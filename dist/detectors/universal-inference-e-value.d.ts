import type { Window } from './safe-t-e-value';
/** Validity envelope for the universal-inference mean-shift e-value (ADR 0010). */
export declare const UI_MEAN_SHIFT_ENVELOPE: Readonly<{
    baseline: "unknown-mean-mle";
    autocorrelation: "ar1-any-phi";
    null: "mean-shift";
    variance: "unknown-mle";
    validUnderEstimatedBaseline: true;
    minCalibration: 6;
    notes: string;
}>;
/** Universal-inference (split likelihood-ratio) e-value for a MEAN shift between a calibration window and
 *  a test window of a single contiguous series `values`, under an AR(1) nuisance. E[e|H0] ≤ 1 by
 *  construction for ANY φ (see file header). Each window is split in time at its midpoint; the alternative
 *  (separate means) is fit on the train halves, the null (common mean) MLE on the eval halves, and the
 *  e-value is the likelihood ratio on the eval halves conditioned on their predecessors.
 *
 *  @throws RangeError if windows are out of bounds, `test.start < 1` (the test train half needs a
 *    predecessor), `cal.len < 6`, `test.len < 6`, or any in-window value is non-finite. */
export declare function universalInferenceMeanShiftEValue(values: ReadonlyArray<number>, cal: Window, test: Window): number;
//# sourceMappingURL=universal-inference-e-value.d.ts.map