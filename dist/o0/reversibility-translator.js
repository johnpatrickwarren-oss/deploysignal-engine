"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/o0/reversibility-translator.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateVerdict = translateVerdict;
/**
 * Translate verdict × reversibility into a concrete orchestrator
 * action. Pure function — no state, no I/O. Easy to unit-test every
 * combination in isolation.
 *
 * Non-rollback verdicts pass through unchanged — reversibility only
 * affects the rollback interpretation. `'baking'` is the engine's
 * internal pre-terminal state; consumers typically filter it out, but
 * passing it through keeps the translator total rather than partial.
 */
function translateVerdict(verdict, reversibility, verdict_reason) {
    if (verdict === 'rollback') {
        switch (reversibility) {
            case 'reversible':
                return { action: 'rollback' };
            case 'forward_only':
                return {
                    action: 'pause_and_alarm',
                    reason: appendReason('Deploy classified forward_only; rollback verdict converted to pause_and_alarm.', verdict_reason),
                };
            case 'conditional':
                return {
                    action: 'human_confirmation_required',
                    reason: appendReason('Deploy classified conditional; rollback verdict requires human confirmation.', verdict_reason),
                };
        }
    }
    if (verdict === 'proceed')
        return { action: 'proceed' };
    if (verdict === 'extend')
        return { action: 'extend' };
    if (verdict === 'baking')
        return { action: 'baking' };
    // Future verdict classes (e.g., Addition #11 'suppressed_insufficient_samples')
    // land here as a suppressed action with the verdict name as the reason.
    return { action: 'suppressed', reason: verdict };
}
function appendReason(prefix, detail) {
    if (!detail)
        return prefix;
    return prefix + ' ' + detail;
}
//# sourceMappingURL=reversibility-translator.js.map