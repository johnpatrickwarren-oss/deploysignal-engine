"use strict";
// detectors/validity-envelope.ts — validity envelopes as first-class, and the FDR-path gate.
//
// ADR 0004 PR E — "the single most important honesty fix." Every e-value detector ships a validity
// ENVELOPE describing the regime in which E[e|H0] ≤ 1 holds, and the engine refuses to imply a
// guarantee outside it. The load-bearing consequence: the plug-in betting / mixture e-values are
// INVALID under an estimated (plug-in) baseline — E[e|H0] ≫ 1 (Tessera ADR 0008/0014: →1e8 plug-in,
// →3e9 mixSM at large n) — so they must NOT be silently fed to e-BH as if valid. They remain useful
// where their regime holds (a TRUE baseline, or m≫n). This module makes that envelope explicit and
// provides the gate that keeps an out-of-envelope e-value out of the FDR path.
//
// The envelopes for the VENDORED detectors (betting-e-process, family-a-mixture-supermartingale) live
// HERE rather than in those files, so the vendored sources stay byte-identical to their upstream
// (SCOPING-MEMO-v0.3 § 9 sync policy). The nuisance-robust BF (ADR 0004 PR A) carries its own envelope
// in its own file (re-exported below) and is retrofitted onto this shared type.
Object.defineProperty(exports, "__esModule", { value: true });
exports.INCREMENT_MEAN_BOUND = exports.NUISANCE_ROBUST_BF_ENVELOPE = exports.MIXTURE_SUPERMARTINGALE_ENVELOPE = exports.BETTING_E_PROCESS_ENVELOPE = void 0;
exports.tailAdmissible = tailAdmissible;
exports.isValidForFdrPath = isValidForFdrPath;
exports.phiAdmissible = phiAdmissible;
exports.assertValidForFdrPath = assertValidForFdrPath;
const nuisance_robust_bf_e_value_1 = require("./nuisance-robust-bf-e-value");
Object.defineProperty(exports, "NUISANCE_ROBUST_BF_ENVELOPE", { enumerable: true, get: function () { return nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE; } });
/** Plug-in betting e-process (`detectors/betting-e-process.ts`). Freezes a point baseline μ̂; under an
 *  estimated baseline E[e|H0] ≫ 1 (Tessera ADR 0008: →1e8). Pre-whitens AR(1) (ADR 0001). Valid ONLY
 *  with a true baseline or m≫n — gate out of the FDR path otherwise; prefer the nuisance-robust BF. */
exports.BETTING_E_PROCESS_ENVELOPE = Object.freeze({
    baseline: 'plug-in',
    autocorrelation: 'ar1-whitened',
    null: 'mean-shift',
    variance: 'stable',
    validUnderEstimatedBaseline: false,
    notes: 'Plug-in point baseline μ̂; E[e|H0] ≫ 1 under an estimated baseline (Tessera ADR 0008 → ~1e8). '
        + 'Valid only with a TRUE baseline or m≫n. Use detectors/safe-t-e-value.ts (or the UI e-value for '
        + 'any-φ validity) in the estimated-baseline regime.',
});
/** Family-A Gaussian mixture supermartingale (`detectors/family-a-mixture-supermartingale.ts`). Plugs
 *  in the null mean; shares the plug-in invalidity in the under-powered regime (Tessera ADR 0014:
 *  E[e|H0] → ~3e9 at large n). Pre-whitens AR(1) (ADR 0002). Valid only with a true baseline or m≫n. */
exports.MIXTURE_SUPERMARTINGALE_ENVELOPE = Object.freeze({
    baseline: 'plug-in',
    autocorrelation: 'ar1-whitened',
    null: 'mean-shift',
    variance: 'stable',
    validUnderEstimatedBaseline: false,
    notes: 'Plug-in null mean; E[e|H0] ≫ 1 in the under-powered regime n≫m (Tessera ADR 0014 → ~3e9). '
        + 'Valid only with a TRUE baseline or m≫n.',
});
// Compile-time guarantee that the BF envelope (defined in its own file) satisfies the shared type.
// (A type-only check; erased at runtime, so no circular import — this module depends on the BF file,
// not vice-versa.)
const _bfEnvelopeSatisfiesShared = nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE;
void _bfEnvelopeSatisfiesShared;
/** The card-falsifier bound every certified test-martingale card carries for the increment mean
 *  (validation/certification/lib/constants.mjs, h0-battery A3.4 / A6.2). */
exports.INCREMENT_MEAN_BOUND = 1.0005;
/** ADR 0035 — does the caller satisfy the envelope's tail premise? An envelope without one is
 *  unconstrained here (UNRECORDED, not safe — see `tailPremise`). A measured refutation wins over a
 *  promise; a measured clearance needs no promise; an inconclusive or absent measurement needs the
 *  promise matching the premise. */
function tailAdmissible(env, assertions = {}) {
    if (env.tailPremise === undefined)
        return true;
    const m = assertions.incrementMean;
    if (m !== undefined) {
        if (m.lower95 > exports.INCREMENT_MEAN_BOUND)
            return false;
        if (m.upper95 < exports.INCREMENT_MEAN_BOUND)
            return true;
    }
    return env.tailPremise === 'mgf' ? Boolean(assertions.lightTails) : Boolean(assertions.clipMeanZero);
}
/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (safe-t, the UI e-value) always is. Anything else — the plug-in betting / mixture e-values,
 *  and since the 2026-07-02 correction the nuisance-robust BF too — is admissible ONLY if the caller
 *  asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] > 1 and feeding it to
 *  e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014; BF: ≈1.155 at every cal length). */
function isValidForFdrPath(env, assertions = {}) {
    if (env.statistic === 'e-detector')
        return false;
    return phiAdmissible(env, assertions)
        && tailAdmissible(env, assertions)
        && (env.validUnderEstimatedBaseline
            || Boolean(assertions.trueBaseline || assertions.mMuchGreaterThanN));
}
/** φ side of the gate, separated so the failure can be reported distinctly from the baseline one.
 *  An envelope with no `maxPhiValid` is unconstrained in φ. One WITH a bound refuses on an unknown
 *  φ: silence is not evidence. */
function phiAdmissible(env, assertions = {}) {
    if (env.maxPhiValid === undefined)
        return true;
    if (assertions.observedPhi === undefined)
        return Boolean(assertions.phiUnmeasuredAccepted);
    return Math.abs(assertions.observedPhi) <= env.maxPhiValid;
}
/** Throw if an e-value with this envelope would be fed to the FDR path OUTSIDE its validity regime.
 *  Call this at the e-BH boundary so an invalid plug-in e-value cannot silently degrade FDR control. */
function assertValidForFdrPath(env, assertions = {}) {
    if (env.statistic === 'e-detector') {
        throw new Error('validity-envelope: an e-DETECTOR statistic (E∞[M_t] = t, an average-run-length guarantee, '
            + 'not E[e|H0] ≤ 1) can never enter the FDR path. No assertion admits it (ADR 0029).');
    }
    if (!phiAdmissible(env, assertions)) {
        throw new Error(`validity-envelope: this e-value holds only for |φ| ≤ ${env.maxPhiValid}; got `
            + `${assertions.observedPhi === undefined ? 'an UNMEASURED φ' : `φ=${assertions.observedPhi}`}. `
            + 'Above that bound E[e|H0] > 1 and the FDR guarantee does not hold — measured exceedance '
            + '0.1420 against α=0.05 at φ=0.99. Supply { observedPhi } within the bound, assert '
            + '{ phiUnmeasuredAccepted } if the regime is known far from a unit root by other means, or '
            + 'route this regime to a detector whose envelope covers it. None does above 0.95.');
    }
    if (!tailAdmissible(env, assertions)) {
        const need = env.tailPremise === 'mgf'
            ? 'a residual whose mgf exists at the bets (the Gaussian-LR increment): measured 1.61 on t3 and '
                + '1.91 on a σ-0.75 lognormal, so E[M_T|H0] grows like 1.6^T. Assert { lightTails }'
            : 'a conditionally mean-zero CLIPPED residual (the bounded bet): a skewed tail leaves the '
                + 'wealths betting against the skew at 1.0009-1.0083 per tick. Assert { clipMeanZero }';
        const m = assertions.incrementMean;
        const measured = m === undefined ? 'no increment mean was measured'
            : m.lower95 > exports.INCREMENT_MEAN_BOUND
                ? `the measured increment mean REFUTES it (lower95 ${m.lower95} > ${exports.INCREMENT_MEAN_BOUND}); no promise overrides a measurement`
                : `the measured interval [${m.lower95}, ${m.upper95}] is inconclusive at ${exports.INCREMENT_MEAN_BOUND}`;
        throw new Error(`validity-envelope: this increment's E[g|H0] ≤ 1 needs ${need}, or supply { incrementMean } `
            + 'from the family-coherent increment estimator on a believed-null feed of this residual with '
            + `upper95 < ${exports.INCREMENT_MEAN_BOUND} — ${measured} (h0-battery Amendment A6, inc-20260925T044059Z; ADR 0035).`);
    }
    if (!isValidForFdrPath(env, assertions)) {
        throw new Error(`validity-envelope: a '${env.baseline}' e-value is INVALID under an estimated baseline `
            + '(E[e|H0] > 1) and must not enter the FDR path. Assert { trueBaseline } or '
            + '{ mMuchGreaterThanN }, or use the safe-t / universal-inference e-value instead.');
    }
}
//# sourceMappingURL=validity-envelope.js.map