"use strict";
// per-shard/baseline-lifecycle.ts — baseline MAINTENANCE: the epoch-level drift-trigger that decides
// WHEN a baseline is stale and must be re-recorded.
//
// Promoted per ADR 0004 Tier 1 (engine/consumer charter — "deciding when a baseline is stale and must
// be re-recorded is domain-agnostic baseline management and belongs in the engine"); validated in
// Tessera as tools/lifecycle-monitor.ts (Tessera ADR 0011, cold-eyed).
//
// THE KEY FINDING (why this is alarm-RATE, not per-fire run-length). A per-fire drift-vs-fault
// discriminator does NOT work: once a slow drift is established, benign drift and a sharp fault both
// fire with the SAME run-length (~9 — Tessera ADR 0011). Persistence alone is not the signal. The
// working signal is EPOCH-level: a SUSTAINED high alarm RATE means the baseline is stale → re-record;
// an OCCASIONAL alarm is a fault → keep alarming. This is the static-vs-adaptive needle: it beats a
// STATIC baseline (which lets drift pile up false alarms) and a trailing-ADAPTIVE baseline (which MASKS
// slow faults — the ADR 0006 tradeoff) for DISCRETE cross-epoch drift.
//
// THE CHARTER SPLIT (engine = WHEN, consumer = WHAT/HOW). This module is JUST the decision machine: it
// consumes a stream of `fired` booleans (the consumer decides what an alarm IS — an e-value crossing,
// a CUSUM fire, …) and emits `reRecord` when the trailing alarm rate says the baseline is stale. The
// consumer supplies the alarms and does the actual re-record operationally (re-pull data, shadow a
// candidate baseline, cut over). The engine supplies only the timing.
//
// HONEST CAVEAT (the re-record/masking tradeoff). Re-recording trades detection LATENCY for FP
// suppression (the ADR 0006 masking tradeoff): a more sensitive rate trigger suppresses sooner and
// masks more. The trigger is epoch-level, so a single SHARP fault is caught by the e-value's first
// alarm (which precedes the rate trigger), not by the lifecycle. Under CONTINUOUS within-epoch change
// (random-walk workload, not discrete drift) the lifecycle degenerates toward adaptive (re-recording
// constantly) and would then mask — that residual is the FLEET's job (the common-mode + valid e-value,
// ADR 0004 PRs A/B), not a richer single-shard scheme.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COOLDOWN = exports.DEFAULT_RATE_THRESHOLD = exports.DEFAULT_RATE_WINDOW = void 0;
exports.freshBaselineLifecycle = freshBaselineLifecycle;
exports.updateBaselineLifecycle = updateBaselineLifecycle;
/** Default trailing window (ticks) over which alarms are counted (Tessera ADR 0011 RATE_WINDOW). */
exports.DEFAULT_RATE_WINDOW = 150;
/** Default alarm count within the window that marks the baseline stale (Tessera RATE_THRESH). */
exports.DEFAULT_RATE_THRESHOLD = 4;
/** Default ticks to suppress re-triggering after a re-record (Tessera COOLDOWN). */
exports.DEFAULT_COOLDOWN = 150;
/** Fresh lifecycle state. `window`/`rateThreshold`/`cooldown` default to the Tessera ADR 0011 values.
 *  @throws RangeError on a non-integer/out-of-range option. */
function freshBaselineLifecycle(opts) {
    const window = opts?.window ?? exports.DEFAULT_RATE_WINDOW;
    const rateThreshold = opts?.rateThreshold ?? exports.DEFAULT_RATE_THRESHOLD;
    const cooldown = opts?.cooldown ?? exports.DEFAULT_COOLDOWN;
    if (!(Number.isInteger(window) && window >= 1)) {
        throw new RangeError(`freshBaselineLifecycle: window must be an integer >= 1; got ${window}`);
    }
    if (!(Number.isInteger(rateThreshold) && rateThreshold >= 1)) {
        throw new RangeError(`freshBaselineLifecycle: rateThreshold must be an integer >= 1; got ${rateThreshold}`);
    }
    if (!(Number.isInteger(cooldown) && cooldown >= 0)) {
        throw new RangeError(`freshBaselineLifecycle: cooldown must be an integer >= 0; got ${cooldown}`);
    }
    return { window, rateThreshold, cooldown, tick: 0, alarmTicks: [], cooldownUntil: 0, epoch: 0, reRecords: 0 };
}
/** Advance the lifecycle by one tick. Pass `fired = true` iff the consumer's detector alarmed on this
 *  tick. Returns `{ reRecord }` — true when the trailing alarm rate (≥ `rateThreshold` alarms within the
 *  last `window` ticks, and past the post-re-record cooldown) marks the baseline stale.
 *
 *  On a re-record the alarm window RESETS (a fresh epoch starts): behaviorally IDENTICAL to the Tessera
 *  reference (which never clears, relying on cooldown) whenever `cooldown ≥ window` — including the
 *  default 150/150 — and strictly safer for `cooldown < window`, where clearing prevents a re-record
 *  storm while the stale-epoch alarms age out (verified by fuzzing: 0 mismatches at cooldown ≥ window;
 *  never more re-records than the reference below it). Mutates `state` in place. */
function updateBaselineLifecycle(state, fired) {
    const i = state.tick;
    let reRecord = false;
    if (fired) {
        state.alarmTicks.push(i);
        // Evict alarms older than the trailing window (keep those with tick > i − window).
        const cutoff = i - state.window;
        let drop = 0;
        while (drop < state.alarmTicks.length && state.alarmTicks[drop] <= cutoff)
            drop++;
        if (drop > 0)
            state.alarmTicks.splice(0, drop);
        if (i >= state.cooldownUntil && state.alarmTicks.length >= state.rateThreshold) {
            reRecord = true;
            state.epoch += 1;
            state.reRecords += 1;
            state.cooldownUntil = i + state.cooldown;
            state.alarmTicks.length = 0; // fresh epoch: reset the alarm-rate window
        }
    }
    state.tick = i + 1;
    return { reRecord, recentAlarms: state.alarmTicks.length };
}
//# sourceMappingURL=baseline-lifecycle.js.map