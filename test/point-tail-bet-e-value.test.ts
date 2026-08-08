// test/point-tail-bet-e-value.test.ts — engine test/adr-0005 pattern
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrateTailBet, pointTailBetEValue, KAPPA } from '../detectors/point-tail-bet-e-value';

const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

test('KAPPA is the registered constant', () => { assert.equal(KAPPA, 0.1); });

test('calibrate refuses short or degenerate rows', () => {
  assert.throws(() => calibrateTailBet([1, 2, 3]));
  assert.throws(() => calibrateTailBet(new Array(10000).fill(7)));
});

test('validity: healthy exceedance at alpha=0.05 within binomial tolerance', () => {
  const r = lcg(20260808);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  let exceed = 0; const N = 4000;
  for (let i = 0; i < N; i++) if (pointTailBetEValue(gauss(r), cal).e >= 20) exceed++;
  // E[1{e>=20}] = P(p <= (20/kappa)^(1/(kappa-1))) = (200)^(-1/0.9) ≈ 0.00279; 3σ tolerance
  const p0 = Math.pow(200, -1 / 0.9);
  assert.ok(exceed / N < p0 + 3 * Math.sqrt(p0 / N), `exceedance ${exceed / N}`);
});

test('mean e under H0 <= 1 within tolerance (calibrator integral)', () => {
  const r = lcg(42);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  let s = 0; const N = 20000;
  for (let i = 0; i < N; i++) s += pointTailBetEValue(gauss(r), cal).e;
  assert.ok(s / N < 1.15, `mean e ${s / N}`); // heavy-tailed; refusal-direction check only
});

test('a beyond-calibration point is decisive on its own', () => {
  const r = lcg(7);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  const { e, p } = pointTailBetEValue(1e6, cal);
  assert.equal(p, 1 / 10001);
  assert.ok(e > 300 && e < 500, `e ${e}`); // 0.1 * (1/10001)^(-0.9) ≈ 398
});

// Mutation regression: the conformal p-value's validity depends on the tie
// direction in the rank count — #{s_cal >= s(x)}, not #{s_cal > s(x)}.
// Excluding exact ties breaks super-uniformity silently (it never shows up
// on continuous draws, since ties have probability 0). rows = 0..9999 is
// symmetric about its median, so every deviation |k - median| repeats
// exactly twice — an exact-tie fixture by construction, not by luck.
test('conformal rank count is >=, not > (tie regression; symmetric-integer fixture)', () => {
  const rows = Array.from({ length: 10000 }, (_, k) => k);
  const cal = calibrateTailBet(rows);
  const x = 1000; // |1000 - median| === |8999 - median|: an exact tie, and x is itself a calibration row.
  const score = Math.abs(x - cal.median) / cal.mad;
  const tiedAtScore = cal.sortedScores.filter((s) => s === score).length;
  assert.ok(tiedAtScore >= 2, `fixture must produce an exact tie at the query score; got ${tiedAtScore}`);

  const expectedCount = cal.sortedScores.filter((s) => s >= score).length; // >= is the correct, validity-bearing direction
  const expectedP = (1 + expectedCount) / (cal.sortedScores.length + 1);
  const { p } = pointTailBetEValue(x, cal);
  assert.equal(p, expectedP);
});
