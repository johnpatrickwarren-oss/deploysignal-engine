"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// _page-cusum-core.ts — shared substrate for the Page-CUSUM detector
// modules: per-signal CUSUM state, the classical update step, cell
// matching, and the shared traffic-gate / primary-signal-set helpers.
// Split out of page-cusum.ts (god-file refactor); behavior preserved
// verbatim. The classical-path and mixture-path evaluators each import
// from here rather than from the page-cusum.ts facade to keep the
// import-graph acyclic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILY_A_PRIMARY_SIGNALS = exports.DEFAULT_BAKE = void 0;
exports.freshCUSUM = freshCUSUM;
exports.getOrCreateCUSUM = getOrCreateCUSUM;
exports.updateCUSUM = updateCUSUM;
exports.matchCellByHour = matchCellByHour;
exports.trafficGateMin = trafficGateMin;
exports.suppressed = suppressed;
exports.DEFAULT_BAKE = {
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
//# sourceMappingURL=_page-cusum-core.js.map