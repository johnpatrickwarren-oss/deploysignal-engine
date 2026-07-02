// test/adr-0022-calibrated-group-attribution.test.ts — ADR 0022, calibrated group evidence in
// attributeCommonMode (2026-07-02 math audit, finding F11).
//
// The raw ≥ min_member_count rule has no null model: under a per-shard false-fire rate α, a
// g-member group falsely surfaces with probability ≈ C(g,2)·α², which GROWS with group size —
// candidate strength depended on rack size. Locked here:
//   1. Rack-size calibration: the RAW ≥2-count false-candidate rate grows with g ∈ {4, 18, 72}
//      under a null fleet (α = 0.05, seeded), while thresholding on binom_tail ≤ 0.01 keeps the
//      false-candidate rate ~flat and small.
//   2. binomialUpperTail matches direct summation and is stable in the deep tail.
//   3. group_e_value = arithmetic mean of member e-values over ALL group members.
//   4. Coincidence window: fires far apart in time do NOT form a candidate; close fires DO.
//   5. Backward compat: calls without the new options produce identical results (no new keys).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  attributeCommonMode,
  binomialUpperTail,
  type FiredShardEvent,
} from '../topology/common-mode-attribution';
import type { TopologySnapshot } from '../types/verdict';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

/** One rack containing g gpu_shard members (maxHop 1 reaches rack from every shard). */
function rackSnapshot(g: number): TopologySnapshot {
  const nodes: TopologySnapshot['nodes'] = [{ id: 'rack-0', service_name: 'rack-0', kind: 'rack' }];
  const edges: TopologySnapshot['edges'] = [];
  for (let i = 0; i < g; i++) {
    const id = `shard-${String(i).padStart(3, '0')}`;
    nodes.push({ id, service_name: id, kind: 'gpu_shard' });
    edges.push({ from: 'rack-0', to: id, relationship: 'contains' });
  }
  return { nodes, edges, fetched_at_ts: 1000, source_id: 'adr0022-test', source_version: 'v1' };
}

const shardId = (i: number): string => `shard-${String(i).padStart(3, '0')}`;
const NOW = (): number => 2000;

test('ADR 0022: raw >=2-count false-candidate rate grows with group size; binom_tail <= 0.01 stays flat', () => {
  const ALPHA = 0.05, TRIALS = 400, Q = 0.01;
  const rawRate: number[] = [];
  const calRate: number[] = [];
  const sizes = [4, 18, 72];
  for (const g of sizes) {
    const snapshot = rackSnapshot(g);
    const rng = lcg(1234 + g);
    let raw = 0, cal = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      const fired: FiredShardEvent[] = [];
      for (let i = 0; i < g; i++) if (rng() < ALPHA) fired.push({ shard_node_id: shardId(i), event_ts: 100 });
      if (fired.length < 2) continue; // cannot form a candidate; count as no candidate either way
      const res = attributeCommonMode({
        fired_events: fired, snapshot,
        opts: { now: NOW, fleet_fire_rate: ALPHA },
      });
      if (res.candidates.length > 0) {
        raw++;
        const c = res.candidates[0];
        assert.equal(c.group_size, g, 'group_size must be the FULL rack membership, fired or not');
        assert.ok(c.binom_tail !== undefined && c.binom_tail > 0 && c.binom_tail <= 1);
        if (c.binom_tail! <= Q) cal++;
      }
    }
    rawRate.push(raw / TRIALS);
    calRate.push(cal / TRIALS);
  }
  // Raw candidate rate grows with g (the C(g,2)·α² defect): ~0.014 → ~0.23 → ~0.88 in theory.
  assert.ok(rawRate[0] < rawRate[1] && rawRate[1] < rawRate[2],
    `raw false-candidate rate must grow with g; got ${rawRate.map((r) => r.toFixed(3)).join(' -> ')}`);
  assert.ok(rawRate[2] > 0.5,
    `at g=72 the raw rule false-candidates on most windows; got ${rawRate[2].toFixed(3)}`);
  // Thresholding on the size-calibrated binom_tail keeps every group size ~flat and small (≤ q up to MC noise).
  for (let s = 0; s < sizes.length; s++) {
    assert.ok(calRate[s] <= 0.03,
      `binom_tail <= ${Q} false-candidate rate must stay small at g=${sizes[s]}; got ${calRate[s].toFixed(4)}`);
  }
  assert.ok(Math.max(...calRate) - Math.min(...calRate) <= 0.025,
    `calibrated false-candidate rate must be ~flat across g; got ${calRate.map((r) => r.toFixed(4)).join(', ')}`);
});

test('ADR 0022: binomialUpperTail matches direct summation and is stable in the deep tail', () => {
  // Direct summation cross-check (small g, no logs).
  const direct = (g: number, k: number, a: number): number => {
    const choose = (n: number, r: number): number => {
      let v = 1; for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1); return v;
    };
    let s = 0; for (let i = Math.max(k, 0); i <= g; i++) s += choose(g, i) * a ** i * (1 - a) ** (g - i);
    return s;
  };
  for (const [g, a] of [[10, 0.3], [18, 0.05], [7, 0.5]] as const) {
    for (let k = 0; k <= g + 1; k++) {
      const got = binomialUpperTail(g, k, a);
      const want = Math.min(direct(g, k, a), 1);
      assert.ok(Math.abs(got - want) < 1e-12, `binomialUpperTail(${g},${k},${a}) = ${got}, direct = ${want}`);
    }
  }
  // Boundaries + monotonicity in k.
  assert.equal(binomialUpperTail(50, 0, 0.1), 1);
  assert.equal(binomialUpperTail(50, 51, 0.1), 0);
  let prev = 1;
  for (let k = 1; k <= 72; k++) {
    const v = binomialUpperTail(72, k, 0.05);
    assert.ok(v <= prev + 1e-15, `tail must be non-increasing in k (k=${k})`);
    prev = v;
  }
  // Deep-tail stability (log-space sum: no underflow to NaN, no overflow).
  const deep = binomialUpperTail(5000, 200, 0.01);
  assert.ok(Number.isFinite(deep) && deep > 0 && deep < 1e-50, `deep tail must be a tiny positive number; got ${deep}`);
  assert.throws(() => binomialUpperTail(10, 2, 0), /alpha must be in \(0, 1\)/);
  assert.throws(() => binomialUpperTail(10, 2, 1), /alpha must be in \(0, 1\)/);
});

test('ADR 0022: group_e_value is the arithmetic mean over ALL group members', () => {
  const snapshot = rackSnapshot(5);
  const fired: FiredShardEvent[] = [
    { shard_node_id: shardId(0), event_ts: 10 },
    { shard_node_id: shardId(1), event_ts: 20 },
  ];
  // All 5 members supplied: one huge e-value among many zeros pulls the mean accordingly.
  const full = new Map<string, number>([
    [shardId(0), 50], [shardId(1), 0], [shardId(2), 0], [shardId(3), 0], [shardId(4), 0],
  ]);
  const res = attributeCommonMode({ fired_events: fired, snapshot, opts: { now: NOW, per_shard_e_values: full } });
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].group_size, 5);
  assert.equal(res.candidates[0].group_e_value, 10); // (50+0+0+0+0)/5 — over ALL members, not just fired
  // Members missing from the map are excluded (mean over the covered sub-group).
  const partial = new Map<string, number>([[shardId(0), 50], [shardId(1), 0]]);
  const res2 = attributeCommonMode({ fired_events: fired, snapshot, opts: { now: NOW, per_shard_e_values: partial } });
  assert.equal(res2.candidates[0].group_e_value, 25);
  // e-values must be non-negative.
  const bad = new Map<string, number>([[shardId(0), -1], [shardId(1), 0]]);
  assert.throws(
    () => attributeCommonMode({ fired_events: fired, snapshot, opts: { now: NOW, per_shard_e_values: bad } }),
    /must be finite and >= 0/,
  );
});

test('ADR 0022: coincidence window — far-apart fires do not form a candidate; close fires do', () => {
  const snapshot = rackSnapshot(4);
  const far: FiredShardEvent[] = [
    { shard_node_id: shardId(0), event_ts: 0 },
    { shard_node_id: shardId(1), event_ts: 10_000 },
  ];
  const resFar = attributeCommonMode({ fired_events: far, snapshot, opts: { now: NOW, coincidence_window_s: 3600 } });
  assert.equal(resFar.candidates.length, 0, 'fires 10_000 s apart with a 3600 s window must NOT cluster');
  const close: FiredShardEvent[] = [
    { shard_node_id: shardId(0), event_ts: 0 },
    { shard_node_id: shardId(1), event_ts: 600 },
  ];
  const resClose = attributeCommonMode({ fired_events: close, snapshot, opts: { now: NOW, coincidence_window_s: 3600 } });
  assert.equal(resClose.candidates.length, 1, 'the same fires 600 s apart MUST cluster');
  assert.deepEqual(resClose.candidates[0].member_shard_ids, [shardId(0), shardId(1)]);
  // Largest coincident subset: the straggler is dropped, the coincident pair survives.
  const mixed: FiredShardEvent[] = [
    { shard_node_id: shardId(0), event_ts: 0 },
    { shard_node_id: shardId(1), event_ts: 300 },
    { shard_node_id: shardId(2), event_ts: 10_000 },
  ];
  const resMixed = attributeCommonMode({ fired_events: mixed, snapshot, opts: { now: NOW, coincidence_window_s: 3600 } });
  assert.equal(resMixed.candidates.length, 1);
  assert.equal(resMixed.candidates[0].member_count, 2);
  assert.deepEqual(resMixed.candidates[0].member_shard_ids, [shardId(0), shardId(1)]);
  assert.equal(resMixed.candidates[0].earliest_event_ts, 0);
  assert.equal(resMixed.candidates[0].latest_event_ts, 300, 'timestamp aggregation covers the counted co-firing set only');
  // Option validation.
  assert.throws(
    () => attributeCommonMode({ fired_events: close, snapshot, opts: { coincidence_window_s: -1 } }),
    /coincidence_window_s must be finite and >= 0/,
  );
  assert.throws(
    () => attributeCommonMode({ fired_events: close, snapshot, opts: { fleet_fire_rate: 0 } }),
    /fleet_fire_rate must be in \(0, 1\)/,
  );
});

test('ADR 0022: backward compat — calls without the new options produce identical results, no new keys', () => {
  // Rack + psu + 3 shards; multi-touch, out-of-order timestamps to exercise the ts aggregation paths.
  const snapshot = rackSnapshot(3);
  snapshot.nodes.push({ id: 'psu-0', service_name: 'psu-0', kind: 'psu' });
  snapshot.edges.push({ from: 'psu-0', to: shardId(0), relationship: 'contains' });
  snapshot.edges.push({ from: 'psu-0', to: shardId(1), relationship: 'contains' });
  const fired: FiredShardEvent[] = [
    { shard_node_id: shardId(1), event_ts: 500 },
    { shard_node_id: shardId(0), event_ts: 900 },
    { shard_node_id: shardId(1), event_ts: 100 },
    { shard_node_id: shardId(2), event_ts: 700 },
  ];
  const legacy = attributeCommonMode({ fired_events: fired, snapshot, opts: { now: NOW } });
  // Exact legacy shape lock (kind order: psu before rack; per-shard-dedup'd min/max ts).
  assert.deepEqual(legacy.candidates, [
    {
      shared_node_id: 'psu-0',
      shared_node_kind: 'psu',
      member_shard_ids: [shardId(0), shardId(1)],
      member_count: 2,
      topology_distance: 1,
      earliest_event_ts: 100,
      latest_event_ts: 900,
      correlational_not_causal: true,
    },
    {
      shared_node_id: 'rack-0',
      shared_node_kind: 'rack',
      member_shard_ids: [shardId(0), shardId(1), shardId(2)],
      member_count: 3,
      topology_distance: 1,
      earliest_event_ts: 100,
      latest_event_ts: 900,
      correlational_not_causal: true,
    },
  ]);
  for (const c of legacy.candidates) {
    assert.ok(!('group_size' in c) && !('group_e_value' in c) && !('binom_tail' in c),
      'legacy calls must not carry the ADR 0022 annotation keys at all');
  }
  // With the new inputs, the pre-existing fields are unchanged and the annotations appear.
  const annotated = attributeCommonMode({
    fired_events: fired, snapshot,
    opts: {
      now: NOW,
      fleet_fire_rate: 0.05,
      per_shard_e_values: new Map([[shardId(0), 3], [shardId(1), 9], [shardId(2), 0]]),
    },
  });
  assert.equal(annotated.candidates.length, legacy.candidates.length);
  for (let i = 0; i < legacy.candidates.length; i++) {
    const { group_size, group_e_value, binom_tail, ...core } = annotated.candidates[i];
    assert.deepEqual(core, legacy.candidates[i]);
    assert.ok(group_size !== undefined && group_e_value !== undefined && binom_tail !== undefined);
  }
  const rackCand = annotated.candidates.find((c) => c.shared_node_id === 'rack-0')!;
  assert.equal(rackCand.group_size, 3);
  assert.equal(rackCand.group_e_value, 4); // (3+9+0)/3
  assert.ok(Math.abs(rackCand.binom_tail! - binomialUpperTail(3, 3, 0.05)) < 1e-15);
  assert.equal(annotated.snapshot_hash, legacy.snapshot_hash);
});
