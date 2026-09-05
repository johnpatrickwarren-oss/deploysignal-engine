// validation/sequencing/analysis/report.mjs — renders REPORT.md from cells.json + manifest.json.
// Pure; the harness and check_report.mjs both call it so the report cannot drift from its data.
const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
const NAMES = { mix: 'O_mix (mixture crossing)', bet: 'O_bet (betting crossing)', sr: 'O_sr (e-SR onset estimate)', srx: 'O_srx (e-SR crossing, reported)' };
export function render(cells, manifest) {
  const L = [];
  L.push(`# REPORT — 2026-09-sequencing (engine substrate), run ${manifest.run}`);
  L.push('');
  L.push(`Engine \`${manifest.git_sha}\`, N = ${manifest.n} per cell, K = ${manifest.K}, ν₀ = ${manifest.nu0}, censor ${manifest.censor} ticks after the last onset, F ∈ {${manifest.fs.join(', ')}}, δ ∈ {${manifest.deltas.join(', ')}} σ, g ∈ {${manifest.gaps.join(', ')}}, per-run α ${manifest.alpha_run} (mixture, betting), α_ARL ${manifest.alpha_arl} (e-SR), null ${manifest.null_id}. Wall ${manifest.wall_seconds} s. Exceptions ${cells.reduce((a, c) => a + c.exceptions, 0)}.`);
  L.push('');
  L.push('## Cells (E1: A − 3·se > 0.5; E2 at g = 50: A ≥ 0.8; E4: Φ ≤ 0.02 for mix and bet)');
  L.push('');
  L.push('| F | δ | g | ordering | A | se | E1 | E2 | Φ false seq. | se | E4 | p_detect | delay mean | delay sd | crossed before onset | uncrossed pairs | onset err | within ±g/2 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) for (const o of c.per_ordering) {
    L.push(`| ${c.F} | ${c.delta} | ${c.g} | ${o.ordering} | ${f(o.A)} | ${f(o.A_se, 4)} | ${o.e1} | ${o.e2 ?? '—'} | ${f(o.phi, 4)} | ${f(o.phi_se, 4)} | ${o.e4 ?? '—'} | ${f(o.p_detect)} | ${f(o.delay_mean, 1)} | ${f(o.delay_sd, 1)} | ${f(o.pre_onset_frac)} | ${f(o.uncrossed_pair_frac)} | ${f(o.onset_err_mean, 1)} | ${f(o.onset_within_half_gap)} |`);
  }
  L.push('');
  L.push('## E3 — the e-SR onset estimate against the crossings (paired per replication; bar at g = 5, δ = 1.5)');
  L.push('');
  L.push('| F | δ | g | A_sr − A_mix | se | A_sr − A_bet | se | E3 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.F} | ${c.delta} | ${c.g} | ${f(c.e3.sr_minus_mix)} | ${f(c.e3.sr_minus_mix_se, 4)} | ${f(c.e3.sr_minus_bet)} | ${f(c.e3.sr_minus_bet_se, 4)} | ${c.e3.verdict ?? '—'} |`);
  L.push('');
  const scored = cells.flatMap((c) => c.per_ordering.filter((o) => o.ordering !== 'srx'));
  const e1 = scored.filter((o) => o.e1 !== 'NOT-SCORED');
  const e2 = cells.filter((c) => c.g === 50).flatMap((c) => c.per_ordering.filter((o) => o.ordering !== 'srx' && o.e2 !== 'NOT-SCORED'));
  const e3 = cells.filter((c) => c.e3.verdict);
  const e4 = cells.flatMap((c) => c.per_ordering.filter((o) => o.e4));
  const anyBeats = scored.some((o) => o.e1 === 'HELD');
  L.push('## Endpoints');
  L.push('');
  L.push(`- **E1 better than chance:** ${e1.every((o) => o.e1 === 'HELD') ? 'HELD' : 'FAILED'} (${e1.filter((o) => o.e1 === 'HELD').length} of ${e1.length} scored cell×ordering bars; ${scored.length - e1.length} not scored for p_detect < 0.5).`);
  L.push(`- **E2 floor 0.8 at g = 50:** ${e2.every((o) => o.e2 === 'HELD') ? 'HELD' : 'FAILED'} (${e2.filter((o) => o.e2 === 'HELD').length} of ${e2.length}; smallest A ${f(Math.min(...e2.map((o) => o.A)))}).`);
  L.push(`- **E3 e-SR onset estimate beats both crossings at g = 5, δ = 1.5:** ${e3.every((c) => c.e3.verdict === 'HELD') ? 'HELD' : 'FAILED'} (${e3.map((c) => `F = ${c.F}: sr − mix ${f(c.e3.sr_minus_mix)}, sr − bet ${f(c.e3.sr_minus_bet)}`).join('; ')}).`);
  L.push(`- **E4 false sequencing ≤ 0.02 for mix and bet:** ${e4.every((o) => o.e4 === 'HELD') ? 'HELD' : 'FAILED'} (largest Φ ${f(Math.max(...e4.map((o) => o.phi)), 4)}); Φ_sr ranges ${f(Math.min(...cells.map((c) => c.per_ordering.find((o) => o.ordering === 'sr').phi)))}–${f(Math.max(...cells.map((c) => c.per_ordering.find((o) => o.ordering === 'sr').phi)))}.`);
  L.push(`- **Falsifier 3 (fires only if no ordering beats chance in any cell):** ${anyBeats ? 'DID NOT FIRE' : 'FIRED'}.`);
  L.push('');
  L.push('Ordering names: ' + Object.entries(NAMES).map(([k, v]) => `${k} = ${v}`).join('; ') + '.');
  L.push('');
  return L.join('\n') + '\n';
}
