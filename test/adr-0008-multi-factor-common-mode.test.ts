// test/adr-0008-multi-factor-common-mode.test.ts — ADR 0008 (productionises ADR 0007 frontier #2).
//
// The contamination-robust MULTI-FACTOR common-mode generalises the scalar center (ADR 0004 PR B) to
// HETEROGENEOUS factor loadings. Properties:
//   1. On a heterogeneous-loading fleet the SCALAR center FAILS (FDP ≫ q) but multi-factor controls
//      FDP ≤ q at power — the whole point.
//   2. On a homogeneous fleet it still controls FDP ≤ q (reduces toward the scalar center).
//   3. Breakdown: controlled at a minority fault fraction, degrades past it.
//   4. Guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { multiFactorRobustResiduals, factorDeflationEnergy } from '../fleet/multi-factor-common-mode';
import { contaminationRobustResiduals } from '../fleet/common-mode';
import { nuisanceRobustBFEValue } from '../detectors/nuisance-robust-bf-e-value';
import { eBenjaminiHochberg } from '../fleet/e-bh';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const N = 36, M = 280, NT = 120, T = M + NT, FONSET = M;
const BASE = 1000, DRIFT = 0.5, LVL = 10, NOISE = 2, RHO = 0.5, STEP = 5;

/** A factor-model fleet: shared random-walk factor F, per-shard loading λ_i (heterogeneous or 1),
 *  per-shard level + AR(1) noise, step fault on the first `mfail` shards from FONSET. */
function genFleet(seed: number, mfail: number, hetero: boolean): { X: number[][]; failed: boolean[] } {
  const rng = lcg(seed); const f = (): number => gaussian(rng);
  const F = new Array(T).fill(0);
  for (let t = 1; t < T; t++) F[t] = F[t - 1] + DRIFT * f();
  const lam = Array.from({ length: N }, () => (hetero ? 0.2 + 1.6 * rng() : 1));
  const failed = Array.from({ length: N }, (_, i) => i < mfail);
  const X: number[][] = [];
  for (let i = 0; i < N; i++) {
    const lvl = LVL * f();
    const row = new Array(T);
    let p = f();
    for (let t = 0; t < T; t++) {
      p = RHO * p + Math.sqrt(1 - RHO * RHO) * f();
      row[t] = BASE + lvl + lam[i] * F[t] + NOISE * p + (failed[i] && t >= FONSET ? STEP : 0);
    }
    X[i] = row;
  }
  return { X, failed };
}

const CAL = { start: 0, len: M }, TST = { start: M, len: NT };
const eValues = (R: number[][]): number[] => R.map((r) => nuisanceRobustBFEValue(r, CAL, TST));
function fdpPower(R: number[][], failed: boolean[], q: number): { fdp: number; power: number } {
  const rej = eBenjaminiHochberg(eValues(R), q).selected;
  const fp = rej.filter((i) => !failed[i]).length, tp = rej.filter((i) => failed[i]).length;
  const nf = failed.filter(Boolean).length;
  return { fdp: rej.length ? fp / rej.length : 0, power: nf ? tp / nf : 0 };
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ── 1. Heterogeneous loadings — scalar FAILS, multi-factor controls FDP ≤ q at power. ──────────────
test('heterogeneous: scalar common-mode fails (FDP ≫ q) but multi-factor controls FDP ≤ q at power', () => {
  const TR = 18, q = 0.1, MFAIL = 4; // ~10% faults
  const scalar: Array<{ fdp: number; power: number }> = [];
  const multi: Array<{ fdp: number; power: number }> = [];
  for (let s = 0; s < TR; s++) {
    const { X, failed } = genFleet(1 + s * 53, MFAIL, true);
    scalar.push(fdpPower(contaminationRobustResiduals(X, M), failed, q));
    multi.push(fdpPower(multiFactorRobustResiduals(X, M), failed, q));
  }
  const scalarFDP = mean(scalar.map((r) => r.fdp));
  const multiFDP = mean(multi.map((r) => r.fdp)), multiPow = mean(multi.map((r) => r.power));
  assert.ok(scalarFDP > 0.3, `the scalar center must FAIL on heterogeneous loadings (FDP ${scalarFDP.toFixed(3)} ≫ q)`);
  assert.ok(multiFDP <= q + 0.02, `multi-factor FDP ${multiFDP.toFixed(3)} must be ≤ q=${q}`);
  assert.ok(multiPow >= 0.5, `multi-factor power ${multiPow.toFixed(3)} must stay usable`);
});

// ── 2. Homogeneous loadings — multi-factor still controls FDP ≤ q. ─────────────────────────────────
test('homogeneous: multi-factor still controls FDP ≤ q (it reduces toward the scalar center)', () => {
  const TR = 18, q = 0.1, MFAIL = 4;
  const multi: Array<{ fdp: number; power: number }> = [];
  for (let s = 0; s < TR; s++) {
    const { X, failed } = genFleet(7 + s * 53, MFAIL, false);
    multi.push(fdpPower(multiFactorRobustResiduals(X, M), failed, q));
  }
  assert.ok(mean(multi.map((r) => r.fdp)) <= q + 0.02, `homogeneous multi-factor FDP must be ≤ q`);
  assert.ok(mean(multi.map((r) => r.power)) >= 0.5, 'homogeneous multi-factor power must stay usable');
});

// ── 3. Breakdown — controlled at a minority, lost past it. ─────────────────────────────────────────
test('breakpoint: FDP controlled at 10% faults, degrades by 40% (the minority-fault envelope)', () => {
  const TR = 14, q = 0.1;
  const fdpAt = (mfail: number): number => {
    const rs: number[] = [];
    for (let s = 0; s < TR; s++) {
      const { X, failed } = genFleet(11 + s * 53, mfail, true);
      rs.push(fdpPower(multiFactorRobustResiduals(X, M), failed, q).fdp);
    }
    return mean(rs);
  };
  const low = fdpAt(4), high = fdpAt(15);
  assert.ok(low <= q + 0.02, `at 10% faults FDP ${low.toFixed(3)} must be ≤ q`);
  assert.ok(high > low, `at 40% faults FDP ${high.toFixed(3)} must degrade vs 10% (${low.toFixed(3)}) — the breakdown`);
});

// ── 4. The scree diagnostic — choosing `factors` (the r footgun is visible). ──────────────────────
test('scree: factorDeflationEnergy exposes the true factor count (1-factor data → an elbow after factor 1)', () => {
  // Single-factor heterogeneous fleet, no faults. Factor 1 should remove a large energy fraction; a
  // spurious factor 2 should drop to the noise floor — the elbow a consumer reads to set `factors`.
  const { X } = genFleet(2024, 0, true);
  const energy = factorDeflationEnergy(X, M, 3);
  assert.equal(energy.length, 3);
  assert.ok(energy[0] > 0.5, `the single true factor must remove a large energy fraction; got ${energy[0].toFixed(3)}`);
  assert.ok(energy[1] < energy[0] / 3, `a spurious 2nd factor must drop sharply (elbow); ${energy[1].toFixed(3)} vs ${energy[0].toFixed(3)}`);
  assert.throws(() => factorDeflationEnergy(X, M, N), RangeError, 'maxFactors >= n');
});

// ── 5. Guards. ────────────────────────────────────────────────────────────────────────────────────
test('guards: invalid matrix / calLen / factors throw RangeError', () => {
  assert.throws(() => multiFactorRobustResiduals([], 5), RangeError, 'empty');
  assert.throws(() => multiFactorRobustResiduals([[1, 2], [3]], 1), RangeError, 'ragged');
  assert.throws(() => multiFactorRobustResiduals([[1, 2, NaN], [4, 5, 6]], 1), RangeError, 'non-finite');
  assert.throws(() => multiFactorRobustResiduals([[1, 2, 3], [4, 5, 6]], 0), RangeError, 'calLen < 1');
  assert.throws(() => multiFactorRobustResiduals([[1, 2, 3], [4, 5, 6]], 4), RangeError, 'calLen > ticks');
  assert.throws(() => multiFactorRobustResiduals([[1, 2, 3], [4, 5, 6]], 2, { factors: 2 }), RangeError, 'factors >= n');
  assert.throws(() => multiFactorRobustResiduals([[1, 2, 3], [4, 5, 6]], 2, { factors: 0 }), RangeError, 'factors < 1');
});
