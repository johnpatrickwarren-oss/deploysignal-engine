/** Median of a sample (0 for empty). Exported for the detection-oriented common-mode (ADR 0017). */
export declare function median(xs: ReadonlyArray<number>): number;
/** Redescending (Tukey-biweight) robust regression slope through the origin: y_i ≈ b·x_i. IRLS from a
 *  median-ratio start with a MAD scale; gross outliers (in either coordinate) get weight 0. Exported for the
 *  detection-oriented common-mode (ADR 0017). */
export declare function robustSlope(x: ReadonlyArray<number>, y: ReadonlyArray<number>, c?: number): number;
/** Per-shard level ℓ̂_i = median over the healthy calibration window [0, calLen). */
export declare function perShardLevel(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number): number[];
export interface MultiFactorOptions {
    /** Number of shared factors r to remove (default 1 — heterogeneous-loading single common-mode).
     *  MUST match the true factor rank (see the file header): too small inflates FDP, too large silently
     *  destroys power. Use {@link factorDeflationEnergy} to choose it. */
    factors?: number;
}
/** Contamination-robust MULTI-FACTOR residual matrix R[i][t] = X[i][t] − ℓ̂_i − Σ_k λ̂_{ik} F̂_k[t], via an
 *  alternating robust (Tukey-biweight) factor fit. The generalisation of `contaminationRobustResiduals`
 *  to heterogeneous factor loadings; feed each row to the per-shard e-value then e-BH. The FDP ≤ q
 *  guarantee is CONDITIONAL on `factors` matching the true factor rank and a minority fault fraction
 *  (~20% breakdown); see the file header for the honest limits (including the ~40% fault-step absorption
 *  that drives the power cost).
 *
 *  @throws RangeError if `X` is empty, rows are ragged, any value is non-finite, `calLen` is not in
 *    1..ticks, or `factors` is not a positive integer < the shard count. */
export declare function multiFactorRobustResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number, opts?: MultiFactorOptions): number[][];
/** Scree diagnostic for choosing `factors`: the fraction of the level-demeaned Frobenius energy that
 *  each successive robust factor removes (factor 1, 2, …, up to `maxFactors`). A true factor removes a
 *  large fraction; once the per-factor fraction drops to the noise floor (a flat tail), further factors
 *  are spurious and would only destroy power. Pick `factors` at that elbow.
 *
 *  @throws RangeError on an invalid matrix/calLen, or `maxFactors` not in 1..(shards−1). */
export declare function factorDeflationEnergy(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number, maxFactors: number): number[];
//# sourceMappingURL=multi-factor-common-mode.d.ts.map