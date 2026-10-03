// test/peer-rank.test.ts — ADR 0039: the rank-among-peers kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPeerRankSpec, initPeerRank, stepPeerRank, peerRankScore, type PeerRankSpec } from '../detectors/peer-rank';
import { twinScore, initTwinMetric, updateTwinMetric, twinMetricEvidence, type TwinMetricSpec } from '../detectors/twin-contrast';
import { lcg } from './_seeded';

const SPEC: PeerRankSpec = { id: 'gpu_temp', worse: 'higher', tolerance: 0.1, margin: { relative: 0.02 }, alpha: 0.05 };
const gaussian = (rng: () => number) => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());

test('spec checks', () => {
  checkPeerRankSpec(SPEC);
  assert.throws(() => checkPeerRankSpec({ ...SPEC, tolerance: 0.5 }), /tolerance/);
  assert.throws(() => checkPeerRankSpec({ ...SPEC, margin: {} }), /relative or absolute/);
  assert.throws(() => checkPeerRankSpec({ ...SPEC, worse: 'up' as 'higher' }), /worse/);
});

test('score: fraction of finite peers the unit is worse than, beyond the band; ties count half without a margin', () => {
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [100, 105, 109, NaN] }), { x: 2 / 3, peersScored: 3 });
  assert.deepEqual(peerRankScore({ ...SPEC, margin: undefined }, { unit: 100, peers: [100, 90, 110] }), { x: 0.5, peersScored: 3 });
  assert.equal(peerRankScore(SPEC, { unit: 100, peers: [NaN] }), null);
  assert.equal(peerRankScore(SPEC, { unit: NaN, peers: [1] }), null);
  assert.deepEqual(peerRankScore({ ...SPEC, worse: 'lower' }, { unit: 90, peers: [100, 91] }), { x: 0.5, peersScored: 2 });
});

test('N = 2 reproduces the twin sign kind score for score and wealth for wealth (with and without a margin)', () => {
  for (const margin of [undefined, { relative: 0.02 }]) {
    const ps: PeerRankSpec = { ...SPEC, margin };
    const ts: TwinMetricSpec = { id: 'x', kind: 'sign', worse: 'higher', tolerance: 0.1, ...(margin ? { margin } : {}) };
    const rng = lcg(11);
    let pst = initPeerRank(ps), tst = initTwinMetric();
    for (let t = 0; t < 500; t++) {
      const u = 100 + 3 * gaussian(rng), p = 100 + 3 * gaussian(rng);
      const peerStep = stepPeerRank(ps, pst, { unit: u, peers: [p] });
      const sc = twinScore(ts, { canary: u, control: p });
      const px = peerRankScore(ps, { unit: u, peers: [p] });
      if (sc === 'tie') assert.equal(px!.x, 0.5); else if (typeof sc === 'object') assert.equal(px!.x, sc.x);
      tst = updateTwinMetric(ts, tst, { canary: u, control: p });
      if (peerStep.fire) break;
      pst = peerStep.state;
      const te = twinMetricEvidence(tst);
      assert.ok(Math.abs(peerStep.rollbackE - te.rollbackE) < 1e-9 * Math.max(1, te.rollbackE), `rollback wealth differs at tick ${t}`);
      assert.ok(Math.abs(peerStep.proceedE - te.proceedE) < 1e-9 * Math.max(1, te.proceedE), `proceed wealth differs at tick ${t}`);
    }
  }
});

test('H0 (exchangeable unit and 3 peers, iid noise): false rollback within the Ville bound', () => {
  const rng = lcg(20261003); const R = 400, T = 300; let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initPeerRank(SPEC);
    for (let t = 0; t < T; t++) {
      const s = stepPeerRank(SPEC, st, { unit: 100 + 3 * gaussian(rng), peers: [0, 1, 2].map(() => 100 + 3 * gaussian(rng)) }); st = s.state;
      if (s.fire) { fired++; break; }
    }
  }
  assert.ok(fired / R <= 0.05 + 2.58 * Math.sqrt(0.05 * 0.95 / R), `false rollback ${fired}/${R}`);
});

test('power: the unit 10% above 3 peers (5× the margin) rolls back within 60 ticks in >= 95% of runs', () => {
  const rng = lcg(5); const R = 200; let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initPeerRank(SPEC);
    for (let t = 0; t < 60; t++) {
      const s = stepPeerRank(SPEC, st, { unit: 110 + 3 * gaussian(rng), peers: [0, 1, 2].map(() => 100 + 3 * gaussian(rng)) }); st = s.state;
      if (s.fire) { fired++; break; }
    }
  }
  assert.ok(fired / R >= 0.95, `power ${fired}/${R}`);
});

test('after a fire the state is terminal', () => {
  let st = initPeerRank(SPEC); let s;
  for (let t = 0; t < 200; t++) { s = stepPeerRank(SPEC, st, { unit: 120, peers: [100, 100, 100] }); st = s.state; if (s.fire) break; }
  assert.ok(s!.fire); const after = stepPeerRank(SPEC, st, { unit: 50, peers: [100, 100, 100] }); assert.ok(after.fire); assert.equal(after.x, null);
});
