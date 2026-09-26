// test/paired-bet.test.ts — ADR 0036: the one-sided bounded-mean betting e-process.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type PairedBetSpec,
  initPairedBet, pairedBetLambda, pairedBetLambdaMax, updatePairedBet, pairedBetWealth,
} from '../detectors/_paired-bet';
import { lcg } from './_seeded';

const HALF: PairedBetSpec = { lo: 0, hi: 1, nullMean: 0.5 };

function feed(spec: PairedBetSpec, xs: number[]) {
  let s = initPairedBet();
  for (const x of xs) s = updatePairedBet(s, spec, x);
  return s;
}

test('predictability: each step multiplies wealth by 1 + λ(x − m) with λ from the state before x', () => {
  const rng = lcg(1);
  let prev = initPairedBet();
  for (let t = 0; t < 200; t++) {
    const m_t = 0.1 + 0.8 * rng();
    const spec_t: PairedBetSpec = { lo: 0, hi: 1, nullMean: m_t };
    const x = rng() < 0.5 ? 0 : 1;

    const lam = pairedBetLambda(prev, spec_t);
    assert.ok(lam >= 0 && lam <= pairedBetLambdaMax(spec_t), `lambda ${lam} for spec with nullMean ${m_t}`);

    const next = updatePairedBet(prev, spec_t, x);
    const expectedLogIncrement = Math.log1p(lam * (x - m_t));
    const actualLogIncrement = next.log_K - prev.log_K;
    assert.ok(Math.abs(actualLogIncrement - expectedLogIncrement) < 1e-12,
      `log increment mismatch: expected ${expectedLogIncrement}, got ${actualLogIncrement}`);

    prev = next;
  }
});

test('lambda stays in [0, lambdaMax] and every factor is at least 1/2', () => {
  const rng = lcg(2);
  const spec: PairedBetSpec = { lo: 0, hi: 1, nullMean: 0.2 };
  const lamMax = pairedBetLambdaMax(spec);
  let s = initPairedBet();
  for (let t = 0; t < 5000; t++) {
    const lam = pairedBetLambda(s, spec);
    assert.ok(lam >= 0 && lam <= lamMax, `lambda ${lam}`);
    assert.ok(1 + lam * (spec.lo - spec.nullMean) >= 0.5 - 1e-12);
    s = updatePairedBet(s, spec, rng() < 0.9 ? 1 : 0);
  }
});

test('Ville: under H0 the wealth crosses 1/alpha in at most alpha of runs (MC, 3 SE)', () => {
  const rng = lcg(3);
  const R = 2000, T = 500, alpha = 0.05;
  let crossed = 0;
  for (let r = 0; r < R; r++) {
    let s = initPairedBet();
    for (let t = 0; t < T; t++) {
      s = updatePairedBet(s, HALF, rng() < 0.5 ? 1 : 0);
      if (pairedBetWealth(s) >= 1 / alpha) { crossed++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(crossed / R <= bar, `crossing rate ${crossed / R} > ${bar}`);
});

test('power: P(X=1) = 0.7 crosses 1/alpha within 500 ticks in at least 95% of runs', () => {
  const rng = lcg(4);
  const R = 400, T = 500, alpha = 0.05;
  let crossed = 0;
  for (let r = 0; r < R; r++) {
    let s = initPairedBet();
    for (let t = 0; t < T; t++) {
      s = updatePairedBet(s, HALF, rng() < 0.7 ? 1 : 0);
      if (pairedBetWealth(s) >= 1 / alpha) { crossed++; break; }
    }
  }
  assert.ok(crossed / R >= 0.95, `power ${crossed / R}`);
});

test('NaN holds the state; out-of-range throws; a bad spec throws; NaN sums yield zero lambda', () => {
  const s = feed(HALF, [1, 0, 1]);
  assert.deepEqual(updatePairedBet(s, HALF, Number.NaN), s);
  assert.throws(() => updatePairedBet(s, HALF, 1.5), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 0 }), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 1.2 }), RangeError);
  assert.equal(pairedBetLambda({ log_K: 0, n: 1, sumY: Number.NaN, sumY2: 0 }, HALF), 0);
});
