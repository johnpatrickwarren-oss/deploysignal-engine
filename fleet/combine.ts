// engine/fleet/combine.ts — Tessera SLICE 3 (R11): hierarchical e-value combination primitives.
//
// Two family-agnostic stateless reduces over log-space per-shard e-values:
//
//   combineProduct (PoE): log(∏ e_i) = Σ log e_i.
//     Ville-preserved at fleet level IFF per-shard e-processes are conditionally
//     independent given F_{t-1} (cluster-state history). Power-optimal under
//     independence; conditional-independence-assumption-VIOLATED under correlated
//     drift (firmware push / synchronized model redeploy). Vovk-Wang 2021 §4.
//
//   combineAverage (AoE): log((1/N) Σ e_i) = logSumExp(log_e) − log(N).
//     Ville-preserved at fleet level under ARBITRARY DEPENDENCE (no independence
//     assumption). Lower power than PoE under independence; conditional-
//     independence-ROBUST under correlated drift. Vovk-Wang 2021 §4 convex-combination result
//     (uniform-convex-combination preserves e-value property under arbitrary
//     dependence).
//
// Operator-selection contract: caller picks combineProduct OR combineAverage per
// expected correlation regime. R11 does NOT auto-select. Future R12+ e-BH FDR
// operator surface (engine/fleet/e-bh.ts; Tessera SLICE 4) consumes combineAverage
// for its arbitrary-dependence FDR guarantee.
//
// PR-F1 evidence matrix (test/q11-hierarchical-e-value-combination.test.ts) empirically
// validates the four (primitive × scenario) cells at N=100 shards × T=100 ticks ×
// N_traj=200 fleet trajectories per cell. Three preserved cells (PoE-iid, AoE-iid,
// AoE-correlated) assert observed FPR ≤ Wilson-CI upper bound; PoE-correlated cell
// is REPORTING-only (documents the OBSERVED FPR for the pair-review record; does
// NOT bind to the observed value).
//
// Numerical stability: log-space throughout. combineAverage uses logSumExp with
// max-shift (canonical numerically-stable form). combineProduct is a plain sum.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close per SCOPING-MEMO-v0.3 § 9.

import type { FleetEProcessState } from '../types/fleet';

// Re-exported for caller ergonomic (q11 + future R12+ consumers pull both
// runtime functions AND the state type from a single module path).
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
export function combineProduct(log_e_values: ReadonlyArray<number>): FleetMergeOutput {
  if (log_e_values.length === 0) {
    throw new Error('combineProduct: empty input array (fleet-merge on N=0 shards is undefined)');
  }
  let sum = 0;
  for (const x of log_e_values) sum += x;
  return { log_fleet_e: sum };
}

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
export function combineAverage(log_e_values: ReadonlyArray<number>): FleetMergeOutput {
  if (log_e_values.length === 0) {
    throw new Error('combineAverage: empty input array (fleet-merge on N=0 shards is undefined)');
  }
  // logSumExp with max-shift for numerical stability.
  let max_x = -Infinity;
  for (const x of log_e_values) if (x > max_x) max_x = x;
  let sum_exp = 0;
  for (const x of log_e_values) sum_exp += Math.exp(x - max_x);
  const log_sum_exp = max_x + Math.log(sum_exp);
  const log_avg = log_sum_exp - Math.log(log_e_values.length);
  return { log_fleet_e: log_avg };
}

/** Fresh fleet-level e-process state. fleet e_0 = 1 ⇒ log_e_0 = 0; no fires yet. */
export function freshFleetEProcessState(): FleetEProcessState {
  return {
    log_fleet_e_t: 0,
    log_fleet_e_max: 0,
    n: 0,
    fired: false,
    tick_at_first_fire: null,
  };
}

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
export function updateFleetEProcessState(
  state: FleetEProcessState,
  log_fleet_e_t: number,
  log_threshold: number,
): FleetEProcessState {
  state.log_fleet_e_t = log_fleet_e_t;
  if (log_fleet_e_t > state.log_fleet_e_max) {
    state.log_fleet_e_max = log_fleet_e_t;
  }
  const tick_post = state.n;  // pre-increment value used as the 0-based tick index
  state.n += 1;
  if (!state.fired && state.log_fleet_e_max >= log_threshold) {
    state.fired = true;
    state.tick_at_first_fire = tick_post;
  }
  return state;
}
