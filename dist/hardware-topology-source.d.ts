import type { TopologySnapshot } from './types/verdict';
import { type FetchContext, type TopologySource } from './topology-overlay';
export declare class HardwareTopologySource implements TopologySource {
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
//# sourceMappingURL=hardware-topology-source.d.ts.map