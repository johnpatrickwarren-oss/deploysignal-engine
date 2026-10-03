// detectors/invariant.ts — ADR 0038 §2: an e-process on an identity. Under health, requests routed
// equal responses accounted for up to in-flight requests crossing the window boundary; the
// unaccounted fraction x_t = (total − accounted) / total ∈ [0, 1] then has a small mean set by the
// measurement, not by the service's history. H0: E[x_t | past] ≤ tolerance. The paired bet
// (_paired-bet.ts) gives a test supermartingale under H0; it fires at wealth ≥ 1/α (Ville).
// No proceed side: an invariant is a veto. No history is read.

import { initPairedBet, updatePairedBet, pairedBetWealth, type PairedBetState } from './_paired-bet';

export interface InvariantSpec {
  id: string;
  /** Declared ceiling on the mean unaccounted fraction under health, in (0, 1): the measurement's
   *  own boundary noise (for a one-minute ALB window, in-flight requests over requests per minute). */
  tolerance: number;
  alpha: number;
  /** Upper clamp on the scored fraction, in (tolerance, 1]; default min(1, 10 · tolerance). Clamping
   *  x down to it keeps H0 (E[min(x, c)] ≤ E[x] ≤ tolerance) and sets the bet's range: at hi = 1 the
   *  GRAPA shrinkage pseudo-observation (((hi − lo)/4)² = 1/16) swamps fractions of order 1e-3 and the
   *  bet has no power inside a bake (found at the first test, 0 of 200 at 2.5× the tolerance). */
  ceiling?: number;
}

export interface InvariantObservation { total: number; accounted: number }

export interface InvariantState { bet: PairedBetState; used: number; skipped: number; missing: number; fired: boolean; firedAt: number | null }

export interface InvariantStep { state: InvariantState; x: number | null; wealth: number; threshold: number; fire: boolean }

export function checkInvariantSpec(spec: InvariantSpec): void {
  if (!(typeof spec.id === 'string' && spec.id.length > 0)) throw new RangeError('invariant: id required');
  if (!(spec.tolerance > 0 && spec.tolerance < 1)) throw new RangeError(`invariant: ${spec.id}: tolerance must lie in (0, 1), got ${spec.tolerance}`);
  if (!(spec.alpha > 0 && spec.alpha < 1)) throw new RangeError(`invariant: ${spec.id}: alpha must lie in (0, 1), got ${spec.alpha}`);
  const c = invariantCeiling(spec);
  if (!(c > spec.tolerance && c <= 1)) throw new RangeError(`invariant: ${spec.id}: ceiling must lie in (tolerance, 1], got ${spec.ceiling}`);
}

export function invariantCeiling(spec: InvariantSpec): number { return spec.ceiling ?? Math.min(1, 10 * spec.tolerance); }

export function initInvariant(spec: InvariantSpec): InvariantState {
  checkInvariantSpec(spec);
  return { bet: initPairedBet(), used: 0, skipped: 0, missing: 0, fired: false, firedAt: null };
}

/** One tick. total = 0 is a skip (nothing routed); a non-finite count is missing (counted, not
 *  scored — the ½-penalty question of ADR 0036 does not arise, since an invariant has no proceed
 *  side to protect). Counts need not be integers: CloudWatch sums are. A negative discrepancy
 *  (more accounted than routed, in-flight from the previous window) clamps to 0; above the ceiling clamps to it. */
export function stepInvariant(spec: InvariantSpec, state: InvariantState, obs: InvariantObservation): InvariantStep {
  const threshold = 1 / spec.alpha;
  if (state.fired) return { state, x: null, wealth: pairedBetWealth(state.bet), threshold, fire: true };
  if (!Number.isFinite(obs.total) || !Number.isFinite(obs.accounted)) {
    return { state: { ...state, missing: state.missing + 1 }, x: null, wealth: pairedBetWealth(state.bet), threshold, fire: false };
  }
  if (obs.total <= 0) return { state: { ...state, skipped: state.skipped + 1 }, x: null, wealth: pairedBetWealth(state.bet), threshold, fire: false };
  const hi = invariantCeiling(spec);
  const x = Math.min(hi, Math.max(0, (obs.total - obs.accounted) / obs.total));
  const bet = updatePairedBet(state.bet, { lo: 0, hi, nullMean: spec.tolerance }, x);
  const wealth = pairedBetWealth(bet);
  const used = state.used + 1;
  const fire = wealth >= threshold;
  return { state: { bet, used, skipped: state.skipped, missing: state.missing, fired: fire, firedAt: fire ? used : null }, x, wealth, threshold, fire };
}
