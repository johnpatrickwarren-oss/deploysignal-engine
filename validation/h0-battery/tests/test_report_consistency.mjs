// tests/test_report_consistency.mjs — written BEFORE analysis/run_endpoints.mjs.
//
// PREREGISTRATION §10. gate-value-study shipped two report scripts reaching
// opposite verdicts on the same data; one of them silently dropped an arm that
// failed the acceptance bar instead of reporting it as failing. These assertions
// exist so that cannot happen here.
//
// Runs against the run REPORT.md cites, not the newest run — a later unrelated
// run must not break the gate, and a report must not silently re-point at
// fresher data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const REPORT = path.join(STUDY, 'REPORT.md');
const PREREG = path.join(STUDY, 'PREREGISTRATION.md');

const has = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');

// Endpoints registered in the pre-registration. Parsed from the file rather than
// hard-coded, so adding an endpoint there without reporting it fails here.
function registeredEndpoints() {
  const t = read(PREREG);
  const ids = new Set();
  for (const m of t.matchAll(/^\*\*(P\d|S\d)\*\*|^- \*\*(P\d|S\d)\*\*|##\s*\d+\.\s*[^\n]*—\s*(P\d)/gm)) {
    for (const g of m.slice(1)) if (g) ids.add(g);
  }
  for (const m of t.matchAll(/\b(P[12]|S[1-4])\b/g)) ids.add(m[1]);
  return [...ids].sort();
}

test('the report exists, or the study is explicitly not-executable', () => {
  if (!has(REPORT)) {
    assert.fail('REPORT.md missing. A not-executable outcome is itself reported (§8).');
  }
});

test('the report cites a run directory, and that directory exists', () => {
  const cited = [...read(REPORT).matchAll(/run-\d{8}T\d{6}Z/g)].map((m) => m[0]);
  assert.ok(cited.length > 0, 'REPORT.md must cite the run id it was generated from');
  for (const id of new Set(cited)) {
    assert.ok(
      has(path.join(STUDY, 'results', 'live', id)),
      `report cites ${id}, which does not exist under results/live/`,
    );
  }
});

test('every registered endpoint appears in the report', () => {
  const body = read(REPORT);
  for (const id of registeredEndpoints()) {
    assert.match(
      body, new RegExp(`^${id}:`, 'm'),
      `endpoint ${id} is registered but has no line in REPORT.md — this is how the hollow-win guard vanished from gate-value-study`,
    );
  }
});

test('every number printed in the report matches the run JSON', () => {
  const body = read(REPORT);
  const runId = body.match(/run-\d{8}T\d{6}Z/)[0];
  const ep = JSON.parse(read(path.join(STUDY, 'results', 'live', runId, 'endpoints.json')));
  for (const cell of ep.cells) {
    const line = body.split('\n').find(
      (l) => l.includes(cell.detector) && l.includes(cell.null_id) && l.includes(`alpha=${cell.alpha}`),
    );
    assert.ok(line, `no report line for ${cell.detector}/${cell.null_id}/alpha=${cell.alpha}`);
    const printed = Number(line.match(/rate=([0-9.]+)/)[1]);
    assert.ok(
      Math.abs(printed - cell.fire_rate) < 5e-4,
      `${cell.detector}/${cell.null_id}: report says ${printed}, JSON says ${cell.fire_rate}`,
    );
    assert.match(line, new RegExp(`verdict=${cell.verdict}\\b`),
      `${cell.detector}/${cell.null_id}: verdict word disagrees with the JSON`);
  }
});

test('no simulated record reaches a scored run', () => {
  const live = path.join(STUDY, 'results', 'live');
  if (!has(live)) return;
  for (const run of fs.readdirSync(live)) {
    const dir = path.join(live, run, 'cells');
    if (!has(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const rec = JSON.parse(read(path.join(dir, f)));
      assert.equal(rec.mode, 'live', `${run}/${f} has mode=${rec.mode} in a scored run`);
      assert.ok(rec.engine_version, `${run}/${f} carries no engine version`);
    }
  }
});

test('exactly one analysis script, and no second report path', () => {
  const analysis = fs.readdirSync(path.join(STUDY, 'analysis'));
  assert.deepEqual(
    analysis.filter((f) => f.endsWith('.mjs')).sort(), ['run_endpoints.mjs'],
    'analysis/ must contain exactly one script — two report paths is the gate-value-study defect',
  );
  const stray = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.name === 'node_modules' || f.name === 'results') continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/^report.*\.mjs$/.test(f.name)) stray.push(p);
    }
  })(STUDY);
  assert.deepEqual(stray, [], `stray report script(s): ${stray.join(', ')}`);
});

test('the report states the registration SHA', () => {
  assert.match(read(REPORT), /registration[- ]sha[: ]+[0-9a-f]{7,40}/i,
    'the report must name the commit that froze the endpoints');
});
