// validation/nab/time-to-alert/analysis/report.mjs — renders REPORT.md for one run directory from its
// JSON, deterministically (the artifact names its input, never the wall clock). check_report.mjs
// re-renders and diffs; a hand edit to REPORT.md fails it. Every number is tier T3.
import fs from 'node:fs';
import path from 'node:path';

const f = (x, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : Number(x).toFixed(d));
const i0 = (x) => (x === null || x === undefined ? '—' : String(x));
const short = (rel) => rel.replace(/^real/, '').replace('.csv', '');

function header(m) {
  return [
    `Engine \`${m.engine_version}\` at \`${m.engine_sha}\`; NAB at \`${m.nab_sha}\`; node ${m.node}; mode ${m.mode}. Registration sha256 \`${m.registration_sha256.slice(0, 12)}\`; harness sha256 \`${m.harness_sha256.slice(0, 12)}\`.`,
    `${m.n_traces} scored traces (registered ${m.registered_traces}) from ${m.sub_benchmarks.join(' + ')}; probationary fraction ${m.probationary_fraction}; the tool's default calibration (\`${m.calibration_signal}\`, pre-whitening on, innovation σ²); α scored ${m.alphas_scored.join(', ')} for the two Ville cards, the compiled config's own level descriptive; e-SR at α_ARL = ${m.alpha_arl}. Exceptions: ${m.exceptions}.`,
    '',
    '**Tier T3 on every number below** (real telemetry, the traces that score). ARL₀ and delay are REPORTED endpoints with no verdict authority (protocol Amendment v1.C66); the falsifier-2 reading is the one registered reading (PREREGISTRATION §4).',
  ];
}

function cellRows(cells) {
  const L = ['| detector | α | pre | in | late | none | P1 strict | P1 by end | not by end | **falsifier 2** | P2 median in (ticks) | P2 median in (h) | P2 censored mean (ticks) | P2b median from point | P3 pre/N | P3 per 1,000 quiet | P4 median onset err | P4 inside window |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of cells) L.push(`| ${c.detector} | ${c.alpha}${c.scored ? '' : ' (descriptive)'} | ${c.n_pre} | ${c.n_in} | ${c.n_late} | ${c.n_none} | ${f(c.p1_strict)} | ${f(c.p1_by_end)} | ${c.not_by_end} of ${c.n} | **${c.falsifier_2_fires ? 'FIRES' : 'does not fire'}** | ${i0(c.p2_median_ticks_in)} | ${f(c.p2_median_hours_in, 1)} | ${f(c.p2_censored_mean_ticks, 1)} | ${i0(c.p2b_median_from_point_in)} | ${f(c.p3_pre_fraction)} | ${f(c.p3_per_1000_quiet, 2)} | ${i0(c.p4_median_onset_error)} | ${f(c.p4_inside_window)} |`);
  return L;
}

function traceRows(traces, rows) {
  const L = ['| trace | n | cadence | nProb | window | point | φ̂ | σ̂ (innov.) | window shift, marginal σ | whitened | mixture 0.05 | mixture 0.01 | betting 0.05 | betting 0.01 | e-SR 1e-3 (onset est.) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const cell = (tr, det, alpha) => { const r = rows.find((x) => x.trace === tr.trace && x.detector === det && x.alpha === alpha); return r ? `${r.class}${r.delay_ticks === null ? '' : ` (${r.delay_ticks >= 0 ? '+' : ''}${r.delay_ticks})`}${r.onset_estimate !== null ? ` [${r.onset_error >= 0 ? '+' : ''}${r.onset_error}]` : ''}` : '—'; };
  for (const tr of traces) L.push(`| ${short(tr.trace)} | ${tr.n} | ${tr.cadence_min} min | ${tr.n_prob} | ${tr.start}–${tr.end} | ${i0(tr.point)} | ${f(tr.phi)} | ${f(tr.sigma)} | ${f(tr.window_shift_marginal, 2)} | ${f(tr.window_shift_whitened, 2)} | ${cell(tr, 'family_A_mixture_supermartingale', 0.05)} | ${cell(tr, 'family_A_mixture_supermartingale', 0.01)} | ${cell(tr, 'family_A_betting_e_process', 0.05)} | ${cell(tr, 'family_A_betting_e_process', 0.01)} | ${cell(tr, 'e_sr_mean_shift', 0.001)} |`);
  return L;
}

export function render(runDir) {
  const J = (n) => JSON.parse(fs.readFileSync(path.join(runDir, n), 'utf8'));
  const m = J('manifest.json'), cells = J('cells.json'), traces = J('traces.json'), rows = J('rows.json');
  const L = [`# 2026-09-nab-time-to-alert — run ${path.basename(runDir)}`, '', ...header(m), '',
    '## Endpoints per detector and α (T3)', '', ...cellRows(cells), '',
    'Classes: `pre` = first alert on the labelled-quiet stretch before the window; `in` = inside the window; `late` = after its end; `none` = no alert by the trace end. P2 medians are over `in` traces; the censored mean is over `in ∪ late ∪ none` with the delay censored at the window length. P2b is `t* − point` on `in` traces (negative = before NAB\'s own label). P3 counts `pre` traces; the quiet stretch is unlabelled real data, not a certified null. P4 is the e-SR onset estimate minus the window start on the traces where it alerted.', '',
    '## Per trace (T3)', '', ...traceRows(traces, rows), '',
    'Class (delay in ticks from the window start) [e-SR: onset estimate minus window start]. "Window shift" is the window mean minus the probationary mean, in marginal σ and in whitened units `(1 − φ̂)/σ̂_innovation` — the size of the event to a whitened detector.', ''];
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPathSafe(import.meta.url)) {
  const runDir = path.resolve(process.argv[2]);
  const out = render(runDir);
  if (process.argv.includes('--stdout')) process.stdout.write(out); else fs.writeFileSync(path.join(runDir, 'REPORT.md'), out);
}
function fileURLToPathSafe(u) { return new URL(u).pathname; }
