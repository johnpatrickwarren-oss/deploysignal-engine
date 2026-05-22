import type { TopologySnapshot } from '../types/verdict';
import { type TopologySource } from '../topology-overlay';
import type { TopologyFetchContext } from './fetch-context';
export interface K8sNodeList {
    items: K8sNode[];
}
export interface K8sNode {
    metadata: {
        name?: string;
        labels?: Record<string, string>;
    };
}
export declare const LABEL_ZONE = "topology.kubernetes.io/zone";
export declare const LABEL_REGION = "topology.kubernetes.io/region";
export declare const LABEL_INSTANCE_TYPE = "node.kubernetes.io/instance-type";
export declare const LABEL_GPU_COUNT = "nvidia.com/gpu.count";
export declare const LABEL_GPU_PRODUCT = "nvidia.com/gpu.product";
export interface K8sNodeLabelSourceOpts {
    id?: string;
    version?: string;
    now?: () => number;
}
export declare class K8sNodeLabelSource implements TopologySource {
    readonly id: string;
    readonly version: string;
    private readonly snapshot;
    constructor(nodeList: K8sNodeList, opts?: K8sNodeLabelSourceOpts);
    fetchSnapshot(ctx?: TopologyFetchContext): Promise<TopologySnapshot>;
    snapshotHash(snapshot: TopologySnapshot): string;
}
export declare function parseNodeListToSnapshot(nodeList: K8sNodeList, source_id: string, source_version: string, fetched_at_ts: number): TopologySnapshot;
//# sourceMappingURL=k8s-source.d.ts.map