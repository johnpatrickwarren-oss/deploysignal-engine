// validation/coverage/test/run-battery.test.mjs — smoke tests for the battery harness.
//
// The harness is driven as a child process at --n 20 (smoke), with COVERAGE_RESULTS_DIR
// pointed at a fresh temp dir. Two independent guards keep a smoke run out of the
// certification evidence path: the temp results root, and the harness's own mode routing
// (any run with n != the registered 2000, or with the forced-throw hook set, lands under
// results/sim, never results/live — loadEvidence reads validation/*/results/live/*,
// collect.mjs:138). Every assertion below checks results/live was never created.
//
// What is asserted here is shape and wiring, not the registered endpoints: one cell per
// registered (class, detector) pair, complete fields, an exact cell census, `canonical`
// marked exactly once per class x detector, a real detection at a deliberately-injected
// 3-sigma K1 step, the A1 healthy arms' S2 shape, the manifest's seed constants against
// their registered literals, and the NOT-EXECUTABLE fallback path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { FAULT_CLASSES } from '../../certification/lib/constants.mjs';
import { rng, gaussFrom, injectOscillation, injectShapeMix } from '../lib/inject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(HERE, '..', 'harness', 'run-battery.mjs');

// PREREGISTRATION.md §7 + Amendment A6 + Amendment v2.K4/v2.K4.1: which detectors are
// scored on which class. K4 gains `point_tail_bet_e_value` at Amendment v2.K4 (K4.3).
// Amendment v2.K3, K3.5: spectral_bet_e_process joins K3 as a new row, scored on all six
// K3 cells (unlike family_D_spectral_e_detector, which stays canonical + -ar1 only).
const REGISTERED_PAIRS = {
  K1: ['safe_t', 'universal_inference'],
  K2: ['group_average_e_value', 'safe_t'],
  K3: ['safe_t', 'universal_inference', 'family_D_spectral_e_detector', 'spectral_bet_e_process'],
  K4: ['family_E_conformal_heldout', 'safe_t', 'point_tail_bet_e_value'],
  K5: ['safe_t', 'universal_inference'],
  // Amendment v2.K6, K6.6: shape_block_conformal_bet joins K6 as a new row, K6 only.
  K6: ['safe_t', 'universal_inference', 'shape_block_conformal_bet'],
};

// Registered seed literals (PREREGISTRATION.md §6, A5). The harness interpolates its own
// constants into the manifest and asserts them against these same literals at startup, so a
// constant that moves fails here as well as there.
const REGISTERED_SEEDS = {
  base_seed: 20260807, trajectory_step: 7919, series_salt: 104729, heldout_offset: 500000,
};

// The registered per-(class, detector) census (§7 + A6 + A1 + Amendment v2.K4 K4.3 +
// Amendment v2.K3 K3.5/K3.6): 72 fault-class rows and 9 arm rows. Amendment v2.K4 adds
// `point_tail_bet_e_value` on K4's four fault cells (18-21) plus its own arm (cell 32,
// S2+S3) — 4 fault + 2 arm rows, the "6 point_tail_bet_e_value rows" the task brief names.
// Amendment v2.K3 adds `spectral_bet_e_process` on all six K3 fault cells plus its own arm
// (cell 33, S2+S3+the verdict-free step_blindness_probe_rate row, Amendment v2.K3.3
// K3.3.3) — 6 fault + 3 arm rows.
const REGISTERED_CENSUS = {
  safe_t: 30,                        // K1 4 + K2 8 + K3 6 + K4 4 + K5 4 + K6 4
  universal_inference: 18,           // K1 4 + K3 6 + K5 4 + K6 4
  group_average_e_value: 8,          // every K2 cell
  family_E_conformal_heldout: 4,     // every K4 cell
  family_D_spectral_e_detector: 2,   // K3's canonical and -ar1 cells only
  point_tail_bet_e_value: 4,         // K4's four fault cells (Amendment v2.K4 K4.3)
  spectral_bet_e_process: 6,         // every K3 cell (Amendment v2.K3, K3.5) — 6 fault + 2 arm rows
  shape_block_conformal_bet: 4,      // K6's four fault cells (Amendment v2.K6, K6.6) — 4 fault + 2 arm rows
};

function runHarness(args = ['--n', '20'], env = {}) {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-'));
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
    mode: 'sim',
    stdout,
    summary: JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8')),
    manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8')),
  };
}

let smokeCache = null;
const smoke = () => (smokeCache ??= runHarness());

const VERDICTS = new Set(['POWERED', 'INERT', 'NOT-EXECUTABLE']);

test('every registered (class, detector) pair emits cells with complete fields', () => {
  const { summary } = smoke();
  const faultCells = summary.cells.filter((c) => c.fault_class != null);
  for (const [classId, dets] of Object.entries(REGISTERED_PAIRS)) {
    for (const det of dets) {
      const rows = faultCells.filter((c) => c.fault_class === classId && c.detector === det);
      assert.ok(rows.length > 0, `no cells for ${classId} x ${det}`);
      for (const c of rows) {
        assert.equal(typeof c.severity, 'string', `${classId} ${det}: severity`);
        assert.equal(typeof c.canonical, 'boolean', `${classId} ${det}: canonical`);
        assert.ok(c.phi === 0 || c.phi === 0.6, `${classId} ${det}: phi ${c.phi}`);
        assert.ok(VERDICTS.has(c.verdict), `${classId} ${det}: verdict ${c.verdict}`);
        assert.equal(c.n, 20, `${classId} ${det}: n`);
        assert.equal(c.alpha, 0.05);
        assert.equal(c.ticks, 300);
        assert.equal(c.onset, 100);
        assert.ok(Number.isInteger(c.non_finite_wealth), `${classId} ${det}: non_finite_wealth`);
        assert.ok('not_executable_reason' in c, `${classId} ${det}: not_executable_reason`);
        if (c.verdict === 'NOT-EXECUTABLE') {
          assert.equal(typeof c.not_executable_reason, 'string');
          assert.equal(c.detection_rate, null, 'a not-executable cell must not report a rate');
        } else {
          assert.equal(c.not_executable_reason, null);
          assert.ok(Number.isFinite(c.detection_rate), `${classId} ${det}: detection_rate`);
          assert.ok(c.detection_rate >= 0 && c.detection_rate <= 1);
        }
      }
    }
  }
});

test('the cell census is exactly the registered (class, detector) assignment', () => {
  const { summary } = smoke();
  // Amendment v2.K3/v2.K3.3, K3.5/K3.6/K3.3.3: +6 fault rows (all six K3 cells) + 3 arm rows
  // (cell 33 S2/S3/step_blindness_probe_rate) on top of the pre-K3 72-cell census (66 fault
  // + 6 arm). Amendment v2.K6, K6.6/K6.7: +4 fault rows (all four K6 cells) + 2 arm rows
  // (cell 34 S2/S3) on top of that.
  assert.equal(summary.cells.length, 87, 'registered census: 76 fault-class rows + 11 arm rows');

  const faultCells = summary.cells.filter((c) => c.fault_class != null);
  assert.equal(faultCells.length, 76);
  const byDetector = {};
  for (const c of faultCells) byDetector[c.detector] = (byDetector[c.detector] ?? 0) + 1;
  assert.deepEqual(byDetector, REGISTERED_CENSUS);

  const armCells = summary.cells.filter((c) => c.arm != null);
  assert.equal(armCells.length, 11);
  assert.deepEqual(
    armCells.map((c) => `${c.detector}:${c.arm}`).sort(),
    ['family_E_conformal_heldout:healthy', 'family_E_conformal_heldout:power',
      'group_average_e_value:healthy', 'group_average_e_value:power',
      'point_tail_bet_e_value:healthy', 'point_tail_bet_e_value:power',
      'shape_block_conformal_bet:healthy', 'shape_block_conformal_bet:power',
      'spectral_bet_e_process:healthy', 'spectral_bet_e_process:power',
      'spectral_bet_e_process:step_blindness_probe'],
  );
  assert.equal(faultCells.length + armCells.length, summary.cells.length,
    'every cell is either a fault-class cell or an arm — no third shape');
});

test('the ordinary path is throw-free end to end', () => {
  const { summary } = smoke();
  for (const c of summary.cells) {
    // Amendment v2.K3.3, K3.3.3/K3.3.5: step_blindness_probe_rate's registered field set is
    // deliberately minimal — no adapter_failures, no verdict — so it is exempt here, not a gap.
    if (c.arm === 'step_blindness_probe') { assert.equal('verdict' in c, false); continue; }
    assert.equal(c.adapter_failures, 0,
      `${c.detector} ${c.fault_class ?? c.arm} ${c.severity ?? ''}: ${c.not_executable_reason}`);
    assert.equal(c.verdict === 'NOT-EXECUTABLE', false, `${c.detector}: unexpected NOT-EXECUTABLE`);
  }
});

test('family_D cells carry the pre-onset firing count as a descriptive secondary', () => {
  const { summary } = smoke();
  const dCells = summary.cells.filter((c) => c.detector === 'family_D_spectral_e_detector');
  assert.equal(dCells.length, 2);
  for (const c of dCells) {
    assert.ok(Number.isInteger(c.fired_pre_onset), 'fired_pre_onset must be an integer count');
    assert.ok(c.fired_pre_onset >= 0 && c.fired_pre_onset <= c.n);
  }
});

test('every emitted severity is a registered grid entry (or its -ar1 replicate)', () => {
  const { summary } = smoke();
  for (const c of summary.cells.filter((x) => x.fault_class != null)) {
    const { grid, canonical } = FAULT_CLASSES[c.fault_class];
    const ok = grid.includes(c.severity) || c.severity === `${canonical}-ar1`;
    assert.ok(ok, `${c.fault_class}: unregistered severity ${c.severity}`);
    assert.equal(c.canonical, c.severity === canonical);
  }
});

test('canonical is marked exactly once per class x detector', () => {
  const { summary } = smoke();
  for (const [classId, dets] of Object.entries(REGISTERED_PAIRS)) {
    for (const det of dets) {
      const canon = summary.cells.filter(
        (c) => c.fault_class === classId && c.detector === det && c.canonical === true,
      );
      assert.equal(canon.length, 1, `${classId} x ${det}: ${canon.length} canonical cells`);
      assert.equal(canon[0].severity, FAULT_CLASSES[classId].canonical);
      assert.equal(canon[0].phi, 0, 'only the phi=0 canonical cell decides (§8, §10.1)');
    }
  }
});

test('the deliberately-injected 3-sigma K1 step is detected at n=20', () => {
  const { summary } = smoke();
  const c = summary.cells.find(
    (x) => x.fault_class === 'K1' && x.severity === '3sigma' && x.detector === 'safe_t',
  );
  assert.ok(c, 'no K1 3sigma safe_t cell');
  assert.ok(c.detection_rate > 0, `harness detected nothing at 3 sigma (rate ${c.detection_rate})`);
});

test('the A1 healthy arms carry the S2 shape and a paired S3 arm', () => {
  const { summary } = smoke();
  for (const det of ['group_average_e_value', 'family_E_conformal_heldout', 'point_tail_bet_e_value']) {
    const arms = summary.cells.filter((c) => c.arm != null && c.detector === det);
    assert.equal(arms.length, 2, `${det}: expected one S2 and one S3 arm`);

    const s2 = arms.find((c) => c.arm === 'healthy');
    assert.ok(s2, `${det}: no healthy (S2) arm`);
    assert.ok(Number.isFinite(s2.exceedance), `${det}: exceedance`);
    assert.ok(Number.isFinite(s2.mean_e), `${det}: mean_e`);
    assert.ok(['FAIL', 'not-refuted', 'NOT-EXECUTABLE'].includes(s2.verdict), `${det}: ${s2.verdict}`);
    assert.ok(!('detection_rate' in s2), `${det}: the S2 arm must not carry a power reading`);
    assert.ok(!('fault_class' in s2), `${det}: the arms are independent of the fault-class cells`);

    const s3 = arms.find((c) => c.arm === 'power');
    assert.ok(s3, `${det}: no power (S3) arm`);
    assert.equal(s3.shift_sigma, 3);
    assert.ok(Number.isFinite(s3.detection_rate), `${det}: S3 detection_rate`);
    assert.ok(['POWERED', 'INERT', 'NOT-EXECUTABLE'].includes(s3.verdict));
    assert.ok(!('exceedance' in s3), `${det}: the S3 arm must not read as a validity candidate`);
  }
});

// Amendment v2.K4 / v2.K4.1 — the new K4 candidate, `point_tail_bet_e_value`.
const HELDOUT_SEED_BY_CELL = { 18: 20760825, 19: 20760826, 20: 20760827, 21: 20760828 };

test('K4.1.5: params stamps heldout-empirical on every point_tail_bet_e_value cell and arm', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'point_tail_bet_e_value');
  assert.equal(rows.length, 6, '4 fault cells + healthy(S2) + power(S3) arm rows');
  for (const c of rows) assert.equal(c.params, 'heldout-empirical', JSON.stringify(c));
});

test('K4.4: point_tail_bet_e_value reuses the registered held-out seed on cells 18-21', () => {
  const { summary } = smoke();
  for (const [idx, heldoutSeed] of Object.entries(HELDOUT_SEED_BY_CELL)) {
    const c = summary.cells.find(
      (x) => x.detector === 'point_tail_bet_e_value' && x.cell_index === Number(idx),
    );
    assert.ok(c, `no point_tail_bet_e_value row for cell ${idx}`);
    assert.equal(c.heldout_seed, heldoutSeed, `cell ${idx}: heldout_seed`);
    assert.equal(c.heldout_rows, 10000, `cell ${idx}: heldout_rows`);
  }
});

test('K4.6: fault cells carry the injected-tick class endpoint plus the window-crossing secondary', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'point_tail_bet_e_value' && c.fault_class === 'K4');
  assert.equal(rows.length, 4, 'cells 18-21');
  for (const c of rows) {
    assert.ok(Number.isFinite(c.detection_rate) || c.verdict === 'NOT-EXECUTABLE', `cell ${c.cell_index}: detection_rate`);
    assert.ok(Number.isFinite(c.window_crossing_rate), `cell ${c.cell_index}: window_crossing_rate (descriptive secondary, K4.6)`);
    assert.ok(c.window_crossing_rate >= (c.detection_rate ?? 0),
      `cell ${c.cell_index}: the window-crossing reading conflates the injected tick with 199 null ticks, so it can only be >= the class endpoint`);
    assert.equal(c.non_finite_wealth, 0, `cell ${c.cell_index}: K4.1.6 — non-finite is structurally impossible once calibration succeeds`);
  }
});

test('K4.8: the canonical 5sigma-point cell clears the coverage floor at n=20', () => {
  const { summary } = smoke();
  const c = summary.cells.find(
    (x) => x.detector === 'point_tail_bet_e_value' && x.fault_class === 'K4' && x.severity === '5sigma-point',
  );
  assert.ok(c, 'no canonical (idx 19, 5sigma-point) point_tail_bet_e_value cell');
  assert.equal(c.canonical, true);
  assert.ok(c.detection_rate > 0.5, `K4.8 predicts canonical detection >= 0.50; got ${c.detection_rate}`);
});

test('K4.1.4: cell 32 (arm) emits the per-point healthy (S2) field set', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'point_tail_bet_e_value' && c.arm === 'healthy');
  assert.ok(s2, 'no point_tail_bet_e_value healthy arm');
  assert.equal(s2.cell_index, 32);
  assert.equal(s2.heldout_seed, 20760839, 'K4.4: CELL_SEED(20260839) + 500000');
  assert.equal(s2.heldout_rows, 10000);
  assert.equal(s2.n, 20, 'trajectory count, unchanged shape from A1/A3(c) — smoke override');
  assert.equal(s2.n_points, s2.n * 200, 'K4.1.4: n_points = n * 200 (200-tick post-onset window)');
  assert.ok(Number.isFinite(s2.exceedance), 'K4.1.4: per-point exceedance');
  assert.ok(Number.isFinite(s2.lower_95), 'K4.1.4: per-point Wilson lower bound');
  assert.ok(Number.isFinite(s2.mean_e), 'K4.5: mean_e across all n_points');
  // K4.1.4: verdict is derived from the already-computed lower_95 field, not recomputed.
  assert.equal(s2.verdict, s2.lower_95 > 0.05 ? 'FAIL' : 'not-refuted');
});

test('K4.5: cell 32 power (S3) arm fires per-trajectory on any of the 200-tick window', () => {
  const { summary } = smoke();
  const s3 = summary.cells.find((c) => c.detector === 'point_tail_bet_e_value' && c.arm === 'power');
  assert.ok(s3, 'no point_tail_bet_e_value power arm');
  assert.equal(s3.cell_index, 32);
  assert.equal(s3.shift_sigma, 3);
  assert.ok(Number.isFinite(s3.detection_rate));
  assert.ok(!('n_points' in s3), 'S3 keeps A1\'s per-trajectory pair, not K4.1.4\'s per-point fields');
});

// Mutation-strength findings from the READY-FOR-RUN review: the six assertions below each fail
// under a named one-line mutation with the rest of the suite green (confirmed by the reviewer,
// re-confirmed here per mutation before landing — see the fix report for the kill log).

test('K4.6 mutation guard: cell 18 window_crossing_rate is STRICTLY greater than detection_rate', () => {
  const { summary } = smoke();
  const c = summary.cells.find((x) => x.detector === 'point_tail_bet_e_value' && x.cell_index === 18);
  assert.ok(c, 'no cell 18 point_tail_bet_e_value row');
  // Kills the any-tick-collapse mutation: if the window scan were narrowed to the injected
  // tick alone, windowCrossed would equal fires exactly and this would be an equality, not a
  // strict inequality. `>=` (as used on all four cells elsewhere) does not catch that.
  assert.ok(c.window_crossing_rate > c.detection_rate,
    `cell 18: window_crossing_rate (${c.window_crossing_rate}) must exceed detection_rate `
    + `(${c.detection_rate}) at these seeds — an any-tick mutation collapsing the window scan `
    + 'to the injected tick alone would make these equal');
});

test('K4.7: cell 32 S2 pins the exceedance/k/n_points triple, k recomputed independently', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'point_tail_bet_e_value' && c.arm === 'healthy');
  assert.ok(Number.isInteger(s2.k), 'k must be an integer per-point exceedance count (K4.7\'s own triple)');
  assert.equal(s2.exceedance, s2.k / s2.n_points, 'exceedance must equal k/n_points exactly, not a separately-tracked ratio');
  assert.ok(s2.exceedance > 0, `expected some points >= threshold at n_points=${s2.n_points} (K4.8 predicts ~0.27%)`);
  assert.ok(s2.lower_95 > 0);
  // Recompute the Wilson lower bound from k/n_points alone, independently of whatever the
  // harness's own lower95() happened to be called with — kills a mutation that computes
  // lower_95 from the wrong (e.g. per-trajectory) k/n pair while k/n_points still look right.
  const p = s2.k / s2.n_points, z = 1.645, d = 1 + (z * z) / s2.n_points;
  const cc = p + (z * z) / (2 * s2.n_points);
  const h = z * Math.sqrt((p * (1 - p)) / s2.n_points + (z * z) / (4 * s2.n_points * s2.n_points));
  const recomputed = Math.max(0, (cc - h) / d);
  assert.ok(Math.abs(s2.lower_95 - recomputed) < 1e-9,
    `lower_95 (${s2.lower_95}) does not match the independent recomputation from k/n_points (${recomputed})`);
});

test('K4.5 mutation guard: cell 32 S3 detection_rate is exactly 1 at the registered smoke seeds', () => {
  const { summary } = smoke();
  const s3 = summary.cells.find((c) => c.detector === 'point_tail_bet_e_value' && c.arm === 'power');
  assert.ok(s3, 'no point_tail_bet_e_value power arm');
  // Kills the any-tick/fires-collapse mutation: reverting s3's detection reading to the
  // onset-tick-only `fires` counter (K4.6's fault-cell reading, wrong for a sustained-step
  // arm) moves this to 0.5 at these seeds instead of 1.
  assert.equal(s3.detection_rate, 1,
    'an any-tick/fires mutation (reading power.fires instead of power.windowCrossed) moves this to 0.5 at these seeds');
});

test('K4.1.8 mutation guard: cell 32 S2 mean_e is within the registered 3-sd band', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'point_tail_bet_e_value' && c.arm === 'healthy');
  assert.ok(Math.abs(s2.mean_e - 0.6246) < 0.3,
    `K4.1.8 predicts mean_e ~0.6246 (3-sd band at n_points=${s2.n_points} smoke); got ${s2.mean_e}`);
});

test('params negative scope: every row outside the two heldout-empirical candidates keeps params=oracle', () => {
  const { summary } = smoke();
  // Amendment v2.K6, K6.9: shape_block_conformal_bet joins point_tail_bet_e_value as the
  // second heldout-empirical candidate — both excluded here, everything else must still
  // read 'oracle'.
  const nonHeldoutRows = summary.cells.filter(
    (c) => c.detector !== 'point_tail_bet_e_value' && c.detector !== 'shape_block_conformal_bet',
  );
  assert.ok(nonHeldoutRows.length > 0);
  for (const c of nonHeldoutRows) {
    // Kills a collapsed-ternary mutation (e.g. always 'heldout-empirical', or the branches
    // swapped) that a heldout-only positive check cannot see.
    assert.equal(c.params, 'oracle', `${c.detector} ${c.fault_class ?? c.arm} ${c.severity ?? ''}: params`);
  }
});

test('K6.9 params positive scope: every shape_block_conformal_bet row stamps heldout-empirical', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet');
  assert.equal(rows.length, 6, '4 fault cells + healthy(S2) + power(S3) arm rows');
  for (const c of rows) assert.equal(c.params, 'heldout-empirical', JSON.stringify(c));
});

// Amendment v2.C1 (C1.2): the re-derivation below now follows the CORRECTED generator — one
// continuous stream per held-out draw. This test's own limitation is worth naming where it lives:
// it re-implements the seeding scheme, so while the harness drew a rank-1 lattice this test agreed
// with it and passed. A re-implementation test cannot see a defect in the thing it re-implements.
// What catches it now is the harness's own guard — assertHeldoutSerialStructure THROWS on rows
// whose autocorrelation does not match their phi, so the pre-C1 draw cannot produce a run at all,
// and this test fails at the harness invocation rather than at its assertions. (Its positive
// control is the COVERAGE_FORCE_HELDOUT_LATTICE test further down.) The bound that guard uses is
// derived and pinned in test/heldout-substrate.test.mjs, which characterizes both schemes but
// invokes nothing — it is spec-documentation, not the kill. Recomputing against the CORRECTED
// scheme here is what makes this test regression-bearing: it now disagrees with a reverted harness
// instead of agreeing with it. It also still earns wrong-stream provenance, as it always did: a
// heldoutSeed off by one, or a cell sharing another cell's draw, still moves median/mad here.
test('K4.4 provenance: cal_median/cal_mad are re-derivable from lib/inject.mjs at the registered heldout seed', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const tailBetDist = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/point-tail-bet-e-value.js'));
  const HELDOUT_ROWS = 10000;
  const regenRows = (heldoutSeed) => {
    const draw = gaussFrom(rng(heldoutSeed));          // ONE stream, advanced continuously (C1.2)
    const rows = new Array(HELDOUT_ROWS);
    for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = draw();
    return rows;
  };
  const cases = [
    { label: 'cell 19 (canonical)', row: () => summary.cells.find(
      (x) => x.detector === 'point_tail_bet_e_value' && x.cell_index === 19), heldoutSeed: 20760826 },
    { label: 'arm 32 (S2)', row: () => summary.cells.find(
      (x) => x.detector === 'point_tail_bet_e_value' && x.arm === 'healthy'), heldoutSeed: 20760839 },
  ];
  for (const { label, row, heldoutSeed } of cases) {
    const c = row();
    assert.ok(c, `${label}: no point_tail_bet_e_value row`);
    const cal = tailBetDist.calibrateTailBet(regenRows(heldoutSeed));
    // Kills a wrong-stream mutation: a heldoutSeed off by one, or accidentally sharing another
    // cell's/arm's draw, moves median/mad away from what an independent re-derivation produces.
    assert.equal(c.cal_median, cal.median, `${label}: cal_median`);
    assert.equal(c.cal_mad, cal.mad, `${label}: cal_mad`);
  }
});

test('K4.1.6 (Minor): point_non_finite is 0 on every point_tail_bet_e_value row at smoke', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'point_tail_bet_e_value');
  assert.ok(rows.length > 0);
  for (const c of rows) {
    assert.equal(c.point_non_finite, 0,
      `${c.fault_class ?? c.arm} ${c.severity ?? ''}: point_non_finite (K4.1.6 — structurally impossible once calibration succeeds)`);
  }
});

// Amendment v2.K3 / v2.K3.1 / v2.K3.2 — the third K3 candidate, `spectral_bet_e_process`.
const FIVE_INSTRUMENT_FIELDS = ['increment_estimator', 'crossing_rate', 'stopped_mean', 'exceedance', 'mean_e'];

test('K3.5: spectral_bet_e_process is scored on all six K3 fault cells (unlike family_D)', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'spectral_bet_e_process' && c.fault_class === 'K3');
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((c) => c.cell_index).sort((a, b) => a - b), [12, 13, 14, 15, 16, 17]);
});

test('K3.8: fault-cell rows carry the registered window-partition fields and params=oracle', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'spectral_bet_e_process' && c.fault_class === 'K3');
  assert.equal(rows.length, 6);
  for (const c of rows) {
    assert.equal(c.windows, 6, `cell ${c.cell_index}: windows`);
    assert.equal(c.window_len, 30, `cell ${c.cell_index}: window_len`);
    assert.equal(c.window_span, '[100,280)', `cell ${c.cell_index}: window_span`);
    assert.equal(c.params, 'oracle', `cell ${c.cell_index}: params (K3.3 — genuinely oracle sigma)`);
    assert.ok(Number.isInteger(c.degenerate_windows), `cell ${c.cell_index}: degenerate_windows`);
    assert.equal(c.degenerate_windows, 0, `cell ${c.cell_index}: no degenerate window expected at these amplitudes (K3.1.6)`);
    assert.ok(Number.isFinite(c.final_wealth_mean), `cell ${c.cell_index}: final_wealth_mean`);
    assert.ok(Number.isFinite(c.final_wealth_median), `cell ${c.cell_index}: final_wealth_median`);
    assert.equal(c.null_id, c.phi === 0 ? 'N1' : 'N3-p06', `cell ${c.cell_index}: null_id keeps the shared fault-cell convention (K3.1.5)`);
  }
});

test('K3.1.4 (Critical, binding): the S3 power row, the step probe row, and all six fault cells carry NONE of the five instrument-named fields', () => {
  const { summary } = smoke();
  const scoped = [
    ...summary.cells.filter((c) => c.detector === 'spectral_bet_e_process' && c.fault_class === 'K3'),
    summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power'),
    // Amendment v2.K3.3, K3.3.3: the retained step-probe row extends K3.1.4's exclusion
    // explicitly — "on the same 'one offending cell VOIDs the whole run's S2 evidence'
    // reasoning."
    summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'step_blindness_probe'),
  ];
  assert.equal(scoped.length, 8, '6 fault cells + 1 S3 arm row + 1 step-probe arm row');
  for (const c of scoped) {
    for (const field of FIVE_INSTRUMENT_FIELDS) {
      assert.equal(field in c, false,
        `${c.fault_class ?? c.arm} cell ${c.cell_index}: must not carry foreign instrument field "${field}" `
        + '(K3.1.4) — a single such field would VOID the entire run\'s S2 evidence for this card');
    }
  }
});

test('K3.1.1/K3.1.2: cell 33 S2 arm carries increment_estimator AND crossing_rate, no foreign fields', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  assert.ok(s2, 'no spectral_bet_e_process healthy arm');
  assert.equal(s2.cell_index, 33);
  assert.equal(s2.windows, 6);
  assert.equal(s2.window_len, 30);
  assert.equal(s2.window_span, '[100,280)');
  assert.ok(Number.isInteger(s2.k), 'k: count of trajectories crossing (K3.7)');
  assert.ok(Number.isFinite(s2.crossing_rate), 'crossing_rate (K3.1.2 supersedes trajectory_crossing_rate)');
  assert.equal(s2.crossing_rate, s2.k / s2.n, 'crossing_rate must equal k/n exactly');
  assert.ok(Number.isFinite(s2.lower_95), 'lower_95: Wilson bound on crossing_rate');
  assert.equal('exceedance' in s2, false, 'S2 must not additionally carry the terminal_e_value instrument');
  assert.equal('mean_e' in s2, false, 'S2 must not additionally carry the terminal_e_value instrument');
  const inc = s2.increment_estimator;
  assert.ok(inc, 'K3.1.1: increment_estimator, resolving K3.15');
  assert.equal(inc.n, s2.n, 'K3.1.1: n expected 2000 (registered)/20 (smoke) absent a degenerate window');
  for (const f of ['mean', 'sd', 'se', 'lower95_one_sided', 'upper95_one_sided']) {
    assert.ok(Number.isFinite(inc[f]), `increment_estimator.${f}`);
  }
  // K3.1.3: the verdict is crossing_rate-derived, NOT increment_estimator-derived.
  assert.equal(s2.verdict, s2.lower_95 > 0.05 ? 'FAIL' : 'not-refuted');
});

test('K3.1.5: cell 33 (both S2 and S3) stamps the out-of-grammar null_id literal', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  const s3 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power');
  assert.equal(s2.null_id, 'K3-arm-oracle');
  assert.equal(s3.null_id, 'K3-arm-oracle');
});

test('K3.1.7: p_uniformity is pooled n*6*3 per-bin p values with decile counts and a KS statistic', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  const pu = s2.p_uniformity;
  assert.ok(pu, 'K3.1.7: p_uniformity, reported with no verdict authority');
  assert.equal(pu.n, s2.n * 6 * 3, 'pooled across n trajectories x 6 windows x 3 bins');
  assert.equal(pu.decile_counts.length, 10);
  assert.equal(pu.decile_counts.reduce((a, b) => a + b, 0), pu.n, 'decile counts must exhaust the pooled sample');
  for (const count of pu.decile_counts) assert.ok(Number.isInteger(count) && count >= 0);
  assert.ok(Number.isFinite(pu.ks_statistic) && pu.ks_statistic >= 0 && pu.ks_statistic <= 1);
  const expectedCritical = 1.36 / Math.sqrt(pu.n);
  assert.ok(Math.abs(pu.ks_critical_at_alpha - expectedCritical) < 1e-9,
    'ks_critical_at_alpha must be the standard asymptotic 1.36/sqrt(n), computed at the actual pooled n');
  assert.equal('verdict' in pu, false, 'K3.1.7: no verdict key of its own');
});

test('K3.1.6: degenerate_windows is a non-negative integer on every spectral_bet_e_process row that carries it, 0 at smoke', () => {
  const { summary } = smoke();
  // step_blindness_probe_rate's registered field set (K3.3.3/K3.3.5) does not include
  // degenerate_windows — excluded here, not a gap.
  const rows = summary.cells.filter((c) => c.detector === 'spectral_bet_e_process' && c.arm !== 'step_blindness_probe');
  assert.equal(rows.length, 8, '6 fault cells + S2 + S3 arm rows');
  for (const c of rows) {
    assert.ok(Number.isInteger(c.degenerate_windows), `${c.fault_class ?? c.arm} ${c.cell_index}: degenerate_windows`);
    assert.equal(c.degenerate_windows, 0, `${c.fault_class ?? c.arm} ${c.cell_index}: none expected at registered amplitudes (K3.1.6)`);
  }
});

// Reviewer's Important 1: degenerate_windows positive control. The ordinary registered
// amplitudes never underflow p to exactly 0 (K3.1.6's own reasoning), so a 0 reading alone
// does not prove the counter can move at all — this drives the test-only
// COVERAGE_FORCE_SPECTRAL_DEGENERATE hook (forces window 0's periodogram past double-
// precision underflow on every trajectory) and checks the counter actually responds.
test('degenerate_windows positive control: the counter moves under a forced p-underflow, stays 0 on the ordinary path', () => {
  const { summary: ordinary } = smoke();
  const ordinaryCell12 = ordinary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.cell_index === 12);
  assert.equal(ordinaryCell12.degenerate_windows, 0, 'ordinary path: no forced condition, no degenerate window');

  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-degen-'));
  execFileSync(process.execPath, [HARNESS, '--n', '5', '--classes', 'K3'], {
    env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot, COVERAGE_FORCE_SPECTRAL_DEGENERATE: '1' },
    encoding: 'utf8',
  });
  const simDir = path.join(outRoot, 'sim');
  const runDir = path.join(simDir, fs.readdirSync(simDir)[0]);
  const forced = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.spectral_force_degenerate_hook, true, 'the hook must be recorded in the manifest');
  assert.equal(manifest.mode, 'sim', 'a forced-degenerate run must never land under results/live');

  const forcedCell12 = forced.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.cell_index === 12);
  assert.ok(forcedCell12.degenerate_windows > 0,
    `degenerate_windows must move under the forced condition; got ${forcedCell12.degenerate_windows}`);
  assert.equal(forcedCell12.degenerate_windows, 5, 'window 0 is forced degenerate on all 5 smoke trajectories');
});

// Amendment v2.K3.3, K3.3.2/K3.3.4: S3 is now the on-grid oscillation probe
// (amp=3sigma, freq=3/30, bin k=3 exactly) — injectStep is DC-blind to every bin this
// detector scores (K3.3.1), so the superseded step construction can no longer be what S3
// measures. K3.3.4's own derivation predicts near-certain detection (I(f_3)=67.5 exactly,
// e_3 ~ 1e25, wealth-saturating on the first window) — pinned here as exactly 1.0 at the
// registered smoke seeds, the K4.5-mutation-guard convention (a step-construction
// regression would collapse this back toward the healthy false-alarm rate, ~0).
test('K3.3.2/K3.3.4: cell 33 S3 (power) arm is the on-grid oscillation probe, detection_rate exactly 1 at smoke seeds', () => {
  const { summary } = smoke();
  const s3 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power');
  assert.ok(s3, 'no spectral_bet_e_process power arm');
  assert.equal(s3.cell_index, 33);
  assert.equal(s3.shift_sigma, 3);
  assert.equal(s3.windows, 6);
  assert.equal(s3.window_len, 30);
  assert.equal(s3.window_span, '[100,280)');
  assert.equal(s3.detection_rate, 1,
    'K3.3.4 predicts near-certain detection; a stale injectStep mutation would collapse this '
    + 'toward the healthy false-alarm rate instead');
  assert.equal(s3.verdict, 'POWERED');
  assert.ok(!('k' in s3), 'S3 keeps A1\'s fires/detection_rate pair, not S2\'s k/crossing_rate pair');
});

// Amendment v2.K3.3, K3.3.3/K3.3.5: the retained (now-superseded) step construction survives
// as a THIRD, verdict-free descriptive row on cell 33 — the exact registered field set, no
// more: no shift_sigma (so it can never be picked up by scoreS3/isPowerCell's shift_sigma
// gate), no verdict (K3.1.4's negative scope, extended explicitly to this row, asserted
// separately above), field name step_blindness_probe_rate (not detection_rate, so
// isPowerCell's `'detection_rate' in c` never admits it as an S3 candidate at all).
test('K3.3.3: cell 33 carries the verdict-free step_blindness_probe_rate row, excluded from S2/S3 scoring by field-name absence', () => {
  const { summary } = smoke();
  const step = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'step_blindness_probe');
  assert.ok(step, 'no spectral_bet_e_process step_blindness_probe row');
  assert.equal(step.cell_index, 33);
  assert.equal(step.null_id, 'K3-arm-oracle', 'K3.1.5\'s literal applies here too — same cell');
  assert.equal(step.phi, 0);
  assert.equal(step.params, 'oracle');
  assert.equal(step.alpha, 0.05);
  assert.equal(step.ticks, 300);
  assert.equal(step.onset, 100);
  assert.equal(step.substrate_tier, 'T1');
  assert.ok(Number.isInteger(step.k), 'k: count crossing (expected ~6/2000 per K3.3.1\'s disclosed probe)');
  assert.equal(step.n, 20, 'n: the full smoke trajectory count (K3.3.3 — n: 2000 at the registered N)');
  assert.ok(Number.isFinite(step.step_blindness_probe_rate));
  assert.equal(step.step_blindness_probe_rate, step.k / step.n, 'step_blindness_probe_rate must equal k/n exactly');
  assert.equal('shift_sigma' in step, false, 'no shift_sigma — belt-and-suspenders with the field-name exclusion');
  assert.equal('verdict' in step, false, 'K3.3.3: no verdict field, this row is purely descriptive');
  assert.equal('not_executable_reason' in step, false);
  assert.equal('detection_rate' in step, false, 'must not be named detection_rate, or isPowerCell would admit it as an S3 candidate');
  // Exactly the registered field set (K3.3.5) — nothing extra smuggled in.
  assert.deepEqual(Object.keys(step).sort(), [
    'alpha', 'arm', 'cell_index', 'detector', 'k', 'n', 'null_id', 'onset', 'params',
    'phi', 'step_blindness_probe_rate', 'substrate_tier', 'ticks',
  ]);
});

// Mutation-strength provenance: independently regenerate the exact seeded trajectories the
// harness itself would have produced (same CELL_SEED/TRAJ_STEP formula, same generator, same
// injection) and recompute both the window-partitioned wealth endpoint (K3.9) and the S2 arm's
// increment_estimator (K3.1.1) straight from dist/detectors/spectral-bet-e-process.js — proving
// the adapter's window slicing and endpoint reading, not merely its field names.
test('K3.9 provenance: independent window-partition + wealth-endpoint recompute matches the harness at smoke n', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const spectralBet = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/spectral-bet-e-process.js'));
  const TRAJ_STEP = 7919, ONSET = 100, T = 300, SIGMA = 1, N_SMOKE = 20;
  const sliceWindows = (series) => {
    const ws = [];
    for (let w = 0; w < 6; w++) ws.push(series.slice(ONSET + w * 30, ONSET + w * 30 + 30));
    return ws;
  };
  const cases = [
    { label: 'idx 15 canonical (A0.75sigma-f0.05)', idx: 15, amp: 0.75, freq: 0.05 },
    { label: 'idx 16 clean k=3 hit (A0.75sigma-f0.1)', idx: 16, amp: 0.75, freq: 0.1 },
  ];
  for (const { label, idx, amp, freq } of cases) {
    const cellSeed = 20260807 + idx;
    let crossedCount = 0;
    for (let i = 0; i < N_SMOKE; i++) {
      const draw = gaussFrom(rng(cellSeed + TRAJ_STEP * i));
      const base = Array.from({ length: T }, draw);
      const series = injectOscillation(base, { sigma: SIGMA, at: ONSET, amp, freq });
      const { log } = spectralBet.spectralBetWealth(sliceWindows(series), SIGMA);
      if (log.some((l) => l >= Math.log(20))) crossedCount += 1;
    }
    const c = summary.cells.find((x) => x.detector === 'spectral_bet_e_process' && x.cell_index === idx);
    assert.ok(c, `${label}: no spectral_bet_e_process cell`);
    assert.equal(c.fires, crossedCount, `${label}: independently recomputed crossing count`);
    assert.equal(c.detection_rate, crossedCount / N_SMOKE, `${label}: detection_rate`);
  }
});

test('K3.1.1 provenance: cell 33 S2 increment_estimator recomputes from an independently regenerated fixture', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const spectralBet = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/spectral-bet-e-process.js'));
  const TRAJ_STEP = 7919, ONSET = 100, T = 300, SIGMA = 1, N_SMOKE = 20;
  const ARM33_SEED = 20260807 + 33;
  // K3.1.1's own summarise(), copied verbatim (same shape PREREGISTRATION.md cites at
  // run-sequential.mjs:37-44).
  function summarise(xs) {
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    const se = Math.sqrt(varr / n);
    return { n, mean, sd: Math.sqrt(varr), se, lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
  }
  const trajMeans = [];
  for (let i = 0; i < N_SMOKE; i++) {
    const draw = gaussFrom(rng(ARM33_SEED + TRAJ_STEP * i));
    const series = Array.from({ length: T }, draw);
    const eAvgs = [];
    for (let w = 0; w < 6; w++) {
      const window = series.slice(ONSET + w * 30, ONSET + w * 30 + 30);
      eAvgs.push(spectralBet.spectralBetWindow(window, SIGMA).eAvg);
    }
    trajMeans.push(eAvgs.reduce((a, b) => a + b, 0) / eAvgs.length);
  }
  const recomputed = summarise(trajMeans);
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  const inc = s2.increment_estimator;
  assert.equal(inc.n, recomputed.n);
  for (const f of ['mean', 'sd', 'se', 'lower95_one_sided', 'upper95_one_sided']) {
    assert.ok(Math.abs(inc[f] - recomputed[f]) < 1e-9, `increment_estimator.${f}: harness ${inc[f]} vs recomputed ${recomputed[f]}`);
  }
});

// Minor 3 (fix round): renamed — this asserts the absence of heldout/calibration fields on
// cell 33's rows, not seed arithmetic (that is covered separately by assertRegistryAgreement's
// own startup check and the K3.9/K3.1.1 provenance tests above, which regenerate against the
// registered CELL_SEED formula directly).
test('K3.3/K3.6: cell 33 rows carry no heldout or calibration fields (sigma is oracle, nothing calibrated)', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  const s3 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power');
  const step = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'step_blindness_probe');
  for (const c of [s2, s3, step]) {
    assert.equal('heldout_seed' in c, false, 'K3.3/K3.6: no calibration stream for this detector');
    assert.equal('cal_median' in c, false);
    assert.equal('cal_mad' in c, false);
  }
});

// Reviewer's Important 2: params==='oracle' alone is a static string — a mutation that starts
// computing sigma from data (Erratum v1.3's defect class, see the K3.3 comment at K3.3
// header) while leaving the 'oracle' stamp untouched would sail past a string-only check. The
// float pin on final_wealth_mean is a second, independent channel: it is computed straight
// from the oracle SIGMA=1 literal (K3.3), so any drift toward an estimated sigma moves this
// number measurably, at these exact deterministic smoke seeds.
test('Reviewer Important 2: params=oracle on every spectral row, plus a float pin on cell 15 final_wealth_mean', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'spectral_bet_e_process');
  assert.ok(rows.length > 0);
  for (const c of rows) {
    assert.equal(c.params, 'oracle', `${c.fault_class ?? c.arm} ${c.cell_index}: params (K3.3 — genuinely oracle sigma)`);
  }
  const c15 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.cell_index === 15);
  assert.ok(c15, 'no cell 15 (canonical) spectral_bet_e_process row');
  assert.equal(c15.final_wealth_mean, 1958461.7555607539,
    'exact float pin at the registered smoke seeds — an estimated-sigma mutation (Erratum '
    + 'v1.3\'s defect class) would move this value while leaving params=\'oracle\' untouched');
});

// Amendment v2.K6/v2.K6.1 — the fourth candidate, `shape_block_conformal_bet` (K6 only).
const K6_HELDOUT_SEED_BY_CELL = { 26: 20760833, 27: 20760834, 28: 20760835, 29: 20760836 };

test('K6.6: shape_block_conformal_bet is scored on all four K6 fault cells, K6 only', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet' && c.fault_class === 'K6');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((c) => c.cell_index).sort((a, b) => a - b), [26, 27, 28, 29]);
  const other = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet' && c.fault_class != null && c.fault_class !== 'K6');
  assert.equal(other.length, 0, 'shape_block_conformal_bet must not be scored on any other class');
});

test('K6.9: fault-cell rows carry the registered window-partition fields, params=heldout-empirical, no shift_sigma', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet' && c.fault_class === 'K6');
  assert.equal(rows.length, 4);
  for (const c of rows) {
    assert.equal(c.windows, 6, `cell ${c.cell_index}: windows`);
    assert.equal(c.window_len, 30, `cell ${c.cell_index}: window_len`);
    assert.equal(c.window_span, '[100,280)', `cell ${c.cell_index}: window_span`);
    assert.equal(c.params, 'heldout-empirical', `cell ${c.cell_index}: params (K6.3 — genuinely empirical calibration)`);
    assert.ok(Number.isInteger(c.degenerate_windows), `cell ${c.cell_index}: degenerate_windows`);
    // degenerate_windows: 0 at these smoke amplitudes (not structurally impossible — see the
    // dedicated positive-control test below, post-Task-11a review Important 1).
    assert.equal(c.degenerate_windows, 0, `cell ${c.cell_index}: none observed at these smoke seeds`);
    assert.equal(c.non_finite_wealth, 0, `cell ${c.cell_index}: structurally zero for this candidate (K6.7)`);
    assert.ok(Number.isFinite(c.final_wealth_mean), `cell ${c.cell_index}: final_wealth_mean`);
    assert.ok(Number.isFinite(c.final_wealth_median), `cell ${c.cell_index}: final_wealth_median`);
    assert.equal(c.null_id, c.phi === 0 ? 'N1' : 'N3-p06', `cell ${c.cell_index}: null_id keeps the shared fault-cell convention (K6.9), not the arm literal`);
    assert.equal('shift_sigma' in c, false, `cell ${c.cell_index}: K6.9 — fault cells carry no shift_sigma`);
  }
});

test('K6.6 + C1.8: shape_block_conformal_bet stamps the registered held-out seed on cells 26-29', () => {
  const { summary } = smoke();
  for (const [idx, heldoutSeed] of Object.entries(K6_HELDOUT_SEED_BY_CELL)) {
    const c = summary.cells.find((x) => x.detector === 'shape_block_conformal_bet' && x.cell_index === Number(idx));
    assert.ok(c, `no shape_block_conformal_bet row for cell ${idx}`);
    assert.equal(Number(idx), c.cell_index);
    // Amendment v2.C1 (C1.8) EXTENDS K6.9's field list: before C1, a K6 row named no
    // calibration at all, so the reference artefact that moved this class's S3 verdict was
    // invisible in the run directory. heldout_seed/heldout_rows now match K4.4's convention.
    assert.equal(c.heldout_seed, Number(heldoutSeed), `cell ${idx}: heldout_seed (C1.8)`);
    assert.equal(c.heldout_rows, 10000, `cell ${idx}: heldout_rows (C1.8)`);
  }
});

// Amendment v2.C1, C1.8 (review Important 3). The fingerprint is asserted three ways: present and
// well-shaped on every K6 row; re-derivable from the corrected generator (so a wrong-stream
// mutation moves it); and ORDERED, since `sortedAbsDev` quantiles that came out unsorted would
// make the compression signature unreadable.
test('C1.8: every shape_block_conformal_bet row carries a well-formed cal_fingerprint', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet');
  assert.equal(rows.length, 6, '4 fault cells + S2 + S3 arm rows');
  for (const c of rows) {
    const f = c.cal_fingerprint;
    assert.ok(f, `${c.fault_class ?? c.arm} ${c.cell_index}: cal_fingerprint absent`);
    assert.equal(f.W, 30, `${c.cell_index}: cal_fingerprint.W`);
    assert.equal(f.m, 333, `${c.cell_index}: cal_fingerprint.m (K6.3's floor(10000/30))`);
    for (const feature of ['kurtosis', 'absSkew']) {
      const g = f[feature];
      assert.ok(Number.isFinite(g.median), `${c.cell_index}/${feature}: median`);
      for (const q of ['absdev_p50', 'absdev_p90', 'absdev_max']) {
        assert.ok(Number.isFinite(g[q]) && g[q] >= 0, `${c.cell_index}/${feature}: ${q}`);
      }
      assert.ok(g.absdev_p50 <= g.absdev_p90, `${c.cell_index}/${feature}: p50 <= p90`);
      assert.ok(g.absdev_p90 <= g.absdev_max, `${c.cell_index}/${feature}: p90 <= max`);
    }
  }
  // The two arm rows share ONE draw (arm 34's), so their fingerprints must be identical — the
  // property C1.7's single-draw caveat is about, made checkable off the emitted rows alone.
  const s2 = rows.find((c) => c.arm === 'healthy');
  const s3 = rows.find((c) => c.arm === 'power');
  assert.deepEqual(s2.cal_fingerprint, s3.cal_fingerprint,
    'C1.7: the S2 and S3 arm rows calibrate on the same held-out draw, so the fingerprints must match');
});

test('C1.8: cal_fingerprint is re-derivable from lib/inject.mjs under the corrected generator', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const shapeDist = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-block-conformal-bet.js'));
  const HELDOUT_ROWS = 10000;
  const q = (sorted, p) => sorted[Math.round(p * (sorted.length - 1))];
  const regen = (heldoutSeed) => {
    const draw = gaussFrom(rng(heldoutSeed));
    const rows = new Array(HELDOUT_ROWS);
    for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = draw();
    return shapeDist.calibrateShapeBlocks(rows, 30);
  };
  for (const [idx, heldoutSeed] of [...Object.entries(K6_HELDOUT_SEED_BY_CELL), ['34', 20760841]]) {
    // Cell 29 is the -ar1 cell: its held-out draw is AR(1) at phi=0.6, so the iid regeneration
    // here does not describe it. C1.3 covers that row's own structure in heldout-substrate.
    if (Number(idx) === 29) continue;
    const c = summary.cells.find((x) => x.detector === 'shape_block_conformal_bet'
      && (x.cell_index === Number(idx)) && x.arm !== 'power');
    assert.ok(c, `no row for ${idx}`);
    const cal = regen(Number(heldoutSeed));
    for (const feature of ['kurtosis', 'absSkew']) {
      assert.equal(c.cal_fingerprint[feature].median, cal[feature].median, `${idx}/${feature}: median`);
      assert.equal(c.cal_fingerprint[feature].absdev_p50, q(cal[feature].sortedAbsDev, 0.5), `${idx}/${feature}: p50`);
      assert.equal(c.cal_fingerprint[feature].absdev_p90, q(cal[feature].sortedAbsDev, 0.9), `${idx}/${feature}: p90`);
      assert.equal(c.cal_fingerprint[feature].absdev_max,
        cal[feature].sortedAbsDev[cal[feature].sortedAbsDev.length - 1], `${idx}/${feature}: max`);
    }
  }
});

// C1.2's registered runtime guard, positive control. A guard that never fires is
// indistinguishable from a guard that cannot fire, and this one exists specifically to make a
// regression to the pre-C1 draw impossible to run. Same COVERAGE_FORCE_* convention as the two
// degenerate-window controls above.
test('C1.2 guard positive control: the harness REFUSES to run on pre-C1 lattice held-out rows', () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-lattice-'));
  let threw = false;
  let stderr = '';
  try {
    execFileSync(process.execPath, [HARNESS, '--n', '5', '--classes', 'K6'], {
      env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot, COVERAGE_FORCE_HELDOUT_LATTICE: '1' },
      encoding: 'utf8', stdio: 'pipe',
    });
  } catch (err) {
    threw = true;
    stderr = String(err.stderr ?? '');
  }
  assert.ok(threw, 'the harness must refuse the lattice draw, not run on it');
  assert.match(stderr, /Amendment v2\.C1 C1\.2/, 'the refusal must name the registration it enforces');
  assert.match(stderr, /rank-1 Kronecker lattice/, 'and the mechanism it rejects');
  assert.equal(fs.existsSync(path.join(outRoot, 'live')), false, 'no results/live directory may be created');
  // And the ordinary path does NOT throw: the guard is a property of the rows, not a blanket
  // refusal that would pass this test for the wrong reason.
  const { summary } = smoke();
  assert.equal(summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet').length, 6);
});

test('K6.7 (Critical, binding): the S3 power row and all four fault cells carry NONE of the five instrument-named fields', () => {
  const { summary } = smoke();
  const scoped = [
    ...summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet' && c.fault_class === 'K6'),
    summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'power'),
  ];
  assert.equal(scoped.length, 5, '4 fault cells + 1 S3 arm row');
  for (const c of scoped) {
    for (const field of FIVE_INSTRUMENT_FIELDS) {
      assert.equal(field in c, false,
        `${c.fault_class ?? c.arm} cell ${c.cell_index}: must not carry foreign instrument field "${field}" `
        + '(K6.7) — a single such field would VOID the entire run\'s S2 evidence for this card');
    }
  }
});

test('K6.7: cell 34 S2 arm carries increment_estimator AND crossing_rate, no foreign fields', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  assert.ok(s2, 'no shape_block_conformal_bet healthy arm');
  assert.equal(s2.cell_index, 34);
  assert.equal(s2.windows, 6);
  assert.equal(s2.window_len, 30);
  assert.equal(s2.window_span, '[100,280)');
  assert.ok(Number.isInteger(s2.k), 'k: count of trajectories crossing (K6.7)');
  assert.ok(Number.isFinite(s2.crossing_rate), 'crossing_rate (K6.7)');
  assert.equal(s2.crossing_rate, s2.k / s2.n, 'crossing_rate must equal k/n exactly');
  assert.ok(Number.isFinite(s2.lower_95), 'lower_95: Wilson bound on crossing_rate');
  assert.equal('exceedance' in s2, false, 'S2 must not additionally carry the terminal_e_value instrument');
  assert.equal('mean_e' in s2, false, 'S2 must not additionally carry the terminal_e_value instrument');
  const inc = s2.increment_estimator;
  assert.ok(inc, 'K6.7: increment_estimator, applying the K3.15 lesson up front');
  assert.equal(inc.n, s2.n, 'K6.7: n expected 2000 (registered)/20 (smoke) absent a degenerate window');
  for (const f of ['mean', 'sd', 'se', 'lower95_one_sided', 'upper95_one_sided']) {
    assert.ok(Number.isFinite(inc[f]), `increment_estimator.${f}`);
  }
  // K6.7: the verdict is crossing_rate-derived, NOT increment_estimator-derived.
  assert.equal(s2.verdict, s2.lower_95 > 0.05 ? 'FAIL' : 'not-refuted');
});

test('K6.7: cell 34 (both S2 and S3) stamps the out-of-grammar null_id literal K6-arm-heldout', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  const s3 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'power');
  assert.equal(s2.null_id, 'K6-arm-heldout');
  assert.equal(s3.null_id, 'K6-arm-heldout');
  // Distinct from K3's own arm literal — this arm's calibration is EMPIRICAL, not oracle.
  assert.notEqual(s2.null_id, 'K3-arm-oracle');
});

test('K6.7: p_uniformity is pooled n*6*2 per-feature p values (kurtosis + absSkew) with decile counts and a KS statistic', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  const pu = s2.p_uniformity;
  assert.ok(pu, 'K6.7: p_uniformity, reported with no verdict authority');
  assert.equal(pu.n, s2.n * 6 * 2, 'pooled across n trajectories x 6 windows x 2 features');
  assert.equal(pu.decile_counts.length, 10);
  assert.equal(pu.decile_counts.reduce((a, b) => a + b, 0), pu.n, 'decile counts must exhaust the pooled sample');
  for (const count of pu.decile_counts) assert.ok(Number.isInteger(count) && count >= 0);
  assert.ok(Number.isFinite(pu.ks_statistic) && pu.ks_statistic >= 0 && pu.ks_statistic <= 1);
  const expectedCritical = 1.36 / Math.sqrt(pu.n);
  assert.ok(Math.abs(pu.ks_critical_at_alpha - expectedCritical) < 1e-9,
    'ks_critical_at_alpha must be the standard asymptotic 1.36/sqrt(n), computed at the actual pooled n');
  assert.equal('verdict' in pu, false, 'K6.7: no verdict key of its own');
});

// Amendment v2.C1: p_uniformity PINNED BY VALUE, not only by shape. The shape test above passed
// on both sides of C1 — it is the statistic's value that carried the finding (T1 read
// P(p<=0.05) = 0.10017 and ks 0.1080 against critical 0.0087788 under the lattice, and this
// instrument firing is what led to the defect). A shape-only test lets that value drift silently,
// so the smoke reading is pinned to the last digit here and the registered n=2000 reading is
// pinned in C1.5's prediction table.
test('C1: p_uniformity is pinned by value on the K6 S2 arm at the smoke seeds', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  const pu = s2.p_uniformity;
  assert.equal(pu.n, 240, '20 smoke trajectories x 6 windows x 2 features');
  assert.deepEqual(pu.decile_counts, [19, 28, 28, 21, 26, 24, 29, 22, 21, 22],
    'the pooled decile histogram under the corrected reference; the lattice piled 4475/24000 into '
    + 'the first decile at n=2000, a first-decile excess this histogram does not have');
  assert.equal(pu.ks_statistic, 0.04575848303393215);
  assert.equal(pu.ks_critical_at_alpha, 0.08778762251403478);
  assert.ok(pu.ks_statistic < pu.ks_critical_at_alpha,
    'at the smoke n the KS statistic sits UNDER its critical value; C1.5 registers that at the '
    + 'registered n=2000 it does NOT (0.0229 > 0.0088) — an expected, unexplained residual with '
    + 'no verdict authority, filed rather than resolved');
});

// K6.7 registers degenerate_windows as "structurally zero" on the reasoning that eAvg stays
// finite even on a degenerate window (the module's own NaN guard). That reasoning shows eAvg
// can never underflow the wealth product — it does NOT show a degenerate window can never
// occur. Amendment v2.K6.2 (K6.2.1) independently establishes the pathway is genuinely
// reachable at the d=2.0 two-point degeneracy (P ~= 1.9e-9/window that a live 30-tick window
// draws all-same-sign, making that window's own kurtosis/absSkew m2=0). At the registered
// amplitudes and these smoke seeds the counter reads 0 (below), not because the event is
// impossible, but because it has not occurred at this n — the positive control further below
// proves the counter can actually move when it does.
test('degenerate_windows is a non-negative integer on every shape_block_conformal_bet row that carries it, 0 at these smoke seeds', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'shape_block_conformal_bet');
  assert.equal(rows.length, 6, '4 fault cells + S2 + S3 arm rows');
  for (const c of rows) {
    assert.ok(Number.isInteger(c.degenerate_windows), `${c.fault_class ?? c.arm} ${c.cell_index}: degenerate_windows`);
    assert.equal(c.degenerate_windows, 0, `${c.fault_class ?? c.arm} ${c.cell_index}: none observed at these smoke seeds`);
  }
});

// Positive control (post-Task-11a review, Important 1): the ordinary registered amplitudes
// essentially never produce a degenerate window (K6.2.1's own P~=1.9e-9/window figure), so a 0
// reading alone does not prove the counter can move at all — the fix above (reading
// perFeature[].p instead of eAvg's own always-finite value) is only real if this responds.
// Same COVERAGE_FORCE_SHAPE_DEGENERATE hook convention as run-battery.mjs's own
// COVERAGE_FORCE_SPECTRAL_DEGENERATE positive control for spectral_bet_e_process.
test('degenerate_windows positive control: the counter moves under a forced constant window, stays 0 on the ordinary path', () => {
  const { summary: ordinary } = smoke();
  const ordinaryCell26 = ordinary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.cell_index === 26);
  assert.equal(ordinaryCell26.degenerate_windows, 0, 'ordinary path: no forced condition, no degenerate window');

  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-shape-degen-'));
  execFileSync(process.execPath, [HARNESS, '--n', '5', '--classes', 'K6'], {
    env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot, COVERAGE_FORCE_SHAPE_DEGENERATE: '1' },
    encoding: 'utf8',
  });
  const simDir = path.join(outRoot, 'sim');
  const runDir = path.join(simDir, fs.readdirSync(simDir)[0]);
  const forced = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.shape_force_degenerate_hook, true, 'the hook must be recorded in the manifest');
  assert.equal(manifest.mode, 'sim', 'a forced-degenerate run must never land under results/live');

  const forcedCell26 = forced.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.cell_index === 26);
  assert.ok(forcedCell26.degenerate_windows > 0,
    `degenerate_windows must move under the forced condition; got ${forcedCell26.degenerate_windows}`);
  assert.equal(forcedCell26.degenerate_windows, 5, 'window 0 is forced degenerate (both features) on all 5 smoke trajectories');

  // The arm-34 rows and every other K6 fault cell see the same forced window 0.
  const forcedArmS2 = forced.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  assert.equal(forcedArmS2.degenerate_windows, 5);
});

test('K6 S3 arm carries no windows/window_len/window_span (K6.7\'s own field list omits them on this row)', () => {
  const { summary } = smoke();
  const s3 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'power');
  assert.ok(s3, 'no shape_block_conformal_bet power arm');
  assert.equal('windows' in s3, false);
  assert.equal('window_len' in s3, false);
  assert.equal('window_span' in s3, false);
});

// Amendment v2.K6.2 (K6.2.1) re-corrects Amendment v2.K6.1's own `~0.000` d=2.0 correction:
// `injectShapeMix`'s scale factor `s = sqrt(max(0, 1 - d*d/4))` is EXACTLY 0 at d=2.0, so the
// injected series degenerates to a pure two-point +-1sigma law (not an overlapping mixture
// like d=1.0/1.5), and the registered, re-derived prediction at this severity is `~0.95-1.0`,
// expected POWERED — not a surprise, the class's own registered expectation. d=1.0/1.5 (idx
// 26, 27, 29) are unaffected (`s>0` there, K6.2.1's own closing paragraph) and still predict
// `~0.000`.
test('canonical (idx 27, mix-d1.5) and idx 26/29 read the predicted near-zero at smoke seeds (K6.2.1: unaffected by the d=2.0 correction)', () => {
  const { summary } = smoke();
  for (const idx of [26, 27, 29]) {
    const c = summary.cells.find((x) => x.detector === 'shape_block_conformal_bet' && x.cell_index === idx);
    assert.ok(c, `no cell ${idx}`);
    assert.equal(c.detection_rate, 0, `cell ${idx}: K6.1.1/K6.2.1 predict ~0.000; at n=20 smoke seeds this reads exactly 0`);
  }
});

// Amendment v2.C1 (C1.5) SUPERSEDES the pin this test carried. Amendment v2.K6.2 (K6.2.1) had
// idx 28 and arm 34's S3 POWERED at `detection_rate` exactly 1, and K6.2.2 drew the consequence:
// S3 POWERED removes overallVerdict's valid-but-inert ADVISORY cap (score.mjs:566-570), so the
// expected card verdict was USE. That reading rested on a rank-1 Kronecker lattice standing in
// for the reference distribution (C1.1). v2.K6.2's PREMISE is kept — `s = sqrt(1 - d^2/4)` is
// exactly 0 at d=2.0, so this severity is genuinely a two-point +-1sigma law, and K6.2.3's
// boundary-artifact taxonomy stands — but its CONCLUSION is withdrawn: against a real reference
// the same law gives mean eAvg 1.1525 and cumulative log-wealth ~0.69 over six windows against
// the bar log(20) = 2.9957, so it cannot cross. Registered: INERT, and the card returns to
// ADVISORY, which is what v2.K6/K6.1 registered from a derivation before any run.
test('C1.5 (supersedes K6.2.1/K6.2.2): idx 28 (mix-d2.0) and arm 34 S3 are INERT at smoke seeds — the corrected-reference expectation', () => {
  const { summary } = smoke();
  const c28 = summary.cells.find((x) => x.detector === 'shape_block_conformal_bet' && x.cell_index === 28);
  assert.ok(c28, 'no cell 28');
  assert.equal(c28.canonical, false, 'idx 28 is grid-only, not the class-deciding canonical cell (idx 27, K6.2.2)');
  // C1.5's registered band at n=2000 is <= 0.02 (point prediction 0.0045); at these 20 smoke
  // seeds it reads exactly 0. Pinned as both: the exact smoke value AND the registered band, so
  // this test fails on a return to the lattice (which reads exactly 1 here) and also on any
  // drift that lifts the rate into the powered range.
  assert.equal(c28.detection_rate, 0, 'C1.5: at n=20 smoke seeds the corrected reference reads exactly 0 (the lattice read exactly 1)');
  assert.ok(c28.detection_rate <= 0.02, 'C1.5 registered band for cell 28');
  assert.equal(c28.verdict, 'INERT');

  const s3 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'power');
  assert.ok(s3, 'no shape_block_conformal_bet power arm');
  assert.equal(s3.detection_rate, 0, 'arm 34 S3 (also d=2.0, K6.8) reads 0 at n=20 smoke seeds under the corrected reference');
  assert.ok(s3.detection_rate <= 0.02, 'C1.5 registered band for arm 34 S3 (point prediction 0.0005 at n=2000)');
  assert.equal(s3.verdict, 'INERT',
    'C1.5/C1.12: INERT here restores overallVerdict\'s valid-but-inert cap (score.mjs:566-570), '
    + 'so the expected overall verdict is ADVISORY — v2.K6/K6.1\'s original registration');
});

test('K6.10 provenance: independent window-partition + wealth-endpoint recompute matches the harness at smoke n, across the d=2.0 two-point degeneracy', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const shapeBlockBet = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-block-conformal-bet.js'));
  const TRAJ_STEP = 7919, HELDOUT_OFFSET = 500000, ONSET = 100, T = 300, N_SMOKE = 20;
  const HELDOUT_ROWS = 10000;
  // Amendment v2.C1 (C1.2): one continuous stream per held-out draw. TRAJ_STEP still spaces the
  // TRAJECTORY seeds below — that scheme is unchanged and was never defective; only the held-out
  // rows moved. Keeping both in one test makes the distinction visible rather than implied.
  const regenHeldout = (heldoutSeed) => {
    const draw = gaussFrom(rng(heldoutSeed));
    const rows = new Array(HELDOUT_ROWS);
    for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = draw();
    return rows;
  };
  const sliceWindows = (series) => {
    const ws = [];
    for (let w = 0; w < 6; w++) ws.push(series.slice(ONSET + w * 30, ONSET + w * 30 + 30));
    return ws;
  };
  const cases = [
    { label: 'idx 27 canonical (d=1.5)', idx: 27, d: 1.5 },
    { label: 'idx 28 (d=2.0, two-point degeneracy, K6.2.1)', idx: 28, d: 2.0 },
  ];
  for (const { label, idx, d } of cases) {
    const cellSeed = 20260807 + idx;
    const heldoutSeed = cellSeed + HELDOUT_OFFSET;
    const cal = shapeBlockBet.calibrateShapeBlocks(regenHeldout(heldoutSeed), 30);
    let crossedCount = 0;
    for (let i = 0; i < N_SMOKE; i++) {
      const r = rng(cellSeed + TRAJ_STEP * i);
      const draw = gaussFrom(r);
      const base = Array.from({ length: T }, draw);
      const series = injectShapeMix(base, { sigma: 1, at: ONSET, d, rng: r });
      const { log } = shapeBlockBet.shapeBetWealth(sliceWindows(series), cal);
      if (log.some((l) => l >= Math.log(20))) crossedCount += 1;
    }
    const c = summary.cells.find((x) => x.detector === 'shape_block_conformal_bet' && x.cell_index === idx);
    assert.ok(c, `${label}: no shape_block_conformal_bet cell`);
    assert.equal(c.fires, crossedCount, `${label}: independently recomputed crossing count`);
    assert.equal(c.detection_rate, crossedCount / N_SMOKE, `${label}: detection_rate`);
  }

  // Minor 6 (post-Task-11a review): arm 34's S3 uses the IDENTICAL d=2.0 construction (K6.8)
  // on a DIFFERENT trajectory stream (CELL_SEED=20260841, no heldout influence on
  // generation — only on calibration, regenerated separately below) — so the pinned
  // detection_rate=1 literal on that row is not resting on cell 28's own guard alone.
  const ARM34_SEED = 20260807 + 34;
  const arm34HeldoutSeed = ARM34_SEED + HELDOUT_OFFSET;
  const arm34Cal = shapeBlockBet.calibrateShapeBlocks(regenHeldout(arm34HeldoutSeed), 30);
  let arm34Crossed = 0;
  for (let i = 0; i < N_SMOKE; i++) {
    const r = rng(ARM34_SEED + TRAJ_STEP * i);
    const draw = gaussFrom(r);
    const base = Array.from({ length: T }, draw);
    const series = injectShapeMix(base, { sigma: 1, at: ONSET, d: 2.0, rng: r });
    const { log } = shapeBlockBet.shapeBetWealth(sliceWindows(series), arm34Cal);
    if (log.some((l) => l >= Math.log(20))) arm34Crossed += 1;
  }
  const s3 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'power');
  assert.ok(s3, 'no shape_block_conformal_bet power arm');
  assert.equal(s3.fires, arm34Crossed, 'arm 34 S3: independently recomputed crossing count');
  assert.equal(s3.detection_rate, arm34Crossed / N_SMOKE, 'arm 34 S3: detection_rate');
});

test('K6.7 provenance: cell 34 S2 increment_estimator recomputes from an independently regenerated fixture', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const shapeBlockBet = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/shape-block-conformal-bet.js'));
  const TRAJ_STEP = 7919, ONSET = 100, T = 300, N_SMOKE = 20, HELDOUT_ROWS = 10000;
  const ARM34_SEED = 20260807 + 34;
  const ARM34_HELDOUT_SEED = ARM34_SEED + 500000;
  function summarise(xs) {
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    const se = Math.sqrt(varr / n);
    return { n, mean, sd: Math.sqrt(varr), se, lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
  }
  // Amendment v2.C1 (C1.2): the held-out rows are one continuous stream, not one draw per
  // spaced seed. TRAJ_STEP below still spaces the TRAJECTORY seeds — unchanged by C1.
  const heldoutRows = new Array(HELDOUT_ROWS);
  const heldoutDraw = gaussFrom(rng(ARM34_HELDOUT_SEED));
  for (let j = 0; j < HELDOUT_ROWS; j++) heldoutRows[j] = heldoutDraw();
  const cal = shapeBlockBet.calibrateShapeBlocks(heldoutRows, 30);

  const trajMeans = [];
  for (let i = 0; i < N_SMOKE; i++) {
    const draw = gaussFrom(rng(ARM34_SEED + TRAJ_STEP * i));
    const series = Array.from({ length: T }, draw);
    const eAvgs = [];
    for (let w = 0; w < 6; w++) {
      const window = series.slice(ONSET + w * 30, ONSET + w * 30 + 30);
      eAvgs.push(shapeBlockBet.shapeBetWindow(window, cal).eAvg);
    }
    trajMeans.push(eAvgs.reduce((a, b) => a + b, 0) / eAvgs.length);
  }
  const recomputed = summarise(trajMeans);
  const s2 = summary.cells.find((c) => c.detector === 'shape_block_conformal_bet' && c.arm === 'healthy');
  const inc = s2.increment_estimator;
  assert.equal(inc.n, recomputed.n);
  for (const f of ['mean', 'sd', 'se', 'lower95_one_sided', 'upper95_one_sided']) {
    assert.ok(Math.abs(inc[f] - recomputed[f]) < 1e-9, `increment_estimator.${f}: harness ${inc[f]} vs recomputed ${recomputed[f]}`);
  }
});

test('manifest records the registered seed scheme, substrate hash and smoke flag', () => {
  const { manifest } = smoke();
  assert.equal(manifest.study, 'coverage');
  assert.equal(manifest.prereg, 'PREREGISTRATION.md');
  assert.equal(manifest.mode, 'sim');
  assert.equal(manifest.alpha, 0.05);
  assert.equal(manifest.ticks, 300);
  assert.equal(manifest.onset, 100);
  assert.equal(manifest.n, 20);
  assert.equal(manifest.registered_n, 2000);
  assert.equal(manifest.smoke, true, 'an --n override must be flagged, never read as the registered run');
  assert.match(manifest.substrate_sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.seed_scheme.heldout_seed_arm_31, 20760838);
  assert.equal(manifest.seed_scheme.heldout_seed_arm_32, 20760839, 'K4.4: cell 32 HELDOUT_SEED');
  assert.equal(manifest.seed_scheme.heldout_seed_arm_34, 20760841, 'K6.6: cell 34 HELDOUT_SEED');
  assert.deepEqual(Object.keys(manifest.classes), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);
  assert.equal('elapsed_s' in manifest, false, 'A8 registers the manifest field list; timing is not in it');
});

// Mutate-resistance. The manifest's seed_scheme prose is INTERPOLATED from the harness's own
// constants, so a constant that moves changes the emitted string. This test pins both ends:
// the constants equal the registered literals, and the prose the run recorded quotes those same
// constants. Editing a constant without editing the pre-registration fails here (and at the
// harness's own startup assertion), rather than producing a run whose manifest describes a seed
// scheme it did not use.
test('manifest seed_scheme quotes the harness constants, and the constants are the registered literals', () => {
  const { manifest } = smoke();
  const c = manifest.seed_scheme.constants;
  assert.deepEqual(c, REGISTERED_SEEDS, 'seed constants moved away from the registered literals');
  assert.ok(manifest.seed_scheme.cell.includes(String(c.base_seed)), manifest.seed_scheme.cell);
  assert.ok(manifest.seed_scheme.trajectory.includes(String(c.trajectory_step)), manifest.seed_scheme.trajectory);
  assert.ok(manifest.seed_scheme.series.includes(String(c.series_salt)), manifest.seed_scheme.series);
  assert.ok(manifest.seed_scheme.series.includes(String(c.trajectory_step)), manifest.seed_scheme.series);
  assert.ok(manifest.seed_scheme.heldout.includes(String(c.heldout_offset)), manifest.seed_scheme.heldout);
  // Amendment v2.C1 (C1.2): the held-out prose no longer describes a spaced-seed draw. It still
  // mentions 7919 — inside the clause naming what it SUPERSEDES — so the old
  // `includes(trajectory_step)` assertion would pass for the wrong reason. Pinned on the words
  // that carry the corrected mechanism instead, plus the row count it draws.
  assert.match(manifest.seed_scheme.heldout, /CONSECUTIVE draws from one continuously-advanced/,
    'the manifest must describe the C1.2 continuous-stream draw, not the superseded scheme');
  assert.match(manifest.seed_scheme.heldout, /Amendment v2\.C1 C1\.2/, manifest.seed_scheme.heldout);
  assert.ok(manifest.seed_scheme.heldout.includes('10000'), manifest.seed_scheme.heldout);
  assert.equal(manifest.seed_scheme.heldout_acf_bound, 0.10, 'C1.2: the registered guard bound is recorded');
  assert.equal(manifest.heldout_lattice_hook, false, 'the lattice control hook must be off on an ordinary run');
  assert.equal(manifest.supersedes, null, 'C1.6: a run that supersedes nothing records null, not an empty list');
  // The one HELDOUT_SEED literal ever registered (Amendment v1.2 item 1) must be the arithmetic
  // result of the constants, not a copied number.
  assert.equal(c.base_seed + 31 + c.heldout_offset, manifest.seed_scheme.heldout_seed_arm_31);
  // Same discipline for arm 32's own HELDOUT_SEED (Amendment v2.K4, K4.4).
  assert.equal(c.base_seed + 32 + c.heldout_offset, manifest.seed_scheme.heldout_seed_arm_32);
  // Same discipline for arm 34's own HELDOUT_SEED (Amendment v2.K6, K6.6).
  assert.equal(c.base_seed + 34 + c.heldout_offset, manifest.seed_scheme.heldout_seed_arm_34);
});

test('a smoke run lands under results/sim and never creates results/live', () => {
  const { outRoot, runDir, manifest } = runHarness(['--n', '5', '--classes', 'K1']);
  assert.equal(fs.existsSync(path.join(outRoot, 'live')), false);
  assert.ok(runDir.startsWith(path.join(outRoot, 'sim')), runDir);
  assert.equal(manifest.mode, 'sim');
  assert.equal(manifest.n, 5);
  assert.equal(manifest.smoke, true);
  assert.deepEqual(fs.readdirSync(outRoot), ['sim'], 'results/sim is the only directory a smoke run creates');
});

// The NOT-EXECUTABLE path, exercised by the harness's named test-only hook
// COVERAGE_FORCE_THROW=<detector_id>, which makes every adapter call for that detector
// throw. §9's fallback (adapter throws on > 1% of a cell's trajectories) then applies
// per (detector, cell), leaving the other detector on the same cells measured.
test('COVERAGE_FORCE_THROW drives the §9 NOT-EXECUTABLE fallback per (detector, cell)', () => {
  const { summary, manifest } = runHarness(['--n', '20', '--classes', 'K1'], { COVERAGE_FORCE_THROW: 'safe_t' });
  assert.equal(manifest.mode, 'sim', 'the forced-throw hook alone routes a run away from results/live');
  assert.equal(manifest.force_throw_hook, 'safe_t');
  const safeTCells = summary.cells.filter((c) => c.detector === 'safe_t');
  assert.ok(safeTCells.length > 0);
  for (const c of safeTCells) {
    assert.equal(c.verdict, 'NOT-EXECUTABLE');
    assert.equal(c.detection_rate, null);
    assert.equal(c.adapter_failures, 20);
    assert.match(c.not_executable_reason, /adapter threw/);
    // M4: the first error message per (detector, cell) is retained, so a reader can tell an
    // adapter's RangeError apart from a wiring defect without re-running the battery.
    assert.match(c.not_executable_reason, /first error: COVERAGE_FORCE_THROW=safe_t/);
  }
  const uiCells = summary.cells.filter((c) => c.detector === 'universal_inference');
  assert.ok(uiCells.length > 0, 'the other detector on the same cells must still be measured');
  for (const c of uiCells) {
    assert.equal(c.verdict === 'NOT-EXECUTABLE', false);
    assert.equal(c.adapter_failures, 0);
  }
});

// Amendment v2.C1, C1.6: the supersession declaration. This exists because results/ is
// append-only and loadEvidence pools every directory under validation/*/results/live/ with no
// cross-run dedup (collect.mjs:135-167) — so a preserved prior run keeps scoring alongside its
// own correction, and a rerun for a named code defect would change nothing. The declaration is
// the rerun's own manifest field, so the prior directory is never edited.
test('C1.6: --supersedes records a machine-readable declaration in the rerun\'s own manifest', () => {
  const { manifest } = runHarness([
    '--n', '20', '--classes', 'K6',
    '--supersedes', 'coverage/run-20260808T121548Z:shape_block_conformal_bet',
    '--supersedes-reason', 'test-only declaration',
  ]);
  assert.deepEqual(manifest.supersedes, [{
    study: 'coverage',
    run: 'run-20260808T121548Z',
    detectors: ['shape_block_conformal_bet'],
    reason: 'test-only declaration',
  }]);
});

test('C1.6: a supersession with no reason, no target, or a nonexistent run is refused at startup', () => {
  const cases = [
    { args: ['--supersedes', 'coverage/run-20260808T121548Z:shape_block_conformal_bet'], match: /must be given together/ },
    { args: ['--supersedes-reason', 'orphaned reason'], match: /must be given together/ },
    {
      args: ['--supersedes', 'coverage/run-does-not-exist:safe_t', '--supersedes-reason', 'r'],
      match: /which does not exist/,
    },
    {
      args: ['--supersedes', 'not-a-locator', '--supersedes-reason', 'r'],
      match: /must read study\/run:detector/,
    },
  ];
  for (const { args, match } of cases) {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-supersede-'));
    let stderr = '';
    let threw = false;
    try {
      execFileSync(process.execPath, [HARNESS, '--n', '5', '--classes', 'K6', ...args], {
        env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot }, encoding: 'utf8', stdio: 'pipe',
      });
    } catch (err) {
      threw = true;
      stderr = String(err.stderr ?? '');
    }
    assert.ok(threw, `${args.join(' ')}: must be refused`);
    assert.match(stderr, match);
    assert.equal(fs.existsSync(path.join(outRoot, 'live')), false);
    assert.equal(fs.existsSync(path.join(outRoot, 'sim')), false, 'refused before any run directory is created');
  }
});
