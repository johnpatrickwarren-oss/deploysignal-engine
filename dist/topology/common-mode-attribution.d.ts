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
export declare function attributeCommonMode(input: CommonModeAttributionInput): CommonModeAttributionResult;
//# sourceMappingURL=common-mode-attribution.d.ts.map