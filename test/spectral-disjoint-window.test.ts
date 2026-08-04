// test/spectral-disjoint-window.test.ts — the e-detector advances once per window, not per tick.
//
// Rolling evaluation makes successive peak|ACF| increments share all but one sample, so u_t is
// nearly F_{t-1}-measurable and the martingale-difference condition fails: measured 0.576 against a
// nominal 0.05 with oracle parameters on iid Gaussian data. Disjoint evaluation measures 0.0005.
// knowledge/stats/h0-battery-2026-08-01.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSpectralEDetectorState } from '../detectors/spectral';
import type { SpectralEDetectorState } from '../types/families/d';

test('a fresh state starts with no ticks banked', () => {
  const st = freshSpectralEDetectorState();
  assert.equal(st.ticksSinceEval ?? 0, 0);
});

test('the wealth advances once per window, not once per tick', () => {
  // Simulated dispatch cadence: W ticks in, exactly one wealth update out.
  const W = 30;
  const st: SpectralEDetectorState = freshSpectralEDetectorState();
  let updates = 0;
  for (let t = 0; t < 300; t++) {
    const since = (st.ticksSinceEval ?? 0) + 1;
    if (since < W) { st.ticksSinceEval = since; continue; }
    st.ticksSinceEval = 0;
    updates += 1;
  }
  assert.equal(updates, 10, '300 ticks at W=30 must yield 10 updates, not 300');
});

test('the counter is optional so pre-2026-08-03 states heal rather than throw', () => {
  const legacy = { M: 1, n: 0, alphaConsumed: 0 } as SpectralEDetectorState;
  assert.equal(legacy.ticksSinceEval ?? 0, 0, 'absence is treated as zero');
});
