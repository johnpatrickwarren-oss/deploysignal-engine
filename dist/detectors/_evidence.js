"use strict";
// engine/detectors/_evidence.ts — ADR 0027: build the optional `evidence` surface from what a
// wealth detector already knows. Pure; never touches state. See
// types/verdict-extensions/evidence-surface.ts for the semantics and the validity boundary.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEvidence = buildEvidence;
exports.advanceLogPeak = advanceLogPeak;
exports.logMeanExp = logMeanExp;
function buildEvidence(a) {
    const hasThreshold = a.threshold !== null && Number.isFinite(a.threshold) && a.threshold > 0;
    const log_threshold = hasThreshold ? Math.log(a.threshold) : null;
    return {
        log_wealth: a.log_wealth,
        log_increment: a.log_increment,
        bet: a.bet,
        n: a.n,
        log_threshold,
        threshold_kind: hasThreshold ? a.threshold_kind : null,
        nats_to_threshold: log_threshold === null ? null : log_threshold - a.log_wealth,
        growth_rate_hat: a.n > 0 ? a.log_wealth / a.n : null,
        log_peak_wealth: a.log_peak_wealth,
        anytime_p: Math.min(1, Math.exp(-a.log_peak_wealth)),
        ...(a.confidence_sequence ? { confidence_sequence: a.confidence_sequence } : {}),
    };
}
/** Running-max bookkeeping: the new peak given the previous (possibly absent) peak and the
 *  current log-wealth. Absence heals to the current value. */
function advanceLogPeak(prevPeak, logM) {
    if (prevPeak == null || !Number.isFinite(prevPeak))
        return logM;
    return logM > prevPeak ? logM : prevPeak;
}
/** log of the arithmetic mean of exp(x_i): logSumExp with max-shift for numerical stability, minus
 *  log K. The Vovk–Wang 2021 §4 uniform-average combiner in log space; fleet/combine.ts's
 *  combineAverage and detectors/group-average-e-value.ts both reduce through this one function
 *  (ADR 0033 moved the arithmetic here so the detector layer no longer imports from fleet/).
 *  Throws on empty input. */
function logMeanExp(xs) {
    if (xs.length === 0)
        throw new Error('logMeanExp: empty input array');
    let max_x = -Infinity;
    for (const x of xs)
        if (x > max_x)
            max_x = x;
    let sum_exp = 0;
    for (const x of xs)
        sum_exp += Math.exp(x - max_x);
    const log_sum_exp = max_x + Math.log(sum_exp);
    return log_sum_exp - Math.log(xs.length);
}
//# sourceMappingURL=_evidence.js.map