// harness/run-family-c.mjs — C19 clause 1. Family C's betting e-process on
// `mrcd`, the only covariance method that carries it in the corpus.
//
//   node harness/run-family-c.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//
// Arms and endpoints fixed by ../PREREGISTRATION.md §3.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, rowsFromDeviations, liveMetricsFrom, EVAL_CTX, bettingC,
  verifyProvenance, CELL_KEY, familyCBuild, familyECal, SIGNALS,
  covarianceCorr, covarianceDiag,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const DS_ROOT = path.resolve(ENGINE_ROOT, '..', 'deploysignal');
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const covMod = require(path.join(DS_ROOT, 'tools', 'calibrators', '_family-c-covariance.js'));
const { relativeDeviations } = covMod;

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const SEED = 20260803;
const ALPHAS = [0.05, 0.01];
const METHODS = ['mcd', 'mrcd'];
const BASELINE_NS = [600, 120];
const REFS = ['B0', 'B1'];

function buildFamilyCBundle(rows, method) {
  const famC = familyCBuild.buildFamilyCPerCell(
    rows, { covariance_method_override: method }, CELL_KEY, 1e-4).result;
  if (!famC.betting_e_process_params) return null;   // D7 did not stamp; cell carries no detector
  const famE = familyECal.buildFamilyEPerCell(
    famC, familyECal.familyESeedForCell(CELL_KEY), 7, 14, 'force_weighted_e_value');
  const cfg = {
    family_c_signals: SIGNALS,
    alpha_budget: { total: 1e-3, per_family: { C: 2e-4, E: 1e-4 } },
    bake_profiles: {},
    traffic_pct_gate: { min_traffic_pct_for_fire: 0 },
    baseline_cells: {
      dimensions: ['hour_of_day'],
      cells: [{ key: CELL_KEY, n_samples: rows.length, confidence: 'strict',
        family_C: famC, family_E: famE }],
      aggregate_fallback: { family_C: famC, family_E: famE },
    },
  };
  return { cfg, famC };
}

/** B1: μ_P^φ from the real baseline rows (the C16 change), applied in place. */
function applyEmpiricalRef(famC, rows) {
  const bp = famC.betting_e_process_params;
  const fm = rff.computeRffFeatureMap(
    bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  const Z = relativeDeviations(rows, famC.mean_vector);
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const z of Z) {
    const phi = rff.applyRffFeatureMap(z, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  bp.baseline_rff_mean = Array.from({ length: D }, (_, i) => acc[i] / Z.length);
  bp.baseline_sample_size = Z.length;
}

const trace = (S) => S.reduce((a, r, i) => a + r[i], 0);

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
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
const skipped = [];
const t0 = Date.now();

for (const method of METHODS) {
  for (const baselineN of BASELINE_NS) {
    for (const ref of REFS) {
      for (const spec of NULLS) {
        const SIGMA_TRUE = spec.sigma === 'corr' ? covarianceCorr() : covarianceDiag();
        const trTrue = trace(SIGMA_TRUE);
        const perTraj = [], maxLogs = [], traceRatios = [];
        const methodsSeen = new Set();
        const perBundle = Math.ceil(N / BUNDLES);
        let done = 0, unbuildable = 0;
        for (let b = 0; b < BUNDLES && done < N; b++) {
          const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
          const baseDraw = deviationStream(spec, baseSeed);
          const rows = rowsFromDeviations(Array.from({ length: baselineN }, baseDraw));
          const built = buildFamilyCBundle(rows, method);
          if (!built) { unbuildable++; continue; }
          const { cfg, famC } = built;
          if (ref === 'B1') applyEmpiricalRef(famC, rows);
          if (b === 0 || traceRatios.length === 0) {
            traceRatios.push(trace(famC.covariance) / trTrue);
            methodsSeen.add(famC.covariance_method);
          }
          for (let i = 0; i < perBundle && done < N; i++, done++) {
            const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
            const devs = [];
            for (let t = 0; t < T; t++) devs.push(draw());
            const c = runFamilyC(cfg, famC, devs);
            perTraj.push(c.exps.reduce((a, x) => a + x, 0) / c.exps.length);
            maxLogs.push(c.maxLog);
          }
        }
        if (done === 0) {
          skipped.push({ method, baselineN, ref, null_id: spec.id,
            reason: 'D7 stamped no betting_e_process_params on any bundle', unbuildable });
          process.stderr.write(
            `${method.padEnd(5)} n=${String(baselineN).padStart(3)} ${ref} ${spec.id.padEnd(15)} `
            + `SKIPPED — no betting params on any of ${unbuildable} bundles\n`);
          continue;
        }
        const inc = summarise(perTraj);
        for (const alpha of ALPHAS) {
          const thr = Math.log(1 / alpha);
          const fires = maxLogs.filter((m) => m >= thr).length;
          cells.push({
            detector: 'family_C_mmd_betting_e_process',
            covariance_method_requested: method,
            covariance_method_realised: [...methodsSeen][0] ?? null,
            reference: ref, baseline_n: baselineN, null_id: spec.id, control: spec.control,
            alpha, n: done, ticks: T, bundles: BUNDLES, unbuildable_bundles: unbuildable,
            fires, crossing_rate: fires / done, crossing_rate_lower95: rateLower95(fires, done),
            increment_estimator: inc,
            trace_ratio_bundle0: traceRatios[0] ?? null,
            supermartingale_verdict: inc.lower95_one_sided > 1 ? 'REFUTED'
              : inc.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive',
            mode: MODE, engine_version: engineVersion, git_sha: gitSha,
          });
        }
        const f05 = maxLogs.filter((m) => m >= Math.log(20)).length / done;
        process.stderr.write(
          `${method.padEnd(5)} n=${String(baselineN).padStart(3)} ${ref} ${spec.id.padEnd(15)} `
          + `inc=${inc.mean.toFixed(6)} cross@0.05=${f05.toFixed(4)} `
          + `trace=${(traceRatios[0] ?? NaN).toFixed(4)} [${[...methodsSeen][0]}] `
          + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
      }
    }
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells, skipped }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'family-c-shipped', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  methods: METHODS, baseline_ns: BASELINE_NS, refs: REFS, alphas: ALPHAS,
  nulls: NULLS.map((s) => s.id), shared_modules_verified: shared, skipped,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
