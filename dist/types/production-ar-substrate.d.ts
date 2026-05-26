/** Production-AR(1) substrate produced by SLICE 10 calibrator. All
 *  fields beyond baseline + AR(1) are OPTIONAL — consumers that need
 *  a specific fit and don't find it fall through to detector defaults. */
export interface ProductionArSubstrate {
    version: 'phase-e-slice10-v1';
    /** Provenance metadata. Required for audit traceability; the calibrator
     *  populates as much as the input CSV makes available. */
    source: {
        signal_name: string;
        description?: string;
        n_observations: number;
        /** ISO timestamps spanning the calibration period; informational. */
        calibration_start?: string;
        calibration_end?: string;
    };
    /** Marginal baseline statistics (always populated). */
    baseline: {
        mean: number;
        sigma_squared_marginal: number;
    };
    /** Single-lag AR(1) calibration (REQUIRED — minimal viable substrate). */
    ar1: {
        phi: number;
        sigma_squared_innovation: number;
    };
    /** Multi-lag AR(p) calibration (SLICE 8). Optional — fit only when
     *  the calibrator's `useArPCalibration: true` option is set. */
    ar_p?: {
        p: number;
        phi: number[];
        sigma_squared_innovation: number;
        ic_kind: 'aic' | 'bic';
        reflection_coefficients: number[];
    };
    /** Seasonal-naive decomposition (SLICE 9). Optional — fit only when
     *  the calibrator's `useSeasonalDecomposition: true` option is set
     *  AND a strong period was detected. */
    seasonal?: {
        period: number;
        seasonal_means: number[];
        acf_at_period: number;
        ar1_phi_deseasoned: number;
        sigma_squared_innovation_deseasoned: number;
    };
    /** Spectral Family D bootstrap-null calibration (SLICE 5). Optional;
     *  populated by the calibrator's spectral fit on the probationary
     *  window. */
    spectral?: {
        bootstrap_null_quantile: number;
        min_peak_lag: number;
        max_peak_lag: number;
        empirically_calibrated: boolean;
    };
    /** ISO timestamp of substrate emission. */
    generated_at: string;
}
/** Type guard / validation. Returns true if the input is a valid
 *  ProductionArSubstrate at the current schema version. */
export declare function isProductionArSubstrate(x: unknown): x is ProductionArSubstrate;
//# sourceMappingURL=production-ar-substrate.d.ts.map