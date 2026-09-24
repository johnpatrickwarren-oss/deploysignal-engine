// engine/events/event-conditional-attribution.ts — Tessera Phase 2 SLICE 4 (R34) WU-06 Surface 2.
//
// Event-conditional correlational attribution layer (MD-F5; PR-F7 trigger).
// ITS-class pre/post window comparison per cluster event; mirrors WU-04
// common-mode-attribution.ts architectural pattern (pure function; deterministic;
// sorted output; A16 wire-format invariant enforced as TS literal-type +
// regex-anchored declaration + JSON round-trip).
//
// Tessera-original code. Extract target: Tessera Phase 2 close.

import type { FiredShardEvent } from '../topology/common-mode-attribution';
import type { ClusterEvent } from './event-feed';

// ── Public types ─────────────────────────────────────────────────────

export interface EventConditionalCandidate {
  /** The triggering ClusterEvent.event_id. Threaded through as
   *  cluster_event_id downstream. */
  cluster_event_id: string;
  cluster_event_kind: ClusterEvent['kind'];
  /** Event timestamp from ClusterEvent.event_ts. */
  event_ts: number;
  /** Distinct shard ids whose post-window event_ts falls within
   *  correlation_window_seconds of cluster_event.event_ts. Sorted lex asc.
   *  Excludes unrelated post-window fires (Cell 4 confounding-discrimination). */
  member_shard_ids: readonly string[];
  /** Cached length of member_shard_ids. */
  member_count: number;
  /** Count of DISTINCT fired shards within the pre-window. ITS baseline;
   *  same unit as post_window_count (distinct shards, remediation
   *  2026-06-10 M4). */
  pre_window_count: number;
  /** Count of fired shards within the post-window correlated with this event
   *  (== member_count by construction). ITS post measurement. */
  post_window_count: number;
  /** Literal `true` per inherited Addition #26 D4. Forces audit
   *  consumers to acknowledge the non-causal labeling in type contracts.
   *  NOT a boolean — the literal-type prevents any code path from
   *  setting this to `false`. */
  correlational_not_causal: true;
}

export interface EventConditionalAttributionOpts {
  /** ITS pre-window length in seconds. Default 300 (5 min). */
  pre_window_seconds?: number;
  /** ITS post-window length in seconds. Default 300 (5 min). */
  post_window_seconds?: number;
  /** Per-shard event-correlation window in seconds (Cell 4 discriminator).
   *  Default 60. A post-window fired shard is event-correlated when
   *  |shard.event_ts - cluster_event.event_ts| <= correlation_window_seconds. */
  correlation_window_seconds?: number;
  /** Min post-window correlated count required to surface a candidate.
   *  Default 2 (singletons not common-mode). */
  min_post_count?: number;
  /** Min (post - pre) elevation required to surface a candidate.
   *  Default 1 (observed elevation over pre-window baseline). */
  min_post_minus_pre_delta?: number;
  /** Injected clock for deterministic tests. */
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
  input: EventConditionalAttributionInput,
): EventConditionalAttributionResult {
  const { fired_events, cluster_events } = input;
  const opts = input.opts ?? {};
  const preWindow = opts.pre_window_seconds ?? DEFAULT_PRE_WINDOW_SECONDS;
  const postWindow = opts.post_window_seconds ?? DEFAULT_POST_WINDOW_SECONDS;
  const correlationWindow = opts.correlation_window_seconds ?? DEFAULT_CORRELATION_WINDOW_SECONDS;
  const minPostCount = opts.min_post_count ?? DEFAULT_MIN_POST_COUNT;
  const minDelta = opts.min_post_minus_pre_delta ?? DEFAULT_MIN_POST_MINUS_PRE_DELTA;
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));

  const candidates: EventConditionalCandidate[] = [];

  for (const ev of cluster_events) {
    const preStart = ev.event_ts - preWindow;
    const preEnd = ev.event_ts;
    const postStart = ev.event_ts;
    const postEnd = ev.event_ts + postWindow;

    // Pre-window count (ITS baseline): (preStart, preEnd) — exclusive at T so fires
    // exactly at event_ts are classified as post-window, not pre-window.
    // Distinct shards (remediation 2026-06-10 M4): the post-window
    // measurement counts distinct shards, so the pre-window baseline must
    // use the same unit. Counting raw fired events here let one noisy shard
    // repeat-firing pre-window suppress a genuine multi-shard post-event
    // elevation via the (post - pre) surfacing filter.
    const preShardSet = new Set<string>();
    for (const fe of fired_events) {
      if (fe.event_ts > preStart && fe.event_ts < preEnd) preShardSet.add(fe.shard_node_id);
    }
    const preCount = preShardSet.size;

    // Post-window correlated subset (Cell 4 discriminator): [postStart, postEnd)
    const correlatedShardSet = new Set<string>();
    for (const fe of fired_events) {
      if (fe.event_ts >= postStart && fe.event_ts < postEnd) {
        if (Math.abs(fe.event_ts - ev.event_ts) <= correlationWindow) {
          correlatedShardSet.add(fe.shard_node_id);
        }
      }
    }

    const memberShardIds = Array.from(correlatedShardSet).sort();
    const memberCount = memberShardIds.length;

    // Surface filters: (a) min correlated count; (b) min elevation over pre baseline.
    if (memberCount < minPostCount) continue;
    if (memberCount - preCount < minDelta) continue;

    candidates.push({
      cluster_event_id: ev.event_id,
      cluster_event_kind: ev.kind,
      event_ts: ev.event_ts,
      member_shard_ids: memberShardIds,
      member_count: memberCount,
      pre_window_count: preCount,
      post_window_count: memberCount,
      correlational_not_causal: true,
    });
  }

  // Deterministic sort: (event_ts asc, cluster_event_id lex asc).
  candidates.sort((a, b) => {
    if (a.event_ts !== b.event_ts) return a.event_ts - b.event_ts;
    return a.cluster_event_id < b.cluster_event_id ? -1 : a.cluster_event_id > b.cluster_event_id ? 1 : 0;
  });

  return { candidates, attributed_at_ts: now() };
}
