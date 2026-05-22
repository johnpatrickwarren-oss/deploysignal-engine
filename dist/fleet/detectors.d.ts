import type { BettingEProcessState } from '../types/families/a';
import type { FamilyCBettingEProcessState } from '../types/families/c';
import { type FleetEProcessState, type FleetMergeOutput } from './combine';
/** Function-signature alias for the caller-supplied combination primitive.
 *  Matches exactly the signature of R11's combineProduct + combineAverage
 *  exports at engine/fleet/combine.ts:63 + :87. Caller picks per the
 *  operating regime (option (a) caller-selection mechanism; see file
 *  header for the conditional-independence-assumption + compensating-control
 *  responsibility split). */
export type CombinePrimitive = (xs: ReadonlyArray<number>) => FleetMergeOutput;
/** Result of a single fleet-merge step. Carries both the fleet log-e-value
 *  (convenience alias for fleet_state.log_fleet_e_t post-update) AND the
 *  same fleet_state reference (in-place mutation contract; explicit
 *  ergonomic for callers that chain across ticks). */
export interface FleetMergeStepResult {
    log_fleet_e: number;
    fleet_state: FleetEProcessState;
}
/** Fleet-merged Family A detector surface. Extracts Math.log(Math.max(
 *  state.M, WEALTH_FLOOR)) from each per-shard BettingEProcessState
 *  (engine/types/families/a.ts:20), calls the caller-supplied combination
 *  primitive, updates the fleet wealth tracker.
 *
 *  Pure with respect to per-shard inputs: reads only state.M; does NOT
 *  mutate any field of any per_shard_states[i].
 *
 *  In-place mutates fleet_state per R11 convention; returns the same
 *  reference in FleetMergeStepResult.fleet_state.
 *
 *  Throws (via the primitive) when per_shard_states is empty.
 *
 *  Caller-selection responsibility: picks primitive = combineProduct (PoE)
 *  under iid-assumption-evidence; primitive = combineAverage (AoE) when
 *  correlated drift cannot be ruled out (Vovk-Wang 2021 §4; R11 PR-F1
 *  evidence at test/q11-hierarchical-e-value-combination.test.ts AC-13..16). */
export declare function fleetMergeFamilyA(per_shard_states: ReadonlyArray<BettingEProcessState>, primitive: CombinePrimitive, fleet_state: FleetEProcessState, log_threshold: number): FleetMergeStepResult;
/** Fleet-merged Family C detector surface. Reads state.log_S_t directly
 *  from each per-shard FamilyCBettingEProcessState (engine/types/families/c.ts:297).
 *  The Family C wealth is already stored in log-space per the inherited
 *  engine convention (engine/types/families/c.ts:298-299 JSDoc: "Wealth
 *  process S_t (multiplicative). Stored in log-space as log_S_t for numerical
 *  stability"); no Math.log call or floor is applied.
 *
 *  Pure with respect to per-shard inputs: reads only state.log_S_t; does
 *  NOT mutate any field of any per_shard_states[i].
 *
 *  In-place mutates fleet_state per R11 convention; returns the same
 *  reference in FleetMergeStepResult.fleet_state.
 *
 *  Throws (via the primitive) when per_shard_states is empty.
 *
 *  Caller-selection responsibility: same as fleetMergeFamilyA. */
export declare function fleetMergeFamilyC(per_shard_states: ReadonlyArray<FamilyCBettingEProcessState>, primitive: CombinePrimitive, fleet_state: FleetEProcessState, log_threshold: number): FleetMergeStepResult;
//# sourceMappingURL=detectors.d.ts.map