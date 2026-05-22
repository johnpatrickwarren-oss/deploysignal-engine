import type { TopologySnapshot } from '../types/verdict';
import { type TopologySource } from '../topology-overlay';
import type { TopologyFetchContext } from './fetch-context';
declare const KNOWN_TPU_VERSIONS: readonly ["v4", "v5p", "v5e"];
export type TpuVersion = (typeof KNOWN_TPU_VERSIONS)[number];
export interface TpuParseOpts {
    /** Epoch-seconds timestamp for the produced snapshot. Defaults to current wall clock. */
    fetched_at_ts?: number;
    /** Source-id literal for the produced snapshot. Defaults to 'tpu_topology_source'. */
    source_id?: string;
    /** Source-version literal for the produced snapshot. Defaults to `tpu-${version}-1`. */
    source_version?: string;
}
export interface TpuParseResult {
    snapshot: TopologySnapshot;
    /** true iff slice_shape has any dimension < 4 (sub-cube mesh-only; no full torus). */
    partial: boolean;
    /** TPU generation inferred from the fixture's `tpu_version` field. */
    tpu_version: TpuVersion;
}
export declare function parseTpuTopologyJson(jsonText: string, opts?: TpuParseOpts): TpuParseResult;
export declare class TpuTopologySource implements TopologySource {
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
export {};
//# sourceMappingURL=tpu-source.d.ts.map