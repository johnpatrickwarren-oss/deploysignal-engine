// validation/drift-saturation/analysis/report.mjs — renders REPORT.md for one run directory from its JSON,
// deterministically. check_report.mjs re-renders and diffs. Every number is tier T1.
import fs from 'node:fs';
import path from 'node:path';
const f = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : Number(x).toFixed(d));
const i0 = (x) => (x === null || x === undefined ? '—' : String(x));
export function render(runDir) {
  const J = (n) => JSON.parse(fs.readFileSync(path.join(runDir, n), 'utf8'));
  const m = J('manifest.json'), cells = J('cells.json'), p3 = J('p3.json'), p4 = J('p4.json');
  const L = [];
  L.push(`# REPORT — 2026-09-drift-saturation (C78), run ${m.run}`);
  L.push('');
  L.push(`Engine \`${m.engine_version}\` at \`${m.engine_sha}\`; node ${m.node}; mode ${m.mode}${m.quick ? ' (quick, never scored)' : ''}. Registration sha256 \`${m.registration_sha256.slice(0, 12)}\`; harness sha256 \`${m.harness_sha256.slice(0, 12)}\`; nulls sha256 \`${m.nulls_sha256.slice(0, 12)}\`. N = ${m.n} per cell, seed ${m.seed}; m = ${m.m}, ν = ${m.nu}, post = ${m.post}; capacity ${m.capacity}σ, κ = ${m.kappa}, ${m.steps} steps, latency step ${m.delta_latency}σ; shapes ${m.shapes.join(', ')}; horizons ${m.horizons.join(', ')}; nulls ${m.nulls.join(', ')}; α ${m.alphas.join(', ')}; α_ARL ${m.alpha_arls.join(', ')}; monitor α_cal ${m.alpha_cal} ('bounded'); K5 instrument window ${m.k5_len}, e ≥ ${m.k5_threshold}. Bounded e-SR: **${m.bounded_esr}**. Exceptions: ${m.exceptions}.`);
  L.push('');
  L.push('**Tier T1 on every number below** (house synthetic nulls, oracle parameters). P1\'s bar is the coverage matrix\'s 0.50 floor read on the unconditional fraction; nothing here ships (PREREGISTRATION §6).');
  L.push('');
  const ic = m.instrument_check;
  L.push(`Instrument check (§4): ${ic.ok ? 'passed' : 'FAILED'} — 3σ step fires at ${Object.entries(ic.step_fires).map(([k, v]) => `${k} ${v}`).join(', ')}; clean at 10⁻⁴: ${Object.entries(ic.clean_quiet).map(([k, v]) => `${k} ${v === -1 ? 'quiet' : v}`).join(', ')}.`);
  L.push('');
  L.push('## P1 / P2 — alerting before saturation and lead time, per cell (rate signal)');
  L.push('');
  L.push('| cell | construction | level | baseline alerts | before S | after S | never | **P1** | bar | P1c | abstained | P1g | lead median | lead/H | censored mean | monitor revoked before S | monitor offset median |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.cell} | ${c.construction} | ${c.level} | ${c.n_baseline_alert} | ${c.n_before_saturation} | ${c.n_after_saturation} | ${c.n_never} | **${f(c.p1)}** | **${c.p1_bar}** | ${f(c.p1c)} | ${c.n_abstained} | ${f(c.p1g)} | ${i0(c.lead_median)} | ${f(c.lead_over_H_median, 2)} | ${f(c.lead_censored_mean, 0)} | ${f(c.monitor_revoked_before_S, 2)} | ${i0(c.monitor_revocation_offset_median)} |`);
  L.push('');
  L.push('## P2 — the latency comparator (K1 step of 1.5σ at S on the latency signal)');
  L.push('');
  L.push('| cell | construction | level | latency alerts in [S, T) | latency alerts before S | latency delay median | both alerted | lead over latency alarm, median |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const c of cells) L.push(`| ${c.cell} | ${c.construction} | ${c.level} | ${c.n_latency_in_post} | ${c.n_latency_before_S} | ${i0(c.latency_delay_median)} | ${c.n_both} | ${i0(c.lead_over_latency_median)} |`);
  L.push('');
  L.push('## P3 — false alerts on the baseline [m, ν) against the contract, pooled per null');
  L.push('');
  L.push('| null | construction | level | contract | pooled N | alerting | bar | **P3** | per 1,000 baseline ticks |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const p of p3) L.push(`| ${p.null} | ${p.construction} | ${p.level} | ${p.contract} | ${p.n_pool} | ${p.alerting} | ${p.bar} | **${p.p3}** | ${f(p.rate_per_1000, 2)} |`);
  L.push('');
  L.push('## P4 — the K5 instrument (safe-t on cal [0, m) vs [ν, ν + 200), e ≥ 20)');
  L.push('');
  L.push('| cell | fraction e ≥ 20 |');
  L.push('|---|---|');
  for (const p of p4) L.push(`| ${p.cell} | ${f(p.k5_fraction)} |`);
  L.push('');
  L.push('## P1 bar summary (cells HELD of 12, per construction and level)');
  L.push('');
  const keys = [...new Set(cells.map((c) => `${c.construction}@${c.level}`))];
  for (const k of keys) { const cs = cells.filter((c) => `${c.construction}@${c.level}` === k); L.push(`- ${k}: ${cs.filter((c) => c.p1_bar === 'HELD').length} of ${cs.length} HELD; canonical (linear-H2000-N1) P1 ${f(cs.find((c) => c.cell === 'linear-H2000-N1')?.p1)}`); }
  L.push('');
  return L.join('\n') + '\n';
}
