// validation/e-by-fcr/analysis/report.mjs — renders REPORT.md from cells.json + manifest.json. Pure;
// the harness and check_report.mjs both call it so the report cannot drift from its data.
const f = (x, d = 4) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
export function render(cells, manifest) {
  const L = [];
  L.push(`# REPORT — 2026-09-e-by-fcr, run ${manifest.run}`);
  L.push('');
  L.push(`Engine \`${manifest.git_sha}\`, N = ${manifest.n} per cell, K = ${manifest.K}, L = ${manifest.L} shifted, T = ${manifest.T}, detector alpha ${manifest.alpha_detector}, deltas ${manifest.deltas.join('/')}. Wall ${manifest.wall_seconds} s. Exceptions ${cells.reduce((a, c) => a + c.exceptions, 0)}. Closed-form re-inversion deviations > 1e-12: ${cells.reduce((a, c) => a + c.reinversion_deviations, 0)}.`);
  L.push('');
  L.push('## Cells (P1 bar: fcr_eBY ≤ δ + 3·se in every cell at every δ)');
  L.push('');
  L.push('| ρ | δ_shift | rule | τ | mean |S| | δ | fcr e-BY | se | bar | P1 | fcr naive | se | width ratio (P3) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) for (const d of c.per_delta) {
    L.push(`| ${c.rho} | ${c.delta_shift} | ${c.rule} | ${c.tau} | ${f(c.mean_selected, 2)} | ${d.delta} | ${f(d.fcr_eby)} | ${f(d.fcr_eby_se)} | ${f(d.delta + 3 * d.fcr_eby_se)} | ${d.p1} | ${f(d.fcr_naive)} | ${f(d.fcr_naive_se)} | ${f(d.width_ratio_mean, 3)} |`);
  }
  L.push('');
  const all = cells.flatMap((c) => c.per_delta);
  const p1 = all.every((d) => d.p1 === 'HELD');
  const p2cells = cells.filter((c) => c.rule === 'B' && c.delta_shift === 0);
  const p2 = p2cells.some((c) => c.per_delta.find((d) => d.delta === 0.05)?.fcr_naive > 0.05);
  L.push('## Endpoints');
  L.push('');
  L.push(`- **P1 e-BY controls FCR:** ${p1 ? 'HELD' : 'FAILED'} (${all.filter((d) => d.p1 === 'HELD').length} of ${all.length} cell×δ bars; largest fcr_eBY/δ ${f(Math.max(...all.map((d) => d.fcr_eby / d.delta)), 3)}).`);
  L.push(`- **P2 naive intervals fail under extremeness selection at δ = 0.05, δ_shift = 0:** ${p2 ? 'HELD' : 'FAILED'} (${p2cells.map((c) => `ρ = ${c.rho}, τ = ${c.tau}: naive ${f(c.per_delta.find((d) => d.delta === 0.05)?.fcr_naive)}`).join('; ')}).`);
  L.push(`- **P3 re-inversion closed form:** ${cells.every((c) => c.reinversion_deviations === 0) ? 'HELD' : 'FAILED'} (deviations above 1e-12: ${cells.reduce((a, c) => a + c.reinversion_deviations, 0)}); width ratios reported in the table.`);
  L.push(`- **P4 both rules inside P1:** ${p1 ? 'HELD' : 'FAILED'} by construction of P1's cell set.`);
  L.push('');
  return L.join('\n') + '\n';
}
