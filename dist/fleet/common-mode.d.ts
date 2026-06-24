/** Tukey-biweight tuning constant: 95% efficiency at the Gaussian; the ψ-function redescends to 0
 *  beyond C·scale. (Tessera ADR 0015 TUKEY_C.) */
export declare const TUKEY_C = 4.685;
/** Redescending (Tukey-biweight) M-estimator of location: IRLS from a high-breakdown median start with
 *  a fixed MAD scale. Any point beyond `c`·scale gets weight exactly 0, so a minority of gross outliers
 *  is fully rejected (breakdown toward the theoretical ≈50%, vs Huber's leakage that biases the center
 *  under heavy contamination). Returns the median for an empty sample or a fully-rejected (pathological)
 *  cross-section.
 *
 *  @param xs    the sample (a per-tick cross-section of level-adjusted shard values, in the fleet use).
 *  @param c     biweight tuning constant; defaults to {@link TUKEY_C}. Must be > 0. */
export declare function robustLocation(xs: ReadonlyArray<number>, c?: number): number;
/** Per-shard level (fixed effect) ℓ̂_i = MEDIAN over the healthy calibration window [0, calLen) of each
 *  shard's row. (A median, not the Tukey {@link robustLocation} — the per-shard level only needs the
 *  median's breakdown, and the cross-sectional contamination is handled by the robust center.) */
export declare function perShardLevel(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number): number[];
/** Contamination-robust residual matrix: R[i][t] = X[i][t] − ℓ̂_i − c_t, where ℓ̂_i is the per-shard
 *  calibration level and c_t is the redescending (Tukey-biweight) common-mode of the level-adjusted
 *  cross-section at tick t. Feed each residual row to {@link nuisanceRobustBFEValue} then e-BH for the
 *  FP/FDR-by-construction pipeline (see file header + envelope/conditions there).
 *
 *  `X` is a shards×ticks matrix (every row the same length, all values finite); `calLen` is the healthy
 *  calibration window used for the per-shard level. The cross-sectional center is computed over ALL ticks.
 *
 *  @throws RangeError if `X` is empty, rows are ragged, any value is non-finite, or `calLen` is not in
 *    1..ticks. (Finiteness is guarded here — like the sibling {@link nuisanceRobustBFEValue} — so a NaN
 *    does not propagate silently through the residual matrix into the e-value.) */
export declare function contaminationRobustResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number): number[][];
//# sourceMappingURL=common-mode.d.ts.map