// engine/events/event-feed.ts — Tessera Phase 2 SLICE 4 (R34) WU-06 Surface 1.
//
// Closed-set 5-event-class deployment-event substrate. Producer-side contract:
// caller supplies a ClusterEvent list; EventFeed.fetchSince(ts) returns the
// subset whose event_ts > ts. Mirrors inherited `flags`-input pattern at
// cluster-event scope.
//
// Tessera-original code (NOT vendored). Extract target: Tessera Phase 2 close.

export type ClusterEventKind =
  | 'firmware_push'
  | 'model_redeploy'
  | 'env_change'
  | 'config_change'
  | 'capacity_change'
  | 'chaos_experiment';

export interface ClusterEvent {
  /** Caller-supplied stable identifier; used as cluster_event_id downstream
   *  (identity threading; no separate mapping). */
  event_id: string;
  /** Closed-set 5 event classes; see ClusterEventKind. */
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

export class SyntheticEventFeed implements EventFeed {
  private readonly events: readonly ClusterEvent[];

  constructor(events: readonly ClusterEvent[]) {
    // Defensive copy + canonical sort (event_ts asc; event_id lex asc on tie).
    const copy = [...events];
    copy.sort((a, b) => {
      if (a.event_ts !== b.event_ts) return a.event_ts - b.event_ts;
      return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
    });
    this.events = copy;
  }

  fetchSince(since_ts: number): readonly ClusterEvent[] {
    return this.events.filter((e) => e.event_ts > since_ts);
  }
}
