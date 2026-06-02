// tools/nab-per-dataset/_nab-per-dataset-cli.ts — CLI argument parsing +
// main entrypoint body. Extracted verbatim from run-nab-per-dataset.ts.

import * as fs from 'node:fs';

import type { NABDetectorFamily, NABSubBenchmark } from '../run-nab-validation';
import { DEFAULT_PROBATIONARY_FRACTION, TOOL_VERSION } from './_nab-per-dataset-constants';
import { runPerDatasetNABValidation } from './_nab-per-dataset-eval';
import type { CliArgs } from './_nab-per-dataset-types';

export function parseArgs(argv: string[]): CliArgs {
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
      case '--seasonal-decomposition': out.useSeasonalDecomposition = true; break;
      case '--seasonal-min-acf': out.seasonalMinAcf = parseFloat(v); i++; break;
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

export function main(): void {
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
    useSeasonalDecomposition: args.useSeasonalDecomposition,
    seasonalMinAcf: args.seasonalMinAcf,
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
