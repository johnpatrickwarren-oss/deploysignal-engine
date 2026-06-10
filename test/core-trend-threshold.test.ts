// test/core-trend-threshold.test.ts — remediation 2026-06-10 (M1, L3).
//
// M1 — effectiveThreshold must apply the trend-strength factor exactly once:
//      effective = baseThreshold − trendDiscount · strength. The reviewed code
//      computed `discount = trendDiscount * strength` and then returned
//      `baseThreshold - discount * strength` (strength squared), systematically
//      under-discounting for moderate trends.
// L3 — summarizeWindow / TrendBuffer.get agree on the degenerate zero-mean cv.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TrendBuffer, trendStrength, effectiveThreshold } from '../core';
import type { TrendSnapshot } from '../types';

function snap(partial: Partial<TrendSnapshot>): TrendSnapshot {
  return {
    slope: 0,
    slopeNorm: 0,
    stable: false,
    cv: 0,
    mean: 0,
    roc: 0,
    min: 0,
    max: 0,
    range: 0,
    n: 10,
    insufficient: false,
    ...partial,
  };
}

test('M1: effectiveThreshold applies trend strength exactly once', () => {
  // slopeNorm 0.02 → slopeScore 0.4; stable → +0.2 bonus; cv 0.01 → no
  // noise penalty. strength = 0.6 (strictly between 0 and 1 so the squared
  // bug is distinguishable from the correct formula).
  const t = snap({ slopeNorm: 0.02, stable: true, cv: 0.01, mean: 100 });
  const strength = trendStrength(t, 'rise');
  assert.ok(Math.abs(strength - 0.6) < 1e-12, `expected strength 0.6, got ${strength}`);

  const base = 2.0;
  const trendDiscount = 0.5;
  const expected = base - trendDiscount * strength; // 1.7
  const actual = effectiveThreshold(base, trendDiscount, t, 'rise');
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `effectiveThreshold must be base - discount·strength = ${expected}; got ${actual}`
    + ' (strength applied twice?)',
  );
});

test('M1: effectiveThreshold bypasses on insufficient data and fast roc', () => {
  assert.equal(effectiveThreshold(2.0, 0.5, null, 'rise'), 2.0);
  assert.equal(
    effectiveThreshold(2.0, 0.5, snap({ slopeNorm: 0.02, stable: true, mean: 100, n: 3 }), 'rise'),
    2.0,
  );
  const fastRoc = snap({ slopeNorm: 0.02, stable: true, cv: 0.01, mean: 100, roc: 0.5 });
  assert.equal(effectiveThreshold(2.0, 0.5, fastRoc, 'rise', 0.3), 2.0);
});

test('L3: snapshot medium view cv agrees with get() on a zero-mean window', () => {
  const buf = new TrendBuffer(10);
  // Zero-mean window: mean === 0 → get() returns cv: 1 as the degenerate
  // default; snapshot's summarizeWindow must agree on the shared field.
  for (const v of [1, -1, 1, -1, 1, -1]) buf.push('sig', v);
  const fromGet = buf.get('sig');
  const fromSnapshot = buf.snapshot('sig').medium;
  assert.equal(fromGet.cv, 1);
  assert.equal(
    fromSnapshot.cv,
    fromGet.cv,
    'summarizeWindow and TrendBuffer.get must agree bit-for-bit on cv',
  );
});
