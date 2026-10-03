"use strict";
// detectors/peer-rank.ts — ADR 0039: the rank-among-peers kind; ADR 0040/0041: declared per-peer offsets and margin floors. A unit against N − 1 peers observed on
// the same signal at the same tick. Under exchangeability of the unit with its peers, for each peer j
// P(unit worse than j) = ½, and with a margin P(worse by more than the margin) ≤ ½ (the ADR 0037
// argument). x_t = (peers the unit is worse than, beyond the margin) / (finite peers) ∈ [0, 1];
// rollback null mean ½, proceed null ½ + τ; two paired bets as the twin's sign kind. N = 2 is the
// sign kind score for score. No missingness penalty: nothing here is a two-arm split whose
// missingness could depend on the outcome of one arm; a tick without a finite unit value or
// without a finite peer is counted and not scored.
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPeerRankSpec = checkPeerRankSpec;
exports.initPeerRank = initPeerRank;
exports.worseThanPeer = worseThanPeer;
exports.peerRankScore = peerRankScore;
exports.stepPeerRank = stepPeerRank;
const _paired_bet_1 = require("./_paired-bet");
function checkPeerRankSpec(spec) {
    if (!(typeof spec.id === 'string' && spec.id.length > 0))
        throw new RangeError('peer-rank: id required');
    if (spec.worse !== 'higher' && spec.worse !== 'lower')
        throw new RangeError(`peer-rank: ${spec.id}: worse must be 'higher' or 'lower'`);
    if (!(spec.tolerance > 0 && spec.tolerance < 0.5))
        throw new RangeError(`peer-rank: ${spec.id}: tolerance is an excess probability in (0, 0.5), got ${spec.tolerance}`);
    if (!(spec.alpha > 0 && spec.alpha < 1))
        throw new RangeError(`peer-rank: ${spec.id}: alpha must lie in (0, 1), got ${spec.alpha}`);
    if (spec.margin !== undefined) {
        const { relative, absolute } = spec.margin;
        if (relative === undefined && absolute === undefined)
            throw new RangeError(`peer-rank: ${spec.id}: margin needs relative or absolute`);
        if (relative !== undefined && !(Number.isFinite(relative) && relative >= 0))
            throw new RangeError(`peer-rank: ${spec.id}: margin.relative must be a finite number >= 0`);
        if (absolute !== undefined && !(Number.isFinite(absolute) && absolute >= 0))
            throw new RangeError(`peer-rank: ${spec.id}: margin.absolute must be a finite number >= 0`);
    }
}
function initPeerRank(spec) {
    checkPeerRankSpec(spec);
    return { rollback: (0, _paired_bet_1.initPairedBet)(), proceed: (0, _paired_bet_1.initPairedBet)(), used: 0, skipped: 0, missing: 0, fired: false, firedAt: null };
}
/** Is the unit worse than one peer, beyond the band? `extraRel` (ADR 0041) is a per-peer relative
 *  margin floor; the band uses the larger of it and the spec's relative margin. Exported for the N = 2
 *  reproduction check. */
function worseThanPeer(spec, unit, peer, extraRel = 0) {
    const floor = Number.isFinite(extraRel) && extraRel > 0 ? extraRel : 0;
    if (spec.margin === undefined && floor === 0)
        return spec.worse === 'higher' ? unit > peer : unit < peer;
    const rel = Math.max(spec.margin?.relative ?? 0, floor), abs = spec.margin?.absolute ?? 0;
    return spec.worse === 'higher' ? unit > peer * (1 + rel) + abs : unit < peer * (1 - rel) - abs;
}
/** The per-tick score, or null when it cannot be scored (non-finite unit, no finite peer). Without a
 *  margin an exact tie with a peer counts half (the sign kind's 'tie' is a skipped tick at N = 2;
 *  at N > 2 a tie with one peer of many is a half-comparison, which keeps E[x] = ½ under exchange). */
function peerRankScore(spec, obs) {
    if (!Number.isFinite(obs.unit))
        return null;
    if (obs.offsets !== undefined && obs.offsets.length !== obs.peers.length) {
        throw new RangeError(`peer-rank: ${spec.id}: offsets (${obs.offsets.length}) must match peers (${obs.peers.length})`);
    }
    if (obs.margins !== undefined && obs.margins.length !== obs.peers.length) {
        throw new RangeError(`peer-rank: ${spec.id}: margins (${obs.margins.length}) must match peers (${obs.peers.length})`);
    }
    let worse = 0, n = 0;
    for (let j = 0; j < obs.peers.length; j++) {
        const raw = obs.peers[j];
        const off = obs.offsets?.[j] ?? 0;
        if (!Number.isFinite(raw) || !Number.isFinite(off) || off <= -1)
            continue; // an unusable offset drops the peer for the tick
        const p = raw * (1 + off); // ADR 0040: the peer on the unit's scale
        n++;
        const floor = obs.margins?.[j] ?? 0;
        if (worseThanPeer(spec, obs.unit, p, floor))
            worse += 1;
        else if (spec.margin === undefined && !(floor > 0) && obs.unit === p)
            worse += 0.5;
    }
    if (n === 0)
        return null;
    return { x: worse / n, peersScored: n };
}
function stepPeerRank(spec, state, obs) {
    const threshold = 1 / spec.alpha;
    const ev = (st) => ({ rollbackE: (0, _paired_bet_1.pairedBetWealth)(st.rollback), proceedE: (0, _paired_bet_1.pairedBetWealth)(st.proceed) });
    if (state.fired)
        return { state, x: null, peersScored: 0, ...ev(state), threshold, fire: true, proceed: false };
    if (!Number.isFinite(obs.unit))
        return { state: { ...state, missing: state.missing + 1 }, x: null, peersScored: 0, ...ev(state), threshold, fire: false, proceed: false };
    const s = peerRankScore(spec, obs);
    if (s === null)
        return { state: { ...state, skipped: state.skipped + 1 }, x: null, peersScored: 0, ...ev(state), threshold, fire: false, proceed: false };
    const rollback = (0, _paired_bet_1.updatePairedBet)(state.rollback, { lo: 0, hi: 1, nullMean: 0.5 }, s.x);
    const proceed = (0, _paired_bet_1.updatePairedBet)(state.proceed, { lo: 0, hi: 1, nullMean: 1 - (0.5 + spec.tolerance) }, 1 - s.x);
    const used = state.used + 1;
    const rollbackE = (0, _paired_bet_1.pairedBetWealth)(rollback), proceedE = (0, _paired_bet_1.pairedBetWealth)(proceed);
    const fire = rollbackE >= threshold;
    const next = { rollback, proceed, used, skipped: state.skipped, missing: state.missing, fired: fire, firedAt: fire ? used : null };
    return { state: next, x: s.x, peersScored: s.peersScored, rollbackE, proceedE, threshold, fire, proceed: !fire && proceedE >= threshold };
}
//# sourceMappingURL=peer-rank.js.map