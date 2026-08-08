// validation/coverage/test/heldout-substrate.test.mjs — SPEC-DOCUMENTATION of both held-out
// row schemes. Read the scope note below before relying on this file for anything.
//
// PREREGISTRATION.md Amendment v2.C1 registers the held-out row generator as a named code
// defect (house rule 7, §11:249) and registers its replacement. The defect was NOT a wrong
// seed literal or a wrong row count — every seed constant and `HELDOUT_ROWS = 10000` was
// exactly as registered, and every marginal check passed. It was the JOINT distribution:
// `seed(j) = HELDOUT_SEED + 7919*j` with one gaussian read per stream makes both uniforms
// `gaussFrom` consumes affine in `j`, so the 10,000 rows walk a rank-1 Kronecker lattice.
//
// WHAT THIS FILE IS, AND WHAT IT IS NOT. It characterizes BOTH schemes side by side — it
// re-implements each locally and imports nothing but `../lib/inject.mjs`. It never invokes the
// harness. **So it is NOT the mechanical kill: a regression of `heldoutRows` back to the spaced-
// seed draw would leave every test here passing**, because these tests assert properties of two
// local functions, not of the code under registration. Its value is (a) deriving and pinning the
// `0.10` bound the harness's own guard uses, (b) recording that the marginals do not separate the
// two schemes, so a future reader cannot substitute a moment check for the autocorrelation one,
// and (c) fixing the lattice's measured signature so the defect stays identifiable.
//
// THE MECHANICAL KILL IS ELSEWHERE, and it is two things:
//   1. `assertHeldoutSerialStructure` in `validation/coverage/harness/run-battery.mjs` — the
//      harness THROWS on rows whose autocorrelation does not match their own phi, so the pre-C1
//      draw cannot produce a run at all. `COVERAGE_FORCE_HELDOUT_LATTICE=1` is its positive
//      control, asserted in run-battery.test.mjs.
//   2. The seven value pins in run-battery.test.mjs that a regression moves: cell 28's and arm
//      34 S3's `detection_rate` + INERT verdict (C1.5), `p_uniformity`'s pinned KS statistic and
//      decile histogram, `cal_fingerprint`'s re-derivation, K4.4's cal_median/cal_mad
//      re-derivation, K6.10's window/wealth recompute, K6.7's increment_estimator recompute, and
//      the manifest's `heldout` prose.
//
// The two pre-existing provenance tests in run-battery.test.mjs (K4.4's cal_median/cal_mad
// recompute, K6.10's window/wealth recompute) re-implemented the scheme, so they agreed with the
// harness while the harness was wrong — a re-implementation test cannot see a defect in the thing
// it re-implements. They are updated to the corrected scheme there, which is what makes them
// regression-bearing now rather than merely confirmatory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, gaussFrom } from '../lib/inject.mjs';

const HELDOUT_ROWS = 10000;
const TRAJ_STEP = 7919;
const ACF_BOUND = 0.10;          // C1.2: a 10-sigma bound (iid sd of acf at n=10,000 is ~0.01)

// The two null generators, copied from run-battery.mjs:262-268 (the file under registration).
const ar1 = (r, phi) => {
  const g = gaussFrom(r);
  let p = g();
  const sd = Math.sqrt(1 - phi * phi);
  return () => (p = phi * p + sd * g());
};
const drawFor = (r, phi) => (phi > 0 ? ar1(r, phi) : gaussFrom(r));

/** The DEFECTIVE scheme, kept here as the thing the bound must reject — a fresh
 *  arithmetically-spaced stream per row, one draw each. Amendment v2.C1 C1.1. */
function latticeRows(heldoutSeed, phi) {
  const rows = new Array(HELDOUT_ROWS);
  for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = drawFor(rng(heldoutSeed + TRAJ_STEP * j), phi)();
  return rows;
}

/** The REGISTERED scheme (C1.2): one continuous stream per held-out draw. */
function continuousRows(heldoutSeed, phi) {
  const r = rng(heldoutSeed);
  const draw = drawFor(r, phi);
  const rows = new Array(HELDOUT_ROWS);
  for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = draw();
  return rows;
}

/** C1.2's registered statistic: the biased sample autocorrelation at lag k. */
function acf(xs, k) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) den += (xs[i] - m) ** 2;
  for (let i = 0; i + k < xs.length; i++) num += (xs[i] - m) * (xs[i + k] - m);
  return num / den;
}

const moments = (xs) => {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const m2 = xs.reduce((a, b) => a + (b - m) ** 2, 0) / n;
  const m4 = xs.reduce((a, b) => a + (b - m) ** 4, 0) / n;
  return { mean: m, sd: Math.sqrt(m2), kurtosis: m4 / (m2 * m2) };
};

const blockKurtosisSd = (rows, W = 30) => {
  const ks = [];
  for (let b = 0; b + W <= rows.length; b += W) ks.push(moments(rows.slice(b, b + W)).kurtosis);
  const m = ks.reduce((a, b) => a + b, 0) / ks.length;
  return Math.sqrt(ks.reduce((a, b) => a + (b - m) ** 2, 0) / ks.length);
};

// Every HELDOUT_SEED the battery actually draws, with the phi its cell/arm carries.
// CELL_SEED = 20260807 + idx, HELDOUT_SEED = CELL_SEED + 500000 (§6, K4.4, K6.6).
const REGISTERED_DRAWS = [
  { label: 'K4 cell 18 (3sigma-point)', heldoutSeed: 20760825, phi: 0 },
  { label: 'K4 cell 19 (canonical)', heldoutSeed: 20760826, phi: 0 },
  { label: 'K4 cell 20 (8sigma-point)', heldoutSeed: 20760827, phi: 0 },
  { label: 'K4 cell 21 (5sigma-point-ar1)', heldoutSeed: 20760828, phi: 0.6 },
  { label: 'K6 cell 26 (mix-d1.0)', heldoutSeed: 20760833, phi: 0 },
  { label: 'K6 cell 27 (canonical, mix-d1.5)', heldoutSeed: 20760834, phi: 0 },
  { label: 'K6 cell 28 (mix-d2.0)', heldoutSeed: 20760835, phi: 0 },
  { label: 'K6 cell 29 (mix-d1.5-ar1)', heldoutSeed: 20760836, phi: 0.6 },
  { label: 'arm 31 (family_E)', heldoutSeed: 20760838, phi: 0 },
  { label: 'arm 32 (point_tail_bet)', heldoutSeed: 20760839, phi: 0 },
  { label: 'arm 34 (shape_block)', heldoutSeed: 20760841, phi: 0 },
];

test('C1.2: the registered generator carries the serial structure its own phi implies, on every registered draw', () => {
  for (const { label, heldoutSeed, phi } of REGISTERED_DRAWS) {
    const rows = continuousRows(heldoutSeed, phi);
    const a1 = acf(rows, 1);
    const a2 = acf(rows, 2);
    const want1 = phi;
    const want2 = phi * phi;
    assert.ok(Math.abs(a1 - want1) <= ACF_BOUND,
      `${label}: |acf(1) ${a1.toFixed(6)} - ${want1}| must be <= ${ACF_BOUND}`);
    assert.ok(Math.abs(a2 - want2) <= ACF_BOUND,
      `${label}: |acf(2) ${a2.toFixed(6)} - ${want2}| must be <= ${ACF_BOUND}`);
  }
});

// THE MECHANICAL KILL. A mutation of heldoutRows back to the spaced-seed scheme has to fail
// something, and it cannot be a marginal check (C1.1: the lattice's marginals are BETTER than
// iid). This is the assertion that catches it, stated as the property rather than as the
// negation of one particular wrong implementation.
test('C1.1: the spaced-seed scheme VIOLATES that bound — the regression this test exists to catch', () => {
  for (const { label, heldoutSeed, phi } of REGISTERED_DRAWS) {
    const rows = latticeRows(heldoutSeed, phi);
    const a1 = acf(rows, 1);
    const a2 = acf(rows, 2);
    const dev1 = Math.abs(a1 - phi);
    const dev2 = Math.abs(a2 - phi * phi);
    assert.ok(dev1 > ACF_BOUND || dev2 > ACF_BOUND,
      `${label}: the lattice must be rejected by the bound; got acf(1) ${a1.toFixed(6)} `
      + `(dev ${dev1.toFixed(6)}), acf(2) ${a2.toFixed(6)} (dev ${dev2.toFixed(6)})`);
  }
});

test('C1.1: the lattice autocorrelation is seed-INVARIANT — the fingerprint no iid sample can have', () => {
  // H only translates the lattice; it cannot change its direction vector (B1, B2), so acf(2)
  // is a constant of the scheme. Eight unrelated seeds spanning the 32-bit range.
  const a2s = [20760825, 20760834, 20760841, 1, 999983, 123456789, 4000000000, 777]
    .map((h) => acf(latticeRows(h, 0), 2));
  const lo = Math.min(...a2s);
  const hi = Math.max(...a2s);
  assert.ok(hi - lo < 1e-3,
    `lattice acf(2) must be seed-invariant to < 1e-3; spanned ${lo.toFixed(6)}..${hi.toFixed(6)}`);
  assert.ok(hi < -0.74 && lo > -0.76,
    `and must sit at the derived value ~-0.7513; spanned ${lo.toFixed(6)}..${hi.toFixed(6)}`);
  // The corrected scheme is seed-DEPENDENT and centred on zero, as an iid sample must be.
  const good = [20760825, 20760834, 20760841, 1, 999983, 123456789, 4000000000, 777]
    .map((h) => acf(continuousRows(h, 0), 2));
  assert.ok(Math.max(...good.map(Math.abs)) < 0.02,
    `corrected acf(2) must be within noise of 0; max |acf(2)| ${Math.max(...good.map(Math.abs)).toFixed(6)}`);
  assert.ok(Math.max(...good) - Math.min(...good) > 1e-3,
    'and must actually vary with the seed, unlike the lattice');
});

test('C1.1: the marginals do NOT separate the two schemes — why a marginal test could not have caught this', () => {
  // Recorded as an assertion, not a comment: both schemes pass every marginal check this
  // study ever applied, and the lattice passes them slightly BETTER (it is a low-discrepancy
  // set, not a random one). A future reader tempted to replace the acf bound with a moment
  // check has the counterexample in front of them.
  const lattice = moments(latticeRows(20760834, 0));
  const corrected = moments(continuousRows(20760834, 0));
  for (const [label, m] of [['lattice', lattice], ['corrected', corrected]]) {
    assert.ok(Math.abs(m.mean) < 0.02, `${label}: mean ${m.mean}`);
    assert.ok(Math.abs(m.sd - 1) < 0.02, `${label}: sd ${m.sd}`);
    assert.ok(Math.abs(m.kurtosis - 3) < 0.10, `${label}: kurtosis ${m.kurtosis}`);
  }
  assert.ok(Math.abs(lattice.sd - 1) < Math.abs(corrected.sd - 1),
    'the lattice sd is CLOSER to 1 than the honest sample — the low-discrepancy signature');
});

test('C1.1: the lattice compresses within-block moment spread, which is the mechanism that moved a verdict', () => {
  // The K6 rank is over BLOCK statistics (shape-block-conformal-bet.ts:18-35), so the
  // quantity that matters is the spread ACROSS blocks, not the marginal moments above.
  for (const { label, heldoutSeed } of REGISTERED_DRAWS.filter((d) => d.phi === 0)) {
    const bad = blockKurtosisSd(latticeRows(heldoutSeed, 0));
    const good = blockKurtosisSd(continuousRows(heldoutSeed, 0));
    assert.ok(bad < good, `${label}: lattice block-kurtosis sd ${bad.toFixed(4)} must be `
      + `compressed against the corrected ${good.toFixed(4)}`);
    assert.ok(bad < 0.55, `${label}: lattice block-kurtosis sd ${bad.toFixed(4)} sits in the `
      + 'compressed 0.479-0.497 band C1.1 measured');
  }
});

test('C1.3: the -ar1 held-out rows now carry real AR(1) structure, and did not before', () => {
  for (const { label, heldoutSeed } of REGISTERED_DRAWS.filter((d) => d.phi === 0.6)) {
    const bad = latticeRows(heldoutSeed, 0.6);
    const good = continuousRows(heldoutSeed, 0.6);
    // Before: acf(2) was NEGATIVE where the matched process requires phi^2 = +0.36.
    assert.ok(acf(bad, 2) < 0, `${label}: the lattice's acf(2) ${acf(bad, 2).toFixed(6)} was negative`);
    assert.ok(Math.abs(acf(bad, 1) - 0.6) > 0.25,
      `${label}: the lattice's acf(1) ${acf(bad, 1).toFixed(6)} was nowhere near phi=0.6`);
    // After: both lags land on the AR(1) theory (phi, phi^2) within the registered bound.
    assert.ok(Math.abs(acf(good, 1) - 0.6) <= ACF_BOUND, `${label}: acf(1) ${acf(good, 1).toFixed(6)} vs phi 0.6`);
    assert.ok(Math.abs(acf(good, 2) - 0.36) <= ACF_BOUND, `${label}: acf(2) ${acf(good, 2).toFixed(6)} vs phi^2 0.36`);
    assert.ok(Math.abs(acf(good, 3) - 0.216) <= ACF_BOUND, `${label}: acf(3) ${acf(good, 3).toFixed(6)} vs phi^3 0.216`);
  }
});
