/** Reference-block length (registered default; overridable per `calibrateShapeBlocks`). */
export declare const W_K6 = 30;
/** kappa for the e-value calibrator e = kappa*p^(kappa-1). Registered, shared
 *  derivation with K3/K4 (point-tail-bet-e-value.ts's KAPPA, spectral-bet-e-process.ts's KAPPA_K3). */
export declare const KAPPA_K6 = 0.1;
/** Minimum disjoint reference blocks. Below this the block-conformal rank's
 *  denominator (m+1) makes even the most extreme live window's p no smaller
 *  than 1/(m+1) — too coarse to be a meaningful rank; registered floor. */
export declare const M_MIN_K6 = 100;
export type ShapeFeatureName = 'kurtosis' | 'absSkew';
/** Per-feature calibration: the reference blocks' own statistic median, plus
 *  the ascending |deviation from that median| distances the live rank counts
 *  against. */
export interface ShapeFeatureCalibration {
    median: number;
    sortedAbsDev: number[];
}
export interface ShapeCalibration {
    W: number;
    m: number;
    kurtosis: ShapeFeatureCalibration;
    absSkew: ShapeFeatureCalibration;
}
export interface ShapeFeatureResult {
    name: ShapeFeatureName;
    T: number;
    p: number;
    e: number;
}
export interface ShapeWindowResult {
    perFeature: ShapeFeatureResult[];
    eAvg: number;
}
export interface ShapeWealthResult {
    wealth: number;
    log: number[];
}
/** Slices `rows` into m disjoint CONTIGUOUS length-W blocks (m = floor(rows.length/W);
 *  the remainder, if any, is dropped, not padded), computes per-block kurtosis and
 *  |skew|, and stores each feature's reference median plus its ascending
 *  |deviation from median| distances. Requires m >= M_MIN_K6. */
export declare function calibrateShapeBlocks(rows: number[], W?: number): ShapeCalibration;
/** Per-window block-conformal shape bet. Requires `window.length === cal.W`.
 *  Per feature: distance-rank p against the calibration's reference blocks,
 *  e through the kappa*p^(kappa-1) calibrator; eAvg is the mean of the two
 *  feature e-values (never max — see module docstring). */
export declare function shapeBetWindow(window: number[], cal: ShapeCalibration, kappa?: number): ShapeWindowResult;
/** Wealth over disjoint windows: product of per-window eAvg, accumulated in the
 *  log domain (ADR 0026 convention — see module docstring). `log[i]` is the
 *  cumulative log-wealth through window i, the running trajectory an any-time
 *  (Ville-inequality) crossing check needs at every prefix. Each window is
 *  validated by `shapeBetWindow` (propagates its guards). */
export declare function shapeBetWealth(windows: number[][], cal: ShapeCalibration): ShapeWealthResult;
//# sourceMappingURL=shape-block-conformal-bet.d.ts.map