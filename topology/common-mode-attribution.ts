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
// ── ADR 0022 — NULL-MODEL CALIBRATION (2026-07-02 math audit, F11) ────────────
// The raw ≥ min_member_count rule has NO null model: under an (independent)
// per-shard false-fire rate α, a g-member group falsely surfaces as a candidate
// with probability ≈ C(g,2)·α² — QUADRATIC in group size, and the fleet-level
// false-candidate count is then linear in the number of groups. A 72-shard rack
// at α = 0.01 false-candidates at ≈ 0.15 per window; an absolute member-count
// threshold therefore means CANDIDATE STRENGTH DEPENDS ON RACK SIZE, and a toy
// sweep at small g cannot see the defect. Two optional, backward-compatible
// annotations calibrate this (computed only when the caller supplies the inputs):
//   • `binom_tail` — P(X ≥ k) for X ~ Binomial(g, α̂) with g = the node's FULL
//     group size (all shard-kind nodes within max_hop_distance, fired or not)
//     and k = the distinct counted fired members. Thresholding on binom_tail
//     (instead of the raw count) makes the false-candidate rate per group
//     ≈ the threshold, INVARIANT to group size. Assumes independent fires
//     under the null; positive co-firing dependence under the null makes the
//     tail ANTI-conservative (see ADR 0022 caveats).
//   • `group_e_value` — the arithmetic mean of the member shards' e-values over
//     ALL group members (fired or not). The mean of valid e-values is a valid
//     e-value, so this is calibrated group-level evidence whose validity is
//     INHERITED from the validity of the supplied per-shard e-values (engine
//     convention: no new guarantee is minted here).
//   • `coincidence_window_s` — a temporal coincidence requirement: only the
//     largest subset of fires that fits inside a sliding window of this many
//     seconds counts toward min_member_count (event_ts was previously only
//     min/max-aggregated, so fires days apart still clustered).
// All three are OPT-IN; calls without the new options produce byte-identical
// results to the pre-ADR-0022 behavior.
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

// ── Module constants ──────────────────────────────────────────────────

export const DEFAULT_MAX_HOP_DISTANCE = 1;
export const DEFAULT_MIN_MEMBER_COUNT = 2;
export const DEFAULT_CANDIDATE_NODE_KINDS: ReadonlyArray<TopologyNode['kind']> = ['psu', 'rack', 'cooling_zone'];

/** ADR 0022 — node kinds counted as GROUP MEMBERS when enumerating a
 *  candidate node's full group (for `group_size` / `group_e_value` /
 *  `binom_tail`): the compute-shard kinds. Infra kinds (psu / rack /
 *  cooling_zone / service / …) are not group members. */
export const SHARD_MEMBER_KINDS: ReadonlyArray<TopologyNode['kind']> = [
  'gpu_shard', 'tpu_shard', 'trainium_chip', 'inferentia_chip',
];

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

  // ── ADR 0022 optional-input validation ────────────────────────────
  const eValues = opts.per_shard_e_values;
  const fireRate = opts.fleet_fire_rate;
  const coincidenceS = opts.coincidence_window_s;
  if (fireRate !== undefined && !(Number.isFinite(fireRate) && fireRate > 0 && fireRate < 1)) {
    throw new RangeError(`attributeCommonMode: fleet_fire_rate must be in (0, 1); got ${fireRate}`);
  }
  if (coincidenceS !== undefined && !(Number.isFinite(coincidenceS) && coincidenceS >= 0)) {
    throw new RangeError(`attributeCommonMode: coincidence_window_s must be finite and >= 0; got ${coincidenceS}`);
  }
  const wantGroup = eValues !== undefined || fireRate !== undefined;
  const shardMemberKindsSet = new Set<TopologyNode['kind']>(SHARD_MEMBER_KINDS);

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
  for (const [sharedNodeId, allTouches] of touchesByNode) {
    // ADR 0022: temporal coincidence — when a window is configured, only the
    // largest co-firing subset that fits inside it counts. Absent = all touches
    // count (pre-ADR-0022 behavior, byte-identical).
    const touches = coincidenceS === undefined ? allTouches : largestCoincidentSubset(allTouches, coincidenceS);
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
    // event-ts: per-distinct-member-shard min/max, then aggregate across shards.
    // R26 MINOR-2: iterate per distinct shard, not all touches.
    // R38 MAJOR-1 fix: use shardLatest (not shardEarliest) in the max-aggregation path.
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;
    for (const sid of distinct) {
      const sidTouches = touches.filter((t) => t.member_shard_id === sid);
      const shardEarliest = Math.min(...sidTouches.map((t) => t.event_ts));
      const shardLatest = Math.max(...sidTouches.map((t) => t.event_ts));
      if (shardEarliest < earliest) earliest = shardEarliest;
      if (shardLatest > latest) latest = shardLatest;
    }
    const candidate: CommonModeCandidate = {
      shared_node_id: sharedNodeId,
      shared_node_kind: kind,
      member_shard_ids: distinct,
      member_count: distinct.length,
      topology_distance: maxOfMinHops,
      earliest_event_ts: earliest,
      latest_event_ts: latest,
      correlational_not_causal: true,
    };
    // ADR 0022 annotations — computed ONLY when the caller supplied the inputs,
    // so legacy calls produce objects with no new keys (backward compatible).
    if (wantGroup) {
      // Full group = shard-kind nodes within maxHop of the shared node, fired
      // or not, union-ed with the counted fired members (guarantees k ≤ g even
      // on a topology whose fired nodes use a non-shard kind).
      const group = new Set<string>(distinct);
      for (const [nodeId, hop] of bfsBounded(adjacency, sharedNodeId, maxHop)) {
        if (hop === 0) continue; // the shared node itself
        const k2 = kindById.get(nodeId);
        if (k2 !== undefined && shardMemberKindsSet.has(k2)) group.add(nodeId);
      }
      candidate.group_size = group.size;
      if (fireRate !== undefined) {
        candidate.binom_tail = binomialUpperTail(group.size, distinct.length, fireRate);
      }
      if (eValues !== undefined) {
        let sum = 0, covered = 0;
        for (const id of group) {
          const e = eValues.get(id);
          if (e === undefined) continue;
          if (!(Number.isFinite(e) && e >= 0)) {
            throw new RangeError(`attributeCommonMode: per_shard_e_values['${id}'] must be finite and >= 0; got ${e}`);
          }
          sum += e; covered++;
        }
        if (covered > 0) candidate.group_e_value = sum / covered;
      }
    }
    candidates.push(candidate);
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

// ── ADR 0022 helpers ──────────────────────────────────────────────────

/** Largest co-firing subset (ADR 0022 coincidence window): sort the touches by
 *  event_ts (shard id tiebreak for determinism) and slide a two-pointer window
 *  of `windowS` seconds; return the touches of the FIRST window that maximizes
 *  the DISTINCT member-shard count. The counted set therefore satisfies
 *  max(ts) − min(ts) ≤ windowS. O(n log n). */
function largestCoincidentSubset(
  touches: ReadonlyArray<{ member_shard_id: string; hop: number; event_ts: number }>,
  windowS: number,
): Array<{ member_shard_id: string; hop: number; event_ts: number }> {
  const sorted = [...touches].sort((a, b) =>
    a.event_ts - b.event_ts
    || (a.member_shard_id < b.member_shard_id ? -1 : a.member_shard_id > b.member_shard_id ? 1 : 0));
  const counts = new Map<string, number>();
  let distinct = 0, l = 0, bestCount = 0, bestL = 0, bestR = -1;
  for (let r = 0; r < sorted.length; r++) {
    const idR = sorted[r].member_shard_id;
    const cR = (counts.get(idR) ?? 0) + 1;
    counts.set(idR, cR);
    if (cR === 1) distinct++;
    while (sorted[r].event_ts - sorted[l].event_ts > windowS) {
      const idL = sorted[l].member_shard_id;
      const cL = counts.get(idL)! - 1;
      counts.set(idL, cL);
      if (cL === 0) distinct--;
      l++;
    }
    if (distinct > bestCount) { bestCount = distinct; bestL = l; bestR = r; }
  }
  return sorted.slice(bestL, bestR + 1);
}

/** P(X ≥ k) for X ~ Binomial(g, alpha), computed as a log-space sum
 *  (log-factorial table + logsumexp) — numerically stable for large g and
 *  tiny tails; no external deps. Exported for direct cross-checking in
 *  test/adr-0022-calibrated-group-attribution.test.ts. */
export function binomialUpperTail(g: number, k: number, alpha: number): number {
  if (!Number.isInteger(g) || g < 0) throw new RangeError(`binomialUpperTail: g must be a non-negative integer; got ${g}`);
  if (!Number.isInteger(k)) throw new RangeError(`binomialUpperTail: k must be an integer; got ${k}`);
  if (!(Number.isFinite(alpha) && alpha > 0 && alpha < 1)) {
    throw new RangeError(`binomialUpperTail: alpha must be in (0, 1); got ${alpha}`);
  }
  if (k <= 0) return 1;
  if (k > g) return 0;
  const logA = Math.log(alpha);
  const logB = Math.log1p(-alpha);
  const lf = new Array<number>(g + 1);
  lf[0] = 0;
  for (let i = 1; i <= g; i++) lf[i] = lf[i - 1] + Math.log(i);
  let maxLog = Number.NEGATIVE_INFINITY;
  const logs: number[] = [];
  for (let i = k; i <= g; i++) {
    const l = lf[g] - lf[i] - lf[g - i] + i * logA + (g - i) * logB;
    logs.push(l);
    if (l > maxLog) maxLog = l;
  }
  let s = 0;
  for (const l of logs) s += Math.exp(l - maxLog);
  const v = Math.exp(maxLog) * s;
  return v > 1 ? 1 : v;
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
