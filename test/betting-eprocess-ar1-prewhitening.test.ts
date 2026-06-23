// test/betting-eprocess-ar1-prewhitening.test.ts
//
// AR(1) pre-whitening on the betting e-process path (decisions/0001).
// Mirrors the family-a-mixture-supermartingale pre-whitening contract:
//   - ar1_phi=0 (default/absent) => byte-identical to pre-whitening behavior.
//   - ar1_phi=rho on AR(1) H0 => restores the Ville bound (FPR collapses from
//     grossly-inflated back to ~alpha), while detection power is retained.
// The engine already pre-whitens its other Family A detectors; this closes the
// betting path that was left out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshBettingState, updateBettingState } from '../detectors/betting-e-process.js';

// Deterministic PRNG + Gaussian (engine tests use seeded LCGs; no external dep).
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function ar1Step(rng: () => number, rho: number): () => number {
  const innov = Math.sqrt(1 - rho * rho);
  let prev = gaussian(rng);
  return () => { prev = rho * prev + innov * gaussian(rng); return prev; };
}

// (ar1Step samples are time-homogeneous; the window index is not needed.)

const ALPHA = 0.01;
const WINDOW = 150;

// Sticky-fire indicator for one stream. baselineMean=0, sigma^2=1 (AR(1) marginal).
function fires(rho: number, ar1Phi: number, seed: number, drift: number): boolean {
  const step = ar1Step(lcg(seed), rho);
  const st = freshBettingState();
  const threshold = 1 / ALPHA;
  for (let w = 0; w < WINDOW; w++) {
    let x = step();
    if (drift) x += drift * (w + 1);
    updateBettingState(st, x, 0, 1, ALPHA, ar1Phi);
    if (st.M >= threshold) return true;
  }
  return false;
}

function fireRate(rho: number, ar1Phi: number, seed0: number, drift: number, trials: number): number {
  let f = 0;
  for (let t = 0; t < trials; t++) if (fires(rho, ar1Phi, seed0 + t * 7919, drift)) f++;
  return f / trials;
}

test('ar1_phi=0 is byte-identical to the omitted-argument (pre-whitening) path', () => {
  // Same observation sequence; ar1_phi omitted vs explicit 0 must yield identical wealth.
  const rng = lcg(424242);
  const a = freshBettingState();
  const b = freshBettingState();
  for (let i = 0; i < 200; i++) {
    const x = gaussian(rng);
    const mA = updateBettingState(a, x, 0, 1, ALPHA);        // omitted -> default 0
    const mB = updateBettingState(b, x, 0, 1, ALPHA, 0);     // explicit 0
    assert.equal(mA, mB);
  }
  assert.equal(a.M, b.M);
});

test('updateBettingState stores the raw centered observation in last_x_centered', () => {
  const st = freshBettingState();
  updateBettingState(st, 5, 2, 1, ALPHA, 0.5); // x=5, baselineMean=2 -> centered=3
  assert.equal(st.last_x_centered, 3);
});

test('last_x_centered stores the RAW centered value, not the whitened one (no compounding)', () => {
  // Two ticks, phi=0.5, baselineMean=0. Tick 2 must store the RAW centered value
  // (10), NOT the whitened value (10 - 0.5*4 = 8). Storing the whitened value
  // would compound the AR(1) correction across ticks. A single-tick test cannot
  // catch this (tick 1 whitened == raw because the prior is 0).
  const st = freshBettingState();
  updateBettingState(st, 4, 0, 1, ALPHA, 0.5);   // tick 1: centered 4, store raw 4
  assert.equal(st.last_x_centered, 4);
  updateBettingState(st, 10, 0, 1, ALPHA, 0.5);  // tick 2: whitened = 10 - 0.5*4 = 8
  assert.equal(st.last_x_centered, 10, 'must store raw centered (10), not whitened (8)');
});

test('AR(1) H0: ar1_phi pre-whitening restores the Ville bound (FPR collapse)', () => {
  const rho = 0.9;
  const raw = fireRate(rho, 0, 1000, 0, 1500);          // no whitening
  const whitened = fireRate(rho, rho, 2000, 0, 1500);   // phi = true rho (calibrator stamps ~rho)
  assert.ok(raw > 0.3, `raw AR(0.9) FPR should be grossly inflated, got ${raw}`);
  // Pinned tight to ~alpha=0.01 (not a loose 0.05) so the assertion fails if
  // whitening were weakened to a partial correction.
  assert.ok(whitened < 0.03, `whitened FPR should be near alpha=${ALPHA}, got ${whitened}`);
});

test('AR(1) drift is still detected after pre-whitening (power not destroyed)', () => {
  // Honest scope: this is a STRONG ramp (0.15/window over 800 windows). Whitening
  // attenuates a ramp by ~(1-phi), so this confirms whitening does not ZERO OUT
  // power — it does NOT characterize sensitivity near the detection floor (that
  // is the job of the detection-envelope sweep, not this unit test).
  const rho = 0.9;
  const power = fireRate(rho, rho, 3000, 0.15, 800);
  assert.ok(power > 0.9, `whitened detection power on a strong ramp should stay high, got ${power}`);
});

test('iid stream with ar1_phi=0 controls type-I (sanity baseline)', () => {
  const fpr = fireRate(0, 0, 4000, 0, 1500);
  assert.ok(fpr <= 0.03, `iid FPR should be at/below ~alpha, got ${fpr}`);
});
