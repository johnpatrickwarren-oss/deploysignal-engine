"use strict";
// engine/events/event-conditional-attribution.ts — Tessera Phase 2 SLICE 4 (R34) WU-06 Surface 2.
//
// Event-conditional correlational attribution layer (MD-F5; PR-F7 trigger).
// ITS-class pre/post window comparison per cluster event; mirrors WU-04
// common-mode-attribution.ts architectural pattern (pure function; deterministic;
// sorted output; A16 wire-format invariant enforced as TS literal-type +
// regex-anchored declaration + JSON round-trip).
//
// Tessera-original code. Extract target: Tessera Phase 2 close.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MIN_POST_MINUS_PRE_DELTA = exports.DEFAULT_MIN_POST_COUNT = exports.DEFAULT_CORRELATION_WINDOW_SECONDS = exports.DEFAULT_POST_WINDOW_SECONDS = exports.DEFAULT_PRE_WINDOW_SECONDS = void 0;
exports.attributeEventConditional = attributeEventConditional;
// ── Module constants ─────────────────────────────────────────────────
exports.DEFAULT_PRE_WINDOW_SECONDS = 300;
exports.DEFAULT_POST_WINDOW_SECONDS = 300;
exports.DEFAULT_CORRELATION_WINDOW_SECONDS = 60;
exports.DEFAULT_MIN_POST_COUNT = 2;
exports.DEFAULT_MIN_POST_MINUS_PRE_DELTA = 1;
// ── Public function ──────────────────────────────────────────────────
function attributeEventConditional(input) {
    const { fired_events, cluster_events } = input;
    const opts = input.opts ?? {};
    const preWindow = opts.pre_window_seconds ?? exports.DEFAULT_PRE_WINDOW_SECONDS;
    const postWindow = opts.post_window_seconds ?? exports.DEFAULT_POST_WINDOW_SECONDS;
    const correlationWindow = opts.correlation_window_seconds ?? exports.DEFAULT_CORRELATION_WINDOW_SECONDS;
    const minPostCount = opts.min_post_count ?? exports.DEFAULT_MIN_POST_COUNT;
    const minDelta = opts.min_post_minus_pre_delta ?? exports.DEFAULT_MIN_POST_MINUS_PRE_DELTA;
    const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    const candidates = [];
    for (const ev of cluster_events) {
        const preStart = ev.event_ts - preWindow;
        const preEnd = ev.event_ts;
        const postStart = ev.event_ts;
        const postEnd = ev.event_ts + postWindow;
        // Pre-window count (ITS baseline): (preStart, preEnd) — exclusive at T so fires
        // exactly at event_ts are classified as post-window, not pre-window.
        let preCount = 0;
        for (const fe of fired_events) {
            if (fe.event_ts > preStart && fe.event_ts < preEnd)
                preCount += 1;
        }
        // Post-window correlated subset (Cell 4 discriminator): [postStart, postEnd)
        const correlatedShardSet = new Set();
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
        if (memberCount < minPostCount)
            continue;
        if (memberCount - preCount < minDelta)
            continue;
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
        if (a.event_ts !== b.event_ts)
            return a.event_ts - b.event_ts;
        return a.cluster_event_id < b.cluster_event_id ? -1 : a.cluster_event_id > b.cluster_event_id ? 1 : 0;
    });
    return { candidates, attributed_at_ts: now() };
}
//# sourceMappingURL=event-conditional-attribution.js.map