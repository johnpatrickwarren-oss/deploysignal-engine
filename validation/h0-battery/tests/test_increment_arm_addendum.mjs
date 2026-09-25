// tests/test_increment_arm_addendum.mjs — Amendment A6.5.3: every number in the increment-arm
// addendum is pinned to the run it cites (the machine-checked-report mechanism of
// knowledge methodology/pre-registration-discipline). Fails on drift, on an invented row, and on a
// cell the addendum forgot to print. analysis/ keeps exactly one script (§8), so this lives here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADDENDUM = path.join(STUDY, 'INCREMENT-ARM-ADDENDUM-2026-09-24.md');
const has = fs.existsSync;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('the addendum exists and cites exactly one live inc- run under the arm study id', () => {
  assert.ok(has(ADDENDUM), 'INCREMENT-ARM-ADDENDUM-2026-09-24.md missing — a not-executable outcome is itself reported (§8)');
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const cited = [...new Set([...body.matchAll(/inc-\d{8}T\d{6}Z/g)].map((m) => m[0]))];
  assert.equal(cited.length, 1, `addendum cites ${cited.length} run ids; A6.7 is one attempt`);
  assert.equal([...body.matchAll(/run-\d{8}T\d{6}Z/g)].length, 0, 'the addendum must not cite a run- directory as its own');
  const dir = path.join(STUDY, 'results', 'live', cited[0]);
  assert.ok(has(dir), `${cited[0]} is not under results/live/`);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(m.study, '2026-09-h0-battery-onset-mixture-increment');
  assert.equal(m.mode, 'live');
  assert.equal(m.arm, 'A6');
  assert.equal(m.supersedes, null);
  assert.equal(m.not_executable, null);
  assert.equal(m.n, 2000); assert.equal(m.ticks, 2000);
  assert.deepEqual(m.nulls, ['N1', 'N3-p09', 'N5', 'N6', 'N8']);
  assert.equal(m.kinds.length, 9);
  for (const v of Object.values(m.generator_variances)) assert.ok(near(v, 1, 0.03), 'A6.4.3');
});

function loadRun() {
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const run = body.match(/inc-\d{8}T\d{6}Z/)[0];
  const dir = path.join(STUDY, 'results', 'live', run, 'cells');
  const cells = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return { body, run, cells };
}

test('every cell in the run is printed with the same n, mean, interval, prediction and both verdict tokens; nothing is printed that the run did not measure', () => {
  const { body, cells } = loadRun();
  assert.equal(cells.length, 45, 'A6.2: 45 cells');
  const lines = body.split('\n').filter((l) => /^family_A_onset_mixture_increment_\S+ N\S+ n=/.test(l));
  assert.equal(lines.length, cells.length, `addendum prints ${lines.length} cell lines; the run has ${cells.length}`);
  for (const c of cells) {
    const e = c.increment_estimator;
    const line = lines.find((l) => l.startsWith(`${c.detector} ${c.null_id} n=`));
    assert.ok(line, `no line for ${c.detector}/${c.null_id}`);
    const num = (k) => Number(line.match(new RegExp(`${k}=(-?[0-9.]+)`))[1]);
    assert.equal(num('n'), e.n);
    assert.ok(near(num('mean'), e.mean, 5e-6), `${c.detector}/${c.null_id}: mean`);
    assert.ok(near(num('lower95'), e.lower95, 5e-6), `${c.detector}/${c.null_id}: lower95`);
    assert.ok(near(num('upper95'), e.upper95, 5e-6), `${c.detector}/${c.null_id}: upper95`);
    assert.ok(near(num('predicted'), c.registered_prediction, 5e-6), `${c.detector}/${c.null_id}: predicted`);
    assert.ok(line.includes(` verdict=${c.verdict} `), `${c.detector}/${c.null_id}: verdict token`);
    assert.ok(line.endsWith(`house=${c.house_rule_verdict}`), `${c.detector}/${c.null_id}: house-rule token`);
    // A6.2's rule, re-derived from the interval the cell carries.
    const expect = e.lower95 > 1.0005 ? 'REFUTED' : e.upper95 < 1.0005 ? 'CLEARED' : 'inconclusive';
    assert.equal(c.verdict, expect, `${c.detector}/${c.null_id}: cell verdict is not A6.2 of its own interval`);
  }
});

test('the summary table agrees with the cells, entry by entry', () => {
  const { body, cells } = loadRun();
  const header = body.split('\n').find((l) => l.startsWith('| increment kind | λ |'));
  assert.ok(header, 'summary table header');
  const nulls = header.split('|').map((s) => s.trim()).filter(Boolean).slice(2);
  assert.deepEqual(nulls, ['N1', 'N3-p09', 'N5', 'N6', 'N8']);
  const rows = body.split('\n').filter((l) => /^\| (gaussian|bounded_l[pm]0[1369]) \|/.test(l));
  assert.equal(rows.length, 9, `summary table has ${rows.length} kind rows`);
  for (const row of rows) {
    const cols = row.split('|').map((s) => s.trim()).filter(Boolean);
    const kind = cols[0];
    nulls.forEach((nid, i) => {
      const c = cells.find((x) => x.increment_kind === kind && x.null_id === nid);
      assert.ok(c, `${kind}/${nid} missing from the run`);
      const m = cols[i + 2].match(/^(-?[0-9.]+) \[(-?[0-9.]+), (-?[0-9.]+)\] (REFUTED|CLEARED|inconclusive)$/);
      assert.ok(m, `${kind}/${nid}: entry "${cols[i + 2]}" is not "mean [lower, upper] VERDICT"`);
      const e = c.increment_estimator;
      assert.ok(near(Number(m[1]), e.mean, 5e-6), `${kind}/${nid}: table mean`);
      assert.ok(near(Number(m[2]), e.lower95, 5e-6), `${kind}/${nid}: table lower`);
      assert.ok(near(Number(m[3]), e.upper95, 5e-6), `${kind}/${nid}: table upper`);
      assert.equal(m[4], c.verdict, `${kind}/${nid}: table verdict`);
    });
  }
});

test('the prediction table agrees with the cells, and every cell is within its registered tolerance (A6.3)', () => {
  const { body, cells } = loadRun();
  const rows = body.split('\n').filter((l) => /^\| N\S+ \| (gaussian|bounded_l[pm]0[1369]) \|/.test(l));
  assert.equal(rows.length, 45, `prediction table has ${rows.length} rows`);
  for (const row of rows) {
    const cols = row.split('|').map((s) => s.trim()).filter(Boolean);
    const [nid, kind, , pred, tol, mean, gap, within] = cols;
    const c = cells.find((x) => x.increment_kind === kind && x.null_id === nid);
    assert.ok(c, `${kind}/${nid} missing from the run`);
    assert.ok(near(Number(pred), c.registered_prediction, 5e-6), `${kind}/${nid}: registered`);
    assert.equal(Number(tol), c.prediction_tolerance, `${kind}/${nid}: tolerance`);
    assert.ok(near(Number(mean), c.increment_estimator.mean, 5e-6), `${kind}/${nid}: measured`);
    assert.ok(near(Number(gap), c.prediction_gap, 5e-6), `${kind}/${nid}: gap`);
    assert.equal(within, c.prediction_within_tolerance ? 'yes' : 'NO', `${kind}/${nid}: within`);
    assert.ok(c.prediction_within_tolerance, `${kind}/${nid}: outside tolerance — A6.3 falsifier (iii), a discrepancy to report`);
  }
});

test('the registered verdict pattern held on every cell (A6.3), stated from the cells, not the prose', () => {
  const { cells } = loadRun();
  for (const c of cells) {
    const g = c.increment_kind === 'gaussian';
    const heavy = c.null_id === 'N5' || c.null_id === 'N6' || c.null_id === 'N8';
    const expect = g ? (heavy ? 'REFUTED' : 'CLEARED')
      : (c.null_id === 'N5' && c.lambda < 0) ? 'REFUTED' : 'CLEARED';
    assert.equal(c.verdict, expect, `${c.detector}/${c.null_id}`);
    assert.equal(c.house_rule_verdict, c.verdict, `${c.detector}/${c.null_id}: house rule and scored token differ — the addendum says they agree on every cell`);
  }
});
