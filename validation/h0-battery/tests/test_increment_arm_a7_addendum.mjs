// tests/test_increment_arm_a7_addendum.mjs — Amendment A7.5.3: every number in the Family-A increment
// addendum is pinned to the run it cites (the machine-checked-report mechanism of
// knowledge methodology/pre-registration-discipline). Fails on drift, on an invented row, and on a
// cell the addendum forgot to print.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADDENDUM = path.join(STUDY, 'FAMILY-A-INCREMENT-ADDENDUM-2026-09-25.md');
const has = fs.existsSync;
const rel = (a, b, tol = 2e-5) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test('the addendum exists and cites exactly one live inc- run under the arm study id', () => {
  assert.ok(has(ADDENDUM), 'FAMILY-A-INCREMENT-ADDENDUM-2026-09-25.md missing — a not-executable outcome is itself reported (§8)');
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const cited = [...new Set([...body.matchAll(/inc-\d{8}T\d{6}Z/g)].map((m) => m[0]))];
  assert.equal(cited.length, 1, `addendum cites ${cited.length} run ids; A7.7 is one attempt`);
  const dir = path.join(STUDY, 'results', 'live', cited[0]);
  assert.ok(has(dir), `${cited[0]} is not under results/live/`);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(m.study, '2026-09-h0-battery-family-a-increment');
  assert.equal(m.mode, 'live'); assert.equal(m.arm, 'A7');
  assert.equal(m.supersedes, null); assert.equal(m.not_executable, null);
  assert.equal(m.n, 2000); assert.equal(m.ticks, 2000);
  assert.deepEqual(m.nulls, ['N1', 'N3-p09', 'N5', 'N6', 'N8']);
  assert.deepEqual(m.constructions, ['family_A_betting_e_process', 'family_A_mixture_supermartingale']);
  assert.equal(m.n5_non_finite_draws, 0, 'A7.4.3: Correction 2 cannot recur');
});

function loadRun() {
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const run = body.match(/inc-\d{8}T\d{6}Z/)[0];
  const dir = path.join(STUDY, 'results', 'live', run, 'cells');
  const cells = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return { body, run, cells };
}

test('every cell is printed with the same n, both estimators, expectation, verdict, divergence and house tokens; nothing is printed that the run did not measure', () => {
  const { body, cells } = loadRun();
  assert.equal(cells.length, 10, 'A7.2: 10 cells');
  const lines = body.split('\n').filter((l) => /^family_A_\S+_increment N\S+ n=/.test(l));
  assert.equal(lines.length, cells.length, `addendum prints ${lines.length} cell lines; the run has ${cells.length}`);
  for (const c of cells) {
    const e = c.trajectory_estimator, p = c.increment_estimator;
    const line = lines.find((l) => l.startsWith(`${c.detector} ${c.null_id} n=`));
    assert.ok(line, `no line for ${c.detector}/${c.null_id}`);
    const num = (k) => Number(line.match(new RegExp(`${k}=(-?[0-9.e+-]+)`))[1]);
    assert.equal(num('n'), p.n);
    assert.ok(rel(num('traj'), e.mean), `${c.detector}/${c.null_id}: traj`);
    assert.ok(rel(num('lower95'), e.lower95), `${c.detector}/${c.null_id}: lower95`);
    assert.ok(rel(num('upper95'), e.upper95), `${c.detector}/${c.null_id}: upper95`);
    assert.ok(rel(num('pooled'), p.mean), `${c.detector}/${c.null_id}: pooled`);
    assert.ok(line.includes(` expected=${c.registered_expectation} `), 'expectation token');
    assert.ok(line.includes(` verdict=${c.verdict} `), 'verdict token');
    assert.ok(line.includes(` divergent=${c.divergent} `), 'divergent token');
    assert.ok(line.endsWith(`house=${c.house_rule_verdict}`), 'house-rule token');
    // A7.2 re-derived from the cell's own estimators.
    const byInterval = e.lower95 > 1.0005 ? 'REFUTED' : e.upper95 < 1.0005 ? 'CLEARED' : 'inconclusive';
    assert.equal(c.divergent, p.mean >= 1e4, 'I2 from the pooled mean');
    assert.equal(c.verdict, c.divergent ? 'REFUTED' : byInterval, `${c.detector}/${c.null_id}: A7.2 of its own estimators`);
    assert.equal(c.non_finite_increments, 0);
  }
});

test('the summary and prediction tables agree with the cells, row by row', () => {
  const { body, cells } = loadRun();
  const short = (id) => id === 'family_A_betting_e_process' ? 'betting' : 'mixture';
  const rows = body.split('\n').filter((l) => /^\| (betting|mixture) \| N\S+ \|/.test(l));
  assert.equal(rows.length, 20, `two tables of ten rows, got ${rows.length}`);
  for (const c of cells) {
    const mine = rows.filter((r) => r.startsWith(`| ${short(c.construction)} | ${c.null_id} |`));
    assert.equal(mine.length, 2, `${c.construction}/${c.null_id}: one row in each table`);
    const [sum, pred] = mine;
    const sc = sum.split('|').map((s) => s.trim()).filter(Boolean);
    const m = sc[2].match(/^(\S+) \[(\S+), (\S+)\]$/);
    assert.ok(m, `${c.null_id}: summary interval cell "${sc[2]}"`);
    assert.ok(rel(Number(m[1]), c.trajectory_estimator.mean, 1e-4) && rel(Number(m[2]), c.trajectory_estimator.lower95, 1e-4) && rel(Number(m[3]), c.trajectory_estimator.upper95, 1e-4), `${c.null_id}: summary interval`);
    assert.ok(rel(Number(sc[3]), c.increment_estimator.mean, 1e-4), `${c.null_id}: summary pooled`);
    assert.equal(sc[5], c.registered_expectation);
    assert.equal(sc[6], `${c.verdict}${c.divergent ? ' (divergent)' : ''}`);
    const pc = pred.split('|').map((s) => s.trim()).filter(Boolean);
    assert.equal(pc[6], c.registered_expectation);
    assert.equal(pc[7], c.prediction_within_tolerance ? 'yes' : 'NO');
    if (c.registered_prediction !== null) assert.ok(rel(Number(pc[2]), c.registered_prediction, 1e-4), `${c.null_id}: registered value`);
  }
});

test('the outcome the addendum states: nine of ten as registered, the mixture on N8 inconclusive', () => {
  const { cells } = loadRun();
  const held = cells.filter((c) => c.prediction_within_tolerance);
  assert.equal(held.length, 9);
  const miss = cells.find((c) => !c.prediction_within_tolerance);
  assert.equal(miss.construction, 'family_A_mixture_supermartingale'); assert.equal(miss.null_id, 'N8');
  assert.equal(miss.verdict, 'inconclusive'); assert.ok(miss.increment_estimator.maxToMean > 1e5, 'the heavy-tail tell');
  const b5 = cells.find((c) => c.construction === 'family_A_betting_e_process' && c.null_id === 'N5');
  assert.equal(b5.verdict, 'REFUTED'); assert.ok(b5.trajectory_estimator.lower95 > 1.001);
  for (const c of cells.filter((c) => c.construction === 'family_A_betting_e_process' && c.null_id !== 'N5')) assert.equal(c.verdict, 'CLEARED');
  for (const id of ['N5', 'N6']) { const c = cells.find((x) => x.construction === 'family_A_mixture_supermartingale' && x.null_id === id); assert.ok(c.divergent && c.verdict === 'REFUTED', id); }
});
