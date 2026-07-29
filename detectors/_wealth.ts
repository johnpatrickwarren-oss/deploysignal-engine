// engine/detectors/_wealth.ts — ADR 0026: log-domain wealth helpers shared by
// the multiplicative e-process detectors (safe-Hotelling, betting, spectral).
//
// Log-wealth (`log_M`) is the single source of truth; the linear `M` field on
// each state is a materialized SATURATING VIEW of it. Saturation at
// Number.MAX_VALUE (not Infinity) keeps the audit surface JSON-safe and fire
// semantics intact (MAX_VALUE ≥ every real threshold), and removes the
// absorbing-state defect of linear accumulation (Infinity · exp(negative)
// stays Infinity; log books keep counting and the view comes back down).

/** log(Number.MAX_VALUE) ≈ 709.7827 — the saturation point of the view. */
export const LOG_MAX_WEALTH = Math.log(Number.MAX_VALUE);

/** Materialize the linear-domain view of a log-wealth. Never Infinity. */
export function wealthView(log_M: number): number {
  return log_M >= LOG_MAX_WEALTH ? Number.MAX_VALUE : Math.exp(log_M);
}

/** Heal a state deserialized from a snapshot persisted before `log_M` existed
 *  (the `last_x_centered` precedent): adopt log(M) when M is finite-positive;
 *  a defective persisted M = Infinity heals to the saturation point instead of
 *  poisoning subsequent ticks; nonpositive M (impossible under the floors, but
 *  defensive) heals to the caller's floor. */
export function healLogWealth(log_M: number | undefined, M: number, logFloor: number): number {
  if (log_M !== undefined) return log_M;
  if (!(M > 0)) return logFloor;
  return Number.isFinite(M) ? Math.log(M) : LOG_MAX_WEALTH;
}
