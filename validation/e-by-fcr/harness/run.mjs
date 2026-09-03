// validation/e-by-fcr/harness/run.mjs — the registered harness for 2026-09-e-by-fcr
// (PREREGISTRATION.md §3). Drives the SHIPPED mixture evaluator per signal, takes the level-free
// inputs the evidence path carries (S_t, t, σ², ρ), and reports the selected set's intervals
// through the shipped e-BY module. No catch anywhere.
//
//   node validation/e-by-fcr/harness/run.mjs --mode live
//   node validation/e-by-fcr/harness/run.mjs --mode sim --quick      (N = 40, never scored)

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

// ── registered constants (PREREGISTRATION §3) ──
const N = QUICK ? 40 : 2000;
const SEED = 20260906;
const K = 20, L = 5, T = 300;
const ALPHA_DETECTOR = 1e-3;
const RHOS = [1, 38], SHIFTS = [0, 0.75, 1.5], DELTAS = [0.05, 0.10, 0.20];
const RULES = ['A', 'B'];
const TOP = 3;

// LCG + Box–Muller, the h0-battery's generator.
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
const gauss = (r) => { const u = r() || 1e-12, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const params = (rho) => ({ mixture_distribution: 'gaussian', gaussian_sigma_squared_prior: rho });

/** One replication: K signals, first L shifted by deltaShift, T ticks through the shipped evaluator.
 *  Returns per-signal { theta, level_free at T, level_free at first fire (or null), fired, S_T }. */
function replicate(seed, rho, deltaShift) {
  const r = rng(seed);
  const p = params(rho);
  return Array.from({ length: K }, (_, i) => {
    const theta = i < L ? deltaShift : 0;
    const state = mix.freshMixtureSupermartingaleState();
    let atFire = null;
    for (let t = 0; t < T; t++) {
      const x = theta + gauss(r);
      const res = mix.evaluatePageCusumMixtureSupermartingale({
        signal: `s${i}`, x_centered: x, live_value: x, baseline_mean: 0, sigma_squared: 1, params: p, ar1_phi: 0, state, alpha: ALPHA_DETECTOR,
      });
      if (!res.confidence_sequence) throw new Error('no confidence_sequence on the Gaussian path');
      if (res.fire && atFire === null) atFire = { S_t: state.S_t, t: state.n, sigma_squared: 1, sigma_squared_prior: rho };
    }
    return { theta, fired: atFire !== null, S_T: state.S_t,
      lfT: { S_t: state.S_t, t: state.n, sigma_squared: 1, sigma_squared_prior: rho }, lfFire: atFire };
  });
}

const select = (rule, sigs) => rule === 'A'
  ? sigs.map((s, i) => (s.fired ? i : -1)).filter((i) => i >= 0)
  : [...sigs.keys()].sort((a, b) => Math.abs(sigs[b].S_T) - Math.abs(sigs[a].S_T)).slice(0, TOP);

const closedForm = (lf, alpha) => { const v = lf.sigma_squared * lf.t + lf.sigma_squared_prior; return Math.sqrt(v * Math.log(v / (alpha * alpha * lf.sigma_squared_prior))) / lf.t; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const se = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length); };

function cell(rho, deltaShift, rule, tau, salt) {
  const fcp = Object.fromEntries(DELTAS.map((d) => [d, { eby: [], naive: [], ratio: [] }]));
  const sizes = []; let deviations = 0, exceptions = 0;
  for (let i = 0; i < N; i++) {
    const sigs = replicate(SEED + 7919 * i + salt, rho, deltaShift);
    const S = select(rule, sigs);
    sizes.push(S.length);
    const lfOf = (j) => (tau === 'fire' ? sigs[j].lfFire : sigs[j].lfT);
    for (const d of DELTAS) {
      if (S.length === 0) { fcp[d].eby.push(0); fcp[d].naive.push(0); continue; }
      const out = eby.eBenjaminiYekutieli(S.map((j) => ({ id: String(j), level_free: lfOf(j) })), K, d);
      let missE = 0, missN = 0;
      for (const [k, j] of S.entries()) {
        const iv = out.intervals[k];
        if (Math.abs(iv.half_width - closedForm(lfOf(j), out.alpha_i)) > 1e-12) deviations++;
        const naive = csm.mixtureConfidenceSequenceAt(lfOf(j), d);
        if (sigs[j].theta < iv.lower || sigs[j].theta > iv.upper) missE++;
        if (sigs[j].theta < naive.lower || sigs[j].theta > naive.upper) missN++;
        if (tau === 'T') fcp[d].ratio.push(iv.half_width / naive.half_width);
      }
      fcp[d].eby.push(missE / S.length); fcp[d].naive.push(missN / S.length);
    }
  }
  const per_delta = DELTAS.map((d) => {
    const fe = mean(fcp[d].eby), fes = se(fcp[d].eby);
    return { delta: d, fcr_eby: fe, fcr_eby_se: fes, p1: fe <= d + 3 * fes ? 'HELD' : 'FAILED',
      fcr_naive: mean(fcp[d].naive), fcr_naive_se: se(fcp[d].naive), width_ratio_mean: fcp[d].ratio.length ? mean(fcp[d].ratio) : null };
  });
  return { rho, delta_shift: deltaShift, rule, tau, n: N, mean_selected: mean(sizes), p_empty: sizes.filter((s) => s === 0).length / N, per_delta, reinversion_deviations: deviations, exceptions };
}

const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const cells = []; let idx = 0;
for (const rho of RHOS) for (const ds of SHIFTS) for (const rule of RULES) for (const tau of rule === 'A' ? ['T', 'fire'] : ['T']) {
  const c = cell(rho, ds, rule, tau, 1_000_000 * idx++);
  cells.push(c);
  console.log(`ρ=${rho} shift=${ds} rule=${rule} τ=${tau}: |S| ${c.mean_selected.toFixed(2)} ` + c.per_delta.map((d) => `δ${d.delta}: eBY ${d.fcr_eby.toFixed(4)} naive ${d.fcr_naive.toFixed(4)} ${d.p1}`).join(' | '));
}
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = { study: '2026-09-e-by-fcr', run: `run-${stamp}`, mode: MODE, quick: QUICK, tier: 'T1',
  git_sha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), harness_sha256: sha256(fileURLToPath(import.meta.url)),
  n: N, seed: SEED, K, L, T, alpha_detector: ALPHA_DETECTOR, rhos: RHOS, shifts: SHIFTS, deltas: DELTAS, top: TOP, cells: cells.length,
  wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2) };
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(cells, manifest));
console.log(`wrote ${runDir} (${cells.length} cells, ${manifest.wall_seconds} s)`);
