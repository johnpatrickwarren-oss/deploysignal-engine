import type { FiredShardEvent } from '../topology/common-mode-attribution';
import type { ClusterEvent } from './event-feed';
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
    /** Count of fired shards within the pre-window. ITS baseline. */
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
export declare const DEFAULT_PRE_WINDOW_SECONDS = 300;
export declare const DEFAULT_POST_WINDOW_SECONDS = 300;
export declare const DEFAULT_CORRELATION_WINDOW_SECONDS = 60;
export declare const DEFAULT_MIN_POST_COUNT = 2;
export declare const DEFAULT_MIN_POST_MINUS_PRE_DELTA = 1;
export declare function attributeEventConditional(input: EventConditionalAttributionInput): EventConditionalAttributionResult;
//# sourceMappingURL=event-conditional-attribution.d.ts.map