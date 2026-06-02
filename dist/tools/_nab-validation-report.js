"use strict";
// tools/_nab-validation-report.ts — Q64 SPEC-4 NAB validation orchestration
// + report emission. Extracted from tools/run-nab-validation.ts; the single
// >100-line `runNABValidation` is decomposed into <100-line helpers
// (verbatim contiguous blocks). Re-exported from run-nab-validation.ts so
// the name stays importable from the same path.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNABValidation = runNABValidation;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const nab_scoring_1 = require("./nab-scoring");
const _nab_validation_types_1 = require("./_nab-validation-types");
const _nab_validation_loading_1 = require("./_nab-validation-loading");
const _nab_validation_dispatch_1 = require("./_nab-validation-dispatch");
/** Initialize the empty per-family score accumulator. */
function initPerFamilyScores(detectors) {
    const perFamilyScores = {};
    for (const fam of detectors) {
        perFamilyScores[fam] = {
            standard_profile_score: 0,
            reward_low_fp_score: 0,
            reward_low_fn_score: 0,
            per_dataset_breakdown: {},
        };
    }
    return perFamilyScores;
}
/** Score every (dataset × detector), populating per_dataset_breakdown. */
function scoreDatasets(perFamilyScores, opts, detectors, labelsPath) {
    const datasets = (0, _nab_validation_loading_1.discoverNABDatasets)(opts.nabRepoPath, opts.nabSubBenchmarks ?? _nab_validation_types_1.DEFAULT_SUB_BENCHMARKS);
    const labels = (0, _nab_validation_loading_1.loadNABLabels)(labelsPath);
    for (const dataset of datasets) {
        const { values, timestamps } = (0, _nab_validation_loading_1.parseNABDatasetCsv)(dataset.absPath);
        const labelWindows = labels[dataset.relPath] ?? [];
        const annotations = (0, _nab_validation_loading_1.annotationsFromLabels)(labelWindows, timestamps);
        for (const fam of detectors) {
            const firings = (0, _nab_validation_dispatch_1.runDetectorOverDataset)(fam, values, opts.compiledConfig, opts.calibrationSignal ?? _nab_validation_types_1.DEFAULT_CALIBRATION_SIGNAL);
            const standard = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.standard);
            const lowFp = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.reward_low_fp);
            const lowFn = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.reward_low_fn);
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
}
/** Aggregate per-family scores via mean across datasets (Lavin-Ahmad 2015 standard). */
function aggregatePerFamilyScores(perFamilyScores, detectors) {
    for (const fam of detectors) {
        const fb = perFamilyScores[fam];
        const standardMap = {};
        const lowFpMap = {};
        const lowFnMap = {};
        for (const [rel, ds] of Object.entries(fb.per_dataset_breakdown)) {
            standardMap[rel] = ds.standard_profile_score;
            lowFpMap[rel] = ds.reward_low_fp_score;
            lowFnMap[rel] = ds.reward_low_fn_score;
        }
        fb.standard_profile_score = (0, nab_scoring_1.aggregateFamilyScore)(standardMap);
        fb.reward_low_fp_score = (0, nab_scoring_1.aggregateFamilyScore)(lowFpMap);
        fb.reward_low_fn_score = (0, nab_scoring_1.aggregateFamilyScore)(lowFnMap);
    }
}
/** Evaluate acceptance gates per § Q64.2. */
function evaluateAcceptance(perFamilyScores) {
    const familyAStandard = Math.max(perFamilyScores.family_A_betting?.standard_profile_score ?? 0, perFamilyScores.family_A_page_cusum?.standard_profile_score ?? 0);
    const familyDStandard = perFamilyScores.family_D_spectral?.standard_profile_score ?? 0;
    const family_A_passes = familyAStandard >= 50;
    const family_D_passes = familyDStandard >= 40;
    return {
        family_A_passes,
        family_D_passes,
        combined_acceptance: family_A_passes && family_D_passes,
    };
}
/** Read the NAB repo's checked-out commit SHA (best-effort; 'unknown' on
 *  any failure). */
function captureNabRepoVersion(nabRepoPath) {
    let nabRepoVersion = 'unknown';
    const headPath = path.join(nabRepoPath, '.git', 'HEAD');
    if (fs.existsSync(headPath)) {
        try {
            const head = fs.readFileSync(headPath, 'utf8').trim();
            if (head.startsWith('ref: ')) {
                const refPath = path.join(nabRepoPath, '.git', head.slice(5));
                if (fs.existsSync(refPath)) {
                    nabRepoVersion = fs.readFileSync(refPath, 'utf8').trim();
                }
            }
            else {
                nabRepoVersion = head; // detached HEAD = direct SHA
            }
        }
        catch { /* ignore; preserve 'unknown' */ }
    }
    return nabRepoVersion;
}
/** Read the compiled config's compiler_version (best-effort; 'unknown'). */
function captureCompiledVersion(compiledConfig) {
    let dsCompiledVersion = 'unknown';
    if (fs.existsSync(compiledConfig)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(compiledConfig, 'utf8'));
            dsCompiledVersion = cfg.compiler_version ?? 'unknown';
        }
        catch { /* ignore */ }
    }
    return dsCompiledVersion;
}
// ── Main runNABValidation ────────────────────────────────────────
function runNABValidation(opts) {
    const subBenchmarks = opts.nabSubBenchmarks ?? _nab_validation_types_1.DEFAULT_SUB_BENCHMARKS;
    const detectors = opts.detectors ?? _nab_validation_types_1.DEFAULT_DETECTORS;
    const labelsPath = opts.labelsPath ?? path.join(opts.nabRepoPath, 'labels', 'combined_windows.json');
    const perFamilyScores = initPerFamilyScores(detectors);
    scoreDatasets(perFamilyScores, opts, detectors, labelsPath);
    aggregatePerFamilyScores(perFamilyScores, detectors);
    const acceptance_results = evaluateAcceptance(perFamilyScores);
    const nabRepoVersion = captureNabRepoVersion(opts.nabRepoPath);
    const dsCompiledVersion = captureCompiledVersion(opts.compiledConfig);
    const report = {
        per_family_scores: perFamilyScores,
        acceptance_results,
        metadata: {
            nab_repo_version: nabRepoVersion,
            deploysignal_compiled_config_version: dsCompiledVersion,
            tool_version: _nab_validation_types_1.TOOL_VERSION,
            sub_benchmarks_evaluated: subBenchmarks,
            detectors_evaluated: detectors,
        },
    };
    fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });
    fs.writeFileSync(opts.outputPath, JSON.stringify(report, null, 2) + '\n');
    return report;
}
//# sourceMappingURL=_nab-validation-report.js.map