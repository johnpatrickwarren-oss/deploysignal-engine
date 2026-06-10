// test/ds-event-consumer.test.ts — remediation 2026-06-10 (H1, H2, L4).
//
// DS→Tessera event-consumer coverage:
//   H1 — every contract event_class (including 'chaos_experiment') is accepted;
//        the runtime VALID_EVENT_CLASSES set is derived from the contract.
//   H2 — shared-secret token verification (401 on mismatch when configured)
//        and request-body size cap (413 when exceeded).
//   L4 — freeze_hook_activated reflects whether an 'activate' subscriber
//        actually received the event.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { DsEventConsumer } from '../ds-integration/event-consumer';
import {
  DEPLOY_EVENT_CLASSES,
  DS_TO_TESSERA_EVENT_ENDPOINT,
  type DeployEventPayload,
  type DsToTesseraEventResponse,
} from '../ds-integration/event-contract';

interface PostResult {
  status: number;
  body: DsToTesseraEventResponse;
}

function postEvent(
  port: number,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<PostResult> {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: DS_TO_TESSERA_EVENT_ENDPOINT.path,
        headers: {
          'content-type': 'application/json',
          'x-ds-instance-id': 'ds-test-1',
          authorization: 'Bearer test-token',
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as DsToTesseraEventResponse,
          });
        });
      },
    );
    req.on('error', reject);
    req.end(raw);
  });
}

function envelopeFor(eventClass: DeployEventPayload['event_class']): unknown {
  return {
    contract_version: 'v1',
    event: {
      event_id: `evt-${eventClass}`,
      event_class: eventClass,
      event_ts: 1_700_000_000,
    },
    emitted_at_ts: 1_700_000_001,
  };
}

test('H1: consumer accepts every contract event_class, including chaos_experiment', async () => {
  const consumer = new DsEventConsumer({ port: 0 });
  const received: string[] = [];
  consumer.on('activate', (ev) => received.push(ev.event_class));
  await consumer.start();
  const port = consumer.address!.port;
  try {
    assert.ok(
      (DEPLOY_EVENT_CLASSES as readonly string[]).includes('chaos_experiment'),
      'contract must enumerate chaos_experiment',
    );
    for (const cls of DEPLOY_EVENT_CLASSES) {
      const res = await postEvent(port, envelopeFor(cls));
      assert.equal(res.status, 202, `event_class '${cls}' must be accepted (got ${res.status}: ${res.body.reason})`);
      assert.equal(res.body.status, 'accepted');
    }
    assert.deepEqual(received.sort(), [...DEPLOY_EVENT_CLASSES].sort());
  } finally {
    await consumer.stop();
  }
});

test('H1: consumer still rejects an unknown event_class', async () => {
  const consumer = new DsEventConsumer({ port: 0 });
  await consumer.start();
  const port = consumer.address!.port;
  try {
    const res = await postEvent(port, envelopeFor('not_a_class' as DeployEventPayload['event_class']));
    assert.equal(res.status, 400);
    assert.equal(res.body.reason, 'invalid event_class');
  } finally {
    await consumer.stop();
  }
});

test('H2: configured auth_token rejects mismatched bearer tokens with 401', async () => {
  const consumer = new DsEventConsumer({ port: 0, auth_token: 'sekrit' });
  let activated = 0;
  consumer.on('activate', () => activated++);
  await consumer.start();
  const port = consumer.address!.port;
  try {
    const bad = await postEvent(port, envelopeFor('firmware_push'), {
      authorization: 'Bearer wrong-token',
    });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.status, 'rejected');
    assert.equal(activated, 0, 'freeze hook must not be reachable without the shared secret');

    const good = await postEvent(port, envelopeFor('firmware_push'), {
      authorization: 'Bearer sekrit',
    });
    assert.equal(good.status, 202);
    assert.equal(activated, 1);
  } finally {
    await consumer.stop();
  }
});

test('H2: oversized request bodies are rejected with 413', async () => {
  const consumer = new DsEventConsumer({ port: 0, max_body_bytes: 1024 });
  let activated = 0;
  consumer.on('activate', () => activated++);
  await consumer.start();
  const port = consumer.address!.port;
  try {
    const envelope = envelopeFor('env_change') as { event: Record<string, unknown> };
    envelope.event.metadata = { pad: 'x'.repeat(4096) };
    const res = await postEvent(port, envelope).catch((err: NodeJS.ErrnoException) => err.code);
    // Server replies 413 then destroys the socket; depending on timing the
    // client either sees the response or a reset.
    if (typeof res === 'object' && res !== null && 'status' in res) {
      assert.equal((res as PostResult).status, 413);
    } else {
      assert.ok(res === 'ECONNRESET' || res === 'EPIPE', `unexpected client error: ${String(res)}`);
    }
    assert.equal(activated, 0, 'oversized body must not activate the freeze hook');
  } finally {
    await consumer.stop();
  }
});

test('L4: freeze_hook_activated is false when no activate subscriber is attached', async () => {
  const consumer = new DsEventConsumer({ port: 0 });
  await consumer.start();
  const port = consumer.address!.port;
  try {
    const res = await postEvent(port, envelopeFor('config_change'));
    assert.equal(res.status, 202);
    assert.equal(res.body.freeze_hook_activated, false);
    assert.equal(res.body.freeze_hook_activated_at_ts, undefined);

    consumer.on('activate', () => {});
    const res2 = await postEvent(port, envelopeFor('config_change'));
    assert.equal(res2.status, 202);
    assert.equal(res2.body.freeze_hook_activated, true);
    assert.equal(typeof res2.body.freeze_hook_activated_at_ts, 'number');
  } finally {
    await consumer.stop();
  }
});
