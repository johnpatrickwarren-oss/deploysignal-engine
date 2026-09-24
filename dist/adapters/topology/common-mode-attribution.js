"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARD_MEMBER_KINDS = exports.DEFAULT_CANDIDATE_NODE_KINDS = exports.DEFAULT_MIN_MEMBER_COUNT = exports.DEFAULT_MAX_HOP_DISTANCE = void 0;
exports.attributeCommonMode = attributeCommonMode;
exports.binomialUpperTail = binomialUpperTail;
const topology_overlay_1 = require("../topology-overlay");
// ── Module constants ──────────────────────────────────────────────────
exports.DEFAULT_MAX_HOP_DISTANCE = 1;
exports.DEFAULT_MIN_MEMBER_COUNT = 2;
exports.DEFAULT_CANDIDATE_NODE_KINDS = ['psu', 'rack', 'cooling_zone'];
/** ADR 0022 — node kinds counted as GROUP MEMBERS when enumerating a
 *  candidate node's full group (for `group_size` / `group_e_value` /
 *  `binom_tail`): the compute-shard kinds. Infra kinds (psu / rack /
 *  cooling_zone / service / …) are not group members. */
exports.SHARD_MEMBER_KINDS = [
    'gpu_shard', 'tpu_shard', 'trainium_chip', 'inferentia_chip',
];
/** Canonical ordering for candidate sort. Lower index = earlier in
 *  output list. Restricted to the three hardware-substrate kinds; any
 *  other kind is excluded by candidate_node_kinds default and would
 *  not reach the sort step. */
const KIND_SORT_ORDER = {
    psu: 0,
    rack: 1,
    cooling_zone: 2,
};
// ── Public function ───────────────────────────────────────────────────
function attributeCommonMode(input) {
    const { fired_events, snapshot } = input;
    const opts = input.opts ?? {};
    const maxHop = opts.max_hop_distance ?? exports.DEFAULT_MAX_HOP_DISTANCE;
    const minMembers = opts.min_member_count ?? exports.DEFAULT_MIN_MEMBER_COUNT;
    const candidateKinds = opts.candidate_node_kinds ?? exports.DEFAULT_CANDIDATE_NODE_KINDS;
    const candidateKindsSet = new Set(candidateKinds);
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
    const shardMemberKindsSet = new Set(exports.SHARD_MEMBER_KINDS);
    // Build adjacency (bidirectional).
    const adjacency = new Map();
    for (const n of snapshot.nodes)
        adjacency.set(n.id, new Set());
    for (const e of snapshot.edges) {
        adjacency.get(e.from)?.add(e.to);
        adjacency.get(e.to)?.add(e.from);
    }
    // kind-by-id lookup.
    const kindById = new Map();
    for (const n of snapshot.nodes)
        kindById.set(n.id, n.kind);
    // For each fired event, BFS-bounded and collect candidate-node touches.
    // Structure: shared_node_id → array of (member_shard_id, hop, event_ts).
    const touchesByNode = new Map();
    for (const ev of fired_events) {
        if (!adjacency.has(ev.shard_node_id))
            continue; // F4: unknown shard silently skipped
        const hops = bfsBounded(adjacency, ev.shard_node_id, maxHop);
        for (const [nodeId, hop] of hops) {
            if (nodeId === ev.shard_node_id)
                continue; // self-exclusion
            const kind = kindById.get(nodeId);
            if (kind === undefined)
                continue; // defensive (shouldn't happen)
            if (!candidateKindsSet.has(kind))
                continue;
            const arr = touchesByNode.get(nodeId) ?? [];
            arr.push({ member_shard_id: ev.shard_node_id, hop, event_ts: ev.event_ts });
            touchesByNode.set(nodeId, arr);
        }
    }
    // Aggregate per candidate.
    const candidates = [];
    for (const [sharedNodeId, allTouches] of touchesByNode) {
        // ADR 0022: temporal coincidence — when a window is configured, only the
        // largest co-firing subset that fits inside it counts. Absent = all touches
        // count (pre-ADR-0022 behavior, byte-identical).
        const touches = coincidenceS === undefined ? allTouches : largestCoincidentSubset(allTouches, coincidenceS);
        // distinct member shard ids (sorted lex asc).
        const distinct = Array.from(new Set(touches.map((t) => t.member_shard_id))).sort();
        if (distinct.length < minMembers)
            continue; // F2 / F9: singleton not surfaced
        const kind = kindById.get(sharedNodeId);
        if (kind !== 'psu' && kind !== 'rack' && kind !== 'cooling_zone')
            continue;
        // topology_distance = max over distinct shards of min hop from that shard.
        let maxOfMinHops = 0;
        for (const sid of distinct) {
            const hops = touches.filter((t) => t.member_shard_id === sid).map((t) => t.hop);
            const minHop = Math.min(...hops);
            if (minHop > maxOfMinHops)
                maxOfMinHops = minHop;
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
            if (shardEarliest < earliest)
                earliest = shardEarliest;
            if (shardLatest > latest)
                latest = shardLatest;
        }
        const candidate = {
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
            const group = new Set(distinct);
            for (const [nodeId, hop] of bfsBounded(adjacency, sharedNodeId, maxHop)) {
                if (hop === 0)
                    continue; // the shared node itself
                const k2 = kindById.get(nodeId);
                if (k2 !== undefined && shardMemberKindsSet.has(k2))
                    group.add(nodeId);
            }
            candidate.group_size = group.size;
            if (fireRate !== undefined) {
                candidate.binom_tail = binomialUpperTail(group.size, distinct.length, fireRate);
            }
            if (eValues !== undefined) {
                let sum = 0, covered = 0;
                for (const id of group) {
                    const e = eValues.get(id);
                    if (e === undefined)
                        continue;
                    if (!(Number.isFinite(e) && e >= 0)) {
                        throw new RangeError(`attributeCommonMode: per_shard_e_values['${id}'] must be finite and >= 0; got ${e}`);
                    }
                    sum += e;
                    covered++;
                }
                if (covered > 0)
                    candidate.group_e_value = sum / covered;
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
        snapshot_hash: (0, topology_overlay_1.computeSnapshotHash)(snapshot),
        attributed_at_ts: now(),
    };
}
// ── ADR 0022 helpers ──────────────────────────────────────────────────
/** Largest co-firing subset (ADR 0022 coincidence window): sort the touches by
 *  event_ts (shard id tiebreak for determinism) and slide a two-pointer window
 *  of `windowS` seconds; return the touches of the FIRST window that maximizes
 *  the DISTINCT member-shard count. The counted set therefore satisfies
 *  max(ts) − min(ts) ≤ windowS. O(n log n). */
function largestCoincidentSubset(touches, windowS) {
    const sorted = [...touches].sort((a, b) => a.event_ts - b.event_ts
        || (a.member_shard_id < b.member_shard_id ? -1 : a.member_shard_id > b.member_shard_id ? 1 : 0));
    const counts = new Map();
    let distinct = 0, l = 0, bestCount = 0, bestL = 0, bestR = -1;
    for (let r = 0; r < sorted.length; r++) {
        const idR = sorted[r].member_shard_id;
        const cR = (counts.get(idR) ?? 0) + 1;
        counts.set(idR, cR);
        if (cR === 1)
            distinct++;
        while (sorted[r].event_ts - sorted[l].event_ts > windowS) {
            const idL = sorted[l].member_shard_id;
            const cL = counts.get(idL) - 1;
            counts.set(idL, cL);
            if (cL === 0)
                distinct--;
            l++;
        }
        if (distinct > bestCount) {
            bestCount = distinct;
            bestL = l;
            bestR = r;
        }
    }
    return sorted.slice(bestL, bestR + 1);
}
/** P(X ≥ k) for X ~ Binomial(g, alpha), computed as a log-space sum
 *  (log-factorial table + logsumexp) — numerically stable for large g and
 *  tiny tails; no external deps. Exported for direct cross-checking in
 *  test/adr-0022-calibrated-group-attribution.test.ts. */
function binomialUpperTail(g, k, alpha) {
    if (!Number.isInteger(g) || g < 0)
        throw new RangeError(`binomialUpperTail: g must be a non-negative integer; got ${g}`);
    if (!Number.isInteger(k))
        throw new RangeError(`binomialUpperTail: k must be an integer; got ${k}`);
    if (!(Number.isFinite(alpha) && alpha > 0 && alpha < 1)) {
        throw new RangeError(`binomialUpperTail: alpha must be in (0, 1); got ${alpha}`);
    }
    if (k <= 0)
        return 1;
    if (k > g)
        return 0;
    const logA = Math.log(alpha);
    const logB = Math.log1p(-alpha);
    const lf = new Array(g + 1);
    lf[0] = 0;
    for (let i = 1; i <= g; i++)
        lf[i] = lf[i - 1] + Math.log(i);
    let maxLog = Number.NEGATIVE_INFINITY;
    const logs = [];
    for (let i = k; i <= g; i++) {
        const l = lf[g] - lf[i] - lf[g - i] + i * logA + (g - i) * logB;
        logs.push(l);
        if (l > maxLog)
            maxLog = l;
    }
    let s = 0;
    for (const l of logs)
        s += Math.exp(l - maxLog);
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
function bfsBounded(adjacency, startId, maxHop) {
    const hops = new Map();
    hops.set(startId, 0);
    if (maxHop <= 0)
        return hops;
    const queue = [startId];
    while (queue.length > 0) {
        const cur = queue.shift();
        const curHop = hops.get(cur);
        if (curHop >= maxHop)
            continue;
        const neighbors = Array.from(adjacency.get(cur) ?? []).sort();
        for (const n of neighbors) {
            if (hops.has(n))
                continue;
            hops.set(n, curHop + 1);
            queue.push(n);
        }
    }
    return hops;
}
//# sourceMappingURL=common-mode-attribution.js.map