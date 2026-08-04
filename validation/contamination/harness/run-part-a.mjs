// harness/run-part-a.mjs — C17 Part A. What is MRCD biased by, and how do
// the MCD defects behave under contamination?
//
//   node harness/run-part-a.mjs --mode live [--reps 200]
//
// Pure estimator study. Known Σ in, Σ̂ out. Arms and endpoints fixed by
// ../PREREGISTRATION.md §4.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const DS_ROOT = path.resolve(ENGINE_ROOT, '..', 'deploysignal');
const mcdMod = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-mcd.js'));
const covMod = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-covariance.js'));

const {
  fastMCD, mcdReweight, consistencyCorrectionFactor, buildFamilyCPerCellMRCD,
  FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED, computeLWWarmSeed,
} = mcdMod;
const { columnMean, relativeDeviations } = covMod;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const REPS = Number(arg('--reps', 200));
const SEED = 20260804;

const PS = [5, 11];
const NS = [600, 10000];
const EPS = [0, 0.05, 0.10, 0.20];
const SHAPES = ['shift', 'scatter'];
const VARIANTS = ['V0', 'V3', 'MRCD'];
const SD = 0.05, RHO = 0.3, LEVEL = 100;
const SHIFT_MULT = 4, SCATTER_MULT = 9;

function sigmaTrue(p) {
  const S = [];
  for (let i = 0; i < p; i++) {
    S.push([]);
    for (let j = 0; j < p; j++) S[i].push(SD * SD * Math.pow(RHO, Math.abs(i - j)));
  }
  return S;
}

function chol(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-18));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussFactory(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    const u1 = Math.max(rng(), 1e-300), u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

/** n rows from N(0, Σ), with a fraction `eps` replaced by outliers. The clean
 *  rows are always drawn the same way, so arms differ only by contamination. */
function drawRows(p, n, eps, shape, seed) {
  const L = chol(sigmaTrue(p));
  const rng = mulberry32(seed);
  const g = gaussFactory(rng);
  const rows = [];
  const nOut = Math.round(n * eps);
  for (let i = 0; i < n; i++) {
    const w = Array.from({ length: p }, g);
    const z = new Array(p);
    for (let r = 0; r < p; r++) { let s = 0; for (let c = 0; c <= r; c++) s += L[r][c] * w[c]; z[r] = s; }
    if (i < nOut) {
      if (shape === 'shift') for (let r = 0; r < p; r++) z[r] += SHIFT_MULT * SD;
      else for (let r = 0; r < p; r++) z[r] *= Math.sqrt(SCATTER_MULT);
    }
    rows.push(z.map((v) => LEVEL * (1 + v)));
  }
  return rows;
}

/** V0 / V3 assembled from the shipped primitives (identical to
 *  ../mcd-consistency/harness), plus MRCD via the shipped builder. */
function estimate(rows, which) {
  if (which === 'MRCD') {
    const r = buildFamilyCPerCellMRCD(rows, FASTMCD_DEFAULT_ALPHA);
    return { cov: r.cell.covariance, retained: null, rho: r.cell.covariance_shrinkage ?? null };
  }
  const rawMean = columnMean(rows);
  const rawZ = relativeDeviations(rows, rawMean);
  const p = rawZ[0].length;
  const mcd = fastMCD(rawZ, FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED, computeLWWarmSeed(rawZ));
  if (!mcd) return null;
  const cRaw = consistencyCorrectionFactor(FASTMCD_DEFAULT_ALPHA, p);
  const c975 = consistencyCorrectionFactor(0.975, p);
  const fixBoth = which === 'V3';
  const covForCutoff = fixBoth ? mcd.cov.map((r) => r.map((v) => v * cRaw)) : mcd.cov;
  const rw = mcdReweight(rawZ, mcd.mean, covForCutoff);
  if (!rw) return null;
  const f = fixBoth ? c975 : cRaw;
  return { cov: rw.cov.map((r) => r.map((v) => v * f)), retained: rw.kept.length / rows.length, rho: null };
}

const trace = (S) => S.reduce((a, r, i) => a + r[i], 0);

function summarise(xs) {
  const n = xs.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, se: NaN, ci95: [NaN, NaN] };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se, ci95: [mean - 1.96 * se, mean + 1.96 * se] };
}

const cells = [];
const t0 = Date.now();
for (const p of PS) {
  const trTrue = trace(sigmaTrue(p));
  for (const n of NS) {
    for (const shape of SHAPES) {
      for (const eps of EPS) {
        for (const which of VARIANTS) {
          // eps=0 is the same data for both shapes; run it once under 'shift'.
          if (eps === 0 && shape === 'scatter') continue;
          const ratios = [], retained = [], rhos = [];
          for (let r = 0; r < REPS; r++) {
            const rows = drawRows(p, n, eps, shape, SEED + 7919 * r + 104729 * p + 31 * n);
            const out = estimate(rows, which);
            if (!out) continue;
            ratios.push(trace(out.cov) / trTrue);
            if (out.retained !== null) retained.push(out.retained);
            if (out.rho !== null) rhos.push(out.rho);
          }
          const tr = summarise(ratios);
          cells.push({
            variant: which, p, n, eps, shape: eps === 0 ? 'none' : shape, reps: ratios.length,
            trace_ratio: tr,
            retained_fraction: retained.length ? summarise(retained) : null,
            rho: rhos.length ? summarise(rhos) : null,
            verdict: (tr.ci95[0] > 1 || tr.ci95[1] < 1) ? 'BIASED'
              : (tr.ci95[1] - tr.ci95[0]) / 2 < 0.02 ? 'CONSISTENT' : 'inconclusive',
          });
          process.stderr.write(
            `${which.padEnd(4)} p=${String(p).padStart(2)} n=${String(n).padStart(5)} `
            + `eps=${eps.toFixed(2)} ${(eps === 0 ? 'none' : shape).padEnd(7)} `
            + `trace=${tr.mean.toFixed(4)} [${tr.ci95[0].toFixed(4)},${tr.ci95[1].toFixed(4)}]`
            + `${rhos.length ? ` rho=${summarise(rhos).mean.toFixed(3)}` : ''} `
            + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        }
      }
    }
  }
}

const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `partA-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'contamination-part-a', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, reps: REPS, ps: PS, ns: NS, eps: EPS, shapes: SHAPES,
  variants: VARIANTS, sd: SD, rho_target: RHO, shift_mult: SHIFT_MULT, scatter_mult: SCATTER_MULT,
  mcd_alpha: FASTMCD_DEFAULT_ALPHA,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
