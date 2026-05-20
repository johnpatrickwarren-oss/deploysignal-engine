// engine/ds-integration/freeze-hook-factory.ts — Phase 3 SLICE 3 Wave 10 WU-Phase3-3C (R66).
//
// Freeze-hook activator factory. Owns a mutable FreezeHookState; subscribes
// to a DsEventConsumer's 'activate' stream; exposes a freeze-aware update
// function that delegates to the R20+R21+R36 frozen pure-function freeze-hook
// surface at engine/events/freeze-hook.ts:40 (freezeAwareUpdatePerShardResidual).
//
// Architecturally novel surface vs handoff doc: the CLUSTER-HANDOFF-
// WAVE10-3A-3C.md frames the freeze-hook as a "FreezeHook class with
// constructor + activate/deactivate methods" — empirical reality at R66 spec-
// emit is that freeze-hook.ts exports only an interface (FreezeHookState) +
// a pure function (freezeAwareUpdatePerShardResidual). The factory therefore
// owns the state externally via closure rather than constructing a class.
// See Q-R66-SPEC.md § 0.1 Q0.1.B + § 8 for the handoff inaccuracy
// disclosure.
//
// Tessera-original code. No external dependencies.

import {
  freezeAwareUpdatePerShardResidual,
  type FreezeHookState,
} from '../events/freeze-hook';
// ExtendedSampleObservation is exported from per-shard/runtime, not from
// freeze-hook.ts (which only imports it as a type for its own signature).
// Tactical fix per Q-R66-SPEC.md § 0.1 Q0.1.B note + § 4.2 import annotation.
import type { ExtendedSampleObservation } from '../per-shard/runtime';
import type { PerShardResidual, BaselineCellEntry } from '../types/config';
import type { ClusterEventKind } from '../events/event-feed';
import type { DeployEventPayload } from './event-contract';
import { DsEventConsumer } from './event-consumer';

/** Identity-mapping from wire-format event_class to engine-internal
 *  ClusterEventKind. Compile-time exhaustiveness check via `never` assertion
 *  inherits AC-R62-7 parity discipline: if either union adds a 6th value
 *  without the other being updated, tsc fails to type-check this switch. */
export function mapEventClassToKind(
  event_class: DeployEventPayload['event_class'],
): ClusterEventKind {
  switch (event_class) {
    case 'firmware_push':   return 'firmware_push';
    case 'model_redeploy':  return 'model_redeploy';
    case 'env_change':      return 'env_change';
    case 'config_change':   return 'config_change';
    case 'capacity_change': return 'capacity_change';
    default: {
      const _exhaustive: never = event_class;
      throw new Error(`mapEventClassToKind: unhandled event_class: ${_exhaustive as string}`);
    }
  }
}

/** Factory options. Clock/timer/now are injectable for deterministic testing. */
export interface FreezeHookActivatorOpts {
  /** Source of activation events. */
  consumer: DsEventConsumer;
  /** Passed through to freezeAwareUpdatePerShardResidual on every update(). */
  config?: { freeze_hook_enabled?: boolean };
  /** Default 300. Activation auto-deactivates after this window. */
  activation_window_seconds?: number;
  /** Default globalThis.setTimeout. Injectable for deterministic testing. */
  setTimeout?: (cb: () => void, ms: number) => unknown;
  /** Default globalThis.clearTimeout. */
  clearTimeout?: (handle: unknown) => void;
  /** Default () => Math.floor(Date.now()/1000). Injectable for deterministic testing. */
  now?: () => number;
}

/** Public surface of the factory return value. */
export interface FreezeHookActivator {
  /** Freeze-aware update. Delegates to the frozen pure-function
   *  freezeAwareUpdatePerShardResidual with the factory's mutable state. */
  update(
    current: PerShardResidual,
    obs: ExtendedSampleObservation,
    baselineCell: BaselineCellEntry | undefined,
  ): PerShardResidual;
  /** Read-only snapshot of current FreezeHookState. Tests inspect this. */
  getState(): Readonly<FreezeHookState>;
  /** Cancel any pending deactivation timer and set state.active=false.
   *  Idempotent. Forward-compat for operational early cancellation (e.g.,
   *  future rollback-completed events). */
  cancelActivation(): void;
  /** Unsubscribe from consumer + clear any pending timer. Idempotent. */
  dispose(): void;
}

export function createFreezeHookFromDsEvents(
  opts: FreezeHookActivatorOpts,
): FreezeHookActivator {
  const windowSec = opts.activation_window_seconds ?? 300;
  const setT = opts.setTimeout ?? ((cb, ms) => globalThis.setTimeout(cb, ms));
  const clearT =
    opts.clearTimeout ??
    ((h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>));
  const config = opts.config ?? {};

  const state: FreezeHookState = { active: false };
  let timerHandle: unknown = null;
  let disposed = false;

  const handleActivate = (event: DeployEventPayload): void => {
    if (disposed) return;
    // Verify cross-union parity at runtime as defense-in-depth (the static
    // switch in mapEventClassToKind is the primary compile-time gate).
    void mapEventClassToKind(event.event_class);
    if (timerHandle !== null) clearT(timerHandle);
    state.active = true;
    state.cluster_event_id = event.event_id;
    state.until_ts = event.event_ts + windowSec;
    timerHandle = setT(() => {
      timerHandle = null;
      state.active = false;
    }, windowSec * 1000);
  };

  opts.consumer.on('activate', handleActivate);

  return {
    update(current, obs, baselineCell) {
      return freezeAwareUpdatePerShardResidual(current, obs, baselineCell, state, config);
    },
    getState() {
      return { ...state };
    },
    cancelActivation() {
      if (timerHandle !== null) {
        clearT(timerHandle);
        timerHandle = null;
      }
      state.active = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.consumer.off('activate', handleActivate);
      if (timerHandle !== null) {
        clearT(timerHandle);
        timerHandle = null;
      }
      state.active = false;
    },
  };
}
