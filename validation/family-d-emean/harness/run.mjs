// harness/run.mjs — first committed execution of PREREGISTRATION.md §§1-5 as amended by
// Amendment A1 (2026-08-18). Append-only; never overwrites a run.
//
//   node harness/run.mjs --mode live
//   node harness/run.mjs --mode sim    (writes under results/sim/, git-ignored shakedown)
//
// `--mode` selects the output directory and nothing else: no generator, detector call, seed,
// horizon or endpoint branches on it.
//
// The instrument is the committed h0-battery family-D adapter (detectors.mjs: W=30, LO=3,
// HI=10, betting_delta = 0.3*sigma0, disjoint or rolling evaluation) driving
// dist/detectors/spectral.js — never a reimplementation (A1.1). e_value_inflation_bound is
// left unset; firing is ignored (E[M_T] is a property of the unstopped path).
//
// EVERYTHING IS LOG DOMAIN. The rolling control's E[M_300] was read at 6.6e23 in 2026-08-03's
// uncommitted run and T=900 rolling is far larger, so means are log-sum-exp over the
// detectors' exact state.log_M (ADR 0026), never over the saturating M view.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { gaussFrom } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { streamRng } from './seed.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENG = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
// --supersedes <runId>: the C1.6 manifest declaration (certification collect.mjs) naming the
// prior run this execution supersedes for a fixed, named defect. Operational provenance only;
// no generator, detector call, seed, horizon or endpoint reads it.
const SUPERSEDED_RUN = arg('--supersedes', null);
const SUPERSEDES = SUPERSEDED_RUN === null ? null : [{
  study: 'family-d-emean', run: SUPERSEDED_RUN,
  detectors: ['family_D_spectral_e_detector'],
  reason: 'seed-scheme defect (review 2026-08-18): avalanche-hashed offsets into one shared 2^32 LCG cycle gave overlapping trajectory substreams, violating Amendment A1.3 disjointness; superseded by per-stream splitmix64 (harness/seed.mjs), full re-run under A1.5.4',
}];

// ── A1.3 constants. None is a flag: sizes are registered. ─────────────────────────────
const N_FULL = 4000;              // exact / per-trajectory / control cells
const D_SHARED = 100;             // shared-draw cells: draws (C51.4 floor)
const N_SHARED = 1000;            // shared-draw cells: trajectories per draw
const HORIZONS = [300, 900];      // nested snapshots of one trajectory
const T_MAX = Math.max(...HORIZONS);
const K_EXACT = 66666;            // exact-shared calibration windows (A1.2)
const W = 30;                     // adapter window (A1.1); K windows = 30*K ticks
const SHIPPED_LOG_THRESHOLD = Math.log(1 / 1e-4);  // descriptive crossing bar, alpha_D = 1e-4
const Z95 = 1.6448536269514722;   // one-sided 95%

const famD = DETECTORS.find((d) => d.id === 'family_D_spectral_e_detector');
if (!famD) throw new Error('family_D adapter not found in h0-battery detectors.mjs');

// ── Seeds. Per-stream splitmix64 (harness/seed.mjs) — the superseding scheme after the
// review finding on run-20260818T220621Z: the first run's avalanche-hashed offsets into one
// shared 2^32 LCG cycle gave overlapping substreams. Stream identity is the structural
// (cellIdx, draw, traj) key; cellIdx 255 is reserved for the exact-shared calibrations.
const CAL_STREAM_A = [255, 0, 0];   // exact-shared calibration, primary draw
const CAL_STREAM_B = [255, 1, 0];   // exact-shared replication guard (A1.2 guard 2)

// ── Calibration: moments of peak|ACF| over disjoint windows, via the adapter's own
//    calibrate() so the statistic is computed by the identical committed code path. ────
function calibrate(K, [c, d, t]) {
  const r = streamRng(c, d, t);
  const g = gaussFrom(r);
  const sample = Array.from({ length: K * W }, g);
  const m = famD.calibrate(sample, {});
  if (!Number.isFinite(m.mu) || !(m.sigma > 0)) {
    throw new Error(`degenerate calibration: ${JSON.stringify(m)}`);
  }
  return m;
}

/** One trajectory to T_MAX. Returns per-horizon {logM, supLogM} snapshots, where supLogM
 *  is the running max over wealth updates (the shipped-threshold crossing instrument). */
function trajectory(windows, mu, sigma, r) {
  const g = gaussFrom(r);
  const inst = famD.make({ mu, sigma, phi: 0, alpha: 1e-4, windows });
  const out = [];
  let sup = -Infinity;
  let hi = 0;
  for (let t = 0; t < T_MAX; t++) {
    inst.step(g());
    const lm = inst.logM();
    if (lm > sup) sup = lm;
    if (t + 1 === HORIZONS[hi]) { out.push({ logM: lm, supLogM: sup }); hi++; }
  }
  return out;
}

/** log-sum-exp, max-shifted; -Infinity on empty. */
function logSumExp(xs) {
  let mx = -Infinity;
  for (const x of xs) if (x > mx) mx = x;
  if (!Number.isFinite(mx)) return mx;
  let s = 0;
  for (const x of xs) s += Math.exp(x - mx);
  return mx + Math.log(s);
}

/** Mean, one-sided 95% lower bound, and diagnostics of exp(logMs), all log-domain-safe. */
function meanStats(logMs) {
  const n = logMs.length;
  const logN = Math.log(n);
  const lse1 = logSumExp(logMs);
  const lse2 = logSumExp(logMs.map((x) => 2 * x));
  const logE1 = lse1 - logN;               // log E[M]
  const logE2 = lse2 - logN;               // log E[M^2]
  // Var = E[M^2] - E[M]^2, computed as E[M^2] * (1 - exp(2 logE1 - logE2)) to stay in log.
  const ratio = Math.exp(2 * logE1 - logE2);           // E[M]^2 / E[M^2], in (0, 1]
  const logVar = ratio < 1 ? logE2 + Math.log(1 - ratio) : -Infinity;
  const logSE = logVar === -Infinity ? -Infinity : 0.5 * (logVar - logN);
  // lower = E1 - z*SE = E1 * (1 - z * exp(logSE - logE1)); may be <= 0 for huge-variance cells.
  const shrink = 1 - Z95 * Math.exp(logSE - logE1);
  const logLower = shrink > 0 ? logE1 + Math.log(shrink) : null;
  let mx = -Infinity;
  for (const x of logMs) if (x > mx) mx = x;
  const sorted = [...logMs].sort((a, b) => a - b);
  // nearest-rank: the p-quantile of n sorted values is the ceil(p*n)-th order statistic
  // (review 2026-08-18 — Math.floor(p*n) indexed one rank high).
  const q = (p) => sorted[Math.max(0, Math.ceil(p * n) - 1)];
  return {
    log_e_mean: logE1,
    e_mean: logE1 < 700 ? Math.exp(logE1) : null,
    log10_e_mean: logE1 / Math.LN10,
    log_e_mean_lower_95: logLower,
    e_mean_lower_95: logLower !== null && logLower < 700 ? Math.exp(logLower) : null,
    top1_share: Math.exp(mx - lse1),
    log10_m_p50: q(0.50) / Math.LN10,
    log10_m_p99: q(0.99) / Math.LN10,
    log10_m_max: mx / Math.LN10,
  };
}

// ── Run directory (append-only) ───────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

// ── A1.2 exact-shared calibration, with the replication guard ─────────────────────────
const calA = calibrate(K_EXACT, CAL_STREAM_A);
const calB = calibrate(K_EXACT, CAL_STREAM_B);
const dMu = Math.abs(calA.mu - calB.mu);
const relDSigma = Math.abs(calA.sigma - calB.sigma) / calA.sigma;
const guardPass = dMu < 2e-3 && relDSigma < 0.02;
console.log(`exact cal A: mu=${calA.mu} sd=${calA.sigma}`);
console.log(`exact cal B: mu=${calB.mu} sd=${calB.sigma}`);
console.log(`guard: |dMu|=${dMu.toExponential(3)} relDSigma=${relDSigma.toExponential(3)} -> ${guardPass ? 'PASS' : 'FAIL'}`);

// wealth updates per horizon: disjoint evals at ticks 60, 90, ... (A1.1)
const updatesDisjoint = (T) => Math.floor(T / W) - 1;
const updatesRolling = (T) => T - W + 1;
const N_UPDATES_E1 = updatesDisjoint(900);           // 29 — the n in the analytic residual
const R_DELTA = 0.3;                                  // r = delta/sigma = 0.3 by adapter
const analyticResidual = (N_UPDATES_E1 ** 2 * R_DELTA ** 2) / (2 * K_EXACT);

// ── Cells ─────────────────────────────────────────────────────────────────────────────
// Registered grid (A1.2). cellIdx feeds the seed mix and is stable by position.
const GRID = [
  { idx: 0, base: 'N1-exact', mode: 'exact-shared', K: K_EXACT, windows: 'disjoint', role: 'primary' },
  { idx: 1, base: 'N1-ptK100', mode: 'per-trajectory', K: 100, windows: 'disjoint', role: 'descriptive' },
  { idx: 2, base: 'N1-ptK400', mode: 'per-trajectory', K: 400, windows: 'disjoint', role: 'descriptive' },
  { idx: 3, base: 'N1-sharedK100', mode: 'shared-draw', K: 100, windows: 'disjoint', role: 'descriptive' },
  { idx: 4, base: 'N1-sharedK400', mode: 'shared-draw', K: 400, windows: 'disjoint', role: 'descriptive' },
  { idx: 5, base: 'N7-rolling', mode: 'exact-shared', K: K_EXACT, windows: 'rolling', role: 'control' },
];

const cells = [];
function emitCell(cell) {
  cells.push(cell);
  fs.writeFileSync(path.join(runDir, 'cells', `${cell.null_id}.json`), JSON.stringify(cell, null, 2));
  const head = `${cell.null_id.padEnd(22)} K=${String(cell.K).padEnd(6)} updates=${String(cell.wealth_updates).padEnd(4)}`;
  const body = cell.cal_mode === 'shared-draw'
    ? `acrossDraw mean=${cell.across_draw_mean.toFixed(4)} sd=${cell.across_draw_sd.toFixed(4)} p05=${cell.across_draw_p05.toFixed(4)} p95=${cell.across_draw_p95.toFixed(4)}`
    : `log10E[M]=${cell.log10_e_mean.toFixed(4)} lower95=${cell.log_e_mean_lower_95 === null ? 'n/a' : (cell.log_e_mean_lower_95 / Math.LN10).toFixed(4)} top1=${cell.top1_share.toFixed(4)}`;
  console.log(`${head} ${body}`);
}

for (const spec of GRID) {
  if (spec.mode === 'shared-draw') {
    // D draws; per draw one K-window calibration and N_SHARED trajectories.
    const perHorizonDrawMeans = HORIZONS.map(() => []);
    for (let d = 0; d < D_SHARED; d++) {
      const cal = calibrate(spec.K, [spec.idx, d + 2, 0]);
      const perHorizon = HORIZONS.map(() => []);
      for (let i = 0; i < N_SHARED; i++) {
        const snaps = trajectory(spec.windows, cal.mu, cal.sigma, streamRng(spec.idx, d + 2, i + 1));
        snaps.forEach((s, h) => perHorizon[h].push(s.logM));
      }
      HORIZONS.forEach((T, h) => {
        perHorizonDrawMeans[h].push(Math.exp(logSumExp(perHorizon[h]) - Math.log(N_SHARED)));
      });
    }
    HORIZONS.forEach((T, h) => {
      const xs = [...perHorizonDrawMeans[h]].sort((a, b) => a - b);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
      emitCell({
        study: 'family-d-emean', detector: 'family_D_spectral_e_detector', family: 'D',
        null_id: `${spec.base}-T${T}`,
        null_label: `iid Gaussian, disjoint, shared-draw calibration K=${spec.K}, D=${D_SHARED} draws x N=${N_SHARED}`,
        cal_mode: 'shared-draw', K: spec.K, cal_draws: D_SHARED, role: spec.role,
        horizon_ticks: T, wealth_updates: updatesDisjoint(T), n: N_SHARED,
        across_draw_mean: mean, across_draw_sd: sd,
        across_draw_p05: xs[Math.floor(0.05 * xs.length)],
        across_draw_p95: xs[Math.floor(0.95 * xs.length)],
        across_draw_min: xs[0], across_draw_max: xs[xs.length - 1],
        alpha: null, shift_sigma: null, control: null,
        control_state: 'pending', scored: false,
        mode: MODE,
      });
    });
  } else {
    const isPT = spec.mode === 'per-trajectory';
    const perHorizon = HORIZONS.map(() => ({ logMs: [], crossings: 0 }));
    for (let i = 0; i < N_FULL; i++) {
      const r = streamRng(spec.idx, 0, i + 1);
      let mu = calA.mu, sigma = calA.sigma;
      if (isPT) {
        // Condition-A shape: the calibration sample precedes the trajectory on the SAME stream.
        const g = gaussFrom(r);
        const sample = Array.from({ length: spec.K * W }, g);
        const m = famD.calibrate(sample, {});
        mu = m.mu; sigma = m.sigma;
        if (!(sigma > 0)) throw new Error(`degenerate per-trajectory calibration at cell ${spec.base} traj ${i}`);
      }
      const snaps = trajectory(spec.windows, mu, sigma, r);
      snaps.forEach((s, h) => {
        perHorizon[h].logMs.push(s.logM);
        if (s.supLogM >= SHIPPED_LOG_THRESHOLD) perHorizon[h].crossings++;
      });
    }
    HORIZONS.forEach((T, h) => {
      const stats = meanStats(perHorizon[h].logMs);
      emitCell({
        study: 'family-d-emean', detector: 'family_D_spectral_e_detector', family: 'D',
        null_id: `${spec.base}-T${T}`,
        null_label: spec.windows === 'rolling'
          ? `iid Gaussian, ROLLING evaluation (shipped cadence), exact-shared calibration K=${spec.K}`
          : `iid Gaussian, disjoint, ${spec.mode} calibration K=${spec.K}`,
        cal_mode: spec.mode, K: spec.K, cal_draws: isPT ? N_FULL : 1, role: spec.role,
        horizon_ticks: T,
        wealth_updates: spec.windows === 'rolling' ? updatesRolling(T) : updatesDisjoint(T),
        n: N_FULL, ...stats,
        crossing_rate_shipped_threshold: perHorizon[h].crossings / N_FULL,
        alpha: null, shift_sigma: null, control: null,
        control_state: 'pending', scored: spec.role === 'primary',
        mode: MODE,
      });
    });
  }
}

// ── Endpoints (A1.4) ──────────────────────────────────────────────────────────────────
const cellById = (id) => cells.find((c) => c.null_id === id);
const controlCell = cellById('N7-rolling-T300');
// A1.4 as corrected 2026-08-18 pre-execution: point log10 E[M] > 1 AND shipped-threshold
// crossing rate > 0.2 — both robust to the one-trajectory-dominated-mean degeneracy that
// makes a lower confidence bound collapse on this cell.
const controlPass = controlCell.log10_e_mean > 1
  && controlCell.crossing_rate_shipped_threshold > 0.2;
const executable = guardPass && controlPass;

const e1 = HORIZONS.map((T) => {
  const c = cellById(`N1-exact-T${T}`);
  const lower = c.e_mean_lower_95;
  return {
    endpoint: 'E1', cell: c.null_id, horizon_ticks: T, wealth_updates: c.wealth_updates,
    K: c.K, cal_mode: c.cal_mode,
    e_mean: c.e_mean, e_mean_lower_95: lower,
    verdict: !executable ? 'NOT-EXECUTABLE' : (lower !== null && lower > 1 ? 'FAIL' : 'not-refuted'),
  };
});

// A1.5.1 — committed-constant comparison: two-sided 95% CI membership.
const COMMITTED = { 300: 1.0636, 900: 1.1076 };
const Z975 = 1.959963984540054;
const comparison = HORIZONS.map((T) => {
  const c = cellById(`N1-exact-T${T}`);
  if (c.e_mean === null || c.e_mean_lower_95 === null) {
    return { horizon_ticks: T, committed: COMMITTED[T], measured: c.e_mean, ci95: null, consistent: null };
  }
  // reconstruct SE from the one-sided bound: lower = mean - Z95*SE
  const se = (c.e_mean - c.e_mean_lower_95) / Z95;
  const lo = c.e_mean - Z975 * se, hi = c.e_mean + Z975 * se;
  return {
    horizon_ticks: T, committed: COMMITTED[T], measured: c.e_mean,
    ci95: [lo, hi], consistent: COMMITTED[T] >= lo && COMMITTED[T] <= hi,
  };
});

const finalState = executable ? 'passed' : 'failed';
for (const c of cells) {
  c.control_state = finalState;
  fs.writeFileSync(path.join(runDir, 'cells', `${c.null_id}.json`), JSON.stringify(c, null, 2));
}

const endpoints = {
  executable, guard: { dMu, relDSigma, pass: guardPass },
  control: {
    cell: 'N7-rolling-T300',
    log10_e_mean: controlCell.log10_e_mean,
    crossing_rate_shipped_threshold: controlCell.crossing_rate_shipped_threshold,
    bar: 'log10 E[M_300] > 1 AND shipped-threshold crossing rate > 0.2 (A1.4 as corrected 2026-08-18)',
    pass: controlPass,
  },
  analytic_residual_log_c: analyticResidual,
  e1, committed_comparison: comparison,
};
fs.writeFileSync(path.join(runDir, 'endpoints-family-d-emean.json'), JSON.stringify(endpoints, null, 2));

const manifest = {
  study: 'family-d-emean', amendment: 'A1 (2026-08-18)', mode: MODE,
  command: process.argv.slice(1).join(' '),
  git_sha: execSync('git rev-parse HEAD', { cwd: ENG }).toString().trim(),
  engine_version: JSON.parse(fs.readFileSync(path.join(ENG, 'package.json'), 'utf8')).version,
  node: process.version,
  supersedes: SUPERSEDES,
  seed_scheme: 'per-stream splitmix64 over bit-disjoint (cellIdx, draw, traj) keys (harness/seed.mjs); exact cal streams (255,0,0)/(255,1,0); full-cell trajectories draw=0, shared-draw cells draw=d+2, trajectory index traj=i+1',
  sizes: { N_FULL, D_SHARED, N_SHARED, HORIZONS, K_EXACT },
  exact_calibration: { A: calA, B: calB, dMu, relDSigma },
  billing: 'no model calls; pure simulation',
};
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\nexecutable: ${executable}`);
for (const e of e1) console.log(`E1 ${e.cell}: E[M]=${e.e_mean?.toFixed(6)} lower95=${e.e_mean_lower_95?.toFixed(6)} -> ${e.verdict}`);
for (const c of comparison) console.log(`committed ${c.committed} vs measured ${c.measured?.toFixed(6)} CI[${c.ci95 ? c.ci95.map((x) => x.toFixed(6)).join(', ') : 'n/a'}] -> ${c.consistent === null ? 'n/a' : c.consistent ? 'CONSISTENT' : 'INCONSISTENT'}`);
console.log(`run: ${runDir}`);
