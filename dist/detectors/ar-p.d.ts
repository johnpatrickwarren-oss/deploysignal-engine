/** Lag-k sample autocovariance γ̂_k = (1/N) Σ_{t=0..N-k-1} (x_t − μ)(x_{t+k} − μ).
 *  Uses the supplied `mean` (typically the probationary baseline mean)
 *  rather than recomputing from the input — keeps the autocovariance
 *  in the same frame as the detector's mean-centering convention. */
export declare function sampleAutocovariance(x: number[], mean: number, k: number): number;
/** Compute the autocovariance sequence γ̂_0, γ̂_1, ..., γ̂_p in a single pass. */
export declare function autocovarianceSequence(x: number[], mean: number, p: number): number[];
/** Levinson-Durbin recursion: solve the Yule-Walker normal equations
 *  Γ_p · φ = γ̂_{1..p} for AR(p) coefficients in O(p²).
 *
 *  Returns:
 *    - `phi[i] = φ_{i+1}` (1-indexed math, 0-indexed array)
 *    - `sigma2_innovation = γ̂_0 · ∏(1 − k_j²)` (Burg-style innovation
 *      variance, equivalent to γ̂_0 − Σ φ_i γ̂_i for the fitted AR(p))
 *    - `reflection_coefficients = k_1..k_p` (partial autocorrelations;
 *      |k_j| ≤ 1 for stationary AR(p))
 *
 *  Stability: the recursion guarantees |k_j| ≤ 1 under H₀; if any
 *  |k_j| > 1 the input autocovariance sequence is non-positive-
 *  definite and the AR fit is unstable — caller should fall back to
 *  a lower order. */
export declare function yuleWalkerLevinson(autocovariances: number[]): {
    phi: number[];
    sigma2_innovation: number;
    reflection_coefficients: number[];
};
/** Fit AR(p) for p ∈ [1, p_max] and return the AIC-optimal model.
 *
 *  AIC(p) = N · log(σ̂²_p) + 2p; BIC(p) = N · log(σ̂²_p) + log(N) · p
 *
 *  P3 derivation per spec § ASK 1: AIC matches the standard time-series
 *  ML choice; BIC's `log(N)·p` is more conservative and underfits on
 *  the N≈600 probationary windows typical of NAB calibration.
 *
 *  Returns the AIC-optimal p̂, the fitted φ vector, the innovation
 *  variance σ̂², the full criterion trace for diagnostics, AND the
 *  reflection coefficients of the chosen model (useful for stability
 *  validation in callers). */
export declare function fitArP(values: number[], mean: number, options?: {
    p_max?: number;
    ic?: 'aic' | 'bic';
}): {
    p: number;
    phi: number[];
    sigma2_innovation: number;
    ic_trace: number[];
    ic_kind: 'aic' | 'bic';
    reflection_coefficients: number[];
};
/** Apply multi-lag AR(p) pre-whitening to a series.
 *
 *  For each tick t:
 *    residual_t = (x_t − μ) − Σ_{i=1..p} φ_i · (x_{t−i} − μ)
 *
 *  For t < p, the unavailable past observations are treated as 0
 *  (their centered deviation; equivalent to assuming the series began
 *  at its mean). This is the standard finite-sample convention; the
 *  warm-up bias decays after p ticks.
 *
 *  Returns the residuals re-centered by adding μ back, so downstream
 *  detectors (which mean-center against the same baseline) consume
 *  `r_t = (residual_t)` as their effective `(x − μ)`. Identity when
 *  phi is empty.
 *
 *  Matches the SLICE 5 `prewhitenSeries` convention (re-add μ) so this
 *  helper is a drop-in replacement at p=1. */
export declare function prewhitenAr(values: number[], mean: number, phi: number[]): number[];
//# sourceMappingURL=ar-p.d.ts.map