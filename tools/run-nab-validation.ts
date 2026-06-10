#!/usr/bin/env node
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
//
// ── Module layout (decomposed from the original 874-line god-file) ────
// This entrypoint owns ONLY the CLI parse + `main()` execution path; the
// implementation lives in sibling `_nab-validation-*.ts` modules and is
// re-exported below so every previously-importable name (types, loaders,
// transforms, dispatch, report) stays importable from this exact path:
//   - _nab-validation-types.ts       public types + constants
//   - _nab-validation-loading.ts     dataset discovery / CSV / labels
//   - _nab-validation-transforms.ts  pre-whitening + cooldown + smoothing
//   - _nab-validation-dispatch.ts    runDetectorOverDataset (per-family)
//   - _nab-validation-report.ts      runNABValidation orchestration

import { TOOL_VERSION as _TOOL_VERSION } from './_nab-validation-types';
import { runNABValidation } from './_nab-validation-report';

// ── Re-exports (preserve the original import surface) ─────────────

export type {
  NABDetectorFamily,
  NABSubBenchmark,
  DetectorFiringDecision,
  NABDatasetAnnotation,
  NABDatasetScore,
  NABValidationOpts,
  NABValidationReport,
  RunDetectorDispatchOpts,
} from './_nab-validation-types';
export { DEFAULT_CALIBRATION_SIGNAL } from './_nab-validation-types';

export {
  prewhitenSeries,
  applyFireCooldown,
  applyAnomalyLikelihoodSmoothing,
} from './_nab-validation-transforms';

export {
  discoverNABDatasets,
  parseNABDatasetCsv,
  loadNABLabels,
  annotationsFromLabels,
} from './_nab-validation-loading';

export { runDetectorOverDataset } from './_nab-validation-dispatch';

export { runNABValidation } from './_nab-validation-report';

// ── CLI entrypoint ───────────────────────────────────────────────

interface CliArgs {
  nabRepo: string;
  compiled: string;
  out: string;
  detectors?: import('./_nab-validation-types').NABDetectorFamily[];
  subBenchmarks?: import('./_nab-validation-types').NABSubBenchmark[];
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
        out.detectors = v.split(',').map((s) => s.trim()) as import('./_nab-validation-types').NABDetectorFamily[];
        i++;
        break;
      case '--sub-benchmarks':
        out.subBenchmarks = v.split(',').map((s) => s.trim()) as import('./_nab-validation-types').NABSubBenchmark[];
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
  console.log(`[run-nab-validation] tool=${_TOOL_VERSION}`);
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
