// harness/run.mjs — the study. Append-only; never overwrites a run.
//
//   node harness/run.mjs --mode live [--n 2000] [--t 300] [--bundles 10]
//   node harness/run.mjs --mode sim   (writes under results/sim/, throwaway)
//
// Endpoints are fixed by PREREGISTRATION.md. Nothing here reads a result and
// changes what it measures.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, conformal, essGateProfile, verifyProvenance, P,
} from './bundle.mjs';
import { NULLS, deviationStream, shapeDiagnostics, MIX_A, MIX_S, ASHMAN_D, MIX_EXCESS_KURTOSIS } from './nulls.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = Number(arg('--baseline-n', 600));
const SEED = 20260803;
const ALPHAS = [0.05, 0.01];
const SHIPPED_ALPHA_C = 1e-4;   // α_C/2 on the default 2e-4 Family C budget
const SHIPPED_ALPHA_E = 1e-4;
const BLOCKS = [[0, 10], [10, 50], [50, 150], [150, T]];

// ── statistics ────────────────────────────────────────────────────────

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

/** Wilson one-sided 95% lower bound on a rate; the h0-battery's P1 convention. */
function rateLower95(fires, n) {
  const rate = fires / n;
  const z = 1.645;
  const denom = 1 + z * z / n;
  const centre = rate + z * z / (2 * n);
  const half = z * Math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n));
  return Math.max(0, (centre - half) / denom);
}

// ── one trajectory ────────────────────────────────────────────────────

/** Draw T relative-deviation vectors. `inflate` multiplies deviations from
 *  `onset` onward — a pure variance inflation with no mean shift, which is
 *  the shape Family C's MMD detector exists to catch (sequential-mmd.ts
 *  header: "bimodality emergence, variance inflation without mean-shift"). */
function drawTrajectory(spec, seed, { inflate = 1, onset = 100, shift = 0 } = {}) {
  const draw = deviationStream(spec, seed);
  const out = [];
  for (let t = 0; t < T; t++) {
    const z = draw();
    if (t >= onset && inflate !== 1) for (let i = 0; i < P; i++) z[i] *= inflate;
    if (t >= onset && shift !== 0) for (let i = 0; i < P; i++) z[i] += shift;
    out.push(z);
  }
  return out;
}

/** Family C canonical betting e-process over one trajectory.
 *  Δ log M is read off `state.log_S_t` before/after each call — exact, and it
 *  requires no change to the detector. */
function runFamilyC(cfg, famC, devs) {
  const states = {};
  const exps = [];
  let maxLog = 0;
  let ticks = 0, suppressed = 0;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const key = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const before = key ? states[key].log_S_t : 0;
    const v = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
    if (!v) throw new Error('family C returned null — cell not compiled');
    if (v.verdict === 'suppressed') { suppressed++; exps.push(1); continue; }
    const k2 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
    const after = states[k2].log_S_t;
    exps.push(Math.exp(after - before));
    if (after > maxLog) maxLog = after;
    ticks++;
  }
  const k = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
  return { exps, maxLog, logMT: states[k].log_S_t, ticks, suppressed };
}

/** Family E weighted_e_value over one trajectory at a given α.
 *  α changes the DYNAMICS here (e_t = 1 + 1{tail} − α and the tail cutoff is
 *  α·total_weight), so unlike Family C this must be re-run per α. */
function runFamilyE(cfgBase, famC, devs, alpha) {
  const cfg = {
    ...cfgBase,
    alpha_budget: { ...cfgBase.alpha_budget, per_family: { ...cfgBase.alpha_budget.per_family, E: alpha } },
  };
  const state = conformal.freshConformalEValueState();
  const exps = [];
  let maxM = 1, fired = false, indicators = 0;
  for (let t = 0; t < devs.length; t++) {
    const live = liveMetricsFrom(devs[t], famC.mean_vector);
    const before = state.M;
    const v = conformal.evaluateFamilyE(cfg, live, EVAL_CTX, state);
    if (!v) throw new Error('family E returned null — cell not compiled');
    if (v.verdict === 'suppressed') throw new Error(`family E suppressed: ${v.reason_code}`);
    const e = state.M / before;
    exps.push(e);
    if (e > 1) indicators++;
    if (state.M > maxM) maxM = state.M;
    if (v.verdict === 'fire') fired = true;
  }
  return { exps, maxM, MT: state.M, fired, indicators };
}

// ── cell accumulation ─────────────────────────────────────────────────

function newAcc() {
  return {
    perTraj: [], blockPerTraj: BLOCKS.map(() => []),
    tickSum: new Array(T).fill(0), tickSumSq: new Array(T).fill(0), tickN: new Array(T).fill(0),
    MT: [], maxLog: [],
  };
}

function push(acc, exps, MT, maxLog) {
  const n = exps.length;
  acc.perTraj.push(exps.reduce((a, b) => a + b, 0) / n);
  BLOCKS.forEach(([lo, hi], bi) => {
    const seg = exps.slice(lo, hi);
    if (seg.length) acc.blockPerTraj[bi].push(seg.reduce((a, b) => a + b, 0) / seg.length);
  });
  for (let t = 0; t < n; t++) { acc.tickSum[t] += exps[t]; acc.tickSumSq[t] += exps[t] ** 2; acc.tickN[t]++; }
  acc.MT.push(MT);
  acc.maxLog.push(maxLog);
}

function finish(acc) {
  const inc = summarise(acc.perTraj);
  const tickMeans = [];
  for (let t = 0; t < T; t++) {
    if (!acc.tickN[t]) continue;
    const m = acc.tickSum[t] / acc.tickN[t];
    const v = Math.max(0, acc.tickSumSq[t] / acc.tickN[t] - m * m);
    tickMeans.push({ tick: t, mean: m, se: Math.sqrt(v / acc.tickN[t]) });
  }
  const worst = tickMeans.reduce((a, b) => (b.mean - 1.645 * b.se > a.mean - 1.645 * a.se ? b : a), tickMeans[0]);
  return {
    increment_estimator: inc,
    blocks: BLOCKS.map(([lo, hi], i) => ({ from: lo, to: hi, ...summarise(acc.blockPerTraj[i]) })),
    worst_tick: worst,
    terminal_mean: summarise(acc.MT),
    tick_profile: tickMeans.filter((_, i) => i % 5 === 0),
  };
}

// ── run ───────────────────────────────────────────────────────────────

verifyProvenance();
const engineVersion = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const dsSha = (() => {
  try { return execSync('git rev-parse HEAD', { cwd: path.resolve(ENGINE_ROOT, '..', 'deploysignal') }).toString().trim(); }
  catch { return 'unavailable'; }
})();

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const perBundle = Math.ceil(N / BUNDLES);
const cells = [];
const only = arg('--only', null);

for (const spec of NULLS) {
  if (only && spec.id !== only) continue;
  const accC = newAcc();
  const accE = new Map(ALPHAS.concat([SHIPPED_ALPHA_E]).map((a) => [a, newAcc()]));
  const fireE = new Map(ALPHAS.concat([SHIPPED_ALPHA_E]).map((a) => [a, 0]));
  const indE = new Map(ALPHAS.concat([SHIPPED_ALPHA_E]).map((a) => [a, 0]));
  const bundleMeta = [];
  let done = 0;
  const t0 = Date.now();

  for (let b = 0; b < BUNDLES && done < N; b++) {
    const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
    const baseDraw = deviationStream(spec, baseSeed);
    const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
    const { cfg, famC, famE } = buildBundle(rows);
    bundleMeta.push({
      bundle: b, baseline_n: BASELINE_N, covariance_method: famC.covariance_method,
      bandwidth: famC.betting_e_process_params.kernel_bandwidth_sigma,
      rff_dim: famC.betting_e_process_params.rff_dim,
      baseline_sample_size: famC.betting_e_process_params.baseline_sample_size,
      family_e_kind: famE.kind, family_e_M: famE.scores.length,
      family_e_ess: famE.effective_sample_size, family_e_total_weight: famE.total_weight,
    });

    for (let i = 0; i < perBundle && done < N; i++, done++) {
      const devs = drawTrajectory(spec, SEED + 7919 * done + 31 * b);
      const c = runFamilyC(cfg, famC, devs);
      push(accC, c.exps, Math.exp(Math.min(c.logMT, 700)), c.maxLog);
      for (const a of accE.keys()) {
        const e = runFamilyE(cfg, famC, devs, a);
        push(accE.get(a), e.exps, e.MT, Math.log(e.maxM));
        if (e.fired) fireE.set(a, fireE.get(a) + 1);
        indE.set(a, indE.get(a) + e.indicators);
      }
    }
  }

  // Family C: α only sets the threshold 1/α, so one run scores every α.
  for (const a of [...ALPHAS, SHIPPED_ALPHA_C]) {
    const thr = Math.log(1 / a);
    const fires = accC.maxLog.filter((m) => m >= thr).length;
    const rec = {
      detector: 'family_C_mmd_betting_e_process', family: 'C', kind: 'betting_e_process',
      null_id: spec.id, null_label: spec.label, control: spec.control,
      alpha: a, scored: a !== SHIPPED_ALPHA_C, n: done, ticks: T, bundles: bundleMeta.length,
      fires, fire_rate: fires / done, fire_rate_lower95: rateLower95(fires, done),
      fire_verdict: rateLower95(fires, done) > a ? 'FAIL' : 'not-refuted',
      ...finish(accC),
      mode: MODE, engine_version: engineVersion, git_sha: gitSha,
    };
    rec.supermartingale_verdict =
      rec.increment_estimator.lower95_one_sided > 1 ? 'REFUTED' : 'not-refuted';
    cells.push(rec);
    fs.writeFileSync(path.join(runDir, 'cells', `familyC__${spec.id}__a${a}.json`), JSON.stringify(rec, null, 2));
  }

  for (const a of accE.keys()) {
    const fires = fireE.get(a);
    const rec = {
      detector: 'family_E_conformal_weighted_e_value', family: 'E', kind: 'weighted_e_value',
      null_id: spec.id, null_label: spec.label, control: spec.control,
      alpha: a, scored: a !== SHIPPED_ALPHA_E, n: done, ticks: T, bundles: bundleMeta.length,
      fires, fire_rate: fires / done, fire_rate_lower95: rateLower95(fires, done),
      fire_verdict: rateLower95(fires, done) > a ? 'FAIL' : 'not-refuted',
      indicator_rate: indE.get(a) / (done * T),
      ...finish(accE.get(a)),
      mode: MODE, engine_version: engineVersion, git_sha: gitSha,
    };
    rec.supermartingale_verdict =
      rec.increment_estimator.lower95_one_sided > 1 ? 'REFUTED' : 'not-refuted';
    cells.push(rec);
    fs.writeFileSync(path.join(runDir, 'cells', `familyE__${spec.id}__a${a}.json`), JSON.stringify(rec, null, 2));
  }

  fs.writeFileSync(path.join(runDir, 'cells', `bundles__${spec.id}.json`), JSON.stringify(bundleMeta, null, 2));
  console.log(`${spec.id} done in ${((Date.now() - t0) / 1000).toFixed(1)}s (${done} trajectories)`);
  for (const c of cells.filter((x) => x.null_id === spec.id)) {
    console.log(`  ${c.detector.padEnd(38)} a=${String(c.alpha).padEnd(7)} `
      + `fire=${c.fire_rate.toFixed(4)} E[expD]=${c.increment_estimator.mean.toFixed(6)} `
      + `lo95=${c.increment_estimator.lower95_one_sided.toFixed(6)} `
      + `E[M_T]=${c.terminal_mean.mean.toExponential(3)} ${c.supermartingale_verdict}`);
  }
}

// ── P2, the vacuous-pass guard ────────────────────────────────────────
// Registered so that a quiet control cannot pass by being inert.

const p2 = [];
if (!only) {
  const spec = NULLS.find((s) => s.id === 'HC-gauss-corr');
  const baseDraw = deviationStream(spec, SEED + 555);
  const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
  const { cfg, famC } = buildBundle(rows);
  const NP2 = Math.min(N, 500);
  let detC = 0, detE = 0;
  for (let i = 0; i < NP2; i++) {
    const devs = drawTrajectory(spec, SEED + 104729 * i, { inflate: 2.0, onset: 100 });
    const c = runFamilyC(cfg, famC, devs);
    if (c.maxLog >= Math.log(1 / 0.05)) detC++;
    const devsE = drawTrajectory(spec, SEED + 104729 * i, { shift: 0.15, onset: 100 });
    const e = runFamilyE(cfg, famC, devsE, 0.05);
    if (e.fired) detE++;
  }
  p2.push({ detector: 'family_C_mmd_betting_e_process', alternative: 'variance inflation ×2 at tick 100, no mean shift', alpha: 0.05, n: NP2, detection_rate: detC / NP2, verdict: detC / NP2 < 0.5 ? 'FAIL' : 'pass' });
  p2.push({ detector: 'family_E_conformal_weighted_e_value', alternative: 'mean shift +0.15 (3σ per coord) at tick 100', alpha: 0.05, n: NP2, detection_rate: detE / NP2, verdict: detE / NP2 < 0.5 ? 'FAIL' : 'pass' });
  for (const r of p2) console.log(`P2 ${r.detector.padEnd(38)} detection=${r.detection_rate.toFixed(4)} ${r.verdict}`);
  fs.writeFileSync(path.join(runDir, 'cells', 'P2.json'), JSON.stringify(p2, null, 2));
}

fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-08-family-ce-nulls', mode: MODE,
  engine_version: engineVersion, git_sha: gitSha, deploysignal_git_sha: dsSha,
  registration_sha: process.env.REGISTRATION_SHA ?? 'see PREREGISTRATION.md',
  node: process.version, seed: SEED, n: N, ticks: T, bundles: BUNDLES, baseline_n: BASELINE_N,
  alphas: ALPHAS, shipped_alpha_C: SHIPPED_ALPHA_C, shipped_alpha_E: SHIPPED_ALPHA_E,
  blocks: BLOCKS, provenance_verified: verifyProvenance(),
  ess_gate: essGateProfile(),
  mixture: { a: MIX_A, s: MIX_S, ashman_D: ASHMAN_D, excess_kurtosis: MIX_EXCESS_KURTOSIS },
  shape_diagnostics: Object.fromEntries(NULLS.map((s) => [s.id, shapeDiagnostics(s, 424242, 100000)])),
  generated_at: stamp, argv: process.argv.slice(2),
}, null, 2));

fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ cells, p2 }, null, 2));
console.log(`\n${cells.length} cells -> ${path.relative(STUDY, runDir)}`);
