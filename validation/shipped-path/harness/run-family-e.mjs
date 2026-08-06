// harness/run-family-e.mjs — C18 Part 1. What does Family E do on the
// covariance path that actually ships?
//
//   node harness/run-family-e.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//
// Arms and endpoints fixed by ../PREREGISTRATION.md §3. The cell, nulls and
// calibrators are reused verbatim from ../../family-ce-nulls/ so the mcd/n=600
// cell is a true replication (P2, the gate).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, rowsFromDeviations, liveMetricsFrom, EVAL_CTX, conformal,
  verifyProvenance, CELL_KEY, familyCBuild, familyECal, SIGNALS,
  covarianceCorr, covarianceDiag, P,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const SEED = 20260803;
const ALPHAS = [0.05, 0.01];
const METHODS = ['mcd', 'mrcd', 'ledoit_wolf'];
const BASELINE_NS = [120, 600];

/** Build a bundle at a chosen covariance method. Family E only — Family C's
 *  betting path needs mmd_params, which is a separate question (§5). */
function buildFamilyEBundle(rows, method, alphaE) {
  const famC = familyCBuild.buildFamilyCPerCell(
    rows, { covariance_method_override: method }, CELL_KEY, 1e-4).result;
  const famE = familyECal.buildFamilyEPerCell(
    famC, familyECal.familyESeedForCell(CELL_KEY), 7, 14, 'force_weighted_e_value');
  if (!famE || famE.kind !== 'weighted_e_value') {
    throw new Error(`bundle: expected weighted_e_value, got ${famE && famE.kind}`);
  }
  const cfg = {
    family_c_signals: SIGNALS,
    alpha_budget: { total: 1e-3, per_family: { C: 2e-4, E: alphaE } },
    bake_profiles: {},
    traffic_pct_gate: { min_traffic_pct_for_fire: 0 },
    baseline_cells: {
      dimensions: ['hour_of_day'],
      cells: [{ key: CELL_KEY, n_samples: rows.length, confidence: 'strict',
        family_C: famC, family_E: famE }],
      aggregate_fallback: { family_C: famC, family_E: famE },
    },
  };
  return { cfg, famC, famE };
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

function runFamilyE(cfg, famC, devs) {
  const state = conformal.freshConformalEValueState();
  let indicators = 0, fired = false, maxM = 1;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const before = state.M;
    const v = conformal.evaluateFamilyE(cfg, live, EVAL_CTX, state);
    if (!v) throw new Error('family E returned null — cell not compiled');
    if (v.verdict === 'suppressed') throw new Error(`family E suppressed: ${v.reason_code}`);
    if (state.M / before > 1) indicators++;
    if (state.M > maxM) maxM = state.M;
    if (v.verdict === 'fire') fired = true;
  }
  return { indicators, fired, ticks: devs.length };
}

const shared = verifyProvenance();
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();

const cells = [];
const t0 = Date.now();

for (const method of METHODS) {
  for (const baselineN of BASELINE_NS) {
    for (const spec of NULLS) {
      const SIGMA_TRUE = spec.sigma === 'corr' ? covarianceCorr() : covarianceDiag();
      const trTrue = trace(SIGMA_TRUE);
      for (const alpha of ALPHAS) {
        let indicators = 0, ticks = 0, fires = 0, done = 0;
        const traceRatios = [], methodsSeen = new Set();
        const perBundle = Math.ceil(N / BUNDLES);
        for (let b = 0; b < BUNDLES && done < N; b++) {
          const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
          const baseDraw = deviationStream(spec, baseSeed);
          const rows = rowsFromDeviations(Array.from({ length: baselineN }, baseDraw));
          const { cfg, famC } = buildFamilyEBundle(rows, method, alpha);
          if (b === 0) {
            traceRatios.push(trace(famC.covariance) / trTrue);
            methodsSeen.add(famC.covariance_method);
          }
          for (let i = 0; i < perBundle && done < N; i++, done++) {
            const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
            const devs = [];
            for (let t = 0; t < T; t++) devs.push(draw());
            const e = runFamilyE(cfg, famC, devs);
            indicators += e.indicators; ticks += e.ticks;
            if (e.fired) fires++;
          }
        }
        const indRate = indicators / ticks;
        // Indicator lower bound: cluster-free binomial over ticks is
        // anti-conservative; use the trajectory-clustered Wilson on fires and a
        // plain Wilson on the tick indicator, reporting both.
        cells.push({
          detector: 'family_E_conformal_weighted_e_value',
          covariance_method_requested: method,
          covariance_method_realised: [...methodsSeen][0] ?? null,
          baseline_n: baselineN, null_id: spec.id, control: spec.control,
          alpha, n: done, ticks_total: ticks, bundles: BUNDLES,
          indicator_count: indicators, indicator_rate: indRate,
          indicator_rate_lower95: rateLower95(indicators, ticks),
          crossing_fires: fires, crossing_rate: fires / done,
          crossing_rate_lower95: rateLower95(fires, done),
          trace_ratio_bundle0: traceRatios[0] ?? null,
          verdict: rateLower95(indicators, ticks) > alpha ? 'ANTI-CONSERVATIVE'
            : indRate < alpha ? 'conservative' : 'nominal',
          mode: MODE, engine_version: engineVersion, git_sha: gitSha,
        });
        process.stderr.write(
          `${method.padEnd(11)} n=${String(baselineN).padStart(3)} ${spec.id.padEnd(15)} `
          + `a=${alpha} ind=${indRate.toFixed(5)} cross=${(fires / done).toFixed(4)} `
          + `trace=${(traceRatios[0] ?? NaN).toFixed(4)} `
          + `[${[...methodsSeen][0]}] (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
      }
    }
  }
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `part1-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'shipped-path-part1', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  methods: METHODS, baseline_ns: BASELINE_NS, alphas: ALPHAS,
  nulls: NULLS.map((s) => s.id), shared_modules_verified: shared,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);
