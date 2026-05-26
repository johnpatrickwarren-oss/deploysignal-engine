import { type NABSubBenchmark, type NABDetectorFamily, type NABDatasetAnnotation, type DetectorFiringDecision } from './run-nab-validation';
import { type NABProfile } from './nab-scoring';
declare const DEFAULT_PROBATIONARY_FRACTION = 0.15;
export interface PerDatasetCalibrationProvenance {
    probationary_fraction: number;
    n_probationary_ticks: number;
    n_total_ticks: number;
    derived: {
        baseline_mean: number;
        baseline_sigma_squared: number;
        ar1_phi: number;
    };
}
/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback). */
export declare function buildPerDatasetConfig(values: number[], calibrationSignal: string, probationaryFraction: number): {
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