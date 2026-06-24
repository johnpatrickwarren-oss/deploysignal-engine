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
    /** Minimum calibration length for E[BF|H0] ≤ 1 to hold (the plug-in innovation variance reintroduces
     *  invalidity below it). Enforced by {@link nuisanceRobustBFEValue}, which throws for shorter windows. */
    minCalibration: number;
}
/** Minimum calibration length for the by-construction E[BF|H0] ≤ 1 property to hold empirically (the
 *  plug-in innovation variance s² reintroduces estimation-error invalidity below this — E[BF|H0] is
 *  ~6.7 at cal=50, ~2e9 at cal=20, ~7e252 at cal=5 on AR(1) nulls; ≤ 1 with margin from ~100 up).
 *  {@link nuisanceRobustBFEValue} throws for shorter calibration windows. */
export declare const MIN_CALIBRATION_FOR_VALIDITY = 100;
/** The nuisance-robust BF e-value's validity envelope (ADR 0004 Tier 1). E[BF|H0] ≤ 1 holds for the
 *  mean-shift null with stable innovation variance, on AR(1)-whitened residuals, under an unknown
 *  (integrated-out) baseline mean — AND for a calibration window of at least `minCalibration` samples. */
export declare const NUISANCE_ROBUST_BF_ENVELOPE: Readonly<NuisanceRobustBFEnvelope>;
/** Default prior-variance multiple (Tessera ADR 0013 TAU_MULT). */
export declare const DEFAULT_TAU_MULT = 25;
/** Nuisance-robust two-sample Bayes-factor e-value over a calibration window and a test window of a
 *  single contiguous series `values`. Robust to the unknown baseline mean (integrated out under a
 *  proper N(0, τ²) prior) and to AR(1) autocorrelation (whitened by φ). Returns the Bayes factor —
 *  a VALID e-value: E[BF|H0] ≤ 1 by construction (see file header + {@link NUISANCE_ROBUST_BF_ENVELOPE}).
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