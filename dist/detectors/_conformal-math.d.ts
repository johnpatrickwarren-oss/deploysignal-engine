/** Mahalanobis distance √(r^T Σ⁻¹ r). Returns null if Σ is not PD.
 *  Exported so the compiler can precompute calibration scores with the
 *  same scoring function the detector uses at query time. */
export declare function mahalanobisDistance(r: number[], covariance: number[][]): number | null;
/** Relative-deviation vector (x − μ) ./ μ, matching Family C's
 *  standardization. Falls back to additive (x − μ) when μ_i ≈ 0. */
export declare function relativeDeviation(x: number[], mean: number[]): number[];
/** Conformal p-value: (#{ s_c ≥ s_query } + 1) / (n_calibration + 1).
 *  `+1` in numerator and denominator makes this a valid (exchangeable)
 *  p-value even on exact ties. */
export declare function conformalPValue(queryScore: number, calibrationScores: number[]): number;
//# sourceMappingURL=_conformal-math.d.ts.map