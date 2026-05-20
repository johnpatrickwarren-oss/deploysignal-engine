// engine/ds-integration/feed.ts — Phase 3 SLICE 3 Wave 10 WU-Phase3-3B (R65).
//
// Tessera→DS feed HTTP client adapter. Constructs VerdictGroupPayload from
// engine VerdictGroup instances per the R62 frozen contract; POSTs to the
// DS correlation layer endpoint via Node.js built-in node:http (no external
// deps per W3-4 Option A).
//
// R65 deliverable: standalone adapter only. Tessera-side wiring (integration
// into a production emission path) is deferred to a future, non-anti-scope
// round (see Q-R65-SPEC.md § 2.4 forward-flag).
//
// Tessera-original code. Extract target: NONE in R65 (engine npm extract
// DEFERRED per Option F to Phase 4 / dedicated design cycle).

import http from 'node:http';
import type { VerdictGroup } from '../types/verdict';
import {
  TESSERA_TO_DS_FEED_ENDPOINT,
  type TesseraToDsFeedRequest,
  type TesseraToDsFeedResponse,
  type TesseraToDsAuthHeaders,
  type VerdictGroupPayload,
} from './feed-contract';

/** Discriminator for the four error classes the adapter can surface. */
export type FeedErrorKind =
  | 'network_error'
  | 'http_4xx'
  | 'http_5xx'
  | 'invalid_response';

/** Structured error surface for non-2xx / non-shape-matching responses. */
export interface FeedError {
  kind: FeedErrorKind;
  status_code?: number;
  reason: string;
}

/** Discriminated-union result of a feed POST. The Promise returned by
 *  TesseraToDsFeedClient.post() ALWAYS resolves; failures are encoded in
 *  the union rather than thrown. */
export type FeedResult =
  | { ok: true; response: TesseraToDsFeedResponse }
  | { ok: false; error: FeedError };

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
export function verdictGroupToFeedRequest(
  group: VerdictGroup,
  emitted_at_ts: number,
): TesseraToDsFeedRequest {
  const families = new Set<string>();
  for (const v of group.firing_verdicts) {
    for (const f of v.firing_families) families.add(f);
  }
  const payload: VerdictGroupPayload = {
    group_id: group.group_id,
    deploy_id: group.deploy_id,
    window_start_ts: group.window_start_ts,
    window_end_ts: group.window_end_ts,
    firing_family_count: families.size,
    confidence: group.confidence,
    correlational_not_causal: true,
    ...(group.cluster_event_id !== undefined
      ? { cluster_event_id: group.cluster_event_id }
      : {}),
  };
  return {
    contract_version: 'v1',
    verdict_group: payload,
    emitted_at_ts,
  };
}

/** HTTP client adapter. Carries connection options; exposes a single
 *  `post()` method that returns a `FeedResult`. */
export class TesseraToDsFeedClient {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(opts: TesseraToDsFeedClientOpts) {
    this.host = opts.host;
    this.port = opts.port;
    this.timeoutMs = opts.request_timeout_ms ?? 5000;
  }

  /** POST one `TesseraToDsFeedRequest` to the DS correlation-layer
   *  endpoint. Always resolves; never throws. */
  async post(
    request: TesseraToDsFeedRequest,
    headers: TesseraToDsAuthHeaders,
  ): Promise<FeedResult> {
    const body = JSON.stringify(request);
    const outgoingHeaders: http.OutgoingHttpHeaders = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
      'x-tessera-instance-id': headers['x-tessera-instance-id'],
      authorization: headers.authorization,
    };

    return new Promise<FeedResult>((resolve) => {
      let settled = false;
      const settle = (r: FeedResult): void => {
        if (settled) return;
        settled = true;
        resolve(r);
      };

      const req = http.request(
        {
          host: this.host,
          port: this.port,
          path: TESSERA_TO_DS_FEED_ENDPOINT.path,
          method: TESSERA_TO_DS_FEED_ENDPOINT.method,
          headers: outgoingHeaders,
          timeout: this.timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;
            if (status >= 500) {
              settle({
                ok: false,
                error: { kind: 'http_5xx', status_code: status, reason: raw },
              });
              return;
            }
            if (status >= 400) {
              settle({
                ok: false,
                error: { kind: 'http_4xx', status_code: status, reason: raw },
              });
              return;
            }
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              settle({
                ok: false,
                error: {
                  kind: 'invalid_response',
                  status_code: status,
                  reason: 'JSON parse error',
                },
              });
              return;
            }
            if (!isFeedResponse(parsed)) {
              settle({
                ok: false,
                error: {
                  kind: 'invalid_response',
                  status_code: status,
                  reason: 'shape mismatch',
                },
              });
              return;
            }
            settle({ ok: true, response: parsed });
          });
        },
      );

      req.on('error', (err) => {
        settle({
          ok: false,
          error: { kind: 'network_error', reason: err.message },
        });
      });
      req.on('timeout', () => {
        req.destroy(new Error('request timeout'));
      });

      req.write(body);
      req.end();
    });
  }
}

/** Type guard validating runtime shape of TesseraToDsFeedResponse. */
function isFeedResponse(v: unknown): v is TesseraToDsFeedResponse {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    r.contract_version === 'v1' &&
    typeof r.correlation_key === 'string' &&
    (r.status === 'accepted' || r.status === 'rejected')
  );
}
