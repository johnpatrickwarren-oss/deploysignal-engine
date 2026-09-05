// validation/drift-saturation/harness/run.mjs — the registered harness for 2026-09-drift-saturation (C78),
// PREREGISTRATION.md §1–§7. Imports the h0-battery's nulls and the Family A mixture adapter (neither
// executes on import); drives the committed dist/ for the e-SR, universal inference, the sequential UI,
// safe-t and the calibration monitor. Deterministic: one seeded LCG per replication, ticks outer, signals
// inner (rate, then latency). No catch anywhere: a throw aborts and the partial directory is kept unscored.
//
//   node validation/drift-saturation/harness/run.mjs --mode live
//   node validation/drift-saturation/harness/run.mjs --mode sim --quick     (N = 10, results/sim/, never scored)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rng, NULLS } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { render } from '../analysis/report.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(STUDY, '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const esr = require(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'));
const ui = require(path.join(ROOT, 'dist/detectors/universal-inference-e-value.js'));
const sui = require(path.join(ROOT, 'dist/detectors/sequential-ui.js'));
const safeT = require(path.join(ROOT, 'dist/detectors/safe-t-e-value.js'));
const cm = require(path.join(ROOT, 'dist/fleet/calibration-monitor.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (§1–§4) ──
const N = QUICK ? 10 : 500;
const SEED = 20260904;
const M = 100, NU = 500, POST = 500, L = 100;
const C = 4, KAPPA = 4, STEPS = 5, DELTA_L = 1.5;
const SHAPES = ['linear', 'exponential', 'staircase'];
const HORIZONS = [500, 2000];
const NULL_IDS = ['N1', 'N3-p06'];
const ALPHAS = [0.05, 1e-4];
const ALPHA_ARLS = [1e-3, 1e-4];
const ALPHA_CAL = 0.01;
const K5_LEN = 200, K5_THRESHOLD = 20;
const BOUNDED_PRESENT = fs.readFileSync(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'), 'utf8').includes('bounded');
const MIX = DETECTORS.find((d) => d.id === 'family_A_mixture_supermartingale');
if (!MIX) throw new Error('mixture adapter missing');

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd }).toString().trim();

/** §1: g(t) for the rate signal. */
function growth(shape, t, nu, H) {
  if (t < nu) return 0;
  if (t >= nu + H) return C;
  const u = (t - nu) / H;
  if (shape === 'linear') return C * u;
  if (shape === 'exponential') return C * (Math.exp(KAPPA * u) - 1) / (Math.exp(KAPPA) - 1);
  if (shape === 'staircase') return C * Math.floor(STEPS * u) / STEPS;
  throw new Error(`unknown shape ${shape}`);
}

/** §1: one replication's two signals from one generator, ticks outer, signals inner. */
function draw(seed, nullSpec, T, gx, gy) {
  const r = rng(seed);
  const srcX = nullSpec.gen(r), srcY = nullSpec.gen(r);
  const x = new Array(T), y = new Array(T);
  for (let t = 0; t < T; t++) { x[t] = srcX() + gx(t); y[t] = srcY() + gy(t); }
  return { x, y };
}

/** §2: constructions on one signal from M. Returns first alert tick per (construction, level), -1 = never. */
function alerts(v, phi) {
  const T = v.length, out = {};
  // universal inference on consecutive windows; alert tick = window's last tick
  const ws = [];
  for (let s = M; s + L <= T; s += L) {
    const e = ui.universalInferenceMeanShiftEValue(v, { start: 0, len: M }, { start: s, len: L });
    if (Number.isNaN(e) || e < 0) throw new Error(`bad UI e ${e} at s=${s}`);
    ws.push({ start: s, end: s + L - 1, e });
  }
  for (const a of ALPHAS) {
    const w = ws.find((x) => x.e >= 1 / a);
    out[`universal_inference_e_value@${a}`] = w ? w.end : -1;
    out[`universal_inference_e_value@${a}#baseline_windows`] = ws.filter((x) => x.end < NU && x.e >= 1 / a).length;
  }
  out['#baseline_windows_total'] = ws.filter((x) => x.end < NU).length;
  // sequential UI on the whole prefix, changeFrom = M
  const R = sui.sequentialUiMeanShiftEProcess(v, { changeFrom: M });
  for (const a of ALPHAS) {
    const thr = Math.log(1 / a); let t = -1;
    for (let s = M; s < T; s++) { const le = R.logE[s - 1]; if (!Number.isFinite(le)) throw new Error(`non-finite seq-UI logE at s=${s}`); if (le >= thr) { t = s; break; } }
    out[`sequential_ui_e_process@${a}`] = t;
  }
  // e-SR: log_M does not depend on alpha_arl (threshold only), so one pass and two crossings
  for (const bounded of BOUNDED_PRESENT ? [false, true] : [false]) {
    const params = bounded ? { alpha_arl: ALPHA_ARLS[ALPHA_ARLS.length - 1], increment: 'bounded' } : { alpha_arl: ALPHA_ARLS[ALPHA_ARLS.length - 1] };
    const st = esr.freshESrMeanShiftState(params);
    const id = bounded ? 'e_sr_mean_shift_bounded' : 'e_sr_mean_shift';
    const first = Object.fromEntries(ALPHA_ARLS.map((a) => [a, -1]));
    for (let t = M; t < T; t++) {
      const res = esr.evaluateESrMeanShift(esr.standardizeAr1Residual(v[t], v[t - 1], 0, 1, phi), params, st);
      if (!Number.isFinite(res.log_M)) throw new Error(`non-finite e-SR log_M at t=${t}`);
      for (const a of ALPHA_ARLS) if (first[a] < 0 && res.log_M >= Math.log(1 / a)) first[a] = t;
      if (ALPHA_ARLS.every((a) => first[a] >= 0)) break;
    }
    for (const a of ALPHA_ARLS) out[`${id}@${a}`] = first[a];
  }
  // Family A mixture through the battery adapter, one instance per level
  for (const a of ALPHAS) {
    const inst = MIX.make({ mu: 0, sigma: 1, phi, alpha: a }); let t = -1;
    for (let s = M; s < T; s++) { if (inst.step(v[s])) { t = s; break; } }
    if (!Number.isFinite(inst.logM())) throw new Error('non-finite mixture logM');
    out[`family_A_mixture_supermartingale@${a}`] = t;
  }
  return out;
}
/** §2 arm (c): the bounded monitor's revocation tick on the rate residual, -1 = never. */
function revocation(v, phi) {
  const m = cm.freshCalibrationMonitor({ alpha: ALPHA_CAL, incrementKind: 'bounded' });
  for (let t = M; t < v.length; t++) { cm.updateCalibration(m, esr.standardizeAr1Residual(v[t], v[t - 1], 0, 1, phi)); if (!m.passing) return t; }
  return -1;
}
/** §2 arm (d): the K5 instrument. */
function k5(v, phi) {
  const e = safeT.safeTwoSampleTEValue(v, { start: 0, len: M }, { start: NU, len: K5_LEN }, { ar1Phi: phi });
  if (Number.isNaN(e) || e < 0) throw new Error(`bad safe-t e ${e}`);
  return e >= K5_THRESHOLD;
}

const CONSTRUCTIONS = [
  { id: 'e_sr_mean_shift', levels: ALPHA_ARLS, contract: 'arl' },
  ...(BOUNDED_PRESENT ? [{ id: 'e_sr_mean_shift_bounded', levels: ALPHA_ARLS, contract: 'arl' }] : []),
  { id: 'universal_inference_e_value', levels: ALPHAS, contract: 'per-window' },
  { id: 'sequential_ui_e_process', levels: ALPHAS, contract: 'per-run' },
  { id: 'family_A_mixture_supermartingale', levels: ALPHAS, contract: 'per-run' },
];

// ── run directory ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

// ── instrument check (§4) ──
const N1 = NULLS.find((n) => n.id === 'N1');
const T0 = NU + 2000 + POST;
const step3 = draw(SEED, N1, T0, (t) => (t >= NU ? 3 : 0), () => 0);
const clean = draw(SEED, N1, T0, () => 0, () => 0);
const aStep = alerts(step3.x, 0), aClean = alerts(clean.x, 0);
const instrument = { step_fires: {}, clean_quiet: {}, ok: true };
for (const c of CONSTRUCTIONS) {
  const lvl = c.contract === 'arl' ? ALPHA_ARLS[0] : ALPHAS[0];
  const t = aStep[`${c.id}@${lvl}`]; instrument.step_fires[c.id] = t;
  if (!(t >= NU && t < T0)) instrument.ok = false;
}
for (const id of ['family_A_mixture_supermartingale', 'universal_inference_e_value', 'sequential_ui_e_process']) {
  const t = aClean[`${id}@${ALPHAS[1]}`]; instrument.clean_quiet[id] = t;
  if (t !== -1) instrument.ok = false;
}
console.log('instrument check', JSON.stringify(instrument));
if (!instrument.ok) { console.error('NOT-EXECUTABLE: instrument check failed'); fs.writeFileSync(path.join(runDir, 'NOT-EXECUTABLE.json'), JSON.stringify(instrument, null, 2) + '\n'); process.exit(3); }

// ── the grid (§1) ──
const cellsDef = [];
for (const shape of SHAPES) for (const H of HORIZONS) for (const nid of NULL_IDS) cellsDef.push({ id: `${shape}-H${H}-${nid}`, shape, H, null: nid, j: cellsDef.length });
const reps = [];
for (const cell of cellsDef) {
  const spec = NULLS.find((n) => n.id === cell.null); const phi = spec.phi ?? 0;
  const S = NU + cell.H, T = S + POST;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const seed = SEED + 7919 * i + 1e6 * cell.j;
    const { x, y } = draw(seed, spec, T, (t) => growth(cell.shape, t, NU, cell.H), (t) => (t >= S ? DELTA_L : 0));
    reps.push({ cell: cell.id, i, seed, S, T, rate: alerts(x, phi), latency: alerts(y, phi), revoked: revocation(x, phi), k5: k5(x, phi) });
  }
  console.log(`${cell.id.padEnd(24)} N=${N} S=${S} T=${T} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ── scoring (§3) ──
const med = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
const cells = [];
for (const cell of cellsDef) {
  const rs = reps.filter((r) => r.cell === cell.id); const S = NU + cell.H;
  const revBefore = rs.filter((r) => r.revoked >= 0 && r.revoked < S).length;
  const revOff = rs.filter((r) => r.revoked >= 0).map((r) => r.revoked - S);
  for (const c of CONSTRUCTIONS) for (const level of c.levels) {
    const key = `${c.id}@${level}`;
    const tx = rs.map((r) => r.rate[key]), ty = rs.map((r) => r.latency[key]);
    const baseline = rs.map((r, k) => (c.contract === 'per-window' ? r.rate[`${key}#baseline_windows`] > 0 : tx[k] >= 0 && tx[k] < NU));
    const p1Idx = rs.map((_, k) => k).filter((k) => tx[k] >= NU && tx[k] < S);
    const noBase = rs.map((_, k) => k).filter((k) => !baseline[k]);
    const abst = p1Idx.filter((k) => rs[k].revoked >= 0 && rs[k].revoked <= tx[k]);
    const leads = p1Idx.map((k) => S - tx[k]);
    const censored = noBase.map((k) => (tx[k] >= NU && tx[k] < S ? S - tx[k] : 0));
    const latOk = rs.map((_, k) => k).filter((k) => ty[k] >= S && ty[k] < rs[k].T);
    const both = rs.map((_, k) => k).filter((k) => tx[k] >= 0 && ty[k] >= 0);
    cells.push({ cell: cell.id, shape: cell.shape, H: cell.H, null: cell.null, construction: c.id, level, contract: c.contract, n: rs.length,
      n_baseline_alert: baseline.filter(Boolean).length, n_before_saturation: p1Idx.length, n_after_saturation: rs.filter((_, k) => tx[k] >= S).length, n_never: tx.filter((t) => t < 0).length,
      p1: p1Idx.length / rs.length, p1_bar: p1Idx.length / rs.length >= 0.5 ? 'HELD' : 'FAILED',
      p1c: noBase.length ? p1Idx.filter((k) => !baseline[k]).length / noBase.length : null, n_no_baseline: noBase.length,
      n_abstained: abst.length, p1g: (p1Idx.length - abst.length) / rs.length, abstained_fraction: p1Idx.length ? abst.length / p1Idx.length : null,
      lead_median: med(leads), lead_censored_mean: mean(censored), lead_over_H_median: leads.length ? med(leads) / cell.H : null,
      latency_delay_median: med(latOk.map((k) => ty[k] - S)), n_latency_in_post: latOk.length, n_latency_before_S: rs.filter((_, k) => ty[k] >= 0 && ty[k] < S).length,
      lead_over_latency_median: med(both.map((k) => ty[k] - tx[k])), n_both: both.length,
      monitor_revoked_before_S: revBefore / rs.length, monitor_revocation_offset_median: med(revOff) });
  }
}
const p3 = [];
for (const nid of NULL_IDS) {
  const rs = reps.filter((r) => cellsDef.find((c) => c.id === r.cell).null === nid); const Np = rs.length, Q = 400;
  for (const c of CONSTRUCTIONS) for (const level of c.levels) {
    const key = `${c.id}@${level}`;
    let alerting, bar, denom;
    if (c.contract === 'per-window') { const W = rs.reduce((a, r) => a + r.rate['#baseline_windows_total'], 0); alerting = rs.reduce((a, r) => a + r.rate[`${key}#baseline_windows`], 0); bar = Math.floor(W * level + 3 * Math.sqrt(W * level * (1 - level))); denom = W * L; }
    else { alerting = rs.filter((r) => r.rate[key] >= 0 && r.rate[key] < NU).length; denom = Np * Q;
      if (c.contract === 'arl') { const E = Np * (1 - Math.exp(-level * Q)); bar = Math.floor(E + 3 * Math.sqrt(E)); }
      else bar = Math.floor(Np * level + 3 * Math.sqrt(Np * level * (1 - level))); }
    p3.push({ null: nid, construction: c.id, level, contract: c.contract, n_pool: Np, alerting, bar, rate_per_1000: 1000 * alerting / denom, p3: alerting <= bar ? 'HELD' : 'FAILED' });
  }
}
const p4 = cellsDef.map((cell) => { const rs = reps.filter((r) => r.cell === cell.id); return { cell: cell.id, shape: cell.shape, H: cell.H, null: cell.null, n: rs.length, k5_fraction: rs.filter((r) => r.k5).length / rs.length }; });

const manifest = {
  study: '2026-09-drift-saturation', run: `run-${stamp}`, mode: MODE, quick: QUICK,
  engine_sha: git(ROOT), engine_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, node: process.version,
  registration_sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')), harness_sha256: sha256(fileURLToPath(import.meta.url)), report_sha256: sha256(path.join(STUDY, 'analysis/report.mjs')),
  nulls_sha256: sha256(path.join(ROOT, 'validation/h0-battery/harness/nulls.mjs')), detectors_sha256: sha256(path.join(ROOT, 'validation/h0-battery/harness/detectors.mjs')),
  seed: SEED, n: N, m: M, nu: NU, post: POST, window_length: L, capacity: C, kappa: KAPPA, steps: STEPS, delta_latency: DELTA_L,
  shapes: SHAPES, horizons: HORIZONS, nulls: NULL_IDS, alphas: ALPHAS, alpha_arls: ALPHA_ARLS, alpha_cal: ALPHA_CAL, k5_len: K5_LEN, k5_threshold: K5_THRESHOLD,
  bounded_esr: BOUNDED_PRESENT ? 'present' : 'absent', constructions: CONSTRUCTIONS.map((c) => c.id), instrument_check: instrument,
  cells: cellsDef.map((c) => c.id), n_reps: reps.length, exceptions: 0, argv: process.argv.slice(2),
};
fs.writeFileSync(path.join(runDir, 'reps.jsonl'), reps.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'p3.json'), JSON.stringify(p3, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'p4.json'), JSON.stringify(p4, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(runDir));
console.log(`\n${reps.length} replications, ${cells.length} cells -> ${path.relative(STUDY, runDir)}; bounded e-SR ${manifest.bounded_esr}`);
for (const c of cells) console.log(`${c.cell.padEnd(24)} ${c.construction.padEnd(34)} ${String(c.level).padEnd(6)} P1 ${c.p1.toFixed(3)} ${c.p1_bar.padEnd(6)} P1c ${c.p1c === null ? '  —  ' : c.p1c.toFixed(3)} P1g ${c.p1g.toFixed(3)} lead med ${String(c.lead_median ?? '—').padStart(5)} (${c.lead_over_H_median === null ? '—' : c.lead_over_H_median.toFixed(2)}H) cens ${c.lead_censored_mean === null ? '—' : c.lead_censored_mean.toFixed(0)} base ${c.n_baseline_alert} lat delay ${c.latency_delay_median ?? '—'} rev<S ${c.monitor_revoked_before_S.toFixed(2)}`);
for (const p of p3) console.log(`P3 ${p.null.padEnd(7)} ${p.construction.padEnd(34)} ${String(p.level).padEnd(6)} alerting ${p.alerting} bar ${p.bar} ${p.p3} rate/1000 ${p.rate_per_1000.toFixed(2)}`);
for (const p of p4) console.log(`P4 ${p.cell.padEnd(24)} k5 ${p.k5_fraction.toFixed(3)}`);
