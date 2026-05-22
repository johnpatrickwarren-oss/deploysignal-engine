"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.K8sNodeLabelSource = exports.LABEL_GPU_PRODUCT = exports.LABEL_GPU_COUNT = exports.LABEL_INSTANCE_TYPE = exports.LABEL_REGION = exports.LABEL_ZONE = void 0;
exports.parseNodeListToSnapshot = parseNodeListToSnapshot;
const topology_overlay_1 = require("../topology-overlay");
// Well-known label keys (exported as constants for readability + test reuse).
exports.LABEL_ZONE = 'topology.kubernetes.io/zone';
exports.LABEL_REGION = 'topology.kubernetes.io/region';
exports.LABEL_INSTANCE_TYPE = 'node.kubernetes.io/instance-type';
exports.LABEL_GPU_COUNT = 'nvidia.com/gpu.count';
exports.LABEL_GPU_PRODUCT = 'nvidia.com/gpu.product';
class K8sNodeLabelSource {
    constructor(nodeList, opts = {}) {
        this.id = opts.id ?? 'k8s_node_label_source';
        this.version = opts.version ?? 'k8s-1';
        const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
        this.snapshot = parseNodeListToSnapshot(nodeList, this.id, this.version, now());
    }
    async fetchSnapshot(ctx) {
        if (ctx?.apiEndpoint !== undefined) {
            throw new Error('LIVE_FETCH_NOT_IMPLEMENTED_PATH_B: k8s');
        }
        return this.snapshot;
    }
    snapshotHash(snapshot) {
        return (0, topology_overlay_1.computeSnapshotHash)(snapshot);
    }
}
exports.K8sNodeLabelSource = K8sNodeLabelSource;
// Pure parsing helper. Exported for unit-test surface independent of class.
function parseNodeListToSnapshot(nodeList, source_id, source_version, fetched_at_ts) {
    const nodes = [];
    const edges = [];
    const zoneNodesByZone = new Map();
    for (const item of nodeList.items) {
        const name = item.metadata.name;
        if (typeof name !== 'string' || name.length === 0)
            continue;
        const labels = item.metadata.labels ?? {};
        const hostId = `host:${name}`;
        // Host node — always emitted when name is present.
        const hostMeta = {};
        const instType = labels[exports.LABEL_INSTANCE_TYPE];
        if (typeof instType === 'string' && instType.length > 0)
            hostMeta.instance_type = instType;
        const region = labels[exports.LABEL_REGION];
        if (typeof region === 'string' && region.length > 0)
            hostMeta.region = region;
        nodes.push({
            id: hostId,
            service_name: name,
            kind: 'rack',
            metadata: hostMeta,
        });
        // Zone node + zone→host edge (if zone label present).
        const zoneVal = labels[exports.LABEL_ZONE];
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
        const countRaw = labels[exports.LABEL_GPU_COUNT];
        if (typeof countRaw === 'string') {
            const count = parseInt(countRaw, 10);
            if (Number.isInteger(count) && count >= 1) {
                const productRaw = labels[exports.LABEL_GPU_PRODUCT];
                const product = typeof productRaw === 'string' && productRaw.length > 0 ? productRaw : undefined;
                for (let i = 0; i < count; i++) {
                    const gpuId = `gpu:${name}:${i}`;
                    const gpuMeta = { host: name };
                    if (product !== undefined)
                        gpuMeta.gpu_product = product;
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
//# sourceMappingURL=k8s-source.js.map