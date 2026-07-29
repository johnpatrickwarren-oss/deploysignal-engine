/** log(Number.MAX_VALUE) ≈ 709.7827 — the saturation point of the view. */
export declare const LOG_MAX_WEALTH: number;
/** Materialize the linear-domain view of a log-wealth. Never Infinity. */
export declare function wealthView(log_M: number): number;
/** Heal a state deserialized from a snapshot persisted before `log_M` existed
 *  (the `last_x_centered` precedent): adopt log(M) when M is finite-positive;
 *  a defective persisted M = Infinity heals to the saturation point instead of
 *  poisoning subsequent ticks; nonpositive M (impossible under the floors, but
 *  defensive) heals to the caller's floor. */
export declare function healLogWealth(log_M: number | undefined, M: number, logFloor: number): number;
//# sourceMappingURL=_wealth.d.ts.map