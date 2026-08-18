// tests/seed-scheme.test.mjs — the property the first run's generator lacked (review 2026-08-18):
// streams must be independent generators, not offsets on one shared 2^32 LCG cycle. splitmix64
// streams from structurally-distinct 64-bit keys overlap only if two keys differ by a multiple of
// the fixed gamma within the consumed range — expected overlapping pairs across this study's
// ~232k streams x ~3e4 draws each is ~1e-4 against ~2.8e4 under the superseded 32-bit scheme.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamRng, streamKey } from '../harness/seed.mjs';

test('key packing is bit-disjoint, so distinct (cell, draw, traj) triples give distinct keys', () => {
  const seen = new Set();
  for (const cell of [0, 1, 11, 255]) {
    for (const draw of [0, 1, 101, 4095]) {
      for (const traj of [0, 1, 4000, 1048575]) {
        const k = streamKey(cell, draw, traj);
        assert.ok(!seen.has(k), `collision at (${cell},${draw},${traj})`);
        seen.add(k);
      }
    }
  }
});

test('out-of-range indices are refused rather than silently wrapped', () => {
  assert.throws(() => streamKey(256, 0, 0));
  assert.throws(() => streamKey(0, 4096, 0));
  assert.throws(() => streamKey(0, 0, 1048576));
});

test('a stream is deterministic and distinct streams differ', () => {
  const a1 = streamRng(3, 5, 7), a2 = streamRng(3, 5, 7), b = streamRng(3, 5, 8);
  const seqA1 = Array.from({ length: 100 }, a1);
  const seqA2 = Array.from({ length: 100 }, a2);
  const seqB = Array.from({ length: 100 }, b);
  assert.deepEqual(seqA1, seqA2);
  assert.notDeepEqual(seqA1, seqB);
  for (const x of seqA1) assert.ok(x >= 0 && x < 1);
});
