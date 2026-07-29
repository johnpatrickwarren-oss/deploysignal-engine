// ADR 0026 — log-domain wealth for the multiplicative e-process detectors.
//
// The binding tests are the overflow cases (AC-1/2/4: behavior the pre-0026
// linear accumulation gets WRONG, replayed in-test as the oracle) and the
// parity cases (AC-3: in-range decision sequences and wealth books identical
// to the linear replay at 1e-9 relative tolerance). AC-5 binds the log-input
// e-BH variant against the linear procedure; AC-6 binds deserialization
// healing including the poisoned persisted-Infinity case. AC-7/8/9 fold the
// cold-eye findings: the NaN pathway (finding 1), the JSON-null log_M
// silent-reset (finding 2), the floor clamps and the e-BH >= boundary
// (findings 3/4 — the surviving mutants, killed here).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshSafeHotellingState,
  evaluateSafeHotelling,
} from '../detectors/hotelling';
import {
  freshBettingState,
  updateBettingState,
} from '../detectors/betting-e-process';
import {
  freshSpectralEDetectorState,
  evaluateSpectralEDetector,
} from '../detectors/spectral';
import { wealthView, healLogWealth, advanceLogWealth, LOG_MAX_WEALTH } from '../detectors/_wealth';
import { eBenjaminiHochberg, eBenjaminiHochbergLog } from '../fleet/e-bh';
import type { FamilyCPerCell, FamilyDPerSignal, SafeHotellingState } from '../types';

/** Identity-Σ safe-Hotelling cell (the minimal-cell construction products use). */
function identityCell(p: number, alpha: number, tauSquared: number): FamilyCPerCell {
  const covariance: number[][] = [];
  for (let i = 0; i < p; i++) {
    const row = new Array<number>(p).fill(0);
    row[i] = 1;
    covariance.push(row);
  }
  return {
    mean_vector: new Array<number>(p).fill(0),
    covariance,
    hotelling_variant: 'safe_test',
    safe_hotelling_params: {
      tau_squared: tauSquared,
      alpha,
      precompiled_log_det_shrink: (p / 2) * Math.log(1 + tauSquared),
      shrink_fraction: tauSquared / (1 + tauSquared),
    },
  };
}

/** Deterministic LCG so the parity fixtures are reproducible without Date/Math.random. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('AC-1: the measured defect dies at the source — huge-shift safe-Hotelling wealth saturates at Number.MAX_VALUE, exact in log_M, JSON-safe', () => {
  const p = 4;
  const cell = identityCell(p, 1e-4, 1);
  const state = freshSafeHotellingState();
  // δ=32-class observations: xᵀΣ⁻¹x = p·32² per tick ⇒ z_t ≈ 2048 — the
  // linear product is Infinity by tick 1's square; run 60 ticks anyway.
  const x = new Array<number>(p).fill(32);
  // Linear-replay oracle (the pre-0026 accumulation), alongside.
  let linearM = 1;
  for (let t = 0; t < 60; t++) {
    const params = cell.safe_hotelling_params!;
    const xSigmaInvX = x.reduce((s, v) => s + v * v, 0);
    const xSigmaPlusInvX = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
    const z = -params.precompiled_log_det_shrink + 0.5 * xSigmaInvX - 0.5 * xSigmaPlusInvX;
    linearM = Math.max(1e-300, linearM * Math.exp(z));
    evaluateSafeHotelling({ cell, alpha: 1e-4 }, [...x], state);
  }
  assert.equal(linearM, Infinity, 'oracle: the pre-0026 linear accumulation overflows');
  assert.equal(state.M, Number.MAX_VALUE, 'the view saturates finite');
  assert.ok(Number.isFinite(state.log_M!), 'log books stay exact');
  assert.ok(state.log_M! > LOG_MAX_WEALTH, 'and are far above the saturation point');
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.equal(roundTripped.M, Number.MAX_VALUE, 'JSON round-trip carries no null');
});

test('AC-2: the absorbing state is gone — wealth driven above saturation decays back when the evidence reverses', () => {
  const p = 2;
  const cell = identityCell(p, 1e-4, 1);
  const state = freshSafeHotellingState();
  const hot = new Array<number>(p).fill(40);
  let linearM = 1;
  const step = (x: number[]) => {
    const params = cell.safe_hotelling_params!;
    const a = x.reduce((s, v) => s + v * v, 0);
    const b = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
    const z = -params.precompiled_log_det_shrink + 0.5 * a - 0.5 * b;
    linearM = Math.max(1e-300, linearM * Math.exp(z));
    evaluateSafeHotelling({ cell, alpha: 1e-4 }, [...x], state);
  };
  for (let t = 0; t < 5; t++) step(hot);
  assert.equal(linearM, Infinity, 'oracle overflowed');
  assert.equal(state.M, Number.MAX_VALUE, 'view saturated');
  // Healthy ticks: z_t = −log_det_shrink < 0 at x = 0. Feed enough to bring
  // the exact log books back below the saturation point.
  const healthyTicks = Math.ceil((state.log_M! - LOG_MAX_WEALTH) / cell.safe_hotelling_params!.precompiled_log_det_shrink) + 10;
  const calm = new Array<number>(p).fill(0);
  for (let t = 0; t < healthyTicks; t++) step(calm);
  assert.equal(linearM, Infinity, 'the pre-0026 linear wealth is ABSORBED at Infinity forever');
  assert.ok(Number.isFinite(state.M) && state.M < Number.MAX_VALUE,
    `the log-domain view comes back down (M = ${state.M.toExponential(3)})`);
  assert.ok(Math.abs(Math.log(state.M) - state.log_M!) < 1e-9, 'view ≡ exp(log books) once in range');
});

test('AC-3a: safe-Hotelling in-range parity — identical verdicts, log books ≡ linear replay at 1e-9', () => {
  const p = 3;
  const cell = identityCell(p, 1e-4, 0.5);
  const state = freshSafeHotellingState();
  const rand = lcg(0xad0024);
  let linearM = 1;
  for (let t = 0; t < 200; t++) {
    // healthy-ish observations with occasional moderate excursions.
    const x = Array.from({ length: p }, () => (rand() - 0.5) * (t % 17 === 0 ? 6 : 2));
    const params = cell.safe_hotelling_params!;
    const a = x.reduce((s, v) => s + v * v, 0);
    const b = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
    const z = -params.precompiled_log_det_shrink + 0.5 * a - 0.5 * b;
    linearM = Math.max(1e-300, linearM * Math.exp(z));
    const v = evaluateSafeHotelling({ cell, alpha: 1e-4 }, [...x], state);
    const linearVerdict = linearM >= 1 / 1e-4 ? 'fire' : 'clean';
    // after the first fire alphaConsumed makes subsequent 'fire' verdicts differ
    // in α accounting only; verdict string parity is what binds here.
    assert.equal(v.verdict, linearVerdict, `tick ${t}: verdict parity`);
    assert.ok(Math.abs(state.log_M! - Math.log(linearM)) <= 1e-9 * Math.max(1, Math.abs(Math.log(linearM))),
      `tick ${t}: log books match linear replay`);
    assert.ok(Math.abs(state.M - linearM) <= 1e-9 * linearM, `tick ${t}: view matches linear replay`);
  }
});

test('AC-3b: betting in-range parity — wealth and fallback books match the linear replay', () => {
  const state = freshBettingState();
  // Linear replay re-implements the pre-0026 update exactly (GRAPA/ONS bets
  // recomputed from the same running moments — shared deterministic inputs).
  const rand = lcg(0xbe77);
  let linearM = 1;
  let mean = 0;
  let m2 = 0;
  let bet = 0;
  let n = 0;
  const BET_CLIP = 1 - 1e-6;
  for (let t = 0; t < 500; t++) {
    const x = (rand() - 0.5) * 2 + (t > 250 ? 0.4 : 0); // drift onset mid-run
    const M = updateBettingState(state, x, 0, 1, 0.01);
    // replay: boundedZ with B=3, sigma=1
    const zRaw = x / 3;
    const z = zRaw > 1 ? 1 : zRaw < -1 ? -1 : zRaw;
    let b = m2 > 0 ? mean / m2 : 0;
    if (!(Math.abs(b) <= BET_CLIP && Number.isFinite(b))) {
      const denomInner = 1 + bet * mean;
      if (!(m2 > 0) || Math.abs(denomInner) < 1e-9) b = 0;
      else {
        const grad = -mean / denomInner;
        const stepv = grad / Math.max(m2, 1e-6);
        b = bet - stepv;
        if (b > BET_CLIP) b = BET_CLIP;
        if (b < -BET_CLIP) b = -BET_CLIP;
      }
    }
    linearM = Math.max(1e-12, linearM * Math.max(0, 1 + b * z));
    bet = b;
    const n1 = n + 1;
    mean = mean + (z - mean) / n1;
    m2 = m2 + (z * z - m2) / n1;
    n = n1;
    assert.ok(Math.abs(M - linearM) <= 1e-9 * Math.max(1e-12, linearM), `tick ${t}: wealth parity (${M} vs ${linearM})`);
  }
  assert.ok(Math.abs(state.log_M! - Math.log(linearM)) <= 1e-9 * Math.max(1, Math.abs(Math.log(linearM))), 'log books match');
});

test('AC-3c: spectral in-range parity — verdicts and wealth match the linear replay', () => {
  const params: FamilyDPerSignal = {
    bootstrap_null_quantile: 0.9, min_peak_lag: 3, max_peak_lag: 10,
    spectral_variant: 'e_detector', null_mean: 0.42, null_std: 0.05, betting_delta: 0.015,
  };
  const state = freshSpectralEDetectorState();
  const rand = lcg(0x5bec);
  let linearM = 1;
  for (let t = 0; t < 300; t++) {
    const peak = 0.42 + (rand() - 0.5) * 0.1 + (t > 150 ? 0.05 : 0);
    const r = 0.015 / 0.05;
    const u = (peak - 0.42) / 0.05;
    const z = r * u - 0.5 * r * r;
    linearM = Math.max(1e-300, linearM * Math.exp(z));
    const v = evaluateSpectralEDetector({ params, alpha: 1e-4, signal: 's' }, peak, state);
    assert.ok(Math.abs(state.M - linearM) <= 1e-9 * linearM, `tick ${t}: wealth parity`);
    assert.equal(v.verdict === 'fire', linearM >= 1e4, `tick ${t}: verdict parity with the linear replay`);
  }
});

test('AC-4: betting long-run overflow — linear replay hits Infinity, log books stay exact, view saturates', () => {
  const state = freshBettingState();
  let linearM = 1;
  let overflowedAt = -1;
  // Sustained maximal drift: x far beyond the clip ⇒ z = 1 every tick; GRAPA
  // bet → 1 ⇒ factor → ~2 per tick; the linear product overflows near tick
  // ~1100 (log2(MAX_VALUE) ≈ 1024 plus bet warm-up).
  for (let t = 0; t < 3000; t++) {
    updateBettingState(state, 100, 0, 1, 0.01);
    if (Number.isFinite(linearM)) {
      // replay only the wealth factor via the state's own bet decision — the
      // moments are shared, so recompute the factor from the post-update bet
      // sequence is not available; instead replay a lower bound: factor ≥ 1
      // once bet > 0 with z = 1, so linear wealth ≥ product of (1 + bet_t).
      linearM = linearM * (1 + state.bet); // bet_t · z_t with z_t = 1
      if (!Number.isFinite(linearM)) overflowedAt = t;
    }
  }
  assert.ok(overflowedAt > 0, `linear replay overflows (at tick ${overflowedAt})`);
  assert.equal(state.M, Number.MAX_VALUE, 'view saturates at MAX_VALUE, never Infinity');
  assert.ok(Number.isFinite(state.log_M!) && state.log_M! > LOG_MAX_WEALTH, 'log books exact and above saturation');
  assert.equal(JSON.parse(JSON.stringify({ e: state.M })).e, Number.MAX_VALUE, 'JSON-safe');
});

test('AC-5: eBenjaminiHochbergLog ≡ eBenjaminiHochberg on in-range inputs (ties and permutations included), and correct beyond the linear range', () => {
  const rand = lcg(0xebff);
  for (let trial = 0; trial < 50; trial++) {
    const N = 1 + Math.floor(rand() * 40);
    const es = Array.from({ length: N }, () => {
      const u = rand();
      // mix: sub-1 e-values, moderate, large, and exact ties
      if (u < 0.25) return 0.5;
      if (u < 0.5) return rand() * 2;
      if (u < 0.75) return 10 + rand() * 100;
      return 1e6;
    });
    const q = 0.05 + rand() * 0.5;
    const lin = eBenjaminiHochberg(es, q);
    const log = eBenjaminiHochbergLog(es.map((e) => Math.log(e)), q);
    assert.deepEqual(log.selected, lin.selected, `trial ${trial}: selection parity`);
    assert.equal(log.K, lin.K, `trial ${trial}: K parity`);
  }
  // Beyond the linear range: log e-values 800 and 750 are both Infinity in
  // linear space; with N/q pushing R to depend on the true magnitudes the log
  // variant still ranks them exactly. Construct N=4 with two overflowing and
  // two tiny values at q small enough that selection is the two large ones.
  const logEs = [800, 750, Math.log(0.1), Math.log(0.2)];
  const out = eBenjaminiHochbergLog(logEs, 0.05);
  assert.deepEqual(out.selected, [0, 1], 'log-only inputs select the truly-large pair');
  // and the linear path on the exp'd inputs (Infinity, Infinity, .1, .2) agrees
  // on the SET here — the log variant's added value is exact ordering + no
  // Infinity in any intermediate, asserted by construction above.
  const linInf = eBenjaminiHochberg(logEs.map(Math.exp), 0.05);
  assert.deepEqual(linInf.selected, [0, 1], 'documented: linear set-selection survives overflow; the record does not');
});

test('AC-6: deserialization healing — pre-0026 states adopt log(M); a poisoned persisted Infinity heals to the saturation point', () => {
  // pre-0026 shape: no log_M field.
  const old: SafeHotellingState = { M: 123.5, n: 7, alphaConsumed: 0 };
  const cell = identityCell(2, 1e-4, 1);
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [0, 0], old);
  assert.ok(Number.isFinite(old.log_M!), 'healed without NaN');
  const params = cell.safe_hotelling_params!;
  assert.ok(Math.abs(old.log_M! - (Math.log(123.5) - params.precompiled_log_det_shrink)) < 1e-12,
    'adopted log(M) then applied the healthy-tick decrement');
  // poisoned persisted state from the defect era:
  const poisoned: SafeHotellingState = { M: Infinity, n: 60, alphaConsumed: 1e-4 };
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [0, 0], poisoned);
  assert.ok(Number.isFinite(poisoned.log_M!), 'Infinity healed to the saturation point');
  assert.ok(Number.isFinite(poisoned.M), 'and the view is finite from the first post-upgrade tick');
  // direct helper checks
  assert.equal(healLogWealth(undefined, 0, -5), -5, 'nonpositive M heals to the floor');
  assert.equal(healLogWealth(3.25, Infinity, -5), 3.25, 'present finite log_M always wins');
  assert.equal(wealthView(LOG_MAX_WEALTH + 1), Number.MAX_VALUE, 'view saturation');
  assert.ok(Math.abs(wealthView(1) - Math.E) < 1e-12, 'view identity in range');
});

test('AC-7 (cold-eye finding 1): the NaN pathway is closed — a NaN observation HOLDS wealth instead of absorbing to JSON null', () => {
  // safe-Hotelling: NaN component → quadratic forms NaN → z_t NaN → hold.
  const cell = identityCell(2, 1e-4, 1);
  const sh = freshSafeHotellingState();
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [1, 1], sh);
  const before = { M: sh.M, log_M: sh.log_M };
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [NaN, 0], sh);
  assert.equal(sh.log_M, before.log_M, 'NaN tick holds the books');
  assert.equal(sh.M, before.M, 'and the view');
  // an INFINITE observation makes z_t = ∞ − ∞ = NaN in safe-Hotelling: held too
  // (the pre-0026 linear code absorbed to NaN → JSON null here).
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [Infinity, 0], sh);
  assert.equal(sh.log_M, before.log_M, 'infinite observation (NaN z_t) holds');
  assert.notEqual(JSON.parse(JSON.stringify(sh)).M, null, 'JSON carries no null');
  // betting: NaN observation skips the tick BEFORE any mutation.
  const bet = freshBettingState();
  updateBettingState(bet, 1, 0, 1, 0.01);
  const snap = JSON.stringify(bet);
  updateBettingState(bet, NaN, 0, 1, 0.01);
  assert.equal(JSON.stringify(bet), snap, 'NaN tick mutates NOTHING (wealth, bets, moments, n, last_x_centered)');
  // ±Infinity betting observations clip to z = ±1 (pre-0026 behavior) and proceed.
  const M1 = updateBettingState(bet, Infinity, 0, 1, 0.01);
  assert.ok(Number.isFinite(M1), 'infinite observation clips, does not corrupt');
  // spectral: NaN peak holds; an INFINITE peak pins at saturation (fires, as
  // pre-0026 did) and stays JSON-safe and NON-absorbing.
  const params: FamilyDPerSignal = {
    bootstrap_null_quantile: 0.9, min_peak_lag: 3, max_peak_lag: 10,
    spectral_variant: 'e_detector', null_mean: 0.42, null_std: 0.05, betting_delta: 0.015,
  };
  const sp = freshSpectralEDetectorState();
  evaluateSpectralEDetector({ params, alpha: 1e-4, signal: 's' }, 0.42, sp);
  const spBefore = sp.log_M;
  evaluateSpectralEDetector({ params, alpha: 1e-4, signal: 's' }, NaN, sp);
  assert.equal(sp.log_M, spBefore, 'NaN peak holds');
  const v = evaluateSpectralEDetector({ params, alpha: 1e-4, signal: 's' }, Infinity, sp);
  assert.equal(v.verdict, 'fire', 'infinite peak fires (pre-0026 parity)');
  assert.equal(sp.log_M, LOG_MAX_WEALTH, 'pinned at the saturation point — finite, JSON-safe');
  assert.equal(sp.M, Number.MAX_VALUE, 'view saturated, not Infinity');
});

test('AC-8 (cold-eye finding 2): a JSON-null log_M is healed, never silently reset to wealth 1', () => {
  // a defect-era state whose log_M went non-finite serializes log_M to null.
  const roundTripped = JSON.parse(JSON.stringify({ M: Number.MAX_VALUE, n: 5, alphaConsumed: 0, log_M: Infinity })) as SafeHotellingState;
  assert.equal(roundTripped.log_M, null, 'precondition: JSON serializes Infinity to null');
  const cell = identityCell(2, 1e-4, 1);
  evaluateSafeHotelling({ cell, alpha: 1e-4 }, [0, 0], roundTripped);
  // null must route through healing (adopt log(M) = LOG_MAX_WEALTH), NOT
  // coerce to 0 in `null + z_t` (which silently resets wealth to ~1).
  const expected = LOG_MAX_WEALTH - cell.safe_hotelling_params!.precompiled_log_det_shrink;
  assert.ok(Math.abs(roundTripped.log_M! - expected) < 1e-9,
    `healed from the saturated view (${roundTripped.log_M}), not reset to ~0`);
  // direct helper coverage of every non-finite log_M shape:
  assert.equal(healLogWealth(null, 50, -5), Math.log(50), 'null → derive from M');
  assert.equal(healLogWealth(NaN, 50, -5), Math.log(50), 'NaN → derive from M');
  assert.equal(healLogWealth(Infinity, 1, -5), LOG_MAX_WEALTH, '+∞ → saturation point');
  assert.equal(healLogWealth(-Infinity, 1, -5), -5, '−∞ → floor');
  assert.equal(healLogWealth(null, Infinity, -5), LOG_MAX_WEALTH, 'null log with Infinity M → saturation point');
  assert.equal(healLogWealth(null, NaN, -5), -5, 'fully-corrupt state → floor');
});

test('AC-9 (cold-eye findings 3+4): the floor clamp and the e-BH >= boundary are mutant-bound', () => {
  // the floor clamp now lives in ONE place (advanceLogWealth) — bind it directly:
  const floor = Math.log(1e-12);
  assert.equal(advanceLogWealth(-5, -Infinity, floor), floor, 'log(0) factor lands on the floor, not -∞');
  assert.equal(advanceLogWealth(-25, -10, floor), floor, 'finite decay below the floor clamps');
  assert.equal(advanceLogWealth(-5, -10, floor), -15, 'in-range decay is exact');
  assert.equal(advanceLogWealth(3, NaN, floor), 3, 'NaN increment holds');
  assert.equal(advanceLogWealth(3, Infinity, floor), LOG_MAX_WEALTH, '+∞ increment pins at saturation');
  assert.ok(Number.isFinite(advanceLogWealth(LOG_MAX_WEALTH, 500, floor)), 'huge finite stays exact-finite');
  // e-BH boundary: k·e_(k) ≥ N/q must be INCLUSIVE. N=1, q=1, e=1 sits exactly
  // on the threshold: 1·1 ≥ 1. A `>` mutant selects nothing here.
  assert.equal(eBenjaminiHochberg([1], 1).K, 1, 'linear: exact-threshold input selects');
  assert.equal(eBenjaminiHochbergLog([0], 1).K, 1, 'log: exact-threshold input selects');
  // and one composite exact-boundary case: N=2, q=0.5 → N/q=4; e=(4,1) →
  // k=2: 2·1 = 2 < 4 rejects; k=1: 1·4 ≥ 4 sits ON the boundary and selects
  // exactly the first, in both domains.
  assert.deepEqual(eBenjaminiHochberg([4, 1], 0.5).selected, [0]);
  assert.deepEqual(eBenjaminiHochbergLog([Math.log(4), 0], 0.5).selected, [0]);
});
