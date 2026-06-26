import { DetectionCommonModeOptions } from './detection-common-mode';
import type { Window } from '../detectors/safe-t-e-value';
export interface LocalizeParams {
    /** `[shard][tick]` counter matrix. */
    X: ReadonlyArray<ReadonlyArray<number>>;
    /** Healthy reference-window length `[0, referenceLen)` for the detection common-mode (per-shard level +
     *  loading fit). Longer ⇒ better loading identification; MUST be fault-free. */
    referenceLen: number;
    /** UI e-value calibration window (the "before"). */
    cal: Window;
    /** UI e-value test/monitoring window (the "after" — where a fault is sought). */
    test: Window;
    /** Crossed factor structure for the common-mode: one entry per factor kind, each an array of length
     *  `n_shards` giving each shard's domain label for that kind (negative = not a member). */
    factorPartitions: ReadonlyArray<ReadonlyArray<number>>;
    /** Per-shard label for the topology-partitioned e-BH (e.g. rack id). e-BH runs within each label group. */
    localizationGroups: ReadonlyArray<number>;
    /** FDR target per group, in (0, 1]. */
    qLevel: number;
    /** Detection common-mode options (iterations, loadLen). `loadLen` defaults to `referenceLen`. */
    commonMode?: DetectionCommonModeOptions;
}
export interface LocalizeResult {
    /** Flagged shard indices (union over all groups), sorted ascending. */
    selected: number[];
    /** Per-shard UI e-value on the detection-common-mode residual (for ranking / diagnostics). */
    perShardEValue: number[];
    /** Per group: `groupLabel → selected shard indices in that group` (only groups with ≥1 selection). */
    byGroup: Map<number, number[]>;
}
/** Run the topology-localised fault-detection path (see the file header). Returns the flagged shards (a
 *  ranked localisation, NOT a certified FDR discovery set — see Scope).
 *
 *  @throws RangeError on an empty/ragged matrix, `referenceLen` out of bounds, `qLevel` ∉ (0,1], or
 *    `localizationGroups` length ≠ shard count. `factorPartitions` and the UI windows are validated by the
 *    underlying operators. */
export declare function localizeFaults(p: LocalizeParams): LocalizeResult;
//# sourceMappingURL=localize.d.ts.map