"use strict";
// detectors/twin-contrast.ts — ADR 0036: canary vs a concurrent control arm, reduced to a bounded
// mean whose null value is observed or fixed.
//
// Every kind produces, per tick, a canary-worse score X ∈ [0, 1] and two null means:
//   rollback H0  E[X | past] ≤ rollbackNull   (the canary is no worse)
//   proceed  H0  E[X | past] ≥ proceedNull    (the canary is worse by at least the tolerance)
// Each is tested by its own paired-bet wealth (the proceed side on 1 − X against 1 − proceedNull).
//
// rate — bad events b and totals n per arm. X = b_c / (b_c + b_k). Conditional on n_c, n_k and the
//   bad-event total E, b_c is Fisher noncentral hypergeometric in the odds ratio ψ of the arms'
//   per-request bad-event probabilities, and its mean is increasing in ψ. So ψ ≤ 1 gives
//   E[X] ≤ n_c / (n_c + n_k) — the observed traffic share — and ψ ≥ 1 + tolerance gives
//   E[X] ≥ fisherNoncentralMean(n_c, n_k, E, 1 + tolerance) / E. Valid at any routing split.
// sign — one value per arm per tick. X = 1 if the canary's is worse. Exchangeable equal-weight arms
//   give P(X = 1 | no tie) = 1/2; the proceed null is 1/2 + tolerance. Ties carry no evidence.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TWIN_SIGN_ENVELOPE = exports.TWIN_RATE_ENVELOPE = void 0;
exports.checkTwinMetricSpec = checkTwinMetricSpec;
exports.fisherNoncentralMean = fisherNoncentralMean;
exports.twinScore = twinScore;
exports.initTwinMetric = initTwinMetric;
exports.skipTwinMetric = skipTwinMetric;
exports.updateTwinMetric = updateTwinMetric;
exports.twinMetricEvidence = twinMetricEvidence;
const _paired_bet_1 = require("./_paired-bet");
const RATE_MAX_TOLERANCE = 10;
function checkTwinMetricSpec(spec) {
    if (spec.kind === 'rate') {
        if (!(spec.tolerance > 0 && spec.tolerance <= RATE_MAX_TOLERANCE)) {
            throw new RangeError(`twin-contrast: ${spec.id}: a rate tolerance is an excess odds ratio in (0, ${RATE_MAX_TOLERANCE}], got ${spec.tolerance}`);
        }
    }
    else if (!(spec.tolerance > 0 && spec.tolerance < 0.5)) {
        throw new RangeError(`twin-contrast: ${spec.id}: a sign tolerance is an excess probability in (0, 0.5), got ${spec.tolerance}`);
    }
}
/** Mean of Fisher's noncentral hypergeometric: X = canary's count of `total` events over arms of
 *  nc and nk requests, odds ratio psi. Weights by the ratio recurrence, in the log domain. */
function fisherNoncentralMean(nc, nk, total, psi) {
    const lo = Math.max(0, total - nk);
    const hi = Math.min(total, nc);
    const logPsi = Math.log(psi);
    const logW = [0];
    for (let x = lo; x < hi; x++) {
        const prev = logW[logW.length - 1];
        logW.push(prev + Math.log(nc - x) - Math.log(x + 1) + Math.log(total - x) - Math.log(nk - total + x + 1) + logPsi);
    }
    const top = Math.max(...logW);
    let z = 0;
    let m = 0;
    for (let i = 0; i < logW.length; i++) {
        const w = Math.exp(logW[i] - top);
        z += w;
        m += w * (lo + i);
    }
    return m / z;
}
function isRate(obs) {
    return obs.canaryTotal !== undefined;
}
function twinScore(spec, obs) {
    if (spec.kind === 'rate') {
        if (!isRate(obs))
            throw new TypeError(`twin-contrast: ${spec.id}: a rate metric needs a RateObservation`);
        const { canaryEvents, canaryTotal, controlEvents, controlTotal } = obs;
        if (![canaryEvents, canaryTotal, controlEvents, controlTotal].every(Number.isFinite))
            return 'skip';
        if (canaryEvents < 0 || controlEvents < 0 || canaryEvents > canaryTotal || controlEvents > controlTotal) {
            throw new RangeError(`twin-contrast: ${spec.id}: events must lie in [0, total]`);
        }
        if (canaryTotal === 0 || controlTotal === 0)
            return 'skip';
        const bc = spec.worse === 'higher' ? canaryEvents : canaryTotal - canaryEvents;
        const bk = spec.worse === 'higher' ? controlEvents : controlTotal - controlEvents;
        const e = bc + bk;
        if (e === 0)
            return 'skip';
        if (Math.max(0, e - controlTotal) === Math.min(e, canaryTotal))
            return 'skip';
        return {
            x: bc / e,
            rollbackNull: canaryTotal / (canaryTotal + controlTotal),
            proceedNull: fisherNoncentralMean(canaryTotal, controlTotal, e, 1 + spec.tolerance) / e,
        };
    }
    if (isRate(obs))
        throw new TypeError(`twin-contrast: ${spec.id}: a sign metric needs a SignObservation`);
    if (!Number.isFinite(obs.canary) || !Number.isFinite(obs.control))
        return 'skip';
    if (obs.canary === obs.control)
        return 'tie';
    const canaryHigher = obs.canary > obs.control;
    const worse = spec.worse === 'higher' ? canaryHigher : !canaryHigher;
    return { x: worse ? 1 : 0, rollbackNull: 0.5, proceedNull: 0.5 + spec.tolerance };
}
function initTwinMetric() {
    return { rollback: (0, _paired_bet_1.initPairedBet)(), proceed: (0, _paired_bet_1.initPairedBet)(), used: 0, skipped: 0, ties: 0 };
}
function skipTwinMetric(state) {
    return { ...state, skipped: state.skipped + 1 };
}
function updateTwinMetric(spec, state, obs) {
    const s = twinScore(spec, obs);
    if (s === 'skip')
        return skipTwinMetric(state);
    if (s === 'tie')
        return { ...state, ties: state.ties + 1 };
    return {
        rollback: (0, _paired_bet_1.updatePairedBet)(state.rollback, { lo: 0, hi: 1, nullMean: s.rollbackNull }, s.x),
        proceed: (0, _paired_bet_1.updatePairedBet)(state.proceed, { lo: 0, hi: 1, nullMean: 1 - s.proceedNull }, 1 - s.x),
        used: state.used + 1,
        skipped: state.skipped,
        ties: state.ties,
    };
}
function twinMetricEvidence(state) {
    return {
        rollbackE: (0, _paired_bet_1.pairedBetWealth)(state.rollback),
        proceedE: (0, _paired_bet_1.pairedBetWealth)(state.proceed),
        used: state.used,
        skipped: state.skipped,
        ties: state.ties,
    };
}
/** ADR 0036 — rate kind. */
exports.TWIN_RATE_ENVELOPE = Object.freeze({
    baseline: 'randomized-twin',
    autocorrelation: 'shared-cancels',
    null: 'paired-order',
    variance: 'none',
    validUnderEstimatedBaseline: true,
    statistic: 'e-value',
    pairingPremise: 'exchangeable-arms',
    notes: 'Null mean is the observed traffic share (rollback) or the Fisher noncentral mean at the '
        + 'tolerance (proceed), both exact given the tick\'s arm totals and bad-event total. Premise: '
        + 'randomized per-request routing, no arm-specific persistent state under H0. Valid at any split. '
        + 'Study 2026-09-twin-null registered, not run.',
});
/** ADR 0036 — sign kind. */
exports.TWIN_SIGN_ENVELOPE = Object.freeze({
    baseline: 'randomized-twin',
    autocorrelation: 'shared-cancels',
    null: 'paired-order',
    variance: 'none',
    validUnderEstimatedBaseline: true,
    statistic: 'e-value',
    pairingPremise: 'exchangeable-equal-weight-arms',
    notes: 'Null P(canary tick worse | no tie) = 1/2 by exchangeability of equal-weight arms; any '
        + 'scalar tick statistic (a percentile, a gauge, a count). Unequal weights break it for skewed '
        + 'statistics. Study 2026-09-twin-null registered, not run.',
});
//# sourceMappingURL=twin-contrast.js.map