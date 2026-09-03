// validation/e-sr-mean-shift/harness/run.mjs — the registered harness for 2026-09-e-sr-delay
// (PREREGISTRATION.md §2–§3 and Amendment A1). Imports the h0-battery's nulls and comparator
// adapters unchanged; the trajectory construction is validation/arl-delay/harness/run.mjs's,
// so the e-SR and the two Family A comparators see identical draws in every cell.
//
//   node validation/e-sr-mean-shift/harness/run.mjs --mode live
//   node validation/e-sr-mean-shift/harness/run.mjs --mode sim --quick     (N = 20, never scored)
//
// Cells carry `detector_id`, never `detector` (Amendment v1.C66, C66.4).

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, NULLS } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';

const require = createRequire(import.meta.url);
const esr = require('../../../dist/detectors/e-sr-mean-shift.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants ──
const N = QUICK ? 20 : 2000;
const SEED = 20260904;
const SALT = { H1: 0, H2: 1_000_003, H3: 2_000_003, H4: 3_000_003, H5: 4_000_003 };
const ALPHA_ARL = [1e-2, 1e-3], ALPHA_SHIPPED = 1e-4;
const SIGMA = 1;
const nullById = (id) => NULLS.find((n) => n.id === id);

// ── the e-SR adapter, the battery's make(cfg) → {step, logM} shape ──
const ESR = {
  id: 'e_sr_mean_shift', family: 'SR', windowed: false,
  make(cfg, lambdas) {
    const params = lambdas ? { alpha_arl: cfg.alpha, lambdas } : { alpha_arl: cfg.alpha };
    const st = esr.freshESrMeanShiftState(params);
    let prev = null;
    return {
      step(x) {
        const r = esr.standardizeAr1Residual(x, prev, cfg.mu, cfg.sigma, cfg.phi ?? 0);
        prev = x;
        return esr.evaluateESrMeanShift(r, params, st).fired;
      },
      logM: () => st.log_M,
      state: st,
    };
  },
};
const COMPARATORS = DETECTORS.filter((d) => d.family === 'A');

/** Trajectory construction copied from validation/arl-delay/harness/run.mjs (itself from
 *  h0-battery/harness/run.mjs:44-79). Returns { tick (0-indexed first fire or -1), inst }. */
function trajectory(det, nullSpec, alpha, seed, T, opts = {}) {
  const r = rng(seed);
  const src = nullSpec.gen(r);
  const cfg = { mu: 0, sigma: 1, phi: nullSpec.params === 'oracle' ? (nullSpec.phi ?? 0) : 0, alpha, windows: nullSpec.windows };
  if (nullSpec.params === 'estimated') {
    const cal = Array.from({ length: nullSpec.m }, src);
    const mu = cal.reduce((a, b) => a + b, 0) / cal.length;
    const sd = Math.sqrt(cal.reduce((a, b) => a + (b - mu) ** 2, 0) / cal.length) || 1;
    let num = 0, den = 0;
    for (let i = 1; i < cal.length; i++) { num += (cal[i] - mu) * (cal[i - 1] - mu); }
    for (let i = 0; i < cal.length; i++) { den += (cal[i] - mu) ** 2; }
    Object.assign(cfg, { mu, sigma: sd, phi: den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0 });
  }
  const inst = det.make(cfg, opts.lambdas);
  const nu = opts.nu ?? Infinity, delta = opts.delta ?? 0;
  for (let t = 0; t < T; t++) {
    let x = src();
    if (t >= nu) x += delta * SIGMA;
    if (opts.onTick) opts.onTick(t, x, inst);
    if (opts.noThreshold) continue;
    if (inst.step(x)) return { tick: t, inst };
  }
  return { tick: -1, inst };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

function arlCell(det, nullId, alpha, T, salt, tag) {
  const ns = nullById(nullId); const rl = []; let fires = 0, exceptions = 0;
  for (let i = 0; i < N; i++) {
    let t; try { t = trajectory(det, ns, alpha, SEED + 7919 * i + salt, T).tick; } catch (e) { exceptions++; continue; }
    const nStar = t < 0 ? Infinity : t + 1; if (nStar <= T) fires++; rl.push(Math.min(nStar, T));
  }
  const pT = fires / rl.length;
  return { detector_id: det.id, hypothesis: tag, null_id: nullId, alpha, T, n: rl.length, p_alarm_T: pT, arl0_T: mean(rl),
    median_run_length: pT >= 0.5 ? q([...rl].sort((a, b) => a - b), 0.5) : null, exceptions };
}

function delayCell(det, nullId, alpha, nu, delta, T, salt, tag) {
  const ns = nullById(nullId); const delays = []; let pre = 0, detected = 0, exceptions = 0;
  for (let i = 0; i < N; i++) {
    let t; try { t = trajectory(det, ns, alpha, SEED + 7919 * i + salt, T, { nu, delta }).tick; } catch (e) { exceptions++; continue; }
    const nStar = t < 0 ? Infinity : t + 1;
    if (nStar <= nu) { pre++; continue; }
    const D = nStar === Infinity ? Infinity : nStar - nu; if (D <= T - nu) detected++; delays.push(Math.min(D, T - nu));
  }
  const n = N - exceptions, nPost = delays.length; const s = [...delays].sort((a, b) => a - b);
  return { detector_id: det.id, hypothesis: tag, null_id: nullId, alpha, nu, delta, T, n, n_post_onset: nPost,
    p_pre_onset_alarm: pre / n, p_detect: nPost ? detected / nPost : null,
    delay_mean_censored: nPost ? mean(delays) : null, delay_median: nPost ? q(s, 0.5) : null, delay_p90: nPost ? q(s, 0.9) : null,
    censored: nPost - detected, exceptions };
}

// Theorem 4.3 + Proposition B.2 bound, from the registered grid (ψ*(∆) = ∆²/2, ratio 144)
function delayBound(alpha, delta) {
  let g = Infinity;
  for (let eta = 1.001; eta <= 8; eta += 0.001) g = Math.min(g, eta * Math.log(1 / alpha) + Math.log(1 + Math.log(144) / Math.log(eta)));
  const D = delta * delta / 2, V = delta * delta;
  return { g_alpha: g, bound: g / D + V / (D * D) + 1 };
}

const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });
const log = (s) => console.log(s);

// ── H1 ──
const h1 = { cells: [], reported: [] };
for (const nullId of ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6']) {
  for (const alpha of [...ALPHA_ARL, ALPHA_SHIPPED]) {
    const T = alpha === ALPHA_SHIPPED ? 20000 : Math.round(20 / alpha);
    const c = arlCell(ESR, nullId, alpha, T, SALT.H1, 'H1');
    c.claimed = ['N1', 'N3-p03', 'N3-p06', 'N3-p09'].includes(nullId) && alpha !== ALPHA_SHIPPED;
    c.pass = c.claimed ? c.arl0_T >= 1 / alpha : null;
    (c.claimed ? h1.cells : h1.reported).push(c);
    log(`H1 ${nullId.padEnd(8)} a=${alpha} T=${T} pT=${c.p_alarm_T.toFixed(4)} arl0=${c.arl0_T.toFixed(1)} ${c.claimed ? (c.pass ? 'pass' : 'FAIL') : 'reported'}`);
  }
}
h1.verdict = h1.cells.length === 8 ? (h1.cells.every((c) => c.pass) ? 'HELD' : 'FAILED') : 'PARTIAL';

// ── H2 ──
const h2 = { cells: [] };
for (const nu of [200, 1000, 2000]) for (const alpha of [1e-3, ALPHA_SHIPPED]) for (const det of [ESR, ...COMPARATORS]) {
  const c = delayCell(det, 'N1', alpha, nu, 1.5, nu + 800, SALT.H2, 'H2'); h2.cells.push(c);
  log(`H2 ${det.id.padEnd(32)} nu=${nu} a=${alpha} pre=${c.p_pre_onset_alarm.toFixed(4)} pdet=${c.p_detect?.toFixed(4)} delay=${c.delay_mean_censored?.toFixed(1)}`);
}
const h2find = (id, nu) => h2.cells.find((c) => c.detector_id === id && c.nu === nu && c.alpha === 1e-3);
{
  const e200 = h2find(ESR.id, 200), e2000 = h2find(ESR.id, 2000), m2000 = h2find('family_A_mixture_supermartingale', 2000);
  h2.a = { esr_nu200: e200.delay_mean_censored, esr_nu2000: e2000.delay_mean_censored, pass: e2000.delay_mean_censored <= 1.5 * e200.delay_mean_censored };
  h2.b = { esr_nu2000: e2000.delay_mean_censored, mixture_nu2000: m2000.delay_mean_censored, pass: e2000.delay_mean_censored <= 0.5 * m2000.delay_mean_censored };
  h2.verdict = h2.a.pass && h2.b.pass ? 'HELD' : 'FAILED';
}

// ── H3 ──
const h3 = { cells: [] };
for (const delta of [0.75, 1.5, 3]) {
  const c = delayCell(ESR, 'N1', 1e-3, 200, delta, 1000, SALT.H3, 'H3'); Object.assign(c, delayBound(1e-3, delta));
  c.pass = c.delay_mean_censored <= c.bound; h3.cells.push(c);
  log(`H3 delta=${delta} delay=${c.delay_mean_censored.toFixed(1)} bound=${c.bound.toFixed(1)} ${c.pass ? 'pass' : 'FAIL'}`);
}
h3.verdict = h3.cells.every((c) => c.pass) ? 'HELD' : 'FAILED';

// ── H4 ──
const h4 = { cells: [] };
for (const nullId of ['N2-m30', 'N2-m100', 'N2-m500']) {
  const c = arlCell(ESR, nullId, 1e-3, 20000, SALT.H4, 'H4'); h4.cells.push(c);
  log(`H4 ${nullId} pT=${c.p_alarm_T.toFixed(4)} arl0=${c.arl0_T.toFixed(1)}`);
}
h4.a = { pass: h4.cells[0].arl0_T <= h4.cells[1].arl0_T && h4.cells[1].arl0_T <= h4.cells[2].arl0_T };
h4.b = { arl0_m30: h4.cells[0].arl0_T, pass: h4.cells[0].arl0_T < 1000 };
h4.verdict = h4.a.pass && h4.b.pass ? 'HELD' : 'FAILED';

// ── H5 (Amendment A1) ──
const h5 = {};
{
  const T = 1000, K = esr.E_SR_LAMBDA_GRID.length; const sum = Array(K).fill(0), sumsq = Array(K).fill(0); let cnt = 0; const fullM = []; let exc = 0;
  for (let i = 0; i < N; i++) {
    try {
      const { inst } = trajectory(ESR, nullById('N1'), 1e-3, SEED + 7919 * i + SALT.H5, T, { noThreshold: true, onTick: (t, x, ins) => {
        const r = esr.standardizeAr1Residual(x, null, 0, 1, 0);
        for (let k = 0; k < K; k++) { const lam = esr.E_SR_LAMBDA_GRID[k]; const L = Math.exp(lam * r - 0.5 * lam * lam); sum[k] += L; sumsq[k] += L * L; }
        cnt++; ins.step(x);
      } });
      fullM.push(Math.exp(inst.logM()));
    } catch (e) { exc++; }
  }
  h5.a = { cells: esr.E_SR_LAMBDA_GRID.map((lam, k) => { const m = sum[k] / cnt; const se = Math.sqrt(Math.max(0, sumsq[k] / cnt - m * m) / cnt); return { lambda: lam, mean_L: m, se, pass: Math.abs(m - 1) <= 3 * se }; }), n_pairs: cnt };
  h5.a.verdict = h5.a.cells.every((c) => c.pass) ? 'HELD' : 'FAILED';
  h5.full_grid_mean_M_1000 = { mean: mean(fullM), T, note: 'the unmeasurable quantity (terminal-mean trap), reported not scored' };
  const Ms = []; for (let i = 0; i < N; i++) { const { inst } = trajectory(ESR, nullById('N1'), 1e-3, SEED + 7919 * i + SALT.H5, 20, { noThreshold: true, lambdas: [0.25, -0.25], onTick: (t, x, ins) => ins.step(x) }); Ms.push(Math.exp(inst.logM())); }
  const m20 = mean(Ms);
  h5.b = { mean_M_20: m20, band: [16, 24], pass: m20 >= 16 && m20 <= 24 && m20 > 5 };
  h5.verdict = h5.a.verdict === 'HELD' && h5.b.pass ? 'HELD' : 'FAILED';
  log(`H5a ${h5.a.verdict} (worst |mean−1|/se = ${Math.max(...h5.a.cells.map((c) => Math.abs(c.mean_L - 1) / c.se)).toFixed(2)})  H5b mean M_20 = ${m20.toFixed(2)} ${h5.b.pass ? 'pass' : 'FAIL'}  full-grid mean M_1000 = ${h5.full_grid_mean_M_1000.mean.toFixed(1)}  exc=${exc}`);
}

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const gitSha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
for (const [name, obj] of Object.entries({ h1, h2, h3, h4, h5 })) fs.writeFileSync(path.join(runDir, `${name}.json`), JSON.stringify(obj, null, 2));
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-09-e-sr-delay', mode: MODE, quick: QUICK, git_sha: gitSha, node: process.version,
  engine_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
  registration: { file: 'validation/e-sr-mean-shift/PREREGISTRATION.md', sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')) },
  module: { file: 'detectors/e-sr-mean-shift.ts', sha256: sha256(path.join(ROOT, 'detectors', 'e-sr-mean-shift.ts')) },
  harness_sha256: sha256(fileURLToPath(import.meta.url)), n: N, seed: SEED, salt: SALT, alpha_arl: ALPHA_ARL, alpha_shipped: ALPHA_SHIPPED,
  lambda_grid: esr.E_SR_LAMBDA_GRID, verdicts: { H1: h1.verdict, H2: h2.verdict, H3: h3.verdict, H4: h4.verdict, H5: h5.verdict },
  wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2),
}, null, 2));
log(`\n-> ${path.relative(STUDY, runDir)}  H1=${h1.verdict} H2=${h2.verdict} H3=${h3.verdict} H4=${h4.verdict} H5=${h5.verdict}  ${Math.round((Date.now() - t0) / 1000)}s`);
