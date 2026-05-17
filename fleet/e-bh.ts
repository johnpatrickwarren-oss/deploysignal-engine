// engine/fleet/e-bh.ts — Tessera SLICE 4 (R13): e-Benjamini-Hochberg FDR
// operator surface for per-shard e-values.
//
// Operator-facing API:
//
//   eBenjaminiHochberg(perShardEValues, qLevel) → { selected, K }
//
// Implements the Ren-Barber 2024 e-BH procedure (Algorithm 1; equivalent
// to Wang-Ramdas 2022 e-BH; theoretically grounded in Vovk-Wang 2021 §4).
// Given N per-shard linear-space e-values e_1, ..., e_N and an FDR target
// q ∈ (0, 1]:
//
//   1. Sort indices by e-value descending; tie-break by index ascending
//      for determinism. (Standard e-BH does not specify tie-breaking;
//      any deterministic rule preserves the FDR-control theorem.)
//   2. Let e_(1) ≥ e_(2) ≥ ... ≥ e_(N) be the sorted e-values.
//   3. Find R = max{k ∈ {1, ..., N} : k · e_(k) ≥ N / q}; if no such k
//      exists, R = 0.
//   4. Return the R indices corresponding to the R largest e-values
//      (sorted ascending in the result for caller ergonomics) and K = R.
//
// FDR-control guarantee (Wang-Ramdas 2022 Theorem 4.1; Ren-Barber 2024 §2):
// if each e_i is a valid e-value under H_{0,i} (i.e., E[e_i | H_{0,i}] ≤ 1),
// then FDR = E[#false / max(K, 1)] ≤ q · N_0/N ≤ q, where N_0 is the
// number of true H_0 hypotheses. The bound holds under ARBITRARY DEPENDENCE
// between e-values (no independence assumption required). This is the
// fundamental property distinguishing e-BH from p-value-based BH: the
// e-value structure preserves FDR even under correlated drift across shards.
//
// Operator-facing claim: K shards flagged; expected number of falsely-
// flagged shards ≤ q · K under the operator's null model.
//
// Architectural position (per Q-J1 hybrid framing in
// ARCHITECT-REPLY-v0.3-PRE-DISPOSITION.md): e-BH is the operator-facing
// FDR interface, PARALLEL to the fleet-merge Ville-bound interface at
// engine/fleet/combine.ts (R11) + engine/fleet/detectors.ts (R12). Both
// consume the same per-shard e-values; they are NOT chained. The Ville
// layer provides the formal any-time guarantee; the e-BH layer provides
// the operator-facing K-shards-flagged surface.
//
// MD-F2 (load-bearing per SCOPING-MEMO-v0.3 § 2.1 + Q-J1): SLICE 4 ships
// the FIXED-TIME e-BH procedure (decision at a single time point T). The
// ANY-TIME analog (Wang-Ramdas-Vovk 2022 e-process selection under any-
// time FDR; arXiv:2009.02824 streaming variant) is deferred to a future
// SLICE. Documented here as an explicit Tessera-design tradeoff, not
// silent absorption.
//
// Default qLevel: NONE. qLevel is a required positional parameter.
// Rationale: the operator-facing claim "E[#false-flagged-shards] ≤ q · K"
// directly couples the operator's policy decision (acceptable false-
// discovery fraction) to the procedure output; a silent default risks
// misalignment. Canonical literature values are q = 0.05 (classical FDR
// target per BH 1995) and q = 0.10 (less conservative). Both are valid
// operator choices; neither is a Tessera default.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the
// shared npm package at Tessera Phase 2 close per SCOPING-MEMO-v0.3 § 9.

/** Output shape of the e-BH procedure. Wrapped in an object (rather than
 *  returning a bare `number[]`) for forward compatibility — future SLICEs
 *  may add fields (e.g., `threshold_e` for diagnostics) without breaking
 *  callers. R13 ships the minimal shape. Mirrors the R11 FleetMergeOutput /
 *  R12 FleetMergeStepResult wrapping convention. */
export interface EBenjaminiHochbergOutput {
  /** 0-based indices of the selected shards (the K shards with the
   *  largest e-values). Sorted ascending for caller ergonomics.
   *  Length === K. */
  selected: ReadonlyArray<number>;
  /** Number of selected shards. Operator-facing K in the FDR claim
   *  "expected falsely-flagged shards ≤ q · K." Equals selected.length. */
  K: number;
}

/** Run the e-BH FDR procedure on N per-shard linear-space e-values at FDR
 *  target q.
 *
 *  See file header for the procedure definition and FDR-control guarantee.
 *
 *  Throws:
 *    - if perShardEValues.length === 0 (N=0 shards is structurally
 *      undefined; mirrors R11 combineProduct/combineAverage empty-input
 *      convention at engine/fleet/combine.ts:64-66, 88-90).
 *    - if qLevel ≤ 0 or qLevel > 1 (invalid FDR target). The single
 *      conjunctive guard `qLevel > 0 && qLevel <= 1` handles NaN and
 *      undefined uniformly (any comparison against NaN/undefined returns
 *      false).
 *
 *  Per-input invariance: does NOT mutate perShardEValues. The sort and
 *  selection operate on an internal indexed copy. */
export function eBenjaminiHochberg(
  perShardEValues: ReadonlyArray<number>,
  qLevel: number,
): EBenjaminiHochbergOutput {
  const N = perShardEValues.length;
  if (N === 0) {
    throw new Error('eBenjaminiHochberg: empty input array (N=0 shards is undefined)');
  }
  if (!(qLevel > 0 && qLevel <= 1)) {
    throw new Error(`eBenjaminiHochberg: qLevel must be in (0, 1]; got ${qLevel}`);
  }
  // Build indexed pairs and sort by e-value DESC, ties broken by index ASC.
  // Standard e-BH does not specify tie-breaking; any deterministic rule
  // preserves the FDR-control theorem.
  const indexed: Array<{ e: number; idx: number }> = [];
  for (let i = 0; i < N; i++) {
    indexed.push({ e: perShardEValues[i], idx: i });
  }
  indexed.sort((a, b) => {
    if (b.e !== a.e) return b.e - a.e;
    return a.idx - b.idx;
  });
  // Find R = max k in [1, N] with k · e_(k) ≥ N / q. Step down from k=N.
  // The multiplicative form k · e_(k) avoids dividing by zero in the
  // degenerate case where k iterates over zero (we never index k=0 here,
  // but k * e_(k) is also numerically cleaner than e_(k) ≥ N / (k · q)).
  const N_over_q = N / qLevel;
  let R = 0;
  for (let k = N; k >= 1; k--) {
    if (k * indexed[k - 1].e >= N_over_q) {
      R = k;
      break;
    }
  }
  // Selected indices = first R entries in DESC-sorted order; re-sort ASC
  // for caller-ergonomic output ordering (operators consume shard indices
  // typically in their original numeric order).
  const selected: number[] = [];
  for (let r = 0; r < R; r++) {
    selected.push(indexed[r].idx);
  }
  selected.sort((a, b) => a - b);
  return { selected, K: R };
}
