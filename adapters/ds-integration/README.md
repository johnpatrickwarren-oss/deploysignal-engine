# Tessera ↔ DeploySignal integration contract — v1 (R62)

This document is the human-readable description of the DS integration
interface contract. The TypeScript source-of-truth lives in
`feed-contract.ts` (Tessera→DS direction) and `event-contract.ts`
(DS→Tessera direction). The contract is types + HTTP transport metadata
only; no implementation. Server/client implementation lands at Phase 3
SLICE 3 Wave 10 (R63+) — `WU-3B` (Tessera→DS feed client) + `WU-3C`
(DS→Tessera event consumer + freeze-hook real-event activation).

## Tessera → DS feed

Endpoint: `POST /v1/tessera/verdict-groups`

Tessera-side WU-3B emits one `TesseraToDsFeedRequest` per closed
VerdictGroup (one HTTP POST per emission; transport-layer batching is out
of scope for the contract). The request carries a `VerdictGroupPayload`
(wire-format projection of `engine/types/verdict.ts:198-231` VerdictGroup),
a contract version literal `'v1'`, and a Tessera-side emit timestamp. The
response carries a DS-assigned `correlation_key`, a status discriminator
(`'accepted' | 'rejected'`), and an optional rejection reason.

Idempotency: DS implementations SHOULD treat `(verdict_group.group_id,
emitted_at_ts)` as the idempotency key. A retransmission with the same
key returns the same `correlation_key`. Enforcement is the consumer's
responsibility — the contract does not mandate it at the type layer.

## DS → Tessera event

Endpoint: `POST /v1/tessera/deploy-events`

DS emits one `DsToTesseraEventRequest` per cluster-level deploy event. The
5-value `event_class` closed-set (`'firmware_push' | 'model_redeploy' |
'env_change' | 'config_change' | 'capacity_change'`) mirrors
`engine/events/event-feed.ts:10-15` ClusterEventKind; cross-repo parity
audit is the Reviewer's responsibility. The response carries a status
discriminator, a `freeze_hook_activated` boolean (Tessera-side outcome),
and an optional activation timestamp + rejection reason.

## Versioning

The contract version literal is pinned at type level on every request:
`contract_version: 'v1'`. A future v2 contract introduces a new module
path OR a discriminated union over `contract_version`. Removal or
renaming of any v1 field is a BREAKING change requiring v2 cutover.
Addition of optional fields is BACKWARD-COMPATIBLE within v1.

## Anti-scope (R62)

The R62 round delivers TYPES + LITERAL CONSTANTS + DOCUMENTATION only. The
following are explicitly out of scope and land at later rounds:

- HTTP server / client implementation (Wave 10: WU-3B + WU-3C).
- Auth scheme implementation (bearer / HMAC / mTLS — deferred).
- DS-repo modification (separate PR per Coordinator W3-1 Option A).
- npm package extract (DEFERRED per Option F to Phase 4 / dedicated
  design cycle).
- Real-cluster integration (Path B inherited).
