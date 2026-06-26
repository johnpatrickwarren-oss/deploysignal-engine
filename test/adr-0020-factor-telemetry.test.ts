// test/adr-0020-factor-telemetry.test.ts — the L2→L1 instrumented-telemetry ingestion contract (ADR 0020).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateFactorTelemetry, resolveFactorMembership, alignToGrid } from '../baseline/factor-telemetry';

const ft = (signals: number[][], ids: string[], ticks: number) => ({ signals, factorIds: ids, t0: 1000, dt: 60, ticks });

test('validateFactorTelemetry: accepts a well-formed telemetry, rejects malformed', () => {
  validateFactorTelemetry(ft([[1, 2, 3], [4, 5, 6]], ['cdu-0', 'feed-0'], 3), 3); // ok
  assert.throws(() => validateFactorTelemetry(ft([[1, 2]], ['a'], 3), 3), /length 2, expected 3/);
  assert.throws(() => validateFactorTelemetry(ft([[1, 2, 3]], ['a'], 2), 3), /telemetry ticks 2 != analysis grid ticks 3/);
  assert.throws(() => validateFactorTelemetry(ft([[1, NaN, 3]], ['a'], 3), 3), /non-finite/);
  assert.throws(() => validateFactorTelemetry(ft([[1, 2, 3], [4, 5, 6]], ['a', 'a'], 3), 3), /duplicate factor id/);
  assert.throws(() => validateFactorTelemetry({ signals: [[1, 2, 3]], factorIds: ['a'], t0: 0, dt: 0, ticks: 3 }, 3), /dt must be > 0/);
});

test('resolveFactorMembership: maps factor ids to indices; zero-factor shard ok; unknown id throws', () => {
  const ids = ['cdu-0', 'feed-0', 'pod-0', 'job-7'];
  const m = resolveFactorMembership(ids, [['cdu-0', 'feed-0', 'pod-0', 'job-7'], ['cdu-0', 'pod-0'], []]);
  assert.deepEqual(m, [[0, 1, 2, 3], [0, 2], []]);
  assert.throws(() => resolveFactorMembership(ids, [['cdu-9']]), /unknown factor id "cdu-9"/);
});

test('alignToGrid: previous-sample-hold', () => {
  // samples at t=1000,1120,1240; grid t0=1000 dt=60 ticks=5 → 1000,1060,1120,1180,1240
  const s = [{ t: 1000, v: 10 }, { t: 1120, v: 20 }, { t: 1240, v: 30 }];
  const g = alignToGrid(s, 1000, 60, 5, { method: 'hold' });
  assert.deepEqual(g, [10, 10, 20, 20, 30]); // hold the most recent at-or-before each grid point
});

test('alignToGrid: linear interpolation', () => {
  const s = [{ t: 1000, v: 10 }, { t: 1120, v: 20 }];
  const g = alignToGrid(s, 1000, 60, 3, { method: 'linear' }); // grid 1000,1060,1120
  assert.equal(g[0], 10);
  assert.ok(Math.abs(g[1] - 15) < 1e-9, `midpoint should interpolate to 15; got ${g[1]}`);
  assert.equal(g[2], 20);
});

test('alignToGrid: maxGap leaves NaN past the gap (engine never fabricates past the declared gap)', () => {
  const s = [{ t: 1000, v: 10 }]; // only one sample; grid extends well past it
  const g = alignToGrid(s, 1000, 60, 4, { method: 'hold', maxGap: 90 }); // 1000,1060,1120,1180
  assert.equal(g[0], 10);          // exact
  assert.equal(g[1], 10);          // 60 ≤ 90 → held
  assert.ok(Number.isNaN(g[2]));   // 120 > 90 → NaN
  assert.ok(Number.isNaN(g[3]));
  // and such a column is rejected by validation (forces the product to handle the gap)
  assert.throws(() => validateFactorTelemetry(ft([g], ['a'], 4), 4), /non-finite/);
});
