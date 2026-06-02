"use strict";
// tools/nab-per-dataset/_nab-per-dataset-config.ts — per-dataset compiled
// config construction. The large `buildPerDatasetConfig` body is
// decomposed into <100-line helpers (verbatim block extraction; identical
// behavior) so no function exceeds 100 lines.
Object.defineProperty(exports, "__esModule", { value: true });
exports.calibrateSpectralBootstrapQuantile = calibrateSpectralBootstrapQuantile;
exports.buildPerDatasetConfig = buildPerDatasetConfig;
const self_normalized_e_process_fallback_1 = require("../../detectors/self-normalized-e-process-fallback");
const spectral_1 = require("../../detectors/spectral");
const family_a_mixture_supermartingale_1 = require("../../detectors/family-a-mixture-supermartingale");
const ar_p_1 = require("../../detectors/ar-p");
const seasonal_1 = require("../../detectors/seasonal");
const _nab_per_dataset_constants_1 = require("./_nab-per-dataset-constants");
/** SLICE 5 — calibrate the spectral bootstrap-null quantile from the
 *  probationary window's empirical peak-ACF distribution. Computes
 *  peakACF on each overlapping length-`SPECTRAL_BOOTSTRAP_WINDOW`
 *  subwindow of the probationary data, then returns the (quantile)-th
 *  order statistic. When the probationary window is too short for
 *  reliable calibration, returns SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE
 *  (≪ SLICE 4's hardcoded 0.5 but still loose enough to not silent-fail). */
function calibrateSpectralBootstrapQuantile(probationary, minLag, maxLag, quantile) {
    if (probationary.length < _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_WINDOW + minLag) {
        return {
            quantile_used: _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE,
            n_subwindows: 0,
            empirically_calibrated: false,
        };
    }
    const peaks = [];
    for (let i = 0; i + _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_WINDOW <= probationary.length; i++) {
        const win = probationary.slice(i, i + _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_WINDOW);
        const p = (0, spectral_1.peakACF)(win, minLag, maxLag).peak;
        peaks.push(p);
    }
    if (peaks.length < _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_MIN_SUBWINDOWS) {
        return {
            quantile_used: _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE,
            n_subwindows: peaks.length,
            empirically_calibrated: false,
        };
    }
    peaks.sort((a, b) => a - b);
    const idx = Math.min(peaks.length - 1, Math.floor(quantile * peaks.length));
    return {
        quantile_used: peaks[idx],
        n_subwindows: peaks.length,
        empirically_calibrated: true,
    };
}
/** Resolve the SLICE-by-SLICE default flags + validate the mutually-
 *  exclusive prewhitening/HAC combination. */
function resolveBuildFlags(options) {
    // SLICE 5 — default mode: pre-whitening ON, HAC OFF, cooldown=1000.
    // The legacy SLICE 4 path (HAC=true, prewhiten=false) is preserved for
    // regression measurement but is no longer the default — the empirical
    // sweep showed HAC inflation silently disabled page-CUSUM fires and
    // did nothing for betting; pre-whitening is the active correction.
    const usePrewhitening = options?.usePrewhitening ?? true;
    const useHac = options?.useHacInflation ?? false;
    if (usePrewhitening && useHac) {
        throw new Error('buildPerDatasetConfig: usePrewhitening and useHacInflation are mutually '
            + 'exclusive — both correct the iid-vs-AR(1) mismatch but via opposing '
            + 'mechanisms. Pick one.');
    }
    const familyACooldownTicks = options?.familyACooldownTicks ?? _nab_per_dataset_constants_1.DEFAULT_FAMILY_A_COOLDOWN_TICKS;
    const useSmoothing = options?.useAnomalyLikelihoodSmoothing ?? true;
    // Phase E SLICE 8 — AR(p) opt-in (architect-pick: default false at
    // emit; SLICE 11 may flip after periodic-decomp landing).
    const useArP = options?.useArPCalibration ?? false;
    // Phase E SLICE 9 — seasonal decomposition opt-in (default off at
    // SLICE 9 emit; SLICE 11 may flip after measurement).
    const useSeasonal = options?.useSeasonalDecomposition ?? false;
    return { usePrewhitening, useHac, familyACooldownTicks, useSmoothing, useArP, useSeasonal };
}
/** Derive all probationary-window calibration numerics (mean, σ²,
 *  AR(1)/AR(p)/seasonal fits, stamped variance, spectral quantile). */
function computeCalibrationStats(values, probationaryFraction, flags, options) {
    const nProbationary = Math.max(2, Math.floor(values.length * probationaryFraction));
    const probationary = values.slice(0, nProbationary);
    const mu = (0, _nab_per_dataset_constants_1.mean)(probationary);
    const iidSigma2 = (0, _nab_per_dataset_constants_1.sampleVariance)(probationary, mu);
    const phi = (0, _nab_per_dataset_constants_1.ar1Phi)(probationary, mu);
    // Phase E SLICE 9 — seasonal decomposition (per-phase mean subtraction).
    // Runs BEFORE AR fitting so subsequent AR(1)/AR(p) operates on the
    // deseasonalized residual. The dispatcher will subtract the same
    // seasonal means from runtime observations using the
    // `seasonal_decomposition` provenance stamp + the spec § ASK 3
    // convention (tick 0 = phase 0).
    const seasonalFit = flags.useSeasonal
        ? (0, seasonal_1.decomposeSeasonal)(probationary, mu, { min_acf: options?.seasonalMinAcf })
        : { period: 0, acf_at_period: 0, seasonal_means: [], deseasonalized: probationary };
    const probationaryResidual = seasonalFit.deseasonalized;
    // Refit AR(1) phi on the deseasonalized series (it's a different
    // process; the raw-series phi captures both AR(1) and periodic
    // structure as one effective lag-1 correlation).
    const phiDeseasoned = seasonalFit.period > 0 ? (0, _nab_per_dataset_constants_1.ar1Phi)(probationaryResidual, mu) : phi;
    const iidSigma2Deseasoned = seasonalFit.period > 0
        ? (0, _nab_per_dataset_constants_1.sampleVariance)(probationaryResidual, mu)
        : iidSigma2;
    // Phase E SLICE 8 — AR(p) multi-lag fit on the (possibly
    // deseasonalized) probationary window with AIC-optimal order.
    // Default off; opt-in via `useArPCalibration`. When SLICE 9 is also
    // on, the AR(p) fit is on the deseasonalized residual — the cleanest
    // composition (seasonal removes nuisance period; AR(p) captures
    // remaining short-range correlation).
    const arPFit = flags.useArP
        ? (0, ar_p_1.fitArP)(probationaryResidual, mu, {
            p_max: options?.arPMaxOrder,
            ic: options?.arPInformationCriterion,
        })
        : null;
    // Variance to stamp into the per-signal config. SLICE 5 default uses
    // INNOVATION variance σ²·(1−φ²) so the detector — receiving pre-
    // whitened residuals — operates on the right scale. SLICE 4 legacy:
    // HAC long-run σ²·(1+φ)/(1−φ). Phase E SLICE 8 (AR(p)): innovation
    // variance comes from the multi-lag Yule-Walker fit; supersedes the
    // single-lag (1-φ²) formula above.
    let sigma2;
    if (arPFit && arPFit.sigma2_innovation > 1e-12) {
        // AR(p) fit dominates when opted in and the fit is non-degenerate.
        sigma2 = arPFit.sigma2_innovation;
    }
    else if (seasonalFit.period > 0) {
        // SLICE 9 active: use the AR(1) innovation variance on the
        // deseasonalized series. Both the dispatcher pre-whitening and the
        // detector's per-tick variance proxy operate on the residual scale.
        const phiSqDes = Math.min(phiDeseasoned * phiDeseasoned, 0.9999);
        sigma2 = Math.max(iidSigma2Deseasoned * (1 - phiSqDes), 1e-12);
    }
    else if (flags.usePrewhitening) {
        // Innovation variance under AR(1). Floor against degenerate φ̂ = ±1.
        const phiSquared = Math.min(phi * phi, 0.9999);
        sigma2 = Math.max(iidSigma2 * (1 - phiSquared), 1e-12);
    }
    else if (flags.useHac) {
        sigma2 = iidSigma2 * (0, _nab_per_dataset_constants_1.hacInflationFactor)(phi);
    }
    else {
        // Raw marginal variance (pre-SLICE-4 iid-calibrated baseline).
        sigma2 = iidSigma2;
    }
    const sigma = Math.sqrt(sigma2);
    // Calibrate spectral bootstrap-null quantile from probationary
    // peak-ACF distribution. This stays in marginal-variance scale (raw
    // values) because spectral consumes raw observations — pre-whitening
    // would destroy the autocorrelation it measures.
    const spectralCalib = calibrateSpectralBootstrapQuantile(probationary, _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MIN_PEAK_LAG, _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MAX_PEAK_LAG, _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_QUANTILE);
    return {
        nProbationary, probationary, mu, iidSigma2, phi,
        seasonalFit, phiDeseasoned, iidSigma2Deseasoned, arPFit,
        sigma2, sigma, spectralCalib,
    };
}
/** Assemble the `smoothing` provenance sub-object (or undefined). */
function buildSmoothingProvenance(useSmoothing) {
    if (!useSmoothing)
        return undefined;
    return {
        page_cusum: {
            window: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.pageCusum.window,
            threshold_count: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.pageCusum.thresholdCount,
            cooldown_ticks: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.pageCusum.cooldownTicks,
        },
        betting: {
            window: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.betting.window,
            threshold_count: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.betting.thresholdCount,
            cooldown_ticks: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.betting.cooldownTicks,
        },
        mixture_supermartingale: {
            window: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.mixtureSupermartingale.window,
            threshold_count: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.mixtureSupermartingale.thresholdCount,
            cooldown_ticks: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.mixtureSupermartingale.cooldownTicks,
        },
        spectral: {
            window: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.spectral.window,
            threshold_count: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.spectral.thresholdCount,
            cooldown_ticks: _nab_per_dataset_constants_1.DEFAULT_SMOOTHING.spectral.cooldownTicks,
        },
    };
}
/** Build the `_calibration_provenance` object from derived stats. */
function buildProvenance(values, probationaryFraction, flags, stats, options) {
    const { nProbationary, mu, iidSigma2, phi, seasonalFit, phiDeseasoned, iidSigma2Deseasoned, arPFit, sigma2, spectralCalib, probationary, } = stats;
    const provenance = {
        probationary_fraction: probationaryFraction,
        n_probationary_ticks: nProbationary,
        n_total_ticks: values.length,
        derived: { baseline_mean: mu, baseline_sigma_squared: iidSigma2, ar1_phi: phi },
        hac_inflation: flags.useHac ? {
            phi_used: phi,
            factor: (0, _nab_per_dataset_constants_1.hacInflationFactor)(phi),
            iid_sigma_squared: iidSigma2,
            inflated_sigma_squared: sigma2,
        } : undefined,
        pre_whitening: flags.usePrewhitening ? {
            phi_used: phi,
            marginal_sigma_squared: iidSigma2,
            innovation_sigma_squared: sigma2,
        } : undefined,
        spectral_bootstrap: {
            quantile_target: _nab_per_dataset_constants_1.SPECTRAL_BOOTSTRAP_QUANTILE,
            quantile_used: spectralCalib.quantile_used,
            n_subwindows: spectralCalib.n_subwindows,
            min_peak_lag: _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MIN_PEAK_LAG,
            max_peak_lag: _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MAX_PEAK_LAG,
            empirically_calibrated: spectralCalib.empirically_calibrated,
        },
        family_a_cooldown_ticks: flags.familyACooldownTicks,
        ar_p_calibration: arPFit ? {
            p: arPFit.p,
            phi: arPFit.phi,
            sigma2_innovation: arPFit.sigma2_innovation,
            ic_trace: arPFit.ic_trace,
            ic_kind: arPFit.ic_kind,
            reflection_coefficients: arPFit.reflection_coefficients,
            p_max: Math.max(1, Math.min(30, options?.arPMaxOrder ?? Math.floor(probationary.length / 10))),
        } : undefined,
        seasonal_decomposition: seasonalFit.period > 0 ? {
            period: seasonalFit.period,
            acf_at_period: seasonalFit.acf_at_period,
            seasonal_means: seasonalFit.seasonal_means,
            ar1_phi_deseasoned: phiDeseasoned,
            sigma2_innovation_deseasoned: iidSigma2Deseasoned * (1 - Math.min(phiDeseasoned * phiDeseasoned, 0.9999)),
        } : undefined,
        smoothing: buildSmoothingProvenance(flags.useSmoothing),
    };
    // Q70 SLICE 2 fallback stamping (independent of HAC/pre-whitening
    // mode). φ̂ above threshold → stamp LIL hyperparameters; downstream
    // consumers (per-detector wiring; Anvil chaos-experiment scoring)
    // decide whether to engage.
    if (Math.abs(phi) >= _nab_per_dataset_constants_1.AR1_PHI_FALLBACK_THRESHOLD) {
        const lilHyperparams = (0, self_normalized_e_process_fallback_1.buildLilBoundHyperparams)(4e-4);
        provenance.self_normalized_fallback = {
            reason: 'ar1_phi_exceeds_threshold',
            threshold: _nab_per_dataset_constants_1.AR1_PHI_FALLBACK_THRESHOLD,
            observed_phi: phi,
            lil_hyperparams: lilHyperparams,
        };
    }
    return provenance;
}
/** Build the Family A per-signal params (+ mixture-supermartingale). */
function buildFamilyAPerSignal(mu, sigma2, sigma, phi) {
    const perSig = {
        baseline_mean: mu,
        baseline_sigma_squared: sigma2,
        // SLICE 7 — raw σ² for mixture-supermartingale + page-cusum
        // Q2.B.5 consumption. Under pre-whitening mode, sigma2 = innovation
        // variance, which is correct for both detector families:
        // page-cusum receives pre-whitened input from dispatch; mixture-
        // SM receives raw input and pre-whitens internally via ar1_phi.
        // In both cases the per-tick variance proxy is the innovation σ².
        baseline_mean_raw: mu,
        baseline_sigma_squared_raw: sigma2,
        tau_squared: sigma2 / 2,
        delta_min: 1.5 * sigma,
        signal_class: 'heavy_tail',
        betting_sliding_buffer_threshold: 1000,
        betting_calibration_scope: 'sliding_buffer_ar1',
        // SLICE 7 — AR(1) phi from Yule-Walker on probationary
        // window. mixture-supermartingale detector pre-whitens
        // internally; page-cusum & betting pre-whiten externally
        // via the dispatch wrapper.
        ar1_phi: phi,
    };
    // SLICE 7 — derive mixture-supermartingale params (Howard-
    // Ramdas-2021 Gaussian mixture for heavy_tail signal class).
    // Returns { mixture_distribution: 'gaussian',
    //          gaussian_sigma_squared_prior: σ²_raw }.
    const msmParams = (0, family_a_mixture_supermartingale_1.deriveMixtureSupermartingaleParams)(perSig);
    if (msmParams)
        perSig.mixture_supermartingale_params = msmParams;
    return perSig;
}
/** Assemble the compiled config object stamped to the temp dir. */
function buildCompiledConfig(calibrationSignal, stats, provenance) {
    const { mu, sigma2, sigma, phi, spectralCalib } = stats;
    return {
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
                        [calibrationSignal]: buildFamilyAPerSignal(mu, sigma2, sigma, phi),
                    },
                },
                family_D: {
                    [calibrationSignal]: {
                        ar1_phi: phi,
                        // SLICE 5 — stamp lag bounds (SLICE 4 omitted these, making
                        // peakACF return 0 always).
                        min_peak_lag: _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MIN_PEAK_LAG,
                        max_peak_lag: _nab_per_dataset_constants_1.DEFAULT_SPECTRAL_MAX_PEAK_LAG,
                        // SLICE 5 — per-dataset bootstrap calibration. SLICE 4
                        // hardcoded 0.5 (which was below the AR(1) baseline-ACF for
                        // φ ≈ 0.95 datasets → fire on every tick if lag bounds had
                        // been present).
                        bootstrap_null_quantile: spectralCalib.quantile_used,
                        peak_acf_threshold: spectralCalib.quantile_used,
                        spectral_variant: 'bootstrap_null',
                    },
                },
            },
        },
        _calibration_provenance: provenance,
    };
}
/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback).
 *
 *  SLICE 5 default behavior: AR(1) pre-whitening + innovation variance
 *  (NOT HAC inflation) + per-dataset spectral bootstrap calibration +
 *  Family A post-fire cooldown. SLICE 4's HAC inflation is preserved as
 *  an opt-in for back-compat regression comparison via the
 *  `useHacInflation: true, usePrewhitening: false` option combination. */
function buildPerDatasetConfig(values, calibrationSignal, probationaryFraction, options) {
    const flags = resolveBuildFlags(options);
    const stats = computeCalibrationStats(values, probationaryFraction, flags, options);
    const provenance = buildProvenance(values, probationaryFraction, flags, stats, options);
    const config = buildCompiledConfig(calibrationSignal, stats, provenance);
    return { config, provenance };
}
//# sourceMappingURL=_nab-per-dataset-config.js.map