import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkExpiry } from '../expiry-check.mjs';
import { fileSha256 } from '../lib/freeze.mjs';

test('drifted source file is reported; matching one is not', () => {
  const root = mkdtempSync(join(tmpdir(), 'exp-'));
  const cards = join(root, 'cards');
  mkdirSync(cards);
  writeFileSync(join(root, 'ok.ts'), 'stable');
  writeFileSync(join(root, 'moved.ts'), 'v1');
  const card = (id, path, sha256) => writeFileSync(join(cards, `${id}.json`),
    JSON.stringify({ detector_id: id, source_files: [{ path, sha256 }] }));
  card('a', 'ok.ts', fileSha256(join(root, 'ok.ts')));
  card('b', 'moved.ts', fileSha256(join(root, 'moved.ts')));
  writeFileSync(join(root, 'moved.ts'), 'v2'); // drift after freeze
  const drifted = checkExpiry(cards, root);
  assert.equal(drifted.length, 1);
  assert.equal(drifted[0].card, 'b');
  assert.equal(drifted[0].path, 'moved.ts');
});

test('a "../"-prefixed source path resolves against an explicit siblingRoot', () => {
  const root = mkdtempSync(join(tmpdir(), 'exp-'));
  const siblingRoot = mkdtempSync(join(tmpdir(), 'sib-'));
  mkdirSync(join(siblingRoot, 'deploysignal', 'tools', 'calibrators'), { recursive: true });
  writeFileSync(join(siblingRoot, 'deploysignal', 'tools', 'calibrators', 'family-e.ts'), 'const x = 1;');

  const cards = join(root, 'cards');
  mkdirSync(cards);

  const expectedSha = fileSha256(join(siblingRoot, 'deploysignal', 'tools', 'calibrators', 'family-e.ts'));
  const card = (id, path, sha256) => writeFileSync(join(cards, `${id}.json`),
    JSON.stringify({ detector_id: id, source_files: [{ path, sha256 }] }));
  card('sibling-test', '../deploysignal/tools/calibrators/family-e.ts', expectedSha);

  const drifted = checkExpiry(cards, root, siblingRoot);
  assert.equal(drifted.length, 0); // should match since we computed the hash correctly
});
