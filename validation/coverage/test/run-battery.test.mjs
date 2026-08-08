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
import { FAULT_CLASSES } from '../../certification/lib/constants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(HERE, '..', 'harness', 'run-battery.mjs');

// PREREGISTRATION.md §7 + Amendment A6 + Amendment v2.K4/v2.K4.1: which detectors are
// scored on which class. K4 gains `point_tail_bet_e_value` at Amendment v2.K4 (K4.3).
const REGISTERED_PAIRS = {
  K1: ['safe_t', 'universal_inference'],
  K2: ['group_average_e_value', 'safe_t'],
  K3: ['safe_t', 'universal_inference', 'family_D_spectral_e_detector'],
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
  assert.equal(summary.cells.length, 72, 'registered census: 66 fault-class rows + 6 arm rows');

  const faultCells = summary.cells.filter((c) => c.fault_class != null);
  assert.equal(faultCells.length, 66);
  const byDetector = {};
  for (const c of faultCells) byDetector[c.detector] = (byDetector[c.detector] ?? 0) + 1;
  assert.deepEqual(byDetector, REGISTERED_CENSUS);

  const armCells = summary.cells.filter((c) => c.arm != null);
  assert.equal(armCells.length, 6);
  assert.deepEqual(
    armCells.map((c) => `${c.detector}:${c.arm}`).sort(),
    ['family_E_conformal_heldout:healthy', 'family_E_conformal_heldout:power',
      'group_average_e_value:healthy', 'group_average_e_value:power',
      'point_tail_bet_e_value:healthy', 'point_tail_bet_e_value:power'],
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
