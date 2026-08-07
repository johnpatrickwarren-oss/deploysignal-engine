// validation/certification/test/golden-verdicts.test.mjs
//
// I5 -- the nine verdicts are frozen here. Any change to the scorer, the guards, the
// cards, or the evidence corpus that moves a verdict fails this test by name.
//
// WHY A GOLDEN TABLE AND NOT A REPORT DIFF. The protocol's own rule is that endpoints and
// thresholds never move inside a version; the risk this guards is a scoring change that
// quietly restates a detector's usability while every stage-level test still passes. A
// per-stage test cannot see that -- only the composed verdict can. So the table below is
// the endpoint, and moving a row is a deliberate act with a commit message attached.
//
// The CLI is driven end-to-end against the REAL evidence corpus into a temp output root
// (CERT_RESULTS_DIR), so this reads the same path an official run takes and never writes
// into results/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const certDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Frozen 2026-08-07, protocol v1, cards frozen at 45ce230.
// verdict, tier, and the four stage statuses that produced them.
const GOLDEN = {
  family_A_betting_e_process: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'INERT', s4: 'UNPRICED' },
  family_A_mixture_supermartingale: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'PASS', s4: 'PASS' },
  family_C_safe_hotelling: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'MISSING', s2: 'MISSING', s3: 'PASS', s4: 'UNPRICED' },
  family_D_spectral_e_detector: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'INERT', s4: 'PASS' },
  family_E_conformal: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'DECLARED', s2: 'VOID', s3: 'MISSING', s4: 'REFUSE' },
  safe_t_e_value: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
  sequential_mmd_betting_e_process: { verdict: 'REFUSE', tier: null, s1: 'DECLARED', s2: 'REFUTED', s3: 'MISSING', s4: 'PASS' },
  sequential_ui_e_process: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'MISSING', s2: 'PASS', s3: 'MISSING', s4: 'PASS' },
  universal_inference_e_value: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
};

function runHarness(t) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'cert-golden-'));
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));
  execFileSync(process.execPath, [join(certDir, 'verdict.mjs')], {
    cwd: certDir, env: { ...process.env, CERT_RESULTS_DIR: tmpRoot }, stdio: 'pipe',
  });
  const runs = readdirSync(tmpRoot).filter((d) => d.startsWith('run-'));
  assert.equal(runs.length, 1);
  const dir = join(tmpRoot, runs[0]);
  const cards = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.card.json'))) {
    const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    cards[o.card.detector_id] = o;
  }
  return { dir, cards };
}

test('the nine verdicts are exactly the frozen table', (t) => {
  const { cards } = runHarness(t);
  assert.deepEqual(Object.keys(cards).sort(), Object.keys(GOLDEN).sort(), 'the set of certified detectors changed');
  for (const [id, want] of Object.entries(GOLDEN)) {
    const o = cards[id];
    assert.equal(o.overall.verdict, want.verdict, `${id}: verdict moved`);
    assert.equal(o.overall.tier, want.tier, `${id}: tier moved`);
    assert.equal(o.s1.status, want.s1, `${id}: S1 moved`);
    assert.equal(o.s2.status, want.s2, `${id}: S2 moved`);
    assert.equal(o.s3.status, want.s3, `${id}: S3 moved`);
    assert.equal(o.s4.status, want.s4, `${id}: S4 moved`);
  }
});

// The two facts the fix wave turned on, asserted against the corpus rather than a fixture:
// if either regressed, safe-t's USE would be resting on a cell that refutes it.
test('safe-t: the mean rule fires on N4-p09 and that cell is out of the published regime', (t) => {
  const { cards } = runHarness(t);
  const o = cards.safe_t_e_value;
  const n4 = o.s2.perCell.filter((c) => c.null_id === 'N4-p09');
  assert.equal(n4.length, 2, 'both alpha replicates of N4-p09 must be scored');
  for (const c of n4) {
    assert.equal(c.mapped, 'REFUTED');
    assert.equal(c.mean_rule_applied, true);
    assert.equal(c.overridden_verdict, 'not-refuted');
    assert.equal(c.out_of_regime, true);
  }
  assert.ok(o.overall.regime.excluded_cells.some((c) => c.null_id === 'N4-p09' && c.mapped === 'REFUTED'),
    'the refuting cell must appear in the published regime as excluded, not vanish');
  assert.equal(o.overall.verdict, 'USE');
});

test('universal-inference keeps its N4 cells in regime: its claim quantifies over any phi', (t) => {
  const { cards } = runHarness(t);
  const o = cards.universal_inference_e_value;
  assert.equal(o.card.guarantee.regime.phi_known, undefined, 'UI claims no known-phi restriction');
  const n4 = o.s2.perCell.filter((c) => c.null_id?.startsWith('N4'));
  assert.equal(n4.length, 4);
  assert.ok(n4.every((c) => c.out_of_regime === false && c.mapped === 'CLEARED'));
});

test('the report the harness writes carries the same nine verdicts as its card JSONs', (t) => {
  const { dir, cards } = runHarness(t);
  const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
  assert.ok(existsSync(join(dir, 'MISSING-CELLS.md')));
  for (const [id, want] of Object.entries(GOLDEN)) {
    const row = report.split('\n').find((l) => l.includes(`| ${id} |`));
    assert.ok(row, `no report row for ${id}`);
    assert.ok(row.includes(`**${want.verdict}**`), `${id}: report row disagrees with the frozen verdict`);
    assert.equal(cards[id].overall.verdict, want.verdict);
  }
});
