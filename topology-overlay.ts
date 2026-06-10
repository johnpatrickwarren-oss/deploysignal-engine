// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/topology-overlay.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/topology-overlay.ts — Addition #26 (ARCHITECT-REPLY-48) enrichment layer.
//
// Post-#25 VerdictGroup enrichment. Pure-additive; VerdictGroup schema
// stays untouched per D5. Orchestrator wiring is slice-2 — this module
// ships the substrate (TopologySource interface + OtelServiceGraphV1 +
// TopologyEnricher) alongside unit tests that use StaticTopologySource
// for in-memory fixtures.
//
// Non-blocking contract: TopologyEnricher.enrich returns a Promise; the
// orchestrator is expected to fire-and-forget on VerdictGroup close
// (audit event emission follows on resolution). Enrichment failures
// degrade gracefully — VerdictGroupWithTopology emits with empty
// candidates + `enrichment_error` set (Q1 lean).
//
// Determinism:
//   - Snapshot hash sorts nodes by `id` and edges by (`from`, `to`,
//     `relationship`) before JSON-stringify + sha256 (D6).
//   - Candidate ordering is `temporal_overlap_ratio` desc, then
//     `topology_distance` asc, then `node_id` lex asc (tie-break per
//     P5 guidance).
//   - BFS visits in canonical id order so identical inputs produce
//     identical candidate lists.

// ── R82 Web Crypto adapter (replaces top-level `import { createHash } from 'node:crypto';`) ──
// Sync surface preserved per A12 + R82 anti-scope (all callers of computeSnapshotHash
// receive `string`, not `Promise<string>`).
//
// In Node: lazy `require('node:crypto')` succeeds.
// In browser bundle: `require` is undefined → ReferenceError caught → falls through to
// embedded pure-JS SHA-256 (FIPS 180-4 reference implementation).

/** R82 pure-JS SHA-256 (FIPS 180-4). Public export for cross-platform parity testing
 *  (AC-R82-7); not consumed by any production engine code path. */
export function pureJsSha256(input: string): string {
  // FIPS 180-4 SHA-256 round constants: first 32 bits of fractional parts of cube roots
  // of the first 64 primes.
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  // Initial hash values: first 32 bits of fractional parts of square roots of first 8 primes.
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  // Encode input as UTF-8 bytes (snapshot canonical is JSON → ASCII-safe).
  const enc = new TextEncoder();
  const msgBytes = enc.encode(input);
  const msgLen = msgBytes.length;

  // Pre-processing: append 0x80, zeros, then 64-bit big-endian bit-length.
  // Total padded length = smallest N*64 such that msgLen+1+8 <= N*64.
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 9 + 63) & ~63); // next multiple of 64
  const padded = new Uint8Array(padLen);
  padded.set(msgBytes);
  padded[msgLen] = 0x80;
  // Write 64-bit big-endian bit length at the end (only low 32 bits needed for <512MB).
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  // Process each 512-bit (64-byte) block.
  const W = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i - 15], 7) ^ rotr32(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr32(W[i - 2], 17) ^ rotr32(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
  }
  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function _sha256Hex(input: string): string {
  try {
    if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nc = require('node:crypto') as typeof import('node:crypto');
      return nc.createHash('sha256').update(input).digest('hex');
    }
  } catch {
    // require failed (browser-bundle path) → fall through to embedded pure-JS.
  }
  return pureJsSha256(input);
}

import type {
  ConfiguredTopologyRef,
  TopologyCandidate,
  TopologyCandidateEvent,
  TopologyEdge,
  TopologyNode,
  TopologySnapshot,
  VerdictGroup,
  VerdictGroupEnrichedWithTopologyAuditEvent,
  VerdictGroupWithTopology,
} from './types';

// ── TopologySource interface + concrete impls ──────────────────────

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

export const OTEL_SERVICE_GRAPH_V1_ID = 'otel_service_graph_v1';
const DEFAULT_FETCH_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_SECONDS = 60;

/** Deterministic sha256 over sorted nodes + edges. Extracted as a free
 *  function so every TopologySource impl shares identical hash
 *  semantics (D6 archaeological-render requirement). */
export function computeSnapshotHash(snapshot: TopologySnapshot): string {
  const nodes = [...snapshot.nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const edges = [...snapshot.edges].sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return a.relationship < b.relationship ? -1 : a.relationship > b.relationship ? 1 : 0;
  });
  const canonical = JSON.stringify({ nodes, edges });
  return _sha256Hex(canonical);
}

/** In-process TopologySource used by tests + any caller that has a
 *  pre-resolved snapshot. Real HTTP fetching lives in
 *  OtelServiceGraphV1 (slice-2 wires it to the orchestrator). */
export class StaticTopologySource implements TopologySource {
  readonly id: string;
  readonly version: string;
  private readonly snapshot: TopologySnapshot;

  constructor(snapshot: TopologySnapshot, opts: { id?: string; version?: string } = {}) {
    this.snapshot = snapshot;
    this.id = opts.id ?? snapshot.source_id ?? 'static_topology_source';
    this.version = opts.version ?? snapshot.source_version ?? 'static-1';
  }

  async fetchSnapshot(_ctx?: FetchContext): Promise<TopologySnapshot> {
    return this.snapshot;
  }

  snapshotHash(snapshot: TopologySnapshot): string {
    return computeSnapshotHash(snapshot);
  }
}

/** v1 concrete TopologySource that pulls an OTel service-graph JSON
 *  payload from a customer-hosted endpoint (ConfiguredTopologyRef.uri).
 *
 *  Wire-format assumption: the URI serves an object of shape
 *  `{ nodes: TopologyNode[], edges: TopologyEdge[] }`. OTel semantic-
 *  convention normalization (Q2) is implementation-time work; this v1
 *  accepts the pre-normalized shape and fails fast on structural
 *  mismatch. Full OTel-spec parsing is a slice-2 follow-up. */
export class OtelServiceGraphV1 implements TopologySource {
  readonly id = OTEL_SERVICE_GRAPH_V1_ID;
  readonly version = 'v1.0';
  private readonly ref: ConfiguredTopologyRef;
  private cached: { snapshot: TopologySnapshot; fetched_at_ts: number } | null = null;

  constructor(ref: ConfiguredTopologyRef) {
    this.ref = ref;
  }

  async fetchSnapshot(ctx?: FetchContext): Promise<TopologySnapshot> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.ref.cache_ttl_seconds ?? DEFAULT_CACHE_TTL_SECONDS;
    if (this.cached && now - this.cached.fetched_at_ts < ttl) {
      return this.cached.snapshot;
    }

    const timeoutMs = this.ref.fetch_timeout_ms ?? DEFAULT_FETCH_TIMEOUT_MS;
    const abort = new AbortController();
    const upstreamSignal = ctx?.signal;
    // Remediation 2026-06-10 L6: keep a reference to the abort forwarder so
    // it can be removed once the fetch settles — `{ once: true }` only fires
    // listeners that abort; on a long-lived upstream signal the per-fetch
    // listeners otherwise accumulate.
    const onUpstreamAbort = () => abort.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) abort.abort();
      else upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
    }
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(this.ref.uri, { signal: abort.signal });
      if (!res.ok) throw new Error(`TOPOLOGY_FETCH_HTTP_${res.status}`);
      const body = (await res.json()) as { nodes?: unknown; edges?: unknown };
      if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
        throw new Error('TOPOLOGY_FETCH_MALFORMED');
      }
      const snapshot: TopologySnapshot = {
        nodes: body.nodes as TopologyNode[],
        edges: body.edges as TopologyEdge[],
        fetched_at_ts: now,
        source_id: this.id,
        source_version: this.version,
      };
      this.cached = { snapshot, fetched_at_ts: now };
      return snapshot;
    } finally {
      clearTimeout(timer);
      if (upstreamSignal) upstreamSignal.removeEventListener('abort', onUpstreamAbort);
    }
  }

  snapshotHash(snapshot: TopologySnapshot): string {
    return computeSnapshotHash(snapshot);
  }
}

// ── TopologyEnricher ───────────────────────────────────────────────

/** Resolves a `VerdictGroup.deploy_id` to a node in the snapshot.
 *  Default heuristic: match by `metadata.deploy_id`, then by `id`,
 *  then by `service_name`. Operators override via
 *  `TopologyEnrichOpts.deployNodeResolver` when deploy-id conventions
 *  differ. */
export type DeployNodeResolver = (
  deploy_id: string,
  snapshot: TopologySnapshot,
) => string | null;

export const defaultDeployNodeResolver: DeployNodeResolver = (deploy_id, snapshot) => {
  for (const n of snapshot.nodes) if (n.metadata?.deploy_id === deploy_id) return n.id;
  for (const n of snapshot.nodes) if (n.id === deploy_id) return n.id;
  for (const n of snapshot.nodes) if (n.service_name === deploy_id) return n.id;
  return null;
};

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

const DEFAULT_MAX_HOP = 3;
const DEFAULT_CORRELATION_WINDOW_SECONDS = 300;

export class TopologyEnricher {
  private readonly source: TopologySource;
  private readonly maxHop: number;
  private readonly corrWindowSeconds: number;
  private readonly resolver: DeployNodeResolver;
  private readonly now: () => number;

  constructor(opts: TopologyEnrichOpts) {
    this.source = opts.source;
    this.maxHop = opts.max_hop_distance ?? DEFAULT_MAX_HOP;
    this.corrWindowSeconds = opts.correlation_window_seconds ?? DEFAULT_CORRELATION_WINDOW_SECONDS;
    this.resolver = opts.deployNodeResolver ?? defaultDeployNodeResolver;
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async enrich(
    group: VerdictGroup,
    events: TopologyCandidateEvent[] = [],
    ctx?: FetchContext,
  ): Promise<VerdictGroupWithTopology> {
    const enrichedAt = this.now();
    let snapshot: TopologySnapshot;
    try {
      // Optional FetchContext threaded through to the source (remediation
      // 2026-06-10 L6) so callers can propagate cancellation.
      snapshot = await this.source.fetchSnapshot(ctx);
    } catch (err) {
      return {
        group_id: group.group_id,
        topology_source_id: this.source.id,
        topology_snapshot_hash: null,
        candidates: [],
        enriched_at_ts: enrichedAt,
        enrichment_error: err instanceof Error ? err.message : String(err),
      };
    }

    const snapshotHash = this.source.snapshotHash(snapshot);
    const startNodeId = this.resolver(group.deploy_id, snapshot);
    if (startNodeId === null) {
      return {
        group_id: group.group_id,
        topology_source_id: this.source.id,
        topology_snapshot_hash: snapshotHash,
        candidates: [],
        enriched_at_ts: enrichedAt,
        enrichment_error: 'DEPLOY_NODE_NOT_IN_TOPOLOGY',
      };
    }

    const hopByNode = this.bfs(snapshot, startNodeId);
    const candidates = this.rankCandidates(group, snapshot, events, hopByNode);

    return {
      group_id: group.group_id,
      topology_source_id: this.source.id,
      topology_snapshot_hash: snapshotHash,
      candidates,
      enriched_at_ts: enrichedAt,
      enrichment_error: null,
    };
  }

  /** BFS over the snapshot treating edges as bidirectional (topology
   *  correlation surfaces both upstream and downstream context).
   *  Returns hop distance per node up to `maxHop`; nodes beyond the
   *  cap are omitted. Iteration order is canonical (node ids sorted
   *  ascending) so ties in BFS enqueuing are deterministic. */
  private bfs(snapshot: TopologySnapshot, startId: string): Map<string, number> {
    const adjacency = new Map<string, Set<string>>();
    for (const n of snapshot.nodes) adjacency.set(n.id, new Set());
    for (const e of snapshot.edges) {
      adjacency.get(e.from)?.add(e.to);
      adjacency.get(e.to)?.add(e.from);
    }

    const hops = new Map<string, number>();
    hops.set(startId, 0);
    const queue: string[] = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curHop = hops.get(cur)!;
      if (curHop >= this.maxHop) continue;
      const neighbors = Array.from(adjacency.get(cur) ?? []).sort();
      for (const n of neighbors) {
        if (hops.has(n)) continue;
        hops.set(n, curHop + 1);
        queue.push(n);
      }
    }
    return hops;
  }

  private rankCandidates(
    group: VerdictGroup,
    snapshot: TopologySnapshot,
    events: TopologyCandidateEvent[],
    hopByNode: Map<string, number>,
  ): TopologyCandidate[] {
    const nodeById = new Map<string, TopologyNode>();
    for (const n of snapshot.nodes) nodeById.set(n.id, n);

    const out: TopologyCandidate[] = [];
    for (const ev of events) {
      const hop = hopByNode.get(ev.node_id);
      if (hop === undefined) continue; // beyond maxHop or unknown node
      const overlap = this.temporalOverlap(group, ev);
      if (overlap <= 0) continue; // D4-adjacent: zero-overlap dropped
      const node = nodeById.get(ev.node_id);
      if (!node) continue;
      out.push({
        node_id: ev.node_id,
        service_name: node.service_name,
        topology_distance: hop,
        temporal_overlap_ratio: overlap,
        candidate_event_type: ev.event_type,
        candidate_event_id: ev.event_id,
        candidate_event_ts: ev.event_ts,
        correlational_not_causal: true,
      });
    }

    // D4 ordering: overlap desc, distance asc, node_id lex asc.
    out.sort((a, b) => {
      if (a.temporal_overlap_ratio !== b.temporal_overlap_ratio) {
        return b.temporal_overlap_ratio - a.temporal_overlap_ratio;
      }
      if (a.topology_distance !== b.topology_distance) {
        return a.topology_distance - b.topology_distance;
      }
      return a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0;
    });
    return out;
  }

  /** Intersection-over-union for interval events; linear proximity
   *  decay for point events within the correlation buffer. Returns 0
   *  when the event falls outside `[group.window_start_ts -
   *  corrWindow, group.window_end_ts + corrWindow]`. */
  private temporalOverlap(group: VerdictGroup, ev: TopologyCandidateEvent): number {
    const gs = group.window_start_ts;
    const ge = group.window_end_ts;
    if (
      ev.event_window_start_ts !== undefined &&
      ev.event_window_end_ts !== undefined &&
      ev.event_window_end_ts >= ev.event_window_start_ts
    ) {
      const es = ev.event_window_start_ts;
      const ee = ev.event_window_end_ts;
      const inter = Math.max(0, Math.min(ge, ee) - Math.max(gs, es));
      const union = Math.max(ge, ee) - Math.min(gs, es);
      return union > 0 ? inter / union : 0;
    }
    // Point event: 1.0 inside [gs, ge]; linear decay to 0 across
    // corrWindow either side; 0 beyond.
    if (ev.event_ts >= gs && ev.event_ts <= ge) return 1;
    const dist = ev.event_ts < gs ? gs - ev.event_ts : ev.event_ts - ge;
    if (dist > this.corrWindowSeconds) return 0;
    return 1 - dist / this.corrWindowSeconds;
  }
}

// ── Audit-event emission ────────────────────────────────────────────

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
export class InMemoryTopologyAuditEmitter implements TopologyAuditEmitter {
  readonly events: VerdictGroupEnrichedWithTopologyAuditEvent[] = [];
  emit(event: VerdictGroupEnrichedWithTopologyAuditEvent): void {
    this.events.push(event);
  }
}

/** Project a `VerdictGroupWithTopology` into its audit-event shape per
 *  `audit/SCHEMA.md` v2.1 draft (slice-3 docs).
 *  `top_candidate` is `candidates[0]` (already sorted by the enricher);
 *  `null` on empty / degraded enrichment. */
export function projectToAuditEvent(
  result: VerdictGroupWithTopology,
): VerdictGroupEnrichedWithTopologyAuditEvent {
  return {
    type: 'verdict_group_enriched_with_topology',
    group_id: result.group_id,
    topology_source_id: result.topology_source_id,
    topology_snapshot_hash: result.topology_snapshot_hash,
    n_candidates: result.candidates.length,
    top_candidate: result.candidates.length > 0 ? result.candidates[0] : null,
    enriched_at_ts: result.enriched_at_ts,
    enrichment_error: result.enrichment_error ?? null,
  };
}
