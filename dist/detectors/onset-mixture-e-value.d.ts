import { type IncrementKind } from './_bounded-bet';
import type { ValidityEnvelope } from './validity-envelope';
export type { IncrementKind };
/** The √E − 1 adjuster (clamped to 0 below E = 1). Maps a running-max e-process value to a valid
 *  all-times e-value. ∫_1^∞ A(e)/e² de = 1 exactly (test/onset-mixture-e-value.test.ts). Tessera
 *  tools/supfdr.ts, verbatim. */
export declare function supAdjuster(e: number): number;
/** NORMALIZED (uniform-onset) convex mixture e-value over a fixed window: mix_t = (M_t + (T−1−t)) / T
 *  — the onsets not yet started contribute the constant-1 e-process — then the running max through
 *  the √E−1 adjuster. Per-look renormalisation by T means it is NOT prefix-monotone; an always-on
 *  loop must use `geometricMixtureEValue`. Tessera tools/mixture-evalue.ts, verbatim. */
export declare function normalizedMixtureEValue(r: ReadonlyArray<number>, inc?: IncrementKind): number;
/** Geometric (Shiryaev) onset hazards for the horizon-independent mixture — a small Robbins-style
 *  grid so no single hazard scale is assumed: expected onsets ~64 / ~1k / ~16k ticks. Fixed BEFORE
 *  data; changing them invalidates cross-look comparability. */
export declare const GEO_RHOS: readonly number[];
/** GEOMETRIC onset-prior mixture e-value (Tessera 2026-07-02 audit fix for the always-on loop).
 *  Same SR-style onset mixture as normalizedMixtureEValue, but with FIXED, horizon-independent
 *  weights: onset j gets w_j = ρ(1−ρ)^{j−1} (summing to 1 over the INFINITE horizon; onsets not yet
 *  started contribute the constant-1 e-process, total tail weight (1−ρ)^t), uniformly mixed over the
 *  GEO_RHOS hazard grid. Recursion per hazard: S_t = g_t·(S_{t−1} + ρ(1−ρ)^{t−1}). PREFIX-MONOTONE,
 *  which is the property a dispatch-at-first-crossing loop needs. Tessera tools/mixture-evalue.ts,
 *  verbatim. */
export declare function geometricMixtureEValue(r: ReadonlyArray<number>, inc?: IncrementKind): number;
/** The 'gaussian' increment: exact on a genuinely N(0,1) residual; the standardising scale is a
 *  plug-in, so a 10% under-estimate moves the null increment mean from ~0.5 to ~7.6 (Tessera audit
 *  F7) and E[e|H0] grows with the horizon at fixed calibration like every plug-in wealth here. */
export declare const ONSET_MIXTURE_GAUSSIAN_ENVELOPE: Readonly<ValidityEnvelope>;
/** The 'bounded' increment: E[g_λ | F] = 1 for any conditionally mean-zero clipped residual — any
 *  tail, any standardising-scale error (Tessera test: t3 tails and a 15% scale under-estimate both
 *  hold E ≤ 1 where the Gaussian increment breaks). The surviving nuisance is the CENTRE. */
export declare const ONSET_MIXTURE_BOUNDED_ENVELOPE: Readonly<ValidityEnvelope>;
//# sourceMappingURL=onset-mixture-e-value.d.ts.map