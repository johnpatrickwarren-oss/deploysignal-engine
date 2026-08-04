// test/spectral-inflation-bound.test.ts — the c-deflation.
//
// The spectral e-detector is not an e-process: E[M_T|H0] measured 1.0636 at T=300 and 1.1076 at
// T=900 under disjoint evaluation. The violation is BOUNDED, and a bounded violation is priceable —
// firing at c/α is identical to running at α on M/c, and E[M/c] ≤ 1. See
// knowledge/stats/h0-battery-2026-08-01.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSpectralEDetectorState, evaluateSpectralEDetector } from '../detectors/spectral';
import type { FamilyDPerSignal } from '../types/families/d';

const base = {
  null_mean: 0.2754, null_std: 0.08, betting_delta: 0.024,
  min_peak_lag: 3, max_peak_lag: 10,
} as unknown as FamilyDPerSignal;

const thresholdWith = (bound?: number): number => {
  const params = { ...base, e_value_inflation_bound: bound } as FamilyDPerSignal;
  const t = evaluateSpectralEDetector(
    { params, alpha: 0.05, signal: 't' }, base.null_mean as number, freshSpectralEDetectorState(),
  ).threshold;
  assert.ok(t !== null && t !== undefined, 'the detector must report a threshold');
  return t;
};

test('absent bound leaves the threshold at 1/alpha — not the same as c = 1 being true', () => {
  assert.equal(thresholdWith(undefined), 20);
});

test('a supplied bound raises the threshold to c/alpha', () => {
  assert.ok(Math.abs(thresholdWith(1.0636) - 1.0636 / 0.05) < 1e-9);
  assert.ok(Math.abs(thresholdWith(1.25) - 25) < 1e-9);
});

test('the bound only ever tightens: c >= 1 raises the bar, never lowers it', () => {
  assert.ok(thresholdWith(1.0636) > thresholdWith(undefined),
    'deflation must not make the detector fire MORE readily');
});

test('the measured bounds are ordered by horizon, as c(n) = a*b^n requires', () => {
  // 1.0636 at 9 wealth updates, 1.1076 at 29. A bound quoted for a short horizon
  // under-corrects a long one, which is why the type says to measure the longest.
  assert.ok(1.1076 > 1.0636);
  assert.ok(thresholdWith(1.1076) > thresholdWith(1.0636));
});
