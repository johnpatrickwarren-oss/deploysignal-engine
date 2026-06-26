export interface DetectionCommonModeOptions {
    /** Backfitting sweeps over the crossed partitions. Default 4 (FAIR: residual φ converges by ~4 sweeps;
     *  more sweeps buy little). Must be a positive integer. */
    iterations?: number;
    /** Reference-window length `[0, loadLen)` for the per-shard loading fit. Defaults to `calLen`. A LONGER
     *  reference identifies the factor loadings better (the dominant lever on residual quality), but it MUST be
     *  fault-free — it is the healthy reference. Integer in `1..ticks`. */
    loadLen?: number;
}
/** Detection-oriented common-mode residuals `R[i][t]`, via heterogeneous crossed-domain backfitting (see the
 *  file header). The common-mode is removed without absorbing single-shard faults, so the residual PRESERVES a
 *  fault in the test window — feed each row to a per-shard detector then a topology-PARTITIONED e-BH for
 *  localisation. This is a POWER tool, NOT an FDR guarantee on its (data-dependent) residual; keep
 *  `multiFactorRobustResiduals` for the guarantee path.
 *
 *  @param X            `[shard][tick]` counter matrix.
 *  @param calLen       healthy reference-window length for the per-shard level (median over `[0, calLen)`).
 *  @param partitions   the crossed factor structure: one entry per factor kind, each an array of length
 *                      `n_shards` giving the domain label of each shard for that kind (negative = not a
 *                      member). E.g. `[coolDomainOf, powerDomainOf, fabricDomainOf, jobDomainOf]`.
 *  @param opts         `iterations` (backfitting sweeps, default 4) and `loadLen` (loading-fit reference
 *                      window, default `calLen`).
 *  @throws RangeError on an empty/ragged/non-finite matrix, `calLen`/`loadLen` out of `1..ticks`,
 *    non-positive `iterations`, no partitions, or a partition whose length ≠ shard count. */
export declare function detectionOrientedResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number, partitions: ReadonlyArray<ReadonlyArray<number>>, opts?: DetectionCommonModeOptions): number[][];
//# sourceMappingURL=detection-common-mode.d.ts.map