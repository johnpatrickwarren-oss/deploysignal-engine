"use strict";
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
// ClusterEvent. The 6-value closed-set `event_class` mirrors
// `engine/events/event-feed.ts:10-16` ClusterEventKind by JSDoc reference;
// the contract DOES NOT import the engine type to preserve cross-repo
// decoupling.
//
// Tessera-original code.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DS_TO_TESSERA_EVENT_ENDPOINT = exports.DEPLOY_EVENT_CLASSES = void 0;
/** Single source of truth for the closed set of deploy-event classes.
 *  The `DeployEventPayload['event_class']` type union AND the consumer's
 *  runtime validation set (`event-consumer.ts`) are both derived from this
 *  constant, so the two can never diverge again (remediation 2026-06-10 H1:
 *  the consumer's hand-maintained Set omitted 'chaos_experiment' and
 *   400-rejected valid Anvil chaos events). */
exports.DEPLOY_EVENT_CLASSES = [
    'firmware_push',
    'model_redeploy',
    'env_change',
    'config_change',
    'capacity_change',
    'chaos_experiment',
];
/** HTTP transport metadata pin (const form — runtime-accessible literal). */
exports.DS_TO_TESSERA_EVENT_ENDPOINT = {
    path: '/v1/tessera/deploy-events',
    method: 'POST',
};
//# sourceMappingURL=event-contract.js.map