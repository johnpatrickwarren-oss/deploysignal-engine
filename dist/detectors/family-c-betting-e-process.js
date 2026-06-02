"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/family-c-betting-e-process.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.freshFamilyCBettingEProcessState = exports.onsUpdate = exports.computeKernelMMDWitness = exports.computeRffWitness = void 0;
exports.evaluateFamilyCBettingEProcess = evaluateFamilyCBettingEProcess;
const types_1 = require("../types");
const schema_continuity_1 = require("../l0/schema-continuity");
const hotelling_1 = require("./hotelling");
const page_cusum_1 = require("./page-cusum");
const sequential_mmd_1 = require("./sequential-mmd");
const _q72_trace_1 = require("./_q72-trace");
const family_c_rff_1 = require("./family-c-rff");
const _family_c_betting_witness_1 = require("./_family-c-betting-witness");
const _family_c_betting_state_1 = require("./_family-c-betting-state");
// ── Public export surface (re-export facade; paths unchanged) ───────────
var _family_c_betting_witness_2 = require("./_family-c-betting-witness");
Object.defineProperty(exports, "computeRffWitness", { enumerable: true, get: function () { return _family_c_betting_witness_2.computeRffWitness; } });
Object.defineProperty(exports, "computeKernelMMDWitness", { enumerable: true, get: function () { return _family_c_betting_witness_2.computeKernelMMDWitness; } });
Object.defineProperty(exports, "onsUpdate", { enumerable: true, get: function () { return _family_c_betting_witness_2.onsUpdate; } });
var _family_c_betting_state_2 = require("./_family-c-betting-state");
Object.defineProperty(exports, "freshFamilyCBettingEProcessState", { enumerable: true, get: function () { return _family_c_betting_state_2.freshFamilyCBettingEProcessState; } });
/** Cell lookup + schema-continuity / bake / traffic gating + live-vector
 *  projection. Returns a discriminated result: continue to evaluation,
 *  return a short-circuit verdict, or skip (null) this tick. Mirrors the
 *  original early-return ladder verbatim. */
function setupBettingEval(cfg, liveMetrics, ctx) {
    if (!cfg.baseline_cells)
        return { kind: 'skip' };
    const tier = (0, types_1.resolveTenantTier)(cfg, ctx.tenantId);
    const lookup = (0, hotelling_1.lookupFamilyCParams)(cfg, {
        hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek, tenant_tier: tier,
    });
    if (!lookup)
        return { kind: 'skip' };
    const params = lookup.params;
    // Q68 Phase-3.d.C consolidation — `mmd_variant` flag retired; Family C
    // MMD dispatch is unconditional Ville-bounded variant. Detector self-
    // gates on `betting_e_process_params` presence (Q67 v2 compile output).
    const bp = params.betting_e_process_params;
    if (!bp)
        return { kind: 'skip' }; // cell not compiled with Q67 params (pre-Phase-3.d.B)
    const lambdaMax = bp.lambda_max ?? _family_c_betting_state_1.DEFAULT_LAMBDA_MAX;
    const log_threshold = -Math.log(bp.alpha); // log(1/α); compare in log-space
    // Schema continuity suppression — same rule as sibling Family C
    // detectors (Family C as a whole suppresses on breaking schema; #8).
    if (ctx.schemaContinuityClass && (0, schema_continuity_1.shouldSuppress)(ctx.schemaContinuityClass, 'C')) {
        return { kind: 'verdict', verdict: (0, _family_c_betting_state_1.suppressedVerdict)(ctx.schemaContinuityClass === 'observability_stack'
                ? 'observability_stack_deploy' : 'schema_continuity_breaking', Math.exp(log_threshold), null) };
    }
    // Bake-profile + age gate — same most-constrained profile as Hotelling.
    const bake = (0, _family_c_betting_state_1.familyCBakeProfile)(cfg);
    const threshold = Math.exp(log_threshold);
    if (ctx.ticksSinceDeploy < bake.min_ticks)
        return { kind: 'verdict', verdict: (0, _family_c_betting_state_1.suppressedVerdict)('bake_profile_not_met', threshold, null) };
    if (ctx.deployAgeDays > bake.max_days)
        return { kind: 'verdict', verdict: (0, _family_c_betting_state_1.suppressedVerdict)('bake_profile_not_met', threshold, null) };
    if (ctx.trafficPct < (0, page_cusum_1.trafficGateMin)(cfg))
        return { kind: 'verdict', verdict: (0, _family_c_betting_state_1.suppressedVerdict)('traffic_pct_below_gate', threshold, null) };
    // Project live metrics into the Family C relative-deviation vector.
    const v = (0, _family_c_betting_state_1.liveVectorFamilyC)(liveMetrics, params.mean_vector, cfg.family_c_signals ?? hotelling_1.FAMILY_C_SIGNALS);
    if (v === null)
        return { kind: 'skip' };
    // Q72 SLICE 2 — RFF mode active when calibrator stamped baseline_rff_mean.
    // Falls through to legacy biased streaming witness when absent (preserves
    // replay of pre-Q72-SLICE-2 audit logs).
    const rffActive = bp.baseline_rff_mean !== undefined && bp.baseline_rff_mean.length > 0;
    const D = rffActive ? (bp.rff_dim ?? family_c_rff_1.RFF_DEFAULT_DIM) : 0;
    return { kind: 'eval', setup: { params, bp, tier, lambdaMax, threshold, log_threshold, v, rffActive, D } };
}
/** Resolve (creating + caching as needed) the per-cell state, RFF feature
 *  map, and baseline pool from the caller's state bag. Mirrors evaluateEMmd's
 *  stateKey / poolKey caching verbatim. */
function resolveBettingResources(states, setup, ctx) {
    const { bp, tier, v, rffActive, D } = setup;
    // Per-(tier, hour, day) state. Mirrors evaluateEMmd's stateKey pattern.
    const stateKey = `__fc_betting_${tier ?? 'none'}_${ctx.hourOfDay}_${ctx.dayOfWeek ?? -1}`;
    let state = states[stateKey];
    if (!state || typeof state.log_S_t !== 'number') {
        state = (0, _family_c_betting_state_1.freshFamilyCBettingEProcessState)(v.length, rffActive ? D : undefined);
        states[stateKey] = state;
    }
    // Lazy init for Q72 SLICE 2 RFF state when state was created pre-RFF
    // but cell config now carries RFF params (e.g., calibrator recompiled).
    if (rffActive && state.q_running_phi_sum === undefined) {
        state.q_running_phi_sum = new Array(D).fill(0);
    }
    // Q72 SLICE 2 — RFF feature map cached per cell by stateKey + rff_seed.
    // Recomputed deterministically from seed if cache absent (e.g., first
    // dispatch after process boot). Same seed produces byte-identical
    // ω + b across Darwin/Linux per cross-platform-determinism gate.
    const fmKey = `__rff_fm_${stateKey}`;
    let fm;
    if (rffActive) {
        fm = states[fmKey];
        if (!fm) {
            fm = (0, family_c_rff_1.computeRffFeatureMap)(bp.rff_seed ?? 0, D, v.length, bp.kernel_bandwidth_sigma);
            states[fmKey] = fm;
        }
    }
    // Baseline pool — reuse Sequential MMD's pseudo-sampling (Cholesky·w).
    // Cache by cell key; same seed function as evaluateEMmd / evaluateSequentialMMD
    // so all three variants agree on the P-side reference set under shadow-compare.
    // RFF mode skips building the pool at runtime (μ_P^φ is precomputed at
    // calibration time and stored in bp.baseline_rff_mean) — pool is only
    // needed for the legacy streaming-witness path.
    const poolKey = `__mmd_pool_${ctx.hourOfDay}_${ctx.dayOfWeek ?? -1}`;
    let pool = states[poolKey];
    if (!rffActive && (!pool || pool.length === 0)) {
        const poolSize = bp.baseline_sample_size && bp.baseline_sample_size > 0
            ? bp.baseline_sample_size : sequential_mmd_1.BASELINE_POOL_SIZE;
        pool = (0, sequential_mmd_1.generateBaselinePool)(setup.params, poolSize, (0, sequential_mmd_1.baselinePoolSeed)({ hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek }));
        states[poolKey] = pool;
    }
    return { state, fm, pool, stateKey };
}
function q72CapturePre(state, setup, pool, stateKey) {
    const { bp, v, rffActive } = setup;
    if ((0, _q72_trace_1.q72TraceEnabled)()) {
        (0, _q72_trace_1.q72EmitProcessHeader)();
        (0, _q72_trace_1.q72EmitCellHeader)(stateKey, {
            kernel_bandwidth_sigma: bp.kernel_bandwidth_sigma,
            lambda_max: bp.lambda_max,
            betting_strategy: bp.betting_strategy,
            ons_initial_lambda: bp.ons_initial_lambda,
            alpha: bp.alpha,
            baseline_sample_size: bp.baseline_sample_size,
            rff_active: rffActive,
            rff_seed: bp.rff_seed,
            rff_dim: bp.rff_dim,
        }, rffActive ? [] : (pool ?? []).slice(0, 5), rffActive ? 0 : (pool?.length ?? 0));
    }
    const pre = {
        log_S_t_pre: state.log_S_t,
        lambda_pre: state.ons_lambda,
        hessian_pre: state.ons_inverse_hessian,
        witness_max_pre: state.witness_running_max,
        q_count_pre: state.q_count,
        q_sum_hash: 0,
        v_sum: 0,
        tick_id: state.n, // pre-increment value
    };
    if ((0, _q72_trace_1.q72TraceEnabled)()) {
        if (rffActive && state.q_running_phi_sum) {
            for (const x of state.q_running_phi_sum)
                pre.q_sum_hash += x;
        }
        else {
            for (const x of state.q_running_sum)
                pre.q_sum_hash += x;
        }
        for (const x of v)
            pre.v_sum += x;
    }
    return pre;
}
/** Per-tick core: predictable witness F_t, log-space wealth update, ONS bet
 *  update, then streaming Q-side bookkeeping + witness running-max. Mutates
 *  `state` exactly as the original inline block. Returns the values the fire
 *  check + trace emission need. */
function stepBettingTick(state, setup, fm, pool) {
    const { bp, v, lambdaMax, rffActive } = setup;
    // ── Predictable witness F_t ────────────────────────────────────────
    // Computed BEFORE q_running_sum / q_running_phi_sum mutation — F_t is
    // F_{t-1}-measurable.
    let F_t;
    let phi_x = null;
    if (rffActive && fm && bp.baseline_rff_mean && state.q_running_phi_sum) {
        // Q72 SLICE 2 unbiased RFF witness: F_t = φ(x_t) · (μ_P^φ - μ_Q^φ).
        const w = (0, _family_c_betting_witness_1.computeRffWitness)(v, bp.baseline_rff_mean, state.q_running_phi_sum, state.q_count, fm);
        F_t = w.F_t;
        phi_x = w.phi_x;
    }
    else {
        // Legacy biased streaming witness (Q67 §Q67.4-ter; pre-Q72-SLICE-2
        // configs only — backward-compat for replay of pre-fix audit logs).
        F_t = (0, _family_c_betting_witness_1.computeKernelMMDWitness)(v, pool ?? [], state.q_running_sum, state.q_count, bp.kernel_bandwidth_sigma, state.witness_running_max, state.n);
    }
    // ── Wealth update: log_S_t += log(1 + λ_{t−1}·F_t) ──────────────────
    // Log-space comparison avoids exp(log_S_t) overflow at large wealth.
    const wealth_factor = 1 + state.ons_lambda * F_t;
    const log_factor = Math.log(Math.max(wealth_factor, _family_c_betting_state_1.LOG_FACTOR_FLOOR));
    state.log_S_t += log_factor;
    // ── ONS bet update for next tick (predictable; uses current F_t) ────
    (0, _family_c_betting_witness_1.onsUpdate)(state, F_t, lambdaMax);
    // ── Streaming Q-side bookkeeping (mutate AFTER witness computation) ──
    if (rffActive && phi_x && state.q_running_phi_sum) {
        // Q72 SLICE 2: update RFF Q-side empirical-mean numerator with this
        // tick's φ(x_t). The legacy q_running_sum is also updated to keep
        // pre-Q72-SLICE-2 audit-replay state coherent (ignored by the RFF
        // witness path).
        const phiSum = state.q_running_phi_sum;
        for (let i = 0; i < phi_x.length; i++)
            phiSum[i] += phi_x[i];
    }
    for (let i = 0; i < v.length; i++)
        state.q_running_sum[i] += v[i];
    state.q_count += 1;
    state.n += 1;
    // Update witness running-max (used by next tick's normalization at n>10).
    const absF = Math.abs(F_t);
    if (absF > state.witness_running_max)
        state.witness_running_max = absF;
    return { F_t, wealth_factor, log_factor };
}
/** Ville-bound fire check (log-space) → DetectorVerdict, plus the trace
 *  bookkeeping fields. Mutates fire/alpha state exactly as original. */
function bettingFireCheck(state, setup) {
    const { bp, log_threshold, threshold } = setup;
    // Materialize S_t for audit visibility; use Math.exp guarded against
    // inf overflow at extreme wealth (rare but real on prolonged H₁ runs).
    const S_t_audit = state.log_S_t > 700 ? Number.MAX_VALUE : Math.exp(state.log_S_t);
    if (state.log_S_t >= log_threshold) {
        const alphaSpent = Math.max(0, bp.alpha - state.alphaConsumed);
        state.alphaConsumed = bp.alpha;
        let firedThisTick = false;
        if (!state.fired) {
            state.fired = true;
            state.tick_at_first_fire = state.n;
            firedThisTick = true;
        }
        return {
            result: {
                verdict: 'fire', statistic: S_t_audit, threshold,
                alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
                reason_code: 'family_c_betting_wealth_exceeded',
                family: 'C',
                signal: 'sequential_mmd_betting_e_process',
            },
            verdictLabel: 'fire', firedThisTick, S_t_audit,
        };
    }
    return {
        result: {
            verdict: 'clean', statistic: S_t_audit, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'below_threshold', family: 'C',
            signal: 'sequential_mmd_betting_e_process',
        },
        verdictLabel: 'clean', firedThisTick: false, S_t_audit,
    };
}
/** Evaluate the canonical Shekhar-Ramdas-2023 betting-e-process variant
 *  at one tick. Pattern mirrors `evaluateEMmd`: shared cell lookup +
 *  bake-profile guard + traffic gate + schema-continuity suppression.
 *  Returns null when:
 *    - cfg.baseline_cells absent (pre-#18 config)
 *    - cell lookup fails
 *    - cell tagged with mmd_variant !== 'betting_e_process' (dispatcher route)
 *    - cell missing betting_e_process_params (pre-Q67 config or non-applicable cell)
 *    - liveMetrics missing any Family C signal */
function evaluateFamilyCBettingEProcess(cfg, liveMetrics, states, ctx) {
    const setupResult = setupBettingEval(cfg, liveMetrics, ctx);
    if (setupResult.kind === 'skip')
        return null;
    if (setupResult.kind === 'verdict')
        return setupResult.verdict;
    const setup = setupResult.setup;
    const { v } = setup;
    const { state, fm, pool, stateKey } = resolveBettingResources(states, setup, ctx);
    // Q72 trace — capture pre-state BEFORE any mutation + emit headers.
    const pre = q72CapturePre(state, setup, pool, stateKey);
    // Per-tick core: witness → wealth → ONS → bookkeeping.
    const { F_t, wealth_factor, log_factor } = stepBettingTick(state, setup, fm, pool);
    // Ville-bound fire check.
    const { result, verdictLabel, firedThisTick } = bettingFireCheck(state, setup);
    // Q72 Phase 1 instrumentation — emit per-tick record AFTER all
    // mutations. Captures pre + post state + computed-this-tick deltas.
    if ((0, _q72_trace_1.q72TraceEnabled)()) {
        (0, _q72_trace_1.q72EmitTick)({
            cell_key: stateKey,
            tick_id: pre.tick_id,
            log_S_t_pre: pre.log_S_t_pre,
            ons_lambda_pre: pre.lambda_pre,
            ons_inverse_hessian_pre: pre.hessian_pre,
            witness_running_max: pre.witness_max_pre,
            q_count: pre.q_count_pre,
            q_running_sum_hash: pre.q_sum_hash,
            v_first_3: v.slice(0, 3),
            v_sum: pre.v_sum,
            F_t,
            wealth_factor,
            log_factor,
            log_S_t_post: state.log_S_t,
            ons_lambda_post: state.ons_lambda,
            ons_inverse_hessian_post: state.ons_inverse_hessian,
            verdict: verdictLabel,
            fired_this_tick: firedThisTick,
        });
    }
    return result;
}
//# sourceMappingURL=family-c-betting-e-process.js.map