// validation/e-by-dependence/analysis/report.mjs — renders REPORT.md from cells.json + manifest.json.
// Pure; the harness and check_report.mjs both call it so the report cannot drift from its data.
const f = (x, d = 4) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
const sum = (cells, k) => cells.reduce((a, c) => a + c[k], 0);
export function render(cells, manifest) {
  const L = [];
  L.push(`# REPORT — 2026-09-e-by-dependence, run ${manifest.run}`);
  L.push('');
  L.push(`Engine \`${manifest.git_sha}\`, N = ${manifest.n} per cell, K = ${manifest.K}, L = ${manifest.L} shifted, T = ${manifest.T}, detector alpha ${manifest.alpha_detector}, deltas ${manifest.deltas.join('/')}, laws ${manifest.laws.map((l) => `${l.law} (σ² ${l.sigma_squared})`).join(', ')}. Wall ${manifest.wall_seconds} s. Exceptions ${sum(cells, 'exceptions')}. Closed-form re-inversion deviations > 1e-12: ${sum(cells, 'reinversion_deviations')}. Width-ratio deviations > 1e-9: ${sum(cells, 'p3_deviations')}. Level-free inputs disagreeing with the shipped surface's half-width > 1e-12: ${sum(cells, 'surface_deviations')}. Vacuous cells (p_empty = 1): ${cells.filter((c) => c.vacuous).length}.`);
  L.push('');
  L.push('## Cells (P1 bar: fcr_eBY ≤ δ + 3·se in every non-vacuous cell at every δ)');
  L.push('');
  L.push('| law | ρ | δ_shift | rule | τ | mean |S| | δ | fcr e-BY | se | bar | P1 | fcr naive | se | width ratio (P3) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) for (const d of c.per_delta) {
    L.push(`| ${c.law} | ${c.rho} | ${c.delta_shift} | ${c.rule} | ${c.tau} | ${f(c.mean_selected, 2)} | ${d.delta} | ${f(d.fcr_eby)} | ${f(d.fcr_eby_se)} | ${f(d.delta + 3 * d.fcr_eby_se)} | ${c.vacuous ? 'VACUOUS' : d.p1} | ${f(d.fcr_naive)} | ${f(d.fcr_naive_se)} | ${f(d.width_ratio_mean, 3)} |`);
  }
  L.push('');
  const scored = cells.filter((c) => !c.vacuous).flatMap((c) => c.per_delta);
  const p1 = scored.every((d) => d.p1 === 'HELD');
  const p2cells = cells.filter((c) => c.law === 'coupled' && c.rule === 'C' && c.delta_shift === 0);
  const p2 = p2cells.some((c) => c.per_delta.find((d) => d.delta === 0.05)?.fcr_naive > 0.05);
  const worst = scored.reduce((w, d) => (d.fcr_eby / d.delta > w.fcr_eby / w.delta ? d : w), scored[0]);
  const worstCell = cells.find((c) => c.per_delta.includes(worst));
  L.push('## Endpoints');
  L.push('');
  L.push(`- **P1 e-BY controls FCR under every law:** ${p1 ? 'HELD' : 'FAILED'} (${scored.filter((d) => d.p1 === 'HELD').length} of ${scored.length} non-vacuous cell×δ bars; largest fcr_eBY/δ ${f(worst.fcr_eby / worst.delta, 3)} at ${worstCell.law} ρ = ${worstCell.rho}, δ_shift = ${worstCell.delta_shift}, rule ${worstCell.rule}, τ = ${worstCell.tau}, δ = ${worst.delta}).`);
  L.push(`- **P2 naive intervals fail under law (c) with rule C at δ = 0.05, δ_shift = 0:** ${p2 ? 'HELD' : 'FAILED'} (registered prediction FAILED; ${p2cells.map((c) => `ρ = ${c.rho}: naive ${f(c.per_delta.find((d) => d.delta === 0.05)?.fcr_naive)}`).join('; ')}).`);
  L.push(`- **P3 width ratio is the closed form:** ${sum(cells, 'p3_deviations') === 0 ? 'HELD' : 'FAILED'} (deviations above 1e-9: ${sum(cells, 'p3_deviations')}); mean ratios in the table.`);
  L.push(`- **P4 re-inversion closed form:** ${sum(cells, 'reinversion_deviations') === 0 ? 'HELD' : 'FAILED'} (deviations above 1e-12: ${sum(cells, 'reinversion_deviations')}).`);
  L.push('');
  L.push('## O1 — did dependence move the FCR? (registered observation, no bar; e-BY FCR per law, laws paired by common random numbers)');
  L.push('');
  const laws = manifest.laws.map((l) => l.law);
  L.push(`| ρ | δ_shift | rule | τ | δ | ${laws.join(' | ')} |`);
  L.push(`|---|---|---|---|---|${laws.map(() => '---').join('|')}|`);
  const ind = cells.filter((c) => c.law === 'independent');
  for (const c0 of ind) for (const d0 of c0.per_delta) {
    const row = laws.map((law) => {
      const c = cells.find((x) => x.law === law && x.rho === c0.rho && x.delta_shift === c0.delta_shift && x.rule === c0.rule && x.tau === c0.tau);
      return f(c.per_delta.find((d) => d.delta === d0.delta).fcr_eby);
    });
    L.push(`| ${c0.rho} | ${c0.delta_shift} | ${c0.rule} | ${c0.tau} | ${d0.delta} | ${row.join(' | ')} |`);
  }
  L.push('');
  return L.join('\n') + '\n';
}
