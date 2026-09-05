// validation/e-sr-bounded/analysis/report.mjs — renders REPORT.md from summary.json + comparison.json +
// manifest.json; pure, shared with check_report.mjs.
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : Number(x).toFixed(d));

export function render(summary, comparison, m) {
  const s2 = summary.cells.filter((c) => 'arl0_T' in c), s3 = summary.cells.filter((c) => 'delay_canonical' in c);
  const { G0, H1, H2, H3, H4 } = comparison;
  const L = [`# 2026-09-e-sr-bounded — run ${m.run}`, '',
    `Engine at \`${m.git_sha}\`; mode ${m.mode}${m.quick ? ' (QUICK, unscored)' : ''}; tier ${m.tier}. Harness sha256 \`${m.harness_sha256.slice(0, 12)}\`, module \`${m.module_sha256.slice(0, 12)}\`, scorer constants \`${m.scorer_constants_sha256.slice(0, 12)}\`. N = ${m.n} (S2: ${m.n_s2}, Amendment A1); α_ARL = ${m.alpha_arl}; S2 T = ${m.T_s2}; S3 ν = ${m.nu}, T = ${m.T_s3}; bounded grid ±{${m.bounded_grid.filter((l) => l > 0).join(', ')}}, clip 3. Exceptions: ${m.exceptions}.`, '',
    '## Verdicts', '',
    `- **G0 instrument:** ${G0.verdict} — default unchanged ${G0.default_unchanged}; bounded recursion vs the SR sum, max |log error| ${G0.recursion_max_abs_log_error.toExponential(1)}.`,
    `- **H1 ARL ≥ 1/α_ARL on all thirteen nulls, heavy tails included (the ship gate):** ${H1.verdict} — ` + H1.cells.map((c) => `${c.null_id} ${f(c.arl0_T)} (lower95 ${f(c.arl0_lower95)}, ${c.token})`).join('; ') + '.',
    `- **H2 delay price at the K1 canonical on N1 (reported):** bounded ${f(H2.cells[0].delay_mean)} ± ${f(H2.cells[0].delay_se, 2)} vs gaussian ${f(H2.cells[1].delay_mean)} ± ${f(H2.cells[1].delay_se, 2)}; ratio ${f(H2.ratio, 2)} (predicted ${f(H2.predicted_ratio, 2)}); both under their bounds (${f(H2.cells[0].bound_registered)} / ${f(H2.cells[1].bound_registered)}): ${H2.both_under_bound}.`,
    `- **H3 increment estimator:** ${H3.verdict} — worst |z| outside N5 ${f(H3.worst_z_outside_n5, 2)}; N5 against the derived offset: ${H3.n5_verdict} (worst |z| ${f(H3.worst_z_n5_vs_offset, 2)}); mean M_20 on ±0.1 = ${f(H3.mean_M_20, 2)} (band [${H3.band.join(', ')}]).`,
    `- **H4 estimation price:** ${H4.verdict} — arl0_T at N2-m30 ${f(H4.arl0_m30)} vs the Gaussian e-SR's recorded ${H4.reference_gaussian}; identical-draws Gaussian on the same cell ${f(H4.comparators.find((c) => c.null_id === 'N2-m30').arl0_T)}.`, '',
    '## S2 — ARL₀ (T-censored), all in regime; the Gaussian e-SR on identical draws beside it (A1.2, unpooled)', '',
    '| null | params | φ | m | arl0_T | se | lower95 | p_alarm_T | median N* | token | gaussian arl0_T | ratio |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of s2) { const g = H4.comparators.find((x) => x.null_id === c.null_id); L.push(`| ${c.null_id} | ${c.params} | ${c.phi} | ${c.m ?? '—'} | ${f(c.arl0_T)} | ${f(c.arl0_se)} | ${f(c.arl0_lower95)} | ${f(c.p_alarm_T, 4)} | ${c.median_run_length ?? `> ${c.T}`} | ${c.verdict} | ${f(g.arl0_T)} ± ${f(g.arl0_se)} | ${f(g.ratio_bounded_over_gaussian, 2)} |`); }
  L.push('', '## S3 — K1 step delay (ν = 200), all in regime, bounded D*', '',
    '| null | shift | canonical | δ_eff | p_pre | detection | delay | se | upper95 | median | p90 | censored | D* bounded | token |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of s3) L.push(`| ${c.null_id} | ${c.severity} | ${c.canonical} | ${f(c.delta_eff, 3)} | ${f(c.p_pre_onset_alarm, 4)} | ${f(c.detection_rate, 3)} | ${f(c.delay_canonical)} | ${f(c.delay_se, 2)} | ${f(c.delay_upper95)} | ${c.delay_median ?? '—'} | ${c.delay_p90 ?? '—'} | ${f(c.censored, 4)} | ${f(c.delay_bound_registered)} | ${c.verdict} |`);
  L.push('', '## H3 — the increment estimator per λ (mean g, N × T pairs)', '', '| null | ' + H3.cells.filter((c) => c.null_id === 'N1').map((c) => `λ=${c.lambda}`).join(' | ') + ' |', '|---|' + H3.cells.filter((c) => c.null_id === 'N1').map(() => '---').join('|') + '|');
  for (const id of [...new Set(H3.cells.map((c) => c.null_id))]) L.push(`| ${id} | ` + H3.cells.filter((c) => c.null_id === id).map((c) => `${c.mean_g.toFixed(5)} (z ${f(c.z, 1)})`).join(' | ') + ' |');
  L.push('', 'H3 z is against 1 on every null except N5, where it is against the derived `1 + λ·(−0.0093)` (PREREGISTRATION §2, §4); se across trajectories (Amendment A1.3).', '');
  return L.join('\n') + '\n';
}
