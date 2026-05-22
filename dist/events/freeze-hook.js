"use strict";
// engine/events/freeze-hook.ts — Tessera Phase 2 SLICE 4 (R34) WU-06 Surface 3.
//
// Phase 1 freeze-hook activation coupling. Wraps the inherited Phase 1
// per-shard runtime composition (updatePerShardResidual at
// engine/per-shard/runtime.ts:82); when freezeState.active AND
// config.freeze_hook_enabled, returns current residual unchanged so the
// event-driven drift is NOT absorbed into per-shard residual during the
// post-event window.
//
// Tessera-original code. See Q-R34-SPEC § 0.2 for empirical-premise
// correction (no pre-engineered freeze-hook substrate existed in inherited
// Phase 1 code; this wrapper introduces the surface). Extract target:
// Tessera Phase 2 close.
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezeAwareUpdatePerShardResidual = freezeAwareUpdatePerShardResidual;
const runtime_1 = require("../per-shard/runtime");
/** Freeze-aware wrapper around updatePerShardResidual.
 *
 *  Decision matrix:
 *    config.freeze_hook_enabled  freezeState.active  Behavior
 *    true                        true                Returns `current` unchanged (FREEZE).
 *    true                        false               Delegates to updatePerShardResidual.
 *    false (or absent)           any                 Delegates to updatePerShardResidual.
 *
 *  Pure function: no mutation of inputs. */
function freezeAwareUpdatePerShardResidual(current, obs, baselineCell, freezeState, config) {
    if (config.freeze_hook_enabled === true && freezeState.active === true) {
        return current;
    }
    return (0, runtime_1.updatePerShardResidual)(current, obs, baselineCell);
}
//# sourceMappingURL=freeze-hook.js.map