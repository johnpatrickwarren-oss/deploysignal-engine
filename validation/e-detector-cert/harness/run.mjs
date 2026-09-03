// validation/e-detector-cert/harness/run.mjs — the registered harness for 2026-09-e-detector-cert
// (PREREGISTRATION.md §3). Adapter and trajectory construction copied from
// validation/e-sr-mean-shift/harness/run.mjs (which executes on import); nulls imported from the
// h0-battery unchanged. Cells carry `detector` so the certification collector pools them
// (Amendment v1.C69 C69.6 — the C66.4 exclusion reversed for this class only).
//
//   node validation/e-detector-cert/harness/run.mjs --mode live
//   node validation/e-detector-cert/harness/run.mjs --mode sim --quick     (N = 20, never scored)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, NULLS, N8_COMBINED } from '../../h0-battery/harness/nulls.mjs';
import { render } from '../analysis/report.mjs';

const require = createRequire(import.meta.url);
const esr = require('../../../dist/detectors/e-sr-mean-shift.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (PREREGISTRATION §3) ──
const DETECTOR = 'e_sr_mean_shift';
// Amendment A1: `--cells <ids>` re-runs only those S2 cells, `--n` and `--salt-s2` override N and the S2 salt.
const CELLS = arg('--cells', null);
const N = QUICK ? 20 : Number(arg('--n', 2000));
const SEED = 20260905;
const SALT_S2 = Number(arg('--salt-s2', 0)), SALT_S3 = (k) => 1_000_003 + 100 * k;
const ALPHA_ARL = 1e-3;
const T_S2 = 20_000;
const NU = 200, T_S3 = 1_200;
const GRID = [{ k: 0, delta: 0.75, severity: '0.75sigma', canonical: false }, { k: 1, delta: 1.5, severity: '1.5sigma', canonical: true }, { k: 2, delta: 3, severity: '3sigma', canonical: false }];
const IN_CLASS = ['N1', 'N2-m30', 'N2-m100', 'N2-m500', 'N3-p03', 'N3-p06', 'N3-p09', 'N4-p06-m100', 'N4-p09-m100', 'N7'];
const OUT_OF_CLASS = ['N5', 'N6', 'N8'];
const Z = 1.645;
const SIGMA = 1;
const ALL_NULLS = [...NULLS, N8_COMBINED];
const nullById = (id) => { const n = ALL_NULLS.find((x) => x.id === id); if (!n) throw new Error(`no null ${id}`); return n; };

// ── the e-SR adapter: the module itself, with its own contract asserted every tick ──
function makeDetector(cfg) {
  const params = { alpha_arl: cfg.alpha };
  const st = esr.freshESrMeanShiftState(params);
  const logThreshold = Math.log(1 / cfg.alpha);
  let prev = null;
  return {
    step(x) {
      const r = esr.standardizeAr1Residual(x, prev, cfg.mu, cfg.sigma, cfg.phi ?? 0);
      prev = x;
      const out = esr.evaluateESrMeanShift(r, params, st);
      if (!Number.isFinite(out.log_M)) throw new Error(`non-finite log_M at t=${st.t}`);
      if (out.fired !== (out.log_M >= logThreshold)) throw new Error(`fired disagrees with log_M >= log(1/alpha) at t=${st.t}`);
      if (Math.abs(out.log_threshold - logThreshold) > 1e-12) throw new Error('module threshold disagrees with log(1/alpha)');
      return out.fired;
    },
  };
}

/** Copied from validation/e-sr-mean-shift/harness/run.mjs (itself from arl-delay, itself from
 *  h0-battery/harness/run.mjs:44-79). Returns the 0-indexed first-fire tick or -1. */
function trajectory(nullSpec, alpha, seed, T, opts = {}) {
  const r = rng(seed);
  const src = nullSpec.gen(r);
  const cfg = { mu: 0, sigma: 1, phi: nullSpec.params === 'oracle' ? (nullSpec.phi ?? 0) : 0, alpha };
  if (nullSpec.params === 'estimated') {
    const cal = Array.from({ length: nullSpec.m }, src);
    const mu = cal.reduce((a, b) => a + b, 0) / cal.length;
    const sd = Math.sqrt(cal.reduce((a, b) => a + (b - mu) ** 2, 0) / cal.length) || 1;
    let num = 0, den = 0;
    for (let i = 1; i < cal.length; i++) { num += (cal[i] - mu) * (cal[i - 1] - mu); }
    for (let i = 0; i < cal.length; i++) { den += (cal[i] - mu) ** 2; }
    Object.assign(cfg, { mu, sigma: sd, phi: den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0 });
  }
  const inst = makeDetector(cfg);
  const nu = opts.nu ?? Infinity, delta = opts.delta ?? 0;
  for (let t = 0; t < T; t++) {
    let x = src();
    if (t >= nu) x += delta * SIGMA;
    if (inst.step(x)) return t;
  }
  return -1;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const genPhi = (ns) => ns.phi ?? 0;
const base = (ns) => ({ detector: DETECTOR, null_id: ns.id, params: ns.params, phi: genPhi(ns), ...(ns.params === 'estimated' ? { m: ns.m } : {}), alpha_arl: ALPHA_ARL });

function arlCell(nullId) {
  const ns = nullById(nullId); const rl = []; let fires = 0, exceptions = 0;
  for (let i = 0; i < N; i++) {
    const t = trajectory(ns, ALPHA_ARL, SEED + 7919 * i + SALT_S2, T_S2);
    const nStar = t < 0 ? Infinity : t + 1; if (nStar <= T_S2) fires++; rl.push(Math.min(nStar, T_S2));
  }
  const arl0 = mean(rl), se = sd(rl) / Math.sqrt(rl.length);
  const floor = 1 / ALPHA_ARL;
  const verdict = arl0 - Z * se >= floor ? 'not-refuted' : arl0 + Z * se < floor ? 'FAIL' : 'INCONCLUSIVE';
  const pT = fires / rl.length;
  return { ...base(ns), T: T_S2, n: rl.length, p_alarm_T: pT, arl0_T: arl0, arl0_se: se, arl0_lower95: arl0 - Z * se,
    median_run_length: pT >= 0.5 ? q([...rl].sort((a, b) => a - b), 0.5) : null, verdict, exceptions };
}

// Theorem 4.3 + Prop. B.2 at the effective whitened shift, for the reader; the scorer computes its own.
function delayBound(alpha, deltaEff) {
  let g = Infinity;
  for (let eta = 1.001; eta <= 8; eta += 0.001) g = Math.min(g, eta * Math.log(1 / alpha) + Math.log(1 + Math.log(144) / Math.log(eta)));
  const D = deltaEff * deltaEff / 2, V = deltaEff * deltaEff;
  return g / D + V / (D * D) + 1;
}

function delayCell(nullId, g) {
  const ns = nullById(nullId); const delays = []; let pre = 0, detected = 0, exceptions = 0;
  for (let i = 0; i < N; i++) {
    const t = trajectory(ns, ALPHA_ARL, SEED + 7919 * i + SALT_S3(g.k), T_S3, { nu: NU, delta: g.delta });
    const nStar = t < 0 ? Infinity : t + 1;
    if (nStar <= NU) { pre++; continue; }
    const D = nStar === Infinity ? Infinity : nStar - NU; if (D <= T_S3 - NU) detected++; delays.push(Math.min(D, T_S3 - NU));
  }
  const nCond = delays.length; const s = [...delays].sort((a, b) => a - b);
  const dmean = nCond ? mean(delays) : null, dse = nCond > 1 ? sd(delays) / Math.sqrt(nCond) : null;
  const phi = genPhi(ns), deltaEff = g.delta * Math.sqrt((1 - phi) / (1 + phi));
  const bound = delayBound(ALPHA_ARL, deltaEff);
  const detection = nCond ? detected / nCond : null, censored = nCond ? (nCond - detected) / nCond : null;
  const upper = dmean != null && dse != null ? dmean + Z * dse : null;
  const verdict = g.canonical ? (censored > 0.01 ? 'CENSORED' : upper <= bound ? 'WITHIN_BOUND' : 'SLOW')
    : (g.delta === 3 ? (detection >= 0.10 ? 'POWERED' : 'INERT') : 'REPORTED');
  return { ...base(ns), T: T_S3, nu: NU, shift_sigma: g.delta, fault_class: 'K1', severity: g.severity, canonical: g.canonical,
    n: N, p_pre_onset_alarm: pre / N, n_conditional: nCond, detection_rate: detection,
    delay_canonical: dmean, delay_se: dse, delay_upper95: upper, delay_median: nCond ? q(s, 0.5) : null, delay_p90: nCond ? q(s, 0.9) : null,
    censored, delta_eff: deltaEff, delay_bound_registered: bound, verdict, exceptions };
}

const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const cells = [];
const S2_IDS = CELLS ? CELLS.split(',') : [...IN_CLASS, ...OUT_OF_CLASS];
for (const id of S2_IDS) { const c = arlCell(id); cells.push(c); console.log(`S2 ${id}: arl0_T ${c.arl0_T.toFixed(1)} ± ${c.arl0_se.toFixed(1)} → ${c.verdict}`); }
for (const id of CELLS ? [] : IN_CLASS) for (const g of GRID) { const c = delayCell(id, g); cells.push(c); console.log(`S3 ${id} ${g.severity}: det ${c.detection_rate?.toFixed(3)} delay ${c.delay_canonical?.toFixed(1)} (D* ${c.delay_bound_registered.toFixed(1)}) → ${c.verdict}`); }

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = {
  study: '2026-09-e-detector-cert', run: `run-${stamp}`, mode: MODE, quick: QUICK, tier: 'T1',
  git_sha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
  harness_sha256: sha256(fileURLToPath(import.meta.url)), module_sha256: sha256(path.join(ROOT, 'detectors', 'e-sr-mean-shift.ts')),
  n: N, seed: SEED, salt: { S2: SALT_S2, S3: GRID.map((g) => SALT_S3(g.k)) }, cells_arg: CELLS, alpha_arl: ALPHA_ARL, T_s2: T_S2, nu: NU, T_s3: T_S3,
  cells: cells.length, exceptions: cells.reduce((a, c) => a + c.exceptions, 0),
  wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2),
};
const summary = { cells };
fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(summary, manifest));
console.log(`wrote ${runDir} (${cells.length} cells, ${manifest.wall_seconds} s, exceptions ${manifest.exceptions})`);
