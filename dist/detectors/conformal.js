"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/conformal.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports._conformalKindForDispatch = exports._CONFORMAL_EVALUATORS_FOR_TEST = exports.conformalPValue = exports.mahalanobisDistance = void 0;
exports.lookupFamilyEParams = lookupFamilyEParams;
exports.evaluateFamilyE = evaluateFamilyE;
exports.freshConformalEValueState = freshConformalEValueState;
exports.evaluateConformalWeightedEValue = evaluateConformalWeightedEValue;
// relative-deviation helper is file-local; exported below for health.ts
// to reuse when it threads x_t through to evaluateConformalWeightedEValue
// via evaluateFamilyE's dispatch branch.
const types_1 = require("../types");
const hotelling_1 = require("./hotelling");
const schema_continuity_1 = require("../l0/schema-continuity");
const _linalg_1 = require("./_linalg");
// Pure math primitives live in a sibling leaf module (no cycle). They are
// re-exported below so the public import surface of this file is unchanged.
const _conformal_math_1 = require("./_conformal-math");
var _conformal_math_2 = require("./_conformal-math");
Object.defineProperty(exports, "mahalanobisDistance", { enumerable: true, get: function () { return _conformal_math_2.mahalanobisDistance; } });
Object.defineProperty(exports, "conformalPValue", { enumerable: true, get: function () { return _conformal_math_2.conformalPValue; } });
const _conformal_math_3 = require("./_conformal-math");
// Default α_family_E = 10% of 1e-3 per handoff §4.1.c.
const DEFAULT_ALPHA_E = 1e-4;
/** Retrieve Family E calibration + matching Family C mean/covariance.
 *
 *  W5 §REPLY-16 Q2: Family E always consults `aggregate_fallback.family_E`
 *  for calibration_scores, never per-cell. Rationale: per-cell calibration
 *  would have far fewer samples than the aggregate's pooled baseline (16K+
 *  samples), risking the underpowered-guard tripping at the project's
 *  α_E=1e-4 default (which needs ≥9999 samples). The aggregate's pooled
 *  scores are statistically richer than any per-cell slice and the
 *  exchangeability assumption underlying conformal p-values is preserved
 *  (calibration draws are independent of the query).
 *
 *  The Family C mean/covariance used for the Mahalanobis distance still
 *  comes from the per-cell match when present — that's a different
 *  contract (per-cell baseline distribution shape, not nonconformity
 *  scoring tail), so per-cell μ/Σ continues to apply.
 */
function lookupFamilyEParams(cfg, cell) {
    const bc = cfg.baseline_cells;
    if (!bc)
        return null;
    const fb = bc.aggregate_fallback;
    if (!fb.family_E)
        return null;
    // Addition #23 — two-stage cell match (exact tier → 'aggregate' tier)
    // so per-cell μ/Σ comes from the requested tenant_tier when present.
    const matchOne = (tier) => bc.cells.find((c) => {
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
    let match = matchOne(cell.tenant_tier);
    if (!match && cell.tenant_tier !== undefined && cell.tenant_tier !== 'aggregate') {
        match = matchOne('aggregate');
    }
    // Calibration scores: always aggregate (per architect REPLY-16 Q2).
    // Family C μ/Σ for Mahalanobis: per-cell when available, else aggregate.
    const famC = (match?.family_C) ?? fb.family_C;
    if (!famC)
        return null;
    return { params: fb.family_E, famC, source: 'aggregate' };
}
/** Collect the live joint vector in Family-C signal order. Returns null
 *  (caller short-circuits to null) when any required signal is absent.
 *  Extracted verbatim from evaluateFamilyE for the 100-line budget. */
function collectFamilyEVector(cSignals, liveMetrics) {
    const x = new Array(cSignals.length);
    for (let i = 0; i < cSignals.length; i++) {
        const v = liveMetrics[cSignals[i]];
        if (v === undefined)
            return null;
        x[i] = v;
    }
    return x;
}
/** Bake-profile + traffic eligibility gates for Family E. Returns a
 *  `suppressed` DetectorVerdict when a gate trips, else null (eligible).
 *  (Signal-level bake profiles aren't per-signal here because the test
 *  is multivariate; most-constrained across signals.) Extracted verbatim
 *  from evaluateFamilyE for the 100-line budget. */
function checkFamilyEGates(cfg, ctx, cSignals, alphaE) {
    const bakeProfiles = cfg.bake_profiles ?? {};
    let maxMinTicks = 0;
    let maxMaxDays = Infinity;
    let anyProfile = false;
    for (const sig of cSignals) {
        const p = bakeProfiles[sig];
        if (!p)
            continue;
        anyProfile = true;
        if (p.min_ticks_before_eligible > maxMinTicks)
            maxMinTicks = p.min_ticks_before_eligible;
        if (p.max_deploy_window_days < maxMaxDays)
            maxMaxDays = p.max_deploy_window_days;
    }
    if (!anyProfile) {
        maxMinTicks = 3;
        maxMaxDays = 1;
    }
    if (ctx.ticksSinceDeploy < maxMinTicks) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'bake_profile_not_met', family: 'E',
        };
    }
    if (ctx.deployAgeDays > maxMaxDays) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'bake_profile_not_met', family: 'E',
        };
    }
    const trafficGate = cfg.traffic_pct_gate?.min_traffic_pct_for_fire ?? 0;
    if (ctx.trafficPct < trafficGate) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'traffic_pct_below_gate', family: 'E',
        };
    }
    return null;
}
/** Evaluate Family E at one tick. Legacy unweighted/weighted paths are
 *  stateless (per-tick single-shot). Addition #22 `weighted_e_value`
 *  variant is stateful — requires the `state` parameter; function
 *  mutates `state.M` / `state.n` / `state.alphaConsumed` in place on
 *  that dispatch branch.
 *
 *  Returns null when Family E isn't compiled for this cell/config. */
function evaluateFamilyE(cfg, liveMetrics, ctx, state) {
    const tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const lookup = lookupFamilyEParams(cfg, {
        hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek, tenant_tier: tier,
    });
    if (!lookup)
        return null;
    const { params, famC } = lookup;
    const alphaE = cfg.alpha_budget.per_family.E ?? DEFAULT_ALPHA_E;
    // Addition #8 runtime consumer (W5 §S6): calibration is parametric
    // under the baseline's schema; a breaking continuity change invalidates
    // the assumed null distribution, so the threshold / conformal p-value
    // is meaningless and we suppress pending rebaseline.
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'E')) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: ctx.schemaContinuityClass === 'observability_stack'
                ? 'observability_stack_deploy' : 'schema_continuity_breaking',
            family: 'E',
        };
    }
    // Addition #13 (per ARCHITECT-REPLY-31 correction): Family E evaluates the
    // full joint vector regardless of `ignore_thresholds`. An in-band signal's
    // contribution to the Mahalanobis nonconformity score is near-zero
    // naturally, so explicit suppression would silence Family E on genuine
    // other-signal novelty the operator didn't intend to ignore.
    // Minimum-calibration guard: need at least 1/α_E calibration samples so
    // the smallest observable p-value can actually fall below α. If we have
    // too few, emit suppressed — a runway-pitch acceptable behavior.
    // Addition #19: guard applies to raw sample count (not ESS). The
    // weighted variant tightens the *threshold* rather than the discrete
    // p-value staircase, so the underpowered-for-α check stays on n.
    if ((0, types_1.conformalSampleCount)(params) + 1 < Math.ceil(1 / alphaE)) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'calibration_underpowered', family: 'E',
        };
    }
    // Collect live vector in joint-vector order — identical to Family C
    // so calibration scores are comparable at query time. REPLY-51b v2
    // R4-1: reads from cfg.family_c_signals when profile is active,
    // otherwise falls back to hardcoded.
    const cSignals = cfg.family_c_signals ?? hotelling_1.FAMILY_C_SIGNALS;
    const x = collectFamilyEVector(cSignals, liveMetrics);
    if (x === null)
        return null;
    // Same bake/traffic gates as Family C — Family E inherits joint-detector
    // eligibility since it's a nonconformity scorer over the same vector.
    const gateVerdict = checkFamilyEGates(cfg, ctx, cSignals, alphaE);
    if (gateVerdict)
        return gateVerdict;
    const r = (0, _conformal_math_1.relativeDeviation)(x, famC.mean_vector);
    const s = (0, _conformal_math_3.mahalanobisDistance)(r, famC.covariance);
    if (s === null) {
        return {
            verdict: 'suppressed', statistic: null, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'covariance_singular', family: 'E',
        };
    }
    // D-54-2 dispatch — variant routing via CONFORMAL_EVALUATORS map,
    // keyed by ConformalParams.kind discriminator. Three variants:
    //   'unweighted'       — pre-#19 parametric-bootstrap p-value.
    //   'weighted'         — #19 weighted-quantile threshold crossing.
    //   'weighted_e_value' — #22 hedged-indicator e-value (requires state).
    // Unknown variant strings throw per feedback_no_skip_test_policy.
    const variant = conformalKindForDispatch(params);
    const evaluator = CONFORMAL_EVALUATORS[variant];
    if (!evaluator) {
        throw new Error(`Unknown ConformalParams.kind: '${String(params.kind)}'. `
            + `Known: ${Object.keys(CONFORMAL_EVALUATORS).join(', ')}`);
    }
    return evaluator({ params, s, r, alphaE, covariance: famC.covariance, state });
}
/** Pre-#19 unweighted parametric-bootstrap p-value. Fires when
 *  p(s | calibration_scores) < α_E. */
function evaluateConformalUnweighted(ctx) {
    const { params, s, alphaE } = ctx;
    // Discriminator narrows — unweighted variant carries calibration_scores.
    const scores = params.calibration_scores;
    const p = (0, _conformal_math_3.conformalPValue)(s, scores);
    if (p < alphaE) {
        return {
            verdict: 'fire', statistic: s, threshold: alphaE,
            alpha_consumed: alphaE, alpha_spent: alphaE,
            reason_code: 'conformal_p_below_threshold', family: 'E',
        };
    }
    return {
        verdict: 'clean', statistic: s, threshold: alphaE,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'E',
    };
}
/** Addition #19 weighted-quantile threshold crossing. */
function evaluateConformalWeightedQuantile(ctx) {
    const { params, s, alphaE } = ctx;
    const w = params;
    const threshold = (0, _linalg_1.weightedQuantile)(w.scores, w.weights, 1 - alphaE);
    if (s > threshold) {
        return {
            verdict: 'fire', statistic: s, threshold,
            alpha_consumed: alphaE, alpha_spent: alphaE,
            reason_code: 'weighted_conformal_threshold_exceeded', family: 'E',
        };
    }
    return {
        verdict: 'clean', statistic: s, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'E',
    };
}
/** Addition #22 weighted-e-value wrapper. Preserves pre-refactor
 *  fall-through: state missing → suppressed with reason code. */
function evaluateConformalWeightedEValueDispatch(ctx) {
    const { params, s, r, alphaE, covariance, state } = ctx;
    if (!state) {
        return {
            verdict: 'suppressed', statistic: s, threshold: alphaE,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'weighted_e_value_state_missing', family: 'E',
        };
    }
    const w = params;
    return evaluateConformalWeightedEValue({ params: w, covariance, alpha: alphaE }, r, state);
}
const CONFORMAL_EVALUATORS = {
    'unweighted': evaluateConformalUnweighted,
    'weighted': evaluateConformalWeightedQuantile,
    'weighted_e_value': evaluateConformalWeightedEValueDispatch,
};
/** Resolve ConformalParams.kind to the dispatch key. Normalizes
 *  undefined (pre-#19 shape) → 'unweighted'. */
function conformalKindForDispatch(params) {
    if ((0, types_1.isWeightedEValueConformal)(params))
        return 'weighted_e_value';
    if ((0, types_1.isWeightedConformal)(params))
        return 'weighted';
    const raw = params.kind;
    if (raw === undefined || raw === 'unweighted')
        return 'unweighted';
    return raw;
}
/** Exposed for dispatch-map parity testing. */
exports._CONFORMAL_EVALUATORS_FOR_TEST = CONFORMAL_EVALUATORS;
exports._conformalKindForDispatch = conformalKindForDispatch;
// ── Addition #22 — weighted e-value detector (ARCHITECT-REPLY-46b) ─────
//
// Hedged-indicator betting form (Shekhar-Ramdas 2023 λ=1 special case)
// with weighted exchangeability over the time-decayed calibration
// distribution from Addition #19. Fires at `M_t ≥ 1/α_E` under Ville's
// inequality — anytime-valid time-uniform α control, parallel to
// Family A (betting), C (safe-Hotelling + e-MMD), D (spectral
// e-detector). REPLACE semantic per D2.
//
// REPLY-46b corrected the original REPLY-46 D3 formula (`e_t =
// total_weight / den`) which was 1/p-conformal inversion and NOT a
// valid e-value: E[e_t|H₀] ≈ log(M) + γ, wealth grew multiplicatively
// under H₀. The hedged-indicator form `e_t = 1 + 𝟙(s_t ∈ upper-α tail)
// − α` preserves `E[e_t|H₀] = 1` exactly.
//
// Fresh per-(deploy, cell) wealth state `M₀ = 1`. Caller threads the
// state object through; this function mutates in place.
//
// Runtime cost: O(log M) binary search into the sorted scores + O(1)
// cumulative-weights lookup. ≈1μs per tick per cell at M=20,000.
/** Fresh wealth state for a new (deploy, cell) weighted-e-value
 *  evaluation. `M₀ = 1` per Ville-inequality convention. */
function freshConformalEValueState() {
    return { M: 1, n: 0, alphaConsumed: 0 };
}
/** Addition #22 (ARCHITECT-REPLY-46b corrected D3) — weighted e-value
 *  per-tick evaluation against a cell with `kind: 'weighted_e_value'`
 *  ConformalParams. Caller owns the state object; this function mutates
 *  `state.M` / `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (hedged-indicator betting form; λ=1 special case of
 *  Shekhar-Ramdas 2023):
 *
 *    Let s_t = √(xᵀ Σ⁻¹ x) be the live Mahalanobis distance against
 *    the cell's robust covariance.
 *    k = findFirstGE(sorted_scores, s_t)     // O(log M) rank
 *    den_raw = cumulative_weights_above[k]   // O(1) reverse-cumsum,
 *              0 if k === scores.length (s_t exceeds all calibration)
 *    indicator = (den_raw < α_E · total_weight) ? 1 : 0
 *    e_t = 1 + indicator − α_E
 *        ⇒ indicator=0: e_t = 1 − α_E ≈ 1 (slight wealth decay)
 *        ⇒ indicator=1: e_t = 2 − α_E ≈ 2 (wealth doubles on fire tick)
 *    M_t = M_{t-1} · e_t
 *    fire iff M_t ≥ 1/α_E
 *
 *  Validity (why this IS an e-value under weighted exchangeability):
 *
 *    Under H₀, P(indicator = 1 | H₀) = P(s_t is in upper α_E tail of
 *    calibration distribution) = α_E by construction of the weighted
 *    rank. So E[e_t | H₀] = α_E · (2 − α_E) + (1 − α_E) · (1 − α_E)
 *                          = 2α_E − α_E² + 1 − 2α_E + α_E²
 *                          = 1  exactly.
 *    Ville's inequality applies: sup_t P(M_t ≥ 1/α_E | H₀) ≤ α_E.
 *
 *  Replaces REPLY-46's original D3 formula `e_t = total_weight / den`
 *  which was 1/p-conformal inversion (not a valid e-value — E[e_t|H₀]
 *  ≈ log(M) + γ, wealth grew multiplicatively under H₀). REPLY-46b
 *  corrects by swapping to the hedged-indicator form that preserves
 *  the martingale property under weighted exchangeability. */
function evaluateConformalWeightedEValue(input, x_t, state) {
    const threshold = 1 / input.alpha;
    const s_t = (0, _conformal_math_3.mahalanobisDistance)(x_t, input.covariance);
    if (s_t === null) {
        return {
            verdict: 'suppressed', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'covariance_singular', family: 'E',
        };
    }
    const { scores, cumulative_weights_above, total_weight } = input.params;
    const k = (0, _linalg_1.findFirstGE)(scores, s_t);
    const den_raw = k < cumulative_weights_above.length ? cumulative_weights_above[k] : 0;
    const fireCutoff = input.alpha * total_weight;
    const indicator = den_raw < fireCutoff ? 1 : 0;
    const e_t = 1 + indicator - input.alpha;
    state.M = state.M * e_t;
    state.n += 1;
    if (state.M >= threshold) {
        const alphaSpent = Math.max(0, input.alpha - state.alphaConsumed);
        state.alphaConsumed = input.alpha;
        return {
            verdict: 'fire', statistic: state.M, threshold,
            alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
            reason_code: 'conformal_e_value_wealth_exceeded',
            family: 'E', signal: 'weighted_conformal_e_value',
        };
    }
    return {
        verdict: 'clean', statistic: state.M, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold',
        family: 'E', signal: 'weighted_conformal_e_value',
    };
}
//# sourceMappingURL=conformal.js.map