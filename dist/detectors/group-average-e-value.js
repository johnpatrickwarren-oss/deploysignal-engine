"use strict";
// detectors/group-average-e-value.ts — the group-average e-value (K2 candidate).
//
// K2 = group-in-unison drift (validation/coverage/PREREGISTRATION.md §1, §5): a shift shared, from
// the same onset, across K series. groupAverageEValue is the terminal read the coverage battery
// scores on K2 cells: it composes K per-series terminal e-values (safe-t,
// detectors/safe-t-e-value.ts, one call per series over that series' own calibration/test split)
// into a single group e-value — the arithmetic mean.
//
// THEOREM (why the mean is valid, not merely convenient). If E_1..E_K are each e-values for their
// own null, then (1/K)*sum(E_i) is an e-value under ARBITRARY DEPENDENCE among the E_i — no
// independence or known-correlation assumption required. Vovk & Wang (2021) §4: averaging (the
// canonical convex combination) is admissible, and the only admissible symmetric combination rule
// absent further information about the components or their dependence. Source:
// ~/concord/knowledge/stats/pages/e-value.md, "Combining e-values" — "Averaging survives arbitrary
// dependence... This generalises to any convex combination or mixture, provided the weights are
// chosen without looking at the data." Uniform weights 1/K are fixed ex ante here (K = the number
// of series in the group, not data-dependent), so the theorem applies directly. That page also
// flags (per the Lean formalisation) that the machine-checked result is the SUB-convex case
// sum(w_i) <= 1; uniform weights 1/K sum to exactly 1, the boundary of that case, so this is still
// covered.
//
// Validity of the GROUP mean inherits from validity of each COMPONENT, not from the averaging step
// itself (the averaging step is unconditionally valid; the components might not be). The shipped
// component is safe-t (detectors/safe-t-e-value.ts): valid at known-phi <= 0.95, estimated
// baseline (SAFE_T_ENVELOPE there). A group read is no more valid than its worst input.
//
// AUDITED COMBINER, WRAPPED, NOT RE-DERIVED. fleet/combine.ts's combineAverage already implements
// this exact reduction (same Vovk-Wang 2021 §4 citation) for the engine's hierarchical fleet-merge
// path (Tessera SLICE 3 / R11; PR-F1 evidence matrix at test/q11-hierarchical-e-value-combination.test.ts
// empirically validates its AoE-iid and AoE-correlated cells against the Wilson-CI FPR bound). This
// module converts plain e-values to/from that primitive's log-space representation rather than
// re-implementing the average from scratch. Log-space is not just reuse for its own sake: component
// e-values here can be astronomically large (detectors/safe-t-e-value.ts's phi-floor discussion
// records estimated-phi e-values many orders of magnitude above 1), and combineAverage's
// logSumExp-with-max-shift avoids the overflow a naive linear-space sum risks at that range.
//
// This module adds the plain-e-value input contract fleet/combine.ts's log-space, fleet-internal
// callers don't need: it throws on empty input and on any component that is negative or NaN (a raw
// e-value is nonnegative by definition — garbage in must be an error, not a silently-wrong number).
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupAverageEValue = groupAverageEValue;
const combine_1 = require("../fleet/combine");
/**
 * Arithmetic mean of K component e-values. An e-value under arbitrary dependence of the components
 * (see file header). Throws on empty input, or on any component that is negative or NaN.
 */
function groupAverageEValue(eValues) {
    if (eValues.length === 0) {
        throw new Error('groupAverageEValue: empty input array (group-average of K=0 components is undefined)');
    }
    for (const e of eValues) {
        if (Number.isNaN(e) || e < 0) {
            throw new Error(`groupAverageEValue: every component must be a nonnegative number (not NaN); got ${e}`);
        }
    }
    const logEValues = eValues.map((e) => Math.log(e));
    const { log_fleet_e } = (0, combine_1.combineAverage)(logEValues);
    return Math.exp(log_fleet_e);
}
//# sourceMappingURL=group-average-e-value.js.map