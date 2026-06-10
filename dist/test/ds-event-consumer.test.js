"use strict";
// test/ds-event-consumer.test.ts — remediation 2026-06-10 (H1, H2, L4).
//
// DS→Tessera event-consumer coverage:
//   H1 — every contract event_class (including 'chaos_experiment') is accepted;
//        the runtime VALID_EVENT_CLASSES set is derived from the contract.
//   H2 — shared-secret token verification (401 on mismatch when configured)
//        and request-body size cap (413 when exceeded).
//   L4 — freeze_hook_activated reflects whether an 'activate' subscriber
//        actually received the event.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_http_1 = __importDefault(require("node:http"));
const event_consumer_1 = require("../ds-integration/event-consumer");
const event_contract_1 = require("../ds-integration/event-contract");
function postEvent(port, payload, headers = {}) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = node_http_1.default.request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: event_contract_1.DS_TO_TESSERA_EVENT_ENDPOINT.path,
            headers: {
                'content-type': 'application/json',
                'x-ds-instance-id': 'ds-test-1',
                authorization: 'Bearer test-token',
                ...headers,
            },
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                resolve({
                    status: res.statusCode ?? 0,
                    body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
                });
            });
        });
        req.on('error', reject);
        req.end(raw);
    });
}
function envelopeFor(eventClass) {
    return {
        contract_version: 'v1',
        event: {
            event_id: `evt-${eventClass}`,
            event_class: eventClass,
            event_ts: 1700000000,
        },
        emitted_at_ts: 1700000001,
    };
}
(0, node_test_1.test)('H1: consumer accepts every contract event_class, including chaos_experiment', async () => {
    const consumer = new event_consumer_1.DsEventConsumer({ port: 0 });
    const received = [];
    consumer.on('activate', (ev) => received.push(ev.event_class));
    await consumer.start();
    const port = consumer.address.port;
    try {
        strict_1.default.ok(event_contract_1.DEPLOY_EVENT_CLASSES.includes('chaos_experiment'), 'contract must enumerate chaos_experiment');
        for (const cls of event_contract_1.DEPLOY_EVENT_CLASSES) {
            const res = await postEvent(port, envelopeFor(cls));
            strict_1.default.equal(res.status, 202, `event_class '${cls}' must be accepted (got ${res.status}: ${res.body.reason})`);
            strict_1.default.equal(res.body.status, 'accepted');
        }
        strict_1.default.deepEqual(received.sort(), [...event_contract_1.DEPLOY_EVENT_CLASSES].sort());
    }
    finally {
        await consumer.stop();
    }
});
(0, node_test_1.test)('H1: consumer still rejects an unknown event_class', async () => {
    const consumer = new event_consumer_1.DsEventConsumer({ port: 0 });
    await consumer.start();
    const port = consumer.address.port;
    try {
        const res = await postEvent(port, envelopeFor('not_a_class'));
        strict_1.default.equal(res.status, 400);
        strict_1.default.equal(res.body.reason, 'invalid event_class');
    }
    finally {
        await consumer.stop();
    }
});
(0, node_test_1.test)('H2: configured auth_token rejects mismatched bearer tokens with 401', async () => {
    const consumer = new event_consumer_1.DsEventConsumer({ port: 0, auth_token: 'sekrit' });
    let activated = 0;
    consumer.on('activate', () => activated++);
    await consumer.start();
    const port = consumer.address.port;
    try {
        const bad = await postEvent(port, envelopeFor('firmware_push'), {
            authorization: 'Bearer wrong-token',
        });
        strict_1.default.equal(bad.status, 401);
        strict_1.default.equal(bad.body.status, 'rejected');
        strict_1.default.equal(activated, 0, 'freeze hook must not be reachable without the shared secret');
        const good = await postEvent(port, envelopeFor('firmware_push'), {
            authorization: 'Bearer sekrit',
        });
        strict_1.default.equal(good.status, 202);
        strict_1.default.equal(activated, 1);
    }
    finally {
        await consumer.stop();
    }
});
(0, node_test_1.test)('H2: oversized request bodies are rejected with 413', async () => {
    const consumer = new event_consumer_1.DsEventConsumer({ port: 0, max_body_bytes: 1024 });
    let activated = 0;
    consumer.on('activate', () => activated++);
    await consumer.start();
    const port = consumer.address.port;
    try {
        const envelope = envelopeFor('env_change');
        envelope.event.metadata = { pad: 'x'.repeat(4096) };
        const res = await postEvent(port, envelope).catch((err) => err.code);
        // Server replies 413 then destroys the socket; depending on timing the
        // client either sees the response or a reset.
        if (typeof res === 'object' && res !== null && 'status' in res) {
            strict_1.default.equal(res.status, 413);
        }
        else {
            strict_1.default.ok(res === 'ECONNRESET' || res === 'EPIPE', `unexpected client error: ${String(res)}`);
        }
        strict_1.default.equal(activated, 0, 'oversized body must not activate the freeze hook');
    }
    finally {
        await consumer.stop();
    }
});
(0, node_test_1.test)('L4: freeze_hook_activated is false when no activate subscriber is attached', async () => {
    const consumer = new event_consumer_1.DsEventConsumer({ port: 0 });
    await consumer.start();
    const port = consumer.address.port;
    try {
        const res = await postEvent(port, envelopeFor('config_change'));
        strict_1.default.equal(res.status, 202);
        strict_1.default.equal(res.body.freeze_hook_activated, false);
        strict_1.default.equal(res.body.freeze_hook_activated_at_ts, undefined);
        consumer.on('activate', () => { });
        const res2 = await postEvent(port, envelopeFor('config_change'));
        strict_1.default.equal(res2.status, 202);
        strict_1.default.equal(res2.body.freeze_hook_activated, true);
        strict_1.default.equal(typeof res2.body.freeze_hook_activated_at_ts, 'number');
    }
    finally {
        await consumer.stop();
    }
});
//# sourceMappingURL=ds-event-consumer.test.js.map