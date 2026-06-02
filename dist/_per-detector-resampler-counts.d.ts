import type { DetectorFamily, ResamplerMode, PerDetectorPoolFiringId, FprSweepResultLike, CompiledConfigVariantHints } from './_per-detector-resampler-types';
/** Resolve Family C hotelling variant from compiled config. Drives
 *  per-detector pool attribution for `family_C` events: when variant
 *  is 'safe_test' all family_C events flow to the safe_test pool;
 *  when 'chi_square' all flow to the chi_square pool. Defaults to
 *  'chi_square' for legacy substrates without the field. */
export declare function resolveHotellingVariant(cfg: CompiledConfigVariantHints): 'safe_test' | 'chi_square';
/** Per-detector firing-count attribution from a single FPR-sweep
 *  pass. Returns `{ count, ids }` where `count` is the per-window
 *  count from `firing_attribution_by_category` (a window contributes
 *  1 per category-firing) and `ids` is a derived list of stub
 *  per-detector firing-IDs.
 *
 *  Disambiguation rules per amended spec § detector family table:
 *  - `family_C_safe_test` ← `family_C` events when `hotelling_variant === 'safe_test'`
 *  - `family_C_chi_square` ← `family_C` events when `hotelling_variant === 'chi_square'`
 *  - `family_D_spectral` ← `family_D` events EXCLUDING kv_cache signal
 *  - `family_D_kv_cache` ← `family_D` events WHERE signal === 'kv_cache'
 *  - `mmd_betting` ← `family_C_mmd` events when `mmd_variant === 'betting_e_process'`
 *  - `mmd_bootstrap_null` ← `family_C_mmd` events when `mmd_variant === 'bootstrap_null'`
 *  - `family_B_pattern_match` ← `family_b` events
 *
 *  detector_id-to-category mapping mirrors `runFprSweep` categorizeId
 *  (build-report-card.js line ~847). */
export declare function extractPerDetectorCounts(source: FprSweepResultLike, family: DetectorFamily, cfg: CompiledConfigVariantHints, mode: ResamplerMode): {
    count: number;
    ids: PerDetectorPoolFiringId[];
};
//# sourceMappingURL=_per-detector-resampler-counts.d.ts.map