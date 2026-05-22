import type { VerdictGroup } from '../types/verdict';
import { type TesseraToDsFeedRequest, type TesseraToDsFeedResponse, type TesseraToDsAuthHeaders } from './feed-contract';
/** Discriminator for the four error classes the adapter can surface. */
export type FeedErrorKind = 'network_error' | 'http_4xx' | 'http_5xx' | 'invalid_response';
/** Structured error surface for non-2xx / non-shape-matching responses. */
export interface FeedError {
    kind: FeedErrorKind;
    status_code?: number;
    reason: string;
}
/** Discriminated-union result of a feed POST. The Promise returned by
 *  TesseraToDsFeedClient.post() ALWAYS resolves; failures are encoded in
 *  the union rather than thrown. */
export type FeedResult = {
    ok: true;
    response: TesseraToDsFeedResponse;
} | {
    ok: false;
    error: FeedError;
};
/** Connection options for the feed client. */
export interface TesseraToDsFeedClientOpts {
    /** DS correlation-layer host (e.g., 'localhost' for in-process mock). */
    host: string;
    /** DS correlation-layer port. */
    port: number;
    /** Transport protocol; only 'http' supported at R65 (TLS deferred to
     *  auth-scheme round). */
    protocol?: 'http';
    /** Request timeout in milliseconds; default 5000. */
    request_timeout_ms?: number;
}
/** Pure projection from engine `VerdictGroup` to wire-format
 *  `TesseraToDsFeedRequest`. Caller controls `emitted_at_ts` (the
 *  Tessera-side emit timestamp; epoch seconds).
 *
 *  Wire-format invariants preserved:
 *   - `contract_version: 'v1'` (literal; pins contract identity)
 *   - `correlational_not_causal: true` (literal per A16; mirrors
 *     `engine/types/verdict.ts:298`)
 *   - `cluster_event_id` conditionally included (omitted when source
 *     `group.cluster_event_id` is undefined)
 *   - `firing_family_count`: dedup count of distinct firing families
 *     across all firing verdicts in the group */
export declare function verdictGroupToFeedRequest(group: VerdictGroup, emitted_at_ts: number): TesseraToDsFeedRequest;
/** HTTP client adapter. Carries connection options; exposes a single
 *  `post()` method that returns a `FeedResult`. */
export declare class TesseraToDsFeedClient {
    private readonly host;
    private readonly port;
    private readonly timeoutMs;
    constructor(opts: TesseraToDsFeedClientOpts);
    /** POST one `TesseraToDsFeedRequest` to the DS correlation-layer
     *  endpoint. Always resolves; never throws. */
    post(request: TesseraToDsFeedRequest, headers: TesseraToDsAuthHeaders): Promise<FeedResult>;
}
//# sourceMappingURL=feed.d.ts.map