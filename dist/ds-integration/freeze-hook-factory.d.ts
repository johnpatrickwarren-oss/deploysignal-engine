import { type FreezeHookState } from '../events/freeze-hook';
import type { ExtendedSampleObservation } from '../per-shard/runtime';
import type { PerShardResidual, BaselineCellEntry } from '../types/config';
import type { ClusterEventKind } from '../events/event-feed';
import type { DeployEventPayload } from './event-contract';
import { DsEventConsumer } from './event-consumer';
/** Identity-mapping from wire-format event_class to engine-internal
 *  ClusterEventKind. Compile-time exhaustiveness check via `never` assertion
 *  inherits AC-R62-7 parity discipline: if either union adds a 6th value
 *  without the other being updated, tsc fails to type-check this switch. */
export declare function mapEventClassToKind(event_class: DeployEventPayload['event_class']): ClusterEventKind;
/** Factory options. Clock/timer/now are injectable for deterministic testing. */
export interface FreezeHookActivatorOpts {
    /** Source of activation events. */
    consumer: DsEventConsumer;
    /** Passed through to freezeAwareUpdatePerShardResidual on every update(). */
    config?: {
        freeze_hook_enabled?: boolean;
    };
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
    update(current: PerShardResidual, obs: ExtendedSampleObservation, baselineCell: BaselineCellEntry | undefined): PerShardResidual;
    /** Read-only snapshot of current FreezeHookState. Tests inspect this. */
    getState(): Readonly<FreezeHookState>;
    /** Cancel any pending deactivation timer and set state.active=false.
     *  Idempotent. Forward-compat for operational early cancellation (e.g.,
     *  future rollback-completed events). */
    cancelActivation(): void;
    /** Unsubscribe from consumer + clear any pending timer. Idempotent. */
    dispose(): void;
}
export declare function createFreezeHookFromDsEvents(opts: FreezeHookActivatorOpts): FreezeHookActivator;
//# sourceMappingURL=freeze-hook-factory.d.ts.map