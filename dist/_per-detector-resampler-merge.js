"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergePerDetectorAcrossPasses = mergePerDetectorAcrossPasses;
exports.mergePerDetectorAcrossThreePasses = mergePerDetectorAcrossThreePasses;
exports.buildAllThreeModePoolsPerDetector = buildAllThreeModePoolsPerDetector;
const _per_detector_resampler_tables_1 = require("./_per-detector-resampler-tables");
const _per_detector_resampler_counts_1 = require("./_per-detector-resampler-counts");
/** Merge per-detector firing-counts across the empirical + parametric
 *  passes, attributing each detector only to ITS methodology-aligned
 *  pass per `PER_DETECTOR_RESAMPLER_MODE`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family. */
function mergePerDetectorAcrossPasses(empirical, parametric, cfg) {
    const out = {};
    for (const family of _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES) {
        const mode = _per_detector_resampler_tables_1.PER_DETECTOR_RESAMPLER_MODE[family];
        const source = mode === 'empirical' ? empirical : parametric;
        const { count, ids } = (0, _per_detector_resampler_counts_1.extractPerDetectorCounts)(source, family, cfg, mode);
        const trajectories = source.healthy_window_count;
        out[family] = {
            pool_id: family,
            methodology_source: mode,
            compile_source_fields: _per_detector_resampler_tables_1.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
            trajectories_per_pass: trajectories,
            firing_count: count,
            firing_ids: ids,
            fpr_per_131: trajectories > 0 ? count / trajectories : 0,
        };
    }
    return out;
}
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
    for (const family of _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES) {
        const mode3 = _per_detector_resampler_tables_1.PER_DETECTOR_RESAMPLER_MODE_3WAY[family];
        const source = passByMode[mode3];
        // Re-use existing 2-way extractPerDetectorCounts; pass 'parametric'
        // for any non-iid mode (the disambiguation logic only cares about
        // empirical vs parametric for firing-ID stub generation; the 3-way
        // distinction lives in the methodology_source override below).
        const mode2 = mode3 === 'iid_bootstrap' ? 'empirical' : 'parametric';
        const { count, ids } = (0, _per_detector_resampler_counts_1.extractPerDetectorCounts)(source, family, cfg, mode2);
        // Override methodology_source on each firing-ID to the 3-way
        // value for accurate schema reporting at the per-firing level.
        for (const id of ids) {
            id.methodology_source = mode3;
        }
        const trajectories = source.healthy_window_count;
        out[family] = {
            pool_id: family,
            methodology_source: mode3,
            compile_source_fields: _per_detector_resampler_tables_1.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
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
    for (const family of _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES) {
        const perMode = {};
        for (const mode of ['iid_bootstrap', 'parametric_gaussian', 'parametric_ar1']) {
            const source = passByMode[mode];
            const mode2 = mode === 'iid_bootstrap' ? 'empirical' : 'parametric';
            const { count, ids } = (0, _per_detector_resampler_counts_1.extractPerDetectorCounts)(source, family, cfg, mode2);
            for (const id of ids) {
                id.methodology_source = mode;
            }
            const trajectories = source.healthy_window_count;
            perMode[mode] = {
                pool_id: family,
                methodology_source: mode,
                compile_source_fields: _per_detector_resampler_tables_1.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY[family],
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
//# sourceMappingURL=_per-detector-resampler-merge.js.map