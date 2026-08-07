import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEvidence, cellsFor } from '../lib/collect.mjs';

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

  return root;
}

test('loads dict-shaped and array-shaped summaries, annotates study/run/tier', () => {
  const ev = loadEvidence(fixture());
  assert.equal(ev.cells.length, 6);
  const cs = ev.cells.find((c) => c.__study === 'clustersynth-ui');
  assert.equal(cs.__tier, 'T2');
  assert.equal(ev.cells.find((c) => c.__run === 'seq-1').__tier, 'T1');
});

test('cellsFor matches on detector_id and aliases', () => {
  const ev = loadEvidence(fixture());
  const card = { detector_id: 'family_A_betting_e_process', aliases: ['betting_e_process'] };
  assert.equal(cellsFor(ev, card).length, 3); // seq cell + h0-battery endpoints cell by id, power cell by alias
});

test('loads endpoints.json (dict-shaped) when summary.json is absent, preferring it over cells/', () => {
  const ev = loadEvidence(fixture());
  const h0Cells = ev.cells.filter((c) => c.__study === '2026-07-h0-battery');
  assert.equal(h0Cells.length, 1); // not 2 -- endpoints.json wins over the redundant cells/ dir
  assert.equal(h0Cells[0].__run, 'run-1');
  assert.equal(h0Cells[0].__git_sha, 'ccc');
  assert.equal(h0Cells[0].alpha, 0.05);
});

test('loads one cell per file from cells/ when neither summary.json nor endpoints.json exists', () => {
  const ev = loadEvidence(fixture());
  const tevCells = ev.cells.filter((c) => c.__study === '2026-08-terminal-evalue');
  assert.equal(tevCells.length, 2);
  assert.ok(tevCells.every((c) => c.detector === 'safe_t'));
  assert.ok(tevCells.every((c) => c.__git_sha === 'ddd'));
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
