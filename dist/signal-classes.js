"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/signal-classes.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SIGNAL_CLASSES = exports.LOG_FLOOR_EPS = exports.LOGIT_BOUNDARY_EPS = void 0;
exports.logitTransform = logitTransform;
exports.logTransform = logTransform;
exports.anscombeTransform = anscombeTransform;
exports.transformForClass = transformForClass;
exports.resolveSignalClass = resolveSignalClass;
// ── Transform constants ──────────────────────────────────────────────
/** Logit-transform boundary clip. Chosen to keep
 *  `log(eps / (1 − eps)) ≈ −20.7` (well within float64 range; not
 *  catastrophic FP loss). Spec open-Q 3 — tunable post-empirical-test;
 *  architect-default 1e-9 with regression tests. */
exports.LOGIT_BOUNDARY_EPS = 1e-9;
/** Log-transform floor. Avoids `log(0)` on signals that may legitimately
 *  hit zero (rare cost samples, idle-period tokens). */
exports.LOG_FLOOR_EPS = 1e-9;
/** Anscombe constant — Snedecor & Cochran 1967. `2·√(x + 3/8)` maps
 *  Poisson(λ) → ≈ N(2√λ, 1) for moderate λ. Spec open-Q 4 — chosen
 *  Anscombe over Freeman-Tukey per established usage. */
const ANSCOMBE_CONSTANT = 3 / 8;
// ── Forward transforms (per-class) ──────────────────────────────────
/** Logit transform: x ∈ (0, 1) → (−∞, +∞).
 *  Boundary clipping prevents `log(0)` / `log(∞)` at saturation;
 *  inverse-operation (sigmoid) produces back-mapped value within
 *  [eps, 1 − eps]. */
function logitTransform(x) {
    const xClipped = Math.max(exports.LOGIT_BOUNDARY_EPS, Math.min(1 - exports.LOGIT_BOUNDARY_EPS, x));
    return Math.log(xClipped / (1 - xClipped));
}
/** Log transform: x ∈ [0, +∞) → (−∞, +∞).
 *  Floor clipping handles legitimate zeros without producing −∞. */
function logTransform(x) {
    return Math.log(Math.max(exports.LOG_FLOOR_EPS, x));
}
/** Anscombe variance-stabilizing transform for Poisson-like counts.
 *  `f(x) = 2 · √(max(0, x) + 3/8)` — handles x = 0 explicitly via the
 *  `max(0, …)` guard so negative inputs (which shouldn't occur on a
 *  count signal but defensively might via FP rounding) don't produce
 *  NaN. */
function anscombeTransform(x) {
    return 2 * Math.sqrt(Math.max(0, x) + ANSCOMBE_CONSTANT);
}
/** Class-appropriate forward transform dispatcher. Single function
 *  call; O(1) per tick per signal at runtime; runtime cost negligible.
 *  Unknown / non-enumerated class falls back to identity transform —
 *  defensive default for forward-compat with future class additions
 *  loaded from a CompiledConfig that this code revision didn't ship. */
function transformForClass(x, cls) {
    switch (cls) {
        case 'gaussian_like':
            return x;
        case 'bounded_probability':
            return logitTransform(x);
        case 'heavy_tail':
            return logTransform(x);
        case 'counts':
            return anscombeTransform(x);
    }
}
// ── Default class assignment for DeploySignal's standard signal set ──
/** Default signal-class assignment per spec table. Operators can
 *  override per-deploy via `CompiledConfig.signal_classes`; absence
 *  = lookup in this map; absence in this map = `'gaussian_like'`. */
exports.DEFAULT_SIGNAL_CLASSES = {
    // Gaussian-like (latencies; standard Gaussian-H₀ assumption holds)
    p99_latency: 'gaussian_like',
    ttft: 'gaussian_like',
    // Bounded-probability (rates ∈ [0, 1]; saturate at boundary)
    tool_success_rate: 'bounded_probability',
    eval_score: 'bounded_probability',
    downstream_err: 'bounded_probability',
    // Heavy-tail (multiplicative-process values)
    cost_req: 'heavy_tail',
    tokens_turn: 'heavy_tail',
};
/** Resolve the class for a given signal: caller-supplied override map
 *  → DEFAULT_SIGNAL_CLASSES → 'gaussian_like'. Centralizes the
 *  three-tier lookup so calibrator and runtime dispatcher share
 *  byte-identical resolution. */
function resolveSignalClass(signal, overrides) {
    return overrides?.[signal] ?? exports.DEFAULT_SIGNAL_CLASSES[signal] ?? 'gaussian_like';
}
//# sourceMappingURL=signal-classes.js.map