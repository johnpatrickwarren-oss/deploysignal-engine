// engine/events/event-conditional-attribution.ts — STUB (R34 RED commit — not yet implemented)

import type { FiredShardEvent } from '../topology/common-mode-attribution';
import type { ClusterEvent } from './event-feed';

// ── Public types ─────────────────────────────────────────────────────

export interface EventConditionalCandidate {
  cluster_event_id: string;
  cluster_event_kind: ClusterEvent['kind'];
  event_ts: number;
  member_shard_ids: readonly string[];
  member_count: number;
  pre_window_count: number;
  post_window_count: number;
  correlational_not_causal: boolean; // NOT literal true yet — RED state
}

export interface EventConditionalAttributionOpts {
  pre_window_seconds?: number;
  post_window_seconds?: number;
  correlation_window_seconds?: number;
  min_post_count?: number;
  min_post_minus_pre_delta?: number;
  now?: () => number;
}

export interface EventConditionalAttributionInput {
  fired_events: readonly FiredShardEvent[];
  cluster_events: readonly ClusterEvent[];
  opts?: EventConditionalAttributionOpts;
}

export interface EventConditionalAttributionResult {
  candidates: readonly EventConditionalCandidate[];
  attributed_at_ts: number;
}

// ── Module constants ─────────────────────────────────────────────────

export const DEFAULT_PRE_WINDOW_SECONDS = 300;
export const DEFAULT_POST_WINDOW_SECONDS = 300;
export const DEFAULT_CORRELATION_WINDOW_SECONDS = 60;
export const DEFAULT_MIN_POST_COUNT = 2;
export const DEFAULT_MIN_POST_MINUS_PRE_DELTA = 1;

// ── Public function ──────────────────────────────────────────────────

export function attributeEventConditional(
  _input: EventConditionalAttributionInput,
): EventConditionalAttributionResult {
  throw new Error('not implemented');
}
