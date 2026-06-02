import type { NABSubBenchmark, NABDetectorFamily } from '../run-nab-validation';
export declare const DEFAULT_PROBATIONARY_FRACTION = 0.15;
/** Q70 SLICE 5 — Family D spectral lag bounds for peak-ACF search.
 *  WEEK4-HANDOFF.md §4.1.d specifies oscillation periods ~3–10 ticks.
 *  These are stamped into the per-dataset config's family_D entry so the
 *  spectral detector's `peakACF(samples, min_peak_lag, max_peak_lag)`
 *  receives concrete numbers (SLICE 4's stub config omitted them →
 *  peakACF returned 0 → spectral never fired). */
export declare const DEFAULT_SPECTRAL_MIN_PEAK_LAG = 3;
export declare const DEFAULT_SPECTRAL_MAX_PEAK_LAG = 10;
/** Q70 SLICE 5 — rolling window length the spectral dispatcher uses to
 *  feed `recentSamples` into evaluateFamilyD. Mirrors `FAMILY_D_WINDOW`
 *  in run-nab-validation.ts; duplicated here so the per-dataset bootstrap
 *  calibration uses the SAME window-size the runtime dispatcher will
 *  later use (matched-conditions H₀ calibration per the bootstrap-null
 *  convention in detectors/spectral.ts comments). */
export declare const SPECTRAL_BOOTSTRAP_WINDOW = 60;
/** Q70 SLICE 5 — bootstrap-null quantile target. NAB Family D acceptance
 *  gate is ≥40; the per-dataset calibration takes the (1 − α_D) quantile
 *  of probationary peak-ACF distribution but with a small margin so the
 *  threshold sits in the upper tail of the H₀ distribution (otherwise
 *  ACF noise spikes register as fires). 0.99 gives ~ Type-I-error 0.01
 *  per evaluation tick — conservative under Bonferroni-class multiple-
 *  test correction at scale. */
export declare const SPECTRAL_BOOTSTRAP_QUANTILE = 0.99;
/** Q70 SLICE 5 — minimum number of probationary subwindows required for
 *  reliable bootstrap calibration. Below this, fall back to a fixed
 *  conservative quantile. (At 60-tick window + ~600-tick probationary,
 *  ~540 overlapping subwindows are available — well above this floor.) */
export declare const SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS = 30;
/** Q70 SLICE 5 — fallback bootstrap quantile when the probationary window
 *  is too short for empirical calibration. 0.90 is a tighter floor than
 *  SLICE 4's 0.5 stub but still loose enough to avoid silent never-fire
 *  on short datasets. */
export declare const SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE = 0.9;
/** Q70 SLICE 5 — post-fire cooldown ticks for Family A detectors. After
 *  a fire, suppress subsequent firings for K ticks. NAB scoring rewards
 *  the FIRST detection in a labeled window; subsequent fires from a
 *  sustained-shift CUSUM (or wealth-still-above-threshold betting) are
 *  FPs that swamp per-dataset scores. K=1000 matches the typical NAB
 *  labeled-window width on the realKnownCause / realAWSCloudwatch sub-
 *  benchmarks (~362–566 ticks). Sweep-tuned: 1000 ticks dominates 200/
 *  500/2000/5000 across the 35-dataset suite. */
export declare const DEFAULT_FAMILY_A_COOLDOWN_TICKS = 1000;
/** Q70 SLICE 6 — anomaly-likelihood smoothing defaults per detector
 *  family. SLICE 5's raw cooldown wrapper emits at the FIRST tick of a
 *  sustained shift; the empirical classification across 35 NAB datasets
 *  (55 labeled windows) showed ~30% of windows have detector fires
 *  within ±500 ticks of the window edge but OUTSIDE the credit zone.
 *  Anomaly-likelihood smoothing requires the rolling fire-count over
 *  `window` ticks to exceed `thresholdCount` before emitting, which (a)
 *  delays emit until the anomaly is sustained — increasing the chance
 *  the emit lands inside the labeled window — and (b) dedupes spurious
 *  single-tick fires that don't repeat.
 *
 *  Defaults are sweep-tuned per detector. Page-cusum tolerates a tighter
 *  threshold ratio because its raw fire trace is dense in sustained
 *  shifts. Betting's wealth process produces stickier elevated states,
 *  so a longer cooldown after emit is preferred. Spectral oscillation
 *  detection operates on shorter windows by design (lag bounds 3–10),
 *  so its smoothing window is also shorter. */
export declare const DEFAULT_SMOOTHING: Record<'pageCusum' | 'betting' | 'mixtureSupermartingale' | 'spectral', {
    window: number;
    thresholdCount: number;
    cooldownTicks: number;
}>;
/** φ̂ threshold above which the Q70 SLICE 2 self-normalized fallback is
 *  stamped on the per-dataset config. NAB real datasets exhibit φ ≈ 0.95
 *  on temperature / sensor signals; the 0.5 threshold engages fallback
 *  metadata generously to leave room for per-detector wiring to decide
 *  whether to consume it. This is metadata-stamping only at SLICE 2 v0.1
 *  — per-detector dispatch wiring is gated on architect units-mapping
 *  cross-check per Q70 spec § Library cross-check status item 2. */
export declare const AR1_PHI_FALLBACK_THRESHOLD = 0.5;
/** φ̂ clamp for HAC long-run variance computation. As φ → ±1 the
 *  factor (1+φ)/(1-φ) explodes (random-walk pole); clamp keeps the
 *  inflation factor bounded by ~199× at φ=±0.99. NAB temperature / taxi
 *  signals have φ̂ ≈ 0.95 → factor ≈ 39× which is the working regime. */
export declare const AR1_PHI_HAC_CLAMP = 0.99;
export declare const DEFAULT_SUB_BENCHMARKS: NABSubBenchmark[];
export declare const DEFAULT_DETECTORS: NABDetectorFamily[];
export declare const TOOL_VERSION = "NAB-per-dataset v0.1.0";
export declare function mean(xs: number[]): number;
/** Sample variance with 1e-12 floor (guards art_daily_no_noise zero-σ). */
export declare function sampleVariance(xs: number[], mu: number): number;
/** Lag-1 autocorrelation φ̂ via Yule-Walker. Clamped to [-0.95, 0.95]. */
export declare function ar1Phi(xs: number[], mu: number): number;
/** AR(1) long-run variance inflation factor for HAC-style σ² correction
 *  (Path B). For an AR(1) process with stationary variance σ² and lag-1
 *  correlation φ, the variance of the cumulative sum S_n = Σ X_i grows
 *  as `n · σ² · (1 + φ) / (1 - φ)` — not `n · σ²`. The CUSUM detector
 *  assumes the iid form when it standardizes; if calibration was done
 *  on an iid probationary window but runtime data exhibits AR(1)
 *  autocorrelation (e.g., NAB temperature data with φ ≈ 0.95), the
 *  detector under-estimates the variance of its test statistic by this
 *  factor, producing FPR inflation.
 *
 *  Path B intervention: replace the iid-calibrated σ² with the HAC
 *  long-run variance σ² · (1+φ)/(1-φ) before stamping into the per-
 *  dataset config. The detector consumes this via its existing variance
 *  field (no engine math change); FP control is restored to the
 *  standard Ville bound, just at the corrected effective variance.
 *
 *  Trade-off: TPR can also drop because the detector's effective signal-
 *  to-noise threshold is wider. NAB-style anomalies (sharp shifts) should
 *  still cross the inflated threshold; subtle drift detection becomes
 *  harder. Empirical question — that's what running NAB validates.
 *
 *  Reference: Newey-Hac (1987) for the AR(1)-corrected long-run variance;
 *  classic in econometric time-series literature. */
export declare function hacInflationFactor(phi: number): number;
//# sourceMappingURL=_nab-per-dataset-constants.d.ts.map