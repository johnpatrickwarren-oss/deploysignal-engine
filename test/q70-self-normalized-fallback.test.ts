// test/q70-self-normalized-fallback.test.ts — Q70 SLICE 2 math + stamping.
//
// Covers the §7 EmpiricalProcessLILBound math primitives (closed-form
// runtime evaluation + Markov-conservative C-constant solver +
// `buildLilBoundHyperparams` constructor) that ship in SLICE 2, plus
// the NAB per-dataset calibrator's fallback-stamping behavior.
//
// Anti-scope at SLICE 2 v0.1 (deferred to SLICE 3 with named owners):
//   - §6 BetaBinomialMixture bisection (sub-Bernoulli; activated only for
//     family_E_conformal on bounded_probability signals; NAB datasets
//     are unbounded so §7 LIL covers our case)
//   - Library-tight Brent-method C calibration (SLICE 2 uses the
//     Markov-conservative analytical upper bound `C = -2·log(α)`)
//   - Per-detector dispatch wiring (CUSUM log-scale vs LIL √V_t scale
//     units-mapping requires architect cross-check per Q70 spec
//     § Library cross-check status item 2)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

import {
  assertLilBoundHyperparams,
  evaluateLilBound,
  computeLilCConstantConservative,
  buildLilBoundHyperparams,
  evaluateSelfNormalizedBound,
  evaluateBetaBinomialBound,
  LIL_A_DEFAULT,
  LIL_T_MIN_DEFAULT,
} from '../detectors/self-normalized-e-process-fallback';
import { buildPerDatasetConfig } from '../tools/run-nab-per-dataset';
import type { LilBoundHyperparams } from '../types/self-normalized-fallback';

// ── §7 LIL math primitives ─────────────────────────────────────────

test('Q70 SLICE 2 / §7 LIL — evaluateLilBound: closed-form at t=1 with t_min=1', () => {
  // bound(1) = A · sqrt((log(1 + log(1/1)) + C) / 1) = A · sqrt((log(1) + C))
  //          = A · sqrt(C)   since log(1) = 0
  const p: LilBoundHyperparams = { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 };
  const v = evaluateLilBound(p, 1);
  const expected = 0.85 * Math.sqrt(18.42);
  assert.ok(Math.abs(v - expected) < 1e-9, `bound(1)=${v} expected=${expected}`);
});

test('Q70 SLICE 2 / §7 LIL — evaluateLilBound: bound shrinks with t (sqrt decay)', () => {
  const p: LilBoundHyperparams = { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 };
  const b1 = evaluateLilBound(p, 10);
  const b2 = evaluateLilBound(p, 100);
  const b3 = evaluateLilBound(p, 1000);
  assert.ok(b1 > b2 && b2 > b3, `expected monotonic decrease; got ${b1} → ${b2} → ${b3}`);
});

test('Q70 SLICE 2 / §7 LIL — evaluateLilBound throws on t < t_min', () => {
  const p: LilBoundHyperparams = { variant: 'lil_bound', alpha: 1e-4, t_min: 10, A: 0.85, C: 18.42 };
  assert.throws(() => evaluateLilBound(p, 5), /t \(5\) must be >= t_min \(10\)/);
});

test('Q70 SLICE 2 / §7 LIL — assertLilBoundHyperparams validates library asserts', () => {
  // α must be in (0,1)
  assert.throws(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 0, t_min: 1, A: 0.85, C: 1 }), /alpha/);
  assert.throws(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 1, t_min: 1, A: 0.85, C: 1 }), /alpha/);
  // t_min must be ≥ 1
  assert.throws(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 0.5, t_min: 0, A: 0.85, C: 1 }), /t_min/);
  // A must be > 1/sqrt(2) ≈ 0.7071
  assert.throws(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 0.5, t_min: 1, A: 0.5, C: 1 }), /A/);
  // C must be finite
  assert.throws(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 0.5, t_min: 1, A: 0.85, C: Infinity }), /C/);
  // Valid passes
  assert.doesNotThrow(() => assertLilBoundHyperparams({ variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 }));
});

// ── C-constant solver ──────────────────────────────────────────────

test('Q70 SLICE 2 — computeLilCConstantConservative: matches Markov upper bound C = -2 log α', () => {
  // For α = 1e-4: C = -2 · log(1e-4) = 2 · 9.2103... ≈ 18.4207
  const c = computeLilCConstantConservative(1e-4);
  assert.ok(Math.abs(c - 18.42068) < 1e-3, `C(1e-4) = ${c}, expected ≈ 18.42`);
});

test('Q70 SLICE 2 — computeLilCConstantConservative: monotone decreasing in α', () => {
  // Smaller α → larger C → wider envelope
  const cTight = computeLilCConstantConservative(1e-4);
  const cLoose = computeLilCConstantConservative(0.05);
  assert.ok(cTight > cLoose, `tighter α should give larger C; got ${cTight} ≯ ${cLoose}`);
});

test('Q70 SLICE 2 — computeLilCConstantConservative rejects α outside (0,1)', () => {
  assert.throws(() => computeLilCConstantConservative(0), /alpha/);
  assert.throws(() => computeLilCConstantConservative(1), /alpha/);
  assert.throws(() => computeLilCConstantConservative(-0.1), /alpha/);
});

// ── buildLilBoundHyperparams constructor ──────────────────────────

test('Q70 SLICE 2 — buildLilBoundHyperparams: defaults match Q70.4 ASKs', () => {
  const p = buildLilBoundHyperparams(1e-4);
  assert.equal(p.variant, 'lil_bound');
  assert.equal(p.alpha, 1e-4);
  assert.equal(p.t_min, LIL_T_MIN_DEFAULT);  // = 1, library canonical (ASK A)
  assert.equal(p.A, LIL_A_DEFAULT);          // = 0.85, library canonical (ASK A)
  assert.ok(Math.abs(p.C - 18.42068) < 1e-3, `C should be Markov-conservative; got ${p.C}`);
});

test('Q70 SLICE 2 — buildLilBoundHyperparams: option overrides apply', () => {
  const p = buildLilBoundHyperparams(1e-4, { A: 0.9, t_min: 5 });
  assert.equal(p.A, 0.9);
  assert.equal(p.t_min, 5);
  // C is determined by α only in the conservative form
  assert.ok(Math.abs(p.C - 18.42068) < 1e-3);
});

// ── Variant dispatch ───────────────────────────────────────────────

test('Q70 SLICE 2 — evaluateSelfNormalizedBound dispatches LIL variant', () => {
  const p = buildLilBoundHyperparams(1e-4);
  const v = evaluateSelfNormalizedBound(p, 100);
  const direct = evaluateLilBound(p, 100);
  assert.equal(v, direct);
});

test('Q70 SLICE 2 — §6 BetaBinomial bound throws notImplementedSlice1 (SLICE 3 follow-on)', () => {
  // SLICE 2 ships §7 LIL only; §6 BetaBinomial is deferred to SLICE 3
  // per spec § Q70.2 architectural rationale (sub-Bernoulli specific;
  // family_E_conformal on bounded_probability signals only).
  assert.throws(
    () => evaluateBetaBinomialBound(
      {
        variant: 'beta_binomial_mixture',
        alpha: 1e-4, v_opt: 100, alpha_opt: 0.05, g: 0.5, h: 0.5, is_one_sided: true,
      },
      100,
    ),
    /\[Q70 SLICE 1\] §6 BetaBinomialMixture/,
  );
});

// ── NAB per-dataset calibrator stamping ────────────────────────────

test('Q70 SLICE 2 / calibrator — low-φ̂ data: no LIL fallback stamped', () => {
  // Synthetic iid Gaussian-like data; expected φ̂ ≈ 0.
  const N = 1000;
  const values: number[] = [];
  let seed = 0xCAFE;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) values.push(rng() * 2 - 1);
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  assert.ok(Math.abs(provenance.derived.ar1_phi) < 0.3, `expected near-zero φ̂; got ${provenance.derived.ar1_phi}`);
  assert.equal(provenance.self_normalized_fallback, undefined, 'low φ̂ should NOT trigger fallback');
});

test('Q70 SLICE 2 / calibrator — high-φ̂ data: LIL fallback stamped with hyperparams', () => {
  // Synthetic AR(1) data with φ = 0.9; expected φ̂ close to that.
  const N = 1000;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xBEEF;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = rng() * 2 - 1;
    prev = 0.9 * prev + eps;
    values.push(prev);
  }
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  assert.ok(Math.abs(provenance.derived.ar1_phi) >= 0.5, `expected high φ̂; got ${provenance.derived.ar1_phi}`);
  assert.ok(provenance.self_normalized_fallback, 'high φ̂ should trigger fallback stamping');
  assert.equal(provenance.self_normalized_fallback!.reason, 'ar1_phi_exceeds_threshold');
  assert.equal(provenance.self_normalized_fallback!.lil_hyperparams.variant, 'lil_bound');
  assert.equal(provenance.self_normalized_fallback!.lil_hyperparams.alpha, 4e-4);
});

test('Q70 SLICE 2 / calibrator — NAB-style real dataset (φ ≈ 0.95) stamps fallback', () => {
  // Match the diagnostic finding on realKnownCause/ambient_temperature
  // (n_ticks=7267, calibration: mean=70.2, σ²=9.17, φ̂≈0.95).
  // Use a real NAB CSV if available; otherwise simulate.
  const nabCsv = '/Users/johnwarren/concord/NAB/data/realKnownCause/ambient_temperature_system_failure.csv';
  if (!fs.existsSync(nabCsv)) {
    // Skip if NAB repo not co-located; this test is opportunistic.
    return;
  }
  const raw = fs.readFileSync(nabCsv, 'utf8').split('\n').slice(1).filter((l) => l.trim().length > 0);
  const values = raw.map((line) => parseFloat(line.split(',')[1]));
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  assert.ok(provenance.derived.ar1_phi > 0.5, `NAB ambient_temperature should have high φ̂; got ${provenance.derived.ar1_phi}`);
  assert.ok(provenance.self_normalized_fallback, 'fallback should be stamped on high-φ̂ NAB data');
});

test('Q70 SLICE 2 / calibrator — stamped LIL hyperparams validate against library asserts', () => {
  // High-φ̂ data → stamped hyperparams should pass assertLilBoundHyperparams.
  const N = 500;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xFACE;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = rng() * 2 - 1;
    prev = 0.85 * prev + eps;
    values.push(prev);
  }
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  if (provenance.self_normalized_fallback) {
    assert.doesNotThrow(() => assertLilBoundHyperparams(provenance.self_normalized_fallback!.lil_hyperparams));
  }
});
