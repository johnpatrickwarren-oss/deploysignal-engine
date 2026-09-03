import type { ValidityEnvelope } from './validity-envelope';
/** ±{0.25·12^{k/7} : k = 0..7} — λ_op = δ for a Gaussian increment, so the grid spans shifts of
 *  0.25σ (below the smallest registered K1 step, 0.75σ) to 3σ (the largest). Frozen with the study. */
export declare const E_SR_LAMBDA_GRID: readonly number[];
export declare const E_SR_DEFAULT_ALPHA_ARL = 0.001;
export interface ESrMeanShiftParams {
    /** ARL level: alarm threshold 1/alpha_arl; E∞[N*] ≥ 1/alpha_arl. Default 1e-3. */
    alpha_arl?: number;
    /** Increment grid; default E_SR_LAMBDA_GRID. Any grid is a valid e-detector (Prop. 2.3). */
    lambdas?: readonly number[];
}
export interface ESrMeanShiftState {
    /** ticks consumed. */
    t: number;
    /** log M_t(λ) per grid point; −Infinity before the first tick (M_0 = 0). */
    log_M_sr: number[];
    /** log C_t(λ) per grid point (CUSUM companion); 0 before the first tick (C_0 = 1 after the max). */
    log_C_cu: number[];
    /** last 0-indexed tick at which C(λ) sat below 1 (the CUSUM reset), per grid point; −1 = never. */
    last_reset: number[];
    /** log of the mixture M_t. −Infinity at t = 0. */
    log_M: number;
    /** running max of log_M (diagnostics only — NOT an e-value). */
    log_M_peak: number;
    /** 0-indexed tick of the first alarm, or null. */
    alarm_tick: number | null;
}
export declare function freshESrMeanShiftState(params?: ESrMeanShiftParams): ESrMeanShiftState;
export interface ESrMeanShiftResult {
    /** log of the mixture SR statistic after this tick. */
    log_M: number;
    /** exp(log_M); may be Infinity on an enormous fault. */
    M: number;
    /** log(1/alpha_arl). */
    log_threshold: number;
    /** M_t ≥ 1/alpha_arl at THIS tick. */
    fired: boolean;
    /** first-alarm semantics: true from the first alarm tick onward. */
    alarmed: boolean;
    /** classical onset estimate (0-indexed first post-change tick) from the argmax-λ CUSUM companion;
     *  null until some component has reset at least once or, before any reset, 0. */
    onset_estimate: number;
    /** the grid λ carrying the largest SR component (sign = shift direction). */
    argmax_lambda: number;
}
/** Standardize one observation against a plug-in AR(1) baseline: r = ((x − μ) − φ(x_prev − μ)) / (σ·sqrt(1 − φ²)).
 *  With φ = 0 this is (x − μ)/σ. After whitening a step of δ has mean δ·sqrt((1 − φ)/(1 + φ)) in r units.
 *  `x_prev` is ignored when φ = 0; pass `null` for the first observation (treated as x_prev = μ). */
export declare function standardizeAr1Residual(x: number, x_prev: number | null, mu: number, sigma: number, phi?: number): number;
/** One tick. `r` is the standardized whitened residual (see standardizeAr1Residual). Mutates `state`. */
export declare function evaluateESrMeanShift(r: number, params: ESrMeanShiftParams, state: ESrMeanShiftState): ESrMeanShiftResult;
/** The e-SR's envelope: statistic 'e-detector' — refused by assertValidForFdrPath by name. The
 *  baseline/autocorrelation fields describe the residual it expects (plug-in μ̂, AR(1)-whitened). */
export declare const E_SR_MEAN_SHIFT_ENVELOPE: Readonly<ValidityEnvelope>;
//# sourceMappingURL=e-sr-mean-shift.d.ts.map