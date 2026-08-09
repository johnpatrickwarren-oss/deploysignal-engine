// validation/coverage/test/run-acrossdraw.test.mjs — the five tests Amendment v2.K6A.6 (K6A.6.6)
// registers for the across-draw driver, each with the mutation that kills it named in its own body.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  seedsForDraw, SEED_BANDS, calibrateDraw, scoreSeries, runArm, runDraw, __test,
} from '../harness/run-acrossdraw.mjs';
import { rng } from '../lib/inject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const mod = require(__test.MODULE_PATH);

// ── 1. DRIVER CENSUS ─────────────────────────────────────────────────────────
// K6A.6.6 (1): every draw carries all four registered endpoints, finite, with the row's own field
// list present. Run at a reduced size — the census is about the SHAPE of a row, and 100 full draws
// is the study, not a test. The 100-draw census of the study itself is verified against
// distributions.json's `draws` in test 1b.
//
// MUTATION KILL: drop `increment_estimator` (or `p_uniformity`, or the screen block) from runDraw's
// returned object, or let any endpoint be NaN, and this fails.
test('1. driver census — every draw carries all four registered endpoints, finite', () => {
  const draws = 2;
  for (let d = 0; d < draws; d++) {
    const r = runDraw(d, draws, 4, 32);
    assert.equal(r.draw, d);
    assert.equal(r.cal_seed, __test.AD_CAL_SEED_BASE + d);
    assert.equal(r.alt_seed, __test.AD_ALT_SEED_BASE + d);
    assert.equal(r.healthy_seed, __test.AD_HEALTHY_SEED_BASE + d);
    // endpoint 1: canonical detection-within-6,000
    assert.ok(Number.isFinite(r.canonical_detection), 'canonical_detection finite');
    assert.ok(r.canonical_detection >= 0 && r.canonical_detection <= 1);
    assert.equal(r.canonical_n, 4);
    // endpoint 2: the healthy arm's crossing rate
    assert.ok(Number.isFinite(r.healthy_crossing_rate), 'healthy_crossing_rate finite');
    assert.ok(Number.isFinite(r.healthy_lower95), 'healthy_lower95 finite');
    assert.equal(typeof r.healthy_above_alpha, 'boolean');
    assert.equal(typeof r.healthy_lb_would_fire, 'boolean');
    // endpoint 3: the S2 increment_estimator
    assert.ok(Number.isFinite(r.increment_estimator.mean), 'increment_estimator.mean finite');
    assert.equal(r.increment_estimator.n, 4);
    for (const k of ['mean', 'sd', 'se', 'lower95_one_sided', 'upper95_one_sided']) {
      assert.ok(Number.isFinite(r.increment_estimator[k]), `increment_estimator.${k} finite`);
    }
    // endpoint 4: p_uniformity KS
    assert.ok(Number.isFinite(r.p_uniformity.ks_statistic), 'ks_statistic finite');
    assert.equal(r.p_uniformity.n, 4 * __test.WINDOWS);
    assert.equal(r.p_uniformity.decile_counts.reduce((a, b) => a + b, 0), 4 * __test.WINDOWS);
    // the standing screen, recorded per draw and never aborting (K6A.6.4 E7)
    assert.equal(r.null_growth_screen.mc_windows, 32);
    assert.ok(Number.isFinite(r.null_growth_screen.g_null), 'g_null finite');
    assert.equal(typeof r.screen_positive, 'boolean');
    // the C1.2 guard ran and its readings are on the row, not merely asserted internally
    assert.ok(Math.abs(r.acf1) <= 0.10 && Math.abs(r.acf2) <= 0.10, 'acf within the C1.2 bound');
    // the geometry the calibration actually had
    assert.equal(r.cal_fingerprint.W, __test.W);
    assert.equal(r.cal_fingerprint.m, __test.M_BLOCKS);
    assert.equal(r.cal_fingerprint.n_A, __test.N_A);
  }
});

// K6A.6.6 (1) states the census as "100 draws x 4 endpoints". The 100 is a property of the
// REGISTERED size, asserted here against the driver's own constants so a silent change to either is
// a failure. MUTATION KILL: change REGISTERED_DRAWS to 50 and this fails.
test('1b. the registered study size is 100 draws x 500 trajectories x 4 endpoints', () => {
  assert.equal(__test.REGISTERED_DRAWS, 100);
  assert.equal(__test.REGISTERED_TRAJ, 500);
  assert.equal(__test.REGISTERED_SCREEN_MC, 8000);
  // the four registered per-draw endpoints of K6A.6, named
  const row = runDraw(0, 1, 2, 8);
  for (const k of ['canonical_detection', 'healthy_crossing_rate', 'increment_estimator', 'p_uniformity']) {
    assert.ok(k in row, `registered endpoint ${k} present`);
  }
});

// ── 2. SEED-BAND GUARD ───────────────────────────────────────────────────────
// K6A.6.6 (2): the driver THROWS outside the registered band. The band is only as good as the guard
// that keeps the driver inside it — K6A.6.2's enumeration covers d = 0..99 and nothing beyond.
//
// MUTATION KILL: delete the `d < 0 || d >= draws` clause from assertDrawIndexInBand, or the
// `draws > REGISTERED_DRAWS` clause, and this fails.
test('2. seed-band guard — throws outside the registered band', () => {
  assert.throws(() => seedsForDraw(-1, 100), /outside the registered band/);
  assert.throws(() => seedsForDraw(100, 100), /outside the registered band/);
  assert.throws(() => seedsForDraw(1.5, 100), /outside the registered band/);
  // a study larger than the enumeration is refused even for an in-range index
  assert.throws(() => seedsForDraw(0, 101), /exceeds the 100/);
  // and the in-band seeds are exactly the registered arithmetic
  for (const d of [0, 37, 99]) {
    const s = seedsForDraw(d, 100);
    assert.equal(s.cal_seed, 51000000 + d);
    assert.equal(s.alt_seed, 52000000 + d);
    assert.equal(s.healthy_seed, 53000000 + d);
    assert.equal(s.screen_mc_seed_base, 57000000 + 10000 * d);
  }
  assert.match(SEED_BANDS.calibration, /^51000000 \+ d, d = 0\.\.99$/);
});

// ── 3. EXACT-SEED DISJOINTNESS ───────────────────────────────────────────────
// K6A.6.6 (3): K6A.6.2's enumeration run as an assertion rather than claimed. Band ordering is NOT
// the argument (K6A.2.3 withdrew it); every seed is reduced mod 2^32 so a family that wraps is
// caught re-entering from below, which the 1.1e9 + 13000027*rep family actually does.
//
// MUTATION KILL: move AD_SCREEN_MC_SEED_BASE to 55000000 and this fails on the wrapped
// 13000027-family member 55039454; move the healthy band to 53041000 and it fails on 53041520.
test('3. exact-seed disjointness — enumerated mod 2^32 against every prior family whose FORM the prereg states', () => {
  const M = 2 ** 32;
  const w = (x) => ((x % M) + M) % M;
  const prior = new Set();
  const add = (x) => prior.add(w(x));

  // the registered study: run-battery.mjs:83-86 BASE_SEED/TRAJ_STEP/SERIES_SALT, cells+arms 0..47,
  // n = 2000 trajectories, K2's 10 series, plus HELDOUT_SEED = CELL_SEED + 500000 (§6)
  for (let idx = 0; idx <= 47; idx++) {
    for (let i = 0; i < 2000; i++) for (let k = 0; k <= 9; k++) add(20260807 + idx + 7919 * i + 104729 * k);
    add(20260807 + idx + 500000);
  }
  // K6A.3.1's null-growth screen bands
  for (let d = 0; d < 250; d++) {
    add(41000000 + d);
    for (let j = 0; j < 8000; j++) add(42000000 + 10000 * d + j);
  }
  // K6A.1.3's fresh probe bands
  for (const b of [1.30e9, 1.42e9, 1.54e9]) {
    for (let rep = 0; rep <= 400; rep++) for (const off of [1, 2, 3, 4, 11, 12, 13, 14]) add(b + 300007 * rep + 7919 * off);
  }
  // K6A.3's sweep bands
  for (const b of [6.0e8, 7.5e8, 9.0e8]) {
    for (let rep = 0; rep <= 400; rep++) for (let cfg = 0; cfg <= 60; cfg++) add(b + 300007 * rep + 7919 * cfg);
  }
  // K6A.4's reproduction anchor — the family K6A.2.3 names as WRAPPING
  for (const s of [1000003, 7000019, 13000027]) for (let rep = 0; rep <= 800; rep++) add(1.1e9 + s * rep);

  assert.equal(prior.size, 3045706, 'the enumerated prior-seed count K6A.6.2 registers');
  // the wrap K6A.6.2 names, verified rather than asserted in prose
  assert.ok(prior.has(42039427), 'the 13000027 family re-enters low at 42039427');
  assert.ok(prior.has(55039454), 'and at 55039454');
  assert.ok(prior.has(68039481), 'and at 68039481');

  const mine = new Set();
  for (let d = 0; d < __test.REGISTERED_DRAWS; d++) {
    const s = seedsForDraw(d);
    for (const v of [s.cal_seed, s.alt_seed, s.healthy_seed]) mine.add(w(v));
    for (let j = 0; j < __test.REGISTERED_SCREEN_MC; j++) mine.add(w(s.screen_mc_seed_base + j));
  }
  assert.equal(mine.size, 3 * __test.REGISTERED_DRAWS + __test.REGISTERED_DRAWS * __test.REGISTERED_SCREEN_MC);
  const collisions = [...mine].filter((s) => prior.has(s));
  assert.deepEqual(collisions, [], `K6A.6.2 registers 0 collisions; got ${collisions.length}: ${collisions.slice(0, 5)}`);
  // every seed of this study is below 2^32, so `seed >>> 0` performs no wrap on THIS side
  for (const s of mine) assert.ok(s < M && s >= 0);
});

// ── 4. MODULE-PATH ASSERTION (positive control) ──────────────────────────────
// K6A.6.6 (4): the driver's scored numbers are EQUAL to the shipped module called directly on the
// same window, so "no reimplementation" is a measurement rather than a comment. If the driver ever
// grows its own p or e, the two diverge and this fails.
//
// MUTATION KILL: replace scoreSeries's `mod.ecdfAccumulatorWindow(...)` with any local arithmetic
// (even an algebraically equivalent one at a different rounding) and this fails.
test('4. module-path assertion — every per-window number is the shipped module\'s, positive control', () => {
  assert.equal(path.basename(__test.MODULE_PATH), 'shape-ecdf-accumulator.js');
  assert.ok(__test.MODULE_PATH.includes(`${path.sep}dist${path.sep}detectors${path.sep}`),
    'the driver imports the SHIPPED module, not the TypeScript source');

  const { cal } = calibrateDraw(seedsForDraw(0).cal_seed);
  const series = __test.canonicalSeries(rng(seedsForDraw(0).alt_seed));
  const got = scoreSeries(series, cal);

  // the same 40 windows, cut the same way, scored by the module DIRECTLY
  const windows = [];
  for (let i = 0; i < __test.WINDOWS; i++) {
    const start = __test.ONSET + i * __test.W;
    windows.push(series.slice(start, start + __test.W));
  }
  const direct = windows.map((win) => mod.ecdfAccumulatorWindow(win, cal));
  assert.equal(got.eAvgs.length, __test.WINDOWS);
  for (let i = 0; i < __test.WINDOWS; i++) {
    assert.equal(got.eAvgs[i], direct[i].e, `window ${i}: e is the module's exact value`);
    assert.equal(got.ps[i], direct[i].p, `window ${i}: p is the module's exact value`);
  }
  const dw = mod.ecdfAccumulatorWealth(windows, cal);
  assert.equal(got.wealth, dw.wealth, 'wealth is the module\'s exact value');
  assert.equal(got.crossed, dw.log.some((l) => l >= Math.log(__test.THRESHOLD)));
  // the calibration is the module's too, and carries the module's own fingerprint
  assert.equal(cal.W, mod.REGISTERED_GEOMETRY_K6SLOW.W);
  assert.equal(cal.m, mod.REGISTERED_GEOMETRY_K6SLOW.m);
  assert.ok(cal.sortedA.length === __test.N_A && cal.blockT.length === __test.M_BLOCKS);
  // and the screen is the module's estimator, not a local one
  const seeds = Array.from({ length: 16 }, (_, j) => 57000000 + j);
  const scr = mod.nullGrowthScreen(cal, { seeds, drawNullWindow: __test.screenNullWindow });
  assert.equal(scr.kappa, __test.KAPPA);
  assert.equal(scr.gNull, Math.log(__test.KAPPA) + (1 - __test.KAPPA) * scr.meanNegLogP);
});

// The geometry guard is enforcement, not observability (run-battery.mjs:205-214's reasoning): a
// wrong-split substrate must not reach a number. MUTATION KILL: drop the assert.deepStrictEqual in
// calibrateDraw, or the module's own exact-split throw, and this fails.
test('4b. a wrong-sized substrate cannot be calibrated', () => {
  const draw = __test.drawFor0(rng(51000000));
  const rows = Array.from({ length: __test.N_ROWS - 1 }, draw);
  assert.throws(() => mod.calibrateEcdfAccumulator(rows, { W: __test.W, nA: __test.N_A, m: __test.M_BLOCKS }),
    /exact multiple of W|m must be/);
});

// ── 5. REPLICATION CONTROL ───────────────────────────────────────────────────
// K6A.6.6 (5): the strongest available evidence that this driver's path IS the registered run's
// path — under the named hook it re-scores run-20260809T035934Z's own two draws, at the registered
// study's own seeds and its spaced-per-trajectory scheme, and reproduces the three published
// numbers EXACTLY. Skipped unless the hook is set (it draws seeds outside this study's band, which
// assertDrawIndexInBand exists to refuse); the study run itself never sets it, and the manifest
// records it either way.
//
// MUTATION KILL: change CANONICAL_D from 1.5, ONSET from 300, T_SPAN from 6300, the A5 `r` pinning
// in canonicalSeries, or the order of the per-window read and the wealth call, and this fails.
test('5. replication control — reproduces run-20260809T035934Z exactly', { skip: !__test.REPLICATION_CONTROL && 'set ACROSSDRAW_REPLICATE=1 to run the replication control' }, async () => {
  const { replicateRegisteredRun } = await import('../harness/run-acrossdraw.mjs');
  const got = replicateRegisteredRun(2000);
  assert.equal(got.heldout_seeds.canonical, 20760851, 'cell 44\'s registered HELDOUT_SEED');
  assert.equal(got.heldout_seeds.arm, 20760854, 'arm 47\'s registered HELDOUT_SEED');
  assert.equal(got.canonical_detection, __test.RUN_DRAW.canonical_detection);
  assert.equal(got.healthy_crossing_rate, __test.RUN_DRAW.healthy_crossing_rate);
  assert.equal(got.increment_mean, __test.RUN_DRAW.increment_mean);
});

// ── the registered predictions, pinned so a silent edit is a failure ─────────
// K6A.6.4's table is the contract this study is judged on. MUTATION KILL: widen any band and this
// fails, which is the point — a band cannot be relaxed after the run without failing a test.
test('6. the registered predictions are the ones K6A.6.4 states', () => {
  const p = __test.PREDICTIONS;
  assert.deepEqual([p.E1.predicted, p.E1.band], [0.6207, [0.593, 0.648]]);
  assert.deepEqual([p.E2.predicted, p.E2.band], [0.1416, [0.117, 0.166]]);
  assert.deepEqual([p.E3.predicted, p.E3.band], [0.196, [0.12, 0.28]]);
  assert.deepEqual([p.E4.predicted, p.E4.band], [0.079, [0.03, 0.15]]);
  assert.deepEqual([p.E5.predicted, p.E5.band], [0.039, [0.01, 0.10]]);
  assert.equal(p.E6.predicted, 0.991433);
  assert.equal(p.E7.predicted, 0.0013);
  assert.equal(p.E8.predicted, null, 'E8 is registered with NO prediction');
  assert.equal(__test.EXACT_NULL_E, 0.991433, 'K6A.1.5\'s exact E[e|null] at m = 500');
  // the registered run's three values, transcribed from summary.json at HEAD
  assert.deepEqual(
    [__test.RUN_DRAW.canonical_detection, __test.RUN_DRAW.healthy_crossing_rate, __test.RUN_DRAW.increment_mean],
    [0.8515, 0.054, 1.0249590993997122],
  );
});

// The reporting statistics are the harness's own, not re-derived. MUTATION KILL: change the 1.645 in
// lower95 or the n-1 in summarise and this fails.
test('7. the reporting statistics match their registered sites', () => {
  // run-battery.mjs:1102-1108
  const s = __test.summarise([1, 2, 3, 4]);
  assert.equal(s.n, 4);
  assert.equal(s.mean, 2.5);
  assert.ok(Math.abs(s.sd - Math.sqrt(5 / 3)) < 1e-15, 'sd uses n-1');
  assert.ok(Math.abs(s.lower95_one_sided - (2.5 - 1.645 * s.se)) < 1e-15);
  // run-battery.mjs:1086-1090 — arm 47's own published pair, reproduced
  assert.ok(Math.abs(__test.lower95(108, 2000) - 0.04627273858970009) < 1e-15,
    'the registered run\'s own healthy lower_95');
  // run-battery.mjs:1114-1123
  const u = __test.computePUniformity([0.05, 0.15, 0.95, Number.NaN]);
  assert.equal(u.n, 3);
  assert.deepEqual(u.decile_counts, [1, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(u.ks_critical_at_alpha, 1.36 / Math.sqrt(3));
  // the nearest-rank quantile convention the driver states in distributions.json
  const sorted = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.equal(__test.nearestRank(sorted, 0.5), 5);
  assert.equal(__test.nearestRank(sorted, 0.05), 0);
  assert.equal(__test.nearestRank(sorted, 0.95), 9);
  // and the descriptive quantile read of K6A.6.4
  const q = __test.quantileOf([0.1, 0.5, 0.9], 0.5);
  assert.deepEqual([q.fraction_at_or_below, q.inside_support], [2 / 3, true]);
  assert.equal(__test.quantileOf([0.1, 0.5], 0.9).inside_support, false);
});

// runArm's accumulation is run-battery.mjs:1044-1060's, including the detail that the per-window e
// and p are pushed UNCONDITIONALLY (outside the finite-wealth branch). MUTATION KILL: move the
// eMeans push inside a finiteness guard and this fails.
test('8. runArm accumulates exactly as run-battery.mjs:1044-1060 does', () => {
  const { cal } = calibrateDraw(seedsForDraw(0).cal_seed);
  const r = rng(seedsForDraw(0).healthy_seed);
  const arm = runArm(cal, () => __test.healthySeries(r), 3);
  assert.equal(arm.finite + arm.nonFinite, 3);
  assert.equal(arm.eMeans.length, 3, 'one increment mean per trajectory, unconditionally');
  assert.equal(arm.ps.length, 3 * __test.WINDOWS, 'every individual p pooled');
  assert.ok(arm.fires <= arm.finite + arm.nonFinite);
  // the increment mean is the mean of the 40 RAW per-window e values, not a log-domain diff
  const series = __test.healthySeries(rng(seedsForDraw(0).healthy_seed));
  const one = scoreSeries(series, cal);
  assert.equal(arm.eMeans[0], one.eAvgs.reduce((a, b) => a + b, 0) / __test.WINDOWS);
});
