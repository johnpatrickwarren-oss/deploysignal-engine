// harness/run-mcd.mjs — C15. Is MCD's covariance inflated, and is it two
// defects that partly cancel?
//
//   node harness/run-mcd.mjs --mode live [--reps 200]
//
// Pure estimator study: known Σ in, Σ̂ out, compare. No detector, no
// e-process, no trajectories. Arms and endpoints fixed by ../PREREGISTRATION.md.

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
const cov = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-covariance.js'));

const {
  fastMCD, mcdReweight, consistencyCorrectionFactor,
  buildFamilyCPerCellMCD, FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED,
} = mcdMod;
const { columnMean, relativeDeviations } = cov;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const REPS = Number(arg('--reps', 200));
const SEED = 20260804;

const PS = [3, 5, 8, 11, 15];
const NS = [600, 10000];
const SD = 0.05, RHO = 0.3;
const LEVEL = 100;                       // rows are LEVEL·(1+z); the estimator works in rel-dev

// ── generative Σ, known by construction ──────────────────────────────

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

function drawRows(p, n, seed) {
  const L = chol(sigmaTrue(p));
  const g = gaussFactory(mulberry32(seed));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const w = Array.from({ length: p }, g);
    const z = new Array(p);
    for (let r = 0; r < p; r++) { let s = 0; for (let c = 0; c <= r; c++) s += L[r][c] * w[c]; z[r] = s; }
    rows.push(z.map((v) => LEVEL * (1 + v)));
  }
  return rows;
}

// ── the four variants, assembled from the SHIPPED primitives ─────────

function variant(rows, which) {
  const rawMean = columnMean(rows);
  const rawZ = relativeDeviations(rows, rawMean);
  const p = rawZ[0].length;
  const warmSeed = mcdMod.computeLWWarmSeed(rawZ);
  const mcd = fastMCD(rawZ, FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED, warmSeed);
  if (!mcd) return null;
  const cRaw = consistencyCorrectionFactor(FASTMCD_DEFAULT_ALPHA, p);
  const c975 = consistencyCorrectionFactor(0.975, p);
  // H-B: does the reweighting cutoff see a CORRECTED raw covariance?
  const fixRaw = which === 'V2' || which === 'V3';
  const covForCutoff = fixRaw ? mcd.cov.map((r) => r.map((v) => v * cRaw)) : mcd.cov;
  const rw = mcdReweight(rawZ, mcd.mean, covForCutoff);
  if (!rw) return null;
  // H-A: which coverage does the post-factor correspond to?
  const fixFactor = which === 'V1' || which === 'V3';
  const f = fixFactor ? c975 : cRaw;
  return {
    cov: rw.cov.map((r) => r.map((v) => v * f)),
    retained: rw.kept.length / rows.length,
    c_raw: cRaw, c_975: c975,
  };
}

// ── metrics ──────────────────────────────────────────────────────────

const trace = (S) => S.reduce((a, r, i) => a + r[i], 0);

function froNorm(A) { let s = 0; for (const r of A) for (const v of r) s += v * v; return Math.sqrt(s); }

function relFro(Sh, St) {
  const D = Sh.map((r, i) => r.map((v, j) => v - St[i][j]));
  return froNorm(D) / froNorm(St);
}

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se, ci95: [mean - 1.96 * se, mean + 1.96 * se] };
}

// ── parity gate: V0 must reproduce the shipped builder exactly ───────

const parityRows = drawRows(11, 600, SEED);
const v0 = variant(parityRows, 'V0');
const shippedCell = buildFamilyCPerCellMCD(parityRows, FASTMCD_DEFAULT_ALPHA);
if (!shippedCell) throw new Error('parity: shipped builder returned null');
let maxAbs = 0;
for (let i = 0; i < v0.cov.length; i++) {
  for (let j = 0; j < v0.cov.length; j++) {
    maxAbs = Math.max(maxAbs, Math.abs(v0.cov[i][j] - shippedCell.cell.covariance[i][j]));
  }
}
if (maxAbs > 1e-15) {
  throw new Error(`parity FAILED: V0 differs from buildFamilyCPerCellMCD by ${maxAbs}. Refusing to run.`);
}
process.stderr.write(`parity OK (max |Δ| = ${maxAbs.toExponential(2)})\n`);

// ── main grid ────────────────────────────────────────────────────────

const cells = [];
for (const p of PS) {
  const St = sigmaTrue(p);
  const trTrue = trace(St);
  for (const n of NS) {
    for (const which of ['V0', 'V1', 'V2', 'V3']) {
      const ratios = [], retained = [], fros = [];
      let nulls = 0;
      for (let r = 0; r < REPS; r++) {
        const rows = drawRows(p, n, SEED + 7919 * r + 104729 * p + 31 * n);
        const out = variant(rows, which);
        if (!out) { nulls++; continue; }
        ratios.push(trace(out.cov) / trTrue);
        retained.push(out.retained);
        fros.push(relFro(out.cov, St));
      }
      const tr = summarise(ratios);
      const rec = {
        variant: which, p, n, reps: ratios.length, nulls,
        trace_ratio: tr,
        retained_fraction: summarise(retained),
        rel_frobenius: summarise(fros),
        c_raw: consistencyCorrectionFactor(FASTMCD_DEFAULT_ALPHA, p),
        c_975: consistencyCorrectionFactor(0.975, p),
        verdict: (tr.ci95[0] > 1 || tr.ci95[1] < 1) ? 'BIASED'
          : (tr.ci95[1] - tr.ci95[0]) / 2 < 0.02 ? 'CONSISTENT' : 'inconclusive',
      };
      cells.push(rec);
      process.stderr.write(
        `${which} p=${String(p).padStart(2)} n=${String(n).padStart(5)} `
        + `trace=${tr.mean.toFixed(4)} [${tr.ci95[0].toFixed(4)},${tr.ci95[1].toFixed(4)}] `
        + `retained=${rec.retained_fraction.mean.toFixed(4)} ${rec.verdict}\n`);
    }
  }
}

const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'mcd-consistency', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, reps: REPS, ps: PS, ns: NS,
  sd: SD, rho: RHO, mcd_alpha: FASTMCD_DEFAULT_ALPHA,
  parity_max_abs_delta: maxAbs,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
