// detectors/peer-rank.ts — ADR 0039: the rank-among-peers kind. A unit against N − 1 peers observed on
// the same signal at the same tick. Under exchangeability of the unit with its peers, for each peer j
// P(unit worse than j) = ½, and with a margin P(worse by more than the margin) ≤ ½ (the ADR 0037
// argument). x_t = (peers the unit is worse than, beyond the margin) / (finite peers) ∈ [0, 1];
// rollback null mean ½, proceed null ½ + τ; two paired bets as the twin's sign kind. N = 2 is the
// sign kind score for score. No missingness penalty: nothing here is a two-arm split whose
// missingness could depend on the outcome of one arm; a tick without a finite unit value or
// without a finite peer is counted and not scored.

import { initPairedBet, updatePairedBet, pairedBetWealth, type PairedBetState } from './_paired-bet';

export interface PeerRankSpec {
  id: string;
  worse: 'higher' | 'lower';
  /** Proceed-side excess probability τ ∈ (0, ½) that the unit's tick is worse (as the sign kind). */
  tolerance: number;
  /** ADR 0037's band, applied per peer: worse 'higher' → unit > peer · (1 + relative) + absolute. */
  margin?: { relative?: number; absolute?: number };
  alpha: number;
}

export interface PeerRankObservation { unit: number; peers: readonly number[] }

export interface PeerRankState { rollback: PairedBetState; proceed: PairedBetState; used: number; skipped: number; missing: number; fired: boolean; firedAt: number | null }

export interface PeerRankStep { state: PeerRankState; x: number | null; peersScored: number; rollbackE: number; proceedE: number; threshold: number; fire: boolean; proceed: boolean }

export function checkPeerRankSpec(spec: PeerRankSpec): void {
  if (!(typeof spec.id === 'string' && spec.id.length > 0)) throw new RangeError('peer-rank: id required');
  if (spec.worse !== 'higher' && spec.worse !== 'lower') throw new RangeError(`peer-rank: ${spec.id}: worse must be 'higher' or 'lower'`);
  if (!(spec.tolerance > 0 && spec.tolerance < 0.5)) throw new RangeError(`peer-rank: ${spec.id}: tolerance is an excess probability in (0, 0.5), got ${spec.tolerance}`);
  if (!(spec.alpha > 0 && spec.alpha < 1)) throw new RangeError(`peer-rank: ${spec.id}: alpha must lie in (0, 1), got ${spec.alpha}`);
  if (spec.margin !== undefined) {
    const { relative, absolute } = spec.margin;
    if (relative === undefined && absolute === undefined) throw new RangeError(`peer-rank: ${spec.id}: margin needs relative or absolute`);
    if (relative !== undefined && !(Number.isFinite(relative) && relative >= 0)) throw new RangeError(`peer-rank: ${spec.id}: margin.relative must be a finite number >= 0`);
    if (absolute !== undefined && !(Number.isFinite(absolute) && absolute >= 0)) throw new RangeError(`peer-rank: ${spec.id}: margin.absolute must be a finite number >= 0`);
  }
}

export function initPeerRank(spec: PeerRankSpec): PeerRankState {
  checkPeerRankSpec(spec);
  return { rollback: initPairedBet(), proceed: initPairedBet(), used: 0, skipped: 0, missing: 0, fired: false, firedAt: null };
}

/** Is the unit worse than one peer, beyond the band? Exported for the N = 2 reproduction check. */
export function worseThanPeer(spec: PeerRankSpec, unit: number, peer: number): boolean {
  const rel = spec.margin?.relative ?? 0, abs = spec.margin?.absolute ?? 0;
  if (spec.margin === undefined) return spec.worse === 'higher' ? unit > peer : unit < peer;
  return spec.worse === 'higher' ? unit > peer * (1 + rel) + abs : unit < peer * (1 - rel) - abs;
}

/** The per-tick score, or null when it cannot be scored (non-finite unit, no finite peer). Without a
 *  margin an exact tie with a peer counts half (the sign kind's 'tie' is a skipped tick at N = 2;
 *  at N > 2 a tie with one peer of many is a half-comparison, which keeps E[x] = ½ under exchange). */
export function peerRankScore(spec: PeerRankSpec, obs: PeerRankObservation): { x: number; peersScored: number } | null {
  if (!Number.isFinite(obs.unit)) return null;
  let worse = 0, n = 0;
  for (const p of obs.peers) {
    if (!Number.isFinite(p)) continue;
    n++;
    if (worseThanPeer(spec, obs.unit, p)) worse += 1;
    else if (spec.margin === undefined && obs.unit === p) worse += 0.5;
  }
  if (n === 0) return null;
  return { x: worse / n, peersScored: n };
}

export function stepPeerRank(spec: PeerRankSpec, state: PeerRankState, obs: PeerRankObservation): PeerRankStep {
  const threshold = 1 / spec.alpha;
  const ev = (st: PeerRankState) => ({ rollbackE: pairedBetWealth(st.rollback), proceedE: pairedBetWealth(st.proceed) });
  if (state.fired) return { state, x: null, peersScored: 0, ...ev(state), threshold, fire: true, proceed: false };
  if (!Number.isFinite(obs.unit)) return { state: { ...state, missing: state.missing + 1 }, x: null, peersScored: 0, ...ev(state), threshold, fire: false, proceed: false };
  const s = peerRankScore(spec, obs);
  if (s === null) return { state: { ...state, skipped: state.skipped + 1 }, x: null, peersScored: 0, ...ev(state), threshold, fire: false, proceed: false };
  const rollback = updatePairedBet(state.rollback, { lo: 0, hi: 1, nullMean: 0.5 }, s.x);
  const proceed = updatePairedBet(state.proceed, { lo: 0, hi: 1, nullMean: 1 - (0.5 + spec.tolerance) }, 1 - s.x);
  const used = state.used + 1;
  const rollbackE = pairedBetWealth(rollback), proceedE = pairedBetWealth(proceed);
  const fire = rollbackE >= threshold;
  const next: PeerRankState = { rollback, proceed, used, skipped: state.skipped, missing: state.missing, fired: fire, firedAt: fire ? used : null };
  return { state: next, x: s.x, peersScored: s.peersScored, rollbackE, proceedE, threshold, fire, proceed: !fire && proceedE >= threshold };
}
