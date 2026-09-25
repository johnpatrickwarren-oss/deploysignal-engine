// tests/test_onset_mixture_addendum.mjs — Amendment A5.5.4: every number in the onset-mixture
// addendum is pinned to the run it cites (the machine-checked-report mechanism of
// knowledge methodology/pre-registration-discipline). Fails on drift, on an invented row, and on a
// cell the addendum forgot to print. analysis/ keeps exactly one script (§8), so this lives here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADDENDUM = path.join(STUDY, 'ONSET-MIXTURE-ADDENDUM-2026-09-24.md');
const has = fs.existsSync;

test('the addendum exists and cites exactly one live run under the arm study id', () => {
  assert.ok(has(ADDENDUM), 'ONSET-MIXTURE-ADDENDUM-2026-09-24.md missing — a not-executable outcome is itself reported (§8)');
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const cited = [...new Set([...body.matchAll(/run-\d{8}T\d{6}Z/g)].map((m) => m[0]))];
  assert.equal(cited.length, 1, `addendum cites ${cited.length} run ids; A5.7 is one attempt`);
  const dir = path.join(STUDY, 'results', 'live', cited[0]);
  assert.ok(has(dir), `${cited[0]} is not under results/live/`);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(m.study, '2026-09-h0-battery-onset-mixture');
  assert.equal(m.mode, 'live');
  assert.equal(m.arm, 'onset-mixture');
  assert.equal(m.n, 2000); assert.equal(m.ticks, 300);
});

function loadRun() {
  const body = fs.readFileSync(ADDENDUM, 'utf8');
  const run = body.match(/run-\d{8}T\d{6}Z/)[0];
  const dir = path.join(STUDY, 'results', 'live', run, 'cells');
  const cells = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return { body, run, cells };
}

test('every P1 cell in the run is printed, with the same rate, lower bound and verdict; nothing is printed that the run did not measure', () => {
  const { body, cells } = loadRun();
  const lines = body.split('\n').filter((l) => /^family_A_onset_mixture_\S+ N\d\S* alpha=/.test(l));
  const p1 = cells.filter((c) => c.null_id);
  assert.equal(lines.length, p1.length, `addendum prints ${lines.length} cell lines; the run has ${p1.length}`);
  for (const c of p1) {
    const line = lines.find((l) => l.startsWith(`${c.detector} ${c.null_id} alpha=${c.alpha} `));
    assert.ok(line, `no line for ${c.detector}/${c.null_id}/alpha=${c.alpha}`);
    const rate = Number(line.match(/rate=([0-9.]+)/)[1]);
    const lower = Number(line.match(/lower95=([0-9.]+)/)[1]);
    assert.ok(Math.abs(rate - c.fire_rate) < 5e-4, `${c.detector}/${c.null_id}/${c.alpha}: rate ${rate} vs ${c.fire_rate}`);
    assert.ok(Math.abs(lower - c.lower_95) < 5e-4, `${c.detector}/${c.null_id}/${c.alpha}: lower ${lower} vs ${c.lower_95}`);
    const tag = c.scored ? c.verdict : `${c.verdict} (descriptive)`;
    assert.ok(line.includes(`verdict=${tag}`), `${c.detector}/${c.null_id}/${c.alpha}: verdict word`);
  }
});

test('every P2 cell is printed with the same detection rate and verdict', () => {
  const { body, cells } = loadRun();
  for (const c of cells.filter((c) => c.detection_rate !== undefined)) {
    const line = body.split('\n').find((l) => l.startsWith(`P2: detector=${c.detector} `));
    assert.ok(line, `no P2 line for ${c.detector}`);
    assert.ok(Math.abs(Number(line.match(/detection_rate=([0-9.]+)/)[1]) - c.detection_rate) < 5e-4);
    assert.ok(line.includes(`verdict=${c.verdict}`));
  }
});

test('the summary table at alpha = 0.05 agrees with the cells, row by row', () => {
  const { body, cells } = loadRun();
  // rows: | adapter | N1 | N2-m30 | ... | each entry "rate/verdict" or "rate/FAIL"
  const table = body.split('\n').filter((l) => l.startsWith('| family_A_onset_mixture_'));
  assert.ok(table.length === 4, `summary table has ${table.length} adapter rows`);
  const header = body.split('\n').find((l) => l.startsWith('| adapter | N1 |'));
  assert.ok(header, 'summary table header');
  const nulls = header.split('|').map((s) => s.trim()).filter(Boolean).slice(1);
  for (const row of table) {
    const cols = row.split('|').map((s) => s.trim()).filter(Boolean);
    const det = cols[0];
    nulls.forEach((nid, i) => {
      const c = cells.find((x) => x.detector === det && x.null_id === nid && x.alpha === 0.05);
      assert.ok(c, `${det}/${nid}@0.05 missing from the run`);
      const m = cols[i + 1].match(/^([0-9.]+) \((not-refuted|FAIL)\)$/);
      assert.ok(m, `${det}/${nid}: cell "${cols[i + 1]}" is not "rate (verdict)"`);
      assert.ok(Math.abs(Number(m[1]) - c.fire_rate) < 5e-4, `${det}/${nid}: table ${m[1]} vs ${c.fire_rate}`);
      assert.equal(m[2], c.verdict, `${det}/${nid}: table verdict`);
    });
  }
});
