"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/self-normalized-e-process-fallback.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.BETA_BINOMIAL_ALPHA_OPT_DEFAULT = exports.LIL_T_MIN_DEFAULT = exports.LIL_A_DEFAULT = void 0;
exports.assertLilBoundHyperparams = assertLilBoundHyperparams;
exports.evaluateLilBound = evaluateLilBound;
exports.assertBetaBinomialHyperparams = assertBetaBinomialHyperparams;
exports.evaluateBetaBinomialBound = evaluateBetaBinomialBound;
exports.evaluateSelfNormalizedBound = evaluateSelfNormalizedBound;
exports.assertSelfNormalizedHyperparams = assertSelfNormalizedHyperparams;
// ── §7 EmpiricalProcessLILBound runtime evaluation ───────────────
const ONE_OVER_SQRT_2 = 1 / Math.SQRT2;
/** Validate §7 LIL hyperparameters per library asserts. Throws on invariant
 *  violation; callers (calibrators in SLICE 2) should guarantee validity at
 *  compile time. */
function assertLilBoundHyperparams(p) {
    if (!(p.alpha > 0 && p.alpha < 1)) {
        throw new RangeError(`LIL alpha must be in (0, 1); got ${p.alpha}`);
    }
    if (!(p.t_min >= 1)) {
        throw new RangeError(`LIL t_min must be >= 1; got ${p.t_min}`);
    }
    if (!(p.A > ONE_OVER_SQRT_2)) {
        throw new RangeError(`LIL A must be > 1/sqrt(2) ≈ 0.7071; got ${p.A}`);
    }
    if (!Number.isFinite(p.C)) {
        throw new RangeError(`LIL C must be finite; got ${p.C}`);
    }
}
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
function evaluateLilBound(p, t) {
    if (!(t >= p.t_min)) {
        throw new RangeError(`LIL bound: t (${t}) must be >= t_min (${p.t_min})`);
    }
    const logTerm = Math.log(1 + Math.log(t / p.t_min));
    return p.A * Math.sqrt((logTerm + p.C) / t);
}
// ── §6 BetaBinomialMixture runtime evaluation (SLICE 2 stub) ────
/** Marker for §6 features that are SLICE 1 stubbed. Throws with a
 *  clear pointer so accidental wire-ups surface immediately during
 *  development. */
function notImplementedSlice1(feature) {
    throw new Error(`[Q70 SLICE 1] §6 BetaBinomialMixture ${feature} not implemented; ` +
        `requires library reference impl bisection helpers (find_mixture_bound + ` +
        `bracket-and-solve dispatch). Tracking: Q70 SLICE 2 follow-on per spec ` +
        `LS-2 (Mac-Claude-implementation-time-gap-hunting).`);
}
/** Validate §6 BetaBinomial hyperparameters per library asserts.
 *  Architect-picks at Q70.4: asymmetric p-locked g/h; biased clamped r_;
 *  finite s_upper_bound = v / g (skips `find_s_upper_bound` doubling
 *  search per library `:389-406`). */
function assertBetaBinomialHyperparams(p) {
    if (!(p.alpha > 0 && p.alpha < 1)) {
        throw new RangeError(`BetaBinomial alpha must be in (0, 1); got ${p.alpha}`);
    }
    if (!(p.v_opt > 0)) {
        throw new RangeError(`BetaBinomial v_opt must be > 0; got ${p.v_opt}`);
    }
    if (!(p.alpha_opt > 0 && p.alpha_opt < 1)) {
        throw new RangeError(`BetaBinomial alpha_opt must be in (0, 1); got ${p.alpha_opt}`);
    }
    if (!(p.g > 0 && p.h > 0)) {
        throw new RangeError(`BetaBinomial g/h must be positive (asymmetric p-locked: g = baseline_mean, h = 1 - baseline_mean); got g=${p.g}, h=${p.h}`);
    }
}
/** §6 BetaBinomialMixture bound evaluation. SLICE 1: throws notImplemented;
 *  SLICE 2 will mirror library `find_mixture_bound` runtime bisection
 *  semantics with the structural fork at `:389-406` (finite
 *  `s_upper_bound = v / g_` per Q70.4 ASK C; skips
 *  `find_s_upper_bound` doubling search). */
function evaluateBetaBinomialBound(_p, _v) {
    return notImplementedSlice1('evaluateBetaBinomialBound');
}
// ── Variant dispatch ───────────────────────────────────────────────
/** Dispatch self-normalized fallback evaluation to the appropriate
 *  variant. `t` for §7 LIL is the tick count; `v` for §6 BetaBinomial
 *  is the intrinsic time (sufficient statistic). Architect's
 *  recommendation per spec § Q70.2 architectural rationale: §7 LIL
 *  primary for cross-detector universality; §6 BetaBinomial secondary
 *  for family_E_conformal on bounded_probability signals only. */
function evaluateSelfNormalizedBound(p, t) {
    if (p.variant === 'lil_bound')
        return evaluateLilBound(p, t);
    return evaluateBetaBinomialBound(p, t);
}
/** Variant-agnostic validation. Useful at calibrator-stamping time
 *  (SLICE 2) before the compiled config is shipped. */
function assertSelfNormalizedHyperparams(p) {
    if (p.variant === 'lil_bound')
        return assertLilBoundHyperparams(p);
    return assertBetaBinomialHyperparams(p);
}
// ── Architect-default constants (Q70.4) ───────────────────────────
/** Library canonical default for §7 LIL A constant.
 *  Library `uniform_boundaries.h:250-269` default; see also the
 *  architectural rationale at Howard-Ramdas-2021 §7. */
exports.LIL_A_DEFAULT = 0.85;
/** Library canonical default for §7 LIL t_min. */
exports.LIL_T_MIN_DEFAULT = 1;
/** Library canonical default for §6 BetaBinomial alpha_opt. */
exports.BETA_BINOMIAL_ALPHA_OPT_DEFAULT = 0.05;
//# sourceMappingURL=self-normalized-e-process-fallback.js.map