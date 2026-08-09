// validation/coverage/harness/run-acrossdraw.mjs — the C51.2 ACROSS-DRAW replication study,
// registered at PREREGISTRATION.md Amendment v2.K6A.6.
//
// WHAT THIS IS. Every prior K6-slow amendment registers the single-calibration-draw lottery as the
// dominant uncertainty on every endpoint (K6A.1.7's per-draw sd, corrected to 0.1416 at K6A.2.4c)
// and then reports ONE draw. This driver measures the across-draw distributions directly: 100 fresh
// calibration draws at the frozen geometry, 500 trajectories per arm per draw, on the real harness
// path.
//
// WHAT THIS IS NOT (K6A.6, stated first so nothing has to be inferred). It does not re-score
// shape_ecdf_accumulator's card, does not move the K6-slow class row, does not touch COVERAGE.md,
// and does not replace the registered single-draw run run-20260809T035934Z. The one-attempt rule is
// untouched and the class answer stays "K6-slow YES at this calibration draw" (K6A.2.4b). It emits
// no card, reads no existing run directory, and its output is append-only.
//
// EVERY PER-WINDOW NUMBER COMES FROM THE SHIPPED MODULE. calibrateEcdfAccumulator,
// ecdfAccumulatorWindow, ecdfAccumulatorWealth and nullGrowthScreen are called on
// dist/detectors/shape-ecdf-accumulator.js; this file computes no p, no e and no wealth of its own.
// The generators are inject.mjs's, imported not copied. The per-draw reads reproduce the registered
// run's own arithmetic at the sites K6A.6.1's table names, and test 5's replication control proves
// it by reproducing run-20260809T035934Z's 0.8515 / 0.054 / 1.0249590993997122 exactly.
//
// ONE REGISTERED DEPARTURE from run-battery.mjs's path, K6A.6.1: trajectories are consecutive
// disjoint blocks of ONE continuously advanced stream per (calibration draw, arm) — K6A.1.3's own
// convention for the 280-draw MC this study replicates — rather than run-battery.mjs:572's spaced
// per-trajectory seeds. The scored path is the module's, bit for bit.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, gaussFrom, injectShapeMix } from '../lib/inject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const require = createRequire(import.meta.url);
const MODULE_PATH = path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js');
const mod = require(MODULE_PATH);

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

// ── the frozen geometry (K6A.6.1, transcribed from K6A.1.2) ───────────────────
// Held as this study's own registered literals and cross-checked against the module's own frozen
// exports, the same discipline run-battery.mjs:161-173 uses: a check against the module alone could
// only ever agree with itself.
const W = 150;
const N_A = 25000;
const M_BLOCKS = 500;
const N_ROWS = N_A + M_BLOCKS * W;              // 100,000
const KAPPA = 0.6820;
const ALPHA = 0.05;
const THRESHOLD = 1 / ALPHA;                    // 20
const T_SPAN = 6300;                            // K6A.1.9: baseline 300 + 6,000 post-onset
const ONSET = 300;                              // K6A.1.9
const WINDOWS = (T_SPAN - ONSET) / W;           // 40
const SIGMA = 1;
const CANONICAL_D = 1.5;                        // the canonical cell, mix-d1.5 (cell 44)
const REGISTERED_GEOMETRY = Object.freeze({ W, nA: N_A, m: M_BLOCKS });
{
  const g = mod.REGISTERED_GEOMETRY_K6SLOW;
  if (g.W !== W || g.nA !== N_A || g.m !== M_BLOCKS) {
    throw new Error(`run-acrossdraw: registered geometry ${JSON.stringify(REGISTERED_GEOMETRY)} != the `
      + `module's own ${JSON.stringify({ W: g.W, nA: g.nA, m: g.m })} (PREREGISTRATION.md K6A.1.2/K6A.6.1)`);
  }
  if (mod.W_K6SLOW !== W) throw new Error(`run-acrossdraw: module W_K6SLOW is ${mod.W_K6SLOW}, K6A.6.1 registers ${W}`);
  if (mod.N_ROWS_K6SLOW !== N_ROWS) throw new Error(`run-acrossdraw: module N_ROWS_K6SLOW is ${mod.N_ROWS_K6SLOW}, K6A.6.1 registers ${N_ROWS}`);
  if (mod.KAPPA_K6SLOW !== KAPPA) throw new Error(`run-acrossdraw: module KAPPA_K6SLOW is ${mod.KAPPA_K6SLOW}, K6A.6.1 registers the frozen ${KAPPA}`);
  if (WINDOWS !== 40) throw new Error(`run-acrossdraw: window count computed as ${WINDOWS}, K6A.6.1 registers 40`);
}

// ── the registered study size (K6A.6.3) ──────────────────────────────────────
const REGISTERED_DRAWS = 100;
const REGISTERED_TRAJ = 500;
const REGISTERED_SCREEN_MC = 8000;              // K6A.4.1's registered-path count, not the smoke 2,000
const SCREEN_MC_SEED_STRIDE = 10000;            // K6A.3.1's discipline: bounds M, so no two draws overlap

// ── the NEW seed band (K6A.6.2), with its enumerated disjointness ─────────────
// Band ordering is NOT the argument — K6A.2.3 withdrew that and it is not re-used. Disjointness is
// exact-seed enumeration modulo 2^32, asserted by test/run-acrossdraw.test.mjs against every prior
// family whose FORM the prereg states (3,045,706 seeds, 0 collisions), with the gap named: eight
// earlier K6-probe bases whose forms are not on record are NOT covered by that claim.
const AD_CAL_SEED_BASE = 51000000;
const AD_ALT_SEED_BASE = 52000000;
const AD_HEALTHY_SEED_BASE = 53000000;
const AD_SCREEN_MC_SEED_BASE = 57000000;

/** The registered band guard. A draw index outside 0..draws-1 is refused rather than silently
 *  producing a seed outside the enumerated band — the band is only as good as the thing that keeps
 *  the driver inside it, so this THROWS. Mutation kill: widen the range and test 2 fails. */
function assertDrawIndexInBand(d, draws) {
  if (!Number.isInteger(d) || d < 0 || d >= draws) {
    throw new Error(`run-acrossdraw: draw index ${d} is outside the registered band 0..${draws - 1} `
      + `(PREREGISTRATION.md Amendment v2.K6A.6 K6A.6.2 registers ${AD_CAL_SEED_BASE} + d, `
      + `${AD_ALT_SEED_BASE} + d, ${AD_HEALTHY_SEED_BASE} + d and `
      + `${AD_SCREEN_MC_SEED_BASE} + ${SCREEN_MC_SEED_STRIDE}*d + j for d = 0..${REGISTERED_DRAWS - 1}); `
      + 'a seed outside the enumerated band would make the freshness argument false');
  }
  if (draws > REGISTERED_DRAWS) {
    throw new Error(`run-acrossdraw: ${draws} draws exceeds the ${REGISTERED_DRAWS} K6A.6.2 enumerates `
      + 'seeds for — the disjointness assertion covers d = 0..99 and nothing beyond it');
  }
}
export const seedsForDraw = (d, draws = REGISTERED_DRAWS) => {
  assertDrawIndexInBand(d, draws);
  return {
    cal_seed: AD_CAL_SEED_BASE + d,
    alt_seed: AD_ALT_SEED_BASE + d,
    healthy_seed: AD_HEALTHY_SEED_BASE + d,
    screen_mc_seed_base: AD_SCREEN_MC_SEED_BASE + SCREEN_MC_SEED_STRIDE * d,
  };
};
export const SEED_BANDS = Object.freeze({
  calibration: `${AD_CAL_SEED_BASE} + d, d = 0..${REGISTERED_DRAWS - 1}`,
  canonical_alt: `${AD_ALT_SEED_BASE} + d, d = 0..${REGISTERED_DRAWS - 1}`,
  healthy: `${AD_HEALTHY_SEED_BASE} + d, d = 0..${REGISTERED_DRAWS - 1}`,
  screen_mc: `${AD_SCREEN_MC_SEED_BASE} + ${SCREEN_MC_SEED_STRIDE}*d + j, j = 0..M-1`,
});

// ── test-only hook, named (run-battery.mjs's convention) ─────────────────────
// The replication control of K6A.6.6 test 5: re-score the REGISTERED run's own draws, at the
// registered study's own seeds and its spaced-per-trajectory scheme, and reproduce
// run-20260809T035934Z exactly. Those seeds are deliberately OUTSIDE this study's band, so the hook
// is the only way past assertDrawIndexInBand — it cannot fire by accident (unset env var leaves it
// false), it forces MODE = 'sim', and it is recorded in the manifest.
const REPLICATION_CONTROL = process.env.ACROSSDRAW_REPLICATE === '1';
// The registered study's own constants, for the control only (run-battery.mjs:83-86, :572).
const RC_BASE_SEED = 20260807;
const RC_TRAJ_STEP = 7919;
const RC_HELDOUT_OFFSET = 500000;
const RC_CANONICAL_IDX = 44;                    // cell 44, mix-d1.5, canonical (K6A.1.9)
const RC_ARM_IDX = 47;                          // arm 47, the healthy arm (K6A.1.10)

// ── generators, imported not copied (K6A.6.1) ────────────────────────────────
// run-battery.mjs:570's drawFor at phi = 0. Every draw of this study is phi = 0: the canonical cell
// is N1 and the healthy arm is N1, and the -ar1 cell (46) is NOT in this study's scope.
const drawFor0 = (r) => gaussFrom(r);

/** C1.2's registered statistic, run-battery.mjs:886-893 (`acfAt`), copied because it is four lines
 *  of arithmetic in a script that exports nothing — the same reason run-battery holds its own. */
function acfAt(xs, k) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) den += (xs[i] - m) ** 2;
  for (let i = 0; i + k < xs.length; i++) num += (xs[i] - m) * (xs[i + k] - m);
  return num / den;
}

/** run-battery.mjs:902-916's guard, at the same 0.10 bound. THROWS: a defective calibration
 *  substrate is not an observation, and K6A.6.7 (5) registers no fallback for it. */
const HELDOUT_ACF_BOUND = 0.10;
function assertSerialStructure(rows, calSeed) {
  const out = {};
  for (const k of [1, 2]) {
    const got = acfAt(rows, k);
    out[`acf${k}`] = got;
    if (!(Math.abs(got - 0) <= HELDOUT_ACF_BOUND)) {
      throw new Error(`run-acrossdraw: calibration draw at seed ${calSeed} has acf(${k}) ${got}, `
        + `deviating ${Math.abs(got)} from the 0 its phi = 0 implies (bound ${HELDOUT_ACF_BOUND}, `
        + 'PREREGISTRATION.md Amendment v2.C1 C1.2). A defective substrate is a draw that must not exist.');
    }
  }
  return out;
}

/** One calibration draw: N_ROWS CONSECUTIVE values from ONE continuously advanced stream (C1.2's
 *  form, run-battery.mjs:946-949), guarded, then handed to the SHIPPED module's calibrator and
 *  asserted against the registered geometry before anything is scored on it
 *  (run-battery.mjs:208-214's enforcement, reused). */
export function calibrateDraw(calSeed) {
  const draw = drawFor0(rng(calSeed));
  const rows = new Array(N_ROWS);
  for (let j = 0; j < N_ROWS; j++) rows[j] = draw();
  const acf = assertSerialStructure(rows, calSeed);
  const cal = mod.calibrateEcdfAccumulator(rows, REGISTERED_GEOMETRY);
  assert.deepStrictEqual(
    { W: cal.W, nA: cal.nA, m: cal.m }, REGISTERED_GEOMETRY,
    `run-acrossdraw: calibration at seed ${calSeed} has geometry != K6A.1.2's registered W/nA/m`,
  );
  return { cal, acf };
}

// ── the two arms' series, at the registered run's own call sites ──────────────
/** The canonical mix-d1.5 series. run-battery.mjs:598 + :607: the baseline is generated in FULL
 *  first, then injectShapeMix is called with the same, now-advanced `r` (A5's K6 pinning). */
const canonicalSeries = (r) => injectShapeMix(
  Array.from({ length: T_SPAN }, drawFor0(r)), { sigma: SIGMA, at: ONSET, d: CANONICAL_D, rng: r },
);
/** The healthy series. run-battery.mjs:1505, at phi = 0: span.T draws, nothing injected. */
const healthySeries = (r) => Array.from({ length: T_SPAN }, drawFor0(r));

/** One trajectory scored, verbatim in the shape of run-battery.mjs:794-813's adapter — the
 *  per-window reads FIRST (so the raw e and p the increment_estimator and p_uniformity need are
 *  taken before advanceLogWealth absorbs anything), then ecdfAccumulatorWealth for the crossing.
 *  The deliberate double evaluation is the registered path's and is kept: it costs time and
 *  guarantees the numbers are the ones the registered run read. */
export function scoreSeries(series, cal) {
  const windows = [];
  for (let w = 0; w < WINDOWS; w++) {
    const start = ONSET + w * W;
    windows.push(series.slice(start, start + W));
  }
  const eAvgs = new Array(WINDOWS);
  const ps = [];
  for (let w = 0; w < WINDOWS; w++) {
    const { p, e } = mod.ecdfAccumulatorWindow(windows[w], cal);
    eAvgs[w] = e;
    ps.push(p);
  }
  const { wealth, log } = mod.ecdfAccumulatorWealth(windows, cal);
  const crossed = log.some((l) => l >= Math.log(THRESHOLD));
  return { crossed, wealth, eAvgs, ps };
}

/** One arm, `traj` trajectories. `streamFn(i)` yields trajectory i's series; the caller decides
 *  whether that is one continuously advanced stream (this study, K6A.1.3) or a per-trajectory seed
 *  (the replication control, run-battery.mjs:572). Accumulation is run-battery.mjs:1044-1060's:
 *  `fires`/`finite` from the wealth read, the per-trajectory mean of the 40 raw per-window e values
 *  pushed unconditionally, and every individual p pooled. */
export function runArm(cal, streamFn, traj) {
  let fires = 0;
  let finite = 0;
  let nonFinite = 0;
  const eMeans = [];
  const ps = [];
  for (let i = 0; i < traj; i++) {
    const out = scoreSeries(streamFn(i), cal);
    if (!Number.isFinite(out.wealth)) nonFinite += 1; else finite += 1;
    if (out.crossed) fires += 1;
    eMeans.push(out.eAvgs.reduce((a, b) => a + b, 0) / out.eAvgs.length);
    for (const p of out.ps) ps.push(p);
  }
  return { fires, finite, nonFinite, eMeans, ps };
}

// ── the harness's own reporting statistics, copied from their registered sites ─
/** run-battery.mjs:1102-1108 (`summarise`), K3.1.1's shape — the increment_estimator object. */
function summarise(xs) {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean: m, sd: Math.sqrt(varr), se, lower95_one_sided: m - 1.645 * se, upper95_one_sided: m + 1.645 * se };
}
/** run-battery.mjs:1114-1123 (`computePUniformity`), K3.1.7's shape. */
function computePUniformity(rawPs) {
  const ps = rawPs.filter(Number.isFinite);
  const n = ps.length;
  const decile_counts = new Array(10).fill(0);
  for (const p of ps) decile_counts[Math.min(9, Math.max(0, Math.floor(p * 10)))] += 1;
  const sorted = [...ps].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < n; i++) d = Math.max(d, (i + 1) / n - sorted[i], sorted[i] - i / n);
  return { n, decile_counts, ks_statistic: n > 0 ? d : NaN, ks_critical_at_alpha: n > 0 ? 1.36 / Math.sqrt(n) : NaN };
}
/** run-battery.mjs:1086-1090 (`lower95`), run.mjs:50-52's one-sided 95% Wilson lower bound. */
const lower95 = (k, n) => {
  const p = k / n, z = 1.645, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.max(0, (c - h) / d);
};

/** One fresh null window for the screen's MC term. run-battery.mjs:1177-1180, verbatim. */
const screenNullWindow = (seed) => {
  const draw = drawFor0(rng(seed));
  return Array.from({ length: W }, draw);
};

// ── distributions (K6A.6.6's registered field list) ──────────────────────────
// The quantile convention is the harness's own nearest-rank form (run-battery.mjs:960 `calQuantile`
// / the module's `calQuantile`), stated so a reader can reproduce the numbers: q(p) =
// sorted[round(p*(n-1))]. NOT interpolated — a second convention would be a second set of numbers.
const nearestRank = (sorted, p) => sorted[Math.round(p * (sorted.length - 1))];
function distribution(xs) {
  const n = xs.length;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return {
    n, mean: m, sd, se_of_mean: sd / Math.sqrt(n),
    min: sorted[0], p05: nearestRank(sorted, 0.05), p25: nearestRank(sorted, 0.25),
    p50: nearestRank(sorted, 0.50), p75: nearestRank(sorted, 0.75), p95: nearestRank(sorted, 0.95),
    max: sorted[n - 1],
  };
}
/** Where a single value sits in the measured distribution, as the fraction of draws at or below it.
 *  K6A.6.4 registers this read as DESCRIPTIVE, with no verdict attached. */
const quantileOf = (xs, v) => ({
  value: v,
  fraction_at_or_below: xs.filter((x) => x <= v).length / xs.length,
  inside_support: v >= Math.min(...xs) && v <= Math.max(...xs),
});

// ── the registered run's own three values (K6A.6.4), transcribed at HEAD ──────
const RUN_DRAW = Object.freeze({
  run: 'run-20260809T035934Z',
  canonical_detection: 0.8515,                  // summary.json cell 44 detection_rate
  healthy_crossing_rate: 0.054,                 // summary.json arm 47 healthy crossing_rate
  increment_mean: 1.0249590993997122,           // summary.json arm 47 increment_estimator.mean
});
const EXACT_NULL_E = 0.991433;                  // K6A.1.5's exact E[e|null] at kappa = 0.6820, m = 500

// ── the registered predictions (K6A.6.4) ─────────────────────────────────────
const PREDICTIONS = Object.freeze({
  E1: { what: 'across-draw mean canonical detection-within-6,000', predicted: 0.6207, band: [0.593, 0.648], source: 'K6A.1.4 mean, K6A.2.4c sd' },
  E2: { what: 'across-draw sd of canonical detection (deconvolved)', predicted: 0.1416, band: [0.117, 0.166], source: 'K6A.2.4c' },
  E3: { what: 'P(canonical detection < 0.50)', predicted: 0.196, band: [0.12, 0.28], source: 'K6A.2.4c' },
  E4: { what: 'fraction of draws with healthy rate > alpha = 0.05', predicted: 0.079, band: [0.03, 0.15], source: 'K6A.1.10 (22/280)' },
  E5: { what: 'fraction of draws where the T1 Wilson-LB stop condition would fire', predicted: 0.039, band: [0.01, 0.10], source: 'K6A.1.10 (11/280)' },
  E6: { what: 'across-draw mean of increment_estimator.mean vs the exact null 0.991433', predicted: EXACT_NULL_E, band: null, source: 'K6A.1.5 exact null; disposition rule K6A.6.5' },
  E7: { what: 'draws with positive null growth at the registered M = 8,000', predicted: 0.0013, band: [0, 0], source: 'K6A.4.1 (1.3e-5 per draw)' },
  E8: { what: 'across-draw distribution of p_uniformity KS', predicted: null, band: null, source: 'NO PREDICTION REGISTERED — descriptive and exploratory (K6A.6.4 E8)' },
});

// ── run ──────────────────────────────────────────────────────────────────────
const DRAWS = Number(arg('--draws', REGISTERED_DRAWS));
const TRAJ = Number(arg('--traj', REGISTERED_TRAJ));
const SCREEN_MC = Number(arg('--screen-mc', REGISTERED_SCREEN_MC));
if (!Number.isInteger(DRAWS) || DRAWS < 1) throw new Error(`run-acrossdraw: --draws must be a positive integer, got ${DRAWS}`);
if (!Number.isInteger(TRAJ) || TRAJ < 1) throw new Error(`run-acrossdraw: --traj must be a positive integer, got ${TRAJ}`);
if (!Number.isInteger(SCREEN_MC) || SCREEN_MC < 1 || SCREEN_MC > SCREEN_MC_SEED_STRIDE) {
  throw new Error(`run-acrossdraw: --screen-mc must be a positive integer <= ${SCREEN_MC_SEED_STRIDE} `
    + `(the MC seed stride, K6A.3.1's discipline), got ${SCREEN_MC}`);
}
// The evidence-path rule, run-battery.mjs:1144-1145's convention: only a run at the registered size
// with no hook engaged may write to results/live. This is a property of the run, not a flag the
// caller passes, so a smoke run cannot opt itself into the registered path.
const MODE = (DRAWS === REGISTERED_DRAWS && TRAJ === REGISTERED_TRAJ
  && SCREEN_MC === REGISTERED_SCREEN_MC && !REPLICATION_CONTROL) ? 'live' : 'sim';

/** The replication control (K6A.6.6 test 5). Re-scores the REGISTERED run's own two draws with the
 *  registered study's own seeds and its spaced-per-trajectory scheme, and returns the three numbers
 *  run-20260809T035934Z published, so a test can assert equality rather than trust a comment. */
export function replicateRegisteredRun(traj = 2000) {
  if (!REPLICATION_CONTROL) {
    throw new Error('run-acrossdraw: replicateRegisteredRun requires ACROSSDRAW_REPLICATE=1 — it draws '
      + "the REGISTERED study's seeds, which are outside this study's enumerated band (K6A.6.2)");
  }
  const canonicalCellSeed = RC_BASE_SEED + RC_CANONICAL_IDX;
  const armCellSeed = RC_BASE_SEED + RC_ARM_IDX;
  const { cal: canCal } = calibrateDraw(canonicalCellSeed + RC_HELDOUT_OFFSET);
  const { cal: armCal } = calibrateDraw(armCellSeed + RC_HELDOUT_OFFSET);
  const can = runArm(canCal, (i) => canonicalSeries(rng(canonicalCellSeed + RC_TRAJ_STEP * i)), traj);
  const arm = runArm(armCal, (i) => healthySeries(rng(armCellSeed + RC_TRAJ_STEP * i)), traj);
  return {
    canonical_detection: can.fires / can.finite,
    healthy_crossing_rate: arm.fires / arm.finite,
    increment_mean: summarise(arm.eMeans).mean,
    heldout_seeds: { canonical: canonicalCellSeed + RC_HELDOUT_OFFSET, arm: armCellSeed + RC_HELDOUT_OFFSET },
  };
}

/** One draw, end to end. Exported so a test can census a single row without a full run. */
export function runDraw(d, draws = DRAWS, traj = TRAJ, screenMc = SCREEN_MC) {
  const s = seedsForDraw(d, draws);
  const { cal, acf } = calibrateDraw(s.cal_seed);

  // The standing screen logic, per draw (K6A.6.4 E7). A positive draw is RECORDED, FLAGGED and
  // INCLUDED in every distribution — this study is exactly where such a draw belongs, and it has no
  // verdict to protect, so unlike run-battery.mjs:1243-1272 it does not abort.
  const seeds = new Array(screenMc);
  for (let j = 0; j < screenMc; j++) seeds[j] = s.screen_mc_seed_base + j;
  const scr = mod.nullGrowthScreen(cal, { seeds, drawNullWindow: screenNullWindow });

  // ONE continuously advanced stream per (draw, arm), consumed as consecutive disjoint blocks
  // (K6A.1.3, K6A.6.1). The closure holds `r` across trajectories — that IS the convention.
  const rAlt = rng(s.alt_seed);
  const rHealthy = rng(s.healthy_seed);
  const can = runArm(cal, () => canonicalSeries(rAlt), traj);
  const hlt = runArm(cal, () => healthySeries(rHealthy), traj);

  const healthyRate = hlt.fires / hlt.finite;
  const healthyLb = lower95(hlt.fires, hlt.finite);
  return {
    draw: d,
    cal_seed: s.cal_seed,
    alt_seed: s.alt_seed,
    healthy_seed: s.healthy_seed,
    cal_fingerprint: cal.cal_fingerprint,
    acf1: acf.acf1,
    acf2: acf.acf2,
    canonical_detection: can.fires / can.finite,
    canonical_fires: can.fires,
    canonical_n: can.finite,
    canonical_non_finite_wealth: can.nonFinite,
    healthy_crossing_rate: healthyRate,
    healthy_k: hlt.fires,
    healthy_n: hlt.finite,
    healthy_lower95: healthyLb,
    healthy_above_alpha: healthyRate > ALPHA,
    healthy_lb_would_fire: healthyLb > ALPHA,
    healthy_non_finite_wealth: hlt.nonFinite,
    increment_estimator: summarise(hlt.eMeans),
    p_uniformity: computePUniformity(hlt.ps),
    null_growth_screen: {
      mc_windows: screenMc,
      mean_neg_log_p: scr.meanNegLogP,
      g_null: scr.gNull,
      positive: scr.positive,
      mc_seed_first: seeds[0],
      mc_seed_last: seeds[screenMc - 1],
    },
    screen_positive: scr.positive,
  };
}

/** Verify one registered prediction. `hit` is null when no prediction is registered (E8). */
const verify = (id, measured) => {
  const p = PREDICTIONS[id];
  const inBand = p.band === null ? null : measured >= p.band[0] && measured <= p.band[1];
  return {
    endpoint: id, what: p.what, predicted: p.predicted, band: p.band, measured,
    verdict: p.band === null ? 'DESCRIPTIVE — no band registered' : (inBand ? 'PREDICTION HELD' : 'DEVIATION — recorded, not corrected'),
    source: p.source,
  };
};

function main() {
  const t0 = Date.now();
  const rows = [];
  for (let d = 0; d < DRAWS; d++) {
    rows.push(runDraw(d));
    if (process.env.ACROSSDRAW_QUIET !== '1') {
      const r = rows[rows.length - 1];
      process.stderr.write(`draw ${String(d).padStart(3)}  det ${r.canonical_detection.toFixed(4)}  `
        + `hlt ${r.healthy_crossing_rate.toFixed(4)}  inc ${r.increment_estimator.mean.toFixed(6)}  `
        + `ks ${r.p_uniformity.ks_statistic.toFixed(5)}  g ${r.null_growth_screen.g_null.toExponential(3)}`
        + `${r.screen_positive ? '  SCREEN-POSITIVE' : ''}\n`);
    }
  }

  const det = rows.map((r) => r.canonical_detection);
  const hlt = rows.map((r) => r.healthy_crossing_rate);
  const inc = rows.map((r) => r.increment_estimator.mean);
  const ks = rows.map((r) => r.p_uniformity.ks_statistic);
  const gs = rows.map((r) => r.null_growth_screen.g_null);

  const detDist = distribution(det);
  // K6A.6.3's registered deconvolution, the K6A.2.4c form: the raw sd of the draw-means CONTAINS
  // this study's own binomial noise at TJ = TRAJ, and reporting only the raw sd would overstate the
  // lottery by the study's own measurement noise.
  const phat = detDist.mean;
  const binomVar = phat * (1 - phat) / TRAJ;
  const deconvolvedSd = Math.sqrt(Math.max(0, detDist.sd ** 2 - binomVar));
  const incDist = distribution(inc);

  const pBelowHalf = det.filter((x) => x < 0.50).length / det.length;
  const fracAboveAlpha = rows.filter((r) => r.healthy_above_alpha).length / rows.length;
  const fracLbFire = rows.filter((r) => r.healthy_lb_would_fire).length / rows.length;
  const screenPositives = rows.filter((r) => r.screen_positive).length;

  // K6A.6.5's disposition rule, applied by the code rather than chosen by the author afterwards.
  const incSeOfMean = incDist.se_of_mean;
  const incGap = incDist.mean - EXACT_NULL_E;
  const runDrawInSupport = quantileOf(inc, RUN_DRAW.increment_mean).inside_support;
  let disposition;
  if (incGap > 1.96 * incSeOfMean) {
    disposition = { reading: 'B', name: 'DISPLACED DISTRIBUTION', consequence: 'the finite-variance claim gains its across-draw evidence' };
  } else if (incGap < -1.96 * incSeOfMean || !runDrawInSupport) {
    disposition = { reading: 'C', name: 'NEITHER', consequence: 'filed as a new contradiction under SCHEMA section 9; neither claim gains evidence' };
  } else {
    disposition = { reading: 'A', name: 'TAIL DRAW', consequence: 'the lottery explanation gains its evidence' };
  }
  disposition.gap_from_exact_null = incGap;
  disposition.se_of_across_draw_mean = incSeOfMean;
  disposition.gap_in_se = incGap / incSeOfMean;
  disposition.run_draw_inside_support = runDrawInSupport;
  disposition.rule = 'PREREGISTRATION.md Amendment v2.K6A.6 K6A.6.5, registered before the run';

  const distributions = {
    study: 'coverage / across-draw replication (C51.2)',
    prereg: 'PREREGISTRATION.md Amendment v2.K6A.6',
    draws: rows.length,
    traj_per_arm: TRAJ,
    quantile_convention: 'nearest rank, q(p) = sorted[round(p*(n-1))] (the harness\'s own calQuantile form)',
    canonical_detection: { ...detDist, deconvolved_sd: deconvolvedSd, binomial_sd_at_traj: Math.sqrt(binomVar) },
    healthy_crossing_rate: distribution(hlt),
    increment_mean: incDist,
    ks_statistic: distribution(ks),
    g_null: distribution(gs),
    derived: {
      p_detection_below_0_50: pBelowHalf,
      fraction_healthy_above_alpha: fracAboveAlpha,
      fraction_wilson_lb_would_fire: fracLbFire,
      screen_positive_draws: screenPositives,
      exact_null_e: EXACT_NULL_E,
      ks_critical_at_alpha: rows[0].p_uniformity.ks_critical_at_alpha,
    },
    predictions: [
      verify('E1', detDist.mean),
      verify('E2', deconvolvedSd),
      verify('E3', pBelowHalf),
      verify('E4', fracAboveAlpha),
      verify('E5', fracLbFire),
      { ...verify('E6', incDist.mean), disposition },
      verify('E7', screenPositives),
      verify('E8', distribution(ks).p50),
    ],
    run_draw_quantiles: {
      note: 'K6A.6.4: DESCRIPTIVE, no verdict attached and no disposition contingent on these',
      run: RUN_DRAW.run,
      canonical_detection: quantileOf(det, RUN_DRAW.canonical_detection),
      healthy_crossing_rate: quantileOf(hlt, RUN_DRAW.healthy_crossing_rate),
      increment_mean: quantileOf(inc, RUN_DRAW.increment_mean),
    },
  };

  let gitSha = null;
  try { gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim(); } catch { gitSha = null; }
  const enginePin = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
  const moduleSha = crypto.createHash('sha256').update(fs.readFileSync(MODULE_PATH)).digest('hex');
  const stamp = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;

  const manifest = {
    study: 'coverage / across-draw replication (C51.2)',
    prereg: 'PREREGISTRATION.md Amendment v2.K6A.6',
    geometry: { W, n_A: N_A, m: M_BLOCKS, n_rows: N_ROWS, kappa: KAPPA, H: T_SPAN - ONSET, windows: WINDOWS, span: `[${ONSET},${T_SPAN})`, threshold: THRESHOLD, canonical_d: CANONICAL_D },
    seed_bands: SEED_BANDS,
    draws: DRAWS,
    traj_per_arm: TRAJ,
    screen_mc_windows: SCREEN_MC,
    trajectory_convention: 'ONE continuously advanced stream per (calibration draw, arm), consecutive disjoint blocks (K6A.1.3, K6A.6.1)',
    module: { path: path.relative(ENGINE_ROOT, MODULE_PATH), sha256: moduleSha },
    replication_control: REPLICATION_CONTROL,
    mode: MODE,
    registered_size: { draws: REGISTERED_DRAWS, traj_per_arm: REGISTERED_TRAJ, screen_mc_windows: REGISTERED_SCREEN_MC },
    git_sha: gitSha,
    engine_pin: enginePin,
    node: process.version,
    generated_at: stamp,
    elapsed_s: (Date.now() - t0) / 1000,
    scores_no_card: true,
    moves_no_coverage_row: true,
  };

  const outRoot = process.env.COVERAGE_RESULTS_DIR
    ? path.resolve(process.env.COVERAGE_RESULTS_DIR)
    : path.join(STUDY, 'results');
  const dir = path.join(outRoot, MODE, `run-acrossdraw-${stamp}`);
  if (fs.existsSync(dir)) throw new Error(`run-acrossdraw: ${dir} already exists — this study is append-only and overwrites nothing`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rows.json'), `${JSON.stringify(rows, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, 'distributions.json'), `${JSON.stringify(distributions, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  process.stdout.write(`${dir}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export const __test = Object.freeze({
  W, N_A, M_BLOCKS, N_ROWS, KAPPA, ALPHA, THRESHOLD, T_SPAN, ONSET, WINDOWS, CANONICAL_D,
  REGISTERED_DRAWS, REGISTERED_TRAJ, REGISTERED_SCREEN_MC, SCREEN_MC_SEED_STRIDE,
  AD_CAL_SEED_BASE, AD_ALT_SEED_BASE, AD_HEALTHY_SEED_BASE, AD_SCREEN_MC_SEED_BASE,
  RC_BASE_SEED, RC_TRAJ_STEP, RC_HELDOUT_OFFSET, RC_CANONICAL_IDX, RC_ARM_IDX,
  MODULE_PATH, RUN_DRAW, EXACT_NULL_E, PREDICTIONS, REPLICATION_CONTROL,
  canonicalSeries, healthySeries, screenNullWindow, acfAt, summarise, computePUniformity,
  lower95, distribution, nearestRank, quantileOf, drawFor0,
});
