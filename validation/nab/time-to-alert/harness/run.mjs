// validation/nab/time-to-alert/harness/run.mjs — the registered harness for 2026-09-nab-time-to-alert
// (PREREGISTRATION.md §2–§6). Deterministic: no randomness anywhere. No catch: a throw aborts the run
// and the partial directory is kept unscored.
//
//   node validation/nab/time-to-alert/harness/run.mjs --mode live
//   node validation/nab/time-to-alert/harness/run.mjs --mode sim        (results/sim/, never scored)
//   [--nab <path>]   the NAB checkout (default ../NAB); refused unless at the registered commit.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DETECTORS } from '../../../h0-battery/harness/detectors.mjs';
import { render } from '../analysis/report.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(STUDY, '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { buildPerDatasetConfig } = require(path.join(ROOT, 'dist/tools/nab-per-dataset/_nab-per-dataset-config.js'));
const nab = require(path.join(ROOT, 'dist/tools/run-nab-validation.js'));
const esr = require(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
// ../NAB beside the checkout, or beside ~/concord when this tree is a session worktree.
const nabCandidates = [arg('--nab', null), path.join(ROOT, '..', 'NAB'), path.join(os.homedir(), 'concord', 'NAB')].filter(Boolean);
const NAB = path.resolve(nabCandidates.find((d) => fs.existsSync(path.join(d, 'labels', 'combined_windows.json'))) ?? nabCandidates[0]);

// ── registered constants (§2–§3) ──
const NAB_SHA = 'ea702d75cc2258d9d7dd35ca8e5e2539d71f3140';
const SUBS = ['realKnownCause', 'realAWSCloudwatch'];
const PROBATIONARY_FRACTION = 0.15;
const CALIBRATION_SIGNAL = 'p99_latency';
const ALPHAS_SCORED = [0.05, 0.01];
const ALPHA_ARL = 1e-3;
const MIN_TRACES = 20;
const REGISTERED_TRACES = 23;

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd }).toString().trim();
const nabSha = git(NAB);
if (nabSha !== NAB_SHA) { console.error(`NOT-EXECUTABLE: ../NAB at ${nabSha}, registered ${NAB_SHA}`); process.exit(3); }

/** §2 rules 1–4: the scored traces derived from the label files. */
function scoredTraces() {
  const W = JSON.parse(fs.readFileSync(path.join(NAB, 'labels/combined_windows.json'), 'utf8'));
  const L = JSON.parse(fs.readFileSync(path.join(NAB, 'labels/combined_labels.json'), 'utf8'));
  const out = [];
  for (const rel of Object.keys(W).sort()) {
    if (!SUBS.includes(rel.split('/')[0])) continue;
    const file = path.join(NAB, 'data', rel);
    const { values, timestamps } = nab.parseNABDatasetCsv(file);
    const nProb = Math.max(2, Math.floor(values.length * PROBATIONARY_FRACTION));
    const wins = nab.annotationsFromLabels(W[rel], timestamps).filter((w) => w.anomaly_window_start >= nProb);
    if (!wins.length) continue;
    const win = wins[0];
    const points = nab.annotationsFromLabels(L[rel].map((p) => [p, p]), timestamps).map((a) => a.anomaly_window_start);
    const point = points.find((p) => p >= win.anomaly_window_start - 1 && p <= win.anomaly_window_end) ?? points.find((p) => p >= nProb) ?? null;
    const cadenceMin = (Date.parse(timestamps[1].replace(' ', 'T') + 'Z') - Date.parse(timestamps[0].replace(' ', 'T') + 'Z')) / 60000;
    out.push({ rel, file, values, n: values.length, n_prob: nProb, start: win.anomaly_window_start, end: win.anomaly_window_end, point, cadence_min: cadenceMin, csv_sha256: sha256(file) });
  }
  return out;
}

/** §3: the tool's default calibration, no options. */
function calibration(values) {
  const { config, provenance } = buildPerDatasetConfig(values, CALIBRATION_SIGNAL, PROBATIONARY_FRACTION);
  const mu = provenance.derived.baseline_mean, phi = provenance.derived.ar1_phi;
  const sigma2 = provenance.pre_whitening.innovation_sigma_squared;
  return { mu, phi, sigma2, sigma: Math.sqrt(sigma2), marginal_sigma2: provenance.derived.baseline_sigma_squared,
    alpha_tool: config.alpha_budget.per_family.A / config.bonferroni_factor, n_prob: provenance.n_probationary_ticks };
}

/** First crossing of a battery adapter fed from the probationary tick (§2 rules 2 and 6). */
function firstCrossingAdapter(id, cal, alpha, values, nProb) {
  const det = DETECTORS.find((d) => d.id === id);
  const inst = det.make({ mu: cal.mu, sigma: cal.sigma, phi: cal.phi, alpha });
  for (let t = nProb; t < values.length; t++) {
    if (inst.step(values[t])) { if (!Number.isFinite(inst.logM())) throw new Error(`non-finite logM at fire, ${id} t=${t}`); return { t_star: t, onset_estimate: null }; }
  }
  if (!Number.isFinite(inst.logM())) throw new Error(`non-finite logM at end, ${id}`);
  return { t_star: -1, onset_estimate: null };
}

/** First crossing of the e-SR on the standardized AR(1) residual (§3). onset_estimate is in the
 *  detector's own 0-indexed tick count (e-sr-mean-shift.ts: last_reset + 1), mapped to a trace index. */
function firstCrossingESr(cal, values, nProb) {
  const params = { alpha_arl: ALPHA_ARL };
  const st = esr.freshESrMeanShiftState(params);
  for (let t = nProb; t < values.length; t++) {
    const r = esr.standardizeAr1Residual(values[t], values[t - 1], cal.mu, cal.sigma, cal.phi);
    const v = esr.evaluateESrMeanShift(r, params, st);
    if (!Number.isFinite(v.log_M)) throw new Error(`non-finite e-SR log_M at t=${t}`);
    if (v.fired) return { t_star: t, onset_estimate: nProb + v.onset_estimate }; // detector tick 0 = trace index nProb
  }
  return { t_star: -1, onset_estimate: null };
}

const classOf = (tStar, tr) => (tStar < 0 ? 'none' : tStar < tr.start ? 'pre' : tStar <= tr.end ? 'in' : 'late');

/** One (trace, detector, α) row (§2 rule 7, §4). */
function row(tr, cal, detector, alpha, hit) {
  const cls = classOf(hit.t_star, tr);
  const D = hit.t_star < 0 ? null : hit.t_star - tr.start;
  return { trace: tr.rel, detector, alpha, t_star: hit.t_star, class: cls,
    delay_ticks: D, delay_hours: D === null ? null : D * tr.cadence_min / 60,
    delay_censored: Math.min(hit.t_star < 0 ? Infinity : Math.max(D, 0), tr.end - tr.start),
    delay_from_point: hit.t_star < 0 || tr.point === null ? null : hit.t_star - tr.point,
    onset_estimate: hit.onset_estimate, onset_error: hit.onset_estimate === null ? null : hit.onset_estimate - tr.start,
    quiet_ticks: tr.start - tr.n_prob, window_ticks: tr.end - tr.start + 1 };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

/** Per (detector, α) summary over the scored traces (§4). */
function summarize(detector, alpha, rows) {
  const n = rows.length, by = (c) => rows.filter((r) => r.class === c);
  const inRows = by('in'), postStart = rows.filter((r) => r.class !== 'pre');
  const notByEnd = by('late').length + by('none').length;
  const hours = (r) => r.delay_censored * r.cadence_min / 60;
  const esrRows = rows.filter((r) => r.onset_estimate !== null);
  return { detector, alpha, n, n_pre: by('pre').length, n_in: inRows.length, n_late: by('late').length, n_none: by('none').length,
    p1_strict: inRows.length / n, p1_by_end: (by('pre').length + inRows.length) / n, not_by_end: notByEnd,
    falsifier_2_fires: notByEnd > n / 2,
    p2_median_ticks_in: median(inRows.map((r) => r.delay_ticks)), p2_median_hours_in: median(inRows.map((r) => r.delay_hours)),
    p2_censored_mean_ticks: mean(postStart.map((r) => r.delay_censored)), p2_censored_mean_hours: mean(postStart.map(hours)),
    p2_n_post_start: postStart.length,
    p2b_median_from_point_in: median(inRows.filter((r) => r.delay_from_point !== null).map((r) => r.delay_from_point)),
    p3_pre_fraction: by('pre').length / n, p3_per_1000_quiet: 1000 * by('pre').length / rows.reduce((s, r) => s + r.quiet_ticks, 0),
    p4_median_onset_error: esrRows.length ? median(esrRows.map((r) => r.onset_error)) : null,
    p4_median_abs_onset_error: esrRows.length ? median(esrRows.map((r) => Math.abs(r.onset_error))) : null,
    p4_inside_window: esrRows.length ? esrRows.filter((r) => r.onset_error >= 0 && r.onset_error <= r.window_ticks - 1).length / esrRows.length : null,
    p4_n: esrRows.length };
}

// ── run ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const traces = scoredTraces();
if (traces.length !== REGISTERED_TRACES || traces.length < MIN_TRACES) { console.error(`NOT-EXECUTABLE: derived ${traces.length} scored traces, registered ${REGISTERED_TRACES}`); process.exit(3); }

const rows = [], perTrace = [];
for (const tr of traces) {
  const cal = calibration(tr.values);
  if (cal.n_prob !== tr.n_prob) throw new Error(`probationary mismatch on ${tr.rel}`);
  const wmean = mean(tr.values.slice(tr.start, tr.end + 1));
  perTrace.push({ trace: tr.rel, n: tr.n, cadence_min: tr.cadence_min, n_prob: tr.n_prob, start: tr.start, end: tr.end, point: tr.point, csv_sha256: tr.csv_sha256,
    mu: cal.mu, phi: cal.phi, sigma: cal.sigma, marginal_sigma: Math.sqrt(cal.marginal_sigma2), alpha_tool: cal.alpha_tool,
    window_shift_whitened: (wmean - cal.mu) * (1 - cal.phi) / cal.sigma, window_shift_marginal: (wmean - cal.mu) / Math.sqrt(cal.marginal_sigma2) });
  const alphas = [...ALPHAS_SCORED, cal.alpha_tool];
  for (const id of ['family_A_mixture_supermartingale', 'family_A_betting_e_process']) for (const alpha of alphas) {
    rows.push({ ...row(tr, cal, id, alpha, firstCrossingAdapter(id, cal, alpha, tr.values, tr.n_prob)), cadence_min: tr.cadence_min, scored_alpha: ALPHAS_SCORED.includes(alpha) });
  }
  rows.push({ ...row(tr, cal, 'e_sr_mean_shift', ALPHA_ARL, firstCrossingESr(cal, tr.values, tr.n_prob)), cadence_min: tr.cadence_min, scored_alpha: true });
  const short = tr.rel.replace(/^real/, '').replace('.csv', '');
  console.log(`${short.padEnd(56)} phi=${cal.phi.toFixed(3)} shift_w=${perTrace.at(-1).window_shift_whitened.toFixed(2)} ` + rows.slice(-7).filter((r) => r.scored_alpha).map((r) => `${r.detector.slice(9, 12)}@${r.alpha}:${r.class}${r.delay_ticks === null ? '' : '(' + r.delay_ticks + ')'}`).join(' '));
}

const cells = [];
const keys = new Map();
for (const r of rows) { const k = `${r.detector}|${r.alpha}`; if (!keys.has(k)) keys.set(k, []); keys.get(k).push(r); }
// the tool's α differs per trace; pool those rows under one descriptive cell
const pooled = new Map();
for (const r of rows) { const k = r.scored_alpha ? `${r.detector}|${r.alpha}` : `${r.detector}|tool`; if (!pooled.has(k)) pooled.set(k, []); pooled.get(k).push(r); }
for (const [k, rs] of pooled) { const [detector, a] = k.split('|'); cells.push({ ...summarize(detector, a === 'tool' ? 'tool (alpha_budget.A / bonferroni, per trace)' : Number(a), rs), scored: a !== 'tool' }); }

const manifest = {
  study: '2026-09-nab-time-to-alert', run: `run-${stamp}`, mode: MODE,
  engine_sha: git(ROOT), engine_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, node: process.version,
  nab_sha: nabSha, labels_sha256: { combined_windows: sha256(path.join(NAB, 'labels/combined_windows.json')), combined_labels: sha256(path.join(NAB, 'labels/combined_labels.json')) },
  registration_sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')), harness_sha256: sha256(fileURLToPath(import.meta.url)), report_sha256: sha256(path.join(STUDY, 'analysis/report.mjs')),
  sub_benchmarks: SUBS, probationary_fraction: PROBATIONARY_FRACTION, calibration_signal: CALIBRATION_SIGNAL, alphas_scored: ALPHAS_SCORED, alpha_arl: ALPHA_ARL,
  n_traces: traces.length, registered_traces: REGISTERED_TRACES, min_traces: MIN_TRACES, exceptions: 0, argv: process.argv.slice(2),
};
fs.writeFileSync(path.join(runDir, 'traces.json'), JSON.stringify(perTrace, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'rows.json'), JSON.stringify(rows.map(({ cadence_min, ...r }) => r), null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(runDir));
console.log(`\n${traces.length} traces, ${rows.length} rows, ${cells.length} cells -> ${path.relative(STUDY, runDir)}`);
for (const c of cells.filter((x) => x.scored)) console.log(`${c.detector.padEnd(34)} a=${String(c.alpha).padEnd(6)} pre/in/late/none ${c.n_pre}/${c.n_in}/${c.n_late}/${c.n_none}  by_end ${c.p1_by_end.toFixed(3)} falsifier2 ${c.falsifier_2_fires ? 'FIRES' : 'does not fire'}  median_in ${c.p2_median_ticks_in}`);
