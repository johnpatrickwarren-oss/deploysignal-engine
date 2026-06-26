// baseline/multivariate-baseline.ts — the multivariate per-cell baseline compiler (L1, ADR 0019/0021).
//
// The Family-C analogue of the univariate `seasonal-baseline.ts`: instead of a scalar μ/σ² per context bin,
// each cell holds a JOINT signal-vector mean + a robust covariance (via `robustCovariance` — FastMCD/Ledoit-
// Wolf clean-null, ADR 0021). A fresh observation is then scored by its Mahalanobis² against its cell — the
// Hotelling-T² statistic — which catches CORRELATION-structure anomalies a per-signal threshold cannot (a
// point inside every marginal but off the joint ellipsoid). Sparse cells pool neighbours, then the aggregate.
//
// Generic over the context axis and signal vector; knows nothing about hours/GPUs/which signals (L2 supplies
// the binned vectors). This is the per-cell COMPILER; the calibrator numerics live in `robust-covariance.ts`.

import { robustCovariance, RobustCovarianceOptions, choleskyLocal, mahalanobisSqFromL } from './robust-covariance';
import type { BaselineConfidence } from './seasonal-baseline';

export interface MultivariateCell {
  /** Clean-null joint mean (length = signal dimension). */
  mean: number[];
  /** Robust covariance (consistency-corrected MCD, or Ledoit-Wolf for small/degenerate cells). */
  cov: number[][];
  /** Observation count behind the cell (raw, before robust trimming). */
  n: number;
  confidence: BaselineConfidence;
  /** Fraction of the cell's observations trimmed as outliers (MCD path; 0 for Ledoit-Wolf). */
  outlierFraction: number;
  method: 'mcd' | 'ledoit_wolf';
}

export interface MultivariateBaseline {
  /** One cell per context bin (length nBins). A bin without a usable own/pooled estimate carries the
   *  aggregate (so scoring never misses). */
  cells: MultivariateCell[];
  /** Robust covariance over ALL observations — the sparse-bin fallback. */
  aggregate: MultivariateCell;
  /** Signal-vector dimension. */
  dim: number;
}

export interface MultivariateBaselineOptions extends RobustCovarianceOptions {
  /** Number of context bins; labels must be integers in `0..nBins-1`. */
  nBins: number;
  /** Observation count at/above which a cell is `strict`. Default 60. Should be ≥ dim+1. */
  minStrict?: number;
  /** Observation count at/above which a cell is `pooled` (usable); below it the cell falls back to adjacency
   *  pooling, then the aggregate. Default 20. Should be ≥ dim+1 to admit a covariance. */
  minPooled?: number;
  /** Adjacency pooling radius: a sparse bin pools the vectors of bins within ±radius before the aggregate. */
  poolRadius?: number;
  /** Treat the context axis as cyclic for adjacency pooling. Default false. */
  cyclic?: boolean;
}

function cell(rows: number[][], confidence: BaselineConfidence, opts: RobustCovarianceOptions): MultivariateCell {
  const r = robustCovariance(rows, opts);
  return { mean: r.mean, cov: r.cov, n: rows.length, confidence, outlierFraction: r.outlierFraction, method: r.method };
}

/** Compile a per-cell multivariate (Family-C) baseline. See the file header.
 *
 *  @param rows       `[observation][signal]` — the joint signal vectors.
 *  @param context    per-observation integer bin label in `0..nBins-1`.
 *  @param opts       `nBins` (required), confidence thresholds, adjacency pooling, and robustCovariance opts.
 *  @throws RangeError on length mismatch, empty/ragged/non-finite input, bad `nBins`/thresholds, or an
 *    out-of-range context label. */
export function compileMultivariateBaseline(
  rows: ReadonlyArray<ReadonlyArray<number>>,
  context: ReadonlyArray<number>,
  opts: MultivariateBaselineOptions,
): MultivariateBaseline {
  const fn = 'compileMultivariateBaseline';
  const n = rows.length;
  if (n === 0) throw new RangeError(`${fn}: rows must be non-empty`);
  const dim = rows[0].length;
  if (dim === 0) throw new RangeError(`${fn}: signal vectors must have ≥ 1 dimension`);
  if (context.length !== n) throw new RangeError(`${fn}: context length ${context.length} != rows length ${n}`);
  const nBins = opts.nBins;
  if (!Number.isInteger(nBins) || nBins < 1) throw new RangeError(`${fn}: nBins must be a positive integer; got ${nBins}`);
  const minStrict = opts.minStrict ?? 60;
  const minPooled = opts.minPooled ?? 20;
  const poolRadius = opts.poolRadius ?? 0;
  const cyclic = opts.cyclic ?? false;
  if (!(minPooled >= 1 && minStrict >= minPooled)) throw new RangeError(`${fn}: require 1 <= minPooled <= minStrict`);
  if (!Number.isInteger(poolRadius) || poolRadius < 0) throw new RangeError(`${fn}: poolRadius must be a non-negative integer`);

  const buckets: number[][][] = Array.from({ length: nBins }, () => []);
  for (let i = 0; i < n; i++) {
    if (rows[i].length !== dim) throw new RangeError(`${fn}: ragged row ${i} has ${rows[i].length} dims, expected ${dim}`);
    for (let j = 0; j < dim; j++) if (!Number.isFinite(rows[i][j])) throw new RangeError(`${fn}: non-finite value at [${i}][${j}]`);
    const c = context[i];
    if (!Number.isInteger(c) || c < 0 || c >= nBins) throw new RangeError(`${fn}: context[${i}] = ${c} out of range 0..${nBins - 1}`);
    buckets[c].push(rows[i] as number[]);
  }

  const aggregate = cell(rows as number[][], 'aggregate', opts);

  const cells = buckets.map((b, idx): MultivariateCell => {
    if (b.length >= minPooled) {
      return cell(b, b.length >= minStrict ? 'strict' : 'pooled', opts);
    }
    if (poolRadius > 0) {
      const pooled: number[][] = [];
      for (let d = -poolRadius; d <= poolRadius; d++) {
        let bi = idx + d;
        if (cyclic) bi = ((bi % nBins) + nBins) % nBins;
        if (bi < 0 || bi >= nBins) continue;
        for (const x of buckets[bi]) pooled.push(x);
      }
      if (pooled.length >= minPooled) return cell(pooled, 'pooled', opts);
    }
    return { ...aggregate, n: b.length, confidence: 'aggregate' };
  });

  return { cells, aggregate, dim };
}

/** Mahalanobis² of an observation vector against its cell `(mean, cov)` — the Hotelling-T² statistic. Large ⇒
 *  the vector is far from the cell's joint distribution (including off-correlation directions a per-signal
 *  check misses). A tiny diagonal ridge guards a non-PD cell covariance.
 *  @throws RangeError if `x` length ≠ the cell dimension. */
export function hotellingT2(x: ReadonlyArray<number>, cell: MultivariateCell): number {
  if (x.length !== cell.mean.length) throw new RangeError(`hotellingT2: x has ${x.length} dims, cell expects ${cell.mean.length}`);
  let L = choleskyLocal(cell.cov);
  if (!L) {
    // ridge fallback: cov + εI (degenerate cell, e.g. a near-constant pooled set)
    const p = cell.cov.length;
    const eps = 1e-9;
    const ridged = cell.cov.map((row, i) => row.map((v, j) => (i === j ? v + eps : v)));
    L = choleskyLocal(ridged);
    if (!L) return Infinity; // still singular ⇒ maximally anomalous
  }
  return mahalanobisSqFromL(x, cell.mean, L);
}
