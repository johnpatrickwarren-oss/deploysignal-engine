// test/ar1-phi-bias-correction.test.ts
//
// Pins the Kendall median-unbiased small-sample correction on the AR(1)
// estimator(s): phi* = phi_ols + (1+3*phi_ols)/n, applied before the
// [-0.95, 0.95] clip. OLS biases AR(1) phi low by ~(1+3phi)/n; under-correcting
// leaves residual autocorrelation after pre-whitening at high phi / short
// baselines. computePerSignalAr1Phi (mixture) is exported and shares the formula
// with tools/fit-production-substrate.ts:ar1Phi.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePerSignalAr1Phi } from '../detectors/family-a-mixture-supermartingale.js';
import { fitProductionSubstrate } from '../tools/fit-production-substrate.js';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function ar1(rng: () => number, rho: number, n: number): number[] {
  const innov = Math.sqrt(1 - rho * rho);
  const out: number[] = [];
  let prev = gaussian(rng);
  for (let i = 0; i < n; i++) { prev = rho * prev + innov * gaussian(rng); out.push(prev); }
  return out;
}
// Independent raw OLS lag-1 (no correction), centered at the sample mean — the
// pre-correction value the estimator would have returned.
function rawOls(values: number[]): number {
  const n = values.length;
  let mean = 0; for (const v of values) mean += v; mean /= n;
  let lag1 = 0, variance = 0;
  for (let i = 1; i < n; i++) lag1 += (values[i] - mean) * (values[i - 1] - mean);
  for (const v of values) variance += (v - mean) * (v - mean);
  return lag1 / variance;
}

test('correction is applied: result = phi_ols + (1+3*phi_ols)/n on AR(0.6)', () => {
  const values = ar1(lcg(2026), 0.6, 300);
  // computePerSignalAr1Phi centers at baseline_mean; pass the sample mean so the
  // centering matches rawOls (which uses the sample mean).
  let mean = 0; for (const v of values) mean += v; mean /= values.length;
  const ols = rawOls(values);
  const corrected = computePerSignalAr1Phi(values, mean);
  const expected = ols + (1 + 3 * ols) / values.length;
  assert.ok(Math.abs(corrected - expected) < 1e-9, `corrected=${corrected} expected=${expected}`);
  assert.ok(corrected > ols, 'correction must raise phi (OLS is biased low for phi > -1/3)');
});

test('correction shrinks toward zero impact as n grows (negligible at long baselines)', () => {
  const short = ar1(lcg(7), 0.6, 60);
  const long = ar1(lcg(7), 0.6, 8000);
  let ms = 0; for (const v of short) ms += v; ms /= short.length;
  let ml = 0; for (const v of long) ml += v; ml /= long.length;
  const gapShort = computePerSignalAr1Phi(short, ms) - rawOls(short);
  const gapLong = computePerSignalAr1Phi(long, ml) - rawOls(long);
  assert.ok(gapShort > gapLong, `short-n correction (${gapShort}) should exceed long-n (${gapLong})`);
  assert.ok(gapLong < 0.001, `long-n correction should be negligible; got ${gapLong}`);
});

test('iid input stays near zero (correction does not manufacture autocorrelation)', () => {
  const rng = lcg(99); const values: number[] = [];
  for (let i = 0; i < 4000; i++) values.push(gaussian(rng));
  assert.ok(Math.abs(computePerSignalAr1Phi(values, 0)) < 0.05);
});

test('result stays within the stationary clip [-0.95, 0.95]', () => {
  const values = ar1(lcg(11), 0.98, 2000);
  const phi = computePerSignalAr1Phi(values, 0);
  assert.ok(phi <= 0.95 && phi >= -0.95, `phi=${phi} must be clipped into [-0.95, 0.95]`);
});

// Pins the OTHER estimator (ar1Phi is not exported) via fitProductionSubstrate,
// which stamps ar1.phi through ar1Phi. Without the correction this would fail
// (stamped phi would equal raw OLS, not exceed it). Closes cold-eye F1.
test('fitProductionSubstrate stamps the bias-corrected phi (pins ar1Phi)', () => {
  const values = ar1(lcg(303), 0.6, 300);
  const ols = rawOls(values); // sample-mean-centered, same centering as ar1Phi(values, mean)
  const sub = fitProductionSubstrate(values, { signalName: 's' });
  const expected = ols + (1 + 3 * ols) / values.length;
  assert.ok(Math.abs(sub.ar1.phi - expected) < 1e-9, `stamped=${sub.ar1.phi} expected=${expected}`);
  assert.ok(sub.ar1.phi > ols, 'stamped phi must exceed raw OLS (correction active)');
});
