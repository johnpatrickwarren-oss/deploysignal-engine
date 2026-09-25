// detectors/onset-mixture-e-value.ts — the SR-style convex onset-mixture e-value: the per-shard
// e-VALUE object Tessera feeds to fleet e-BH (Tessera ADR 0019), promoted to the engine under the
// engine/consumer charter (ADR 0034, 2026-09-24).
//
// Ported line for line from Tessera's tools/mixture-evalue.ts (`normalizedMixtureEValue`,
// `geometricMixtureEValue`, `GEO_RHOS`) and tools/supfdr.ts (`supAdjuster`); test/onset-mixture-
// e-value.test.ts holds the port in lockstep against Tessera's compiled tools while Tessera still
// carries an independent copy, and carries Tessera's property tests.
//
// WHY THIS EXISTS (Tessera ADR 0019). The e-detector's running statistic M^SR_t = Σ_{j≤t} Λ^(j)_t is
// a SUM of t per-onset e-processes, so E[M^SR_t | H0] ≈ t — it is NOT an e-value, and feeding its
// running max to e-BH over-selects (measured FDP 0.50 / 0.72 at q = 0.1; the √E−1 SupFDR adjuster
// cannot rescue it because the adjuster assumes a genuine e-process). The fix is a CONVEX onset
// mixture (weights summing to 1): a convex combination of e-processes IS an e-process
// (E[·|H0] ≤ 1), so its running max → √E−1 adjuster → a valid all-times e-value for e-BH.
//
// Increments (detectors/_bounded-bet.ts): 'gaussian' g(r) = mean_λ exp(λr − λ²/2) over λ ∈ ±{0.5,1,2},
// capped — each term is an e-value under N(0,1); 'bounded' g_λ(r) = 1 + λ·clip(r, ±3)/3 — exactly
// mean-one for any conditionally mean-zero clipped residual (any tail, any scale error). The
// residual fed in is the baseline-standardised per-shard residual.
//
// VALIDITY IS BY CONSTRUCTION ON A VALID NULL, and the envelope says so: the construction does not
// certify that the residual's null holds. Under a plug-in baseline the same n ≫ m price applies as
// to every plug-in wealth in this library (validity-envelope.ts).

import { gInc, gBounded, BOUND_LAMBDAS, type IncrementKind } from './_bounded-bet';
import type { ValidityEnvelope } from './validity-envelope';

export type { IncrementKind };

/** The √E − 1 adjuster (clamped to 0 below E = 1). Maps a running-max e-process value to a valid
 *  all-times e-value. ∫_1^∞ A(e)/e² de = 1 exactly (test/onset-mixture-e-value.test.ts). Tessera
 *  tools/supfdr.ts, verbatim. */
export function supAdjuster(e: number): number {
  return e > 1 ? Math.sqrt(e) - 1 : 0;
}

/** NORMALIZED (uniform-onset) convex mixture e-value over a fixed window: mix_t = (M_t + (T−1−t)) / T
 *  — the onsets not yet started contribute the constant-1 e-process — then the running max through
 *  the √E−1 adjuster. Per-look renormalisation by T means it is NOT prefix-monotone; an always-on
 *  loop must use `geometricMixtureEValue`. Tessera tools/mixture-evalue.ts, verbatim. */
export function normalizedMixtureEValue(r: ReadonlyArray<number>, inc: IncrementKind = 'gaussian'): number {
  const T = r.length;
  if (T === 0) return 0;
  if (inc === 'gaussian') {
    let M = 0, mixPeak = 0;
    for (let t = 0; t < T; t++) {
      M = (1 + M) * gInc(r[t]);
      if (!isFinite(M)) M = Number.MAX_VALUE;
      const mix = (M + (T - 1 - t)) / T; // convex onset-mixture e-process value at t
      if (mix > mixPeak) mixPeak = mix;
    }
    return supAdjuster(mixPeak);
  }
  // 'bounded': one SR recursion per λ (linear bets mix at the CAPITAL level — see gBounded's header);
  // the per-λ onset mixtures are averaged (a convex combination of e-processes is an e-process).
  const K = BOUND_LAMBDAS.length;
  const M = new Array<number>(K).fill(0);
  let mixPeak = 0;
  for (let t = 0; t < T; t++) {
    let mix = 0;
    for (let k = 0; k < K; k++) {
      M[k] = (1 + M[k]) * gBounded(r[t], BOUND_LAMBDAS[k]);
      if (!isFinite(M[k])) M[k] = Number.MAX_VALUE;
      mix += (M[k] + (T - 1 - t)) / T;
    }
    mix /= K;
    if (mix > mixPeak) mixPeak = mix;
  }
  return supAdjuster(mixPeak);
}

/** Geometric (Shiryaev) onset hazards for the horizon-independent mixture — a small Robbins-style
 *  grid so no single hazard scale is assumed: expected onsets ~64 / ~1k / ~16k ticks. Fixed BEFORE
 *  data; changing them invalidates cross-look comparability. */
export const GEO_RHOS: readonly number[] = Object.freeze([1 / 64, 1 / 1024, 1 / 16384]);

/** GEOMETRIC onset-prior mixture e-value (Tessera 2026-07-02 audit fix for the always-on loop).
 *  Same SR-style onset mixture as normalizedMixtureEValue, but with FIXED, horizon-independent
 *  weights: onset j gets w_j = ρ(1−ρ)^{j−1} (summing to 1 over the INFINITE horizon; onsets not yet
 *  started contribute the constant-1 e-process, total tail weight (1−ρ)^t), uniformly mixed over the
 *  GEO_RHOS hazard grid. Recursion per hazard: S_t = g_t·(S_{t−1} + ρ(1−ρ)^{t−1}). PREFIX-MONOTONE,
 *  which is the property a dispatch-at-first-crossing loop needs. Tessera tools/mixture-evalue.ts,
 *  verbatim. */
export function geometricMixtureEValue(r: ReadonlyArray<number>, inc: IncrementKind = 'gaussian'): number {
  if (r.length === 0) return 0;
  const lams = inc === 'gaussian' ? [0] : BOUND_LAMBDAS; // gaussian: one per-tick-mixed increment
  const L = lams.length, K = GEO_RHOS.length;
  const S: number[][] = Array.from({ length: L }, () => new Array<number>(K).fill(0));
  const w = GEO_RHOS.map((rho) => rho);        // w_t = ρ(1−ρ)^{t−1}, updated each tick
  const tail = new Array<number>(K).fill(1);   // (1−ρ)^t — weight of not-yet-started onsets
  let mixPeak = 0;
  for (let t = 0; t < r.length; t++) {
    let mix = 0;
    for (let l = 0; l < L; l++) {
      const g = inc === 'gaussian' ? gInc(r[t]) : gBounded(r[t], lams[l]);
      for (let k = 0; k < K; k++) {
        S[l][k] = g * (S[l][k] + w[k]);
        if (!isFinite(S[l][k])) S[l][k] = Number.MAX_VALUE;
        mix += S[l][k] + tail[k];
      }
    }
    for (let k = 0; k < K; k++) { w[k] *= 1 - GEO_RHOS[k]; tail[k] *= 1 - GEO_RHOS[k]; }
    mix /= L * K;
    if (mix > mixPeak) mixPeak = mix;
  }
  return supAdjuster(mixPeak);
}

// ── Validity envelopes (ADR 0034) ──────────────────────────────────────────────────────────────

/** The 'gaussian' increment: exact on a genuinely N(0,1) residual; the standardising scale is a
 *  plug-in, so a 10% under-estimate moves the null increment mean from ~0.5 to ~7.6 (Tessera audit
 *  F7) and E[e|H0] grows with the horizon at fixed calibration like every plug-in wealth here. */
export const ONSET_MIXTURE_GAUSSIAN_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'iid',
  null: 'mean-shift',
  variance: 'stable',
  validUnderEstimatedBaseline: false,
  statistic: 'e-value',
  notes: 'Convex onset mixture of SR e-processes with Gaussian-LR increments, √E−1 adjusted: an e-value by '
    + 'construction on a valid N(0,1) residual (Tessera ADR 0019: Mode B FDP 0.099 ≤ q = 0.1 on the '
    + 'spatial null; the raw SR sum it replaced measured FDP 0.50 / 0.72). Assumes the residual is '
    + 'already whitened and standardised; does not certify the null. Plug-in centre and scale: valid '
    + 'only with a TRUE baseline or m ≫ n.',
});

/** The 'bounded' increment: E[g_λ | F] = 1 for any conditionally mean-zero CLIPPED residual — any
 *  symmetric tail, any standardising-scale error (Tessera test: t3 tails and a 15% scale
 *  under-estimate both hold E ≤ 1 where the Gaussian increment breaks). A mean-zero raw residual
 *  with a skewed tail is NOT clip-mean-zero: clipping at ±3 removes mass from the long side, and
 *  the wealths betting against the skew then have E[g_λ] > 1 (h0-battery Amendment A6,
 *  inc-20260925T044059Z: lognormal σ = 0.75 gives 1.0009 to 1.0083 for λ = −0.1 to −0.9). The
 *  surviving nuisances are the CENTRE and the clip-mean. */
export const ONSET_MIXTURE_BOUNDED_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'iid',
  null: 'mean-shift',
  variance: 'robust',
  validUnderEstimatedBaseline: false,
  statistic: 'e-value',
  notes: 'Convex onset mixture of SR e-processes with linear bounded bets (clip 3, eight ±λ), √E−1 adjusted: '
    + 'mean-one increments for any mean-zero CLIPPED residual — any symmetric tail, any scale error (Tessera '
    + 'ADR 0019 W1; property tests; engine H0 battery A6: 1.0000 at every λ on N(0,1) and t3). A skewed tail '
    + 'is not clip-mean-zero: the wealths betting against the skew have E[g_λ] > 1 (A6: 1.0009–1.0083 on a '
    + 'σ = 0.75 lognormal) and the mixed capital grows with the horizon. The plug-in CENTRE remains: valid '
    + 'only with a TRUE baseline or m ≫ n.',
});
