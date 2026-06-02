"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// _page-cusum-mixture.ts — Howard-Ramdas-2021 mixture-supermartingale
// Page-CUSUM path (Ville-bounded; AR(1) pre-whitening). Canonical Family A
// dispatch post-Q68 close. Split out of page-cusum.ts (god-file refactor);
// behavior preserved verbatim.
//
// ── Q66 Phase-3.d.A close (item g) → Q68 Phase-3.d.C consolidation ─────
// Howard-Ramdas-2021 mixture-supermartingale Page-CUSUM is the canonical
// Family A Page-CUSUM path post-Q68 close. Classical reset-at-zero variant
// retired from production dispatch at Q68 Phase-3.d.C consolidation
// (page_cusum_variant flag retired; no opt-in). evaluateFamilyAShadow
// (classical implementation) retained as exported helper for tools/run-nab-
// validation.ts consumption per Q64 anti-scope (full retirement at Q69 .D
// when NAB tooling re-derives for Ville-bounded variants).
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFamilyAShadowMixture = evaluateFamilyAShadowMixture;
exports.evaluateFamilyA = evaluateFamilyA;
const types_1 = require("../types");
const schema_continuity_1 = require("../l0/schema-continuity");
const family_a_mixture_supermartingale_1 = require("./family-a-mixture-supermartingale");
const _page_cusum_core_1 = require("./_page-cusum-core");
/** Resolve `FamilyAPerSignalParams` for the mixture-supermartingale path.
 *  Mirrors `lookupCellParams` cell-matching but returns the raw per-signal
 *  shape (mixture_supermartingale_params + ar1_phi + baseline_*_raw) rather
 *  than the classical-CUSUM `MSPRTParams` view-model. */
function lookupFamilyAPerSignal(cfg, cell, signal) {
    const bc = cfg.baseline_cells;
    if (!bc)
        return null;
    const match = (0, _page_cusum_core_1.matchCellByHour)(bc.cells, cell);
    if (!match)
        return null;
    let perSig = match.family_A?.per_signal[signal];
    const aggregateFallback = match.confidence === 'aggregate' || match.confidence === 'none';
    if (!perSig && aggregateFallback) {
        perSig = bc.aggregate_fallback.family_A?.per_signal[signal];
    }
    return perSig ?? null;
}
/** Schema-continuity suppression mirrors classical path for symmetry. */
function mixtureSchemaContinuitySuppression(cfg, states, schemaContinuityClass) {
    const reason = schemaContinuityClass === 'observability_stack'
        ? 'observability_stack_deploy' : 'schema_continuity_breaking';
    const out = [];
    for (const signal of (cfg.family_a_signals ?? _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS)) {
        const state = states[signal] ?? (0, family_a_mixture_supermartingale_1.freshMixtureSupermartingaleState)();
        states[signal] = state;
        out.push({
            verdict: 'suppressed',
            statistic: state.M_t,
            threshold: null,
            alpha_consumed: 0,
            alpha_spent: 0,
            reason_code: reason,
            family: 'A',
            signal,
        });
    }
    return out;
}
/** Evaluate one primary SLI for the mixture shadow path. Returns the
 *  verdict to push, or null when the signal should be skipped silently. */
function evaluateMixtureSignal(cfg, liveMetrics, states, ctx, cell, alphaFamilyA, bonf, signal) {
    if (ctx.ignoredSignals?.has(signal)) {
        const state = states[signal] ?? (0, family_a_mixture_supermartingale_1.freshMixtureSupermartingaleState)();
        states[signal] = state;
        return {
            verdict: 'suppressed',
            statistic: state.M_t,
            threshold: null,
            alpha_consumed: 0,
            alpha_spent: 0,
            reason_code: 'ignore_threshold',
            family: 'A',
            signal,
            ignore_threshold_trigger_signal: signal,
        };
    }
    const perSig = lookupFamilyAPerSignal(cfg, cell, signal);
    if (!perSig)
        return null;
    const live = liveMetrics[signal];
    if (live === undefined)
        return null;
    // Mixture-supermartingale operates on RAW observation space (Q2.B.5):
    // x_centered = live − baseline_mean_raw. Falls through to baseline_mean
    // (transformed) on pre-Q2.A configs.
    const baselineMeanRaw = perSig.baseline_mean_raw ?? perSig.baseline_mean;
    if (baselineMeanRaw === undefined)
        return null;
    const sigmaSquared = perSig.baseline_sigma_squared_raw
        ?? perSig.baseline_sigma_squared;
    if (sigmaSquared === undefined)
        return null;
    // Resolve mixture params: prefer compile-time stamp; derive on-the-fly
    // for pre-Phase-3.d.A-close configs lacking the field.
    const mixtureParams = perSig.mixture_supermartingale_params
        ?? (0, family_a_mixture_supermartingale_1.deriveMixtureSupermartingaleParams)(perSig);
    if (!mixtureParams)
        return null;
    // Per-signal alpha — same allocation as classical (split with betting
    // co-ship when present so the two Family A detectors share budget).
    const perSigBudget = alphaFamilyA / bonf;
    const alpha = perSig.betting_e_process_alpha !== undefined
        ? Math.max(perSigBudget - perSig.betting_e_process_alpha, perSigBudget * 0.5)
        : perSigBudget;
    let state = states[signal];
    if (!state) {
        state = (0, family_a_mixture_supermartingale_1.freshMixtureSupermartingaleState)();
        states[signal] = state;
    }
    const x_centered = live - baselineMeanRaw;
    const result = (0, family_a_mixture_supermartingale_1.evaluatePageCusumMixtureSupermartingale)({
        signal,
        x_centered,
        live_value: live,
        baseline_mean: baselineMeanRaw,
        sigma_squared: sigmaSquared,
        params: mixtureParams,
        ar1_phi: perSig.ar1_phi,
        state,
        alpha,
    });
    return {
        verdict: result.fire ? 'fire' : (state.S_t !== 0 ? 'indeterminate' : 'clean'),
        statistic: result.M_t,
        threshold: result.threshold,
        alpha_consumed: result.fire ? alpha : 0,
        alpha_spent: result.fire ? alpha : 0,
        reason_code: result.fire ? 'cusum_exceeded_threshold' : 'accumulating',
        family: 'A',
        signal,
    };
}
/** Per-tick mixture-supermartingale Page-CUSUM evaluator. Parallel to
 *  `evaluateFamilyAShadow` (classical) but consumes the Howard-Ramdas-2021
 *  Ville-bounded variant + AR(1) pre-whitening (Q66.A.b H1'). */
function evaluateFamilyAShadowMixture(cfg, liveMetrics, states, ctx) {
    if (!cfg.baseline_cells)
        return [];
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'A')) {
        return mixtureSchemaContinuitySuppression(cfg, states, ctx.schemaContinuityClass);
    }
    const trafficGate = (0, _page_cusum_core_1.trafficGateMin)(cfg);
    void trafficGate;
    const cell = { hour_of_day: ctx.hourOfDay };
    if (ctx.dayOfWeek !== undefined)
        cell.day_of_week = ctx.dayOfWeek;
    cell.tenant_tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const out = [];
    const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
    const bonf = cfg.bonferroni_factor ?? 6;
    for (const signal of _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS) {
        const v = evaluateMixtureSignal(cfg, liveMetrics, states, ctx, cell, alphaFamilyA, bonf, signal);
        if (v !== null)
            out.push(v);
    }
    return out;
}
/** Q68 Phase-3.d.C consolidation — top-level Family A Page-CUSUM dispatch
 *  wrapper. Always delegates to Howard-Ramdas-2021 mixture-supermartingale
 *  variant (Ville-bounded; methodology-resampler-mode invariant by
 *  construction). Classical variant retired at Q68 close; the
 *  `cusumStates` parameter is preserved in the signature for caller
 *  backward-compat (TrendBuffer.cusumStates allocation pattern) but is
 *  unused in the runtime path. */
function evaluateFamilyA(cfg, liveMetrics, _cusumStates, mixtureStates, ctx) {
    return evaluateFamilyAShadowMixture(cfg, liveMetrics, mixtureStates, ctx);
}
//# sourceMappingURL=_page-cusum-mixture.js.map