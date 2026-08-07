// test/group-average-e-value.test.ts — the group-average e-value (K2 candidate).
//
// Coverage matrix K2 = group-in-unison drift (validation/coverage/PREREGISTRATION.md §1, §5).
// groupAverageEValue composes K per-series terminal e-values (safe-t) into one group e-value: the
// arithmetic mean, which is itself an e-value under arbitrary dependence of the components
// (Vovk-Wang 2021 §4; ~/concord/knowledge/stats/pages/e-value.md "Combining e-values").

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupAverageEValue } from '../detectors/group-average-e-value';

test('mean: arithmetic mean of [2, 4] is 3', () => {
  const got = groupAverageEValue([2, 4]);
  assert.ok(Math.abs(got - 3) < 1e-9, `expected ~3, got ${got}`);
});

test('mean: matches the plain arithmetic mean on a larger, unequal set', () => {
  const vals = [1, 2, 3, 4, 5, 100];
  const want = vals.reduce((a, b) => a + b, 0) / vals.length;
  const got = groupAverageEValue(vals);
  assert.ok(Math.abs(got - want) < 1e-6 * Math.max(1, want), `expected ~${want}, got ${got}`);
});

test('mean: a single component is its own mean (identity)', () => {
  const got = groupAverageEValue([7]);
  assert.ok(Math.abs(got - 7) < 1e-9, `expected ~7, got ${got}`);
});

test('mean: a zero component pulls the mean down correctly', () => {
  const got = groupAverageEValue([0, 4]);
  assert.ok(Math.abs(got - 2) < 1e-9, `expected ~2, got ${got}`);
});

// Regression: the log/exp round trip through combineAverage degenerates when EVERY component is
// exactly 0 (Math.log(0) = -Infinity for all inputs; the max-shift logSumExp then computes
// exp(-Infinity - -Infinity) = exp(NaN) = NaN). Zero is a legal e-value and the mean of all-zeros
// is 0, not NaN.
test('mean: a single 0 component is 0 (not NaN)', () => {
  assert.equal(groupAverageEValue([0]), 0);
});

test('mean: all-zero components average to 0 (not NaN)', () => {
  assert.equal(groupAverageEValue([0, 0]), 0);
});

test('mean: a mixed [0, 4] still averages to 2 (regression guard alongside the all-zero fix)', () => {
  const got = groupAverageEValue([0, 4]);
  assert.ok(Math.abs(got - 2) < 1e-9, `expected ~2, got ${got}`);
});

test('guards: throws on empty input', () => {
  assert.throws(() => groupAverageEValue([]), Error);
});

test('guards: throws on a negative component', () => {
  assert.throws(() => groupAverageEValue([1, -1]), Error);
});

test('guards: throws on a NaN component', () => {
  assert.throws(() => groupAverageEValue([1, NaN]), Error);
});
