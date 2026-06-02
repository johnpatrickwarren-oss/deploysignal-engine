import type { PerDatasetCalibrationProvenance } from './_nab-per-dataset-types';
/** SLICE 5 — calibrate the spectral bootstrap-null quantile from the
 *  probationary window's empirical peak-ACF distribution. Computes
 *  peakACF on each overlapping length-`SPECTRAL_BOOTSTRAP_WINDOW`
 *  subwindow of the probationary data, then returns the (quantile)-th
 *  order statistic. When the probationary window is too short for
 *  reliable calibration, returns SPECTRAL_BOOTSTRAP_FALLBACK_QUANTILE
 *  (≪ SLICE 4's hardcoded 0.5 but still loose enough to not silent-fail). */
export declare function calibrateSpectralBootstrapQuantile(probationary: number[], minLag: number, maxLag: number, quantile: number): {
    quantile_used: number;
    n_subwindows: number;
    empirically_calibrated: boolean;
};
export interface BuildPerDatasetConfigOptions {
    /** SLICE 4 HAC inflation (mutually exclusive with usePrewhitening).
     *  Default false in SLICE 5 — pre-whitening is the active correction. */
    useHacInflation?: boolean;
    /** SLICE 5 AR(1) pre-whitening + innovation variance. Default true.
     *  When false AND useHacInflation false, falls back to iid-calibrated
     *  marginal σ² (the pre-SLICE-4 behavior; mostly silent-fails on
     *  high-φ NAB data — kept for SLICE-by-SLICE regression measurement). */
    usePrewhitening?: boolean;
    /** SLICE 5 post-fire cooldown for Family A detectors. Default 1000.
     *  Set to 0 to disable. */
    familyACooldownTicks?: number;
    /** SLICE 6 — enable anomaly-likelihood smoothing (Numenta-style
     *  persistence filter). Default true. Set false to revert to SLICE 5
     *  raw cooldown wrapper. */
    useAnomalyLikelihoodSmoothing?: boolean;
    /** Phase E SLICE 8 — enable multi-lag AR(p) Yule-Walker calibration
     *  with AIC order selection (vs SLICE 5's single-lag AR(1)).
     *  Default false at SLICE 8 emit (architect-pick per spec § ASK 4 —
     *  opt-in until SLICE 11 measurement validates default-flip). When
     *  enabled, the fitted `phi` vector + innovation σ² replace the
     *  SLICE 5 single-lag stamping; the Family A dispatcher consumes
     *  the multi-lag prewhitening helper. */
    useArPCalibration?: boolean;
    /** Phase E SLICE 8 — AR(p) order cap. Default `floor(N/10)` clamped
     *  to [1, 30] per spec § ASK 2. Override for testing or for cases
     *  with strong-prior order knowledge. */
    arPMaxOrder?: number;
    /** Phase E SLICE 8 — information criterion for order selection.
     *  Default 'aic' per spec § ASK 1. */
    arPInformationCriterion?: 'aic' | 'bic';
    /** Phase E SLICE 9 — enable seasonal decomposition (per-phase mean
     *  subtraction) before AR(1) pre-whitening. Default false at SLICE
     *  9 emit (architect-pick per spec § ASK 4 — opt-in until SLICE 11
     *  measurement validates default-flip). When enabled, the
     *  calibrator detects the dominant period via ACF peak search,
     *  computes per-phase seasonal means on the probationary window,
     *  AND refits AR(1) on the deseasonalized residual; both are
     *  stamped in `seasonal_decomposition` provenance so the
     *  dispatcher subtracts the seasonal component AND uses the
     *  refit phi for pre-whitening. */
    useSeasonalDecomposition?: boolean;
    /** Phase E SLICE 9 — override the ACF peak threshold for period
     *  detection. Default 0.25 per spec § ASK 1. */
    seasonalMinAcf?: number;
}
/** Build a compiled config calibrated against the probationary window of
 *  one NAB dataset. Schema mirrors the mini-fixture in
 *  test/q64-nab-validation.test.ts (family_A.per_signal[sig] +
 *  family_D[sig] under baseline_cells.aggregate_fallback).
 *
 *  SLICE 5 default behavior: AR(1) pre-whitening + innovation variance
 *  (NOT HAC inflation) + per-dataset spectral bootstrap calibration +
 *  Family A post-fire cooldown. SLICE 4's HAC inflation is preserved as
 *  an opt-in for back-compat regression comparison via the
 *  `useHacInflation: true, usePrewhitening: false` option combination. */
export declare function buildPerDatasetConfig(values: number[], calibrationSignal: string, probationaryFraction: number, options?: BuildPerDatasetConfigOptions): {
    config: Record<string, unknown>;
    provenance: PerDatasetCalibrationProvenance;
};
//# sourceMappingURL=_nab-per-dataset-config.d.ts.map