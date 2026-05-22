import type { FleetEProcessState } from '../types/fleet';
export type { FleetEProcessState };
/** Output shape of the fleet-merge primitives. Wrapped in an object (rather
 *  than returning a bare `number`) for future extensibility — e.g., R12+ may
 *  add a `compensating_control_engaged: boolean` field for the e-BH operator
 *  surface. R11 ships the minimal shape. */
export interface FleetMergeOutput {
    /** Log of the fleet e-value at this tick — combined across the N per-shard
     *  log-e-values supplied to the primitive. */
    log_fleet_e: number;
}
/** Product-of-e-values combination (PoE). Ville-preserved IFF per-shard
 *  e-processes are conditionally independent given F_{t-1}. Throws on empty input.
 *
 *  Formula: log_fleet_e = Σ_i log_e_values[i].
 *
 *  Caller responsibility: ensure the conditional-independence assumption holds
 *  for the operating regime. Under correlated drift (firmware push, synchronized
 *  model redeploy), the cond.-indep. assumption is VIOLATED and the fleet Ville
 *  bound is NOT guaranteed; switch caller to combineAverage as the compensating
 *  control. Vovk-Wang 2021 §4.
 */
export declare function combineProduct(log_e_values: ReadonlyArray<number>): FleetMergeOutput;
/** Average-of-e-values combination (AoE). Ville-preserved under arbitrary
 *  dependence (no independence assumption required). Throws on empty input.
 *
 *  Formula: log_fleet_e = logSumExp(log_e_values) − log(N), implemented via
 *  the canonical numerically-stable max-shift form to avoid overflow when
 *  individual log-e-values are large.
 *
 *  Vovk-Wang 2021 §4 convex-combination result: convex combinations (uniform-average is
 *  the canonical instance) of e-values are e-values under arbitrary dependence.
 *  By the Ville inequality, P(sup_t fleet_e_t ≥ 1/α) ≤ α at the fleet level.
 *
 *  Conditional-independence-ROBUST: appropriate for operating regimes where
 *  correlated drift cannot be ruled out (the production default at R12+ e-BH
 *  consumer; R11 ships both primitives for caller selection).
 */
export declare function combineAverage(log_e_values: ReadonlyArray<number>): FleetMergeOutput;
/** Fresh fleet-level e-process state. fleet e_0 = 1 ⇒ log_e_0 = 0; no fires yet. */
export declare function freshFleetEProcessState(): FleetEProcessState;
/** Update the fleet wealth tracker with a new fleet log-e-value at the current
 *  tick. Mutates state in-place (matches inherited engine convention; see file
 *  header). Returns the same state reference for ergonomic chaining.
 *
 *  log_threshold = Math.log(1 / α_fleet). At α_fleet=0.01 the threshold is
 *  ≈ 4.605; at α_fleet=10⁻³ it is ≈ 6.908.
 *
 *  Sticky-fire: once log_fleet_e_max ≥ log_threshold at any tick, state.fired
 *  remains true. tick_at_first_fire records the first crossing.
 */
export declare function updateFleetEProcessState(state: FleetEProcessState, log_fleet_e_t: number, log_threshold: number): FleetEProcessState;
//# sourceMappingURL=combine.d.ts.map