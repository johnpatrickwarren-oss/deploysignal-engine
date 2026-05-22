"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/hotelling.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports._hotellingVariantForDispatch = exports._HOTELLING_EVALUATORS_FOR_TEST = exports.FAMILY_C_SIGNALS = void 0;
exports.chiSquareQuantile = chiSquareQuantile;
exports.hotellingT2 = hotellingT2;
exports.lookupFamilyCParams = lookupFamilyCParams;
exports.evaluateFamilyC = evaluateFamilyC;
exports.freshSafeHotellingState = freshSafeHotellingState;
exports.evaluateSafeHotelling = evaluateSafeHotelling;
const types_1 = require("../types");
const schema_continuity_1 = require("../l0/schema-continuity");
const _linalg_1 = require("./_linalg");
const page_cusum_1 = require("./page-cusum");
// Primary SLI vector for Family C — must agree with tools/calibrate.ts
// FAMILY_C_SIGNALS order. The covariance matrix's row/column indices are
// this list's positions.
exports.FAMILY_C_SIGNALS = [
    'p99_latency', 'ttft', 'tokens_turn', 'kv_cache', 'cost_req',
    'downstream_err', 'mfu', 'hbm_spill', 'collective_ops',
    'corpus_delta', 'traffic_pct',
];
/** Rational approximation to Φ⁻¹ (inverse standard normal CDF). Beasley-
 *  Springer-Moro, 1995 — sufficient accuracy for our purposes (err
 *  < 1e-7 in the tails we care about). */
function invStdNormalCDF(p) {
    if (p <= 0)
        return -Infinity;
    if (p >= 1)
        return Infinity;
    // Split at 0.5 to keep the approximation in one tail.
    const q = p < 0.5 ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(q));
    // Coefficients from Abramowitz & Stegun 26.2.23
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    const num = c0 + c1 * t + c2 * t * t;
    const den = 1 + d1 * t + d2 * t * t + d3 * t * t * t;
    const z = t - num / den;
    return p < 0.5 ? -z : z;
}
/** Wilson-Hilferty χ² quantile: χ²(q, k) ≈ k·(1 − 2/(9k) + z·√(2/(9k)))³
 *  where z = Φ⁻¹(q). Good to ~1% in the right tail for k ≳ 5. */
function chiSquareQuantile(q, k) {
    const z = invStdNormalCDF(q);
    const a = 1 - 2 / (9 * k);
    const b = z * Math.sqrt(2 / (9 * k));
    const root = a + b;
    return k * root * root * root;
}
/** Compute T² = r^T Σ⁻¹ r via Cholesky. Returns null if Σ is not PSD. */
function hotellingT2(r, covariance) {
    const L = (0, _linalg_1.cholesky)(covariance);
    if (!L)
        return null;
    // Σ⁻¹ = (L L^T)⁻¹ = L^-T L^-1 ; r^T Σ⁻¹ r = ||L⁻¹ r||².
    const y = (0, _linalg_1.forwardSolve)(L, r);
    let sum = 0;
    for (const v of y)
        sum += v * v;
    return sum;
}
/** Retrieve the Family C params for the cell matching `cell`. Falls back
 *  to `aggregate_fallback.family_C` when the cell's confidence is
 *  aggregate/none. Returns null if Family C isn't compiled.
 *
 *  Addition #23 — `cell.tenant_tier` routes the lookup through the tiered
 *  matrix. Two-stage match: exact tier first, then `'aggregate'` tier,
 *  then `aggregate_fallback.family_C` as the last resort. Pre-#23 configs
 *  (no tenant_tier on cells) match any tier query. */
function matchFamilyCCell(bc, cell, tier) {
    return bc.cells.find((c) => {
        if (c.key.hour_of_day !== cell.hour_of_day)
            return false;
        if (cell.day_of_week !== undefined && c.key.day_of_week !== undefined) {
            if (c.key.day_of_week !== cell.day_of_week)
                return false;
        }
        if (tier !== undefined && c.key.tenant_tier !== undefined) {
            if (c.key.tenant_tier !== tier)
                return false;
        }
        return true;
    });
}
function lookupFamilyCParams(cfg, cell) {
    const bc = cfg.baseline_cells;
    if (!bc)
        return null;
    let match = matchFamilyCCell(bc, cell, cell.tenant_tier);
    if ((!match || !match.family_C) && cell.tenant_tier !== undefined && cell.tenant_tier !== 'aggregate') {
        match = matchFamilyCCell(bc, cell, 'aggregate');
    }
    if (match?.family_C)
        return { params: match.family_C, source: match };
    if (bc.aggregate_fallback.family_C)
        return { params: bc.aggregate_fallback.family_C, source: 'aggregate' };
    return null;
}
/** Lookup the per-signal Family A bake profile as the Family C proxy —
 *  architect spec §Addition #4: bake profile is signal-level, not
 *  cell-level, and applies to Families A/C/D/E. Family C uses the
 *  most-constrained profile across its signals (max of each field)
 *  so the joint test only fires when every component signal is ready.
 *
 *  W4 §4.1.h (ARCHITECT-REPLY-12 S2 landing): adds `min_obs` as the
 *  joint `min_observation_window` clause-2 bound. */
function familyCBakeProfile(cfg) {
    const profiles = cfg.bake_profiles ?? {};
    let maxMinTicks = 0, maxMinObs = 0, maxMaxDays = Infinity;
    let any = false;
    // REPLY-51b v2 R4-1 — prefer config-provided signals (set when
    // compiled under a profile); fall back to hardcoded for legacy
    // configs. Same pattern at every runtime FAMILY_C_SIGNALS site.
    const signals = cfg.family_c_signals ?? exports.FAMILY_C_SIGNALS;
    for (const sig of signals) {
        const p = profiles[sig];
        if (!p)
            continue;
        any = true;
        if (p.min_ticks_before_eligible > maxMinTicks)
            maxMinTicks = p.min_ticks_before_eligible;
        if (p.min_observation_window > maxMinObs)
            maxMinObs = p.min_observation_window;
        if (p.max_deploy_window_days < maxMaxDays)
            maxMaxDays = p.max_deploy_window_days;
    }
    if (!any)
        return { min_ticks: 3, min_obs: 3, max_days: 1 };
    return {
        min_ticks: maxMinTicks,
        min_obs: maxMinObs,
        max_days: Number.isFinite(maxMaxDays) ? maxMaxDays : 1,
    };
}
/** One Family C evaluation at one tick. Legacy `chi_square` path is
 *  stateless (per-tick joint test); the Addition #20 `safe_test` dispatch
 *  branch (activated when `cell.hotelling_variant === 'safe_test'` and
 *  `states` is provided) is stateful — it mutates the per-cell wealth
 *  martingale in `states[__sh_<tier>_<h>_<d>]`. */
function evaluateFamilyC(cfg, liveMetrics, ctx, states) {
    if (!cfg.baseline_cells)
        return null;
    const tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const lookup = lookupFamilyCParams(cfg, {
        hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek, tenant_tier: tier,
    });
    if (!lookup)
        return null;
    const { params } = lookup;
    // Addition #18 D8: Family C α-budget splits 50/50 between Hotelling T²
    // and Sequential MMD. When the cell carries `mmd_params` (post-#18
    // recompile), Hotelling takes half; otherwise it uses the full budget
    // (backward compat for v4-and-earlier configs). Threshold uses
    // Wilson-Hilferty chi-square quantile at `1 − α_hotelling`.
    const alphaFamilyC = cfg.alpha_budget.per_family.C ?? 2e-4;
    const alphaHotelling = params.mmd_params ? alphaFamilyC * 0.5 : alphaFamilyC;
    // REPLY-51b v2 R4-1 — χ² degrees-of-freedom matches compiled
    // joint-vector dimension (profile-driven when present).
    const signalsForChi2 = cfg.family_c_signals ?? exports.FAMILY_C_SIGNALS;
    // Q2.B.6.2 — sliding-buffer-aware threshold under joint AR(1) H₀.
    // Stamped by the calibrator post-cholesky_L_eps (per Q2-B-6-2 spec)
    // so per-trajectory FPR matches α under the runtime sliding-buffer
    // evaluation contract. Pre-Q2.B.6.2 configs lack the field; falls
    // through to the single-window Wilson-Hilferty χ²_p quantile (P3.7
    // backward-compat anchor).
    const threshold = params.hotelling_sliding_buffer_threshold
        ?? chiSquareQuantile(1 - alphaHotelling, signalsForChi2.length);
    // Addition #8 runtime consumer (W5 §S6): per-cell covariance is only
    // meaningful against the baseline's original schema. A breaking change
    // invalidates Σ; suppress without evaluating.
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'C')) {
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: ctx.schemaContinuityClass === 'observability_stack'
                ? 'observability_stack_deploy' : 'schema_continuity_breaking',
            family: 'C',
        };
    }
    // Addition #13 (per ARCHITECT-REPLY-31 correction): multivariate families
    // evaluate the full joint vector regardless of `ignore_thresholds` state.
    // An in-band signal contributes near-zero to the Mahalanobis quadratic
    // form naturally — (x − μ)ᵀ Σ⁻¹ (x − μ) with x ≈ μ for that component —
    // so explicit suppression would be redundant and would silence Family C
    // on other-signal drift the operator didn't intend to ignore.
    // ignore_thresholds are a per-signal suppression for single-signal
    // detectors (Family A) only; Family C is unaffected.
    // Gather the live vector, in the compiled joint-vector order.
    // REPLY-51b v2 R4-1 — project onto cfg.family_c_signals when
    // profile is active; fall back to hardcoded for legacy configs.
    // Missing signals kill the evaluation — the cov matrix dimensions
    // don't shrink.
    const cSignals = cfg.family_c_signals ?? exports.FAMILY_C_SIGNALS;
    const x = new Array(cSignals.length);
    for (let i = 0; i < cSignals.length; i++) {
        const v = liveMetrics[cSignals[i]];
        if (v === undefined)
            return null;
        x[i] = v;
    }
    // Bake-profile gate (joint; takes max of per-signal min_ticks_before_eligible).
    const bake = familyCBakeProfile(cfg);
    if (ctx.ticksSinceDeploy < bake.min_ticks) {
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'bake_profile_not_met', family: 'C',
        };
    }
    // Addition #4 clause 2 — W4 §4.1.h lands the missing consumer. Family C
    // is per-tick single-shot, so ticksSinceDeploy is the post-deploy
    // sample count for this detector's purposes.
    if (ctx.ticksSinceDeploy < bake.min_obs) {
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'bake_profile_not_met', family: 'C',
        };
    }
    if (ctx.deployAgeDays > bake.max_days) {
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'bake_profile_not_met', family: 'C',
        };
    }
    // Traffic gate.
    if (ctx.trafficPct < (0, page_cusum_1.trafficGateMin)(cfg)) {
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'traffic_pct_below_gate', family: 'C',
        };
    }
    // Relative deviation vector r = (x − μ) ./ μ (element-wise), matching
    // the compiler's covariance standardization. Fallback to additive
    // (x − μ) when μ_i ≈ 0 — keeps the formula working on near-zero-mean
    // signals (no such signal in the current set, but defensive).
    const mu = params.mean_vector;
    const r = new Array(mu.length);
    for (let i = 0; i < mu.length; i++) {
        const m = mu[i];
        r[i] = Math.abs(m) > 1e-12 ? (x[i] - m) / m : (x[i] - m);
    }
    // D-54-2 dispatch — variant routing via HOTELLING_EVALUATORS map.
    // `chi_square` is the default when hotelling_variant is unset (pre-#20
    // configs). `safe_test` additionally requires compile-time params +
    // runtime state store; missing prereqs fall through to chi_square
    // (preserves pre-refactor semantics byte-for-byte). Unknown variant
    // strings throw — see dispatch-maps.ts.
    const variant = hotellingVariantForDispatch(params.hotelling_variant, !!params.safe_hotelling_params, !!states);
    const evaluator = HOTELLING_EVALUATORS[variant];
    if (!evaluator) {
        throw new Error(`Unknown hotelling_variant: '${String(params.hotelling_variant)}'. `
            + `Known: ${Object.keys(HOTELLING_EVALUATORS).join(', ')}`);
    }
    return evaluator({
        params, r, alphaHotelling, threshold, states, tier,
        hourOfDay: ctx.hourOfDay, dayOfWeek: ctx.dayOfWeek,
    });
}
/** Chi-square (Wilson-Hilferty) per-tick T² test — the pre-#20 default.
 *  Stateless; statistic is (x − μ)ᵀ Σ⁻¹ (x − μ). */
function evaluateHotellingChiSquare(ctx) {
    const { params, r, alphaHotelling, threshold } = ctx;
    const t2 = hotellingT2(r, params.covariance);
    if (t2 === null) {
        // Covariance not positive definite — shouldn't happen after Ledoit-
        // Wolf shrinkage, but the compiler could hit a degenerate cell.
        return {
            verdict: 'suppressed', statistic: null, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'covariance_singular', family: 'C',
        };
    }
    if (t2 >= threshold) {
        return {
            verdict: 'fire', statistic: t2, threshold,
            alpha_consumed: alphaHotelling, alpha_spent: alphaHotelling,
            reason_code: 'hotelling_exceeded_threshold', family: 'C',
        };
    }
    return {
        verdict: 'clean', statistic: t2, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'C',
    };
}
/** Safe-Hotelling e-process wrapper for dispatch. Allocates per-cell
 *  state on first use; requires `safe_hotelling_params` on the cell. */
function evaluateHotellingSafeTestDispatch(ctx) {
    const { params, r, states, tier, hourOfDay, dayOfWeek } = ctx;
    // The dispatch map only routes here when prereqs are present; reassert
    // here for the type-narrow + throw defensively if someone added a
    // caller that skips the guard.
    if (!params.safe_hotelling_params || !states) {
        throw new Error('evaluateHotellingSafeTestDispatch invoked without safe_hotelling_params or states — '
            + 'dispatch map gate must enforce prereqs before routing.');
    }
    const cellKey = `__sh_${tier ?? 'none'}_${hourOfDay}_${dayOfWeek ?? -1}`;
    let state = states[cellKey];
    if (!state) {
        state = freshSafeHotellingState();
        states[cellKey] = state;
    }
    return evaluateSafeHotelling({ cell: params, alpha: params.safe_hotelling_params.alpha }, r, state);
}
/** Variant→evaluator dispatch map. Adding a variant = adding a key. */
const HOTELLING_EVALUATORS = {
    'chi_square': evaluateHotellingChiSquare,
    'safe_test': evaluateHotellingSafeTestDispatch,
};
/** Resolve a cell's declared variant to the effective dispatch key.
 *  Normalizes `undefined` → `'chi_square'` for backward-compat. Falls
 *  `safe_test` back to `chi_square` when compile-time params or
 *  runtime state is missing (preserves pre-D-54-2 semantics). Passes
 *  through any other value so the caller's Record lookup can throw
 *  on unknowns (feedback_no_skip_test_policy). */
function hotellingVariantForDispatch(raw, hasParams, hasStates) {
    if (raw === undefined || raw === 'chi_square')
        return 'chi_square';
    if (raw === 'safe_test') {
        return (hasParams && hasStates) ? 'safe_test' : 'chi_square';
    }
    // Unknown string — return as-is so the Record lookup throws.
    return raw;
}
/** Exposed for dispatch-map parity testing. */
exports._HOTELLING_EVALUATORS_FOR_TEST = HOTELLING_EVALUATORS;
exports._hotellingVariantForDispatch = hotellingVariantForDispatch;
// ── Addition #20 — safe-Hotelling e-process (ARCHITECT-REPLY-43) ──────
//
// Mixture-prior growth-optimal e-test for the composite-Gaussian-mean
// null, per Grünwald-de Heide-Koolen 2024. Co-ships alongside the
// legacy chi_square variant; selection by `cell.hotelling_variant`.
// Wealth update `M_t = M_{t-1} · exp(z_t)` with z_t derived from the
// log-likelihood ratio under μ ~ N(0, τ²I_p) prior on the alternative.
// Anytime-valid under Ville's inequality: fire at `M_t ≥ 1/α`.
/** Fresh wealth state for a new (deploy, cell) safe-Hotelling evaluation.
 *  `M₀ = 1` is the Ville-inequality convention (log-wealth starts at 0). */
function freshSafeHotellingState() {
    return { M: 1, n: 0, alphaConsumed: 0 };
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
    // Informational floor against denormal underflow on extremely long
    // healthy runs (z_t negative ~60+ ticks of log(0.946) ≈ -0.056 sums
    // to log(1e-300) ≈ -690 → M_t at ~12,300 ticks). E-process semantics
    // preserved; floor is observability only.
    state.M = Math.max(1e-300, state.M * Math.exp(z_t));
    state.n += 1;
    if (state.M >= threshold) {
        const alphaSpent = Math.max(0, input.alpha - state.alphaConsumed);
        state.alphaConsumed = input.alpha;
        return {
            verdict: 'fire', statistic: state.M, threshold,
            alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
            reason_code: 'safe_hotelling_wealth_exceeded', family: 'C',
            signal: 'hotelling_t2_safe',
        };
    }
    return {
        verdict: 'clean', statistic: state.M, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'C',
        signal: 'hotelling_t2_safe',
    };
}
//# sourceMappingURL=hotelling.js.map