/** ADR 0022 — domains with 2..LOO_MAX_MEMBERS members are deflated against leave-one-out factors
 *  (one post-loop pass; see the file header). Domains above this size keep the all-members Tukey
 *  factor, whose breakdown point already handles a 1-of-many outlier. */
export declare const LOO_MAX_MEMBERS = 5;
export interface DetectionCommonModeOptions {
    /** Backfitting sweeps over the crossed partitions. Default 4 (FAIR: residual φ converges by ~4 sweeps;
     *  more sweeps buy little). Must be a positive integer. */
    iterations?: number;
    /** Reference-window length `[0, loadLen)` for the per-shard loading fit. Defaults to `calLen`. A LONGER
     *  reference identifies the factor loadings better (the dominant lever on residual quality), but it MUST be
     *  fault-free — it is the healthy reference. Integer in `1..ticks`. */
    loadLen?: number;
    /** Per-shard LEAVE-OUT group label (e.g. rack id; negative = no group). When set, each domain factor used
     *  for a shard is estimated with the shard's OWN leave-out group EXCLUDED — so a coherent group fault cannot
     *  be absorbed into the in-sample baseline it is measured against. It DOES fix absorption (ADR 0017: an
     *  in-sample baseline preserves only ~3.5/8 of a rack shift, leave-rack-out ~7.8/8 ≈ oracle).
     *  **BUT — important caveat — it is NOT a localisation win and is OFF by default.** Estimating a group's
     *  factor from OTHER groups, under HETEROGENEOUS loadings, leaves a per-group `(Δλ)·F` residual; since F is
     *  nonstationary, that bias is a TREND that does not cancel in the cal-vs-test e-value, so it inflates EVERY
     *  group's score and empirically DEGRADES rank-vs-fleet ranking (worse, not better — ADR 0017). Only use it
     *  when group loadings are near-homogeneous (then Δλ≈0). The clean fix for localisation remains true factor
     *  knowledge (oracle / temporal model), not leave-group-out. Cost: a domain with G distinct groups computes
     *  ~G factors per sweep. Length must equal the shard count. */
    leaveOutGroups?: ReadonlyArray<number>;
}
/** Detection-oriented common-mode residuals `R[i][t]`, via heterogeneous crossed-domain backfitting (see the
 *  file header). The common-mode is removed without absorbing single-shard faults, so the residual PRESERVES a
 *  fault in the test window — feed each row to a per-shard detector then a topology-PARTITIONED e-BH for
 *  localisation. This is a POWER tool, NOT an FDR guarantee on its (data-dependent) residual; keep
 *  `multiFactorRobustResiduals` for the guarantee path.
 *
 *  ADR 0022: domains with 2..LOO_MAX_MEMBERS members are deflated ONCE, after the sweeps, against
 *  leave-one-out factors (shard i vs the robust location of the OTHER members) — no self-absorption; a
 *  2-member domain becomes a pure pair contrast whose mirrored sibling excursion is intrinsic and documented
 *  (file header). Larger domains keep the iterated all-members factor.
 *
 *  @param X            `[shard][tick]` counter matrix.
 *  @param calLen       healthy reference-window length for the per-shard level (median over `[0, calLen)`).
 *  @param partitions   the crossed factor structure: one entry per factor kind, each an array of length
 *                      `n_shards` giving the domain label of each shard for that kind (negative = not a
 *                      member). E.g. `[coolDomainOf, powerDomainOf, fabricDomainOf, jobDomainOf]`.
 *  @param opts         `iterations` (backfitting sweeps, default 4), `loadLen` (loading-fit reference window,
 *                      default `calLen`), and `leaveOutGroups` (per-shard leave-out label, e.g. rack — when
 *                      set, each domain factor excludes the shard's own group so a coherent GROUP fault is not
 *                      absorbed into the baseline; see the option doc).
 *  @throws RangeError on an empty/ragged/non-finite matrix, `calLen`/`loadLen` out of `1..ticks`,
 *    non-positive `iterations`, no partitions, or a partition/leaveOutGroups whose length ≠ shard count. */
export declare function detectionOrientedResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number, partitions: ReadonlyArray<ReadonlyArray<number>>, opts?: DetectionCommonModeOptions): number[][];
//# sourceMappingURL=detection-common-mode.d.ts.map