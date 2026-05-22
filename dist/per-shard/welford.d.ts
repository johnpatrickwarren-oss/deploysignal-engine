/** Running accumulator for Welford's online mean + covariance algorithm.
 *  R05 (SLICE 2b3) integration: this state is carried on PerShardResidual.welford_state
 *  via engine/per-shard/runtime.ts (function updatePerShardResidual). */
export interface WelfordState {
    /** Number of samples observed so far (n ≥ 0). */
    n: number;
    /** Running mean vector; length d. */
    mean: number[];
    /** Running M2 matrix (sum of (x_i − mean)(x_i − mean)^T); shape d × d.
     *  Sample covariance is M2 / (n − 1) for n ≥ 2. */
    m2: number[][];
}
/** Initialize a Welford accumulator for d-dimensional samples.
 *  Returns { n: 0, mean: <d zeros>, m2: <d × d zeros> }. Throws if d < 1. */
export declare function initialWelfordState(d: number): WelfordState;
/** Pure-function Welford update: state_new = state + sample.
 *  Returns a NEW WelfordState; does not mutate input state.
 *  Throws if sample.length !== state.mean.length (dimension mismatch). */
export declare function updateWelford(state: WelfordState, sample: number[]): WelfordState;
/** Returns the running mean as a defensive copy.
 *  Defensive copy prevents caller from mutating the WelfordState's internal mean. */
export declare function welfordMean(state: WelfordState): number[];
/** Returns the sample covariance matrix M2 / (n − 1) for n ≥ 2.
 *  Returns null for n < 2 (covariance undefined with insufficient samples).
 *  Returns a defensive deep copy. */
export declare function welfordCovariance(state: WelfordState): number[][] | null;
//# sourceMappingURL=welford.d.ts.map