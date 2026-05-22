"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILY_A_PRIMARY_SIGNALS = void 0;
exports.freshCUSUM = freshCUSUM;
exports.getOrCreateCUSUM = getOrCreateCUSUM;
exports.updateCUSUM = updateCUSUM;
exports.evaluateCUSUM = evaluateCUSUM;
exports.lookupCellParams = lookupCellParams;
exports.trafficGateMin = trafficGateMin;
exports.evaluateFamilyAShadow = evaluateFamilyAShadow;
exports.evaluateFamilyAShadowMixture = evaluateFamilyAShadowMixture;
exports.evaluateFamilyA = evaluateFamilyA;
const types_1 = require("../types");
const schema_continuity_1 = require("../l0/schema-continuity");
const family_a_mixture_supermartingale_1 = require("./family-a-mixture-supermartingale");
// Q2.A — see betting-e-process.ts for the symmetric runtime dispatch
// rationale; both Family A detectors apply the same class transform to
// live observations so cellMean (in transformed space post-Q2.A
// calibration) and live observations are in the same space at
// standardization time. Runtime honors only declared classes;
// pre-Q2.A configs default to identity (gaussian_like).
// Q2.B.5: Page-CUSUM no longer applies the Q2.A forward transform at
// runtime; consumes raw-space σ² from `empirical_variance_raw` (derived
// from blended Σ_C diagonal at compile time). The signal-classes import
// is retained as a no-op for now in case a future revision needs it
// (and to keep the import-graph stable for downstream consumers).
const signal_classes_1 = require("../signal-classes");
void signal_classes_1.transformForClass;
// Family A default bake profile (Addition #4 table). Used when the
// compiled config doesn't carry a profile for a signal — guards against
// partially-populated configs and legacy (W2) configs without the
// `bake_profiles` block.
const DEFAULT_BAKE = {
    min_ticks_before_eligible: 3,
    min_observation_window: 3,
    max_deploy_window_days: 1,
};
function freshCUSUM() {
    return { S: 0, n: 0, alphaConsumed: 0 };
}
function getOrCreateCUSUM(states, signal) {
    const s = states[signal];
    if (s)
        return s;
    const fresh = freshCUSUM();
    states[signal] = fresh;
    return fresh;
}
/** Page-CUSUM update. Mutates `state` in place and returns the new S_n. */
function updateCUSUM(state, x, sigmaSquared, tauSquared, perTickAlpha) {
    // Guard against a degenerate cell (σ² = 0). If the cell has no
    // variance, any non-zero x_n is infinitely surprising under H₀ — the
    // correct behavior is immediate fire. The compiler applies a τ²
    // derivation that cannot be exactly zero (τ² = δ_min² / 4 and δ_min has
    // a 5% × mean floor), but σ² can be 0 if the generator clamps. Treat
    // σ² = 0 as "use τ² alone" — the mixture degenerates to a flat prior on
    // the shifted mean and z_n collapses to x²/(2τ²).
    let z;
    if (sigmaSquared <= 0) {
        if (tauSquared <= 0)
            z = 0;
        else
            z = (x * x) / (2 * tauSquared);
    }
    else {
        const denom = sigmaSquared + tauSquared;
        const logShrink = 0.5 * Math.log(sigmaSquared / denom);
        const quad = (x * x * tauSquared) / (2 * sigmaSquared * denom);
        z = logShrink + quad;
    }
    state.S = Math.max(0, state.S + z);
    state.n += 1;
    state.alphaConsumed += perTickAlpha;
    return state.S;
}
function suppressed(signal, reason, state, threshold) {
    // Suppressed verdicts expose the current S_n so the shadow-compare
    // audit output can trace pre-eligibility accumulation. Not a fire, not
    // a clean — the caller treats this as "do not action".
    return {
        verdict: 'suppressed',
        statistic: state.S,
        threshold,
        alpha_consumed: state.alphaConsumed,
        alpha_spent: 0,
        reason_code: reason,
        family: 'A',
        signal,
    };
}
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
    updateCUSUM(state, x, sigmaSquared, params.tau_squared, params.alpha);
    const threshold = -Math.log(params.alpha);
    if (input.ticksSinceDeploy < params.min_ticks_before_eligible) {
        return suppressed(signal, 'bake_profile_not_met', state, threshold);
    }
    // Addition #4 clause 2 — n_post_deploy_samples >= min_observation_window.
    // Wired in W4 §4.1.h per ARCHITECT-REPLY-12 S2 landing. Often equivalent
    // to clause 1 on fast-fire signals (p99 3/3/1), but does real work on
    // slower signals like cost_req (8/8/7). `state.n` is the post-update
    // post-deploy sample count — checked after updateCUSUM, so the current
    // sample is included.
    if (state.n < params.min_observation_window) {
        return suppressed(signal, 'bake_profile_not_met', state, threshold);
    }
    if (input.deployAgeDays > params.max_deploy_window_days) {
        return suppressed(signal, 'bake_profile_not_met', state, threshold);
    }
    if (input.trafficPct < input.trafficGate) {
        return suppressed(signal, 'traffic_pct_below_gate', state, threshold);
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
/** Match a cell by `hour_of_day` (and `day_of_week` when present). Returns
 *  the first cell whose key agrees on every dimension supplied in `query`.
 *  Extra dimensions on the stored cell are ignored; extra dimensions on
 *  the query are respected (strict subset match).
 *
 *  Addition #23 — `tenant_tier` on the query participates in the match when
 *  the stored cell also carries a `tenant_tier`. Two-stage match: first
 *  attempt the requested tier; if no cell carries it, fall back to
 *  `'aggregate'` tier (pre-#23 backward compat). Cells without a
 *  `tenant_tier` key compare equal to any query tier (pre-#23 config
 *  shape keeps working). */
function matchCellByHour(cells, query) {
    const matchOne = (tier) => cells.find((c) => {
        if (c.key.hour_of_day !== query.hour_of_day)
            return false;
        if (query.day_of_week !== undefined && c.key.day_of_week !== undefined) {
            if (c.key.day_of_week !== query.day_of_week)
                return false;
        }
        if (tier !== undefined && c.key.tenant_tier !== undefined) {
            if (c.key.tenant_tier !== tier)
                return false;
        }
        return true;
    });
    const direct = matchOne(query.tenant_tier);
    if (direct)
        return direct;
    if (query.tenant_tier !== undefined && query.tenant_tier !== 'aggregate') {
        return matchOne('aggregate');
    }
    return undefined;
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
    const bake = cfg.bake_profiles?.[signal] ?? DEFAULT_BAKE;
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
    const match = matchCellByHour(bc.cells, cell);
    if (!match)
        return null;
    return buildMSPRTParams(cfg, match, signal);
}
/** `traffic_pct_gate.min_traffic_pct_for_fire` or 0 if gate not compiled. */
function trafficGateMin(cfg) {
    return cfg.traffic_pct_gate?.min_traffic_pct_for_fire ?? 0;
}
/** Primary SLIs covered by Week-2 Family A. Kept in one place so health.ts,
 *  the compiler, and the parity test agree on the set. */
exports.FAMILY_A_PRIMARY_SIGNALS = [
    'p99_latency', 'ttft', 'eval_score', 'tool_success_rate',
    'downstream_err', 'cost_req',
];
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
    // Addition #8 runtime consumer (W5 §S6): 'breaking' or 'observability_stack'
    // suppresses Family A entirely — x_n against a mismatched baseline mean is
    // garbage, so accumulating S_n is worse than silence. Emit one suppressed
    // verdict per primary SLI so the audit shape is symmetric with bake-profile
    // suppression; reason_code routes the family-level suppression_reason.
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'A')) {
        const reason = ctx.schemaContinuityClass === 'observability_stack'
            ? 'observability_stack_deploy' : 'schema_continuity_breaking';
        const out = [];
        for (const signal of (cfg.family_a_signals ?? exports.FAMILY_A_PRIMARY_SIGNALS)) {
            const state = getOrCreateCUSUM(states, signal);
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
    const trafficGate = trafficGateMin(cfg);
    const cell = { hour_of_day: ctx.hourOfDay };
    if (ctx.dayOfWeek !== undefined)
        cell.day_of_week = ctx.dayOfWeek;
    cell.tenant_tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const out = [];
    for (const signal of exports.FAMILY_A_PRIMARY_SIGNALS) {
        if (ctx.ignoredSignals?.has(signal)) {
            const state = getOrCreateCUSUM(states, signal);
            out.push({
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
            });
            continue;
        }
        const params = lookupCellParams(cfg, cell, signal);
        if (!params)
            continue;
        const live = liveMetrics[signal];
        if (live === undefined)
            continue;
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
            continue;
        const x = live - cellMeanRaw;
        const state = getOrCreateCUSUM(states, signal);
        const v = evaluateCUSUM({
            signal, params, state,
            trafficPct: ctx.trafficPct,
            trafficGate,
            ticksSinceDeploy: ctx.ticksSinceDeploy,
            deployAgeDays: ctx.deployAgeDays,
        }, x);
        out.push(v);
    }
    return out;
}
/** Resolve `FamilyAPerSignalParams` for the mixture-supermartingale path.
 *  Mirrors `lookupCellParams` cell-matching but returns the raw per-signal
 *  shape (mixture_supermartingale_params + ar1_phi + baseline_*_raw) rather
 *  than the classical-CUSUM `MSPRTParams` view-model. */
function lookupFamilyAPerSignal(cfg, cell, signal) {
    const bc = cfg.baseline_cells;
    if (!bc)
        return null;
    const match = matchCellByHour(bc.cells, cell);
    if (!match)
        return null;
    let perSig = match.family_A?.per_signal[signal];
    const aggregateFallback = match.confidence === 'aggregate' || match.confidence === 'none';
    if (!perSig && aggregateFallback) {
        perSig = bc.aggregate_fallback.family_A?.per_signal[signal];
    }
    return perSig ?? null;
}
/** Per-tick mixture-supermartingale Page-CUSUM evaluator. Parallel to
 *  `evaluateFamilyAShadow` (classical) but consumes the Howard-Ramdas-2021
 *  Ville-bounded variant + AR(1) pre-whitening (Q66.A.b H1'). */
function evaluateFamilyAShadowMixture(cfg, liveMetrics, states, ctx) {
    if (!cfg.baseline_cells)
        return [];
    // Schema-continuity suppression mirrors classical path for symmetry.
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'A')) {
        const reason = ctx.schemaContinuityClass === 'observability_stack'
            ? 'observability_stack_deploy' : 'schema_continuity_breaking';
        const out = [];
        for (const signal of (cfg.family_a_signals ?? exports.FAMILY_A_PRIMARY_SIGNALS)) {
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
    const trafficGate = trafficGateMin(cfg);
    const cell = { hour_of_day: ctx.hourOfDay };
    if (ctx.dayOfWeek !== undefined)
        cell.day_of_week = ctx.dayOfWeek;
    cell.tenant_tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const out = [];
    const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
    const bonf = cfg.bonferroni_factor ?? 6;
    for (const signal of exports.FAMILY_A_PRIMARY_SIGNALS) {
        if (ctx.ignoredSignals?.has(signal)) {
            const state = states[signal] ?? (0, family_a_mixture_supermartingale_1.freshMixtureSupermartingaleState)();
            states[signal] = state;
            out.push({
                verdict: 'suppressed',
                statistic: state.M_t,
                threshold: null,
                alpha_consumed: 0,
                alpha_spent: 0,
                reason_code: 'ignore_threshold',
                family: 'A',
                signal,
                ignore_threshold_trigger_signal: signal,
            });
            continue;
        }
        const perSig = lookupFamilyAPerSignal(cfg, cell, signal);
        if (!perSig)
            continue;
        const live = liveMetrics[signal];
        if (live === undefined)
            continue;
        // Mixture-supermartingale operates on RAW observation space (Q2.B.5):
        // x_centered = live − baseline_mean_raw. Falls through to baseline_mean
        // (transformed) on pre-Q2.A configs.
        const baselineMeanRaw = perSig.baseline_mean_raw ?? perSig.baseline_mean;
        if (baselineMeanRaw === undefined)
            continue;
        const sigmaSquared = perSig.baseline_sigma_squared_raw
            ?? perSig.baseline_sigma_squared;
        if (sigmaSquared === undefined)
            continue;
        // Resolve mixture params: prefer compile-time stamp; derive on-the-fly
        // for pre-Phase-3.d.A-close configs lacking the field.
        const mixtureParams = perSig.mixture_supermartingale_params
            ?? (0, family_a_mixture_supermartingale_1.deriveMixtureSupermartingaleParams)(perSig);
        if (!mixtureParams)
            continue;
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
        out.push({
            verdict: result.fire ? 'fire' : (state.S_t !== 0 ? 'indeterminate' : 'clean'),
            statistic: result.M_t,
            threshold: result.threshold,
            alpha_consumed: result.fire ? alpha : 0,
            alpha_spent: result.fire ? alpha : 0,
            reason_code: result.fire ? 'cusum_exceeded_threshold' : 'accumulating',
            family: 'A',
            signal,
        });
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
//# sourceMappingURL=page-cusum.js.map