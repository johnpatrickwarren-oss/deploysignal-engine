"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/verdict-groups.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
// Tessera Phase 2 SLICE 2.A amendments (R20, 2026-05-17) — wire VerdictGroup.cluster_event_id
// per SCOPING-MEMO-v0.3.md § 2.3 + § 9 vendored-with-deltas policy:
//   1. VerdictGrouper.ingest opts adds optional cluster_event_id?: string (per-call origination).
//   2. Internal keying transitions to (cluster_event_id, deploy_id) tuple via groupKey() helper;
//      legacy single-deploy mode preserved when cluster_event_id is absent.
//   3. group_id format is conditional: composite `group-{cluster_event_id}-{deploy_id}-{ts}`
//      when cluster_event_id present; inherited `group-{deploy_id}-{ts}` preserved when absent.
//   4. Late-arrival lookup matches on (cluster_event_id, deploy_id) tuple-equality; mismatch
//      opens a new group rather than attaching across scopes (D2 preserved/extended).
// All deltas additive; Addition #25 D2 + D5 preserved (legacy mode byte-identical at the
// observable level; cluster-event mode is a strict superset of behavior).
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerdictGrouper = void 0;
const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_GRACE_SECONDS = 300;
const DEFAULT_CONFIDENCE_SATURATION = 3;
class VerdictGrouper {
    constructor(opts = {}) {
        this.openByGroupKey = new Map();
        this.recentlyClosed = new Map();
        this.windowSeconds = opts.window_seconds ?? DEFAULT_WINDOW_SECONDS;
        this.graceSeconds = opts.grace_seconds ?? DEFAULT_GRACE_SECONDS;
        this.confidenceSaturation = opts.confidence_saturation ?? DEFAULT_CONFIDENCE_SATURATION;
    }
    ingest(verdict, ts_seconds, opts = {}) {
        const deployId = verdict.deploy_ref;
        const clusterEventId = opts.cluster_event_id;
        const key = this.groupKey(clusterEventId, deployId);
        this.evictStaleClosed(ts_seconds);
        let openGroup = this.openByGroupKey.get(key);
        let closedByThisCall = null;
        let lateArrival = false;
        let rotated = false;
        if (openGroup && ts_seconds - openGroup.window_start_ts > this.windowSeconds) {
            closedByThisCall = this.closeGroup(key, ts_seconds, 'window_elapsed');
            openGroup = undefined;
            rotated = true;
        }
        let attributed;
        if (!openGroup) {
            // Late-arrival attach is only considered when this call did NOT
            // just rotate (window-elapsed close). A rotation-triggering
            // verdict always opens a new group — it's the first verdict of
            // the next window, not a straggler for the previous one.
            const lateTarget = rotated
                ? null
                : this.findRecentClosedForKey(clusterEventId, deployId, ts_seconds);
            if (lateTarget) {
                lateTarget.late_arrival_verdicts.push(verdict);
                lateTarget.verdicts.push(verdict);
                if (verdict.firing_families.length > 0)
                    lateTarget.firing_verdicts.push(verdict);
                this.recomputeDerived(lateTarget);
                lateArrival = true;
                attributed = lateTarget;
            }
            else {
                attributed = this.openGroupAt(key, clusterEventId, deployId, verdict, ts_seconds);
            }
        }
        else {
            this.appendToOpen(openGroup, verdict);
            attributed = openGroup;
        }
        if (opts.terminal && !lateArrival && !attributed.closed) {
            const terminalClose = this.closeGroup(key, ts_seconds, 'terminal_verdict');
            if (terminalClose && !closedByThisCall)
                closedByThisCall = terminalClose;
        }
        return { closed: closedByThisCall, late_arrival: lateArrival, attributed_group: attributed };
    }
    flush(ts_seconds) {
        const closed = [];
        for (const key of Array.from(this.openByGroupKey.keys())) {
            const g = this.closeGroup(key, ts_seconds, 'window_elapsed');
            if (g)
                closed.push(g);
        }
        return closed;
    }
    /** Public for test + orchestrator visibility. Does not mutate. */
    openGroupForDeploy(deploy_id, cluster_event_id) {
        return this.openByGroupKey.get(this.groupKey(cluster_event_id, deploy_id));
    }
    // ── Internal helpers ────────────────────────────────────────────────
    groupKey(cluster_event_id, deploy_id) {
        const eventSeg = cluster_event_id ? cluster_event_id : '';
        return `${eventSeg}|${deploy_id}`;
    }
    groupId(cluster_event_id, deployId, window_start_ts) {
        if (cluster_event_id) {
            return `group-${cluster_event_id}-${deployId}-${window_start_ts}`;
        }
        return `group-${deployId}-${window_start_ts}`;
    }
    openGroupAt(key, cluster_event_id, deployId, verdict, ts) {
        const firing = verdict.firing_families.length > 0;
        const group = {
            group_id: this.groupId(cluster_event_id, deployId, ts),
            deploy_id: deployId,
            cluster_event_id: cluster_event_id,
            window_start_ts: ts,
            window_end_ts: ts + this.windowSeconds,
            verdicts: [verdict],
            firing_verdicts: firing ? [verdict] : [],
            root_cause: null,
            confidence: 0,
            late_arrival_verdicts: [],
            closed: false,
            closed_at_ts: null,
        };
        this.recomputeDerived(group);
        this.openByGroupKey.set(key, group);
        return group;
    }
    appendToOpen(group, verdict) {
        group.verdicts.push(verdict);
        if (verdict.firing_families.length > 0)
            group.firing_verdicts.push(verdict);
        this.recomputeDerived(group);
    }
    closeGroup(key, ts, _reason) {
        const group = this.openByGroupKey.get(key);
        if (!group)
            return null;
        this.openByGroupKey.delete(key);
        group.closed = true;
        group.closed_at_ts = ts;
        group.window_end_ts = ts;
        this.recentlyClosed.set(group.group_id, group);
        return group;
    }
    recomputeDerived(group) {
        if (group.firing_verdicts.length === 0) {
            group.root_cause = null;
            group.confidence = 0;
            return;
        }
        // D7: earliest-firing FusedVerdict by tick; tie-break by
        // total_alpha_spent (highest wins). Within a single deploy each
        // tick emits one FusedVerdict, so intra-group tick ties are
        // unexpected — the tie-break exists as a defensive determinism
        // guard rather than an operational branch.
        let earliest = group.firing_verdicts[0];
        for (let i = 1; i < group.firing_verdicts.length; i++) {
            const v = group.firing_verdicts[i];
            if (v.tick < earliest.tick)
                earliest = v;
            else if (v.tick === earliest.tick && v.total_alpha_spent > earliest.total_alpha_spent) {
                earliest = v;
            }
        }
        group.root_cause = earliest;
        // D8: confidence = min(1, k / K_saturation) where k = count of
        // distinct firing families across ALL firing verdicts in the group.
        const families = new Set();
        for (const fv of group.firing_verdicts) {
            for (const f of fv.firing_families)
                families.add(f);
        }
        group.confidence = Math.min(1, families.size / this.confidenceSaturation);
    }
    findRecentClosedForKey(cluster_event_id, deployId, ts) {
        let best = null;
        for (const g of this.recentlyClosed.values()) {
            if (g.deploy_id !== deployId)
                continue;
            if ((g.cluster_event_id ?? '') !== (cluster_event_id ?? ''))
                continue;
            if (g.closed_at_ts === null)
                continue;
            if (ts - g.closed_at_ts > this.graceSeconds)
                continue;
            if (best === null || g.closed_at_ts > (best.closed_at_ts ?? -Infinity))
                best = g;
        }
        return best;
    }
    evictStaleClosed(ts) {
        for (const [id, g] of this.recentlyClosed) {
            if (g.closed_at_ts === null || ts - g.closed_at_ts > this.graceSeconds) {
                this.recentlyClosed.delete(id);
            }
        }
    }
}
exports.VerdictGrouper = VerdictGrouper;
//# sourceMappingURL=verdict-groups.js.map