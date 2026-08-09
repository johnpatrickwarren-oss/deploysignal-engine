import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvidence, cellsFor, derivePhiParams } from '../lib/collect.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ev-'));
  const mk = (study, run, manifest, summary) => {
    const d = join(root, study, 'results', 'live', run);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(d, 'summary.json'), JSON.stringify(summary));
  };
  mk('detector-audit', 'seq-1', { study: 'detector-audit-sequential', git_sha: 'aaa' },
    { cells: [{ detector: 'family_A_betting_e_process', null_id: 'N1', verdict: 'CLEARED' }] });
  mk('detector-audit', 'power-1', { study: 'detector-audit-power', git_sha: 'aaa' },
    [{ detector: 'betting_e_process', null_id: 'N1', shift_sigma: 3, detection_rate: 1, verdict: 'POWERED' }]);
  mk('shape-battery', 'sui-1', { study: 'clustersynth-ui', git_sha: 'bbb' },
    { cells: [{ detector: 'sequential_ui_e_process', null_id: 'CS1', verdict: 'CLEARED' }] });

  // Wide-format csui cell shape (real 2026-08-07 clustersynth-ui data): no top-level
  // `detector`, evidence for two detectors folded into one row via sui_/ui_ prefixes.
  // Mixed into the same run: a cell that already carries `detector` (must pass through
  // untouched) and a no-detector cell with no recognized prefix (must be skipped, not
  // silently mis-tagged as evidence).
  mk('shape-battery', 'wide-1', { study: 'clustersynth-wide-test', git_sha: 'www' },
    { cells: [
      {
        arm: 'A', counter: 'x', n_sui: 5, n_ui: 5,
        sui_crossing: 1, sui_stopped_mean: 0.5, sui_verdict: 'CLEARED',
        ui_exceedance: 1, ui_mean_e: 2.3, ui_verdict: 'REFUTED',
      },
      { detector: 'already_tagged', null_id: 'N1', verdict: 'CLEARED' },
      { arm: 'B', counter: 'y', mystery_field: 42 },
    ] });

  // h0-battery-like: manifest.json + endpoints.json (dict-shaped {cells:[...]}), no summary.json.
  // A cells/ dir sits alongside it with the same data split into per-cell files; endpoints.json
  // must win so cells aren't double-counted.
  const epDir = join(root, 'h0-battery', 'results', 'live', 'run-1');
  mkdirSync(join(epDir, 'cells'), { recursive: true });
  writeFileSync(join(epDir, 'manifest.json'), JSON.stringify({ study: '2026-07-h0-battery', git_sha: 'ccc' }));
  const h0Cell = { detector: 'family_A_betting_e_process', null_id: 'N1', alpha: 0.05, verdict: 'not-refuted' };
  writeFileSync(join(epDir, 'endpoints.json'), JSON.stringify({ cells: [h0Cell] }));
  writeFileSync(join(epDir, 'cells', 'family_A_betting_e_process__N1__a0.05.json'), JSON.stringify(h0Cell));

  // terminal-evalue-like: manifest.json + cells/*.json only, no summary.json and no endpoints.json.
  // Each file in cells/ is one cell.
  const cellsOnlyDir = join(root, 'terminal-evalue', 'results', 'live', 'run-1');
  mkdirSync(join(cellsOnlyDir, 'cells'), { recursive: true });
  writeFileSync(join(cellsOnlyDir, 'manifest.json'), JSON.stringify({ study: '2026-08-terminal-evalue', git_sha: 'ddd' }));
  writeFileSync(join(cellsOnlyDir, 'cells', 'safe_t__N1__a0.01.json'),
    JSON.stringify({ detector: 'safe_t', null_id: 'N1', alpha: 0.01, verdict: 'not-refuted' }));
  writeFileSync(join(cellsOnlyDir, 'cells', 'CONTROL_power__safe_t.json'),
    JSON.stringify({ control: 'power', detector: 'safe_t', verdict: 'pass' }));

  // Unsupported layout: a run dir with none of summary.json / endpoints.json / cells/.
  // Must be skipped (stderr warning), never thrown, never silently counted.
  const unsupportedDir = join(root, 'mystery-study', 'results', 'live', 'run-x');
  mkdirSync(unsupportedDir, { recursive: true });
  writeFileSync(join(unsupportedDir, 'notes.txt'), 'nothing recognizable here');

  // Adversarial union case, endpoints.json variant (mirrors the real h0-battery tree, where
  // three of four live runs have cells/ files -- P2__<detector>.json power cells -- that never
  // made it into endpoints.json). cells/ here holds: the same cell already in endpoints.json
  // (must be deduped, not double-counted), a P2-style power cell absent from endpoints.json
  // (must be included), and a bundles__x.json diagnostic with no 'detector' field (must be
  // ignored -- it's not evidence).
  const epMergeDir = join(root, 'h0-battery-merge', 'results', 'live', 'run-1');
  mkdirSync(join(epMergeDir, 'cells'), { recursive: true });
  writeFileSync(join(epMergeDir, 'manifest.json'), JSON.stringify({ study: 'h0-battery-merge-study', git_sha: 'eee' }));
  const epMergeCell = { detector: 'family_D_spectral_e_detector', null_id: 'N1', alpha: 0.05, verdict: 'not-refuted' };
  writeFileSync(join(epMergeDir, 'endpoints.json'), JSON.stringify({ cells: [epMergeCell] }));
  writeFileSync(join(epMergeDir, 'cells', 'family_D_spectral_e_detector__N1__a0.05.json'), JSON.stringify(epMergeCell));
  writeFileSync(join(epMergeDir, 'cells', 'P2__family_D_spectral_e_detector.json'),
    JSON.stringify({ detector: 'family_D_spectral_e_detector', shift_sigma: 3, detection_rate: 0.0075, verdict: 'FAIL' }));
  writeFileSync(join(epMergeDir, 'cells', 'bundles__x.json'), JSON.stringify([{ bundle: 0, baseline_n: 600 }]));

  // Adversarial union case, summary.json variant (mirrors the real family-ce-nulls tree, where
  // a P2.json array of power cells sits in cells/ but never made it into summary.json). Same
  // three-way mix: duplicate, extra (this time an array-shaped P2.json file), diagnostic.
  const smMergeDir = join(root, 'family-merge', 'results', 'live', 'run-1');
  mkdirSync(join(smMergeDir, 'cells'), { recursive: true });
  writeFileSync(join(smMergeDir, 'manifest.json'), JSON.stringify({ study: 'family-merge-study', git_sha: 'fff' }));
  const smMergeCell = { detector: 'family_C_mmd_betting_e_process', null_id: 'HC1', alpha: 0.05, verdict: 'not-refuted' };
  writeFileSync(join(smMergeDir, 'summary.json'), JSON.stringify({ cells: [smMergeCell] }));
  writeFileSync(join(smMergeDir, 'cells', 'familyC__HC1__a0.05.json'), JSON.stringify(smMergeCell));
  writeFileSync(join(smMergeDir, 'cells', 'P2.json'),
    JSON.stringify([{ detector: 'family_C_mmd_betting_e_process', alpha: 0.05, detection_rate: 1, verdict: 'pass' }]));
  writeFileSync(join(smMergeDir, 'cells', 'bundles__y.json'), JSON.stringify([{ bundle: 0, baseline_n: 600 }]));

  return root;
}

test('loads dict-shaped and array-shaped summaries, annotates study/run/tier', () => {
  const ev = loadEvidence(fixture());
  // 10 pre-existing + 3 from the wide-1 run's wide-format adapter (2 split + 1
  // already-tagged passthrough; the unrecognized no-detector cell is skipped, not counted).
  assert.equal(ev.cells.length, 13);
  const cs = ev.cells.find((c) => c.__study === 'clustersynth-ui');
  assert.equal(cs.__tier, 'T2');
  assert.equal(ev.cells.find((c) => c.__run === 'seq-1').__tier, 'T1');
});

test('cellsFor matches on detector_id and aliases', () => {
  const ev = loadEvidence(fixture());
  const card = { detector_id: 'family_A_betting_e_process', aliases: ['betting_e_process'] };
  assert.equal(cellsFor(ev, card).length, 3); // seq cell + h0-battery endpoints cell by id, power cell by alias
});

test('loads endpoints.json (dict-shaped) when summary.json is absent, deduping the identical cells/ copy', () => {
  const ev = loadEvidence(fixture());
  const h0Cells = ev.cells.filter((c) => c.__study === '2026-07-h0-battery');
  assert.equal(h0Cells.length, 1); // not 2 -- cells/ here holds only a duplicate of the endpoints.json cell
  assert.equal(h0Cells[0].__run, 'run-1');
  assert.equal(h0Cells[0].__git_sha, 'ccc');
  assert.equal(h0Cells[0].alpha, 0.05);
});

test('union rule (endpoints.json variant): cells/ extras are added, the aggregate duplicate is deduped, non-detector files are ignored', () => {
  const ev = loadEvidence(fixture());
  const mergeCells = ev.cells.filter((c) => c.__study === 'h0-battery-merge-study');
  assert.equal(mergeCells.length, 2); // aggregate cell + P2 power cell; duplicate and bundles__x.json excluded
  assert.ok(mergeCells.some((c) => c.null_id === 'N1' && c.verdict === 'not-refuted'));
  const power = mergeCells.find((c) => c.shift_sigma === 3);
  assert.equal(power.verdict, 'FAIL');
  assert.equal(power.detection_rate, 0.0075);
  assert.ok(!mergeCells.some((c) => 'bundle' in c));
});

test('union rule (summary.json variant): cells/ extras (including array-shaped files) are added, duplicates deduped, non-detector files ignored', () => {
  const ev = loadEvidence(fixture());
  const mergeCells = ev.cells.filter((c) => c.__study === 'family-merge-study');
  assert.equal(mergeCells.length, 2); // aggregate cell + P2.json power cell; duplicate and bundles__y.json excluded
  assert.ok(mergeCells.some((c) => c.null_id === 'HC1' && c.verdict === 'not-refuted'));
  const power = mergeCells.find((c) => c.verdict === 'pass');
  assert.equal(power.detection_rate, 1);
  assert.ok(!mergeCells.some((c) => 'bundle' in c));
});

test('loads one cell per file from cells/ when neither summary.json nor endpoints.json exists', () => {
  const ev = loadEvidence(fixture());
  const tevCells = ev.cells.filter((c) => c.__study === '2026-08-terminal-evalue');
  assert.equal(tevCells.length, 2);
  assert.ok(tevCells.every((c) => c.detector === 'safe_t'));
  assert.ok(tevCells.every((c) => c.__git_sha === 'ddd'));
});

// ---------------------------------------------------------------------------
// Task 4 -- wide-format adapter (unlocks T2 evidence for sequential_ui_e_process and
// universal_inference_e_value). csui summary.json cells carry no top-level `detector`;
// evidence for both detectors is folded into one row via sui_/ui_ prefixes.
// ---------------------------------------------------------------------------

test('wide-format adapter: a prefixed cell with no detector field splits into one cell per prefix, fields renamed, non-prefixed fields shared', () => {
  const ev = loadEvidence(fixture());
  const wideCells = ev.cells.filter((c) => c.__run === 'wide-1');

  const sui = wideCells.find((c) => c.detector === 'sequential_ui_e_process');
  assert.ok(sui, 'sequential_ui_e_process cell must be produced');
  assert.equal(sui.arm, 'A');
  assert.equal(sui.counter, 'x');
  assert.equal(sui.n_sui, 5);
  assert.equal(sui.n_ui, 5);
  assert.equal(sui.crossing_rate, 1);
  assert.equal(sui.stopped_mean, 0.5);
  assert.equal(sui.verdict, 'CLEARED');
  assert.equal(sui.__tier, 'T2');
  assert.ok(!('sui_crossing' in sui), 'prefixed field name must not survive');

  const ui = wideCells.find((c) => c.detector === 'universal_inference_e_value');
  assert.ok(ui, 'universal_inference_e_value cell must be produced');
  assert.equal(ui.arm, 'A');
  assert.equal(ui.counter, 'x');
  assert.equal(ui.exceedance, 1);
  assert.equal(ui.mean_e, 2.3);
  assert.equal(ui.verdict, 'REFUTED');
  assert.equal(ui.__tier, 'T2');
  assert.ok(!('ui_exceedance' in ui), 'prefixed field name must not survive');
});

test('wide-format adapter: a cell that already carries `detector` is passed through untouched', () => {
  const ev = loadEvidence(fixture());
  const already = ev.cells.find((c) => c.__run === 'wide-1' && c.detector === 'already_tagged');
  assert.ok(already);
  assert.equal(already.null_id, 'N1');
  assert.equal(already.verdict, 'CLEARED');
});

test('wide-format adapter: a no-detector cell with no recognized prefix is skipped (stderr), not counted', () => {
  const root = fixture();
  const originalWrite = process.stderr.write;
  const chunks = [];
  process.stderr.write = (chunk, ...rest) => { chunks.push(String(chunk)); return true; };
  let ev;
  try {
    ev = loadEvidence(root);
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.ok(!ev.cells.some((c) => c.__run === 'wide-1' && c.mystery_field === 42));
  const skipped = chunks.join('').split('\n').filter((l) => l.startsWith('skipped:'));
  assert.ok(skipped.some((l) => l.includes('wide-1')), 'must report the unrecognized cell as skipped');
});

// ---------------------------------------------------------------------------
// C2 -- mechanical phi/params derivation from the registered null-id grammar.
// Source of truth: h0-battery/harness/nulls.mjs (the NULLS table), which
// terminal-evalue's harness imports from and whose PREREGISTRATION section 5
// reuses verbatim. The id encodes phi and which parameter was estimated.
// ---------------------------------------------------------------------------

test('derivePhiParams: N1 is an oracle-parameter iid null at phi 0', () => {
  assert.deepEqual(derivePhiParams('N1'), { phi: 0, phi_source: 'oracle', params: 'oracle' });
});

test('derivePhiParams: N2-mXX estimates the baseline moments; phi is 0 by construction (iid)', () => {
  assert.deepEqual(derivePhiParams('N2-m30'), { phi: 0, phi_source: 'iid-by-construction', params: 'estimated-moments' });
  assert.deepEqual(derivePhiParams('N2-m500'), { phi: 0, phi_source: 'iid-by-construction', params: 'estimated-moments' });
});

test('derivePhiParams: N3-pXX carries an ORACLE phi read off the id', () => {
  assert.deepEqual(derivePhiParams('N3-p06'), { phi: 0.6, phi_source: 'oracle', params: 'oracle-phi' });
  assert.deepEqual(derivePhiParams('N3-p09'), { phi: 0.9, phi_source: 'oracle', params: 'oracle-phi' });
  assert.equal(derivePhiParams('N3-p03').phi, 0.3);
});

test('derivePhiParams: N4-pXX ESTIMATES phi, with or without the -mYY suffix', () => {
  assert.deepEqual(derivePhiParams('N4-p09'), { phi: 0.9, phi_source: 'estimated', params: 'estimated-phi' });
  assert.deepEqual(derivePhiParams('N4-p06-m100'), { phi: 0.6, phi_source: 'estimated', params: 'estimated-phi' });
});

test('derivePhiParams: N5/N6 are iid moment-matched nulls at phi 0; N7 is oracle', () => {
  assert.equal(derivePhiParams('N5').phi, 0);
  assert.equal(derivePhiParams('N5').params, 'moment-matched');
  assert.equal(derivePhiParams('N6').phi_source, 'iid-by-construction');
  assert.deepEqual(derivePhiParams('N7'), { phi: 0, phi_source: 'oracle', params: 'oracle' });
});

test('derivePhiParams returns null for any id outside the registered grammar (fail-closed input)', () => {
  for (const id of ['HC-gauss-corr', 'CS1', 'N8', 'N3', 'N4', 'N1-p09', '', undefined, null]) {
    assert.equal(derivePhiParams(id), null, `${id} must not be derivable`);
  }
});

test('loadEvidence annotates a phi-less cell whose null_id is in the grammar', () => {
  const ev = loadEvidence(fixture());
  const c = ev.cells.find((x) => x.__study === '2026-08-terminal-evalue' && x.null_id === 'N1');
  assert.equal(c.phi, 0);
  assert.equal(c.phi_source, 'oracle');
  assert.equal(c.phi_derived_from, 'null_id grammar (h0-battery/harness/nulls.mjs)');
});

test('loadEvidence never overwrites a recorded phi or a recorded params, but still tags phi_source', () => {
  const root = fixture();
  const d = join(root, 'phi-recorded', 'results', 'live', 'run-1');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'manifest.json'), JSON.stringify({ study: 'phi-recorded-study', git_sha: 'ggg' }));
  writeFileSync(join(d, 'summary.json'), JSON.stringify({ cells: [
    { detector: 'd', null_id: 'N4-p09-m100', phi: 0.87, params: 'estimated', verdict: 'REFUTED' },
  ] }));
  const c = loadEvidence(root).cells.find((x) => x.__study === 'phi-recorded-study');
  assert.equal(c.phi, 0.87, 'a recorded phi must win over the derived one');
  assert.equal(c.params, 'estimated', 'a recorded params must win over the derived one');
  assert.equal(c.phi_source, 'estimated', 'phi_source is still derived so the known-phi regime test is uniform');
  assert.equal(c.phi_derived_from, undefined);
});

test('loadEvidence leaves a non-grammar cell without phi, so the scorer can fail closed', () => {
  const ev = loadEvidence(fixture());
  const cs = ev.cells.find((c) => c.null_id === 'CS1');
  assert.equal(cs.phi, undefined);
  assert.equal(cs.phi_source, undefined);
});

test('unsupported run layouts are skipped (reported to stderr), not thrown, and not counted', () => {
  const root = fixture();
  const originalWrite = process.stderr.write;
  const chunks = [];
  process.stderr.write = (chunk, ...rest) => { chunks.push(String(chunk)); return true; };
  let ev;
  try {
    ev = loadEvidence(root);
  } finally {
    process.stderr.write = originalWrite;
  }
  const skippedLines = chunks.join('').split('\n').filter((l) => l.startsWith('skipped:'));
  // The unsupported run layout (mystery-study) plus the wide-1 run's unrecognized
  // no-detector, no-prefix cell (Task 4 adapter) each produce one skipped: line.
  assert.equal(skippedLines.length, 2);
  assert.ok(skippedLines.some((l) => l.includes(join('mystery-study', 'results', 'live', 'run-x'))));
  assert.ok(!ev.runs.some((r) => r.study === 'mystery-study'));
});

// ── supersession (coverage PREREGISTRATION.md Amendment v2.C1 C1.6, v2.C1.1) ──────────────
// results/ is append-only, so a rerun for a named code defect preserves the prior directory and
// its rows keep being scored alongside the rows that correct them. These tests pin the two shapes
// of the `supersedes` manifest field and the fact that exactly one of them is acted on.
function supersedeFixture(manifests) {
  const root = mkdtempSync(join(tmpdir(), 'ev-supersede-'));
  for (const [study, run, manifest, summary] of manifests) {
    const d = join(root, study, 'results', 'live', run);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(d, 'summary.json'), JSON.stringify(summary));
  }
  return root;
}
const cell = (detector, rate) => ({ detector, null_id: 'N1', shift_sigma: 3, detection_rate: rate, verdict: rate >= 0.1 ? 'POWERED' : 'INERT' });

test('C1.6: an array supersedes declaration drops exactly the named (study, run, detector) rows', () => {
  const root = supersedeFixture([
    ['coverage', 'run-old', { study: 'coverage', git_sha: 'a' },
      { cells: [cell('shape_block_conformal_bet', 1), cell('safe_t', 0)] }],
    ['coverage', 'run-new', {
      study: 'coverage',
      git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-old', detectors: ['shape_block_conformal_bet'], reason: 'C1' }],
    }, { cells: [cell('shape_block_conformal_bet', 0.0005)] }],
  ]);
  const ev = loadEvidence(root);
  const shape = ev.cells.filter((c) => c.detector === 'shape_block_conformal_bet');
  assert.equal(shape.length, 1, 'the superseded row must be gone, the correcting row must remain');
  assert.equal(shape[0].detection_rate, 0.0005);
  assert.equal(shape[0].__run, 'run-new');
  // safe_t was NOT named, so it survives in BOTH runs — the granularity is per detector, because
  // a run holds sound rows alongside the defective ones.
  assert.equal(ev.cells.filter((c) => c.detector === 'safe_t').length, 1);
  const old = ev.runs.find((r) => r.run === 'run-old');
  // `source` (Amendment A1) distinguishes a drop a later run's manifest declared from one a study
  // registry declared, so REPORT.md cannot attribute an amendment's decision to a run.
  assert.deepEqual(old.superseded, [{
    detector: 'shape_block_conformal_bet', cells: 1, superseded_by: 'coverage/run-new', reason: 'C1',
    source: 'manifest',
  }], 'the drop must be reported on the run entry, never silent');
});

test('C1.6: a supersession declared by a run discovered LATER still applies', () => {
  // Directory order is readdir order. `run-aaa` sorts first but is the one superseded, so a
  // single-pass loader would have already emitted its cells before seeing the declaration.
  const root = supersedeFixture([
    ['coverage', 'run-aaa', { study: 'coverage', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['coverage', 'run-zzz', {
      study: 'coverage', git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-aaa', detectors: ['d'], reason: 'r' }],
    }, { cells: [cell('d', 0)] }],
  ]);
  const ev = loadEvidence(root);
  assert.equal(ev.cells.filter((c) => c.detector === 'd').length, 1);
  assert.equal(ev.cells.find((c) => c.detector === 'd').__run, 'run-zzz');
});

test('C1.6: a supersession naming a run outside the corpus, or itself, fails closed', () => {
  const missing = supersedeFixture([
    ['coverage', 'run-new', {
      study: 'coverage', git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-nonexistent', detectors: ['d'], reason: 'r' }],
    }, { cells: [cell('d', 0)] }],
  ]);
  assert.throws(() => loadEvidence(missing), /not in the evidence corpus/);

  const selfRef = supersedeFixture([
    ['coverage', 'run-new', {
      study: 'coverage', git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-new', detectors: ['d'], reason: 'r' }],
    }, { cells: [cell('d', 0)] }],
  ]);
  assert.throws(() => loadEvidence(selfRef), /cannot supersede itself/);

  const noReason = supersedeFixture([
    ['coverage', 'run-old', { study: 'coverage', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['coverage', 'run-new', {
      study: 'coverage', git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-old', detectors: ['d'] }],
    }, { cells: [cell('d', 0)] }],
  ]);
  assert.throws(() => loadEvidence(noReason), /needs study, run, a non-empty/);
});

// Amendment v2.C1.1. h0-battery's run-20260801T064237Z and run-20260801T064627Z have carried
// `supersedes: {priorRun, defect}` since 2026-08-01 and nothing read it, so all 144 cells of
// run-20260801T062824Z have been scored alongside their own correction. Recognized and REPORTED,
// deliberately not acted on: honouring it moves four cards' verdicts, which needs h0-battery's own
// pre-registration. This test pins BOTH halves — that it is surfaced, and that it is not applied.
test('C1.1: the legacy {priorRun, defect} shape is reported and NOT applied', () => {
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('family_A_betting_e_process', 1)] }],
    ['h0-battery', 'run-new', {
      study: 'h0-battery', git_sha: 'b',
      supersedes: { priorRun: 'run-old', defect: 'oracle phi was never threaded' },
    }, { cells: [cell('family_A_betting_e_process', 0)] }],
  ]);
  const ev = loadEvidence(root);
  assert.equal(ev.cells.filter((c) => c.detector === 'family_A_betting_e_process').length, 2,
    'NOT applied: the superseded run is still scored');
  assert.equal(ev.runs.find((r) => r.run === 'run-old').superseded, undefined);
  assert.deepEqual(ev.unhonoured_supersessions, [{
    declared_by: 'h0-battery/run-new',
    target: 'h0-battery/run-old',
    defect: 'oracle phi was never threaded',
  }], 'REPORTED: the declaration must reach the caller so the report can carry it');
});

// LEAD WITH THE CORRECTION. This test used to assert the other half of the C1.1 gap — that
// run-20260801T062824Z's cells were "still scored", with `assert.ok(still.length >= 144)`. That was
// true when written and is now false: h0-battery PREREGISTRATION.md Amendment A1 registered
// validation/h0-battery/results/live/SUPERSESSIONS.json and the collector honours it. Both halves
// still hold, in their corrected form: the two 2026-08-01 declarations are still REPORTED (they are
// still not the mechanism that acts), and each now carries covered_by_registry.
test('C1.1 / A1: the real corpus still reports the two h0-battery legacy declarations, now covered by the registry', () => {
  const ev = loadEvidence(join(HERE, '..', '..'));
  const u = ev.unhonoured_supersessions;
  assert.equal(u.length, 2, `expected the two 2026-08-01 h0-battery declarations, got ${JSON.stringify(u)}`);
  for (const d of u) {
    // The locator uses the manifest's own `study` field, not the directory name: h0-battery's
    // manifests declare study '2026-07-h0-battery'.
    assert.equal(d.target, '2026-07-h0-battery/run-20260801T062824Z');
    assert.match(d.defect, /oracle phi was never threaded/);
    assert.equal(d.covered_by_registry, true,
      'a legacy declaration a registry covers is annotated, never removed from the report');
  }
  assert.equal(ev.cells.filter((c) => c.__run === 'run-20260801T062824Z').length, 0,
    'the declared-defective cells are no longer pooled');
});

test('C1.6: an unrecognized supersedes shape is a crash, not a silently ignored field', () => {
  const root = supersedeFixture([
    ['coverage', 'run-new', { study: 'coverage', git_sha: 'b', supersedes: 'run-old' },
      { cells: [cell('d', 0)] }],
  ]);
  assert.throws(() => loadEvidence(root), /must be an array, a legacy/);
});

// ── h0-battery PREREGISTRATION.md Amendment A1: per-study supersession registries ─────────────
// A registry closes the gap C1.1 reported without promoting the legacy shape. It exists because
// Amendment A1 supersedes three runs, two of which NO later run ever declared, so there is no
// manifest to carry the declaration and inventing a run to carry it would fabricate an artifact.
// The authority is a pre-registration amendment, named in each entry's `declared_by`.
function withRegistry(root, studyDir, entries) {
  writeFileSync(join(root, studyDir, 'results', 'live', 'SUPERSESSIONS.json'), JSON.stringify(entries));
  return root;
}
const regEntry = (over = {}) => ({
  study: 'h0-battery', run: 'run-old', detectors: ['family_A_betting_e_process'],
  reason: 'Amendment A1: byte-identical to the canonical run', declared_by: 'Amendment A1', ...over,
});
// Two runs, three detectors in the old one, two in the new. Enough to show the registry drops
// exactly what it names and leaves the rest, and enough for the no-self-erasure rule to have
// something to protect.
const twoRunStudy = () => supersedeFixture([
  ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' },
    { cells: [cell('family_A_betting_e_process', 1), cell('family_C_safe_hotelling', 1), cell('safe_t', 0)] }],
  ['h0-battery', 'run-new', { study: 'h0-battery', git_sha: 'b' },
    { cells: [cell('family_A_betting_e_process', 0.5), cell('family_C_safe_hotelling', 0.5)] }],
]);

test('A1: a registry drops exactly the (run x detector) cells it names, and nothing else', () => {
  const root = withRegistry(twoRunStudy(), 'h0-battery', [
    regEntry({ detectors: ['family_A_betting_e_process', 'family_C_safe_hotelling'] }),
  ]);
  const ev = loadEvidence(root);
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old' && c.detector === 'family_A_betting_e_process').length, 0);
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old' && c.detector === 'family_C_safe_hotelling').length, 0);
  // safe_t was NOT named, so it survives — the granularity is per detector even when the
  // amendment happens to name every detector a run carries.
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old' && c.detector === 'safe_t').length, 1);
  assert.equal(ev.cells.filter((c) => c.__run === 'run-new').length, 2, 'the canonical run is untouched');
  const old = ev.runs.find((r) => r.run === 'run-old');
  assert.deepEqual(old.superseded.map((s) => [s.detector, s.cells, s.superseded_by, s.source]), [
    ['family_A_betting_e_process', 1, 'Amendment A1', 'registry'],
    ['family_C_safe_hotelling', 1, 'Amendment A1', 'registry'],
  ], 'registry drops are reported with source: registry, so REPORT.md can show provenance');
});

test('A1: the real corpus census — the registry drops 440 h0-battery cells and leaves 064627Z whole', () => {
  const ev = loadEvidence(join(HERE, '..', '..'));
  const dropped = Object.fromEntries(ev.runs
    .filter((r) => r.study === '2026-07-h0-battery' && r.superseded)
    .map((r) => [r.run, r.superseded.reduce((n, s) => n + s.cells, 0)]));
  // Exact counts, not floors: results/ is append-only, so these three run directories are frozen
  // and their cell counts cannot change. 144 = the 4 x 12 x 3 endpoint grid (run-20260801T062612Z
  // has no P2 cells at all); 148 = the same grid plus 4 P2__<detector>.json cells from cells/.
  assert.deepEqual(dropped, {
    'run-20260801T062612Z': 144,
    'run-20260801T062824Z': 148,
    'run-20260801T064237Z': 148,
  }, 'exactly the three runs Amendment A1 names, at the counts A1.1 registers');
  assert.equal(ev.cells.filter((c) => c.__study === '2026-07-h0-battery').length, 148,
    'run-20260801T064627Z is the sole scored h0-battery run, at its full 148 cells');
  for (const r of ev.runs.filter((r) => r.study === '2026-07-h0-battery' && r.superseded)) {
    assert.equal(r.superseded.length, 4, `${r.run}: all four detectors named`);
    assert.ok(r.superseded.every((s) => s.source === 'registry'));
    assert.ok(r.superseded.every((s) => /Amendment A1/.test(s.superseded_by)));
  }
});

test('A1: a registry entry that is malformed fails closed', () => {
  const notArray = withRegistry(twoRunStudy(), 'h0-battery', { study: 'h0-battery', run: 'run-old' });
  assert.throws(() => loadEvidence(notArray), /supersession registry must be an array/);

  const noReason = withRegistry(twoRunStudy(), 'h0-battery', [{ ...regEntry(), reason: undefined }]);
  assert.throws(() => loadEvidence(noReason), /needs study, run, a non-empty/);

  const noDetectors = withRegistry(twoRunStudy(), 'h0-battery', [regEntry({ detectors: [] })]);
  assert.throws(() => loadEvidence(noDetectors), /needs study, run, a non-empty/);

  // `declared_by` is required of a registry entry and of nothing else: a manifest entry's declarer
  // is the run carrying it, and a registry has no run, so the authorizing amendment must sign.
  const noDeclarer = withRegistry(twoRunStudy(), 'h0-battery', [{ ...regEntry(), declared_by: undefined }]);
  assert.throws(() => loadEvidence(noDeclarer), /needs declared_by/);
});

test('A1: a registry naming a run outside the evidence corpus fails closed', () => {
  const root = withRegistry(twoRunStudy(), 'h0-battery', [regEntry({ run: 'run-nonexistent' })]);
  assert.throws(() => loadEvidence(root), /not in the evidence corpus/);
});

// The registry's stand-in for supersessionIndex's self-supersession check, which compares a
// target against the DECLARING RUN's locator and is vacuous for a file that is not a run
// (Amendment A1, A1.7). Rule 1: a registry's reach is the study whose pre-registration authorized
// it. Rule 2: it may not drop the replacement along with the defect.
test('A1 rule 1: a registry may not reach into another study', () => {
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-new', { study: 'h0-battery', git_sha: 'b' }, { cells: [cell('d', 0)] }],
    ['coverage', 'run-cov', { study: 'coverage', git_sha: 'c' }, { cells: [cell('d', 1)] }],
    ['coverage', 'run-cov2', { study: 'coverage', git_sha: 'd' }, { cells: [cell('d', 0)] }],
  ]);
  withRegistry(root, 'h0-battery', [regEntry({ study: 'coverage', run: 'run-cov', detectors: ['d'] })]);
  assert.throws(() => loadEvidence(root), /registry's reach is the study whose pre-registration authorized it/);
});

test('A1 rule 2: a registry may not leave a detector with no scoring run in the study', () => {
  const root = withRegistry(twoRunStudy(), 'h0-battery', [
    regEntry({ detectors: ['family_A_betting_e_process'] }),
    regEntry({ run: 'run-new', detectors: ['family_A_betting_e_process'] }),
  ]);
  assert.throws(() => loadEvidence(root),
    /leaves no run of h0-battery scoring family_A_betting_e_process/);
});

test('A1: a registry annotates the legacy declaration it covers rather than silencing it', () => {
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-new', {
      study: 'h0-battery', git_sha: 'b',
      supersedes: { priorRun: 'run-old', defect: 'oracle phi was never threaded' },
    }, { cells: [cell('d', 0)] }],
  ]);
  // Nothing covers it yet: the C1.1 behaviour is unchanged where no registry exists.
  assert.equal(loadEvidence(root).unhonoured_supersessions[0].covered_by_registry, undefined);
  assert.equal(loadEvidence(root).cells.filter((c) => c.__run === 'run-old').length, 1);

  withRegistry(root, 'h0-battery', [regEntry({ detectors: ['d'] })]);
  const ev = loadEvidence(root);
  assert.deepEqual(ev.unhonoured_supersessions, [{
    declared_by: 'h0-battery/run-new',
    target: 'h0-battery/run-old',
    defect: 'oracle phi was never threaded',
    covered_by_registry: true,
  }], 'still reported, now annotated — the legacy shape is covered, not honoured');
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old').length, 0, 'and the cells are gone');
  assert.equal(ev.runs.find((r) => r.run === 'run-old').superseded[0].source, 'registry',
    'the drop is attributed to the registry, not to the run that declared it in the legacy shape');
});

test('A1: a registry wins over a manifest array naming the same (run, detector)', () => {
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-new', {
      study: 'h0-battery', git_sha: 'b',
      supersedes: [{ study: 'h0-battery', run: 'run-old', detectors: ['d'], reason: 'the run says so' }],
    }, { cells: [cell('d', 0)] }],
  ]);
  withRegistry(root, 'h0-battery', [regEntry({ detectors: ['d'], reason: 'the amendment says so' })]);
  const s = loadEvidence(root).runs.find((r) => r.run === 'run-old').superseded[0];
  assert.equal(s.source, 'registry');
  assert.equal(s.reason, 'the amendment says so',
    'the amendment is the later and more specific artifact, so its reason is the reported one');
});

// ── h0-battery PREREGISTRATION.md Amendment A2: the two rules A1 left able to pass vacuously ──────
// WORKLIST C48(1) and C48(2), both found by C44's review. Until A2 a supersedes entry could name a
// detector that no cell of its target run carries — a typo, a rename, an alias the cells do not use
// — and the entry would drop nothing, report nothing, and read as honoured; and the registry's
// no-self-erasure rule counted a run that never measured the detector as the surviving run, so it
// could be satisfied by evidence that does not exist.

test('A2 C48(1): a manifest entry naming a detector the target run does not carry fails closed', () => {
  const root = supersedeFixture([
    ['coverage', 'run-old', { study: 'coverage', git_sha: 'a' }, { cells: [cell('safe_t', 1)] }],
    ['coverage', 'run-new', {
      study: 'coverage', git_sha: 'b',
      supersedes: [{ study: 'coverage', run: 'run-old', detectors: ['safe_t_e_value'], reason: 'r' }],
    }, { cells: [cell('safe_t', 0)] }],
  ]);
  // The error has to name all three: which entry declared it, which run it targets, and which name
  // did not match — a report that says only "unknown detector" cannot be acted on.
  assert.throws(() => loadEvidence(root), (e) => {
    assert.match(e.message, /^coverage\/run-new:/);
    assert.match(e.message, /names detector safe_t_e_value on target coverage\/run-old/);
    assert.match(e.message, /appears in no cell of that run/);
    assert.match(e.message, /carries safe_t$/);
    return true;
  });
});

test('A2 C48(1): a registry entry naming a detector the target run does not carry fails closed', () => {
  const root = withRegistry(twoRunStudy(), 'h0-battery', [regEntry({ detectors: ['family_B_typo'] })]);
  assert.throws(() => loadEvidence(root),
    /SUPERSESSIONS\.json: supersedes entry names detector family_B_typo on target h0-battery\/run-old/);
});

test('A2 C48(1): the target run is what must carry the name, not the corpus', () => {
  // safe_t exists in this study — in run-new — and the old rule would have been satisfied by any
  // spelling that matched something somewhere, because it matched nothing at all. The drop resolves
  // per (run, detector), so the name must be carried by the RUN being superseded.
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-new', { study: 'h0-battery', git_sha: 'b' },
      { cells: [cell('d', 0), cell('safe_t', 0)] }],
  ]);
  withRegistry(root, 'h0-battery', [regEntry({ detectors: ['safe_t'] })]);
  assert.throws(() => loadEvidence(root), /names detector safe_t on target h0-battery\/run-old/);
});

test('A2 C48(1): a wide-format target resolves its detector names through the adapter, not falsely', () => {
  // clustersynth-ui's rows fold two detectors into one cell with no top-level `detector` field, so
  // the check reads the names the wide adapter would produce. Without that expansion this entry
  // would throw on a name the run genuinely carries — the false-positive direction of the rule.
  const wide = { arm: 'a', counter: 1, sui_crossing: 0.01, sui_verdict: 'CLEARED', ui_exceedance: 0, ui_verdict: 'CLEARED' };
  const root = supersedeFixture([
    ['clustersynth-ui', 'run-old', { study: 'clustersynth-ui', git_sha: 'a' }, { cells: [wide] }],
    ['clustersynth-ui', 'run-new', {
      study: 'clustersynth-ui', git_sha: 'b',
      supersedes: [{ study: 'clustersynth-ui', run: 'run-old', detectors: ['sequential_ui_e_process'], reason: 'r' }],
    }, { cells: [wide] }],
  ]);
  const ev = loadEvidence(root);
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old' && c.detector === 'sequential_ui_e_process').length, 0,
    'the named half of the wide cell is dropped');
  assert.equal(ev.cells.filter((c) => c.__run === 'run-old' && c.detector === 'universal_inference_e_value').length, 1,
    'and the unnamed half of the same wide cell survives');
});

test('A2 C48(1): every committed declaration in the real corpus names only detectors its target carries', () => {
  // The corpus-level positive control for the strengthening: it is a strengthening only if the
  // committed SUPERSESSIONS.json and every committed manifest still validate. loadEvidence throws
  // if any named detector is unmatched, so reaching the census at all is the assertion.
  const ev = loadEvidence(join(HERE, '..', '..'));
  assert.equal(ev.cells.length, 2266, 'the pooled corpus is unchanged by A2 — no cell is added or dropped');
  const drops = ev.runs.filter((r) => r.superseded)
    .map((r) => [r.run, r.superseded.reduce((n, s) => n + s.cells, 0)]);
  assert.deepEqual(Object.fromEntries(drops), {
    'run-20260808T010208Z': 64,
    'run-20260808T064039Z': 12,
    'run-20260808T121548Z': 6,
    'run-20260801T062612Z': 144,
    'run-20260801T062824Z': 148,
    'run-20260801T064237Z': 148,
  }, 'the same six runs at the same counts as before A2 — three manifest-declared, three registry');
});

// C44's reviewer's fixture, verbatim in structure: run-old measures detector d, run-empty measures
// something else, and the registry drops run-old for d. Under A1.7's rule this PASSED — run-empty
// was not dropped for d, so it counted as the run that survives scoring d, while carrying no cell
// of d at all. d ends with no evidence, which is exactly what the rule forbids.
test('A2 C48(2): a surviving run must carry cells for the detector, not merely escape the drop', () => {
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-empty', { study: 'h0-battery', git_sha: 'b' }, { cells: [cell('other', 0)] }],
  ]);
  withRegistry(root, 'h0-battery', [regEntry({ detectors: ['d'] })]);
  assert.throws(() => loadEvidence(root),
    /leaves no run of h0-battery scoring d with cells for it/);
});

test('A2 C48(2): a run that does carry the detector still counts as the survivor', () => {
  // The negative control for the same rule: the strengthening must not refuse a registry whose
  // replacement run really does measure the detector.
  const root = supersedeFixture([
    ['h0-battery', 'run-old', { study: 'h0-battery', git_sha: 'a' }, { cells: [cell('d', 1)] }],
    ['h0-battery', 'run-new', { study: 'h0-battery', git_sha: 'b' }, { cells: [cell('d', 0)] }],
  ]);
  withRegistry(root, 'h0-battery', [regEntry({ detectors: ['d'] })]);
  const ev = loadEvidence(root);
  assert.equal(ev.cells.filter((c) => c.detector === 'd').length, 1);
  assert.equal(ev.cells.find((c) => c.detector === 'd').__run, 'run-new');
});
