// validation/e-sr-mean-shift/analysis/report.mjs — renders REPORT.md for one run directory from
// its JSON, deterministically (no wall clock). check_report.mjs re-renders and diffs.
//   node validation/e-sr-mean-shift/analysis/report.mjs <run-dir> [--stdout]
import fs from 'node:fs';
import path from 'node:path';

export function render(runDir) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8'));
  const m = J('manifest.json'), h1 = J('h1.json'), h2 = J('h2.json'), h3 = J('h3.json'), h4 = J('h4.json'), h5 = J('h5.json');
  const f4 = (x) => (x == null ? '—' : Number(x).toFixed(4)), f1 = (x) => (x == null ? '—' : Number(x).toFixed(1)), f2 = (x) => (x == null ? '—' : Number(x).toFixed(2));
  const L = [];
  L.push(`# 2026-09-e-sr-delay — run ${path.basename(runDir)}`, '');
  L.push(`Engine \`${m.engine_version}\` at \`${m.git_sha}\`; node ${m.node}; mode ${m.mode}${m.quick ? ' (QUICK, unscored)' : ''}. N = ${m.n}.`);
  L.push(`Registration sha256 \`${m.registration.sha256.slice(0, 12)}\` (with Amendment A1); module sha256 \`${m.module.sha256.slice(0, 12)}\`; harness sha256 \`${m.harness_sha256.slice(0, 12)}\`.`, '');
  L.push(`**Verdicts:** H1 ${h1.verdict} · H2 ${h2.verdict} · H3 ${h3.verdict} · H4 ${h4.verdict} · H5 ${h5.verdict}`, '');
  L.push('## H1 — ARL at oracle parameters (claimed cells)', '', '| null | α_ARL | T | p_alarm_T | arl0_T | 1/α | median N* | verdict |', '|---|---|---|---|---|---|---|---|');
  for (const c of h1.cells) L.push(`| ${c.null_id} | ${c.alpha} | ${c.T} | ${f4(c.p_alarm_T)} | ${f1(c.arl0_T)} | ${1 / c.alpha} | ${c.median_run_length ?? '> T'} | ${c.pass ? 'pass' : 'FAIL'} |`);
  L.push('', 'Reported (no claim: N5/N6 outside the sub-Gaussian class; α = 1e-4 censored at T = 20,000):', '', '| null | α | T | p_alarm_T | arl0_T | median N* |', '|---|---|---|---|---|---|');
  for (const c of h1.reported) L.push(`| ${c.null_id} | ${c.alpha} | ${c.T} | ${f4(c.p_alarm_T)} | ${f1(c.arl0_T)} | ${c.median_run_length ?? '> T'} |`);
  L.push('', '## H2 — delay against the onset time (N1, +1.5σ, censored at 800)', '', '| detector | ν | α | p_pre_onset_alarm | p_detect | delay mean | median | p90 |', '|---|---|---|---|---|---|---|---|');
  for (const c of h2.cells) L.push(`| ${c.detector_id} | ${c.nu} | ${c.alpha} | ${f4(c.p_pre_onset_alarm)} | ${f4(c.p_detect)} | ${f1(c.delay_mean_censored)} | ${c.delay_median} | ${c.delay_p90} |`);
  L.push('', `- (a) e-SR at ν = 2,000 (${f1(h2.a.esr_nu2000)}) ≤ 1.5 × e-SR at ν = 200 (${f1(h2.a.esr_nu200)}): ${h2.a.pass ? 'pass' : 'FAIL'}`);
  L.push(`- (b) e-SR at ν = 2,000 (${f1(h2.b.esr_nu2000)}) ≤ 0.5 × mixture at ν = 2,000 (${f1(h2.b.mixture_nu2000)}): ${h2.b.pass ? 'pass' : 'FAIL'}`);
  L.push('', '## H3 — delay at canonical against the Theorem 4.3 bound (N1, ν = 200, α_ARL = 1e-3)', '', '| δ | p_pre_onset_alarm | p_detect | delay mean | median | p90 | g_α | bound | verdict |', '|---|---|---|---|---|---|---|---|---|');
  for (const c of h3.cells) L.push(`| ${c.delta}σ | ${f4(c.p_pre_onset_alarm)} | ${f4(c.p_detect)} | ${f1(c.delay_mean_censored)} | ${c.delay_median} | ${c.delay_p90} | ${f2(c.g_alpha)} | ${f1(c.bound)} | ${c.pass ? 'pass' : 'FAIL'} |`);
  L.push('', '## H4 — the estimation price (α_ARL = 1e-3, T = 20,000)', '', '| null | p_alarm_T | arl0_T | median N* |', '|---|---|---|---|');
  for (const c of h4.cells) L.push(`| ${c.null_id} | ${f4(c.p_alarm_T)} | ${f1(c.arl0_T)} | ${c.median_run_length ?? '> T'} |`);
  L.push('', `- (a) monotone in m: ${h4.a.pass ? 'pass' : 'FAIL'}; (b) arl0 at m = 30 (${f1(h4.b.arl0_m30)}) < 1,000: ${h4.b.pass ? 'pass' : 'FAIL'}`);
  L.push('', '## H5 — structural (Amendment A1)', '', `- H5a increment estimator per λ over ${h5.a.n_pairs} (trajectory, tick) pairs: ${h5.a.verdict}`, '', '| λ | mean L | se | |mean−1|/se |', '|---|---|---|---|');
  for (const c of h5.a.cells) L.push(`| ${f4(c.lambda)} | ${c.mean_L.toFixed(5)} | ${c.se.toExponential(2)} | ${f2(Math.abs(c.mean_L - 1) / c.se)} |`);
  L.push('', `- H5b mean M_20 on λ = ±0.25: ${f2(h5.b.mean_M_20)} (band [16, 24], must exceed 5): ${h5.b.pass ? 'pass' : 'FAIL'}`);
  L.push(`- Reported, unmeasurable: full-grid trajectory mean of M_1000 = ${f1(h5.full_grid_mean_M_1000.mean)} against an expectation of 1000 (the terminal-mean trap).`);
  L.push('', `Wall time ${m.wall_seconds}s.`);
  return L.join('\n') + '\n';
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const runDir = path.resolve(process.argv[2]); const out = render(runDir);
  if (process.argv.includes('--stdout')) process.stdout.write(out); else { fs.writeFileSync(path.join(runDir, 'REPORT.md'), out); console.log(`wrote ${path.join(runDir, 'REPORT.md')}`); }
}
