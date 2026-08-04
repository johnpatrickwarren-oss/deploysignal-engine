// harness/run-pool.mjs — C13. Does the 500-draw reference pool explain the
// Family C betting e-process failing its own Gaussian control?
//
//   node harness/run-pool.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//   node harness/run-pool.mjs --mode sim   (throwaway, under results/sim/)
//
// Endpoints and arms are fixed by ../PREREGISTRATION.md. Nothing here reads a
// result and changes what it measures.
//
// The cell, the nulls, the calibrators and the provenance check are REUSED
// verbatim from ../../family-ce-nulls/harness/ so the A0 arm is a true
// replication and not a re-implementation that happens to agree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, verifyProvenance, P, CELL_KEY,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const DET = (m) => require(path.join(ENGINE_ROOT, 'dist', 'detectors', `${m}.js`));
const rff = DET('family-c-rff');
const smmd = DET('sequential-mmd');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = Number(arg('--baseline-n', 600));
const SEED = 20260803;                     // same seed as family-ce-nulls, so A0 replicates
const ALPHAS = [0.05, 0.01];
const SHIPPED_ALPHA_C = 1e-4;
const BLOCKS = [[0, 10], [10, 50], [50, 150], [150, T]];
const LOG_FACTOR_FLOOR = 1e-12;            // detectors/_family-c-betting-state.ts:15

/** The arms, PREREGISTRATION §5. `pool: null` means the closed form. */
const ARMS = [
  { id: 'A0', pool: 500, label: 'shipped FAMILY_C_BETTING_BASELINE_POOL_SIZE' },
  { id: 'A1a', pool: 2000, label: 'pool ×4' },
  { id: 'A1b', pool: 8000, label: 'pool ×16' },
  { id: 'A1c', pool: 32000, label: 'pool ×64' },
  { id: 'A2', pool: null, label: 'exact closed-form mean embedding' },
];

const CONTROLS = NULLS.filter((s) => s.control);   // the two Gaussian arms only

// ── the two ways to build μ_P^φ ───────────────────────────────────────

/** Monte Carlo, exactly as the calibrator does it, at an arbitrary N_P.
 *  `_family-c-build.ts:304-325` — same pool generator, same seed, same map. */
function mcRffMean(famC, fm, poolSize) {
  const pool = smmd.generateBaselinePool(
    famC, poolSize, smmd.baselinePoolSeed({
      hour_of_day: CELL_KEY.hour_of_day, day_of_week: CELL_KEY.day_of_week,
    }));
  const D = fm.D;
  const acc = new Float64Array(D);
  for (const x of pool) {
    const phi = rff.applyRffFeatureMap(x, fm);
    for (let i = 0; i < D; i++) acc[i] += phi[i];
  }
  const out = new Array(D);
  for (let i = 0; i < D; i++) out[i] = acc[i] / pool.length;
  return out;
}

/** Closed form, PREREGISTRATION §3.
 *
 *    φ_i(x) = √(2/D)·cos(ωᵢᵀx + bᵢ),  x ~ N(0, Σ)
 *    ωᵢᵀx ~ N(0, ωᵢᵀΣωᵢ),  E[cos(Z+b)] = e^{−v/2}·cos b for Z ~ N(0,v)
 *  ⇒ μ_P^φ[i] = √(2/D)·exp(−½ ωᵢᵀΣωᵢ)·cos(bᵢ)
 *
 *  Exact. The pool law IS N(0, Σ) — `generateBaselinePool` emits z = L·w with
 *  w ~ N(0,I), described in sequential-mmd.ts as a "relative-deviation vector
 *  around the origin", i.e. zero-mean. */
function analyticRffMean(famC, fm) {
  const D = fm.D, d = fm.d, S = famC.covariance;
  const scale = Math.sqrt(2 / D);
  const out = new Array(D);
  for (let i = 0; i < D; i++) {
    const w = fm.omega[i];
    let v = 0;
    for (let r = 0; r < d; r++) {
      let s = 0;
      for (let c = 0; c < d; c++) s += S[r][c] * w[c];
      v += w[r] * s;
    }
    out[i] = scale * Math.exp(-0.5 * v) * Math.cos(fm.b[i]);
  }
  return out;
}

/** Replace the compiled μ_P^φ in place. Returns a diagnostic on how far the
 *  arm's vector sits from the shipped one — the ‖ε‖ that H1 is about. */
function overrideRffMean(famC, arm) {
  const bp = famC.betting_e_process_params;
  const fm = rff.computeRffFeatureMap(
    bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  const shipped = bp.baseline_rff_mean.slice();
  const next = arm.pool === null ? analyticRffMean(famC, fm) : mcRffMean(famC, fm, arm.pool);
  let d2 = 0, n2 = 0;
  for (let i = 0; i < next.length; i++) { d2 += (next[i] - shipped[i]) ** 2; n2 += next[i] ** 2; }
  bp.baseline_rff_mean = next;
  bp.baseline_sample_size = arm.pool === null ? -1 : arm.pool;
  return { l2_from_shipped: Math.sqrt(d2), l2_norm: Math.sqrt(n2) };
}

/** The same override applied to the analytic vector, used once per bundle to
 *  report ‖μ̂_P(N_P) − μ_P(exact)‖ — the direct measurement of ε that the
 *  1/N_P prediction is about. Reported, scored by nothing. */
function epsilonVsExact(famC, fm, poolSize) {
  const exact = analyticRffMean(famC, fm);
  const mc = mcRffMean(famC, fm, poolSize);
  let s = 0;
  for (let i = 0; i < exact.length; i++) s += (mc[i] - exact[i]) ** 2;
  return Math.sqrt(s);
}

// ── statistics (identical conventions to ../../family-ce-nulls) ───────

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

// ── one trajectory ────────────────────────────────────────────────────

function drawTrajectory(spec, seed) {
  const draw = deviationStream(spec, seed);
  const out = [];
  for (let t = 0; t < T; t++) out.push(draw());
  return out;
}

function runFamilyC(cfg, famC, devs) {
  const states = {};
  const exps = [];
  let maxLog = 0, clamps = 0;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const key = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const before = key ? states[key].log_S_t : 0;
    const v = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
    if (!v) throw new Error('family C returned null — cell not compiled');
    if (v.verdict === 'suppressed') { exps.push(1); continue; }
    const k2 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const after = states[k2].log_S_t;
    const e = Math.exp(after - before);
    // H3: the wealth factor is floored at 1e-12, which would truncate a loss.
    // A clamped tick lands on exactly that value.
    if (Math.abs(e - LOG_FACTOR_FLOOR) < 1e-18) clamps++;
    exps.push(e);
    if (after > maxLog) maxLog = after;
  }
  const k = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
  return { exps, maxLog, logMT: states[k].log_S_t, clamps };
}

// ── accumulation ──────────────────────────────────────────────────────

function newAcc() {
  return {
    perTrajInc: [], terminal: [], maxLog: [],
    blocks: BLOCKS.map(() => []), worst: Array.from({ length: T }, () => []),
    clamps: 0,
  };
}

function push(acc, exps, MT, maxLog, clamps) {
  acc.perTrajInc.push(exps.reduce((a, b) => a + b, 0) / exps.length);
  acc.terminal.push(MT);
  acc.maxLog.push(maxLog);
  acc.clamps += clamps;
  BLOCKS.forEach(([lo, hi], bi) => {
    const s = exps.slice(lo, hi);
    if (s.length) acc.blocks[bi].push(s.reduce((a, b) => a + b, 0) / s.length);
  });
  for (let t = 0; t < exps.length && t < T; t++) acc.worst[t].push(exps[t]);
}

function finish(acc) {
  const worst = acc.worst
    .map((xs, t) => (xs.length ? { tick: t, ...summarise(xs) } : null))
    .filter(Boolean)
    .sort((a, b) => b.lower95_one_sided - a.lower95_one_sided)[0];
  return {
    increment_estimator: summarise(acc.perTrajInc),
    terminal_mean: summarise(acc.terminal),
    blocks: BLOCKS.map(([from, to], i) => ({ from, to, ...summarise(acc.blocks[i]) })),
    worst_tick: worst ? { tick: worst.tick, mean: worst.mean, se: worst.se } : null,
    clamp_events: acc.clamps,
  };
}

// ── main ──────────────────────────────────────────────────────────────

const shared = verifyProvenance();
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();

const cells = [];
const bundleMeta = [];
const t0 = Date.now();

for (const arm of ARMS) {
  for (const spec of CONTROLS) {
    const acc = newAcc();
    const perBundle = Math.ceil(N / BUNDLES);
    let done = 0;
    for (let b = 0; b < BUNDLES && done < N; b++) {
      // Byte-identical baseline draw to family-ce-nulls, so A0 replicates it.
      const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
      const baseDraw = deviationStream(spec, baseSeed);
      const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
      const { cfg, famC } = buildBundle(rows);
      const bp = famC.betting_e_process_params;
      const fm = rff.computeRffFeatureMap(
        bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
      const eps = arm.pool === null ? 0 : epsilonVsExact(famC, fm, arm.pool);
      const ov = overrideRffMean(famC, arm);
      if (b === 0) {
        bundleMeta.push({
          arm: arm.id, null_id: spec.id, pool: arm.pool, bundle: b,
          rff_dim: bp.rff_dim, bandwidth: bp.kernel_bandwidth_sigma,
          covariance_method: famC.covariance_method,
          l2_from_shipped: ov.l2_from_shipped, l2_norm: ov.l2_norm,
          l2_epsilon_vs_exact: eps,
        });
      }
      for (let i = 0; i < perBundle && done < N; i++, done++) {
        const devs = drawTrajectory(spec, SEED + 7919 * done + 31 * b);
        const c = runFamilyC(cfg, famC, devs);
        push(acc, c.exps, Math.exp(Math.min(c.logMT, 700)), c.maxLog, c.clamps);
      }
    }
    const fin = finish(acc);
    for (const a of [...ALPHAS, SHIPPED_ALPHA_C]) {
      const thr = Math.log(1 / a);
      const fires = acc.maxLog.filter((m) => m >= thr).length;
      const rec = {
        arm: arm.id, arm_label: arm.label, pool_size: arm.pool,
        detector: 'family_C_mmd_betting_e_process',
        null_id: spec.id, null_label: spec.label, control: spec.control,
        alpha: a, scored: a !== SHIPPED_ALPHA_C, n: done, ticks: T, bundles: BUNDLES,
        fires, fire_rate: fires / done, fire_rate_lower95: rateLower95(fires, done),
        fire_verdict: rateLower95(fires, done) > a ? 'FAIL' : 'not-refuted',
        ...fin,
        mode: MODE, engine_version: engineVersion, git_sha: gitSha,
      };
      // PREREGISTRATION §6 — the two-sided rule.
      rec.supermartingale_verdict =
        rec.increment_estimator.lower95_one_sided > 1 ? 'REFUTED'
          : rec.increment_estimator.upper95_one_sided < 1.0005 ? 'CLEARED'
            : 'inconclusive';
      cells.push(rec);
    }
    process.stderr.write(
      `${arm.id} ${spec.id}: inc=${fin.increment_estimator.mean.toFixed(6)} `
      + `[${fin.increment_estimator.lower95_one_sided.toFixed(6)}, `
      + `${fin.increment_estimator.upper95_one_sided.toFixed(6)}] `
      + `fire@0.05=${(acc.maxLog.filter((m) => m >= Math.log(20)).length / done).toFixed(4)} `
      + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

// ── the scaling exponent, PREREGISTRATION §6 secondary ────────────────

function scalingFit(nullId) {
  const pts = ARMS.filter((a) => a.pool !== null).map((a) => {
    const c = cells.find((x) => x.arm === a.id && x.null_id === nullId && x.alpha === 0.05);
    return { pool: a.pool, excess: c.increment_estimator.mean - 1 };
  }).filter((p) => p.excess > 0);
  if (pts.length < 3) return { n: pts.length, note: 'too few positive-excess points to fit' };
  const xs = pts.map((p) => Math.log(p.pool));
  const ys = pts.map((p) => Math.log(p.excess));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const se = n > 2 ? Math.sqrt((sse / (n - 2)) / sxx) : NaN;
  return { n, points: pts, slope, se, ci95: [slope - 1.96 * se, slope + 1.96 * se] };
}

const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(path.join(outDir, 'cells'), { recursive: true });
for (const c of cells) {
  fs.writeFileSync(
    path.join(outDir, 'cells', `${c.arm}__${c.null_id}__a${c.alpha}.json`),
    `${JSON.stringify(c, null, 1)}\n`);
}
fs.writeFileSync(path.join(outDir, 'summary.json'),
  `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'family-c-pool', prereg: '../PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES,
  baseline_n: BASELINE_N, arms: ARMS, nulls: CONTROLS.map((s) => s.id),
  shared_modules_verified: shared,
  engine_version: engineVersion, git_sha: gitSha, mode: MODE,
  elapsed_s: (Date.now() - t0) / 1000,
  bundle_meta: bundleMeta,
  scaling_fit: Object.fromEntries(CONTROLS.map((s) => [s.id, scalingFit(s.id)])),
}, null, 1)}\n`);

process.stderr.write(`\nwrote ${outDir}\n`);
for (const s of CONTROLS) {
  const f = scalingFit(s.id);
  process.stderr.write(`scaling ${s.id}: slope=${f.slope?.toFixed(3)} se=${f.se?.toFixed(3)}\n`);
}
