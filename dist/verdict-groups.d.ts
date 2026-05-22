import type { FusedVerdict, VerdictGroup } from './types';
export interface VerdictGroupOpts {
    /** Default 300 (5 min). Overrides CompilerOptions.verdict_group_window_seconds. */
    window_seconds?: number;
    /** Default 300 (5 min). Overrides CompilerOptions.verdict_group_grace_seconds. */
    grace_seconds?: number;
    /** Default 3. Overrides CompilerOptions.verdict_group_confidence_saturation. */
    confidence_saturation?: number;
}
export type VerdictGroupCloseReason = 'window_elapsed' | 'terminal_verdict';
export interface IngestResult {
    /** Group newly closed by this ingest call (window-elapsed rotation
     *  OR terminal verdict). `null` when no close was triggered. */
    closed: VerdictGroup | null;
    /** True when the ingested verdict was attached as a late-arrival to
     *  a previously-closed group (grace-window attach per D5). Consumers
     *  use this to emit `verdict_group_updated` audit events. */
    late_arrival: boolean;
    /** The group (open or closed) the ingested verdict was attributed
     *  to. Matches `closed` when a terminal/window-elapsed close fired
     *  on the same verdict. */
    attributed_group: VerdictGroup;
}
export declare class VerdictGrouper {
    private readonly windowSeconds;
    private readonly graceSeconds;
    private readonly confidenceSaturation;
    private readonly openByGroupKey;
    private readonly recentlyClosed;
    constructor(opts?: VerdictGroupOpts);
    ingest(verdict: FusedVerdict, ts_seconds: number, opts?: {
        terminal?: boolean;
        cluster_event_id?: string;
    }): IngestResult;
    flush(ts_seconds: number): VerdictGroup[];
    /** Public for test + orchestrator visibility. Does not mutate. */
    openGroupForDeploy(deploy_id: string, cluster_event_id?: string): VerdictGroup | undefined;
    private groupKey;
    private groupId;
    private openGroupAt;
    private appendToOpen;
    private closeGroup;
    private recomputeDerived;
    private findRecentClosedForKey;
    private evictStaleClosed;
}
//# sourceMappingURL=verdict-groups.d.ts.map