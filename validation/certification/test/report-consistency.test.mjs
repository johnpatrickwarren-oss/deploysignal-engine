// validation/certification/test/report-consistency.test.mjs
//
// Machine check: REPORT.md must never drift from the card JSONs it was
// generated from (the runway test_report_consistency mechanism). Two tests:
//   1. Walks the real results/ directory, if any runs exist there yet. This
//      is expected to skip cleanly today -- the official first run is a
//      later task's job, not this one's.
//   2. Drives verdict.mjs end-to-end against a temp output root via the
//      CERT_RESULTS_DIR env override (documented in README.md), so this test
//      exercises the real CLI without ever creating or touching the real
//      results/ directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const testDir = dirname(fileURLToPath(import.meta.url));
const certDir = join(testDir, '..');
const verdictScript = join(certDir, 'verdict.mjs');
const resultsRoot = join(certDir, 'results');

// Same merge-then-format algorithm verdict.mjs uses to build the REPORT.md
// 'suppressed' column (its mergeSuppressed/formatTally helpers) --
// reimplemented independently here so this test recomputes the expected
// string from the card JSON's own s2/s3.suppressed_verdicts rather than
// trusting the CLI's own formatting of it.
function expectedSuppressedCell(o) {
  const merged = {};
  for (const tally of [o.s2.suppressed_verdicts, o.s3.suppressed_verdicts]) {
    for (const [token, count] of Object.entries(tally ?? {})) merged[token] = (merged[token] ?? 0) + count;
  }
  const keys = Object.keys(merged).sort();
  return keys.length ? keys.map((k) => `${k} x${merged[k]}`).join(', ') : '—';
}

function checkRunDir(dir) {
  const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
  const cardFiles = readdirSync(dir).filter((n) => n.endsWith('.card.json'));
  assert.ok(cardFiles.length > 0, `${dir}: no card JSON files emitted`);
  for (const f of cardFiles) {
    const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const row = report.split('\n').find((l) => l.includes(`| ${o.card.detector_id} |`));
    assert.ok(row, `${dir}: no report row for ${o.card.detector_id}`);
    assert.ok(row.includes(`**${o.overall.verdict}**`), `${dir}/${f}: report says "${row}" but card verdict is ${o.overall.verdict}`);
    assert.ok(row.includes(`| ${o.s2.status} |`), `${dir}/${f}: S2 mismatch`);
    assert.ok(row.includes(`| ${o.s3.status} |`), `${dir}/${f}: S3 mismatch`);
    assert.ok(row.includes(`| ${o.s4.status} |`), `${dir}/${f}: S4 mismatch`);

    // Row shape: | detector | class | S2 | S3 | S4 | suppressed | **verdict** | tier |
    // split('|') on a line that starts and ends with '|' yields a leading and
    // trailing empty string, so the suppressed cell is index 6.
    const cells = row.split('|').map((c) => c.trim());
    assert.equal(
      cells[6], expectedSuppressedCell(o),
      `${dir}/${f}: suppressed column "${cells[6]}" does not match the card's suppressed_verdicts tally`,
    );
  }
}

test('every REPORT.md verdict line matches its card JSON (results/, if any runs exist yet)', (t) => {
  if (!existsSync(resultsRoot)) return t.skip('no runs yet -- the official first run belongs to a later task');
  for (const run of readdirSync(resultsRoot).filter((d) => d.startsWith('run-'))) {
    checkRunDir(join(resultsRoot, run));
  }
});

test('verdict.mjs run against a temp CERT_RESULTS_DIR produces a self-consistent report', (t) => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'cert-verdict-'));
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));

  execFileSync(process.execPath, [verdictScript], {
    cwd: certDir,
    env: { ...process.env, CERT_RESULTS_DIR: tmpRoot },
    stdio: 'pipe',
  });

  const runs = readdirSync(tmpRoot).filter((d) => d.startsWith('run-'));
  assert.equal(runs.length, 1, `expected exactly one run-<UTC> directory under the temp root, got ${runs.length}`);
  const dir = join(tmpRoot, runs[0]);

  assert.ok(existsSync(join(dir, 'manifest.json')), 'manifest.json missing');
  assert.ok(existsSync(join(dir, 'MISSING-CELLS.md')), 'MISSING-CELLS.md missing');
  checkRunDir(dir);

  const missing = readFileSync(join(dir, 'MISSING-CELLS.md'), 'utf8');
  assert.match(missing, /clustersynth-ui \/ 13 wide-format studies: 426 cells carry no detector field/, 'standing gap 1 not carried verbatim into MISSING-CELLS.md');
  assert.match(missing, /power-per-cell \+ phi-sweep \(2026-08-05\): runs exist only under terminal-evalue\/results\/sim\//, 'standing gap 2 not carried verbatim into MISSING-CELLS.md');
});
