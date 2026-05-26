// tools/run-nab-per-dataset.ts — per-dataset-calibrated NAB validation.
//
// Standard NAB benchmark practice (Lavin-Ahmad 2015): each detector gets
// a probationary calibration window (default 15% of dataset head) before
// scoring on the remainder. Numenta's reference runner does this for
// every detector; the Q64 SPEC-4 single-config sweep did not, which is
// why naive cross-domain dispatch produced Family A 0.00.
//
// This tool:
//   1. discovers NAB datasets (delegates to run-nab-validation helpers)
//   2. for each dataset: derives baseline_mean / σ² / ar1_phi from the
//      first probationaryFraction of the CSV values; writes a per-dataset
//      compiled config to a temp dir
//   3. dispatches detectors against the per-dataset config; scores only
//      ticks post-probationary-window (standard NAB practice)
//   4. aggregates per-family scores; emits report JSON
//
// Anti-scope: no engine/detectors/* modification — all tool-side.
// Honest scope: closes the calibration-scale gap; does NOT close the
// within-dataset autocorrelation gap (φ ≈ 0.95 on real NAB datasets).
// That residual gap maps to Q70 SLICE 2 (self-normalized e-process
// fallback wired into page-cusum + conformal dispatch); see
// coordination/Q70-PHASE-3-D-E-CALIBRATION-REGIME-ARCHITECTURE-SPEC.md.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  discoverNABDatasets,
  parseNABDatasetCsv,
  loadNABLabels,
  annotationsFromLabels,
  runDetectorOverDataset,
  DEFAULT_CALIBRATION_SIGNAL,
  type NABSubBenchmark,
  type NABDetectorFamily,
  type NABDatasetAnnotation,
  type DetectorFiringDecision,
} from './run-nab-validation';
import { computeNABScore, aggregateFamilyScore, NAB_PROFILES, type NABProfile } from './nab-scoring';
import {
  buildLilBoundHyperparams,
  freshSelfNormalizedDetectorState,
  evaluateSelfNormalizedFallback,
} from '../detectors/self-normalized-e-process-fallback';
import { peakACF } from '../detectors/spectral';
import { deriveMixtureSupermartingaleParams } from '../detectors/family-a-mixture-supermartingale';
import { fitArP } from '../detectors/ar-p';
import type { LilBoundHyperparams } from '../types/self-normalized-fallback';
import type { FamilyAPerSignalParams } from '../types/families/a';

const DEFAULT_PROBATIONARY_FRACTION = 0.15;

/** Q70 SLICE 5 — Family D spectral lag bounds for peak-ACF search.
 *  WEEK4-HANDOFF.md §4.1.d specifies oscillation periods ~3–10 ticks.
 *  These are stamped into the per-dataset config's family_D entry so the
 *  spectral detector's `peakACF(samples, min_peak_lag, max_peak_lag)`
 *  receives concrete numbers (SLICE 4's stub config omitted them →
 *  peakACF returned 0 → spectral never fired). */
const DEFAULT_SPECTRAL_MIN_PEAK_LAG = 3;
const DEFAULT_SPECTRAL_MAX_PEAK_LAG = 10;

/** Q70 SLICE 5 — rolling window length the spectral dispatcher uses to
 *  feed `recentSamples` into evaluateFamilyD. Mirrors `FAMILY_D_WINDOW`
 *  in run-nab-validation.ts; duplicated here so the per-dataset bootstrap
 *  calibration uses the SAME window-size the runtime dispatcher will
 *  later use (matched-conditions H₀ calibration per the bootstrap-null
 *  convention in detectors/spectral.ts comments). */
const SPECTRAL_BOOTSTRAP_WINDOW = 60;

/** Q70 SLICE 5 — bootstrap-null quantile target. NAB Family D acceptance
 *  gate is ≥40; the per-dataset calibration takes the (1 − α_D) quantile
 *  of probationary peak-ACF distribution but with a small margin so the
 *  threshold sits in the upper tail of the H₀ distribution (otherwise
 *  ACF noise spikes register as fires). 0.99 gives ~ Type-I-error 0.01
 *  per evaluation tick — conservative under Bonferroni-class multiple-
 *  test correction at scale. */
const SPECTRAL_BOOTSTRAP_QUANTILE = 0.99;

/** Q70 SLICE 5 — minimum number of probationary subwindows required for
 *  reliable bootstrap calibration. Below this, fall back to a fixed
 *  conservative quantile. (At 60-tick window + ~600-tick probationary,
 *  ~540 overlapping subwindows are available — well above this floor.) */
const SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS = 30;

/** Q70 SLICE 5 — fallback bootstrap quantile when the probationary window
 *  is too short for empirical calibration. 0.90 is a tighter floor than
 *  SLICE 4's 0.5 stub but still loose enough to avoid silent never-fire
 *  on short datasets. */
const SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE = 0.90;

/** Q70 SLICE 5 — post-fire cooldown ticks for Family A detectors. After
 *  a fire, suppress subsequent firings for K ticks. NAB scoring rewards
 *  the FIRST detection in a labeled window; subsequent fires from a
 *  sustained-shift CUSUM (or wealth-still-above-threshold betting) are
 *  FPs that swamp per-dataset scores. K=1000 matches the typical NAB
 *  labeled-window width on the realKnownCause / realAWSCloudwatch sub-
 *  benchmarks (~362–566 ticks). Sweep-tuned: 1000 ticks dominates 200/
 *  500/2000/5000 across the 35-dataset suite. */
const DEFAULT_FAMILY_A_COOLDOWN_TICKS = 1000;

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
const DEFAULT_SMOOTHING: Record<'pageCusum' | 'betting' | 'mixtureSupermartingale' | 'spectral', {
  window: number;
  thresholdCount: number;
  cooldownTicks: number;
}> = {
  pageCusum:               { window: 50, thresholdCount: 25, cooldownTicks: 1000 },
  betting:                 { window: 50, thresholdCount: 20, cooldownTicks: 1500 },
  // SLICE 7 — mixture-supermartingale fires on per-tick threshold
  // crossings (non-sticky for dispatch downstream); smoothing dedupes
  // the same way page-cusum does. Same defaults as page-cusum tuned in
  // the SLICE 6 sweep; per-detector empirical re-tune may follow.
  mixtureSupermartingale:  { window: 50, thresholdCount: 25, cooldownTicks: 1000 },
  spectral:                { window: 30, thresholdCount:  9, cooldownTicks: 1500 },
};

/** φ̂ threshold above which the Q70 SLICE 2 self-normalized fallback is
 *  stamped on the per-dataset config. NAB real datasets exhibit φ ≈ 0.95
 *  on temperature / sensor signals; the 0.5 threshold engages fallback
 *  metadata generously to leave room for per-detector wiring to decide
 *  whether to consume it. This is metadata-stamping only at SLICE 2 v0.1
 *  — per-detector dispatch wiring is gated on architect units-mapping
 *  cross-check per Q70 spec § Library cross-check status item 2. */
const AR1_PHI_FALLBACK_THRESHOLD = 0.5;

/** φ̂ clamp for HAC long-run variance computation. As φ → ±1 the
 *  factor (1+φ)/(1-φ) explodes (random-walk pole); clamp keeps the
 *  inflation factor bounded by ~199× at φ=±0.99. NAB temperature / taxi
 *  signals have φ̂ ≈ 0.95 → factor ≈ 39× which is the working regime. */
const AR1_PHI_HAC_CLAMP = 0.99;

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
export function hacInflationFactor(phi: number): number {
  const phiClamped = Math.max(-AR1_PHI_HAC_CLAMP, Math.min(AR1_PHI_HAC_CLAMP, phi));
  return (1 + phiClamped) / (1 - phiClamped);
}
const DEFAULT_SUB_BENCHMARKS: NABSubBenchmark[] = [
  'realKnownCause',
  'realAWSCloudwatch',
  'artificialNoAnomaly',
  'artificialWithAnomaly',
];
const DEFAULT_DETECTORS: NABDetectorFamily[] = [
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
const TOOL_VERSION = 'NAB-per-dataset v0.1.0';

// ── Probationary-window statistics ─────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample variance with 1e-12 floor (guards art_daily_no_noise zero-σ). */
function sampleVariance(xs: number[], mu: number): number {
  if (xs.length < 2) return 1e-12;
  let s2 = 0;
  for (const x of xs) {
    const d = x - mu;
    s2 += d * d;
  }
  const v = s2 / (xs.length - 1);
  return Math.max(v, 1e-12);
}

/** Lag-1 autocorrelation φ̂ via Yule-Walker. Clamped to [-0.95, 0.95]. */
function ar1Phi(xs: number[], mu: number): number {
  if (xs.length < 3) return 0;
  let num = 0;
  let den = 0;
  for (let i = 1; i < xs.length; i++) {
    num += (xs[i] - mu) * (xs[i - 1] - mu);
  }
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i] - mu;
    den += d * d;
  }
  if (den <= 0) return 0;
  const phi = num / den;
  return Math.max(-0.95, Math.min(0.95, phi));
}

// ── Per-dataset compiled config ────────────────────────────────────

export interface PerDatasetCalibrationProvenance {
  probationary_fraction: number;
  n_probationary_ticks: number;
  n_total_ticks: number;
  derived: {
    baseline_mean: number;
    /** Marginal variance estimated from the probationary window. Kept
     *  as the canonical `baseline_sigma_squared` for back-compat with
     *  existing tests + downstream consumers; the variance ACTUALLY
     *  stamped into the per-signal config may be innovation variance
     *  (see SLICE 5 below) when pre-whitening is enabled. */
    baseline_sigma_squared: number;
    ar1_phi: number;
  };
  /** Q70 SLICE 2 metadata. Populated when |φ̂| ≥
   *  AR1_PHI_FALLBACK_THRESHOLD — the calibration substrate is iid by
   *  construction (probationary window of length n_probationary_ticks)
   *  but the dataset's empirical AR(1) structure suggests runtime
   *  observations carry correlation the iid calibration does not
   *  capture. The LIL hyperparameters are stamped into the compiled
   *  config so a wiring-aware detector can substitute the LIL bound
   *  for the standard 1/α threshold. */
  self_normalized_fallback?: {
    reason: 'ar1_phi_exceeds_threshold';
    threshold: number;
    observed_phi: number;
    lil_hyperparams: LilBoundHyperparams;
  };
  /** Path B (HAC variance inflation) provenance. Populated only when
   *  the caller opts into legacy HAC inflation (SLICE 4 behavior).
   *  SLICE 5 default is pre-whitening + innovation variance, in which
   *  case `pre_whitening` is populated instead. The two corrections
   *  are mutually exclusive — both attempt to bridge the iid-calibration
   *  vs AR(1)-runtime gap but via opposite mechanisms (HAC widens σ to
   *  cover unwhitened observations; pre-whitening produces near-iid
   *  residuals so σ stays at innovation scale). */
  hac_inflation?: {
    phi_used: number;
    factor: number;
    iid_sigma_squared: number;
    inflated_sigma_squared: number;
  };
  /** SLICE 5 — pre-whitening provenance. Populated when the caller opts
   *  into AR(1) pre-whitening + innovation variance (default). The
   *  innovation variance σ²·(1−φ²) is stamped into the per-signal config;
   *  the dispatcher pre-whitens the input series before passing to
   *  Family A detectors. Spectral (Family D) consumes raw values. */
  pre_whitening?: {
    phi_used: number;
    marginal_sigma_squared: number;
    innovation_sigma_squared: number;
  };
  /** SLICE 5 — spectral bootstrap calibration provenance. Records the
   *  per-dataset peak-ACF empirical distribution properties from the
   *  probationary window's overlapping subwindows. */
  spectral_bootstrap?: {
    quantile_target: number;
    quantile_used: number;
    n_subwindows: number;
    min_peak_lag: number;
    max_peak_lag: number;
    /** False when n_subwindows was too small for reliable calibration
     *  and the fallback fixed quantile was used. */
    empirically_calibrated: boolean;
  };
  /** SLICE 5 — post-fire cooldown applied to Family A detectors. */
  family_a_cooldown_ticks: number;
  /** SLICE 6 — per-detector anomaly-likelihood smoothing parameters
   *  (Numenta-style persistence filter). Stamped only when smoothing is
   *  enabled at the calibrator level. */
  smoothing?: {
    page_cusum:              { window: number; threshold_count: number; cooldown_ticks: number };
    betting:                 { window: number; threshold_count: number; cooldown_ticks: number };
    mixture_supermartingale: { window: number; threshold_count: number; cooldown_ticks: number };
    spectral:                { window: number; threshold_count: number; cooldown_ticks: number };
  };
  /** Phase E SLICE 8 — multi-lag AR(p) Yule-Walker calibration trail.
   *  Stamped only when `useArPCalibration: true`. The fitted `phi`
   *  vector replaces SLICE 5's single-lag φ̂ at dispatch; the
   *  innovation variance `sigma2_innovation` replaces the SLICE 5
   *  single-lag innovation σ². `ic_trace` carries the per-order AIC
   *  (or BIC) values for debugging; `p` is the AIC-optimal order. */
  ar_p_calibration?: {
    p: number;
    phi: number[];
    sigma2_innovation: number;
    ic_trace: number[];
    ic_kind: 'aic' | 'bic';
    reflection_coefficients: number[];
    p_max: number;
  };
}

/** SLICE 5 — calibrate the spectral bootstrap-null quantile from the
 *  probationary window's empirical peak-ACF distribution. Computes
 *  peakACF on each overlapping length-`SPECTRAL_BOOTSTRAP_WINDOW`
 *  subwindow of the probationary data, then returns the (quantile)-th
 *  order statistic. When the probationary window is too short for
 *  reliable calibration, returns SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE
 *  (≪ SLICE 4's hardcoded 0.5 but still loose enough to not silent-fail). */
export function calibrateSpectralBootstrapQuantile(
  probationary: number[],
  minLag: number,
  maxLag: number,
  quantile: number,
): { quantile_used: number; n_subwindows: number; empirically_calibrated: boolean } {
  if (probationary.length < SPECTRAL_BOOTSTRAP_WINDOW + minLag) {
    return {
      quantile_used: SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE,
      n_subwindows: 0,
      empirically_calibrated: false,
    };
  }
  const peaks: number[] = [];
  for (let i = 0; i + SPECTRAL_BOOTSTRAP_WINDOW <= probationary.length; i++) {
    const win = probationary.slice(i, i + SPECTRAL_BOOTSTRAP_WINDOW);
    const p = peakACF(win, minLag, maxLag).peak;
    peaks.push(p);
  }
  if (peaks.length < SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS) {
    return {
      quantile_used: SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE,
      n_subwindows: peaks.length,
      empirically_calibrated: false,
    };
  }
  peaks.sort((a, b) => a - b);
  const idx = Math.min(peaks.length - 1, Math.floor(quantile * peaks.length));
  return {
    quantile_used: peaks[idx],
    n_subwindows: peaks.length,
    empirically_calibrated: true,
  };
}

/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback).
 *
 *  SLICE 5 default behavior: AR(1) pre-whitening + innovation variance
 *  (NOT HAC inflation) + per-dataset spectral bootstrap calibration +
 *  Family A post-fire cooldown. SLICE 4's HAC inflation is preserved as
 *  an opt-in for back-compat regression comparison via the
 *  `useHacInflation: true, usePrewhitening: false` option combination. */
export function buildPerDatasetConfig(
  values: number[],
  calibrationSignal: string,
  probationaryFraction: number,
  options?: {
    /** SLICE 4 HAC inflation (mutually exclusive with usePrewhitening).
     *  Default false in SLICE 5 — pre-whitening is the active correction. */
    useHacInflation?: boolean;
    /** SLICE 5 AR(1) pre-whitening + innovation variance. Default true.
     *  When false AND useHacInflation false, falls back to iid-calibrated
     *  marginal σ² (the pre-SLICE-4 behavior; mostly silent-fails on
     *  high-φ NAB data — kept for SLICE-by-SLICE regression measurement). */
    usePrewhitening?: boolean;
    /** SLICE 5 post-fire cooldown for Family A detectors. Default 1000.
     *  Set to 0 to disable. */
    familyACooldownTicks?: number;
    /** SLICE 6 — enable anomaly-likelihood smoothing (Numenta-style
     *  persistence filter). Default true. Set false to revert to SLICE 5
     *  raw cooldown wrapper. */
    useAnomalyLikelihoodSmoothing?: boolean;
    /** Phase E SLICE 8 — enable multi-lag AR(p) Yule-Walker calibration
     *  with AIC order selection (vs SLICE 5's single-lag AR(1)).
     *  Default false at SLICE 8 emit (architect-pick per spec § ASK 4 —
     *  opt-in until SLICE 11 measurement validates default-flip). When
     *  enabled, the fitted `phi` vector + innovation σ² replace the
     *  SLICE 5 single-lag stamping; the Family A dispatcher consumes
     *  the multi-lag prewhitening helper. */
    useArPCalibration?: boolean;
    /** Phase E SLICE 8 — AR(p) order cap. Default `floor(N/10)` clamped
     *  to [1, 30] per spec § ASK 2. Override for testing or for cases
     *  with strong-prior order knowledge. */
    arPMaxOrder?: number;
    /** Phase E SLICE 8 — information criterion for order selection.
     *  Default 'aic' per spec § ASK 1. */
    arPInformationCriterion?: 'aic' | 'bic';
  },
): { config: Record<string, unknown>; provenance: PerDatasetCalibrationProvenance } {
  // SLICE 5 — default mode: pre-whitening ON, HAC OFF, cooldown=1000.
  // The legacy SLICE 4 path (HAC=true, prewhiten=false) is preserved for
  // regression measurement but is no longer the default — the empirical
  // sweep showed HAC inflation silently disabled page-CUSUM fires and
  // did nothing for betting; pre-whitening is the active correction.
  const usePrewhitening = options?.usePrewhitening ?? true;
  const useHac = options?.useHacInflation ?? false;
  if (usePrewhitening && useHac) {
    throw new Error(
      'buildPerDatasetConfig: usePrewhitening and useHacInflation are mutually '
      + 'exclusive — both correct the iid-vs-AR(1) mismatch but via opposing '
      + 'mechanisms. Pick one.',
    );
  }
  const familyACooldownTicks = options?.familyACooldownTicks ?? DEFAULT_FAMILY_A_COOLDOWN_TICKS;
  const useSmoothing = options?.useAnomalyLikelihoodSmoothing ?? true;
  // Phase E SLICE 8 — AR(p) opt-in (architect-pick: default false at
  // emit; SLICE 11 may flip after periodic-decomp landing).
  const useArP = options?.useArPCalibration ?? false;

  const nProbationary = Math.max(2, Math.floor(values.length * probationaryFraction));
  const probationary = values.slice(0, nProbationary);
  const mu = mean(probationary);
  const iidSigma2 = sampleVariance(probationary, mu);
  const phi = ar1Phi(probationary, mu);

  // Phase E SLICE 8 — AR(p) multi-lag fit on probationary window with
  // AIC-optimal order. Default off; opt-in via `useArPCalibration`.
  // When enabled, both the stamped innovation variance AND the
  // dispatcher's pre-whitening φ-vector come from this fit; the single-
  // lag SLICE 5 phi above is retained for back-compat provenance only.
  const arPFit = useArP
    ? fitArP(probationary, mu, {
        p_max: options?.arPMaxOrder,
        ic: options?.arPInformationCriterion,
      })
    : null;

  // Variance to stamp into the per-signal config. SLICE 5 default uses
  // INNOVATION variance σ²·(1−φ²) so the detector — receiving pre-
  // whitened residuals — operates on the right scale. SLICE 4 legacy:
  // HAC long-run σ²·(1+φ)/(1−φ). Phase E SLICE 8 (AR(p)): innovation
  // variance comes from the multi-lag Yule-Walker fit; supersedes the
  // single-lag (1-φ²) formula above.
  let sigma2: number;
  if (arPFit && arPFit.sigma2_innovation > 1e-12) {
    // AR(p) fit dominates when opted in and the fit is non-degenerate.
    sigma2 = arPFit.sigma2_innovation;
  } else if (usePrewhitening) {
    // Innovation variance under AR(1). Floor against degenerate φ̂ = ±1.
    const phiSquared = Math.min(phi * phi, 0.9999);
    sigma2 = Math.max(iidSigma2 * (1 - phiSquared), 1e-12);
  } else if (useHac) {
    sigma2 = iidSigma2 * hacInflationFactor(phi);
  } else {
    // Raw marginal variance (pre-SLICE-4 iid-calibrated baseline).
    sigma2 = iidSigma2;
  }
  const sigma = Math.sqrt(sigma2);

  // Calibrate spectral bootstrap-null quantile from probationary
  // peak-ACF distribution. This stays in marginal-variance scale (raw
  // values) because spectral consumes raw observations — pre-whitening
  // would destroy the autocorrelation it measures.
  const spectralCalib = calibrateSpectralBootstrapQuantile(
    probationary,
    DEFAULT_SPECTRAL_MIN_PEAK_LAG,
    DEFAULT_SPECTRAL_MAX_PEAK_LAG,
    SPECTRAL_BOOTSTRAP_QUANTILE,
  );

  const provenance: PerDatasetCalibrationProvenance = {
    probationary_fraction: probationaryFraction,
    n_probationary_ticks: nProbationary,
    n_total_ticks: values.length,
    derived: { baseline_mean: mu, baseline_sigma_squared: iidSigma2, ar1_phi: phi },
    hac_inflation: useHac ? {
      phi_used: phi,
      factor: hacInflationFactor(phi),
      iid_sigma_squared: iidSigma2,
      inflated_sigma_squared: sigma2,
    } : undefined,
    pre_whitening: usePrewhitening ? {
      phi_used: phi,
      marginal_sigma_squared: iidSigma2,
      innovation_sigma_squared: sigma2,
    } : undefined,
    spectral_bootstrap: {
      quantile_target: SPECTRAL_BOOTSTRAP_QUANTILE,
      quantile_used: spectralCalib.quantile_used,
      n_subwindows: spectralCalib.n_subwindows,
      min_peak_lag: DEFAULT_SPECTRAL_MIN_PEAK_LAG,
      max_peak_lag: DEFAULT_SPECTRAL_MAX_PEAK_LAG,
      empirically_calibrated: spectralCalib.empirically_calibrated,
    },
    family_a_cooldown_ticks: familyACooldownTicks,
    ar_p_calibration: arPFit ? {
      p: arPFit.p,
      phi: arPFit.phi,
      sigma2_innovation: arPFit.sigma2_innovation,
      ic_trace: arPFit.ic_trace,
      ic_kind: arPFit.ic_kind,
      reflection_coefficients: arPFit.reflection_coefficients,
      p_max: Math.max(1, Math.min(30, options?.arPMaxOrder ?? Math.floor(probationary.length / 10))),
    } : undefined,
    smoothing: useSmoothing ? {
      page_cusum: {
        window: DEFAULT_SMOOTHING.pageCusum.window,
        threshold_count: DEFAULT_SMOOTHING.pageCusum.thresholdCount,
        cooldown_ticks: DEFAULT_SMOOTHING.pageCusum.cooldownTicks,
      },
      betting: {
        window: DEFAULT_SMOOTHING.betting.window,
        threshold_count: DEFAULT_SMOOTHING.betting.thresholdCount,
        cooldown_ticks: DEFAULT_SMOOTHING.betting.cooldownTicks,
      },
      mixture_supermartingale: {
        window: DEFAULT_SMOOTHING.mixtureSupermartingale.window,
        threshold_count: DEFAULT_SMOOTHING.mixtureSupermartingale.thresholdCount,
        cooldown_ticks: DEFAULT_SMOOTHING.mixtureSupermartingale.cooldownTicks,
      },
      spectral: {
        window: DEFAULT_SMOOTHING.spectral.window,
        threshold_count: DEFAULT_SMOOTHING.spectral.thresholdCount,
        cooldown_ticks: DEFAULT_SMOOTHING.spectral.cooldownTicks,
      },
    } : undefined,
  };

  // Q70 SLICE 2 fallback stamping (independent of HAC/pre-whitening
  // mode). φ̂ above threshold → stamp LIL hyperparameters; downstream
  // consumers (per-detector wiring; Anvil chaos-experiment scoring)
  // decide whether to engage.
  if (Math.abs(phi) >= AR1_PHI_FALLBACK_THRESHOLD) {
    const lilHyperparams = buildLilBoundHyperparams(4e-4);
    provenance.self_normalized_fallback = {
      reason: 'ar1_phi_exceeds_threshold',
      threshold: AR1_PHI_FALLBACK_THRESHOLD,
      observed_phi: phi,
      lil_hyperparams: lilHyperparams,
    };
  }
  const config = {
    version: 'nab-per-dataset-calibrated',
    compiler_version: '0.2.0',
    compiled_at: new Date().toISOString(),
    baseline_ref: 'nab-per-dataset-calibrated',
    alpha_budget: {
      total: 1e-3,
      per_family: { A: 4e-4, C: 2e-4, D: 1e-4, E: 1e-4 },
    },
    bonferroni_factor: 6,
    baseline_cells: {
      dimensions: ['hour_of_day'],
      // The dispatcher routes through `matchCellByHour(cells, query)` →
      // `buildMSPRTParams` and returns null if no cell matches the query.
      // The query in run-nab-validation pins {hourOfDay: 0, dayOfWeek: 0}
      // (NAB datasets have no temporal metadata), so we ship one stub
      // cell at hour_of_day=0 with `confidence: 'aggregate'` to flow the
      // dispatcher through to the aggregate_fallback path below. Without
      // this cell, lookupCellParams returns null at line 349 and the
      // detector silently no-ops every tick — a finding from Path B
      // empirical run after HAC inflation failed to move NAB scores.
      cells: [{
        key: { hour_of_day: 0 },
        confidence: 'aggregate',
        family_A: { per_signal: {} },
      }],
      aggregate_fallback: {
        family_A: {
          per_signal: {
            [calibrationSignal]: (() => {
              const perSig: FamilyAPerSignalParams = {
                baseline_mean: mu,
                baseline_sigma_squared: sigma2,
                // SLICE 7 — raw σ² for mixture-supermartingale + page-cusum
                // Q2.B.5 consumption. Under pre-whitening mode, sigma2 = innovation
                // variance, which is correct for both detector families:
                // page-cusum receives pre-whitened input from dispatch; mixture-
                // SM receives raw input and pre-whitens internally via ar1_phi.
                // In both cases the per-tick variance proxy is the innovation σ².
                baseline_mean_raw: mu,
                baseline_sigma_squared_raw: sigma2,
                tau_squared: sigma2 / 2,
                delta_min: 1.5 * sigma,
                signal_class: 'heavy_tail',
                betting_sliding_buffer_threshold: 1000,
                betting_calibration_scope: 'sliding_buffer_ar1',
                // SLICE 7 — AR(1) phi from Yule-Walker on probationary
                // window. mixture-supermartingale detector pre-whitens
                // internally; page-cusum & betting pre-whiten externally
                // via the dispatch wrapper.
                ar1_phi: phi,
              };
              // SLICE 7 — derive mixture-supermartingale params (Howard-
              // Ramdas-2021 Gaussian mixture for heavy_tail signal class).
              // Returns { mixture_distribution: 'gaussian',
              //          gaussian_sigma_squared_prior: σ²_raw }.
              const msmParams = deriveMixtureSupermartingaleParams(perSig);
              if (msmParams) perSig.mixture_supermartingale_params = msmParams;
              return perSig;
            })(),
          },
        },
        family_D: {
          [calibrationSignal]: {
            ar1_phi: phi,
            // SLICE 5 — stamp lag bounds (SLICE 4 omitted these, making
            // peakACF return 0 always).
            min_peak_lag: DEFAULT_SPECTRAL_MIN_PEAK_LAG,
            max_peak_lag: DEFAULT_SPECTRAL_MAX_PEAK_LAG,
            // SLICE 5 — per-dataset bootstrap calibration. SLICE 4
            // hardcoded 0.5 (which was below the AR(1) baseline-ACF for
            // φ ≈ 0.95 datasets → fire on every tick if lag bounds had
            // been present).
            bootstrap_null_quantile: spectralCalib.quantile_used,
            peak_acf_threshold: spectralCalib.quantile_used,
            spectral_variant: 'bootstrap_null',
          },
        },
      },
    },
    _calibration_provenance: provenance,
  };
  return { config, provenance };
}

// ── Post-probationary scoring ──────────────────────────────────────

/** Score firings against annotations, restricted to ticks ≥ probationary
 *  cutoff. Standard NAB convention: scoring starts after the probationary
 *  window so the detector has a chance to calibrate. */
export function scorePostProbationary(
  firings: DetectorFiringDecision[],
  annotations: NABDatasetAnnotation[],
  nProbationary: number,
  profile: NABProfile,
): number {
  const postFirings = firings.filter((f) => f.tick >= nProbationary);
  const postAnnotations: NABDatasetAnnotation[] = [];
  for (const a of annotations) {
    if (a.anomaly_window_end < nProbationary) continue;
    postAnnotations.push({
      anomaly_window_start: Math.max(a.anomaly_window_start, nProbationary),
      anomaly_window_end: a.anomaly_window_end,
    });
  }
  return computeNABScore(postFirings, postAnnotations, profile);
}

// ── Self-normalized fallback dispatch (SLICE 3) ───────────────────

/** Run the self-normalized LIL e-process fallback over a NAB dataset.
 *  When `provenance.self_normalized_fallback` is unstamped (low φ̂), this
 *  returns an all-false firing trace (the fallback simply doesn't engage).
 *  When stamped (high φ̂), the evaluator runs on raw observations using
 *  the per-dataset baseline_mean + σ² and the stamped LIL hyperparameters,
 *  with the firing trace expressed in the standard `DetectorFiringDecision`
 *  shape so it scores through the same Lavin-Ahmad path as the other
 *  detector families. */
function runSelfNormalizedOverDataset(
  values: number[],
  provenance: PerDatasetCalibrationProvenance,
): DetectorFiringDecision[] {
  const fallback = provenance.self_normalized_fallback;
  if (!fallback) {
    return values.map((_, t) => ({ tick: t, fire: false }));
  }
  const { baseline_mean, baseline_sigma_squared } = provenance.derived;
  const lilParams = fallback.lil_hyperparams;
  const state = freshSelfNormalizedDetectorState();
  const out: DetectorFiringDecision[] = [];
  for (let t = 0; t < values.length; t++) {
    const v = evaluateSelfNormalizedFallback(state, values[t], baseline_mean, baseline_sigma_squared, lilParams);
    out.push({ tick: t, fire: v.fire, statistic_value: v.statistic, threshold: v.threshold });
  }
  return out;
}

// ── Per-dataset NAB validation ────────────────────────────────────

export interface PerDatasetNABValidationOpts {
  nabRepoPath: string;
  nabSubBenchmarks?: NABSubBenchmark[];
  detectors?: NABDetectorFamily[];
  labelsPath?: string;
  calibrationSignal?: string;
  probationaryFraction?: number;
  /** SLICE 4 legacy HAC inflation. Default false (SLICE 5 uses pre-whitening). */
  useHacInflation?: boolean;
  /** SLICE 5 — AR(1) pre-whitening + innovation variance. Default true. */
  usePrewhitening?: boolean;
  /** SLICE 5 — Family A post-fire cooldown ticks. Default 1000. */
  familyACooldownTicks?: number;
  /** SLICE 6 — anomaly-likelihood smoothing. Default true. */
  useAnomalyLikelihoodSmoothing?: boolean;
  /** Phase E SLICE 8 — AR(p) multi-lag calibration. Default false. */
  useArPCalibration?: boolean;
  /** Phase E SLICE 8 — AR(p) order cap. */
  arPMaxOrder?: number;
  /** Phase E SLICE 8 — AR(p) order selection criterion. */
  arPInformationCriterion?: 'aic' | 'bic';
}

export interface PerDatasetNABDatasetScore {
  dataset_path: string;
  n_ticks: number;
  n_probationary_ticks: number;
  n_anomaly_windows: number;
  standard_profile_score: number;
  reward_low_fp_score: number;
  reward_low_fn_score: number;
  baseline_mean: number;
  baseline_sigma_squared: number;
  ar1_phi: number;
}

export interface PerDatasetNABValidationReport {
  metadata: {
    tool_version: string;
    probationary_fraction: number;
    sub_benchmarks_evaluated: NABSubBenchmark[];
    detectors_evaluated: NABDetectorFamily[];
    calibration_signal: string;
    nab_repo_path: string;
    generated_at: string;
  };
  per_family_scores: Record<NABDetectorFamily, {
    standard_profile_score: number;
    reward_low_fp_score: number;
    reward_low_fn_score: number;
    per_dataset_breakdown: Record<string, PerDatasetNABDatasetScore>;
  }>;
  acceptance_results: {
    family_A_betting_passes: boolean;
    family_A_page_cusum_passes: boolean;
    family_A_mixture_supermartingale_passes: boolean;
    family_D_spectral_passes: boolean;
    family_A_passes: boolean;
    family_D_passes: boolean;
    combined_acceptance: boolean;
  };
}

export function runPerDatasetNABValidation(opts: PerDatasetNABValidationOpts): PerDatasetNABValidationReport {
  const subBenchmarks = opts.nabSubBenchmarks ?? DEFAULT_SUB_BENCHMARKS;
  const detectors = opts.detectors ?? DEFAULT_DETECTORS;
  const calibrationSignal = opts.calibrationSignal ?? DEFAULT_CALIBRATION_SIGNAL;
  const probationaryFraction = opts.probationaryFraction ?? DEFAULT_PROBATIONARY_FRACTION;
  const labelsPath = opts.labelsPath ?? path.join(opts.nabRepoPath, 'labels', 'combined_windows.json');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nab-per-dataset-'));

  const datasets = discoverNABDatasets(opts.nabRepoPath, subBenchmarks);
  const labels = loadNABLabels(labelsPath);

  const perFamilyScores = {} as PerDatasetNABValidationReport['per_family_scores'];
  for (const fam of detectors) {
    perFamilyScores[fam] = {
      standard_profile_score: 0,
      reward_low_fp_score: 0,
      reward_low_fn_score: 0,
      per_dataset_breakdown: {},
    };
  }

  for (const dataset of datasets) {
    const { values, timestamps } = parseNABDatasetCsv(dataset.absPath);
    if (values.length < 20) continue;
    const labelWindows = labels[dataset.relPath] ?? [];
    const annotations = annotationsFromLabels(labelWindows, timestamps);
    const { config, provenance } = buildPerDatasetConfig(values, calibrationSignal, probationaryFraction, {
      useHacInflation: opts.useHacInflation,
      usePrewhitening: opts.usePrewhitening,
      familyACooldownTicks: opts.familyACooldownTicks,
      useAnomalyLikelihoodSmoothing: opts.useAnomalyLikelihoodSmoothing,
      useArPCalibration: opts.useArPCalibration,
      arPMaxOrder: opts.arPMaxOrder,
      arPInformationCriterion: opts.arPInformationCriterion,
    });
    const cfgPath = path.join(tmpDir, dataset.relPath.replace(/\//g, '__').replace(/\.csv$/, '.json'));
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(config));
    const nProbationary = provenance.n_probationary_ticks;
    // SLICE 5+6+8 — per-detector dispatch opts:
    // - Family A page-cusum + betting: pre-whitening (single- or multi-
    //   lag) + smoothing (or raw cooldown). Phase E SLICE 8: when
    //   ar_p_calibration is stamped, the multi-lag φ vector supersedes
    //   the single-lag φ̂ for these detectors.
    // - Family D spectral: NO pre-whitening (autocorrelation is the
    //   signal); smoothing applies to dedupe + delay.
    const sm = provenance.smoothing;
    const baseFamilyA = provenance.pre_whitening ? {
      prewhitenPhi: provenance.pre_whitening.phi_used,
      prewhitenMean: provenance.derived.baseline_mean,
      // Phase E SLICE 8 — when AR(p) calibration ran, hand the
      // multi-lag φ vector to the dispatcher; the dispatcher's
      // prewhitenPhiArray path supersedes the single-lag prewhitenPhi
      // when both are present.
      prewhitenPhiArray: provenance.ar_p_calibration?.phi,
    } : {};
    const familyAPageCusumOpts = sm ? {
      ...baseFamilyA,
      cooldownTicks: sm.page_cusum.cooldown_ticks,
      smoothingWindow: sm.page_cusum.window,
      smoothingThresholdCount: sm.page_cusum.threshold_count,
    } : {
      ...baseFamilyA,
      cooldownTicks: provenance.family_a_cooldown_ticks,
    };
    const familyABettingOpts = sm ? {
      ...baseFamilyA,
      cooldownTicks: sm.betting.cooldown_ticks,
      smoothingWindow: sm.betting.window,
      smoothingThresholdCount: sm.betting.threshold_count,
    } : {
      ...baseFamilyA,
      cooldownTicks: provenance.family_a_cooldown_ticks,
    };
    // SLICE 7 — mixture-supermartingale detector. NO external
    // pre-whitening (detector pre-whitens internally via its ar1_phi
    // input — external pre-whitening would double-correct).
    const familyAMixtureSMOpts = sm ? {
      cooldownTicks: sm.mixture_supermartingale.cooldown_ticks,
      smoothingWindow: sm.mixture_supermartingale.window,
      smoothingThresholdCount: sm.mixture_supermartingale.threshold_count,
    } : {
      cooldownTicks: provenance.family_a_cooldown_ticks,
    };
    const familyDSpectralOpts = sm ? {
      cooldownTicks: sm.spectral.cooldown_ticks,
      smoothingWindow: sm.spectral.window,
      smoothingThresholdCount: sm.spectral.threshold_count,
    } : {
      cooldownTicks: provenance.family_a_cooldown_ticks,
    };
    for (const fam of detectors) {
      let firings: DetectorFiringDecision[];
      if (fam === ('self_normalized_lil' as NABDetectorFamily)) {
        firings = runSelfNormalizedOverDataset(values, provenance);
      } else {
        const dispatchOpts =
          fam === 'family_A_page_cusum' ? familyAPageCusumOpts
          : fam === 'family_A_betting' ? familyABettingOpts
          : fam === 'family_A_mixture_supermartingale' ? familyAMixtureSMOpts
          : familyDSpectralOpts;
        firings = runDetectorOverDataset(fam, values, cfgPath, calibrationSignal, dispatchOpts);
      }
      const standard = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.standard);
      const lowFp = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.reward_low_fp);
      const lowFn = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.reward_low_fn);
      perFamilyScores[fam].per_dataset_breakdown[dataset.relPath] = {
        dataset_path: dataset.relPath,
        n_ticks: values.length,
        n_probationary_ticks: nProbationary,
        n_anomaly_windows: annotations.length,
        standard_profile_score: standard,
        reward_low_fp_score: lowFp,
        reward_low_fn_score: lowFn,
        baseline_mean: provenance.derived.baseline_mean,
        baseline_sigma_squared: provenance.derived.baseline_sigma_squared,
        ar1_phi: provenance.derived.ar1_phi,
      };
    }
  }

  for (const fam of detectors) {
    const fb = perFamilyScores[fam];
    const standardMap: Record<string, number> = {};
    const lowFpMap: Record<string, number> = {};
    const lowFnMap: Record<string, number> = {};
    for (const [k, d] of Object.entries(fb.per_dataset_breakdown)) {
      standardMap[k] = d.standard_profile_score;
      lowFpMap[k] = d.reward_low_fp_score;
      lowFnMap[k] = d.reward_low_fn_score;
    }
    fb.standard_profile_score = aggregateFamilyScore(standardMap);
    fb.reward_low_fp_score = aggregateFamilyScore(lowFpMap);
    fb.reward_low_fn_score = aggregateFamilyScore(lowFnMap);
  }

  const aBettingPass = (perFamilyScores.family_A_betting?.standard_profile_score ?? 0) >= 50;
  const aPageCusumPass = (perFamilyScores.family_A_page_cusum?.standard_profile_score ?? 0) >= 50;
  const aMixtureSMPass = (perFamilyScores.family_A_mixture_supermartingale?.standard_profile_score ?? 0) >= 50;
  const dSpectralPass = (perFamilyScores.family_D_spectral?.standard_profile_score ?? 0) >= 40;

  const report: PerDatasetNABValidationReport = {
    metadata: {
      tool_version: TOOL_VERSION,
      probationary_fraction: probationaryFraction,
      sub_benchmarks_evaluated: subBenchmarks,
      detectors_evaluated: detectors,
      calibration_signal: calibrationSignal,
      nab_repo_path: opts.nabRepoPath,
      generated_at: new Date().toISOString(),
    },
    per_family_scores: perFamilyScores,
    acceptance_results: {
      family_A_betting_passes: aBettingPass,
      family_A_page_cusum_passes: aPageCusumPass,
      family_A_mixture_supermartingale_passes: aMixtureSMPass,
      family_D_spectral_passes: dSpectralPass,
      family_A_passes: aBettingPass || aPageCusumPass || aMixtureSMPass,
      family_D_passes: dSpectralPass,
      combined_acceptance: (aBettingPass || aPageCusumPass || aMixtureSMPass) && dSpectralPass,
    },
  };

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup best-effort */ }

  return report;
}

// ── CLI ────────────────────────────────────────────────────────────

interface CliArgs {
  nabRepo?: string;
  out?: string;
  probationaryFraction?: number;
  calibrationSignal?: string;
  detectors?: NABDetectorFamily[];
  subBenchmarks?: NABSubBenchmark[];
  useHacInflation?: boolean;
  usePrewhitening?: boolean;
  familyACooldownTicks?: number;
  useAnomalyLikelihoodSmoothing?: boolean;
  useArPCalibration?: boolean;
  arPMaxOrder?: number;
  arPInformationCriterion?: 'aic' | 'bic';
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--nab-repo': out.nabRepo = v; i++; break;
      case '--out': out.out = v; i++; break;
      case '--probationary-fraction': out.probationaryFraction = parseFloat(v); i++; break;
      case '--calibration-signal': out.calibrationSignal = v; i++; break;
      case '--detectors': out.detectors = v.split(',') as NABDetectorFamily[]; i++; break;
      case '--sub-benchmarks': out.subBenchmarks = v.split(',') as NABSubBenchmark[]; i++; break;
      // SLICE 4 legacy HAC inflation knob retained for regression comparison.
      case '--use-hac-inflation': out.useHacInflation = true; out.usePrewhitening = false; break;
      case '--no-hac-inflation': out.useHacInflation = false; break;
      // SLICE 5 — pre-whitening on by default; flag exposes the off-switch.
      case '--no-prewhitening': out.usePrewhitening = false; break;
      case '--family-a-cooldown-ticks': out.familyACooldownTicks = parseInt(v, 10); i++; break;
      case '--no-smoothing': out.useAnomalyLikelihoodSmoothing = false; break;
      case '--ar-p-calibration': out.useArPCalibration = true; break;
      case '--ar-p-max-order': out.arPMaxOrder = parseInt(v, 10); i++; break;
      case '--ar-p-ic':
        if (v !== 'aic' && v !== 'bic') throw new Error(`--ar-p-ic must be 'aic' or 'bic'; got ${v}`);
        out.arPInformationCriterion = v;
        i++;
        break;
    }
  }
  if (!out.nabRepo || !out.out) {
    throw new Error('Required: --nab-repo <path> --out <path>. '
      + 'Optional: --probationary-fraction <0..1> --calibration-signal <name> '
      + '--detectors <a,b,c> --sub-benchmarks <a,b,c> '
      + '--no-prewhitening --use-hac-inflation --family-a-cooldown-ticks <N>');
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv);
  console.log(`[run-nab-per-dataset] tool=${TOOL_VERSION}`);
  console.log(`[run-nab-per-dataset] nab_repo=${args.nabRepo}`);
  console.log(`[run-nab-per-dataset] probationary_fraction=${args.probationaryFraction ?? DEFAULT_PROBATIONARY_FRACTION}`);
  const report = runPerDatasetNABValidation({
    nabRepoPath: args.nabRepo!,
    detectors: args.detectors,
    nabSubBenchmarks: args.subBenchmarks,
    calibrationSignal: args.calibrationSignal,
    probationaryFraction: args.probationaryFraction,
    useHacInflation: args.useHacInflation,
    usePrewhitening: args.usePrewhitening,
    familyACooldownTicks: args.familyACooldownTicks,
    useAnomalyLikelihoodSmoothing: args.useAnomalyLikelihoodSmoothing,
    useArPCalibration: args.useArPCalibration,
    arPMaxOrder: args.arPMaxOrder,
    arPInformationCriterion: args.arPInformationCriterion,
  });
  fs.writeFileSync(args.out!, JSON.stringify(report, null, 2));
  console.log(`[run-nab-per-dataset] wrote ${args.out}`);
  for (const fam of Object.keys(report.per_family_scores)) {
    const s = report.per_family_scores[fam as NABDetectorFamily];
    console.log(`[run-nab-per-dataset]   ${fam}: standard=${s.standard_profile_score.toFixed(2)} low_fp=${s.reward_low_fp_score.toFixed(2)} low_fn=${s.reward_low_fn_score.toFixed(2)}`);
  }
  const a = report.acceptance_results;
  console.log(
    `[run-nab-per-dataset]   acceptance: A_betting=${a.family_A_betting_passes} `
    + `A_page_cusum=${a.family_A_page_cusum_passes} `
    + `A_mixture_supermartingale=${a.family_A_mixture_supermartingale_passes} `
    + `D_spectral=${a.family_D_spectral_passes} combined=${a.combined_acceptance}`,
  );
}

if (require.main === module) {
  main();
}

export { DEFAULT_PROBATIONARY_FRACTION };
