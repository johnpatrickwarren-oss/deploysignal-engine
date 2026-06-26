// test/adr-0021-robust-covariance.test.ts — the ported robust multivariate covariance (MCD + Ledoit-Wolf).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  robustCovariance, ledoitWolfShrinkage, consistencyCorrectionFactor, choleskyLocal, mahalanobisSqFromL, columnMean,
} from '../baseline/robust-covariance';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// rows from a known 2D covariance [[2,1],[1,2]] via its Cholesky.
function genCorrelated(n: number, seed: number): number[][] {
  const rng = lcg(seed), g = (): number => gaussian(rng);
  const l00 = Math.SQRT2, l10 = 1 / Math.SQRT2, l11 = Math.sqrt(2 - 0.5);
  const rows: number[][] = [];
  for (let i = 0; i < n; i++) { const z0 = g(), z1 = g(); rows.push([l00 * z0, l10 * z0 + l11 * z1]); }
  return rows;
}

test('robustCovariance: recovers the true covariance on clean Gaussian (MCD path)', () => {
  const rows = genCorrelated(600, 1);
  const r = robustCovariance(rows, { seed: 7 });
  assert.equal(r.method, 'mcd');
  assert.ok(r.outlierFraction < 0.1, `clean data should trim few outliers; got ${r.outlierFraction.toFixed(2)}`);
  // true cov [[2,1],[1,2]] — within ~25% (finite-sample MCD + consistency correction)
  assert.ok(Math.abs(r.cov[0][0] - 2) < 0.5, `var0 ≈ 2; got ${r.cov[0][0].toFixed(2)}`);
  assert.ok(Math.abs(r.cov[1][1] - 2) < 0.5, `var1 ≈ 2; got ${r.cov[1][1].toFixed(2)}`);
  assert.ok(Math.abs(r.cov[0][1] - 1) < 0.5, `cov01 ≈ 1; got ${r.cov[0][1].toFixed(2)}`);
});

test('robustCovariance: rejects gross outliers (clean-null) where the sample covariance would blow up', () => {
  const rows = genCorrelated(500, 2);
  // corrupt 12% of rows with huge values
  const corrupt = rows.map((r, i) => (i % 8 === 0 ? [r[0] + 40, r[1] - 40] : r));
  const robust = robustCovariance(corrupt, { seed: 7 });
  // robust variance stays near the truth (≈2), not the outlier-inflated sample variance (which is ~200+)
  const sampleVar0 = (() => { const m = columnMean(corrupt); let v = 0; for (const x of corrupt) v += (x[0] - m[0]) ** 2; return v / corrupt.length; })();
  assert.ok(sampleVar0 > 50, `sanity: contaminated sample variance should be huge; got ${sampleVar0.toFixed(0)}`);
  assert.ok(robust.cov[0][0] < 6, `robust var0 should reject the outliers (≈2, not ${sampleVar0.toFixed(0)}); got ${robust.cov[0][0].toFixed(2)}`);
  assert.ok(robust.outlierFraction > 0.08, `should flag ~12% outliers; got ${robust.outlierFraction.toFixed(2)}`);
});

test('robustCovariance: Ledoit-Wolf fallback for small samples, PSD output', () => {
  const rows = genCorrelated(8, 3); // n=8 < 5·p=10 → LW path
  const r = robustCovariance(rows, { seed: 7 });
  assert.equal(r.method, 'ledoit_wolf');
  assert.ok(r.lambda! >= 0 && r.lambda! <= 1, `lambda in [0,1]; got ${r.lambda}`);
  assert.ok(choleskyLocal(r.cov) !== null, 'LW covariance must be positive-definite');
});

test('robustCovariance: consistency factor — >1 correction, matches canonical at p=11, identity at α=1', () => {
  // p=11,α=.75 ≈ 1.24 is the Croux–Haesbroeck value WH reproduces accurately (matches the original engine).
  assert.ok(Math.abs(consistencyCorrectionFactor(0.75, 11) - 1.24) < 0.06, `p=11,α=.75 ≈ 1.24; got ${consistencyCorrectionFactor(0.75, 11).toFixed(3)}`);
  // smaller p: a real (>1) correction, larger as coverage tightens; we assert direction/range, not a pinned
  // canonical value (the WH approximation diverges from the table for small p — a known limitation).
  assert.ok(consistencyCorrectionFactor(0.75, 5) > 1.1, `p=5,α=.75 should correct >1; got ${consistencyCorrectionFactor(0.75, 5).toFixed(3)}`);
  assert.ok(consistencyCorrectionFactor(0.5, 2) > 1.0, `p=2,α=.5 should correct >1; got ${consistencyCorrectionFactor(0.5, 2).toFixed(3)}`);
  assert.equal(consistencyCorrectionFactor(1.0, 5), 1, 'α=1 (no trimming) ⇒ no correction');
});

test('robustCovariance: linalg + guards', () => {
  assert.equal(choleskyLocal([[1, 2], [2, 1]]), null); // indefinite → null
  // Mahalanobis² of [3,4] under identity = 25
  assert.ok(Math.abs(mahalanobisSqFromL([3, 4], [0, 0], [[1, 0], [0, 1]]) - 25) < 1e-9);
  const { lambda } = ledoitWolfShrinkage([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  assert.ok(lambda >= 0 && lambda <= 1);
  assert.throws(() => robustCovariance([]), /non-empty/);
  assert.throws(() => robustCovariance([[1, 2], [3]]), /ragged/);
});
