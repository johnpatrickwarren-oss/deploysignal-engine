// detectors/twin-contrast.ts — ADR 0036: canary vs a concurrent control arm, reduced to a bounded
// mean whose null value is observed or fixed.
//
// Every kind produces, per tick, a canary-worse score X ∈ [0, 1] and two null means:
//   rollback H0  E[X | past] ≤ rollbackNull   (the canary is no worse)
//   proceed  H0  E[X | past] ≥ proceedNull    (the canary is worse by at least the tolerance)
// Each is tested by its own paired-bet wealth (the proceed side on 1 − X against 1 − proceedNull).
//
// rate — bad events b and totals n per arm. X = b_c / (b_c + b_k). Conditional on n_c, n_k and the
//   bad-event total E, ψ ≤ 1 (canary odds no worse) gives E[X] ≤ n_c / (n_c + n_k) — the observed
//   traffic share — EXACTLY under randomized per-request routing WITH NO ARM-LEVEL EFFECT on any
//   tick: b_c is then central hypergeometric given n_c, n_k, E even when per-request bad-event
//   probabilities vary within the tick, because routing is independent of outcome. Persistent
//   arm-specific state (a cold canary fleet, a control pinned to a degraded host) breaks this at
//   ANY split. A per-tick arm-level shock (pod-level noise: iid across ticks, zero-mean, symmetric
//   between arms) cancels exactly when the tick's realised arm totals are equal, and to second
//   order at canaryWeight 0.5 (study P2: 0.028 / 0.030 against P1's 0.026) — with per-request
//   randomization the totals differ by O(√N), so the cancellation is second-order, not exact; at
//   unequal weights the shock moves E[X | E] off the traffic share, with a sign that varies with E
//   (measured 0.755 false rollback at w 0.1, σ_arm 0.3). The PROCEED null needs more: ψ ≥
//   1 + tolerance gives E[X] ≥ fisherNoncentralMean(n_c, n_k, E, 1 + tolerance) / E only when each
//   arm's requests share ONE bad-event probability within the tick (b_c is then Fisher noncentral
//   hypergeometric in ψ, whose mean is increasing in ψ); heterogeneous per-request probabilities
//   within an arm can make this anticonservative (a false clear). Rollback does not need this.
// sign — one value per arm per tick. X = 1 if the canary's is worse. Exchangeable equal-weight arms
//   give P(X = 1 | no tie) = 1/2; the proceed null is 1/2 + tolerance. Ties carry no evidence.
//
// A non-finite value (rate: any of the four counts; sign: either arm) is 'missing', distinct from
// a structural 'skip' (empty arm, zero bad events, degenerate support). Skipping a missing tick
// outright would let outcome-dependent missingness (the canary's worst ticks come back NaN) bias
// the wealth toward PROCEED; instead `missTwinMetric` multiplies both wealths by 1/2, the smallest
// factor any attainable bet can produce, so the ½ is dominated by whatever factor the true value
// would have given and both Ville bounds hold under any missingness mechanism.

import type { ValidityEnvelope } from './validity-envelope';
import {
  type PairedBetState,
  initPairedBet, updatePairedBet, pairedBetWealth,
} from './_paired-bet';
import { advanceLogWealth } from './_wealth';

export type TwinMetricKind = 'rate' | 'sign';

export interface TwinMetricSpec {
  /** Free-form metric name; the gate keys observations by it. */
  id: string;
  kind: TwinMetricKind;
  /** Which direction of the metric is a regression. For 'rate', 'lower' means the events are
   *  successes and the bad events are total − events. */
  worse: 'higher' | 'lower';
  /** Smallest regression worth blocking on; sets the PROCEED test only, never rollback.
   *  rate: excess odds ratio ρ in (0, 10] (0.2 = 20% more bad events per request).
   *  sign: excess probability τ in (0, 0.5) that the canary's tick is worse (0.1 = 60% of ticks). */
  tolerance: number;
}

export interface RateObservation { canaryEvents: number; canaryTotal: number; controlEvents: number; controlTotal: number }
export interface SignObservation { canary: number; control: number }
export type TwinObservation = RateObservation | SignObservation;

export interface TwinScore { x: number; rollbackNull: number; proceedNull: number }

export interface TwinMetricState {
  rollback: PairedBetState;
  proceed: PairedBetState;
  used: number;
  skipped: number;
  ties: number;
  missing: number;
}

export interface TwinMetricEvidence { rollbackE: number; proceedE: number; used: number; skipped: number; ties: number; missing: number }

const RATE_MAX_TOLERANCE = 10;

export function checkTwinMetricSpec(spec: TwinMetricSpec): void {
  if (spec.kind !== 'rate' && spec.kind !== 'sign') {
    throw new RangeError(`twin-contrast: ${spec.id}: kind must be 'rate' or 'sign', got '${spec.kind}'`);
  }
  if (spec.worse !== 'higher' && spec.worse !== 'lower') {
    throw new RangeError(`twin-contrast: ${spec.id}: worse must be 'higher' or 'lower', got '${spec.worse}'`);
  }
  if (spec.kind === 'rate') {
    if (!(spec.tolerance > 0 && spec.tolerance <= RATE_MAX_TOLERANCE)) {
      throw new RangeError(`twin-contrast: ${spec.id}: a rate tolerance is an excess odds ratio in (0, ${RATE_MAX_TOLERANCE}], got ${spec.tolerance}`);
    }
  } else if (!(spec.tolerance > 0 && spec.tolerance < 0.5)) {
    throw new RangeError(`twin-contrast: ${spec.id}: a sign tolerance is an excess probability in (0, 0.5), got ${spec.tolerance}`);
  }
}

/** Mean of Fisher's noncentral hypergeometric: X = canary's count of `total` events over arms of
 *  nc and nk requests, odds ratio psi. Weights by the ratio recurrence, in the log domain. The
 *  running maximum is tracked inside the recurrence loop rather than via `Math.max(...logW)`,
 *  which spreads the whole support onto the call stack and overflows it once the support exceeds
 *  the engine's argument-count limit (observed at N ≈ 5e5 requests per tick with E ≈ N/2). */
export function fisherNoncentralMean(nc: number, nk: number, total: number, psi: number): number {
  const lo = Math.max(0, total - nk);
  const hi = Math.min(total, nc);
  const logPsi = Math.log(psi);
  const logW: number[] = [0];
  let top = 0;
  for (let x = lo; x < hi; x++) {
    const prev = logW[logW.length - 1];
    const next = prev + Math.log(nc - x) - Math.log(x + 1) + Math.log(total - x) - Math.log(nk - total + x + 1) + logPsi;
    logW.push(next);
    if (next > top) top = next;
  }
  let z = 0;
  let m = 0;
  for (let i = 0; i < logW.length; i++) {
    const w = Math.exp(logW[i] - top);
    z += w;
    m += w * (lo + i);
  }
  return m / z;
}

function isRate(obs: TwinObservation): obs is RateObservation {
  return (obs as RateObservation).canaryTotal !== undefined;
}

export function twinScore(spec: TwinMetricSpec, obs: TwinObservation): TwinScore | 'skip' | 'tie' | 'missing' {
  if (spec.kind === 'rate') {
    if (!isRate(obs)) throw new TypeError(`twin-contrast: ${spec.id}: a rate metric needs a RateObservation`);
    const { canaryEvents, canaryTotal, controlEvents, controlTotal } = obs;
    if (![canaryEvents, canaryTotal, controlEvents, controlTotal].every(Number.isFinite)) return 'missing';
    if (![canaryEvents, canaryTotal, controlEvents, controlTotal].every(Number.isInteger)) {
      throw new RangeError(
        `twin-contrast: ${spec.id}: rate counts must be integers — round per-tick deltas before `
        + `calling twinScore, got canaryEvents=${canaryEvents} canaryTotal=${canaryTotal} `
        + `controlEvents=${controlEvents} controlTotal=${controlTotal}`,
      );
    }
    if (canaryEvents < 0 || controlEvents < 0 || canaryEvents > canaryTotal || controlEvents > controlTotal) {
      throw new RangeError(`twin-contrast: ${spec.id}: events must lie in [0, total]`);
    }
    if (canaryTotal === 0 || controlTotal === 0) return 'skip';
    const bc = spec.worse === 'higher' ? canaryEvents : canaryTotal - canaryEvents;
    const bk = spec.worse === 'higher' ? controlEvents : controlTotal - controlEvents;
    const e = bc + bk;
    if (e === 0) return 'skip';
    if (Math.max(0, e - controlTotal) === Math.min(e, canaryTotal)) return 'skip';
    return {
      x: bc / e,
      rollbackNull: canaryTotal / (canaryTotal + controlTotal),
      proceedNull: fisherNoncentralMean(canaryTotal, controlTotal, e, 1 + spec.tolerance) / e,
    };
  }
  if (isRate(obs)) throw new TypeError(`twin-contrast: ${spec.id}: a sign metric needs a SignObservation`);
  if (!Number.isFinite(obs.canary) || !Number.isFinite(obs.control)) return 'missing';
  if (obs.canary === obs.control) return 'tie';
  const canaryHigher = obs.canary > obs.control;
  const worse = spec.worse === 'higher' ? canaryHigher : !canaryHigher;
  return { x: worse ? 1 : 0, rollbackNull: 0.5, proceedNull: 0.5 + spec.tolerance };
}

export function initTwinMetric(): TwinMetricState {
  return { rollback: initPairedBet(), proceed: initPairedBet(), used: 0, skipped: 0, ties: 0, missing: 0 };
}

export function skipTwinMetric(state: TwinMetricState): TwinMetricState {
  return { ...state, skipped: state.skipped + 1 };
}

/** A tick whose observation is missing (outcome-dependent or not) gets a ½ wealth factor on BOTH
 *  sides rather than being skipped. Every attainable paired-bet factor is ≥ 1/2 (λ ≤ ½/(m − lo)
 *  caps the factor 1 + λ(x − m) from below at 1 − λmax(m − lo) = 1/2 over x ∈ [lo, hi]), so a ½
 *  factor is dominated by whatever factor the true, unobserved value would have produced. Both
 *  Ville bounds therefore hold under ANY missingness mechanism, including one that depends on the
 *  unobserved outcome itself (ADR 0036) — no missing-at-random premise is needed. */
export function missTwinMetric(state: TwinMetricState): TwinMetricState {
  const halve = (s: PairedBetState): PairedBetState => (
    { ...s, log_K: advanceLogWealth(s.log_K, Math.log(0.5), -Infinity) }
  );
  return {
    rollback: halve(state.rollback),
    proceed: halve(state.proceed),
    used: state.used,
    skipped: state.skipped,
    ties: state.ties,
    missing: state.missing + 1,
  };
}

export function updateTwinMetric(spec: TwinMetricSpec, state: TwinMetricState, obs: TwinObservation): TwinMetricState {
  const s = twinScore(spec, obs);
  if (s === 'skip') return skipTwinMetric(state);
  if (s === 'missing') return missTwinMetric(state);
  if (s === 'tie') return { ...state, ties: state.ties + 1 };
  return {
    rollback: updatePairedBet(state.rollback, { lo: 0, hi: 1, nullMean: s.rollbackNull }, s.x),
    proceed: updatePairedBet(state.proceed, { lo: 0, hi: 1, nullMean: 1 - s.proceedNull }, 1 - s.x),
    used: state.used + 1,
    skipped: state.skipped,
    ties: state.ties,
    missing: state.missing,
  };
}

export function twinMetricEvidence(state: TwinMetricState): TwinMetricEvidence {
  return {
    rollbackE: pairedBetWealth(state.rollback),
    proceedE: pairedBetWealth(state.proceed),
    used: state.used,
    skipped: state.skipped,
    ties: state.ties,
    missing: state.missing,
  };
}

/** ADR 0036 — rate kind. */
export const TWIN_RATE_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-arms',
  notes: 'Rollback null is the observed traffic share, exact under randomized per-request routing '
    + 'with no arm-level effect on any tick (b_c is central hypergeometric given the tick\'s arm '
    + 'totals and bad-event total, even with heterogeneous per-request bad-event probabilities). '
    + 'Persistent arm-specific state breaks this at any split; a per-tick arm-level shock (iid, '
    + 'zero-mean, symmetric between arms) cancels exactly when the tick\'s realised arm totals are '
    + 'equal, and to second order at canaryWeight 0.5 (study P2: 0.028 / 0.030); at unequal weights '
    + 'it moves E[X | E] off the traffic share (measured 0.755 false rollback at w 0.1, σ_arm 0.3). '
    + 'The PROCEED null (Fisher noncentral mean at 1 + tolerance) needs more: each arm\'s '
    + 'requests share one bad-event probability within the tick; heterogeneous requests within an '
    + 'arm can make it anticonservative (a false clear). Study 2026-09-twin-null run-20260926T053339Z '
    + '(T1, R = 1000, T = 2000, α = 0.05): false rollback 0.026 (w 0.5) / 0.027 (w 0.1) at P1, 0.018 '
    + 'at CS W=150; false proceed 0.004 (w 0.5) / 0.007 (w 0.1) at P5 (×1.5 rate shift). Premise boundary: '
    + 'iid arm shocks σ 0.3 at w 0.1 → 0.755; persistent state φ 0.5 σ 0.1 → 0.075 at w 0.5; '
    + 'cold start without warm-up → 0.289 rate / 1.000 sign. Real-deploy (T3) validity is unmeasured.',
});

/** ADR 0036 — sign kind. */
export const TWIN_SIGN_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-equal-weight-arms',
  notes: 'Null P(canary tick worse | no tie) = 1/2 by exchangeability of equal-weight arms; any '
    + 'scalar tick statistic (a percentile, a gauge, a count). Unequal weights break it for skewed '
    + 'statistics. Study 2026-09-twin-null run-20260926T053339Z (T1, R = 1000, T = 2000, α = 0.05): '
    + 'false rollback 0.025 at w 0.5 (P1), 0.034 at CS W=150; false proceed 0.025 at P5 (sign-direct). '
    + 'Premise boundary: persistent state φ 0.5 σ 0.1 → 0.165 at w 0.5; cold start without warm-up '
    + '→ 0.289 rate / 1.000 sign. Unequal weights measured: P3 (w 0.1, worse = lower) false rollback '
    + '1.000 — the gate refuses sign at canaryWeight ≠ 0.5. Real-deploy (T3) validity is unmeasured.',
});
