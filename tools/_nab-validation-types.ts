// tools/_nab-validation-types.ts — Q64 SPEC-4 NAB validation public types
// + constants. Extracted verbatim from tools/run-nab-validation.ts to keep
// each module under 500 lines; re-exported from run-nab-validation.ts so
// every previously-importable name stays importable from the same path.

// ── Public types ─────────────────────────────────────────────────

/** Detector family identifier (subset of full DetectorFamily enum;
 *  Q64 evaluates Family A + Family D primary per § Q64.1; Q70 SLICE 7
 *  adds the Howard-Ramdas-2021 mixture-supermartingale variant —
 *  anytime-valid Ville-bounded; the architecturally correct construct
 *  for mean-shift detection under correlated observations). */
export type NABDetectorFamily =
  | 'family_A_betting'
  | 'family_A_page_cusum'
  | 'family_A_mixture_supermartingale'
  | 'family_D_spectral';

export type NABSubBenchmark =
  | 'realKnownCause'
  | 'realAWSCloudwatch'
  | 'artificialNoAnomaly'
  | 'artificialWithAnomaly';

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
  anomaly_window_start: number;  // tick index
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
    family_A_passes: boolean;     // any family_A_* >= 50
    family_D_passes: boolean;     // family_D_spectral >= 40
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

export const DEFAULT_SUB_BENCHMARKS: NABSubBenchmark[] = [
  'realKnownCause',
  'realAWSCloudwatch',
  'artificialNoAnomaly',
  'artificialWithAnomaly',
];

export const DEFAULT_DETECTORS: NABDetectorFamily[] = [
  'family_A_betting',
  'family_A_page_cusum',
  'family_A_mixture_supermartingale',
  'family_D_spectral',
];

export const TOOL_VERSION = 'Q64 SPEC-4 v1.0';

/** Q64 Phase 4 architect-disposed default calibration signal — heavy_tail
 *  signal class most representative of NAB time-series anomalies
 *  (realAWSCloudwatch CPU; realKnownCause sensor data). Settable via
 *  --calibration-signal CLI flag. */
export const DEFAULT_CALIBRATION_SIGNAL = 'p99_latency';

/** SLICE 5+6 dispatcher options. All optional with backward-compatible
 *  defaults: when none are supplied, runDetectorOverDataset retains its
 *  pre-SLICE-5 behavior (no pre-whitening, no cooldown, no smoothing).
 *  buildPerDatasetConfig wires these into the dispatch automatically
 *  when its own `usePrewhitening` / `cooldownTicks` /
 *  `useAnomalyLikelihoodSmoothing` defaults are active. */
export interface RunDetectorDispatchOpts {
  /** When set, pre-whiten the input series by AR(1) with this φ and the
   *  baseline mean (also supplied). Detector receives the pre-whitened
   *  values. Family D spectral is EXEMPT — autocorrelation IS its signal;
   *  pre-whitening would destroy what the detector measures. */
  prewhitenPhi?: number;
  /** Required when `prewhitenPhi` is set. The calibration mean used by the
   *  detector internally (so pre-whitened residuals re-center to it). */
  prewhitenMean?: number;
  /** When > 0 AND `smoothingWindow` is unset, suppress firing for this
   *  many ticks after each `fire` decision (raw cooldown wrapper).
   *  When `smoothingWindow` is set, this value is interpreted as the
   *  post-emit cooldown applied by the smoothing wrapper. */
  cooldownTicks?: number;
  /** SLICE 6 — anomaly-likelihood smoothing window length. When > 0,
   *  the dispatcher replaces the raw cooldown wrapper with the
   *  persistence-filter wrapper (`applyAnomalyLikelihoodSmoothing`).
   *  Sweep-tuned default for Family A page-cusum is 50; Family D
   *  spectral is 30 (oscillation periods are shorter). */
  smoothingWindow?: number;
  /** SLICE 6 — anomaly-likelihood smoothing threshold count. Must
   *  satisfy 1 ≤ thresholdCount ≤ smoothingWindow. Detector emits a
   *  fire only when ≥ this many of the most recent `smoothingWindow`
   *  ticks have detector-fire=true. */
  smoothingThresholdCount?: number;
  /** Phase E SLICE 8 — multi-lag AR(p) pre-whitening φ vector.
   *  When provided, supersedes the single-lag `prewhitenPhi` field
   *  above; the dispatcher applies `prewhitenAr(values, mean, phi)`
   *  using all lags simultaneously. Requires `prewhitenMean` to also
   *  be set (the calibration mean used by the detector internally so
   *  pre-whitened residuals re-center correctly). Empty array or
   *  undefined → fall through to single-lag path. Family D spectral
   *  remains EXEMPT (autocorrelation IS its signal). */
  prewhitenPhiArray?: number[];
  /** Phase E SLICE 9 — seasonal means for per-phase subtraction
   *  BEFORE AR pre-whitening. When provided (and `seasonalPeriod` is
   *  also set), the dispatcher first deseasonalizes the input series
   *  by subtracting `seasonalMeans[t mod seasonalPeriod]` from each
   *  observation, then applies AR pre-whitening. Family D spectral
   *  remains EXEMPT (seasonal cycles are part of its signal). */
  seasonalMeans?: number[];
  /** Phase E SLICE 9 — seasonal period (length of seasonalMeans). */
  seasonalPeriod?: number;
}
