// test/counter-rate-transform.test.ts — remediation 2026-06-10 (M3).
//
// transformPair used actual_elapsed_seconds as a divisor with no guard:
// duplicate timestamps (elapsed = 0) yielded Infinity/NaN rates and
// out-of-order samples (elapsed < 0) yielded negative rates, all flagged
// 'normal' — propagating directly into TrendBuffer/detector state. Pairs
// with non-positive elapsed must now return a null-value degraded sample.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { transformPair } from '../l0/counter-rate-transform';

const COUNTER = { semantic_type: 'counter' } as const;
const OPTS = { expected_scrape_interval_seconds: 30 } as const;

test('M3: zero elapsed (duplicate timestamp) returns null value, degraded', () => {
  const r = transformPair(
    { value: 100, ts_seconds: 1000 },
    { value: 160, ts_seconds: 1000 },
    COUNTER,
    OPTS,
  );
  assert.equal(r.value, null, 'rate over zero elapsed is undefined; must not be Infinity');
  assert.equal(r.actual_elapsed_seconds, 0);
  assert.equal(r.slope_quality, 'degraded');
  assert.equal(r.nonpositive_elapsed_detected, true);
  assert.equal(r.reset_detected, false);
  assert.equal(r.wraparound_handled, false);
});

test('M3: negative elapsed (out-of-order pair) returns null value, degraded', () => {
  const r = transformPair(
    { value: 100, ts_seconds: 1000 },
    { value: 160, ts_seconds: 970 },
    COUNTER,
    OPTS,
  );
  assert.equal(r.value, null, 'negative-elapsed rate must not be emitted');
  assert.equal(r.actual_elapsed_seconds, -30);
  assert.equal(r.slope_quality, 'degraded');
  assert.equal(r.nonpositive_elapsed_detected, true);
});

test('M3: non-counter pass-through also guarded (timestamp invariant is pair-level)', () => {
  const r = transformPair(
    { value: 0.5, ts_seconds: 1000 },
    { value: 0.7, ts_seconds: 1000 },
    { semantic_type: 'gauge' },
    OPTS,
  );
  assert.equal(r.value, null);
  assert.equal(r.slope_quality, 'degraded');
  assert.equal(r.nonpositive_elapsed_detected, true);
});

test('M3: clean increasing counter unchanged by the guard', () => {
  const r = transformPair(
    { value: 100, ts_seconds: 1000 },
    { value: 160, ts_seconds: 1030 },
    COUNTER,
    OPTS,
  );
  assert.equal(r.value, 2);
  assert.equal(r.slope_quality, 'normal');
  assert.equal(r.nonpositive_elapsed_detected, undefined);
});
