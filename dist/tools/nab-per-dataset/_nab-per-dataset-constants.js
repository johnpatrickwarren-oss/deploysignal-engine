"use strict";
// tools/nab-per-dataset/_nab-per-dataset-constants.ts — calibration
// constants + probationary-window numerics. Extracted verbatim from
// run-nab-per-dataset.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_VERSION = exports.DEFAULT_DETECTORS = exports.DEFAULT_SUB_BENCHMARKS = exports.AR1_PHI_HAC_CLAMP = exports.AR1_PHI_FALLBACK_THRESHOLD = exports.DEFAULT_SMOOTHING = exports.DEFAULT_FAMILY_A_COOLDOWN_TICKS = exports.SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE = exports.SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS = exports.SPECTRAL_BOOTSTRAP_QUANTILE = exports.SPECTRAL_BOOTSTRAP_WINDOW = exports.DEFAULT_SPECTRAL_MAX_PEAK_LAG = exports.DEFAULT_SPECTRAL_MIN_PEAK_LAG = exports.DEFAULT_PROBATIONARY_FRACTION = void 0;
exports.mean = mean;
exports.sampleVariance = sampleVariance;
exports.ar1Phi = ar1Phi;
exports.hacInflationFactor = hacInflationFactor;
exports.DEFAULT_PROBATIONARY_FRACTION = 0.15;
/** Q70 SLICE 5 — Family D spectral lag bounds for peak-ACF search.
 *  WEEK4-HANDOFF.md §4.1.d specifies oscillation periods ~3–10 ticks.
 *  These are stamped into the per-dataset config's family_D entry so the
 *  spectral detector's `peakACF(samples, min_peak_lag, max_peak_lag)`
 *  receives concrete numbers (SLICE 4's stub config omitted them →
 *  peakACF returned 0 → spectral never fired). */
exports.DEFAULT_SPECTRAL_MIN_PEAK_LAG = 3;
exports.DEFAULT_SPECTRAL_MAX_PEAK_LAG = 10;
/** Q70 SLICE 5 — rolling window length the spectral dispatcher uses to
 *  feed `recentSamples` into evaluateFamilyD. Mirrors `FAMILY_D_WINDOW`
 *  in run-nab-validation.ts; duplicated here so the per-dataset bootstrap
 *  calibration uses the SAME window-size the runtime dispatcher will
 *  later use (matched-conditions H₀ calibration per the bootstrap-null
 *  convention in detectors/spectral.ts comments). */
exports.SPECTRAL_BOOTSTRAP_WINDOW = 60;
/** Q70 SLICE 5 — bootstrap-null quantile target. NAB Family D acceptance
 *  gate is ≥40; the per-dataset calibration takes the (1 − α_D) quantile
 *  of probationary peak-ACF distribution but with a small margin so the
 *  threshold sits in the upper tail of the H₀ distribution (otherwise
 *  ACF noise spikes register as fires). 0.99 gives ~ Type-I-error 0.01
 *  per evaluation tick — conservative under Bonferroni-class multiple-
 *  test correction at scale. */
exports.SPECTRAL_BOOTSTRAP_QUANTILE = 0.99;
/** Q70 SLICE 5 — minimum number of probationary subwindows required for
 *  reliable bootstrap calibration. Below this, fall back to a fixed
 *  conservative quantile. (At 60-tick window + ~600-tick probationary,
 *  ~540 overlapping subwindows are available — well above this floor.) */
exports.SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS = 30;
/** Q70 SLICE 5 — fallback bootstrap quantile when the probationary window
 *  is too short for empirical calibration. 0.90 is a tighter floor than
 *  SLICE 4's 0.5 stub but still loose enough to avoid silent never-fire
 *  on short datasets. */
exports.SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE = 0.90;
/** Q70 SLICE 5 — post-fire cooldown ticks for Family A detectors. After
 *  a fire, suppress subsequent firings for K ticks. NAB scoring rewards
 *  the FIRST detection in a labeled window; subsequent fires from a
 *  sustained-shift CUSUM (or wealth-still-above-threshold betting) are
 *  FPs that swamp per-dataset scores. K=1000 matches the typical NAB
 *  labeled-window width on the realKnownCause / realAWSCloudwatch sub-
 *  benchmarks (~362–566 ticks). Sweep-tuned: 1000 ticks dominates 200/
 *  500/2000/5000 across the 35-dataset suite. */
exports.DEFAULT_FAMILY_A_COOLDOWN_TICKS = 1000;
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
exports.DEFAULT_SMOOTHING = {
    pageCusum: { window: 50, thresholdCount: 25, cooldownTicks: 1000 },
    betting: { window: 50, thresholdCount: 20, cooldownTicks: 1500 },
    // SLICE 7 — mixture-supermartingale fires on per-tick threshold
    // crossings (non-sticky for dispatch downstream); smoothing dedupes
    // the same way page-cusum does. Same defaults as page-cusum tuned in
    // the SLICE 6 sweep; per-detector empirical re-tune may follow.
    mixtureSupermartingale: { window: 50, thresholdCount: 25, cooldownTicks: 1000 },
    spectral: { window: 30, thresholdCount: 9, cooldownTicks: 1500 },
};
/** φ̂ threshold above which the Q70 SLICE 2 self-normalized fallback is
 *  stamped on the per-dataset config. NAB real datasets exhibit φ ≈ 0.95
 *  on temperature / sensor signals; the 0.5 threshold engages fallback
 *  metadata generously to leave room for per-detector wiring to decide
 *  whether to consume it. This is metadata-stamping only at SLICE 2 v0.1
 *  — per-detector dispatch wiring is gated on architect units-mapping
 *  cross-check per Q70 spec § Library cross-check status item 2. */
exports.AR1_PHI_FALLBACK_THRESHOLD = 0.5;
/** φ̂ clamp for HAC long-run variance computation. As φ → ±1 the
 *  factor (1+φ)/(1-φ) explodes (random-walk pole); clamp keeps the
 *  inflation factor bounded by ~199× at φ=±0.99. NAB temperature / taxi
 *  signals have φ̂ ≈ 0.95 → factor ≈ 39× which is the working regime. */
exports.AR1_PHI_HAC_CLAMP = 0.99;
exports.DEFAULT_SUB_BENCHMARKS = [
    'realKnownCause',
    'realAWSCloudwatch',
    'artificialNoAnomaly',
    'artificialWithAnomaly',
];
exports.DEFAULT_DETECTORS = [
    'family_A_betting',
    'family_A_page_cusum',
    // SLICE 7 — Howard-Ramdas-2021 mixture-supermartingale variant.
    // Anytime-valid Ville-bounded by construction (P(sup_t M_t ≥ 1/α) ≤
    // α uniformly); AR(1) pre-whitening built into the detector. This is
    // the architecturally-correct mean-shift detector that resolves the
    // PR #3 "LIL application formula" deferred question — the §7 LIL
    // bound was for empirical-CDF / quantile work (per confseq library
    // docstring), not for mean-shift detection. The mixture-supermartingale
    // is the right tool for mean-shift; the LIL primitive is retained for
    // future quantile-detector work (family_E_conformal trajectory).
    'family_A_mixture_supermartingale',
    'family_D_spectral',
    // NOTE: `self_normalized_lil` was an experimental evaluator from
    // SLICE 3; the SLICE 7 architectural decision deprecates its
    // application for mean-shift detection in favor of the mixture-
    // supermartingale path. The math primitive remains valid for
    // empirical-CDF / quantile work.
];
exports.TOOL_VERSION = 'NAB-per-dataset v0.1.0';
// ── Probationary-window statistics ─────────────────────────────────
function mean(xs) {
    if (xs.length === 0)
        return 0;
    let s = 0;
    for (const x of xs)
        s += x;
    return s / xs.length;
}
/** Sample variance with 1e-12 floor (guards art_daily_no_noise zero-σ). */
function sampleVariance(xs, mu) {
    if (xs.length < 2)
        return 1e-12;
    let s2 = 0;
    for (const x of xs) {
        const d = x - mu;
        s2 += d * d;
    }
    const v = s2 / (xs.length - 1);
    return Math.max(v, 1e-12);
}
/** Lag-1 autocorrelation φ̂ via Yule-Walker. Clamped to [-0.95, 0.95]. */
function ar1Phi(xs, mu) {
    if (xs.length < 3)
        return 0;
    let num = 0;
    let den = 0;
    for (let i = 1; i < xs.length; i++) {
        num += (xs[i] - mu) * (xs[i - 1] - mu);
    }
    for (let i = 0; i < xs.length; i++) {
        const d = xs[i] - mu;
        den += d * d;
    }
    if (den <= 0)
        return 0;
    const phi = num / den;
    return Math.max(-0.95, Math.min(0.95, phi));
}
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
function hacInflationFactor(phi) {
    const phiClamped = Math.max(-exports.AR1_PHI_HAC_CLAMP, Math.min(exports.AR1_PHI_HAC_CLAMP, phi));
    return (1 + phiClamped) / (1 - phiClamped);
}
//# sourceMappingURL=_nab-per-dataset-constants.js.map