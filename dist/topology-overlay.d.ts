/** R82 pure-JS SHA-256 (FIPS 180-4). Public export for cross-platform parity testing
 *  (AC-R82-7); not consumed by any production engine code path. */
export declare function pureJsSha256(input: string): string;
import type { ConfiguredTopologyRef, TopologyCandidateEvent, TopologySnapshot, VerdictGroup, VerdictGroupEnrichedWithTopologyAuditEvent, VerdictGroupWithTopology } from './types';
/** Abstract topology-source contract per D1 Option E. v1 ships
 *  `OtelServiceGraphV1`; v2 adds Istio / K8s / Linkerd / custom impls
 *  against this same interface without VerdictGroupWithTopology
 *  consumer changes. */
export interface TopologySource {
    readonly id: string;
    readonly version: string;
    fetchSnapshot(ctx?: FetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
export interface FetchContext {
    /** Abort signal (timeout / orchestrator shutdown propagation). */
    signal?: AbortSignal;
}
export declare const OTEL_SERVICE_GRAPH_V1_ID = "otel_service_graph_v1";
/** Deterministic sha256 over sorted nodes + edges. Extracted as a free
 *  function so every TopologySource impl shares identical hash
 *  semantics (D6 archaeological-render requirement). */
export declare function computeSnapshotHash(snapshot: TopologySnapshot): string;
/** In-process TopologySource used by tests + any caller that has a
 *  pre-resolved snapshot. Real HTTP fetching lives in
 *  OtelServiceGraphV1 (slice-2 wires it to the orchestrator). */
export declare class StaticTopologySource implements TopologySource {
    readonly id: string;
    readonly version: string;
    private readonly snapshot;
    constructor(snapshot: TopologySnapshot, opts?: {
        id?: string;
        version?: string;
    });
    fetchSnapshot(_ctx?: FetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
/** v1 concrete TopologySource that pulls an OTel service-graph JSON
 *  payload from a customer-hosted endpoint (ConfiguredTopologyRef.uri).
 *
 *  Wire-format assumption: the URI serves an object of shape
 *  `{ nodes: TopologyNode[], edges: TopologyEdge[] }`. OTel semantic-
 *  convention normalization (Q2) is implementation-time work; this v1
 *  accepts the pre-normalized shape and fails fast on structural
 *  mismatch. Full OTel-spec parsing is a slice-2 follow-up. */
export declare class OtelServiceGraphV1 implements TopologySource {
    readonly id = "otel_service_graph_v1";
    readonly version = "v1.0";
    private readonly ref;
    private cached;
    constructor(ref: ConfiguredTopologyRef);
    fetchSnapshot(ctx?: FetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
/** Resolves a `VerdictGroup.deploy_id` to a node in the snapshot.
 *  Default heuristic: match by `metadata.deploy_id`, then by `id`,
 *  then by `service_name`. Operators override via
 *  `TopologyEnrichOpts.deployNodeResolver` when deploy-id conventions
 *  differ. */
export type DeployNodeResolver = (deploy_id: string, snapshot: TopologySnapshot) => string | null;
export declare const defaultDeployNodeResolver: DeployNodeResolver;
export interface TopologyEnrichOpts {
    source: TopologySource;
    /** BFS hop cap. Default 3 per CompilerOptions.topology_max_hop_distance. */
    max_hop_distance?: number;
    /** Correlation window (seconds) flanking the group's window. Default
     *  300 per CompilerOptions.topology_correlation_window_seconds. */
    correlation_window_seconds?: number;
    /** Override for the default deploy-id → node-id resolver. */
    deployNodeResolver?: DeployNodeResolver;
    /** Injected clock for deterministic tests. */
    now?: () => number;
}
export declare class TopologyEnricher {
    private readonly source;
    private readonly maxHop;
    private readonly corrWindowSeconds;
    private readonly resolver;
    private readonly now;
    constructor(opts: TopologyEnrichOpts);
    enrich(group: VerdictGroup, events?: TopologyCandidateEvent[]): Promise<VerdictGroupWithTopology>;
    /** BFS over the snapshot treating edges as bidirectional (topology
     *  correlation surfaces both upstream and downstream context).
     *  Returns hop distance per node up to `maxHop`; nodes beyond the
     *  cap are omitted. Iteration order is canonical (node ids sorted
     *  ascending) so ties in BFS enqueuing are deterministic. */
    private bfs;
    private rankCandidates;
    /** Intersection-over-union for interval events; linear proximity
     *  decay for point events within the correlation buffer. Returns 0
     *  when the event falls outside `[group.window_start_ts -
     *  corrWindow, group.window_end_ts + corrWindow]`. */
    private temporalOverlap;
}
/** Audit sink for enrichment outcomes. Kept separate from the existing
 *  `AuditWriter` (which carries per-tick `AuditRecord` shapes) so the
 *  new event type is a clean strict-additive surface per REPLY-48 D4.
 *  Orchestrator integration (slice with #25 slice-2) wires a concrete
 *  adapter that fans out to the primary audit stream. */
export interface TopologyAuditEmitter {
    emit(event: VerdictGroupEnrichedWithTopologyAuditEvent): void;
}
/** In-memory emitter for tests + harness-level end-to-end composition.
 *  Stores every emitted event on `.events` in receipt order. */
export declare class InMemoryTopologyAuditEmitter implements TopologyAuditEmitter {
    readonly events: VerdictGroupEnrichedWithTopologyAuditEvent[];
    emit(event: VerdictGroupEnrichedWithTopologyAuditEvent): void;
}
/** Project a `VerdictGroupWithTopology` into its audit-event shape per
 *  `audit/SCHEMA.md` v2.1 draft (slice-3 docs).
 *  `top_candidate` is `candidates[0]` (already sorted by the enricher);
 *  `null` on empty / degraded enrichment. */
export declare function projectToAuditEvent(result: VerdictGroupWithTopology): VerdictGroupEnrichedWithTopologyAuditEvent;
//# sourceMappingURL=topology-overlay.d.ts.map