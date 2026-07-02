/** A contiguous index window [start, start+len) into the observation series. */
export interface Window {
    /** First index (inclusive). */
    start: number;
    /** Number of samples. */
    len: number;
}
export interface NuisanceRobustBFOptions {
    /** Prior variance on the (whitened) mean as a multiple of the innovation variance:
     *  τ² = tauMult × s². Diffuse but proper. Default {@link DEFAULT_TAU_MULT}. */
    tauMult?: number;
    /** Override the AR(1) coefficient used to whiten. Default: the engine's Kendall-corrected
     *  {@link computePerSignalAr1Phi} estimated on the calibration window (centered on its mean). */
    ar1Phi?: number;
}
/** The validity regime in which E[BF|H0] ≤ 1 holds. Shipped as metadata so the engine never implies
 *  a guarantee outside it (ADR 0004 — validity envelopes as first-class). */
export interface NuisanceRobustBFEnvelope {
    /** The baseline mean is unknown and INTEGRATED OUT (a proper-prior Bayes factor) — it is never
     *  plugged in, which is exactly why this e-value is valid where the plug-in detectors are not. */
    baseline: 'unknown-mean-integrated';
    /** Residuals are AR(1)-whitened before the test. */
    autocorrelation: 'ar1-whitened';
    /** The null is a stable mean (the alternative is a mean shift). */
    null: 'mean-shift';
    /** Validity assumes the SAME innovation variance in calibration and test. A variance change is out
     *  of scope (route to the distributional-signature detector, ADR 0004 Tier 2). */
    variance: 'stable';
    /** FALSE (2026-07-02 correction — see the file header): the data-dependent recentering makes
     *  E[BF|H0] ≈ 1.155 at EVERY calibration length, so this e-value is NOT admissible to the FDR path
     *  as-is. Use {@link safeTwoSampleTEValue} instead. This is the shared {@link ValidityEnvelope}
     *  honesty flag (PR E). */
    validUnderEstimatedBaseline: false;
    /** Minimum calibration length enforced by {@link nuisanceRobustBFEValue} (throws for shorter
     *  windows). NB (2026-07-02): originally justified as "E[BF|H0] ≤ 1 with margin from ~100 up" —
     *  an MC artifact (see the header); the true mean is ≈1.155 at every length. The plug-in-s²
     *  blow-ups BELOW this floor are real and additional, so the floor is kept. */
    minCalibration: number;
    /** Free-text regime detail (aligned with the shared {@link ValidityEnvelope} shape). */
    notes: string;
}
/** Minimum calibration length enforced by {@link nuisanceRobustBFEValue} (throws below it). The
 *  plug-in innovation variance s² causes real blow-ups below this — E[BF|H0] is ~6.7 at cal=50,
 *  ~2e9 at cal=20, ~7e252 at cal=5 on AR(1) nulls. ⚠️ The original "≤ 1 with margin from ~100 up"
 *  half of the rationale was an MC artifact: the true null mean is ≈1.155 at EVERY calibration
 *  length (2026-07-02 correction — see the file header). */
export declare const MIN_CALIBRATION_FOR_VALIDITY = 100;
/** The nuisance-robust BF e-value's validity envelope. ⚠️ CORRECTED (2026-07-02): E[BF|H0] ≈ 1.155
 *  at every calibration length (the recentering breaks the proper-prior property — file header), so
 *  `validUnderEstimatedBaseline` is FALSE and this e-value must not enter the FDR path as-is. The
 *  theorem-valid substitute is {@link safeTwoSampleTEValue} (ADR 0005). */
export declare const NUISANCE_ROBUST_BF_ENVELOPE: Readonly<NuisanceRobustBFEnvelope>;
/** Default prior-variance multiple (Tessera ADR 0013 TAU_MULT). */
export declare const DEFAULT_TAU_MULT = 25;
/** Nuisance-robust two-sample Bayes-factor e-value over a calibration window and a test window of a
 *  single contiguous series `values`, AR(1)-whitened by φ.
 *
 *  @deprecated 2026-07-02 — NOT a valid e-value: E[BF|H0] ≈ 1.155 at every calibration length (the
 *  data-dependent recentering breaks the proper-prior property — see the file header for the exact
 *  formula and why the original MC validation missed it). Bounded inflation (FDR ≤ 1.155·q), so
 *  existing results are not catastrophically wrong, but do not feed this to e-BH as theorem-valid.
 *  Use {@link safeTwoSampleTEValue} (detectors/safe-t-e-value.ts) — same call signature, the
 *  location integrated out by right-Haar invariance, E[BF|H0] = 1 exactly.
 *
 *  Whitening uses each sample's immediate predecessor in `values`, so the calibration window drops its
 *  first sample (no predecessor inside the window) and the test window uses `values[test.start - 1]`
 *  as the predecessor of its first sample; therefore `test.start >= 1` and the two windows must index
 *  a single contiguous series.
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `test.len < 2`,
 *    `cal.len < MIN_CALIBRATION_FOR_VALIDITY` (the validity floor — see that constant), or any
 *    in-window value is non-finite. */
export declare function nuisanceRobustBFEValue(values: ReadonlyArray<number>, cal: Window, test: Window, opts?: NuisanceRobustBFOptions): number;
//# sourceMappingURL=nuisance-robust-bf-e-value.d.ts.map