import type { NABSubBenchmark, NABDetectorFamily } from '../run-nab-validation';
import type { LilBoundHyperparams } from '../../types/self-normalized-fallback';
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
/** CLI argument shape for the per-dataset NAB runner. */
export interface CliArgs {
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
    useSeasonalDecomposition?: boolean;
    seasonalMinAcf?: number;
}
//# sourceMappingURL=_nab-per-dataset-types.d.ts.map