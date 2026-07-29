export interface SequentialUiOptions {
    /** First index whose mean the ALTERNATIVE allows to differ (e.g. the monitoring start). The
     *  null keeps one common mean throughout. Default 1 (every scored point is post-change). */
    changeFrom?: number;
    /** Clip for the predictable φ̂ (stability at short prefixes). Default 0.95 (engine parity). */
    phiClip?: number;
}
export interface SequentialUiResult {
    /** log E_t after each scored tick s = 1..T−1 (index i ↔ tick i+1). */
    logE: number[];
    /** terminal log e-value. */
    terminalLogE: number;
    /** first scored tick (1-based) with E ≥ 1/alpha01 (α = 0.01), else null — a convenience readout;
     *  the caller owns real threshold semantics. */
    firstCross01: number | null;
}
/**
 * The sequential UI e-process on a raw series (index 0 is the conditioning origin). Returns the
 * full log-e trajectory; E[E_τ] ≤ 1 at every stopping time under the composite AR(1) null.
 */
export declare function sequentialUiMeanShiftEProcess(x: ReadonlyArray<number>, opts?: SequentialUiOptions): SequentialUiResult;
/** Validity envelope (mirrors UI_MEAN_SHIFT_ENVELOPE's shape). */
export declare const SEQUENTIAL_UI_ENVELOPE: Readonly<{
    baseline: "unknown-mean-mle";
    autocorrelation: "ar1-any-phi";
    null: "mean-shift";
    variance: "unknown-mle";
    validUnderEstimatedBaseline: true;
    minCalibration: 3;
    notes: string;
}>;
//# sourceMappingURL=sequential-ui.d.ts.map