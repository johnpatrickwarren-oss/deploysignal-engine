import { ValidityEnvelope, FdrPathAssertions } from '../detectors/validity-envelope';
/** Empirical breakdown fault fraction of the redescending robust common-mode (Tessera ADR 0015 ~20%). */
export declare const ROBUST_COMMON_MODE_BREAKDOWN = 0.2;
export interface FleetGuaranteeInput {
    /** Validity envelope of the per-shard e-value feeding e-BH (see detectors/validity-envelope.ts). */
    eValueEnvelope: ValidityEnvelope;
    /** Any FDR-path assertions admitting a plug-in e-value within its validity regime. */
    assertions?: FdrPathAssertions;
    /** Estimated/asserted fraction of faulty shards in the fleet (0..1). */
    faultFraction: number;
    /** Does the fleet genuinely SHARE a common-mode? (The robust center only helps a coupled fleet.) */
    genuineCoupling: boolean;
    /** Is the common-mode modeled as a per-tick SCALAR (homogeneous loading)? */
    scalarCommonMode: boolean;
    /** Robust-center breakdown fraction; default {@link ROBUST_COMMON_MODE_BREAKDOWN}. */
    breakdownFraction?: number;
    /** The δ for the FD claim ("detection ≥ power for effect ≥ δ"); null if not characterized. The FD
     *  side is a power curve, never an unconditional guarantee. */
    minDetectableEffect?: number | null;
}
export interface FleetGuaranteeConditions {
    /** FP/FDR ≤ q holds BY CONSTRUCTION iff every condition below is met. */
    fdrGuaranteedByConstruction: boolean;
    /** The per-shard e-value is admissible to the FDR path (valid under its baseline regime). */
    eValueValidForFdr: boolean;
    faultFraction: number;
    breakdownFraction: number;
    faultFractionUnderBreakdown: boolean;
    genuineCoupling: boolean;
    scalarCommonMode: boolean;
    /** The FD claim is conditional on effect ≥ this δ (a power curve), never unconditional. */
    minDetectableEffect: number | null;
    /** Human-readable conditions for the verdict surface. */
    summary: string;
}
/** Assemble the FP/FDR-by-construction conditions for a fleet verdict. The result is data the consumer
 *  attaches to its verdict so the guarantee's envelope is auditable, not implied. */
export declare function assembleFleetGuaranteeConditions(input: FleetGuaranteeInput): FleetGuaranteeConditions;
//# sourceMappingURL=guarantee.d.ts.map