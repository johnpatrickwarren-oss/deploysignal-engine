/** κ for the e-value calibrator e = κ·p^(κ−1). Registered, not tuned. */
export declare const KAPPA = 0.1;
export interface TailBetCalibration {
    median: number;
    mad: number;
    sortedScores: number[];
}
/** Computes (median_ref, MAD_ref, sorted calibration scores) from held-out
 *  rows. Requires n >= 10,000 (the coverage-gap page's registered floor)
 *  and a nondegenerate MAD (MAD = 0 collapses every score to +Infinity). */
export declare function calibrateTailBet(rows: number[]): TailBetCalibration;
/** Per-point conformal tail-bet e-value against a frozen calibration.
 *  score = |x - cal.median| / cal.mad; p = (1 + #{cal >= score}) / (n+1);
 *  e = kappa * p^(kappa-1). See module docstring for the validity argument. */
export declare function pointTailBetEValue(x: number, cal: TailBetCalibration, kappa?: number): {
    e: number;
    p: number;
    score: number;
};
//# sourceMappingURL=point-tail-bet-e-value.d.ts.map