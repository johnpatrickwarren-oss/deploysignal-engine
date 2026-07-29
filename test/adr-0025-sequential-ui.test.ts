// test/adr-0025-sequential-ui.test.ts — the sequential (predictable-plug-in) UI e-process.
//
// Properties: (1) ANYTIME validity across the composite null — Ville crossing rate ≤ α and
// stopped mean ≤ 1 at φ ∈ {0, 0.6, 0.95, 0.999}; (2) SELF-STANDARDIZATION — a level-shifted,
// mis-scaled null (μ0 = 5, σ = 2) stays valid with no standardization step (the F7 failure mode
// the gaussian mixture has); (3) power — a mean shift at the declared boundary is detected;
// (4) the trajectory is a genuine e-process readout (finite, monotone bookkeeping); (5) guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sequentialUiMeanShiftEProcess } from '../detectors/sequential-ui';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
/** AR(1) with mean mu, innovation sd sigma, coefficient phi; stationary start. */
function ar1(rng: () => number, n: number, phi: number, mu = 0, sigma = 1): number[] {
  const out: number[] = [];
  let z = gaussian(rng) / Math.sqrt(Math.max(1 - phi * phi, 1e-6));
  for (let t = 0; t < n; t++) { z = phi * z + gaussian(rng); out.push(mu + sigma * z); }
  return out;
}

test('anytime validity: crossing rate ≤ α and stopped mean ≤ 1 across the composite null (any φ)', () => {
  const T = 240, alpha = 0.01, reps = 120;
  for (const phi of [0, 0.6, 0.95, 0.999]) {
    let crossings = 0, stoppedSum = 0;
    for (let rep = 0; rep < reps; rep++) {
      const x = ar1(lcg(1000 * (1 + phi * 1000) + rep), T, phi);
      const r = sequentialUiMeanShiftEProcess(x, { changeFrom: 60 });
      const crossIdx = r.logE.findIndex((le) => le >= Math.log(1 / alpha));
      if (crossIdx >= 0) crossings++;
      // stopping rule: first crossing else terminal — a legal stopping time
      stoppedSum += Math.exp(Math.min(crossIdx >= 0 ? r.logE[crossIdx] : r.terminalLogE, 50));
    }
    assert.ok(crossings / reps <= alpha + 0.03,
      `φ=${phi}: crossing rate ${(crossings / reps).toFixed(3)} should be ≤ α (+MC slack)`);
    assert.ok(stoppedSum / reps <= 1.6,
      `φ=${phi}: stopped mean e ${(stoppedSum / reps).toFixed(2)} should be ≈ ≤ 1 (+MC slack)`);
  }
});

test('self-standardizing: a level-shifted, mis-scaled null needs NO standardization step', () => {
  const T = 240, alpha = 0.01, reps = 150;
  let crossings = 0;
  for (let rep = 0; rep < reps; rep++) {
    const x = ar1(lcg(77000 + rep), T, 0.6, 5, 2); // μ0 = 5, σ = 2 — raw feed
    const r = sequentialUiMeanShiftEProcess(x, { changeFrom: 60 });
    if (r.logE.some((le) => le >= Math.log(1 / alpha))) crossings++;
  }
  assert.ok(crossings / reps <= alpha + 0.03,
    `raw-feed null crossing rate ${(crossings / reps).toFixed(3)} — the profile must absorb level+scale`);
});

test('power: a 2.5σ mean shift at the declared boundary crosses 1/α anytime-validly', () => {
  // Calibration note (2026-07-29, measured): the composite free-φ null ABSORBS most of a small
  // step (oracle-parameter terminal logE ≈ 7 at 1.5σ/T=300 — the construction's ceiling, not an
  // estimator defect), and the predictable plug-in additionally pays ~(k/2)·log t learning
  // regret. Measured at 2.5σ: sequential anytime crossing 0.55 ≈ the fixed-split UI's terminal
  // 0.55 — parity, with the strictly stronger anytime guarantee. This test pins that regime;
  // small-shift power is honestly the fixed-split's (fixed-window) domain.
  let detected = 0, termSum = 0;
  const reps = 60, cal = 60, T = 300;
  for (let rep = 0; rep < reps; rep++) {
    const rng = lcg(31000 + rep);
    const x = ar1(rng, T, 0.5).map((v, t) => (t >= cal ? v + 2.5 : v));
    const r = sequentialUiMeanShiftEProcess(x, { changeFrom: cal });
    if (r.firstCross01 !== null) detected++;
    termSum += r.terminalLogE;
  }
  assert.ok(detected / reps >= 0.4, `anytime detection ${(detected / reps).toFixed(2)} should be ≥ 0.4`);
  assert.ok(termSum / reps > 1, `mean terminal logE ${(termSum / reps).toFixed(1)} should be positive (evidence accumulates)`);
});

test('trajectory sanity: finite everywhere; firstCross01 consistent with the trajectory', () => {
  const x = ar1(lcg(5), 200, 0.9);
  const r = sequentialUiMeanShiftEProcess(x, { changeFrom: 50 });
  assert.equal(r.logE.length, 199);
  for (const le of r.logE) assert.ok(Number.isFinite(le));
  const idx = r.logE.findIndex((le) => le >= Math.log(100));
  assert.equal(r.firstCross01, idx >= 0 ? idx + 1 : null);
});

test('guards: too-short input throws', () => {
  assert.throws(() => sequentialUiMeanShiftEProcess([1, 2]), /need ≥ 3/);
});
