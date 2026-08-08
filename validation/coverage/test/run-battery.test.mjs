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
import { rng, gaussFrom, injectOscillation } from '../lib/inject.mjs';

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
  K6: ['safe_t', 'universal_inference'],
};

// Registered seed literals (PREREGISTRATION.md §6, A5). The harness interpolates its own
// constants into the manifest and asserts them against these same literals at startup, so a
// constant that moves fails here as well as there.
const REGISTERED_SEEDS = {
  base_seed: 20260807, trajectory_step: 7919, series_salt: 104729, heldout_offset: 500000,
};

// The registered per-(class, detector) census (§7 + A6 + A1 + Amendment v2.K4 K4.3): 66
// fault-class rows and 6 arm rows. Amendment v2.K4 adds `point_tail_bet_e_value` on K4's
// four fault cells (18-21) plus its own arm (cell 32, S2+S3) — 4 fault + 2 arm rows, the
// "6 point_tail_bet_e_value rows" the task brief names.
const REGISTERED_CENSUS = {
  safe_t: 30,                        // K1 4 + K2 8 + K3 6 + K4 4 + K5 4 + K6 4
  universal_inference: 18,           // K1 4 + K3 6 + K5 4 + K6 4
  group_average_e_value: 8,          // every K2 cell
  family_E_conformal_heldout: 4,     // every K4 cell
  family_D_spectral_e_detector: 2,   // K3's canonical and -ar1 cells only
  point_tail_bet_e_value: 4,         // K4's four fault cells (Amendment v2.K4 K4.3)
  spectral_bet_e_process: 6,         // every K3 cell (Amendment v2.K3, K3.5) — 6 fault + 2 arm rows
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
  // Amendment v2.K3, K3.5/K3.6: +6 fault rows (all six K3 cells) + 2 arm rows (cell 33
  // S2/S3) on top of the pre-K3 72-cell census (66 fault + 6 arm).
  assert.equal(summary.cells.length, 80, 'registered census: 72 fault-class rows + 8 arm rows');

  const faultCells = summary.cells.filter((c) => c.fault_class != null);
  assert.equal(faultCells.length, 72);
  const byDetector = {};
  for (const c of faultCells) byDetector[c.detector] = (byDetector[c.detector] ?? 0) + 1;
  assert.deepEqual(byDetector, REGISTERED_CENSUS);

  const armCells = summary.cells.filter((c) => c.arm != null);
  assert.equal(armCells.length, 8);
  assert.deepEqual(
    armCells.map((c) => `${c.detector}:${c.arm}`).sort(),
    ['family_E_conformal_heldout:healthy', 'family_E_conformal_heldout:power',
      'group_average_e_value:healthy', 'group_average_e_value:power',
      'point_tail_bet_e_value:healthy', 'point_tail_bet_e_value:power',
      'spectral_bet_e_process:healthy', 'spectral_bet_e_process:power'],
  );
  assert.equal(faultCells.length + armCells.length, summary.cells.length,
    'every cell is either a fault-class cell or an arm — no third shape');
});

test('the ordinary path is throw-free end to end', () => {
  const { summary } = smoke();
  for (const c of summary.cells) {
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

test('params negative scope: every non-point_tail_bet_e_value row keeps params=oracle', () => {
  const { summary } = smoke();
  const nonPointRows = summary.cells.filter((c) => c.detector !== 'point_tail_bet_e_value');
  assert.ok(nonPointRows.length > 0);
  for (const c of nonPointRows) {
    // Kills a collapsed-ternary mutation (e.g. always 'heldout-empirical', or the branches
    // swapped) that a point_tail_bet_e_value-only positive check cannot see.
    assert.equal(c.params, 'oracle', `${c.detector} ${c.fault_class ?? c.arm} ${c.severity ?? ''}: params`);
  }
});

test('K4.4 provenance: cal_median/cal_mad are re-derivable from lib/inject.mjs at the registered heldout seed', () => {
  const { summary } = smoke();
  const distRequire = createRequire(import.meta.url);
  const tailBetDist = distRequire(path.join(HERE, '..', '..', '..', 'dist/detectors/point-tail-bet-e-value.js'));
  const HELDOUT_ROWS = 10000, TRAJ_STEP = 7919;
  const regenRows = (heldoutSeed) => {
    const rows = new Array(HELDOUT_ROWS);
    for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = gaussFrom(rng(heldoutSeed + TRAJ_STEP * j))();
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

test('K3.1.4 (Critical, binding): the S3 power row and all six fault cells carry NONE of the five instrument-named fields', () => {
  const { summary } = smoke();
  const scoped = [
    ...summary.cells.filter((c) => c.detector === 'spectral_bet_e_process' && c.fault_class === 'K3'),
    summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power'),
  ];
  assert.equal(scoped.length, 7, '6 fault cells + 1 S3 arm row');
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

test('K3.1.6: degenerate_windows is a non-negative integer on every spectral_bet_e_process row, 0 at smoke', () => {
  const { summary } = smoke();
  const rows = summary.cells.filter((c) => c.detector === 'spectral_bet_e_process');
  assert.equal(rows.length, 8, '6 fault cells + S2 + S3 arm rows');
  for (const c of rows) {
    assert.ok(Number.isInteger(c.degenerate_windows), `${c.fault_class ?? c.arm} ${c.cell_index}: degenerate_windows`);
    assert.equal(c.degenerate_windows, 0, `${c.fault_class ?? c.arm} ${c.cell_index}: none expected at registered amplitudes (K3.1.6)`);
  }
});

test('K3.7: cell 33 S3 (power) arm fires on any of the 6 window checkpoints, shift_sigma=3, no S2 instrument fields', () => {
  const { summary } = smoke();
  const s3 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power');
  assert.ok(s3, 'no spectral_bet_e_process power arm');
  assert.equal(s3.cell_index, 33);
  assert.equal(s3.shift_sigma, 3);
  assert.equal(s3.windows, 6);
  assert.equal(s3.window_len, 30);
  assert.equal(s3.window_span, '[100,280)');
  assert.ok(Number.isFinite(s3.detection_rate));
  assert.ok(!('k' in s3), 'S3 keeps A1\'s fires/detection_rate pair, not S2\'s k/crossing_rate pair');
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

test('K3 seed arithmetic: cell 33 CELL_SEED is BASE_SEED + 33, no heldout stream registered', () => {
  const { summary } = smoke();
  const s2 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'healthy');
  const s3 = summary.cells.find((c) => c.detector === 'spectral_bet_e_process' && c.arm === 'power');
  assert.equal('heldout_seed' in s2, false, 'K3.3/K3.6: no calibration stream for this detector');
  assert.equal('heldout_seed' in s3, false);
  assert.equal('cal_median' in s2, false);
  assert.equal('cal_mad' in s2, false);
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
  assert.ok(manifest.seed_scheme.heldout.includes(String(c.trajectory_step)), manifest.seed_scheme.heldout);
  // The one HELDOUT_SEED literal ever registered (Amendment v1.2 item 1) must be the arithmetic
  // result of the constants, not a copied number.
  assert.equal(c.base_seed + 31 + c.heldout_offset, manifest.seed_scheme.heldout_seed_arm_31);
  // Same discipline for arm 32's own HELDOUT_SEED (Amendment v2.K4, K4.4).
  assert.equal(c.base_seed + 32 + c.heldout_offset, manifest.seed_scheme.heldout_seed_arm_32);
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
