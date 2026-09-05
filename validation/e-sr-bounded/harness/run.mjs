// validation/e-sr-bounded/harness/run.mjs — the registered harness for 2026-09-e-sr-bounded
// (PREREGISTRATION.md §3–§4). Adapter and trajectory construction copied from
// validation/e-detector-cert/harness/run.mjs; nulls imported from the h0-battery unchanged.
// S2/S3 cells carry `detector: 'e_sr_mean_shift_bounded'` (pooled by the certification collector);
// the H2 comparator and H3 estimator cells carry `detector_id` only and pool nowhere.
//
//   node validation/e-sr-bounded/harness/run.mjs --mode live
//   node validation/e-sr-bounded/harness/run.mjs --mode sim --quick     (N = 20, never scored)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, NULLS, N8_COMBINED } from '../../h0-battery/harness/nulls.mjs';
import { effectiveShift, eDetectorDelayBound } from '../../certification/lib/constants.mjs';
import { render } from '../analysis/report.mjs';

const require = createRequire(import.meta.url);
const esr = require('../../../dist/detectors/e-sr-mean-shift.js');
const monitor = require('../../../dist/fleet/calibration-monitor.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (PREREGISTRATION §3) ──
const DETECTOR = 'e_sr_mean_shift_bounded';
const COMPARATOR = 'e_sr_mean_shift';
const N = QUICK ? 20 : 2000;
const N_S2 = QUICK ? 20 : 20000; // Amendment A1.1
const SEED = 20260906;
const SALT = { S2: 0, S3: (k) => 1_000_003 + 100 * k, H2: 2_000_003, H3: 3_000_003 };
const ALPHA_ARL = 1e-3;
const T_S2 = 20_000;
const NU = 200, T_S3 = 1_200;
const T_H3 = 1_000;
const GRID = [{ k: 0, delta: 0.75, severity: '0.75sigma', canonical: false }, { k: 1, delta: 1.5, severity: '1.5sigma', canonical: true }, { k: 2, delta: 3, severity: '3sigma', canonical: false }];
const IN_CLASS = ['N1', 'N2-m30', 'N2-m100', 'N2-m500', 'N3-p03', 'N3-p06', 'N3-p09', 'N4-p06-m100', 'N4-p09-m100', 'N7', 'N5', 'N6', 'N8'];
const Z = 1.645;
const SIGMA = 1;
const GAUSSIAN_M30_REFERENCE = 1148; // e-detector-cert A1 re-run, N = 20,000 (PREREGISTRATION §4 H4)
const N5_CLIPPED_MEAN = -0.0093;     // per unit lambda: E[clip(r)]/B with E[clip(r)] ≈ -0.028 (PREREGISTRATION §2)
const ALL_NULLS = [...NULLS, N8_COMBINED];
const nullById = (id) => { const n = ALL_NULLS.find((x) => x.id === id); if (!n) throw new Error(`no null ${id}`); return n; };
const BOUNDED_GRID = esr.E_SR_BOUNDED_LAMBDA_GRID;

// ── the adapter: the module itself, with its own contract asserted every tick ──
function makeDetector(cfg, increment) {
  const params = increment === 'default' ? { alpha_arl: cfg.alpha } : { alpha_arl: cfg.alpha, increment };
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
      return out.fired;
    },
    residual(x) { const r = esr.standardizeAr1Residual(x, prev, cfg.mu, cfg.sigma, cfg.phi ?? 0); prev = x; return r; },
    logM: () => st.log_M,
  };
}

/** The battery's calibration on an 'estimated' null; oracle otherwise. */
function configFor(nullSpec, src, alpha) {
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
  return cfg;
}

/** Returns the 0-indexed first-fire tick (or -1) per increment; `increments` runs several detectors on identical draws. */
function trajectory(nullSpec, alpha, seed, T, opts = {}) {
  const r = rng(seed);
  const src = nullSpec.gen(r);
  const cfg = configFor(nullSpec, src, alpha);
  const incs = opts.increments ?? ['bounded'];
  const insts = incs.map((inc) => makeDetector(cfg, inc));
  const fired = incs.map(() => -1);
  const nu = opts.nu ?? Infinity, delta = opts.delta ?? 0;
  for (let t = 0; t < T; t++) {
    let x = src();
    if (t >= nu) x += delta * SIGMA;
    for (let j = 0; j < insts.length; j++) if (fired[j] < 0 && insts[j].step(x)) fired[j] = t;
    if (fired.every((f) => f >= 0)) break;
  }
  return fired;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const genPhi = (ns) => ns.phi ?? 0;
const base = (ns) => ({ detector: DETECTOR, null_id: ns.id, params: ns.params, phi: genPhi(ns), ...(ns.params === 'estimated' ? { m: ns.m } : {}), alpha_arl: ALPHA_ARL });

function runLengths(nullId, salt, T, increments) {
  const ns = nullById(nullId); const rl = increments.map(() => []);
  for (let i = 0; i < N_S2; i++) {
    const ts = trajectory(ns, ALPHA_ARL, SEED + 7919 * i + salt, T, { increments });
    ts.forEach((t, j) => rl[j].push(Math.min(t < 0 ? Infinity : t + 1, T)));
  }
  return rl;
}

function arlSummary(rl) {
  const fires = rl.filter((x) => x <= T_S2).length;
  const arl0 = mean(rl), se = sd(rl) / Math.sqrt(rl.length);
  const floor = 1 / ALPHA_ARL;
  const verdict = arl0 - Z * se >= floor ? 'not-refuted' : arl0 + Z * se < floor ? 'FAIL' : 'INCONCLUSIVE';
  const pT = fires / rl.length;
  return { T: T_S2, n: rl.length, p_alarm_T: pT, arl0_T: arl0, arl0_se: se, arl0_lower95: arl0 - Z * se,
    median_run_length: pT >= 0.5 ? q([...rl].sort((a, b) => a - b), 0.5) : null, verdict, exceptions: 0 };
}
/** S2 cell (pooled) plus the identical-draws Gaussian comparator (Amendment A1.2, unpooled). */
function arlCell(nullId) {
  const ns = nullById(nullId);
  const [rlB, rlG] = runLengths(nullId, SALT.S2, T_S2, ['bounded', 'gaussian']);
  const cell = { ...base(ns), ...arlSummary(rlB) };
  const comparator = { detector_id: COMPARATOR, hypothesis: 'H4-comparator', null_id: ns.id, params: ns.params, phi: genPhi(ns), ...(ns.params === 'estimated' ? { m: ns.m } : {}), alpha_arl: ALPHA_ARL, ...arlSummary(rlG), ratio_bounded_over_gaussian: cell.arl0_T / mean(rlG) };
  return { cell, comparator };
}

function delayStats(nullId, salt, T, nu, delta, increments) {
  const ns = nullById(nullId); const out = increments.map(() => ({ delays: [], pre: 0, detected: 0 }));
  for (let i = 0; i < N; i++) {
    const ts = trajectory(ns, ALPHA_ARL, SEED + 7919 * i + salt, T, { nu, delta, increments });
    ts.forEach((t, j) => {
      const nStar = t < 0 ? Infinity : t + 1;
      if (nStar <= nu) { out[j].pre++; return; }
      const D = nStar === Infinity ? Infinity : nStar - nu; if (D <= T - nu) out[j].detected++; out[j].delays.push(Math.min(D, T - nu));
    });
  }
  return out.map((o) => {
    const s = [...o.delays].sort((a, b) => a - b), nCond = o.delays.length;
    return { p_pre_onset_alarm: o.pre / N, n_conditional: nCond, detection_rate: nCond ? o.detected / nCond : null,
      delay_mean: nCond ? mean(o.delays) : null, delay_se: nCond > 1 ? sd(o.delays) / Math.sqrt(nCond) : null,
      delay_median: nCond ? q(s, 0.5) : null, delay_p90: nCond ? q(s, 0.9) : null, censored: nCond ? (nCond - o.detected) / nCond : null };
  });
}

function delayCell(nullId, g) {
  const ns = nullById(nullId);
  const [d] = delayStats(nullId, SALT.S3(g.k), T_S3, NU, g.delta, ['bounded']);
  const phi = genPhi(ns), deltaEff = effectiveShift(g.delta, phi);
  const bound = eDetectorDelayBound(ALPHA_ARL, deltaEff, 'bounded').bound;
  const upper = d.delay_mean != null && d.delay_se != null ? d.delay_mean + Z * d.delay_se : null;
  const verdict = g.canonical ? (d.censored > 0.01 ? 'CENSORED' : upper <= bound ? 'WITHIN_BOUND' : 'SLOW')
    : (g.delta === 3 ? (d.detection_rate >= 0.10 ? 'POWERED' : 'INERT') : 'REPORTED');
  return { ...base(ns), T: T_S3, nu: NU, shift_sigma: g.delta, fault_class: 'K1', severity: g.severity, canonical: g.canonical,
    n: N, p_pre_onset_alarm: d.p_pre_onset_alarm, n_conditional: d.n_conditional, detection_rate: d.detection_rate,
    delay_canonical: d.delay_mean, delay_se: d.delay_se, delay_upper95: upper, delay_median: d.delay_median, delay_p90: d.delay_p90,
    censored: d.censored, delta_eff: deltaEff, delay_bound_registered: bound, verdict, exceptions: 0 };
}

/** H2: both increments on identical N1 draws at the K1 canonical. */
function h2() {
  const [b, gsn] = delayStats('N1', SALT.H2, T_S3, NU, 1.5, ['bounded', 'gaussian']);
  const row = (id, d, bound) => ({ detector_id: id, hypothesis: 'H2', null_id: 'N1', alpha_arl: ALPHA_ARL, nu: NU, T: T_S3, shift_sigma: 1.5, n: N, ...d, bound_registered: bound });
  const cells = [row(DETECTOR, b, eDetectorDelayBound(ALPHA_ARL, 1.5, 'bounded').bound), row(COMPARATOR, gsn, eDetectorDelayBound(ALPHA_ARL, 1.5).bound)];
  const ratio = b.delay_mean / gsn.delay_mean;
  return { cells, ratio, predicted_ratio: 1.125 / 0.3442, both_under_bound: b.delay_mean + Z * b.delay_se <= cells[0].bound_registered && gsn.delay_mean + Z * gsn.delay_se <= cells[1].bound_registered,
    verdict: 'REPORTED' };
}

/** H3: the increment estimator per λ on every null, no threshold; se ACROSS TRAJECTORIES (Amendment
 *  A1.3: a trajectory's calibration error is frozen, so its T pairs are not independent); N5 against
 *  the derived offset. */
function h3() {
  const K = BOUNDED_GRID.length; const cells = [];
  for (const id of IN_CLASS) {
    const ns = nullById(id); const perTraj = Array.from({ length: K }, () => []);
    for (let i = 0; i < N; i++) {
      const r = rng(SEED + 7919 * i + SALT.H3); const src = ns.gen(r); const cfg = configFor(ns, src, ALPHA_ARL);
      const det = makeDetector(cfg, 'bounded'); const sum = Array(K).fill(0);
      for (let t = 0; t < T_H3; t++) {
        const res = det.residual(src());
        for (let k = 0; k < K; k++) sum[k] += monitor.gBounded(res, BOUNDED_GRID[k]);
      }
      for (let k = 0; k < K; k++) perTraj[k].push(sum[k] / T_H3);
    }
    BOUNDED_GRID.forEach((lam, k) => {
      const m = mean(perTraj[k]); const se = sd(perTraj[k]) / Math.sqrt(N);
      const expected = id === 'N5' ? 1 + lam * N5_CLIPPED_MEAN : 1;
      cells.push({ detector_id: DETECTOR, hypothesis: 'H3', null_id: id, lambda: lam, n_trajectories: N, ticks_per_trajectory: T_H3, mean_g: m, se, expected, z: (m - expected) / se, pass: Math.abs(m - expected) <= 3 * se });
    });
  }
  // mean M_20 on the two-point grid ±0.1 (the H5b instrument), N1
  const Ms = [];
  for (let i = 0; i < N; i++) {
    const r = rng(SEED + 7919 * i + SALT.H3); const src = nullById('N1').gen(r);
    const p = { alpha_arl: ALPHA_ARL, increment: 'bounded', lambdas: [0.1, -0.1] }; const st = esr.freshESrMeanShiftState(p);
    let prev = null, out = null;
    for (let t = 0; t < 20; t++) { const x = src(); out = esr.evaluateESrMeanShift(esr.standardizeAr1Residual(x, prev, 0, 1, 0), p, st); prev = x; }
    Ms.push(Math.exp(out.log_M));
  }
  const m20 = mean(Ms);
  const outsideN5 = cells.filter((c) => c.null_id !== 'N5');
  const n5 = cells.filter((c) => c.null_id === 'N5');
  return { cells, mean_M_20: m20, band: [16, 24], m20_pass: m20 >= 16 && m20 <= 24,
    worst_z_outside_n5: Math.max(...outsideN5.map((c) => Math.abs(c.z))), worst_z_n5_vs_offset: Math.max(...n5.map((c) => Math.abs(c.z))),
    n5_raw_z: n5.map((c) => ({ lambda: c.lambda, z_vs_one: (c.mean_g - 1) / c.se })),
    verdict: outsideN5.every((c) => c.pass) && m20 >= 16 && m20 <= 24 ? 'HELD' : 'FAILED', n5_verdict: n5.every((c) => c.pass) ? 'within-offset' : 'outside-offset' };
}

/** G0: the default is unchanged; the bounded recursion is the SR sum. */
function g0() {
  const r = rng(SEED); const src = nullById('N1').gen(r);
  const a = esr.freshESrMeanShiftState({ alpha_arl: ALPHA_ARL }), b = esr.freshESrMeanShiftState({ alpha_arl: ALPHA_ARL, increment: 'gaussian' });
  let identical = true;
  for (let t = 0; t < 200; t++) { const x = src(); const ra = esr.evaluateESrMeanShift(x, { alpha_arl: ALPHA_ARL }, a), rb = esr.evaluateESrMeanShift(x, { alpha_arl: ALPHA_ARL, increment: 'gaussian' }, b); if (ra.log_M !== rb.log_M) identical = false; }
  const rs = Array.from({ length: 40 }, () => 0.5 + 3 * src());
  const p = { alpha_arl: ALPHA_ARL, increment: 'bounded' }; const st = esr.freshESrMeanShiftState(p);
  for (const x of rs) esr.evaluateESrMeanShift(x, p, st);
  let maxErr = 0;
  BOUNDED_GRID.forEach((lam, k) => { let sum = 0; for (let j = 0; j < rs.length; j++) { let prod = 1; for (let i = j; i < rs.length; i++) prod *= monitor.gBounded(rs[i], lam); sum += prod; } maxErr = Math.max(maxErr, Math.abs(Math.log(sum) - st.log_M_sr[k])); });
  return { default_unchanged: identical, recursion_max_abs_log_error: maxErr, verdict: identical && maxErr < 1e-9 ? 'HELD' : 'FAILED' };
}

// ── run ──
const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const gate0 = g0(); console.log(`G0 ${gate0.verdict}: default unchanged ${gate0.default_unchanged}, recursion error ${gate0.recursion_max_abs_log_error.toExponential(1)}`);
if (gate0.verdict !== 'HELD') { console.error('G0 failed: instrument defect'); process.exit(2); }

const cells = [], comparators = [];
for (const id of IN_CLASS) { const { cell: c, comparator } = arlCell(id); cells.push(c); comparators.push(comparator); console.log(`S2 ${id.padEnd(12)} bounded arl0_T ${c.arl0_T.toFixed(1)} ± ${c.arl0_se.toFixed(1)} → ${c.verdict} | gaussian ${comparator.arl0_T.toFixed(1)} (ratio ${comparator.ratio_bounded_over_gaussian.toFixed(2)})`); }
for (const id of IN_CLASS) for (const g of GRID) { const c = delayCell(id, g); cells.push(c); console.log(`S3 ${id.padEnd(12)} ${g.severity.padEnd(9)} det ${c.detection_rate?.toFixed(3)} delay ${c.delay_canonical?.toFixed(1)} (D* ${c.delay_bound_registered.toFixed(1)}) → ${c.verdict}`); }
const H2 = h2(); console.log(`H2 bounded ${H2.cells[0].delay_mean.toFixed(1)} vs gaussian ${H2.cells[1].delay_mean.toFixed(1)}: ratio ${H2.ratio.toFixed(2)} (predicted ${H2.predicted_ratio.toFixed(2)}), both under bound ${H2.both_under_bound}`);
const H3 = h3(); console.log(`H3 ${H3.verdict}: worst |z| outside N5 ${H3.worst_z_outside_n5.toFixed(2)}; N5 vs offset ${H3.n5_verdict} (worst |z| ${H3.worst_z_n5_vs_offset.toFixed(2)}); mean M_20 ${H3.mean_M_20.toFixed(2)}`);
const s2 = (id) => cells.find((c) => c.null_id === id && 'arl0_T' in c);
const H1 = { cells: IN_CLASS.map((id) => ({ null_id: id, arl0_T: s2(id).arl0_T, arl0_lower95: s2(id).arl0_lower95, token: s2(id).verdict })), verdict: IN_CLASS.every((id) => s2(id).verdict === 'not-refuted') ? 'HELD' : IN_CLASS.some((id) => s2(id).verdict === 'FAIL') ? 'FAILED' : 'INCONCLUSIVE' };
const H4 = { arl0_m30: s2('N2-m30').arl0_T, reference_gaussian: GAUSSIAN_M30_REFERENCE, verdict: s2('N2-m30').arl0_T >= GAUSSIAN_M30_REFERENCE ? 'HELD' : 'FAILED', comparators };
console.log(`H1 ${H1.verdict}; H4 ${H4.verdict} (${H4.arl0_m30.toFixed(1)} vs ${GAUSSIAN_M30_REFERENCE})`);

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = {
  study: '2026-09-e-sr-bounded', run: `run-${stamp}`, mode: MODE, quick: QUICK, tier: 'T1',
  git_sha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
  harness_sha256: sha256(fileURLToPath(import.meta.url)), module_sha256: sha256(path.join(ROOT, 'detectors', 'e-sr-mean-shift.ts')),
  scorer_constants_sha256: sha256(path.join(ROOT, 'validation', 'certification', 'lib', 'constants.mjs')),
  n: N, n_s2: N_S2, seed: SEED, salt: { S2: SALT.S2, S3: GRID.map((g) => SALT.S3(g.k)), H2: SALT.H2, H3: SALT.H3 }, alpha_arl: ALPHA_ARL, T_s2: T_S2, nu: NU, T_s3: T_S3, T_h3: T_H3,
  bounded_grid: [...BOUNDED_GRID], n5_clipped_mean_per_lambda: N5_CLIPPED_MEAN, gaussian_m30_reference: GAUSSIAN_M30_REFERENCE,
  cells: cells.length, exceptions: 0, wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2),
};
const summary = { cells };
const comparison = { G0: gate0, H1, H2, H3, H4 };
fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(summary, comparison, manifest));
console.log(`wrote ${runDir} (${cells.length} cells, ${manifest.wall_seconds} s)`);
