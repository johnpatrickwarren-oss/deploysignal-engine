// harness/run.mjs — the c-bound measurement of PREREGISTRATION.md §§1-5 as amended by
// Amendment A1 (2026-08-10). Append-only; never overwrites a run.
//
//   node harness/run.mjs --mode live   [--n 4000] [--b 5]
//   node harness/run.mjs --mode sim    (writes under results/sim/)
//
// `--mode` selects the output directory and nothing else. No generator, detector call, seed,
// horizon or endpoint branches on it.
//
// TWO INSTRUMENTS, per A1.3, both reported on every cell because they are different objects:
//   c_markov(T)    = max(1, E[M_T | H0])                     -- the terminal Markov price
//   c_ville_emp(T) = alpha * q_{1-alpha}( sup_{t<=T} M_t )   -- the sup price the bootstrap targets
//
// EVERYTHING IS LOG DOMAIN. E[M_T] reaches 2.6e300 in the published readings and exp() overflows
// above logM ~ 709.78, so the mean is a log-sum-exp over the detectors' own exact state.log_M
// (ADR 0026) and never over the saturating `M` view.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { rng, NULLS } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENG = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 4000));          // A1.4: N = 4000 per replicate
const B = Number(arg('--b', 5));             // A1.4: B = 5 independent replicates
const HORIZONS = [300, 900, 2000];           // A1.4: nested snapshots of ONE trajectory
const T_MAX = Math.max(...HORIZONS);
const ALPHA = 0.05;                          // A1.3: the study's scored level
const BASE_SEED = 20260801;
const BATCH_STRIDE = 40000000;               // > 3999 * 7919 = 31667081, so replicates never collide
const TRAJ_STRIDE = 7919;

// A1.3 — quoted from stats/ville-guarantee-is-empirical, medians over
// ../deploysignal/runs/compiled-configs/. NOT re-measured here (A1.7 item 1).
const SHIPPED_RATIO = {
  family_A_betting_e_process: 2.41e4,
  family_C_safe_hotelling: 3.6e76,
  family_D_spectral_e_detector: null,        // analytical 1/alpha, no substitution — control only
};

// A1.4 — the cells. Ids map §2's N1 / N3-p09 / N4-p09 onto h0-battery/harness/nulls.mjs.
const CELLS = [
  { det: 'family_A_betting_e_process', nulls: ['N1', 'N3-p09', 'N4-p09-m100'], role: 'primary' },
  { det: 'family_C_safe_hotelling', nulls: ['N1', 'N3-p09', 'N4-p09-m100'], role: 'primary' },
  { det: 'family_D_spectral_e_detector', nulls: ['N1', 'N7'], role: 'control' },
];

const LN10 = Math.log(10);

/** log-sum-exp, max-shifted. Returns -Infinity for an empty sample. */
function logSumExp(xs) {
  let mx = -Infinity;
  for (const x of xs) if (x > mx) mx = x;
  if (!Number.isFinite(mx)) return mx;
  let s = 0;
  for (const x of xs) s += Math.exp(x - mx);
  return mx + Math.log(s);
}

/** One trajectory to T_MAX, snapshotting log M and running sup log M at each horizon.
 *  Firing is IGNORED: neither detector resets or halts on fire (betting-e-process.ts:278,
 *  _hotelling-safe.ts:131 return a verdict and leave the wealth advancing), and E[M_T] and
 *  q(sup M) are properties of the unstopped path. */
function trajectory(det, nullSpec, seed) {
  const r = rng(seed);
  const src = nullSpec.gen(r);
  const draw = () => (det.vector ? Array.from({ length: det.vector }, src) : src());

  // Identical to h0-battery/harness/run.mjs:40-53 — oracle cells receive phi, estimated cells
  // estimate mu, sigma and phi from the same m-length calibration window.
  const cfg = { mu: 0, sigma: 1, phi: nullSpec.params === 'oracle' ? (nullSpec.phi ?? 0) : 0,
    alpha: ALPHA, windows: nullSpec.windows };
  if (nullSpec.params === 'estimated') {
    const cal = Array.from({ length: nullSpec.m }, src);
    const mu = cal.reduce((a, b) => a + b, 0) / cal.length;
    const sd = Math.sqrt(cal.reduce((a, b) => a + (b - mu) ** 2, 0) / cal.length) || 1;
    let num = 0, den = 0;
    for (let i = 1; i < cal.length; i++) num += (cal[i] - mu) * (cal[i - 1] - mu);
    for (let i = 0; i < cal.length; i++) den += (cal[i] - mu) ** 2;
    Object.assign(cfg, { mu, sigma: sd, phi: den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0 });
  }
  if (det.calibrate) {
    // A windowed statistic has its own null moments. 3000 samples = 100 disjoint W=30 windows,
    // against the 400 windows the committed Family D bound was measured at (A1.4, P-C9).
    Object.assign(cfg, det.calibrate(Array.from({ length: 3000 }, src), cfg));
  }

  const inst = det.make(cfg);
  const out = { logM: {}, supLog: {} };
  let sup = 0;                                // log M_0 = 0
  let h = 0;
  for (let t = 1; t <= T_MAX; t++) {
    inst.step(draw());
    const l = inst.logM();
    if (l > sup) sup = l;
    if (t === HORIZONS[h]) { out.logM[HORIZONS[h]] = l; out.supLog[HORIZONS[h]] = sup; h += 1; }
  }
  return out;
}

/** A1.3/A1.5 — the two instruments plus the diagnostics on one replicate's sample. */
function instruments(logMs, supLogs) {
  const lse = logSumExp(logMs);
  const logEM = lse - Math.log(logMs.length);
  const mx = Math.max(...logMs);
  const top1Share = Number.isFinite(lse) ? Math.exp(mx - lse) : NaN;

  const sorted = [...supLogs].sort((a, b) => a - b);
  // Upper (1-alpha) empirical quantile: the ceil((1-alpha)*n)-th order statistic, 1-indexed.
  const qIdx = Math.min(sorted.length - 1, Math.ceil((1 - ALPHA) * sorted.length) - 1);
  const logQ = sorted[qIdx];
  const logCVille = Math.log(ALPHA) + logQ;

  return {
    log10_E_M: logEM / LN10,
    E_M: Number.isFinite(logEM) && logEM < 700 ? Math.exp(logEM) : null,
    log10_c_markov: Math.max(0, logEM / LN10),
    top1_share: top1Share,
    log10_sup_q: logQ / LN10,
    log10_c_ville_emp: logCVille / LN10,
    c_ville_emp: Number.isFinite(logCVille) && logCVille < 700 ? Math.exp(logCVille) : null,
    n: logMs.length,
    q_order_statistics_above: sorted.length - 1 - qIdx,
  };
}

const engineVersion = JSON.parse(fs.readFileSync(path.join(ENG, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENG }).toString().trim();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const emitted = [];
for (const spec of CELLS) {
  const det = DETECTORS.find((d) => d.id === spec.det);
  if (!det) { console.error(`no adapter for ${spec.det}`); process.exit(1); }
  for (const nullId of spec.nulls) {
    const nullSpec = NULLS.find((n) => n.id === nullId);
    if (!nullSpec) { console.error(`no null ${nullId}`); process.exit(1); }

    // logMs[T][b] / supLogs[T][b] — the same trajectories snapshotted at three horizons.
    const logMs = {}, supLogs = {};
    for (const T of HORIZONS) { logMs[T] = []; supLogs[T] = []; }
    const t0 = Date.now();
    for (let b = 0; b < B; b++) {
      for (const T of HORIZONS) { logMs[T][b] = []; supLogs[T][b] = []; }
      const base = BASE_SEED + b * BATCH_STRIDE;
      for (let i = 0; i < N; i++) {
        const r = trajectory(det, nullSpec, base + TRAJ_STRIDE * i);
        for (const T of HORIZONS) { logMs[T][b].push(r.logM[T]); supLogs[T][b].push(r.supLog[T]); }
      }
    }

    for (const T of HORIZONS) {
      const reps = [];
      for (let b = 0; b < B; b++) {
        reps.push({ replicate: b, seed_base: BASE_SEED + b * BATCH_STRIDE,
          ...instruments(logMs[T][b], supLogs[T][b]) });
      }
      const l10 = reps.map((x) => x.log10_E_M);
      const l10v = reps.map((x) => x.log10_c_ville_emp);
      const finite = (xs) => xs.filter(Number.isFinite);
      const rangeOf = (xs) => (finite(xs).length ? Math.max(...finite(xs)) - Math.min(...finite(xs)) : NaN);

      // A1.5 — D1..D4, each recorded fired or not, including where nothing fired.
      const D1 = reps.some((x) => Number.isFinite(x.top1_share) && x.top1_share >= 0.5);
      const D2 = rangeOf(l10) >= 1;
      const D3 = Math.min(...l10) < 0 && Math.max(...l10) >= 0;   // straddles E[M] = 1
      const D4 = rangeOf(l10v) >= 1;
      const markovMeasurable = !(D1 || D2 || D3);
      const villeMeasurable = !D4;

      const ratio = SHIPPED_RATIO[spec.det];
      const primary = reps[0];
      const mean = (xs) => finite(xs).reduce((a, b) => a + b, 0) / Math.max(finite(xs).length, 1);
      const cell = {
        study: '2026-08-bootstrap-overshoot',
        registration: ['PREREGISTRATION.md', 'PREREGISTRATION.md#amendment-a1-2026-08-10'],
        role: spec.role,
        detector: spec.det, null_id: nullId, null_label: nullSpec.label,
        params: nullSpec.params, phi: nullSpec.phi ?? 0, windows: nullSpec.windows,
        horizon_T: T, alpha: ALPHA, n_per_replicate: N, replicates: B,
        // B1 — the primary endpoint, replicate 0, the one comparable to PREREGISTRATION §2.
        primary_replicate: {
          log10_E_M: primary.log10_E_M, E_M: primary.E_M,
          log10_c_markov: primary.log10_c_markov, top1_share: primary.top1_share,
          log10_c_ville_emp: primary.log10_c_ville_emp, c_ville_emp: primary.c_ville_emp,
        },
        across_replicate: {
          log10_E_M_mean: mean(l10), log10_E_M_min: Math.min(...l10), log10_E_M_max: Math.max(...l10),
          log10_E_M_range: rangeOf(l10),
          log10_c_ville_emp_mean: mean(l10v), log10_c_ville_emp_min: Math.min(...l10v),
          log10_c_ville_emp_max: Math.max(...l10v), log10_c_ville_emp_range: rangeOf(l10v),
          max_top1_share: Math.max(...reps.map((x) => x.top1_share)),
        },
        criteria: { D1_one_draw_carries_mean: D1, D2_replicates_span_decade: D2,
          D3_replicates_straddle_one: D3, D4_quantile_spans_decade: D4 },
        c_markov_status: markovMeasurable ? 'MEASURED' : 'NOT_MEASURABLE',
        c_ville_emp_status: villeMeasurable ? 'MEASURED' : 'NOT_MEASURABLE',
        // B2 — the overshoot, in log10, for each instrument. Null on the control.
        shipped_threshold_ratio: ratio,
        log10_overshoot_markov: ratio === null ? null : Math.log10(ratio) - primary.log10_c_markov,
        log10_overshoot_ville: ratio === null ? null : Math.log10(ratio) - primary.log10_c_ville_emp,
        replicate_detail: reps,
        wall_ms: Date.now() - t0,
        mode: MODE, engine_version: engineVersion, git_sha: gitSha,
      };
      emitted.push(cell);
      fs.writeFileSync(path.join(runDir, 'cells', `${spec.det}__${nullId}__T${T}.json`),
        JSON.stringify(cell, null, 2));
      const fired = Object.entries(cell.criteria).filter(([, v]) => v).map(([k]) => k.split('_')[0]);
      console.log(`${spec.det.padEnd(30)} ${nullId.padEnd(13)} T=${String(T).padEnd(5)} `
        + `log10E[M]=${cell.primary_replicate.log10_E_M.toFixed(4).padStart(10)} `
        + `top1=${cell.primary_replicate.top1_share.toFixed(4)} `
        + `log10c_ville=${cell.primary_replicate.log10_c_ville_emp.toFixed(4).padStart(9)} `
        + `range=${cell.across_replicate.log10_E_M_range.toFixed(3).padStart(8)} `
        + `markov=${cell.c_markov_status} ville=${cell.c_ville_emp_status}`
        + (fired.length ? ` [${fired.join(',')}]` : ' [none]'));
    }
  }
}

fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-08-bootstrap-overshoot', mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  node: process.version, generated_at: stamp,
  prereg: ['PREREGISTRATION.md'],
  amendments: ['Amendment A1 — 2026-08-10'],
  base_seed: BASE_SEED, batch_stride: BATCH_STRIDE, traj_stride: TRAJ_STRIDE,
  n_per_replicate: N, replicates: B, horizons: HORIZONS, alpha: ALPHA,
  shipped_threshold_ratio: SHIPPED_RATIO,
  instruments: ['c_markov = max(1, E[M_T])', 'c_ville_emp = alpha * q_{1-alpha}(sup_{t<=T} M_t)'],
  criteria: ['D1 top1_share >= 0.5', 'D2 across-replicate log10 E[M] range >= 1',
    'D3 replicates straddle E[M] = 1', 'D4 across-replicate log10 c_ville range >= 1'],
  cells: emitted.length, argv: process.argv.slice(2),
}, null, 2));
console.log(`\n${emitted.length} cells -> ${path.relative(STUDY, runDir)}`);
