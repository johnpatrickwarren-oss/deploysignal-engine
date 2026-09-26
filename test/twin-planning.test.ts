// test/twin-planning.test.ts — ADR 0036: the bake-length planning figure. It is a POWER statement;
// validity never reads it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ticksToDetect } from '../per-shard/twin-planning';
import { initPairedBet, updatePairedBet, pairedBetWealth } from '../detectors/_paired-bet';
import { lcg } from './_seeded';

test('sign: 0.2 excess at alpha 0.05 is ln(20) / 0.08 ticks', () => {
  const got = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  assert.ok(Math.abs(got - Math.log(20) / 0.08) < 1e-9, `${got}`);
});

test('sign: ties stretch the bake by 1 / (1 − tieRate)', () => {
  const a = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  const b = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0.5, alpha: 0.05 });
  assert.ok(Math.abs(b - 2 * a) < 1e-9);
});

test('rate: share 0.5, odds 2, 20 bad events per tick at alpha 0.05 is ~20.35 ticks', () => {
  const got = ticksToDetect({ kind: 'rate', canaryShare: 0.5, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 });
  assert.ok(Math.abs(got - 20.35) < 0.1, `${got}`);
});

test('no effect plans an infinite bake', () => {
  assert.equal(ticksToDetect({ kind: 'sign', excessProbability: 0, tieRate: 0, alpha: 0.05 }), Infinity);
  assert.equal(ticksToDetect({ kind: 'rate', canaryShare: 0.5, oddsRatio: 1, badEventsPerTick: 20, alpha: 0.05 }), Infinity);
});

test('sign: the simulated median crossing tick lies within [0.8x, 3x] of the plan', () => {
  const plan = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  const rng = lcg(31);
  const ticks: number[] = [];
  for (let r = 0; r < 400; r++) {
    let s = initPairedBet();
    for (let t = 1; t <= 2000; t++) {
      s = updatePairedBet(s, { lo: 0, hi: 1, nullMean: 0.5 }, rng() < 0.7 ? 1 : 0);
      if (pairedBetWealth(s) >= 20) { ticks.push(t); break; }
    }
  }
  ticks.sort((a, b) => a - b);
  const median = ticks[Math.floor(ticks.length / 2)];
  assert.ok(median >= 0.8 * plan && median <= 3 * plan, `median ${median}, plan ${plan}`);
});

test('inputs out of range throw', () => {
  assert.throws(() => ticksToDetect({ kind: 'sign', excessProbability: 0.6, tieRate: 0, alpha: 0.05 }), RangeError);
  assert.throws(() => ticksToDetect({ kind: 'rate', canaryShare: 0, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 }), RangeError);
});
