import type { AuditRecord, AuditRecordV2, CellKey, FamilyId, Verdict } from '../types';
/** Five-value enum of lifecycle event types. */
export type LifecycleEventType = 'evaluation.triggered' | 'evaluation.started' | 'evaluation.tick' | 'evaluation.suppressed' | 'evaluation.finished' | 'verdict_group.closed' | 'verdict_group.updated' | 'verdict_group.topology_enriched' | 'agent_proposal.emitted' | 'agent_proposal.downgraded';
export interface TriggeredPayload {
    type: 'evaluation.triggered';
    deploy_id: string;
    service_id: string;
    compiled_config_version: string;
    expected_window_ticks: number;
    risk_tier: string;
}
export interface StartedPayload {
    type: 'evaluation.started';
    deploy_id: string;
    cell_key: CellKey | null;
    cell_confidence: string;
    families_eligible: FamilyId[];
}
export interface TickPayload {
    type: 'evaluation.tick';
    deploy_id: string;
    tick: number;
    audit_record: AuditRecord | AuditRecordV2;
}
export interface SuppressedPayload {
    type: 'evaluation.suppressed';
    deploy_id: string;
    tick: number;
    family_id: FamilyId;
    suppression_reason: string;
}
export interface FinishedPayload {
    type: 'evaluation.finished';
    deploy_id: string;
    final_verdict: Verdict;
    total_alpha_spent: number;
    families_summary: Record<string, {
        verdict: string;
        alpha_spent: number;
    }>;
    divergence_from_spec?: string;
}
export interface VerdictGroupClosedPayload {
    type: 'verdict_group.closed';
    deploy_id: string;
    group_id: string;
    window_start_ts: number;
    window_end_ts: number;
    verdict_count: number;
    firing_family_count: number;
    root_cause_detector_id: string | null;
    confidence: number;
    closed_at_ts: number | null;
}
export interface VerdictGroupUpdatedPayload {
    type: 'verdict_group.updated';
    deploy_id: string;
    group_id: string;
    late_arrival_count: number;
    late_arrival_at_ts: number;
}
export interface VerdictGroupTopologyEnrichedPayload {
    type: 'verdict_group.topology_enriched';
    deploy_id: string;
    group_id: string;
    topology_source_id: string;
    topology_snapshot_hash: string | null;
    candidate_count: number;
    enrichment_error?: string;
}
export interface AgentProposalEmittedPayload {
    type: 'agent_proposal.emitted';
    deploy_id: string;
    group_id: string;
    proposed_action_id: string;
    playbook_category: string;
    confidence: number;
}
export interface AgentProposalDowngradedPayload {
    type: 'agent_proposal.downgraded';
    deploy_id: string;
    group_id: string;
    rails_failed: string[];
    downgrade_reason?: string;
}
/** Tagged union discriminated on `type`. Payload shape is statically
 *  guaranteed consistent with the `type` field — subscribers can narrow
 *  via `if (event.payload.type === 'evaluation.tick') { ... }`. */
export type LifecycleEventPayload = TriggeredPayload | StartedPayload | TickPayload | SuppressedPayload | FinishedPayload | VerdictGroupClosedPayload | VerdictGroupUpdatedPayload | VerdictGroupTopologyEnrichedPayload | AgentProposalEmittedPayload | AgentProposalDowngradedPayload;
/** The contract. Real adapters (Argo, Spinnaker, MLflow, webhooks) and
 *  the test-fixture in-memory adapter both implement this. Returns a
 *  Promise so adapters that do I/O can await their transport; the
 *  orchestrator emits fire-and-forget (no await in the hot decision
 *  path). */
export interface LifecycleEventEmitter {
    emit(event_type: LifecycleEventType, payload: LifecycleEventPayload): Promise<void>;
}
/** Default emitter. Every method is a no-op. Used by the orchestrator
 *  when a caller doesn't pass a real emitter — backward compat hard
 *  gate. */
export declare class NoOpLifecycleEventEmitter implements LifecycleEventEmitter {
    emit(_event_type: LifecycleEventType, _payload: LifecycleEventPayload): Promise<void>;
}
export interface RecordedLifecycleEvent {
    type: LifecycleEventType;
    payload: LifecycleEventPayload;
    at: number;
}
type Listener = (event: RecordedLifecycleEvent) => void;
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
export declare class InMemoryLifecycleEventEmitter implements LifecycleEventEmitter {
    private events;
    private listeners;
    emit(event_type: LifecycleEventType, payload: LifecycleEventPayload): Promise<void>;
    subscribe(listener: Listener): void;
    getEvents(): RecordedLifecycleEvent[];
    reset(): void;
}
/** Per-deploy lifecycle state threaded across ticks. The orchestrator
 *  is single-tick; this object carries the "once-per-deploy emit
 *  latches" and the per-family suppression state needed to fire
 *  `evaluation.suppressed` only on non-suppressed → suppressed
 *  transitions rather than every tick. Caller creates fresh per deploy. */
export interface LifecycleDeployState {
    triggeredEmitted: boolean;
    startedEmitted: boolean;
    finishedEmitted: boolean;
    /** Previous tick's per-family suppression state. Keys are the five
     *  canonical family IDs; value is `true` if the family-level verdict
     *  was `'suppressed'` on the most recent tick. Used to detect the
     *  non-suppressed → suppressed transition. */
    perFamilySuppressionState: Record<FamilyId, boolean>;
}
export declare function freshLifecycleState(): LifecycleDeployState;
/** Fire-and-forget wrapper so the orchestrator hot path doesn't await
 *  the emitter's Promise. Catches both synchronous throws and async
 *  rejections to avoid unhandled-rejection warnings. Visible for
 *  testing but primarily an internal helper. */
export declare function safeEmit(emitter: LifecycleEventEmitter, event_type: LifecycleEventType, payload: LifecycleEventPayload): void;
export {};
//# sourceMappingURL=lifecycle-events.d.ts.map