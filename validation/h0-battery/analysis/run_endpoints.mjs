// analysis/run_endpoints.mjs — the ONLY script that reads results (§10).
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIVE = path.join(STUDY, 'results', 'live');
const runs = fs.existsSync(LIVE) ? fs.readdirSync(LIVE).filter((d) => d.startsWith('run-')).sort() : [];
if (!runs.length) { console.error('no live run'); process.exit(1); }
const run = runs[runs.length - 1];
const dir = path.join(LIVE, run);
const cells = fs.readdirSync(path.join(dir, 'cells')).map(
  (f) => JSON.parse(fs.readFileSync(path.join(dir, 'cells', f), 'utf8')));
for (const c of cells) if (c.mode !== 'live') { console.error(`refusing: ${c.detector} mode=${c.mode}`); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const nullCells = cells.filter((c) => c.null_id);
const p2cells = cells.filter((c) => c.detection_rate !== undefined);
const scored = nullCells.filter((c) => c.scored);
const byDet = {};
for (const c of scored) (byDet[c.detector] ??= []).push(c);
const out = { run, registration_sha: manifest.registration_sha, engine_version: manifest.engine_version,
  cells: nullCells, P1: Object.entries(byDet).map(([d, cs]) => ({ detector: d,
    failed_cells: cs.filter((c) => c.verdict === 'FAIL').map((c) => `${c.null_id}@${c.alpha}`),
    verdict: cs.some((c) => c.verdict === 'FAIL') ? 'FAIL' : 'not-refuted' })),
  out_of_scope: manifest.out_of_scope };
out.P2 = p2cells.map((c) => ({ detector: c.detector, detection_rate: c.detection_rate, verdict: c.verdict }));
fs.writeFileSync(path.join(dir, 'endpoints.json'), JSON.stringify(out, null, 2));

// ---- REPORT.md, generated from endpoints.json. The ONLY report path (§10).
const L = [];
L.push('# REPORT — H0 battery: do the detectors produce e-values?');
L.push('');
L.push(`Run: \`${run}\`  ·  engine \`${out.engine_version}\`  ·  registration sha ${out.registration_sha}`);
L.push('');
L.push('**Verdict wording is fixed by PREREGISTRATION §2.** A detector that survives a null is');
L.push('"not refuted at these nulls". It is NOT evidence that the detector is an e-value.');
L.push('');
L.push('## P1 — false-alarm rate against nominal');
L.push('');
for (const r of out.P1) {
  L.push(`P1: detector=${r.detector} verdict=${r.verdict} failed_cells=${r.failed_cells.length}`);
}
L.push('');
L.push('## P2 — vacuous-pass guard (3 sigma step, detect within 200 ticks)');
L.push('');
for (const r of out.P2) {
  L.push(`P2: detector=${r.detector} detection_rate=${r.detection_rate.toFixed(4)} verdict=${r.verdict}`);
}
L.push('');
L.push('## Secondary endpoints (§6) — subordinate, no verdict');
L.push('');
const meanBy = (f) => { const v = nullCells.filter(f); return v.reduce((a, c) => a + c.mean_logM, 0) / v.length; };
L.push(`S1: mean_logM_under_N1=${meanBy((c) => c.null_id === 'N1' && c.alpha === 0.05).toFixed(4)} ` +
       `mean_logM_all_nulls=${meanBy((c) => c.alpha === 0.05).toFixed(4)} ` +
       `note=heavy-tailed, descriptive only per PREREGISTRATION §6`);
const shipped = nullCells.filter((c) => !c.scored);
L.push(`S2: shipped_alpha=1e-4 cells=${shipped.length} ` +
       `max_rate=${Math.max(...shipped.map((c) => c.fire_rate)).toFixed(4)} ` +
       `note=measured, scored by no endpoint per PREREGISTRATION §4`);
L.push('S3: not_measured_in_this_run=true note=threshold-vs-1/alpha ratio requires compiled configs, ' +
       'which this harness does not read; measured separately 2026-07-31 at median 2.4e4 and 3.6e76');
L.push('S4: not_measured_in_this_run=true note=integrated autocorrelation time of the per-tick ' +
       'increment was not instrumented in this harness');
L.push('');
L.push('## Cells');
L.push('');
for (const c of cells.filter((x) => x.null_id).sort((a, b) =>
  a.detector.localeCompare(b.detector) || a.null_id.localeCompare(b.null_id) || a.alpha - b.alpha)) {
  L.push(`${c.detector} ${c.null_id} alpha=${c.alpha} rate=${c.fire_rate.toFixed(4)} ` +
         `lower95=${c.lower_95.toFixed(4)} verdict=${c.verdict}${c.scored ? '' : ' (descriptive)'}`);
}
L.push('');
L.push('## Out of scope (PREREGISTRATION §8.4 — named, not silently passed)');
L.push('');
for (const o of out.out_of_scope) L.push(`- **${o.id}** — ${o.reason}`);
L.push('');
fs.writeFileSync(path.join(STUDY, 'REPORT.md'), L.join('\n'));
console.log(`endpoints.json + REPORT.md written for ${run}: ${scored.length} scored cells`);
