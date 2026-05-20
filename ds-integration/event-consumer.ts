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
import {
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
  /** Bind host; default '127.0.0.1'. */
  host?: string;
  /** Bind port; caller picks. Use 0 for kernel-assigned (recommended in tests). */
  port: number;
  /** Default 5000. */
  request_timeout_ms?: number;
}

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

const VALID_EVENT_CLASSES: ReadonlySet<DeployEventPayload['event_class']> = new Set([
  'firmware_push',
  'model_redeploy',
  'env_change',
  'config_change',
  'capacity_change',
]);

/** Validate the DS→Tessera auth headers shape. */
function validateAuthHeaders(
  headers: http.IncomingHttpHeaders,
): ParseResult<DsToTesseraAuthHeaders> {
  const instId = headers['x-ds-instance-id'];
  const auth = headers['authorization'];
  if (typeof instId !== 'string' || instId.length === 0) {
    return { ok: false, reason: 'missing x-ds-instance-id' };
  }
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing or malformed authorization' };
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
  private server: http.Server | null = null;
  private boundPort: number | null = null;

  constructor(opts: DsEventConsumerOpts) {
    super();
    this.host = opts.host ?? '127.0.0.1';
    this.port = opts.port;
    this.timeoutMs = opts.request_timeout_ms ?? 5000;
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

    const authResult = validateAuthHeaders(req.headers);
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
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
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
      this.emit('activate', envelope.value.event);
      const nowSec = Math.floor(Date.now() / 1000);
      this.writeResponse(res, 202, {
        contract_version: 'v1',
        status: 'accepted',
        freeze_hook_activated: true,
        freeze_hook_activated_at_ts: nowSec,
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
