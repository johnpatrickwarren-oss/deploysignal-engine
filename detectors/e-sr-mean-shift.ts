// detectors/e-sr-mean-shift.ts — ADR 0029, study 2026-09-e-sr-delay (WORKLIST C68; design
// knowledge/stats/pages/e-sr-mean-shift-design.md).
//
// An e-DETECTOR for the mean-shift class: a uniform mixture of Shiryaev–Roberts e-detectors over
// exponential baseline increments on the standardized, AR(1)-whitened residual r_t
// (Shin, Ramdas & Rinaldo 2022, "E-detectors", §2.4 Def. 2.9/2.11, §3 eq. (22), §4.1 Algorithm 1):
//
//   L_t(λ) = exp(λ·r_t − λ²/2)                 baseline increment; E[L_t | F_{t−1}] = 1 iff r_t | F_{t−1} ~ N(0,1)
//   M_t(λ) = L_t(λ) · (M_{t−1}(λ) + 1),  M_0 = 0  the SR recursion, eq. (13)
//   M_t    = (1/K) Σ_λ M_t(λ)                   the mixture, Prop. 2.3; K = 16, λ ∈ ±{0.25·12^{k/7}}
//   alarm at the first t with M_t ≥ 1/α_ARL     Thm 2.4:  E∞[N*] ≥ 1/α_ARL
//
// THE GUARANTEE is on the AVERAGE RUN LENGTH under H0, for every conditionally mean-zero
// sub-Gaussian(1) pre-change law, any changepoint, any post-change law. It is NOT an e-value:
//   E∞[M_t] = t  exactly  (a sum of t e-processes started at consecutive ticks — study H5)
// so M_t must NEVER enter e-BH or draw from the per-run α budget (the F3 category error,
// knowledge/stats/pages/e-detector.md). E_SR_MEAN_SHIFT_ENVELOPE carries statistic: 'e-detector'
// and assertValidForFdrPath refuses it by name. α_ARL is an ARL level (default 1e-3: one false
// alarm per 1,000 ticks per stream), not the per-deploy α.
//
// DELAY (Thm 4.3 with Prop. B.2, iid post-change at shift δ, D = δ²/2, V = δ²):
//   E_ν[N* − ν | N* > ν] ≤ g_α/D + V/D² + 1,  g_α ≤ inf_η [η·log(1/α) + log(1 + log_η 144)] ≈ 11.5 nats at α = 1e-3
// with NO ν in it — the single-onset Family A statistics' delay grows with the onset time
// (knowledge/stats/pages/arl-delay-2026-09-03.md); this construction's does not, which is H2.
//
// THE PREMISE: r_t must be the standardized whitened residual. With μ̂ from m calibration draws the
// null increment mean is exp(λ·ε_μ + λ²(σ²/σ̂² − 1)/2) — the κ/m estimation price, first order like
// every plug-in detector (knowledge/stats/pages/validity-premise-chain.md). The ARL claim is an
// ORACLE-parameter claim; under estimation the ARL is measured (study H4). Heavy tails (t3,
// lognormal) sit outside the sub-Gaussian class: reported, not claimed.
//
// ONSET ESTIMATE (not part of the ARL claim): a companion CUSUM recursion per λ,
// C_t(λ) = L_t(λ)·max(C_{t−1}(λ), 1); the last tick at which the argmax-λ CUSUM sat below 1 is the
// classical onset estimate. Sixteen more floats. Feeds sequencing (thesis claim 4), never the alarm.
//
// Everything is accumulated in the log domain: log M_t(λ) = log L + logaddexp(log M_{t−1}(λ), 0).
// `M` is exp(log_M) and may overflow to Infinity on an enormous fault; `log_M` never does.

import type { ValidityEnvelope } from './validity-envelope';
import { BOUND_LAMBDAS, gBounded } from '../fleet/calibration-monitor';

// ADR 0031 (study 2026-09-e-sr-bounded, WORKLIST C77) — the BOUNDED-BET increment, the heavy-tail
// fallback the design page names. Same SR recursion, same mixture, same CUSUM companion, on
//   g_λ(r) = 1 + λ·clip(r, ±B)/B,   B = BOUND_CLIP = 3,   λ ∈ BOUND_LAMBDAS = ±{0.1, 0.3, 0.6, 0.9}
// (fleet/calibration-monitor.ts, the gate's own increment). E[g_λ | F_{t−1}] = 1 whenever the CLIPPED
// residual is conditionally mean-zero — any tail, any scale error, no sub-Gaussian premise — so
// Thm 2.4 gives E∞[N*] ≥ 1/α_ARL for symmetric pre-change laws at the reference location. A skewed
// law breaks it by the clipped mean (the standardized lognormal: ≈ −0.028). The price is delay: the
// growth rate at 1.5σ is 0.344 against the Gaussian's 1.125 (Thm 4.3 floor 34.9 vs 13.0 ticks at
// α_ARL = 1e-3; protocol Amendment v1.C77). Default 'gaussian': behaviour byte-identical.

/** ±{0.25·12^{k/7} : k = 0..7} — λ_op = δ for a Gaussian increment, so the grid spans shifts of
 *  0.25σ (below the smallest registered K1 step, 0.75σ) to 3σ (the largest). Frozen with the study. */
export const E_SR_LAMBDA_GRID: readonly number[] = Object.freeze(
  Array.from({ length: 8 }, (_, k) => 0.25 * Math.pow(12, k / 7)).flatMap((l) => [l, -l]),
);

export const E_SR_DEFAULT_ALPHA_ARL = 1e-3;

/** The bounded increment's default grid: the calibration monitor's eight ±λ (ADR 0031). */
export const E_SR_BOUNDED_LAMBDA_GRID: readonly number[] = Object.freeze([...BOUND_LAMBDAS]);

export type ESrIncrement = 'gaussian' | 'bounded';

export interface ESrMeanShiftParams {
  /** ARL level: alarm threshold 1/alpha_arl; E∞[N*] ≥ 1/alpha_arl. Default 1e-3. */
  alpha_arl?: number;
  /** Increment grid; default E_SR_LAMBDA_GRID ('gaussian') or E_SR_BOUNDED_LAMBDA_GRID ('bounded').
   *  Any grid is a valid e-detector (Prop. 2.3); with 'bounded' every |λ| must be < 1. */
  lambdas?: readonly number[];
  /** 'gaussian' (default): exp(λr − λ²/2), needs a sub-Gaussian(1) residual. 'bounded': the
   *  clipped linear bet 1 + λ·clip(r, ±3)/3 — any tail, any scale error (ADR 0031). */
  increment?: ESrIncrement;
}

/** The grid a params object resolves to. */
export function eSrLambdaGrid(params: ESrMeanShiftParams = {}): readonly number[] {
  const inc = params.increment ?? 'gaussian';
  const grid = params.lambdas ?? (inc === 'bounded' ? E_SR_BOUNDED_LAMBDA_GRID : E_SR_LAMBDA_GRID);
  if (inc === 'bounded' && grid.some((l) => !(Math.abs(l) < 1))) {
    throw new Error(`e-sr-mean-shift: the bounded increment needs |lambda| < 1 on every grid point, got ${grid.join(',')}`);
  }
  return grid;
}

/** log of the baseline increment for one residual at one λ. */
function logIncrement(inc: ESrIncrement, lam: number, r: number): number {
  return inc === 'bounded' ? Math.log(gBounded(r, lam)) : lam * r - 0.5 * lam * lam;
}

export interface ESrMeanShiftState {
  /** ticks consumed. */
  t: number;
  /** log M_t(λ) per grid point; −Infinity before the first tick (M_0 = 0). */
  log_M_sr: number[];
  /** log C_t(λ) per grid point (CUSUM companion); 0 before the first tick (C_0 = 1 after the max). */
  log_C_cu: number[];
  /** last 0-indexed tick at which C(λ) sat below 1 (the CUSUM reset), per grid point; −1 = never. */
  last_reset: number[];
  /** log of the mixture M_t. −Infinity at t = 0. */
  log_M: number;
  /** running max of log_M (diagnostics only — NOT an e-value). */
  log_M_peak: number;
  /** 0-indexed tick of the first alarm, or null. */
  alarm_tick: number | null;
}

export function freshESrMeanShiftState(params: ESrMeanShiftParams = {}): ESrMeanShiftState {
  const K = eSrLambdaGrid(params).length;
  return {
    t: 0, log_M_sr: Array(K).fill(-Infinity), log_C_cu: Array(K).fill(0), last_reset: Array(K).fill(-1),
    log_M: -Infinity, log_M_peak: -Infinity, alarm_tick: null,
  };
}

export interface ESrMeanShiftResult {
  /** log of the mixture SR statistic after this tick. */
  log_M: number;
  /** exp(log_M); may be Infinity on an enormous fault. */
  M: number;
  /** log(1/alpha_arl). */
  log_threshold: number;
  /** M_t ≥ 1/alpha_arl at THIS tick. */
  fired: boolean;
  /** first-alarm semantics: true from the first alarm tick onward. */
  alarmed: boolean;
  /** classical onset estimate (0-indexed first post-change tick) from the argmax-λ CUSUM companion;
   *  null until some component has reset at least once or, before any reset, 0. */
  onset_estimate: number;
  /** the grid λ carrying the largest SR component (sign = shift direction). */
  argmax_lambda: number;
}

const logaddexp = (a: number, b: number): number => {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
};

/** Standardize one observation against a plug-in AR(1) baseline: r = ((x − μ) − φ(x_prev − μ)) / (σ·sqrt(1 − φ²)).
 *  With φ = 0 this is (x − μ)/σ. After whitening a step of δ has mean δ·sqrt((1 − φ)/(1 + φ)) in r units.
 *  `x_prev` is ignored when φ = 0; pass `null` for the first observation (treated as x_prev = μ). */
export function standardizeAr1Residual(x: number, x_prev: number | null, mu: number, sigma: number, phi = 0): number {
  if (!(sigma > 0)) throw new Error(`standardizeAr1Residual: sigma must be > 0, got ${sigma}`);
  if (!(Math.abs(phi) < 1)) throw new Error(`standardizeAr1Residual: |phi| must be < 1, got ${phi}`);
  const prev = x_prev === null ? mu : x_prev;
  return ((x - mu) - phi * (prev - mu)) / (sigma * Math.sqrt(1 - phi * phi));
}

/** One tick. `r` is the standardized whitened residual (see standardizeAr1Residual). Mutates `state`. */
export function evaluateESrMeanShift(r: number, params: ESrMeanShiftParams, state: ESrMeanShiftState): ESrMeanShiftResult {
  if (!Number.isFinite(r)) throw new Error(`evaluateESrMeanShift: r must be finite, got ${r}`);
  const alpha = params.alpha_arl ?? E_SR_DEFAULT_ALPHA_ARL;
  if (!(alpha > 0 && alpha < 1)) throw new Error(`evaluateESrMeanShift: alpha_arl must be in (0,1), got ${alpha}`);
  const inc: ESrIncrement = params.increment ?? 'gaussian';
  if (inc !== 'gaussian' && inc !== 'bounded') throw new Error(`evaluateESrMeanShift: increment must be 'gaussian' or 'bounded', got ${String(inc)}`);
  const lambdas = eSrLambdaGrid(params);
  const K = lambdas.length;
  if (state.log_M_sr.length !== K) throw new Error(`evaluateESrMeanShift: state has ${state.log_M_sr.length} components, grid has ${K}`);
  const t = state.t;
  let logSum = -Infinity, best = 0, bestLog = -Infinity;
  for (let k = 0; k < K; k++) {
    const lam = lambdas[k];
    const logL = logIncrement(inc, lam, r);
    // SR: M_t = L·(M_{t−1} + 1)
    const logM = logL + logaddexp(state.log_M_sr[k], 0);
    state.log_M_sr[k] = logM;
    logSum = logaddexp(logSum, logM);
    if (logM > bestLog) { bestLog = logM; best = k; }
    // CUSUM companion: C_t = L·max(C_{t−1}, 1); a reset happened when C_{t−1} < 1
    if (state.log_C_cu[k] < 0) state.last_reset[k] = t - 1;
    state.log_C_cu[k] = logL + Math.max(state.log_C_cu[k], 0);
  }
  const logM = logSum - Math.log(K);
  state.t = t + 1;
  state.log_M = logM;
  if (logM > state.log_M_peak) state.log_M_peak = logM;
  const log_threshold = Math.log(1 / alpha);
  const fired = logM >= log_threshold;
  if (fired && state.alarm_tick === null) state.alarm_tick = t;
  return {
    log_M: logM, M: Math.exp(logM), log_threshold, fired, alarmed: state.alarm_tick !== null,
    onset_estimate: state.last_reset[best] + 1, argmax_lambda: lambdas[best],
  };
}

/** The e-SR's envelope: statistic 'e-detector' — refused by assertValidForFdrPath by name. The
 *  baseline/autocorrelation fields describe the residual it expects (plug-in μ̂, AR(1)-whitened). */
export const E_SR_MEAN_SHIFT_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'ar1-whitened',
  null: 'mean-shift',
  variance: 'stable',
  validUnderEstimatedBaseline: false,
  statistic: 'e-detector',
  notes: 'An e-DETECTOR (Shin–Ramdas–Rinaldo 2022): E∞[M_t] = t, not ≤ 1. Its guarantee is the average '
    + 'run length E∞[N*] ≥ 1/alpha_arl at oracle parameters (study 2026-09-e-sr-delay). Never an e-value; '
    + 'never on the FDR path or the per-run α budget.',
});

/** The bounded e-SR's envelope (ADR 0031): the same 'e-detector' statistic, refused by the FDR gate
 *  by name. Its premise is a conditionally mean-zero CLIPPED residual — symmetric pre-change laws at
 *  the reference location, any tail, any scale error — not sub-Gaussianity. Registry id
 *  `e_sr_mean_shift_bounded`; certified under the e_detector class with N5/N6/N8 inside the regime
 *  (study 2026-09-e-sr-bounded). */
export const E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'ar1-whitened',
  null: 'mean-shift',
  variance: 'stable',
  validUnderEstimatedBaseline: false,
  statistic: 'e-detector',
  notes: 'An e-DETECTOR on the bounded-bet increment 1 + lambda*clip(r, +-3)/3 over +-{0.1, 0.3, 0.6, 0.9} '
    + '(ADR 0031): E_inf[M_t] = t, never an e-value, never on the FDR path or the per-run alpha budget. '
    + 'Its guarantee is E_inf[N*] >= 1/alpha_arl whenever the clipped whitened residual is conditionally '
    + 'mean-zero -- symmetric laws at any scale and any tail; a skewed law breaks it by its clipped mean. '
    + 'Delay floor at 1.5 sigma: 34.9 ticks against the Gaussian increment\'s 13.0 (Amendment v1.C77).',
});

