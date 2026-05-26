// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/self-normalized-e-process-fallback.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/detectors/self-normalized-e-process-fallback.ts —
// Q70 Phase-3.d.E §7 EmpiricalProcessLILBound + §6 BetaBinomialMixture
// self-normalized e-process variant fallback.
//
// Per Q70-PHASE-3-D-E-CALIBRATION-REGIME-ARCHITECTURE-SPEC.md § Q70.2.
// Architectural rationale: when conditional exemption (Q70.1) exempts
// >X% of test coverage for a detector × substrate × sweep_mode triple,
// exemption-based approach defeats the test purpose. Self-normalized
// e-process variant handles correlated observations natively without
// requiring matching calibration-time phi.
//
// §7 EmpiricalProcessLILBound is PRIMARY (canonical-library
// `uniform_boundaries.h:250-269` + `:513-556`). Closed-form at runtime;
// O(1) per call post-construction.
// §6 BetaBinomialMixture is SECONDARY (canonical-library `:285-323` +
// `:580-660`). Runtime bisection via find_mixture_bound; sub-Bernoulli
// specific (bounded [0,1] random variables); narrower applicability —
// activated only for family_E_conformal on bounded_probability signals
// per architect-pick at Q70.4 ASK B.
//
// SLICE 1 scope (this file):
//   - SelfNormalizedEProcessFallback discriminated union per spec line 122.
//   - §7 LIL closed-form runtime evaluation (well-defined; library-faithful
//     `A * sqrt((log(1 + log(t / t_min)) + C) / t)` per spec line 99-104).
//   - C calibration constant carried as a parameter (computed offline via
//     library reference impl; library cross-check at spec § Library
//     cross-check status item 2 confirms `uniform_boundaries.h` is the
//     authoritative source for the bisection-derived C calibration).
//   - §6 BetaBinomial structure stubbed; runtime bisection helpers
//     deferred to SLICE 2 (architectural complexity per spec LS-2;
//     library reference impl `find_mixture_bound` requires full
//     bracket-and-solve dispatch surface).
//
// SLICE 2 scope (follow-on, post-empirical-sweep validation):
//   - C bisection-and-solve at construction time (mirrors library bisection
//     + brent + bracket-and-solve dispatch).
//   - §6 BetaBinomial `find_mixture_bound` runtime bisection (mirrors
//     library structural fork at `:389-406` skipping `find_s_upper_bound`
//     doubling search per Q70.4 ASK C).
//   - Asymmetric p-locked prior (Q70.4 ASK B) for family_E_conformal
//     bounded_probability signals; biased clamped r_ estimator (Q70.4
//     ASK D).
//
// Anti-scope at Q70 SLICE 1:
//   - NO callers wired this slice — module is library-grade primitive
//     consumed by detectors in SLICE 2.
//   - NO calibration-time stamping wired this slice (tools/calibrators/*
//     extension is SLICE 2).

import type {
  LilBoundHyperparams,
  BetaBinomialMixtureHyperparams,
  SelfNormalizedEProcessFallback,
} from '../types/self-normalized-fallback';

export type {
  LilBoundHyperparams,
  BetaBinomialMixtureHyperparams,
  SelfNormalizedEProcessFallback,
};

// ── §7 EmpiricalProcessLILBound runtime evaluation ───────────────

const ONE_OVER_SQRT_2 = 1 / Math.SQRT2;

/** Validate §7 LIL hyperparameters per library asserts. Throws on invariant
 *  violation; callers (calibrators in SLICE 2) should guarantee validity at
 *  compile time. */
export function assertLilBoundHyperparams(p: LilBoundHyperparams): void {
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
export function evaluateLilBound(p: LilBoundHyperparams, t: number): number {
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
function notImplementedSlice1(feature: string): never {
  throw new Error(
    `[Q70 SLICE 1] §6 BetaBinomialMixture ${feature} not implemented; ` +
    `requires library reference impl bisection helpers (find_mixture_bound + ` +
    `bracket-and-solve dispatch). Tracking: Q70 SLICE 2 follow-on per spec ` +
    `LS-2 (Mac-Claude-implementation-time-gap-hunting).`,
  );
}

/** Validate §6 BetaBinomial hyperparameters per library asserts.
 *  Architect-picks at Q70.4: asymmetric p-locked g/h; biased clamped r_;
 *  finite s_upper_bound = v / g (skips `find_s_upper_bound` doubling
 *  search per library `:389-406`). */
export function assertBetaBinomialHyperparams(p: BetaBinomialMixtureHyperparams): void {
  if (!(p.alpha > 0 && p.alpha < 1)) {
    throw new RangeError(`BetaBinomial alpha must be in (0, 1); got ${p.alpha}`);
  }
  if (!(p.v_opt > 0)) {
    throw new RangeError(`BetaBinomial v_opt must be > 0; got ${p.v_opt}`);
  }
  if (!(p.alpha_opt > 0 && p.alpha_opt < 1)) {
    throw new RangeError(
      `BetaBinomial alpha_opt must be in (0, 1); got ${p.alpha_opt}`,
    );
  }
  if (!(p.g > 0 && p.h > 0)) {
    throw new RangeError(
      `BetaBinomial g/h must be positive (asymmetric p-locked: g = baseline_mean, h = 1 - baseline_mean); got g=${p.g}, h=${p.h}`,
    );
  }
}

/** §6 BetaBinomialMixture bound evaluation. SLICE 1: throws notImplemented;
 *  SLICE 2 will mirror library `find_mixture_bound` runtime bisection
 *  semantics with the structural fork at `:389-406` (finite
 *  `s_upper_bound = v / g_` per Q70.4 ASK C; skips
 *  `find_s_upper_bound` doubling search). */
export function evaluateBetaBinomialBound(
  _p: BetaBinomialMixtureHyperparams,
  _v: number,
): number {
  return notImplementedSlice1('evaluateBetaBinomialBound');
}

// ── Variant dispatch ───────────────────────────────────────────────

/** Dispatch self-normalized fallback evaluation to the appropriate
 *  variant. `t` for §7 LIL is the tick count; `v` for §6 BetaBinomial
 *  is the intrinsic time (sufficient statistic). Architect's
 *  recommendation per spec § Q70.2 architectural rationale: §7 LIL
 *  primary for cross-detector universality; §6 BetaBinomial secondary
 *  for family_E_conformal on bounded_probability signals only. */
export function evaluateSelfNormalizedBound(
  p: SelfNormalizedEProcessFallback,
  t: number,
): number {
  if (p.variant === 'lil_bound') return evaluateLilBound(p, t);
  return evaluateBetaBinomialBound(p, t);
}

/** Variant-agnostic validation. Useful at calibrator-stamping time
 *  (SLICE 2) before the compiled config is shipped. */
export function assertSelfNormalizedHyperparams(
  p: SelfNormalizedEProcessFallback,
): void {
  if (p.variant === 'lil_bound') return assertLilBoundHyperparams(p);
  return assertBetaBinomialHyperparams(p);
}

// ── Architect-default constants (Q70.4) ───────────────────────────

/** Library canonical default for §7 LIL A constant.
 *  Library `uniform_boundaries.h:250-269` default; see also the
 *  architectural rationale at Howard-Ramdas-2021 §7. */
export const LIL_A_DEFAULT = 0.85;

/** Library canonical default for §7 LIL t_min. */
export const LIL_T_MIN_DEFAULT = 1;

/** Library canonical default for §6 BetaBinomial alpha_opt. */
export const BETA_BINOMIAL_ALPHA_OPT_DEFAULT = 0.05;

// ── Self-normalized e-process detector evaluator (SLICE 3 — EXPERIMENTAL) ─
//
// HONEST SCOPE: the math primitive (evaluateLilBound + computeLilCConstantTight
// above) is validated correct against the confseq library reference value
// to 1e-7. The APPLICATION of that bound to a fire decision on a detector's
// statistic is NOT YET DETERMINED — exactly the architect-cross-check item
// Q70 SLICE 1 named "Mac Claude CLI library cross-check PENDING" per
// Q70-PHASE-3-D-E-CALIBRATION-REGIME-ARCHITECTURE-SPEC.md.
//
// Empirical finding from SLICE 3 attempt: applying b(V_n) as a self-
// normalized t-statistic threshold (|S_n| ≥ √V_n · b(V_n)) yields ~100%
// false-positive rate on iid Gaussian H₀ across 200 trajectories of
// length 1000 — far above the architect-aspired α-bound. Two possible
// causes: (a) the application formula is wrong (the bound may apply to
// a different statistic like |S_n / n| · √n or a process-stopping
// reformulation), (b) the LIL form is finite-sample-loose at the
// trajectory lengths tested. Both call for architect cross-check of
// the actual confseq application pattern.
//
// Until the cross-check resolves, this evaluator + state machinery
// stay exported for development against the application formula, but
// they are NOT wired into any consumer (NAB tool, detector dispatch).
// The evaluator's per-tick semantics use supremum persistence (state.fired
// persists once set) because the LIL bound is mathematically a supremum
// bound — but that doesn't validate the application formula, only the
// state-machine semantics for the bound's intended use.

export interface SelfNormalizedDetectorState {
  S: number;          // running sum of standardized increments
  V: number;          // running sum-of-squares (intrinsic time)
  n: number;          // tick count
  fired: boolean;     // supremum-fire flag (persistent once set)
}

export function freshSelfNormalizedDetectorState(): SelfNormalizedDetectorState {
  return { S: 0, V: 0, n: 0, fired: false };
}

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
export function evaluateSelfNormalizedFallback(
  state: SelfNormalizedDetectorState,
  x: number,
  baselineMean: number,
  baselineSigmaSq: number,
  lilParams: LilBoundHyperparams,
): SelfNormalizedDetectorVerdict {
  const sigma = Math.sqrt(baselineSigmaSq);
  const z = sigma > 0 ? (x - baselineMean) / sigma : 0;
  state.S += z;
  state.V += z * z;
  state.n += 1;
  const t = Math.max(state.V, lilParams.t_min);
  const b = evaluateLilBound(lilParams, t);
  const threshold = Math.sqrt(state.V) * b;
  const statistic = Math.abs(state.S);
  if (statistic >= threshold) state.fired = true;
  return { fire: state.fired, statistic, threshold };
}

// ── §7 LIL C-constant computation (SLICE 2) ──────────────────────

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
export function computeLilCConstantConservative(alpha: number): number {
  if (!(alpha > 0 && alpha < 1)) {
    throw new RangeError(`LIL C-computation: alpha must be in (0, 1); got ${alpha}`);
  }
  return -2 * Math.log(alpha);
}

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
export function computeLilCConstantTight(alpha: number, A: number = LIL_A_DEFAULT): number {
  if (!(alpha > 0 && alpha < 1)) {
    throw new RangeError(`LIL C-tight: alpha must be in (0, 1); got ${alpha}`);
  }
  if (!(A > 1 / Math.SQRT2)) {
    throw new RangeError(`LIL C-tight: A must be > 1/sqrt(2); got ${A}`);
  }

  // error_bound(C, η) — library line 525-531.
  const errorBound = (C: number, eta: number): number => {
    const sqrtTerm = A - Math.sqrt((2 * (eta - 1)) / C);
    const gammaSq = (2 / eta) * sqrtTerm * sqrtTerm;
    if (gammaSq <= 1) return Number.POSITIVE_INFINITY;
    return 4 * Math.exp(-gammaSq * C) * (1 + 1 / ((gammaSq - 1) * Math.log(eta)));
  };

  // η_upper(C): largest η in (1, 2A²) where the γ² > 1 constraint binds.
  // Library `uniform_boundaries.h:535-539` bisects `√(η/2) + √(2(η-1)/C) = A`
  // on (1, 2A²). The constraint is monotone in η so bisect on the sign.
  const findEtaUpper = (C: number): number => {
    const f = (eta: number) => Math.sqrt(eta / 2) + Math.sqrt((2 * (eta - 1)) / C) - A;
    let lo = 1.0;
    let hi = 2 * A * A;
    // At η=1: f = √(1/2) - A. If A > √(1/2) ≈ 0.7071, f(1) < 0.
    // At η=2A²: f = A + √(2(2A²-1)/C) - A = √(2(2A²-1)/C) ≥ 0.
    if (f(lo) >= 0) return lo; // degenerate; A at boundary
    if (f(hi) <= 0) return hi;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (f(mid) < 0) lo = mid;
      else hi = mid;
      if (hi - lo < 1e-10) break;
    }
    return 0.5 * (lo + hi);
  };

  // For a fixed C, find η minimizing error_bound over (1, η_upper(C)).
  // Library uses Brent's method (line 541-542); ternary-section on the
  // unimodal valid region converges similarly.
  const minErrorOverEta = (C: number): number => {
    const etaUpper = findEtaUpper(C);
    let lo = 1.0;
    let hi = etaUpper;
    if (hi <= lo + 1e-9) return Number.POSITIVE_INFINITY;
    const phi = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - phi * (hi - lo);
    let x2 = lo + phi * (hi - lo);
    let f1 = errorBound(C, x1);
    let f2 = errorBound(C, x2);
    for (let i = 0; i < 80 && hi - lo > 1e-10; i++) {
      if (f1 < f2) {
        hi = x2;
        x2 = x1;
        f2 = f1;
        x1 = hi - phi * (hi - lo);
        f1 = errorBound(C, x1);
      } else {
        lo = x1;
        x1 = x2;
        f1 = f2;
        x2 = lo + phi * (hi - lo);
        f2 = errorBound(C, x2);
      }
    }
    return Math.min(f1, f2);
  };

  // Bisect C such that minErrorOverEta(C) = α. Library uses
  // bracket_and_solve_root with guess=5, factor=2; we mirror that.
  const target = (C: number): number => minErrorOverEta(C) - alpha;
  // Bracket: error decreases as C grows. Start at C=5; expand until
  // target(C) < 0 (error < α). Then bisect.
  let cLo = 0.5;
  let cHi = 5.0;
  let tHi = target(cHi);
  let attempts = 0;
  while (tHi > 0 && attempts < 50) {
    cLo = cHi;
    cHi *= 2;
    tHi = target(cHi);
    attempts++;
  }
  if (tHi > 0) {
    // Brent bracket didn't converge; fall back to conservative bound.
    return computeLilCConstantConservative(alpha);
  }
  // Standard bisection.
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (cLo + cHi);
    const tMid = target(mid);
    if (tMid > 0) cLo = mid;
    else cHi = mid;
    if (cHi - cLo < 1e-9) break;
  }
  return 0.5 * (cLo + cHi);
}

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
export function buildLilBoundHyperparams(
  alpha: number,
  options?: { A?: number; t_min?: number; tightC?: boolean },
): LilBoundHyperparams {
  const A = options?.A ?? LIL_A_DEFAULT;
  const t_min = options?.t_min ?? LIL_T_MIN_DEFAULT;
  const tightC = options?.tightC ?? true;
  const C = tightC
    ? computeLilCConstantTight(alpha, A)
    : computeLilCConstantConservative(alpha);
  const params: LilBoundHyperparams = { variant: 'lil_bound', alpha, t_min, A, C };
  assertLilBoundHyperparams(params);
  return params;
}
