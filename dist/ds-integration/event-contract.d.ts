/** Single source of truth for the closed set of deploy-event classes.
 *  The `DeployEventPayload['event_class']` type union AND the consumer's
 *  runtime validation set (`event-consumer.ts`) are both derived from this
 *  constant, so the two can never diverge again (remediation 2026-06-10 H1:
 *  the consumer's hand-maintained Set omitted 'chaos_experiment' and
 *   400-rejected valid Anvil chaos events). */
export declare const DEPLOY_EVENT_CLASSES: readonly ["firmware_push", "model_redeploy", "env_change", "config_change", "capacity_change", "chaos_experiment"];
/** Wire-format projection of `ClusterEvent` for Tessera consumption.
 *
 *  Cross-reference: `engine/events/event-feed.ts:17-31` declares the
 *  engine-internal `ClusterEvent`. The `event_class` 6-value union mirrors
 *  `engine/events/event-feed.ts:10-16` `ClusterEventKind` — parity audit is
 *  the Reviewer's responsibility (single source-of-divergence risk; see
 *  § 5.5 D-2). */
export interface DeployEventPayload {
    /** Event identifier; stable across DS retries; used as
     *  `cluster_event_id` downstream in Tessera's freeze-hook flow. */
    event_id: string;
    /** Closed-set 6 event classes. Mirrors `events/event-feed.ts:10-16`
     *  ClusterEventKind. `'chaos_experiment'` added per DS-side Anvil
     *  (DeploySignal Addition #29 / PRD-29 / Q29): DeploySignal emits a
     *  `chaos_experiment` event when an Anvil chaos run starts so Tessera's
     *  freeze-hook activates over the experiment's declared fault window,
     *  same semantic as the other 5 event classes. */
    event_class: (typeof DEPLOY_EVENT_CLASSES)[number];
    /** Epoch seconds when the event occurred (point-shaped) or began
     *  (interval-shaped; event_window_end_ts populated). */
    event_ts: number;
    /** Optional; interval-shaped events set this to the end of the event
     *  window. Absent → point-shaped event. */
    event_window_end_ts?: number;
    /** Optional caller-supplied metadata; not used by Tessera consumer logic
     *  at R62 contract layer. */
    metadata?: Record<string, string>;
}
/** Top-level request payload sent by DS to Tessera when a deploy event fires. */
export interface DsToTesseraEventRequest {
    contract_version: 'v1';
    /** Per-event payload. */
    event: DeployEventPayload;
    /** DS-side emit timestamp (epoch seconds). */
    emitted_at_ts: number;
}
/** Tessera-side response after consuming a DS→Tessera event. */
export interface DsToTesseraEventResponse {
    contract_version: 'v1';
    /** Acceptance discriminator. */
    status: 'accepted' | 'rejected';
    /** Whether the event activated Tessera's Phase 2 freeze-hook for the
     *  matching (cluster_event_id, window). */
    freeze_hook_activated: boolean;
    /** Tessera-side activation timestamp (epoch seconds). Present when
     *  `freeze_hook_activated === true` and `status === 'accepted'`. */
    freeze_hook_activated_at_ts?: number;
    /** Populated when `status === 'rejected'`. */
    reason?: string;
}
/** HTTP transport metadata pin (interface form — type-level). */
export interface DsToTesseraEventEndpoint {
    readonly path: '/v1/tessera/deploy-events';
    readonly method: 'POST';
}
/** HTTP transport metadata pin (const form — runtime-accessible literal). */
export declare const DS_TO_TESSERA_EVENT_ENDPOINT: {
    readonly path: "/v1/tessera/deploy-events";
    readonly method: "POST";
};
//# sourceMappingURL=event-contract.d.ts.map