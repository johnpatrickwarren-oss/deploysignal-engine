import { RobustCovarianceOptions } from './robust-covariance';
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
/** Compile a per-cell multivariate (Family-C) baseline. See the file header.
 *
 *  @param rows       `[observation][signal]` — the joint signal vectors.
 *  @param context    per-observation integer bin label in `0..nBins-1`.
 *  @param opts       `nBins` (required), confidence thresholds, adjacency pooling, and robustCovariance opts.
 *  @throws RangeError on length mismatch, empty/ragged/non-finite input, bad `nBins`/thresholds, or an
 *    out-of-range context label. */
export declare function compileMultivariateBaseline(rows: ReadonlyArray<ReadonlyArray<number>>, context: ReadonlyArray<number>, opts: MultivariateBaselineOptions): MultivariateBaseline;
/** Mahalanobis² of an observation vector against its cell `(mean, cov)` — the Hotelling-T² statistic. Large ⇒
 *  the vector is far from the cell's joint distribution (including off-correlation directions a per-signal
 *  check misses). A tiny diagonal ridge guards a non-PD cell covariance.
 *  @throws RangeError if `x` length ≠ the cell dimension. */
export declare function hotellingT2(x: ReadonlyArray<number>, cell: MultivariateCell): number;
//# sourceMappingURL=multivariate-baseline.d.ts.map