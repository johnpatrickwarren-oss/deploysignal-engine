import { type ProductionArSubstrate } from '../types/production-ar-substrate';
/** Load and validate a substrate JSON from disk. Throws on schema
 *  mismatch (bad version literal, missing required fields). */
export declare function loadProductionSubstrate(path: string): ProductionArSubstrate;
/** Convert a substrate to the per-signal config block consumed by
 *  Family A detector dispatch (page-cusum, betting, mixture-supermartingale).
 *
 *  Mirrors the inline calibrator's `aggregate_fallback.family_A.per_signal`
 *  shape so the substrate-driven path is a drop-in replacement. */
export declare function substrateToFamilyAPerSignal(s: ProductionArSubstrate): Record<string, unknown>;
/** Convert a substrate to the per-signal Family D config block. */
export declare function substrateToFamilyDPerSignal(s: ProductionArSubstrate): Record<string, unknown>;
/** Convert a substrate to the dispatch options consumed by
 *  `runDetectorOverDataset`. Returns the pre-whitening phi vector,
 *  the calibration mean, and (when present) seasonal means + period. */
export declare function substrateToDispatchOpts(s: ProductionArSubstrate): {
    prewhitenMean: number;
    prewhitenPhi: number;
    prewhitenPhiArray?: number[];
    seasonalMeans?: number[];
    seasonalPeriod?: number;
};
//# sourceMappingURL=load-production-substrate.d.ts.map