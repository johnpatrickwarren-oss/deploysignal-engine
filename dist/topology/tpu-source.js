"use strict";
// engine/topology/tpu-source.ts — Phase 3 SLICE 2 WU-Phase3-2A Google TPU/ICI topology adapter (R56).
//
// Three exports:
//   1. parseTpuTopologyJson(jsonText, opts) — pure JSON parser for the JAX-style
//      TPU topology manifest. Produces a TopologySnapshot with `tpu_shard` nodes
//      (R56 enum addition) and `tpu_ici_peer` edges (R56 enum addition). TPU
//      generation is determined by the `tpu_version` field (known set:
//      'v4' | 'v5p' | 'v5e'); single node kind 'tpu_shard' shared across all
//      generations per WAVE-PLAN-07 frame-AC (d) single-literal decision.
//      Edges are undirected-deduped (canonical from = min(a, b) lex order on
//      `tpu-N` id form); self-peer entries are skipped; peer ids referenced in
//      `ici_peers` but absent from `chips` are emitted opportunistically as
//      nodes. Partial-flag semantics: `partial = slice_shape.some(dim < 4)`
//      (sub-cube mesh-only per Google Cloud TPU public docs retrieved
//      2026-05-19: "Slices smaller than a full cube ... don't have wrap-around
//      links that make them a 3D torus"). Failure modes throw one of:
//      TPU_PARSE_INVALID_JSON, TPU_PARSE_MISSING_TPU_VERSION,
//      TPU_PARSE_UNKNOWN_TPU_VERSION, TPU_PARSE_INVALID_SLICE_SHAPE,
//      TPU_PARSE_MISSING_CHIPS, TPU_PARSE_NO_CHIPS.
//   2. TpuTopologySource — thin TopologySource impl wrapping the parser.
//      Structurally parallel to NeuronTopologySource (R53), NvlinkTopologySource (R30),
//      and SlurmTopologySource (R28). snapshotHash delegates to
//      computeSnapshotHash per Addition #26 D6.
//   3. (No L0 counter-ingestion helper at R56; counter ingestion deferred to
//      Phase 3 SLICE 2B or SLICE 3 per WAVE-PLAN-07 file-tree scope.)
//
// Tessera-original code (NOT vendored from DeploySignal).
Object.defineProperty(exports, "__esModule", { value: true });
exports.TpuTopologySource = void 0;
exports.parseTpuTopologyJson = parseTpuTopologyJson;
const topology_overlay_1 = require("../topology-overlay");
const KNOWN_TPU_VERSIONS = ['v4', 'v5p', 'v5e'];
function validateTpuVersion(version) {
    if (typeof version !== 'string' || version.length === 0) {
        throw new Error('TPU_PARSE_MISSING_TPU_VERSION');
    }
    if (!KNOWN_TPU_VERSIONS.includes(version)) {
        throw new Error(`TPU_PARSE_UNKNOWN_TPU_VERSION: ${version}`);
    }
    return version;
}
function validateSliceShape(sliceShape) {
    if (!Array.isArray(sliceShape) || sliceShape.length !== 3) {
        throw new Error('TPU_PARSE_INVALID_SLICE_SHAPE');
    }
    for (const dim of sliceShape) {
        if (typeof dim !== 'number' || !Number.isInteger(dim) || dim < 1) {
            throw new Error('TPU_PARSE_INVALID_SLICE_SHAPE');
        }
    }
    return [sliceShape[0], sliceShape[1], sliceShape[2]];
}
function isPartialSlice(sliceShape) {
    return sliceShape.some((dim) => dim < 4);
}
function parseTpuTopologyJson(jsonText, opts = {}) {
    // Step 1: JSON parse with wrap-and-rethrow
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`TPU_PARSE_INVALID_JSON: ${msg}`);
    }
    // Step 2: validate top-level shape
    if (parsed === null || typeof parsed !== 'object') {
        throw new Error('TPU_PARSE_MISSING_TPU_VERSION');
    }
    const root = parsed;
    // Step 3: validate tpu_version
    const tpu_version = validateTpuVersion(root.tpu_version);
    // Step 4: validate slice_shape
    const slice_shape = validateSliceShape(root.slice_shape);
    // Step 5: validate chips array
    if (!Array.isArray(root.chips)) {
        throw new Error('TPU_PARSE_MISSING_CHIPS');
    }
    if (root.chips.length === 0) {
        throw new Error('TPU_PARSE_NO_CHIPS');
    }
    // Step 6: compute partial flag
    const partial = isPartialSlice(slice_shape);
    // Step 7: emit nodes + collect raw edge pairs
    const nodes = [];
    const nodeIds = new Set();
    const rawEdgePairs = [];
    for (const chip of root.chips) {
        const id = chip.chip;
        if (!nodeIds.has(id)) {
            nodes.push({ id, service_name: id, kind: 'tpu_shard' });
            nodeIds.add(id);
        }
        const peers = Array.isArray(chip.ici_peers) ? chip.ici_peers : [];
        for (const peerId of peers) {
            if (peerId === id)
                continue; // self-peer defensive guard
            if (!nodeIds.has(peerId)) {
                nodes.push({ id: peerId, service_name: peerId, kind: 'tpu_shard' });
                nodeIds.add(peerId);
            }
            rawEdgePairs.push([id, peerId]);
        }
    }
    // Step 8: canonical undirected dedup
    const edgeKeys = new Set();
    const edges = [];
    for (const [a, b] of rawEdgePairs) {
        const from = a < b ? a : b;
        const to = a < b ? b : a;
        const key = `${from}|${to}`;
        if (edgeKeys.has(key))
            continue;
        edgeKeys.add(key);
        edges.push({ from, to, relationship: 'tpu_ici_peer' });
    }
    // Step 9: build snapshot
    const snapshot = {
        nodes,
        edges,
        fetched_at_ts: opts.fetched_at_ts ?? Math.floor(Date.now() / 1000),
        source_id: opts.source_id ?? 'tpu_topology_source',
        source_version: opts.source_version ?? `tpu-${tpu_version}-1`,
    };
    return { snapshot, partial, tpu_version };
}
class TpuTopologySource {
    constructor(jsonText, opts = {}) {
        const { snapshot } = parseTpuTopologyJson(jsonText, {
            fetched_at_ts: opts.fetched_at_ts,
            source_id: opts.source_id,
            source_version: opts.source_version,
        });
        this.snapshot = snapshot;
        // Third operands ('tpu_topology_source' / 'tpu-1') are structurally
        // unreachable: parseTpuTopologyJson always defaults snapshot.source_id /
        // source_version (typed string, never undefined). Retained for defensive
        // correctness if parseTpuTopologyJson is ever modified — mirrors R53
        // NeuronTopologySource constructor pattern.
        this.id = opts.id ?? snapshot.source_id ?? 'tpu_topology_source';
        this.version = opts.version ?? snapshot.source_version ?? 'tpu-1';
    }
    async fetchSnapshot(ctx) {
        if (ctx?.apiEndpoint !== undefined) {
            throw new Error('LIVE_FETCH_NOT_IMPLEMENTED_PATH_B: tpu');
        }
        return this.snapshot;
    }
    snapshotHash(snapshot) {
        return (0, topology_overlay_1.computeSnapshotHash)(snapshot);
    }
}
exports.TpuTopologySource = TpuTopologySource;
//# sourceMappingURL=tpu-source.js.map