"use strict";
// engine/events/event-feed.ts — Tessera Phase 2 SLICE 4 (R34) WU-06 Surface 1.
//
// Closed-set 5-event-class deployment-event substrate. Producer-side contract:
// caller supplies a ClusterEvent list; EventFeed.fetchSince(ts) returns the
// subset whose event_ts > ts. Mirrors inherited `flags`-input pattern at
// cluster-event scope.
//
// Tessera-original code (NOT vendored). Extract target: Tessera Phase 2 close.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticEventFeed = void 0;
class SyntheticEventFeed {
    constructor(events) {
        // Defensive copy + canonical sort (event_ts asc; event_id lex asc on tie).
        const copy = [...events];
        copy.sort((a, b) => {
            if (a.event_ts !== b.event_ts)
                return a.event_ts - b.event_ts;
            return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
        });
        this.events = copy;
    }
    fetchSince(since_ts) {
        return this.events.filter((e) => e.event_ts > since_ts);
    }
}
exports.SyntheticEventFeed = SyntheticEventFeed;
//# sourceMappingURL=event-feed.js.map