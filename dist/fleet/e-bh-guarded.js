"use strict";
// fleet/e-bh-guarded.ts — the e-BH entry point that refuses.
//
// `fleet/e-bh.ts` states the contract in its header: e-BH "TRUSTS the caller to have passed only
// e-values that are VALID under their baseline regime … Gate inputs with
// detectors/validity-envelope.ts:assertValidForFdrPath before calling this." Until 2026-08-02
// nothing did — `assertValidForFdrPath` had zero production callers across six repos, and there was
// no way to obtain an envelope for a detector id in the first place, because both gate functions
// take an envelope OBJECT the caller supplies.
//
// This file supplies the missing map and the entry point that uses it. Modelled on Tessera's
// `certifiedFdrBenjaminiHochberg` (tessera/tools/emitter-contract.ts), which is the working
// precedent for a gated FDR path in this workspace.
//
// `eBenjaminiHochberg` stays exported and ungated. Measurement harnesses legitimately compute an
// observed FDP against labelled ground truth and must not be forced through a validity gate — see
// validation/h0-battery/. What changes is that a caller committing to an FDR CLAIM has a function
// that refuses.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETECTOR_ENVELOPES = void 0;
exports.envelopeFor = envelopeFor;
exports.eBenjaminiHochbergGuarded = eBenjaminiHochbergGuarded;
const e_bh_1 = require("./e-bh");
const validity_envelope_1 = require("../detectors/validity-envelope");
const safe_t_e_value_1 = require("../detectors/safe-t-e-value");
const universal_inference_e_value_1 = require("../detectors/universal-inference-e-value");
const sequential_ui_1 = require("../detectors/sequential-ui");
const nuisance_robust_bf_e_value_1 = require("../detectors/nuisance-robust-bf-e-value");
const contrast_1 = require("../per-shard/contrast");
/** Detector id → the regime in which that detector's `E[e|H0] ≤ 1` holds.
 *
 *  An id ABSENT from this map is refused, not admitted. `detector-portfolio-current` records the
 *  rule this implements: a blank axis-2 cell means UNRECORDED, NOT SAFE. Families C, D and E publish
 *  no envelope, so they are absent, and the 2026-08-01 H0 battery measured Family D's spectral
 *  e-detector at a 57.6% false-alarm rate against a nominal 5% — which is what "unrecorded" was
 *  concealing. */
exports.DETECTOR_ENVELOPES = Object.freeze({
    betting_e_process: validity_envelope_1.BETTING_E_PROCESS_ENVELOPE,
    page_cusum_mixture_supermartingale: validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE,
    safe_t_e_value: safe_t_e_value_1.SAFE_T_ENVELOPE,
    universal_inference_e_value: universal_inference_e_value_1.UI_MEAN_SHIFT_ENVELOPE,
    sequential_ui_e_process: sequential_ui_1.SEQUENTIAL_UI_ENVELOPE,
    // Retracted at v0.6.2-pre; kept so a caller still feeding it gets a NAMED refusal rather than
    // an "unknown detector" one. Its envelope carries validUnderEstimatedBaseline: false.
    nuisance_robust_bf_e_value: nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE,
    // C81 (2026-09-05): the contrast null (per-shard/contrast.ts) — the mixture or betting card on the
    // standardized contrast residual of a treatment/control pair. A NAMED REFUSAL: study
    // 2026-09-contrast-null measured the estimated OFFSET of the contrast as the plug-in n >> m price
    // (0.34 / 0.18 / 0.03 false alerts per 1,000 ticks at fit 60 / 300 / 2000 on iid pairs) and admitted
    // nothing; the envelope's `admission` carries the numbers. Admitted here only under the caller's
    // assertion { mMuchGreaterThanN } (fit >> horizon) or { trueBaseline } (a twin with a known offset).
    contrast_null_mixture: contrast_1.CONTRAST_NULL_ENVELOPE,
    contrast_null_betting: contrast_1.CONTRAST_NULL_ENVELOPE,
});
function envelopeFor(detectorId) {
    return exports.DETECTOR_ENVELOPES[detectorId];
}
/** e-BH that refuses inadmissible inputs instead of trusting the caller.
 *
 *  Throws on: an unknown detector id, an envelope outside its validity regime, or a calibration
 *  length below the envelope's declared floor. Otherwise delegates to `eBenjaminiHochberg`.
 *
 *  @throws RangeError with the detector id and the reason. */
function eBenjaminiHochbergGuarded(inputs, q) {
    if (inputs.length === 0) {
        throw new RangeError('eBenjaminiHochbergGuarded: no inputs (N=0 is structurally undefined)');
    }
    for (const input of inputs) {
        const env = envelopeFor(input.detectorId);
        if (env === undefined) {
            throw new RangeError(`eBenjaminiHochbergGuarded: no validity envelope for detector "${input.detectorId}". ` +
                'An unrecorded envelope is refused, not admitted — see detectors/validity-envelope.ts. ' +
                'Families C, D and E publish none.');
        }
        try {
            (0, validity_envelope_1.assertValidForFdrPath)(env, input.assertions ?? {});
        }
        catch (e) {
            throw new RangeError(`eBenjaminiHochbergGuarded: "${input.detectorId}" is outside its validity regime — ` +
                `${e.message}`);
        }
        if (env.minCalibration !== undefined && input.calLen !== undefined
            && input.calLen < env.minCalibration) {
            throw new RangeError(`eBenjaminiHochbergGuarded: "${input.detectorId}" needs cal ≥ ${env.minCalibration} for its ` +
                `by-construction validity; got ${input.calLen}.`);
        }
    }
    return (0, e_bh_1.eBenjaminiHochberg)(inputs.map((i) => i.eValue), q);
}
//# sourceMappingURL=e-bh-guarded.js.map