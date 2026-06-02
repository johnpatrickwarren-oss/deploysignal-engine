"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPerDetectorAcceptance = checkPerDetectorAcceptance;
exports.wilsonUpperBound = wilsonUpperBound;
exports.summarizePerDetectorAcrossSeeds = summarizePerDetectorAcrossSeeds;
const _per_detector_resampler_tables_1 = require("./_per-detector-resampler-tables");
/** Per-detector α-budget acceptance check per Step-4 amendment.
 *  Architect-pick: mean firing count across N seeds ≤ α × healthy_windows
 *  × marginMultiplier (default 1.2). Tighter than the report-card-level
 *  1.5 × α_total because per-detector α is already conservative. */
function checkPerDetectorAcceptance(perDetectorMeans, alphaBudgets, healthyWindows, marginMultiplier = 1.2) {
    const out = {};
    for (const family of _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES) {
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
    for (const family of _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES) {
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
//# sourceMappingURL=_per-detector-resampler-acceptance.js.map