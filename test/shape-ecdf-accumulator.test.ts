// test/shape-ecdf-accumulator.test.ts — engine test pattern (node:test), following
// test/shape-block-conformal-bet.test.ts (K6) and point-tail-bet-e-value.test.ts (K4).
//
// Every constant asserted here is transcribed from validation/coverage/PREREGISTRATION.md
// Amendment v2.K6A.1 §K6A.1.2 (the frozen configuration), §K6A.1.4-K6A.1.6 (the gate) and
// Amendment v2.K6A §K6A.2 (the construction and the energy-distance form), NOT from any
// report or brief. Where a number is derived rather than quoted, the derivation is in the
// comment above the assertion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrateEcdfAccumulator,
  ecdfAccumulatorWindow,
  ecdfAccumulatorWealth,
  nullGrowthScreen,
  W_K6SLOW,
  N_A_K6SLOW,
  M_K6SLOW,
  N_ROWS_K6SLOW,
  KAPPA_K6SLOW,
  ALPHA_K6SLOW,
  LOG_WEALTH_THRESHOLD_K6SLOW,
  LOG_WEALTH_FLOOR_K6SLOW,
  REGISTERED_GEOMETRY_K6SLOW,
} from '../detectors/shape-ecdf-accumulator';

// ── the hand-computable fixture ──────────────────────────────────────────────
// Geometry {W: 4, nA: 4, m: 4}: 4 reference rows + 4 disjoint 4-blocks = 20 rows.
// This is NOT the registered geometry (that is W=150 / nA=25,000 / m=500 and is
// exercised separately below) — it exists so every T, every rank and every
// fingerprint quantile below is an exact rational computable by hand.
//
//   A  = [0, 1, 2, 4]                (the reference; Fhat_A's support)
//   B1 = [0, 1, 2, 4]   B2 = [1, 2, 3, 6]   B3 = [0, 0, 1, 1]   B4 = [2, 4, 6, 8]
//
// The registered feature (v2.K6A K6A.2, `energy`, verbatim):
//   T(w) = (2/(W*n_A)) * SUM_{i,j} |x_i - a_j|  -  (1/W^2) * SUM_{i,k} |x_i - x_k|
// with W = n_A = 4 the two coefficients are 2/16 = 1/8 and 1/16, and SUM_{i,k} runs
// over ALL W^2 ordered pairs, i.e. twice the i<k sum.
//
// cross(w) = SUM_{i,j} |x_i - a_j|,  within(w) = SUM_{i,k} |x_i - x_k| = 2*SUM_{i<k}(...)
//
//   B1 = [0,1,2,4]: rows |x-a| = (0+1+2+4)=7, (1+0+1+3)=5, (2+1+0+2)=5, (4+3+2+0)=9
//                   cross = 26;  i<k gaps 1,2,4,1,3,2 = 13 -> within = 26
//                   T = 26/8 - 26/16 = 3.25 - 1.625 = 1.625              = 13/8
//   B2 = [1,2,3,6]: rows 5, 5, 7, 17 -> cross = 34; i<k gaps 1,2,5,1,4,3 = 16 -> within = 32
//                   T = 34/8 - 32/16 = 4.25 - 2 = 2.25                   = 9/4
//   B3 = [0,0,1,1]: rows 7, 7, 5, 5 -> cross = 24; i<k gaps 0,1,1,1,1,0 = 4 -> within = 8
//                   T = 24/8 - 8/16 = 3 - 0.5 = 2.5                      = 5/2
//   B4 = [2,4,6,8]: rows 5, 9, 17, 25 -> cross = 56; i<k gaps 2,4,6,2,4,2 = 20 -> within = 40
//                   T = 56/8 - 40/16 = 7 - 2.5 = 4.5                     = 9/2
//
// All four are exact binary fractions, so the assertions below are exact, not merely
// within tolerance.
const FIX_A = [0, 1, 2, 4];
const FIX_B = [
  [0, 1, 2, 4],
  [1, 2, 3, 6],
  [0, 0, 1, 1],
  [2, 4, 6, 8],
];
const FIX_GEOM = { W: 4, nA: 4, m: 4 };
const FIX_BLOCK_T = [1.625, 2.25, 2.5, 4.5];

function fixtureRows(): number[] {
  return [...FIX_A, ...FIX_B.flat()];
}
function fixtureCal() {
  return calibrateEcdfAccumulator(fixtureRows(), FIX_GEOM);
}

/** The registered formula computed as literally written — the full W*n_A and W^2
 *  double sums, no sorted-A prefix-sum identity. The module uses the O(W log n_A)
 *  form because the registered geometry's direct sum is 3.75M terms per window;
 *  this is the oracle that pins the two forms together. */
function naiveEnergyT(window: number[], a: number[]): number {
  const W = window.length;
  const nA = a.length;
  let cross = 0;
  for (const x of window) for (const aj of a) cross += Math.abs(x - aj);
  let within = 0;
  for (const x of window) for (const y of window) within += Math.abs(x - y);
  return (2 / (W * nA)) * cross - (1 / (W * W)) * within;
}

// A deterministic non-crypto source for the registered-geometry test only. Copied
// from test/shape-block-conformal-bet.test.ts; it is NOT the harness's registered
// generator (lib/inject.mjs's LCG + gaussFrom) and nothing here claims parity with it.
const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// ── 1. registered constants, against the prereg text ────────────────────────
test('registered constants (v2.K6A.1 K6A.1.2, the frozen configuration)', () => {
  assert.equal(W_K6SLOW, 150);
  assert.equal(N_A_K6SLOW, 25000);
  assert.equal(M_K6SLOW, 500);
  assert.equal(N_ROWS_K6SLOW, 100000);
  // K6A.1.2: kappa = 0.6820 FROZEN LITERAL, not re-derived on the gate's own data.
  assert.equal(KAPPA_K6SLOW, 0.682);
  assert.equal(ALPHA_K6SLOW, 0.05);
  // endpoint = wealth >= 20 (log >= log 20 = 2.995732), i.e. 1/alpha at alpha = 0.05.
  assert.equal(LOG_WEALTH_THRESHOLD_K6SLOW, Math.log(20));
  assert.ok(Math.abs(LOG_WEALTH_THRESHOLD_K6SLOW - 2.995732) < 5e-7);
  // K6A.1.2's substrate arithmetic: n = n_A + m*W with no remainder.
  assert.equal(N_A_K6SLOW + M_K6SLOW * W_K6SLOW, N_ROWS_K6SLOW);
  assert.deepEqual(
    { ...REGISTERED_GEOMETRY_K6SLOW },
    { W: 150, nA: 25000, m: 500 },
  );
  // Same floor as the K6 module's LOG_WEALTH_FLOOR_K6 (C1.9 I1: log(1e-12)).
  assert.equal(LOG_WEALTH_FLOOR_K6SLOW, Math.log(1e-12));
});

// ── 2. exact T on the hand-computed fixture ─────────────────────────────────
test('T is the registered energy-distance form, exact on a hand-computed 4-point window', () => {
  const cal = fixtureCal();
  // live = [1,2,3,6] is B2's own content: cross = 34, within = 32,
  // T = 34/8 - 32/16 = 2.25 (derivation in the fixture comment above).
  const r = ecdfAccumulatorWindow([1, 2, 3, 6], cal);
  assert.ok(Math.abs(r.T - 2.25) < 1e-12, `T = ${r.T}, expected 2.25`);
  // and the other three, all hand-derived above
  assert.ok(Math.abs(ecdfAccumulatorWindow([0, 1, 2, 4], cal).T - 1.625) < 1e-12);
  assert.ok(Math.abs(ecdfAccumulatorWindow([0, 0, 1, 1], cal).T - 2.5) < 1e-12);
  assert.ok(Math.abs(ecdfAccumulatorWindow([2, 4, 6, 8], cal).T - 4.5) < 1e-12);
  // the calibration's own block statistics are the same four values, in block order
  assert.deepEqual(cal.blockT, FIX_BLOCK_T);
});

test('the prefix-sum T equals the literal double-sum form (CvM/AD would not)', () => {
  const cal = fixtureCal();
  const windows = [
    [1, 2, 3, 6],
    [0, 0, 1, 1],
    [-3, 0.5, 2.25, 9],
    [7, 7, 7, 7.5],
  ];
  for (const w of windows) {
    const fast = ecdfAccumulatorWindow(w, cal).T;
    const slow = naiveEnergyT(w, FIX_A);
    assert.ok(Math.abs(fast - slow) < 1e-12, `${JSON.stringify(w)}: ${fast} vs ${slow}`);
  }
});

// ── 3. rank-p exactness, tie-inclusive ──────────────────────────────────────
test('p = (1 + #{T(B_j) >= T(live)})/(m+1), exact rationals, ties INCLUDED', () => {
  const cal = fixtureCal();
  // block T = [1.625, 2.25, 2.5, 4.5], m = 4, so p is a fifth.
  // live T = 2.25 ties B2 exactly: #{>= 2.25} = {2.25, 2.5, 4.5} = 3 -> p = 4/5.
  // A `>` instead of `>=` would drop the tie and read 3/5 (K6.2's rule, cited by K6A.2).
  assert.equal(ecdfAccumulatorWindow([1, 2, 3, 6], cal).p, 4 / 5);
  // live T = 1.625 ties the smallest: all four are >= -> p = 5/5 = 1
  assert.equal(ecdfAccumulatorWindow([0, 1, 2, 4], cal).p, 1);
  // live T = 4.5 ties the largest: #{>= 4.5} = 1 -> p = 2/5
  assert.equal(ecdfAccumulatorWindow([2, 4, 6, 8], cal).p, 2 / 5);
  // live [10,11,12,13]: rows 33,37,41,45 -> cross = 156; i<k gaps 1,2,3,1,2,1 = 10 -> within = 20
  //   T = 156/8 - 20/16 = 19.5 - 1.25 = 18.25, above every block -> count 0 -> p = 1/5
  const top = ecdfAccumulatorWindow([10, 11, 12, 13], cal);
  assert.ok(Math.abs(top.T - 18.25) < 1e-12);
  assert.equal(top.p, 1 / 5);
  // e = kappa * p^(kappa-1) at the frozen kappa = 0.6820, pinned to 15 significant digits
  assert.ok(Math.abs(top.e - 1.1377761766300065) < 1e-12, `e = ${top.e}`);
  assert.ok(Math.abs(ecdfAccumulatorWindow([2, 4, 6, 8], cal).e - 0.91270262041713124) < 1e-12);
  assert.ok(Math.abs(ecdfAccumulatorWindow([1, 2, 3, 6], cal).e - 0.73215285257918494) < 1e-12);
  // p = 1 is the neutral read: e = kappa exactly
  assert.equal(ecdfAccumulatorWindow([0, 1, 2, 4], cal).e, KAPPA_K6SLOW);
});

// ── 4. the exact discrete null law at the frozen m and kappa ────────────────
test('E[e|null] over the m+1 equally likely p values = 0.991433320 at m=500, kappa=0.6820', () => {
  // K6A.1.5 registers E[e|null] = 0.991433 exact at the frozen constants, and K6A.2's
  // closed form is E[e|null] = kappa*(m+1)^(-kappa)*SUM_{k=1..m+1} k^(kappa-1).
  // Computed two independent ways from the module's own constants: as the mean of
  // kappa*p^(kappa-1) over the 501-point grid p = k/501, and as the closed form.
  const m = M_K6SLOW;
  const k = KAPPA_K6SLOW;
  let gridMean = 0;
  for (let i = 1; i <= m + 1; i++) gridMean += k * Math.pow(i / (m + 1), k - 1);
  gridMean /= m + 1;
  let s = 0;
  for (let i = 1; i <= m + 1; i++) s += Math.pow(i, k - 1);
  const closedForm = k * Math.pow(m + 1, -k) * s;
  assert.ok(Math.abs(gridMean - closedForm) < 1e-12, `${gridMean} vs ${closedForm}`);
  assert.ok(Math.abs(gridMean - 0.991433320) < 1e-9, `E[e|null] = ${gridMean}`);
  // strictly below 1 — the property that makes it an e-value (K6A.2)
  assert.ok(gridMean < 1);
  // K6A.1.5's companion exact: E[log p|null] = (SUM_{k<=m+1} log k)/(m+1) - log(m+1)
  let sl = 0;
  for (let i = 1; i <= m + 1; i++) sl += Math.log(i / (m + 1));
  assert.ok(Math.abs(sl / (m + 1) + 0.991961) < 5e-7, `E[log p|null] = ${sl / (m + 1)}`);
});

// ── 5. windows combine by PRODUCT, never by max ─────────────────────────────
test('windows combine by PRODUCT in the log domain, never by max', () => {
  const cal = fixtureCal();
  const w = [10, 11, 12, 13]; // p = 1/5, e = 1.1377761766300065 (test 3)
  const r = ecdfAccumulatorWealth([w, w], cal);
  // product: e^2 = 1.2945346281067958; max: e = 1.1377761766300065. They diverge by 0.157.
  assert.ok(Math.abs(r.wealth - 1.2945346281067958) < 1e-12, `wealth = ${r.wealth}`);
  assert.ok(Math.abs(r.wealth - 1.1377761766300065) > 0.1, 'a max-combining wealth would read the single e');
  // the log path is cumulative, one entry per window (the any-time crossing check needs
  // every prefix, not just the final value)
  assert.equal(r.log.length, 2);
  assert.ok(Math.abs(r.log[0] - Math.log(1.1377761766300065)) < 1e-12);
  assert.ok(Math.abs(r.log[1] - 2 * Math.log(1.1377761766300065)) < 1e-12);
  assert.ok(r.log[1] > r.log[0], 'a max-combining path would be flat on identical windows');
});

// ── 6. the registered crossing arithmetic ───────────────────────────────────
test('the earliest arithmetically possible crossing is window 2 (K6A.1.5)', () => {
  // K6A.1.5: per-window ceiling log kappa + (1-kappa)*log(m+1) = 1.594155 nats at the
  // frozen constants, so one window cannot reach log 20 = 2.995732 and two can; a
  // crossing at window 2 needs S_2 >= (log 20 - 2 log kappa)/(1 - kappa) = 11.82762 of
  // the maximum attainable 2*log 501 = 12.43321.
  const ceiling = Math.log(KAPPA_K6SLOW) + (1 - KAPPA_K6SLOW) * Math.log(M_K6SLOW + 1);
  assert.ok(Math.abs(ceiling - 1.594155) < 5e-7, `ceiling = ${ceiling}`);
  assert.ok(ceiling < LOG_WEALTH_THRESHOLD_K6SLOW, 'window 1 cannot cross');
  assert.ok(2 * ceiling > LOG_WEALTH_THRESHOLD_K6SLOW, 'window 2 can');
  const s2Needed = (Math.log(20) - 2 * Math.log(KAPPA_K6SLOW)) / (1 - KAPPA_K6SLOW);
  assert.ok(Math.abs(s2Needed - 11.82762) < 1e-4, `S_2 needed = ${s2Needed}`);
  assert.ok(Math.abs(2 * Math.log(M_K6SLOW + 1) - 12.43321) < 1e-4);

  // and the module realizes it: at the registered geometry, a live window far outside
  // the reference's support scores the minimum attainable p = 1/501 (e = 4.924167), so
  // two such windows cross and one does not.
  const cal = registeredGeometryCal();
  const extreme = new Array<number>(W_K6SLOW).fill(1e6);
  const one = ecdfAccumulatorWealth([extreme], cal);
  assert.equal(one.crossingIndex, -1);
  const two = ecdfAccumulatorWealth([extreme, extreme], cal);
  assert.equal(ecdfAccumulatorWindow(extreme, cal).p, 1 / (M_K6SLOW + 1));
  assert.ok(two.log[0] < LOG_WEALTH_THRESHOLD_K6SLOW);
  assert.ok(two.log[1] >= LOG_WEALTH_THRESHOLD_K6SLOW);
  assert.equal(two.crossingIndex, 1, 'crossingIndex is 0-based: 1 is the second window');
});

// ── 7. the wealth floor ─────────────────────────────────────────────────────
test('the wealth floor binds on an underflowing path and the crossing is unaffected', () => {
  const cal = fixtureCal();
  // p = 1 for every window (live T at the smallest block T), so log e = log kappa =
  // -0.38272562 per window. 80 windows would reach 80*log(0.6820) = -30.618050, below
  // the floor log(1e-12) = -27.631021, so the floor binds from window 73 on
  // (72*0.38272562 = 27.556 < 27.631 <= 73*0.38272562 = 27.939).
  const neutral = [0, 1, 2, 4];
  const windows = new Array<number[]>(80).fill(neutral);
  const r = ecdfAccumulatorWealth(windows, cal);
  // window 72 (index 71) is the last unfloored one
  assert.ok(Math.abs(r.log[71] - 72 * Math.log(KAPPA_K6SLOW)) < 1e-9, `log[71] = ${r.log[71]}`);
  assert.equal(r.log[79], LOG_WEALTH_FLOOR_K6SLOW, 'the floor binds instead of underflowing');
  assert.ok(Math.abs(LOG_WEALTH_FLOOR_K6SLOW - -27.631021115928547) < 1e-12);
  // without the floor this path would read -30.618049691093990
  assert.ok(r.log[79] > -30.6, 'floor removal would let the path run to 80*log kappa');
  assert.equal(r.crossingIndex, -1, 'a floored path never crosses upward on its own');
  // the upper bar, and why the floor cannot touch a registered verdict: over the
  // registered horizon N = 40 the worst attainable path is 40*log kappa = -15.309025,
  // which never reaches the floor at all.
  assert.ok(40 * Math.log(KAPPA_K6SLOW) > LOG_WEALTH_FLOOR_K6SLOW);
  // and a floored prefix followed by maximal windows still needs the full climb
  const r2 = ecdfAccumulatorWealth([...windows, ...new Array<number[]>(2).fill([10, 11, 12, 13])], cal);
  assert.equal(r2.crossingIndex, -1);
  assert.ok(r2.log[81] > r2.log[79], 'the books keep counting up from the floor (ADR 0026)');
});

// ── 8. guards, one positive control each ────────────────────────────────────
test('guard: a window whose length is not W throws', () => {
  const cal = fixtureCal();
  assert.throws(() => ecdfAccumulatorWindow([1, 2, 3], cal), /must be 4, got 3/);
  assert.throws(() => ecdfAccumulatorWindow([1, 2, 3, 4, 5], cal), /must be 4, got 5/);
  // at the registered geometry this is the W = 150 guard
  const rcal = registeredGeometryCal();
  assert.throws(
    () => ecdfAccumulatorWindow(new Array<number>(149).fill(0), rcal),
    /must be 150, got 149/,
  );
});

test('guard: kappa outside the open interval (0,1) throws', () => {
  const cal = fixtureCal();
  for (const bad of [0, 1, -0.5, 1.5, NaN, Infinity]) {
    assert.throws(
      () => ecdfAccumulatorWindow([1, 2, 3, 6], cal, bad),
      /kappa must be a finite number in the open interval \(0,1\)/,
      `kappa = ${bad} must throw`,
    );
  }
  // the frozen literal itself is inside the interval
  assert.ok(KAPPA_K6SLOW > 0 && KAPPA_K6SLOW < 1);
});

test('guard: a degenerate reference throws at calibration time', () => {
  // (a) Fhat_A degenerate: A is a point mass, so the reference measure has no spread
  const flatA = [3, 3, 3, 3, ...FIX_B.flat()];
  assert.throws(() => calibrateEcdfAccumulator(flatA, FIX_GEOM), /degenerate reference ECDF/);
  // (b) a constant B-block
  const constBlock = [...FIX_A, ...FIX_B[0], 5, 5, 5, 5, ...FIX_B[2], ...FIX_B[3]];
  assert.throws(() => calibrateEcdfAccumulator(constBlock, FIX_GEOM), /constant reference block/);
  // (c) zero spread across the m block statistics (every block ties the same T), the
  //     K6 module's assertNonDegenerate case (b) in this construction's terms
  const tied = [...FIX_A, ...FIX_B[1], ...FIX_B[1], ...FIX_B[1], ...FIX_B[1]];
  assert.throws(() => calibrateEcdfAccumulator(tied, FIX_GEOM), /zero spread/);
});

test('guard: non-finite input throws rather than propagating a NaN', () => {
  // The messages are asserted at the INDEX, not just on the phrase "non-finite": a NaN row
  // also reaches the downstream "non-finite T" checks, so a loose pattern would let the
  // input guard be deleted without any test noticing (mutation G6/G7).
  const rows = fixtureRows();
  // calibration side, in A
  const badA = [...rows]; badA[2] = NaN;
  assert.throws(() => calibrateEcdfAccumulator(badA, FIX_GEOM), /non-finite row at index 2 \(NaN\)/);
  // calibration side, in B
  const badB = [...rows]; badB[13] = Infinity;
  assert.throws(() => calibrateEcdfAccumulator(badB, FIX_GEOM), /non-finite row at index 13 \(Infinity\)/);
  // live side
  const cal = fixtureCal();
  assert.throws(() => ecdfAccumulatorWindow([1, 2, NaN, 6], cal), /non-finite value at window index 2 \(NaN\)/);
  assert.throws(() => ecdfAccumulatorWindow([1, 2, -Infinity, 6], cal), /non-finite value at window index 2/);
  // and through the wealth path — a NaN window must not be silently absorbed
  assert.throws(
    () => ecdfAccumulatorWealth([[1, 2, 3, 6], [1, 2, NaN, 6]], cal),
    /non-finite value at window index 2/,
  );
});

test('guard: m after the A/B split must equal the registered m', () => {
  const rows = fixtureRows();
  // one row short: B no longer divides into W-blocks (the A/B off-by-one signature)
  assert.throws(() => calibrateEcdfAccumulator(rows.slice(0, 19), FIX_GEOM), /exact multiple of W/);
  // four rows short: B divides, but into m-1 = 3 blocks
  assert.throws(() => calibrateEcdfAccumulator(rows.slice(0, 16), FIX_GEOM), /m must be 4, got 3/);
  // four rows long: m+1 = 5 blocks
  assert.throws(() => calibrateEcdfAccumulator([...rows, 1, 2, 3, 4], FIX_GEOM), /m must be 4, got 5/);
  // at the registered geometry the same guard is the n = 100,000 / m = 500 check
  assert.throws(
    () => calibrateEcdfAccumulator(new Array<number>(99850).fill(0).map((_, i) => i)),
    /m must be 500, got 499/,
  );
  // and a geometry whose own arithmetic is not integral is refused
  assert.throws(() => calibrateEcdfAccumulator(rows, { W: 0, nA: 4, m: 4 }), /W must be a positive integer/);
  assert.throws(() => calibrateEcdfAccumulator(rows, { W: 4, nA: 0, m: 4 }), /nA must be a positive integer/);
  assert.throws(() => calibrateEcdfAccumulator(rows, { W: 4, nA: 4, m: 0 }), /m must be a positive integer/);
});

// ── 9. cal_fingerprint ──────────────────────────────────────────────────────
test('cal_fingerprint is deterministic given rows, on C1.8s registered construction', () => {
  const cal = fixtureCal();
  // sorted block T = [1.625, 2.25, 2.5, 4.5]; m = 4 is even so
  //   median = (2.25 + 2.5)/2 = 2.375
  //   |dev| = [0.75, 0.125, 0.125, 2.125] -> ascending [0.125, 0.125, 0.75, 2.125]
  // C1.8's quantile convention q(p) = sortedAbsDev[round(p*(m-1))]:
  //   q(0.5) = index round(1.5) = 2 -> 0.75      (JS rounds half away from zero)
  //   q(0.9) = index round(2.7) = 3 -> 2.125
  //   max    = last                  -> 2.125
  assert.deepEqual(cal.cal_fingerprint, {
    W: 4,
    m: 4,
    n_A: 4,
    blockT: { median: 2.375, absdev_p50: 0.75, absdev_p90: 2.125, absdev_max: 2.125 },
  });
  // deterministic: a second calibration on the same rows is identical
  assert.deepEqual(calibrateEcdfAccumulator(fixtureRows(), FIX_GEOM).cal_fingerprint, cal.cal_fingerprint);
});

test('cal_fingerprint changes when a row changes', () => {
  const cal = fixtureCal();
  // a changed B row moves that block's T; making it the extreme moves absdev_max
  const movedB = fixtureRows(); movedB[19] = 80; // B4's last row, 8 -> 80
  const fb = calibrateEcdfAccumulator(movedB, FIX_GEOM).cal_fingerprint;
  assert.notEqual(fb.blockT.absdev_max, cal.cal_fingerprint.blockT.absdev_max);
  // a changed A row moves every block's T, so the median moves too
  const movedA = fixtureRows(); movedA[3] = 9; // A's last row, 4 -> 9
  const fa = calibrateEcdfAccumulator(movedA, FIX_GEOM).cal_fingerprint;
  assert.notEqual(fa.blockT.median, cal.cal_fingerprint.blockT.median);
  // the geometry fields are the construction's identity, not the draw's
  assert.equal(fa.W, 4); assert.equal(fa.m, 4); assert.equal(fa.n_A, 4);
});

// ── 10. the registered geometry, end to end ─────────────────────────────────
let REG_CAL: ReturnType<typeof calibrateEcdfAccumulator> | null = null;
/** One 100,000-row draw at the registered geometry, memoized across tests. The draw is
 *  from the test-local LCG above, NOT from the harness's registered generator. */
function registeredGeometryCal() {
  if (REG_CAL === null) {
    const r = lcg(20260851);
    const rows = new Array<number>(N_ROWS_K6SLOW);
    for (let i = 0; i < N_ROWS_K6SLOW; i++) rows[i] = gauss(r);
    REG_CAL = calibrateEcdfAccumulator(rows);
  }
  return REG_CAL;
}

test('the registered geometry splits 100,000 rows into A = 25,000 and m = 500 blocks of 150', () => {
  const cal = registeredGeometryCal();
  assert.equal(cal.W, 150);
  assert.equal(cal.nA, 25000);
  assert.equal(cal.m, 500);
  assert.equal(cal.blockT.length, 500);
  assert.equal(cal.sortedA.length, 25000);
  assert.equal(cal.cal_fingerprint.W, 150);
  assert.equal(cal.cal_fingerprint.m, 500);
  assert.equal(cal.cal_fingerprint.n_A, 25000);
  // ascending, finite, non-degenerate
  for (let i = 1; i < cal.sortedA.length; i++) assert.ok(cal.sortedA[i - 1] <= cal.sortedA[i]);
  assert.ok(cal.blockT.every((t) => Number.isFinite(t)));

  // C1.8's quantile convention, pinned at m = 500 where it is DISTINGUISHABLE: at m = 4 the
  // fixture above cannot separate q(p) = sortedAbsDev[round(p*(m-1))] from the off-by-one
  // sortedAbsDev[floor(p*m)] — both land on the same element. At m = 500 they do not:
  // round(0.9*499) = 449 against floor(0.9*500) = 450 (mutation A7).
  const sortedT = [...cal.blockT].sort((a, b) => a - b);
  const med = (sortedT[249] + sortedT[250]) / 2;
  const dev = sortedT.map((t) => Math.abs(t - med)).sort((a, b) => a - b);
  assert.equal(cal.cal_fingerprint.blockT.median, med);
  assert.equal(cal.cal_fingerprint.blockT.absdev_p50, dev[Math.round(0.5 * 499)]);
  assert.equal(cal.cal_fingerprint.blockT.absdev_p90, dev[Math.round(0.9 * 499)]);
  assert.equal(cal.cal_fingerprint.blockT.absdev_max, dev[499]);
  assert.notEqual(dev[449], dev[450], 'the two quantile conventions must be distinguishable here');
});

test('K6A.1.12s structural zeros: p in [1/501, 1] and e in [0.6820, 4.924167], always finite', () => {
  const cal = registeredGeometryCal();
  const r = lcg(20260851 + 500000);
  const eMax = KAPPA_K6SLOW * Math.pow(M_K6SLOW + 1, 1 - KAPPA_K6SLOW);
  assert.ok(Math.abs(eMax - 4.924167) < 1e-6, `e ceiling = ${eMax}`);
  const windows: number[][] = [];
  for (let w = 0; w < 40; w++) {
    const win = new Array<number>(W_K6SLOW);
    for (let i = 0; i < W_K6SLOW; i++) win[i] = gauss(r);
    windows.push(win);
  }
  for (const win of windows) {
    const res = ecdfAccumulatorWindow(win, cal);
    assert.ok(Number.isFinite(res.T));
    assert.ok(res.p >= 1 / (M_K6SLOW + 1) && res.p <= 1, `p = ${res.p}`);
    assert.ok(Math.abs(res.p * (M_K6SLOW + 1) - Math.round(res.p * (M_K6SLOW + 1))) < 1e-12,
      `p must be a multiple of 1/501, got ${res.p}`);
    assert.ok(res.e >= KAPPA_K6SLOW && res.e <= eMax, `e = ${res.e}`);
  }
  // N = 40 windows of 150 is the registered horizon H = 6,000 (K6A.1.9)
  assert.equal(windows.length * W_K6SLOW, 6000);
  const path = ecdfAccumulatorWealth(windows, cal);
  assert.equal(path.log.length, 40);
  assert.ok(path.log.every((v) => Number.isFinite(v)));
  assert.ok(Number.isFinite(path.wealth));
});

// ── 11. the reference-conditional null-growth screen ────────────────────────
test('nullGrowthScreen implements g_null(S) = log kappa + (1-kappa)*E[-log p|null,S]', () => {
  const cal = fixtureCal();
  // Three MC seeds, each mapped by the caller's own sampler to a window whose p is
  // known exactly from test 3: 1/5, 2/5, 4/5.
  const bySeed: Record<number, number[]> = {
    11: [10, 11, 12, 13], // p = 1/5
    22: [2, 4, 6, 8],     // p = 2/5
    33: [1, 2, 3, 6],     // p = 4/5
  };
  const screen = nullGrowthScreen(cal, {
    seeds: [11, 22, 33],
    drawNullWindow: (s) => bySeed[s],
  });
  const expectedMean = (-Math.log(1 / 5) - Math.log(2 / 5) - Math.log(4 / 5)) / 3;
  assert.equal(screen.draws, 3);
  assert.equal(screen.kappa, KAPPA_K6SLOW);
  assert.ok(Math.abs(screen.meanNegLogP - expectedMean) < 1e-12);
  // g_null = log(0.6820) + 0.318 * mean = -0.091345168402693633
  assert.ok(Math.abs(screen.gNull - -0.091345168402693633) < 1e-12, `gNull = ${screen.gNull}`);
  assert.equal(screen.positive, false);
  // deterministic: same seeds, same reading
  const again = nullGrowthScreen(cal, { seeds: [11, 22, 33], drawNullWindow: (s) => bySeed[s] });
  assert.deepEqual(again, screen);
});

test('nullGrowthScreen fires on positive null growth — the registered STOP condition', () => {
  const cal = fixtureCal();
  // every draw at the minimum attainable p = 1/5 (m = 4): E[-log p] = log 5 = 1.6094,
  // g_null = log(0.6820) + 0.318*1.6094 = +0.12907563501536895 > 0 -> STOP.
  const screen = nullGrowthScreen(cal, {
    seeds: [1, 2, 3],
    drawNullWindow: () => [10, 11, 12, 13],
  });
  assert.ok(Math.abs(screen.gNull - 0.12907563501536895) < 1e-12, `gNull = ${screen.gNull}`);
  assert.equal(screen.positive, true);
  // and the clean direction: p = 1 every draw gives g_null = log kappa exactly
  const clean = nullGrowthScreen(cal, { seeds: [1, 2], drawNullWindow: () => [0, 1, 2, 4] });
  assert.equal(clean.meanNegLogP, 0);
  assert.equal(clean.gNull, Math.log(KAPPA_K6SLOW));
  assert.equal(clean.positive, false);
});

test('nullGrowthScreen has no Date or Math.random default and guards its inputs', () => {
  const cal = fixtureCal();
  const ok = { seeds: [1], drawNullWindow: () => [1, 2, 3, 6] };
  // seeds are mandatory and must be finite numbers
  assert.throws(() => nullGrowthScreen(cal, { ...ok, seeds: [] }), /at least one MC seed/);
  assert.throws(() => nullGrowthScreen(cal, { ...ok, seeds: [NaN] }), /seeds\[0\] must be a finite number/);
  // the sampler is mandatory — the module carries no generator of its own
  assert.throws(
    () => nullGrowthScreen(cal, { seeds: [1] } as unknown as Parameters<typeof nullGrowthScreen>[1]),
    /drawNullWindow must be a function/,
  );
  // the sampler's output is validated by the same window guards
  assert.throws(() => nullGrowthScreen(cal, { ...ok, drawNullWindow: () => [1, 2, 3] }), /must be 4, got 3/);
  assert.throws(() => nullGrowthScreen(cal, { ...ok, drawNullWindow: () => [1, 2, NaN, 4] }), /non-finite/);
  // kappa is overridable but guarded
  assert.throws(() => nullGrowthScreen(cal, { ...ok, kappa: 1 }), /open interval \(0,1\)/);
  assert.equal(nullGrowthScreen(cal, { ...ok, kappa: 0.5 }).kappa, 0.5);
  // the shipped module carries no wall-clock or Math.random fallback anywhere
  const src: string = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'detectors', 'shape-ecdf-accumulator.js'),
    'utf8',
  );
  assert.ok(!/Math\.random|Date\.now|new Date/.test(src), 'no Date/random default in the built module');
});
