// validation/mixture-cs/harness/run.mjs — the registered harness for 2026-09-mixture-cs.
// Reads PREREGISTRATION.md's cells; writes results/live/run-<ts>/{manifest,endpoints}.json.
// Drives the compiled detector (dist/) for P2 and the compiled module for P5; every other
// quantity is computed here from the closed form, independently of the module.
//
// Usage: node validation/mixture-cs/harness/run.mjs [--quick]   (--quick: N=400 for smoke only)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { evaluatePageCusumMixtureSupermartingale, freshMixtureSupermartingaleState } from '../../../dist/detectors/family-a-mixture-supermartingale.js';
import { mixtureConfidenceSequence } from '../../../dist/detectors/mixture-confidence-sequence.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const quick = process.argv.includes('--quick');

// ── registered constants ──
const ALPHA = 0.05, SIGMA = 1, T = 900, T_P3 = 300;
const N = quick ? 400 : 4000;
const RHOS = [1, 38];
const MS = [30, 100, 500];
const DELTA_STAR = 0.75;
const LOG_THRESH = Math.log(1 / ALPHA);

// ── PRNG: scrambled per-trajectory seeds (no shared substreams) ──
function scramble(n) { let z = (n + 0x9E3779B9) | 0; z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); return (z ^ (z >>> 15)) >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(rng) { const u1 = Math.max(rng(), 1e-12), u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }
const trajRng = (cell, i) => mulberry32(scramble(cell * 1_000_003 + i));

// ── closed forms, independent of the module ──
const halfWidth = (t, s2, rho) => { const v = s2 * t + rho; return Math.sqrt(v * Math.log(v / (ALPHA * ALPHA * rho))) / t; };
// complementary normal tail Φ̄(z) via erfc (Numerical Recipes erfcc, |rel err| < 1.2e-7)
function erfc(x) { const z = Math.abs(x); const t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
const phiBar = (z) => 0.5 * erfc(z / Math.SQRT2);
const seBin = (p, n) => Math.sqrt(p * (1 - p) / n);

let cellId = 0;
const endpoints = [];
const held = (id, claim, measured, band, ok, extra = {}) => endpoints.push({ id, claim, measured, band, verdict: ok ? 'HELD' : 'FAILED', ...extra });

// ── P1: time-uniform coverage at oracle parameters ──
for (const rho of RHOS) for (const delta of [0, DELTA_STAR]) {
  const cell = ++cellId; let miss = 0;
  const w = Array.from({ length: T + 1 }, (_, t) => t === 0 ? Infinity : halfWidth(t, SIGMA * SIGMA, rho));
  for (let i = 0; i < N; i++) {
    const rng = trajRng(cell, i); let S = 0; let missed = false;
    for (let t = 1; t <= T; t++) { S += delta + SIGMA * gaussian(rng); if (Math.abs(S / t - delta) >= w[t]) { missed = true; break; } }
    if (missed) miss++;
  }
  const p = miss / N;
  held(`P1.rho${rho}.delta${delta}`, 'time-uniform miscoverage of δ at oracle parameters', p, [0.005, 0.060], p >= 0.005 && p <= 0.060, { N, T });
}

// ── P2: duality with the compiled detector ──
for (const rho of RHOS) {
  const cell = ++cellId; let agree = 0; const params = { mixture_distribution: 'gaussian', gaussian_sigma_squared_prior: rho };
  const w = Array.from({ length: T + 1 }, (_, t) => t === 0 ? Infinity : halfWidth(t, 1, rho));
  for (let i = 0; i < N; i++) {
    const rng = trajRng(cell, i); const state = freshMixtureSupermartingaleState(); let S = 0; let firstCs = -1;
    for (let t = 1; t <= T; t++) {
      const x = DELTA_STAR + gaussian(rng); S += x;
      evaluatePageCusumMixtureSupermartingale({ signal: 's', x_centered: x, live_value: x, baseline_mean: 0, sigma_squared: 1, params, state, alpha: ALPHA });
      if (firstCs < 0 && Math.abs(S / t) >= w[t]) firstCs = t - 1;  // 0-indexed like tick_at_first_fire
    }
    if (firstCs === (state.tick_at_first_fire ?? -1)) agree++;
  }
  held(`P2.rho${rho}`, 'first tick CS excludes 0 == detector first-fire tick', agree, [Math.ceil(0.999 * N), N], agree >= Math.ceil(0.999 * N), { N });
}

// ── P3: fixed-horizon miscoverage under a plug-in μ̂, oracle σ ──
for (const rho of RHOS) for (const m of MS) {
  const cell = ++cellId; let miss = 0; const wT = halfWidth(T_P3, 1, rho);
  const predicted = 2 * phiBar(wT / Math.sqrt(1 / T_P3 + 1 / m));
  for (let i = 0; i < N; i++) {
    const rng = trajRng(cell, i); let mu = 0; for (let k = 0; k < m; k++) mu += gaussian(rng); mu /= m;
    let S = 0; for (let t = 1; t <= T_P3; t++) S += gaussian(rng) - mu;
    if (Math.abs(S / T_P3) >= wT) miss++;
  }
  const p = miss / N; const se = seBin(predicted, N);
  held(`P3.rho${rho}.m${m}`, 'fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m))', p, [predicted - 3 * se, predicted + 3 * se], Math.abs(p - predicted) <= 3 * se, { predicted, se, N, T: T_P3 });
}

// ── P4: as deployed (μ̂ and σ̂² from the calibration window), time-uniform ──
const p4 = {};
for (const rho of RHOS) { p4[rho] = {}; for (const m of MS) {
  const cell = ++cellId; let miss = 0;
  for (let i = 0; i < N; i++) {
    const rng = trajRng(cell, i); const cal = Array.from({ length: m }, () => gaussian(rng));
    const mu = cal.reduce((a, b) => a + b, 0) / m; const s2 = cal.reduce((a, b) => a + (b - mu) ** 2, 0) / (m - 1);
    let S = 0; let missed = false;
    for (let t = 1; t <= T; t++) { S += gaussian(rng) - mu; if (Math.abs(S / t) >= halfWidth(t, s2, rho)) { missed = true; break; } }
    if (missed) miss++;
  }
  p4[rho][m] = miss / N;
} }
for (const rho of RHOS) {
  const a = p4[rho][30], b = p4[rho][500], mono = p4[rho][30] >= p4[rho][100] && p4[rho][100] >= p4[rho][500];
  held(`P4.rho${rho}.a`, 'as-deployed time-uniform miscoverage at m=30 ≥ 0.50', a, [0.5, 1], a >= 0.5, { N, T });
  held(`P4.rho${rho}.b`, 'as-deployed time-uniform miscoverage at m=500 ≤ 0.20', b, [0, 0.2], b <= 0.2, { N, T });
  held(`P4.rho${rho}.c`, 'monotone non-increasing in m', p4[rho], null, mono, { N, T });
}

// ── P5: the module's half-width matches the closed form ──
let maxRel = 0;
for (const rho of RHOS) for (const s2 of [1, 0.37, 2.5]) for (let t = 1; t <= T; t++) {
  const mod = mixtureConfidenceSequence({ S_t: 0.3 * t, t, sigma_squared: s2, sigma_squared_prior: rho, alpha: ALPHA }).half_width;
  const ref = halfWidth(t, s2, rho); maxRel = Math.max(maxRel, Math.abs(mod - ref) / ref);
}
held('P5', 'module half-width vs independent closed form, max relative deviation', maxRel, [0, 1e-9], maxRel < 1e-9);

// ── write ──
const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const outDir = join(here, '..', 'results', 'live', `run-${ts}`);
mkdirSync(outDir, { recursive: true });
const manifest = {
  study: '2026-09-mixture-cs', quick,
  engine_sha: execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim(),
  node: process.version, N, T, T_P3, alpha: ALPHA, rhos: RHOS, ms: MS, delta_star: DELTA_STAR,
  prng: 'mulberry32 with scrambled per-(cell,trajectory) seeds', generated_from: 'harness/run.mjs',
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(outDir, 'endpoints.json'), JSON.stringify({ manifest, endpoints }, null, 2) + '\n');
const fails = endpoints.filter((e) => e.verdict !== 'HELD');
console.log(`${outDir}\n${endpoints.length} endpoints, ${fails.length} FAILED`);
for (const e of endpoints) console.log(`${e.verdict.padEnd(6)} ${e.id.padEnd(16)} ${typeof e.measured === 'number' ? e.measured.toFixed(4) : JSON.stringify(e.measured)}  band ${JSON.stringify(e.band)}${e.predicted !== undefined ? `  predicted ${e.predicted.toFixed(4)}` : ''}`);
