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

test('each factor has conditional mean exactly 1 at the null boundary (two-point law)', () => {
  const specs: PairedBetSpec[] = [HALF, { lo: 0, hi: 1, nullMean: 0.1 }, { lo: -1, hi: 1, nullMean: -0.3 }];
  const rng = lcg(1);
  for (const spec of specs) {
    for (let k = 0; k < 50; k++) {
      const hist = Array.from({ length: 1 + Math.floor(rng() * 40) }, () => spec.lo + rng() * (spec.hi - spec.lo));
      const lam = pairedBetLambda(feed(spec, hist), spec);
      const pHi = (spec.nullMean - spec.lo) / (spec.hi - spec.lo);
      const e = pHi * (1 + lam * (spec.hi - spec.nullMean)) + (1 - pHi) * (1 + lam * (spec.lo - spec.nullMean));
      assert.ok(Math.abs(e - 1) < 1e-12, `E[factor] = ${e}`);
    }
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

test('NaN holds the state; out-of-range throws; a bad spec throws', () => {
  const s = feed(HALF, [1, 0, 1]);
  assert.deepEqual(updatePairedBet(s, HALF, Number.NaN), s);
  assert.throws(() => updatePairedBet(s, HALF, 1.5), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 0 }), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 1.2 }), RangeError);
});
