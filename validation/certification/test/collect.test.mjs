import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEvidence, cellsFor, derivePhiParams } from '../lib/collect.mjs';

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
  assert.equal(ev.cells.length, 10);
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
  assert.equal(skippedLines.length, 1);
  assert.ok(skippedLines[0].includes(join('mystery-study', 'results', 'live', 'run-x')));
  assert.ok(!ev.runs.some((r) => r.study === 'mystery-study'));
});
