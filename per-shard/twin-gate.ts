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
//         across ticks, zero-mean, symmetric between arms) cancels exactly when the tick's realised
//         arm totals are equal, and to second order at canaryWeight 0.5 (study P2: 0.028 / 0.030);
//         at unequal weights it moves E[X | E] off the traffic share (measured 0.755 false rollback
//         at w 0.1, σ_arm 0.3) (see detectors/twin-contrast.ts TWIN_RATE_ENVELOPE).
//   (ii)  a `rate` metric's PROCEED test needs one more premise, one bad-event probability per arm
//         per tick (see detectors/twin-contrast.ts TWIN_RATE_ENVELOPE); heterogeneous per-request
//         probabilities within an arm can make it anticonservative (a false clear). Rollback and the
//         SRM guard do not need it.
//   (iii) a missing observation (input.observations[m.id] === undefined while the canary is taking
//         traffic) is handled by `missTwinMetric`'s ½ wealth penalty on both sides, which dominates
//         whatever factor the true value would have produced under ANY missingness mechanism — so
//         no missing-at-random premise is needed, even outcome-dependent missingness is covered.

import {
  type PairedBetState,
  initPairedBet, updatePairedBet, pairedBetWealth,
} from '../detectors/_paired-bet';
import {
  type TwinMetricSpec, type TwinMetricState, type TwinObservation,
  checkTwinMetricSpec, initTwinMetric, skipTwinMetric, missTwinMetric, updateTwinMetric, twinMetricEvidence,
} from '../detectors/twin-contrast';

export interface TwinGateConfig {
  metrics: readonly TwinMetricSpec[];
  alphaRollback: number;
  alphaProceed: number;
  alphaSrm: number;
  /** Configured routing share of the canary within the experiment: w_c / (w_c + w_k). */
  canaryWeight: number;
  maxTicks: number;
  /** Opt in to `rate` metrics at canaryWeight ≠ 0.5. Refused by default: at an unequal split any
   *  per-tick arm-level shock moves the rollback null off the traffic share (study 2026-09-twin-null
   *  P2: 0.755 false rollback at w 0.1, σ_arm 0.3). Set it only where the arms are known to carry no
   *  arm-level effect on any tick, e.g. from an A/A run at the same split. */
  allowUnequalRateSplit?: boolean;
}

export type TwinVerdict = 'rollback' | 'proceed' | 'extend' | 'inconclusive' | 'invalid_experiment';

export interface TwinGateState {
  tick: number;
  terminal: TwinVerdict | null;
  metrics: Readonly<Record<string, TwinMetricState>>;
  srmUp: PairedBetState;
  srmDown: PairedBetState;
}

export interface TwinTickInput {
  canaryRequests: number;
  controlRequests: number;
  observations: Readonly<Record<string, TwinObservation | undefined>>;
}

export interface TwinMetricReport {
  id: string;
  rollbackE: number;
  rollbackThreshold: number;
  proceedE: number;
  proceedThreshold: number;
  used: number;
  skipped: number;
  ties: number;
  missing: number;
}

export interface TwinGateDecision {
  verdict: TwinVerdict;
  tick: number;
  srmE: number;
  srmThreshold: number;
  metrics: TwinMetricReport[];
}

function inUnit(x: number): boolean { return x > 0 && x < 1; }

export function checkTwinGateConfig(cfg: TwinGateConfig): void {
  if (cfg.metrics.length === 0) throw new RangeError('twin-gate: at least one metric is required');
  const ids = new Set<string>();
  for (const m of cfg.metrics) {
    if (ids.has(m.id)) throw new RangeError(`twin-gate: duplicate metric id '${m.id}'`);
    ids.add(m.id);
    checkTwinMetricSpec(m);
  }
  if (![cfg.alphaRollback, cfg.alphaProceed, cfg.alphaSrm, cfg.canaryWeight].every(inUnit)) {
    throw new RangeError('twin-gate: alphas and canaryWeight must lie in (0, 1)');
  }
  if (!(Number.isInteger(cfg.maxTicks) && cfg.maxTicks >= 1)) {
    throw new RangeError(`twin-gate: maxTicks must be a positive integer, got ${cfg.maxTicks}`);
  }
  if (cfg.metrics.some((m) => m.kind !== 'rate') && cfg.canaryWeight !== 0.5) {
    throw new RangeError(
      'twin-gate: a sign metric needs equal routing weights (canaryWeight 0.5): its null is the '
      + `exchangeability of two equal-sized arms (ADR 0036). Got canaryWeight ${cfg.canaryWeight}.`,
    );
  }
  if (cfg.canaryWeight !== 0.5 && !cfg.allowUnequalRateSplit) {
    throw new RangeError(
      `twin-gate: a rate metric at canaryWeight ${cfg.canaryWeight} is refused by default: at an `
      + 'unequal split per-tick arm-level shocks move its rollback null off the traffic share (study '
      + '2026-09-twin-null P2: 0.755 false rollback at w 0.1, σ_arm 0.3). Use canaryWeight 0.5, or set '
      + 'allowUnequalRateSplit where an A/A run at this split shows no arm-level effect (ADR 0036).',
    );
  }
}

export function initTwinGate(cfg: TwinGateConfig): TwinGateState {
  checkTwinGateConfig(cfg);
  const metrics: Record<string, TwinMetricState> = {};
  for (const m of cfg.metrics) metrics[m.id] = initTwinMetric();
  return { tick: 0, terminal: null, metrics, srmUp: initPairedBet(), srmDown: initPairedBet() };
}

function srmE(state: TwinGateState): number {
  return (pairedBetWealth(state.srmUp) + pairedBetWealth(state.srmDown)) / 2;
}

function report(cfg: TwinGateConfig, state: TwinGateState, verdict: TwinVerdict): TwinGateDecision {
  const n = cfg.metrics.length;
  return {
    verdict,
    tick: state.tick,
    srmE: srmE(state),
    srmThreshold: 1 / cfg.alphaSrm,
    metrics: cfg.metrics.map((m) => {
      const ev = twinMetricEvidence(state.metrics[m.id]);
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

function decide(cfg: TwinGateConfig, state: TwinGateState): TwinVerdict {
  if (srmE(state) >= 1 / cfg.alphaSrm) return 'invalid_experiment';
  const n = cfg.metrics.length;
  const ev = cfg.metrics.map((m) => twinMetricEvidence(state.metrics[m.id]));
  if (ev.some((e) => e.rollbackE >= n / cfg.alphaRollback)) return 'rollback';
  if (ev.every((e) => e.proceedE >= 1 / cfg.alphaProceed)) return 'proceed';
  if (state.tick >= cfg.maxTicks) return 'inconclusive';
  return 'extend';
}

export function stepTwinGate(
  cfg: TwinGateConfig, state: TwinGateState, input: TwinTickInput,
): { state: TwinGateState; decision: TwinGateDecision } {
  if (state.terminal !== null) return { state, decision: report(cfg, state, state.terminal) };
  const { canaryRequests: c, controlRequests: k } = input;
  if (!(Number.isFinite(c) && Number.isFinite(k) && c >= 0 && k >= 0)) {
    throw new RangeError(`twin-gate: request counts must be finite and non-negative, got ${c}, ${k}`);
  }
  let { srmUp, srmDown } = state;
  if (c + k > 0) {
    const share = c / (c + k);
    srmUp = updatePairedBet(srmUp, { lo: 0, hi: 1, nullMean: cfg.canaryWeight }, share);
    srmDown = updatePairedBet(srmDown, { lo: 0, hi: 1, nullMean: 1 - cfg.canaryWeight }, 1 - share);
  }
  const metrics: Record<string, TwinMetricState> = { ...state.metrics };
  for (const m of cfg.metrics) {
    const obs = input.observations[m.id];
    metrics[m.id] = obs !== undefined ? updateTwinMetric(m, metrics[m.id], obs)
      : c > 0 ? missTwinMetric(metrics[m.id])
      : skipTwinMetric(metrics[m.id]);
  }
  const next: TwinGateState = { tick: state.tick + 1, terminal: null, metrics, srmUp, srmDown };
  const verdict = decide(cfg, next);
  const settled: TwinGateState = { ...next, terminal: verdict === 'extend' ? null : verdict };
  return { state: settled, decision: report(cfg, settled, verdict) };
}
