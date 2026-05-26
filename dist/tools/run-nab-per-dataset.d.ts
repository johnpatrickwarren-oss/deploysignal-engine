import { type NABSubBenchmark, type NABDetectorFamily, type NABDatasetAnnotation, type DetectorFiringDecision } from './run-nab-validation';
import { type NABProfile } from './nab-scoring';
import type { LilBoundHyperparams } from '../types/self-normalized-fallback';
declare const DEFAULT_PROBATIONARY_FRACTION = 0.15;
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
        page_cusum: {
            window: number;
            threshold_count: number;
            cooldown_ticks: number;
        };
        betting: {
            window: number;
            threshold_count: number;
            cooldown_ticks: number;
        };
        mixture_supermartingale: {
            window: number;
            threshold_count: number;
            cooldown_ticks: number;
        };
        spectral: {
            window: number;
            threshold_count: number;
            cooldown_ticks: number;
        };
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
    /** Phase E SLICE 9 — seasonal decomposition trail. When period is 0,
     *  no strong periodicity was detected and seasonal_means is empty;
     *  the dispatcher falls through to the single-lag AR(1) path. When
     *  period > 0, the dispatcher subtracts `seasonal_means[t mod period]`
     *  from each observation before AR(1) pre-whitening. */
    seasonal_decomposition?: {
        period: number;
        acf_at_period: number;
        seasonal_means: number[];
        /** AR(1) phi refit on the deseasonalized probationary series.
         *  Replaces the raw-series phi when seasonal decomposition is
         *  active, so the dispatcher's pre-whitening operates on the
         *  residual scale. */
        ar1_phi_deseasoned: number;
        sigma2_innovation_deseasoned: number;
    };
}
/** SLICE 5 — calibrate the spectral bootstrap-null quantile from the
 *  probationary window's empirical peak-ACF distribution. Computes
 *  peakACF on each overlapping length-`SPECTRAL_BOOTSTRAP_WINDOW`
 *  subwindow of the probationary data, then returns the (quantile)-th
 *  order statistic. When the probationary window is too short for
 *  reliable calibration, returns SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE
 *  (≪ SLICE 4's hardcoded 0.5 but still loose enough to not silent-fail). */
export declare function calibrateSpectralBootstrapQuantile(probationary: number[], minLag: number, maxLag: number, quantile: number): {
    quantile_used: number;
    n_subwindows: number;
    empirically_calibrated: boolean;
};
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
export declare function buildPerDatasetConfig(values: number[], calibrationSignal: string, probationaryFraction: number, options?: {
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
    /** Phase E SLICE 9 — enable seasonal decomposition (per-phase mean
     *  subtraction) before AR(1) pre-whitening. Default false at SLICE
     *  9 emit (architect-pick per spec § ASK 4 — opt-in until SLICE 11
     *  measurement validates default-flip). When enabled, the
     *  calibrator detects the dominant period via ACF peak search,
     *  computes per-phase seasonal means on the probationary window,
     *  AND refits AR(1) on the deseasonalized residual; both are
     *  stamped in `seasonal_decomposition` provenance so the
     *  dispatcher subtracts the seasonal component AND uses the
     *  refit phi for pre-whitening. */
    useSeasonalDecomposition?: boolean;
    /** Phase E SLICE 9 — override the ACF peak threshold for period
     *  detection. Default 0.25 per spec § ASK 1. */
    seasonalMinAcf?: number;
}): {
    config: Record<string, unknown>;
    provenance: PerDatasetCalibrationProvenance;
};
/** Score firings against annotations, restricted to ticks ≥ probationary
 *  cutoff. Standard NAB convention: scoring starts after the probationary
 *  window so the detector has a chance to calibrate. */
export declare function scorePostProbationary(firings: DetectorFiringDecision[], annotations: NABDatasetAnnotation[], nProbationary: number, profile: NABProfile): number;
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
    /** Phase E SLICE 9 — seasonal decomposition. Default false. */
    useSeasonalDecomposition?: boolean;
    /** Phase E SLICE 9 — ACF threshold for period detection. */
    seasonalMinAcf?: number;
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
export declare function runPerDatasetNABValidation(opts: PerDatasetNABValidationOpts): PerDatasetNABValidationReport;
export { DEFAULT_PROBATIONARY_FRACTION };
//# sourceMappingURL=run-nab-per-dataset.d.ts.map