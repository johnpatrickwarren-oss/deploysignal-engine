import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tierOfStudy } from './constants.mjs';
import { derivePhiParams } from './nulls.mjs';

export { derivePhiParams };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// C2 -- annotate a loaded cell with the phi/params its null_id mechanically encodes.
// A RECORDED value always wins: detector-audit-sequential carries a measured `phi` and its
// own `params` tag, and this must not overwrite either. `phi_source` is derived even when
// phi is recorded, so the known-phi regime test in lib/score.mjs reads one uniform field
// across studies. A cell whose null_id is outside the registered grammar is left alone,
// with no phi -- that is the fail-closed case the scorer refuses.
function annotatePhi(cell) {
  const d = derivePhiParams(cell.null_id);
  if (!d) return cell;
  const out = { ...cell };
  if (out.phi == null) {
    out.phi = d.phi;
    out.phi_derived_from = 'null_id grammar (h0-battery/harness/nulls.mjs)';
  }
  out.phi_source = d.phi_source;
  if (out.params == null) out.params = d.params;
  return out;
}

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

// Wide-format adapter (Task 4) -- unlocks T2 evidence for sequential_ui_e_process and
// universal_inference_e_value. clustersynth-ui's summary.json cells fold both detectors'
// evidence into one row, no top-level `detector`: {arm, counter, n_sui, n_ui, sui_crossing,
// sui_stopped_mean, sui_verdict, ui_exceedance, ui_mean_e, ui_verdict, ...}. `sui_` fields
// become a sequential_ui_e_process cell, `ui_` fields a universal_inference_e_value cell;
// fields with neither prefix (arm, counter, n_sui, n_ui, ...) are copied onto each. Most
// prefixed fields are a plain strip (sui_stopped_mean -> stopped_mean, ui_exceedance ->
// exceedance); sui_crossing is the one recorded exception, renamed to crossing_rate since
// the value is a rate, not a boolean.
const WIDE_PREFIXES = [
  { prefix: 'sui_', detector: 'sequential_ui_e_process', renames: { sui_crossing: 'crossing_rate' } },
  { prefix: 'ui_', detector: 'universal_inference_e_value', renames: {} },
];

// Splits a wide-format cell (no top-level `detector`) into one cell per recognized
// prefix present. Returns null when neither prefix is found, so the caller can report
// the cell as skipped instead of silently dropping it or mis-tagging it as evidence.
// A cell that already carries `detector` is returned as a single-element array, untouched.
function expandWideCell(cell) {
  if ('detector' in cell) return [cell];

  const shared = {};
  for (const k of Object.keys(cell)) {
    if (!WIDE_PREFIXES.some(({ prefix }) => k.startsWith(prefix))) shared[k] = cell[k];
  }

  const out = [];
  for (const { prefix, detector, renames } of WIDE_PREFIXES) {
    const fields = {};
    let found = false;
    for (const [k, v] of Object.entries(cell)) {
      if (!k.startsWith(prefix)) continue;
      found = true;
      fields[renames[k] ?? k.slice(prefix.length)] = v;
    }
    if (found) out.push({ ...shared, detector, ...fields });
  }
  return out.length ? out : null;
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
      const tier = tierOfStudy(studyName, manifest.tier ?? null);
      runs.push({ study: studyName, run: run.name, git_sha: gitSha, tier });
      for (const c of rawCells) {
        const expanded = expandWideCell(c);
        if (expanded === null) {
          process.stderr.write(`skipped: ${dir} (unrecognized cell shape, no detector/sui_/ui_ fields)\n`);
          continue;
        }
        for (const ec of expanded) {
          cells.push(annotatePhi({ ...ec, __study: studyName, __run: run.name, __git_sha: gitSha, __tier: tier }));
        }
      }
    }
  }
  return { cells, runs };
}

export function cellsFor(evidence, card) {
  const ids = new Set([card.detector_id, ...(card.aliases ?? [])]);
  return evidence.cells.filter((c) => ids.has(c.detector));
}
