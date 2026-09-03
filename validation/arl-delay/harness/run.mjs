// validation/arl-delay/harness/run.mjs — the registered harness for 2026-09-arl-delay.
// PREREGISTRATION.md §1–§8. Imports the h0-battery's nulls and adapters unchanged; the
// trajectory construction is copied from h0-battery/harness/run.mjs:44-79 so arm A's first
// 300 ticks ARE the battery's trajectories (G1 is an exact reproduction where the detector's
// fire behaviour has not moved).
//
//   node validation/arl-delay/harness/run.mjs --mode live            (registered sizes)
//   node validation/arl-delay/harness/run.mjs --mode sim --quick     (N = 20, results/sim/, never scored)
//   [--only <detector_id>]  restricts the detector loop; a partial run is labelled in the manifest.
//
// Cells carry `detector_id`, never `detector`, and no summary.json/endpoints.json is written,
// so validation/certification/lib/collect.mjs pools none of this (Amendment v1.C66, C66.4).

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { rng, NULLS, N8_COMBINED } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS, OUT_OF_SCOPE } from '../../h0-battery/harness/detectors.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
const ONLY = arg('--only', null);
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live (§6)'); process.exit(1); }

// ── registered constants (§2–§3) ──
const N = QUICK ? 20 : 2000;
const T_ARL = 3000, T_DELAY = 1000, NU = 200;
const ALPHAS_SCORED = [0.05, 0.01], ALPHA_SHIPPED = 1e-4;
const ALPHAS = [...ALPHAS_SCORED, ALPHA_SHIPPED];
const SEED_A = 20260801;                       // the battery's seed and stride (§3 arm A)
const SEED_B = 20260903;
const SALT = { K1: 0, K2: 1_000_003, K3: 2_000_003 };
const SIGMA = 1;                               // every battery null has unit marginal variance
const BATTERY_RUNS = { default: 'run-20260801T064627Z', N8: 'run-20260819T014934Z' };
const NULLS_ALL = [...NULLS, N8_COMBINED];
const DETS = DETECTORS.filter((d) => !ONLY || d.id === ONLY);

// ── injections (§2 canonical severities; coverage lib/inject.mjs:37-41 form) ──
const INJECT = {
  K1: { label: 'K1 step +1.5sigma', apply: (x, t) => (Array.isArray(x) ? x.map((v) => v + 1.5 * SIGMA) : x + 1.5 * SIGMA) },
  K2: { label: 'K2 unison +0.5sigma per coordinate (K = 2, adapter dimension)', apply: (x, t) => (Array.isArray(x) ? x.map((v) => v + 0.5 * SIGMA) : x + 0.5 * SIGMA) },
  K3: { label: 'K3 oscillation A = 0.75sigma, f = 0.05', apply: (x, t) => { const s = 0.75 * SIGMA * Math.sin(2 * Math.PI * 0.05 * (t - NU)); return Array.isArray(x) ? x.map((v) => v + s) : x + s; } },
};
const PAIRS = [];                               // (detector, injection) — §3 arm B table
for (const det of DETS) {
  PAIRS.push({ det, inj: 'K1', own: det.family === 'A' });
  if (det.id === 'family_C_safe_hotelling') PAIRS.push({ det, inj: 'K2', own: true });
  if (det.id === 'family_D_spectral_e_detector') PAIRS.push({ det, inj: 'K3', own: true });
}

/** One trajectory. Copied from h0-battery/harness/run.mjs:44-79 (calibration and phi threading
 *  verbatim); the horizon and the injection are the only additions. Returns the 0-indexed
 *  first-fire tick, or -1. */
function trajectory(det, nullSpec, alpha, seed, T, inject = null) {
  const r = rng(seed);
  const src = nullSpec.gen(r);
  const draw = () => (det.vector ? Array.from({ length: det.vector }, src) : src());

  const cfg = { mu: 0, sigma: 1, phi: nullSpec.params === 'oracle' ? (nullSpec.phi ?? 0) : 0,
                alpha, windows: nullSpec.windows };

  if (nullSpec.params === 'estimated') {
    const cal = Array.from({ length: nullSpec.m }, src);
    const mu = cal.reduce((a, b) => a + b, 0) / cal.length;
    const sd = Math.sqrt(cal.reduce((a, b) => a + (b - mu) ** 2, 0) / cal.length) || 1;
    let num = 0, den = 0;
    for (let i = 1; i < cal.length; i++) { num += (cal[i] - mu) * (cal[i - 1] - mu); }
    for (let i = 0; i < cal.length; i++) { den += (cal[i] - mu) ** 2; }
    Object.assign(cfg, { mu, sigma: sd, phi: den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0 });
  }
  if (det.calibrate) {
    Object.assign(cfg, det.calibrate(Array.from({ length: 3000 }, src), cfg));
  }

  const inst = det.make(cfg);
  for (let t = 0; t < T; t++) {
    let x = draw();
    if (inject && t >= NU) x = inject(x, t);
    if (inst.step(x)) {
      if (!Number.isFinite(inst.logM())) throw new Error(`non-finite logM at fire, t=${t}`);
      return t;
    }
  }
  if (!Number.isFinite(inst.logM())) throw new Error('non-finite logM at horizon');
  return -1;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

// ── arm A ──
function arlCell(det, nullSpec, alpha) {
  const runLengths = []; let exceptions = 0, fires300 = 0, firesT = 0;
  for (let i = 0; i < N; i++) {
    let t;
    try { t = trajectory(det, nullSpec, alpha, SEED_A + i * 7919, T_ARL); }
    catch (e) { exceptions++; continue; }                       // §6: counted, printed, excluded
    const nStar = t < 0 ? Infinity : t + 1;
    if (nStar <= 300) fires300++;
    if (nStar <= T_ARL) firesT++;
    runLengths.push(Math.min(nStar, T_ARL));
  }
  const n = runLengths.length;
  const sorted = [...runLengths].sort((a, b) => a - b);
  const pT = firesT / n;
  return {
    detector_id: det.id, family: det.family, null_id: nullSpec.id, null_label: nullSpec.label, alpha,
    scored: ALPHAS_SCORED.includes(alpha), n, T: T_ARL,
    fires_300: fires300, p_alarm_300: fires300 / n,
    fires_T: firesT, p_alarm_T: pT, censored_fraction: 1 - pT,
    arl0_T: mean(runLengths),
    median_run_length: pT >= 0.5 ? quantile(sorted, 0.5) : null,
    median_run_length_note: pT >= 0.5 ? null : `> ${T_ARL}`,
    exceptions, not_executable: exceptions > 0.01 * N,
  };
}

// ── arm B ──
function delayCell(pair, nullSpec, alpha) {
  const { det, inj } = pair; const apply = INJECT[inj].apply;
  const delays = []; let exceptions = 0, pre = 0, detected = 0;
  for (let i = 0; i < N; i++) {
    let t;
    try { t = trajectory(det, nullSpec, alpha, SEED_B + i * 7919 + SALT[inj], T_DELAY, apply); }
    catch (e) { exceptions++; continue; }
    const nStar = t < 0 ? Infinity : t + 1;
    if (nStar <= NU) { pre++; continue; }                        // alarm before the first injected observation
    const D = nStar === Infinity ? Infinity : nStar - NU;
    if (D <= T_DELAY - NU) detected++;
    delays.push(Math.min(D, T_DELAY - NU));
  }
  const n = N - exceptions, nPost = delays.length;
  const sorted = [...delays].sort((a, b) => a - b);
  const pDet = nPost ? detected / nPost : null;
  const q = (p) => (nPost && quantile(sorted, p) < T_DELAY - NU ? quantile(sorted, p) : null);
  return {
    detector_id: det.id, family: det.family, injection: inj, injection_label: INJECT[inj].label,
    class_own: pair.own, null_id: nullSpec.id, null_label: nullSpec.label, alpha,
    scored: ALPHAS_SCORED.includes(alpha), n, T: T_DELAY, nu: NU,
    n_post_onset: nPost, p_pre_onset_alarm: pre / n, p_detect: pDet,
    delay_mean_censored: nPost ? mean(delays) : null,
    delay_median: q(0.5), delay_p90: q(0.9),
    censored: nPost - detected, exceptions, not_executable: exceptions > 0.01 * N,
  };
}

// ── gates (§4) ──
function readBattery(det, nullId, alpha) {
  const run = nullId === 'N8' ? BATTERY_RUNS.N8 : BATTERY_RUNS.default;
  const p = path.join(ROOT, 'validation', 'h0-battery', 'results', 'live', run, 'cells', `${det}__${nullId}__a${alpha}.json`);
  return { run, fires: JSON.parse(fs.readFileSync(p, 'utf8')).fires };
}
function gates(arl, delay) {
  const g1 = [];
  for (const c of arl) {
    if (!c.scored) continue;
    const b = readBattery(c.detector_id, c.null_id, c.alpha);
    const pbar = (c.fires_300 + b.fires) / (c.n + 2000);
    const tol = Math.max(3, 3 * Math.sqrt(2 * 2000 * pbar * (1 - pbar)));
    const diff = Math.abs(c.fires_300 - b.fires);
    g1.push({ detector_id: c.detector_id, null_id: c.null_id, alpha: c.alpha, fires_300: c.fires_300,
      battery_fires: b.fires, battery_run: b.run, diff, tol, pass: diff <= tol, exact: diff === 0 });
  }
  const g1Fail = g1.filter((x) => !x.pass).length;
  const g2 = delay.filter((c) => c.class_own && c.null_id === 'N1' && c.alpha === 0.05)
    .map((c) => ({ detector_id: c.detector_id, injection: c.injection, p_detect: c.p_detect,
      executable: c.p_detect !== null && c.p_detect >= 0.5 }));
  const G3_CELLS = { family_A_betting_e_process: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'],
    family_A_mixture_supermartingale: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], family_C_safe_hotelling: ['N1'] };
  const g3 = [];
  for (const c of arl) {
    if (!c.scored || !(G3_CELLS[c.detector_id] ?? []).includes(c.null_id)) continue;
    const bound = c.alpha + 3 * Math.sqrt(c.alpha * (1 - c.alpha) / 2000);
    g3.push({ detector_id: c.detector_id, null_id: c.null_id, alpha: c.alpha, p_alarm_T: c.p_alarm_T, bound, pass: c.p_alarm_T <= bound });
  }
  return {
    G1: { cells: g1, n_cells: g1.length, n_fail: g1Fail, n_exact: g1.filter((x) => x.exact).length,
      verdict: g1.length === 104 ? (g1Fail <= 2 ? 'HELD' : 'FAILED') : 'PARTIAL' },
    G2: { pairs: g2 },
    G3: { cells: g3, n_cells: g3.length, n_fail: g3.filter((x) => !x.pass).length,
      verdict: g3.length === 18 ? (g3.every((x) => x.pass) ? 'HELD' : 'FAILED') : 'PARTIAL' },
  };
}

// ── run ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });
const t0 = Date.now();

const arl = [];
for (const det of DETS) for (const ns of NULLS_ALL) for (const alpha of ALPHAS) {
  const c = arlCell(det, ns, alpha); arl.push(c);
  console.log(`A ${det.id.padEnd(34)} ${ns.id.padEnd(12)} a=${String(alpha).padEnd(6)} p300=${c.p_alarm_300.toFixed(4)} pT=${c.p_alarm_T.toFixed(4)} arl0_T=${c.arl0_T.toFixed(1)} exc=${c.exceptions}`);
}
const delay = [];
for (const pair of PAIRS) for (const ns of NULLS_ALL) for (const alpha of ALPHAS) {
  const c = delayCell(pair, ns, alpha); delay.push(c);
  console.log(`B ${pair.det.id.padEnd(34)} ${pair.inj} ${ns.id.padEnd(12)} a=${String(alpha).padEnd(6)} pre=${c.p_pre_onset_alarm.toFixed(4)} pdet=${c.p_detect === null ? 'n/a' : c.p_detect.toFixed(4)} delay=${c.delay_mean_censored === null ? 'n/a' : c.delay_mean_censored.toFixed(1)} exc=${c.exceptions}`);
}
const g = (MODE === 'live' && !ONLY) || QUICK ? gates(arl, delay) : gates(arl, delay);

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const gitSha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const engineVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(runDir, 'arl.json'), JSON.stringify(arl, null, 2));
fs.writeFileSync(path.join(runDir, 'delay.json'), JSON.stringify(delay, null, 2));
fs.writeFileSync(path.join(runDir, 'gates.json'), JSON.stringify(g, null, 2));
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-09-arl-delay', mode: MODE, quick: QUICK, partial: ONLY ? { only: ONLY } : null,
  engine_version: engineVersion, git_sha: gitSha, node: process.version,
  registration: { file: 'validation/arl-delay/PREREGISTRATION.md', sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')) },
  harness_sha256: sha256(fileURLToPath(import.meta.url)),
  n: N, T_arl: T_ARL, T_delay: T_DELAY, nu: NU, alphas_scored: ALPHAS_SCORED, alpha_shipped: ALPHA_SHIPPED,
  seeds: { arm_A: `${SEED_A} + 7919*i (the h0-battery scheme)`, arm_B: `${SEED_B} + 7919*i + SALT[injection]`, salt: SALT },
  battery_runs_read_for_G1: BATTERY_RUNS, out_of_scope_inherited: OUT_OF_SCOPE,
  not_defined: ['safe_t_e_value', 'universal_inference_e_value'],
  missing_no_adapter: ['group_average_e_value', 'point_tail_bet_e_value', 'spectral_bet_e_process', 'shape_block_conformal_bet', 'shape_ecdf_accumulator', 'sequential_mmd_betting_e_process', 'family_E_conformal', 'family_E_conformal_heldout', 'sequential_ui_e_process'],
  wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2),
}, null, 2));
console.log(`\n${arl.length} ARL cells, ${delay.length} delay cells -> ${path.relative(STUDY, runDir)}  G1=${g.G1.verdict} (${g.G1.n_fail} fail, ${g.G1.n_exact} exact) G3=${g.G3.verdict}  ${Math.round((Date.now() - t0) / 1000)}s`);
