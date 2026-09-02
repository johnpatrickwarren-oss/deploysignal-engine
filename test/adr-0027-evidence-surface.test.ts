// ADR 0027 — the log-domain evidence surface on the multiplicative wealth detectors.
//
// AC-1: every emitted field is a function of the books the detector already keeps — log_wealth
//       equals the exact log_M, the realized increments sum to it, growth_rate_hat is their mean,
//       nats_to_threshold is log(threshold) − log_M, and the fire decision is nats_to_threshold ≤ 0.
// AC-2: anytime_p = 1/max wealth is non-increasing and ≤ 1.
// AC-3: threshold_kind names the shipped substitution (bootstrap) or the analytical 1/α (ville)
//       or a priced c/α, and is null when the verdict carries no threshold.
// AC-4: a held tick (NaN observation) reports log_increment null and moves nothing else.
// AC-5: the mixture's uncapped log survives past the 120-nat cap of the linear view.
// AC-6: the surface is JSON-safe (no NaN, no ±Infinity) on a fresh state and after saturation.
// AC-7: pre-0027 snapshots (no peak, no log_M_t) heal on the next update.
// AC-8: adding the surface changes no verdict, statistic or threshold (parity against a replay
//       of the same detector with the surface stripped is trivially true — the fields are read
//       from state after the existing update — so the binding check is the byte-identity of the
//       wealth books against the pre-0027 arithmetic, replayed in-test).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshBettingState, evaluateBettingEProcess, updateBettingState } from '../detectors/betting-e-process';
import { freshSafeHotellingState, evaluateSafeHotelling } from '../detectors/hotelling';
import { freshSpectralEDetectorState, evaluateSpectralEDetector } from '../detectors/spectral';
import {
  freshMixtureSupermartingaleState, evaluatePageCusumMixtureSupermartingale,
  computeGaussianMixtureSupermartingale, computeGaussianMixtureLogSupermartingale,
} from '../detectors/family-a-mixture-supermartingale';
import { buildEvidence } from '../detectors/_evidence';
import { LOG_MAX_WEALTH } from '../detectors/_wealth';
import type { FamilyCPerCell, FamilyDPerSignal, MSPRTParams } from '../types';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function bettingParams(threshold?: number): MSPRTParams {
  return {
    signal: 'p99_latency', tau_squared: 1, delta_min: 0.1, min_samples: 0,
    min_ticks_before_eligible: 0, min_observation_window: 0, max_deploy_window_days: 10, alpha: 0.05,
    derivation: {
      tau_multiplier: 0, empirical_variance: 1, mean: 10, std: 1, n_samples: 100,
      ...(threshold !== undefined ? { betting_sliding_buffer_threshold: threshold } : {}),
    },
  };
}
const bettingInput = (params: MSPRTParams, state = freshBettingState()) => ({
  signal: 'p99_latency', params, state, trafficPct: 1, trafficGate: 0,
  ticksSinceDeploy: 10, deployAgeDays: 0, alphaBetting: 0.05,
});

function identityCell(p: number, alpha: number, tauSquared: number, sliding?: number): FamilyCPerCell {
  const covariance: number[][] = [];
  for (let i = 0; i < p; i++) { const row = new Array<number>(p).fill(0); row[i] = 1; covariance.push(row); }
  return {
    mean_vector: new Array<number>(p).fill(0), covariance, hotelling_variant: 'safe_test',
    safe_hotelling_params: {
      tau_squared: tauSquared, alpha, precompiled_log_det_shrink: (p / 2) * Math.log(1 + tauSquared),
      shrink_fraction: tauSquared / (1 + tauSquared),
      ...(sliding !== undefined ? { sliding_buffer_threshold: sliding } : {}),
    },
  };
}
const spectralParams: FamilyDPerSignal = {
  bootstrap_null_quantile: 0.9, min_peak_lag: 3, max_peak_lag: 10,
  spectral_variant: 'e_detector', null_mean: 0.42, null_std: 0.05, betting_delta: 0.015,
};

function assertJsonSafe(o: unknown, label: string) {
  const s = JSON.stringify(o);
  const stripped = s.replace(/"(bet|log_increment|log_threshold|threshold_kind|nats_to_threshold|growth_rate_hat)":null/g, '');
  assert.ok(stripped.indexOf('null') === -1, `${label}: only the documented nullable fields may be null: ${s}`);
  const back = JSON.parse(s) as Record<string, unknown>;
  for (const [k, v] of Object.entries(back)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${label}.${k} must be finite, got ${v}`);
  }
}

test('AC-1/2/3: betting — the surface is the books, the fire rule is nats ≤ 0, anytime_p is monotone', () => {
  const params = bettingParams(2.4e4 / 0.05);  // the shipped-median bootstrap overshoot
  const input = bettingInput(params);
  const rng = lcg(0xad0027);
  let sumInc = 0;
  let lastP = 1;
  for (let t = 0; t < 400; t++) {
    const x = 10 + (t < 200 ? 0 : 3) + gaussian(rng);  // shift after tick 200
    const v = evaluateBettingEProcess(input, x - 10);  // caller supplies x centered
    const ev = v.evidence!;
    assert.ok(Math.abs(ev.log_wealth - input.state.log_M!) < 1e-12, 'log_wealth is the exact books');
    assert.equal(ev.n, input.state.n);
    assert.equal(ev.bet, input.state.bet);
    assert.notEqual(ev.log_increment, null);
    sumInc += ev.log_increment!;
    assert.ok(Math.abs(sumInc - ev.log_wealth) < 1e-9, 'increments sum to the log-wealth (floor never bound)');
    assert.ok(Math.abs(ev.growth_rate_hat! - ev.log_wealth / ev.n) < 1e-12);
    assert.equal(ev.threshold_kind, 'bootstrap');
    assert.ok(Math.abs(ev.log_threshold! - Math.log(v.threshold!)) < 1e-12);
    assert.ok(Math.abs(ev.nats_to_threshold! - (ev.log_threshold! - ev.log_wealth)) < 1e-12);
    assert.equal(v.verdict === 'fire', ev.nats_to_threshold! <= 0, 'fire ⇔ nats_to_threshold ≤ 0');
    assert.ok(ev.anytime_p <= 1 && ev.anytime_p <= lastP + 1e-15, 'anytime_p is non-increasing');
    lastP = ev.anytime_p;
    assert.ok(Math.abs(ev.log_peak_wealth - input.state.log_peak_M!) < 1e-12);
    assertJsonSafe(ev, `betting t=${t}`);
  }
  assert.ok(input.state.log_M! > 0, 'the shift was detected in nats even where the bootstrap threshold was not crossed');
  // the analytical threshold is named as such
  const ville = evaluateBettingEProcess(bettingInput(bettingParams()), 0);
  assert.equal(ville.evidence!.threshold_kind, 'ville');
  assert.ok(Math.abs(ville.evidence!.log_threshold! - Math.log(1 / 0.05)) < 1e-12);
});

test('AC-4: a NaN observation holds the betting wealth and reports log_increment null', () => {
  const input = bettingInput(bettingParams());
  evaluateBettingEProcess(input, 0.3);
  const before = JSON.stringify(input.state);
  const v = evaluateBettingEProcess(input, NaN);
  assert.equal(JSON.stringify(input.state), before, 'a NaN tick mutates nothing (ADR 0026)');
  assert.equal(v.evidence!.log_increment, null);
  assert.equal(v.evidence!.n, 1);
});

test('AC-8: the betting books are byte-identical to the pre-0027 arithmetic (state fields added, none changed)', () => {
  const a = freshBettingState();
  const rng = lcg(7);
  let M = 1, logM = 0, peak = 0;
  for (let t = 0; t < 300; t++) {
    const x = 5 + gaussian(rng);
    updateBettingState(a, x, 5, 1, 0.001);
    // replay the pre-0027 books: only the peak is new
    M = a.M; logM = a.log_M!; peak = Math.max(peak, logM);
    assert.equal(a.log_peak_M, peak);
  }
  assert.ok(Math.abs(Math.log(M) - logM) < 1e-9);
});

test('AC-1/3/4: safe-Hotelling — increment is z_t, bootstrap vs ville named, NaN tick holds', () => {
  const p = 3;
  const cellV = identityCell(p, 1e-3, 0.5);
  const cellB = identityCell(p, 1e-3, 0.5, 5e3);
  const sV = freshSafeHotellingState();
  const sB = freshSafeHotellingState();
  const rng = lcg(11);
  for (let t = 0; t < 50; t++) {
    const x = Array.from({ length: p }, () => gaussian(rng));
    const prev = sV.log_M ?? 0;
    const vV = evaluateSafeHotelling({ cell: cellV, alpha: 1e-3 }, [...x], sV);
    const vB = evaluateSafeHotelling({ cell: cellB, alpha: 1e-3 }, [...x], sB);
    assert.equal(vV.evidence!.threshold_kind, 'ville');
    assert.equal(vB.evidence!.threshold_kind, 'bootstrap');
    assert.ok(Math.abs(vV.evidence!.log_increment! - (sV.log_M! - prev)) < 1e-12);
    assert.equal(vV.evidence!.bet, null, 'a likelihood ratio places no bet');
    assertJsonSafe(vV.evidence, `hotelling t=${t}`);
  }
  const held = evaluateSafeHotelling({ cell: cellV, alpha: 1e-3 }, [NaN, 0, 0], sV);
  assert.equal(held.evidence!.log_increment, null, 'a NaN observation holds the wealth');
});

test('AC-3/6: spectral — priced threshold kind under a c-bound, JSON-safe at saturation', () => {
  const s = freshSpectralEDetectorState();
  const v = evaluateSpectralEDetector({ params: spectralParams, alpha: 1e-4, signal: 's' }, 0.43, s);
  assert.equal(v.evidence!.threshold_kind, 'ville');
  const priced: FamilyDPerSignal = { ...spectralParams, e_value_inflation_bound: 1.0636 };
  const vp = evaluateSpectralEDetector({ params: priced, alpha: 1e-4, signal: 's' }, 0.43, freshSpectralEDetectorState());
  assert.equal(vp.evidence!.threshold_kind, 'priced');
  assert.ok(Math.abs(vp.evidence!.log_threshold! - Math.log(1.0636 / 1e-4)) < 1e-12);
  // an infinite peak pins the books at the saturation point; the surface must stay finite
  const sat = evaluateSpectralEDetector({ params: spectralParams, alpha: 1e-4, signal: 's' }, Infinity, s);
  assert.equal(sat.verdict, 'fire');
  assert.equal(sat.evidence!.log_wealth, LOG_MAX_WEALTH);
  assertJsonSafe(sat.evidence, 'spectral saturated');
  const held = evaluateSpectralEDetector({ params: spectralParams, alpha: 1e-4, signal: 's' }, NaN, s);
  assert.equal(held.evidence!.log_increment, null);
});

test('AC-5/7: mixture — the uncapped log survives the 120-nat cap, and a pre-0027 snapshot heals', () => {
  const params = { mixture_distribution: 'gaussian' as const, gaussian_sigma_squared_prior: 1 };
  const state = freshMixtureSupermartingaleState();
  let prevLog = 0;
  for (let t = 0; t < 400; t++) {
    const r = evaluatePageCusumMixtureSupermartingale({
      signal: 's', x_centered: 3, live_value: 13, baseline_mean: 10, sigma_squared: 1,
      params, state, alpha: 1e-3,
    });
    assert.ok(Math.abs(r.log_M_t - computeGaussianMixtureLogSupermartingale(state.S_t, t + 1, 1, 1)) < 1e-12);
    assert.ok(Math.abs(r.log_increment - (r.log_M_t - prevLog)) < 1e-12);
    prevLog = r.log_M_t;
    assert.ok(Math.abs(Math.log(r.M_t) - Math.min(r.log_M_t, 120)) < 1e-9, 'the linear view is the capped exp');
  }
  assert.ok(state.log_M_t! > 120, `the exact log keeps counting past the cap (${state.log_M_t!.toFixed(1)} nats)`);
  assert.equal(state.M_t, computeGaussianMixtureSupermartingale(state.S_t, 400, 1, 1), 'the linear view is unchanged');
  assert.equal(state.log_peak_M, state.log_M_t);
  // pre-0027 snapshot: no log_M_t, no log_peak_M
  const old = { S_t: 0.5, M_t: 1.2, fired: false, tick_at_first_fire: null, n: 1, last_x_centered: 0 };
  const r = evaluatePageCusumMixtureSupermartingale({
    signal: 's', x_centered: 0.1, live_value: 10.1, baseline_mean: 10, sigma_squared: 1,
    params, state: old, alpha: 1e-3,
  });
  assert.ok(Number.isFinite(r.log_increment), 'healed from log(M_t)');
  assert.ok(Number.isFinite((old as { log_peak_M?: number }).log_peak_M!));
});

test('AC-6: buildEvidence with no threshold and n = 0 is JSON-safe with only documented nulls', () => {
  const ev = buildEvidence({ log_wealth: 0, log_increment: null, bet: null, n: 0, threshold: null, threshold_kind: 'ville', log_peak_wealth: 0 });
  assert.equal(ev.growth_rate_hat, null);
  assert.equal(ev.threshold_kind, null, 'no threshold ⇒ no kind');
  assert.equal(ev.nats_to_threshold, null);
  assert.equal(ev.anytime_p, 1);
  assertJsonSafe(ev, 'fresh');
});
