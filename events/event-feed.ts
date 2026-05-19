// engine/events/event-feed.ts — STUB (R34 RED commit — not yet implemented)
export type ClusterEventKind =
  | 'firmware_push'
  | 'model_redeploy'
  | 'env_change'
  | 'config_change'
  | 'capacity_change';

export interface ClusterEvent {
  event_id: string;
  kind: ClusterEventKind;
  event_ts: number;
  event_window_end_ts?: number;
  metadata?: Record<string, string>;
}

export interface EventFeed {
  fetchSince(since_ts: number): readonly ClusterEvent[];
}

export class SyntheticEventFeed implements EventFeed {
  constructor(_events: readonly ClusterEvent[]) {}
  fetchSince(_since_ts: number): readonly ClusterEvent[] {
    throw new Error('not implemented');
  }
}
