// engine/ds-integration/event-contract.ts — Phase 3 SLICE 3 WU-Phase3-3A (R62).
//
// DS→Tessera deploy-event contract. Wire-format types + HTTP transport
// metadata for DS-side (separate PR after Wave 10) to send deploy events
// that Tessera's freeze-hook (`engine/events/freeze-hook.ts`) consumes.
//
// R62 deliverable: types + literal constants only. No HTTP server; no
// implementation. Server-side handler and freeze-hook integration land at
// Wave 10 (R63+) WU-3C.
//
// Wire-format projection convention: DeployEventPayload is a
// structurally-independent projection of `engine/events/event-feed.ts:17-31`
// ClusterEvent. The 5-value closed-set `event_class` mirrors
// `engine/events/event-feed.ts:10-15` ClusterEventKind by JSDoc reference;
// the contract DOES NOT import the engine type to preserve cross-repo
// decoupling.
//
// Tessera-original code.

/** Wire-format projection of `ClusterEvent` for Tessera consumption.
 *
 *  Cross-reference: `engine/events/event-feed.ts:17-31` declares the
 *  engine-internal `ClusterEvent`. The `event_class` 5-value union mirrors
 *  `engine/events/event-feed.ts:10-15` `ClusterEventKind` — parity audit is
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
  event_class:
    | 'firmware_push'
    | 'model_redeploy'
    | 'env_change'
    | 'config_change'
    | 'capacity_change'
    | 'chaos_experiment';
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
export const DS_TO_TESSERA_EVENT_ENDPOINT = {
  path: '/v1/tessera/deploy-events',
  method: 'POST',
} as const;
