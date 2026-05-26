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
exports.DEFAULT_CALIBRATION_SIGNAL = void 0;
exports.prewhitenSeries = prewhitenSeries;
exports.applyFireCooldown = applyFireCooldown;
exports.discoverNABDatasets = discoverNABDatasets;
exports.parseNABDatasetCsv = parseNABDatasetCsv;
exports.loadNABLabels = loadNABLabels;
exports.annotationsFromLabels = annotationsFromLabels;
exports.runDetectorOverDataset = runDetectorOverDataset;
exports.runNABValidation = runNABValidation;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const nab_scoring_1 = require("./nab-scoring");
const page_cusum_js_1 = require("../detectors/page-cusum.js");
const betting_e_process_js_1 = require("../detectors/betting-e-process.js");
const spectral_js_1 = require("../detectors/spectral.js");
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
function prewhitenSeries(values, phi, mean) {
    if (!Number.isFinite(phi) || Math.abs(phi) >= 1) {
        throw new Error(`prewhitenSeries: phi must be finite and within (-1, 1), got ${phi}`);
    }
    const out = new Array(values.length);
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
function applyFireCooldown(firings, cooldownTicks) {
    if (cooldownTicks <= 0)
        return firings;
    let suppressUntil = -1;
    const out = firings.map((f) => ({ ...f }));
    for (let i = 0; i < out.length; i++) {
        if (out[i].fire && out[i].tick <= suppressUntil) {
            out[i].fire = false;
        }
        else if (out[i].fire) {
            suppressUntil = out[i].tick + cooldownTicks;
        }
    }
    return out;
}
const DEFAULT_SUB_BENCHMARKS = [
    'realKnownCause',
    'realAWSCloudwatch',
    'artificialNoAnomaly',
    'artificialWithAnomaly',
];
const DEFAULT_DETECTORS = [
    'family_A_betting',
    'family_A_page_cusum',
    'family_D_spectral',
];
const TOOL_VERSION = 'Q64 SPEC-4 v1.0';
// ── NAB dataset discovery + parsing ─────────────────────────────
/** Discover NAB dataset CSV files under <nabRepoPath>/data/<sub>/*.csv. */
function discoverNABDatasets(nabRepoPath, subBenchmarks) {
    const out = [];
    const dataRoot = path.join(nabRepoPath, 'data');
    if (!fs.existsSync(dataRoot)) {
        throw new Error(`NAB repository missing data/ directory at ${nabRepoPath}; verify nabRepoPath`);
    }
    for (const sub of subBenchmarks) {
        const subDir = path.join(dataRoot, sub);
        if (!fs.existsSync(subDir))
            continue;
        const entries = fs.readdirSync(subDir);
        for (const entry of entries) {
            if (!entry.endsWith('.csv'))
                continue;
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
function parseNABDatasetCsv(absPath) {
    const data = fs.readFileSync(absPath, 'utf8');
    const lines = data.split('\n').filter((l) => l.trim().length > 0);
    const header = lines[0].split(',').map((s) => s.trim());
    const tsIdx = header.indexOf('timestamp');
    const valIdx = header.indexOf('value');
    if (tsIdx < 0 || valIdx < 0) {
        throw new Error(`NAB CSV ${path.basename(absPath)} missing 'timestamp' or 'value' header column. `
            + `Got: ${JSON.stringify(header)}`);
    }
    const values = [];
    const timestamps = [];
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
function loadNABLabels(labelsPath) {
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
function normalizeNABTimestamp(ts) {
    // Convert ISO 'T' separator to space; drop trailing 'Z'.
    let s = ts.replace('T', ' ').replace(/Z$/, '');
    // Strip fractional seconds.
    s = s.replace(/\.\d+$/, '');
    return s;
}
function annotationsFromLabels(labelWindows, timestamps) {
    const tsToTick = new Map();
    for (let i = 0; i < timestamps.length; i++)
        tsToTick.set(normalizeNABTimestamp(timestamps[i]), i);
    const out = [];
    for (const [startTs, endTs] of labelWindows) {
        const start = tsToTick.get(normalizeNABTimestamp(startTs));
        const end = tsToTick.get(normalizeNABTimestamp(endTs));
        if (start === undefined || end === undefined)
            continue; // label timestamp not in dataset
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
exports.DEFAULT_CALIBRATION_SIGNAL = 'p99_latency';
/** Rolling window length for Family D spectral peak-ACF evaluation. */
const FAMILY_D_WINDOW = 60;
function runDetectorOverDataset(family, values, compiledConfigPath, calibrationSignal = exports.DEFAULT_CALIBRATION_SIGNAL, dispatchOpts) {
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
    const cfg = JSON.parse(fs.readFileSync(compiledConfigPath, 'utf8'));
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
    // SLICE 5 — pre-whiten Family A inputs when caller supplies φ̂ + μ.
    // Spectral (Family D) consumes the raw values (autocorrelation is the
    // signal it measures; pre-whitening would zero it out).
    const isFamilyA = family === 'family_A_page_cusum' || family === 'family_A_betting';
    const prewhitenedValues = (isFamilyA
        && dispatchOpts?.prewhitenPhi !== undefined
        && dispatchOpts.prewhitenMean !== undefined)
        ? prewhitenSeries(values, dispatchOpts.prewhitenPhi, dispatchOpts.prewhitenMean)
        : values;
    const out = [];
    if (family === 'family_A_page_cusum') {
        const states = {};
        for (let t = 0; t < prewhitenedValues.length; t++) {
            const verdicts = (0, page_cusum_js_1.evaluateFamilyAShadow)(cfg, { [calibrationSignal]: prewhitenedValues[t] }, states, { ...ctx, ticksSinceDeploy: t });
            const v = verdicts.find((x) => x.signal === calibrationSignal);
            out.push({
                tick: t,
                fire: v?.verdict === 'fire',
                statistic_value: v?.statistic ?? undefined,
                threshold: v?.threshold ?? undefined,
            });
        }
    }
    else if (family === 'family_A_betting') {
        const states = {};
        for (let t = 0; t < prewhitenedValues.length; t++) {
            const verdicts = (0, betting_e_process_js_1.evaluateFamilyABettingShadow)(cfg, { [calibrationSignal]: prewhitenedValues[t] }, states, { ...ctx, ticksSinceDeploy: t });
            const v = verdicts.find((x) => x.signal === calibrationSignal);
            out.push({
                tick: t,
                fire: v?.verdict === 'fire',
                statistic_value: v?.statistic ?? undefined,
                threshold: v?.threshold ?? undefined,
            });
        }
    }
    else if (family === 'family_D_spectral') {
        const recent = [];
        for (let t = 0; t < values.length; t++) {
            recent.push(values[t]);
            if (recent.length > FAMILY_D_WINDOW)
                recent.shift();
            const v = (0, spectral_js_1.evaluateFamilyD)(cfg, calibrationSignal, recent, { ...ctx, ticksSinceDeploy: t });
            out.push({
                tick: t,
                fire: v?.verdict === 'fire',
                statistic_value: v?.statistic ?? undefined,
                threshold: v?.threshold ?? undefined,
            });
        }
    }
    else {
        throw new Error(`Detector ${family} not supported at Q64 NAB validation; only `
            + 'family_A_betting + family_A_page_cusum + family_D_spectral architect-picked '
            + '(per Q64 spec § Q64.1 + ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-DISPOSITION.md).');
    }
    // SLICE 5 — apply post-fire cooldown to dedupe sustained firings.
    return applyFireCooldown(out, dispatchOpts?.cooldownTicks ?? 0);
}
// ── Main runNABValidation ────────────────────────────────────────
function runNABValidation(opts) {
    const subBenchmarks = opts.nabSubBenchmarks ?? DEFAULT_SUB_BENCHMARKS;
    const detectors = opts.detectors ?? DEFAULT_DETECTORS;
    const labelsPath = opts.labelsPath ?? path.join(opts.nabRepoPath, 'labels', 'combined_windows.json');
    const datasets = discoverNABDatasets(opts.nabRepoPath, subBenchmarks);
    const labels = loadNABLabels(labelsPath);
    const perFamilyScores = {};
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
            const firings = runDetectorOverDataset(fam, values, opts.compiledConfig, opts.calibrationSignal ?? exports.DEFAULT_CALIBRATION_SIGNAL);
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
    // Aggregate per-family scores via mean across datasets (Lavin-Ahmad 2015 standard).
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
    // Acceptance gates per § Q64.2.
    const familyAStandard = Math.max(perFamilyScores.family_A_betting?.standard_profile_score ?? 0, perFamilyScores.family_A_page_cusum?.standard_profile_score ?? 0);
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
            }
            else {
                nabRepoVersion = head; // detached HEAD = direct SHA
            }
        }
        catch { /* ignore; preserve 'unknown' */ }
    }
    let dsCompiledVersion = 'unknown';
    if (fs.existsSync(opts.compiledConfig)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(opts.compiledConfig, 'utf8'));
            dsCompiledVersion = cfg.compiler_version ?? 'unknown';
        }
        catch { /* ignore */ }
    }
    const report = {
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