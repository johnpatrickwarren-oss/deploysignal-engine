#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNABValidation = exports.runDetectorOverDataset = exports.annotationsFromLabels = exports.loadNABLabels = exports.parseNABDatasetCsv = exports.discoverNABDatasets = exports.applyAnomalyLikelihoodSmoothing = exports.applyFireCooldown = exports.prewhitenSeries = exports.DEFAULT_CALIBRATION_SIGNAL = void 0;
const _nab_validation_types_1 = require("./_nab-validation-types");
const _nab_validation_report_1 = require("./_nab-validation-report");
var _nab_validation_types_2 = require("./_nab-validation-types");
Object.defineProperty(exports, "DEFAULT_CALIBRATION_SIGNAL", { enumerable: true, get: function () { return _nab_validation_types_2.DEFAULT_CALIBRATION_SIGNAL; } });
var _nab_validation_transforms_1 = require("./_nab-validation-transforms");
Object.defineProperty(exports, "prewhitenSeries", { enumerable: true, get: function () { return _nab_validation_transforms_1.prewhitenSeries; } });
Object.defineProperty(exports, "applyFireCooldown", { enumerable: true, get: function () { return _nab_validation_transforms_1.applyFireCooldown; } });
Object.defineProperty(exports, "applyAnomalyLikelihoodSmoothing", { enumerable: true, get: function () { return _nab_validation_transforms_1.applyAnomalyLikelihoodSmoothing; } });
var _nab_validation_loading_1 = require("./_nab-validation-loading");
Object.defineProperty(exports, "discoverNABDatasets", { enumerable: true, get: function () { return _nab_validation_loading_1.discoverNABDatasets; } });
Object.defineProperty(exports, "parseNABDatasetCsv", { enumerable: true, get: function () { return _nab_validation_loading_1.parseNABDatasetCsv; } });
Object.defineProperty(exports, "loadNABLabels", { enumerable: true, get: function () { return _nab_validation_loading_1.loadNABLabels; } });
Object.defineProperty(exports, "annotationsFromLabels", { enumerable: true, get: function () { return _nab_validation_loading_1.annotationsFromLabels; } });
var _nab_validation_dispatch_1 = require("./_nab-validation-dispatch");
Object.defineProperty(exports, "runDetectorOverDataset", { enumerable: true, get: function () { return _nab_validation_dispatch_1.runDetectorOverDataset; } });
var _nab_validation_report_2 = require("./_nab-validation-report");
Object.defineProperty(exports, "runNABValidation", { enumerable: true, get: function () { return _nab_validation_report_2.runNABValidation; } });
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = argv[i + 1];
        switch (k) {
            case '--nab-repo':
                out.nabRepo = v;
                i++;
                break;
            case '--compiled':
                out.compiled = v;
                i++;
                break;
            case '--out':
                out.out = v;
                i++;
                break;
            case '--detectors':
                out.detectors = v.split(',').map((s) => s.trim());
                i++;
                break;
            case '--sub-benchmarks':
                out.subBenchmarks = v.split(',').map((s) => s.trim());
                i++;
                break;
            case '--calibration-signal':
                out.calibrationSignal = v;
                i++;
                break;
            default:
                if (k.startsWith('--'))
                    throw new Error(`Unknown flag: ${k}`);
        }
    }
    if (!out.nabRepo || !out.compiled || !out.out) {
        throw new Error('Required: --nab-repo <path> --compiled <path> --out <path>. '
            + 'Optional: --detectors family_A_betting,family_A_page_cusum,family_D_spectral '
            + '--sub-benchmarks realKnownCause,realAWSCloudwatch,artificialNoAnomaly,artificialWithAnomaly');
    }
    return out;
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    console.log(`[run-nab-validation] tool=${_nab_validation_types_1.TOOL_VERSION}`);
    console.log(`[run-nab-validation] nab_repo=${args.nabRepo}`);
    console.log(`[run-nab-validation] compiled=${args.compiled}`);
    const report = (0, _nab_validation_report_1.runNABValidation)({
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
        console.log(`[run-nab-validation]   ${fam}: standard=${fb.standard_profile_score.toFixed(2)} `
            + `low_fp=${fb.reward_low_fp_score.toFixed(2)} low_fn=${fb.reward_low_fn_score.toFixed(2)}`);
    }
    console.log(`[run-nab-validation]   acceptance: family_A_passes=${report.acceptance_results.family_A_passes} `
        + `family_D_passes=${report.acceptance_results.family_D_passes} `
        + `combined=${report.acceptance_results.combined_acceptance}`);
    console.log(`[run-nab-validation] wrote ${args.out}`);
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=run-nab-validation.js.map