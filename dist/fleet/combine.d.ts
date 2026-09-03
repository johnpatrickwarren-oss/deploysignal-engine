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
export declare function combineProduct(log_e_values: ReadonlyArray<number>, opts?: {
    sequential: true;
}): FleetMergeOutput;
/** The raw product, for measurement harnesses computing observed quantities against labelled
 *  ground truth. Carries no validity claim. */
export declare function combineProductUnguarded(log_e_values: ReadonlyArray<number>): FleetMergeOutput;
/** ADR 0028 — martingale merging (Ramdas–Wang 2025 Definition 8.10):
 *
 *    log ∏_k (1 − λ_k + λ_k e_k),   λ_k ∈ [0, 1] PREDICTABLE (a function of e_1..e_{k−1} only).
 *
 *  An e-value whenever the inputs are sequential e-values (Proposition 8.11); exact when they are
 *  exact. Predictability is the caller's contract — `adaptiveLambdas` satisfies it by construction.
 *  λ ≡ 0 is the constant 1 (no bet); λ ≡ 1 is the product; the arithmetic mean is the λ_k = 1/K
 *  fixed-amount bet. Throws on empty input or a λ outside [0, 1] or a length mismatch. */
export declare function combineMartingale(log_e_values: ReadonlyArray<number>, lambdas: ReadonlyArray<number>): FleetMergeOutput;
/** ADR 0028 — the empirically adaptive bet (Ramdas–Wang 2025 Example 8.14 / Definition 7.21):
 *
 *    λ_1 = 0;   λ_k = argmax_{λ ∈ [0, γ]} (1/(k−1)) Σ_{s<k} log(1 − λ + λ e_s)   for k ≥ 2.
 *
 *  Each λ_k depends only on e_1..e_{k−1}, so the sequence is predictable and combineMartingale on
 *  it is an e-value for sequential inputs. The objective is concave in λ (a mean of logs of
 *  affine functions), so the maximizer is found by bisection on its derivative
 *  g(λ) = Σ (e_s − 1)/(1 − λ + λ e_s): λ_k = 0 iff the running mean of e_1..e_{k−1} is ≤ 1
 *  (Theorem 3.14 as the text notes), λ_k = γ when g(γ) ≥ 0. γ = 1/2 is the book's uninformative
 *  default; γ = 1 permits the all-in bet. Asymptotically log-optimal on inputs iid under the
 *  alternative (Theorem 7.22). */
export declare function adaptiveLambdas(log_e_values: ReadonlyArray<number>, gamma?: number): number[];
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