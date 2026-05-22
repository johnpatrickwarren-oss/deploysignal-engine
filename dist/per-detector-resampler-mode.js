"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.PER_DETECTOR_ALPHA_BUDGETS = exports.PER_DETECTOR_RESAMPLER_MODE_3WAY = exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY = exports.PER_DETECTOR_RESAMPLER_MODE = exports.PER_DETECTOR_FAMILIES = void 0;
exports.resolveHotellingVariant = resolveHotellingVariant;
exports.extractPerDetectorCounts = extractPerDetectorCounts;
exports.mergePerDetectorAcrossPasses = mergePerDetectorAcrossPasses;
exports.mergePerDetectorAcrossThreePasses = mergePerDetectorAcrossThreePasses;
exports.buildAllThreeModePoolsPerDetector = buildAllThreeModePoolsPerDetector;
exports.checkPerDetectorAcceptance = checkPerDetectorAcceptance;
exports.wilsonUpperBound = wilsonUpperBound;
exports.summarizePerDetectorAcrossSeeds = summarizePerDetectorAcrossSeeds;
/** Enumerated detector-family list. Source-of-truth ordering for
 *  iteration in `mergePerDetectorAcrossPasses` and report-card
 *  emission loops. */
exports.PER_DETECTOR_FAMILIES = [
    'family_A_betting',
    'family_A_page_cusum',
    'family_C_safe_test',
    'family_C_chi_square',
    'family_D_spectral',
    'family_D_kv_cache',
    'family_E_conformal',
    'mmd_betting',
    'mmd_bootstrap_null',
    'family_B_pattern_match',
];
/** Per-detector resampler-mode dispatch table per Q58 amended spec
 *  § Q58.2 + detector-family enumeration table. Each detector
 *  evaluated against the methodology surface IT WAS CALIBRATED FOR
 *  (Q2.B.6.4 P4-β.7 ADR methodology-vs-detector-design alignment).
 *
 *  Parametric pass services 6 pools — calibrated against parametric
 *  H₀ surfaces (Cholesky-correct Σ_C draws + per-cell Mahalanobis +
 *  Q3 Ville-clean betting + parametric MMD nulls).
 *
 *  Empirical pass services 4 pools — calibrated against raw distribution
 *  shape (CUSUM raw-distribution + peak-ACF raw temporal structure +
 *  structural ratio observed). */
exports.PER_DETECTOR_RESAMPLER_MODE = {
    // Parametric pass (6 detectors):
    family_A_betting: 'parametric', // Q3 Ville-clean H₀ test design intent.
    family_C_safe_test: 'parametric', // Cholesky-correct + non-diagonal Σ_C.
    family_C_chi_square: 'parametric', // Cholesky-correct.
    family_E_conformal: 'parametric', // Q2.B.6.4 ADR original motivation.
    mmd_betting: 'parametric', // Cholesky-correct + e_mmd_params.
    mmd_bootstrap_null: 'parametric', // null_quantile + bandwidth parametric.
    // Empirical pass (4 detectors):
    family_A_page_cusum: 'empirical', // CUSUM raw-distribution calibration.
    family_D_spectral: 'empirical', // Peak-ACF raw temporal structure.
    family_D_kv_cache: 'empirical', // Same peak-ACF rationale.
    family_B_pattern_match: 'empirical', // Structural ratios over raw observed.
};
/** Compile-output fields read by each detector's runtime evaluator.
 *  Per Q58 amended spec § Q58.3 + Step-0 Gap 4 disposition (6 missing
 *  fields added across pools).
 *
 *  P3.3 sub-pattern (compile-time-substrate-with-runtime-multiple-
 *  read-paths) anchored: each entry mirrors the actual read paths in
 *  engine/detectors/* runtime code. Mac-Claude-2 grep at Step Q58.0
 *  surfaced 6 missing fields; architect amended; this enumeration
 *  closes the gap. */
exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY = {
    family_A_betting: [
        'family_A.per_signal[sig].baseline_mean_raw',
        'family_A.per_signal[sig].baseline_sigma_squared_raw',
        'family_A.per_signal[sig].betting_e_process_alpha',
        'family_A.per_signal[sig].betting_sliding_buffer_threshold', // Q2.B.6.3
        'family_A.per_signal[sig].signal_class', // Q2.A
    ],
    family_A_page_cusum: [
        'family_A.per_signal[sig].baseline_mean',
        'family_A.per_signal[sig].baseline_sigma_squared',
        'family_A.per_signal[sig].tau_squared',
        'family_A.per_signal[sig].delta_min',
        'family_A.per_signal[sig].signal_class', // Q2.A
    ],
    family_C_safe_test: [
        'family_C.mean_vector',
        'family_C.covariance',
        'family_C.cholesky_L',
        'family_C.safe_hotelling_params',
        'family_C.sliding_buffer_threshold', // Q2.B.6.2
        'family_C.mmd_params', // alpha-halving (Step-0 Gap 4)
        'family_C.hotelling_variant', // dispatch (Step-0 Gap 4)
    ],
    family_C_chi_square: [
        'family_C.mean_vector',
        'family_C.covariance',
        'family_C.cholesky_L',
        'family_C.hotelling_sliding_buffer_threshold', // Q2.B.6.2
        'family_C.hotelling_variant', // dispatch (Step-0 Gap 4)
    ],
    family_D_spectral: [
        'family_D[sig].ar1_phi',
        'family_D[sig].ar1_sigma_eps',
        'family_D[sig].null_mean',
        'family_D[sig].null_std',
        'family_D[sig].betting_delta',
        'family_D[sig].cholesky_L_eps', // Q2.B.6.1
        'family_D[sig].spectral_variant', // dispatch (Step-0 Gap 4)
    ],
    family_D_kv_cache: [
        // Inherits family_D_spectral; signal-scoped to kv_cache.
        'family_D.kv_cache.ar1_phi',
        'family_D.kv_cache.ar1_sigma_eps',
        'family_D.kv_cache.null_mean',
        'family_D.kv_cache.null_std',
        'family_D.kv_cache.betting_delta',
        'family_D.kv_cache.cholesky_L_eps',
        'family_D.kv_cache.spectral_variant', // dispatch (Step-0 Gap 4)
    ],
    family_E_conformal: [
        // Aggregate calibration scores (per ARCHITECT-REPLY-16 Q2;
        // anti-scope per Q2.B.6.4 ADR — DO NOT change source from aggregate).
        'aggregate_fallback.family_E.calibration_scores',
        'aggregate_fallback.family_E.threshold',
        'aggregate_fallback.family_E.weight_decay_params',
        // Per-cell-preferred Mahalanobis source (Step-0 Gap 4 + Gap 3
        // amendment; per engine/detectors/conformal.ts:137; ANTI-SCOPE
        // per Q2.B.6.4 ADR — DO NOT make Family E aggregate-only).
        'cells[*].family_C.mean_vector',
        'cells[*].family_C.covariance',
        'cells[*].family_C.cholesky_L',
        'aggregate_fallback.family_C.mean_vector', // fallback when per-cell unavailable
        'aggregate_fallback.family_C.covariance',
        'aggregate_fallback.family_C.cholesky_L',
    ],
    mmd_betting: [
        'family_C.mean_vector', // Step-0 Gap 4
        'family_C.covariance', // Step-0 Gap 4
        'family_C.cholesky_L', // Step-0 Gap 4
        'family_C.e_mmd_params',
        'family_C.betting_e_process_params', // Q67 v2 canonical params
    ],
    mmd_bootstrap_null: [
        'family_C.mmd_params.bandwidth',
        'family_C.mmd_params.baseline_baseline_sum',
        'family_C.mmd_params.null_quantile',
        'family_C.mmd_params.null_quantile_bootstraps',
        'family_C.mean_vector', // for centering (Step-0 Gap 4)
    ],
    family_B_pattern_match: [
        'family_B.patterns[name].threshold',
        'family_B.patterns[name].ratio_definition',
    ],
};
/** Resolve Family C hotelling variant from compiled config. Drives
 *  per-detector pool attribution for `family_C` events: when variant
 *  is 'safe_test' all family_C events flow to the safe_test pool;
 *  when 'chi_square' all flow to the chi_square pool. Defaults to
 *  'chi_square' for legacy substrates without the field. */
function resolveHotellingVariant(cfg) {
    return cfg?.baseline_cells?.aggregate_fallback?.family_C?.hotelling_variant ?? 'chi_square';
}
/** Per-detector firing-count attribution from a single FPR-sweep
 *  pass. Returns `{ count, ids }` where `count` is the per-window
 *  count from `firing_attribution_by_category` (a window contributes
 *  1 per category-firing) and `ids` is a derived list of stub
 *  per-detector firing-IDs.
 *
 *  Disambiguation rules per amended spec § detector family table:
 *  - `family_C_safe_test` ← `family_C` events when `hotelling_variant === 'safe_test'`
 *  - `family_C_chi_square` ← `family_C` events when `hotelling_variant === 'chi_square'`
 *  - `family_D_spectral` ← `family_D` events EXCLUDING kv_cache signal
 *  - `family_D_kv_cache` ← `family_D` events WHERE signal === 'kv_cache'
 *  - `mmd_betting` ← `family_C_mmd` events when `mmd_variant === 'betting_e_process'`
 *  - `mmd_bootstrap_null` ← `family_C_mmd` events when `mmd_variant === 'bootstrap_null'`
 *  - `family_B_pattern_match` ← `family_b` events
 *
 *  detector_id-to-category mapping mirrors `runFprSweep` categorizeId
 *  (build-report-card.js line ~847). */
function extractPerDetectorCounts(source, family, cfg, mode) {
    const counts = source.firing_attribution_by_category.counts;
    const events = source.firing_events_by_detector_id;
    const perCellByCategory = source.firing_attribution_by_category.per_cell_breakdown ?? {};
    let count = 0;
    const ids = [];
    // Helper: synthesize firing-ID stubs from per-cell breakdown for a
    // given source category. Each cell-key with N firings produces N
    // entries with cell_key populated; tick/statistic/threshold are null
    // (per anti-scope: not surfacing inner detector statistic without
    // touching engine/detectors/*).
    const inflateFromCategory = (sourceCategory, signalFilter) => {
        const out = [];
        const perCell = perCellByCategory[sourceCategory] ?? {};
        for (const [cellKeyStr, n] of Object.entries(perCell)) {
            const [hStr, dStr] = cellKeyStr.split('-');
            const cellKey = { hour_of_day: parseInt(hStr, 10), day_of_week: parseInt(dStr, 10) };
            for (let i = 0; i < n; i++) {
                // Signal filter for family_D split (kv_cache vs other). When
                // filter is unset, all events admitted; when set, only matching
                // events admitted (best-effort: per-cell breakdown doesn't
                // capture per-event signal, so signal filtering happens at
                // event-level via firing_events_by_detector_id below).
                if (!signalFilter) {
                    out.push({
                        cell_key: cellKey,
                        tick: null,
                        signal: undefined,
                        statistic_value: null,
                        threshold: null,
                        verdict: 'fire',
                        detector_family: family,
                        methodology_source: mode,
                    });
                }
            }
        }
        return out;
    };
    switch (family) {
        case 'family_A_betting': {
            count = counts.family_A_betting ?? 0;
            ids.push(...inflateFromCategory('family_A_betting'));
            break;
        }
        case 'family_A_page_cusum': {
            // 'family_A_page_cusum' covers the explicit-named ID; 'family_A_other'
            // covers legacy `family_A_<signal>` IDs (per categorizeId line
            // ~849-850). Both are Page-CUSUM classical-epoch.
            count = (counts.family_A_page_cusum ?? 0) + (counts.family_A_other ?? 0);
            ids.push(...inflateFromCategory('family_A_page_cusum'));
            ids.push(...inflateFromCategory('family_A_other'));
            break;
        }
        case 'family_C_safe_test': {
            const variant = resolveHotellingVariant(cfg);
            count = variant === 'safe_test' ? (counts.family_C ?? 0) : 0;
            if (variant === 'safe_test')
                ids.push(...inflateFromCategory('family_C'));
            break;
        }
        case 'family_C_chi_square': {
            const variant = resolveHotellingVariant(cfg);
            count = variant === 'chi_square' ? (counts.family_C ?? 0) : 0;
            if (variant === 'chi_square')
                ids.push(...inflateFromCategory('family_C'));
            break;
        }
        case 'family_D_spectral': {
            // family_D events split by signal: family_D_<sig> per detector
            // attribution. spectral pool covers all signals EXCEPT kv_cache
            // (which has its own pool below). Count derived from event-level
            // detector_id splits.
            let total = 0;
            for (const [id, n] of Object.entries(events)) {
                if (!id.startsWith('family_D_'))
                    continue;
                if (id === 'family_D_kv_cache')
                    continue;
                total += n;
            }
            count = total;
            // ids inflated from category-level (no per-signal cell breakdown
            // available); family-level cell_key is the available granularity.
            ids.push(...inflateFromCategory('family_D'));
            break;
        }
        case 'family_D_kv_cache': {
            count = events['family_D_kv_cache'] ?? 0;
            // ids: best-effort empty; family_D per-cell breakdown doesn't
            // distinguish kv_cache vs other signals.
            break;
        }
        case 'family_E_conformal': {
            count = counts.family_E ?? 0;
            ids.push(...inflateFromCategory('family_E'));
            break;
        }
        case 'mmd_betting': {
            // Q68 Phase-3.d.C consolidation — `mmd_variant` flag retired;
            // all family_C_mmd events now flow to mmd_betting pool unconditionally.
            count = counts.family_C_mmd ?? 0;
            ids.push(...inflateFromCategory('family_C_mmd'));
            break;
        }
        case 'mmd_bootstrap_null': {
            // Q68 Phase-3.d.C consolidation — classical bootstrap-null detector
            // retired (engine/detectors/sequential-mmd.ts evaluateSequentialMMD
            // removed). Pool preserved with always-zero count for schema
            // backward-compat. Q69 Phase-3.d.D close: CAVEAT_EXEMPT_FAMILIES
            // set retired per Q69.1; mmd_bootstrap_null entry no longer needed
            // for CAVEAT-test exemption (CAVEAT clause RETIRED-SPEC-SIDE).
            count = 0;
            break;
        }
        case 'family_B_pattern_match': {
            count = counts.family_b ?? 0;
            ids.push(...inflateFromCategory('family_b'));
            break;
        }
    }
    return { count, ids };
}
/** Merge per-detector firing-counts across the empirical + parametric
 *  passes, attributing each detector only to ITS methodology-aligned
 *  pass per `PER_DETECTOR_RESAMPLER_MODE`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family. */
function mergePerDetectorAcrossPasses(empirical, parametric, cfg) {
    const out = {};
    for (const family of exports.PER_DETECTOR_FAMILIES) {
        const mode = exports.PER_DETECTOR_RESAMPLER_MODE[family];
        const source = mode === 'empirical' ? empirical : parametric;
        const { count, ids } = extractPerDetectorCounts(source, family, cfg, mode);
        const trajectories = source.healthy_window_count;
        out[family] = {
            pool_id: family,
            methodology_source: mode,
            compile_source_fields: exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
            trajectories_per_pass: trajectories,
            firing_count: count,
            firing_ids: ids,
            fpr_per_131: trajectories > 0 ? count / trajectories : 0,
        };
    }
    return out;
}
/** Per-detector 3-way resampler-mode dispatch table per Q58 Step-4
 *  amendment. Each detector evaluated against the methodology
 *  surface IT WAS CALIBRATED FOR (Q2.B.6.4 P4-β.7 ADR
 *  methodology-vs-detector-design alignment). 3-way granularity
 *  resolves the parametric_gaussian-vs-parametric_ar1 trade-off
 *  surfaced empirically at Step-Q58.4. */
exports.PER_DETECTOR_RESAMPLER_MODE_3WAY = {
    // iid_bootstrap pass (2 detectors) — calibrated against raw
    // empirical distribution shape.
    family_A_page_cusum: 'iid_bootstrap', // CUSUM raw-distribution calibration.
    family_B_pattern_match: 'iid_bootstrap', // Structural ratios over raw observed.
    // parametric_gaussian pass (5 detectors) — Cholesky-correct joint
    // Gaussian draws from cell.family_C.{mean_vector, cholesky_L}.
    family_A_betting: 'parametric_gaussian', // Q3 Ville-clean H₀ design intent.
    family_C_safe_test: 'parametric_gaussian', // Cholesky-correct + non-diagonal Σ_C.
    family_C_chi_square: 'parametric_gaussian', // Cholesky-correct.
    mmd_betting: 'parametric_gaussian', // Cholesky-correct + e_mmd_params.
    mmd_bootstrap_null: 'parametric_gaussian', // null_quantile + bandwidth parametric.
    // parametric_ar1 pass (3 detectors) — preserves AR(1) temporal
    // correlation that calibration was tuned against. CHANGE from
    // Step-0 spec: family_E + family_D moved here from parametric.
    family_D_spectral: 'parametric_ar1', // Peak-ACF ↔ AR(1) temporal structure.
    family_D_kv_cache: 'parametric_ar1', // Same peak-ACF rationale; high-ρ kv_cache.
    family_E_conformal: 'parametric_ar1', // Conformal Mahalanobis ↔ Q2.B.7 AR(1)-aware.
};
/** Per-detector α budgets for Step-4 acceptance check (mean ≤ α × N
 *  × marginMultiplier). Step-4 amendment per spec § Q58.4 acceptance.
 *  Family B is non-α-consuming (structural pattern match); auto-pass
 *  via `checkPerDetectorAcceptance`. */
exports.PER_DETECTOR_ALPHA_BUDGETS = {
    family_A_betting: 2e-4, // α_A_betting union over 6 signals (Bonferroni)
    family_A_page_cusum: 1e-4, // α_A_page_cusum classical-epoch
    family_C_safe_test: 2e-4, // α_C
    family_C_chi_square: 2e-4, // α_C (variant share)
    family_D_spectral: 1e-4, // α_D
    family_D_kv_cache: 1e-4, // α_D (signal share)
    family_E_conformal: 1e-4, // α_E
    mmd_betting: 1e-4, // α_mmd
    mmd_bootstrap_null: 1e-4, // α_mmd (variant share)
    family_B_pattern_match: 0, // non-α-consuming structural
};
/** Three-pass merge: each detector attributed only to its mode-
 *  aligned pass per `PER_DETECTOR_RESAMPLER_MODE_3WAY`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family with the
 *  `methodology_source` field re-typed as `ResamplerMode3Way`
 *  (extends `ResamplerMode` superset). */
function mergePerDetectorAcrossThreePasses(iidBootstrap, parametricGaussian, parametricAr1, cfg) {
    const passByMode = {
        iid_bootstrap: iidBootstrap,
        parametric_gaussian: parametricGaussian,
        parametric_ar1: parametricAr1,
    };
    const out = {};
    for (const family of exports.PER_DETECTOR_FAMILIES) {
        const mode3 = exports.PER_DETECTOR_RESAMPLER_MODE_3WAY[family];
        const source = passByMode[mode3];
        // Re-use existing 2-way extractPerDetectorCounts; pass 'parametric'
        // for any non-iid mode (the disambiguation logic only cares about
        // empirical vs parametric for firing-ID stub generation; the 3-way
        // distinction lives in the methodology_source override below).
        const mode2 = mode3 === 'iid_bootstrap' ? 'empirical' : 'parametric';
        const { count, ids } = extractPerDetectorCounts(source, family, cfg, mode2);
        // Override methodology_source on each firing-ID to the 3-way
        // value for accurate schema reporting at the per-firing level.
        for (const id of ids) {
            id.methodology_source = mode3;
        }
        const trajectories = source.healthy_window_count;
        out[family] = {
            pool_id: family,
            methodology_source: mode3,
            compile_source_fields: exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
            trajectories_per_pass: trajectories,
            firing_count: count,
            firing_ids: ids,
            fpr_per_131: trajectories > 0 ? count / trajectories : 0,
        };
    }
    return out;
}
/** Q66 Phase-3.d.A close item (h) schema bump 2.2.0 → 2.3.0 — emit
 *  ALL three mode pools per detector (iid_bootstrap + parametric_gaussian
 *  + parametric_ar1) instead of only the design-intent-mode pool. Each
 *  pool block has the same shape as the existing single-mode
 *  PerDetectorIidBootstrapPool; consumers can evaluate halt criterion
 *  (a) per mode by reading the appropriate field on the per-detector
 *  block in build-report-card.js output. Per architect Ask 2 disposition
 *  2026-05-05 refined-Option-(i) bundled pick.
 *
 *  Backward-compat: existing `iid_bootstrap_pool` field on each detector
 *  block continues to emit design-intent-mode pool (per
 *  `mergePerDetectorAcrossThreePasses`); this new function provides
 *  per-mode visibility ALONGSIDE that, not instead. */
function buildAllThreeModePoolsPerDetector(iidBootstrap, parametricGaussian, parametricAr1, cfg) {
    const passByMode = {
        iid_bootstrap: iidBootstrap,
        parametric_gaussian: parametricGaussian,
        parametric_ar1: parametricAr1,
    };
    const out = {};
    for (const family of exports.PER_DETECTOR_FAMILIES) {
        const perMode = {};
        for (const mode of ['iid_bootstrap', 'parametric_gaussian', 'parametric_ar1']) {
            const source = passByMode[mode];
            const mode2 = mode === 'iid_bootstrap' ? 'empirical' : 'parametric';
            const { count, ids } = extractPerDetectorCounts(source, family, cfg, mode2);
            for (const id of ids) {
                id.methodology_source = mode;
            }
            const trajectories = source.healthy_window_count;
            perMode[mode] = {
                pool_id: family,
                methodology_source: mode,
                compile_source_fields: exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
                trajectories_per_pass: trajectories,
                firing_count: count,
                firing_ids: ids,
                fpr_per_131: trajectories > 0 ? count / trajectories : 0,
            };
        }
        out[family] = perMode;
    }
    return out;
}
/** Per-detector α-budget acceptance check per Step-4 amendment.
 *  Architect-pick: mean firing count across N seeds ≤ α × healthy_windows
 *  × marginMultiplier (default 1.2). Tighter than the report-card-level
 *  1.5 × α_total because per-detector α is already conservative. */
function checkPerDetectorAcceptance(perDetectorMeans, alphaBudgets, healthyWindows, marginMultiplier = 1.2) {
    const out = {};
    for (const family of exports.PER_DETECTOR_FAMILIES) {
        const mean = perDetectorMeans[family] ?? 0;
        const alpha = alphaBudgets[family] ?? 0;
        const expected = alpha * healthyWindows;
        const threshold = expected * marginMultiplier;
        out[family] = {
            pass: alpha === 0 ? true : mean <= threshold, // non-α detectors auto-pass
            mean,
            expected,
            threshold,
        };
    }
    return out;
}
/** Wilson-score upper bound for binomial proportion. Used for
 *  per-seed pass-rate confidence interval (architect-pick: ≥ 6/8 seeds
 *  pass under per-seed firing_count ≤ ceil(μ + 1.96 × √μ) Poisson
 *  upper bound). */
function wilsonUpperBound(successes, trials, z = 1.96) {
    if (trials === 0)
        return 1;
    const p = successes / trials;
    const denom = 1 + (z * z) / trials;
    const center = p + (z * z) / (2 * trials);
    const halfWidth = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
    return (center + halfWidth) / denom;
}
/** Compute per-detector mean firing-count across N seeds + per-seed
 *  pass count (against Poisson upper bound). */
function summarizePerDetectorAcrossSeeds(perSeedFiringCounts, alphaBudgets, healthyWindows) {
    const nSeeds = perSeedFiringCounts.length;
    const out = {};
    for (const family of exports.PER_DETECTOR_FAMILIES) {
        const counts = perSeedFiringCounts.map((s) => s[family] ?? 0);
        const sum = counts.reduce((a, b) => a + b, 0);
        const mean = nSeeds > 0 ? sum / nSeeds : 0;
        const alpha = alphaBudgets[family] ?? 0;
        const expected = alpha * healthyWindows;
        // Poisson upper bound at 95%: ceil(μ + 1.96 × √μ).
        const poissonUpper = Math.ceil(expected + 1.96 * Math.sqrt(expected));
        const passes = counts.filter((c) => c <= poissonUpper).length;
        out[family] = {
            per_seed_counts: counts,
            mean,
            per_seed_pass_count: passes,
            per_seed_pass_rate: nSeeds > 0 ? passes / nSeeds : 0,
            poisson_upper_bound: poissonUpper,
        };
    }
    return out;
}
//# sourceMappingURL=per-detector-resampler-mode.js.map