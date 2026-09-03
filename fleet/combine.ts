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
//
// ── ADR 0028 (2026-09-02, WORKLIST C63) — the merge class between the two extremes ──
//
// Ramdas–Wang 2025 ch. 8 settles which merges are admissible for which inputs
// (knowledge stats/pages/ramdas-wang-2025.md §2):
//   - ARBITRARY dependence: only weighted arithmetic means (Theorem 8.4). combineAverage.
//   - SEQUENTIAL e-values (E[e_k | e_1..e_{k−1}] ≤ 1): the martingale merging functions
//     ∏ (1 − λ_k + λ_k e_k) with predictable λ_k ∈ [0, 1] (Definition 8.10, Theorem 8.12) —
//     combineMartingale, with the empirically adaptive λ of Example 8.14 (adaptiveLambdas) as
//     the default that needs no alternative in mind, asymptotically log-optimal on iid inputs
//     (Theorem 7.22).
//   - INDEPENDENT e-values: the product ΠK is admissible but is the λ ≡ 1 "all-in" bet — the
//     largest null variance of any exact sequential merge (Proposition 8.16), and Example 8.17's
//     all-in wealth goes to 0 almost surely while its expectation is maximal. combineProduct is
//     therefore GATED: the caller must assert `{ sequential: true }`.

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
export function combineProduct(
  log_e_values: ReadonlyArray<number>,
  opts?: { sequential: true },
): FleetMergeOutput {
  // ADR 0028 — refuse rather than trust a docstring: the product is an e-value only for
  // independent or sequential inputs (Ramdas–Wang 2025 §8.2–8.3), and even then it is the
  // maximum-variance choice (Proposition 8.16). Measurement harnesses that need the raw product
  // call combineProductUnguarded.
  if (opts?.sequential !== true) {
    throw new Error(
      'combineProduct: the product of e-values is an e-value only when they are independent or '
      + 'sequential (E[e_k | e_1..e_{k-1}] <= 1). Pass { sequential: true } to assert that, or '
      + 'use combineAverage (arbitrary dependence) / combineMartingale (sequential, adaptive bet).',
    );
  }
  return combineProductUnguarded(log_e_values);
}

/** The raw product, for measurement harnesses computing observed quantities against labelled
 *  ground truth. Carries no validity claim. */
export function combineProductUnguarded(log_e_values: ReadonlyArray<number>): FleetMergeOutput {
  if (log_e_values.length === 0) {
    throw new Error('combineProduct: empty input array (fleet-merge on N=0 shards is undefined)');
  }
  let sum = 0;
  for (const x of log_e_values) sum += x;
  return { log_fleet_e: sum };
}

/** log((1 − λ) + λ·e) from log e, stable for large |log e|: logaddexp(log(1−λ), log λ + log e). */
function logMix(lambda: number, logE: number): number {
  if (lambda <= 0) return 0;
  if (lambda >= 1) return logE;
  const a = Math.log(1 - lambda);
  const b = Math.log(lambda) + logE;
  const m = a > b ? a : b;
  if (m === -Infinity) return -Infinity;
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/** ADR 0028 — martingale merging (Ramdas–Wang 2025 Definition 8.10):
 *
 *    log ∏_k (1 − λ_k + λ_k e_k),   λ_k ∈ [0, 1] PREDICTABLE (a function of e_1..e_{k−1} only).
 *
 *  An e-value whenever the inputs are sequential e-values (Proposition 8.11); exact when they are
 *  exact. Predictability is the caller's contract — `adaptiveLambdas` satisfies it by construction.
 *  λ ≡ 0 is the constant 1 (no bet); λ ≡ 1 is the product; the arithmetic mean is the λ_k = 1/K
 *  fixed-amount bet. Throws on empty input or a λ outside [0, 1] or a length mismatch. */
export function combineMartingale(
  log_e_values: ReadonlyArray<number>,
  lambdas: ReadonlyArray<number>,
): FleetMergeOutput {
  if (log_e_values.length === 0) {
    throw new Error('combineMartingale: empty input array (fleet-merge on N=0 shards is undefined)');
  }
  if (lambdas.length !== log_e_values.length) {
    throw new Error(`combineMartingale: ${lambdas.length} lambdas for ${log_e_values.length} e-values`);
  }
  let sum = 0;
  for (let k = 0; k < log_e_values.length; k++) {
    const l = lambdas[k];
    if (!(l >= 0 && l <= 1)) throw new Error(`combineMartingale: lambda[${k}] = ${l} outside [0, 1]`);
    sum += logMix(l, log_e_values[k]);
  }
  return { log_fleet_e: sum };
}

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
export function adaptiveLambdas(log_e_values: ReadonlyArray<number>, gamma = 0.5): number[] {
  if (!(gamma > 0 && gamma <= 1)) throw new Error(`adaptiveLambdas: gamma must be in (0, 1], got ${gamma}`);
  const K = log_e_values.length;
  const out = new Array<number>(K);
  if (K === 0) return out;
  out[0] = 0;
  // derivative term of log(1 − λ + λ e) in λ, from log e, stable at both tails:
  //   e ≤ 1: (e − 1)/(1 − λ + λ e)      with e = exp(x);
  //   e > 1: (1 − 1/e)/((1 − λ)/e + λ)  with 1/e = exp(−x)  (→ 1/λ as e → ∞).
  const term = (x: number, l: number): number => {
    if (x <= 0) { const e = Math.exp(x); return (e - 1) / (1 - l + l * e); }
    const r = Math.exp(-x);
    return (1 - r) / ((1 - l) * r + l);
  };
  const g = (l: number, upto: number): number => {
    let s = 0;
    for (let i = 0; i < upto; i++) s += term(log_e_values[i], l);
    return s;
  };
  for (let k = 1; k < K; k++) {
    if (g(0, k) <= 0) { out[k] = 0; continue; }
    if (g(gamma, k) >= 0) { out[k] = gamma; continue; }
    let lo = 0, hi = gamma;
    for (let it = 0; it < 60; it++) {
      const mid = 0.5 * (lo + hi);
      if (g(mid, k) > 0) lo = mid; else hi = mid;
    }
    out[k] = 0.5 * (lo + hi);
  }
  return out;
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
