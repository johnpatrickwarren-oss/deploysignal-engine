"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/families/e.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWeightedConformal = isWeightedConformal;
exports.isWeightedEValueConformal = isWeightedEValueConformal;
exports.conformalSampleCount = conformalSampleCount;
/** Type guard: true iff `p` is the Addition #19 weighted variant. */
function isWeightedConformal(p) {
    return p.kind === 'weighted';
}
/** Type guard: true iff `p` is the Addition #22 weighted-e-value variant. */
function isWeightedEValueConformal(p) {
    return p.kind === 'weighted_e_value';
}
/** Sample count across all variants of `ConformalParams`. Used by the
 *  detector's underpowered guard and by tests that want a variant-
 *  agnostic size. */
function conformalSampleCount(p) {
    if (isWeightedConformal(p) || isWeightedEValueConformal(p))
        return p.scores.length;
    return p.calibration_scores.length;
}
//# sourceMappingURL=e.js.map