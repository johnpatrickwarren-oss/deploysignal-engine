"use strict";
// engine/ds-integration/event-consumer.ts — Phase 3 SLICE 3 Wave 10 WU-Phase3-3C (R66).
//
// DS→Tessera event consumer HTTP server adapter. Receives DeployEventPayload
// POSTs on DS_TO_TESSERA_EVENT_ENDPOINT.path; emits 'activate' events with
// parsed DeployEventPayload for downstream subscribers (e.g., the freeze-hook
// factory in freeze-hook-factory.ts).
//
// R66 deliverable: standalone server adapter only. Production wiring to a
// freeze-hook factory is exemplified in tests but not connected to a live
// emission path at R66.
//
// Tessera-original code. No external dependencies (Node.js built-in node:http
// + node:events only, per W3-4 Option A).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DsEventConsumer = exports.DEFAULT_MAX_BODY_BYTES = void 0;
const node_http_1 = __importDefault(require("node:http"));
const node_events_1 = require("node:events");
const node_crypto_1 = require("node:crypto");
const event_contract_1 = require("./event-contract");
/** Default request-body cap (1 MiB). */
exports.DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
// Derived from the contract's single source of truth so the runtime set can
// never drift from the DeployEventPayload['event_class'] union again
// (remediation 2026-06-10 H1: a hand-maintained copy here omitted
// 'chaos_experiment', 400-rejecting valid Anvil chaos events).
const VALID_EVENT_CLASSES = new Set(event_contract_1.DEPLOY_EVENT_CLASSES);
/** Constant-time bearer-token comparison. Hashless timingSafeEqual requires
 *  equal lengths; length mismatch is an immediate (non-secret-dependent)
 *  reject. */
function tokenMatches(presented, expected) {
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
/** Validate the DS→Tessera auth headers shape and (when a shared secret is
 *  configured) verify the bearer token. */
function validateAuthHeaders(headers, authToken) {
    const instId = headers['x-ds-instance-id'];
    const auth = headers['authorization'];
    if (typeof instId !== 'string' || instId.length === 0) {
        return { ok: false, reason: 'missing x-ds-instance-id' };
    }
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
        return { ok: false, reason: 'missing or malformed authorization' };
    }
    if (authToken !== undefined && !tokenMatches(auth.slice('Bearer '.length), authToken)) {
        return { ok: false, reason: 'invalid bearer token' };
    }
    return {
        ok: true,
        value: {
            'x-ds-instance-id': instId,
            authorization: auth,
        },
    };
}
/** Validate the DeployEventPayload structural shape. */
function validateDeployEventPayload(parsed) {
    if (typeof parsed !== 'object' || parsed === null) {
        return { ok: false, reason: 'body is not an object' };
    }
    const p = parsed;
    if (typeof p.event_id !== 'string' || p.event_id.length === 0) {
        return { ok: false, reason: 'missing event_id' };
    }
    if (typeof p.event_class !== 'string' ||
        !VALID_EVENT_CLASSES.has(p.event_class)) {
        return { ok: false, reason: 'invalid event_class' };
    }
    if (typeof p.event_ts !== 'number' || !Number.isFinite(p.event_ts)) {
        return { ok: false, reason: 'missing or non-numeric event_ts' };
    }
    if (p.event_window_end_ts !== undefined &&
        (typeof p.event_window_end_ts !== 'number' || !Number.isFinite(p.event_window_end_ts))) {
        return { ok: false, reason: 'event_window_end_ts is non-numeric' };
    }
    if (p.metadata !== undefined &&
        (typeof p.metadata !== 'object' || p.metadata === null || Array.isArray(p.metadata))) {
        return { ok: false, reason: 'metadata is not a plain object' };
    }
    return {
        ok: true,
        value: {
            event_id: p.event_id,
            event_class: p.event_class,
            event_ts: p.event_ts,
            ...(p.event_window_end_ts !== undefined
                ? { event_window_end_ts: p.event_window_end_ts }
                : {}),
            ...(p.metadata !== undefined
                ? { metadata: p.metadata }
                : {}),
        },
    };
}
/** Validate top-level DsToTesseraEventRequest envelope (contract_version + event + emitted_at_ts). */
function validateRequestEnvelope(parsed) {
    if (typeof parsed !== 'object' || parsed === null) {
        return { ok: false, reason: 'body is not an object' };
    }
    const r = parsed;
    if (r.contract_version !== 'v1') {
        return { ok: false, reason: 'contract_version must be v1' };
    }
    if (typeof r.emitted_at_ts !== 'number' || !Number.isFinite(r.emitted_at_ts)) {
        return { ok: false, reason: 'missing or non-numeric emitted_at_ts' };
    }
    const inner = validateDeployEventPayload(r.event);
    if (!inner.ok)
        return inner;
    return {
        ok: true,
        value: {
            contract_version: 'v1',
            event: inner.value,
            emitted_at_ts: r.emitted_at_ts,
        },
    };
}
/** HTTP server adapter consuming DS→Tessera deploy-event POSTs.
 *
 *  Lifecycle:
 *    const c = new DsEventConsumer({ port: 0 });
 *    c.on('activate', (event) => { ... });
 *    await c.start();
 *    // ... send POSTs ...
 *    await c.stop();
 *
 *  All emitted events go through node:events EventEmitter. */
class DsEventConsumer extends node_events_1.EventEmitter {
    constructor(opts) {
        super();
        this.server = null;
        this.boundPort = null;
        this.host = opts.host ?? '127.0.0.1';
        this.port = opts.port;
        this.timeoutMs = opts.request_timeout_ms ?? 5000;
        this.authToken = opts.auth_token;
        this.maxBodyBytes = opts.max_body_bytes ?? exports.DEFAULT_MAX_BODY_BYTES;
    }
    /** Bound port after start(); null before start() / after stop(). */
    get address() {
        return this.boundPort === null ? null : { host: this.host, port: this.boundPort };
    }
    start() {
        return new Promise((resolve, reject) => {
            const server = node_http_1.default.createServer((req, res) => this.handle(req, res));
            server.on('error', reject);
            server.listen(this.port, this.host, () => {
                const addr = server.address();
                this.boundPort =
                    typeof addr === 'object' && addr !== null ? addr.port : this.port;
                this.server = server;
                resolve();
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.server === null) {
                resolve();
                return;
            }
            this.server.close(() => {
                this.server = null;
                this.boundPort = null;
                resolve();
            });
        });
    }
    handle(req, res) {
        if (req.method !== 'POST' || req.url !== event_contract_1.DS_TO_TESSERA_EVENT_ENDPOINT.path) {
            this.writeResponse(res, 404, {
                contract_version: 'v1',
                status: 'rejected',
                freeze_hook_activated: false,
                reason: 'not found',
            });
            return;
        }
        const authResult = validateAuthHeaders(req.headers, this.authToken);
        if (!authResult.ok) {
            this.emit('parse_error', `auth: ${authResult.reason}`);
            this.writeResponse(res, 401, {
                contract_version: 'v1',
                status: 'rejected',
                freeze_hook_activated: false,
                reason: `auth: ${authResult.reason}`,
            });
            return;
        }
        const chunks = [];
        let received = 0;
        let overflowed = false;
        req.on('data', (c) => {
            if (overflowed)
                return;
            received += c.length;
            if (received > this.maxBodyBytes) {
                // Body cap (H2): reject and drop the connection so a hostile or
                // looping client cannot buffer unbounded memory server-side.
                overflowed = true;
                chunks.length = 0;
                this.emit('parse_error', 'request body too large');
                this.writeResponse(res, 413, {
                    contract_version: 'v1',
                    status: 'rejected',
                    freeze_hook_activated: false,
                    reason: 'request body too large',
                });
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            if (overflowed)
                return;
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                this.emit('parse_error', 'JSON parse error');
                this.writeResponse(res, 400, {
                    contract_version: 'v1',
                    status: 'rejected',
                    freeze_hook_activated: false,
                    reason: 'JSON parse error',
                });
                return;
            }
            const envelope = validateRequestEnvelope(parsed);
            if (!envelope.ok) {
                this.emit('parse_error', envelope.reason);
                this.writeResponse(res, 400, {
                    contract_version: 'v1',
                    status: 'rejected',
                    freeze_hook_activated: false,
                    reason: envelope.reason,
                });
                return;
            }
            // L4 (remediation 2026-06-10): only claim activation when an
            // 'activate' subscriber actually received the event — emit() returns
            // true iff at least one listener was invoked. The standalone adapter
            // with no wired freeze hook previously asserted activation
            // unconditionally.
            const delivered = this.emit('activate', envelope.value.event);
            const nowSec = Math.floor(Date.now() / 1000);
            this.writeResponse(res, 202, {
                contract_version: 'v1',
                status: 'accepted',
                freeze_hook_activated: delivered,
                ...(delivered ? { freeze_hook_activated_at_ts: nowSec } : {}),
            });
        });
        req.setTimeout(this.timeoutMs, () => req.destroy(new Error('request timeout')));
    }
    writeResponse(res, status, body) {
        const json = JSON.stringify(body);
        res.writeHead(status, {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(json).toString(),
        });
        res.end(json);
    }
}
exports.DsEventConsumer = DsEventConsumer;
//# sourceMappingURL=event-consumer.js.map