// tools/load-production-substrate.ts — Phase E SLICE 10 loader/applier.
//
// Reads a substrate JSON, validates the schema, and produces consumer-
// ready data structures: (a) a compiled-config stamp for NAB tool
// dispatch, (b) per-dataset calibration provenance equivalent to what
// inline fitting would produce. Mirrors `buildPerDatasetConfig`'s
// stamp output so consumers can swap-in substrate-driven calibration
// transparently.

import * as fs from 'node:fs';

import { isProductionArSubstrate, type ProductionArSubstrate } from '../types/production-ar-substrate';

/** Load and validate a substrate JSON from disk. Throws on schema
 *  mismatch (bad version literal, missing required fields). */
export function loadProductionSubstrate(path: string): ProductionArSubstrate {
  if (!fs.existsSync(path)) {
    throw new Error(`loadProductionSubstrate: file not found at ${path}`);
  }
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!isProductionArSubstrate(raw)) {
    throw new Error(
      `loadProductionSubstrate: invalid substrate at ${path}. `
      + 'Expected version "phase-e-slice10-v1" with baseline + ar1 + source + generated_at; '
      + `got: ${JSON.stringify(raw).slice(0, 200)}...`,
    );
  }
  return raw;
}

/** Convert a substrate to the per-signal config block consumed by
 *  Family A detector dispatch (page-cusum, betting, mixture-supermartingale).
 *
 *  Mirrors the inline calibrator's `aggregate_fallback.family_A.per_signal`
 *  shape so the substrate-driven path is a drop-in replacement. */
export function substrateToFamilyAPerSignal(s: ProductionArSubstrate): Record<string, unknown> {
  // Choose the variance to stamp: prefer SLICE 9 deseasoned innovation
  // (most refined), then AR(p) innovation, then SLICE 5 single-lag
  // innovation, finally marginal σ² as floor.
  let sigma2: number;
  if (s.seasonal?.sigma_squared_innovation_deseasoned) {
    sigma2 = s.seasonal.sigma_squared_innovation_deseasoned;
  } else if (s.ar_p?.sigma_squared_innovation) {
    sigma2 = s.ar_p.sigma_squared_innovation;
  } else {
    sigma2 = s.ar1.sigma_squared_innovation;
  }
  const sigma = Math.sqrt(sigma2);
  return {
    baseline_mean: s.baseline.mean,
    baseline_sigma_squared: sigma2,
    baseline_mean_raw: s.baseline.mean,
    baseline_sigma_squared_raw: sigma2,
    tau_squared: sigma2 / 2,
    delta_min: 1.5 * sigma,
    signal_class: 'heavy_tail',
    betting_sliding_buffer_threshold: 1000,
    betting_calibration_scope: 'sliding_buffer_ar1',
    ar1_phi: s.seasonal?.ar1_phi_deseasoned ?? s.ar1.phi,
    mixture_supermartingale_params: {
      mixture_distribution: 'gaussian',
      gaussian_sigma_squared_prior: sigma2,
    },
  };
}

/** Convert a substrate to the per-signal Family D config block. */
export function substrateToFamilyDPerSignal(s: ProductionArSubstrate): Record<string, unknown> {
  return {
    ar1_phi: s.ar1.phi,
    min_peak_lag: s.spectral?.min_peak_lag ?? 3,
    max_peak_lag: s.spectral?.max_peak_lag ?? 10,
    bootstrap_null_quantile: s.spectral?.bootstrap_null_quantile ?? 0.9,
    peak_acf_threshold: s.spectral?.bootstrap_null_quantile ?? 0.9,
    spectral_variant: 'bootstrap_null',
  };
}

/** Convert a substrate to the dispatch options consumed by
 *  `runDetectorOverDataset`. Returns the pre-whitening phi vector,
 *  the calibration mean, and (when present) seasonal means + period. */
export function substrateToDispatchOpts(s: ProductionArSubstrate): {
  prewhitenMean: number;
  prewhitenPhi: number;
  prewhitenPhiArray?: number[];
  seasonalMeans?: number[];
  seasonalPeriod?: number;
} {
  return {
    prewhitenMean: s.baseline.mean,
    // Prefer seasonal-deseasoned AR(1) phi when seasonal is active;
    // otherwise fall back to raw AR(1) phi.
    prewhitenPhi: s.seasonal?.ar1_phi_deseasoned ?? s.ar1.phi,
    prewhitenPhiArray: s.ar_p?.phi,
    seasonalMeans: s.seasonal?.seasonal_means,
    seasonalPeriod: s.seasonal?.period,
  };
}
