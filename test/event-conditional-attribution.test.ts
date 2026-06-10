// test/event-conditional-attribution.test.ts — remediation 2026-06-10 (M4).
//
// The ITS pre/post comparison mixed units: pre_window_count counted fired
// EVENTS (one shard firing 3× counted 3) while the post-window measurement
// counted DISTINCT SHARDS. The surfacing filter (memberCount - preCount <
// minDelta) therefore compared mismatched units, so a single noisy shard
// repeat-firing in the pre-window could suppress a genuine multi-shard
// post-event elevation. Both windows must count distinct shards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attributeEventConditional } from '../events/event-conditional-attribution';

const T = 10_000;

test('M4: repeat-firing single shard in the pre-window does not suppress a multi-shard post elevation', () => {
  const result = attributeEventConditional({
    cluster_events: [
      { event_id: 'ev-1', kind: 'firmware_push', event_ts: T },
    ],
    fired_events: [
      // Pre-window: ONE noisy shard firing 3 times → 1 distinct shard.
      { shard_node_id: 'gpu:n1:0', event_ts: T - 200 },
      { shard_node_id: 'gpu:n1:0', event_ts: T - 150 },
      { shard_node_id: 'gpu:n1:0', event_ts: T - 100 },
      // Post-window: 2 distinct shards correlated with the event.
      { shard_node_id: 'gpu:n2:0', event_ts: T + 10 },
      { shard_node_id: 'gpu:n3:0', event_ts: T + 20 },
    ],
    opts: { now: () => T + 1000 },
  });

  // Distinct-shard units: post 2 vs pre 1 → delta 1 >= default minDelta 1;
  // candidate must surface. (Event-counted pre was 3 → delta -1 → suppressed.)
  assert.equal(result.candidates.length, 1, 'candidate suppressed by event-vs-shard unit mismatch');
  const c = result.candidates[0];
  assert.equal(c.pre_window_count, 1, 'pre_window_count must count distinct shards');
  assert.equal(c.post_window_count, 2);
  assert.deepEqual(c.member_shard_ids, ['gpu:n2:0', 'gpu:n3:0']);
});

test('M4: pre-window distinct-shard counting keeps boundary semantics (fire at event_ts is post)', () => {
  const result = attributeEventConditional({
    cluster_events: [{ event_id: 'ev-2', kind: 'env_change', event_ts: T }],
    fired_events: [
      { shard_node_id: 'gpu:a:0', event_ts: T },      // exactly at T → post
      { shard_node_id: 'gpu:b:0', event_ts: T + 5 },
    ],
    opts: { now: () => T + 1000 },
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].pre_window_count, 0);
  assert.equal(result.candidates[0].post_window_count, 2);
});
