/** Detect the dominant period in a series via ACF peak search.
 *
 *  Algorithm:
 *    1. Compute ACF(k) for k ∈ [min_period, max_period]
 *    2. Find the first local maximum: k* where ACF(k*) > ACF(k*-1)
 *       AND ACF(k*) > ACF(k*+1)
 *    3. If ACF(k*) ≥ min_acf, return k* (the dominant period)
 *    4. Else return 0 (no strong periodic structure detected)
 *
 *  Defaults:
 *    - min_period = 10 (shorter lags are autocorrelation, not periodicity)
 *    - max_period = floor(N/3) (need ≥ 3 periods to estimate seasonal
 *      means reliably; per SLICE 9 spec § ASK 2)
 *    - min_acf = 0.25 (conservative; only strong periodicity triggers
 *      decomposition; per spec § ASK 1) */
export declare function detectDominantPeriod(values: number[], mean: number, options?: {
    min_period?: number;
    max_period?: number;
    min_acf?: number;
}): {
    period: number;
    acf_at_period: number;
};
/** Compute per-phase seasonal means for a series of given period.
 *
 *  s[p] = (1/n_p) · Σ_{t : t mod P = p} (values[t] − baselineMean)
 *
 *  Returns the array of seasonal residuals s[0], s[1], ..., s[P-1].
 *  Sum of s ≈ 0 by construction (since baselineMean cancels). When a
 *  phase has zero observations in the input (shouldn't happen for the
 *  probationary use case but defensive), its s is 0.
 *
 *  `startPhase` (default 0) lets callers anchor phase 0 to a non-zero
 *  tick position — used when the calibration window's first tick is
 *  not the canonical phase-0 (per spec § ASK 3 the runtime default is
 *  tick 0 = phase 0, but the helper is parameterized for flexibility). */
export declare function seasonalMeans(values: number[], period: number, baselineMean: number, startPhase?: number): number[];
/** Deseasonalize a series by subtracting the per-phase mean.
 *
 *  deseasoned[t] = values[t] − s[(t + startPhase) mod P]
 *
 *  The returned series has the same baseline mean as the input by
 *  construction (since Σ s ≈ 0 from `seasonalMeans`). Downstream
 *  detectors mean-center against the same `baselineMean`; the residual
 *  structure (short-range autocorrelation + anomaly signal) is what
 *  reaches the detector. */
export declare function deseasonalize(values: number[], seasonal: number[], period: number, startPhase?: number): number[];
/** Convenience: detect period, compute seasonal means, and return both
 *  the decomposition trail and the deseasonalized series. Returns
 *  period=0 + identity deseasonalized when no strong period is
 *  detected (per ASK 1 + ASK 2 — fall through to single-lag AR(1)
 *  path in the caller). */
export declare function decomposeSeasonal(values: number[], baselineMean: number, options?: {
    min_period?: number;
    max_period?: number;
    min_acf?: number;
}): {
    period: number;
    acf_at_period: number;
    seasonal_means: number[];
    deseasonalized: number[];
};
//# sourceMappingURL=seasonal.d.ts.map