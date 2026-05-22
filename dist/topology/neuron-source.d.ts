import type { TopologySnapshot } from '../types/verdict';
import { type TopologySource } from '../topology-overlay';
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
export declare function parseNeuronLsJson(jsonText: string, opts?: NeuronParseOpts): NeuronParseResult;
export declare class NeuronTopologySource implements TopologySource {
    readonly id: string;
    readonly version: string;
    private readonly snapshot;
    constructor(jsonText: string, opts?: {
        id?: string;
        version?: string;
        fetched_at_ts?: number;
        source_id?: string;
        source_version?: string;
    });
    fetchSnapshot(ctx?: TopologyFetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
//# sourceMappingURL=neuron-source.d.ts.map