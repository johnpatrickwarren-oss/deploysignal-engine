// harness/run-unbiased.mjs — PREREGISTRATION §7 addendum, A-P1 to A-P4.
//
//   node harness/run-unbiased.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//
// Two questions the main grid could not answer:
//   (a) where does the UNBIASED covariance sit on the U-curve? k is a multiple
//       of Σ̂, and Σ̂ is itself biased, so k_unbiased = trace(Σ_true)/trace(Σ̂),
//       computed per bundle rather than assumed.
//   (b) can the detector detect a pure SHAPE fault — live stream switching
//       gauss → mix at matched moments — at that corrected covariance?

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, verifyProvenance, CELL_KEY, covarianceCorr, covarianceDiag, P,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const smmd = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'sequential-mmd.js'));

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = 600;
const SEED = 20260803;
const POOL = 500;
const FAULT_ONSET = 100;

const trace = (S) => S.reduce((a, r, i) => a + r[i], 0);

function restamp(famC, k) {
  const bp = famC.betting_e_process_params;
  const fm = rff.computeRffFeatureMap(
    bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  const scaled = { ...famC, covariance: famC.covariance.map((r) => r.map((v) => v * k)) };
  const pool = smmd.generateBaselinePool(scaled, POOL, smmd.baselinePoolSeed({
    hour_of_day: CELL_KEY.hour_of_day, day_of_week: CELL_KEY.day_of_week }));
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const x of pool) {
    const phi = rff.applyRffFeatureMap(x, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  bp.baseline_rff_mean = Array.from({ length: D }, (_, i) => acc[i] / pool.length);
}

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
}

function runFamilyC(cfg, famC, devs) {
  const states = {};
  const exps = [];
  let maxLog = 0;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const k1 = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
    const before = k1 ? states[k1].log_S_t : 0;
    const v = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
    if (!v) throw new Error('family C returned null');
    if (v.verdict === 'suppressed') { exps.push(1); continue; }
    const k2 = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
    const after = states[k2].log_S_t;
    exps.push(Math.exp(after - before));
    if (after > maxLog) maxLog = after;
  }
  return { exps, maxLog };
}

const shared = verifyProvenance();
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();

const cells = [];
const t0 = Date.now();
const perBundle = Math.ceil(N / BUNDLES);

// ── A-P1 / A-P2: the four nulls at k_unbiased, computed per bundle ───
for (const spec of NULLS) {
  const SIGMA_TRUE = spec.sigma === 'corr' ? covarianceCorr() : covarianceDiag();
  const trTrue = trace(SIGMA_TRUE);
  for (const mode of ['k_unbiased', 'k_one']) {
    const perTraj = [], maxLogs = [], ks = [];
    let done = 0;
    for (let b = 0; b < BUNDLES && done < N; b++) {
      const baseDraw = deviationStream(spec, SEED + 1000003 * b + spec.id.length * 7919);
      const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
      const { cfg, famC } = buildBundle(rows);
      const k = mode === 'k_one' ? 1 : trTrue / trace(famC.covariance);
      ks.push(k);
      restamp(famC, k);
      for (let i = 0; i < perBundle && done < N; i++, done++) {
        const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
        const devs = [];
        for (let t = 0; t < T; t++) devs.push(draw());
        const c = runFamilyC(cfg, famC, devs);
        perTraj.push(c.exps.reduce((a, x) => a + x, 0) / c.exps.length);
        maxLogs.push(c.maxLog);
      }
    }
    const fires = maxLogs.filter((x) => x >= Math.log(20)).length;
    cells.push({
      arm: 'null', null_id: spec.id, control: spec.control, k_mode: mode,
      k_mean: ks.reduce((a, b) => a + b, 0) / ks.length,
      n: done, ticks: T, alpha: 0.05, fires, crossing_rate: fires / done,
      increment_estimator: summarise(perTraj),
      mode: MODE, engine_version: engineVersion, git_sha: gitSha,
    });
    process.stderr.write(
      `null  ${spec.id.padEnd(15)} ${mode.padEnd(11)} k=${(ks.reduce((a, b) => a + b, 0) / ks.length).toFixed(4)} `
      + `cross=${(fires / done).toFixed(4)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

// ── A-P3 / A-P4: the power arm. Gaussian baseline, live switches to the
//    moment-matched mixture at tick 100. Pure shape fault. ──────────────
for (const sigma of ['corr', 'diag']) {
  const gaussSpec = NULLS.find((s) => s.law === 'gauss' && s.sigma === sigma);
  const mixSpec = NULLS.find((s) => s.law === 'mix' && s.sigma === sigma);
  const SIGMA_TRUE = sigma === 'corr' ? covarianceCorr() : covarianceDiag();
  const trTrue = trace(SIGMA_TRUE);
  for (const mode of ['k_unbiased', 'k_one']) {
    const maxLogs = [], ks = [];
    let done = 0;
    for (let b = 0; b < BUNDLES && done < N; b++) {
      const baseDraw = deviationStream(gaussSpec, SEED + 1000003 * b + gaussSpec.id.length * 7919);
      const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
      const { cfg, famC } = buildBundle(rows);
      const k = mode === 'k_one' ? 1 : trTrue / trace(famC.covariance);
      ks.push(k);
      restamp(famC, k);
      for (let i = 0; i < perBundle && done < N; i++, done++) {
        const preDraw = deviationStream(gaussSpec, SEED + 7919 * done + 31 * b);
        const postDraw = deviationStream(mixSpec, SEED + 104729 * done + 31 * b);
        const devs = [];
        for (let t = 0; t < T; t++) devs.push(t < FAULT_ONSET ? preDraw() : postDraw());
        const c = runFamilyC(cfg, famC, devs);
        maxLogs.push(c.maxLog);
      }
    }
    const fires = maxLogs.filter((x) => x >= Math.log(20)).length;
    cells.push({
      arm: 'power', sigma, fault: 'gauss->mix at tick 100, moments matched',
      k_mode: mode, k_mean: ks.reduce((a, b) => a + b, 0) / ks.length,
      n: done, ticks: T, alpha: 0.05, fires, power: fires / done,
      mode: MODE, engine_version: engineVersion, git_sha: gitSha,
    });
    process.stderr.write(
      `POWER ${sigma.padEnd(15)} ${mode.padEnd(11)} k=${(ks.reduce((a, b) => a + b, 0) / ks.length).toFixed(4)} `
      + `power=${(fires / done).toFixed(4)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `unbiased-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'bandwidth-scale-unbiased-addendum', prereg: '../PREREGISTRATION.md §7',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  baseline_n: BASELINE_N, pool_size: POOL, fault_onset: FAULT_ONSET,
  shared_modules_verified: shared,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
