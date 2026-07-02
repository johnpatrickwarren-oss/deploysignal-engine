"use strict";
// fleet/guarantee.ts — the assembled FP/FDR-by-construction guarantee's CONDITIONS, surfaced for the
// fleet verdict (ADR 0004 PR E: "surface the assembled guarantee's conditions in the fleet verdict").
//
// The pipeline contaminationRobustResiduals → safeTwoSampleTEValue → eBenjaminiHochberg gives
// FP/FDR ≤ q BY CONSTRUCTION (the nuisance-robust BF formerly named here was corrected 2026-07-02:
// E[BF|H0] ≈ 1.155, not ≤ 1 — see detectors/nuisance-robust-bf-e-value.ts; safe-t is the valid
// substitute), but the guarantee is CONDITIONAL and the conditions must travel with the
// verdict rather than be buried:
//   - the per-shard e-value must be VALID for the FDR path (the validity envelope / gate);
//   - the fault fraction must stay under the robust common-mode's breakdown (~20%, Tessera ADR 0015);
//   - the common-mode must be a per-tick SCALAR (homogeneous loading);
//   - the fleet must genuinely SHARE a common-mode (else removing it can mildly worsen FP).
// The FD (detection) side is CHARACTERIZED, never unconditionally guaranteed: detection ≥ power for an
// effect ≥ δ (a power/MDE curve), so the minimum detectable effect is surfaced, not a blanket claim.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROBUST_COMMON_MODE_BREAKDOWN = void 0;
exports.assembleFleetGuaranteeConditions = assembleFleetGuaranteeConditions;
const validity_envelope_1 = require("../detectors/validity-envelope");
/** Empirical breakdown fault fraction of the redescending robust common-mode (Tessera ADR 0015 ~20%). */
exports.ROBUST_COMMON_MODE_BREAKDOWN = 0.2;
/** Assemble the FP/FDR-by-construction conditions for a fleet verdict. The result is data the consumer
 *  attaches to its verdict so the guarantee's envelope is auditable, not implied. */
function assembleFleetGuaranteeConditions(input) {
    const breakdownFraction = input.breakdownFraction ?? exports.ROBUST_COMMON_MODE_BREAKDOWN;
    if (!(input.faultFraction >= 0 && input.faultFraction <= 1)) {
        throw new RangeError(`assembleFleetGuaranteeConditions: faultFraction must be in [0,1]; got ${input.faultFraction}`);
    }
    if (!(breakdownFraction > 0 && breakdownFraction <= 1)) {
        throw new RangeError(`assembleFleetGuaranteeConditions: breakdownFraction must be in (0,1]; got ${breakdownFraction}`);
    }
    const eValueValidForFdr = (0, validity_envelope_1.isValidForFdrPath)(input.eValueEnvelope, input.assertions);
    // Strict `<` is intentional: AT the breakdown the robust center is on the edge of failing, so an
    // exactly-at-breakdown fault fraction is treated as OUT of the envelope (conservative). Do not relax
    // to `<=` without re-validating the breakpoint.
    const faultFractionUnderBreakdown = input.faultFraction < breakdownFraction;
    const fdrGuaranteedByConstruction = eValueValidForFdr && faultFractionUnderBreakdown && input.genuineCoupling && input.scalarCommonMode;
    const minDetectableEffect = input.minDetectableEffect ?? null;
    const unmet = [];
    if (!eValueValidForFdr)
        unmet.push('the per-shard e-value is INVALID under an estimated baseline (gate it or assert its regime)');
    if (!faultFractionUnderBreakdown)
        unmet.push(`fault fraction ${(input.faultFraction * 100).toFixed(0)}% ≥ breakdown ${(breakdownFraction * 100).toFixed(0)}%`);
    if (!input.genuineCoupling)
        unmet.push('the fleet lacks genuine common-mode coupling');
    if (!input.scalarCommonMode)
        unmet.push('the common-mode is not a per-tick scalar (heterogeneous loading)');
    const fdPhrase = minDetectableEffect === null
        ? 'FD (detection) is characterized as a power curve, not guaranteed.'
        : `FD (detection) is characterized: detection ≥ power for an effect ≥ δ=${minDetectableEffect}, not an unconditional guarantee.`;
    const summary = fdrGuaranteedByConstruction
        ? `FP/FDR ≤ q holds BY CONSTRUCTION within the envelope (e-value valid; fault fraction `
            + `${(input.faultFraction * 100).toFixed(0)}% < breakdown ${(breakdownFraction * 100).toFixed(0)}%; `
            + `scalar, coupled common-mode). ${fdPhrase}`
        : `FP/FDR ≤ q is NOT guaranteed by construction — ${unmet.join('; ')}. ${fdPhrase}`;
    return {
        fdrGuaranteedByConstruction,
        eValueValidForFdr,
        faultFraction: input.faultFraction,
        breakdownFraction,
        faultFractionUnderBreakdown,
        genuineCoupling: input.genuineCoupling,
        scalarCommonMode: input.scalarCommonMode,
        minDetectableEffect,
        summary,
    };
}
//# sourceMappingURL=guarantee.js.map