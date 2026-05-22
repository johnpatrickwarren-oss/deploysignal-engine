"use strict";
// engine/fleet/verdict-consumer.ts — Tessera Phase 2 SLICE 2.B (R21):
// fleet-merge consumer surface bridging per-shard FusedVerdict streams to
// VerdictGrouper with cluster_event_id propagation.
//
// Tessera-original code (NOT vendored from DeploySignal). Placed under
// engine/fleet/ parallel to the R11/R12/R13 fleet-merge math primitives
// (combine.ts / detectors.ts / e-bh.ts); orthogonal concern: math vs ingest.
//
// Per-tick cluster_event_id scope (Q3 disposition): one cluster_event_id value
// per fleetTickIngest call, propagated identically to all N per-shard ingests.
// Concurrent cluster events handled by caller-side iteration (two sequential
// fleetTickIngest calls with disjoint shard slices).
//
// e-BH orthogonality (Q4 disposition): engine/fleet/e-bh.ts stays
// cluster_event_id-agnostic at R21. Cluster-event-scoped FDR is a future-SLICE
// concern; FDR claim holds uniformly across cluster_event_id scope.
//
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2
// close commitment; matches the convention used by combine.ts / detectors.ts /
// e-bh.ts per SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetTickIngest = fleetTickIngest;
exports.rollupByClusterEvent = rollupByClusterEvent;
/** Fan out per_shard_verdicts to VerdictGrouper.ingest in array order,
 *  propagating cluster_event_id and terminal to every per-shard call.
 *  Empty per_shard_verdicts returns empty ingest_results without throwing
 *  (empty fleet-tick is semantically valid; see spec § 2.7). */
function fleetTickIngest(input, grouper) {
    const results = [];
    for (const verdict of input.per_shard_verdicts) {
        const r = grouper.ingest(verdict, input.ts_seconds, {
            cluster_event_id: input.cluster_event_id,
            terminal: input.terminal,
        });
        results.push(r);
    }
    return { ingest_results: results };
}
/** Consolidate IngestResults across one or more ticks into a per-cluster-event
 *  view. Operates on ReadonlyArray<IngestResult> (not FleetTickIngestResult)
 *  for cross-tick composability via .concat().
 *
 *  Empty-string cluster_event_id short-circuits to no-match per spec § 2.4 /
 *  R20 § 2.6 alignment. Dedupes groups by group_id (first-occurrence preserved).
 *  Strict === filter: undefined attributed_group.cluster_event_id never matches
 *  a non-empty query. */
function rollupByClusterEvent(results, cluster_event_id) {
    if (cluster_event_id === '') {
        return { groups: [], deploy_ids: [] };
    }
    const groups = [];
    const deploy_ids = [];
    const seen_group_ids = new Set();
    const seen_deploy_ids = new Set();
    for (const r of results) {
        const g = r.attributed_group;
        if (g.cluster_event_id !== cluster_event_id)
            continue;
        if (!seen_group_ids.has(g.group_id)) {
            seen_group_ids.add(g.group_id);
            groups.push(g);
        }
        if (!seen_deploy_ids.has(g.deploy_id)) {
            seen_deploy_ids.add(g.deploy_id);
            deploy_ids.push(g.deploy_id);
        }
    }
    return { groups, deploy_ids };
}
//# sourceMappingURL=verdict-consumer.js.map