import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tierOfStudy } from './constants.mjs';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Identity tuple for deduping a cell loaded from an aggregate (summary.json/endpoints.json)
// against the same cell re-encountered while scanning cells/. Two cells are the same
// evidence iff they agree on all five of these; anything in cells/ that doesn't match
// an already-seen tuple is additional evidence the aggregate omitted.
const identityKey = (c) => JSON.stringify([c.detector, c.null_id ?? null, c.control ?? null, c.shift_sigma ?? null, c.alpha ?? null]);

// Scans a cells/ directory for cells not already covered by `seenKeys` (mutated in place
// as extras are found, so repeat files/entries within cells/ itself also dedupe). A file may
// hold a single cell object or an array of cells (e.g. P2.json). Entries without a 'detector'
// field are diagnostics (bundle dumps, etc.), not evidence, and are ignored.
function scanCellsDirExtras(cellsDir, seenKeys) {
  const extras = [];
  if (!existsSync(cellsDir) || !statSync(cellsDir).isDirectory()) return extras;
  for (const f of readdirSync(cellsDir)) {
    if (!f.endsWith('.json')) continue;
    const content = readJson(join(cellsDir, f));
    const entries = Array.isArray(content) ? content : [content];
    for (const c of entries) {
      if (!('detector' in c)) continue;
      const key = identityKey(c);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      extras.push(c);
    }
  }
  return extras;
}

// A run directory's cells can live in one of three supported layouts:
//   1. summary.json     -- {cells: [...]} or a bare array of cells
//   2. endpoints.json    -- same two shapes as summary.json (h0-battery)
//   3. cells/*.json      -- one cell per file, no aggregate manifest (terminal-evalue)
// When an aggregate (1 or 2) exists, cells/ is still scanned for evidence the aggregate
// omitted -- real h0-battery and family-ce-nulls runs carry P2-style power cells in cells/
// that never made it into endpoints.json/summary.json -- and merged in via the identity-tuple
// dedup above, so the aggregate's own cells are never duplicated.
// Returns null when none apply, so the caller can report the run as skipped
// instead of silently dropping its evidence.
function loadRunCells(dir) {
  const summaryPath = join(dir, 'summary.json');
  const endpointsPath = join(dir, 'endpoints.json');
  const cellsDir = join(dir, 'cells');

  let aggregateCells = null;
  if (existsSync(summaryPath)) {
    const summary = readJson(summaryPath);
    aggregateCells = Array.isArray(summary) ? summary : (summary.cells ?? []);
  } else if (existsSync(endpointsPath)) {
    const endpoints = readJson(endpointsPath);
    aggregateCells = Array.isArray(endpoints) ? endpoints : (endpoints.cells ?? []);
  }

  if (aggregateCells !== null) {
    const seenKeys = new Set(aggregateCells.map(identityKey));
    const extras = scanCellsDirExtras(cellsDir, seenKeys);
    return [...aggregateCells, ...extras];
  }

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
