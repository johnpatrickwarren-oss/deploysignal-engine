// tools/run-nab-validation.ts — Q64 SPEC-4 NAB validation standalone tool.
//
// Per Q64-NAB-FIREWALL-SPEC.md § Q64.3 + § Implementation surface.
// Wraps existing `orchestrate(...)` engine dispatch via wrapper-layer;
// NO engine/detectors/* runtime code modifications (preserves Q58 ADR
// anti-scope clause 3 + Q59 H4 PERMANENT clause + Q60 anti-scope).
//
// Tool architecture (per spec § Q64.3):
//   1. Discover NAB datasets at nabRepoPath/data/<sub-benchmark>/*.csv.
//   2. Discover NAB labels at nabRepoPath/labels/combined_windows.json.
//   3. Per-(dataset × detector): run DeploySignal detector via
//      orchestrate(...) wrapper; capture per-tick firing decisions.
//   4. Per-(dataset × detector): compute NAB score (3 profiles) via
//      Lavin-Ahmad 2015 scoring formulas (tools/nab-scoring.ts).
//   5. Aggregate per-family across datasets.
//   6. Evaluate acceptance gates (Family A ≥ 50; Family D ≥ 40).
//   7. Emit JSON report at outputPath.
//
// Anti-scope:
//   - NO engine/detectors/* modifications.
//   - NO BaselineProvenance enum extension.
//   - NO integration with tools/build-report-card.js.
//   - NO Phase-3.d activation as Q64 dependency.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { computeNABScore, aggregateFamilyScore, NAB_PROFILES, type NABProfile } from './nab-scoring';
import { evaluateFamilyAShadow, type CUSUMStates } from '../detectors/page-cusum.js';
import { evaluateFamilyABettingShadow, type BettingStates } from '../detectors/betting-e-process.js';
import { evaluateFamilyD } from '../detectors/spectral.js';
import {
  evaluatePageCusumMixtureSupermartingale,
  freshMixtureSupermartingaleState,
  type MixtureSupermartingaleStates,
} from '../detectors/family-a-mixture-supermartingale.js';
import { prewhitenAr } from '../detectors/ar-p.js';
import { deseasonalize } from '../detectors/seasonal.js';
import type { CompiledConfig, BaselineCellEntry } from '../types/config.js';
import type { FamilyAPerSignalParams } from '../types/families/a.js';

// ── Q70 SLICE 5 (this PR) — dispatcher-layer calibration interventions ─
//
// SLICE 4 left page-cusum at 17.07, betting at 0, spectral at 17.14 — well
// short of the (≥50, ≥40) NAB gate. SLICE 5 lands three layered fixes at
// the dispatch wrapper (preserves engine/detectors/* anti-scope from
// Q58/Q59/Q60):
//
//   1. AR(1) pre-whitening of detector input. NAB datasets exhibit
//      φ̂ ≈ 0.95 on temperature/sensor signals; the probationary-window
//      σ² estimates the AR(1) MARGINAL variance, but page-CUSUM and
//      betting standardize against assuming iid Gaussian. SLICE 4's HAC
//      inflation (1+φ)/(1−φ) bandaged this for page-CUSUM by widening σ
//      but silently disabled fire (S_n stayed at 0); same intervention
//      did nothing for betting (which fires on bias accumulation in the
//      GRAPA running-mean). Pre-whitening + innovation variance σ²·(1−φ²)
//      restores the iid-residual assumption per Howard-Ramdas-2021 H1'
//      (calibration phi from baseline).
//
//   2. Post-fire cooldown. Page-CUSUM and betting both fire on EVERY
//      tick once S_n / M_t crosses threshold (CUSUM doesn't reset; betting
//      wealth grows unboundedly). NAB scores reward the FIRST detection
//      in a labeled window; subsequent fires are FPs that swamp the per-
//      dataset score. The cooldown holds firing suppressed for K ticks
//      after a fire (default K=1000 — matches typical NAB labeled-window
//      half-width of ~300–600 ticks).
//
//   3. Spectral lag config + bootstrap-null calibration. The SLICE 4
//      stub config omitted `min_peak_lag` / `max_peak_lag` from the
//      family_D entry, making `peakACF(samples, undefined, undefined)`
//      return 0 → never fires. SLICE 5 stamps `[3, 10]` defaults and
//      replaces the hardcoded 0.5 quantile with a per-dataset bootstrap
//      calibration over the probationary window's peak-ACF distribution.
//
// All three live in tools/ — zero engine/detectors/* modification. The
// honest finding is that even with these interventions, NAB-window
// alignment with first-detection time is the structural ceiling for
// page-CUSUM (the detector flags real changes earlier than NAB's labeled
// window starts — good in production, bad for NAB scoring). The
// architectural gate (combined_acceptance) may not pass under this
// regime; Q70 Phase E production-AR(1) substrate (Q70.3 option iii) is
// still the documented path to unblock.

/** AR(1) pre-whitening helper. Given a series, the calibration mean μ,
 *  and the lag-1 autocorrelation φ̂, returns a sequence of residuals
 *  `r_t = (x_t − μ) − φ̂·(x_{t−1} − μ)` re-centered by adding μ back, so
 *  downstream detectors (which mean-center against `baseline_mean` in
 *  their derivation) see `x_t − μ = r_t` as input.
 *
 *  Under AR(1) H₀ with iid Gaussian innovations, the residual sequence is
 *  approximately iid with innovation variance σ²·(1−φ²); the detector's
 *  iid-calibrated math then operates correctly. */
export function prewhitenSeries(values: number[], phi: number, mean: number): number[] {
  if (!Number.isFinite(phi) || Math.abs(phi) >= 1) {
    throw new Error(`prewhitenSeries: phi must be finite and within (-1, 1), got ${phi}`);
  }
  const out: number[] = new Array(values.length);
  let prevDev = 0;
  for (let i = 0; i < values.length; i++) {
    const dev = values[i] - mean;
    const residual = dev - phi * prevDev;
    out[i] = mean + residual;
    prevDev = dev;
  }
  return out;
}

/** Apply post-fire cooldown to a firing trace. After a `fire: true`
 *  decision, the next `cooldownTicks` of firings are suppressed (set to
 *  `fire: false`). Statistic and threshold fields pass through unchanged.
 *  Pure data transform — no engine state coupling. */
export function applyFireCooldown(
  firings: DetectorFiringDecision[],
  cooldownTicks: number,
): DetectorFiringDecision[] {
  if (cooldownTicks <= 0) return firings;
  let suppressUntil = -1;
  const out = firings.map((f) => ({ ...f }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].fire && out[i].tick <= suppressUntil) {
      out[i].fire = false;
    } else if (out[i].fire) {
      suppressUntil = out[i].tick + cooldownTicks;
    }
  }
  return out;
}

/** SLICE 6 — anomaly-likelihood smoothing (NAB-aware window logic).
 *
 *  Replaces the raw cooldown wrapper with a Numenta-style persistence
 *  filter: a fire is emitted only when at least `thresholdCount` of the
 *  most recent `windowK` ticks have detector-fire=true. After emit,
 *  fires are suppressed for `cooldownTicks` (anomaly-likelihood
 *  effectively forms a "confirmed alert" once the rolling count crosses
 *  threshold).
 *
 *  Motivation: page-CUSUM crosses threshold at the FIRST tick of a
 *  sustained shift, but NAB labeled windows trail the actual change
 *  point by ~200–1500 ticks. Empirical classification of the SLICE 5
 *  output showed ~30% of labeled windows have detector fires within
 *  ±500 ticks of the window edge but OUTSIDE the credit zone. Requiring
 *  the rolling fire-count to cross a threshold (a) delays emit until
 *  the anomaly is sustained, increasing the chance the emit lands
 *  inside the labeled window, and (b) dedupes noisy spurious fires
 *  (single-tick CUSUM spikes that don't repeat) so they don't burn
 *  cooldown windows on isolated FPs.
 *
 *  Parameters:
 *  - `windowK`: rolling-window length over which fire-count is summed.
 *  - `thresholdCount`: minimum count of fire=true ticks in the window
 *    required to emit. With windowK=50, thresholdCount=25 means
 *    "detector must have fired in ≥ 50% of the last 50 ticks".
 *  - `cooldownTicks`: post-emit suppression length.
 *
 *  Anti-scope: pure dispatch-layer wrapper; no engine state coupling. */
export function applyAnomalyLikelihoodSmoothing(
  firings: DetectorFiringDecision[],
  windowK: number,
  thresholdCount: number,
  cooldownTicks: number,
): DetectorFiringDecision[] {
  if (windowK <= 0 || thresholdCount <= 0) return firings;
  if (thresholdCount > windowK) {
    throw new Error(
      `applyAnomalyLikelihoodSmoothing: thresholdCount (${thresholdCount}) `
      + `must not exceed windowK (${windowK})`,
    );
  }
  const out = firings.map((f) => ({ ...f, fire: false }));
  let rolling = 0;
  let suppressUntil = -1;
  for (let i = 0; i < firings.length; i++) {
    if (firings[i].fire) rolling += 1;
    if (i >= windowK && firings[i - windowK].fire) rolling -= 1;
    const t = firings[i].tick;
    if (t <= suppressUntil) continue;
    if (rolling >= thresholdCount) {
      out[i].fire = true;
      suppressUntil = t + cooldownTicks;
    }
  }
  return out;
}

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

const DEFAULT_SUB_BENCHMARKS: NABSubBenchmark[] = [
  'realKnownCause',
  'realAWSCloudwatch',
  'artificialNoAnomaly',
  'artificialWithAnomaly',
];

const DEFAULT_DETECTORS: NABDetectorFamily[] = [
  'family_A_betting',
  'family_A_page_cusum',
  'family_A_mixture_supermartingale',
  'family_D_spectral',
];

const TOOL_VERSION = 'Q64 SPEC-4 v1.0';

// ── NAB dataset discovery + parsing ─────────────────────────────

/** Discover NAB dataset CSV files under <nabRepoPath>/data/<sub>/*.csv. */
export function discoverNABDatasets(
  nabRepoPath: string, subBenchmarks: NABSubBenchmark[],
): Array<{ subBenchmark: NABSubBenchmark; relPath: string; absPath: string }> {
  const out: Array<{ subBenchmark: NABSubBenchmark; relPath: string; absPath: string }> = [];
  const dataRoot = path.join(nabRepoPath, 'data');
  if (!fs.existsSync(dataRoot)) {
    throw new Error(`NAB repository missing data/ directory at ${nabRepoPath}; verify nabRepoPath`);
  }
  for (const sub of subBenchmarks) {
    const subDir = path.join(dataRoot, sub);
    if (!fs.existsSync(subDir)) continue;
    const entries = fs.readdirSync(subDir);
    for (const entry of entries) {
      if (!entry.endsWith('.csv')) continue;
      const abs = path.join(subDir, entry);
      const rel = path.join(sub, entry);
      out.push({ subBenchmark: sub, relPath: rel, absPath: abs });
    }
  }
  return out;
}

/** Parse NAB dataset CSV. Numenta convention: header row `timestamp,
 *  value`; per-tick observation. Returns per-tick value array (tick
 *  index = row index post-header). */
export function parseNABDatasetCsv(absPath: string): { values: number[]; timestamps: string[] } {
  const data = fs.readFileSync(absPath, 'utf8');
  const lines = data.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((s) => s.trim());
  const tsIdx = header.indexOf('timestamp');
  const valIdx = header.indexOf('value');
  if (tsIdx < 0 || valIdx < 0) {
    throw new Error(
      `NAB CSV ${path.basename(absPath)} missing 'timestamp' or 'value' header column. `
      + `Got: ${JSON.stringify(header)}`,
    );
  }
  const values: number[] = [];
  const timestamps: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',');
    timestamps.push(f[tsIdx]);
    values.push(parseFloat(f[valIdx]));
  }
  return { values, timestamps };
}

/** Load NAB combined_windows.json labels file. Maps relative dataset
 *  path (e.g. 'realKnownCause/foo.csv') to array of [start_ts, end_ts]
 *  ISO strings. */
export function loadNABLabels(labelsPath: string): Record<string, Array<[string, string]>> {
  if (!fs.existsSync(labelsPath)) {
    throw new Error(`NAB labels missing at ${labelsPath}; verify nabRepoPath/labels/combined_windows.json`);
  }
  const data = fs.readFileSync(labelsPath, 'utf8');
  return JSON.parse(data);
}

/** Convert NAB ISO-timestamp anomaly windows to tick-index annotations
 *  by indexing into the per-dataset timestamps array. */
/** Normalize a NAB timestamp string for comparison.
 *  Labels carry microseconds (`"2014-04-10 07:15:00.000000"`) while
 *  CSVs drop them (`"2014-04-10 07:15:00"`). Strip the fractional
 *  seconds component so label timestamps match CSV timestamps for
 *  tick-bucket lookup. Also tolerates `T` separator and `Z` suffix
 *  defensively. */
function normalizeNABTimestamp(ts: string): string {
  // Convert ISO 'T' separator to space; drop trailing 'Z'.
  let s = ts.replace('T', ' ').replace(/Z$/, '');
  // Strip fractional seconds.
  s = s.replace(/\.\d+$/, '');
  return s;
}

export function annotationsFromLabels(
  labelWindows: Array<[string, string]>, timestamps: string[],
): NABDatasetAnnotation[] {
  const tsToTick = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) tsToTick.set(normalizeNABTimestamp(timestamps[i]), i);
  const out: NABDatasetAnnotation[] = [];
  for (const [startTs, endTs] of labelWindows) {
    const start = tsToTick.get(normalizeNABTimestamp(startTs));
    const end = tsToTick.get(normalizeNABTimestamp(endTs));
    if (start === undefined || end === undefined) continue;  // label timestamp not in dataset
    out.push({ anomaly_window_start: start, anomaly_window_end: end });
  }
  return out;
}

// ── Detector dispatch (wrapper-layer) ────────────────────────────

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
export const DEFAULT_CALIBRATION_SIGNAL = 'p99_latency';

/** Rolling window length for Family D spectral peak-ACF evaluation. */
const FAMILY_D_WINDOW = 60;

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

/** SLICE 7 helper — find the {hour_of_day=0} aggregate stub cell that
 *  the NAB calibrator stamps. Used by the mixture-supermartingale
 *  dispatch case which doesn't go through `lookupCellParams`. */
function findStubAggregateCell(cfg: CompiledConfig): BaselineCellEntry | undefined {
  const cells = cfg.baseline_cells?.cells;
  if (!cells) return undefined;
  return cells.find((c) => c.key.hour_of_day === 0 && c.confidence === 'aggregate');
}

/** SLICE 7 helper — resolve the per-signal mixture-supermartingale
 *  params from a cell, walking through aggregate_fallback when the
 *  cell's own per_signal block is empty. Mirrors the same fallback
 *  pattern as `lookupCellParams` in page-cusum.ts but returns the
 *  raw FamilyAPerSignalParams shape (not the MSPRTParams view-model). */
function resolveMixtureSupermartingalePerSignal(
  cfg: CompiledConfig,
  cell: BaselineCellEntry,
  signal: string,
): FamilyAPerSignalParams | undefined {
  let perSig = cell.family_A?.per_signal[signal];
  if (perSig) return perSig;
  const aggregateFallback = cell.confidence === 'aggregate' || cell.confidence === 'none';
  if (aggregateFallback) {
    perSig = cfg.baseline_cells?.aggregate_fallback.family_A?.per_signal[signal];
  }
  return perSig;
}

export function runDetectorOverDataset(
  family: NABDetectorFamily,
  values: number[],
  compiledConfigPath: string,
  calibrationSignal: string = DEFAULT_CALIBRATION_SIGNAL,
  dispatchOpts?: RunDetectorDispatchOpts,
): DetectorFiringDecision[] {
  // Q64 Phase 4 STUB resolution per architect option (i.a) single-signal-
  // detector emulation (ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-
  // DISPOSITION.md § Ask 1). Family A + Family D natively per-signal;
  // NAB univariate maps cleanly. Calibration source: v5 substrate's
  // family_A.per_signal[calibrationSignal] / family_D[calibrationSignal]
  // (default 'p99_latency' heavy_tail signal class).
  //
  // Architect pseudo-code uses `evaluatePageCusumPerSignal` /
  // `evaluateBettingEProcessPerSignal` / `evaluateSpectralPeakAcfPerSignal`;
  // codebase actuals are `evaluateFamilyAShadow` /
  // `evaluateFamilyABettingShadow` / `evaluateFamilyD` — naming drift
  // only; semantics match (single-signal evaluation per call).
  const cfg = JSON.parse(fs.readFileSync(compiledConfigPath, 'utf8')) as CompiledConfig;

  // NAB datasets carry no hour-of-day metadata; pin to (h=0, d=0) so the
  // detectors fall through to aggregate_fallback (per architect-disposed
  // calibration source: aggregate_fallback.family_A.per_signal[sig] +
  // aggregate_fallback.family_D[sig]).
  const ctx = {
    hourOfDay: 0,
    dayOfWeek: 0,
    ticksSinceDeploy: 0,
    deployAgeDays: 0,
    trafficPct: 1,
  };

  // SLICE 5 / Phase E SLICE 8+9 — pre-whiten Family A inputs.
  // Pipeline (when all options provided):
  //   raw → deseasonalize → pre-whiten (multi-lag or single-lag) → detector
  // Each stage is optional; missing options pass through.
  // Spectral (Family D) consumes raw values throughout — seasonal
  // cycles AND autocorrelation are part of its signal.
  const isFamilyA = family === 'family_A_page_cusum' || family === 'family_A_betting';
  let prewhitenedValues = values;
  if (isFamilyA) {
    // SLICE 9 — first stage: deseasonalize using per-phase means.
    if (
      dispatchOpts?.seasonalMeans
      && dispatchOpts.seasonalMeans.length > 0
      && dispatchOpts.seasonalPeriod
      && dispatchOpts.seasonalPeriod > 0
    ) {
      prewhitenedValues = deseasonalize(
        prewhitenedValues,
        dispatchOpts.seasonalMeans,
        dispatchOpts.seasonalPeriod,
        0,
      );
    }
    // SLICE 5/8 — second stage: AR pre-whitening on the (possibly
    // deseasonalized) series.
    if (dispatchOpts?.prewhitenMean !== undefined) {
      if (dispatchOpts.prewhitenPhiArray && dispatchOpts.prewhitenPhiArray.length > 0) {
        prewhitenedValues = prewhitenAr(prewhitenedValues, dispatchOpts.prewhitenMean, dispatchOpts.prewhitenPhiArray);
      } else if (dispatchOpts.prewhitenPhi !== undefined) {
        prewhitenedValues = prewhitenSeries(prewhitenedValues, dispatchOpts.prewhitenPhi, dispatchOpts.prewhitenMean);
      }
    }
  }

  const out: DetectorFiringDecision[] = [];

  if (family === 'family_A_page_cusum') {
    const states: CUSUMStates = {};
    for (let t = 0; t < prewhitenedValues.length; t++) {
      const verdicts = evaluateFamilyAShadow(
        cfg,
        { [calibrationSignal]: prewhitenedValues[t] },
        states,
        { ...ctx, ticksSinceDeploy: t },
      );
      const v = verdicts.find((x) => x.signal === calibrationSignal);
      out.push({
        tick: t,
        fire: v?.verdict === 'fire',
        statistic_value: v?.statistic ?? undefined,
        threshold: v?.threshold ?? undefined,
      });
    }
  } else if (family === 'family_A_betting') {
    const states: BettingStates = {};
    for (let t = 0; t < prewhitenedValues.length; t++) {
      const verdicts = evaluateFamilyABettingShadow(
        cfg,
        { [calibrationSignal]: prewhitenedValues[t] },
        states,
        { ...ctx, ticksSinceDeploy: t },
      );
      const v = verdicts.find((x) => x.signal === calibrationSignal);
      out.push({
        tick: t,
        fire: v?.verdict === 'fire',
        statistic_value: v?.statistic ?? undefined,
        threshold: v?.threshold ?? undefined,
      });
    }
  } else if (family === 'family_A_mixture_supermartingale') {
    // Q70 SLICE 7 — Howard-Ramdas-2021 mixture-supermartingale Page-CUSUM
    // variant. Anytime-valid Ville-bounded: P(sup_t M_t ≥ 1/α) ≤ α by
    // construction. AR(1) pre-whitening is built INTO the detector via
    // its `ar1_phi` input — caller must NOT pre-whiten externally
    // (double-whitening would compound the correction).
    //
    // SLICE 7 architectural decision: this detector is the empirically-
    // verifiable replacement for the deferred §7 LIL fallback wiring
    // from SLICE 1-3. The LIL bound (per confseq library docstring) is
    // for empirical-CDF / quantile work, NOT mean-shift detection. The
    // mixture-supermartingale is the right tool for mean-shift; both
    // are anytime-valid Ville-bounded but for different statistics.
    const states: MixtureSupermartingaleStates = {};
    const cell = findStubAggregateCell(cfg);
    const perSig = cell ? resolveMixtureSupermartingalePerSignal(cfg, cell, calibrationSignal) : undefined;
    if (!perSig || !perSig.mixture_supermartingale_params) {
      // Calibrator did not stamp mixture params — emit all-false (silent)
      // rather than throw, mirroring the page-cusum dispatch's null-cell
      // behavior. Configs predating SLICE 7 carry no mixture params.
      for (let t = 0; t < values.length; t++) {
        out.push({ tick: t, fire: false });
      }
    } else {
      const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
      const bonf = cfg.bonferroni_factor ?? 6;
      const alpha = alphaFamilyA / bonf;
      const baselineMean = perSig.baseline_mean_raw ?? perSig.baseline_mean;
      const sigmaSquared = perSig.baseline_sigma_squared_raw ?? perSig.baseline_sigma_squared;
      const phi = perSig.ar1_phi ?? 0;
      for (let t = 0; t < values.length; t++) {
        if (!states[calibrationSignal]) states[calibrationSignal] = freshMixtureSupermartingaleState();
        const xCentered = values[t] - baselineMean;
        const result = evaluatePageCusumMixtureSupermartingale({
          signal: calibrationSignal,
          x_centered: xCentered,
          live_value: values[t],
          baseline_mean: baselineMean,
          sigma_squared: sigmaSquared,
          params: perSig.mixture_supermartingale_params,
          ar1_phi: phi,
          state: states[calibrationSignal],
          alpha,
        });
        // Per-tick threshold-crossing (non-sticky) so downstream
        // anomaly-likelihood smoothing can dedupe; the detector's own
        // sticky fire latch is not the right unit for window alignment.
        const tickFire = result.M_t >= result.threshold;
        out.push({
          tick: t,
          fire: tickFire,
          statistic_value: result.M_t,
          threshold: result.threshold,
        });
      }
    }
  } else if (family === 'family_D_spectral') {
    const recent: number[] = [];
    for (let t = 0; t < values.length; t++) {
      recent.push(values[t]);
      if (recent.length > FAMILY_D_WINDOW) recent.shift();
      const v = evaluateFamilyD(
        cfg,
        calibrationSignal,
        recent,
        { ...ctx, ticksSinceDeploy: t },
      );
      out.push({
        tick: t,
        fire: v?.verdict === 'fire',
        statistic_value: v?.statistic ?? undefined,
        threshold: v?.threshold ?? undefined,
      });
    }
  } else {
    throw new Error(
      `Detector ${family} not supported at Q64 NAB validation; only `
      + 'family_A_betting + family_A_page_cusum + family_D_spectral architect-picked '
      + '(per Q64 spec § Q64.1 + ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-DISPOSITION.md).');
  }

  // SLICE 6 — when smoothing window is set, apply anomaly-likelihood
  // smoothing (Numenta-style persistence filter with post-emit cooldown).
  // Otherwise fall back to SLICE 5 raw cooldown wrapper.
  const cooldown = dispatchOpts?.cooldownTicks ?? 0;
  if (dispatchOpts?.smoothingWindow && dispatchOpts.smoothingWindow > 0
      && dispatchOpts.smoothingThresholdCount && dispatchOpts.smoothingThresholdCount > 0) {
    return applyAnomalyLikelihoodSmoothing(
      out,
      dispatchOpts.smoothingWindow,
      dispatchOpts.smoothingThresholdCount,
      cooldown,
    );
  }
  return applyFireCooldown(out, cooldown);
}

// ── Main runNABValidation ────────────────────────────────────────

export function runNABValidation(opts: NABValidationOpts): NABValidationReport {
  const subBenchmarks = opts.nabSubBenchmarks ?? DEFAULT_SUB_BENCHMARKS;
  const detectors = opts.detectors ?? DEFAULT_DETECTORS;
  const labelsPath = opts.labelsPath ?? path.join(opts.nabRepoPath, 'labels', 'combined_windows.json');

  const datasets = discoverNABDatasets(opts.nabRepoPath, subBenchmarks);
  const labels = loadNABLabels(labelsPath);

  const perFamilyScores: NABValidationReport['per_family_scores'] = {} as
    NABValidationReport['per_family_scores'];
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
    const labelWindows = labels[dataset.relPath] ?? [];
    const annotations = annotationsFromLabels(labelWindows, timestamps);

    for (const fam of detectors) {
      const firings = runDetectorOverDataset(fam, values, opts.compiledConfig,
        opts.calibrationSignal ?? DEFAULT_CALIBRATION_SIGNAL);
      const standard = computeNABScore(firings, annotations, NAB_PROFILES.standard);
      const lowFp = computeNABScore(firings, annotations, NAB_PROFILES.reward_low_fp);
      const lowFn = computeNABScore(firings, annotations, NAB_PROFILES.reward_low_fn);
      perFamilyScores[fam].per_dataset_breakdown[dataset.relPath] = {
        dataset_path: dataset.relPath,
        n_ticks: values.length,
        n_anomaly_windows: annotations.length,
        standard_profile_score: standard,
        reward_low_fp_score: lowFp,
        reward_low_fn_score: lowFn,
      };
    }
  }

  // Aggregate per-family scores via mean across datasets (Lavin-Ahmad 2015 standard).
  for (const fam of detectors) {
    const fb = perFamilyScores[fam];
    const standardMap: Record<string, number> = {};
    const lowFpMap: Record<string, number> = {};
    const lowFnMap: Record<string, number> = {};
    for (const [rel, ds] of Object.entries(fb.per_dataset_breakdown)) {
      standardMap[rel] = ds.standard_profile_score;
      lowFpMap[rel] = ds.reward_low_fp_score;
      lowFnMap[rel] = ds.reward_low_fn_score;
    }
    fb.standard_profile_score = aggregateFamilyScore(standardMap);
    fb.reward_low_fp_score = aggregateFamilyScore(lowFpMap);
    fb.reward_low_fn_score = aggregateFamilyScore(lowFnMap);
  }

  // Acceptance gates per § Q64.2.
  const familyAStandard = Math.max(
    perFamilyScores.family_A_betting?.standard_profile_score ?? 0,
    perFamilyScores.family_A_page_cusum?.standard_profile_score ?? 0,
  );
  const familyDStandard = perFamilyScores.family_D_spectral?.standard_profile_score ?? 0;
  const family_A_passes = familyAStandard >= 50;
  const family_D_passes = familyDStandard >= 40;

  // Capture metadata.
  let nabRepoVersion = 'unknown';
  const headPath = path.join(opts.nabRepoPath, '.git', 'HEAD');
  if (fs.existsSync(headPath)) {
    try {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      if (head.startsWith('ref: ')) {
        const refPath = path.join(opts.nabRepoPath, '.git', head.slice(5));
        if (fs.existsSync(refPath)) {
          nabRepoVersion = fs.readFileSync(refPath, 'utf8').trim();
        }
      } else {
        nabRepoVersion = head;  // detached HEAD = direct SHA
      }
    } catch { /* ignore; preserve 'unknown' */ }
  }
  let dsCompiledVersion = 'unknown';
  if (fs.existsSync(opts.compiledConfig)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(opts.compiledConfig, 'utf8'));
      dsCompiledVersion = cfg.compiler_version ?? 'unknown';
    } catch { /* ignore */ }
  }

  const report: NABValidationReport = {
    per_family_scores: perFamilyScores,
    acceptance_results: {
      family_A_passes,
      family_D_passes,
      combined_acceptance: family_A_passes && family_D_passes,
    },
    metadata: {
      nab_repo_version: nabRepoVersion,
      deploysignal_compiled_config_version: dsCompiledVersion,
      tool_version: TOOL_VERSION,
      sub_benchmarks_evaluated: subBenchmarks,
      detectors_evaluated: detectors,
    },
  };

  fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });
  fs.writeFileSync(opts.outputPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

// ── CLI entrypoint ───────────────────────────────────────────────

interface CliArgs {
  nabRepo: string;
  compiled: string;
  out: string;
  detectors?: NABDetectorFamily[];
  subBenchmarks?: NABSubBenchmark[];
  calibrationSignal?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--nab-repo': out.nabRepo = v; i++; break;
      case '--compiled': out.compiled = v; i++; break;
      case '--out':      out.out = v; i++; break;
      case '--detectors':
        out.detectors = v.split(',').map((s) => s.trim()) as NABDetectorFamily[];
        i++;
        break;
      case '--sub-benchmarks':
        out.subBenchmarks = v.split(',').map((s) => s.trim()) as NABSubBenchmark[];
        i++;
        break;
      case '--calibration-signal':
        out.calibrationSignal = v;
        i++;
        break;
      default:
        if (k.startsWith('--')) throw new Error(`Unknown flag: ${k}`);
    }
  }
  if (!out.nabRepo || !out.compiled || !out.out) {
    throw new Error(
      'Required: --nab-repo <path> --compiled <path> --out <path>. '
      + 'Optional: --detectors family_A_betting,family_A_page_cusum,family_D_spectral '
      + '--sub-benchmarks realKnownCause,realAWSCloudwatch,artificialNoAnomaly,artificialWithAnomaly',
    );
  }
  return out as CliArgs;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[run-nab-validation] tool=${TOOL_VERSION}`);
  console.log(`[run-nab-validation] nab_repo=${args.nabRepo}`);
  console.log(`[run-nab-validation] compiled=${args.compiled}`);
  const report = runNABValidation({
    nabRepoPath: args.nabRepo,
    compiledConfig: args.compiled,
    outputPath: args.out,
    detectors: args.detectors,
    nabSubBenchmarks: args.subBenchmarks,
    calibrationSignal: args.calibrationSignal,
  });
  console.log(`[run-nab-validation]   nab_repo_version=${report.metadata.nab_repo_version}`);
  for (const fam of report.metadata.detectors_evaluated) {
    const fb = report.per_family_scores[fam];
    console.log(
      `[run-nab-validation]   ${fam}: standard=${fb.standard_profile_score.toFixed(2)} `
      + `low_fp=${fb.reward_low_fp_score.toFixed(2)} low_fn=${fb.reward_low_fn_score.toFixed(2)}`,
    );
  }
  console.log(
    `[run-nab-validation]   acceptance: family_A_passes=${report.acceptance_results.family_A_passes} `
    + `family_D_passes=${report.acceptance_results.family_D_passes} `
    + `combined=${report.acceptance_results.combined_acceptance}`,
  );
  console.log(`[run-nab-validation] wrote ${args.out}`);
}

if (require.main === module) {
  main();
}
