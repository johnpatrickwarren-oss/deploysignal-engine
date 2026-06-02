import type { DetectorFamily, ResamplerMode3Way, PerDetectorIidBootstrapPool, FprSweepResultLike, CompiledConfigVariantHints } from './_per-detector-resampler-types';
/** Merge per-detector firing-counts across the empirical + parametric
 *  passes, attributing each detector only to ITS methodology-aligned
 *  pass per `PER_DETECTOR_RESAMPLER_MODE`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family. */
export declare function mergePerDetectorAcrossPasses(empirical: FprSweepResultLike, parametric: FprSweepResultLike, cfg: CompiledConfigVariantHints): Record<DetectorFamily, PerDetectorIidBootstrapPool>;
/** Three-pass merge: each detector attributed only to its mode-
 *  aligned pass per `PER_DETECTOR_RESAMPLER_MODE_3WAY`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family with the
 *  `methodology_source` field re-typed as `ResamplerMode3Way`
 *  (extends `ResamplerMode` superset). */
export declare function mergePerDetectorAcrossThreePasses(iidBootstrap: FprSweepResultLike, parametricGaussian: FprSweepResultLike, parametricAr1: FprSweepResultLike, cfg: CompiledConfigVariantHints): Record<DetectorFamily, PerDetectorIidBootstrapPool>;
/** Q66 Phase-3.d.A close item (h) schema bump 2.2.0 → 2.3.0 — emit
 *  ALL three mode pools per detector (iid_bootstrap + parametric_gaussian
 *  + parametric_ar1) instead of only the design-intent-mode pool. Each
 *  pool block has the same shape as the existing single-mode
 *  PerDetectorIidBootstrapPool; consumers can evaluate halt criterion
 *  (a) per mode by reading the appropriate field on the per-detector
 *  block in build-report-card.js output. Per architect Ask 2 disposition
 *  2026-05-05 refined-Option-(i) bundled pick.
 *
 *  Backward-compat: existing `iid_bootstrap_pool` field on each detector
 *  block continues to emit design-intent-mode pool (per
 *  `mergePerDetectorAcrossThreePasses`); this new function provides
 *  per-mode visibility ALONGSIDE that, not instead. */
export declare function buildAllThreeModePoolsPerDetector(iidBootstrap: FprSweepResultLike, parametricGaussian: FprSweepResultLike, parametricAr1: FprSweepResultLike, cfg: CompiledConfigVariantHints): Record<DetectorFamily, Record<ResamplerMode3Way, PerDetectorIidBootstrapPool>>;
//# sourceMappingURL=_per-detector-resampler-merge.d.ts.map