// test/adr-0006-ebh-conditional-calibration.test.ts — ADR 0006.
//
// Validates the closed-form e-BH-CC (Lee-Ren conditional-calibration boosting for a KNOWN per-shard
// null, arXiv:2404.17562) against its theorems: Theorem 2 — the boosted set is a DETERMINISTIC SUPERSET
// of plain e-BH; Theorem 1 — FDR ≤ q is preserved. The construction is EXACT (closed form in the null
// survival), so there is NO Monte-Carlo sample size and NO validity cliff.
//
// Test e-value: a Gaussian one-sided likelihood ratio e = exp(λx − λ²/2), x ~ N(μ,1) — a valid e-value
// (E[e|H0] = 1) whose null survival P(ẽ ≥ x | H0) = Φ(−(ln x + λ²/2)/λ) is known in closed form.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eBenjaminiHochberg } from '../fleet/e-bh';
import { eBHConditionalCalibration } from '../fleet/e-bh-conditional-calibration';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const Phi = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));

const LAMBDA = 2, DELTA = 3;
const eLR = (x: number): number => Math.exp(LAMBDA * x - LAMBDA * LAMBDA / 2);
// Exact null survival of the Gaussian-LR e-value: P(e ≥ x | H0) = P(Z ≥ (ln x + λ²/2)/λ).
const survival = (_j: number, x: number): number => (x <= 0 ? 1 : Phi(-(Math.log(x) + LAMBDA * LAMBDA / 2) / LAMBDA));

// ── 1. Theorem 2 — deterministic superset + the (full) power gain. ─────────────────────────────────
test('superset + power: boosted ⊇ plain on every trial, and boosting roughly doubles power', () => {
  const m = 50, m1 = 10, q = 0.1, T = 300;
  let viol = 0, plainPow = 0, boostPow = 0;
  for (let t = 0; t < T; t++) {
    const rng = lcg(7 + t * 101);
    const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < m1 ? DELTA : 0)));
    const plain = eBenjaminiHochberg(e, q).selected;
    const boost = new Set(eBHConditionalCalibration(e, q, survival).selected);
    for (const i of plain) if (!boost.has(i)) viol++;
    plainPow += plain.filter((i) => i < m1).length / m1;
    boostPow += [...boost].filter((i) => i < m1).length / m1;
  }
  assert.equal(viol, 0, 'Theorem 2: every plain rejection must remain rejected after boosting');
  assert.ok(boostPow / T > plainPow / T + 0.2, `boosting must materially raise power (plain ${(plainPow / T).toFixed(2)} → boosted ${(boostPow / T).toFixed(2)})`);
});

// ── 2. Theorem 1 — FDR ≤ q (mixed null/alternative). ────────────────────────────────────────────
test('FDR: boosted realized FDP ≤ q on a mixed null/alternative fleet', () => {
  const m = 50, m1 = 10, q = 0.1, T = 400;
  let fdp = 0;
  for (let t = 0; t < T; t++) {
    const rng = lcg(1234 + t * 97);
    const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < m1 ? DELTA : 0)));
    const sel = eBHConditionalCalibration(e, q, survival).selected;
    fdp += sel.length ? sel.filter((i) => i >= m1).length / sel.length : 0;
  }
  assert.ok(fdp / T <= q + 0.01, `boosted FDP ${(fdp / T).toFixed(4)} must be ≤ q=${q}`);
});

// ── 3. Theorem 1 — pure-null FDR ≤ q (every rejection is false). ──────────────────────────────────
test('FDR: under the complete null, P(any false rejection) ≤ q', () => {
  const m = 50, q = 0.1, T = 2000;
  let anyRej = 0;
  for (let t = 0; t < T; t++) {
    const rng = lcg(50001 + t * 101);
    const e = Array.from({ length: m }, () => eLR(gaussian(rng)));
    if (eBHConditionalCalibration(e, q, survival).selected.length) anyRej++;
  }
  assert.ok(anyRej / T <= q + 0.005, `pure-null realized FDR ${(anyRej / T).toFixed(4)} must be ≤ q=${q}`);
});

// ── 4. Exactness — deterministic (no Monte-Carlo, no sample-size cliff). ───────────────────────────
test('exact: the procedure is deterministic (no sampling) — repeated calls give identical results', () => {
  const m = 30, q = 0.1;
  const rng = lcg(2024);
  const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < 5 ? DELTA : 0)));
  const a = eBHConditionalCalibration(e, q, survival).selected;
  const b = eBHConditionalCalibration(e, q, survival).selected;
  assert.deepEqual(a, b, 'identical inputs must give identical outputs (no randomness)');
});

// ── 5. Conservative survival stays valid; the float boundary is handled. ───────────────────────────
test('conservative survival fires no more than the exact one (over-stating the tail is safe)', () => {
  const m = 40, q = 0.1, T = 100;
  const conservative = (j: number, x: number): number => Math.min(1, 1.5 * survival(j, x)); // over-states the tail
  let exactExtra = 0;
  for (let t = 0; t < T; t++) {
    const rng = lcg(303 + t * 71);
    const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < 8 ? DELTA : 0)));
    const ex = new Set(eBHConditionalCalibration(e, q, survival).selected);
    const cons = eBHConditionalCalibration(e, q, conservative).selected;
    for (const i of cons) if (!ex.has(i)) exactExtra++; // conservative ⊆ exact
  }
  assert.equal(exactExtra, 0, 'a tail-over-stating survival must reject a subset of the exact procedure');
});

// ── 6. Guards. ──────────────────────────────────────────────────────────────────────────────────
test('guards: empty input, bad q, bad nullMean, out-of-range survival throw', () => {
  assert.throws(() => eBHConditionalCalibration([], 0.1, survival), /empty input/);
  assert.throws(() => eBHConditionalCalibration([2, 3], 0, survival), RangeError);
  assert.throws(() => eBHConditionalCalibration([2, 3], 1.5, survival), RangeError);
  assert.throws(() => eBHConditionalCalibration([2, 3], 0.1, survival, { nullMean: 0 }), RangeError);
  assert.throws(() => eBHConditionalCalibration([2, 3], 0.1, survival, { nullMean: 1.2 }), RangeError); // E[ẽ]>1 impossible for a valid e-value
  assert.throws(() => eBHConditionalCalibration([2, 3], 0.1, () => 2), RangeError); // survival > 1
});
