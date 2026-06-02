export type { DetectorFamily, ResamplerMode, ResamplerMode3Way, PerDetectorPoolFiringId, PerDetectorIidBootstrapPool, FprSweepResultLike, CompiledConfigVariantHints, } from './_per-detector-resampler-types';
export { PER_DETECTOR_FAMILIES, PER_DETECTOR_RESAMPLER_MODE, COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY, PER_DETECTOR_RESAMPLER_MODE_3WAY, PER_DETECTOR_ALPHA_BUDGETS, } from './_per-detector-resampler-tables';
export { resolveHotellingVariant, extractPerDetectorCounts, } from './_per-detector-resampler-counts';
export { mergePerDetectorAcrossPasses, mergePerDetectorAcrossThreePasses, buildAllThreeModePoolsPerDetector, } from './_per-detector-resampler-merge';
export { checkPerDetectorAcceptance, wilsonUpperBound, summarizePerDetectorAcrossSeeds, } from './_per-detector-resampler-acceptance';
//# sourceMappingURL=per-detector-resampler-mode.d.ts.map