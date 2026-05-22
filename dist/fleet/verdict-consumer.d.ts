import type { FusedVerdict, VerdictGroup } from '../types/verdict';
import type { IngestResult, VerdictGrouper } from '../verdict-groups';
/** Per-tick payload for the fleet-merge consumer layer.
 *  cluster_event_id and terminal are optional; absent → legacy mode. */
export interface FleetTickInput {
    per_shard_verdicts: ReadonlyArray<FusedVerdict>;
    ts_seconds: number;
    cluster_event_id?: string;
    terminal?: boolean;
}
/** Fan-out result: one IngestResult per shard, index-order preserved. */
export interface FleetTickIngestResult {
    ingest_results: ReadonlyArray<IngestResult>;
}
/** Rollup of VerdictGroups sharing a cluster_event_id across one or more
 *  ticks' IngestResults. */
export interface ClusterEventRollup {
    groups: ReadonlyArray<VerdictGroup>;
    deploy_ids: ReadonlyArray<string>;
}
/** Fan out per_shard_verdicts to VerdictGrouper.ingest in array order,
 *  propagating cluster_event_id and terminal to every per-shard call.
 *  Empty per_shard_verdicts returns empty ingest_results without throwing
 *  (empty fleet-tick is semantically valid; see spec § 2.7). */
export declare function fleetTickIngest(input: FleetTickInput, grouper: VerdictGrouper): FleetTickIngestResult;
/** Consolidate IngestResults across one or more ticks into a per-cluster-event
 *  view. Operates on ReadonlyArray<IngestResult> (not FleetTickIngestResult)
 *  for cross-tick composability via .concat().
 *
 *  Empty-string cluster_event_id short-circuits to no-match per spec § 2.4 /
 *  R20 § 2.6 alignment. Dedupes groups by group_id (first-occurrence preserved).
 *  Strict === filter: undefined attributed_group.cluster_event_id never matches
 *  a non-empty query. */
export declare function rollupByClusterEvent(results: ReadonlyArray<IngestResult>, cluster_event_id: string): ClusterEventRollup;
//# sourceMappingURL=verdict-consumer.d.ts.map