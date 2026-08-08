// validation/coverage/test/run-clustersynth-arm.test.mjs — smoke tests for the K6 T2
// clustersynth arm (PREREGISTRATION.md Amendment v2.K6, K6.12, and Amendment v2.K6.1,
// K6.1.3/K6.1.4 — the T2 field list supersession).
//
// The harness is driven as a child process at small --shards/--steps (smoke), with
// COVERAGE_RESULTS_DIR pointed at a fresh temp dir. Mode routing mirrors run-battery.mjs:
// only the registered shard count (120) AND the registered scenario steps (9600) together
// route to results/live; anything else lands under results/sim. Every assertion below
// checks results/live was never created by a smoke run.
//
// What is asserted here is shape and wiring, not the registered T2 endpoint: the per-
// (shard, coordinate) field set K6.1.3 supersedes the plan's own literal with, the pooled
// and per-coordinate summary rows, the binding field-name exclusion (no `fault_class`, no
// `crossing_rate`/`verdict` literal, none of the five instrument-named fields — K6.1.3),
// the degenerate-reference guard's skip-with-reason behavior under a forced positive
// control, and the manifest's registered scenario seed/constants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(HERE, '..', 'harness', 'run-clustersynth-arm.mjs');

const COUNTER_NAMES = ['gpu_temp_c', 'power_w', 'sm_util', 'hbm_bw_gbps', 'nvlink_tx_gbps'];
// K6.1.3: T2 must never carry any of the five class-instrument fields, `fault_class`, or the
// literal `crossing_rate`/`verdict` (K6.12's own field-name supersession).
const FIVE_INSTRUMENT_FIELDS = ['increment_estimator', 'crossing_rate', 'stopped_mean', 'exceedance', 'mean_e'];

// Smoke scenario: 3 shards, 9060 steps (9000 reference + 60 live => 2 disjoint W=30 live
// windows, not the registered 20) — small enough to run fast while keeping the registered
// 9000-tick reference slice (so n_reference_blocks stays the registered 300 even at smoke).
function runHarness(args = ['--shards', '3', '--steps', '9060'], env = {}) {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-t2-'));
  const stdout = execFileSync(process.execPath, [HARNESS, ...args], {
    env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot, ...env },
    encoding: 'utf8',
  });
  assert.equal(fs.existsSync(path.join(outRoot, 'live')), false,
    'a smoke run must never write results/live (the certification evidence path)');
  const simDir = path.join(outRoot, 'sim');
  const runs = fs.readdirSync(simDir);
  assert.equal(runs.length, 1, `expected one run dir, got ${runs.join(',')}`);
  const runDir = path.join(simDir, runs[0]);
  return {
    outRoot,
    runDir,
    stdout,
    summary: JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8')),
    manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8')),
  };
}

let smokeCache = null;
const smoke = () => (smokeCache ??= runHarness());

test('a smoke run lands under results/sim and never creates results/live', () => {
  const { manifest } = smoke();
  assert.equal(manifest.mode, 'sim');
  assert.equal(manifest.smoke, true);
});

test('manifest records the registered scenario seed, tier, and study, with the shard/step counts actually used', () => {
  const { manifest } = smoke();
  assert.equal(manifest.study, 'coverage-t2-clustersynth');
  assert.match(manifest.study, /clustersynth/i, 'tierOfStudy fallback would also read T2 off this name');
  assert.equal(manifest.tier, 'T2');
  assert.equal(manifest.scenario_seed, 20260842, 'K6.12: K6_T2_SCENARIO_SEED = BASE_SEED + 35');
  assert.equal(manifest.family, 'gb200');
  assert.equal(manifest.pods, 1);
  assert.equal(manifest.faults, false, 'K6.12: healthy only');
  assert.equal(manifest.dt_s, 30);
  assert.equal(manifest.registered_shards, 120);
  assert.equal(manifest.registered_steps, 9600);
  assert.equal(manifest.shards, 3, 'the --shards override actually used, not the registered literal');
  assert.equal(manifest.steps, 9060, 'the --steps override actually used, not the registered literal');
  assert.equal(manifest.reference_ticks, 9000, 'K6.12/K6.3: fixed regardless of --steps');
  assert.equal(manifest.w, 30);
});

test('K6.12: emits one row per (shard, coordinate), 5 counters x shard count, with the registered field set', () => {
  const { summary } = smoke();
  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  assert.equal(pairRows.length, 15, '3 shards x 5 counters');
  const byCounter = {};
  for (const c of pairRows) byCounter[c.counter] = (byCounter[c.counter] ?? 0) + 1;
  assert.deepEqual(byCounter, Object.fromEntries(COUNTER_NAMES.map((n) => [n, 3])));
  for (const c of pairRows) {
    assert.equal(c.detector, 'shape_block_conformal_bet');
    assert.equal(typeof c.shard_id, 'string');
    assert.equal(c.substrate_tier, 'T2');
    assert.equal('fault_class' in c, false, 'K6.1.3: T2 cells carry NO fault_class');
    assert.ok('skipped' in c && typeof c.skipped === 'boolean', 'skipped');
    assert.ok('skip_reason' in c, 'skip_reason');
    if (c.skipped) {
      assert.equal(c.k, null);
      assert.equal(c.n, null);
      assert.equal(c.t2_crossing_rate, null);
      assert.equal(typeof c.skip_reason, 'string');
    } else {
      assert.equal(c.skip_reason, null);
      assert.equal(c.n_reference_blocks, 300, 'K6.3: floor(9000/30)');
      assert.equal(c.n_live_windows, 2, 'floor(60/30) at this smoke steps override');
      assert.ok(c.k === 0 || c.k === 1, 'k: 1 if this pair crossed, 0 otherwise (K6.1.4)');
      assert.equal(c.n, 1, 'K6.1.4: n is always 1 per row, the row\'s own weight');
      assert.equal(c.t2_crossing_rate, c.k, 'at n=1, t2_crossing_rate === k/n === k');
    }
  }
});

test('K6.1.3 binding: no T2 row anywhere carries fault_class, the literal crossing_rate/verdict, or any of the five instrument fields', () => {
  const { summary } = smoke();
  assert.ok(summary.cells.length > 0);
  for (const c of summary.cells) {
    assert.equal('fault_class' in c, false, `${c.arm} ${c.counter ?? ''}: must not carry fault_class (K6.1.3)`);
    assert.equal('crossing_rate' in c, false, `${c.arm} ${c.counter ?? ''}: must not carry the literal crossing_rate (K6.1.3 supersedes the plan)`);
    assert.equal('verdict' in c, false, `${c.arm} ${c.counter ?? ''}: must not carry the literal verdict (K6.1.3 supersedes the plan)`);
    for (const field of FIVE_INSTRUMENT_FIELDS) {
      assert.equal(field in c, false, `${c.arm} ${c.counter ?? ''}: must not carry foreign instrument field "${field}"`);
    }
  }
});

test('K6.1.4: per-coordinate pooled summary rows aggregate k/n correctly from the per-pair rows', () => {
  const { summary } = smoke();
  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  const coordRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth-coordinate');
  assert.equal(coordRows.length, 5, 'one summary row per counter');
  for (const counter of COUNTER_NAMES) {
    const rows = pairRows.filter((c) => c.counter === counter && !c.skipped);
    const expectedK = rows.reduce((a, c) => a + c.k, 0);
    const expectedN = rows.length;
    const summaryRow = coordRows.find((c) => c.counter === counter);
    assert.ok(summaryRow, `no per-coordinate summary row for ${counter}`);
    assert.equal(summaryRow.detector, 'shape_block_conformal_bet');
    assert.equal(summaryRow.substrate_tier, 'T2');
    assert.equal(summaryRow.k, expectedK, `${counter}: k must equal sum(k_i) over non-skipped pairs`);
    assert.equal(summaryRow.n, expectedN, `${counter}: n must equal count of non-skipped pairs`);
    assert.equal(summaryRow.t2_crossing_rate, expectedN ? expectedK / expectedN : null, `${counter}: t2_crossing_rate`);
    assert.equal('fault_class' in summaryRow, false);
  }
});

test('K6.1.4: one overall pooled row carries t2_pooled_lower_95, recomputed independently from the pooled k/n', () => {
  const { summary } = smoke();
  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth' && !c.skipped);
  const pooled = summary.cells.find((c) => c.arm === 'T2-clustersynth-pooled');
  assert.ok(pooled, 'no overall pooled row');
  const expectedK = pairRows.reduce((a, c) => a + c.k, 0);
  const expectedN = pairRows.length;
  assert.equal(pooled.k, expectedK, 'pooled k must equal sum(k_i) over ALL non-skipped pairs');
  assert.equal(pooled.n, expectedN, 'pooled n must equal count of ALL non-skipped pairs');
  assert.equal(pooled.t2_crossing_rate, expectedK / expectedN);
  // Wilson 95% one-sided lower bound, recomputed independently of run-battery.mjs's own
  // lower95() (same formula, but this test does not import it — a mutation to the harness's
  // copy would still be caught here).
  const p = expectedK / expectedN, z = 1.645, d = 1 + (z * z) / expectedN;
  const cVal = p + (z * z) / (2 * expectedN);
  const h = z * Math.sqrt((p * (1 - p)) / expectedN + (z * z) / (4 * expectedN * expectedN));
  const recomputed = Math.max(0, (cVal - h) / d);
  assert.ok(Math.abs(pooled.t2_pooled_lower_95 - recomputed) < 1e-9,
    `t2_pooled_lower_95 (${pooled.t2_pooled_lower_95}) != independent recompute (${recomputed})`);
  assert.equal(pooled.t2_verdict, pooled.t2_pooled_lower_95 > 0.05 ? 'FAIL' : 'not-refuted',
    'K6.13: the T2 stop condition reads off this exact field');
  assert.equal('counter' in pooled, true);
  assert.equal(pooled.counter, null, 'the overall row is not scoped to one coordinate');
});

test('the cell census is exactly per-pair + per-coordinate + one pooled row, no other shape', () => {
  const { summary } = smoke();
  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  const coordRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth-coordinate');
  const pooledRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth-pooled');
  assert.equal(pairRows.length, 15);
  assert.equal(coordRows.length, 5);
  assert.equal(pooledRows.length, 1);
  assert.equal(pairRows.length + coordRows.length + pooledRows.length, summary.cells.length);
});

// K6.12's own registered finding: a coordinate whose 9,000-tick reference trips the
// degenerate-reference guard must be recorded skipped-with-reason, not abort the arm. Real
// clustersynth telemetry is continuous-valued (never trips this in the ordinary path, per
// K6.12's own text) — this positive control forces one (shard, coordinate) pair's reference
// into a constant block, the same COVERAGE_FORCE_SPECTRAL_DEGENERATE convention
// run-battery.mjs already uses for its own guard, so the skip path is proven to fire at all.
test('degenerate-reference guard positive control: a forced quantized coordinate is recorded skipped-with-reason, excluded from both denominators', () => {
  const { summary, manifest } = runHarness(['--shards', '3', '--steps', '9060'], { COVERAGE_T2_FORCE_DEGENERATE: '1' });
  assert.equal(manifest.t2_force_degenerate_hook, true, 'the hook must be recorded in the manifest');
  assert.equal(manifest.mode, 'sim', 'a forced-degenerate run must never land under results/live');

  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  const skipped = pairRows.filter((c) => c.skipped);
  assert.equal(skipped.length, 1, 'exactly one forced (shard, coordinate) pair must skip');
  assert.equal(typeof skipped[0].skip_reason, 'string');
  assert.match(skipped[0].skip_reason, /degenerate/i);

  const forcedCounter = skipped[0].counter;
  const scoredForForcedCounter = pairRows.filter((c) => c.counter === forcedCounter && !c.skipped);
  assert.equal(scoredForForcedCounter.length, 2, 'the forced counter: 3 shards - 1 skipped = 2 scored');

  const coordRow = summary.cells.find((c) => c.arm === 'T2-clustersynth-coordinate' && c.counter === forcedCounter);
  assert.equal(coordRow.n, 2, 'the skipped pair must not be folded into the per-coordinate denominator');

  const pooled = summary.cells.find((c) => c.arm === 'T2-clustersynth-pooled');
  assert.equal(pooled.n, 14, '15 total pairs - 1 skipped = 14 (never silently folded into a 0 reading, K6.15)');
});

test('a smoke run without the hook has zero skips (real synthetic telemetry never trips the guard, K6.12)', () => {
  const { summary, manifest } = smoke();
  assert.equal(manifest.t2_force_degenerate_hook, false);
  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  assert.equal(pairRows.filter((c) => c.skipped).length, 0);
});

// Important 4 (post-Task-11a review): t2_verdict on the pooled row previously fell open to
// 'not-refuted' at n=0 (`n && ... ? 'FAIL' : 'not-refuted'` — a falsy n short-circuits the
// condition, silently reading as "cleared" when nothing was measured). Forcing EVERY pair to
// skip (COVERAGE_T2_FORCE_ALL_DEGENERATE) exercises the n=0 pooled row end to end, not merely
// in isolation, and proves the fix reads NOT-EXECUTABLE instead.
test('Important 4 fix: t2_verdict reads NOT-EXECUTABLE (not the fail-open not-refuted) when every pair is skipped', () => {
  const { summary, manifest } = runHarness(['--shards', '2', '--steps', '9060'], { COVERAGE_T2_FORCE_ALL_DEGENERATE: '1' });
  assert.equal(manifest.t2_force_all_degenerate_hook, true, 'the hook must be recorded in the manifest');
  assert.equal(manifest.mode, 'sim', 'a forced-all-degenerate run must never land under results/live');

  const pairRows = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  assert.equal(pairRows.length, 10, '2 shards x 5 counters');
  assert.ok(pairRows.every((c) => c.skipped), 'every pair must be skipped under this hook');

  const pooled = summary.cells.find((c) => c.arm === 'T2-clustersynth-pooled');
  assert.equal(pooled.n, 0);
  assert.equal(pooled.k, 0);
  assert.equal(pooled.t2_crossing_rate, null);
  assert.ok(!Number.isFinite(pooled.t2_pooled_lower_95), 't2_pooled_lower_95 must be non-finite (NaN) at n=0, not a misleading 0');
  assert.equal(pooled.t2_verdict, 'NOT-EXECUTABLE',
    'the pre-fix ternary (`n && ... ? FAIL : not-refuted`) would read this as not-refuted — a false clearance');
  assert.notEqual(pooled.t2_verdict, 'not-refuted');
});

test('provenance: an independently re-driven (shard, coordinate) pair matches the harness exactly', async () => {
  const { summary, manifest } = smoke();
  const shardId = summary.cells.find((c) => c.arm === 'T2-clustersynth').shard_id;
  const row = summary.cells.find((c) => c.arm === 'T2-clustersynth' && c.shard_id === shardId && c.counter === 'gpu_temp_c');
  assert.ok(row, 'no gpu_temp_c row for the first shard');

  // Independently re-derive via the SAME clustersynth entry point + the compiled detector
  // module, using only the manifest's own recorded, registered constants — not re-running
  // the harness, not importing its internals.
  const distRequire = createRequire(import.meta.url);
  const shapeBlockBet = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-block-conformal-bet.js'));

  assert.ok(manifest.clustersynth_root, 'manifest must record clustersynth_root for independent re-derivation');
  const clustersynthIndex = path.join(manifest.clustersynth_root, 'dist', 'index.js');
  const cs = await import(`file://${clustersynthIndex}`);
  const sc = cs.buildScenario({
    family: manifest.family, pods: manifest.pods, seed: manifest.scenario_seed,
    window: { steps: manifest.steps, dt_s: manifest.dt_s }, faults: manifest.faults,
  });
  const rec = cs.realizeShard(sc.seed, shardId, sc.ctx, sc.graph, sc.applier, undefined, undefined);
  const series = rec.gpu_temp_c;
  const reference = series.slice(0, manifest.reference_ticks);
  const live = series.slice(manifest.reference_ticks, manifest.steps);
  const cal = shapeBlockBet.calibrateShapeBlocks(reference, manifest.w);
  // Minor 5 (post-Task-11a review): aligned with the harness's own full-windows-only
  // condition ((w+1)*W <= live.length) — the prior `w*W < live.length` form would include a
  // trailing PARTIAL window when live.length isn't an exact multiple of W, diverging from
  // what the harness itself scores whenever --steps is overridden to a non-multiple.
  const windows = [];
  for (let w = 0; (w + 1) * manifest.w <= live.length; w++) windows.push(live.slice(w * manifest.w, w * manifest.w + manifest.w));
  const { log } = shapeBlockBet.shapeBetWealth(windows, cal);
  const crossed = log.some((l) => l >= Math.log(20));
  assert.equal(row.k, crossed ? 1 : 0, 'independently recomputed crossing must match the harness row exactly');
  assert.equal(row.n_reference_blocks, cal.m);
});
