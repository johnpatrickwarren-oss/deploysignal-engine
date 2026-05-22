import { type ExtendedSampleObservation } from '../per-shard/runtime';
import type { PerShardResidual, BaselineCellEntry } from '../types/config';
export interface FreezeHookState {
    /** True when the per-shard baseline accumulation should be paused. */
    active: boolean;
    /** Optional epoch-seconds expiry; informational only — wrapper does NOT
     *  compare to current time. Caller controls active transition. */
    until_ts?: number;
    /** Optional ClusterEvent.event_id that drove this freeze. Informational. */
    cluster_event_id?: string;
}
/** Freeze-aware wrapper around updatePerShardResidual.
 *
 *  Decision matrix:
 *    config.freeze_hook_enabled  freezeState.active  Behavior
 *    true                        true                Returns `current` unchanged (FREEZE).
 *    true                        false               Delegates to updatePerShardResidual.
 *    false (or absent)           any                 Delegates to updatePerShardResidual.
 *
 *  Pure function: no mutation of inputs. */
export declare function freezeAwareUpdatePerShardResidual(current: PerShardResidual, obs: ExtendedSampleObservation, baselineCell: BaselineCellEntry | undefined, freezeState: FreezeHookState, config: {
    freeze_hook_enabled?: boolean;
}): PerShardResidual;
//# sourceMappingURL=freeze-hook.d.ts.map