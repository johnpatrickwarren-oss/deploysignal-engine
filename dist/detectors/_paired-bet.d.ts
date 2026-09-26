export interface PairedBetSpec {
    /** Smallest value an observation can take. */
    lo: number;
    /** Largest value an observation can take. */
    hi: number;
    /** H0: E[X | past] ≤ nullMean. Needs lo < nullMean ≤ hi. */
    nullMean: number;
}
export interface PairedBetState {
    /** Log-wealth (the source of truth; see _wealth.ts). */
    log_K: number;
    /** Observations consumed. */
    n: number;
    /** Σ (X − m). */
    sumY: number;
    /** Σ (X − m)². */
    sumY2: number;
}
/** λmax as a fraction of the positivity bound 1 / (m − lo): every factor stays ≥ 1 − this. */
export declare const PAIRED_BET_MAX_FRACTION = 0.5;
export declare function initPairedBet(): PairedBetState;
export declare function pairedBetLambdaMax(spec: PairedBetSpec): number;
/** The bet for the NEXT observation, from past observations only. */
export declare function pairedBetLambda(state: PairedBetState, spec: PairedBetSpec): number;
/** Consume one observation. NaN carries no evidence and holds the state. Pure. */
export declare function updatePairedBet(state: PairedBetState, spec: PairedBetSpec, x: number): PairedBetState;
export declare function pairedBetWealth(state: PairedBetState): number;
//# sourceMappingURL=_paired-bet.d.ts.map