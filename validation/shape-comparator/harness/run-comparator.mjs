// harness/run-comparator.mjs — ../PREREGISTRATION.md. Statistic-level
// head-to-head. No detectors, no e-values; separation and its sensitivity to a
// covariance scale error, which is what decides which construction to build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { covarianceCorr, P } from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const REPS = Number(arg('--reps', 400));
const KS = [0.85, 1.00, 1.15];
const WINDOWS = [120, 300];
const SEED = 20260805;

const gaussSpec = NULLS.find((s) => s.law === 'gauss' && s.sigma === 'corr');
const mixSpec = NULLS.find((s) => s.law === 'mix' && s.sigma === 'corr');
const SIGMA = covarianceCorr();

/** Standardise per coordinate by sigma_hat = sqrt(k * Sigma_ii). The scale
 *  error enters exactly here, which is what the k sweep probes. */
function standardise(win, k) {
  return win.map((z) => z.map((v, i) => v / Math.sqrt(k * SIGMA[i][i])));
}

/** B — per-coordinate standardised fourth moment, averaged. Scale-invariant:
 *  m4/m2^2 is unchanged by u -> c*u. */
function statB(win, k) {
  const U = standardise(win, k);
  let acc = 0;
  for (let i = 0; i < P; i++) {
    let m2 = 0, m4 = 0;
    for (const u of U) { const x = u[i]; m2 += x * x; m4 += x * x * x * x; }
    m2 /= U.length; m4 /= U.length;
    acc += m2 > 0 ? m4 / (m2 * m2) : 3;
  }
  return acc / P;
}

/** A — degree-4 polynomial-kernel MMD^2 against a Gaussian reference sample,
 *  unbiased-ish V-statistic. k(x,y) = (<x,y>/p + 1)^4 on standardised coords. */
function polyK(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  const t = d / a.length + 1;
  return t * t * t * t;
}
function statA(win, ref, k) {
  const X = standardise(win, k), Y = standardise(ref, k);
  const n = X.length, m = Y.length;
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) xx += polyK(X[i], X[j]);
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) yy += polyK(Y[i], Y[j]);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) xy += polyK(X[i], Y[j]);
  return xx / (n * (n - 1)) + yy / (m * (m - 1)) - 2 * xy / (n * m);
}

function draw(spec, n, seed) {
  const d = deviationStream(spec, seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(d());
  return out;
}

function stats(xs) {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  return { mean, sd };
}

const cells = [];
for (const W of WINDOWS) {
  for (const k of KS) {
    for (const cand of ['A-poly4-mmd', 'B-std-4th-moment']) {
      const gs = [], ms = [];
      for (let r = 0; r < REPS; r++) {
        const wg = draw(gaussSpec, W, SEED + 7919 * r);
        const wm = draw(mixSpec, W, SEED + 104729 * r);
        if (cand === 'B-std-4th-moment') { gs.push(statB(wg, k)); ms.push(statB(wm, k)); }
        else {
          const ref = draw(gaussSpec, Math.min(W, 200), SEED + 31337 + r);
          gs.push(statA(wg, ref, k)); ms.push(statA(wm, ref, k));
        }
      }
      const G = stats(gs), M = stats(ms);
      const d = G.sd > 0 ? Math.abs(M.mean - G.mean) / G.sd : NaN;
      const ticks = d > 0 ? Math.ceil(3.0 / (d * d / 2)) : Infinity;
      cells.push({ candidate: cand, window: W, k, reps: REPS,
        gauss_mean: G.mean, gauss_sd: G.sd, mix_mean: M.mean,
        separation_d: d, ticks_to_detect: ticks });
      process.stderr.write(
        `${cand.padEnd(18)} W=${String(W).padStart(3)} k=${k.toFixed(2)}  `
        + `gauss=${G.mean.toExponential(3)} mix=${M.mean.toExponential(3)}  `
        + `d=${d.toFixed(3)}  ticks=${ticks}\n`);
    }
  }
}

// P2: k-sensitivity of the separation, per candidate per window.
const sens = {};
for (const cand of ['A-poly4-mmd', 'B-std-4th-moment']) {
  for (const W of WINDOWS) {
    const ds = KS.map((k) => cells.find((c) => c.candidate === cand && c.window === W && c.k === k).separation_d);
    const lo = Math.min(...ds), hi = Math.max(...ds), mid = ds[1];
    sens[`${cand}@W${W}`] = { d_at_k: ds, spread_pct: mid > 0 ? 100 * (hi - lo) / mid : NaN };
  }
}
process.stderr.write('\n=== P2: separation sensitivity across the +-15% covariance band ===\n');
for (const [k2, v] of Object.entries(sens)) {
  process.stderr.write(`${k2.padEnd(26)} d=[${v.d_at_k.map((x) => x.toFixed(3)).join(', ')}]  spread=${v.spread_pct.toFixed(1)}%\n`);
}

const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `cmp-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'),
  `${JSON.stringify({ cells, k_sensitivity: sens }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'shape-comparator', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, reps: REPS, ks: KS, windows: WINDOWS,
  git_sha: gitSha, mode: MODE,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
