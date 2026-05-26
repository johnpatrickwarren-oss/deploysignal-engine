"use strict";
// test/q64-nab-validation.test.ts — Q64 SPEC-4 NAB validation acceptance.
//
// Per Q64-NAB-FIREWALL-SPEC.md § Tests block. Phase 2-3 deliverable
// (acquisition-independent): scoring helper + tool framework verified
// via synthetic firings + annotations + miniature NAB-shaped fixture
// directory. Phase 4 empirical run against ~35-dataset NAB subset is
// deferred until John pre-acquires NAB repo (analogous to Q60/Q62
// dataset acquisition halt patterns).
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const nab_scoring_1 = require("../tools/nab-scoring");
const run_nab_validation_1 = require("../tools/run-nab-validation");
// ── Synthetic fixture helpers ───────────────────────────────────────
/** Q64 Phase 4 STUB-resolution support: minimum compiled config for
 *  runDetectorOverDataset dispatch on `p99_latency` calibration signal.
 *  Mirrors v5-sequential-e-process.json subset shape: family_A.per_signal
 *  + family_D entries on aggregate_fallback so detector dispatch resolves
 *  cleanly without a full v5 fixture (~15MB).
 *  Per architect ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-DISPOSITION
 *  § Calibration substrate disposition: family_A.per_signal['p99_latency']
 *  + family_D['p99_latency'] heavy_tail signal class. */
function buildMiniCompiledConfig() {
    const cfg = {
        version: 'q64-test-fixture',
        compiler_version: '0.2.0',
        compiled_at: '2026-05-04T00:00:00Z',
        baseline_ref: 'q64-test-fixture',
        alpha_budget: { total: 1e-3, per_family: { A: 4e-4, C: 2e-4, D: 1e-4, E: 1e-4 } },
        bonferroni_factor: 6,
        baseline_cells: {
            dimensions: ['hour_of_day'],
            cells: [],
            aggregate_fallback: {
                family_A: {
                    per_signal: {
                        p99_latency: {
                            baseline_mean: 1.0,
                            baseline_sigma_squared: 0.01,
                            tau_squared: 0.005,
                            delta_min: 0.5,
                            signal_class: 'heavy_tail',
                            betting_sliding_buffer_threshold: 1000,
                            betting_calibration_scope: 'sliding_buffer_ar1',
                            derivation: { mean: 1.0, empirical_variance: 0.01 },
                        },
                    },
                },
                family_D: {
                    p99_latency: {
                        ar1_phi: 0.5,
                        peak_acf_threshold: 0.5,
                        bootstrap_null_quantile: 0.5,
                        spectral_variant: 'bootstrap_null',
                    },
                },
            },
        },
    };
    const p = path.join(os.tmpdir(), `q64-mini-compiled-${Date.now()}.json`);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    return p;
}
function buildMiniNABRepo() {
    // Build a temp NAB-shaped directory with 4 sub-benchmark categories,
    // 1 dataset each, + minimal labels file. Used to exercise discovery
    // + parsing + dispatch loop without needing real NAB checkout.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q64-mini-nab-'));
    const subs = ['realKnownCause', 'realAWSCloudwatch', 'artificialNoAnomaly', 'artificialWithAnomaly'];
    const labels = {};
    const baseTs = Date.parse('2024-01-01T00:00:00');
    for (const sub of subs) {
        const dir = path.join(root, 'data', sub);
        fs.mkdirSync(dir, { recursive: true });
        // 100-tick synthetic CSV.
        const lines = ['timestamp,value'];
        const tsForTick = [];
        for (let t = 0; t < 100; t++) {
            const ts = new Date(baseTs + t * 60000).toISOString().replace(/\..*$/, '');
            tsForTick.push(ts);
            // Inject anomaly bump at tick 50-60 in artificialWithAnomaly + realKnownCause.
            const value = (sub === 'artificialWithAnomaly' || sub === 'realKnownCause')
                ? (t >= 50 && t <= 60 ? 5.0 + Math.random() * 0.1 : 1.0 + Math.random() * 0.1)
                : 1.0 + Math.random() * 0.1;
            lines.push(`${ts},${value.toFixed(4)}`);
        }
        fs.writeFileSync(path.join(dir, 'sample.csv'), lines.join('\n'));
        // Add anomaly window to labels for the WithAnomaly + KnownCause datasets.
        if (sub === 'artificialWithAnomaly' || sub === 'realKnownCause') {
            labels[`${sub}/sample.csv`] = [[tsForTick[50], tsForTick[60]]];
        }
        else {
            labels[`${sub}/sample.csv`] = [];
        }
    }
    fs.mkdirSync(path.join(root, 'labels'), { recursive: true });
    fs.writeFileSync(path.join(root, 'labels', 'combined_windows.json'), JSON.stringify(labels, null, 2));
    return root;
}
// ── NAB scoring helper tests ────────────────────────────────────────
(0, node_test_1.test)('Q64 #1: NAB scoring per Lavin-Ahmad 2015 standard profile produces high score on detection at window start', () => {
    const firings = [{ tick: 50, fire: true }];
    const annotations = [{ anomaly_window_start: 50, anomaly_window_end: 60 }];
    const score = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.standard);
    // Detection at window start → rel_pos = 1.0 → sigmoidDecay = sigmoid(5) ≈ 0.993
    // raw = 1.0 × 0.993 ≈ 0.993; perfect = 1.0 × 0.993; normalized = 100.
    strict_1.default.ok(score >= 95, `detection at window start should score near-perfect; got ${score.toFixed(2)}`);
});
(0, node_test_1.test)('Q64 #2: NAB scoring penalizes FP per profile weights (reward_low_fp heavier)', () => {
    // FP at tick 10 (well before any anomaly window).
    const firings = [{ tick: 10, fire: true }];
    const annotations = [{ anomaly_window_start: 50, anomaly_window_end: 60 }];
    const standardScore = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.standard);
    const lowFpScore = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.reward_low_fp);
    // reward_low_fp profile penalizes FP heavier → score lower than standard.
    // Both have raw < 0 because no TP and 1 FP + 1 FN.
    // Normalization clamps at 0 lower bound; both expected at 0.
    strict_1.default.ok(lowFpScore <= standardScore + 1e-6, `low_fp score (${lowFpScore}) should be ≤ standard (${standardScore}) under FP-only firings`);
});
(0, node_test_1.test)('Q64 #3: NAB scoring counts FN when no detection within window', () => {
    // No firings at all.
    const firings = [{ tick: 10, fire: false }];
    const annotations = [{ anomaly_window_start: 50, anomaly_window_end: 60 }];
    const score = (0, nab_scoring_1.computeNABScore)(firings, annotations, nab_scoring_1.NAB_PROFILES.standard);
    // raw = -1.0 (FN); normalized clamps to 0.
    strict_1.default.equal(score, 0, `FN-only should score 0; got ${score}`);
});
(0, node_test_1.test)('Q64 #4: NAB scoring with empty annotations returns FP-only floor score', () => {
    // 2 FPs, no anomaly windows (e.g., artificialNoAnomaly NAB sub-benchmark).
    const firings = [
        { tick: 10, fire: true }, { tick: 20, fire: true },
    ];
    const score = (0, nab_scoring_1.computeNABScore)(firings, [], nab_scoring_1.NAB_PROFILES.standard);
    // raw = 2 × -0.22 = -0.44; FP-only branch returns max(0, 100 + raw) = 99.56.
    strict_1.default.ok(score < 100 && score > 95, `2 FPs on no-anomaly should score slightly below 100; got ${score.toFixed(2)}`);
});
(0, node_test_1.test)('Q64 #5: aggregateFamilyScore mean across datasets', () => {
    const perDataset = { 'd1': 50, 'd2': 60, 'd3': 70 };
    const mean = (0, nab_scoring_1.aggregateFamilyScore)(perDataset);
    strict_1.default.equal(mean, 60);
});
(0, node_test_1.test)('Q64 #6: aggregateFamilyScore on empty dict returns 0', () => {
    strict_1.default.equal((0, nab_scoring_1.aggregateFamilyScore)({}), 0);
});
// ── Tool framework tests (synthetic mini-NAB fixture) ───────────────
(0, node_test_1.test)('Q64 #7: discoverNABDatasets finds CSV files under sub-benchmark directories', () => {
    const root = buildMiniNABRepo();
    try {
        const datasets = (0, run_nab_validation_1.discoverNABDatasets)(root, [
            'realKnownCause', 'realAWSCloudwatch', 'artificialNoAnomaly', 'artificialWithAnomaly',
        ]);
        strict_1.default.equal(datasets.length, 4, `expected 4 datasets (1 per sub-benchmark); got ${datasets.length}`);
        const cats = new Set(datasets.map((d) => d.subBenchmark));
        strict_1.default.ok(cats.has('realKnownCause'));
        strict_1.default.ok(cats.has('realAWSCloudwatch'));
        strict_1.default.ok(cats.has('artificialNoAnomaly'));
        strict_1.default.ok(cats.has('artificialWithAnomaly'));
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('Q64 #8: parseNABDatasetCsv reads timestamp + value columns', () => {
    const root = buildMiniNABRepo();
    try {
        const csvPath = path.join(root, 'data', 'realKnownCause', 'sample.csv');
        const { values, timestamps } = (0, run_nab_validation_1.parseNABDatasetCsv)(csvPath);
        strict_1.default.equal(values.length, 100);
        strict_1.default.equal(timestamps.length, 100);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('Q64 #9: annotationsFromLabels maps ISO timestamps to tick indices', () => {
    const root = buildMiniNABRepo();
    try {
        const csvPath = path.join(root, 'data', 'artificialWithAnomaly', 'sample.csv');
        const { timestamps } = (0, run_nab_validation_1.parseNABDatasetCsv)(csvPath);
        const labels = (0, run_nab_validation_1.loadNABLabels)(path.join(root, 'labels', 'combined_windows.json'));
        const labelWindows = labels['artificialWithAnomaly/sample.csv'];
        const annotations = (0, run_nab_validation_1.annotationsFromLabels)(labelWindows, timestamps);
        strict_1.default.equal(annotations.length, 1);
        strict_1.default.equal(annotations[0].anomaly_window_start, 50);
        strict_1.default.equal(annotations[0].anomaly_window_end, 60);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('Q64 #10: runNABValidation emits report with metadata + acceptance gates', () => {
    const root = buildMiniNABRepo();
    const compiledConfigPath = buildMiniCompiledConfig();
    const outPath = path.join(os.tmpdir(), `q64-mini-report-${Date.now()}.json`);
    try {
        const report = (0, run_nab_validation_1.runNABValidation)({
            nabRepoPath: root,
            compiledConfig: compiledConfigPath,
            outputPath: outPath,
            detectors: ['family_A_betting', 'family_A_page_cusum', 'family_D_spectral'],
        });
        strict_1.default.ok(report.metadata.tool_version === 'Q64 SPEC-4 v1.0');
        strict_1.default.ok(Array.isArray(report.metadata.sub_benchmarks_evaluated));
        strict_1.default.equal(report.metadata.sub_benchmarks_evaluated.length, 4);
        strict_1.default.ok(report.per_family_scores.family_A_betting);
        strict_1.default.ok(report.per_family_scores.family_A_page_cusum);
        strict_1.default.ok(report.per_family_scores.family_D_spectral);
        strict_1.default.ok(typeof report.acceptance_results.combined_acceptance === 'boolean');
        // Report file written.
        strict_1.default.ok(fs.existsSync(outPath), 'report JSON should be emitted at outputPath');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
        if (fs.existsSync(compiledConfigPath))
            fs.unlinkSync(compiledConfigPath);
        if (fs.existsSync(outPath))
            fs.unlinkSync(outPath);
    }
});
(0, node_test_1.test)('Q64 #11: runNABValidation skipped sub-benchmarks (realAdExchange / realTraffic / realTweets) NOT evaluated by default', () => {
    const root = buildMiniNABRepo();
    const compiledConfigPath = buildMiniCompiledConfig();
    // Add skipped sub-benchmark dirs to verify default discovery skips them.
    for (const skipped of ['realAdExchange', 'realTraffic', 'realTweets']) {
        fs.mkdirSync(path.join(root, 'data', skipped), { recursive: true });
        fs.writeFileSync(path.join(root, 'data', skipped, 'sample.csv'), 'timestamp,value\n2024-01-01T00:00:00,1.0\n');
    }
    const outPath = path.join(os.tmpdir(), `q64-skip-report-${Date.now()}.json`);
    try {
        const report = (0, run_nab_validation_1.runNABValidation)({
            nabRepoPath: root,
            compiledConfig: compiledConfigPath,
            outputPath: outPath,
        });
        const breakdownDatasets = Object.keys(report.per_family_scores.family_A_betting?.per_dataset_breakdown ?? {});
        for (const ds of breakdownDatasets) {
            strict_1.default.ok(!ds.startsWith('realAdExchange'), `realAdExchange should be skipped; got ${ds}`);
            strict_1.default.ok(!ds.startsWith('realTraffic'), `realTraffic should be skipped; got ${ds}`);
            strict_1.default.ok(!ds.startsWith('realTweets'), `realTweets should be skipped; got ${ds}`);
        }
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
        if (fs.existsSync(compiledConfigPath))
            fs.unlinkSync(compiledConfigPath);
        if (fs.existsSync(outPath))
            fs.unlinkSync(outPath);
    }
});
(0, node_test_1.test)('Q64 #12: anti-scope verification — run-nab-validation.ts does NOT MODIFY engine/detectors/*', () => {
    // Q64 Phase 4 STUB resolution per architect option (i.a) PICK
    // (ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-DISPOSITION) imports
    // evaluateFamilyAShadow + evaluateFamilyABettingShadow + evaluateFamilyD
    // from engine/detectors/* for single-signal-detector emulation —
    // single-signal NAB univariate naturally matches per-signal detector
    // architecture. Per Memorial F sub-rule 4 (pre-existing-property-vs-
    // new-acceptance-criterion-coherence): architect's Phase 4 disposition
    // introduces detector imports that conflict with the original Phase 1-3
    // STUB-era anti-scope test; amended here per architect-disposition
    // takes precedence. Anti-scope clause now verifies NO MODIFICATIONS
    // (preserves Q58 ADR + Q59 H4 PERMANENT + Q60 anti-scope clause 8 of
    // "no engine/detectors/* runtime code modifications") rather than
    // forbidding all imports.
    // Resolve to repo root from either source layout (test/) or compiled
    // layout (dist/test/). The .ts source lives at <repo>/tools regardless.
    const fromSrc = path.resolve(__dirname, '..', 'tools', 'run-nab-validation.ts');
    const fromDist = path.resolve(__dirname, '..', '..', 'tools', 'run-nab-validation.ts');
    const sourcePath = fs.existsSync(fromSrc) ? fromSrc : fromDist;
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    // Imports from detectors/* are PERMITTED for Phase 4 (i.a) single-
    // signal-detector emulation (architect-PICKED). The tool calls
    // existing detector functions but does NOT modify detectors/* source
    // code. Verify imports are EXACTLY architect-disposed names. Post-engine-
    // extraction the path is `../detectors/*` (sibling to tools/), not the
    // legacy `../engine/detectors/*` from the in-tree deploysignal layout.
    const importedFromDetectors = sourceCode.match(/from\s+['"]\.\.\/detectors\/[^'"]+['"]/g) ?? [];
    for (const imp of importedFromDetectors) {
        const allowed = [
            "from '../detectors/page-cusum.js'",
            "from '../detectors/betting-e-process.js'",
            "from '../detectors/spectral.js'",
            // Q70 SLICE 7 — architect-PICKED addition resolving the deferred
            // §7 LIL application-formula question. The Howard-Ramdas-2021
            // mixture-supermartingale variant is the architecturally correct
            // anytime-valid mean-shift detector; the LIL primitive is for
            // empirical-CDF / quantile work per the confseq library
            // docstring. SLICE 7 wires the existing mixture-supermartingale
            // detector into NAB dispatch (zero engine modification).
            "from '../detectors/family-a-mixture-supermartingale.js'",
            // Phase E SLICE 8 — AR(p) multi-lag Yule-Walker calibration
            // (Levinson-Durbin recursion + AIC order selection). Math
            // primitive consumed at dispatch for multi-lag pre-whitening.
            // Per PHASE-E-SLICE-8-SPEC § ASK 3 — placed in detectors/ for
            // future engine-internal consumption (e.g., production-AR(1)
            // substrate work at SLICE 10).
            "from '../detectors/ar-p.js'",
            // Phase E SLICE 9 — seasonal-naive decomposition (per-phase mean
            // subtraction). Math primitive consumed at dispatch BEFORE AR
            // pre-whitening; separates known-nuisance periodicity from
            // anomaly-carrying residual structure. Per PHASE-E-SLICE-9-SPEC.
            "from '../detectors/seasonal.js'",
        ];
        strict_1.default.ok(allowed.includes(imp), `detectors/* import must be on architect-disposed allowlist (Q64 Phase 4 (i.a)); got ${imp}`);
    }
});
//# sourceMappingURL=q64-nab-validation.test.js.map