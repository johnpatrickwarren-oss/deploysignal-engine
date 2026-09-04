"use strict";
// engine/fleet/e-by.ts — the e-BY procedure for false-coverage control (ADR 0030, C62 b).
//
// Ramdas–Wang 2025 Definition 13.6 / Theorem 13.7. Given K signals, each with a LEVEL-FREE family
// of e-confidence intervals {C_i(α)}, a selected set S chosen by ANY rule, and a target δ, report
// each selected signal's interval at
//
//   α_i = δ·|S|/K
//
// and the false coverage rate E[#{i ∈ S : θ_i ∉ C_i(α_i)} / (|S| ∨ 1)] is at most δ under any
// dependence between the signals — with the stronger form E[sup_S sup_δ FCP(S, δ|S|/K)/δ] ≤ 1.
// The proof is Markov on Σ_i E_i(θ_i)·1{i ∈ S}·|S|δ/K (the monograph, p. 202).
//
// PREMISE (the only one): each family is level-free e-CIs. The engine's mixture confidence
// sequence (detectors/mixture-confidence-sequence.ts) qualifies by Proposition 13.4 whenever the
// mixture's own construction premise holds — residuals conditionally sub-Gaussian(σ) under the
// reference law — because its e-process M_t(S_t − tm) does not involve α. Nothing here checks
// that premise; the caller's inputs are the evidence surface's `level_free` fields, produced by
// the shipped detector. Under an ESTIMATED baseline the intervals cover the shift from the
// estimate, not from the truth (study 2026-09-mixture-cs P3/P4), at every level alike.
//
// This is REPORTED output with no verdict authority: it prices the intervals a consumer shows
// next to a selection; it does not select. The selection's own error (FDR) is e-BH's business.
// Registered and measured: validation/e-by-fcr (PREREGISTRATION.md).
Object.defineProperty(exports, "__esModule", { value: true });
exports.eByLevel = eByLevel;
exports.eBenjaminiYekutieli = eBenjaminiYekutieli;
const mixture_confidence_sequence_1 = require("../detectors/mixture-confidence-sequence");
/** The e-BY level for one selected signal: δ·|S|/K. Throws on an empty universe, a selected
 *  count outside [0, K], or δ outside (0, 1). With |S| = 0 nothing is reported and the level is 0
 *  by the formula; callers get an empty interval list rather than a level. */
function eByLevel(delta, selectedCount, K) {
    if (!(Number.isInteger(K) && K >= 1))
        throw new Error(`eByLevel: K must be an integer ≥ 1, got ${K}`);
    if (!(Number.isInteger(selectedCount) && selectedCount >= 0 && selectedCount <= K)) {
        throw new Error(`eByLevel: |S| must be an integer in [0, K], got ${selectedCount} with K = ${K}`);
    }
    if (!(delta > 0 && delta < 1))
        throw new Error(`eByLevel: delta must be in (0,1), got ${delta}`);
    return (delta * selectedCount) / K;
}
/** e-BY on the mixture confidence sequence. `K` is the number of signals the selection was made
 *  from (all of them, not the selected ones); `selected` carries the chosen signals' level-free
 *  inputs at the tick the report is made (a stopping time). Pure; does not mutate inputs. */
function eBenjaminiYekutieli(selected, K, delta) {
    const alpha_i = eByLevel(delta, selected.length, K);
    const intervals = selected.length === 0 ? [] : selected.map((s) => {
        const cs = (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(s.level_free, alpha_i);
        return { id: s.id, alpha_i, center: cs.center, half_width: cs.half_width, lower: cs.lower, upper: cs.upper };
    });
    return {
        delta, K, selected_count: selected.length, alpha_i, intervals,
        guarantee: 'FCR <= delta for any selection rule and any dependence, given level-free e-CIs (Ramdas-Wang 2025 Thm 13.7)',
    };
}
//# sourceMappingURL=e-by.js.map