// types/production-ar-substrate.ts — Phase E SLICE 10 substrate schema.
//
// Per coordination/PHASE-E-SLICE-10-SPEC.md. Decouples the calibration
// concern (fitting AR(1) / AR(p) / seasonal-decomp / spectral params
// against a representative production window) from the runtime
// detection concern. Production consumers (Anvil, future Tessera
// integrations) fit the substrate offline once per calibration cycle;
// the engine and the NAB tool load it at dispatch time.
//
// Schema version policy: `version: 'phase-e-slice10-v1'` literal
// discriminator. Future schema evolutions add new version literals;
// loaders may accept multiple versions but never silently migrate.

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
export function isProductionArSubstrate(x: unknown): x is ProductionArSubstrate {
  if (typeof x !== 'object' || x === null) return false;
  const candidate = x as Partial<ProductionArSubstrate>;
  if (candidate.version !== 'phase-e-slice10-v1') return false;
  if (typeof candidate.source !== 'object' || candidate.source === null) return false;
  if (typeof candidate.source.signal_name !== 'string') return false;
  if (typeof candidate.source.n_observations !== 'number') return false;
  if (typeof candidate.baseline !== 'object' || candidate.baseline === null) return false;
  if (typeof candidate.baseline.mean !== 'number') return false;
  if (typeof candidate.baseline.sigma_squared_marginal !== 'number') return false;
  if (typeof candidate.ar1 !== 'object' || candidate.ar1 === null) return false;
  if (typeof candidate.ar1.phi !== 'number') return false;
  if (typeof candidate.ar1.sigma_squared_innovation !== 'number') return false;
  if (typeof candidate.generated_at !== 'string') return false;
  return true;
}
