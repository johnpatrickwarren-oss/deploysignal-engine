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
    /** Path B (HAC variance inflation) provenance. Always populated. The
     *  inflated_sigma_squared field is what gets stamped into the
     *  detector's variance configuration; downstream consumers can recover
     *  the iid σ² by dividing inflated_sigma_squared by hac_inflation_factor. */
    hac_inflation?: {
        phi_used: number;
        factor: number;
        iid_sigma_squared: number;
        inflated_sigma_squared: number;
    };
}
/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback). */
export declare function buildPerDatasetConfig(values: number[], calibrationSignal: string, probationaryFraction: number, options?: {
    useHacInflation?: boolean;
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
    useHacInflation?: boolean;
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
        family_D_spectral_passes: boolean;
        family_A_passes: boolean;
        family_D_passes: boolean;
        combined_acceptance: boolean;
    };
}
export declare function runPerDatasetNABValidation(opts: PerDatasetNABValidationOpts): PerDatasetNABValidationReport;
export { DEFAULT_PROBATIONARY_FRACTION };
//# sourceMappingURL=run-nab-per-dataset.d.ts.map