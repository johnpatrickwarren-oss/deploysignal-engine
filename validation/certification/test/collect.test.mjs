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
  assert.deepEqual(old.superseded, [{
    detector: 'shape_block_conformal_bet', cells: 1, superseded_by: 'coverage/run-new', reason: 'C1',
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

test('C1.1: the real corpus carries exactly the two h0-battery legacy declarations, unhonoured', () => {
  const ev = loadEvidence(join(HERE, '..', '..'));
  const u = ev.unhonoured_supersessions;
  assert.equal(u.length, 2, `expected the two 2026-08-01 h0-battery declarations, got ${JSON.stringify(u)}`);
  for (const d of u) {
    // The locator uses the manifest's own `study` field, not the directory name: h0-battery's
    // manifests declare study '2026-07-h0-battery'.
    assert.equal(d.target, '2026-07-h0-battery/run-20260801T062824Z');
    assert.match(d.defect, /oracle phi was never threaded/);
  }
  // And the superseded run's cells ARE still present — the gap this reports is real, not latent.
  // 148 = endpoints.json's 144 plus the 4 additional cells/ entries the aggregate omitted
  // (scanCellsDirExtras); floor rather than an exact count, for the same append-only reason
  // golden-verdicts.test.mjs uses floors.
  const still = ev.cells.filter((c) => c.__run === 'run-20260801T062824Z');
  assert.ok(still.length >= 144, `the declared-defective cells are still scored; got ${still.length}`);
});

test('C1.6: an unrecognized supersedes shape is a crash, not a silently ignored field', () => {
  const root = supersedeFixture([
    ['coverage', 'run-new', { study: 'coverage', git_sha: 'b', supersedes: 'run-old' },
      { cells: [cell('d', 0)] }],
  ]);
  assert.throws(() => loadEvidence(root), /must be an array, a legacy/);
});
