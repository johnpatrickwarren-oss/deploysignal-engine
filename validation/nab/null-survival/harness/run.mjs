// validation/nab/null-survival/harness/run.mjs — the registered harness for 2026-09-nab-null-survival
// (PREREGISTRATION.md §1–§8). C75's trace enumeration and calibration are copied from
// validation/nab/time-to-alert/harness/run.mjs (not imported: it executes on import). Deterministic: no
// randomness anywhere. No catch: a throw aborts the run and the partial directory is kept unscored.
//
//   node validation/nab/null-survival/harness/run.mjs --mode live
//   node validation/nab/null-survival/harness/run.mjs --mode sim        (results/sim/, never scored)
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
const safeT = require(path.join(ROOT, 'dist/detectors/safe-t-e-value.js'));
const ui = require(path.join(ROOT, 'dist/detectors/universal-inference-e-value.js'));
const sui = require(path.join(ROOT, 'dist/detectors/sequential-ui.js'));
const cm = require(path.join(ROOT, 'dist/fleet/calibration-monitor.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const nabCandidates = [arg('--nab', null), path.join(ROOT, '..', 'NAB'), path.join(os.homedir(), 'concord', 'NAB')].filter(Boolean);
const NAB = path.resolve(nabCandidates.find((d) => fs.existsSync(path.join(d, 'labels', 'combined_windows.json'))) ?? nabCandidates[0]);

// ── registered constants (§1–§4) ──
const NAB_SHA = 'ea702d75cc2258d9d7dd35ca8e5e2539d71f3140';
const SUBS = ['realKnownCause', 'realAWSCloudwatch'];
const TOOL_FRACTION = 0.15;
const CALIBRATION_SIGNAL = 'p99_latency';
const ARMS = ['tool', '0.15', '0.30', '0.50'];
const ALPHAS = [0.05, 0.01];
const ALPHA_ARL = 1e-3;
const ALPHA_CAL = 0.01;
const L = 100;
const REGISTERED_TRACES = 23;
const C75_REPRO = { family_A_mixture_supermartingale: 14, family_A_betting_e_process: 11, e_sr_mean_shift: 20 };
const BOUNDED_PRESENT = fs.readFileSync(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'), 'utf8').includes('bounded');

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd }).toString().trim();
const nabSha = git(NAB);
if (nabSha !== NAB_SHA) { console.error(`NOT-EXECUTABLE: ../NAB at ${nabSha}, registered ${NAB_SHA}`); process.exit(3); }

/** C75 §2 rules 1–4, copied: the scored traces derived from the label files. */
function scoredTraces() {
  const W = JSON.parse(fs.readFileSync(path.join(NAB, 'labels/combined_windows.json'), 'utf8'));
  const out = [];
  for (const rel of Object.keys(W).sort()) {
    if (!SUBS.includes(rel.split('/')[0])) continue;
    const file = path.join(NAB, 'data', rel);
    const { values, timestamps } = nab.parseNABDatasetCsv(file);
    const nProb = Math.max(2, Math.floor(values.length * TOOL_FRACTION));
    const wins = nab.annotationsFromLabels(W[rel], timestamps).filter((w) => w.anomaly_window_start >= nProb);
    if (!wins.length) continue;
    const win = wins[0];
    out.push({ rel, file, values, n: values.length, n_prob: nProb, start: win.anomaly_window_start, end: win.anomaly_window_end, csv_sha256: sha256(file) });
  }
  return out;
}

/** §1: the tool's calibration on the head [0, cut). */
function calibration(values, cut) {
  const { provenance } = buildPerDatasetConfig(values, CALIBRATION_SIGNAL, (cut + 0.5) / values.length);
  if (provenance.n_probationary_ticks !== cut) throw new Error(`head mismatch: wanted ${cut}, got ${provenance.n_probationary_ticks}`);
  const sigma2 = provenance.pre_whitening.innovation_sigma_squared;
  return { cut, mu: provenance.derived.baseline_mean, phi: provenance.derived.ar1_phi, sigma2, sigma: Math.sqrt(sigma2), marginal_sigma2: provenance.derived.baseline_sigma_squared };
}
const cutOf = (tr, arm) => (arm === 'tool' ? tr.n_prob : Math.max(2, Math.floor(Number(arm) * tr.start)));

const classOf = (t, tr) => (t < 0 ? 'none' : t < tr.start ? 'pre' : t <= tr.end ? 'in' : 'late');

/** Sequential constructions: first crossing at or after cut, scanning the whole trace (§2). */
function firstCrossingAdapter(id, cal, alpha, values) {
  const inst = DETECTORS.find((d) => d.id === id).make({ mu: cal.mu, sigma: cal.sigma, phi: cal.phi, alpha });
  for (let t = cal.cut; t < values.length; t++) {
    if (inst.step(values[t])) { if (!Number.isFinite(inst.logM())) throw new Error(`non-finite logM at fire, ${id} t=${t}`); return t; }
  }
  if (!Number.isFinite(inst.logM())) throw new Error(`non-finite logM at end, ${id}`);
  return -1;
}
function firstCrossingESr(cal, values, bounded) {
  const params = bounded ? { alpha_arl: ALPHA_ARL, increment: 'bounded' } : { alpha_arl: ALPHA_ARL };
  const st = esr.freshESrMeanShiftState(params);
  for (let t = cal.cut; t < values.length; t++) {
    const v = esr.evaluateESrMeanShift(esr.standardizeAr1Residual(values[t], values[t - 1], cal.mu, cal.sigma, cal.phi), params, st);
    if (!Number.isFinite(v.log_M)) throw new Error(`non-finite e-SR log_M at t=${t}`);
    if (v.fired) return t;
  }
  return -1;
}
function firstCrossingSeqUi(cal, values, alpha) {
  const r = sui.sequentialUiMeanShiftEProcess(values, { changeFrom: cal.cut });
  const thr = Math.log(1 / alpha);
  for (let s = cal.cut; s < values.length; s++) { const le = r.logE[s - 1]; if (!Number.isFinite(le)) throw new Error(`non-finite seq-UI logE at s=${s}`); if (le >= thr) return s; }
  return -1;
}
/** Terminal constructions on consecutive windows of L from cut (§2): per-window e-values. */
function windowsTerminal(kind, cal, values) {
  const out = [];
  for (let s = cal.cut; s + L <= values.length; s += L) {
    const e = kind === 'safe_t_e_value'
      ? safeT.safeTwoSampleTEValue(values, { start: 0, len: cal.cut }, { start: s, len: L }, { ar1Phi: cal.phi })
      : ui.universalInferenceMeanShiftEValue(values, { start: 0, len: cal.cut }, { start: s, len: L });
    // +Infinity is a legitimate (overwhelming) e-value on a huge shift; only NaN or a negative value is a defect.
    if (Number.isNaN(e) || e < 0) throw new Error(`bad terminal e ${e} for ${kind} at s=${s}`);
    out.push({ start: s, e });
  }
  return out;
}
/** §3: revocation ticks of the two monitors on the quiet stretch. */
function monitors(cal, values, start) {
  const rev = {};
  for (const kind of ['gaussian', 'bounded']) {
    const m = cm.freshCalibrationMonitor({ alpha: ALPHA_CAL, incrementKind: kind }); rev[kind] = null;
    for (let t = cal.cut; t < start; t++) { cm.updateCalibration(m, esr.standardizeAr1Residual(values[t], values[t - 1], cal.mu, cal.sigma, cal.phi)); if (!m.passing && rev[kind] === null) rev[kind] = t; }
  }
  return rev;
}

const SEQUENTIAL = [
  { id: 'family_A_mixture_supermartingale', levels: ALPHAS, run: (cal, v, a) => firstCrossingAdapter('family_A_mixture_supermartingale', cal, a, v), contract: 'per-run' },
  { id: 'family_A_betting_e_process', levels: ALPHAS, run: (cal, v, a) => firstCrossingAdapter('family_A_betting_e_process', cal, a, v), contract: 'per-run' },
  { id: 'e_sr_mean_shift', levels: [ALPHA_ARL], run: (cal, v) => firstCrossingESr(cal, v, false), contract: 'arl' },
  { id: 'sequential_ui_e_process', levels: ALPHAS, run: (cal, v, a) => firstCrossingSeqUi(cal, v, a), contract: 'per-run' },
  ...(BOUNDED_PRESENT ? [{ id: 'e_sr_mean_shift_bounded', levels: [ALPHA_ARL], run: (cal, v) => firstCrossingESr(cal, v, true), contract: 'arl' }] : []),
];
const TERMINAL = [{ id: 'safe_t_e_value', levels: ALPHAS }, { id: 'universal_inference_e_value', levels: ALPHAS }];

// ── run ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const traces = scoredTraces();
if (traces.length !== REGISTERED_TRACES) { console.error(`NOT-EXECUTABLE: derived ${traces.length} scored traces, registered ${REGISTERED_TRACES}`); process.exit(3); }

const rows = [], calib = [], monitorRows = [];
for (const tr of traces) {
  const short = tr.rel.replace(/^real/, '').replace('.csv', '');
  for (const arm of ARMS) {
    const cut = cutOf(tr, arm);
    if (cut >= tr.start) throw new Error(`cut ${cut} not before start ${tr.start} on ${tr.rel} arm ${arm}`);
    const cal = calibration(tr.values, cut);
    const quiet = tr.start - cut;
    calib.push({ trace: tr.rel, arm, cut, quiet_ticks: quiet, mu: cal.mu, phi: cal.phi, sigma: cal.sigma, marginal_sigma: Math.sqrt(cal.marginal_sigma2) });
    const rev = monitors(cal, tr.values, tr.start);
    monitorRows.push({ trace: tr.rel, arm, cut, quiet_ticks: quiet, revoked_gaussian: rev.gaussian, revoked_bounded: rev.bounded });
    const gate = (t) => ({ gaussian_revoked_before: rev.gaussian !== null && rev.gaussian <= t, bounded_revoked_before: rev.bounded !== null && rev.bounded <= t });
    for (const c of SEQUENTIAL) for (const level of c.levels) {
      const t = c.run(cal, tr.values, level);
      const cls = classOf(t, tr);
      rows.push({ trace: tr.rel, arm, construction: c.id, level, kind: 'sequential', cut, quiet_ticks: quiet, t_star: t, class: cls,
        quiet_alert: cls === 'pre', quiet_windows: null, quiet_alerting_windows: null, ...(cls === 'pre' ? gate(t) : { gaussian_revoked_before: null, bounded_revoked_before: null }) });
    }
    for (const c of TERMINAL) {
      const ws = windowsTerminal(c.id, cal, tr.values);
      const quietWs = ws.filter((w) => w.start + L <= tr.start);
      for (const level of c.levels) {
        const first = ws.find((w) => w.e >= 1 / level);
        const t = first ? first.start : -1;
        const cls = classOf(t, tr);
        const alerting = quietWs.filter((w) => w.e >= 1 / level);
        const g = alerting.length ? { gaussian_revoked_before: alerting.every((w) => rev.gaussian !== null && rev.gaussian <= w.start), bounded_revoked_before: alerting.every((w) => rev.bounded !== null && rev.bounded <= w.start) } : { gaussian_revoked_before: null, bounded_revoked_before: null };
        rows.push({ trace: tr.rel, arm, construction: c.id, level, kind: 'terminal', cut, quiet_ticks: quiet, t_star: t, class: cls,
          quiet_alert: alerting.length > 0, quiet_windows: quietWs.length, quiet_alerting_windows: alerting.length, ...g });
      }
    }
    console.log(`${short.padEnd(50)} ${arm.padEnd(4)} cut=${String(cut).padStart(5)} q=${String(quiet).padStart(5)} rev g/b=${rev.gaussian ?? '—'}/${rev.bounded ?? '—'} ` + rows.slice(-(SEQUENTIAL.reduce((a, c) => a + c.levels.length, 0) + 4)).map((r) => `${r.construction.slice(0, 6)}@${r.level}:${r.class}`).join(' '));
  }
}

// ── instrument check (§5): the tool arm reproduces C75 ──
const repro = {};
for (const [id, want] of Object.entries(C75_REPRO)) {
  const level = id === 'e_sr_mean_shift' ? ALPHA_ARL : 0.05;
  const got = rows.filter((r) => r.arm === 'tool' && r.construction === id && r.level === level && r.quiet_alert).length;
  repro[id] = { want, got, ok: got === want };
}
if (!Object.values(repro).every((x) => x.ok)) { console.error(`NOT-EXECUTABLE: C75 reproduction failed ${JSON.stringify(repro)}`); process.exit(3); }

// ── cells (§4) ──
const floor = Math.floor, sqrt = Math.sqrt;
const cells = [];
for (const arm of ARMS) for (const c of [...SEQUENTIAL, ...TERMINAL]) for (const level of c.levels) {
  const rs = rows.filter((r) => r.arm === arm && r.construction === c.id && r.level === level);
  const N = rs.length, Q = rs.reduce((a, r) => a + r.quiet_ticks, 0);
  const terminal = rs[0].kind === 'terminal';
  const alerting = terminal ? rs.reduce((a, r) => a + r.quiet_alerting_windows, 0) : rs.filter((r) => r.quiet_alert).length;
  const W = terminal ? rs.reduce((a, r) => a + r.quiet_windows, 0) : null;
  let bar;
  if (terminal) bar = floor(W * level + 3 * sqrt(W * level * (1 - level)));
  else if (c.contract === 'arl') { const E = rs.reduce((a, r) => a + (1 - Math.exp(-ALPHA_ARL * r.quiet_ticks)), 0); bar = floor(E + 3 * sqrt(E)); }
  else bar = floor(N * level + 3 * sqrt(N * level * (1 - level)));
  const alertingStretches = rs.filter((r) => r.quiet_alert);
  const gG = alertingStretches.filter((r) => r.gaussian_revoked_before === true).length, gB = alertingStretches.filter((r) => r.bounded_revoked_before === true).length;
  const by = (k) => rs.filter((r) => r.class === k).length;
  cells.push({ arm, construction: c.id, level, kind: terminal ? 'terminal' : 'sequential', contract: terminal ? 'per-window' : c.contract, n: N, quiet_ticks: Q, windows: W,
    alerting, rate_per_1000: 1000 * alerting / (terminal ? W * L : Q), bar, p1: alerting <= bar ? 'HELD' : 'FAILED',
    alerting_stretches: alertingStretches.length, gaussian_abstained: gG, bounded_abstained: gB,
    counted_after_gaussian_gate: alertingStretches.length - gG, counted_after_bounded_gate: alertingStretches.length - gB,
    p2_gaussian_before_alert: alertingStretches.length ? gG / alertingStretches.length : null, p2_bounded_before_alert: alertingStretches.length ? gB / alertingStretches.length : null,
    n_pre: by('pre'), n_in: by('in'), n_late: by('late'), n_none: by('none'), p3_by_end: (by('pre') + by('in')) / N, p3_strict: by('in') / N });
}
const monitorCells = [];
for (const arm of ARMS) for (const kind of ['gaussian', 'bounded']) {
  const rs = monitorRows.filter((r) => r.arm === arm); const k = `revoked_${kind}`;
  const rev = rs.filter((r) => r[k] !== null); const offs = rev.map((r) => r[k] - r.cut).sort((a, b) => a - b);
  monitorCells.push({ arm, kind, revoked: rev.length, n: rs.length, revocation_rate: rev.length / rs.length, median_revocation_offset: offs.length ? offs[offs.length >> 1] : null });
}
const clears = {};
for (const c of [...SEQUENTIAL, ...TERMINAL]) { clears[c.id] = ARMS.filter((arm) => cells.filter((x) => x.construction === c.id && x.arm === arm).every((x) => x.p1 === 'HELD')); }
const p4 = [];
for (const c of [...SEQUENTIAL, ...TERMINAL]) for (const level of c.levels) {
  const rates = ['0.15', '0.30', '0.50'].map((arm) => cells.find((x) => x.construction === c.id && x.arm === arm && x.level === level).rate_per_1000);
  p4.push({ construction: c.id, level, rate_015: rates[0], rate_030: rates[1], rate_050: rates[2], monotone_non_increasing: rates[0] >= rates[1] && rates[1] >= rates[2] });
}

const manifest = {
  study: '2026-09-nab-null-survival', run: `run-${stamp}`, mode: MODE,
  engine_sha: git(ROOT), engine_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, node: process.version,
  nab_sha: nabSha, labels_sha256: { combined_windows: sha256(path.join(NAB, 'labels/combined_windows.json')), combined_labels: sha256(path.join(NAB, 'labels/combined_labels.json')) },
  registration_sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')), harness_sha256: sha256(fileURLToPath(import.meta.url)), report_sha256: sha256(path.join(STUDY, 'analysis/report.mjs')),
  sub_benchmarks: SUBS, tool_fraction: TOOL_FRACTION, arms: ARMS, alphas: ALPHAS, alpha_arl: ALPHA_ARL, alpha_cal: ALPHA_CAL, window_length: L,
  bounded_esr: BOUNDED_PRESENT ? 'present' : 'absent', constructions: [...SEQUENTIAL, ...TERMINAL].map((c) => c.id),
  n_traces: traces.length, registered_traces: REGISTERED_TRACES, c75_reproduction: repro, survivors: clears, exceptions: 0, argv: process.argv.slice(2),
};
fs.writeFileSync(path.join(runDir, 'calibration.json'), JSON.stringify(calib, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'monitors.json'), JSON.stringify(monitorRows, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'rows.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'monitor_cells.json'), JSON.stringify(monitorCells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'p4.json'), JSON.stringify(p4, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(runDir));
console.log(`\n${traces.length} traces, ${rows.length} rows, ${cells.length} cells -> ${path.relative(STUDY, runDir)}; bounded e-SR ${manifest.bounded_esr}`);
for (const c of cells) console.log(`${c.arm.padEnd(4)} ${c.construction.padEnd(34)} ${String(c.level).padEnd(6)} alerting ${String(c.alerting).padStart(3)} bar ${String(c.bar).padStart(3)} ${c.p1.padEnd(6)} rate/1000 ${c.rate_per_1000.toFixed(2).padStart(6)} gate g/b ${c.p2_gaussian_before_alert === null ? '  —  ' : c.p2_gaussian_before_alert.toFixed(2)}/${c.p2_bounded_before_alert === null ? '—' : c.p2_bounded_before_alert.toFixed(2)} by_end ${c.p3_by_end.toFixed(3)} in ${c.n_in}`);
console.log('survivors', JSON.stringify(clears));
