// harness/run-sequential.mjs — detector audit, sequential class.
//
//   node harness/run-sequential.mjs --mode live [--n 2000] [--t 300]
//
// The h0-battery scored the CROSSING rate, which is a Ville-type endpoint and
// sound. This adds the sharper supermartingale instrument — the increment
// estimator — over the same nulls and the same adapters, so the two compose.
// Per ../PREREGISTRATION.md §3 this applies to wealth processes ONLY.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { NULLS, rng, gaussFrom } from '../../h0-battery/harness/nulls.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const SEED = 20260804;
const ALPHA = 0.05;

// Sequential (wealth-process) detectors only. safe_t / UI are terminal and are
// measured by exceedance in a separate arm — mixing the instruments is the
// error §3 exists to prevent.
const SEQUENTIAL = new Set([
  'family_A_betting_e_process',
  'family_A_mixture_supermartingale',
  'family_D_spectral_e_detector',
]);

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
}

/** Estimate mu/sigma (and phi where the null is AR(1)) from a calibration
 *  window of length m — the "estimated" params path. */
function calibrate(spec, r, g) {
  const m = spec.m ?? 100;
  const draw = spec.gen(r, g);
  const xs = [];
  for (let i = 0; i < m; i++) xs.push(draw());
  const mu = xs.reduce((a, b) => a + b, 0) / m;
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, m - 1);
  let phiHat = 0;
  if (spec.phi !== undefined) {
    let num = 0, den = 0;
    for (let i = 1; i < m; i++) { num += (xs[i] - mu) * (xs[i - 1] - mu); den += (xs[i - 1] - mu) ** 2; }
    phiHat = den > 0 ? num / den : 0;
  }
  return { mu, sigma: Math.sqrt(Math.max(v, 1e-12)), phi: phiHat };
}

const cells = [];
const t0 = Date.now();

for (const det of DETECTORS.filter((d) => SEQUENTIAL.has(d.id))) {
  for (const spec of NULLS) {
    const incs = [], maxLogs = [];
    let phiUsed = [];
    for (let i = 0; i < N; i++) {
      const r = rng(SEED + 7919 * i + spec.id.length * 104729 + det.id.length);
      const g = gaussFrom(r);
      let cfg;
      if (spec.params === 'estimated') {
        const c = calibrate(spec, rng(SEED + 31 * i + spec.id.length), gaussFrom(rng(SEED + 31 * i)));
        cfg = { mu: c.mu, sigma: c.sigma, phi: spec.phi !== undefined ? c.phi : 0, alpha: ALPHA, windows: spec.windows };
        phiUsed.push(c.phi);
      } else {
        cfg = { mu: 0, sigma: 1, phi: spec.phi ?? 0, alpha: ALPHA, windows: spec.windows };
      }
      const inst = det.make(cfg);
      const draw = spec.gen(r, g);
      const exps = [];
      let maxLog = 0;
      for (let t = 0; t < T; t++) {
        const before = inst.logM();
        inst.step(draw());
        const after = inst.logM();
        if (Number.isFinite(before) && Number.isFinite(after)) exps.push(Math.exp(after - before));
        if (Number.isFinite(after) && after > maxLog) maxLog = after;
      }
      if (exps.length) incs.push(exps.reduce((a, b) => a + b, 0) / exps.length);
      maxLogs.push(maxLog);
    }
    const inc = summarise(incs);
    const fires = maxLogs.filter((m) => m >= Math.log(1 / ALPHA)).length;
    cells.push({
      detector: det.id, null_id: spec.id, null_label: spec.label,
      params: spec.params ?? 'oracle', m: spec.m ?? null, phi: spec.phi ?? 0,
      phi_hat_mean: phiUsed.length ? phiUsed.reduce((a, b) => a + b, 0) / phiUsed.length : null,
      n: incs.length, ticks: T, alpha: ALPHA,
      increment_estimator: inc,
      crossing_rate: fires / maxLogs.length,
      verdict: inc.lower95_one_sided > 1 ? 'REFUTED'
        : inc.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive',
      mode: MODE,
    });
    const c = cells[cells.length - 1];
    process.stderr.write(
      `${det.id.padEnd(34)} ${spec.id.padEnd(12)} inc=${inc.mean.toFixed(6)} `
      + `[${inc.lower95_one_sided.toFixed(6)},${inc.upper95_one_sided.toFixed(6)}] `
      + `${c.verdict.padEnd(12)} cross=${c.crossing_rate.toFixed(4)} `
      + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `seq-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'detector-audit-sequential', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, alpha: ALPHA,
  detectors: [...SEQUENTIAL], nulls: NULLS.map((s) => s.id),
  git_sha: gitSha, mode: MODE, elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
