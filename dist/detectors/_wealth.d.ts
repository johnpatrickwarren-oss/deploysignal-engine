/** log(Number.MAX_VALUE) ≈ 709.7827 — the saturation point of the view. */
export declare const LOG_MAX_WEALTH: number;
/** Materialize the linear-domain view of a log-wealth. Never Infinity. */
export declare function wealthView(log_M: number): number;
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
export declare function advanceLogWealth(log_M: number, increment: number, logFloor: number): number;
/** Heal a state's log-wealth on read. Covers (cold-eye 0026 finding 2):
 *  - a snapshot persisted before `log_M` existed (field absent) — adopt
 *    log(M), the `last_x_centered` precedent;
 *  - a defect-era snapshot whose `M` was Infinity — heal to the saturation
 *    point instead of poisoning subsequent ticks;
 *  - a JSON round-trip of a non-finite `log_M` (serializes to null) — null
 *    must NOT be treated as a number (null + z coerces to z, silently
 *    resetting wealth to 1); non-finite log_M itself is pinned to the
 *    matching bound. */
export declare function healLogWealth(log_M: number | null | undefined, M: number, logFloor: number): number;
//# sourceMappingURL=_wealth.d.ts.map