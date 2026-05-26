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
export interface SelfNormalizedDetectorState {
    S: number;
    V: number;
    n: number;
    fired: boolean;
}
export declare function freshSelfNormalizedDetectorState(): SelfNormalizedDetectorState;
export interface SelfNormalizedDetectorVerdict {
    fire: boolean;
    /** |S_n| (running cumulative sum of standardized increments). */
    statistic: number;
    /** Application-formula threshold (PRELIMINARY: √V_n · b(V_n);
     *  application formula gated on architect cross-check). */
    threshold: number;
}
/** Evaluate one tick of the self-normalized e-process fallback.
 *  EXPERIMENTAL — see file-header comment on application-formula
 *  uncertainty. Pure function in `state` shape: mutates state in place. */
export declare function evaluateSelfNormalizedFallback(state: SelfNormalizedDetectorState, x: number, baselineMean: number, baselineSigmaSq: number, lilParams: LilBoundHyperparams): SelfNormalizedDetectorVerdict;
/** Compute a one-sided crossing-probability-conservative C constant
 *  via the Ville-Markov upper bound. Setting C = -2 · log(α) preserves
 *  FP control under the standard Ville inequality but is LOOSER than
 *  the library's tight bisection by an O(1) factor.
 *
 *  REVERSE-VALIDATED against confseq library test value (uniform_
 *  boundaries_unittest.cpp:72-74; α=0.05, t_min=100, A=0.85, t=1000;
 *  library bound = 0.08204769 → library C ≈ 8.115; this form C ≈ 5.991).
 *  The library's C is LARGER → wider bound → fewer false fires. SLICE 3
 *  ships `computeLilCConstantTight` below; this conservative form is
 *  retained for fallback when bisection fails to converge. */
export declare function computeLilCConstantConservative(alpha: number): number;
/** Library-tight C constant via the same bisection scheme as
 *  `EmpiricalProcessLILBound::find_optimal_C` in confseq
 *  `uniform_boundaries.h:521-556`. Port of:
 *
 *    γ² = (2/η) · (A - √(2(η-1)/C))²
 *    if γ² ≤ 1: error_bound = ∞
 *    else: error_bound = 4 · exp(-γ²·C) · (1 + 1/((γ²-1)·log(η)))
 *
 *  We:
 *    1. For each candidate C, find η ∈ [1, 2A²] that minimizes error_bound
 *       (Brent's-method-style golden-section + parabolic interpolation; TS
 *       impl uses ternary-search-on-unimodal-region which converges for
 *       this error_bound's shape per HR2021 §7).
 *    2. Bisect C such that min_η error_bound(C, η) = α.
 *
 *  Validated against confseq unit test value: at α=0.05, t_min=100, A=0.85,
 *  t=1000, the closed-form bound returns 0.0820 ± 1e-4. */
export declare function computeLilCConstantTight(alpha: number, A?: number): number;
/** Construct §7 LIL hyperparameters with library-tight C bisection
 *  (default; matches confseq `find_optimal_C` semantics). Pass
 *  `tightC: false` to use the Markov-conservative form (faster
 *  construction; FP-control-safe but slightly wider envelope).
 *
 *    const lil = buildLilBoundHyperparams(1e-4);  // tight C bisection
 *    // → { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: ≈8.5 }
 *
 *  Calibrators may override A, t_min if specific signal-class evidence
 *  exists; defaults match library canonical values per Q70.4 ASKs. */
export declare function buildLilBoundHyperparams(alpha: number, options?: {
    A?: number;
    t_min?: number;
    tightC?: boolean;
}): LilBoundHyperparams;
//# sourceMappingURL=self-normalized-e-process-fallback.d.ts.map