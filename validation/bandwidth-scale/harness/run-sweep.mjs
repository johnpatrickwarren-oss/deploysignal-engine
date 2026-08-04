// harness/run-sweep.mjs — bandwidth vs covariance scale, factorial.
//
//   node harness/run-sweep.mjs --mode live [--n 1000] [--t 300] [--bundles 5]
//
// Design fixed by ../PREREGISTRATION.md §2. One base cell per null built at
// covariance_method_override:'mcd' so SHAPE is held fixed; the sweep then
// recomputes the stamped baseline_rff_mean at (k·Σ̂, m·σ) and re-stamps the
// bandwidth so the runtime regenerates the matching feature map.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, verifyProvenance, CELL_KEY,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const smmd = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'sequential-mmd.js'));

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 1000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 5));
const BASELINE_N = 600;
const SEED = 20260803;
const KS = [0.70, 0.78, 0.90, 1.00, 1.15];
const MS = [0.50, 0.71, 1.00, 1.41, 2.00];
const POOL = 500;

/** Re-stamp baseline_rff_mean for a pool drawn from k·Σ̂ under bandwidth m·σ.
 *  Also re-stamps kernel_bandwidth_sigma so the RUNTIME regenerates the same
 *  feature map — the detector derives ω from (rff_seed, rff_dim, bandwidth). */
function restamp(famC, k, m, sigmaBase) {
  const bp = famC.betting_e_process_params;
  const sigma = m * sigmaBase;
  const fm = rff.computeRffFeatureMap(
    bp.rff_seed, bp.rff_dim, famC.mean_vector.length, sigma);
  const scaled = { ...famC, covariance: famC.covariance.map((r) => r.map((v) => v * k)) };
  const pool = smmd.generateBaselinePool(
    scaled, POOL, smmd.baselinePoolSeed({
      hour_of_day: CELL_KEY.hour_of_day, day_of_week: CELL_KEY.day_of_week }));
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const x of pool) {
    const phi = rff.applyRffFeatureMap(x, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  bp.baseline_rff_mean = Array.from({ length: D }, (_, i) => acc[i] / pool.length);
  bp.kernel_bandwidth_sigma = sigma;
  return { sigma, pool_size: pool.length };
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

for (const spec of NULLS) {
  // Build the base bundles ONCE per null; the sweep only re-stamps.
  const bases = [];
  for (let b = 0; b < BUNDLES; b++) {
    const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
    const baseDraw = deviationStream(spec, baseSeed);
    const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
    const built = buildBundle(rows);
    bases.push({
      cfg: built.cfg, famC: built.famC,
      sigmaBase: built.famC.betting_e_process_params.kernel_bandwidth_sigma,
    });
  }
  for (const k of KS) {
    for (const m of MS) {
      const perTraj = [], maxLogs = [];
      let done = 0, sigmaUsed = null;
      for (let b = 0; b < BUNDLES && done < N; b++) {
        const { cfg, famC, sigmaBase } = bases[b];
        const st = restamp(famC, k, m, sigmaBase);
        sigmaUsed = st.sigma;
        for (let i = 0; i < perBundle && done < N; i++, done++) {
          const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
          const devs = [];
          for (let t = 0; t < T; t++) devs.push(draw());
          const c = runFamilyC(cfg, famC, devs);
          perTraj.push(c.exps.reduce((a, x) => a + x, 0) / c.exps.length);
          maxLogs.push(c.maxLog);
        }
      }
      const inc = summarise(perTraj);
      const fires = maxLogs.filter((x) => x >= Math.log(20)).length;
      cells.push({
        null_id: spec.id, control: spec.control, k, m,
        sigma: sigmaUsed, sigma_base: bases[0].sigmaBase,
        n: done, ticks: T, bundles: BUNDLES, alpha: 0.05,
        fires, crossing_rate: fires / done,
        increment_estimator: inc,
        supermartingale_verdict: inc.lower95_one_sided > 1 ? 'REFUTED'
          : inc.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive',
        mode: MODE, engine_version: engineVersion, git_sha: gitSha,
      });
    }
    const row = MS.map((m) => {
      const c = cells.find((x) => x.null_id === spec.id && x.k === k && x.m === m);
      return `m=${m.toFixed(2)}:${c.crossing_rate.toFixed(4)}`;
    }).join('  ');
    process.stderr.write(`${spec.id.padEnd(15)} k=${k.toFixed(2)}  ${row} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'bandwidth-scale', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  baseline_n: BASELINE_N, ks: KS, ms: MS, pool_size: POOL,
  nulls: NULLS.map((s) => s.id), shared_modules_verified: shared,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
