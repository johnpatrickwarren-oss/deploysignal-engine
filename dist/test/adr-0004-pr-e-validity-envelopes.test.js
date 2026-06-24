"use strict";
// test/adr-0004-pr-e-validity-envelopes.test.ts — ADR 0004 PR E.
//
// The honesty fix: every e-value ships a validity envelope; the plug-in betting/mixture e-values are
// labelled INVALID under an estimated baseline and gated out of the FDR path unless their regime is
// asserted; the assembled FP/FDR-by-construction conditions are surfaced for the fleet verdict.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const validity_envelope_1 = require("../detectors/validity-envelope");
const guarantee_1 = require("../fleet/guarantee");
// ── Envelopes label the plug-in e-values invalid-under-estimated-baseline; the BF valid. ──────────
(0, node_test_1.test)('envelopes: plug-in betting/mixture are invalid-under-estimated-baseline; the BF is valid', () => {
    strict_1.default.equal(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE.baseline, 'plug-in');
    strict_1.default.equal(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE.validUnderEstimatedBaseline, false);
    strict_1.default.equal(validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE.baseline, 'plug-in');
    strict_1.default.equal(validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE.validUnderEstimatedBaseline, false);
    strict_1.default.equal(validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE.baseline, 'unknown-mean-integrated');
    strict_1.default.equal(validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE.validUnderEstimatedBaseline, true);
});
// ── The FDR-path gate. ────────────────────────────────────────────────────────────────────────────
(0, node_test_1.test)('gate: the BF is always admissible to the FDR path', () => {
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE), true);
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE, {}), true);
});
(0, node_test_1.test)('gate: a plug-in e-value is gated OUT unless its validity regime is asserted', () => {
    // Default (estimated baseline) → not admissible.
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE), false);
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE), false);
    // Asserting a true baseline OR m≫n admits it within its regime.
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE, { trueBaseline: true }), true);
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE, { mMuchGreaterThanN: true }), true);
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE, { mMuchGreaterThanN: true }), true);
});
(0, node_test_1.test)('gate: assertValidForFdrPath throws for an unasserted plug-in e-value, passes otherwise', () => {
    strict_1.default.throws(() => (0, validity_envelope_1.assertValidForFdrPath)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE), /INVALID under an estimated baseline/);
    strict_1.default.throws(() => (0, validity_envelope_1.assertValidForFdrPath)(validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE), /INVALID/);
    strict_1.default.doesNotThrow(() => (0, validity_envelope_1.assertValidForFdrPath)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE, { trueBaseline: true }));
    strict_1.default.doesNotThrow(() => (0, validity_envelope_1.assertValidForFdrPath)(validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE));
});
// ── The assembled fleet guarantee conditions. ─────────────────────────────────────────────────────
(0, node_test_1.test)('guarantee: FP/FDR is by-construction only when ALL conditions hold (valid e-value, minority faults, scalar, coupled)', () => {
    const base = {
        eValueEnvelope: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE,
        faultFraction: 0.1,
        genuineCoupling: true,
        scalarCommonMode: true,
        minDetectableEffect: 3,
    };
    const ok = (0, guarantee_1.assembleFleetGuaranteeConditions)(base);
    strict_1.default.equal(ok.fdrGuaranteedByConstruction, true);
    strict_1.default.equal(ok.eValueValidForFdr, true);
    strict_1.default.equal(ok.faultFractionUnderBreakdown, true);
    strict_1.default.equal(ok.breakdownFraction, guarantee_1.ROBUST_COMMON_MODE_BREAKDOWN);
    strict_1.default.match(ok.summary, /BY CONSTRUCTION/);
    strict_1.default.match(ok.summary, /δ=3/); // FD characterized, not unconditional
    // Fault fraction past the breakdown → not guaranteed.
    strict_1.default.equal((0, guarantee_1.assembleFleetGuaranteeConditions)({ ...base, faultFraction: 0.4 }).fdrGuaranteedByConstruction, false);
    // No genuine coupling → not guaranteed.
    strict_1.default.equal((0, guarantee_1.assembleFleetGuaranteeConditions)({ ...base, genuineCoupling: false }).fdrGuaranteedByConstruction, false);
    // Heterogeneous (non-scalar) loading → not guaranteed.
    strict_1.default.equal((0, guarantee_1.assembleFleetGuaranteeConditions)({ ...base, scalarCommonMode: false }).fdrGuaranteedByConstruction, false);
});
(0, node_test_1.test)('guarantee: a plug-in e-value (unasserted) blocks the by-construction FP/FDR claim', () => {
    const c = (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.BETTING_E_PROCESS_ENVELOPE,
        faultFraction: 0.05, genuineCoupling: true, scalarCommonMode: true,
    });
    strict_1.default.equal(c.eValueValidForFdr, false);
    strict_1.default.equal(c.fdrGuaranteedByConstruction, false);
    strict_1.default.match(c.summary, /INVALID under an estimated baseline/);
    // Asserting the plug-in's regime restores the by-construction claim.
    const asserted = (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.BETTING_E_PROCESS_ENVELOPE, assertions: { mMuchGreaterThanN: true },
        faultFraction: 0.05, genuineCoupling: true, scalarCommonMode: true,
    });
    strict_1.default.equal(asserted.fdrGuaranteedByConstruction, true);
});
(0, node_test_1.test)('guarantee: the FD side is characterized (MDE), never unconditional; input is validated', () => {
    const noMde = (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.1, genuineCoupling: true, scalarCommonMode: true,
    });
    strict_1.default.equal(noMde.minDetectableEffect, null);
    strict_1.default.match(noMde.summary, /not an unconditional guarantee|not guaranteed/);
    strict_1.default.throws(() => (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 1.5, genuineCoupling: true, scalarCommonMode: true,
    }), RangeError);
    strict_1.default.throws(() => (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.1, breakdownFraction: 1.5, genuineCoupling: true, scalarCommonMode: true,
    }), RangeError, 'breakdownFraction > 1');
});
(0, node_test_1.test)('guarantee: AT exactly the breakdown the guarantee is withheld (strict-< is conservative)', () => {
    const c = (0, guarantee_1.assembleFleetGuaranteeConditions)({
        eValueEnvelope: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.2, breakdownFraction: 0.2,
        genuineCoupling: true, scalarCommonMode: true,
    });
    strict_1.default.equal(c.faultFractionUnderBreakdown, false, 'faultFraction === breakdownFraction is OUT of envelope');
    strict_1.default.equal(c.fdrGuaranteedByConstruction, false);
});
//# sourceMappingURL=adr-0004-pr-e-validity-envelopes.test.js.map