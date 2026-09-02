// test/e-bh-margin.test.ts — the realized e-BH threshold and per-shard margin
// (knowledge stats/e-betting-metrics-2026-09-02, option 3).
//
// The one property that makes these fields worth emitting: the margin's SIGN
// reproduces the selection exactly. If that ever drifts, the diagnostic is
// lying about the procedure it describes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eBenjaminiHochberg, eBenjaminiHochbergLog } from '../fleet/e-bh';
import { LOG_MAX_WEALTH } from '../detectors/_wealth';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Selected iff margin ≥ 0, modulo a floating tie band around zero where the
 *  multiplicative rule k·e_(k) ≥ N/q and the log-domain subtraction can round
 *  differently at the last ulp. */
function assertSignReproducesSelection(
  selected: ReadonlyArray<number>, margin: ReadonlyArray<number>, label: string,
) {
  const sel = new Set(selected);
  margin.forEach((m, i) => {
    if (Math.abs(m) < 1e-9) return;  // boundary tie: either answer is the procedure's
    assert.equal(m >= 0, sel.has(i), `${label}: index ${i} margin ${m} vs selected ${sel.has(i)}`);
  });
}

test('margin sign reproduces the selection on 200 random snapshots (linear and log)', () => {
  const rng = mulberry32(20260902);
  for (let trial = 0; trial < 200; trial++) {
    const N = 1 + Math.floor(rng() * 60);
    const q = 0.02 + rng() * 0.3;
    const es: number[] = [];
    for (let i = 0; i < N; i++) {
      // mix of null-ish (e ≈ 0.1..2) and strong (e up to 1e4) values
      es.push(rng() < 0.7 ? 0.1 + rng() * 2 : Math.exp(rng() * Math.log(1e4)));
    }
    const lin = eBenjaminiHochberg(es, q);
    assertSignReproducesSelection(lin.selected, lin.log_margin, `linear trial ${trial}`);
    const lg = eBenjaminiHochbergLog(es.map(Math.log), q);
    assertSignReproducesSelection(lg.selected, lg.log_margin, `log trial ${trial}`);
    assert.deepEqual(lg.selected, lin.selected, 'both variants select the same set');
    assert.ok(Math.abs(lg.log_threshold_e - lin.log_threshold_e) < 1e-9);
  }
});

test('threshold is log(N/(qK)) when K ≥ 1 and log(N/q) when nothing is selected', () => {
  const r = eBenjaminiHochberg([100, 50, 1, 0.5], 0.1);
  assert.equal(r.K, 2);
  assert.ok(Math.abs(r.log_threshold_e - Math.log(4 / (0.1 * 2))) < 1e-12);
  const none = eBenjaminiHochberg([1, 1, 1], 0.1);
  assert.equal(none.K, 0);
  assert.ok(Math.abs(none.log_threshold_e - Math.log(3 / 0.1)) < 1e-12);
  // every margin negative when nothing is selected
  assert.ok(none.log_margin.every((m) => m < 0));
});

test('margin is index-aligned with the input, and a zero e-value is floored, never −Infinity', () => {
  const r = eBenjaminiHochberg([0, 1000, 3], 0.1);
  assert.equal(r.log_margin.length, 3);
  assert.ok(Number.isFinite(r.log_margin[0]), 'zero e-value must not produce −Infinity');
  assert.equal(r.log_margin[0], -LOG_MAX_WEALTH);
  assert.ok(r.log_margin[1] > 0 && r.selected.includes(1));
  assert.ok(JSON.stringify(r).indexOf('null') === -1, 'the surface stays JSON-safe');
});
