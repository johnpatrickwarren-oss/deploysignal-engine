// tools/run-nab-per-dataset.ts — per-dataset-calibrated NAB validation.
//
// Standard NAB benchmark practice (Lavin-Ahmad 2015): each detector gets
// a probationary calibration window (default 15% of dataset head) before
// scoring on the remainder. Numenta's reference runner does this for
// every detector; the Q64 SPEC-4 single-config sweep did not, which is
// why naive cross-domain dispatch produced Family A 0.00.
//
// This tool:
//   1. discovers NAB datasets (delegates to run-nab-validation helpers)
//   2. for each dataset: derives baseline_mean / σ² / ar1_phi from the
//      first probationaryFraction of the CSV values; writes a per-dataset
//      compiled config to a temp dir
//   3. dispatches detectors against the per-dataset config; scores only
//      ticks post-probationary-window (standard NAB practice)
//   4. aggregates per-family scores; emits report JSON
//
// Anti-scope: no engine/detectors/* modification — all tool-side.
// Honest scope: closes the calibration-scale gap; does NOT close the
// within-dataset autocorrelation gap (φ ≈ 0.95 on real NAB datasets).
// That residual gap maps to Q70 SLICE 2 (self-normalized e-process
// fallback wired into page-cusum + conformal dispatch); see
// coordination/Q70-PHASE-3-D-E-CALIBRATION-REGIME-ARCHITECTURE-SPEC.md.
//
// ── Module layout ──────────────────────────────────────────────────
// This file is the runnable entrypoint (`node dist/tools/run-nab-per-
// dataset.js`) and the stable import surface. The implementation lives
// in cohesive sibling modules under `nab-per-dataset/`:
//   _nab-per-dataset-constants.ts — calibration constants + numerics
//   _nab-per-dataset-types.ts     — shared interfaces
//   _nab-per-dataset-config.ts    — per-dataset compiled config build
//   _nab-per-dataset-eval.ts      — scoring + validation orchestrator
//   _nab-per-dataset-cli.ts       — argv parsing + main()
// Everything previously exported from this path is re-exported below so
// existing importers (tests, package.json bins) keep working unchanged.

import { main } from './nab-per-dataset/_nab-per-dataset-cli';

// ── Public re-exports (preserve the historical import surface) ─────
export {
  DEFAULT_PROBATIONARY_FRACTION,
  hacInflationFactor,
} from './nab-per-dataset/_nab-per-dataset-constants';
export {
  buildPerDatasetConfig,
  calibrateSpectralBootstrapQuantile,
} from './nab-per-dataset/_nab-per-dataset-config';
export {
  scorePostProbationary,
  runPerDatasetNABValidation,
} from './nab-per-dataset/_nab-per-dataset-eval';
export type {
  PerDatasetCalibrationProvenance,
  PerDatasetNABValidationOpts,
  PerDatasetNABDatasetScore,
  PerDatasetNABValidationReport,
} from './nab-per-dataset/_nab-per-dataset-types';

// ── CLI ────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
