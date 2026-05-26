import type { LilBoundHyperparams, BetaBinomialMixtureHyperparams, SelfNormalizedEProcessFallback } from '../types/self-normalized-fallback';
export type { LilBoundHyperparams, BetaBinomialMixtureHyperparams, SelfNormalizedEProcessFallback, };
/** Validate §7 LIL hyperparameters per library asserts. Throws on invariant
 *  violation; callers (calibrators in SLICE 2) should guarantee validity at
 *  compile time. */
export declare function assertLilBoundHyperparams(p: LilBoundHyperparams): void;
/** §7 EmpiricalProcessLILBound evaluation at intrinsic time `t`.
 *
 *  Closed-form (library reference impl `uniform_boundaries.h` operator()):
 *    bound(t) = A * sqrt( (log(1 + log(t / t_min)) + C) / t )
 *
 *  Asserts t >= t_min. Returns the upper-confidence boundary value
 *  (one-sided per Q70.4 ASK A architect-pick). The empirical process
 *  S_t / sqrt(V_t) crosses the bound under H₁; healthy operation stays
 *  below uniformly with crossing probability <= alpha.
 *
 *  O(1) per call post-construction.
 */
export declare function evaluateLilBound(p: LilBoundHyperparams, t: number): number;
/** Validate §6 BetaBinomial hyperparameters per library asserts.
 *  Architect-picks at Q70.4: asymmetric p-locked g/h; biased clamped r_;
 *  finite s_upper_bound = v / g (skips `find_s_upper_bound` doubling
 *  search per library `:389-406`). */
export declare function assertBetaBinomialHyperparams(p: BetaBinomialMixtureHyperparams): void;
/** §6 BetaBinomialMixture bound evaluation. SLICE 1: throws notImplemented;
 *  SLICE 2 will mirror library `find_mixture_bound` runtime bisection
 *  semantics with the structural fork at `:389-406` (finite
 *  `s_upper_bound = v / g_` per Q70.4 ASK C; skips
 *  `find_s_upper_bound` doubling search). */
export declare function evaluateBetaBinomialBound(_p: BetaBinomialMixtureHyperparams, _v: number): number;
/** Dispatch self-normalized fallback evaluation to the appropriate
 *  variant. `t` for §7 LIL is the tick count; `v` for §6 BetaBinomial
 *  is the intrinsic time (sufficient statistic). Architect's
 *  recommendation per spec § Q70.2 architectural rationale: §7 LIL
 *  primary for cross-detector universality; §6 BetaBinomial secondary
 *  for family_E_conformal on bounded_probability signals only. */
export declare function evaluateSelfNormalizedBound(p: SelfNormalizedEProcessFallback, t: number): number;
/** Variant-agnostic validation. Useful at calibrator-stamping time
 *  (SLICE 2) before the compiled config is shipped. */
export declare function assertSelfNormalizedHyperparams(p: SelfNormalizedEProcessFallback): void;
/** Library canonical default for §7 LIL A constant.
 *  Library `uniform_boundaries.h:250-269` default; see also the
 *  architectural rationale at Howard-Ramdas-2021 §7. */
export declare const LIL_A_DEFAULT = 0.85;
/** Library canonical default for §7 LIL t_min. */
export declare const LIL_T_MIN_DEFAULT = 1;
/** Library canonical default for §6 BetaBinomial alpha_opt. */
export declare const BETA_BINOMIAL_ALPHA_OPT_DEFAULT = 0.05;
/** Compute a one-sided crossing-probability-conservative C constant
 *  via the Ville-Markov upper bound on the empirical-process LIL
 *  martingale. Derivation:
 *
 *  Under H₀ the self-normalized empirical process S_t / √V_t admits an
 *  e-process M_t with M_0 = 1 and E[M_t | H₀] ≤ 1. By Ville's inequality:
 *
 *    P( sup_t M_t ≥ 1/α | H₀ ) ≤ α.
 *
 *  The LIL boundary B(t) = A √((log(1 + log(t/t_min)) + C) / t)
 *  corresponds to the e-process crossing 1/α when M_t exceeds the
 *  exponential of the bracket. Setting C = -2 · log(α) gives the
 *  one-sided Markov-conservative crossing-probability ≤ α.
 *
 *  This is the SLICE 2 v0.1 closed-form C. The library reference impl
 *  uses Brent's-method bisection on the EXACT crossing-probability
 *  integral over [t_min, ∞), producing a slightly tighter C (and
 *  correspondingly slightly tighter detection envelope). The Markov-
 *  conservative form is FP-control-safe — it overstates C marginally,
 *  yielding a slightly wider envelope. Tightening to the library-exact
 *  form is SLICE 3 follow-on.
 *
 *  Properties:
 *  - Monotone increasing in -log(α): smaller α → larger C → wider bound
 *  - Independent of A and t_min in this conservative form (library-tight
 *    form is jointly determined by all three; the conservatism increases
 *    as A or t_min deviate from canonical defaults)
 *
 *  Asserts α in (0, 1) per the boundary's domain. */
export declare function computeLilCConstantConservative(alpha: number): number;
/** Construct §7 LIL hyperparameters with sensible defaults +
 *  Markov-conservative C. The typical calibrator-side use:
 *
 *    const lil = buildLilBoundHyperparams(1e-4);  // α = 1e-4
 *    // → { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 }
 *
 *  Calibrators may override A, t_min if specific signal-class evidence
 *  exists; defaults match library canonical values per Q70.4 ASKs. */
export declare function buildLilBoundHyperparams(alpha: number, options?: {
    A?: number;
    t_min?: number;
}): LilBoundHyperparams;
//# sourceMappingURL=self-normalized-e-process-fallback.d.ts.map