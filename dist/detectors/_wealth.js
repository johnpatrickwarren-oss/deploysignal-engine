"use strict";
// engine/detectors/_wealth.ts — ADR 0026: log-domain wealth helpers shared by
// the multiplicative e-process detectors (safe-Hotelling, betting, spectral).
//
// Log-wealth (`log_M`) is the single source of truth; the linear `M` field on
// each state is a materialized SATURATING VIEW of it. Saturation at
// Number.MAX_VALUE (not Infinity) keeps the audit surface JSON-safe and fire
// semantics intact (MAX_VALUE ≥ every real threshold), and removes the
// absorbing-state defect of linear accumulation (Infinity · exp(negative)
// stays Infinity; log books keep counting and the view comes back down).
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_MAX_WEALTH = void 0;
exports.wealthView = wealthView;
exports.advanceLogWealth = advanceLogWealth;
exports.healLogWealth = healLogWealth;
/** log(Number.MAX_VALUE) ≈ 709.7827 — the saturation point of the view. */
exports.LOG_MAX_WEALTH = Math.log(Number.MAX_VALUE);
/** Materialize the linear-domain view of a log-wealth. Never Infinity. */
function wealthView(log_M) {
    return log_M >= exports.LOG_MAX_WEALTH ? Number.MAX_VALUE : Math.exp(log_M);
}
/** Advance a log-wealth by one log-increment, keeping the books permanently
 *  finite (cold-eye 0026 finding 1 — the NaN pathway was still an
 *  audit-null):
 *  - NaN increment (a NaN observation, or ∞−∞ inside a quadratic form)
 *    carries no evidence — the wealth HOLDS at its last good value instead
 *    of absorbing to NaN → JSON null.
 *  - +Infinity increment (a literally infinite observation) pins the books
 *    at the saturation point: the view fires exactly as the pre-0026 linear
 *    code did (M = ∞ ≥ threshold), but stays JSON-safe and NON-absorbing —
 *    later negative evidence brings it back down.
 *  - Otherwise the caller's floor applies, exactly as the linear
 *    `max(floor, M·factor)` did (−Infinity from log(0) lands here too). */
function advanceLogWealth(log_M, increment, logFloor) {
    const next = log_M + increment;
    if (Number.isNaN(next))
        return log_M;
    if (next === Infinity)
        return exports.LOG_MAX_WEALTH;
    return Math.max(logFloor, next);
}
/** Heal a state's log-wealth on read. Covers (cold-eye 0026 finding 2):
 *  - a snapshot persisted before `log_M` existed (field absent) — adopt
 *    log(M), the `last_x_centered` precedent;
 *  - a defect-era snapshot whose `M` was Infinity — heal to the saturation
 *    point instead of poisoning subsequent ticks;
 *  - a JSON round-trip of a non-finite `log_M` (serializes to null) — null
 *    must NOT be treated as a number (null + z coerces to z, silently
 *    resetting wealth to 1); non-finite log_M itself is pinned to the
 *    matching bound. */
function healLogWealth(log_M, M, logFloor) {
    if (log_M != null && Number.isFinite(log_M))
        return log_M;
    if (log_M === Infinity)
        return exports.LOG_MAX_WEALTH;
    if (log_M === -Infinity)
        return logFloor;
    // absent, JSON-null, or NaN: derive from the linear view.
    if (!(M > 0))
        return logFloor;
    return Number.isFinite(M) ? Math.log(M) : exports.LOG_MAX_WEALTH;
}
//# sourceMappingURL=_wealth.js.map