// test/adr-0019-seasonal-baseline.test.ts — the L1 seasonal clean-null baseline kit (ADR 0019).
//
// Properties: (1) removes predictable seasonal structure (residual variance ≪ raw); (2) the clean-null trims
// anomalies (bin mean ≈ the anomaly-free mean, clean count < total); (3) sparse bins fall back to aggregate;
// (4) a fault in fresh data SURVIVES residualisation (baseline came from healthy history); (5) guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compileSeasonalBaseline, seasonalBaselineResidual } from '../baseline/seasonal-baseline';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const variance = (a: number[]): number => { const m = a.reduce((x, y) => x + y, 0) / a.length; return a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; };

const NB = 24, DAYS = 42; // 24 bins (hour-of-day), 6 weeks
function diurnalSeries(seed: number): { values: number[]; context: number[] } {
  const rng = lcg(seed), g = (): number => gaussian(rng);
  const values: number[] = [], context: number[] = [];
  for (let d = 0; d < DAYS; d++) {
    for (let h = 0; h < NB; h++) {
      const seasonal = 10 * Math.sin((2 * Math.PI * h) / NB) + 3 * Math.cos((4 * Math.PI * h) / NB);
      values.push(50 + seasonal + g()); // base + strong diurnal + small noise
      context.push(h);
    }
  }
  return { values, context };
}

test('seasonal baseline: removes the diurnal structure (residual variance ≪ raw)', () => {
  const { values, context } = diurnalSeries(1);
  const bl = compileSeasonalBaseline(values, context, { nBins: NB, minStrict: 30, minPooled: 10 });
  const resid = seasonalBaselineResidual(values, context, bl);
  const ratio = variance(resid) / variance(values);
  assert.ok(ratio < 0.1, `residual/raw variance should be ≪ 1 (seasonality removed); got ${ratio.toFixed(3)}`);
  // every bin is strict (42 samples each) and the per-bin clean mean tracks the seasonal shape
  assert.ok(bl.bins.every((b) => b.confidence === 'strict'), 'all bins should be strict at 42 samples/bin');
});

test('seasonal baseline: clean-null trims anomalies', () => {
  const { values, context } = diurnalSeries(2);
  // corrupt bin 5 with a few large anomalies
  const v = values.slice();
  let injected = 0;
  for (let i = 0; i < v.length && injected < 5; i++) if (context[i] === 5) { v[i] += 100; injected++; }
  const clean = compileSeasonalBaseline(values, context, { nBins: NB, minStrict: 30, minPooled: 10 });
  const dirty = compileSeasonalBaseline(v, context, { nBins: NB, minStrict: 30, minPooled: 10 });
  // the trimmed bin-5 mean stays close to the uncorrupted mean (anomalies dropped), and clean n < 42
  assert.ok(Math.abs(dirty.bins[5].mean - clean.bins[5].mean) < 2,
    `clean-null should reject the anomalies; mean drifted ${Math.abs(dirty.bins[5].mean - clean.bins[5].mean).toFixed(2)}`);
  assert.ok(dirty.bins[5].n <= 42 - injected, `clean count should drop the ${injected} anomalies; got n=${dirty.bins[5].n}`);
});

test('seasonal baseline: sparse bins fall back to aggregate', () => {
  // only bins 0..3 populated heavily; bins 4..23 get 1 sample each ⇒ aggregate
  const values: number[] = [], context: number[] = [];
  for (let i = 0; i < 200; i++) { values.push(50 + gaussian(lcg(i + 1))); context.push(i % 4); }
  for (let h = 4; h < NB; h++) { values.push(99); context.push(h); }
  const bl = compileSeasonalBaseline(values, context, { nBins: NB, minStrict: 30, minPooled: 10 });
  assert.equal(bl.bins[0].confidence, 'strict');
  assert.equal(bl.bins[10].confidence, 'aggregate');
  assert.equal(bl.bins[10].mean, bl.aggregate.mean);
});

test('seasonal baseline: adjacency pooling borrows from neighbours before the aggregate', () => {
  // bins 0-2 heavily populated at 10; bins 3,5,6,7 at 90; bin 4 has a single sample → sparse.
  const values: number[] = [], context: number[] = [];
  for (let h = 0; h <= 2; h++) for (let k = 0; k < 100; k++) { values.push(10 + gaussian(lcg(h * 100 + k))); context.push(h); }
  for (const h of [3, 5, 6, 7]) for (let k = 0; k < 30; k++) { values.push(90 + gaussian(lcg(h * 100 + k))); context.push(h); }
  values.push(90); context.push(4); // lone sample in bin 4
  const opt = { nBins: 8, minStrict: 30, minPooled: 10 };
  const noPool = compileSeasonalBaseline(values, context, opt);
  const pooled = compileSeasonalBaseline(values, context, { ...opt, poolRadius: 1 });
  // without pooling, bin 4 (1 sample) falls back to the global aggregate — the robust clean-null center of the
  // majority (≈ 10; the 90s are the minority and get trimmed), NOT bin 4's true neighbourhood value (90).
  assert.equal(noPool.bins[4].confidence, 'aggregate');
  assert.ok(Math.abs(noPool.bins[4].mean - 10) < 3, `aggregate (robust majority) ≈ 10; got ${noPool.bins[4].mean.toFixed(1)}`);
  // with poolRadius=1, bin 4 borrows neighbours 3 & 5 (both ≈ 90) → pooled ≈ 90, not the aggregate
  assert.equal(pooled.bins[4].confidence, 'pooled');
  assert.ok(Math.abs(pooled.bins[4].mean - 90) < 2, `adjacency-pooled ≈ 90; got ${pooled.bins[4].mean.toFixed(1)}`);
});

test('seasonal baseline: a fault in fresh data survives residualisation', () => {
  const { values, context } = diurnalSeries(3);
  const bl = compileSeasonalBaseline(values, context, { nBins: NB, minStrict: 30, minPooled: 10 });
  // fresh day: same diurnal shape + a +8 fault on every hour
  const fresh: number[] = [], fctx: number[] = [];
  const rng = lcg(77), g = (): number => gaussian(rng);
  for (let h = 0; h < NB; h++) {
    const seasonal = 10 * Math.sin((2 * Math.PI * h) / NB) + 3 * Math.cos((4 * Math.PI * h) / NB);
    fresh.push(50 + seasonal + g() + 8); fctx.push(h);
  }
  const resid = seasonalBaselineResidual(fresh, fctx, bl);
  const m = resid.reduce((a, b) => a + b, 0) / resid.length;
  assert.ok(m > 6, `the +8 fault should survive (seasonality removed, fault kept); residual mean ${m.toFixed(2)}`);
});

test('seasonal baseline: guards', () => {
  const { values, context } = diurnalSeries(1);
  assert.throws(() => compileSeasonalBaseline([], [], { nBins: NB }), /non-empty/);
  assert.throws(() => compileSeasonalBaseline(values, context.slice(1), { nBins: NB }), /context length/);
  assert.throws(() => compileSeasonalBaseline(values, context, { nBins: 0 }), /nBins/);
  assert.throws(() => compileSeasonalBaseline(values, context.map(() => 99), { nBins: NB }), /out of range/);
  assert.throws(() => compileSeasonalBaseline(values, context, { nBins: NB, minStrict: 5, minPooled: 10 }), /minPooled <= minStrict/);
});
