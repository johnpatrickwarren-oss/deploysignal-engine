// validation/e-detector-cert/analysis/report.mjs — renders REPORT.md from summary.json + manifest.json.
// Pure: the harness and analysis/check_report.mjs both call it, so the report can never drift
// from its data (the runway test_report_consistency mechanism).
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
const f3 = (x) => f(x, 3);

export function render(summary, manifest) {
  const cells = summary.cells;
  const s2 = cells.filter((c) => 'arl0_T' in c);
  const s3 = cells.filter((c) => 'delay_canonical' in c);
  const L = [];
  L.push(`# REPORT — 2026-09-e-detector-cert, run ${manifest.run}`);
  L.push('');
  L.push(`Engine \`${manifest.git_sha}\`, N = ${manifest.n} per cell, alpha_arl = ${manifest.alpha_arl}, S2 T = ${manifest.T_s2}, S3 nu = ${manifest.nu}, T = ${manifest.T_s3}. Wall ${manifest.wall_seconds} s. Exceptions ${cells.reduce((a, c) => a + c.exceptions, 0)}.`);
  L.push('');
  L.push('The verdict is the certification script\'s (`npm run cert:verdict`), not this file\'s. The tokens below are the harness\'s own reading of the registered rules (PREREGISTRATION §2) and the scorer recomputes every one of them from the fields; a disagreement voids the run.');
  L.push('');
  L.push('## S2 — T-censored ARL under H0 (rule: arl0_T − 1.645·se ≥ 1/alpha_arl clears; arl0_T + 1.645·se < 1/alpha_arl refutes)');
  L.push('');
  L.push('| null | params | phi | m | p_alarm_T | arl0_T | se | lower95 | 1/alpha | token |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of s2) L.push(`| ${c.null_id} | ${c.params} | ${c.phi} | ${c.m ?? '—'} | ${f3(c.p_alarm_T)} | ${f(c.arl0_T)} | ${f(c.arl0_se)} | ${f(c.arl0_lower95)} | ${1 / c.alpha_arl} | ${c.verdict} |`);
  L.push('');
  L.push('## S3 — K1 step at onset nu (rule (a): detection_rate at 3σ ≥ 0.10; rule (b): delay_canonical + 1.645·se ≤ D*(alpha_arl, delta_eff) at 1.5σ)');
  L.push('');
  L.push('| null | shift | delta_eff | p_pre | n_cond | detection | delay | se | upper95 | median | p90 | censored | D* | token |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of s3) L.push(`| ${c.null_id} | ${c.shift_sigma} | ${f3(c.delta_eff)} | ${f3(c.p_pre_onset_alarm)} | ${c.n_conditional} | ${f3(c.detection_rate)} | ${f(c.delay_canonical)} | ${f(c.delay_se, 2)} | ${f(c.delay_upper95)} | ${c.delay_median ?? '—'} | ${c.delay_p90 ?? '—'} | ${f3(c.censored)} | ${c.canonical ? f(c.delay_bound_registered) : '—'} | ${c.verdict} |`);
  L.push('');
  const inClass = (c) => /^N[12347](-|$)/.test(c.null_id);
  const s2In = s2.filter(inClass), s2Out = s2.filter((c) => !inClass(c));
  const canon = s3.filter((c) => c.canonical), three = s3.filter((c) => c.shift_sigma === 3);
  L.push('## Against the registered predictions (§4)');
  L.push('');
  L.push(`- S2 in-class cells: ${s2In.filter((c) => c.verdict === 'not-refuted').length} of ${s2In.length} clear; tokens ${s2In.map((c) => `${c.null_id}:${c.verdict}`).join(', ')}.`);
  L.push(`- S2 outside the class: ${s2Out.map((c) => `${c.null_id}:${c.verdict} (arl0_T ${f(c.arl0_T)})`).join(', ')}.`);
  L.push(`- S3 rule (a): ${three.filter((c) => c.detection_rate >= 0.10).length} of ${three.length} cells powered at 3σ (min detection ${f3(Math.min(...three.map((c) => c.detection_rate)))}).`);
  L.push(`- S3 rule (b): ${canon.filter((c) => c.verdict === 'WITHIN_BOUND').length} of ${canon.length} canonical cells under D*; ${canon.map((c) => `${c.null_id} ${f(c.delay_upper95)} vs ${f(c.delay_bound_registered)}`).join('; ')}.`);
  L.push('');
  return L.join('\n') + '\n';
}
