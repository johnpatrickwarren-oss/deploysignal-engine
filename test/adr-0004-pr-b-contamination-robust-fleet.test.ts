// test/adr-0004-pr-b-contamination-robust-fleet.test.ts — ADR 0004 PR B.
//
// Ports Tessera's contamination-robust fleet validation (tools/contamination-robust-fleet.ts, Tessera
// ADR 0015 "Lever A") for the promoted common-mode. Four properties, per the migration plan (ADR 0004
// § Migration plan #2):
//
//   1. REDESCENDING REJECTION — robustLocation gives gross outliers weight exactly 0, so a minority of
//      arbitrarily-extreme values cannot move the center (unlike the mean).
//   2. DEMEAN RANK-FLIP — removing each shard's calibration LEVEL turns a faulty-but-low-level shard
//      from mid-pack (by raw value) into a clear cross-sectional outlier (the step plain centers lack).
//   3. FDP ≤ q ON THE SYNTHETIC FLEET — the assembled pipeline
//      contaminationRobustResiduals → nuisanceRobustBFEValue → eBenjaminiHochberg controls realized
//      FDP ≤ q at retained power, where the naive per-tick-median center does NOT (the ADR 0012 gap).
//   4. ~20% BREAKPOINT — FDR control holds for a minority fault fraction and is lost past the
//      redescending estimator's breakdown.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  robustLocation,
  perShardLevel,
  contaminationRobustResiduals,
  TUKEY_C,
} from '../fleet/common-mode';
import { nuisanceRobustBFEValue } from '../detectors/nuisance-robust-bf-e-value';
import { eBenjaminiHochberg } from '../fleet/e-bh';

// ── deterministic PRNG + Gaussian (engine tests use seeded LCGs; no external dep). ──
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }

// ── synthetic fleet (mirrors Tessera genFleet): a strongly-coupled fleet — shared common-mode random
//    walk + per-shard level + AR(1) noise, with a step fault on the first `mfail` shards from FONSET. ──
const N = 60, M = 500, N_TEST = 200, T = M + N_TEST, FONSET = M;
const BASE = 1000, DRIFT = 0.5, LVL = 10, NOISE = 2, RHO = 0.5, STEP = 5;

function genFleet(seed: number, mfail: number, step = STEP): { X: number[][]; failed: boolean[] } {
  const rng = lcg(seed);
  const cm = new Array(T).fill(0);
  for (let t = 1; t < T; t++) cm[t] = cm[t - 1] + DRIFT * gaussian(rng);
  const failed = Array.from({ length: N }, (_, i) => i < mfail);
  const X: number[][] = [];
  for (let i = 0; i < N; i++) {
    const lvl = LVL * gaussian(rng);
    const row = new Array(T);
    let p = gaussian(rng);
    for (let t = 0; t < T; t++) {
      p = RHO * p + Math.sqrt(1 - RHO * RHO) * gaussian(rng);
      row[t] = BASE + cm[t] + lvl + NOISE * p + (failed[i] && t >= FONSET ? step : 0);
    }
    X[i] = row;
  }
  return { X, failed };
}

const CAL = { start: 0, len: M }, TST = { start: M, len: N_TEST };

/** Robust pipeline e-values: contamination-robust residuals → per-shard BF e-value. */
function robustEValues(X: number[][]): number[] {
  return contaminationRobustResiduals(X, M).map((r) => nuisanceRobustBFEValue(r, CAL, TST));
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
/** Naive baseline (ADR 0012): per-tick MEDIAN center, NO per-shard demean → BF e-value. */
function naiveEValues(X: number[][]): number[] {
  const t = X[0].length, n = X.length;
  const R: number[][] = X.map(() => new Array<number>(t));
  for (let j = 0; j < t; j++) {
    const med = median(X.map((row) => row[j]));
    for (let i = 0; i < n; i++) R[i][j] = X[i][j] - med;
  }
  return R.map((r) => nuisanceRobustBFEValue(r, CAL, TST));
}
/** Ablation arm: per-shard demean + per-tick MEDIAN center (the robust center swapped for a plain
 *  median) → BF e-value. Isolates the demean lever from the choice of robust estimator. */
function medianDemeanEValues(X: number[][]): number[] {
  const t = X[0].length, n = X.length;
  const lvl = perShardLevel(X, M);
  const R: number[][] = X.map(() => new Array<number>(t));
  for (let j = 0; j < t; j++) {
    const col = X.map((row, i) => row[j] - lvl[i]);
    const med = median(col);
    for (let i = 0; i < n; i++) R[i][j] = col[i] - med;
  }
  return R.map((r) => nuisanceRobustBFEValue(r, CAL, TST));
}
function fdpPower(evals: number[], failed: boolean[], q: number): { fdp: number; power: number } {
  const rej = eBenjaminiHochberg(evals, q).selected;
  const fp = rej.filter((i) => !failed[i]).length, tp = rej.filter((i) => failed[i]).length;
  const nf = failed.filter(Boolean).length;
  return { fdp: rej.length ? fp / rej.length : 0, power: nf ? tp / nf : 0 };
}

// ── 1. Redescending rejection. ────────────────────────────────────────────────────────────────────
test('robustLocation: redescends — a minority of gross outliers gets weight 0 and cannot move the center', () => {
  const inliers = Array.from({ length: 40 }, () => 0);
  const withOutliers = [...inliers, 100, 120, 150]; // 3/43 gross outliers
  const loc = robustLocation(withOutliers);
  assert.ok(Math.abs(loc) < 1e-6, `center must stay at the inlier mode ~0; got ${loc}`);
  // Push the outliers to 1e9 — redescending ⇒ still weight 0 ⇒ center does not budge (the mean would).
  const moreExtreme = [...inliers, 1e9, 1e9, 1e9];
  assert.ok(Math.abs(robustLocation(moreExtreme)) < 1e-6, 'an extreme outlier must not move a redescending center');
  assert.ok(Math.abs(mean(moreExtreme)) > 1e7, 'sanity: the mean IS dragged by the same outliers');
});

test('robustLocation: guards and edge cases', () => {
  assert.equal(robustLocation([]), 0, 'empty → 0');
  assert.throws(() => robustLocation([1, 2, 3], 0), RangeError, 'c must be > 0');
  // On clean Gaussian-ish data it agrees with the mean to within sampling error.
  const rng = lcg(99); const clean = Array.from({ length: 500 }, () => 10 + gaussian(rng));
  assert.ok(Math.abs(robustLocation(clean) - 10) < 0.3, 'on clean data ≈ the true center');
  assert.equal(TUKEY_C, 4.685);
});

// ── 2. Demean rank-flip. ────────────────────────────────────────────────────────────────────────
test('contaminationRobustResiduals: demean flips a faulty-but-low-level shard from mid-pack to outlier', () => {
  // One faulty shard with a LOW baseline level: at the fault tick its raw value is mid-pack (NOT the
  // max), so value-rank trimming would miss it — but after per-shard level removal it is the outlier.
  const n = 21, t = 600, cal = 500, faulty = 0, faultTick = 550, step = 8;
  const rng = lcg(2024);
  const levels = Array.from({ length: n }, (_, i) => (i === faulty ? 980 : 1000 + 4 * gaussian(rng)));
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(t);
    for (let k = 0; k < t; k++) row[k] = levels[i] + 0.5 * gaussian(rng) + (i === faulty && k >= faultTick ? step : 0);
    X[i] = row;
  }
  // Raw values at the fault tick: the faulty shard (level 980 + 8 = ~988) sits BELOW the ~1000 pack.
  const rawAtFault = X.map((row) => row[faultTick]);
  const rawRank = rawAtFault.filter((v) => v > rawAtFault[faulty]).length; // how many shards exceed it
  assert.ok(rawRank > n / 2, `by raw value the faulty shard is mid/low-pack (rank ${rawRank}/${n}), not an outlier`);
  // Level-adjusted residual at the fault tick: the faulty shard is now the clear cross-sectional outlier.
  const lvl = perShardLevel(X, cal);
  assert.ok(Math.abs(lvl[faulty] - 980) < 1, 'per-shard level recovers the faulty shard’s low baseline');
  const R = contaminationRobustResiduals(X, cal);
  const absResid = R.map((r) => Math.abs(r[faultTick]));
  const maxIdx = absResid.indexOf(Math.max(...absResid));
  assert.equal(maxIdx, faulty, 'after demean the faulty shard has the largest |residual| (it became the outlier)');
  assert.ok(absResid[faulty] > 5, `the fault (step ${step}) survives into the residual; got ${absResid[faulty].toFixed(2)}`);
});

test('contaminationRobustResiduals: guards', () => {
  assert.throws(() => contaminationRobustResiduals([], 5), RangeError, 'empty');
  assert.throws(() => contaminationRobustResiduals([[1, 2], [3]], 1), RangeError, 'ragged');
  assert.throws(() => contaminationRobustResiduals([[1, 2, 3]], 0), RangeError, 'calLen < 1');
  assert.throws(() => contaminationRobustResiduals([[1, 2, 3]], 4), RangeError, 'calLen > ticks');
  assert.throws(() => contaminationRobustResiduals([[1, 2, NaN], [4, 5, 6]], 1), RangeError, 'non-finite value');
});

// ── 3. FDP ≤ q on the synthetic fleet (the assembled pipeline) — the DEMEAN is the load-bearing lever. ──
// HONEST DECOMPOSITION (cold-eye): three arms isolate the two levers.
//   - robust   = per-shard demean + Tukey-biweight center (the shipped construction)
//   - medDemean= per-shard demean + plain MEDIAN center (swaps the robust estimator only)
//   - naive    = per-tick MEDIAN center, NO demean (the ADR 0012 baseline)
// Result on this strongly-coupled synthetic: BOTH demeaned arms control FDP ≤ q at 10% load; the naive
// (no-demean) arm does NOT. So at this load the DEMEAN closes the gap (it makes faults cross-sectional
// outliers), not the choice of robust estimator — the plain median already has 50% breakdown here. The
// Tukey center is chosen for Gaussian EFFICIENCY while still rejecting gross outliers (that rejection is
// pinned by the redescending unit test above); its marginal FDR edge over the median is fault-geometry-
// dependent (Tessera ADR 0015's substrate showed it; this one does not). We do NOT claim Tukey > median.
test('pipeline: the assembled demean+robust+BF+e-BH pipeline controls FDP ≤ q at power; the naive no-demean center does not', () => {
  const TRIALS = 40, q = 0.1, MFAIL = 6; // 6/60 = 10% faults (a minority, under the breakpoint)
  const robust: Array<{ fdp: number; power: number }> = [];
  const medDemean: Array<{ fdp: number; power: number }> = [];
  const naive: Array<{ fdp: number; power: number }> = [];
  for (let s = 0; s < TRIALS; s++) {
    const { X, failed } = genFleet(1 + s * 53, MFAIL);
    robust.push(fdpPower(robustEValues(X), failed, q));
    medDemean.push(fdpPower(medianDemeanEValues(X), failed, q));
    naive.push(fdpPower(naiveEValues(X), failed, q));
  }
  const robustFDP = mean(robust.map((r) => r.fdp)), robustPow = mean(robust.map((r) => r.power));
  const medDemeanFDP = mean(medDemean.map((r) => r.fdp));
  const naiveFDP = mean(naive.map((r) => r.fdp));
  assert.ok(robustFDP <= q + 0.02, `robust (demean+Tukey) FDP ${robustFDP.toFixed(3)} must be ≤ q (=${q})`);
  assert.ok(robustPow >= 0.95, `robust power ${robustPow.toFixed(3)} must stay high`);
  // The demean is the load-bearing lever: with it, even a plain median center controls FDP…
  assert.ok(medDemeanFDP <= q + 0.02, `demean+median FDP ${medDemeanFDP.toFixed(3)} must also be ≤ q (the demean is the lever)`);
  // …without it, the same e-value over a contaminated center blows the FDR (the ADR 0012 gap).
  assert.ok(naiveFDP > Math.max(robustFDP, medDemeanFDP) + 0.1, `naive no-demean FDP ${naiveFDP.toFixed(3)} must be materially worse — the demean is what closes the ADR 0012 gap`);
});

// ── 4. Breakpoint — control holds for a minority, is lost past the breakdown. ──────────────────────
// The breakdown is a finite fault fraction (Tessera ADR 0015 measured ~20% on its substrate; the exact
// value is substrate-dependent — these synthetic params break a bit below 20%). This test pins the
// QUALITATIVE property: controlled at a clear minority (10%), lost well past breakdown (40%).
test('breakpoint: FDR controlled at a 10% fault fraction, lost at 40% (past the breakdown)', () => {
  const TRIALS = 30, q = 0.1;
  const fdpAt = (mfail: number): number => {
    const rs: number[] = [];
    for (let s = 0; s < TRIALS; s++) {
      const { X, failed } = genFleet(7 + s * 53, mfail);
      rs.push(fdpPower(robustEValues(X), failed, q).fdp);
    }
    return mean(rs);
  };
  const lowFrac = fdpAt(6);   // 10% — a minority
  const highFrac = fdpAt(24); // 40% — past the redescending estimator's breakdown
  assert.ok(lowFrac <= q + 0.02, `at 10% faults FDP ${lowFrac.toFixed(3)} must be ≤ q`);
  assert.ok(highFrac > lowFrac, `at 40% faults FDP ${highFrac.toFixed(3)} must degrade vs 10% (${lowFrac.toFixed(3)}) — the breakdown`);
});
