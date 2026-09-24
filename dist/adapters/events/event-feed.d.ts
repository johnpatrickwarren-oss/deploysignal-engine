export type ClusterEventKind = 'firmware_push' | 'model_redeploy' | 'env_change' | 'config_change' | 'capacity_change' | 'chaos_experiment';
export interface ClusterEvent {
    /** Caller-supplied stable identifier; used as cluster_event_id downstream
     *  (identity threading; no separate mapping). */
    event_id: string;
    /** Closed-set 6 event classes; see ClusterEventKind. */
    kind: ClusterEventKind;
    /** Epoch seconds when the event occurred (point-shaped) or began
     *  (interval-shaped; event_window_end_ts populated). */
    event_ts: number;
    /** Optional; interval-shaped events set this to the end of the event
     *  window. Absent → point-shaped event. */
    event_window_end_ts?: number;
    /** Optional caller-supplied metadata; not used by attribution logic. */
    metadata?: Record<string, string>;
}
export interface EventFeed {
    /** Returns the subset of events with event_ts > since_ts, sorted asc by
     *  (event_ts, event_id). Returns [] when no events match. */
    fetchSince(since_ts: number): readonly ClusterEvent[];
}
export declare class SyntheticEventFeed implements EventFeed {
    private readonly events;
    constructor(events: readonly ClusterEvent[]);
    fetchSince(since_ts: number): readonly ClusterEvent[];
}
//# sourceMappingURL=event-feed.d.ts.map