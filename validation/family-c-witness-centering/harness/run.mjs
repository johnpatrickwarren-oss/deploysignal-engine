// harness/run.mjs — C57: magnitude of the Family C witness-centering defect at exact
// parameters. Endpoints, arms, sizes and seeds are fixed by ../PREREGISTRATION.md
// (+ Amendment A1); nothing here reads a result and changes what it measures.
//
//   node harness/run.mjs --mode live
//   node harness/run.mjs --mode sim    (writes under results/sim/, git-ignored shakedown)
//
// The instrument drives dist/detectors/family-c-betting-e-process.js through the shipped
// evaluator and reads the detector's OWN state per tick. The per-tick F_t used by the
// mechanism channel is computed by calling the dist witness functions on the detector's own
// pre-tick state with the detector's own cached feature map — never a reimplementation.
// E0.3 checks per tick that (e_t − 1) = λ_{t−1}·F_t to 1e-9, so the harness F IS the
// detector's F or nothing is scored.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  ENGINE_ROOT, DS_ROOT, familyCBuild, bettingC, verifyProvenance,
  rowsFromDeviations, liveMetricsFrom, EVAL_CTX, CELL_KEY, SIGNALS, P,
  covarianceCorr, covarianceDiag, cholesky,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream, gaussFrom } from '../../family-ce-nulls/harness/nulls.mjs';
import { streamRng } from '../../family-d-emean/harness/seed.mjs';
import { stampBettingParams, analyticRffMean } from './stamp.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stateDet = require(path.join(ENGINE_ROOT, 'dist', 'detectors', '_family-c-betting-state.js'));

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
// Sim-mode shakedown may shrink sizes; live mode runs the registered sizes only.
const SIM_SCALE = MODE === 'live' ? 1 : Number(arg('--scale', 1));

// ── Registered constants (PREREG §2, §3). None is a flag in live mode. ──────────────
const REP_SEED = 20260803;                 // family-c-pool SEED, verbatim (E0.1 anchor)
const ALPHA_MMD = 1e-4;                    // buildBundle's alphaMMD, unchanged
const BASELINE_N = 600;
const BUNDLES = 10;
const LOG_A05 = Math.log(20);              // descriptive crossing at alpha = 0.05
const LOG_SHIPPED = Math.log(1 / ALPHA_MMD);
const LOG_FACTOR_FLOOR = 1e-12;            // detectors/_family-c-betting-state.ts:15
const BLOCKS = [[1, 10], [11, 50], [51, 150], [151, 300], [301, 600], [601, 900]];
const X1_ANCHOR = { corr: 1.002019, diag: 1.001878 };   // post-hoc X1, PREREG §1 (E1b)
const A2_ANCHOR = { corr: 1.006732, diag: 1.006659 };   // committed A2 (E0.1)

const scaleN = (n) => Math.max(20, Math.round(n * SIM_SCALE));
const CELLS = [
  { id: 'EXACT-corr-T900', arm: 'EXACT', null_id: 'HC-gauss-corr', sigma: 'corr', cellIdx: 0, N: scaleN(4000), T: 900 },
  { id: 'EXACT-diag-T900', arm: 'EXACT', null_id: 'HC-gauss-diag', sigma: 'diag', cellIdx: 1, N: scaleN(4000), T: 900 },
  { id: 'REPA2-corr-T300', arm: 'REPA2', null_id: 'HC-gauss-corr', sigma: 'corr', cellIdx: null, N: scaleN(2000), T: 300 },
  { id: 'REPA2-diag-T300', arm: 'REPA2', null_id: 'HC-gauss-diag', sigma: 'diag', cellIdx: null, N: scaleN(2000), T: 300 },
  { id: 'LEG500-corr-T300', arm: 'LEG', pool: 500, null_id: 'HC-gauss-corr', sigma: 'corr', cellIdx: 2, N: scaleN(2000), T: 300 },
  { id: 'LEG500-diag-T300', arm: 'LEG', pool: 500, null_id: 'HC-gauss-diag', sigma: 'diag', cellIdx: 3, N: scaleN(2000), T: 300 },
  { id: 'LEG8000-corr-T300', arm: 'LEG', pool: 8000, null_id: 'HC-gauss-corr', sigma: 'corr', cellIdx: 4, N: scaleN(1000), T: 300 },
  { id: 'LEG8000-diag-T300', arm: 'LEG', pool: 8000, null_id: 'HC-gauss-diag', sigma: 'diag', cellIdx: 5, N: scaleN(1000), T: 300 },
];

const SIGMA_TRUE = { corr: covarianceCorr(), diag: covarianceDiag() };
const CHOL_TRUE = { corr: cholesky(SIGMA_TRUE.corr), diag: cholesky(SIGMA_TRUE.diag) };
const nullById = (id) => NULLS.find((s) => s.id === id);

// ── Deviation streams ────────────────────────────────────────────────────────────────
// New cells: splitmix64 streams feeding the same transformation nulls.mjs applies.
// tests/harness.test.mjs proves this reproduces deviationStream() bit-identically when fed
// the same mulberry32 uniforms. REPA2 cells use deviationStream + the C13 seeds verbatim.
function deviationStreamRng(sigma, rng) {
  const g = gaussFrom(rng);
  const L = CHOL_TRUE[sigma];
  return () => {
    const u = new Array(P);
    for (let k = 0; k < P; k++) u[k] = g();
    const z = new Array(P);
    for (let i = 0; i < P; i++) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += L[i][j] * u[j];
      z[i] = s;
    }
    return z;
  };
}

// ── Bundle construction per arm ──────────────────────────────────────────────────────
let caughtFailures = 0;   // harness-discipline rule 2: every catch counts and prints

function buildCell(rows) {
  const famC = familyCBuild.buildFamilyCPerCell(
    rows, { covariance_method_override: 'mcd' }, CELL_KEY, ALPHA_MMD).result;
  if (!famC.mmd_params) throw new Error('calibrator produced no mmd_params');
  stampBettingParams(famC, CELL_KEY, ALPHA_MMD);   // Amendment A1 reconstruction
  const cfg = {
    family_c_signals: SIGNALS,
    alpha_budget: { total: 1e-3, per_family: { C: 2e-4 } },
    bake_profiles: {},
    traffic_pct_gate: { min_traffic_pct_for_fire: 0 },
    baseline_cells: {
      dimensions: ['hour_of_day'],
      cells: [{ key: CELL_KEY, n_samples: rows.length, confidence: 'strict', family_C: famC }],
      aggregate_fallback: { family_C: famC },
    },
  };
  return { cfg, famC };
}

const rffMod = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));

/** Build one bundle for `cell`, bundle index b. Returns everything a trajectory needs. */
function makeBundle(cell, b) {
  let rows;
  if (cell.arm === 'REPA2') {
    const spec = nullById(cell.null_id);
    const baseSeed = REP_SEED + 1000003 * b + spec.id.length * 7919;
    const baseDraw = deviationStream(spec, baseSeed);
    rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
  } else {
    const draw = deviationStreamRng(cell.sigma, streamRng(cell.cellIdx, b, 0));
    rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, draw));
  }
  const { cfg, famC } = buildCell(rows);
  const bp = famC.betting_e_process_params;
  const fm = rffMod.computeRffFeatureMap(
    bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);

  let mu0 = null, mu0norm2 = null;
  if (cell.arm === 'EXACT') {
    mu0 = analyticRffMean(SIGMA_TRUE[cell.sigma], fm);
    bp.baseline_rff_mean = mu0;
    bp.baseline_sample_size = -1;   // marks closed form, the C13 A2 convention
    mu0norm2 = mu0.reduce((a, x) => a + x * x, 0);
  } else if (cell.arm === 'REPA2') {
    bp.baseline_rff_mean = analyticRffMean(famC.covariance, fm);
    bp.baseline_sample_size = -1;
  } else {
    // Legacy kernel path: no RFF mean => rffActive false; oracle-Sigma pool at runtime.
    delete bp.baseline_rff_mean;
    famC.covariance = SIGMA_TRUE[cell.sigma];
    bp.baseline_sample_size = cell.pool;
  }
  return { cfg, famC, bp, mu0norm2, bandwidth: bp.kernel_bandwidth_sigma };
}

/** Deviation draw function for trajectory `traj` (1-based) of bundle `b`. */
function trajDraw(cell, b, traj, done) {
  if (cell.arm === 'REPA2') {
    return deviationStream(nullById(cell.null_id), REP_SEED + 7919 * done + 31 * b);
  }
  return deviationStreamRng(cell.sigma, streamRng(cell.cellIdx, b, traj));
}

// ── One trajectory ───────────────────────────────────────────────────────────────────

function runTrajectory(cell, bundle, draw, keepLog) {
  const { cfg, famC, bp } = bundle;
  const T = cell.T;
  const states = {};
  let state = null, fm = null, pool = null;
  let prevLog = 0;
  let sumE = 0, sumE300 = 0;
  const blockSums = BLOCKS.map(() => 0), blockCounts = BLOCKS.map(() => 0);
  let sumLB = 0, sumLFb = 0, sumFb = 0, sumF = 0, bTicks = 0, fTicks = 0;
  let clampPos = 0, clampNeg = 0, floorEvents = 0, suppressed = 0;
  let consistencyMax = 0;
  let logS300 = null, sup300 = -Infinity, supFull = -Infinity;
  const logs = keepLog ? new Float64Array(T) : null;
  const lambdaMax = bp.lambda_max;

  for (let t = 1; t <= T; t++) {
    const dev = draw();
    const live = liveMetricsFrom(dev, famC.mean_vector);

    // Pre-tick reads of the detector's own state (t >= 2; t = 1 reconstructed below).
    let lambdaPre = 0, b_t = null, F_pre = null, v = null;
    if (state) {
      lambdaPre = state.ons_lambda;
      v = stateDet.liveVectorFamilyC(live, famC.mean_vector, SIGNALS);
      if (cell.arm !== 'LEG') {
        const qc = state.q_count;
        if (bundle.mu0norm2 !== null) {
          let dq = 0;
          if (qc > 0) {
            const qs = state.q_running_phi_sum;
            for (let i = 0; i < qs.length; i++) dq += bp.baseline_rff_mean[i] * qs[i];
            dq /= qc;
          }
          b_t = bundle.mu0norm2 - dq;
        }
        F_pre = bettingC.computeRffWitness(
          v, bp.baseline_rff_mean, state.q_running_phi_sum, state.q_count, fm).F_t;
      } else {
        F_pre = bettingC.computeKernelMMDWitness(
          v, pool, state.q_running_sum, state.q_count,
          bp.kernel_bandwidth_sigma, state.witness_running_max, state.n);
      }
    }

    const verdict = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
    if (!verdict) throw new Error(`null verdict at tick ${t} — cell not compiled`);
    if (verdict.verdict === 'suppressed') { suppressed++; sumE += 1; if (t <= 300) sumE300 += 1; continue; }

    if (!state) {
      const key = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
      state = states[key];
      fm = states[`__rff_fm_${key}`];
      pool = states[Object.keys(states).find((k) => k.startsWith('__mmd_pool')) ?? ''] ?? null;
      // Reconstruct tick-1 pre-quantities: Q side was empty, lambda_0 = 0.
      v = stateDet.liveVectorFamilyC(live, famC.mean_vector, SIGNALS);
      if (cell.arm !== 'LEG') {
        if (bundle.mu0norm2 !== null) b_t = bundle.mu0norm2;
        F_pre = bettingC.computeRffWitness(
          v, bp.baseline_rff_mean, new Array(bp.rff_dim).fill(0), 0, fm).F_t;
      } else {
        F_pre = bettingC.computeKernelMMDWitness(
          v, pool, new Array(P).fill(0), 0, bp.kernel_bandwidth_sigma, 0, 0);
      }
      lambdaPre = 0;
    }

    const e = Math.exp(state.log_S_t - prevLog);
    prevLog = state.log_S_t;

    // E0.3 witness consistency: (e − 1) = lambda_pre * F_pre when above the floor.
    if (Math.abs(lambdaPre) > 1e-9 && Math.abs(e - LOG_FACTOR_FLOOR) >= 1e-18) {
      const d = Math.abs((e - 1) - lambdaPre * F_pre);
      if (d > consistencyMax) consistencyMax = d;
    }
    if (Math.abs(e - LOG_FACTOR_FLOOR) < 1e-18) floorEvents++;

    sumE += e;
    if (t <= 300) sumE300 += e;
    for (let bi = 0; bi < BLOCKS.length; bi++) {
      if (t >= BLOCKS[bi][0] && t <= BLOCKS[bi][1]) { blockSums[bi] += e; blockCounts[bi]++; }
    }
    if (b_t !== null) {
      sumLB += lambdaPre * b_t;
      sumLFb += lambdaPre * (F_pre - b_t);
      sumFb += F_pre - b_t;
      bTicks++;
    }
    if (cell.arm === 'LEG') { sumF += F_pre; fTicks++; }

    const lambdaPost = state.ons_lambda;
    if (lambdaPost === lambdaMax) clampPos++;
    else if (lambdaPost === -lambdaMax) clampNeg++;

    if (state.log_S_t > supFull) supFull = state.log_S_t;
    if (t <= 300 && state.log_S_t > sup300) sup300 = state.log_S_t;
    if (t === 300) logS300 = state.log_S_t;
    if (logs) logs[t - 1] = state.log_S_t;
  }

  return {
    meanE: sumE / T, meanE300: sumE300 / Math.min(T, 300),
    blockMeans: blockSums.map((s, i) => (blockCounts[i] ? s / blockCounts[i] : null)),
    meanLB: bTicks ? sumLB / T : null,
    meanLFb: bTicks ? sumLFb / T : null,
    meanFb: bTicks ? sumFb / T : null,
    meanF: fTicks ? sumF / T : null,
    clampPosFrac: clampPos / T, clampNegFrac: clampNeg / T,
    floorEvents, suppressed, consistencyMax,
    logS300, logSFinal: prevLog, sup300, supFull, logs,
  };
}

// ── Statistics (family-c-pool conventions; nearest-rank percentiles per the family-d
//    correction append item 3) ─────────────────────────────────────────────────────────
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
const pct = (sorted, p) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];

function terminalStats(logVals) {
  const S = logVals.map((l) => Math.exp(Math.min(l, 700))).sort((a, b) => a - b);
  const sum = S.reduce((a, b) => a + b, 0);
  return {
    mean: sum / S.length,
    p50: pct(S, 0.5), p99: pct(S, 0.99), max: S[S.length - 1],
    top1_share: S[S.length - 1] / sum,
  };
}

const smVerdict = (s) =>
  s.lower95_one_sided > 1 ? 'REFUTED' : s.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive';

// ── Run directory (append-only) ──────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const shared = verifyProvenance();
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const dsSha = execSync('git rev-parse HEAD', { cwd: DS_ROOT }).toString().trim();
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;

// ── Cells ────────────────────────────────────────────────────────────────────────────
const cellRecords = [];
let reproMismatches = 0;
let globalConsistencyMax = 0;

for (const cell of CELLS) {
  const perBundle = Math.ceil(cell.N / BUNDLES);
  const acc = {
    meanE: [], meanE300: [], blocks: BLOCKS.map(() => []),
    LB: [], LFb: [], Fb: [], F: [],
    clampPos: [], clampNeg: [],
    logS300: [], logSFinal: [],
    floorEvents: 0, suppressed: 0, consistencyMax: 0,
    cross05_300: 0, cross05_full: 0, crossShip_300: 0, crossShip_full: 0,
  };
  const bundleMeta = [];
  let done = 0;
  for (let b = 0; b < BUNDLES && done < cell.N; b++) {
    const bundle = makeBundle(cell, b);
    bundleMeta.push({
      bundle: b, bandwidth: bundle.bandwidth,
      mu0_norm2: bundle.mu0norm2,
    });

    // E0.2 determinism: 10 paired re-drives on bundle 0, bit-identical log_S sequences.
    if (b === 0) {
      for (let i = 1; i <= 10; i++) {
        const d1 = runTrajectory(cell, bundle, trajDraw(cell, 0, i, i - 1), true);
        const d2 = runTrajectory(cell, bundle, trajDraw(cell, 0, i, i - 1), true);
        for (let t = 0; t < cell.T; t++) {
          if (d1.logs[t] !== d2.logs[t]) { reproMismatches++; break; }
        }
      }
    }

    for (let i = 1; i <= perBundle && done < cell.N; i++, done++) {
      const tr = runTrajectory(cell, bundle, trajDraw(cell, b, i, done), false);
      acc.meanE.push(tr.meanE); acc.meanE300.push(tr.meanE300);
      tr.blockMeans.forEach((m, bi) => { if (m !== null) acc.blocks[bi].push(m); });
      if (tr.meanLB !== null) { acc.LB.push(tr.meanLB); acc.LFb.push(tr.meanLFb); acc.Fb.push(tr.meanFb); }
      if (tr.meanF !== null) acc.F.push(tr.meanF);
      acc.clampPos.push(tr.clampPosFrac); acc.clampNeg.push(tr.clampNegFrac);
      acc.logS300.push(tr.logS300); acc.logSFinal.push(tr.logSFinal);
      acc.floorEvents += tr.floorEvents; acc.suppressed += tr.suppressed;
      if (tr.consistencyMax > acc.consistencyMax) acc.consistencyMax = tr.consistencyMax;
      if (tr.sup300 >= LOG_A05) acc.cross05_300++;
      if (tr.supFull >= LOG_A05) acc.cross05_full++;
      if (tr.sup300 >= LOG_SHIPPED) acc.crossShip_300++;
      if (tr.supFull >= LOG_SHIPPED) acc.crossShip_full++;
    }
  }
  if (acc.consistencyMax > globalConsistencyMax) globalConsistencyMax = acc.consistencyMax;

  const incFull = summarise(acc.meanE);
  const inc300 = summarise(acc.meanE300);
  const rec = {
    study: '2026-08-family-c-witness-centering',
    detector: 'family_C_mmd_betting_e_process', family: 'C',
    control: 'witness-centering',
    cell_id: cell.id, arm: cell.arm, null_id: cell.null_id,
    n: done, ticks: cell.T, bundles: BUNDLES,
    // C54: the reference condition beside every number.
    reference: {
      mu_p_phi: cell.arm === 'EXACT' ? 'closed_form_N0_Sigma_true'
        : cell.arm === 'REPA2' ? 'closed_form_N0_Sigma_hat_mcd' : 'none_legacy_kernel_path',
      pool_size: cell.arm === 'LEG' ? cell.pool : null,
      pool_law: cell.arm === 'LEG' ? 'N(0, Sigma_true)' : null,
      baseline_rows: BASELINE_N, bundles: BUNDLES,
      rff_dim: cell.arm === 'LEG' ? null : 256,
      bandwidth_source: 'median heuristic, shipped calibrator, per bundle',
    },
    increment_summary: incFull,
    increment_summary_verdict: smVerdict(incFull),
    increment_summary_t300: inc300,
    blocks: BLOCKS.filter((bl) => bl[0] <= cell.T).map(([from, to], bi) => ({
      from, to, ...summarise(acc.blocks[bi]),
    })),
    mechanism: acc.LB.length ? {
      lambda_b: summarise(acc.LB),
      lambda_F_minus_b: summarise(acc.LFb),
      F_minus_b: summarise(acc.Fb),
    } : null,
    legacy_mean_F: acc.F.length ? summarise(acc.F) : null,
    clamp: { pos_frac: summarise(acc.clampPos), neg_frac: summarise(acc.clampNeg) },
    floor_events: acc.floorEvents,
    suppressed_ticks: acc.suppressed,
    consistency_max: acc.consistencyMax,
    terminal_t300: terminalStats(acc.logS300),
    terminal_final: terminalStats(acc.logSFinal),
    crossing: {
      alpha05_t300: acc.cross05_300 / done, alpha05_full: acc.cross05_full / done,
      shipped_t300: acc.crossShip_300 / done, shipped_full: acc.crossShip_full / done,
    },
    caught_failures: caughtFailures,
    bundle_meta: bundleMeta,
    mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  };
  cellRecords.push(rec);
  fs.writeFileSync(path.join(runDir, 'cells', `${cell.id}.json`), `${JSON.stringify(rec, null, 1)}\n`);
  process.stderr.write(
    `${cell.id}: inc=${incFull.mean.toFixed(6)} [${incFull.lower95_one_sided.toFixed(6)}, `
    + `${incFull.upper95_one_sided.toFixed(6)}] ${rec.increment_summary_verdict} `
    + `clamp+=${rec.clamp.pos_frac.mean.toFixed(4)} clamp-=${rec.clamp.neg_frac.mean.toFixed(4)}\n`);
}

// ── Endpoints (PREREG §4) ────────────────────────────────────────────────────────────
const byId = (id) => cellRecords.find((c) => c.cell_id === id);
const exact = { corr: byId('EXACT-corr-T900'), diag: byId('EXACT-diag-T900') };
const repa2 = { corr: byId('REPA2-corr-T300'), diag: byId('REPA2-diag-T300') };

const e01 = {
  corr: { measured: repa2.corr.increment_summary.mean, anchor: A2_ANCHOR.corr },
  diag: { measured: repa2.diag.increment_summary.mean, anchor: A2_ANCHOR.diag },
};
e01.pass = Math.abs(e01.corr.measured - e01.corr.anchor) <= 3e-4
  && Math.abs(e01.diag.measured - e01.diag.anchor) <= 3e-4;
const e02 = { repro_mismatches: reproMismatches, pass: reproMismatches === 0 };
const e03 = { consistency_max: globalConsistencyMax, pass: globalConsistencyMax < 1e-9 };
const executable = e01.pass && e02.pass && e03.pass;
const verdict = (held) => (executable ? (held ? 'HELD' : 'REFUTED') : 'NOT-EXECUTABLE');

const e1 = {
  corr: { ...pickInc(exact.corr) }, diag: { ...pickInc(exact.diag) },
  prediction: 'REFUTED on both cells',
  verdict: executable
    ? (exact.corr.increment_summary_verdict === 'REFUTED'
      && exact.diag.increment_summary_verdict === 'REFUTED' ? 'REFUTED-as-predicted'
      : `corr=${exact.corr.increment_summary_verdict}, diag=${exact.diag.increment_summary_verdict}`)
    : 'NOT-EXECUTABLE',
};
function pickInc(c) {
  return {
    mean: c.increment_summary.mean,
    lower95: c.increment_summary.lower95_one_sided,
    upper95: c.increment_summary.upper95_one_sided,
    verdict: c.increment_summary_verdict,
  };
}

const e1bBand = {
  corr: [X1_ANCHOR.corr - 0.001, X1_ANCHOR.corr + 0.001],
  diag: [X1_ANCHOR.diag - 0.001, X1_ANCHOR.diag + 0.001],
};
const e1bHeld = ['corr', 'diag'].every((s) =>
  exact[s].increment_summary_t300.mean >= e1bBand[s][0]
  && exact[s].increment_summary_t300.mean <= e1bBand[s][1]);
const e1b = {
  corr: exact.corr.increment_summary_t300.mean, diag: exact.diag.increment_summary_t300.mean,
  bands: e1bBand, verdict: verdict(e1bHeld),
};

const e2Held = ['corr', 'diag'].every((s) => {
  const m = exact[s].mechanism;
  return m.lambda_b.lower95_one_sided > 0
    && Math.abs(m.lambda_F_minus_b.mean) <= 3 * m.lambda_F_minus_b.se
    && Math.abs(m.F_minus_b.mean) <= 3 * m.F_minus_b.se;
});
const e2 = {
  corr: exact.corr.mechanism, diag: exact.diag.mechanism, verdict: verdict(e2Held),
};

const e3Held = ['corr', 'diag'].every((s) =>
  exact[s].clamp.pos_frac.mean > exact[s].clamp.neg_frac.mean);
const e3 = {
  corr: { pos: exact.corr.clamp.pos_frac.mean, neg: exact.corr.clamp.neg_frac.mean },
  diag: { pos: exact.diag.clamp.pos_frac.mean, neg: exact.diag.clamp.neg_frac.mean },
  verdict: verdict(e3Held),
};

const lastBlock = (c) => c.blocks.find((b) => b.from === 601);
const e4Held = ['corr', 'diag'].every((s) => lastBlock(exact[s]).lower95_one_sided > 1);
const e4 = {
  corr: { mean: lastBlock(exact.corr).mean, lower95: lastBlock(exact.corr).lower95_one_sided },
  diag: { mean: lastBlock(exact.diag).mean, lower95: lastBlock(exact.diag).lower95_one_sided },
  verdict: verdict(e4Held),
};

const e5 = {
  corr: { t300: exact.corr.terminal_t300, t900: exact.corr.terminal_final, crossing: exact.corr.crossing },
  diag: { t300: exact.diag.terminal_t300, t900: exact.diag.terminal_final, crossing: exact.diag.crossing },
  note: 'reported, scored by nothing (C26: test martingale class)',
};

const e6 = Object.fromEntries(['LEG500-corr-T300', 'LEG500-diag-T300', 'LEG8000-corr-T300', 'LEG8000-diag-T300']
  .map((id) => {
    const c = byId(id);
    return [id, {
      pool_size: c.reference.pool_size,
      increment: pickInc(c),
      mean_F: { mean: c.legacy_mean_F.mean, lower95: c.legacy_mean_F.lower95_one_sided, upper95: c.legacy_mean_F.upper95_one_sided },
      clamp: { pos: c.clamp.pos_frac.mean, neg: c.clamp.neg_frac.mean },
      note: 'descriptive; no scored verdict (PREREG §4 E6)',
    }];
  }));

const endpoints = {
  executable,
  E0: { anchors: e01, determinism: e02, witness_consistency: e03 },
  E1: e1, E1b: e1b, E2: e2, E3: e3, E4: e4, E5: e5, E6: e6,
  caught_failures: caughtFailures,
};
fs.writeFileSync(path.join(runDir, 'endpoints-witness-centering.json'), `${JSON.stringify(endpoints, null, 1)}\n`);
fs.writeFileSync(path.join(runDir, 'manifest.json'), `${JSON.stringify({
  study: '2026-08-family-c-witness-centering',
  prereg: '../PREREGISTRATION.md (incl. Amendment A1: reconstructed betting-params stamp)',
  mode: MODE, sim_scale: SIM_SCALE,
  git_sha: gitSha, engine_version: engineVersion,
  deploysignal_sha: dsSha,
  node: process.version, command: process.argv.slice(1).join(' '),
  shared_modules_verified: shared,
  cells: CELLS.map((c) => ({ id: c.id, arm: c.arm, null_id: c.null_id, N: c.N, T: c.T, pool: c.pool ?? null })),
  seed_scheme: 'EXACT/LEG cells: per-stream splitmix64 (family-d-emean/harness/seed.mjs), triple (cellIdx, bundle, traj), traj 0 = baseline rows, trajectories 1..perBundle; REPA2 cells: family-c-pool mulberry32 scheme verbatim (SEED 20260803, baseSeed +1000003*b +id.length*7919, traj seed +7919*done +31*b) for the E0.1 anchor',
  billing: 'no model calls; pure simulation; ANTHROPIC env empty at launch',
}, null, 1)}\n`);

console.log(`E0: anchors ${e01.pass ? 'PASS' : 'FAIL'} `
  + `(corr ${e01.corr.measured.toFixed(6)} vs ${A2_ANCHOR.corr}; diag ${e01.diag.measured.toFixed(6)} vs ${A2_ANCHOR.diag}), `
  + `determinism ${e02.pass ? 'PASS' : `FAIL(${reproMismatches})`}, `
  + `consistency ${e03.pass ? 'PASS' : 'FAIL'} (max ${globalConsistencyMax.toExponential(2)}) `
  + `-> ${executable ? 'EXECUTABLE' : 'NOT-EXECUTABLE'}`);
for (const k of ['E1', 'E1b', 'E2', 'E3', 'E4']) {
  console.log(`${k}: ${endpoints[k].verdict}`);
}
console.log(`caught failures: ${caughtFailures}`);
console.log(`run: ${runDir}`);
