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

// PREREGISTRATION.md (coverage) Amendment v2.C1, C1.6 -- supersession, declared by the run doing
// the superseding.
//
// WHY THIS EXISTS. results/ is append-only (house rule 6): a rerun for a named code defect
// (house rule 7) preserves the prior directory byte-for-byte. But loadEvidence pools every
// directory under validation/*/results/live/ with no cross-run dedup, so the prior run's rows keep
// being scored alongside the rows that correct them. Concretely: coverage's C1 defect made
// shape_block_conformal_bet's S3 arm read detection_rate 1.0000 against a rank-1 lattice
// reference, and the corrected rerun reads 0.0005. With both rows in the pool, overallVerdict's
// s3Powered set (lib/score.mjs) stays non-empty and the card stays USE -- the rerun would change
// nothing, and the defect would survive its own fix.
//
// WHY THE NEW RUN DECLARES IT, NOT THE OLD ONE. Editing the superseded manifest would break the
// append-only guarantee that makes the prior artifact citable at all. So the DECLARING run carries
// the field, the superseded directory is never touched, and the exclusion is derived from a
// registered manifest field rather than hardcoded in the scorer.
//
// GRANULARITY IS (study, run, detector), NOT (study, run). coverage/run-20260808T010208Z holds
// family_E_conformal_heldout rows that DO calibrate on the defective substrate alongside
// safe_t/universal_inference/group_average_e_value/family_D rows that take no held-out calibration
// and are bit-identical under the fix. Dropping the whole directory would delete four classes'
// worth of sound evidence in order to correct one detector's rows.
//
// TWO SHAPES, ONE FIELD NAME, AND ONLY ONE OF THEM IS HONOURED. `supersedes` is NOT a new field:
// h0-battery's run-20260801T064237Z and run-20260801T064627Z manifests have carried
// `supersedes: {priorRun, defect}` since 2026-08-01, declaring run-20260801T062824Z superseded
// for a named code defect (oracle phi never threaded into the detector config, so N3/N4 ran with
// AR(1) pre-whitening disabled). Nothing ever read it: all 144 of that run's cells
// (family_A_betting_e_process, family_A_mixture_supermartingale, family_C_safe_hotelling,
// family_D_spectral_e_detector, 36 each) have been scored alongside their own correction ever
// since. That is a real gap, and it is REPORTED here rather than closed: honouring it could move
// four cards' verdicts, which is outside coverage Amendment v2.C1's registered scope and needs
// h0-battery's own pre-registration to authorize. See coverage Amendment v2.C1.1.
//   - LEGACY OBJECT `{priorRun, defect}`: recognized, recorded as declared-but-not-honoured,
//     reported, NOT applied.
//   - ARRAY of `{study, run, detectors, reason}` (C1.6): applied.
// Every drop and every unhonoured declaration is reported on the returned `runs` entry, so
// neither is ever silent.
function supersessionIndex(manifests) {
  const dropped = new Map();      // "study/run" -> Map(detector -> {by, reason})
  const unhonoured = [];          // legacy declarations, reported not applied
  for (const { studyName, runName, manifest } of manifests) {
    const decls = manifest.supersedes;
    if (decls == null) continue;
    if (!Array.isArray(decls)) {
      if (typeof decls === 'object' && typeof decls.priorRun === 'string') {
        unhonoured.push({
          declared_by: `${studyName}/${runName}`,
          target: `${studyName}/${decls.priorRun}`,
          defect: decls.defect ?? '(no defect stated)',
        });
        continue;
      }
      throw new Error(`${studyName}/${runName}: manifest.supersedes must be an array, a legacy `
        + `{priorRun, defect} object, or null — got ${JSON.stringify(decls)}`);
    }
    for (const d of decls) {
      if (!d?.study || !d?.run || !Array.isArray(d.detectors) || d.detectors.length === 0 || !d.reason) {
        throw new Error(`${studyName}/${runName}: each supersedes entry needs study, run, a non-empty `
          + 'detectors array, and a reason');
      }
      const target = `${d.study}/${d.run}`;
      if (target === `${studyName}/${runName}`) {
        throw new Error(`${studyName}/${runName}: a run cannot supersede itself`);
      }
      // A declaration naming a run this scorer cannot see would silently supersede nothing, which
      // is exactly the failure mode the field exists to prevent. Fail closed.
      if (!manifests.some((m) => `${m.studyName}/${m.runName}` === target)) {
        throw new Error(`${studyName}/${runName}: manifest.supersedes names ${target}, which is not `
          + 'in the evidence corpus');
      }
      const perDetector = dropped.get(target) ?? new Map();
      for (const det of d.detectors) perDetector.set(det, { by: `${studyName}/${runName}`, reason: d.reason });
      dropped.set(target, perDetector);
    }
  }
  return { dropped, unhonoured };
}

export function loadEvidence(validationRoot) {
  const cells = [];
  const runs = [];
  // Pass 1: read every manifest first, so a supersession declared by a run that appears LATER in
  // directory order still applies to one that appears earlier.
  const manifests = [];
  for (const study of readdirSync(validationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const live = join(validationRoot, study.name, 'results', 'live');
    if (!existsSync(live)) continue;
    for (const run of readdirSync(live, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(live, run.name);
      const mPath = join(dir, 'manifest.json');
      const manifest = existsSync(mPath) ? readJson(mPath) : { study: study.name, git_sha: null };
      manifests.push({ dir, runName: run.name, studyName: manifest.study ?? study.name, manifest });
    }
  }
  const { dropped, unhonoured } = supersessionIndex(manifests);

  // Pass 2: load cells, skipping the declared (study, run, detector) rows.
  for (const { dir, runName, studyName, manifest } of manifests) {
    const rawCells = loadRunCells(dir);
    if (rawCells === null) {
      process.stderr.write(`skipped: ${dir}\n`);
      continue;
    }
    const gitSha = manifest.git_sha ?? null;
    const tier = tierOfStudy(studyName, manifest.tier ?? null);
    const perDetector = dropped.get(`${studyName}/${runName}`) ?? null;
    const superseded = [];
    const entry = { study: studyName, run: runName, git_sha: gitSha, tier };
    runs.push(entry);
    for (const c of rawCells) {
      const expanded = expandWideCell(c);
      if (expanded === null) {
        process.stderr.write(`skipped: ${dir} (unrecognized cell shape, no detector/sui_/ui_ fields)\n`);
        continue;
      }
      for (const ec of expanded) {
        const drop = perDetector?.get(ec.detector);
        if (drop) {
          const already = superseded.find((s) => s.detector === ec.detector);
          if (already) already.cells += 1;
          else superseded.push({ detector: ec.detector, cells: 1, superseded_by: drop.by, reason: drop.reason });
          continue;
        }
        cells.push(annotatePhi({ ...ec, __study: studyName, __run: runName, __git_sha: gitSha, __tier: tier }));
      }
    }
    if (superseded.length) entry.superseded = superseded;
  }
  return { cells, runs, unhonoured_supersessions: unhonoured };
}

export function cellsFor(evidence, card) {
  const ids = new Set([card.detector_id, ...(card.aliases ?? [])]);
  return evidence.cells.filter((c) => ids.has(c.detector));
}
