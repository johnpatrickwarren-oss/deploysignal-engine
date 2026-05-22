/** Cholesky decomposition A = L L^T for a symmetric PSD matrix A.
 *  Returns null if A is not positive definite (any non-positive diagonal
 *  pivot during reduction). Pure in-place math; allocates one triangular
 *  result. */
export declare function cholesky(A: number[][]): number[][] | null;
/** Solve L y = b for lower-triangular L. */
export declare function forwardSolve(L: number[][], b: number[]): number[];
/** Addition #20 — log(det(A)) via Cholesky. A = L L^T ⇒
 *  det(A) = det(L)² = (Π L_ii)² ⇒ log det(A) = 2 · Σ log L_ii.
 *  Returns null if A is not positive definite. Used by
 *  `tools/calibrate.ts` to precompute `safe_hotelling_params.precompiled_log_det_shrink`
 *  at compile time. */
export declare function logDet(A: number[][]): number | null;
/** Addition #22 (ARCHITECT-REPLY-46 D3) — binary search returning the
 *  smallest index `k` such that `sorted[k] >= target`. Returns
 *  `sorted.length` if no such index exists (target strictly exceeds all
 *  elements). Empty array → 0. O(log n). Pure function.
 *
 *  Used by the Family E weighted e-value detector to rank a live
 *  Mahalanobis score against the calibration distribution: `k`
 *  indexes into a precomputed `cumulative_weights_above[k]` array
 *  giving `Σ_{i ≥ k} weight_i` — the denominator of the conformal
 *  e-value construction per REPLY-46 D3. */
export declare function findFirstGE(sorted: number[], target: number): number;
/** Addition #19 (ARCHITECT-REPLY-35 D4) — standard weighted-quantile.
 *
 *  Sort `(score_i, weight_i)` pairs by `score_i` ascending; return the
 *  smallest `score_k` such that `(Σ_{i≤k} w_i) / (Σ_i w_i) ≥ q`. Ties
 *  resolved conservatively: when the cumulative-weighted fraction equals
 *  `q` at the `k`-th rank, we still return `score_k` (which, because
 *  sort keys stable-tie-break, may equal `score_{k+1}`; the caller fires
 *  strictly above the returned threshold, so equal-to-threshold live
 *  scores don't fire — the safe-side choice).
 *
 *  Edge cases:
 *    - `scores.length === 0` → returns 0 (no calibration; caller must
 *      have already bailed via the underpowered guard).
 *    - `scores.length !== weights.length` → throws; invariant violation.
 *    - `Σw ≤ 0` (degenerate weights) → returns the max score. */
export declare function weightedQuantile(scores: number[], weights: number[], q: number): number;
//# sourceMappingURL=_linalg.d.ts.map