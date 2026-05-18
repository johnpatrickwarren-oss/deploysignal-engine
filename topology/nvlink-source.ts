// engine/topology/nvlink-source.ts — Phase 2 SLICE 3.B WU-03 NVLink topology adapter (R30).
//
// Three exports:
//   1. parseNvlinkStatus(rawText, opts) — pure regex-based parser for
//      `nvidia-smi nvlink --status` text output. Produces a TopologySnapshot
//      with `gpu_shard` nodes (per R18 enum) and `nvlink_peer` edges (per R23
//      enum). Edges are undirected-deduped: one canonical edge per peer pair
//      with from = min(gpu-A, gpu-B) (lex order on the `gpu-N` id form).
//      Multi-link aggregation: if GPU 0 has multiple Link entries to GPU 1,
//      one canonical edge is emitted (not one per link). Sparse handling:
//      input with GPU blocks but no `Peer GPU` lines → nodes only, edges = [],
//      partial = true. Empty / no `GPU N:` blocks → throws
//      `NVLINK_PARSE_NO_GPU_BLOCKS`.
//   2. NvlinkTopologySource — thin TopologySource impl wrapping the parser.
//      Structurally parallel to HardwareTopologySource (R23).
//      snapshotHash delegates to computeSnapshotHash per Addition #26 D6.
//   3. ingestNvlinkErrorCounter — thin wrapper around transformPair baking
//      in NVLink-specific counter_width: 32. Adapter glue for L0-contract
//      consumption per CLUSTER-HANDOFF-1-WU00-WU03.md.
//
// Tessera-original code (NOT vendored from DeploySignal).

import type { TopologyNode, TopologyEdge, TopologySnapshot } from '../types/verdict';
import {
  computeSnapshotHash,
  type FetchContext,
  type TopologySource,
} from '../topology-overlay';
import {
  transformPair,
  type CounterMetadata,
  type CounterSample,
  type RateSample,
  type TransformOpts,
} from '../l0/counter-rate-transform';

export interface NvlinkParseOpts {
  /** Epoch-seconds timestamp for the produced snapshot. Defaults to current wall clock. */
  fetched_at_ts?: number;
  /** Source-id literal for the produced snapshot. Defaults to 'nvlink_topology_source'. */
  source_id?: string;
  /** Source-version literal for the produced snapshot. Defaults to 'nvlink-1'. */
  source_version?: string;
}

export interface NvlinkParseResult {
  snapshot: TopologySnapshot;
  /** true iff GPU blocks were parsed but no Peer-GPU lines yielded edges. */
  partial: boolean;
}

const GPU_HEADER_RE = /^GPU\s+(\d+):/;
const LINK_PEER_RE  = /^\s*Link\s+\d+:.*?Peer\s+GPU\s+(\d+)/i;

export function parseNvlinkStatus(rawText: string, opts: NvlinkParseOpts = {}): NvlinkParseResult {
  const nodes: TopologyNode[] = [];
  const nodeIds: Set<string> = new Set();
  const rawEdgePairs: Array<[string, string]> = [];
  let currentGpuId: string | null = null;

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine; // do NOT trim — header pattern relies on leading-anchored regex
    const gpuMatch = GPU_HEADER_RE.exec(line);
    if (gpuMatch) {
      const id = `gpu-${gpuMatch[1]}`;
      currentGpuId = id;
      if (!nodeIds.has(id)) {
        nodes.push({ id, service_name: id, kind: 'gpu_shard' });
        nodeIds.add(id);
      }
      continue;
    }
    const linkMatch = LINK_PEER_RE.exec(line);
    if (linkMatch && currentGpuId !== null) {
      const peerId = `gpu-${linkMatch[1]}`;
      rawEdgePairs.push([currentGpuId, peerId]);
      // peer GPU may not yet have its own GPU N: header parsed — emit its node opportunistically
      if (!nodeIds.has(peerId)) {
        nodes.push({ id: peerId, service_name: peerId, kind: 'gpu_shard' });
        nodeIds.add(peerId);
      }
      continue;
    }
  }

  if (nodes.length === 0) {
    throw new Error('NVLINK_PARSE_NO_GPU_BLOCKS');
  }

  const edgeKeys = new Set<string>();
  const edges: TopologyEdge[] = [];
  for (const [a, b] of rawEdgePairs) {
    if (a === b) continue; // ignore self-peer (shouldn't occur but defend)
    const from = a < b ? a : b;
    const to   = a < b ? b : a;
    const key  = `${from}|${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, relationship: 'nvlink_peer' });
  }

  const partial = edges.length === 0;

  const snapshot: TopologySnapshot = {
    nodes,
    edges,
    fetched_at_ts: opts.fetched_at_ts ?? Math.floor(Date.now() / 1000),
    source_id:     opts.source_id     ?? 'nvlink_topology_source',
    source_version: opts.source_version ?? 'nvlink-1',
  };

  return { snapshot, partial };
}

export class NvlinkTopologySource implements TopologySource {
  readonly id: string;
  readonly version: string;
  private readonly snapshot: TopologySnapshot;

  constructor(rawText: string, opts: {
    id?: string;
    version?: string;
    fetched_at_ts?: number;
    source_id?: string;
    source_version?: string;
  } = {}) {
    const { snapshot } = parseNvlinkStatus(rawText, {
      fetched_at_ts: opts.fetched_at_ts,
      source_id: opts.source_id,
      source_version: opts.source_version,
    });
    this.snapshot = snapshot;
    // Third operands ('nvlink_topology_source' / 'nvlink-1') are structurally unreachable:
    // parseNvlinkStatus always defaults snapshot.source_id / source_version (typed string, never
    // undefined). Retained for defensive correctness if parseNvlinkStatus is ever modified.
    this.id      = opts.id      ?? snapshot.source_id     ?? 'nvlink_topology_source';
    this.version = opts.version ?? snapshot.source_version ?? 'nvlink-1';
  }

  async fetchSnapshot(_ctx?: FetchContext): Promise<TopologySnapshot> {
    return this.snapshot;
  }

  snapshotHash(snapshot: TopologySnapshot): string {
    return computeSnapshotHash(snapshot);
  }
}

export function ingestNvlinkErrorCounter(
  prev: CounterSample,
  next: CounterSample,
  opts: TransformOpts,
): RateSample {
  const meta: CounterMetadata = { semantic_type: 'counter', counter_width: 32 };
  return transformPair(prev, next, meta, opts);
}
