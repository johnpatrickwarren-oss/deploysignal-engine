// test/twin-gate.test.ts — ADR 0036: multi-metric fusion and the sample-ratio guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type TwinGateConfig, type TwinTickInput,
  checkTwinGateConfig, initTwinGate, stepTwinGate,
} from '../per-shard/twin-gate';
import { lcg, poisson } from './_seeded';

const CFG: TwinGateConfig = {
  metrics: [
    { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 },
    { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.2 },
  ],
  alphaRollback: 0.01,
  alphaProceed: 0.05,
  alphaSrm: 0.001,
  canaryWeight: 0.5,
  maxTicks: 1000,
};

function tick(rng: () => number, canaryMult: number, canaryLatencyShift: number): TwinTickInput {
  const n = poisson(rng, 2000);
  let nc = 0;
  for (let i = 0; i < n; i++) if (rng() < 0.5) nc++;
  const nk = n - nc;
  return {
    canaryRequests: nc,
    controlRequests: nk,
    observations: {
      http_5xx: {
        canaryEvents: Math.min(nc, poisson(rng, nc * 0.01 * canaryMult)), canaryTotal: nc,
        controlEvents: Math.min(nk, poisson(rng, nk * 0.01)), controlTotal: nk,
      },
      p99_ms: { canary: 200 + canaryLatencyShift + 20 * (rng() - 0.5), control: 200 + 20 * (rng() - 0.5) },
    },
  };
}

function run(cfg: TwinGateConfig, rng: () => number, mult: number, shift: number) {
  let state = initTwinGate(cfg);
  let decision = stepTwinGate(cfg, state, tick(rng, mult, shift)).decision;
  for (let t = 0; t < cfg.maxTicks; t++) {
    const out = stepTwinGate(cfg, state, tick(rng, mult, shift));
    state = out.state;
    decision = out.decision;
    if (decision.verdict !== 'extend') break;
  }
  return decision;
}

test('config: a sign metric at unequal weights is refused', () => {
  assert.throws(() => checkTwinGateConfig({ ...CFG, canaryWeight: 0.1 }), /equal routing weights/);
});

test('config: a rate metric at unequal weights is refused unless allowUnequalRateSplit is set', () => {
  const rateOnly: TwinGateConfig = { ...CFG, metrics: [CFG.metrics[0]], canaryWeight: 0.1 };
  assert.throws(() => checkTwinGateConfig(rateOnly), /allowUnequalRateSplit/);
  assert.doesNotThrow(() => checkTwinGateConfig({ ...rateOnly, allowUnequalRateSplit: true }));
  assert.doesNotThrow(() => checkTwinGateConfig({ ...rateOnly, canaryWeight: 0.5 }));
  // The opt-in covers rate only: a sign metric at unequal weights is still refused.
  assert.throws(() => checkTwinGateConfig({ ...CFG, canaryWeight: 0.1, allowUnequalRateSplit: true }), /equal routing weights/);
});

test('config: empty metric list and duplicate ids are refused', () => {
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [] }), RangeError);
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [CFG.metrics[0], CFG.metrics[0]] }), RangeError);
});

test('config: an unrecognized metric kind or worse direction is refused', () => {
  const badKind = { ...CFG.metrics[0], kind: 'bogus' as unknown as 'rate' };
  const badWorse = { ...CFG.metrics[0], worse: 'sideways' as unknown as 'higher' };
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [badKind] }), RangeError);
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [badWorse] }), RangeError);
});

test('a canary with 3x the error rate is rolled back', () => {
  const d = run(CFG, lcg(21), 3, 0);
  assert.equal(d.verdict, 'rollback');
  assert.ok(d.tick < 200, `tick ${d.tick}`);
});

test('a canary 15 ms slower on every tick is rolled back by the sign metric', () => {
  const d = run(CFG, lcg(22), 1, 15);
  assert.equal(d.verdict, 'rollback');
});

test('identical arms proceed', () => {
  const d = run(CFG, lcg(23), 1, 0);
  assert.equal(d.verdict, 'proceed');
});

test('a canary receiving no traffic is an invalid experiment', () => {
  const cfg: TwinGateConfig = { ...CFG, metrics: [CFG.metrics[0]] };
  let state = initTwinGate(cfg);
  let verdict = 'extend';
  for (let t = 0; t < 100 && verdict === 'extend'; t++) {
    const out = stepTwinGate(cfg, state, { canaryRequests: 0, controlRequests: 1000, observations: {} });
    state = out.state;
    verdict = out.decision.verdict;
  }
  assert.equal(verdict, 'invalid_experiment');
});

test('terminal verdicts are sticky', () => {
  const rng = lcg(24);
  let state = initTwinGate(CFG);
  let out = stepTwinGate(CFG, state, tick(rng, 3, 0));
  while (out.decision.verdict === 'extend') { state = out.state; out = stepTwinGate(CFG, state, tick(rng, 3, 0)); }
  const after = stepTwinGate(CFG, out.state, tick(rng, 1, 0));
  assert.equal(after.decision.verdict, out.decision.verdict);
  assert.equal(after.state.tick, out.state.tick);
});

test('maxTicks without a decision is inconclusive', () => {
  const cfg: TwinGateConfig = { ...CFG, maxTicks: 3 };
  const d = run(cfg, lcg(25), 1, 0);
  assert.equal(d.verdict, 'inconclusive');
});

test('rollback threshold is Bonferroni over metrics; proceed is not split', () => {
  const d = stepTwinGate(CFG, initTwinGate(CFG), tick(lcg(26), 1, 0)).decision;
  assert.ok(d.metrics.every((m) => m.rollbackThreshold === 2 / 0.01 && m.proceedThreshold === 1 / 0.05));
});

// Outcome-dependent missingness: the canary is worse on 70% of ticks (right at the proceed
// tolerance boundary, worse = 0.5 + 0.2), but its observation goes missing on half of exactly the
// ticks where it was worse. Skipping those ticks would understate the canary's true worse-rate
// (observed worse-rate among non-missing ticks drops to ~0.35 / 0.65 ≈ 0.54, well under the 0.7
// proceed null) and clear PROCEED on evidence that was never collected. The ½ penalty in
// missTwinMetric must prevent that.
test('outcome-dependent missingness at the proceed boundary never clears a false proceed', () => {
  const cfg: TwinGateConfig = {
    ...CFG,
    metrics: [{ id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.2 }],
    maxTicks: 1000,
  };
  const rng = lcg(31);
  let state = initTwinGate(cfg);
  let verdict = 'extend';
  for (let t = 0; t < cfg.maxTicks && verdict === 'extend'; t++) {
    const worse = rng() < 0.7;
    const dropped = worse && rng() < 0.5;
    const observations = dropped ? {} : {
      p99_ms: worse ? { canary: 201, control: 200 } : { canary: 199, control: 200 },
    };
    const out = stepTwinGate(cfg, state, { canaryRequests: 1000, controlRequests: 1000, observations });
    state = out.state;
    verdict = out.decision.verdict;
  }
  assert.notEqual(verdict, 'proceed');
});
