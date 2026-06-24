/** A contiguous index window [start, start+len) into the observation series. */
export interface Window {
    start: number;
    len: number;
}
export interface SafeTOptions {
    /** Prior variance on the standardized effect size δ = Δμ/σ (a proper N(0, g) prior). Diffuse but
     *  proper. Default {@link DEFAULT_EFFECT_PRIOR_VAR}. */
    effectPriorVar?: number;
    /** Override the AR(1) coefficient used to whiten. Default: the engine's Kendall-corrected
     *  {@link computePerSignalAr1Phi} estimated on the calibration window (centered on its mean). */
    ar1Phi?: number;
}
/** Default prior variance on the standardized effect (matches ADR 0004 TAU_MULT = 25). */
export declare const DEFAULT_EFFECT_PRIOR_VAR = 25;
/** The safe-t e-value's validity envelope (ADR 0005). Mirrors the shared ValidityEnvelope shape. The
 *  variance is integrated out (E[e|H0] = 1 exactly and uniform over σ when the residuals are iid) — the
 *  `minCalibration` here is the MATH minimum; with the DEFAULT estimated φ the FDR-relevant E[e|H0] ≤ 1
 *  still needs cal ≳ 100 (the residual floor is the φ plug-in, NOT the variance — see file header / ADR 0005). */
export declare const SAFE_T_ENVELOPE: Readonly<{
    baseline: "unknown-mean-integrated";
    autocorrelation: "ar1-whitened";
    null: "mean-shift";
    variance: "stable";
    validUnderEstimatedBaseline: true;
    minCalibration: 3;
    notes: string;
}>;
/** Safe (right-Haar / GROW) two-sample t-test e-value over a calibration window and a test window of a
 *  single contiguous series `values`. Tests a MEAN shift between the windows with the common mean AND the
 *  common (unknown) innovation variance integrated out; valid (E[e|H0] = 1, uniform over σ) for any
 *  calibration length. Whitens by the engine's native AR(1) φ (cal drops its first sample; the test window
 *  uses `values[test.start − 1]` as its first predecessor, so `test.start >= 1`).
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `cal.len < 3`, `test.len < 2`,
 *    `effectPriorVar <= 0`, or any in-window value is non-finite. */
export declare function safeTwoSampleTEValue(values: ReadonlyArray<number>, cal: Window, test: Window, opts?: SafeTOptions): number;
//# sourceMappingURL=safe-t-e-value.d.ts.map