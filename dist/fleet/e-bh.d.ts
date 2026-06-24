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
//# sourceMappingURL=e-bh.d.ts.map