// engine/topology/common-mode-attribution.ts — Tessera Phase 2 SLICE 3.C (R26) WU-04 MD-F4.
//
// Topology-aware spatial attribution layer. Consumes a list of fired per-shard
// events plus a TopologySnapshot (from HardwareTopologySource, R23) and surfaces
// common-mode candidates: shared hardware-substrate nodes (PSU / rack /
// cooling_zone) that have at least DEFAULT_MIN_MEMBER_COUNT fired shards within
// DEFAULT_MAX_HOP_DISTANCE. Each candidate carries the literal
// `correlational_not_causal: true` label per inherited Addition #26 D4.
//
// Operates DOWNSTREAM of per-shard detectors — does NOT modify detector
// internals (A12/A5). Re-implements BFS-on-undirected (matching the semantics
// of the inherited engine/topology-overlay.ts:262-285 private BFS) so that the
// inherited topology-overlay body stays at-pin (A12). Hash semantics delegate
// to the inherited computeSnapshotHash free function (Addition #26 D6).
//
// PR-F6 hybrid Reviewer evidence package: this module's behavior is exercised
// by the 4-cell matrix in test/q-md-f4-common-mode-injection.test.ts; the
// external literature citation package lives at coordination/evidence/PR-F6-
// EVIDENCE.md. The hybrid Reviewer pair-review runs at WU-05 SLICE 3 close per
// SCOPING-MEMO-v0.3 § 3 SLICE 3.C row.
//
// Tessera-original code (NOT vendored from DeploySignal). Extract target at
// Phase 2 close: @johnpatrickwarren-oss/deploysignal-engine.

import type { TopologyNode, TopologySnapshot } from '../types/verdict';
import { computeSnapshotHash } from '../topology-overlay';

// ── Public types ──────────────────────────────────────────────────────

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
  /** Min event_ts across all touch records contributing to this candidate
   *  (all appearances of each shard are considered; iteration over all
   *  touches, not per-distinct-shard dedup — R26 MINOR-2 docstring correction). */
  earliest_event_ts: number;
  /** Max event_ts across the same set of records. */
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

// ── Module constants ──────────────────────────────────────────────────

export const DEFAULT_MAX_HOP_DISTANCE = 1;
export const DEFAULT_MIN_MEMBER_COUNT = 2;
export const DEFAULT_CANDIDATE_NODE_KINDS: ReadonlyArray<TopologyNode['kind']> = ['psu', 'rack', 'cooling_zone'];

/** Canonical ordering for candidate sort. Lower index = earlier in
 *  output list. Restricted to the three hardware-substrate kinds; any
 *  other kind is excluded by candidate_node_kinds default and would
 *  not reach the sort step. */
const KIND_SORT_ORDER: Record<'psu' | 'rack' | 'cooling_zone', number> = {
  psu: 0,
  rack: 1,
  cooling_zone: 2,
};

// ── Public function ───────────────────────────────────────────────────

export function attributeCommonMode(
  input: CommonModeAttributionInput,
): CommonModeAttributionResult {
  const { fired_events, snapshot } = input;
  const opts = input.opts ?? {};
  const maxHop = opts.max_hop_distance ?? DEFAULT_MAX_HOP_DISTANCE;
  const minMembers = opts.min_member_count ?? DEFAULT_MIN_MEMBER_COUNT;
  const candidateKinds = opts.candidate_node_kinds ?? DEFAULT_CANDIDATE_NODE_KINDS;
  const candidateKindsSet = new Set<TopologyNode['kind']>(candidateKinds);
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));

  // Build adjacency (bidirectional).
  const adjacency = new Map<string, Set<string>>();
  for (const n of snapshot.nodes) adjacency.set(n.id, new Set());
  for (const e of snapshot.edges) {
    adjacency.get(e.from)?.add(e.to);
    adjacency.get(e.to)?.add(e.from);
  }

  // kind-by-id lookup.
  const kindById = new Map<string, TopologyNode['kind']>();
  for (const n of snapshot.nodes) kindById.set(n.id, n.kind);

  // For each fired event, BFS-bounded and collect candidate-node touches.
  // Structure: shared_node_id → array of (member_shard_id, hop, event_ts).
  const touchesByNode = new Map<
    string,
    Array<{ member_shard_id: string; hop: number; event_ts: number }>
  >();
  for (const ev of fired_events) {
    if (!adjacency.has(ev.shard_node_id)) continue; // F4: unknown shard silently skipped
    const hops = bfsBounded(adjacency, ev.shard_node_id, maxHop);
    for (const [nodeId, hop] of hops) {
      if (nodeId === ev.shard_node_id) continue;          // self-exclusion
      const kind = kindById.get(nodeId);
      if (kind === undefined) continue;                    // defensive (shouldn't happen)
      if (!candidateKindsSet.has(kind)) continue;
      const arr = touchesByNode.get(nodeId) ?? [];
      arr.push({ member_shard_id: ev.shard_node_id, hop, event_ts: ev.event_ts });
      touchesByNode.set(nodeId, arr);
    }
  }

  // Aggregate per candidate.
  const candidates: CommonModeCandidate[] = [];
  for (const [sharedNodeId, touches] of touchesByNode) {
    // distinct member shard ids (sorted lex asc).
    const distinct = Array.from(new Set(touches.map((t) => t.member_shard_id))).sort();
    if (distinct.length < minMembers) continue;            // F2 / F9: singleton not surfaced
    const kind = kindById.get(sharedNodeId);
    if (kind !== 'psu' && kind !== 'rack' && kind !== 'cooling_zone') continue;
    // topology_distance = max over distinct shards of min hop from that shard.
    let maxOfMinHops = 0;
    for (const sid of distinct) {
      const hops = touches.filter((t) => t.member_shard_id === sid).map((t) => t.hop);
      const minHop = Math.min(...hops);
      if (minHop > maxOfMinHops) maxOfMinHops = minHop;
    }
    // event-ts aggregates over records of distinct members.
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;
    for (const t of touches) {
      if (t.event_ts < earliest) earliest = t.event_ts;
      if (t.event_ts > latest) latest = t.event_ts;
    }
    candidates.push({
      shared_node_id: sharedNodeId,
      shared_node_kind: kind,
      member_shard_ids: distinct,
      member_count: distinct.length,
      topology_distance: maxOfMinHops,
      earliest_event_ts: earliest,
      latest_event_ts: latest,
      correlational_not_causal: true,
    });
  }

  // Sort: (kind canonical-order, then shared_node_id lex asc).
  candidates.sort((a, b) => {
    if (a.shared_node_kind !== b.shared_node_kind) {
      return KIND_SORT_ORDER[a.shared_node_kind] - KIND_SORT_ORDER[b.shared_node_kind];
    }
    return a.shared_node_id < b.shared_node_id ? -1 : a.shared_node_id > b.shared_node_id ? 1 : 0;
  });

  return {
    candidates,
    snapshot_hash: computeSnapshotHash(snapshot),
    attributed_at_ts: now(),
  };
}

// ── Private BFS ───────────────────────────────────────────────────────

/** Bounded BFS over a pre-built bidirectional adjacency map. Returns
 *  hop distance per node up to maxHop inclusive; nodes beyond cap are
 *  omitted. Neighbor visit order is canonical (lex asc by id) so
 *  identical inputs produce identical hop maps. Mirrors the semantics
 *  of the inherited private BFS at engine/topology-overlay.ts:262-285;
 *  re-implemented here so the inherited file stays at-pin (A12). */
function bfsBounded(
  adjacency: Map<string, Set<string>>,
  startId: string,
  maxHop: number,
): Map<string, number> {
  const hops = new Map<string, number>();
  hops.set(startId, 0);
  if (maxHop <= 0) return hops;
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curHop = hops.get(cur)!;
    if (curHop >= maxHop) continue;
    const neighbors = Array.from(adjacency.get(cur) ?? []).sort();
    for (const n of neighbors) {
      if (hops.has(n)) continue;
      hops.set(n, curHop + 1);
      queue.push(n);
    }
  }
  return hops;
}
