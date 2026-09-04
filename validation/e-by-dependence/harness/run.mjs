// validation/e-by-dependence/harness/run.mjs — the registered harness for 2026-09-e-by-dependence
// (PREREGISTRATION.md §2). Structure copied from validation/e-by-fcr/harness/run.mjs (not imported:
// it executes on import). Drives the SHIPPED mixture evaluator per signal under five joint laws of
// the innovations, takes the level-free inputs (S_t, t, σ², ρ) the evidence path carries, and
// reports each selected set's intervals through the shipped e-BY module. No catch anywhere.
//
//   node validation/e-by-dependence/harness/run.mjs --mode live
//   node validation/e-by-dependence/harness/run.mjs --mode sim --quick      (N = 40, never scored)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { render } from '../analysis/report.mjs';

const require = createRequire(import.meta.url);
const mix = require('../../../dist/detectors/family-a-mixture-supermartingale.js');
const eby = require('../../../dist/fleet/e-by.js');
const csm = require('../../../dist/detectors/mixture-confidence-sequence.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (PREREGISTRATION §2) ──
const N = QUICK ? 40 : 2000;
const SEED = 20260911;
const K = 20, L = 5, T = 300;
const ALPHA_DETECTOR = 1e-3;
const RHOS = [1, 38], SHIFTS = [0, 0.75, 1.5], DELTAS = [0.05, 0.10, 0.20];
const TOP = 3, HALF = K / 2;
const NEG = new Set([3, 7, 11, 15, 19]);
const SIGN = Array.from({ length: K }, (_, i) => (NEG.has(i) ? -1 : 1));
/** §2.1: e_{i,t} as a mix of the per-tick common draw z and the idiosyncratic draw e_i. */
const LAWS = [
  { law: 'equi-0.5', sigma2: 1, mix: (z, e) => Math.sqrt(0.5) * z + Math.sqrt(0.5) * e },
  { law: 'equi-0.9', sigma2: 1, mix: (z, e) => Math.sqrt(0.9) * z + Math.sqrt(0.1) * e },
  { law: 'common-mode', sigma2: 4, mix: (z, e) => Math.sqrt(3) * z + e },
  { law: 'coupled', sigma2: 1, mix: (z, _e, i) => SIGN[i] * z },
  { law: 'independent', sigma2: 1, mix: (_z, e) => e },
];
const CELLS = [['A', 'T'], ['A', 'fire'], ['B', 'T'], ['C', 'T']];

// LCG + Box–Muller, the h0-battery's generator.
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
const gauss = (r) => { const u = r() || 1e-12, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const closedForm = (lf, alpha) => { const v = lf.sigma_squared * lf.t + lf.sigma_squared_prior; return Math.sqrt(v * Math.log(v / (alpha * alpha * lf.sigma_squared_prior))) / lf.t; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const se = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length); };

/** One replication under one law: K signals driven tick by tick (the common draw first, then the
 *  K idiosyncratic draws, every law alike), through the shipped evaluator. Returns per-signal
 *  { theta, fired, S_T, proj, lfT, lfFire } and the surface-consistency deviation count. */
function replicate(seed, law, rho, deltaShift) {
  const r = rng(seed);
  const p = { mixture_distribution: 'gaussian', gaussian_sigma_squared_prior: rho };
  const sigs = Array.from({ length: K }, (_, i) => ({
    theta: i < L ? deltaShift : 0, state: mix.freshMixtureSupermartingaleState(), lfFire: null, proj: 0,
  }));
  let surfaceDeviations = 0;
  const x = new Array(K);
  for (let t = 0; t < T; t++) {
    const z = gauss(r);
    for (let i = 0; i < K; i++) x[i] = sigs[i].theta + law.mix(z, gauss(r), i);
    const xbar = mean(x);
    for (let i = 0; i < K; i++) {
      const s = sigs[i];
      const res = mix.evaluatePageCusumMixtureSupermartingale({
        signal: `s${i}`, x_centered: x[i], live_value: x[i], baseline_mean: 0, sigma_squared: law.sigma2, params: p, ar1_phi: 0, state: s.state, alpha: ALPHA_DETECTOR,
      });
      if (!res.confidence_sequence) throw new Error('no confidence_sequence on the Gaussian path');
      const lf = { S_t: s.state.S_t, t: s.state.n, sigma_squared: law.sigma2, sigma_squared_prior: rho };
      if (Math.abs(csm.mixtureConfidenceSequenceAt(lf, ALPHA_DETECTOR).half_width - res.confidence_sequence.half_width) > 1e-12) surfaceDeviations++;
      if (res.fire && s.lfFire === null) s.lfFire = lf;
      s.proj += x[i] * xbar;
    }
  }
  return {
    surfaceDeviations,
    sigs: sigs.map((s) => ({ theta: s.theta, fired: s.lfFire !== null, S_T: s.state.S_t, proj: s.proj,
      lfT: { S_t: s.state.S_t, t: s.state.n, sigma_squared: law.sigma2, sigma_squared_prior: rho }, lfFire: s.lfFire })),
  };
}

const byIndex = (a, b) => a - b;
function select(rule, sigs) {
  if (rule === 'A') return sigs.map((s, i) => (s.fired ? i : -1)).filter((i) => i >= 0);
  if (rule === 'B') return [...sigs.keys()].sort((a, b) => (Math.abs(sigs[b].S_T) - Math.abs(sigs[a].S_T)) || byIndex(a, b)).slice(0, TOP);
  return [...sigs.keys()].sort((a, b) => (sigs[b].proj - sigs[a].proj) || byIndex(a, b)).slice(0, HALF);
}

const newAcc = () => ({ fcp: Object.fromEntries(DELTAS.map((d) => [d, { eby: [], naive: [], ratio: [] }])), sizes: [], deviations: 0, p3Deviations: 0 });

/** Score one selection on one replication into its cell accumulator. */
function score(acc, S, sigs, tau, rho) {
  acc.sizes.push(S.length);
  const lfOf = (j) => (tau === 'fire' ? sigs[j].lfFire : sigs[j].lfT);
  for (const d of DELTAS) {
    const f = acc.fcp[d];
    if (S.length === 0) { f.eby.push(0); f.naive.push(0); continue; }
    const out = eby.eBenjaminiYekutieli(S.map((j) => ({ id: String(j), level_free: lfOf(j) })), K, d);
    let missE = 0, missN = 0;
    for (const [k, j] of S.entries()) {
      const iv = out.intervals[k], lf = lfOf(j);
      if (Math.abs(iv.half_width - closedForm(lf, out.alpha_i)) > 1e-12) acc.deviations++;
      const naive = csm.mixtureConfidenceSequenceAt(lf, d);
      if (sigs[j].theta < iv.lower || sigs[j].theta > iv.upper) missE++;
      if (sigs[j].theta < naive.lower || sigs[j].theta > naive.upper) missN++;
      if (tau === 'T') {
        const ratio = iv.half_width / naive.half_width;
        const v = lf.sigma_squared * lf.t + lf.sigma_squared_prior;
        if (Math.abs(ratio - Math.sqrt(Math.log(v / (out.alpha_i ** 2 * rho)) / Math.log(v / (d * d * rho)))) > 1e-9) acc.p3Deviations++;
        f.ratio.push(ratio);
      }
    }
    f.eby.push(missE / S.length); f.naive.push(missN / S.length);
  }
}

function finish(acc, law, rho, deltaShift, rule, tau, surfaceDeviations) {
  const per_delta = DELTAS.map((d) => {
    const fe = mean(acc.fcp[d].eby), fes = se(acc.fcp[d].eby);
    return { delta: d, fcr_eby: fe, fcr_eby_se: fes, p1: fe <= d + 3 * fes ? 'HELD' : 'FAILED',
      fcr_naive: mean(acc.fcp[d].naive), fcr_naive_se: se(acc.fcp[d].naive), width_ratio_mean: acc.fcp[d].ratio.length ? mean(acc.fcp[d].ratio) : null };
  });
  const p_empty = acc.sizes.filter((s) => s === 0).length / N;
  return { law, sigma_squared: LAWS.find((l) => l.law === law).sigma2, rho, delta_shift: deltaShift, rule, tau, n: N, mean_selected: mean(acc.sizes), p_empty, vacuous: p_empty === 1,
    per_delta, reinversion_deviations: acc.deviations, p3_deviations: acc.p3Deviations, surface_deviations: surfaceDeviations, exceptions: 0 };
}

const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const cells = [];
for (const law of LAWS) {
  let j = 0;
  for (const rho of RHOS) for (const ds of SHIFTS) {
    const salt = 1_000_000 * j++;
    const accs = CELLS.map(() => newAcc());
    let surfaceDeviations = 0;
    for (let i = 0; i < N; i++) {
      const rep = replicate(SEED + 7919 * i + salt, law, rho, ds);
      surfaceDeviations += rep.surfaceDeviations;
      for (const [c, [rule, tau]] of CELLS.entries()) score(accs[c], select(rule, rep.sigs), rep.sigs, tau, rho);
    }
    for (const [c, [rule, tau]] of CELLS.entries()) {
      const cell = finish(accs[c], law.law, rho, ds, rule, tau, surfaceDeviations);
      cells.push(cell);
      console.log(`${law.law} ρ=${rho} shift=${ds} rule=${rule} τ=${tau}: |S| ${cell.mean_selected.toFixed(2)} ` + cell.per_delta.map((d) => `δ${d.delta}: eBY ${d.fcr_eby.toFixed(4)} naive ${d.fcr_naive.toFixed(4)} ${d.p1}`).join(' | '));
    }
  }
}
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = { study: '2026-09-e-by-dependence', run: `run-${stamp}`, mode: MODE, quick: QUICK, tier: 'T1',
  git_sha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), harness_sha256: sha256(fileURLToPath(import.meta.url)),
  n: N, seed: SEED, K, L, T, alpha_detector: ALPHA_DETECTOR, laws: LAWS.map((l) => ({ law: l.law, sigma_squared: l.sigma2 })), negative_signs: [...NEG],
  rhos: RHOS, shifts: SHIFTS, deltas: DELTAS, top: TOP, half: HALF, cells: cells.length,
  wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2) };
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(cells, manifest));
console.log(`wrote ${runDir} (${cells.length} cells, ${manifest.wall_seconds} s)`);
