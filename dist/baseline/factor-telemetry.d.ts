export interface FactorTelemetry {
    /** Measured factor signals on the analysis grid: `signals[k][t]`, each of length `ticks`. */
    signals: ReadonlyArray<ReadonlyArray<number>>;
    /** Stable id per factor (e.g. "cdu-0", "power-feed-3"); same order/length as `signals`; the product's
     *  vocabulary, resolved to indices by `resolveFactorMembership`. */
    factorIds: ReadonlyArray<string>;
    /** Grid origin (epoch), step, and length the product resampled to — must match the shard matrix's grid. */
    t0: number;
    dt: number;
    ticks: number;
}
/** Validate a FactorTelemetry against the analysis-grid length the shard matrix uses.
 *  @throws RangeError on a grid/length mismatch, non-finite value, id/signal count mismatch, or duplicate id. */
export declare function validateFactorTelemetry(ft: FactorTelemetry, ticks: number): void;
/** Map per-shard membership expressed as factor IDS (product vocabulary) to the integer index arrays that
 *  `instrumentedCommonModeResiduals` consumes (indices into `factorIds`). A shard may list zero factors.
 *  @throws RangeError if a membership entry references an unknown factor id. */
export declare function resolveFactorMembership(factorIds: ReadonlyArray<string>, membershipByFactorId: ReadonlyArray<ReadonlyArray<string>>): number[][];
export interface AlignOptions {
    /** Resampling rule. 'hold' = previous-sample-hold (default); 'linear' = linear interpolation between
     *  bracketing samples. */
    method?: 'hold' | 'linear';
    /** Max time gap (same units as timestamps) to fill; grid points farther than this from a usable sample get
     *  NaN (the product decides how to handle gaps). Default Infinity (always fill). */
    maxGap?: number;
}
/** Convenience aligner for the COMMON case: resample one irregular `(t, v)` stream onto the grid
 *  `t0 + i·dt`, i in `[0, ticks)`. Products with bespoke resampling skip this. Samples need not be sorted.
 *  Grid points with no usable sample within `maxGap` are left `NaN` (so `validateFactorTelemetry` will reject
 *  them unless the product fills them) — the engine never fabricates a value past the declared gap.
 *  @throws RangeError on bad grid params or a non-finite sample. */
export declare function alignToGrid(samples: ReadonlyArray<{
    t: number;
    v: number;
}>, t0: number, dt: number, ticks: number, opts?: AlignOptions): number[];
//# sourceMappingURL=factor-telemetry.d.ts.map