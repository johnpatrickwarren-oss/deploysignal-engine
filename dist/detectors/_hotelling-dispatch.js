"use strict";
// engine/detectors/_hotelling-dispatch.ts — Family C variant dispatch maps.
//
// Split out of `hotelling.ts` (god-file decomposition). Internals moved
// VERBATIM; `hotelling.ts` re-exports `_HOTELLING_EVALUATORS_FOR_TEST`
// and `_hotellingVariantForDispatch` so the public import surface is
// unchanged.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOTELLING_EVALUATORS = void 0;
exports.hotellingVariantForDispatch = hotellingVariantForDispatch;
const _hotelling_core_1 = require("./_hotelling-core");
const _hotelling_safe_1 = require("./_hotelling-safe");
/** Chi-square (Wilson-Hilferty) per-tick T² test — the pre-#20 default.
 *  Stateless; statistic is (x − μ)ᵀ Σ⁻¹ (x − μ). */
function evaluateHotellingChiSquare(ctx) {
    const { params, r, alphaHotelling, threshold } = ctx;
    const t2 = (0, _hotelling_core_1.hotellingT2)(r, params.covariance);
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
        state = (0, _hotelling_safe_1.freshSafeHotellingState)();
        states[cellKey] = state;
    }
    return (0, _hotelling_safe_1.evaluateSafeHotelling)({ cell: params, alpha: params.safe_hotelling_params.alpha }, r, state);
}
/** Variant→evaluator dispatch map. Adding a variant = adding a key. */
exports.HOTELLING_EVALUATORS = {
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
//# sourceMappingURL=_hotelling-dispatch.js.map