"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEventClassToKind = mapEventClassToKind;
exports.createFreezeHookFromDsEvents = createFreezeHookFromDsEvents;
const freeze_hook_1 = require("../events/freeze-hook");
/** Identity-mapping from wire-format event_class to engine-internal
 *  ClusterEventKind. Compile-time exhaustiveness check via `never` assertion
 *  inherits AC-R62-7 parity discipline: if either union adds a 6th value
 *  without the other being updated, tsc fails to type-check this switch. */
function mapEventClassToKind(event_class) {
    switch (event_class) {
        case 'firmware_push': return 'firmware_push';
        case 'model_redeploy': return 'model_redeploy';
        case 'env_change': return 'env_change';
        case 'config_change': return 'config_change';
        case 'capacity_change': return 'capacity_change';
        case 'chaos_experiment': return 'chaos_experiment';
        default: {
            const _exhaustive = event_class;
            throw new Error(`mapEventClassToKind: unhandled event_class: ${_exhaustive}`);
        }
    }
}
function createFreezeHookFromDsEvents(opts) {
    const windowSec = opts.activation_window_seconds ?? 300;
    const setT = opts.setTimeout ?? ((cb, ms) => globalThis.setTimeout(cb, ms));
    const clearT = opts.clearTimeout ??
        ((h) => globalThis.clearTimeout(h));
    const config = opts.config ?? {};
    const state = { active: false };
    let timerHandle = null;
    let disposed = false;
    const handleActivate = (event) => {
        if (disposed)
            return;
        // Verify cross-union parity at runtime as defense-in-depth (the static
        // switch in mapEventClassToKind is the primary compile-time gate).
        void mapEventClassToKind(event.event_class);
        if (timerHandle !== null)
            clearT(timerHandle);
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
            return (0, freeze_hook_1.freezeAwareUpdatePerShardResidual)(current, obs, baselineCell, state, config);
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
            if (disposed)
                return;
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
//# sourceMappingURL=freeze-hook-factory.js.map