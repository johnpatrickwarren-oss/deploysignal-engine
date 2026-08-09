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

// ── Amendment v2.K6A.1 (K6A.1.11) — the K6-slow accumulator's own T2 validity arm ─────────────
// K6.12's construction applied UNCHANGED with detector: 'shape_ecdf_accumulator', at the m = 45
// geometry K6A.1.11 derives by arithmetic: W = 150 cannot be fed m = 500 (75,000 >> the 9,000
// reference ticks the scenario supplies), so the frozen 1:3 A/B ratio gives A = 2,250 and
// B = 6,750 -> 45 blocks of 150 exactly, with 600/150 = 4 live windows.
test('K6A.1.11: the accumulator T2 arm runs at m = 45 with 4 live windows, on its own scenario seed', () => {
  const { summary, manifest } = runHarness(['--detector', 'shape_ecdf_accumulator', '--shards', '2', '--steps', '9600']);
  assert.equal(manifest.detector, 'shape_ecdf_accumulator');
  assert.equal(manifest.scenario_seed, 20260855, 'K6A.1.9: K6SLOW_T2_SCENARIO_SEED = BASE_SEED + 48');
  assert.equal(manifest.w, 150, 'K6A.1.2 freezes W = 150');
  assert.equal(manifest.reference_a_ticks, 2250, 'K6A.1.11: the frozen 1:3 ratio against B = 6,750');
  assert.equal(manifest.n_reference_blocks_registered, 45, 'K6A.1.11: T2 m is 45, NOT T1 500');
  assert.equal(manifest.reference_a_ticks + manifest.n_reference_blocks_registered * manifest.w, 9000,
    'A + m*W must exhaust the 9,000 reference ticks exactly — the split is not floored');
  const pairs = summary.cells.filter((c) => c.arm === 'T2-clustersynth');
  assert.ok(pairs.length > 0);
  for (const c of pairs) {
    assert.equal(c.detector, 'shape_ecdf_accumulator');
    assert.equal('fault_class' in c, false, 'K6.1.3: no fault_class field at all on this arm');
    assert.equal('crossing_rate' in c, false, 'K6.1.3: t2_crossing_rate, never the S2 instrument name');
    assert.equal('increment_estimator' in c, false,
      'K6.1.3 binding: the S2 instrument name must not appear, or the scorer reads a T2 row as a validity candidate');
    if (c.skipped) continue;
    assert.equal(c.n_reference_blocks, 45, `${c.shard_id} ${c.counter}: m`);
    assert.equal(c.n_live_windows, 4, 'K6A.1.11: 600/150 = 4 live windows');
    // v2.K6A.2 K6A.2.6: the T2 increment mean is its OWN registered prediction (0.960274 at
    // m = 45, band [0.94, 0.98]); a reading near T1's 0.9914 would indicate the wrong m.
    assert.ok(Number.isFinite(c.t2_increment_mean), 'the registered T2 increment reading');
  }
  const pooled = summary.cells.find((c) => c.arm === 'T2-clustersynth-pooled');
  assert.ok(pooled);
  assert.equal(pooled.detector, 'shape_ecdf_accumulator');
  assert.ok(Number.isFinite(pooled.t2_increment_mean));
  assert.ok(['FAIL', 'not-refuted', 'NOT-EXECUTABLE'].includes(pooled.t2_verdict));
});

test('K6.1.3: the sibling T2 arm keeps its registered field set — no increment field is added to it', () => {
  const { summary, manifest } = runHarness(['--shards', '2', '--steps', '9600']);
  assert.equal(manifest.detector, 'shape_block_conformal_bet', 'the default detector is unchanged');
  assert.equal(manifest.scenario_seed, 20260842, 'K6.12: the sibling arm keeps its own scenario seed');
  assert.equal(manifest.w, 30);
  assert.equal(manifest.reference_a_ticks, null, 'the sibling blocks the whole reference, with no A/B split');
  assert.equal(manifest.n_reference_blocks_registered, 300);
  for (const c of summary.cells) {
    assert.equal(c.detector, 'shape_block_conformal_bet');
    assert.equal('t2_increment_mean' in c, false,
      'K6.1.3 fixes this arm\'s field set and registers no increment field on it');
  }
});

test('an unregistered --detector is refused', () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't2-detector-'));
  let threw = false;
  let stderr = '';
  try {
    execFileSync(process.execPath, [HARNESS, '--detector', 'safe_t', '--shards', '2', '--steps', '9600'], {
      env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot }, encoding: 'utf8', stdio: 'pipe',
    });
  } catch (err) { threw = true; stderr = String(err.stderr ?? ''); }
  assert.ok(threw);
  assert.match(stderr, /is not a registered T2 candidate/);
  fs.rmSync(outRoot, { recursive: true, force: true });
});

// ── Amendment v2.K6A.7 — the strided reference (the ratified C50 ruling) ───────────────────────
// knowledge/methodology/pages/t2-reference-placement.md, RATIFIED 2026-08-08: A becomes a stride-4,
// phase-0 sample of the whole 9,000-tick reference span instead of its contiguous prefix, so the
// front/back placement DOF no longer exists to be chosen. B's 45 blocks are the SAME contiguous
// slices of the SAME 6,750 ticks — only A moves (K6A.7.1).
const accumulatorSmoke = () => runHarness(['--detector', 'shape_ecdf_accumulator', '--shards', '2', '--steps', '9600']);

// MUTATION KILL: change REFERENCE_A_STRIDE to 3 (or REFERENCE_A_PHASE to 1) in the harness and the
// re-derived A below stops matching the calibration the harness actually built, failing this test.
test('K6A.7.1: the manifest records the strided layout, and A is exactly every 4th tick from phase 0', async () => {
  const { manifest, summary } = accumulatorSmoke();
  assert.equal(manifest.reference_a_layout, 'strided', 'K6A.7.1: the accumulator arm strides A');
  assert.equal(manifest.reference_a_stride, 4, 'K6A.7.1: 9000/2250 = 4 exactly, a registered literal');
  assert.equal(manifest.reference_a_phase, 0, 'K6A.7.1 registers phase 0');
  assert.equal(manifest.reference_a_ticks, 2250, 'n_A is UNCHANGED by C50');
  assert.equal(manifest.n_reference_blocks_registered, 45, 'm is UNCHANGED by C50');
  // The stride must be exact: a remainder would silently shorten A.
  assert.equal(manifest.reference_ticks % manifest.reference_a_ticks, 0);
  assert.equal(manifest.reference_ticks / manifest.reference_a_ticks, manifest.reference_a_stride);
  for (const c of summary.cells.filter((x) => x.arm === 'T2-clustersynth')) {
    assert.equal(c.n_reference_blocks, 45, 'striding A must not change m');
    assert.equal(c.n_live_windows, 4, 'striding A must not change the live geometry');
  }
});

// THE POSITIVE CONTROL for the stride, and the one that kills the plumbing mutation.
// MUTATION KILL: revert the harness to `SPEC.calibrate(reference)` — i.e. A back to the contiguous
// prefix — and `sortedA` matches the prefix layout, failing the first assertion. The paired
// assertion that `blockT` is IDENTICAL is what proves only A moved: if a future change also moved
// B, this fails in the other direction.
test('K6A.7.1 positive control: the harness consumed the STRIDE (A differs from the prefix) while B did not move', async () => {
  const { manifest, summary } = accumulatorSmoke();
  const distRequire = createRequire(import.meta.url);
  const acc = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-ecdf-accumulator.js'));
  const cs = await import(`file://${path.join(manifest.clustersynth_root, 'dist', 'index.js')}`);
  const sc = cs.buildScenario({
    family: manifest.family, pods: manifest.pods, seed: manifest.scenario_seed,
    window: { steps: manifest.steps, dt_s: manifest.dt_s }, faults: manifest.faults,
  });
  const shardId = sc.gpuIds[0];
  const rec = cs.realizeShard(sc.seed, shardId, sc.ctx, sc.graph, sc.applier, undefined, undefined);
  const reference = rec.gpu_temp_c.slice(0, manifest.reference_ticks);
  const live = rec.gpu_temp_c.slice(manifest.reference_ticks, manifest.steps);
  const geom = { W: manifest.w, nA: manifest.reference_a_ticks, m: manifest.n_reference_blocks_registered };

  // A re-derived from the manifest's own stride/phase, B contiguous from n_A — K6A.7.1's layout.
  const strideA = [];
  for (let t = manifest.reference_a_phase; t < reference.length; t += manifest.reference_a_stride) strideA.push(reference[t]);
  assert.equal(strideA.length, manifest.reference_a_ticks, 'the stride must yield exactly n_A ticks');
  const stridedRows = [...strideA, ...reference.slice(manifest.reference_a_ticks, manifest.reference_ticks)];
  const strided = acc.calibrateEcdfAccumulator(stridedRows, geom);
  const prefix = acc.calibrateEcdfAccumulator(reference.slice(0, manifest.reference_ticks), geom);

  assert.notDeepEqual(strided.sortedA, prefix.sortedA,
    'a strided A must differ from the contiguous prefix — if these match, the harness never strided');

  // THE KILL, and the reason it has to be phrased against the harness's OWN emitted row rather than
  // against a second re-derivation: comparing two locally-built calibrations to each other proves
  // only that this test can stride, never that the HARNESS did. So the pair's emitted
  // t2_increment_mean is required to match the strided re-derivation and to DIFFER from the prefix
  // one — which is what fails if the harness goes back to passing the raw prefix.
  // It is checked over EVERY pair rather than one, because the two layouts do not always separate:
  // measured 8 of 10 pairs at this smoke geometry, and `gpu_temp_c` is NOT one of them — both
  // layouts drive it to the same p-floor grid values on this scenario, so its increment is identical
  // under both. A single-pair form of this check picked `gpu_temp_c` and passed the mutation.
  const incUnder = (cal, windows) => {
    const es = windows.map((win) => acc.ecdfAccumulatorWindow(win, cal).e);
    return es.reduce((a, b) => a + b, 0) / es.length;
  };
  let separated = 0;
  for (const counter of COUNTER_NAMES) {
    const series = rec[counter];
    const ownRef = series.slice(0, manifest.reference_ticks);
    const ownLive = series.slice(manifest.reference_ticks, manifest.steps);
    const windows = [];
    for (let w = 0; (w + 1) * geom.W <= ownLive.length; w++) windows.push(ownLive.slice(w * geom.W, w * geom.W + geom.W));
    const ownStrideA = [];
    for (let t = manifest.reference_a_phase; t < ownRef.length; t += manifest.reference_a_stride) ownStrideA.push(ownRef[t]);
    const ownStrided = acc.calibrateEcdfAccumulator(
      [...ownStrideA, ...ownRef.slice(manifest.reference_a_ticks, manifest.reference_ticks)], geom);
    const ownPrefix = acc.calibrateEcdfAccumulator(ownRef.slice(0, manifest.reference_ticks), geom);
    const row = summary.cells.find((c) => c.arm === 'T2-clustersynth' && c.shard_id === shardId && c.counter === counter);
    assert.ok(row, `no ${counter} row for the first shard`);
    assert.ok(Math.abs(row.t2_increment_mean - incUnder(ownStrided, windows)) < 1e-12,
      `${counter}: the harness must have scored this pair against the STRIDED A (K6A.7.1)`);
    if (Math.abs(row.t2_increment_mean - incUnder(ownPrefix, windows)) > 1e-9) separated++;
  }
  assert.ok(separated >= 1,
    'at least one coordinate must separate the two layouts, or this control cannot tell whether the '
    + 'harness strided at all — the pre-C50 prefix is the mutation it exists to kill');
  // B's blockT values CANNOT be compared across layouts: T(B_j) is the energy distance from B_j to
  // Fhat_A (detectors/shape-ecdf-accumulator.ts:283), so every one of them moves when A moves.
  // What "B did not move" means is testable directly, and more sharply — which TICKS each block is
  // cut from, and in what order. Re-deriving T over reference[2250 + j*150, +150) against each
  // layout's own A must reproduce that layout's own blockT, block for block.
  for (const [name, cal] of [['strided', strided], ['prefix', prefix]]) {
    for (let j = 0; j < geom.m; j++) {
      const lo = manifest.reference_a_ticks + j * geom.W;
      assert.equal(acc.ecdfAccumulatorWindow(reference.slice(lo, lo + geom.W), cal).T, cal.blockT[j],
        `${name}: B_${j + 1} must be reference ticks [${lo}, ${lo + geom.W}) in that order — C50 moves A only (K6A.7.1)`);
    }
  }
  // A OVERLAPS B by arithmetic (n_A + m*W = 9000 saturates the span, K6A.7.2). Pinned as a
  // property so the overlap cannot be quietly removed without the prereg being revisited: every
  // 150-tick B block contributes 37 or 38 of its ticks to A (150/4 = 37.5).
  const aSet = new Set();
  for (let t = manifest.reference_a_phase; t < manifest.reference_ticks; t += manifest.reference_a_stride) aSet.add(t);
  for (let j = 0; j < geom.m; j++) {
    let shared = 0;
    for (let t = manifest.reference_a_ticks + j * geom.W; t < manifest.reference_a_ticks + (j + 1) * geom.W; t++) {
      if (aSet.has(t)) shared++;
    }
    assert.ok(shared === 37 || shared === 38, `B_${j + 1} shares ${shared} ticks with A, expected 37 or 38 (K6A.7.2)`);
  }
});

// THE FLIP-COLLAPSE REGRESSION (the ratified page's "with strided A the front/back flip must
// collapse", re-run as a registered check). Scored on a NON-REGISTERED scenario seed — 700000002,
// the crossing-carrying seed of Amendment v2.K6A.7's 12-seed pre-registration probe (base 7.0e8,
// disjoint from both registered T2 seeds 20260842 / 20260855) — so this test can pin digits without
// touching the registered endpoint.
//
// Frozen 2026-08-09 from the probe, one shard (cluster-0-pod-0-rack-0-tray-0-gpu-0), gpu_temp_c.
// The reading these numbers exist to pin is K6A.7.8's finding: strided A tracks FRONT-A, it does
// NOT land between the placements, so the flip does not collapse.
//
// This test pins the STATISTICS, not the harness's plumbing — the plumbing mutation is killed by
// the positive control above, stated here rather than left implied (heldout-substrate.test.mjs's
// own convention for saying where a kill actually lives).
// MUTATION KILL: change the stride, the phase, or which contiguous slice B tiles, and the pinned
// triple below stops matching.
test('K6A.7.8 flip-collapse regression: strided A tracks front-A, not the front/back midpoint (non-registered seed)', async () => {
  const distRequire = createRequire(import.meta.url);
  const acc = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-ecdf-accumulator.js'));
  const csRoot = process.env.CLUSTERSYNTH_ROOT
    ? path.resolve(process.env.CLUSTERSYNTH_ROOT)
    : path.resolve(HERE, '..', '..', '..', '..', 'clustersynth');
  const cs = await import(`file://${path.join(csRoot, 'dist', 'index.js')}`);

  const PROBE_SEED = 700000002;   // NOT a registered seed (v2.K6A.7 K6A.7.8, probe base 7.0e8)
  const REF = 9000, STEPS = 9600, W = 150, NA = 2250, M = 45;
  const sc = cs.buildScenario({ family: 'gb200', pods: 1, seed: PROBE_SEED, window: { steps: STEPS, dt_s: 30 }, faults: false });
  const rec = cs.realizeShard(sc.seed, sc.gpuIds[0], sc.ctx, sc.graph, sc.applier, undefined, undefined);
  const series = rec.gpu_temp_c;
  const reference = series.slice(0, REF);
  const live = series.slice(REF, STEPS);
  const windows = [];
  for (let w = 0; (w + 1) * W <= live.length; w++) windows.push(live.slice(w * W, w * W + W));
  assert.equal(windows.length, 4);

  const strided = [];
  for (let t = 0; t < REF; t += 4) strided.push(reference[t]);
  const layouts = {
    frontA: reference.slice(0, REF),
    backA: [...reference.slice(6750, 9000), ...reference.slice(0, 6750)],
    stridedA: [...strided, ...reference.slice(2250, 9000)],
  };
  const read = {};
  for (const [name, rows] of Object.entries(layouts)) {
    const cal = acc.calibrateEcdfAccumulator(rows, { W, nA: NA, m: M });
    read[name] = windows.map((w) => Number(acc.ecdfAccumulatorWindow(w, cal).p.toFixed(6)));
  }

  // The pinned triple.
  assert.deepEqual(read.frontA, [0.065217, 0.086957, 0.021739, 0.021739], 'front-A p values (frozen 2026-08-09)');
  assert.deepEqual(read.backA, [0.869565, 0.869565, 0.565217, 0.673913], 'back-A p values (frozen 2026-08-09)');
  assert.deepEqual(read.stridedA, [0.065217, 0.108696, 0.021739, 0.021739], 'strided-A p values (frozen 2026-08-09)');

  // And the reading, asserted as a property rather than left to the reader of the literals:
  // front-A and back-A sit on opposite sides (the confound), and strided-A stays on front-A's side
  // instead of moving to the middle. THE FLIP DOES NOT COLLAPSE (K6A.7.8's H_substrate).
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(read.frontA) < 0.15, 'front-A puts the live span in the reference tail');
  assert.ok(mean(read.backA) > 0.60, 'back-A inverts it — the A-placement confound');
  assert.ok(mean(read.stridedA) < 0.15,
    'strided A must stay on front-A\'s side: the ratified page expects a collapse and K6A.7.8 registers that it does not');
  assert.ok(Math.abs(mean(read.stridedA) - mean(read.frontA)) < 0.05,
    'strided A tracks front-A, it does not average the two placements (K6A.7.4)');
});

// MUTATION KILL: delete the LIVE_TICKS < W throw, or weaken `<` to `<=`, and the harness produces a
// pooled row reading `not-refuted` from zero scored windows — the fail-open path K6A.7.6 names.
test('K6A.7.6 fails closed: a geometry with no full live window is refused, and writes no run directory', () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't2-nowindow-'));
  let threw = false;
  let stderr = '';
  try {
    // 9060 - 9000 = 60 live ticks against W = 150: not one full window. The SAME --steps is a
    // legitimate 2-window smoke on the block arm at W = 30, which is why the guard is W-relative.
    execFileSync(process.execPath, [HARNESS, '--detector', 'shape_ecdf_accumulator', '--shards', '2', '--steps', '9060'], {
      env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot }, encoding: 'utf8', stdio: 'pipe',
    });
  } catch (err) { threw = true; stderr = String(err.stderr ?? ''); }
  assert.ok(threw, 'a zero-live-window geometry must abort, not score');
  assert.match(stderr, /fewer than W = 150/);
  assert.match(stderr, /K6A\.7\.6/);
  // The abort must precede the run: neither results root may exist.
  assert.equal(fs.existsSync(path.join(outRoot, 'live')), false);
  assert.equal(fs.existsSync(path.join(outRoot, 'sim')), false);
  fs.rmSync(outRoot, { recursive: true, force: true });
});

// MUTATION KILL: restore `typeof x === 'number'` at either aggregation site and a NaN increment
// reaches the coordinate and pooled means (typeof NaN === 'number'), which is the second half of
// K6A.7.6's fail-open path.
test('K6A.7.5/K6A.7.6: every emitted increment is finite, and the three pooling levels agree with the registered estimator', () => {
  const { summary } = accumulatorSmoke();
  const pairs = summary.cells.filter((c) => c.arm === 'T2-clustersynth' && !c.skipped);
  assert.ok(pairs.length > 0);
  for (const c of pairs) {
    assert.ok(Number.isFinite(c.t2_increment_mean), 'a non-finite increment must never be emitted');
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // K6A.7.5: coordinate = unweighted mean of that coordinate's pair-means.
  for (const row of summary.cells.filter((c) => c.arm === 'T2-clustersynth-coordinate')) {
    const own = pairs.filter((c) => c.counter === row.counter).map((c) => c.t2_increment_mean);
    assert.ok(Math.abs(row.t2_increment_mean - mean(own)) < 1e-12,
      `${row.counter}: coordinate increment must be the unweighted mean of its pair-means (K6A.7.5)`);
  }
  // K6A.7.5: pooled = unweighted mean of ALL pair-means, every coordinate together — NOT the mean
  // of the five coordinate means. The two coincide only while every coordinate scores the same n,
  // which is exactly why the registered definition names one of them.
  const pooled = summary.cells.find((c) => c.arm === 'T2-clustersynth-pooled');
  assert.ok(Math.abs(pooled.t2_increment_mean - mean(pairs.map((c) => c.t2_increment_mean))) < 1e-12,
    'pooled increment must be the unweighted mean of all pair-means (K6A.7.5)');

  // A SOURCE-TEXT PIN, and the reason it is one rather than a behavioural check — stated because a
  // pin that is not justified reads as a test that gave up (run-battery.test.mjs:1925-1932's own
  // convention). K6A.7.6 part 3 replaces `typeof x === 'number'` with `Number.isFinite(x)` at both
  // aggregation sites. That mutation is UNREACHABLE behaviourally once parts 1 and 2 are in place:
  // the only producer of a NaN increment was a zero-window pair, and parts 1 and 2 now refuse that
  // geometry before any pair is scored. So the filter is defence in depth against a future
  // producer, and the only way to hold it is to pin the text. `typeof NaN === 'number'` is what
  // made the old form admit a NaN into these means.
  const harnessSrc = fs.readFileSync(HARNESS, 'utf8');
  assert.equal((harnessSrc.match(/filter\(\(x\) => Number\.isFinite\(x\)\)/g) ?? []).length, 2,
    'both increment aggregation sites must filter with Number.isFinite (K6A.7.6 part 3)');
  assert.equal(harnessSrc.includes("typeof x === 'number'"), false,
    "typeof NaN === 'number', so a typeof-based filter admits a NaN increment into a mean (K6A.7.6)");
  assert.match(harnessSrc, /windowEs && windowEs\.length \?/,
    'the pair-level emission guard must test length: `[]` is truthy and emitted 0/0 = NaN (K6A.7.6)');
});

// MUTATION KILL: drop the target-manifest study assertion and a locator naming
// `coverage/run-t2-...` (the DIRECTORY's study, not the manifest's) is accepted, writing a
// supersession declaration that collect.mjs will never apply — the inert-declaration failure
// K6A.7.7 names.
test('K6A.7.7: --supersedes requires its reason, and refuses a locator whose target manifest records a different study', () => {
  const attempt = (args) => {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't2-supersede-'));
    let stderr = '';
    let threw = false;
    try {
      execFileSync(process.execPath, [HARNESS, ...args], {
        env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot }, encoding: 'utf8', stdio: 'pipe',
      });
    } catch (err) { threw = true; stderr = String(err.stderr ?? ''); }
    fs.rmSync(outRoot, { recursive: true, force: true });
    return { threw, stderr };
  };
  const base = ['--detector', 'shape_ecdf_accumulator', '--shards', '2', '--steps', '9600'];

  // Both flags travel together or neither does.
  const lone = attempt([...base, '--supersedes', 'coverage-t2-clustersynth/run-t2-20260809T040552Z:shape_ecdf_accumulator']);
  assert.ok(lone.threw);
  assert.match(lone.stderr, /--supersedes and --supersedes-reason must be given together/);

  // A malformed locator is a startup crash, not a run with a dead declaration.
  const malformed = attempt([...base, '--supersedes', 'nocolon', '--supersedes-reason', 'x']);
  assert.ok(malformed.threw);
  assert.match(malformed.stderr, /must read study\/run:detector/);

  // The registered difference from run-battery's copy: the target's OWN manifest names the study,
  // and 'coverage' is the directory rather than the study for these runs.
  const wrongStudy = attempt([...base,
    '--supersedes', 'coverage/run-t2-20260809T040552Z:shape_ecdf_accumulator', '--supersedes-reason', 'x']);
  assert.ok(wrongStudy.threw);
  assert.match(wrongStudy.stderr, /manifest records study "coverage-t2-clustersynth"/);
  assert.match(wrongStudy.stderr, /would supersede nothing/);
});
