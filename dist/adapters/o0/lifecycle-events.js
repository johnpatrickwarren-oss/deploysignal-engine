"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/o0/lifecycle-events.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryLifecycleEventEmitter = exports.NoOpLifecycleEventEmitter = void 0;
exports.freshLifecycleState = freshLifecycleState;
exports.safeEmit = safeEmit;
/** Default emitter. Every method is a no-op. Used by the orchestrator
 *  when a caller doesn't pass a real emitter — backward compat hard
 *  gate. */
class NoOpLifecycleEventEmitter {
    async emit(_event_type, _payload) {
        // intentional no-op
    }
}
exports.NoOpLifecycleEventEmitter = NoOpLifecycleEventEmitter;
/** In-memory emitter for tests and any harness that wants to inspect
 *  emitted events programmatically.
 *
 *  - `emit()` appends the event to an internal list and fans it out to
 *    registered listeners. Listener errors are isolated per-listener via
 *    try/catch — a throwing listener does NOT prevent other listeners
 *    from receiving the event nor break the deploy flow.
 *  - Listeners are invoked in registration order (predictable for
 *    debugging per ARCHITECT-REPLY-31 Open Q3 architect default).
 *  - `reset()` clears both the event buffer and the listener list —
 *    convenient for test isolation. */
class InMemoryLifecycleEventEmitter {
    constructor() {
        this.events = [];
        this.listeners = [];
    }
    async emit(event_type, payload) {
        const event = { type: event_type, payload, at: Date.now() };
        this.events.push(event);
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (_err) {
                // Isolate listener-side errors — one throwing listener must not
                // prevent other listeners from receiving the event, nor break
                // the deploy flow. Brief anti-scope: no third persistence path
                // for errors; subscribers own their own error channels.
            }
        }
    }
    subscribe(listener) {
        this.listeners.push(listener);
    }
    getEvents() {
        return [...this.events];
    }
    reset() {
        this.events = [];
        this.listeners = [];
    }
}
exports.InMemoryLifecycleEventEmitter = InMemoryLifecycleEventEmitter;
function freshLifecycleState() {
    return {
        triggeredEmitted: false,
        startedEmitted: false,
        finishedEmitted: false,
        perFamilySuppressionState: { A: false, B: false, C: false, D: false, E: false },
    };
}
/** Fire-and-forget wrapper so the orchestrator hot path doesn't await
 *  the emitter's Promise. Catches both synchronous throws and async
 *  rejections to avoid unhandled-rejection warnings. Visible for
 *  testing but primarily an internal helper. */
function safeEmit(emitter, event_type, payload) {
    try {
        const result = emitter.emit(event_type, payload);
        if (result && typeof result.catch === 'function') {
            result.catch(() => { });
        }
    }
    catch (_err) {
        // Synchronous throw from emit() — swallow. Real adapters are
        // expected to handle their own error paths; the engine must not
        // crash on emitter failures.
    }
}
//# sourceMappingURL=lifecycle-events.js.map