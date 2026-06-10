import { EventEmitter } from 'node:events';
import { type DeployEventPayload } from './event-contract';
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
export declare const DEFAULT_MAX_BODY_BYTES: number;
/** Event names emitted by DsEventConsumer.
 *  - 'activate' — payload accepted; subscriber receives DeployEventPayload.
 *  - 'parse_error' — payload rejected; subscriber receives a reason string
 *    (observability hook; tests + future audit pipelines may subscribe). */
export interface DsEventConsumerEvents {
    activate: [event: DeployEventPayload];
    parse_error: [reason: string];
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
export declare class DsEventConsumer extends EventEmitter {
    private readonly host;
    private readonly port;
    private readonly timeoutMs;
    private readonly authToken;
    private readonly maxBodyBytes;
    private server;
    private boundPort;
    constructor(opts: DsEventConsumerOpts);
    /** Bound port after start(); null before start() / after stop(). */
    get address(): {
        host: string;
        port: number;
    } | null;
    start(): Promise<void>;
    stop(): Promise<void>;
    private handle;
    private writeResponse;
}
//# sourceMappingURL=event-consumer.d.ts.map