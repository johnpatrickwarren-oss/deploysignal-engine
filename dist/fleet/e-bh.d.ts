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
    /** Realized selection threshold, in the LOG domain: log(N / (q · max(K, 1))).
     *
     *  The selection rule K · e_(K) ≥ N/q means every selected shard has
     *  e ≥ N/(qK) and — because R is the LARGEST such k — every unselected
     *  shard has e < N/(qK) (if e_(K+1) ≥ N/(qK) then (K+1)·e_(K+1) > N/q and
     *  R would be ≥ K+1). So this single number separates the selected set
     *  exactly: `selected` is precisely the indices with log_margin ≥ 0
     *  (ties at the boundary are selected). With K = 0 it is log(N/q), the
     *  value the largest e-value would have needed.
     *
     *  DIAGNOSTIC, NOT A GUARANTEE (ramdas-2023 §6.2; knowledge
     *  stats/e-betting-metrics-2026-09-02 option 3): the threshold is
     *  data-dependent — it moves with K — so a shard's distance to it is a
     *  statement about THIS snapshot's ranking, not a certified quantity.
     *  The FDR claim is unchanged and still rests on the inputs being
     *  e-values (see the validity contract on eBenjaminiHochberg). */
    log_threshold_e: number;
    /** Per-input log-margin to the realized threshold, index-aligned with
     *  the input array: log(e_i) − log_threshold_e. ≥ 0 iff selected.
     *  JSON-safe: a zero e-value (log = −∞) is floored at −LOG_MAX_WEALTH so
     *  the surface never carries −Infinity (the ADR 0026 convention). */
    log_margin: ReadonlyArray<number>;
}
/** Run the e-BH FDR procedure on N per-shard linear-space e-values at FDR
 *  target q.
 *
 *  See file header for the procedure definition and FDR-control guarantee.
 *
 *  VALIDITY CONTRACT (ADR 0004 PR E): e-BH operates on bare e-value numbers and
 *  CANNOT see their provenance, so it TRUSTS the caller to have passed only e-values
 *  that are VALID under their baseline regime. FDR ≤ q holds only if E[e_i|H0] ≤ 1
 *  for every input; a plug-in betting/mixture e-value under an estimated baseline has
 *  E[e|H0] ≫ 1 and silently breaks the guarantee. Gate inputs with
 *  detectors/validity-envelope.ts:assertValidForFdrPath before calling this, and use
 *  fleet/guarantee.ts:assembleFleetGuaranteeConditions to surface the conditions in the
 *  verdict. The contract is enforced at that verdict-assembly layer, not inside e-BH.
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
export declare function eBenjaminiHochberg(perShardEValues: ReadonlyArray<number>, qLevel: number): EBenjaminiHochbergOutput;
/** ADR 0026 — run the e-BH procedure on LOG-space per-shard e-values.
 *
 *  Identical procedure to eBenjaminiHochberg with the selection condition
 *  rewritten in the log domain: k · e_(k) ≥ N/q  ⇔  log k + logE_(k) ≥ log(N/q).
 *  For in-range inputs the two agree (modulo final-ulp rounding of the
 *  comparison, asserted by the equivalence test); for log e-values beyond
 *  ~709.78 the linear procedure sees indistinguishable ties at Infinity while
 *  this variant preserves the true ordering. Consumers that keep e-values in
 *  the log domain end-to-end (combineAverage output; product-side per-leaf
 *  log e-values) should call this and never round-trip through exp.
 *
 *  Same validity contract, throws, and input-invariance as eBenjaminiHochberg.
 */
export declare function eBenjaminiHochbergLog(perShardLogEValues: ReadonlyArray<number>, qLevel: number): EBenjaminiHochbergOutput;
//# sourceMappingURL=e-bh.d.ts.map