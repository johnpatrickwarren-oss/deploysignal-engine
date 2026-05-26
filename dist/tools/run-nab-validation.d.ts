/** AR(1) pre-whitening helper. Given a series, the calibration mean μ,
 *  and the lag-1 autocorrelation φ̂, returns a sequence of residuals
 *  `r_t = (x_t − μ) − φ̂·(x_{t−1} − μ)` re-centered by adding μ back, so
 *  downstream detectors (which mean-center against `baseline_mean` in
 *  their derivation) see `x_t − μ = r_t` as input.
 *
 *  Under AR(1) H₀ with iid Gaussian innovations, the residual sequence is
 *  approximately iid with innovation variance σ²·(1−φ²); the detector's
 *  iid-calibrated math then operates correctly. */
export declare function prewhitenSeries(values: number[], phi: number, mean: number): number[];
/** Apply post-fire cooldown to a firing trace. After a `fire: true`
 *  decision, the next `cooldownTicks` of firings are suppressed (set to
 *  `fire: false`). Statistic and threshold fields pass through unchanged.
 *  Pure data transform — no engine state coupling. */
export declare function applyFireCooldown(firings: DetectorFiringDecision[], cooldownTicks: number): DetectorFiringDecision[];
/** Detector family identifier (subset of full DetectorFamily enum;
 *  Q64 evaluates Family A + Family D primary per § Q64.1). */
export type NABDetectorFamily = 'family_A_betting' | 'family_A_page_cusum' | 'family_D_spectral';
export type NABSubBenchmark = 'realKnownCause' | 'realAWSCloudwatch' | 'artificialNoAnomaly' | 'artificialWithAnomaly';
/** Per-tick firing decision captured from detector dispatch. */
export interface DetectorFiringDecision {
    tick: number;
    fire: boolean;
    /** Q64 Phase 4 STUB resolution: per-detector statistic at evaluation
     *  tick (CUSUM S_n; betting wealth M_t; spectral peak |ACF|).
     *  Optional — captured for diagnostic memo emission, not for NAB
     *  scoring (NAB scores depend on `fire` + tick alignment with
     *  annotation windows). */
    statistic_value?: number;
    /** Per-detector threshold (architect-disposed sliding-buffer
     *  threshold or per-cell threshold). Optional. */
    threshold?: number;
}
/** NAB anomaly annotation window (per Numenta labels/combined_windows.json). */
export interface NABDatasetAnnotation {
    anomaly_window_start: number;
    anomaly_window_end: number;
}
export interface NABDatasetScore {
    dataset_path: string;
    n_ticks: number;
    n_anomaly_windows: number;
    standard_profile_score: number;
    reward_low_fp_score: number;
    reward_low_fn_score: number;
}
export interface NABValidationOpts {
    /** Path to NAB repository checkout (numenta/NAB GitHub clone). */
    nabRepoPath: string;
    /** Subset of NAB sub-benchmarks. Default: 4 architect-picked. */
    nabSubBenchmarks?: NABSubBenchmark[];
    /** DeploySignal compiled config path (substrate for detector calibration). */
    compiledConfig: string;
    /** Detector families. Default: family_A_betting + family_A_page_cusum + family_D_spectral. */
    detectors?: NABDetectorFamily[];
    /** Output validation report path. */
    outputPath: string;
    /** Optional NAB labels path override. Default: <nabRepoPath>/labels/combined_windows.json. */
    labelsPath?: string;
    /** Q64 Phase 4 architect-disposed calibration signal (default
     *  'p99_latency' heavy_tail signal class). Detector dispatch sources
     *  v5 substrate's family_A.per_signal[calibrationSignal] +
     *  family_D[calibrationSignal] for NAB scoring. */
    calibrationSignal?: string;
}
export interface NABValidationReport {
    per_family_scores: Record<NABDetectorFamily, {
        standard_profile_score: number;
        reward_low_fp_score: number;
        reward_low_fn_score: number;
        per_dataset_breakdown: Record<string, NABDatasetScore>;
    }>;
    acceptance_results: {
        family_A_passes: boolean;
        family_D_passes: boolean;
        combined_acceptance: boolean;
    };
    metadata: {
        nab_repo_version: string;
        deploysignal_compiled_config_version: string;
        tool_version: string;
        sub_benchmarks_evaluated: NABSubBenchmark[];
        detectors_evaluated: NABDetectorFamily[];
    };
}
/** Discover NAB dataset CSV files under <nabRepoPath>/data/<sub>/*.csv. */
export declare function discoverNABDatasets(nabRepoPath: string, subBenchmarks: NABSubBenchmark[]): Array<{
    subBenchmark: NABSubBenchmark;
    relPath: string;
    absPath: string;
}>;
/** Parse NAB dataset CSV. Numenta convention: header row `timestamp,
 *  value`; per-tick observation. Returns per-tick value array (tick
 *  index = row index post-header). */
export declare function parseNABDatasetCsv(absPath: string): {
    values: number[];
    timestamps: string[];
};
/** Load NAB combined_windows.json labels file. Maps relative dataset
 *  path (e.g. 'realKnownCause/foo.csv') to array of [start_ts, end_ts]
 *  ISO strings. */
export declare function loadNABLabels(labelsPath: string): Record<string, Array<[string, string]>>;
export declare function annotationsFromLabels(labelWindows: Array<[string, string]>, timestamps: string[]): NABDatasetAnnotation[];
/** Run a single detector family over a NAB dataset and capture per-
 *  tick firing decisions. Pure wrapper-layer: imports orchestrate
 *  via shared.js (preserves Q58/Q59/Q60 anti-scope on engine/detectors/*).
 *
 *  Mac Claude implementation deferred to Phase 3 empirical run; tool
 *  framework + scoring helper testable independent of detector
 *  dispatch path. Stub returns empty firing list (caller handles via
 *  Phase 3 architect-disposition or per-detector dispatch resolution
 *  with real NAB data). */
/** Q64 Phase 4 architect-disposed default calibration signal — heavy_tail
 *  signal class most representative of NAB time-series anomalies
 *  (realAWSCloudwatch CPU; realKnownCause sensor data). Settable via
 *  --calibration-signal CLI flag. */
export declare const DEFAULT_CALIBRATION_SIGNAL = "p99_latency";
/** SLICE 5 dispatcher options. All optional with backward-compatible
 *  defaults: when none are supplied, runDetectorOverDataset retains its
 *  pre-SLICE-5 behavior (no pre-whitening, no cooldown). buildPerDataset
 *  Config wires these into the dispatch automatically when its own
 *  `usePrewhitening` / `cooldownTicks` defaults are active. */
export interface RunDetectorDispatchOpts {
    /** When set, pre-whiten the input series by AR(1) with this φ and the
     *  baseline mean (also supplied). Detector receives the pre-whitened
     *  values. Family D spectral is EXEMPT — autocorrelation IS its signal;
     *  pre-whitening would destroy what the detector measures. */
    prewhitenPhi?: number;
    /** Required when `prewhitenPhi` is set. The calibration mean used by the
     *  detector internally (so pre-whitened residuals re-center to it). */
    prewhitenMean?: number;
    /** When > 0, suppress firing for this many ticks after each `fire`
     *  decision. Applied to ALL detector families (CUSUM doesn't reset on
     *  fire; betting wealth grows unboundedly — both produce dense FP
     *  trains without cooldown). */
    cooldownTicks?: number;
}
export declare function runDetectorOverDataset(family: NABDetectorFamily, values: number[], compiledConfigPath: string, calibrationSignal?: string, dispatchOpts?: RunDetectorDispatchOpts): DetectorFiringDecision[];
export declare function runNABValidation(opts: NABValidationOpts): NABValidationReport;
//# sourceMappingURL=run-nab-validation.d.ts.map