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
/** log of the arithmetic mean of exp(x_i): logSumExp with max-shift for numerical stability, minus
 *  log K. The Vovk–Wang 2021 §4 uniform-average combiner in log space; fleet/combine.ts's
 *  combineAverage and detectors/group-average-e-value.ts both reduce through this one function
 *  (ADR 0033 moved the arithmetic here so the detector layer no longer imports from fleet/).
 *  Throws on empty input. */
export declare function logMeanExp(xs: ReadonlyArray<number>): number;
//# sourceMappingURL=_evidence.d.ts.map