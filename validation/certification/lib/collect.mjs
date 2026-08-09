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
// TWO SHAPES, ONE FIELD NAME, AND ONLY ONE OF THEM IS HONOURED IN A MANIFEST. `supersedes` is NOT
// a new field: h0-battery's run-20260801T064237Z and run-20260801T064627Z manifests have carried
// `supersedes: {priorRun, defect}` since 2026-08-01, declaring run-20260801T062824Z superseded
// for a named code defect (oracle phi never threaded into the detector config, so N3/N4 ran with
// AR(1) pre-whitening disabled). Nothing ever read it: all 148 of that run's cells
// (family_A_betting_e_process, family_A_mixture_supermartingale, family_C_safe_hotelling,
// family_D_spectral_e_detector, 37 each -- 144 from endpoints.json at 36 each, plus 4 that
// scanCellsDirExtras merges from cells/, one per detector) stayed in the pool alongside their own
// correction ever since.
//   - LEGACY OBJECT `{priorRun, defect}`: recognized, recorded as declared-but-not-honoured,
//     reported, NOT applied.
//   - ARRAY of `{study, run, detectors, reason}` (C1.6): applied.
//
// THAT GAP IS NOW CLOSED, AND NOT BY THE MANIFEST PATH. Corrected in place rather than deleted,
// because the reason it stayed open is the point. This block used to read: "That is a real gap, and
// it is REPORTED here rather than closed: honouring it could move four cards' verdicts, which is
// outside coverage Amendment v2.C1's registered scope and needs h0-battery's own pre-registration
// to authorize. See coverage Amendment v2.C1.1." That was true when written. h0-battery
// PREREGISTRATION.md **Amendment A1** (2026-08-08) is the authorization it was waiting for, and it
// closes the gap through a THIRD shape rather than by promoting the legacy object:
//   - PER-STUDY REGISTRY `<study>/results/live/SUPERSESSIONS.json`, an array of
//     `{study, run, detectors, reason, declared_by}` (C1.6's shape plus `declared_by`): applied.
// The legacy object is STILL not applied and still reported -- editing a superseded manifest to
// add an array would break the append-only guarantee that makes it citable, and a run cannot
// retroactively declare what it did not declare. A registry entry does not silence the legacy
// declaration it covers; the declaration keeps its report line and gains `covered_by_registry`.
//
// WHY A FILE AND NOT A RUN. Amendment A1 supersedes three runs, two of which no later run ever
// declared (run-20260801T062612Z is byte-identical to run-20260801T062824Z at the same sha and
// seed; run-20260801T064237Z is 24 defective mixture rows plus 124 cells byte-identical to the
// canonical run). There is no new run to carry the declaration and inventing one would be
// fabricating an artifact. The authority is a pre-registration amendment, so `declared_by` names
// the amendment.
//
// TWO RULES A REGISTRY NEEDS THAT A MANIFEST DOES NOT (Amendment A1, A1.7). The self-supersession
// check below compares a declaration's target against the DECLARING RUN's own locator, which is
// vacuous for a file that is not a run. Registered in its place, both fail-closed:
//   1. OWN-STUDY ONLY -- an entry's `study` must be one a run under this registry's own
//      results/live/ declares. A registry's authority is one study's pre-registration.
//   2. NO SELF-ERASURE -- for every (study, detector) a registry names, at least one run of that
//      study must survive un-superseded for that detector, AND CARRY AT LEAST ONE CELL FOR IT
//      (Amendment A2, quote-and-correct; A1.7 registered the clause without the second half and
//      that made the rule vacuously satisfiable -- see A2 and the comment on the check itself).
//      A registry that drops the replacement along with the defect is the failure the field exists
//      to prevent.
//
// A THIRD RULE, ON BOTH PATHS (Amendment A2). Every detector a supersedes entry names must appear in
// at least one cell of the TARGET RUN. Until A2 an unknown detector name -- a typo, a renamed
// detector, an alias the cells do not carry -- dropped nothing and reported nothing: the entry
// passed shape validation, the target existed, and `perDetector.get(ec.detector)` in pass 2 simply
// never matched. The declaration read as honoured and was inert. Fail closed instead.
//
// Every drop carries its `source` ('manifest' | 'registry') so REPORT.md can show provenance, and
// every drop and every unhonoured declaration is reported on the returned `runs` entry, so neither
// is ever silent.
export const SUPERSESSIONS_FILE = 'SUPERSESSIONS.json';

// Shape check shared by both paths, so the manifest array and the registry cannot drift into two
// different notions of a well-formed entry.
function assertEntryShape(d, where) {
  if (!d?.study || !d?.run || !Array.isArray(d.detectors) || d.detectors.length === 0 || !d.reason) {
    throw new Error(`${where}: each supersedes entry needs study, run, a non-empty `
      + 'detectors array, and a reason');
  }
}

// Amendment A2's named-detector rule, also shared by both paths, because an unknown name is equally
// inert whichever path declared it: manifest arrays and registries alike resolve a drop by exact
// string match on `cell.detector` in pass 2, so a name no cell carries drops nothing and reports
// nothing. Called AFTER each path's own target checks (self-supersession, own-study reach, corpus
// membership), so a wrong target keeps the error message that names the wrong target.
function assertDetectorsCarried(d, where, detectorsByRun) {
  const target = `${d.study}/${d.run}`;
  const carried = detectorsByRun.get(target) ?? new Set();
  for (const det of d.detectors) {
    if (carried.has(det)) continue;
    throw new Error(`${where}: supersedes entry names detector ${det} on target ${target}, which `
      + `appears in no cell of that run — ${target} carries `
      + `${[...carried].sort().join(', ') || '(no readable cells)'}`);
  }
}

// "study/run" -> the set of detector names that run's own cells carry, keyed on the same locator
// supersessionIndex builds. Three jobs: corpus membership is `has(target)`, Amendment A2's
// named-detector rule reads the set, and A2's strengthened no-self-erasure rule asks whether a
// candidate survivor measured the detector at all. Wide-format cells are expanded first, so a run
// whose evidence only names its detectors through the sui_/ui_ prefixes still resolves.
function detectorsByRunIndex(manifests) {
  const idx = new Map();
  for (const { studyName, runName, rawCells } of manifests) {
    const key = `${studyName}/${runName}`;
    const set = idx.get(key) ?? new Set();
    for (const c of rawCells ?? []) {
      for (const ec of expandWideCell(c) ?? []) if (ec.detector != null) set.add(ec.detector);
    }
    idx.set(key, set);
  }
  return idx;
}

function applyDrop(dropped, target, detectors, by, reason, source) {
  const perDetector = dropped.get(target) ?? new Map();
  for (const det of detectors) perDetector.set(det, { by, reason, source });
  dropped.set(target, perDetector);
}

function supersessionIndex(manifests, registries = []) {
  const dropped = new Map();      // "study/run" -> Map(detector -> {by, reason, source})
  const unhonoured = [];          // legacy declarations, reported not applied
  const detectorsByRun = detectorsByRunIndex(manifests);
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
      assertEntryShape(d, `${studyName}/${runName}`);
      const target = `${d.study}/${d.run}`;
      if (target === `${studyName}/${runName}`) {
        throw new Error(`${studyName}/${runName}: a run cannot supersede itself`);
      }
      // A declaration naming a run this scorer cannot see would silently supersede nothing, which
      // is exactly the failure mode the field exists to prevent. Fail closed.
      if (!detectorsByRun.has(target)) {
        throw new Error(`${studyName}/${runName}: manifest.supersedes names ${target}, which is not `
          + 'in the evidence corpus');
      }
      assertDetectorsCarried(d, `${studyName}/${runName}`, detectorsByRun);
      applyDrop(dropped, target, d.detectors, `${studyName}/${runName}`, d.reason, 'manifest');
    }
  }

  // Registries apply AFTER the manifests, so when both name the same (target, detector) the
  // registry's reason is the one reported. That ordering is deliberate: a registry is an
  // amendment-authorized statement about a run and a manifest declaration is a run's own, and the
  // amendment is the later and more specific artifact.
  for (const reg of registries) {
    if (!Array.isArray(reg.entries)) {
      throw new Error(`${reg.path}: a supersession registry must be an array of `
        + `{study, run, detectors, reason, declared_by} entries — got ${JSON.stringify(reg.entries)}`);
    }
    for (const d of reg.entries) {
      assertEntryShape(d, reg.path);
      if (!d.declared_by) {
        throw new Error(`${reg.path}: each registry entry needs declared_by — a registry has no `
          + 'declaring run, so the authorizing amendment must name itself');
      }
      if (!reg.studyNames.has(d.study)) {
        throw new Error(`${reg.path}: names study ${d.study}, which no run under ${reg.liveDir} `
          + `declares (this registry governs ${[...reg.studyNames].join(', ') || '(no study)'}) — a `
          + "registry's reach is the study whose pre-registration authorized it");
      }
      const target = `${d.study}/${d.run}`;
      if (!detectorsByRun.has(target)) {
        throw new Error(`${reg.path}: names ${target}, which is not in the evidence corpus`);
      }
      assertDetectorsCarried(d, reg.path, detectorsByRun);
      applyDrop(dropped, target, d.detectors, d.declared_by, d.reason, 'registry');
    }
  }

  // Rule 2, checked once every drop is in: a registry may not leave a detector with no scoring run
  // in the study it just superseded.
  //
  // AMENDMENT A2, QUOTE-AND-CORRECT. A1.7 registered the rule as "at least one run of that study
  // must survive un-superseded for that detector", and this loop used to implement exactly that:
  // `!dropped.get(key)?.has(det)`. Any run of the study that was not itself dropped for `det`
  // counted as the survivor -- INCLUDING a run that never measured `det` at all, for which the
  // predicate is trivially true. So the rule was vacuously satisfiable: a study with one run
  // carrying detector d and one run carrying nothing of d could drop the only run that measured d
  // and pass, leaving d with no evidence, which is the outcome the rule exists to forbid. Carrying
  // at least one cell for the detector is now part of surviving.
  for (const reg of registries) {
    for (const d of reg.entries) {
      const runsOfStudy = manifests.filter((m) => m.studyName === d.study);
      for (const det of d.detectors) {
        const survives = runsOfStudy.some((m) => {
          const key = `${m.studyName}/${m.runName}`;
          return detectorsByRun.get(key)?.has(det) && !dropped.get(key)?.has(det);
        });
        if (!survives) {
          throw new Error(`${reg.path}: superseding ${d.study}/${d.run} for ${det} leaves no run of `
            + `${d.study} scoring ${det} with cells for it — a registry may not drop the replacement `
            + 'along with the defect');
        }
      }
    }
  }

  // A legacy declaration a registry covers is annotated, never removed: the reader of a report
  // needs to see both that the 2026-08-01 declaration existed and that it is now acted on.
  for (const u of unhonoured) {
    const perDetector = dropped.get(u.target);
    if (perDetector && [...perDetector.values()].some((v) => v.source === 'registry')) {
      u.covered_by_registry = true;
    }
  }
  return { dropped, unhonoured };
}

export function loadEvidence(validationRoot) {
  const cells = [];
  const runs = [];
  // Pass 1: read every manifest first, so a supersession declared by a run that appears LATER in
  // directory order still applies to one that appears earlier. A study's SUPERSESSIONS.json
  // registry (Amendment A1) is read in the same pass and for the same reason -- it sits beside the
  // run directories, so it is discovered whenever the study is, whatever order readdir returns.
  const manifests = [];
  const registries = [];
  for (const study of readdirSync(validationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const live = join(validationRoot, study.name, 'results', 'live');
    if (!existsSync(live)) continue;
    const studyNames = new Set();
    for (const run of readdirSync(live, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(live, run.name);
      const mPath = join(dir, 'manifest.json');
      const manifest = existsSync(mPath) ? readJson(mPath) : { study: study.name, git_sha: null };
      const studyName = manifest.study ?? study.name;
      studyNames.add(studyName);
      // Cells are read HERE, in pass 1, and carried on the entry so pass 2 re-reads nothing.
      // Amendment A2's two rules ask what detectors a run's cells carry, and both are checked
      // before any cell is emitted, so the read has to happen before the index is built. `null`
      // (unsupported layout) is preserved as null and still reported by pass 2, unchanged.
      manifests.push({ dir, runName: run.name, studyName, manifest, rawCells: loadRunCells(dir) });
    }
    // The registry names studies by the value the runs' own manifests carry (h0-battery's runs
    // declare study '2026-07-h0-battery', not the directory name), which is the same locator
    // supersessionIndex builds -- hence studyNames, collected from the manifests just read.
    const regPath = join(live, SUPERSESSIONS_FILE);
    if (existsSync(regPath)) registries.push({ path: regPath, liveDir: live, studyNames, entries: readJson(regPath) });
  }
  const { dropped, unhonoured } = supersessionIndex(manifests, registries);

  // Pass 2: emit cells, skipping the declared (study, run, detector) rows.
  for (const { dir, runName, studyName, manifest, rawCells } of manifests) {
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
          else superseded.push({ detector: ec.detector, cells: 1, superseded_by: drop.by, reason: drop.reason, source: drop.source });
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
