// validation/arl-delay/analysis/report.mjs — renders REPORT.md for one run directory from its
// JSON, deterministically (harness-discipline rule 4: the artifact names its input, never the
// wall clock). check_report.mjs re-renders and diffs; a hand edit to REPORT.md fails it.
//
//   node validation/arl-delay/analysis/report.mjs <run-dir>            writes <run-dir>/REPORT.md
//   node validation/arl-delay/analysis/report.mjs <run-dir> --stdout   prints instead

import fs from 'node:fs';
import path from 'node:path';

export function render(runDir) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8'));
  const m = J('manifest.json'), arl = J('arl.json'), delay = J('delay.json'), g = J('gates.json');
  const f4 = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(4));
  const f1 = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(1));
  const int = (x) => (x === null || x === undefined ? '—' : String(x));
  const L = [];
  L.push(`# 2026-09-arl-delay — run ${path.basename(runDir)}`, '');
  L.push(`Engine \`${m.engine_version}\` at \`${m.git_sha}\`; node ${m.node}; mode ${m.mode}${m.quick ? ' (QUICK, unscored)' : ''}${m.partial ? ` (PARTIAL: ${m.partial.only})` : ''}.`);
  L.push(`Registration sha256 \`${m.registration.sha256.slice(0, 12)}\`; harness sha256 \`${m.harness_sha256.slice(0, 12)}\`.`);
  L.push(`N = ${m.n}; arm A T = ${m.T_arl}; arm B T = ${m.T_delay}, ν = ${m.nu}; α scored ${m.alphas_scored.join(', ')}; α = ${m.alpha_shipped} descriptive.`, '');
  L.push('The two endpoints carry no verdict authority (Amendment v1.C66, C66.3). The gates below are instrument checks (G1, G2) and one construction prediction (G3).', '');

  L.push('## Gates', '');
  L.push(`- **G1 (instrument reproduces the battery): ${g.G1.verdict}** — ${g.G1.n_fail} of ${g.G1.n_cells} cells outside 3 pooled se; ${g.G1.n_exact} of ${g.G1.n_cells} exact count matches.`);
  const g1bad = g.G1.cells.filter((c) => !c.pass);
  for (const c of g1bad) L.push(`  - FAIL ${c.detector_id} ${c.null_id} α=${c.alpha}: fires_300=${c.fires_300} battery=${c.battery_fires} (${c.battery_run}) diff=${c.diff} tol=${f1(c.tol)}`);
  const g1inexact = g.G1.cells.filter((c) => c.pass && !c.exact);
  if (g1inexact.length) L.push(`  - inexact but within tolerance (behavioural drift since the battery ran, unscored): ${g1inexact.map((c) => `${c.detector_id}/${c.null_id}/α${c.alpha} ${c.fires_300} vs ${c.battery_fires}`).join('; ')}`);
  L.push(`- **G2 (delay executability, N1, α = 0.05, class-own injection):**`);
  for (const p of g.G2.pairs) L.push(`  - ${p.detector_id} @ ${p.injection}: p_detect = ${f4(p.p_detect)} → ${p.executable ? 'EXECUTABLE' : 'NOT-EXECUTABLE (delay cells for this pair are not quoted)'}`);
  L.push(`- **G3 (Ville extends to T = ${m.T_arl}): ${g.G3.verdict}** — ${g.G3.n_fail} of ${g.G3.n_cells} cells above α + 3 se.`);
  for (const c of g.G3.cells) L.push(`  - ${c.pass ? 'pass' : 'FAIL'} ${c.detector_id} ${c.null_id} α=${c.alpha}: p_alarm_T = ${f4(c.p_alarm_T)} (bound ${f4(c.bound)})`);
  L.push('');

  L.push(`## Arm A — ARL₀ (T-censored, T = ${m.T_arl})`, '');
  L.push('| detector | null | α | p_alarm_300 | p_alarm_T | arl0_T | median N* | exc |', '|---|---|---|---|---|---|---|---|');
  for (const c of arl) L.push(`| ${c.detector_id} | ${c.null_id} | ${c.alpha} | ${f4(c.p_alarm_300)} | ${f4(c.p_alarm_T)} | ${f1(c.arl0_T)} | ${c.median_run_length ?? c.median_run_length_note} | ${c.exceptions}${c.not_executable ? ' NOT-EXECUTABLE' : ''} |`);
  L.push('');

  L.push(`## Arm B — detection delay (ν = ${m.nu}, T = ${m.T_delay}, delay censored at ${m.T_delay - m.nu})`, '');
  const notExec = new Set(g.G2.pairs.filter((p) => !p.executable).map((p) => `${p.detector_id}|${p.injection}`));
  L.push('| detector | injection | null | α | p_pre_onset_alarm | p_detect | delay mean (cens.) | median | p90 | censored | exc |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of delay) {
    const ne = notExec.has(`${c.detector_id}|${c.injection}`) && c.class_own;
    L.push(`| ${c.detector_id} | ${c.injection}${c.class_own ? '' : ' (cross-class)'} | ${c.null_id} | ${c.alpha} | ${f4(c.p_pre_onset_alarm)} | ${ne ? 'NOT-EXECUTABLE' : f4(c.p_detect)} | ${ne ? '—' : f1(c.delay_mean_censored)} | ${ne ? '—' : int(c.delay_median ?? `> ${m.T_delay - m.nu}`)} | ${ne ? '—' : int(c.delay_p90 ?? `> ${m.T_delay - m.nu}`)} | ${c.censored} | ${c.exceptions}${c.not_executable ? ' NOT-EXECUTABLE' : ''} |`);
  }
  L.push('');
  L.push('## Not measured', '');
  L.push(`- NOT DEFINED (terminal class, no run length): ${m.not_defined.join(', ')}.`);
  L.push(`- MISSING (no battery adapter): ${m.missing_no_adapter.join(', ')}.`);
  for (const o of m.out_of_scope_inherited) L.push(`  - ${o.id}: ${o.reason}`);
  L.push('- T1 only; one onset ν; Lorden/Pollak worst-case delays not estimated; α = 1e-4 cells cannot resolve 1/α = 10,000 at T = 3,000.');
  L.push('', `Wall time ${m.wall_seconds}s.`);
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const runDir = path.resolve(process.argv[2]);
  const out = render(runDir);
  if (process.argv.includes('--stdout')) process.stdout.write(out);
  else { fs.writeFileSync(path.join(runDir, 'REPORT.md'), out); console.log(`wrote ${path.join(runDir, 'REPORT.md')}`); }
}
