import type { TopologySnapshot } from '../types/verdict';
import { type TopologySource } from '../topology-overlay';
import type { TopologyFetchContext } from './fetch-context';
export interface SlurmTopologySourceOpts {
    /** Identifier override; defaults to 'slurm_topology_source'. Surfaces on .id + snapshot.source_id. */
    id?: string;
    /** Version override; defaults to 'slurm-1'. Surfaces on .version + snapshot.source_version. */
    version?: string;
    /** Override snapshot.fetched_at_ts (default Math.floor(Date.now()/1000)). */
    fetchedAtTs?: number;
}
export interface ParseMeta {
    sourceId: string;
    sourceVersion: string;
    fetchedAtTs: number;
}
export declare class SlurmTopologySource implements TopologySource {
    readonly id: string;
    readonly version: string;
    private readonly snapshot;
    constructor(topologyConfText: string, opts?: SlurmTopologySourceOpts);
    fetchSnapshot(ctx?: TopologyFetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
export declare function parseSlurmTopologyConf(text: string, meta: ParseMeta): TopologySnapshot;
export declare function expandSlurmHostlist(hostlist: string): string[];
//# sourceMappingURL=slurm-source.d.ts.map