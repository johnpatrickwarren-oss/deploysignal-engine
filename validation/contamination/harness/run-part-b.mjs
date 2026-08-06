// harness/run-part-b.mjs — C17 Part B. What does a contaminated baseline cost
// an empirical P-side reference, and does the MCD-retained hybrid fix it?
//
//   node harness/run-part-b.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//
// Arms and endpoints fixed by ../PREREGISTRATION.md §5. Decides whether C16
// ships, and as which arm.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, verifyProvenance, P, SD as CELL_SD,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const DS_ROOT = path.resolve(ENGINE_ROOT, '..', 'deploysignal');
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const mcdMod = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-mcd.js'));
const covMod = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-covariance.js'));
const { relativeDeviations } = covMod;
const { fastMCD, mcdReweight, FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED, computeLWWarmSeed } = mcdMod;

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = 600;
const SEED = 20260803;
const EPS = [0, 0.05, 0.10, 0.20];
const SHIFT_MULT = 4;
const ARMS = ['B0', 'B1', 'B2'];
const GAUSS = NULLS.find((s) => s.control && s.sigma === 'corr');
const FAULT_ONSET = 100, FAULT_INFLATE = 2;

/** Baseline rows with a fraction `eps` shifted — the 'shift' shape of §3. */
function baselineRows(eps, seed) {
  const draw = deviationStream(GAUSS, seed);
  const devs = [];
  const nOut = Math.round(BASELINE_N * eps);
  for (let i = 0; i < BASELINE_N; i++) {
    const z = draw();
    if (i < nOut) for (let k = 0; k < P; k++) z[k] += SHIFT_MULT * CELL_SD;
    devs.push(z);
  }
  return rowsFromDeviations(devs);
}

function rffMeanOver(Z, fm) {
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const z of Z) {
    const phi = rff.applyRffFeatureMap(z, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  return Array.from({ length: D }, (_, i) => acc[i] / Z.length);
}

/** B2: average φ over the rows the MCD reweighting KEPT — nonparametric
 *  reference with outlier resistance. */
function retainedSubset(famC, rows) {
  const Z = relativeDeviations(rows, famC.mean_vector);
  const mcd = fastMCD(Z, FASTMCD_DEFAULT_ALPHA, FASTMCD_DEFAULT_SEED, computeLWWarmSeed(Z));
  if (!mcd) return Z;
  const rw = mcdReweight(Z, mcd.mean, mcd.cov);
  return rw ? rw.kept.map((i) => Z[i]) : Z;
}

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se, lower95_one_sided: mean - 1.645 * se,
    upper95_one_sided: mean + 1.645 * se };
}

function runFamilyC(cfg, famC, devs) {
  const states = {};
  const exps = [];
  let maxLog = 0;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const k1 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const before = k1 ? states[k1].log_S_t : 0;
    const v = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
    if (!v) throw new Error('family C returned null');
    if (v.verdict === 'suppressed') { exps.push(1); continue; }
    const k2 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
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

for (const arm of ARMS) {
  for (const eps of EPS) {
    for (const mode of ['null', 'fault']) {
      const maxLogs = [], incs = [];
      const perBundle = Math.ceil(N / BUNDLES);
      let done = 0, npUsed = null;
      for (let b = 0; b < BUNDLES && done < N; b++) {
        const rows = baselineRows(eps, SEED + 1000003 * b + GAUSS.id.length * 7919);
        const { cfg, famC } = buildBundle(rows);
        const bp = famC.betting_e_process_params;
        if (arm !== 'B0') {
          const fm = rff.computeRffFeatureMap(
            bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
          const Z = arm === 'B1'
            ? relativeDeviations(rows, famC.mean_vector)
            : retainedSubset(famC, rows);
          bp.baseline_rff_mean = rffMeanOver(Z, fm);
          bp.baseline_sample_size = Z.length;
          npUsed = Z.length;
        } else npUsed = bp.baseline_sample_size;
        for (let i = 0; i < perBundle && done < N; i++, done++) {
          // Live stream is drawn from the CLEAN law in both modes; 'fault'
          // adds a x2 variance inflation from tick 100 (the family-ce-nulls
          // vacuous-pass shape).
          const draw = deviationStream(GAUSS, SEED + 7919 * done + 31 * b);
          const devs = [];
          for (let t = 0; t < T; t++) {
            const z = draw();
            if (mode === 'fault' && t >= FAULT_ONSET) for (let k = 0; k < P; k++) z[k] *= FAULT_INFLATE;
            devs.push(z);
          }
          const c = runFamilyC(cfg, famC, devs);
          maxLogs.push(c.maxLog);
          incs.push(c.exps.reduce((a, x) => a + x, 0) / c.exps.length);
        }
      }
      const thr = Math.log(1 / 0.05);
      const fires = maxLogs.filter((m) => m >= thr).length;
      cells.push({
        arm, eps, mode, n: done, ticks: T, bundles: BUNDLES, N_P: npUsed,
        alpha: 0.05, fires, rate: fires / done,
        increment_estimator: summarise(incs),
        mode_meaning: mode === 'null' ? 'false alarm (clean live stream)' : 'power (x2 variance from tick 100)',
        engine_version: engineVersion, git_sha: gitSha, run_mode: MODE,
      });
      process.stderr.write(
        `${arm} eps=${eps.toFixed(2)} ${mode.padEnd(5)} rate=${(fires / done).toFixed(4)} `
        + `N_P=${npUsed} inc=${summarise(incs).mean.toFixed(6)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `partB-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'contamination-part-b', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  baseline_n: BASELINE_N, eps: EPS, arms: ARMS, null_id: GAUSS.id,
  shift_mult: SHIFT_MULT, fault_onset: FAULT_ONSET, fault_inflate: FAULT_INFLATE,
  shared_modules_verified: shared,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
