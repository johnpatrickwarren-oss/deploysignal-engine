import type { ValidityEnvelope } from '../detectors/validity-envelope';
/** Result of fitting an AR(1) model to a baseline sample (Tessera `Ar1Fit`). */
export interface ContrastAr1Fit {
    /** Bias-corrected lag-1 autoregressive coefficient. */
    phi: number;
    /** Innovation (residual) variance of x_t − φ·x_{t−1} on the sample. */
    sigma2: number;
}
/** Tessera's `estimateAr1`: OLS lag-1 autocorrelation on the mean-centered sample, Kendall
 *  median-unbiased correction φ* = φ_ols + (1 + 3φ_ols)/n, clipped to ±0.95. Degenerate inputs
 *  (n < 2, zero variance) return φ = 0 (whitening becomes identity). Pure. */
export declare function estimateContrastAr1(samples: ReadonlyArray<number>): ContrastAr1Fit;
/** Tessera's `whiten`: the AR(1) innovation x_t − φ·x_{t−1}; the first tick (no prior) is returned
 *  unchanged. Pure. */
export declare function whitenContrast(x: number, xPrev: number | null, phi: number): number;
export declare const median: (xs: ReadonlyArray<number>) => number;
export declare const madScale: (xs: ReadonlyArray<number>) => number;
/** The contrast fit estimated on the HEALTHY baseline contrast: a centering offset (the treatment and
 *  control have INDEPENDENT baselines, so the contrast has a nonzero mean), AR(1) φ, and robust
 *  location/scale of the whitened residual. CENTER BEFORE WHITENING: `whitenContrast` returns the
 *  first tick unchanged (no prior sample), so without centering that seed tick carries the full
 *  baseline offset and standardizes to a many-σ outlier — one fat tail per series that spuriously
 *  trips the ∏g calibration. */
export interface ContrastFit {
    phi: number;
    loc: number;
    scale: number;
    center: number;
}
export declare function fitContrast(d0: ReadonlyArray<number>): ContrastFit;
/** Apply a baseline contrast fit to a (monitoring) contrast: center, whiten at φ, standardize by
 *  loc/scale. Causal: applying to a prefix equals the prefix of applying to the whole. */
export declare function applyContrast(d: ReadonlyArray<number>, fit: ContrastFit): number[];
/** Compose a fit from two sources (Tessera 2026-07-02 audit F8 fix, ADR 0022 mixed-cadence path): the
 *  CENTER from a long (possibly coarse-cadence) baseline fit of the SAME contrast — a mean offset is
 *  cadence-independent — and the DYNAMICS (φ, loc, scale — all cadence-dependent) from a monitoring-
 *  cadence KNOWN-NULL fit (a control-vs-control sibling contrast). */
export declare function composeFit(centerFrom: ContrastFit, dynamicsFrom: ContrastFit): ContrastFit;
/** Like fitContrast but using mean/SD instead of median/MAD — O(n) with NO sort, so it scales to a
 *  long (multi-million-tick) HEALTHY baseline where the median sorts dominate. Use ONLY on a known-
 *  healthy baseline. */
export declare function fitContrastFast(d0: ReadonlyArray<number>): ContrastFit;
/** A treatment series paired with its concurrent control twin (same length; the seam is raw numbers,
 *  as Tessera's tools/telemetry-source.ts). */
export interface ContrastPair {
    treatment: ReadonlyArray<number>;
    control: ReadonlyArray<number>;
}
/** The model-free contrast d_t = treatment_t − control_t. Throws on a length mismatch — a pair whose
 *  members are not concurrent is not a pair. */
export declare function contrastOf(p: ContrastPair): number[];
/** The standardized contrast residual of a pair under a fit, for the mean-shift constructions:
 *  `applyContrast(contrastOf(p), fit)`. */
export declare function contrastResidual(p: ContrastPair, fit: ContrastFit): number[];
/** One measured admission cell of the study: what a construction's contract did on the contrast
 *  residual at one fit-window length, over the registered nulls. */
export interface ContrastAdmission {
    /** the construction (h0-battery / registry naming). */
    construction: 'family_A_mixture_supermartingale' | 'family_A_betting_e_process' | 'e_sr_mean_shift' | 'calibration_monitor_gaussian' | 'calibration_monitor_bounded';
    /** its level (α per run, α_ARL, or α_cal). */
    level: number;
    /** the fit-window length m. */
    fitTicks: number;
    /** nulls on which the contract HELD at this m (h0-battery ids). */
    heldOn: readonly string[];
    /** nulls on which it FAILED. */
    failedOn: readonly string[];
    /** measured false alerts per 1,000 monitoring ticks, [min, max] over the nulls. */
    ratePer1000: readonly [number, number];
}
/** The contrast null's envelope: `ValidityEnvelope` with the premise stated and the fit-window length
 *  as the regime. `admission` is the study's P2 written as numbers; `minCalibration` is the smallest
 *  fit length at which the mixture holds on every Gaussian-innovation null. */
export interface ContrastNullEnvelope extends ValidityEnvelope {
    /** the premise, in one sentence, so a consumer that asserts it can say what it asserted. */
    premise: string;
    /** the registered fit-window lengths. */
    fitTicksMeasured: readonly number[];
    /** per (construction, level, m): held / failed nulls and the measured rate. Empty until the run. */
    admission: readonly ContrastAdmission[];
    /** the study run this envelope's numbers pin to. */
    evidence: string;
}
/** The registered run every number below pins to (validation/contrast-null/results/live/<run>). */
export declare const CONTRAST_NULL_RUN = "run-20260905T061348Z";
/** The contrast null's validity envelope — a REFUSAL RECORD, not an admission. Study
 *  2026-09-contrast-null (registered 2416bef, amended A1/A2 before the run, run once as
 *  CONTRAST_NULL_RUN; 21 cells × 500 replications × 3 variants, 0 exceptions): the registered ship
 *  rule (§6) was P1 and P3 HELD; as computed P1 FAILED in 8 of 21 cells and P3 FAILED in 14 of 21, both
 *  by the same mechanism, so under the registration NOTHING IS ADMITTED and `validUnderEstimatedBaseline`
 *  stays false with no `minCalibration`. The engine's convention (fleet/e-bh-guarded.ts, the retracted BF)
 *  is that a measured refusal is recorded by name rather than left blank, which is what this object is.
 *
 *  WHAT THE NUMBERS SAY. The shared component cancels exactly (the shared-step residual is identical to
 *  the null's, max |Δr| = 8.9e-16; every one of 73,500 alert ticks identical), and the contrast beats the
 *  temporal path where a shared component exists (N1, m = 2000: 29 vs 228 of 500 mixture false alerts at
 *  α = 0.05; a treatment-only 1.5σ step detected with median delay 80 vs 155 ticks). What does not cancel is
 *  the contrast's OFFSET: the two units have independent baselines, so the center is estimated from m ticks
 *  and read against a 2,000-tick horizon — the plug-in n ≫ m regime MIXTURE_SUPERMARTINGALE_ENVELOPE already
 *  names. The mixture's false-alert rate on the null contrast is independent of the fit's scale error
 *  (0.69 vs 0.65 across the scale split at m = 60) and falls with m as the center's error does (0.34 →
 *  0.18 → 0.03 per 1,000 ticks at m = 60 / 300 / 2000 on N1). A null exists BY CONSTRUCTION for what the
 *  units share; it does not exist by construction for their offset unless the pair is a true twin (offset
 *  known) or m ≫ n (Tessera's ≥ 2-month baseline against 300-tick windows, ratio ~10⁴).
 *
 *  ADMISSION TO THE FDR PATH is therefore only under the caller's own assertion `mMuchGreaterThanN` (the
 *  regime the study measured as the price) or `trueBaseline` (a twin with a known offset), greppable at
 *  the call site, exactly as for the plug-in cards. */
export declare const CONTRAST_NULL_ENVELOPE: Readonly<ContrastNullEnvelope>;
//# sourceMappingURL=contrast.d.ts.map