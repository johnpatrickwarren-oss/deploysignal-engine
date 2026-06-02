"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// _page-cusum-classical.ts — classical Page-1954 reset-at-zero CUSUM path.
// Split out of page-cusum.ts (god-file refactor); behavior preserved
// verbatim. Retained as exported helper for tools/run-nab-validation.ts
// consumption per Q64 anti-scope (see page-cusum.ts header for the Q68
// production-dispatch retirement note).
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCUSUM = evaluateCUSUM;
exports.lookupCellParams = lookupCellParams;
exports.evaluateFamilyAShadow = evaluateFamilyAShadow;
const types_1 = require("../types");
const schema_continuity_1 = require("../l0/schema-continuity");
const _page_cusum_core_1 = require("./_page-cusum-core");
/** Evaluate one (signal, cell) at the current tick. Mutates `state` (S_n
 *  and n advance regardless of suppression, per architect spec). */
function evaluateCUSUM(input, x) {
    const { signal, params, state } = input;
    // Q2.B.5 (per Q2-B-5-SIGMA-COHERENCE-SPEC.md) — Page-CUSUM operates
    // on RAW observation space; consumes raw-space σ² derived at compile
    // time from Family C's blended Σ_C diagonal for overlapping signals.
    // Falls through to `empirical_variance` (transformed-space σ²) on
    // pre-Q2.B.5 configs lacking `empirical_variance_raw` — preserves
    // backward compatibility with v5/v5.1 substrates.
    const sigmaSquared = params.derivation?.empirical_variance_raw
        ?? params.derivation?.empirical_variance;
    if (sigmaSquared === undefined) {
        throw new Error(`CUSUM: missing derivation.empirical_variance(_raw) for signal ${signal}`);
    }
    // Always update first — bake/traffic gates only suppress the fire, not
    // the accumulation. When eligibility lands, S_n already reflects all
    // prior samples.
    (0, _page_cusum_core_1.updateCUSUM)(state, x, sigmaSquared, params.tau_squared, params.alpha);
    const threshold = -Math.log(params.alpha);
    if (input.ticksSinceDeploy < params.min_ticks_before_eligible) {
        return (0, _page_cusum_core_1.suppressed)(signal, 'bake_profile_not_met', state, threshold);
    }
    // Addition #4 clause 2 — n_post_deploy_samples >= min_observation_window.
    // Wired in W4 §4.1.h per ARCHITECT-REPLY-12 S2 landing. Often equivalent
    // to clause 1 on fast-fire signals (p99 3/3/1), but does real work on
    // slower signals like cost_req (8/8/7). `state.n` is the post-update
    // post-deploy sample count — checked after updateCUSUM, so the current
    // sample is included.
    if (state.n < params.min_observation_window) {
        return (0, _page_cusum_core_1.suppressed)(signal, 'bake_profile_not_met', state, threshold);
    }
    if (input.deployAgeDays > params.max_deploy_window_days) {
        return (0, _page_cusum_core_1.suppressed)(signal, 'bake_profile_not_met', state, threshold);
    }
    if (input.trafficPct < input.trafficGate) {
        return (0, _page_cusum_core_1.suppressed)(signal, 'traffic_pct_below_gate', state, threshold);
    }
    if (state.S >= threshold) {
        return {
            verdict: 'fire',
            statistic: state.S,
            threshold,
            alpha_consumed: state.alphaConsumed,
            alpha_spent: params.alpha, // Ville's-inequality budget (Q3)
            reason_code: 'cusum_exceeded_threshold',
            family: 'A',
            signal,
        };
    }
    return {
        verdict: state.S > 0 ? 'indeterminate' : 'clean',
        statistic: state.S,
        threshold,
        alpha_consumed: state.alphaConsumed,
        alpha_spent: 0,
        reason_code: state.S > 0 ? 'accumulating' : 'reset_to_zero',
        family: 'A',
        signal,
    };
}
/** Build an `MSPRTParams` view-model from the unified `baseline_cells`
 *  entry + signal-level bake profile + per-family α. Returns null if the
 *  config has no Family A block for this cell/signal. When the cell's
 *  `confidence ∈ {aggregate, none}`, falls back to
 *  `baseline_cells.aggregate_fallback.family_A`. */
function buildMSPRTParams(cfg, cell, signal) {
    let perSig = cell.family_A?.per_signal[signal];
    let pooled = cell.confidence === 'pooled';
    const aggregateFallback = cell.confidence === 'aggregate' || cell.confidence === 'none';
    if (!perSig && aggregateFallback) {
        perSig = cfg.baseline_cells?.aggregate_fallback.family_A?.per_signal[signal];
        pooled = true;
    }
    if (!perSig)
        return null;
    const bake = cfg.bake_profiles?.[signal] ?? _page_cusum_core_1.DEFAULT_BAKE;
    const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
    const bonf = cfg.bonferroni_factor ?? 6;
    // Addition #17 (ARCHITECT-REPLY-34 D7) — Family A α-split when the
    // compiled config carries a betting-e-process co-ship allocation. Pre-
    // #17 configs (no `betting_e_process_alpha` field) keep the full
    // per-signal Bonferroni α for Page-CUSUM so demo fire timing calibrated
    // against that threshold stays intact. Post-#17 configs give Page-CUSUM
    // whatever is left of the per-signal budget after the betting half.
    const perSigBudget = alphaFamilyA / bonf;
    const alpha = perSig.betting_e_process_alpha !== undefined
        ? Math.max(perSigBudget - perSig.betting_e_process_alpha, perSigBudget * 0.5)
        : perSigBudget;
    return {
        signal,
        tau_squared: perSig.tau_squared,
        delta_min: perSig.delta_min,
        min_samples: 0, // CUSUM is perpetual; field retained for schema stability
        min_ticks_before_eligible: bake.min_ticks_before_eligible,
        min_observation_window: bake.min_observation_window,
        max_deploy_window_days: bake.max_deploy_window_days,
        alpha,
        derivation: {
            tau_multiplier: 0, // Week-2 legacy; retained for audit provenance
            empirical_variance: perSig.baseline_sigma_squared,
            // Q2.B.5 — propagate raw-space σ² for Page-CUSUM consumption.
            // Optional in MSPRTParams.derivation for backward compatibility.
            empirical_variance_raw: perSig.baseline_sigma_squared_raw,
            mean: perSig.baseline_mean,
            // Q2.A — propagate raw-space μ for Page-CUSUM consumption (Q2.B.5).
            mean_raw: perSig.baseline_mean_raw,
            std: Math.sqrt(perSig.baseline_sigma_squared),
            pooled,
            n_samples: cell.n_samples,
        },
    };
}
/** Retrieve the per-signal `MSPRTParams` for the cell matching `cell`.
 *  Navigates the Week-3 `baseline_cells` schema; returns null if Family A
 *  isn't compiled or the signal is absent.
 *
 *  Addition #23 — `cell.tenant_tier` routes the lookup through the tiered
 *  cell matrix. On miss, falls back to `'aggregate'` tier (handled by
 *  `matchCellByHour` internally). */
function lookupCellParams(cfg, cell, signal) {
    const bc = cfg.baseline_cells;
    if (!bc)
        return null;
    const match = (0, _page_cusum_core_1.matchCellByHour)(bc.cells, cell);
    if (!match)
        return null;
    return buildMSPRTParams(cfg, match, signal);
}
/** Addition #8 runtime consumer (W5 §S6): 'breaking' or 'observability_stack'
 *  suppresses Family A entirely — x_n against a mismatched baseline mean is
 *  garbage, so accumulating S_n is worse than silence. Emit one suppressed
 *  verdict per primary SLI so the audit shape is symmetric with bake-profile
 *  suppression; reason_code routes the family-level suppression_reason. */
function schemaContinuitySuppression(cfg, states, schemaContinuityClass) {
    const reason = schemaContinuityClass === 'observability_stack'
        ? 'observability_stack_deploy' : 'schema_continuity_breaking';
    const out = [];
    for (const signal of (cfg.family_a_signals ?? _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS)) {
        const state = (0, _page_cusum_core_1.getOrCreateCUSUM)(states, signal);
        out.push({
            verdict: 'suppressed',
            statistic: state.S,
            threshold: null,
            alpha_consumed: state.alphaConsumed,
            alpha_spent: 0,
            reason_code: reason,
            family: 'A',
            signal,
        });
    }
    return out;
}
/** Evaluate one primary SLI for the classical shadow path. Returns the
 *  verdict to push, or null when the signal should be skipped silently
 *  (missing live metric / cell params / cell mean). */
function evaluateShadowSignal(cfg, liveMetrics, states, ctx, cell, trafficGate, signal) {
    if (ctx.ignoredSignals?.has(signal)) {
        const state = (0, _page_cusum_core_1.getOrCreateCUSUM)(states, signal);
        return {
            verdict: 'suppressed',
            statistic: state.S,
            threshold: null,
            alpha_consumed: state.alphaConsumed,
            alpha_spent: 0,
            reason_code: 'ignore_threshold',
            family: 'A',
            signal,
            // Audit enrichment per ARCHITECT-REPLY-31: single-signal detector
            // has an unambiguous trigger — name it so downstream consumers
            // don't have to cross-reference operator config to reconstruct
            // which ignore-band caused the suppression.
            ignore_threshold_trigger_signal: signal,
        };
    }
    const params = lookupCellParams(cfg, cell, signal);
    if (!params)
        return null;
    const live = liveMetrics[signal];
    if (live === undefined)
        return null;
    // Q2.B.5 — Page-CUSUM operates on RAW observation space (no Q2.A
    // forward transform). Mean-centers against `mean_raw` (Q2.A added
    // for Q2.B.4 audit; now consumed at runtime by Page-CUSUM under
    // Q2.B.5). Falls through to transformed-space `mean` on pre-Q2.A
    // configs lacking `mean_raw`. Family A betting-e-process retains
    // its transformed-space (Q2.A) consumption — different runtime
    // contracts; no cross-class coherence requirement (see spec
    // §Architectural mechanism).
    const cellMeanRaw = params.derivation?.mean_raw
        ?? params.derivation?.mean;
    if (cellMeanRaw === undefined)
        return null;
    const x = live - cellMeanRaw;
    const state = (0, _page_cusum_core_1.getOrCreateCUSUM)(states, signal);
    return evaluateCUSUM({
        signal, params, state,
        trafficPct: ctx.trafficPct,
        trafficGate,
        ticksSinceDeploy: ctx.ticksSinceDeploy,
        deployAgeDays: ctx.deployAgeDays,
    }, x);
}
/** Per-tick shadow evaluator. For each primary SLI:
 *  1. Look up the cell params at `ctx.hourOfDay`.
 *  2. Compute x_n = live − cell baseline mean.
 *  3. Advance the CUSUM state (state must be supplied by caller).
 *  4. Emit `DetectorVerdict`.
 *
 *  Signals missing from either the live metrics map or the cell's params
 *  list are skipped silently — the engine runs on scenarios that may omit
 *  quality-tier signals. */
function evaluateFamilyAShadow(cfg, liveMetrics, states, ctx) {
    if (!cfg.baseline_cells)
        return [];
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'A')) {
        return schemaContinuitySuppression(cfg, states, ctx.schemaContinuityClass);
    }
    const trafficGate = (0, _page_cusum_core_1.trafficGateMin)(cfg);
    const cell = { hour_of_day: ctx.hourOfDay };
    if (ctx.dayOfWeek !== undefined)
        cell.day_of_week = ctx.dayOfWeek;
    cell.tenant_tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const out = [];
    for (const signal of _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS) {
        const v = evaluateShadowSignal(cfg, liveMetrics, states, ctx, cell, trafficGate, signal);
        if (v !== null)
            out.push(v);
    }
    return out;
}
//# sourceMappingURL=_page-cusum-classical.js.map