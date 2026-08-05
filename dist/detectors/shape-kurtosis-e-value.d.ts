import type { DetectorVerdict } from '../types/verdict.js';
/** Compiled per-cell parameters. `scores` is the ascending calibration
 *  distribution of K under H₀ for this cell's (p, W, correlation). */
export interface ShapeKurtosisParams {
    readonly kind: 'shape_kurtosis_e_value';
    /** Trailing window length the score is computed over. */
    readonly window: number;
    /** Ascending calibration scores. Both tails are read from this. */
    readonly scores: ReadonlyArray<number>;
    /** Per-coordinate standard deviations used to standardise. Only their
     *  RATIO to the live scale matters — the score is scale-invariant — but
     *  they are stamped so the runtime does not re-derive them. */
    readonly sigma: ReadonlyArray<number>;
}
export interface ShapeKurtosisState {
    /** Trailing raw observations, newest last. */
    buf: number[][];
    /** Ticks since the last scored window. DISJOINT evaluation: the window is
     *  scored once per `window` ticks, never on every tick. Sliding by one tick
     *  makes consecutive scores share W−1 observations, and the hedged
     *  indicator's e_t = 1 + 1{tail} − α needs the indicator to fire at rate α
     *  on the sequence it is applied to. Overlapping windows break that — a
     *  first build of this detector false-alarmed at 0.206 against α = 0.05 for
     *  exactly this reason, which is Family D's dominant failure recurring
     *  (knowledge/stats/h0-battery-2026-08-01 N7). */
    sinceEval: number;
    /** Running wealth. */
    M: number;
    n: number;
    alphaConsumed: number;
}
export declare function freshShapeKurtosisState(): ShapeKurtosisState;
/** K = (1/p) Σ_i m4_i/m2_i². Returns null if any coordinate is degenerate. */
export declare function shapeKurtosisScore(win: ReadonlyArray<ReadonlyArray<number>>, sigma: ReadonlyArray<number>): number | null;
/** Evaluate one tick. Accumulates into the trailing window and only scores
 *  once the window is full; before that the wealth is untouched, which keeps
 *  e_t = 1 and the process a valid (trivial) martingale over the warm-up. */
export declare function evaluateShapeKurtosisEValue(input: {
    params: ShapeKurtosisParams;
    alpha: number;
}, x_t: ReadonlyArray<number>, state: ShapeKurtosisState): DetectorVerdict;
/** Validity envelope. `baseline: 'plug-in'` is deliberate and is the known
 *  risk: the score standardises by a compiled σ̂. The score is invariant to a
 *  multiplicative error in it, but the CALIBRATION distribution is not
 *  invariant to a wrong correlation structure. */
export declare const SHAPE_KURTOSIS_ENVELOPE: Readonly<{
    baseline: "plug-in";
    autocorrelation: "iid";
    null: "distributional-shape";
    variance: "stable";
    validUnderEstimatedBaseline: false;
    minCalibration: 200;
    notes: string;
}>;
/** Build the per-cell calibration distribution of K under H₀.
 *
 *  Synthesized, exactly as Family E's is: draw windows from N(0, Σ) via the
 *  supplied Cholesky factor and record K for each. The score is scale-
 *  invariant, so the DISTRIBUTION of K does not depend on the scale of Σ —
 *  but it does depend on the correlation structure, which is why this is
 *  per-cell rather than a (p, window) lookup.
 *
 *  `draws` is the number of calibration windows; `L` is lower-triangular. */
export declare function buildShapeKurtosisCalibration(L: ReadonlyArray<ReadonlyArray<number>>, window: number, draws: number, rng: () => number): {
    scores: number[];
    sigma: number[];
};
/** Build the calibration EMPIRICALLY, from real baseline windows.
 *
 *  REQUIRED, not optional. The synthesized-Gaussian builder above asserts
 *  Gaussian kurtosis, and the N1–N7 battery measured what that costs when the
 *  baseline is not Gaussian: `E[exp(Δ log M)]` of 1.947 with a crossing rate
 *  of 1.0000 on healthy lognormal and healthy t₃ traffic — the detector reads
 *  healthy non-Gaussian data as a shape fault. Rebuilding the same
 *  distribution from the baseline's own windows takes those to 0.998 and
 *  1.001, and takes AR(1) φ=0.9 from a crossing rate of 1.0000 to 0.0010.
 *
 *  The synthesized builder is retained only for the Gaussian-baseline case and
 *  for tests; anything reaching production should use this.
 *
 *  TRIM FIRST. The contamination arm measured what an untrimmed empirical
 *  calibration costs: at 10% and 20% shift contamination the detector loses
 *  ALL power — 1.0000 to 0.0000 — because a contaminated baseline is itself
 *  mildly bimodal, so its K distribution overlaps the fault's and the
 *  reference has absorbed the shape it exists to detect. False alarms stay
 *  low throughout, so the failure is silent. Passing MCD-retained rows only
 *  restores power to 1.0000 at every contamination level tested while keeping
 *  the false-alarm rate at 0.0030–0.0420 against α=0.05.
 *
 *  `rows` are baseline observations in the same space the detector sees. */
export declare function buildShapeKurtosisCalibrationEmpirical(rows: ReadonlyArray<ReadonlyArray<number>>, window: number, sigma: ReadonlyArray<number>, stride?: number): number[];
//# sourceMappingURL=shape-kurtosis-e-value.d.ts.map