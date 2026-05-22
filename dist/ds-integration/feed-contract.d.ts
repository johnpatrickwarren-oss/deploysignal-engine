/** Wire-format projection of `VerdictGroup` for DS consumption.
 *
 *  Cross-reference: `engine/types/verdict.ts:198-231` declares the
 *  engine-internal `VerdictGroup`. This projection mirrors the load-bearing
 *  summary subset; engine-internal evolution (additional fields) does NOT
 *  automatically flow to the wire format. Adding a wire-format field is a
 *  deliberate cross-repo contract change. */
export interface VerdictGroupPayload {
    /** Tessera VerdictGroupId; format `group-{deploy_id}-{window_start_ts}`
     *  per `engine/types/verdict.ts:189-193`. DS treats as opaque string. */
    group_id: string;
    /** Tessera deploy identifier. */
    deploy_id: string;
    /** Epoch seconds; first-ingested verdict's timestamp. */
    window_start_ts: number;
    /** Epoch seconds; actual close time or nominal `window_start_ts +
     *  window_seconds`. */
    window_end_ts: number;
    /** Optional cluster-level event correlation id propagated through the
     *  Phase 2 SLICE 1 outer aggregator (R18 schema delta). */
    cluster_event_id?: string;
    /** Count of distinct firing families in the closed VerdictGroup. */
    firing_family_count: number;
    /** `min(1, k / confidence_saturation)` per Addition #25 D3. */
    confidence: number;
    /** Required literal per Addition #26 D4 wire-format invariant.
     *  Mirrors `engine/types/verdict.ts:298`. */
    correlational_not_causal: true;
}
/** Auth/identity headers for the Tessera→DS feed.
 *
 *  R62: structural type only. Specific auth-scheme implementation
 *  (bearer / HMAC / mTLS) lands at R63+ Wave 10 WU-3B. */
export interface TesseraToDsAuthHeaders {
    /** Stable identifier for the Tessera instance emitting this payload. */
    'x-tessera-instance-id': string;
    /** Bearer-token placeholder; auth scheme deferred. */
    authorization: `Bearer ${string}`;
}
/** Top-level request payload sent by Tessera to DS when a VerdictGroup closes. */
export interface TesseraToDsFeedRequest {
    /** Contract version literal; bumped on breaking changes. v1 is initial. */
    contract_version: 'v1';
    /** Per-VerdictGroup observation payload (wire-format projection). */
    verdict_group: VerdictGroupPayload;
    /** Tessera-side emit timestamp (epoch seconds). */
    emitted_at_ts: number;
}
/** DS-side response after consuming a Tessera→DS feed request. */
export interface TesseraToDsFeedResponse {
    contract_version: 'v1';
    /** DS-assigned opaque identifier for downstream attribution audit. */
    correlation_key: string;
    /** Acceptance discriminator. */
    status: 'accepted' | 'rejected';
    /** Populated when `status === 'rejected'`. */
    reason?: string;
}
/** HTTP transport metadata pin (interface form — type-level). */
export interface TesseraToDsFeedEndpoint {
    readonly path: '/v1/tessera/verdict-groups';
    readonly method: 'POST';
}
/** HTTP transport metadata pin (const form — runtime-accessible literal). */
export declare const TESSERA_TO_DS_FEED_ENDPOINT: {
    readonly path: "/v1/tessera/verdict-groups";
    readonly method: "POST";
};
//# sourceMappingURL=feed-contract.d.ts.map