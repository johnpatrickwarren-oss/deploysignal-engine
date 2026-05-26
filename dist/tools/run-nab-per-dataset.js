"use strict";
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
exports.DEFAULT_PROBATIONARY_FRACTION = void 0;
exports.hacInflationFactor = hacInflationFactor;
exports.buildPerDatasetConfig = buildPerDatasetConfig;
exports.scorePostProbationary = scorePostProbationary;
exports.runPerDatasetNABValidation = runPerDatasetNABValidation;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const run_nab_validation_1 = require("./run-nab-validation");
const nab_scoring_1 = require("./nab-scoring");
const self_normalized_e_process_fallback_1 = require("../detectors/self-normalized-e-process-fallback");
const DEFAULT_PROBATIONARY_FRACTION = 0.15;
exports.DEFAULT_PROBATIONARY_FRACTION = DEFAULT_PROBATIONARY_FRACTION;
/** φ̂ threshold above which the Q70 SLICE 2 self-normalized fallback is
 *  stamped on the per-dataset config. NAB real datasets exhibit φ ≈ 0.95
 *  on temperature / sensor signals; the 0.5 threshold engages fallback
 *  metadata generously to leave room for per-detector wiring to decide
 *  whether to consume it. This is metadata-stamping only at SLICE 2 v0.1
 *  — per-detector dispatch wiring is gated on architect units-mapping
 *  cross-check per Q70 spec § Library cross-check status item 2. */
const AR1_PHI_FALLBACK_THRESHOLD = 0.5;
/** φ̂ clamp for HAC long-run variance computation. As φ → ±1 the
 *  factor (1+φ)/(1-φ) explodes (random-walk pole); clamp keeps the
 *  inflation factor bounded by ~199× at φ=±0.99. NAB temperature / taxi
 *  signals have φ̂ ≈ 0.95 → factor ≈ 39× which is the working regime. */
const AR1_PHI_HAC_CLAMP = 0.99;
/** AR(1) long-run variance inflation factor for HAC-style σ² correction
 *  (Path B). For an AR(1) process with stationary variance σ² and lag-1
 *  correlation φ, the variance of the cumulative sum S_n = Σ X_i grows
 *  as `n · σ² · (1 + φ) / (1 - φ)` — not `n · σ²`. The CUSUM detector
 *  assumes the iid form when it standardizes; if calibration was done
 *  on an iid probationary window but runtime data exhibits AR(1)
 *  autocorrelation (e.g., NAB temperature data with φ ≈ 0.95), the
 *  detector under-estimates the variance of its test statistic by this
 *  factor, producing FPR inflation.
 *
 *  Path B intervention: replace the iid-calibrated σ² with the HAC
 *  long-run variance σ² · (1+φ)/(1-φ) before stamping into the per-
 *  dataset config. The detector consumes this via its existing variance
 *  field (no engine math change); FP control is restored to the
 *  standard Ville bound, just at the corrected effective variance.
 *
 *  Trade-off: TPR can also drop because the detector's effective signal-
 *  to-noise threshold is wider. NAB-style anomalies (sharp shifts) should
 *  still cross the inflated threshold; subtle drift detection becomes
 *  harder. Empirical question — that's what running NAB validates.
 *
 *  Reference: Newey-Hac (1987) for the AR(1)-corrected long-run variance;
 *  classic in econometric time-series literature. */
function hacInflationFactor(phi) {
    const phiClamped = Math.max(-AR1_PHI_HAC_CLAMP, Math.min(AR1_PHI_HAC_CLAMP, phi));
    return (1 + phiClamped) / (1 - phiClamped);
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
    // NOTE: `self_normalized_lil` is implemented + tested but NOT in the
    // default NAB sweep. SLICE 3 architectural finding: the LIL fallback
    // is appropriate for Q70's design target (synthetic substrate where
    // sweep-mode injects AR(1) AND calibration baseline is iid — the
    // mismatch case the fallback was architected for) but produces
    // excessive firings on NAB-style production-AR(1) data where natural
    // diurnal/seasonal patterns triggers continuous fires. The Q70 spec
    // explicitly anti-scoped production-AR(1) at Q70.3 option (ii) (TAGGED
    // FUTURE Phase E). To enable for NAB use the --detectors flag with
    // `self_normalized_lil` and review per-dataset firing patterns before
    // claiming the score.
];
const TOOL_VERSION = 'NAB-per-dataset v0.1.0';
// ── Probationary-window statistics ─────────────────────────────────
function mean(xs) {
    if (xs.length === 0)
        return 0;
    let s = 0;
    for (const x of xs)
        s += x;
    return s / xs.length;
}
/** Sample variance with 1e-12 floor (guards art_daily_no_noise zero-σ). */
function sampleVariance(xs, mu) {
    if (xs.length < 2)
        return 1e-12;
    let s2 = 0;
    for (const x of xs) {
        const d = x - mu;
        s2 += d * d;
    }
    const v = s2 / (xs.length - 1);
    return Math.max(v, 1e-12);
}
/** Lag-1 autocorrelation φ̂ via Yule-Walker. Clamped to [-0.95, 0.95]. */
function ar1Phi(xs, mu) {
    if (xs.length < 3)
        return 0;
    let num = 0;
    let den = 0;
    for (let i = 1; i < xs.length; i++) {
        num += (xs[i] - mu) * (xs[i - 1] - mu);
    }
    for (let i = 0; i < xs.length; i++) {
        const d = xs[i] - mu;
        den += d * d;
    }
    if (den <= 0)
        return 0;
    const phi = num / den;
    return Math.max(-0.95, Math.min(0.95, phi));
}
/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback). */
function buildPerDatasetConfig(values, calibrationSignal, probationaryFraction, options) {
    const useHac = options?.useHacInflation ?? true;
    const nProbationary = Math.max(2, Math.floor(values.length * probationaryFraction));
    const probationary = values.slice(0, nProbationary);
    const mu = mean(probationary);
    const iidSigma2 = sampleVariance(probationary, mu);
    const phi = ar1Phi(probationary, mu);
    // Path B: replace the iid σ² with HAC long-run variance when enabled.
    // Always applied (no φ threshold) — the inflation factor naturally
    // shrinks to ≈1 for low-φ iid data, so this graceful generalizes the
    // iid case without an activation cliff.
    const inflationFactor = useHac ? hacInflationFactor(phi) : 1;
    const sigma2 = iidSigma2 * inflationFactor;
    const sigma = Math.sqrt(sigma2);
    const provenance = {
        probationary_fraction: probationaryFraction,
        n_probationary_ticks: nProbationary,
        n_total_ticks: values.length,
        derived: { baseline_mean: mu, baseline_sigma_squared: sigma2, ar1_phi: phi },
        hac_inflation: useHac ? {
            phi_used: phi,
            factor: inflationFactor,
            iid_sigma_squared: iidSigma2,
            inflated_sigma_squared: sigma2,
        } : undefined,
    };
    // Q70 SLICE 2 fallback stamping (independent of HAC). φ̂ above threshold
    // → stamp LIL hyperparameters; downstream consumers (per-detector
    // wiring; Anvil chaos-experiment scoring) decide whether to engage.
    if (Math.abs(phi) >= AR1_PHI_FALLBACK_THRESHOLD) {
        const lilHyperparams = (0, self_normalized_e_process_fallback_1.buildLilBoundHyperparams)(4e-4);
        provenance.self_normalized_fallback = {
            reason: 'ar1_phi_exceeds_threshold',
            threshold: AR1_PHI_FALLBACK_THRESHOLD,
            observed_phi: phi,
            lil_hyperparams: lilHyperparams,
        };
    }
    const config = {
        version: 'nab-per-dataset-calibrated',
        compiler_version: '0.2.0',
        compiled_at: new Date().toISOString(),
        baseline_ref: 'nab-per-dataset-calibrated',
        alpha_budget: {
            total: 1e-3,
            per_family: { A: 4e-4, C: 2e-4, D: 1e-4, E: 1e-4 },
        },
        bonferroni_factor: 6,
        baseline_cells: {
            dimensions: ['hour_of_day'],
            // The dispatcher routes through `matchCellByHour(cells, query)` →
            // `buildMSPRTParams` and returns null if no cell matches the query.
            // The query in run-nab-validation pins {hourOfDay: 0, dayOfWeek: 0}
            // (NAB datasets have no temporal metadata), so we ship one stub
            // cell at hour_of_day=0 with `confidence: 'aggregate'` to flow the
            // dispatcher through to the aggregate_fallback path below. Without
            // this cell, lookupCellParams returns null at line 349 and the
            // detector silently no-ops every tick — a finding from Path B
            // empirical run after HAC inflation failed to move NAB scores.
            cells: [{
                    key: { hour_of_day: 0 },
                    confidence: 'aggregate',
                    family_A: { per_signal: {} },
                }],
            aggregate_fallback: {
                family_A: {
                    per_signal: {
                        [calibrationSignal]: {
                            baseline_mean: mu,
                            baseline_sigma_squared: sigma2,
                            tau_squared: sigma2 / 2,
                            delta_min: 1.5 * sigma,
                            signal_class: 'heavy_tail',
                            betting_sliding_buffer_threshold: 1000,
                            betting_calibration_scope: 'sliding_buffer_ar1',
                            derivation: { mean: mu, empirical_variance: sigma2 },
                        },
                    },
                },
                family_D: {
                    [calibrationSignal]: {
                        ar1_phi: phi,
                        peak_acf_threshold: 0.5,
                        bootstrap_null_quantile: 0.5,
                        spectral_variant: 'bootstrap_null',
                    },
                },
            },
        },
        _calibration_provenance: provenance,
    };
    return { config, provenance };
}
// ── Post-probationary scoring ──────────────────────────────────────
/** Score firings against annotations, restricted to ticks ≥ probationary
 *  cutoff. Standard NAB convention: scoring starts after the probationary
 *  window so the detector has a chance to calibrate. */
function scorePostProbationary(firings, annotations, nProbationary, profile) {
    const postFirings = firings.filter((f) => f.tick >= nProbationary);
    const postAnnotations = [];
    for (const a of annotations) {
        if (a.anomaly_window_end < nProbationary)
            continue;
        postAnnotations.push({
            anomaly_window_start: Math.max(a.anomaly_window_start, nProbationary),
            anomaly_window_end: a.anomaly_window_end,
        });
    }
    return (0, nab_scoring_1.computeNABScore)(postFirings, postAnnotations, profile);
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
function runSelfNormalizedOverDataset(values, provenance) {
    const fallback = provenance.self_normalized_fallback;
    if (!fallback) {
        return values.map((_, t) => ({ tick: t, fire: false }));
    }
    const { baseline_mean, baseline_sigma_squared } = provenance.derived;
    const lilParams = fallback.lil_hyperparams;
    const state = (0, self_normalized_e_process_fallback_1.freshSelfNormalizedDetectorState)();
    const out = [];
    for (let t = 0; t < values.length; t++) {
        const v = (0, self_normalized_e_process_fallback_1.evaluateSelfNormalizedFallback)(state, values[t], baseline_mean, baseline_sigma_squared, lilParams);
        out.push({ tick: t, fire: v.fire, statistic_value: v.statistic, threshold: v.threshold });
    }
    return out;
}
function runPerDatasetNABValidation(opts) {
    const subBenchmarks = opts.nabSubBenchmarks ?? DEFAULT_SUB_BENCHMARKS;
    const detectors = opts.detectors ?? DEFAULT_DETECTORS;
    const calibrationSignal = opts.calibrationSignal ?? run_nab_validation_1.DEFAULT_CALIBRATION_SIGNAL;
    const probationaryFraction = opts.probationaryFraction ?? DEFAULT_PROBATIONARY_FRACTION;
    const labelsPath = opts.labelsPath ?? path.join(opts.nabRepoPath, 'labels', 'combined_windows.json');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nab-per-dataset-'));
    const datasets = (0, run_nab_validation_1.discoverNABDatasets)(opts.nabRepoPath, subBenchmarks);
    const labels = (0, run_nab_validation_1.loadNABLabels)(labelsPath);
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
        const { values, timestamps } = (0, run_nab_validation_1.parseNABDatasetCsv)(dataset.absPath);
        if (values.length < 20)
            continue;
        const labelWindows = labels[dataset.relPath] ?? [];
        const annotations = (0, run_nab_validation_1.annotationsFromLabels)(labelWindows, timestamps);
        const { config, provenance } = buildPerDatasetConfig(values, calibrationSignal, probationaryFraction, { useHacInflation: opts.useHacInflation });
        const cfgPath = path.join(tmpDir, dataset.relPath.replace(/\//g, '__').replace(/\.csv$/, '.json'));
        fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
        fs.writeFileSync(cfgPath, JSON.stringify(config));
        const nProbationary = provenance.n_probationary_ticks;
        for (const fam of detectors) {
            let firings;
            if (fam === 'self_normalized_lil') {
                firings = runSelfNormalizedOverDataset(values, provenance);
            }
            else {
                firings = (0, run_nab_validation_1.runDetectorOverDataset)(fam, values, cfgPath, calibrationSignal);
            }
            const standard = scorePostProbationary(firings, annotations, nProbationary, nab_scoring_1.NAB_PROFILES.standard);
            const lowFp = scorePostProbationary(firings, annotations, nProbationary, nab_scoring_1.NAB_PROFILES.reward_low_fp);
            const lowFn = scorePostProbationary(firings, annotations, nProbationary, nab_scoring_1.NAB_PROFILES.reward_low_fn);
            perFamilyScores[fam].per_dataset_breakdown[dataset.relPath] = {
                dataset_path: dataset.relPath,
                n_ticks: values.length,
                n_probationary_ticks: nProbationary,
                n_anomaly_windows: annotations.length,
                standard_profile_score: standard,
                reward_low_fp_score: lowFp,
                reward_low_fn_score: lowFn,
                baseline_mean: provenance.derived.baseline_mean,
                baseline_sigma_squared: provenance.derived.baseline_sigma_squared,
                ar1_phi: provenance.derived.ar1_phi,
            };
        }
    }
    for (const fam of detectors) {
        const fb = perFamilyScores[fam];
        const standardMap = {};
        const lowFpMap = {};
        const lowFnMap = {};
        for (const [k, d] of Object.entries(fb.per_dataset_breakdown)) {
            standardMap[k] = d.standard_profile_score;
            lowFpMap[k] = d.reward_low_fp_score;
            lowFnMap[k] = d.reward_low_fn_score;
        }
        fb.standard_profile_score = (0, nab_scoring_1.aggregateFamilyScore)(standardMap);
        fb.reward_low_fp_score = (0, nab_scoring_1.aggregateFamilyScore)(lowFpMap);
        fb.reward_low_fn_score = (0, nab_scoring_1.aggregateFamilyScore)(lowFnMap);
    }
    const aBettingPass = (perFamilyScores.family_A_betting?.standard_profile_score ?? 0) >= 50;
    const aPageCusumPass = (perFamilyScores.family_A_page_cusum?.standard_profile_score ?? 0) >= 50;
    const dSpectralPass = (perFamilyScores.family_D_spectral?.standard_profile_score ?? 0) >= 40;
    const report = {
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
            family_D_spectral_passes: dSpectralPass,
            family_A_passes: aBettingPass || aPageCusumPass,
            family_D_passes: dSpectralPass,
            combined_acceptance: (aBettingPass || aPageCusumPass) && dSpectralPass,
        },
    };
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    catch { /* cleanup best-effort */ }
    return report;
}
function parseArgs(argv) {
    const out = {};
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const v = argv[i + 1];
        switch (a) {
            case '--nab-repo':
                out.nabRepo = v;
                i++;
                break;
            case '--out':
                out.out = v;
                i++;
                break;
            case '--probationary-fraction':
                out.probationaryFraction = parseFloat(v);
                i++;
                break;
            case '--calibration-signal':
                out.calibrationSignal = v;
                i++;
                break;
            case '--detectors':
                out.detectors = v.split(',');
                i++;
                break;
            case '--sub-benchmarks':
                out.subBenchmarks = v.split(',');
                i++;
                break;
            case '--no-hac-inflation':
                out.useHacInflation = false;
                break;
        }
    }
    if (!out.nabRepo || !out.out) {
        throw new Error('Required: --nab-repo <path> --out <path>. '
            + 'Optional: --probationary-fraction <0..1> --calibration-signal <name> '
            + '--detectors <a,b,c> --sub-benchmarks <a,b,c>');
    }
    return out;
}
function main() {
    const args = parseArgs(process.argv);
    console.log(`[run-nab-per-dataset] tool=${TOOL_VERSION}`);
    console.log(`[run-nab-per-dataset] nab_repo=${args.nabRepo}`);
    console.log(`[run-nab-per-dataset] probationary_fraction=${args.probationaryFraction ?? DEFAULT_PROBATIONARY_FRACTION}`);
    const report = runPerDatasetNABValidation({
        nabRepoPath: args.nabRepo,
        detectors: args.detectors,
        nabSubBenchmarks: args.subBenchmarks,
        calibrationSignal: args.calibrationSignal,
        probationaryFraction: args.probationaryFraction,
        useHacInflation: args.useHacInflation,
    });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
    console.log(`[run-nab-per-dataset] wrote ${args.out}`);
    for (const fam of Object.keys(report.per_family_scores)) {
        const s = report.per_family_scores[fam];
        console.log(`[run-nab-per-dataset]   ${fam}: standard=${s.standard_profile_score.toFixed(2)} low_fp=${s.reward_low_fp_score.toFixed(2)} low_fn=${s.reward_low_fn_score.toFixed(2)}`);
    }
    const a = report.acceptance_results;
    console.log(`[run-nab-per-dataset]   acceptance: A_betting=${a.family_A_betting_passes} A_page_cusum=${a.family_A_page_cusum_passes} D_spectral=${a.family_D_spectral_passes} combined=${a.combined_acceptance}`);
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=run-nab-per-dataset.js.map