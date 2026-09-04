import type { EvidenceSurface, ThresholdKind, ConfidenceSequenceEvidence } from '../types/verdict-extensions/evidence-surface';
export interface EvidenceArgs {
    log_wealth: number;
    log_increment: number | null;
    bet: number | null;
    n: number;
    /** linear threshold as the verdict carries it, or null. */
    threshold: number | null;
    threshold_kind: ThresholdKind | null;
    log_peak_wealth: number;
    /** ADR 0030 — attached by the Family A Gaussian-mixture path only. */
    confidence_sequence?: ConfidenceSequenceEvidence;
}
export declare function buildEvidence(a: EvidenceArgs): EvidenceSurface;
/** Running-max bookkeeping: the new peak given the previous (possibly absent) peak and the
 *  current log-wealth. Absence heals to the current value. */
export declare function advanceLogPeak(prevPeak: number | null | undefined, logM: number): number;
//# sourceMappingURL=_evidence.d.ts.map