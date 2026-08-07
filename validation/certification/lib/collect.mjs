import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tierOfStudy } from './constants.mjs';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// A run directory's cells can live in one of three supported layouts, checked in
// this order so a study that emits more than one of them isn't double-counted:
//   1. summary.json     -- {cells: [...]} or a bare array of cells
//   2. endpoints.json    -- same two shapes as summary.json (h0-battery)
//   3. cells/*.json      -- one cell per file, no aggregate manifest (terminal-evalue)
// Returns null when none apply, so the caller can report the run as skipped
// instead of silently dropping its evidence.
function loadRunCells(dir) {
  const summaryPath = join(dir, 'summary.json');
  if (existsSync(summaryPath)) {
    const summary = readJson(summaryPath);
    return Array.isArray(summary) ? summary : (summary.cells ?? []);
  }
  const endpointsPath = join(dir, 'endpoints.json');
  if (existsSync(endpointsPath)) {
    const endpoints = readJson(endpointsPath);
    return Array.isArray(endpoints) ? endpoints : (endpoints.cells ?? []);
  }
  const cellsDir = join(dir, 'cells');
  if (existsSync(cellsDir) && statSync(cellsDir).isDirectory()) {
    return readdirSync(cellsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson(join(cellsDir, f)));
  }
  return null;
}

export function loadEvidence(validationRoot) {
  const cells = [];
  const runs = [];
  for (const study of readdirSync(validationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const live = join(validationRoot, study.name, 'results', 'live');
    if (!existsSync(live)) continue;
    for (const run of readdirSync(live, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(live, run.name);
      const mPath = join(dir, 'manifest.json');
      const manifest = existsSync(mPath) ? readJson(mPath) : { study: study.name, git_sha: null };
      const rawCells = loadRunCells(dir);
      if (rawCells === null) {
        process.stderr.write(`skipped: ${dir}\n`);
        continue;
      }
      const studyName = manifest.study ?? study.name;
      const gitSha = manifest.git_sha ?? null;
      runs.push({ study: studyName, run: run.name, git_sha: gitSha });
      for (const c of rawCells) {
        cells.push({ ...c, __study: studyName, __run: run.name, __git_sha: gitSha, __tier: tierOfStudy(studyName) });
      }
    }
  }
  return { cells, runs };
}

export function cellsFor(evidence, card) {
  const ids = new Set([card.detector_id, ...(card.aliases ?? [])]);
  return evidence.cells.filter((c) => ids.has(c.detector));
}
