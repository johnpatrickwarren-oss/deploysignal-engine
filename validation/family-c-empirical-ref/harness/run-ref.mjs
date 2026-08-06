// harness/run-ref.mjs — C16. Does an empirical P-side reference stop Family C
// firing on healthy bimodal data?
//
//   node harness/run-ref.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//
// Arms, endpoints and predictions fixed by ../PREREGISTRATION.md, including
// §10: no repo change. B1 overrides the stamped baseline_rff_mean rather than
// editing deploysignal's calibrator, because that tree is owned by another
// session. Same quantity — the vector IS the calibrator's only output here.

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
const DS_ROOT = path.resolve(ENGINE_ROOT, '..', 'deploysignal');
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const cov = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-covariance.js'));
const { relativeDeviations } = cov;

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = 600;
const SEED = 20260803;                    // family-ce-nulls' seed, so B0 replicates
const ALPHAS = [0.05, 0.01];
const SHIPPED_ALPHA_C = 1e-4;
const BLOCKS = [[0, 10], [10, 50], [50, 150], [150, T]];

/** B1: μ_P^φ as the mean of φ over the REAL baseline rows, in the same
 *  relative-deviation space the synthesized pool lives in. This is exactly
 *  what `relativeDeviations(rows, cell.mean_vector)` would feed the existing
 *  averaging loop in `_family-c-build.ts:316-325`. */
function empiricalRffMean(famC, fm, rows) {
  const Z = relativeDeviations(rows, famC.mean_vector);
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const z of Z) {
    const phi = rff.applyRffFeatureMap(z, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  const out = new Array(D);
  for (let i = 0; i < D; i++) out[i] = acc[i] / Z.length;
  return { mean: out, N_P: Z.length };
}

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return {
    n, mean, sd: Math.sqrt(varr), se,
    ci95: [mean - 1.96 * se, mean + 1.96 * se],
    lower95_one_sided: mean - 1.645 * se,
    upper95_one_sided: mean + 1.645 * se,
  };
}

function rateLower95(fires, n) {
  const rate = fires / n, z = 1.645;
  const denom = 1 + z * z / n;
  const centre = rate + z * z / (2 * n);
  const half = z * Math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n));
  return Math.max(0, (centre - half) / denom);
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
    if (!v) throw new Error('family C returned null — cell not compiled');
    if (v.verdict === 'suppressed') { exps.push(1); continue; }
    const k2 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const after = states[k2].log_S_t;
    exps.push(Math.exp(after - before));
    if (after > maxLog) maxLog = after;
  }
  const k = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
  return { exps, maxLog, logMT: states[k].log_S_t };
}

const shared = verifyProvenance();          // C-2
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();

const cells = [];
const meta = [];
const t0 = Date.now();

for (const arm of ['B0', 'B1']) {
  for (const spec of NULLS) {
    const perTraj = [], terminal = [], maxLogs = [];
    const blocks = BLOCKS.map(() => []);
    const perBundle = Math.ceil(N / BUNDLES);
    let done = 0;
    for (let b = 0; b < BUNDLES && done < N; b++) {
      const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
      const baseDraw = deviationStream(spec, baseSeed);
      const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
      const { cfg, famC } = buildBundle(rows);
      const bp = famC.betting_e_process_params;
      if (arm === 'B1') {
        const fm = rff.computeRffFeatureMap(
          bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
        const synth = bp.baseline_rff_mean.slice();
        const emp = empiricalRffMean(famC, fm, rows);
        let d2 = 0;
        for (let i = 0; i < emp.mean.length; i++) d2 += (emp.mean[i] - synth[i]) ** 2;
        bp.baseline_rff_mean = emp.mean;
        bp.baseline_sample_size = emp.N_P;
        if (b === 0) {
          meta.push({
            arm, null_id: spec.id, N_P: emp.N_P,
            l2_empirical_vs_synthetic: Math.sqrt(d2),
            key_set: Object.keys(bp).sort().join(','),
          });
        }
      } else if (b === 0) {
        meta.push({
          arm, null_id: spec.id, N_P: bp.baseline_sample_size,
          l2_empirical_vs_synthetic: 0, key_set: Object.keys(bp).sort().join(','),
        });
      }
      for (let i = 0; i < perBundle && done < N; i++, done++) {
        const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
        const devs = [];
        for (let t = 0; t < T; t++) devs.push(draw());
        const c = runFamilyC(cfg, famC, devs);
        perTraj.push(c.exps.reduce((a, x) => a + x, 0) / c.exps.length);
        terminal.push(Math.exp(Math.min(c.logMT, 700)));
        maxLogs.push(c.maxLog);
        BLOCKS.forEach(([lo, hi], bi) => {
          const s = c.exps.slice(lo, hi);
          if (s.length) blocks[bi].push(s.reduce((a, x) => a + x, 0) / s.length);
        });
      }
    }
    const inc = summarise(perTraj);
    for (const a of [...ALPHAS, SHIPPED_ALPHA_C]) {
      const thr = Math.log(1 / a);
      const fires = maxLogs.filter((m) => m >= thr).length;
      cells.push({
        arm, detector: 'family_C_mmd_betting_e_process',
        null_id: spec.id, null_label: spec.label, control: spec.control,
        alpha: a, scored: a !== SHIPPED_ALPHA_C, n: done, ticks: T, bundles: BUNDLES,
        fires, fire_rate: fires / done, fire_rate_lower95: rateLower95(fires, done),
        increment_estimator: inc,
        terminal_mean: summarise(terminal),
        blocks: BLOCKS.map(([from, to], i) => ({ from, to, ...summarise(blocks[i]) })),
        supermartingale_verdict: inc.lower95_one_sided > 1 ? 'REFUTED'
          : inc.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive',
        mode: MODE, engine_version: engineVersion, git_sha: gitSha,
      });
    }
    const f05 = maxLogs.filter((m) => m >= Math.log(20)).length / done;
    process.stderr.write(
      `${arm} ${spec.id.padEnd(15)} inc=${inc.mean.toFixed(6)} `
      + `[${inc.lower95_one_sided.toFixed(6)}] fire@0.05=${f05.toFixed(4)} `
      + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'family-c-empirical-ref', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  baseline_n: BASELINE_N, nulls: NULLS.map((s) => s.id),
  shared_modules_verified: shared, arm_meta: meta,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
