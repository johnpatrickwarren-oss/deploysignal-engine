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
import { FAULT_CLASSES, TIERS, COVERAGE_FLOOR } from '../lib/constants.mjs';

const testDir = dirname(fileURLToPath(import.meta.url));
const certDir = join(testDir, '..');
const verdictScript = join(certDir, 'verdict.mjs');
const resultsRoot = join(certDir, 'results');

// Same min-tier reduction lib/score.mjs's (unexported) minTier performs, reimplemented
// independently here for the same reason expectedSuppressedCell reimplements
// mergeSuppressed/formatTally below: the test must not trust the CLI's own arithmetic.
function minTier(tiers) {
  const present = tiers.filter((t) => t != null);
  if (present.length === 0) return null;
  return present.reduce((best, t) => (TIERS.indexOf(t) < TIERS.indexOf(best) ? t : best), present[0]);
}

// Mirrors coverageFor's own canonical/covering selection (lib/score.mjs coverageFor,
// the `canonicalCells.find(... >= COVERAGE_FLOOR) ?? canonicalCells[0] ?? null` line) so
// this test can recover the tier of the specific cell that produced a class's
// `coverage[K].canonical` reading -- that tier is not itself exposed on `canonical`,
// only on the full cell objects in `coverage[K].cells`.
function coveringCellFor(covClass) {
  const rate = (c) => c.detection_rate ?? c.rate_e_ge_20;
  const canonicalCells = (covClass.cells ?? []).filter((c) => c.canonical === true);
  return canonicalCells.find((c) => rate(c) >= COVERAGE_FLOOR) ?? canonicalCells[0] ?? null;
}

// Task 2 machine-check: independently re-derive every COVERAGE.md row from the card
// JSONs beside it, the same "recompute, don't trust the CLI's formatting" pattern
// checkRunDir already applies to REPORT.md. A class answers YES iff at least one card
// with overall.verdict === 'USE' has that class COVERED; a YES row's tier must equal the
// min tier of the supporting cards' covering canonical cells.
function checkCoverageDir(dir) {
  const coveragePath = join(dir, 'COVERAGE.md');
  if (!existsSync(coveragePath)) return;
  const coverage = readFileSync(coveragePath, 'utf8');
  const cards = readdirSync(dir).filter((n) => n.endsWith('.card.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

  const classIds = Object.keys(FAULT_CLASSES);
  const rows = coverage.split('\n').filter((l) => classIds.some((k) => l.startsWith(`| ${k} |`)));
  assert.equal(rows.length, classIds.length, `${dir}: expected ${classIds.length} class rows in COVERAGE.md, got ${rows.length}`);

  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    const classId = cells[1];
    const answer = cells[2];
    const tier = cells[4];

    for (const o of cards) assert.ok(o.coverage, `${dir}: ${o.card.detector_id}.card.json has no coverage key`);

    const supporting = cards.filter((o) => o.overall.verdict === 'USE' && o.coverage[classId].status === 'COVERED');
    const expectedAnswer = supporting.length > 0 ? 'YES' : 'NO';
    assert.equal(answer, expectedAnswer, `${dir}: COVERAGE.md ${classId} answer "${answer}" disagrees with independent re-derivation (${expectedAnswer})`);

    if (expectedAnswer === 'YES') {
      const expectedTier = minTier(supporting.map((o) => coveringCellFor(o.coverage[classId])?.__tier ?? null));
      assert.equal(tier, expectedTier ?? '—', `${dir}: COVERAGE.md ${classId} tier "${tier}" disagrees with independent re-derivation (${expectedTier ?? '—'})`);
    }
  }
}

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

    // Row shape: | detector | class | S1 | S2 | S3 | S4 | suppressed | **verdict** | tier |
    // split('|') on a line that starts and ends with '|' yields a leading and trailing
    // empty string, so the detector is index 1 and every stage column is positional --
    // checked by index rather than by `includes`, so one stage's status can no longer
    // satisfy another stage's assertion.
    const cells = row.split('|').map((c) => c.trim());
    assert.equal(cells[3], o.s1.status, `${dir}/${f}: S1 mismatch`);
    assert.equal(cells[4], o.s2.status, `${dir}/${f}: S2 mismatch`);
    assert.equal(cells[5], o.s3.status, `${dir}/${f}: S3 mismatch`);
    assert.equal(cells[6], o.s4.status, `${dir}/${f}: S4 mismatch`);
    assert.equal(
      cells[7], expectedSuppressedCell(o),
      `${dir}/${f}: suppressed column "${cells[7]}" does not match the card's suppressed_verdicts tally`,
    );
    assert.equal(cells[9], o.overall.tier ?? '—', `${dir}/${f}: tier mismatch`);
  }

  // I9: both standing caveats, verbatim, on every run's report footer.
  assert.match(report, /ADR-0012 real-telemetry anomaly \(E\[e\|H0\] = 24\/9\/9\) attaches to every T1\/T2 verdict until explained/, `${dir}: ADR-0012 caveat missing from REPORT.md`);
  assert.match(report, /P1 unmet: assertValidForFdrPath has no production caller — every USE is advisory in practice until the gate is wired/, `${dir}: P1 caveat missing from REPORT.md`);

  checkCoverageDir(dir);
}

// Run directories are named run-<UTC basic>, so lexicographic order IS chronological.
// No pointer file: results/ is append-only, and a "current run" pointer would be the one
// file every run rewrote. Which report shape a run has is read off its own manifest's
// report_format, so a preserved run written under an earlier shape is checked against the
// shape it was written under rather than the shape the CLI emits today.
const runDirs = () => (existsSync(resultsRoot) ? readdirSync(resultsRoot).filter((d) => d.startsWith('run-')).sort() : []);
const reportFormat = (dir) => {
  const p = join(dir, 'manifest.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')).report_format ?? 1) : 1;
};

test('every format-2 run report matches its card JSONs, column for column', (t) => {
  const dirs = runDirs().map((r) => join(resultsRoot, r)).filter((d) => reportFormat(d) >= 2);
  if (dirs.length === 0) return t.skip('no format-2 run in results/ yet');
  for (const dir of dirs) checkRunDir(dir);
});

// Preserved earlier runs are NOT rewritten -- that is what append-only means -- so a
// format-1 run keeps its own table shape (no S1 column, no caveat footer). What must still
// hold for every preserved run is the property the machine check exists for: no report row
// may disagree with the verdict in the card JSON beside it.
test('every preserved format-1 run report still agrees with its own card JSONs on the verdict', (t) => {
  const dirs = runDirs().map((r) => join(resultsRoot, r)).filter((d) => reportFormat(d) < 2);
  if (dirs.length === 0) return t.skip('no format-1 run preserved in results/');
  for (const dir of dirs) {
    const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.card.json'))) {
      const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const row = report.split('\n').find((l) => l.includes(`| ${o.card.detector_id} |`));
      assert.ok(row, `${dir}: no report row for ${o.card.detector_id}`);
      assert.ok(row.includes(`**${o.overall.verdict}**`), `${dir}/${f}: report says "${row}" but card verdict is ${o.overall.verdict}`);
    }
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
  assert.ok(existsSync(join(dir, 'COVERAGE.md')), 'COVERAGE.md missing');
  checkRunDir(dir);

  const missing = readFileSync(join(dir, 'MISSING-CELLS.md'), 'utf8');
  assert.match(missing, /clustersynth-ui \/ 13 wide-format studies: 426 cells carry no detector field/, 'standing gap 1 not carried verbatim into MISSING-CELLS.md');
  assert.match(missing, /power-per-cell \+ phi-sweep \(2026-08-05\): runs exist only under terminal-evalue\/results\/sim\//, 'standing gap 2 not carried verbatim into MISSING-CELLS.md');
});
