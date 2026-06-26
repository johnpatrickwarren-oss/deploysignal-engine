export interface InstrumentedCommonModeOptions {
    /** Ridge (Tikhonov) penalty added to the per-shard normal equations, to stabilise the loading fit when a
     *  shard's factors are collinear over the reference window. Default 0 (plain least squares). A small value
     *  (e.g. 1e-3 · mean factor energy) trades a little bias for conditioning. */
    ridge?: number;
}
/** Per-shard residuals after removing the INSTRUMENTED common-mode (ADR 0018). For each shard, the loadings on
 *  its (measured) factor signals are fit by least squares on the healthy reference window, then subtracted over
 *  all ticks — so a test-window fault is preserved, not absorbed. Feed the residuals to a per-shard detector +
 *  topology-partitioned e-BH for localisation (RANKING, not an FDR guarantee — see the file header).
 *
 *  @param X             `[shard][tick]` counter matrix.
 *  @param calLen        healthy reference-window length `[0, calLen)` for the level, the loading fit, and the
 *                       factor centring.
 *  @param factorSignals `[factor][tick]` the measured common-mode signals (one row per instrumented factor:
 *                       a CDU temp, a PDU power, a pod/rail network counter, a job allocation, …).
 *  @param membership    per shard, the factor indices it loads on (its domains): `membership[i]` ⊆
 *                       `0..factorSignals.length-1`. An empty list ⇒ that shard keeps its level-removed series.
 *  @param opts          `ridge` (default 0) to stabilise collinear per-shard fits.
 *  @throws RangeError on an empty/ragged/non-finite `X`, `calLen` ∉ `1..ticks`, a factor signal of the wrong
 *    length or non-finite, `membership` length ≠ shard count, or a membership index out of range. */
export declare function instrumentedCommonModeResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number, factorSignals: ReadonlyArray<ReadonlyArray<number>>, membership: ReadonlyArray<ReadonlyArray<number>>, opts?: InstrumentedCommonModeOptions): number[][];
//# sourceMappingURL=instrumented-common-mode.d.ts.map