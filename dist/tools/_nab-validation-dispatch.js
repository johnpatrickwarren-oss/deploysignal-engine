"use strict";
// tools/_nab-validation-dispatch.ts — Q64/Q70 NAB detector dispatch
// (wrapper-layer). Extracted from tools/run-nab-validation.ts; the single
// >100-line `runDetectorOverDataset` is decomposed into per-family <100-
// line helpers (verbatim contiguous blocks). All public names re-exported
// from run-nab-validation.ts so imports stay stable. Pure wrapper-layer:
// imports orchestrate-equivalent shadow evaluators; NO engine/detectors/*
// runtime modification (preserves Q58/Q59/Q60 anti-scope).
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
exports.runDetectorOverDataset = runDetectorOverDataset;
const fs = __importStar(require("node:fs"));
const page_cusum_js_1 = require("../detectors/page-cusum.js");
const betting_e_process_js_1 = require("../detectors/betting-e-process.js");
const spectral_js_1 = require("../detectors/spectral.js");
const family_a_mixture_supermartingale_js_1 = require("../detectors/family-a-mixture-supermartingale.js");
const ar_p_js_1 = require("../detectors/ar-p.js");
const seasonal_js_1 = require("../detectors/seasonal.js");
const _nab_validation_types_1 = require("./_nab-validation-types");
const _nab_validation_transforms_1 = require("./_nab-validation-transforms");
/** Rolling window length for Family D spectral peak-ACF evaluation. */
const FAMILY_D_WINDOW = 60;
/** NAB datasets carry no hour-of-day metadata; pin to (h=0, d=0) so the
 *  detectors fall through to aggregate_fallback (per architect-disposed
 *  calibration source: aggregate_fallback.family_A.per_signal[sig] +
 *  aggregate_fallback.family_D[sig]). */
const NAB_DISPATCH_CTX = {
    hourOfDay: 0,
    dayOfWeek: 0,
    ticksSinceDeploy: 0,
    deployAgeDays: 0,
    trafficPct: 1,
};
/** SLICE 7 helper — find the {hour_of_day=0} aggregate stub cell that
 *  the NAB calibrator stamps. Used by the mixture-supermartingale
 *  dispatch case which doesn't go through `lookupCellParams`. */
function findStubAggregateCell(cfg) {
    const cells = cfg.baseline_cells?.cells;
    if (!cells)
        return undefined;
    return cells.find((c) => c.key.hour_of_day === 0 && c.confidence === 'aggregate');
}
/** SLICE 7 helper — resolve the per-signal mixture-supermartingale
 *  params from a cell, walking through aggregate_fallback when the
 *  cell's own per_signal block is empty. Mirrors the same fallback
 *  pattern as `lookupCellParams` in page-cusum.ts but returns the
 *  raw FamilyAPerSignalParams shape (not the MSPRTParams view-model). */
function resolveMixtureSupermartingalePerSignal(cfg, cell, signal) {
    let perSig = cell.family_A?.per_signal[signal];
    if (perSig)
        return perSig;
    const aggregateFallback = cell.confidence === 'aggregate' || cell.confidence === 'none';
    if (aggregateFallback) {
        perSig = cfg.baseline_cells?.aggregate_fallback.family_A?.per_signal[signal];
    }
    return perSig;
}
/** SLICE 5 / Phase E SLICE 8+9 — pre-whiten Family A inputs.
 *  Pipeline (when all options provided):
 *    raw → deseasonalize → pre-whiten (multi-lag or single-lag) → detector
 *  Each stage is optional; missing options pass through.
 *  Spectral (Family D) consumes raw values throughout — seasonal
 *  cycles AND autocorrelation are part of its signal. */
function prewhitenFamilyAInput(family, values, dispatchOpts) {
    const isFamilyA = family === 'family_A_page_cusum' || family === 'family_A_betting';
    let prewhitenedValues = values;
    if (isFamilyA) {
        // SLICE 9 — first stage: deseasonalize using per-phase means.
        if (dispatchOpts?.seasonalMeans
            && dispatchOpts.seasonalMeans.length > 0
            && dispatchOpts.seasonalPeriod
            && dispatchOpts.seasonalPeriod > 0) {
            prewhitenedValues = (0, seasonal_js_1.deseasonalize)(prewhitenedValues, dispatchOpts.seasonalMeans, dispatchOpts.seasonalPeriod, 0);
        }
        // SLICE 5/8 — second stage: AR pre-whitening on the (possibly
        // deseasonalized) series.
        if (dispatchOpts?.prewhitenMean !== undefined) {
            if (dispatchOpts.prewhitenPhiArray && dispatchOpts.prewhitenPhiArray.length > 0) {
                prewhitenedValues = (0, ar_p_js_1.prewhitenAr)(prewhitenedValues, dispatchOpts.prewhitenMean, dispatchOpts.prewhitenPhiArray);
            }
            else if (dispatchOpts.prewhitenPhi !== undefined) {
                prewhitenedValues = (0, _nab_validation_transforms_1.prewhitenSeries)(prewhitenedValues, dispatchOpts.prewhitenPhi, dispatchOpts.prewhitenMean);
            }
        }
    }
    return prewhitenedValues;
}
/** family_A_page_cusum branch — per-tick Page-CUSUM shadow evaluation. */
function runPageCusumOverDataset(cfg, prewhitenedValues, calibrationSignal) {
    const out = [];
    const states = {};
    for (let t = 0; t < prewhitenedValues.length; t++) {
        const verdicts = (0, page_cusum_js_1.evaluateFamilyAShadow)(cfg, { [calibrationSignal]: prewhitenedValues[t] }, states, { ...NAB_DISPATCH_CTX, ticksSinceDeploy: t });
        const v = verdicts.find((x) => x.signal === calibrationSignal);
        out.push({
            tick: t,
            fire: v?.verdict === 'fire',
            statistic_value: v?.statistic ?? undefined,
            threshold: v?.threshold ?? undefined,
        });
    }
    return out;
}
/** family_A_betting branch — per-tick betting e-process shadow evaluation. */
function runBettingOverDataset(cfg, prewhitenedValues, calibrationSignal) {
    const out = [];
    const states = {};
    for (let t = 0; t < prewhitenedValues.length; t++) {
        const verdicts = (0, betting_e_process_js_1.evaluateFamilyABettingShadow)(cfg, { [calibrationSignal]: prewhitenedValues[t] }, states, { ...NAB_DISPATCH_CTX, ticksSinceDeploy: t });
        const v = verdicts.find((x) => x.signal === calibrationSignal);
        out.push({
            tick: t,
            fire: v?.verdict === 'fire',
            statistic_value: v?.statistic ?? undefined,
            threshold: v?.threshold ?? undefined,
        });
    }
    return out;
}
/** family_A_mixture_supermartingale branch — Q70 SLICE 7 Howard-Ramdas-2021
 *  mixture-supermartingale Page-CUSUM variant. Anytime-valid Ville-bounded:
 *  P(sup_t M_t ≥ 1/α) ≤ α by construction. AR(1) pre-whitening is built
 *  INTO the detector via its `ar1_phi` input — caller must NOT pre-whiten
 *  externally (double-whitening would compound the correction).
 *
 *  SLICE 7 architectural decision: this detector is the empirically-
 *  verifiable replacement for the deferred §7 LIL fallback wiring from
 *  SLICE 1-3. The LIL bound (per confseq library docstring) is for
 *  empirical-CDF / quantile work, NOT mean-shift detection. The
 *  mixture-supermartingale is the right tool for mean-shift; both are
 *  anytime-valid Ville-bounded but for different statistics. */
function runMixtureSupermartingaleOverDataset(cfg, values, calibrationSignal) {
    const out = [];
    const states = {};
    const cell = findStubAggregateCell(cfg);
    const perSig = cell ? resolveMixtureSupermartingalePerSignal(cfg, cell, calibrationSignal) : undefined;
    if (!perSig || !perSig.mixture_supermartingale_params) {
        // Calibrator did not stamp mixture params — emit all-false (silent)
        // rather than throw, mirroring the page-cusum dispatch's null-cell
        // behavior. Configs predating SLICE 7 carry no mixture params.
        for (let t = 0; t < values.length; t++) {
            out.push({ tick: t, fire: false });
        }
        return out;
    }
    const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
    const bonf = cfg.bonferroni_factor ?? 6;
    const alpha = alphaFamilyA / bonf;
    const baselineMean = perSig.baseline_mean_raw ?? perSig.baseline_mean;
    const sigmaSquared = perSig.baseline_sigma_squared_raw ?? perSig.baseline_sigma_squared;
    const phi = perSig.ar1_phi ?? 0;
    for (let t = 0; t < values.length; t++) {
        if (!states[calibrationSignal])
            states[calibrationSignal] = (0, family_a_mixture_supermartingale_js_1.freshMixtureSupermartingaleState)();
        const xCentered = values[t] - baselineMean;
        const result = (0, family_a_mixture_supermartingale_js_1.evaluatePageCusumMixtureSupermartingale)({
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
    return out;
}
/** family_D_spectral branch — rolling-window peak-ACF spectral evaluation. */
function runSpectralOverDataset(cfg, values, calibrationSignal) {
    const out = [];
    const recent = [];
    for (let t = 0; t < values.length; t++) {
        recent.push(values[t]);
        if (recent.length > FAMILY_D_WINDOW)
            recent.shift();
        const v = (0, spectral_js_1.evaluateFamilyD)(cfg, calibrationSignal, recent, { ...NAB_DISPATCH_CTX, ticksSinceDeploy: t });
        out.push({
            tick: t,
            fire: v?.verdict === 'fire',
            statistic_value: v?.statistic ?? undefined,
            threshold: v?.threshold ?? undefined,
        });
    }
    return out;
}
/** Apply SLICE 5/6 post-processing wrapper to a raw firing trace.
 *  When smoothing window is set, apply anomaly-likelihood smoothing
 *  (Numenta-style persistence filter with post-emit cooldown).
 *  Otherwise fall back to SLICE 5 raw cooldown wrapper. */
function applyDispatchPostProcessing(out, dispatchOpts) {
    const cooldown = dispatchOpts?.cooldownTicks ?? 0;
    if (dispatchOpts?.smoothingWindow && dispatchOpts.smoothingWindow > 0
        && dispatchOpts.smoothingThresholdCount && dispatchOpts.smoothingThresholdCount > 0) {
        return (0, _nab_validation_transforms_1.applyAnomalyLikelihoodSmoothing)(out, dispatchOpts.smoothingWindow, dispatchOpts.smoothingThresholdCount, cooldown);
    }
    return (0, _nab_validation_transforms_1.applyFireCooldown)(out, cooldown);
}
/** Run a single detector family over a NAB dataset and capture per-
 *  tick firing decisions. Pure wrapper-layer: imports orchestrate
 *  via shared.js (preserves Q58/Q59/Q60 anti-scope on engine/detectors/*).
 *
 *  Q64 Phase 4 STUB resolution per architect option (i.a) single-signal-
 *  detector emulation (ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-
 *  DISPOSITION.md § Ask 1). Family A + Family D natively per-signal;
 *  NAB univariate maps cleanly. Calibration source: v5 substrate's
 *  family_A.per_signal[calibrationSignal] / family_D[calibrationSignal]
 *  (default 'p99_latency' heavy_tail signal class).
 *
 *  Architect pseudo-code uses `evaluatePageCusumPerSignal` /
 *  `evaluateBettingEProcessPerSignal` / `evaluateSpectralPeakAcfPerSignal`;
 *  codebase actuals are `evaluateFamilyAShadow` /
 *  `evaluateFamilyABettingShadow` / `evaluateFamilyD` — naming drift
 *  only; semantics match (single-signal evaluation per call). */
function runDetectorOverDataset(family, values, compiledConfigPath, calibrationSignal = _nab_validation_types_1.DEFAULT_CALIBRATION_SIGNAL, dispatchOpts) {
    const cfg = JSON.parse(fs.readFileSync(compiledConfigPath, 'utf8'));
    const prewhitenedValues = prewhitenFamilyAInput(family, values, dispatchOpts);
    let out;
    if (family === 'family_A_page_cusum') {
        out = runPageCusumOverDataset(cfg, prewhitenedValues, calibrationSignal);
    }
    else if (family === 'family_A_betting') {
        out = runBettingOverDataset(cfg, prewhitenedValues, calibrationSignal);
    }
    else if (family === 'family_A_mixture_supermartingale') {
        out = runMixtureSupermartingaleOverDataset(cfg, values, calibrationSignal);
    }
    else if (family === 'family_D_spectral') {
        out = runSpectralOverDataset(cfg, values, calibrationSignal);
    }
    else {
        throw new Error(`Detector ${family} not supported at Q64 NAB validation; only `
            + 'family_A_betting + family_A_page_cusum + family_D_spectral architect-picked '
            + '(per Q64 spec § Q64.1 + ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-DISPOSITION.md).');
    }
    return applyDispatchPostProcessing(out, dispatchOpts);
}
//# sourceMappingURL=_nab-validation-dispatch.js.map