"use strict";
// per-shard/twin-gate.ts — ADR 0036: one deploy's canary-vs-control decision across N metrics.
//
// Error statement, each under its own null and each by Ville on the paired-bet wealths:
//   P(rollback | every metric no worse)                 ≤ alphaRollback  (N/α per metric: Bonferroni,
//                                                                          valid under any dependence)
//   P(proceed  | some metric worse by ≥ its tolerance)  ≤ alphaProceed   (proceed needs EVERY metric's
//                                                                          wealth over 1/α: intersection–
//                                                                          union, no split)
//   P(invalid_experiment | routing at canaryWeight)     ≤ alphaSrm       (two-sided sample-ratio guard:
//                                                                          the mean of two one-sided
//                                                                          wealths is a supermartingale)
// The guard is checked first: a canary that stops receiving traffic reads as invalid_experiment, and
// the consumer must treat that as halt-and-shift-back, not as a pass. Terminal verdicts are sticky.
//
// Premises the three bounds above rest on:
//   (i)   the SRM guard needs only randomized per-request routing (routing independent of outcome).
//         Every metric's ROLLBACK test needs more: no arm-level effect on any tick either. Persistent
//         arm-specific state breaks it at any split; a per-tick arm-level shock (pod-level noise: iid
//         across ticks, zero-mean, symmetric between arms) cancels at canaryWeight 0.5 but not at
//         unequal weights (see detectors/twin-contrast.ts TWIN_RATE_ENVELOPE).
//   (ii)  a `rate` metric's PROCEED test needs one more premise, one bad-event probability per arm
//         per tick (see detectors/twin-contrast.ts TWIN_RATE_ENVELOPE); heterogeneous per-request
//         probabilities within an arm can make it anticonservative (a false clear). Rollback and the
//         SRM guard do not need it.
//   (iii) a missing observation (input.observations[m.id] === undefined while the canary is taking
//         traffic) is handled by `missTwinMetric`'s ½ wealth penalty on both sides, which dominates
//         whatever factor the true value would have produced under ANY missingness mechanism — so
//         no missing-at-random premise is needed, even outcome-dependent missingness is covered.
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTwinGateConfig = checkTwinGateConfig;
exports.initTwinGate = initTwinGate;
exports.stepTwinGate = stepTwinGate;
const _paired_bet_1 = require("../detectors/_paired-bet");
const twin_contrast_1 = require("../detectors/twin-contrast");
function inUnit(x) { return x > 0 && x < 1; }
function checkTwinGateConfig(cfg) {
    if (cfg.metrics.length === 0)
        throw new RangeError('twin-gate: at least one metric is required');
    const ids = new Set();
    for (const m of cfg.metrics) {
        if (ids.has(m.id))
            throw new RangeError(`twin-gate: duplicate metric id '${m.id}'`);
        ids.add(m.id);
        (0, twin_contrast_1.checkTwinMetricSpec)(m);
    }
    if (![cfg.alphaRollback, cfg.alphaProceed, cfg.alphaSrm, cfg.canaryWeight].every(inUnit)) {
        throw new RangeError('twin-gate: alphas and canaryWeight must lie in (0, 1)');
    }
    if (!(Number.isInteger(cfg.maxTicks) && cfg.maxTicks >= 1)) {
        throw new RangeError(`twin-gate: maxTicks must be a positive integer, got ${cfg.maxTicks}`);
    }
    if (cfg.metrics.some((m) => m.kind !== 'rate') && cfg.canaryWeight !== 0.5) {
        throw new RangeError('twin-gate: a sign metric needs equal routing weights (canaryWeight 0.5): its null is the '
            + `exchangeability of two equal-sized arms (ADR 0036). Got canaryWeight ${cfg.canaryWeight}.`);
    }
}
function initTwinGate(cfg) {
    checkTwinGateConfig(cfg);
    const metrics = {};
    for (const m of cfg.metrics)
        metrics[m.id] = (0, twin_contrast_1.initTwinMetric)();
    return { tick: 0, terminal: null, metrics, srmUp: (0, _paired_bet_1.initPairedBet)(), srmDown: (0, _paired_bet_1.initPairedBet)() };
}
function srmE(state) {
    return ((0, _paired_bet_1.pairedBetWealth)(state.srmUp) + (0, _paired_bet_1.pairedBetWealth)(state.srmDown)) / 2;
}
function report(cfg, state, verdict) {
    const n = cfg.metrics.length;
    return {
        verdict,
        tick: state.tick,
        srmE: srmE(state),
        srmThreshold: 1 / cfg.alphaSrm,
        metrics: cfg.metrics.map((m) => {
            const ev = (0, twin_contrast_1.twinMetricEvidence)(state.metrics[m.id]);
            return {
                id: m.id,
                rollbackE: ev.rollbackE,
                rollbackThreshold: n / cfg.alphaRollback,
                proceedE: ev.proceedE,
                proceedThreshold: 1 / cfg.alphaProceed,
                used: ev.used,
                skipped: ev.skipped,
                ties: ev.ties,
                missing: ev.missing,
            };
        }),
    };
}
function decide(cfg, state) {
    if (srmE(state) >= 1 / cfg.alphaSrm)
        return 'invalid_experiment';
    const n = cfg.metrics.length;
    const ev = cfg.metrics.map((m) => (0, twin_contrast_1.twinMetricEvidence)(state.metrics[m.id]));
    if (ev.some((e) => e.rollbackE >= n / cfg.alphaRollback))
        return 'rollback';
    if (ev.every((e) => e.proceedE >= 1 / cfg.alphaProceed))
        return 'proceed';
    if (state.tick >= cfg.maxTicks)
        return 'inconclusive';
    return 'extend';
}
function stepTwinGate(cfg, state, input) {
    if (state.terminal !== null)
        return { state, decision: report(cfg, state, state.terminal) };
    const { canaryRequests: c, controlRequests: k } = input;
    if (!(Number.isFinite(c) && Number.isFinite(k) && c >= 0 && k >= 0)) {
        throw new RangeError(`twin-gate: request counts must be finite and non-negative, got ${c}, ${k}`);
    }
    let { srmUp, srmDown } = state;
    if (c + k > 0) {
        const share = c / (c + k);
        srmUp = (0, _paired_bet_1.updatePairedBet)(srmUp, { lo: 0, hi: 1, nullMean: cfg.canaryWeight }, share);
        srmDown = (0, _paired_bet_1.updatePairedBet)(srmDown, { lo: 0, hi: 1, nullMean: 1 - cfg.canaryWeight }, 1 - share);
    }
    const metrics = { ...state.metrics };
    for (const m of cfg.metrics) {
        const obs = input.observations[m.id];
        metrics[m.id] = obs !== undefined ? (0, twin_contrast_1.updateTwinMetric)(m, metrics[m.id], obs)
            : c > 0 ? (0, twin_contrast_1.missTwinMetric)(metrics[m.id])
                : (0, twin_contrast_1.skipTwinMetric)(metrics[m.id]);
    }
    const next = { tick: state.tick + 1, terminal: null, metrics, srmUp, srmDown };
    const verdict = decide(cfg, next);
    const settled = { ...next, terminal: verdict === 'extend' ? null : verdict };
    return { state: settled, decision: report(cfg, settled, verdict) };
}
//# sourceMappingURL=twin-gate.js.map