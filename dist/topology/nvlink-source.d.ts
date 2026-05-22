import type { TopologySnapshot } from '../types/verdict';
import { type TopologySource } from '../topology-overlay';
import type { TopologyFetchContext } from './fetch-context';
import { type CounterSample, type RateSample, type TransformOpts } from '../l0/counter-rate-transform';
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
export declare function parseNvlinkStatus(rawText: string, opts?: NvlinkParseOpts): NvlinkParseResult;
export declare class NvlinkTopologySource implements TopologySource {
    readonly id: string;
    readonly version: string;
    private readonly snapshot;
    constructor(rawText: string, opts?: {
        id?: string;
        version?: string;
        fetched_at_ts?: number;
        source_id?: string;
        source_version?: string;
    });
    fetchSnapshot(ctx?: TopologyFetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
export declare function ingestNvlinkErrorCounter(prev: CounterSample, next: CounterSample, opts: TransformOpts): RateSample;
//# sourceMappingURL=nvlink-source.d.ts.map