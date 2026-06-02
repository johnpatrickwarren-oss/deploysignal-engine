// tools/nab-per-dataset/_nab-per-dataset-eval.ts — post-probationary
// scoring, self-normalized fallback dispatch, and the per-dataset NAB
// validation orchestrator. The large `runPerDatasetNABValidation` body is
// decomposed into <100-line helpers (verbatim block extraction; identical
// behavior).

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
  type NABDetectorFamily,
  type NABDatasetAnnotation,
  type DetectorFiringDecision,
} from '../run-nab-validation';
import { computeNABScore, aggregateFamilyScore, NAB_PROFILES, type NABProfile } from '../nab-scoring';
import {
  freshSelfNormalizedDetectorState,
  evaluateSelfNormalizedFallback,
} from '../../detectors/self-normalized-e-process-fallback';

import {
  DEFAULT_SUB_BENCHMARKS,
  DEFAULT_DETECTORS,
  DEFAULT_PROBATIONARY_FRACTION,
  TOOL_VERSION,
} from './_nab-per-dataset-constants';
import { buildPerDatasetConfig } from './_nab-per-dataset-config';
import type {
  PerDatasetCalibrationProvenance,
  PerDatasetNABValidationOpts,
  PerDatasetNABDatasetScore,
  PerDatasetNABValidationReport,
} from './_nab-per-dataset-types';

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

// ── Per-dataset dispatch options ──────────────────────────────────

interface PerDetectorDispatchOpts {
  familyAPageCusumOpts: Record<string, unknown>;
  familyABettingOpts: Record<string, unknown>;
  familyAMixtureSMOpts: Record<string, unknown>;
  familyDSpectralOpts: Record<string, unknown>;
}

/** Build the per-detector dispatch option bags from the calibration
 *  provenance. SLICE 5+6+8 — pre-whitening (single/multi-lag) +
 *  smoothing/cooldown wiring; SLICE 9 deseasoned phi supersession. */
function buildDispatchOpts(provenance: PerDatasetCalibrationProvenance): PerDetectorDispatchOpts {
  // SLICE 5+6+8 — per-detector dispatch opts:
  // - Family A page-cusum + betting: pre-whitening (single- or multi-
  //   lag) + smoothing (or raw cooldown). Phase E SLICE 8: when
  //   ar_p_calibration is stamped, the multi-lag φ vector supersedes
  //   the single-lag φ̂ for these detectors.
  // - Family D spectral: NO pre-whitening (autocorrelation is the
  //   signal); smoothing applies to dedupe + delay.
  const sm = provenance.smoothing;
  const seasonal = provenance.seasonal_decomposition;
  // SLICE 9 — when seasonal decomposition is active, the deseasoned
  // AR(1) phi supersedes the raw-series phi for pre-whitening
  // (operating on residual scale). When AR(p) is ALSO active, the
  // AR(p) phi vector (which was fit on the same deseasonalized
  // series) supersedes both single-lag forms.
  const effectivePrewhitenPhi = seasonal?.ar1_phi_deseasoned
    ?? provenance.pre_whitening?.phi_used;
  const baseFamilyA = (effectivePrewhitenPhi !== undefined) ? {
    prewhitenPhi: effectivePrewhitenPhi,
    prewhitenMean: provenance.derived.baseline_mean,
    prewhitenPhiArray: provenance.ar_p_calibration?.phi,
    seasonalMeans: seasonal?.seasonal_means,
    seasonalPeriod: seasonal?.period,
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
  return { familyAPageCusumOpts, familyABettingOpts, familyAMixtureSMOpts, familyDSpectralOpts };
}

type PerFamilyScores = PerDatasetNABValidationReport['per_family_scores'];

interface DatasetContext {
  values: number[];
  cfgPath: string;
  calibrationSignal: string;
  annotations: NABDatasetAnnotation[];
  provenance: PerDatasetCalibrationProvenance;
  dispatch: PerDetectorDispatchOpts;
  relPath: string;
}

/** Run all detectors over one dataset and write the per-dataset
 *  breakdown into `perFamilyScores`. */
function scoreDatasetAcrossDetectors(
  detectors: NABDetectorFamily[],
  ctx: DatasetContext,
  perFamilyScores: PerFamilyScores,
): void {
  const { values, cfgPath, calibrationSignal, annotations, provenance, dispatch, relPath } = ctx;
  const nProbationary = provenance.n_probationary_ticks;
  for (const fam of detectors) {
    let firings: DetectorFiringDecision[];
    if (fam === ('self_normalized_lil' as NABDetectorFamily)) {
      firings = runSelfNormalizedOverDataset(values, provenance);
    } else {
      const dispatchOpts =
        fam === 'family_A_page_cusum' ? dispatch.familyAPageCusumOpts
        : fam === 'family_A_betting' ? dispatch.familyABettingOpts
        : fam === 'family_A_mixture_supermartingale' ? dispatch.familyAMixtureSMOpts
        : dispatch.familyDSpectralOpts;
      firings = runDetectorOverDataset(fam, values, cfgPath, calibrationSignal, dispatchOpts);
    }
    const standard = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.standard);
    const lowFp = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.reward_low_fp);
    const lowFn = scorePostProbationary(firings, annotations, nProbationary, NAB_PROFILES.reward_low_fn);
    perFamilyScores[fam].per_dataset_breakdown[relPath] = {
      dataset_path: relPath,
      n_ticks: values.length,
      n_probationary_ticks: nProbationary,
      n_anomaly_windows: annotations.length,
      standard_profile_score: standard,
      reward_low_fp_score: lowFp,
      reward_low_fn_score: lowFn,
      baseline_mean: provenance.derived.baseline_mean,
      baseline_sigma_squared: provenance.derived.baseline_sigma_squared,
      ar1_phi: provenance.derived.ar1_phi,
    } satisfies PerDatasetNABDatasetScore;
  }
}

/** Roll the per-dataset breakdown into the aggregated family scores. */
function aggregatePerFamilyScores(detectors: NABDetectorFamily[], perFamilyScores: PerFamilyScores): void {
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

  const perFamilyScores = {} as PerFamilyScores;
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
      useSeasonalDecomposition: opts.useSeasonalDecomposition,
      seasonalMinAcf: opts.seasonalMinAcf,
    });
    const cfgPath = path.join(tmpDir, dataset.relPath.replace(/\//g, '__').replace(/\.csv$/, '.json'));
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(config));
    const dispatch = buildDispatchOpts(provenance);
    scoreDatasetAcrossDetectors(detectors, {
      values, cfgPath, calibrationSignal, annotations, provenance, dispatch, relPath: dataset.relPath,
    }, perFamilyScores);
  }

  aggregatePerFamilyScores(detectors, perFamilyScores);

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
