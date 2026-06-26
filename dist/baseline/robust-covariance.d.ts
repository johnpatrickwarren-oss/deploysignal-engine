/** Lower-triangular Cholesky; returns null if not positive-definite (used as the PSD gate). */
export declare function choleskyLocal(A: ReadonlyArray<ReadonlyArray<number>>): number[][] | null;
export declare function columnMean(rows: ReadonlyArray<ReadonlyArray<number>>): number[];
/** Sample covariance of mean-zero rows Z (n×p). */
export declare function sampleCovariance(Z: ReadonlyArray<ReadonlyArray<number>>): number[][];
/** Mahalanobis distance² (z−mean)ᵀ Σ⁻¹ (z−mean) given Σ's Cholesky L. */
export declare function mahalanobisSqFromL(z: ReadonlyArray<number>, mean: ReadonlyArray<number>, L: ReadonlyArray<ReadonlyArray<number>>): number;
/** Wilson-Hilferty χ²(0.975, p). */
export declare function chiSqQuantile975(p: number): number;
/** Ledoit-Wolf shrinkage toward `μ_diag·I` (mean-zero input Z, n×p). Returns the shrunk cov + intensity λ. */
export declare function ledoitWolfShrinkage(Z: ReadonlyArray<ReadonlyArray<number>>): {
    cov: number[][];
    lambda: number;
};
/** Croux–Haesbroeck (1999) MCD consistency factor `c = α / F_{χ²_{p+2}}(q_{p,α})`; `Σ_corrected = c·Σ_MCD`. */
export declare function consistencyCorrectionFactor(alpha: number, p: number): number;
export interface RobustCovarianceOptions {
    /** MCD coverage (fraction of the cleanest subset kept by the determinant minimiser). Default 0.75. */
    alpha?: number;
    /** PRNG seed for the FastMCD random subsets (deterministic). */
    seed?: number;
    /** Use MCD only when `n ≥ minSamplesPerDim·p`; below it, fall back to Ledoit-Wolf. Default 5. */
    minSamplesPerDim?: number;
}
export interface RobustCovarianceResult {
    mean: number[];
    /** Robust covariance: consistency-corrected reweighted MCD, or Ledoit-Wolf for small/degenerate samples. */
    cov: number[][];
    method: 'mcd' | 'ledoit_wolf';
    /** Fraction of rows dropped as outliers (MCD reweight); 0 for the Ledoit-Wolf path. */
    outlierFraction: number;
    /** Shrinkage intensity when `method === 'ledoit_wolf'`. */
    lambda?: number;
}
/** Robust multivariate mean + covariance with anomaly trimming (the clean-null estimator). FastMCD → reweight
 *  → Croux–Haesbroeck consistency correction when the sample is large enough; Ledoit-Wolf shrinkage otherwise
 *  (or if MCD degenerates). The covariance is the input each per-cell multivariate baseline needs.
 *  @throws RangeError on empty/ragged input. */
export declare function robustCovariance(rows: ReadonlyArray<ReadonlyArray<number>>, opts?: RobustCovarianceOptions): RobustCovarianceResult;
//# sourceMappingURL=robust-covariance.d.ts.map