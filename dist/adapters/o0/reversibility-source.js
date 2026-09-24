"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/o0/reversibility-source.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioReversibilitySource = exports.InlineReversibilitySource = exports.NoReversibilitySource = void 0;
/** Default source. Every deploy receives `null` → default-fallback
 *  applies at the classifier. Orchestrator uses this when the caller
 *  doesn't thread a real source through — guarantees backward compat
 *  with pre-#5 callers and frees new callers from boilerplate. */
class NoReversibilitySource {
    getReversibility(_deploy_id) {
        return null;
    }
}
exports.NoReversibilitySource = NoReversibilitySource;
/** Test fixture. Pins a specific value (or explicit `null`) for every
 *  deploy_id. Useful for unit tests that want deterministic annotation
 *  behavior without constructing a Record. */
class InlineReversibilitySource {
    constructor(value) {
        this.value = value;
    }
    getReversibility(_deploy_id) {
        return this.value;
    }
}
exports.InlineReversibilitySource = InlineReversibilitySource;
/** Runway synthetic source. Reads from a keyed Record, typically
 *  populated from a scenario JSON file at test setup. Unknown deploy
 *  IDs fall through to `null` → default-fallback applies. */
class ScenarioReversibilitySource {
    constructor(annotations) {
        this.annotations = annotations;
    }
    getReversibility(deploy_id) {
        return this.annotations[deploy_id] ?? null;
    }
}
exports.ScenarioReversibilitySource = ScenarioReversibilitySource;
//# sourceMappingURL=reversibility-source.js.map