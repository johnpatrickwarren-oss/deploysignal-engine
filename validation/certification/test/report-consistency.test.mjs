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

  const yesClasses = [];
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
      yesClasses.push(classId);
      const expectedTier = minTier(supporting.map((o) => coveringCellFor(o.coverage[classId])?.__tier ?? null));
      assert.equal(tier, expectedTier ?? '—', `${dir}: COVERAGE.md ${classId} tier "${tier}" disagrees with independent re-derivation (${expectedTier ?? '—'})`);
    }
  }

  // I4: a YES row names only the USE cards that carried the class, so a card that measured
  // the class COVERED but is barred from carrying it by its own non-USE verdict
  // (group_average_e_value's 0.9985 on K2, card REFUSE) would appear nowhere in COVERAGE.md.
  // The detail section must name every such card. Re-derived from the card JSONs here and
  // compared set-for-set, so neither a missing line nor an invented one passes. Gated on
  // report_format >= 3: format-2 runs were written before these lines existed and are never
  // rewritten (append-only), so each is checked against the shape it was written under.
  if (reportFormat(dir) >= 3) {
    const expectedAlso = yesClasses.flatMap((classId) => cards
      .filter((o) => o.overall.verdict !== 'USE' && o.coverage[classId].status === 'COVERED')
      .map((o) => `- ${classId}: also COVERED by ${o.card.detector_id} `
        + `${o.coverage[classId].canonical?.rate ?? '—'} (verdict ${o.overall.verdict} — see card)`));
    const actualAlso = coverage.split('\n').filter((l) => l.includes('also COVERED by'));
    assert.deepEqual(
      actualAlso.slice().sort(), expectedAlso.slice().sort(),
      `${dir}: COVERAGE.md "also COVERED" detail lines disagree with the card JSONs`,
    );
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

// ── Amendment v2.C1 C1.9: the NO-row tie is rendered, not silently resolved ────────────────
// `betterBlocked`'s lexicographic step is a deterministic ORDERING, not a claim about which
// detector is strongest. When several cards tie on (status, canonical rate) the single-name line
// asserted a distinction the evidence does not make: all three K6 detectors read exactly 0.0005
// at the canonical cell in run-20260808T121548Z and the line named one of them, which the run
// report then had to record as a deviation from the amendment's own expectation. Gated on
// report_format >= 4 — earlier runs were written under the single-name shape and are never
// rewritten.
const STATUS_PRIORITY = { COVERED: 0, NOT_POWERED: 1, NO_EVIDENCE: 2 };

// Driven end-to-end into a temp root (the same pattern as the self-consistency test above) PLUS
// every committed format-4 run. The temp run is what keeps this green before the first format-4
// run is committed; the committed dirs are what keep it honest afterwards.
function formatFourDirs(t) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'cert-c1-'));
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));
  execFileSync(process.execPath, [verdictScript], { cwd: certDir, env: { ...process.env, CERT_RESULTS_DIR: tmpRoot }, stdio: 'pipe' });
  const fresh = readdirSync(tmpRoot).filter((d) => d.startsWith('run-')).map((d) => join(tmpRoot, d));
  const committed = runDirs().map((r) => join(resultsRoot, r)).filter((d) => reportFormat(d) >= 4);
  return [...fresh, ...committed];
}

test('C1.9: every NO row names every detector tied at the best (status, canonical rate)', (t) => {
  const dirs = formatFourDirs(t);
  assert.ok(dirs.length > 0, 'no format-4 certification run to check');
  for (const dir of dirs) {
    const coverage = readFileSync(join(dir, 'COVERAGE.md'), 'utf8');
    const cards = readdirSync(dir).filter((n) => n.endsWith('.card.json'))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
    for (const classId of Object.keys(FAULT_CLASSES)) {
      const line = coverage.split('\n').find((l) => l.startsWith(`- ${classId}: NO —`));
      if (!line) continue;   // a YES row has no blocked line
      const candidates = cards.map((o) => ({
        detector: o.card.detector_id,
        status: o.coverage[classId].status,
        rate: o.coverage[classId].canonical?.rate ?? null,
      }));
      const best = candidates.slice().sort((a, b) => {
        const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (p !== 0) return p;
        const ra = a.rate ?? -Infinity;
        const rb = b.rate ?? -Infinity;
        if (ra !== rb) return rb - ra;
        return a.detector.localeCompare(b.detector);
      })[0];
      const tied = candidates.filter((c) => c.status === best.status && c.rate === best.rate)
        .map((c) => c.detector).sort((a, b) => a.localeCompare(b));
      for (const d of tied) {
        assert.ok(line.includes(d),
          `${dir}: COVERAGE.md ${classId} NO line must name tied detector ${d}; line was "${line}"`);
      }
      if (tied.length > 1) {
        assert.ok(line.includes(`${tied.length}-way tie`),
          `${dir}: COVERAGE.md ${classId} must declare the ${tied.length}-way tie; line was "${line}"`);
      }
      // And it must not name a detector that is NOT tied with the best.
      for (const c of candidates) {
        if (tied.includes(c.detector)) continue;
        assert.equal(line.includes(c.detector), false,
          `${dir}: COVERAGE.md ${classId} NO line names untied detector ${c.detector}: "${line}"`);
      }
    }
  }
});

// C1.1: the unhonoured-supersession section is not optional decoration. h0-battery declared
// run-20260801T062824Z superseded for a named code defect and its cells were still scored, so a
// format-4 report that omits the disclosure is a report that hides a known gap.
//
// LEAD WITH THE CORRECTION (h0-battery Amendment A1). This test asserted "Declared superseded but
// STILL SCORED" on every format >= 4 report. A1 registered a supersession registry and the cells
// are no longer scored, so on a format-5 report that heading would be a false statement, and the
// declaration moves to a section naming what closed it. Both shapes are checked, each against the
// format it was written under — committed format-4 runs are never rewritten, which is what
// append-only means. What is asserted in BOTH cases is the property the test exists for: the
// 2026-08-01 declaration is named in the report, whatever the scorer does about it.
test('C1.1 / A1: every format-4+ report discloses the 2026-08-01 declaration, in the shape its format uses', (t) => {
  const dirs = formatFourDirs(t);
  assert.ok(dirs.length > 0, 'no format-4 certification run to check');
  for (const dir of dirs) {
    const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
    if (reportFormat(dir) >= 5) {
      assert.match(report, /Declared superseded in the legacy shape, and now closed by a registry/,
        `${dir}: REPORT.md must say what closed the legacy declaration`);
      assert.match(report, /NOW DROPPED by a supersession registry/,
        `${dir}: and the per-declaration line must say the cells are gone`);
      assert.match(report, /Superseded evidence by study registry \(h0-battery Amendment A1\)/,
        `${dir}: and the registry-declared drops need their own provenance section`);
      assert.doesNotMatch(report, /run-20260801T062824Z — declared superseded by .*STILL SCORED/,
        `${dir}: a format-5 report must not claim the dropped cells are still scored`);
    } else {
      assert.match(report, /Declared superseded but STILL SCORED/,
        `${dir}: REPORT.md must carry the C1.1 disclosure section`);
    }
    assert.match(report, /run-20260801T062824Z/, `${dir}: and name the run it applies to`);
  }
});
