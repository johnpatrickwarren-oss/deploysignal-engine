"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/family-c-betting-e-process.ts (split)
// Sync policy: vendored-at-pin
//
// State factory + per-tick projection/gating helpers extracted VERBATIM
// from family-c-betting-e-process.ts. No behavior change.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LAMBDA_MAX = exports.LOG_FACTOR_FLOOR = void 0;
exports.freshFamilyCBettingEProcessState = freshFamilyCBettingEProcessState;
exports.liveVectorFamilyC = liveVectorFamilyC;
exports.familyCBakeProfile = familyCBakeProfile;
exports.suppressedVerdict = suppressedVerdict;
const hotelling_1 = require("./hotelling");
/** Numerical guard for Math.log(0) on wealth-factor underflow. Mirrors
 *  evaluateEMmd's WEALTH_FLOOR convention. */
exports.LOG_FACTOR_FLOOR = 1e-12;
/** Default λ_max if FamilyCBettingEProcessParams.lambda_max absent —
 *  canonical 0.5 per `ONSstrategy(F, lambda_max=0.5)` signature. */
exports.DEFAULT_LAMBDA_MAX = 0.5;
/** Initial wealth state for a new (deploy, cell) Q67 v2 evaluation.
 *
 *  `p` is the input dimension (Family C joint-vector size, typically 11).
 *  `D` is optional Q72 SLICE 2 RFF feature dimension; when provided,
 *  the state pre-allocates q_running_phi_sum ∈ R^D for the unbiased
 *  RFF witness path. Absent ⇒ legacy state shape (q_running_phi_sum
 *  not initialized; runtime falls back to biased streaming witness). */
function freshFamilyCBettingEProcessState(p, D) {
    const state = {
        log_S_t: 0, // S_0 = 1 ⇒ log_S_0 = 0
        ons_lambda: 0, // canonical λ_0 = 0 (no bet at start)
        ons_inverse_hessian: 1, // canonical A_0 = 1 (implicit regularization)
        n: 0,
        witness_running_max: 0,
        q_running_sum: new Array(p).fill(0),
        q_count: 0,
        fired: false,
        tick_at_first_fire: null,
        alphaConsumed: 0,
    };
    if (D !== undefined && D > 0) {
        state.q_running_phi_sum = new Array(D).fill(0);
    }
    return state;
}
/** Project live metrics into the Family C relative-deviation vector.
 *  Returns null when any consumed signal is missing (detector skips that
 *  tick) — same convention as evaluateEMmd / evaluateSequentialMMD. */
function liveVectorFamilyC(liveMetrics, mean, signals) {
    const p = signals.length;
    const v = new Array(p);
    for (let i = 0; i < p; i++) {
        const live = liveMetrics[signals[i]];
        if (live === undefined)
            return null;
        const m = mean[i];
        v[i] = Math.abs(m) > 1e-12 ? (live - m) / m : (live - m);
    }
    return v;
}
/** Most-constrained bake profile across Family C signals. Local copy
 *  (mirrors sequential-mmd.ts mmdBakeProfile) so this detector doesn't
 *  pull a private export from sibling. */
function familyCBakeProfile(cfg) {
    const profiles = cfg.bake_profiles ?? {};
    let maxMinTicks = 0;
    let maxMaxDays = Infinity;
    let any = false;
    const signals = cfg.family_c_signals ?? hotelling_1.FAMILY_C_SIGNALS;
    for (const sig of signals) {
        const p = profiles[sig];
        if (!p)
            continue;
        any = true;
        if (p.min_ticks_before_eligible > maxMinTicks)
            maxMinTicks = p.min_ticks_before_eligible;
        if (p.max_deploy_window_days < maxMaxDays)
            maxMaxDays = p.max_deploy_window_days;
    }
    if (!any)
        return { min_ticks: 3, max_days: 1 };
    return { min_ticks: maxMinTicks, max_days: Number.isFinite(maxMaxDays) ? maxMaxDays : 1 };
}
function suppressedVerdict(reason, threshold, statistic) {
    return {
        verdict: 'suppressed', statistic, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: reason, family: 'C',
        signal: 'sequential_mmd_betting_e_process',
    };
}
//# sourceMappingURL=_family-c-betting-state.js.map