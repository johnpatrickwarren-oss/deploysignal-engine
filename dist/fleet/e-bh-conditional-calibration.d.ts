import { EBenjaminiHochbergOutput } from './e-bh';
/** The null survival function of hypothesis `j`'s e-value: `P(ẽ_j ≥ x | H_j)`. KNOWN in closed form for
 *  our pivotal e-values. Must be a valid (non-increasing in `x`, in [0,1]) survival; over-stating the
 *  tail stays conservative, under-stating it breaks FDR. */
export type NullSurvival = (j: number, x: number) => number;
export interface EBHConditionalCalibrationOptions {
    /** `E[ẽ_j | H_j]` — the null mean of each e-value. A proper e-value has E ≤ 1; default 1. A smaller
     *  (correct) value makes the boost more conservative. */
    nullMean?: number;
}
/** e-BH with conditional-calibration boosting (Lee-Ren), closed-form for a KNOWN per-shard null. Returns
 *  the boosted rejection set: a deterministic SUPERSET of plain `eBenjaminiHochberg(eValues, qLevel)` with
 *  FDR ≤ qLevel preserved under arbitrary dependence. Exact — no Monte-Carlo, no sample-size cliff.
 *
 *  @param eValues       observed per-shard e-values.
 *  @param qLevel        FDR target in (0, 1].
 *  @param nullSurvival  the KNOWN null survival `P(ẽ_j ≥ x | H_j)` of each e-value (see the file header).
 *  @throws Error/RangeError on empty input or bad qLevel (mirrors eBenjaminiHochberg). */
export declare function eBHConditionalCalibration(eValues: ReadonlyArray<number>, qLevel: number, nullSurvival: NullSurvival, opts?: EBHConditionalCalibrationOptions): EBenjaminiHochbergOutput;
//# sourceMappingURL=e-bh-conditional-calibration.d.ts.map