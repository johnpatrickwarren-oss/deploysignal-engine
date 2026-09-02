"use strict";
// engine/detectors/_hotelling-safe.ts — Family C safe-Hotelling e-process.
//
// Split out of `hotelling.ts` (god-file decomposition). Internals moved
// VERBATIM; `hotelling.ts` re-exports `freshSafeHotellingState` and
// `evaluateSafeHotelling` so the public import surface is unchanged.
//
// ── Addition #20 — safe-Hotelling e-process (ARCHITECT-REPLY-43) ──────
//
// Mixture-prior growth-optimal e-test for the composite-Gaussian-mean
// null, per Grünwald-de Heide-Koolen 2024. Co-ships alongside the
// legacy chi_square variant; selection by `cell.hotelling_variant`.
// Wealth update `M_t = M_{t-1} · exp(z_t)` with z_t derived from the
// log-likelihood ratio under μ ~ N(0, τ²I_p) prior on the alternative.
// Ville-valid at `M_t ≥ 1/α` ONLY when the compiled (μ, Σ) are the truth
// (axis 2 unrecorded — guarantees.ts). The SHIPPED threshold is
// `sliding_buffer_threshold`, a bootstrap (1−α) quantile of max wealth
// under a joint AR(1) null (median 3.6e76 × 1/α across compiled cells,
// knowledge stats/ville-guarantee-is-empirical); it calibrates a crossing
// rate and licenses no e-value claim. Corrected 2026-09-02 (C61): this
// header said "anytime-valid under Ville's inequality: fire at 1/α".
Object.defineProperty(exports, "__esModule", { value: true });
exports.freshSafeHotellingState = freshSafeHotellingState;
exports.evaluateSafeHotelling = evaluateSafeHotelling;
const _linalg_1 = require("./_linalg");
const _wealth_1 = require("./_wealth");
const _evidence_1 = require("./_evidence");
/** ADR 0026 — log-domain observability floor, same value as the previous
 *  linear floor (1e-300). See the floor comment at the update site. */
const LOG_SAFE_HOTELLING_FLOOR = Math.log(1e-300);
/** Fresh wealth state for a new (deploy, cell) safe-Hotelling evaluation.
 *  `M₀ = 1` is the Ville-inequality convention (log-wealth starts at 0). */
function freshSafeHotellingState() {
    return { M: 1, n: 0, alphaConsumed: 0, log_M: 0 };
}
/** Addition #20 (ARCHITECT-REPLY-43 D4) — safe-Hotelling per-tick
 *  evaluation against a cell with populated `safe_hotelling_params`.
 *  The caller owns the state object; this function mutates `state.M` /
 *  `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (z_t derived inline for future auditors):
 *    Multivariate-Gaussian log-density under null N(0, Σ):
 *      log p₀(x) = -(p/2) log(2π) - ½ log det(Σ) - ½ xᵀ Σ⁻¹ x
 *    Marginal under alternative prior μ ~ N(0, τ²I_p):
 *      p_A(x) = ∫ N(x | μ, Σ) · N(μ | 0, τ²I) dμ = N(x | 0, Σ + τ²I)
 *      log p_A(x) = -(p/2) log(2π) - ½ log det(Σ+τ²I) - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    Log-likelihood ratio:
 *      z_t = log p_A(x) - log p₀(x)
 *          = -½ [log det(Σ+τ²I) - log det(Σ)]
 *            + ½ xᵀ Σ⁻¹ x
 *            - ½ xᵀ (Σ+τ²I)⁻¹ x
 *          = -precompiled_log_det_shrink + ½ xᵀ Σ⁻¹ x - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    M_t = M_{t-1} · exp(z_t); fire when M_t ≥ 1/alpha.
 *
 *  Practice-5 anchors (healthy p=11 cell, τ²≈δ_min²/4):
 *    - Healthy x near zero:        z_t ≈ -0.055, M drifts ~0.946×/tick.
 *    - Drifted x = [3σ, 3σ, 0, …]: z_t ≈  0.445, M grows   ~1.56×/tick.
 *    - Fire horizon on moderate shift: ~log(1/α)/z_t ≈ 9.2/0.445 ≈ 20 ticks.
 */
function evaluateSafeHotelling(input, x, state) {
    // Q2.B.6.2 — sliding-buffer-aware wealth threshold under joint AR(1) H₀.
    // Stamped by the calibrator (safe_hotelling_params.sliding_buffer_threshold);
    // pre-Q2.B.6.2 configs fall through to analytical 1/α (P3.7 backward-
    // compat anchor).
    const params = input.cell.safe_hotelling_params;
    const threshold = params?.sliding_buffer_threshold ?? (1 / input.alpha);
    if (!params) {
        return {
            verdict: 'suppressed', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'safe_hotelling_params_missing', family: 'C',
            signal: 'hotelling_t2_safe',
        };
    }
    // xᵀ Σ⁻¹ x = ||L⁻¹ x||², L from Cholesky of Σ.
    const L = (0, _linalg_1.cholesky)(input.cell.covariance);
    if (!L) {
        return {
            verdict: 'suppressed', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'covariance_singular', family: 'C',
            signal: 'hotelling_t2_safe',
        };
    }
    // Build Σ+τ²I additively on the diagonal; PSD whenever Σ is PSD and
    // τ² > 0. Defensive Cholesky still runs — if it fails, degenerate Σ
    // slipped past REPLY-41's off-diag gate and surfaces as suppressed.
    const p = input.cell.covariance.length;
    const sigmaPlus = new Array(p);
    for (let i = 0; i < p; i++) {
        sigmaPlus[i] = input.cell.covariance[i].slice();
        sigmaPlus[i][i] += params.tau_squared;
    }
    const Lplus = (0, _linalg_1.cholesky)(sigmaPlus);
    if (!Lplus) {
        return {
            verdict: 'suppressed', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'covariance_plus_tau_singular', family: 'C',
            signal: 'hotelling_t2_safe',
        };
    }
    const y = (0, _linalg_1.forwardSolve)(L, x);
    const yPlus = (0, _linalg_1.forwardSolve)(Lplus, x);
    let xSigmaInvX = 0;
    for (const v of y)
        xSigmaInvX += v * v;
    let xSigmaPlusInvX = 0;
    for (const v of yPlus)
        xSigmaPlusInvX += v * v;
    const z_t = -params.precompiled_log_det_shrink
        + 0.5 * xSigmaInvX
        - 0.5 * xSigmaPlusInvX;
    // ADR 0026 — log-domain accumulation: z_t IS the log-increment, so wealth
    // books are kept exactly in log_M and `M` is materialized as the
    // Number.MAX_VALUE-saturating view (never Infinity; the pre-0026 linear
    // update overflowed inside the products' claimed shift bands and was
    // absorbing once it did). Non-finite z_t (a NaN observation, or ∞−∞
    // between the two quadratic forms on an infinite observation) HOLDS the
    // wealth — see advanceLogWealth. The floor keeps its pre-0026 value and
    // intent: informational only, against denormal underflow on extremely long
    // healthy runs (z_t negative ~log(0.946) ≈ -0.056/tick sums to
    // log(1e-300) ≈ -690 at ~12,300 ticks). E-process semantics preserved.
    const logM = (0, _wealth_1.healLogWealth)(state.log_M, state.M, LOG_SAFE_HOTELLING_FLOOR);
    state.log_M = (0, _wealth_1.advanceLogWealth)(logM, z_t, LOG_SAFE_HOTELLING_FLOOR);
    state.M = (0, _wealth_1.wealthView)(state.log_M);
    state.n += 1;
    // ADR 0027 — evidence surface. A NaN z_t held the wealth: no increment to report.
    if (!Number.isNaN(z_t))
        state.log_peak_M = (0, _evidence_1.advanceLogPeak)(state.log_peak_M, state.log_M);
    const evidence = (0, _evidence_1.buildEvidence)({
        log_wealth: state.log_M,
        log_increment: Number.isNaN(z_t) ? null : state.log_M - logM,
        bet: null, n: state.n, threshold,
        threshold_kind: params.sliding_buffer_threshold !== undefined ? 'bootstrap' : 'ville',
        log_peak_wealth: (0, _evidence_1.advanceLogPeak)(state.log_peak_M, state.log_M),
    });
    if (state.M >= threshold) {
        const alphaSpent = Math.max(0, input.alpha - state.alphaConsumed);
        state.alphaConsumed = input.alpha;
        return {
            verdict: 'fire', statistic: state.M, threshold,
            alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
            reason_code: 'safe_hotelling_wealth_exceeded', family: 'C',
            signal: 'hotelling_t2_safe', evidence,
        };
    }
    return {
        verdict: 'clean', statistic: state.M, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'C',
        signal: 'hotelling_t2_safe', evidence,
    };
}
//# sourceMappingURL=_hotelling-safe.js.map