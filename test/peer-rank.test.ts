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

// ── ADR 0040: declared per-peer offsets ─────────────────────────────────────────────────────────

test('ADR 0040: offsets map peers onto the unit\'s scale; absent or zero is ADR 0039; length must match', () => {
  // unit 60 against peers 100 and 30: raw, the unit is worse than the 30 only
  assert.deepEqual(peerRankScore(SPEC, { unit: 60, peers: [100, 30] }), { x: 0.5, peersScored: 2 });
  // with the gaps declared (unit runs at 0.6 of peer 0 and 2× peer 1), both peers sit at 60 → inside the band → 0
  assert.deepEqual(peerRankScore(SPEC, { unit: 60, peers: [100, 30], offsets: [-0.4, 1.0] }), { x: 0, peersScored: 2 });
  assert.deepEqual(peerRankScore(SPEC, { unit: 60, peers: [100, 30], offsets: [0, 0] }), peerRankScore(SPEC, { unit: 60, peers: [100, 30] }));
  assert.throws(() => peerRankScore(SPEC, { unit: 1, peers: [1, 2], offsets: [0] }), /offsets/);
  // an unusable offset (≤ −1 or non-finite) drops that peer for the tick
  assert.deepEqual(peerRankScore(SPEC, { unit: 60, peers: [100, 30], offsets: [-1, 1.0] }), { x: 0, peersScored: 1 });
});

test('ADR 0040: H0 with persistent gaps (the unit 1.4–2.5× every peer) and exact offsets: false rollback within the Ville bound; without offsets it rolls back', () => {
  const rng = lcg(20261003); const R = 300, T = 300; let firedWith = 0, firedWithout = 0;
  const G = [-0.5, -0.3, -0.6]; const off = G.map((g) => 1 / (1 + g) - 1); // the unit runs 1.4–2.5× every peer: the GWDG 'hot GPU'
  for (let r = 0; r < R; r++) {
    let a = initPeerRank(SPEC), b = initPeerRank(SPEC); let doneA = false, doneB = false;
    for (let t = 0; t < T && !(doneA && doneB); t++) {
      const base = 100 + 3 * gaussian(rng); const peers = G.map((g) => (100 + 3 * gaussian(rng)) * (1 + g));
      if (!doneA) { const s = stepPeerRank(SPEC, a, { unit: base, peers, offsets: off }); a = s.state; if (s.fire) { firedWith++; doneA = true; } }
      if (!doneB) { const s = stepPeerRank(SPEC, b, { unit: base, peers }); b = s.state; if (s.fire) { firedWithout++; doneB = true; } }
    }
  }
  assert.ok(firedWith / R <= 0.05 + 2.58 * Math.sqrt(0.05 * 0.95 / R), `with offsets ${firedWith}/${R}`);
  assert.ok(firedWithout / R >= 0.9, `without offsets ${firedWithout}/${R}`);
});

// ── ADR 0041: per-peer margin floors ────────────────────────────────────────────────────────────

test('ADR 0041: a per-peer margin floor widens the band for that peer only; zeros reproduce ADR 0039/0040', () => {
  // unit 110 vs peers 100, 100 at a 2% spec margin: worse than both
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [100, 100] }), { x: 1, peersScored: 2 });
  // a 15% floor on the first peer: inside its band; the second still counts
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [100, 100], margins: [0.15, 0] }), { x: 0.5, peersScored: 2 });
  // a floor smaller than the spec margin changes nothing
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [100, 100], margins: [0.01, 0.01] }), { x: 1, peersScored: 2 });
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [100, 100], margins: [0, 0], offsets: [0, 0] }), peerRankScore(SPEC, { unit: 110, peers: [100, 100] }));
  assert.throws(() => peerRankScore(SPEC, { unit: 1, peers: [1, 2], margins: [0] }), /margins/);
  // offsets and floors compose: peer 50 at offset +1.0 sits at 100; floor 0.15 puts 110 inside its band
  assert.deepEqual(peerRankScore(SPEC, { unit: 110, peers: [50, 100], offsets: [1.0, 0], margins: [0.15, 0] }), { x: 0.5, peersScored: 2 });
});
