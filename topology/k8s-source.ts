// engine/topology/k8s-source.ts — Tessera Phase 2 SLICE 3.B (R29).
//
// K8sNodeLabelSource — concrete impl of the inherited Addition #26
// TopologySource interface (engine/topology-overlay.ts:50-55) for K8s
// node-label metadata. Consumes a `corev1.NodeList`-structurally-subset
// JSON object (just .items[].metadata.{name,labels}) and produces a
// TopologySnapshot with three node kinds (cooling_zone for K8s zones,
// rack for K8s hosts, gpu_shard for inferred GPUs) plus 'contains'
// containment edges between them.
//
// Why existing kind literals (no vendored-with-deltas this round):
//   K8s zone → 'cooling_zone' (semantic stretch — K8s availability zones
//     correlate with thermal/power domains; closest pre-existing literal).
//   K8s host → 'rack' (single host as containment unit for its GPUs;
//     symmetric with v9Y multi-rack-cluster substrate convention).
//   GPU → 'gpu_shard' (exact match).
//   Region → metadata-only on host node (not BFS-walkable structure;
//     reflects R29 PRD scope which does not require region-level BFS).
//
// snapshotHash() delegates to inherited computeSnapshotHash; every
// TopologySource impl shares identical hash semantics per Addition #26 D6.
//
// Tessera-original code (NOT vendored from DeploySignal).

import type { TopologyEdge, TopologyNode, TopologySnapshot } from '../types/verdict';
import {
  computeSnapshotHash,
  type FetchContext,
  type TopologySource,
} from '../topology-overlay';

// Structural-subset input shape — only the fields this adapter reads from
// upstream K8s corev1.NodeList JSON. Importing the full corev1 types is
// out-of-scope (A8). Exported so callers + tests can type-check fixtures.
export interface K8sNodeList { items: K8sNode[]; }
export interface K8sNode {
  metadata: {
    name?: string;
    labels?: Record<string, string>;
  };
}

// Well-known label keys (exported as constants for readability + test reuse).
export const LABEL_ZONE = 'topology.kubernetes.io/zone';
export const LABEL_REGION = 'topology.kubernetes.io/region';
export const LABEL_INSTANCE_TYPE = 'node.kubernetes.io/instance-type';
export const LABEL_GPU_COUNT = 'nvidia.com/gpu.count';
export const LABEL_GPU_PRODUCT = 'nvidia.com/gpu.product';

export interface K8sNodeLabelSourceOpts {
  id?: string;
  version?: string;
  now?: () => number;
}

export class K8sNodeLabelSource implements TopologySource {
  readonly id: string;
  readonly version: string;
  private readonly snapshot: TopologySnapshot;

  constructor(nodeList: K8sNodeList, opts: K8sNodeLabelSourceOpts = {}) {
    this.id = opts.id ?? 'k8s_node_label_source';
    this.version = opts.version ?? 'k8s-1';
    const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.snapshot = parseNodeListToSnapshot(nodeList, this.id, this.version, now());
  }

  async fetchSnapshot(_ctx?: FetchContext): Promise<TopologySnapshot> {
    return this.snapshot;
  }

  snapshotHash(snapshot: TopologySnapshot): string {
    return computeSnapshotHash(snapshot);
  }
}

// Pure parsing helper. Exported for unit-test surface independent of class.
export function parseNodeListToSnapshot(
  nodeList: K8sNodeList,
  source_id: string,
  source_version: string,
  fetched_at_ts: number,
): TopologySnapshot {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const zoneNodesByZone = new Map<string, true>();

  for (const item of nodeList.items) {
    const name = item.metadata.name;
    if (typeof name !== 'string' || name.length === 0) continue;

    const labels = item.metadata.labels ?? {};
    const hostId = `host:${name}`;

    // Host node — always emitted when name is present.
    const hostMeta: Record<string, string> = {};
    const instType = labels[LABEL_INSTANCE_TYPE];
    if (typeof instType === 'string' && instType.length > 0) hostMeta.instance_type = instType;
    const region = labels[LABEL_REGION];
    if (typeof region === 'string' && region.length > 0) hostMeta.region = region;
    nodes.push({
      id: hostId,
      service_name: name,
      kind: 'rack',
      metadata: hostMeta,
    });

    // Zone node + zone→host edge (if zone label present).
    const zoneVal = labels[LABEL_ZONE];
    if (typeof zoneVal === 'string' && zoneVal.length > 0) {
      const zoneId = `zone:${zoneVal}`;
      if (!zoneNodesByZone.has(zoneVal)) {
        zoneNodesByZone.set(zoneVal, true);
        nodes.push({
          id: zoneId,
          service_name: zoneVal,
          kind: 'cooling_zone',
          metadata: {},
        });
      }
      edges.push({ from: zoneId, to: hostId, relationship: 'contains' });
    }

    // GPU shards — gated by gpu.count parse.
    const countRaw = labels[LABEL_GPU_COUNT];
    if (typeof countRaw === 'string') {
      const count = parseInt(countRaw, 10);
      if (Number.isInteger(count) && count >= 1) {
        const productRaw = labels[LABEL_GPU_PRODUCT];
        const product = typeof productRaw === 'string' && productRaw.length > 0 ? productRaw : undefined;
        for (let i = 0; i < count; i++) {
          const gpuId = `gpu:${name}:${i}`;
          const gpuMeta: Record<string, string> = { host: name };
          if (product !== undefined) gpuMeta.gpu_product = product;
          nodes.push({
            id: gpuId,
            service_name: `${name}/gpu-${i}`,
            kind: 'gpu_shard',
            metadata: gpuMeta,
          });
          edges.push({ from: hostId, to: gpuId, relationship: 'contains' });
        }
      }
    }
  }

  return {
    nodes,
    edges,
    fetched_at_ts,
    source_id,
    source_version,
  };
}
