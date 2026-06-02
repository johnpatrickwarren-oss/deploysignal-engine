/** Wilson-Hilferty χ² quantile: χ²(q, k) ≈ k·(1 − 2/(9k) + z·√(2/(9k)))³
 *  where z = Φ⁻¹(q). Good to ~1% in the right tail for k ≳ 5. */
export declare function chiSquareQuantile(q: number, k: number): number;
/** Compute T² = r^T Σ⁻¹ r via Cholesky. Returns null if Σ is not PSD. */
export declare function hotellingT2(r: number[], covariance: number[][]): number | null;
//# sourceMappingURL=_hotelling-core.d.ts.map