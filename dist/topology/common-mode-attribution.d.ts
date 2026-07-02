import type { TopologyNode, TopologySnapshot } from '../types/verdict';
/** A single fired-shard event consumed by the attribution layer. Lean,
 *  decoupled from FusedVerdict so callers can adapt from any per-shard
 *  detector surface (FusedVerdict, VerdictGroup, or future per-shard
 *  audit envelope). Phase 2 SLICE 4 (WU-06) will ship the adapter from
 *  FusedVerdict; this WU consumes FiredShardEvent directly. */
export interface FiredShardEvent {
    /** Must match a TopologyNode.id in the snapshot (typically a
     *  gpu_shard-kind node). If unmatched, the event is silently
     *  skipped (failure mode F4). */
    shard_node_id: string;
    /** Epoch seconds. Used for earliest_event_ts / latest_event_ts
     *  aggregation on each emitted candidate. */
    event_ts: number;
    /** Optional caller-supplied identifier for cross-referencing. Not
     *  used in attribution logic; passed through where convenient. */
    event_id?: string;
}
/** Common-mode candidate emitted by the attribution layer. Each
 *  candidate represents a shared hardware-substrate node that has
 *  ≥ min_member_count fired shards within max_hop_distance. */
export interface CommonModeCandidate {
    /** TopologyNode.id of the shared hardware-substrate node (PSU /
     *  rack / cooling_zone). */
    shared_node_id: string;
    /** TopologyNode.kind of the shared node. Constrained to the three
     *  hardware-substrate kinds added in R18 + R23. */
    shared_node_kind: 'psu' | 'rack' | 'cooling_zone';
    /** Distinct shard ids whose fired events reached this shared node
     *  within max_hop_distance. Sorted lex asc for determinism. */
    member_shard_ids: readonly string[];
    /** Cached length of member_shard_ids (avoids re-walking on
     *  consumers). */
    member_count: number;
    /** Max over distinct member shards of the min hop from that shard
     *  to shared_node_id. Always ≤ opts.max_hop_distance. For v9Y at
     *  max_hop=1 this is always 1. */
    topology_distance: number;
    /** Min over distinct member shards of that shard's earliest event_ts.
     *  per-distinct-shard dedup: one earliest value per distinct member_shard_id
     *  (min of all that shard's touches), then min across those per-shard values.
     *  R26 MINOR-2 fix; R38 MAJOR-1 extends the same dedup to latest_event_ts. */
    earliest_event_ts: number;
    /** Max over distinct member shards of that shard's latest event_ts.
     *  per-distinct-shard dedup: one latest value per distinct member_shard_id
     *  (max of all that shard's touches), then max across those per-shard values.
     *  R38 MAJOR-1 fix: was incorrectly using shardEarliest in the max path. */
    latest_event_ts: number;
    /** Literal `true` per inherited Addition #26 D4. Forces audit
     *  consumers to acknowledge the non-causal labeling in type
     *  contracts. NOT a boolean — the literal-type prevents any code
     *  path from setting this to `false`. */
    correlational_not_causal: true;
    /** ADR 0022 — present iff `per_shard_e_values` or `fleet_fire_rate`
     *  was supplied: the FULL group size g — every shard-kind node
     *  (SHARD_MEMBER_KINDS) within max_hop_distance of the shared node,
     *  fired or not (union-ed with the counted fired members so that
     *  member_count ≤ group_size always holds). */
    group_size?: number;
    /** ADR 0022 — present iff `per_shard_e_values` was supplied and at
     *  least one group member has an entry: the ARITHMETIC MEAN of the
     *  group members' e-values over ALL members of the group (not just
     *  fired ones). The mean of valid e-values is a valid e-value —
     *  validity is INHERITED from the supplied inputs (this module mints
     *  no guarantee of its own). Members missing from the map are
     *  excluded from the mean (equivalent to averaging over the covered
     *  sub-group — still a valid e-value if the supplied ones are). */
    group_e_value?: number;
    /** ADR 0022 — present iff `fleet_fire_rate` was supplied:
     *  P(X ≥ member_count) for X ~ Binomial(group_size, α̂), the
     *  size-calibrated co-firing score. Unlike the raw member count,
     *  thresholding on this is invariant to rack/group size (see the
     *  file-header null-model rationale). Computed with a log-space
     *  sum (numerically stable for large groups / tiny tails). */
    binom_tail?: number;
}
export interface CommonModeAttributionOpts {
    /** BFS hop cap from each fired shard. Default 1. */
    max_hop_distance?: number;
    /** Minimum distinct member shards required to surface a candidate.
     *  Default 2 (singletons are per-shard alarms, not common modes). */
    min_member_count?: number;
    /** Candidate-eligible TopologyNode.kind values. Default
     *  ['psu', 'rack', 'cooling_zone']. */
    candidate_node_kinds?: ReadonlyArray<TopologyNode['kind']>;
    /** Injected clock for deterministic tests. */
    now?: () => number;
    /** ADR 0022 (optional) — per-shard e-values keyed by shard node id,
     *  for ALL group members (not just fired ones). When supplied, each
     *  candidate is annotated with `group_e_value` (arithmetic mean over
     *  the group; validity inherited from the inputs). Values must be
     *  finite and ≥ 0 (e-values are non-negative). */
    per_shard_e_values?: ReadonlyMap<string, number>;
    /** ADR 0022 (optional) — α̂, the expected HEALTHY per-shard fire rate
     *  (e.g. the fleet-wide false-fire rate at the configured per-shard
     *  threshold). Must be in (0, 1). When supplied, each candidate is
     *  annotated with `binom_tail` = P(X ≥ k), X ~ Binomial(g, α̂). */
    fleet_fire_rate?: number;
    /** ADR 0022 (optional) — temporal coincidence window in seconds.
     *  When supplied, only the LARGEST subset of a node's fires whose
     *  event_ts values fit inside a sliding window of this length
     *  (max ts − min ts ≤ window; sort + two-pointer, first maximal
     *  window wins for determinism) counts toward min_member_count;
     *  member_shard_ids / member_count / timestamps / hop aggregation
     *  are computed over that counted subset only. Fires outside the
     *  window do not form a candidate. Absent = current behavior
     *  (no temporal requirement). Must be finite and ≥ 0. */
    coincidence_window_s?: number;
}
export interface CommonModeAttributionInput {
    fired_events: readonly FiredShardEvent[];
    snapshot: TopologySnapshot;
    opts?: CommonModeAttributionOpts;
}
export interface CommonModeAttributionResult {
    candidates: readonly CommonModeCandidate[];
    /** Deterministic sha256 over sorted nodes + sorted edges (delegated
     *  to inherited computeSnapshotHash). */
    snapshot_hash: string;
    /** Epoch seconds when attribution ran. */
    attributed_at_ts: number;
}
export declare const DEFAULT_MAX_HOP_DISTANCE = 1;
export declare const DEFAULT_MIN_MEMBER_COUNT = 2;
export declare const DEFAULT_CANDIDATE_NODE_KINDS: ReadonlyArray<TopologyNode['kind']>;
/** ADR 0022 — node kinds counted as GROUP MEMBERS when enumerating a
 *  candidate node's full group (for `group_size` / `group_e_value` /
 *  `binom_tail`): the compute-shard kinds. Infra kinds (psu / rack /
 *  cooling_zone / service / …) are not group members. */
export declare const SHARD_MEMBER_KINDS: ReadonlyArray<TopologyNode['kind']>;
export declare function attributeCommonMode(input: CommonModeAttributionInput): CommonModeAttributionResult;
/** P(X ≥ k) for X ~ Binomial(g, alpha), computed as a log-space sum
 *  (log-factorial table + logsumexp) — numerically stable for large g and
 *  tiny tails; no external deps. Exported for direct cross-checking in
 *  test/adr-0022-calibrated-group-attribution.test.ts. */
export declare function binomialUpperTail(g: number, k: number, alpha: number): number;
//# sourceMappingURL=common-mode-attribution.d.ts.map