/** A contiguous index window [start, start+len) into the observation series. */
export interface Window {
    start: number;
    len: number;
}
/** Signature thresholds (Tessera ADR 0016). `hasSignature` trips if any score exceeds its threshold. */
export declare const F_RATIO_THRESHOLD = 2;
export declare const TREND_T_THRESHOLD = 4;
export declare const COLLAPSE_SIGMA_THRESHOLD = 6;
export interface DistributionalSignature {
    /** Innovation-variance ratio var(whitened test) / var(whitened cal). > 1 ⇒ variance inflation
     *  (SDC / bit-flip). The BF's same-variance blind spot. */
    fRatio: number;
    /** |OLS slope| / slope-se of a linear trend on the WHITENED test innovations (degradation ramp).
     *  Computed on whitened residuals so the iid slope-se is valid (see the load-bearing fix in the
     *  file header). */
    trendT: number;
    /** How far the test RAW mean sits BELOW the cal RAW mean, in cal-σ units (detachment → large).
     *  One-sided: 0 when the test mean is at or above the cal mean. */
    collapseSigma: number;
    /** True if any score exceeds its threshold — evidence of a distributional change other than a clean
     *  mean step. */
    hasSignature: boolean;
}
/** Distributional-signature scores on the test window vs the calibration window of a single contiguous
 *  series `values`: evidence of a change OTHER than a clean mean step (which the BF e-value already
 *  covers). Whitening uses the engine's native Kendall-corrected AR(1) φ on the calibration window; the
 *  calibration window drops its first sample and the test window uses `values[test.start − 1]` as the
 *  predecessor of its first sample (so `test.start >= 1`).
 *
 *  The two windows may be arbitrary index ranges (they need not be adjacent, and overlap is not
 *  forbidden); the canonical m≫n calibration-then-test layout is the CALLER's discipline, not enforced.
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `cal.len < 3`, `test.len < 2`,
 *    or any in-window value is non-finite. */
export declare function distributionalSignature(values: ReadonlyArray<number>, cal: Window, test: Window): DistributionalSignature;
//# sourceMappingURL=distributional-signature.d.ts.map