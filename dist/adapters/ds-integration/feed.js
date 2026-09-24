"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TesseraToDsFeedClient = void 0;
exports.verdictGroupToFeedRequest = verdictGroupToFeedRequest;
const node_http_1 = __importDefault(require("node:http"));
const feed_contract_1 = require("./feed-contract");
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
function verdictGroupToFeedRequest(group, emitted_at_ts) {
    const families = new Set();
    for (const v of group.firing_verdicts) {
        for (const f of v.firing_families)
            families.add(f);
    }
    const payload = {
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
class TesseraToDsFeedClient {
    constructor(opts) {
        this.host = opts.host;
        this.port = opts.port;
        this.timeoutMs = opts.request_timeout_ms ?? 5000;
    }
    /** POST one `TesseraToDsFeedRequest` to the DS correlation-layer
     *  endpoint. Always resolves; never throws. */
    async post(request, headers) {
        const body = JSON.stringify(request);
        const outgoingHeaders = {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body).toString(),
            'x-tessera-instance-id': headers['x-tessera-instance-id'],
            authorization: headers.authorization,
        };
        return new Promise((resolve) => {
            let settled = false;
            const settle = (r) => {
                if (settled)
                    return;
                settled = true;
                resolve(r);
            };
            const req = node_http_1.default.request({
                host: this.host,
                port: this.port,
                path: feed_contract_1.TESSERA_TO_DS_FEED_ENDPOINT.path,
                method: feed_contract_1.TESSERA_TO_DS_FEED_ENDPOINT.method,
                headers: outgoingHeaders,
                timeout: this.timeoutMs,
            }, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
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
                    let parsed;
                    try {
                        parsed = JSON.parse(raw);
                    }
                    catch {
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
            });
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
exports.TesseraToDsFeedClient = TesseraToDsFeedClient;
/** Type guard validating runtime shape of TesseraToDsFeedResponse. */
function isFeedResponse(v) {
    if (typeof v !== 'object' || v === null)
        return false;
    const r = v;
    return (r.contract_version === 'v1' &&
        typeof r.correlation_key === 'string' &&
        (r.status === 'accepted' || r.status === 'rejected'));
}
//# sourceMappingURL=feed.js.map