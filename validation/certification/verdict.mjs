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
import { scoreS1, scoreS2, scoreS3, scoreS4, overallVerdict } from './lib/score.mjs';
import { fileSha256 } from './lib/freeze.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outRoot = process.env.CERT_RESULTS_DIR ? resolve(process.env.CERT_RESULTS_DIR) : join(here, 'results');
const outDir = join(outRoot, `run-${stamp}`);
mkdirSync(outDir, { recursive: true });

const evidence = loadEvidence(join(repoRoot, 'validation'));
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
  const s4 = scoreS4(card);
  const overall = overallVerdict(card, s2, s3, s4);
  const out = { card, s1, s2, s3, s4, overall, generated_from: { runs: [...new Set(cells.map((c) => `${c.__study}/${c.__run}`))] } };
  writeFileSync(join(outDir, `${card.detector_id}.card.json`), JSON.stringify(out, null, 2) + '\n');
  emitted.push(out);
}

const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
  study: 'detector-certification', protocol_version: 1, git_sha: gitSha,
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
  return `| ${o.card.detector_id} | ${o.card.class} | ${o.s2.status} | ${o.s3.status} | ${o.s4.status} | ${suppressed} | **${o.overall.verdict}** | ${o.overall.tier ?? '—'} |`;
};
writeFileSync(join(outDir, 'REPORT.md'), [
  `# Certification re-score — protocol v1, engine ${gitSha.slice(0, 7)}`, '',
  'Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.', '',
  '| detector | class | S2 | S3 | S4 | suppressed | verdict | tier |', '|---|---|---|---|---|---|---|---|',
  ...emitted.map(line), '',
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
  ...(o.s2.missing ?? []).map((e) => cellLine(o, 'S2', e)),
  ...(o.s3.missing ?? []).map((e) => cellLine(o, 'S3', e)),
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
console.log(`emitted ${emitted.length} cards -> ${outDir}`);
