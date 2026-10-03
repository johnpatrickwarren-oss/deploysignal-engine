"use strict";
// detectors/invariant.ts — ADR 0038 §2: an e-process on an identity. Under health, requests routed
// equal responses accounted for up to in-flight requests crossing the window boundary; the
// unaccounted fraction x_t = (total − accounted) / total ∈ [0, 1] then has a small mean set by the
// measurement, not by the service's history. H0: E[x_t | past] ≤ tolerance. The paired bet
// (_paired-bet.ts) gives a test supermartingale under H0; it fires at wealth ≥ 1/α (Ville).
// No proceed side: an invariant is a veto. No history is read.
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInvariantSpec = checkInvariantSpec;
exports.invariantCeiling = invariantCeiling;
exports.initInvariant = initInvariant;
exports.stepInvariant = stepInvariant;
const _paired_bet_1 = require("./_paired-bet");
function checkInvariantSpec(spec) {
    if (!(typeof spec.id === 'string' && spec.id.length > 0))
        throw new RangeError('invariant: id required');
    if (!(spec.tolerance > 0 && spec.tolerance < 1))
        throw new RangeError(`invariant: ${spec.id}: tolerance must lie in (0, 1), got ${spec.tolerance}`);
    if (!(spec.alpha > 0 && spec.alpha < 1))
        throw new RangeError(`invariant: ${spec.id}: alpha must lie in (0, 1), got ${spec.alpha}`);
    const c = invariantCeiling(spec);
    if (!(c > spec.tolerance && c <= 1))
        throw new RangeError(`invariant: ${spec.id}: ceiling must lie in (tolerance, 1], got ${spec.ceiling}`);
}
function invariantCeiling(spec) { return spec.ceiling ?? Math.min(1, 10 * spec.tolerance); }
function initInvariant(spec) {
    checkInvariantSpec(spec);
    return { bet: (0, _paired_bet_1.initPairedBet)(), used: 0, skipped: 0, missing: 0, fired: false, firedAt: null };
}
/** One tick. total = 0 is a skip (nothing routed); a non-finite count is missing (counted, not
 *  scored — the ½-penalty question of ADR 0036 does not arise, since an invariant has no proceed
 *  side to protect). Counts need not be integers: CloudWatch sums are. A negative discrepancy
 *  (more accounted than routed, in-flight from the previous window) clamps to 0; above the ceiling clamps to it. */
function stepInvariant(spec, state, obs) {
    const threshold = 1 / spec.alpha;
    if (state.fired)
        return { state, x: null, wealth: (0, _paired_bet_1.pairedBetWealth)(state.bet), threshold, fire: true };
    if (!Number.isFinite(obs.total) || !Number.isFinite(obs.accounted)) {
        return { state: { ...state, missing: state.missing + 1 }, x: null, wealth: (0, _paired_bet_1.pairedBetWealth)(state.bet), threshold, fire: false };
    }
    if (obs.total <= 0)
        return { state: { ...state, skipped: state.skipped + 1 }, x: null, wealth: (0, _paired_bet_1.pairedBetWealth)(state.bet), threshold, fire: false };
    const hi = invariantCeiling(spec);
    const x = Math.min(hi, Math.max(0, (obs.total - obs.accounted) / obs.total));
    const bet = (0, _paired_bet_1.updatePairedBet)(state.bet, { lo: 0, hi, nullMean: spec.tolerance }, x);
    const wealth = (0, _paired_bet_1.pairedBetWealth)(bet);
    const used = state.used + 1;
    const fire = wealth >= threshold;
    return { state: { bet, used, skipped: state.skipped, missing: state.missing, fired: fire, firedAt: fire ? used : null }, x, wealth, threshold, fire };
}
//# sourceMappingURL=invariant.js.map