// test/adr-0021-multivariate-baseline.test.ts — the multivariate per-cell baseline compiler (Family-C).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compileMultivariateBaseline, hotellingT2 } from '../baseline/multivariate-baseline';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// n correlated 2-vectors with the given mean and correlation ρ (unit variances).
function genCell(n: number, seed: number, mean: [number, number], rho: number): number[][] {
  const rng = lcg(seed), g = (): number => gaussian(rng);
  const l11 = Math.sqrt(1 - rho * rho);
  const rows: number[][] = [];
  for (let i = 0; i < n; i++) { const z0 = g(), z1 = g(); rows.push([mean[0] + z0, mean[1] + rho * z0 + l11 * z1]); }
  return rows;
}

test('multivariate baseline: recovers per-cell mean + correlation, rejects outliers (clean-null)', () => {
  const a = genCell(200, 1, [10, 10], 0.9); // bin 0: correlated
  const b = genCell(200, 2, [50, 30], 0.0); // bin 1: uncorrelated, different mean
  // corrupt 12% of bin 0 with gross outliers
  const aC = a.map((r, i) => (i % 8 === 0 ? [r[0] + 30, r[1] - 30] : r));
  const rows = [...aC, ...b];
  const context = [...aC.map(() => 0), ...b.map(() => 1)];
  const bl = compileMultivariateBaseline(rows, context, { nBins: 2, minStrict: 60, minPooled: 20, seed: 7 });
  assert.equal(bl.dim, 2);
  // bin 0 mean ≈ [10,10] despite the outliers; correlation ≈ 0.9 (not destroyed)
  assert.ok(Math.abs(bl.cells[0].mean[0] - 10) < 1 && Math.abs(bl.cells[0].mean[1] - 10) < 1, `bin0 mean ≈ [10,10]; got [${bl.cells[0].mean.map((v) => v.toFixed(1))}]`);
  assert.ok(bl.cells[0].cov[0][1] > 0.6, `bin0 correlation preserved (>0.6); got ${bl.cells[0].cov[0][1].toFixed(2)}`);
  assert.ok(bl.cells[0].outlierFraction > 0.08, `bin0 should flag ~12% outliers; got ${bl.cells[0].outlierFraction.toFixed(2)}`);
  // bin 1 distinct mean, ~zero correlation
  assert.ok(Math.abs(bl.cells[1].mean[0] - 50) < 1 && Math.abs(bl.cells[1].mean[1] - 30) < 1, `bin1 mean ≈ [50,30]; got [${bl.cells[1].mean.map((v) => v.toFixed(1))}]`);
  assert.ok(Math.abs(bl.cells[1].cov[0][1]) < 0.3, `bin1 ~uncorrelated; got ${bl.cells[1].cov[0][1].toFixed(2)}`);
  assert.equal(bl.cells[0].confidence, 'strict');
});

test('multivariate baseline: Hotelling-T² catches a correlation-structure anomaly per-signal checks miss', () => {
  const rows = genCell(300, 3, [10, 10], 0.9);
  const bl = compileMultivariateBaseline(rows, rows.map(() => 0), { nBins: 1, minStrict: 60, minPooled: 20, seed: 7 });
  const c = bl.cells[0];
  // both points are ~2σ in each marginal (within per-signal limits); [12,8] VIOLATES the +0.9 correlation,
  // [12,12] is consistent with it. Hotelling T² should flag the former far more.
  const tViolate = hotellingT2([12, 8], c);
  const tConsistent = hotellingT2([12, 12], c);
  assert.ok(tViolate > 3 * tConsistent, `correlation-violating point should score ≫ consistent one; got ${tViolate.toFixed(1)} vs ${tConsistent.toFixed(1)}`);
  assert.ok(hotellingT2([10, 10], c) < 1, `the cell centre should score ~0; got ${hotellingT2([10, 10], c).toFixed(2)}`);
});

test('multivariate baseline: adjacency pooling for a sparse cell', () => {
  // bins 0-2 populated; bin 3 has 2 vectors (sparse); poolRadius=1 borrows bins 2 & 4.
  const rows: number[][] = [], context: number[] = [];
  for (const h of [0, 1, 2, 4, 5]) { const g = genCell(40, h + 1, [h, h], 0.0); for (const r of g) { rows.push(r); context.push(h); } }
  rows.push([3, 3], [3.1, 2.9]); context.push(3, 3); // sparse bin 3
  const noPool = compileMultivariateBaseline(rows, context, { nBins: 6, minStrict: 60, minPooled: 20, seed: 7 });
  const pooled = compileMultivariateBaseline(rows, context, { nBins: 6, minStrict: 60, minPooled: 20, poolRadius: 1, seed: 7 });
  assert.equal(noPool.cells[3].confidence, 'aggregate'); // 2 < minPooled ⇒ aggregate
  assert.equal(pooled.cells[3].confidence, 'pooled');    // borrows bins 2 & 4 (40 each) ⇒ pooled
});

test('multivariate baseline: guards', () => {
  const rows = genCell(50, 1, [0, 0], 0);
  assert.throws(() => compileMultivariateBaseline([], [], { nBins: 2 }), /non-empty/);
  assert.throws(() => compileMultivariateBaseline(rows, rows.slice(1).map(() => 0), { nBins: 2 }), /context length/);
  assert.throws(() => compileMultivariateBaseline(rows, rows.map(() => 0), { nBins: 0 }), /nBins/);
  assert.throws(() => compileMultivariateBaseline(rows, rows.map(() => 5), { nBins: 2 }), /out of range/);
  assert.throws(() => hotellingT2([1, 2, 3], { mean: [0, 0], cov: [[1, 0], [0, 1]], n: 10, confidence: 'strict', outlierFraction: 0, method: 'mcd' }), /dims/);
});
