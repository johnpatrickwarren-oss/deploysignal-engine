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
exports.NUISANCE_ROBUST_BF_ENVELOPE = exports.MIXTURE_SUPERMARTINGALE_ENVELOPE = exports.BETTING_E_PROCESS_ENVELOPE = void 0;
exports.isValidForFdrPath = isValidForFdrPath;
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
        + 'Valid only with a TRUE baseline or m≫n. Use detectors/nuisance-robust-bf-e-value.ts in the '
        + 'estimated-baseline regime.',
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
/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (the nuisance-robust BF) always is. A plug-in e-value (betting / mixture) is admissible ONLY
 *  if the caller asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] ≫ 1 and
 *  feeding it to e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014). */
function isValidForFdrPath(env, assertions = {}) {
    if (env.validUnderEstimatedBaseline)
        return true;
    return Boolean(assertions.trueBaseline || assertions.mMuchGreaterThanN);
}
/** Throw if an e-value with this envelope would be fed to the FDR path OUTSIDE its validity regime.
 *  Call this at the e-BH boundary so an invalid plug-in e-value cannot silently degrade FDR control. */
function assertValidForFdrPath(env, assertions = {}) {
    if (!isValidForFdrPath(env, assertions)) {
        throw new Error(`validity-envelope: a '${env.baseline}' e-value is INVALID under an estimated baseline `
            + '(E[e|H0] ≫ 1) and must not enter the FDR path. Assert { trueBaseline } or '
            + '{ mMuchGreaterThanN }, or use the nuisance-robust BF e-value instead.');
    }
}
//# sourceMappingURL=validity-envelope.js.map