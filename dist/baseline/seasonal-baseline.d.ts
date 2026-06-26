export interface SeasonalBaselineOptions {
    /** Number of context bins; context labels must be integers in `0..nBins-1` (e.g. 24 for hour-of-day, 168
     *  for hour×day-of-week). */
    nBins: number;
    /** Clean-sample count at/above which a bin is `strict` (trusted on its own). Default 60. */
    minStrict?: number;
    /** Clean-sample count at/above which a bin is `pooled` (usable but thin); below it the bin falls back to the
     *  aggregate. Default 20. */
    minPooled?: number;
    /** Robust trim cutoff in MAD-σ: samples with `|x − median| / (1.4826·MAD) > zCut` are dropped as anomalies
     *  before computing the clean mean/variance. Default 3.0. */
    zCut?: number;
    /** Variance floor relative to mean² (guards underflow / degenerate constant bins). Default 1e-6. */
    varFloorRel?: number;
}
export type BaselineConfidence = 'strict' | 'pooled' | 'aggregate' | 'none';
export interface BaselineCell {
    /** Clean-sample count behind this cell (after trimming). */
    n: number;
    mean: number;
    variance: number;
    confidence: BaselineConfidence;
}
export interface SeasonalBaseline {
    /** One cell per context bin (length nBins). A bin with too few clean samples is marked `aggregate` and
     *  carries the aggregate mean/variance (so lookups never miss). */
    bins: BaselineCell[];
    /** Robust clean-null over ALL clean samples — the sparse-bin fallback. */
    aggregate: BaselineCell;
}
/** Compile a per-bin robust clean-null baseline for one series. See the file header.
 *
 *  @param values   the historical samples.
 *  @param context  per-sample integer bin label in `0..nBins-1` (same length as `values`).
 *  @throws RangeError on length mismatch, empty input, non-finite values, bad `nBins`/thresholds, or a context
 *    label out of range. */
export declare function compileSeasonalBaseline(values: ReadonlyArray<number>, context: ReadonlyArray<number>, opts: SeasonalBaselineOptions): SeasonalBaseline;
/** Residualise a series against a compiled baseline: each observation minus its context bin's clean-null mean.
 *  The result has the predictable (calendar/seasonal) structure removed — feed it to a per-shard detector.
 *
 *  @throws RangeError on length mismatch, non-finite values, or a context label out of range for the baseline. */
export declare function seasonalBaselineResidual(values: ReadonlyArray<number>, context: ReadonlyArray<number>, baseline: SeasonalBaseline): number[];
//# sourceMappingURL=seasonal-baseline.d.ts.map