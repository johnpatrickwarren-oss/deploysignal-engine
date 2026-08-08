// validation/coverage/test/run-battery.test.mjs — smoke tests for the battery harness.
//
// The harness is driven as a child process at --n 20 (smoke), with COVERAGE_RESULTS_DIR
// pointed at a fresh temp dir so no test ever writes under
// validation/coverage/results/live (Task 9 owns the registered runs; loadEvidence reads
// validation/*/results/live/* and would pick a smoke run up as evidence).
//
// What is asserted here is shape and wiring, not the registered endpoints: one cell per
// registered (class, detector) pair, complete fields, `canonical` marked exactly once per
// class x detector, a real detection at a deliberately-injected 3-sigma K1 step, the A1
// healthy arms' S2 shape, and the NOT-EXECUTABLE fallback path.
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

// PREREGISTRATION.md §7 + Amendment A6: which detectors are scored on which class.
const REGISTERED_PAIRS = {
  K1: ['safe_t', 'universal_inference'],
  K2: ['group_average_e_value', 'safe_t'],
  K3: ['safe_t', 'universal_inference', 'family_D_spectral_e_detector'],
  K4: ['family_E_conformal_heldout', 'safe_t'],
  K5: ['safe_t', 'universal_inference'],
  K6: ['safe_t', 'universal_inference'],
};

function runHarness(args = [], env = {}) {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-battery-'));
  const stdout = execFileSync(process.execPath, [HARNESS, '--n', '20', ...args], {
    env: { ...process.env, COVERAGE_RESULTS_DIR: outRoot, ...env },
    encoding: 'utf8',
  });
  const liveDir = path.join(outRoot, 'live');
  const runs = fs.readdirSync(liveDir);
  assert.equal(runs.length, 1, `expected one run dir, got ${runs.join(',')}`);
  const runDir = path.join(liveDir, runs[0]);
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
  for (const det of ['group_average_e_value', 'family_E_conformal_heldout']) {
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

test('manifest records the registered seed scheme, substrate hash and smoke flag', () => {
  const { manifest } = smoke();
  assert.equal(manifest.study, 'coverage');
  assert.equal(manifest.prereg, 'PREREGISTRATION.md');
  assert.equal(manifest.alpha, 0.05);
  assert.equal(manifest.ticks, 300);
  assert.equal(manifest.onset, 100);
  assert.equal(manifest.n, 20);
  assert.equal(manifest.registered_n, 2000);
  assert.equal(manifest.smoke, true, 'an --n override must be flagged, never read as the registered run');
  assert.match(manifest.substrate_sha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.seed_scheme.cell, /20260807/);
  assert.match(manifest.seed_scheme.series, /104729/);
  assert.equal(manifest.seed_scheme.heldout_seed_arm_31, 20760838);
  assert.deepEqual(Object.keys(manifest.classes), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);
});

// The NOT-EXECUTABLE path, exercised by the harness's named test-only hook
// COVERAGE_FORCE_THROW=<detector_id>, which makes every adapter call for that detector
// throw. §9's fallback (adapter throws on > 1% of a cell's trajectories) then applies
// per (detector, cell), leaving the other detector on the same cells measured.
test('COVERAGE_FORCE_THROW drives the §9 NOT-EXECUTABLE fallback per (detector, cell)', () => {
  const { summary } = runHarness(['--classes', 'K1'], { COVERAGE_FORCE_THROW: 'safe_t' });
  const safeTCells = summary.cells.filter((c) => c.detector === 'safe_t');
  assert.ok(safeTCells.length > 0);
  for (const c of safeTCells) {
    assert.equal(c.verdict, 'NOT-EXECUTABLE');
    assert.equal(c.detection_rate, null);
    assert.equal(c.adapter_failures, 20);
    assert.match(c.not_executable_reason, /adapter threw/);
  }
  const uiCells = summary.cells.filter((c) => c.detector === 'universal_inference');
  assert.ok(uiCells.length > 0, 'the other detector on the same cells must still be measured');
  for (const c of uiCells) {
    assert.equal(c.verdict === 'NOT-EXECUTABLE', false);
    assert.equal(c.adapter_failures, 0);
  }
});
