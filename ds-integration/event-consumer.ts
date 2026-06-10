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

import http from 'node:http';
import { EventEmitter } from 'node:events';
import { timingSafeEqual } from 'node:crypto';
import {
  DEPLOY_EVENT_CLASSES,
  DS_TO_TESSERA_EVENT_ENDPOINT,
  type DeployEventPayload,
  type DsToTesseraEventRequest,
  type DsToTesseraEventResponse,
} from './event-contract';

/** Auth headers expected on the DS→Tessera event POST.
 *
 *  Note (R66): defined locally in this module rather than in
 *  event-contract.ts because the R62 contract did not enumerate a
 *  DsToTesseraAuthHeaders type (only the feed-direction
 *  TesseraToDsAuthHeaders in feed-contract.ts:55). The CLUSTER-HANDOFF
 *  document references DsToTesseraAuthHeaders as a contract export; that is
 *  inaccurate (verified empirically at R66 spec-emit). Future promotion to
 *  the contract module is a separate round outside R66 anti-scope. */
export interface DsToTesseraAuthHeaders {
  'x-ds-instance-id': string;
  authorization: `Bearer ${string}`;
}

/** Connection options for the consumer server. */
export interface DsEventConsumerOpts {
  /** Bind host; default '127.0.0.1'.
   *
   *  SECURITY: the loopback default is a load-bearing assumption — when no
   *  `auth_token` is configured the only protection is that the server is
   *  not reachable off-host. Set `auth_token` before binding to any
   *  non-loopback host. */
  host?: string;
  /** Bind port; caller picks. Use 0 for kernel-assigned (recommended in tests). */
  port: number;
  /** Default 5000. */
  request_timeout_ms?: number;
  /** Shared secret for bearer-token verification (remediation 2026-06-10
   *  H2). When set, every request must carry `authorization: Bearer
   *  <auth_token>` (compared via crypto.timingSafeEqual); mismatches are
   *  rejected 401 before the body is read. When unset, only the header
   *  shape is checked (legacy R66 behavior; acceptable only behind the
   *  loopback default-bind documented on `host`). */
  auth_token?: string;
  /** Max accepted request-body size in bytes; default 1 MiB (remediation
   *  2026-06-10 H2). Larger bodies are rejected 413 and the connection is
   *  destroyed, bounding memory per request. */
  max_body_bytes?: number;
}

/** Default request-body cap (1 MiB). */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/** Event names emitted by DsEventConsumer.
 *  - 'activate' — payload accepted; subscriber receives DeployEventPayload.
 *  - 'parse_error' — payload rejected; subscriber receives a reason string
 *    (observability hook; tests + future audit pipelines may subscribe). */
export interface DsEventConsumerEvents {
  activate: [event: DeployEventPayload];
  parse_error: [reason: string];
}

/** Internal validation result for body / auth-header parsing. */
type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

// Derived from the contract's single source of truth so the runtime set can
// never drift from the DeployEventPayload['event_class'] union again
// (remediation 2026-06-10 H1: a hand-maintained copy here omitted
// 'chaos_experiment', 400-rejecting valid Anvil chaos events).
const VALID_EVENT_CLASSES: ReadonlySet<DeployEventPayload['event_class']> = new Set(
  DEPLOY_EVENT_CLASSES,
);

/** Constant-time bearer-token comparison. Hashless timingSafeEqual requires
 *  equal lengths; length mismatch is an immediate (non-secret-dependent)
 *  reject. */
function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Validate the DS→Tessera auth headers shape and (when a shared secret is
 *  configured) verify the bearer token. */
function validateAuthHeaders(
  headers: http.IncomingHttpHeaders,
  authToken: string | undefined,
): ParseResult<DsToTesseraAuthHeaders> {
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
      authorization: auth as `Bearer ${string}`,
    },
  };
}

/** Validate the DeployEventPayload structural shape. */
function validateDeployEventPayload(parsed: unknown): ParseResult<DeployEventPayload> {
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'body is not an object' };
  }
  const p = parsed as Record<string, unknown>;
  if (typeof p.event_id !== 'string' || p.event_id.length === 0) {
    return { ok: false, reason: 'missing event_id' };
  }
  if (
    typeof p.event_class !== 'string' ||
    !VALID_EVENT_CLASSES.has(p.event_class as DeployEventPayload['event_class'])
  ) {
    return { ok: false, reason: 'invalid event_class' };
  }
  if (typeof p.event_ts !== 'number' || !Number.isFinite(p.event_ts)) {
    return { ok: false, reason: 'missing or non-numeric event_ts' };
  }
  if (
    p.event_window_end_ts !== undefined &&
    (typeof p.event_window_end_ts !== 'number' || !Number.isFinite(p.event_window_end_ts))
  ) {
    return { ok: false, reason: 'event_window_end_ts is non-numeric' };
  }
  if (
    p.metadata !== undefined &&
    (typeof p.metadata !== 'object' || p.metadata === null || Array.isArray(p.metadata))
  ) {
    return { ok: false, reason: 'metadata is not a plain object' };
  }
  return {
    ok: true,
    value: {
      event_id: p.event_id,
      event_class: p.event_class as DeployEventPayload['event_class'],
      event_ts: p.event_ts,
      ...(p.event_window_end_ts !== undefined
        ? { event_window_end_ts: p.event_window_end_ts as number }
        : {}),
      ...(p.metadata !== undefined
        ? { metadata: p.metadata as Record<string, string> }
        : {}),
    },
  };
}

/** Validate top-level DsToTesseraEventRequest envelope (contract_version + event + emitted_at_ts). */
function validateRequestEnvelope(parsed: unknown): ParseResult<DsToTesseraEventRequest> {
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'body is not an object' };
  }
  const r = parsed as Record<string, unknown>;
  if (r.contract_version !== 'v1') {
    return { ok: false, reason: 'contract_version must be v1' };
  }
  if (typeof r.emitted_at_ts !== 'number' || !Number.isFinite(r.emitted_at_ts)) {
    return { ok: false, reason: 'missing or non-numeric emitted_at_ts' };
  }
  const inner = validateDeployEventPayload(r.event);
  if (!inner.ok) return inner;
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
export class DsEventConsumer extends EventEmitter {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private readonly authToken: string | undefined;
  private readonly maxBodyBytes: number;
  private server: http.Server | null = null;
  private boundPort: number | null = null;

  constructor(opts: DsEventConsumerOpts) {
    super();
    this.host = opts.host ?? '127.0.0.1';
    this.port = opts.port;
    this.timeoutMs = opts.request_timeout_ms ?? 5000;
    this.authToken = opts.auth_token;
    this.maxBodyBytes = opts.max_body_bytes ?? DEFAULT_MAX_BODY_BYTES;
  }

  /** Bound port after start(); null before start() / after stop(). */
  get address(): { host: string; port: number } | null {
    return this.boundPort === null ? null : { host: this.host, port: this.boundPort };
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const server = http.createServer((req, res) => this.handle(req, res));
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

  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
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

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST' || req.url !== DS_TO_TESSERA_EVENT_ENDPOINT.path) {
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

    const chunks: Buffer[] = [];
    let received = 0;
    let overflowed = false;
    req.on('data', (c: Buffer) => {
      if (overflowed) return;
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
      if (overflowed) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
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

  private writeResponse(
    res: http.ServerResponse,
    status: number,
    body: DsToTesseraEventResponse,
  ): void {
    const json = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(json).toString(),
    });
    res.end(json);
  }
}
