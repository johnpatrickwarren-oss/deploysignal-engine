// test/invariant.test.ts — ADR 0038 §2: the invariant e-process.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkInvariantSpec, initInvariant, stepInvariant, type InvariantSpec } from '../detectors/invariant';
import { lcg, poisson } from './_seeded';

const SPEC: InvariantSpec = { id: 'unaccounted', tolerance: 0.002, alpha: 0.05 };

test('spec: tolerance and alpha in (0, 1), id required', () => {
  checkInvariantSpec(SPEC);
  assert.throws(() => checkInvariantSpec({ ...SPEC, tolerance: 0 }), /tolerance/);
  assert.throws(() => checkInvariantSpec({ ...SPEC, tolerance: 1 }), /tolerance/);
  assert.throws(() => checkInvariantSpec({ ...SPEC, alpha: 0 }), /alpha/);
  assert.throws(() => checkInvariantSpec({ ...SPEC, id: '' }), /id/);
  assert.throws(() => checkInvariantSpec({ ...SPEC, ceiling: 0.001 }), /ceiling/);
  assert.throws(() => checkInvariantSpec({ ...SPEC, ceiling: 1.5 }), /ceiling/);
});

test('a tick with nothing routed is a skip; a non-finite count is missing; neither moves wealth', () => {
  let st = initInvariant(SPEC);
  let s = stepInvariant(SPEC, st, { total: 0, accounted: 0 });
  assert.equal(s.state.skipped, 1); assert.equal(s.x, null); assert.equal(s.wealth, 1);
  s = stepInvariant(SPEC, s.state, { total: NaN, accounted: 3 });
  assert.equal(s.state.missing, 1); assert.equal(s.wealth, 1);
});

test('more accounted than routed clamps to x = 0', () => {
  const s = stepInvariant(SPEC, initInvariant(SPEC), { total: 4800, accounted: 4810 });
  assert.equal(s.x, 0);
});

test('H0 (mean unaccounted fraction below the tolerance, boundary noise only): false fire within the Ville bound', () => {
  const rng = lcg(20261003);
  const R = 400, T = 300;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initInvariant(SPEC); let prev = poisson(rng, 10);
    for (let t = 0; t < T; t++) {
      const n = poisson(rng, 4870); const inflight = poisson(rng, 10);
      const s = stepInvariant(SPEC, st, { total: n, accounted: Math.max(0, Math.min(n, n - inflight + prev)) });
      prev = inflight; st = s.state;
      if (s.fire) { fired++; break; }
    }
  }
  assert.ok(fired / R <= 0.05 + 2.58 * Math.sqrt((0.05 * 0.95) / R), `false fire ${fired}/${R}`);
});

test('power: 0.5% of requests dropped (2.5× the tolerance) fires within 60 ticks in >= 95% of runs', () => {
  const rng = lcg(7);
  const R = 200, T = 60;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initInvariant(SPEC); let prev = poisson(rng, 10);
    for (let t = 0; t < T; t++) {
      const n = poisson(rng, 4870); const inflight = poisson(rng, 10); const drops = poisson(rng, n * 0.005);
      const s = stepInvariant(SPEC, st, { total: n, accounted: Math.max(0, Math.min(n, n - drops - inflight + prev)) });
      prev = inflight; st = s.state;
      if (s.fire) { fired++; assert.equal(s.state.firedAt, s.state.used); break; }
    }
  }
  assert.ok(fired / R >= 0.95, `power ${fired}/${R}`);
});

test('after a fire the state is terminal: further ticks report fire without scoring', () => {
  let st = initInvariant(SPEC);
  let s;
  for (let t = 0; t < 200; t++) { s = stepInvariant(SPEC, st, { total: 4870, accounted: 4800 }); st = s.state; if (s.fire) break; }
  assert.ok(s!.fire);
  const used = st.used;
  const after = stepInvariant(SPEC, st, { total: 4870, accounted: 4870 });
  assert.ok(after.fire); assert.equal(after.state.used, used); assert.equal(after.x, null);
});
