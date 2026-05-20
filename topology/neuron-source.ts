// engine/topology/neuron-source.ts — Phase 3 SLICE 1 WU-Phase3-1 AWS Neuron topology adapter (R53).
//
// Three exports:
//   1. parseNeuronLsJson(jsonText, opts) — pure JSON parser for `neuron-ls --json-output`
//      stdout. Produces a TopologySnapshot with chip-family-discriminated node kinds
//      (`trainium_chip` or `inferentia_chip` per R53 enum addition) and `neuron_link_peer`
//      edges (R53 enum addition). Chip family is determined by `instance_type` prefix:
//      `trn*` → trainium, `inf*` → inferentia. Edges are undirected-deduped (canonical
//      from = min(a, b) lex order on `neuron-N` id form); self-peer entries are skipped;
//      peer ids referenced in `connected_to` but absent from `neuron_devices` are emitted
//      opportunistically as nodes. Sparse handling: input with devices but no `connected_to`
//      entries → nodes only, edges = [], partial = true. Failure modes throw one of:
//      NEURON_PARSE_INVALID_JSON, NEURON_PARSE_MISSING_INSTANCE_TYPE,
//      NEURON_PARSE_UNKNOWN_INSTANCE_TYPE, NEURON_PARSE_MISSING_NEURON_DEVICES,
//      NEURON_PARSE_NO_DEVICES.
//   2. NeuronTopologySource — thin TopologySource impl wrapping the parser.
//      Structurally parallel to NvlinkTopologySource (R30) and SlurmTopologySource (R28).
//      snapshotHash delegates to computeSnapshotHash per Addition #26 D6.
//   3. (No L0 counter-ingestion helper at R53; counter ingestion is deferred to SLICE 2
//      conditional on Path A operator disposition at WAVE-GATE-Phase3-01 close.)
//
// Tessera-original code (NOT vendored from DeploySignal).

import type { TopologyNode, TopologyEdge, TopologySnapshot } from '../types/verdict';
import {
  computeSnapshotHash,
  type FetchContext,
  type TopologySource,
} from '../topology-overlay';
import type { TopologyFetchContext } from './fetch-context';

export interface NeuronParseOpts {
  /** Epoch-seconds timestamp for the produced snapshot. Defaults to current wall clock. */
  fetched_at_ts?: number;
  /** Source-id literal for the produced snapshot. Defaults to 'neuron_topology_source'. */
  source_id?: string;
  /** Source-version literal for the produced snapshot. Defaults to 'neuron-1'. */
  source_version?: string;
}

export interface NeuronParseResult {
  snapshot: TopologySnapshot;
  /** true iff devices were parsed but no `connected_to` entries yielded edges. */
  partial: boolean;
  /** Chip family inferred from the fixture's `instance_type` prefix. */
  chip_family: 'trainium' | 'inferentia';
}

interface NeuronLsJsonDevice {
  neuron_device: number;
  connected_to?: number[];
}

interface NeuronLsJsonRoot {
  instance_type: string;
  neuron_devices: NeuronLsJsonDevice[];
}

function chipFamilyFromInstanceType(instanceType: string):
  { chip_family: 'trainium' | 'inferentia'; node_kind: 'trainium_chip' | 'inferentia_chip' } {
  if (instanceType.startsWith('trn')) return { chip_family: 'trainium', node_kind: 'trainium_chip' };
  if (instanceType.startsWith('inf')) return { chip_family: 'inferentia', node_kind: 'inferentia_chip' };
  throw new Error(`NEURON_PARSE_UNKNOWN_INSTANCE_TYPE: ${instanceType}`);
}

export function parseNeuronLsJson(jsonText: string, opts: NeuronParseOpts = {}): NeuronParseResult {
  // Step 1: JSON parse with wrap-and-rethrow
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`NEURON_PARSE_INVALID_JSON: ${msg}`);
  }

  // Step 2: validate top-level shape
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('NEURON_PARSE_MISSING_INSTANCE_TYPE');
  }
  const root = parsed as Partial<NeuronLsJsonRoot>;
  if (typeof root.instance_type !== 'string') {
    throw new Error('NEURON_PARSE_MISSING_INSTANCE_TYPE');
  }
  const { chip_family, node_kind } = chipFamilyFromInstanceType(root.instance_type);

  if (!Array.isArray(root.neuron_devices)) {
    throw new Error('NEURON_PARSE_MISSING_NEURON_DEVICES');
  }
  if (root.neuron_devices.length === 0) {
    throw new Error('NEURON_PARSE_NO_DEVICES');
  }

  // Step 3: emit nodes + collect raw edge pairs
  const nodes: TopologyNode[] = [];
  const nodeIds: Set<string> = new Set();
  const rawEdgePairs: Array<[string, string]> = [];

  for (const device of root.neuron_devices) {
    const id = `neuron-${device.neuron_device}`;
    if (!nodeIds.has(id)) {
      nodes.push({ id, service_name: id, kind: node_kind });
      nodeIds.add(id);
    }
    const peers: number[] = Array.isArray(device.connected_to) ? device.connected_to : [];
    for (const peerNumericId of peers) {
      const peerId = `neuron-${peerNumericId}`;
      if (peerId === id) continue; // self-peer defensive guard
      if (!nodeIds.has(peerId)) {
        nodes.push({ id: peerId, service_name: peerId, kind: node_kind });
        nodeIds.add(peerId);
      }
      rawEdgePairs.push([id, peerId]);
    }
  }

  // Step 4: canonical undirected dedup
  const edgeKeys = new Set<string>();
  const edges: TopologyEdge[] = [];
  for (const [a, b] of rawEdgePairs) {
    const from = a < b ? a : b;
    const to   = a < b ? b : a;
    const key  = `${from}|${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, relationship: 'neuron_link_peer' });
  }

  const partial = edges.length === 0;

  const snapshot: TopologySnapshot = {
    nodes,
    edges,
    fetched_at_ts: opts.fetched_at_ts ?? Math.floor(Date.now() / 1000),
    source_id:     opts.source_id     ?? 'neuron_topology_source',
    source_version: opts.source_version ?? 'neuron-1',
  };

  return { snapshot, partial, chip_family };
}

export class NeuronTopologySource implements TopologySource {
  readonly id: string;
  readonly version: string;
  private readonly snapshot: TopologySnapshot;

  constructor(jsonText: string, opts: {
    id?: string;
    version?: string;
    fetched_at_ts?: number;
    source_id?: string;
    source_version?: string;
  } = {}) {
    const { snapshot } = parseNeuronLsJson(jsonText, {
      fetched_at_ts: opts.fetched_at_ts,
      source_id: opts.source_id,
      source_version: opts.source_version,
    });
    this.snapshot = snapshot;
    // Third operands ('neuron_topology_source' / 'neuron-1') are structurally unreachable:
    // parseNeuronLsJson always defaults snapshot.source_id / source_version (typed string,
    // never undefined). Retained for defensive correctness if parseNeuronLsJson is ever
    // modified — mirrors R30 NvlinkTopologySource constructor pattern.
    this.id      = opts.id      ?? snapshot.source_id     ?? 'neuron_topology_source';
    this.version = opts.version ?? snapshot.source_version ?? 'neuron-1';
  }

  async fetchSnapshot(ctx?: TopologyFetchContext): Promise<TopologySnapshot> {
    if (ctx?.apiEndpoint !== undefined) {
      throw new Error('LIVE_FETCH_NOT_IMPLEMENTED_PATH_B: neuron');
    }
    return this.snapshot;
  }

  snapshotHash(snapshot: TopologySnapshot): string {
    return computeSnapshotHash(snapshot);
  }
}
