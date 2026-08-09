// validation/certification/verdict.mjs
//
// Mechanical verdict CLI: reads every frozen card in cards/, matches it against
// registered evidence under validation/*/results/live/, scores it through the
// four protocol stages, and emits one append-only results/run-<UTC>/ directory
// containing a manifest, one <detector_id>.card.json per card, REPORT.md, and
// MISSING-CELLS.md.
//
// Output root override: set CERT_RESULTS_DIR to redirect where run-<UTC>/ is
// created (used by test/report-consistency.test.mjs to drive the CLI
// end-to-end against a temp directory without touching the real results/).
// Defaults to validation/certification/results/.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { validateCard } from './lib/schema.mjs';
import { loadEvidence, cellsFor } from './lib/collect.mjs';
import { scoreS1, scoreS2, scoreS3, scoreS4, overallVerdict, pairingGaps, untokenedExclusions, coverageFor } from './lib/score.mjs';
import { envelopeKeys } from './lib/envelope.mjs';
import { fileSha256 } from './lib/freeze.mjs';
import { FAULT_CLASSES, COVERAGE_FLOOR, TIERS } from './lib/constants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outRoot = process.env.CERT_RESULTS_DIR ? resolve(process.env.CERT_RESULTS_DIR) : join(here, 'results');
const outDir = join(outRoot, `run-${stamp}`);
mkdirSync(outDir, { recursive: true });

const evidence = loadEvidence(join(repoRoot, 'validation'));
// S4.4 wiring is a fact about the shipped gate's envelope map, read out of the file
// mechanically once per run (lib/envelope.mjs).
const envKeys = envelopeKeys(readFileSync(join(repoRoot, 'fleet', 'e-bh-guarded.ts'), 'utf8'));
const cardFiles = readdirSync(join(here, 'cards')).filter((f) => f.endsWith('.json')).sort();
const emitted = [];
for (const f of cardFiles) {
  const card = JSON.parse(readFileSync(join(here, 'cards', f), 'utf8'));
  const errs = validateCard(card);
  if (errs.length) throw new Error(`${f} fails schema: ${errs.join('; ')}`);
  if (card.engine_pin.sha == null) throw new Error(`${f} is unfrozen; run freeze-cards first`);
  // The validity/power split is internal to scoreS2/scoreS3 (isValidityCell /
  // isPowerCell in lib/score.mjs) -- both stages get the full matched cell set
  // for the card, matching the nine-card sanity harness call pattern in
  // task-7-report.md (one "cells matched" count feeds both S2 and S3).
  const cells = cellsFor(evidence, card);
  const s1 = scoreS1(card);
  const s2 = scoreS2(card, cells);
  const s3 = scoreS3(card, cells);
  const s4 = scoreS4(card, { envelopeKeys: envKeys });
  const overall = overallVerdict(card, s1, s2, s3, s4);
  const pairing = pairingGaps(s2, s3);
  // Task 2: fault-class coverage, a grouping layer over the same S3 power evidence
  // (lib/score.mjs coverageFor doc comment). Attached to the per-card JSON so
  // COVERAGE.md below -- and the report-consistency machine check -- can both read it
  // straight off disk rather than recomputing it from raw cells.
  const coverage = coverageFor(card, cells);
  const out = { card, s1, s2, s3, s4, pairing, overall, coverage, generated_from: { runs: [...new Set(cells.map((c) => `${c.__study}/${c.__run}`))] } };
  writeFileSync(join(outDir, `${card.detector_id}.card.json`), JSON.stringify(out, null, 2) + '\n');
  emitted.push(out);
}

const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
// report_format is the shape of this run's emitted markdown, NOT the protocol version
// (which stays 1). Format 2 added REPORT.md's S1 column and the standing-caveat footer;
// format 3 added COVERAGE.md's per-YES-row "also COVERED" detail lines (I4); format 4 names
// EVERY detector tied at the best (status, canonical rate) on a NO row instead of the single
// lexicographic winner (coverage Amendment v2.C1 C1.9) and adds REPORT.md's superseded-evidence
// sections (C1.6, C1.1); format 5 splits those sections by provenance -- a registry-declared drop
// gets its own section, and a legacy declaration a registry covers moves out of "STILL SCORED"
// (which is no longer true of it) into a section that says what closed it (h0-battery Amendment
// A1); format 6 emits a SEVENTH class row -- coverage Amendment v2.K6A.1 (K6A.1.13 item 1) adds
// `K6-slow` to FAULT_CLASSES and `coverageFor`/`classRow` iterate its keys, so every COVERAGE.md
// this CLI writes from here on carries seven class rows where the eight committed run directories
// carry six. The row-count machine check in test/report-consistency.test.mjs is gated on this
// field for exactly that reason (the controller's ruling, registered at v2.K6A.2 K6A.2.1): format
// >= 6 is checked against the seven-class shape, format < 6 against the frozen six-class list.
// Preserved runs written under an earlier format are never rewritten --
// results/ is append-only -- so the machine check in test/report-consistency.test.mjs reads this
// field to know which columns and which detail lines to expect.
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
  study: 'detector-certification', protocol_version: 1, report_format: 6, git_sha: gitSha,
  node: process.version, cards: cardFiles.map((f) => ({ file: f, sha256: fileSha256(join(here, 'cards', f)) })),
}, null, 2) + '\n');

// One tally per stage that carries suppressed_verdicts (S2, S3), merged and
// sorted by token for a deterministic string. Nonempty means at least one
// entry in excluded[]/missing[] named a discarded verdict token -- see
// lib/score.mjs's withSuppression/tallySuppressed. '—' when nothing was
// suppressed on either stage, matching the '—' convention already used for a
// null tier below.
function mergeSuppressed(...tallies) {
  const merged = {};
  for (const t of tallies) {
    for (const [token, count] of Object.entries(t ?? {})) merged[token] = (merged[token] ?? 0) + count;
  }
  return merged;
}
function formatTally(tally) {
  const keys = Object.keys(tally).sort();
  return keys.length ? keys.map((k) => `${k} x${tally[k]}`).join(', ') : '—';
}

const line = (o) => {
  const suppressed = formatTally(mergeSuppressed(o.s2.suppressed_verdicts, o.s3.suppressed_verdicts));
  return `| ${o.card.detector_id} | ${o.card.class} | ${o.s1.status} | ${o.s2.status} | ${o.s3.status} | ${o.s4.status} | ${suppressed} | **${o.overall.verdict}** | ${o.overall.tier ?? '—'} |`;
};

// Two caveats that attach to every verdict in the table and are not derivable from any
// card's stage scores, carried verbatim so no reader can quote a row without them.
const STANDING_CAVEATS = [
  'ADR-0012 real-telemetry anomaly (E[e|H0] = 24/9/9) attaches to every T1/T2 verdict until explained',
  'P1 unmet: assertValidForFdrPath has no production caller — every USE is advisory in practice until the gate is wired',
];

// Amendment v2.C1 (C1.6): evidence a rerun's own manifest declared superseded is DROPPED from
// scoring, so it has to be visible in the report -- an unreported exclusion is
// indistinguishable from a scorer that lost rows. One line per (superseded run, detector), with
// the row count, the declaring run, and the declared reason.
//
// Amendment A1 (h0-battery) splits these by PROVENANCE. A drop a later run declared in its own
// manifest and a drop a pre-registration amendment authorized through a study registry are not the
// same act, and one section listing both would let a reader attribute an amendment's decision to a
// run that never made it. `source` comes off lib/collect.mjs's dropped map.
const supersededLine = (r, s) => `- ${r.study}/${r.run} — ${s.detector}: ${s.cells} `
  + `cell${s.cells === 1 ? '' : 's'} dropped, superseded by ${s.superseded_by} (${s.reason})`;
const supersededBySource = (source) => evidence.runs
  .filter((r) => r.superseded)
  .flatMap((r) => r.superseded.filter((s) => (s.source ?? 'manifest') === source).map((s) => supersededLine(r, s)));
const supersededLines = supersededBySource('manifest');
const registryLines = supersededBySource('registry');

// Amendment v2.C1.1: legacy `supersedes: {priorRun, defect}` declarations, recognized and
// reported, deliberately NOT acted on. Silence here would have been the status quo — which is
// how 148 h0-battery cells stayed in the pool for a week after being declared defective.
//
// Amendment A1 closed that gap through a registry rather than by promoting the legacy shape, so
// these declarations split in two. One that no registry covers is STILL SCORED and keeps the
// original section verbatim -- the sentence is still true of it. One a registry covers is now acted
// on, and gets its own section rather than vanishing: a reader has to be able to see both that the
// 2026-08-01 declaration existed and that something finally read it.
const legacy = evidence.unhonoured_supersessions ?? [];
const unhonouredLines = legacy
  .filter((u) => !u.covered_by_registry)
  .map((u) => `- ${u.target} — declared superseded by ${u.declared_by}, STILL SCORED. `
    + `Stated defect: ${u.defect}`);
const coveredLegacyLines = legacy
  .filter((u) => u.covered_by_registry)
  .map((u) => `- ${u.target} — declared superseded by ${u.declared_by} in the legacy `
    + `\`{priorRun, defect}\` shape, and NOW DROPPED by a supersession registry. `
    + `Stated defect: ${u.defect}`);

writeFileSync(join(outDir, 'REPORT.md'), [
  `# Certification re-score — protocol v1, engine ${gitSha.slice(0, 7)}`, '',
  'Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.', '',
  '| detector | class | S1 | S2 | S3 | S4 | suppressed | verdict | tier |', '|---|---|---|---|---|---|---|---|---|',
  ...emitted.map(line), '',
  ...(supersededLines.length
    ? ['## Superseded evidence (Amendment v2.C1 C1.6)', '',
      'Rows a later run\'s manifest declared superseded. The prior run directories are preserved '
      + 'byte-for-byte; only their scoring is withdrawn, per the reason each declaring run states.', '',
      ...supersededLines, '']
    : []),
  ...(registryLines.length
    ? ['## Superseded evidence by study registry (h0-battery Amendment A1)', '',
      'Rows a study\'s `results/live/SUPERSESSIONS.json` declares superseded. No later run '
      + 'declared these: the authority is the study\'s own pre-registration amendment, named in '
      + 'each line\'s `declared_by`. The superseded run directories are preserved byte-for-byte '
      + 'and the registry is a new file beside them, never inside one.', '',
      ...registryLines, '']
    : []),
  ...(coveredLegacyLines.length
    ? ['## Declared superseded in the legacy shape, and now closed by a registry (Amendment v2.C1.1 reported it; h0-battery Amendment A1 closed it)', '',
      'These runs declared a prior run superseded for a named code defect in the legacy '
      + '`supersedes: {priorRun, defect}` manifest shape. That shape is still not acted on — '
      + 'editing a preserved manifest to upgrade it would break the append-only guarantee that '
      + 'makes it citable. What acts on it is the registry above, authorized by the declaring '
      + 'study\'s own pre-registration. The declaration is kept here rather than removed, so the '
      + 'gap and its closure are both readable.', '',
      ...coveredLegacyLines, '']
    : []),
  ...(unhonouredLines.length
    ? ['## Declared superseded but STILL SCORED (Amendment v2.C1.1 — a reported gap, not a decision)', '',
      'These runs declared a prior run superseded for a named code defect, in the legacy '
      + '`supersedes: {priorRun, defect}` manifest shape, and this scorer does NOT act on it: '
      + 'the superseded run\'s cells are still in every verdict below. Honouring the declaration '
      + 'would move card verdicts, which needs the declaring study\'s own pre-registration to '
      + 'authorize. Read every verdict below with this open.', '',
      ...unhonouredLines, '']
    : []),
  '## Standing caveats', '',
  ...STANDING_CAVEATS.map((c) => `- ${c}`), '',
].join('\n'));

// A nonempty suppressed_verdicts tally gets its own MISSING-CELLS line per
// stage (S2, S3), in addition to the stage MISSING/UNPRICED lines the brief
// already asks for -- a suppressed verdict is evidence that was discarded,
// not evidence that never existed, and both are worth naming separately.
const suppressedLines = (o) => {
  const lines = [];
  if (Object.keys(o.s2.suppressed_verdicts ?? {}).length) {
    lines.push(`- ${o.card.detector_id}: S2 suppressed verdicts — ${formatTally(o.s2.suppressed_verdicts)}`);
  }
  if (Object.keys(o.s3.suppressed_verdicts ?? {}).length) {
    lines.push(`- ${o.card.detector_id}: S3 suppressed verdicts — ${formatTally(o.s3.suppressed_verdicts)}`);
  }
  return lines;
};

// o.s2.missing / o.s3.missing are arrays of per-cell objects
// ({detector, null_id, reason, ...}), not strings -- format each into its
// own markdown line naming which card, cell, and stage it came from.
const cellLine = (o, stage, entry) =>
  `- ${o.card.detector_id} ${stage} ${entry.detector}${entry.null_id ? '/' + entry.null_id : ''}: ${entry.reason}`;

const missing = emitted.flatMap((o) => [
  ...(o.s1.status === 'MISSING' ? [`- ${o.card.detector_id}: S1 reachability has no run-backed evidence`] : []),
  ...(o.s2.status === 'MISSING' ? [`- ${o.card.detector_id}: S2 has no scoreable in-regime validity cell`] : []),
  ...(o.s3.status === 'MISSING' ? [`- ${o.card.detector_id}: S3 has no in-regime power cell at the registered shift`] : []),
  ...(o.s4.status === 'UNPRICED' ? [`- ${o.card.detector_id}: S4 c-bound unmeasured behind a bootstrap-substituted threshold`] : []),
  // Every S4 reason, whatever the status. Some record a gap without changing the status
  // (no envelope wiring, alpha resolution unverifiable) and would otherwise appear nowhere,
  // since the REPORT column shows PASS; and gating them on PASS would let one S4 finding
  // suppress another, which is how family_C's unwired envelope hid behind its UNPRICED
  // c-bound. Overlap with the status line above is better than a swallowed finding.
  ...(o.s4.reasons ?? []).map((r) => `- ${o.card.detector_id}: S4 ${r}`),
  ...(o.s2.missing ?? []).map((e) => cellLine(o, 'S2', e)),
  ...(o.s3.missing ?? []).map((e) => cellLine(o, 'S3', e)),
  // I2: an in-regime cleared validity cell with no power arm at the same null.
  ...(o.pairing ?? []).map((g) => `- ${o.card.detector_id}: ${g.line}`),
  // I8: the excluded cells that carried no verdict token, grouped with counts -- the other
  // half of the excluded population from the suppressed-verdict tallies below.
  ...untokenedExclusions(o.s2).map((l) => `- ${o.card.detector_id}: S2 ${l}`),
  ...untokenedExclusions(o.s3).map((l) => `- ${o.card.detector_id}: S3 ${l}`),
  ...suppressedLines(o),
]);

// Two standing gaps that are protocol-wide, not per-card, and don't fall out
// of any single card's stage scores -- carried verbatim per the certification
// plan's coordination notes.
const standingGaps = [
  'clustersynth-ui / 13 wide-format studies: 426 cells carry no detector field (arm/counter keyed); sequential_ui T2 evidence and UI T2 tier unreadable until a per-study adapter exists',
  'power-per-cell + phi-sweep (2026-08-05): runs exist only under terminal-evalue/results/sim/; no live run backs the wiki page numbers; live re-run required',
];

writeFileSync(join(outDir, 'MISSING-CELLS.md'), [
  '# Missing cells (protocol v1 re-score)', '',
  ...missing, '',
  '## Standing gaps (protocol-wide, not per-card)', '',
  ...standingGaps.map((g) => `- ${g}`), '',
].join('\n'));

// COVERAGE.md -- fault-class coverage, aggregated across the whole card set. A class
// answers YES iff at least one card with overall.verdict === 'USE' has that class
// COVERED (lib/score.mjs coverageFor); everything else is NO. This is a portfolio
// question ("can anything in the fleet see a K3 fault"), not a per-card one, so it
// aggregates emitted[] rather than living inside the per-card loop above.
const minTier = (tiers) => {
  const present = tiers.filter((t) => t != null);
  if (present.length === 0) return null;
  return present.reduce((best, t) => (TIERS.indexOf(t) < TIERS.indexOf(best) ? t : best), present[0]);
};

// Mirrors coverageFor's own canonical/covering selection (lib/score.mjs, the
// `canonicalCells.find(... >= COVERAGE_FLOOR) ?? canonicalCells[0] ?? null` line) --
// `coverage[K].canonical` records the {severity, rate} the covering cell produced but
// not the cell's own __tier, so a YES row's tier is recovered by re-selecting the same
// cell out of `coverage[K].cells` (the full survivor objects) rather than re-deriving a
// second, divergent notion of "covering".
function coveringCellFor(covClass) {
  const rate = (c) => c.detection_rate ?? c.rate_e_ge_20;
  const canonicalCells = (covClass.cells ?? []).filter((c) => c.canonical === true);
  return canonicalCells.find((c) => rate(c) >= COVERAGE_FLOOR) ?? canonicalCells[0] ?? null;
}

function classRow(classId) {
  const supporting = emitted
    .filter((o) => o.overall.verdict === 'USE' && o.coverage[classId].status === 'COVERED')
    .map((o) => ({ o, cell: coveringCellFor(o.coverage[classId]) }))
    .sort((a, b) => a.o.card.detector_id.localeCompare(b.o.card.detector_id));

  if (supporting.length === 0) {
    return { classId, answer: 'NO', detectors: '—', tier: '—', rate: '—' };
  }

  const detectors = supporting.map(({ o }) => o.card.detector_id).join(', ');
  const rate = supporting.map(({ o }) => o.coverage[classId].canonical.rate).join(', ');
  const tier = minTier(supporting.map(({ cell }) => cell?.__tier ?? null)) ?? '—';
  return { classId, answer: 'YES', detectors, tier, rate };
}

const coverageRows = Object.keys(FAULT_CLASSES).map(classRow);
const coverageLine = (r) => `| ${r.classId} | ${r.answer} | ${r.detectors} | ${r.tier} | ${r.rate} |`;

// For a NO class, the detail line names the single best-status card that still fell
// short -- COVERED-but-not-USE beats NOT_POWERED beats NO_EVIDENCE, ties broken by the
// higher canonical rate and then by the lexicographically smaller detector_id -- so a
// reader sees exactly what is blocking the class rather than nine identical "no evidence"
// lines. M1: the detector_id tiebreak is compared explicitly rather than inherited from
// `emitted`'s order. It happens to be the same order today (cardFiles is sorted and each
// card's filename is its detector_id), but a comment claiming a tiebreak the code left to
// readdir order was false in the only sense that matters -- it would stop being true the
// moment the iteration order changed.
const STATUS_PRIORITY = { COVERED: 0, NOT_POWERED: 1, NO_EVIDENCE: 2 };
function bestBlocked(classId) {
  let best = null;
  for (const o of emitted) {
    const cov = o.coverage[classId];
    const candidate = { detector: o.card.detector_id, status: cov.status, rate: cov.canonical?.rate ?? null, verdict: o.overall.verdict };
    if (best === null || betterBlocked(candidate, best)) best = candidate;
  }
  return best;
}
function betterBlocked(a, b) {
  const pa = STATUS_PRIORITY[a.status], pb = STATUS_PRIORITY[b.status];
  if (pa !== pb) return pa < pb;
  const ra = a.rate ?? -Infinity, rb = b.rate ?? -Infinity;
  if (ra !== rb) return ra > rb;
  return a.detector.localeCompare(b.detector) < 0;
}
// Amendment v2.C1 (C1.9): the tie is now RENDERED, not silently resolved. `betterBlocked`'s
// lexicographic step is a deterministic ordering, not a statement about which detector is
// strongest -- and when several cards tie on (status, canonical rate) the old single-name line
// asserted a distinction the evidence does not make. All three K6 detectors read exactly 0.0005
// at the canonical cell in run-20260808T121548Z, and the line named one of them, which the Task
// 11b report then had to record as a deviation from the amendment's own expectation. Every card
// tied with the winner is named; the tie-break still fixes the ORDER, so the file stays
// deterministic. FUTURE RUNS ONLY -- committed COVERAGE.md files are not rewritten.
function tiedWithBest(classId, best) {
  return emitted
    .map((o) => ({ detector: o.card.detector_id, status: o.coverage[classId].status, rate: o.coverage[classId].canonical?.rate ?? null }))
    .filter((c) => c.status === best.status && c.rate === best.rate)
    .map((c) => c.detector)
    .sort((a, b) => a.localeCompare(b));
}
function blockedLine(classId) {
  const best = bestBlocked(classId);
  const rateStr = best.rate != null ? ` ${best.rate}` : '';
  const tied = tiedWithBest(classId, best);
  const names = tied.length > 1
    ? `${tied.join(', ')} (${tied.length}-way tie)`
    : best.detector;
  return `- ${classId}: NO — best: ${names} ${best.status}${rateStr} (verdict ${best.verdict})`;
}

// I4: a YES row's detector column lists only the USE cards that carried the class, so a
// card that measured the class COVERED but is barred from carrying it by its own non-USE
// verdict appeared nowhere in COVERAGE.md -- group_average_e_value read 0.9985 at the K2
// canonical cell, above the floor, and its REFUSE card removed it from the row that its
// number is the strongest evidence for. One detail line per such card, naming the rate and
// the verdict that blocks it, sorted by detector_id for a deterministic file.
function alsoCoveredLines(classId) {
  return emitted
    .filter((o) => o.overall.verdict !== 'USE' && o.coverage[classId].status === 'COVERED')
    .sort((a, b) => a.card.detector_id.localeCompare(b.card.detector_id))
    .map((o) => `- ${classId}: also COVERED by ${o.card.detector_id} `
      + `${o.coverage[classId].canonical?.rate ?? '—'} (verdict ${o.overall.verdict} — see card)`);
}

writeFileSync(join(outDir, 'COVERAGE.md'), [
  `# Fault-class coverage — protocol v1, engine ${gitSha.slice(0, 7)}`, '',
  'A class answers YES iff at least one card with overall verdict USE has that class COVERED '
    + '(lib/score.mjs coverageFor). Tier on a YES row is the min tier of the supporting canonical '
    + 'cells. Every row is detailed below the table: a NO row with the best status found across '
    + 'every card, a YES row with any card that also measured the class COVERED but is barred '
    + 'from carrying it by its own non-USE verdict.', '',
  '| class | answer | detector(s) | tier | canonical rate |', '|---|---|---|---|---|',
  ...coverageRows.map(coverageLine), '',
  '## Detail', '',
  ...coverageRows.flatMap((r) => (r.answer === 'NO' ? [blockedLine(r.classId)] : alsoCoveredLines(r.classId))), '',
].join('\n'));

console.log(`emitted ${emitted.length} cards -> ${outDir}`);
