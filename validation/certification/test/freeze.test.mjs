import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stampPins, fileSha256 } from '../lib/freeze.mjs';

test('stampPins fills engine sha and file hashes without mutating input', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  writeFileSync(join(root, 'a.ts'), 'export const x = 1;\n');
  const card = {
    engine_pin: { version: 'v0.6.6-pre', sha: null },
    source_files: [{ path: 'a.ts', sha256: null }],
  };
  const out = stampPins(card, { repoRoot: root, gitSha: 'abc123', version: 'v0.6.6-pre' });
  assert.equal(out.engine_pin.sha, 'abc123');
  assert.match(out.source_files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(card.engine_pin.sha, null); // input untouched
});

test('fileSha256 is deterministic', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  const p = join(root, 'b.txt');
  writeFileSync(p, 'same bytes');
  assert.equal(fileSha256(p), fileSha256(p));
});

test('a missing source file throws with the path in the message', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  const card = { engine_pin: { version: 'x', sha: null }, source_files: [{ path: 'nope.ts', sha256: null }] };
  assert.throws(() => stampPins(card, { repoRoot: root, gitSha: 's', version: 'x' }), /nope\.ts/);
});
