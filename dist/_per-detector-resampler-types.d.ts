export type DetectorFamily = 'family_A_betting' | 'family_A_page_cusum' | 'family_C_safe_test' | 'family_C_chi_square' | 'family_D_spectral' | 'family_D_kv_cache' | 'family_E_conformal' | 'mmd_betting' | 'mmd_bootstrap_null' | 'family_B_pattern_match';
export type ResamplerMode = 'empirical' | 'parametric';
export type ResamplerMode3Way = 'iid_bootstrap' | 'parametric_gaussian' | 'parametric_ar1';
/** Per-detector firing-ID emission per Q58.5. Stamps detector_family +
 *  methodology_source on every firing for explicit per-detector
 *  attribution; no cross-pass attribution mixing.
 *
 *  Step-4 amendment: methodology_source widened to union of 2-way
 *  ResamplerMode and 3-way ResamplerMode3Way so the same stub interface
 *  serves both `mergePerDetectorAcrossPasses` (2-way) and
 *  `mergePerDetectorAcrossThreePasses` (3-way). */
export interface PerDetectorPoolFiringId {
    cell_key: {
        hour_of_day: number;
        day_of_week: number;
        tier?: string;
    };
    tick: number | null;
    signal?: string;
    statistic_value: number | null;
    threshold: number | null;
    verdict: 'fire' | 'clean';
    detector_family: DetectorFamily;
    methodology_source: ResamplerMode | ResamplerMode3Way;
}
/** Per-detector iid_bootstrap pool block emitted under
 *  `report.detectors[family]`. Nested storage per Q58.1
 *  schema. Step-4 amendment: methodology_source widened to union of
 *  2-way + 3-way modes (3-way values stamped post-Step-4). */
export interface PerDetectorIidBootstrapPool {
    pool_id: DetectorFamily;
    methodology_source: ResamplerMode | ResamplerMode3Way;
    compile_source_fields: readonly string[];
    trajectories_per_pass: number;
    firing_count: number;
    firing_ids: PerDetectorPoolFiringId[];
    fpr_per_131: number;
}
/** Subset of the runFprSweep result that mergePerDetectorAcrossPasses
 *  consumes. Decoupled from build-report-card.js's full FprSweepResult
 *  so per-detector-resampler-mode.ts stays free of build-report-card
 *  imports (anti-scope: engine/* must not depend on tools/*). */
export interface FprSweepResultLike {
    /** args.healthyWindows; typically 131. */
    healthy_window_count: number;
    /** firing_attribution_by_category.counts: per-category window counts. */
    firing_attribution_by_category: {
        counts: Record<string, number>;
        per_cell_breakdown?: Record<string, Record<string, number>>;
    };
    /** firing_events_by_detector_id: raw detector_id → event count. */
    firing_events_by_detector_id: Record<string, number>;
}
/** Subset of compiled config consulted to disambiguate Family C
 *  hotelling variant pools (safe_test vs chi_square). Full type lives
 *  in engine/types/config.ts; this is a structural subset to avoid
 *  importing the full type tree at validation methodology boundary.
 *
 *  Q68 Phase-3.d.C consolidation: `mmd_variant` field retired from
 *  schema; Family C MMD pool attribution now constant (always
 *  betting_e_process / mmd_betting; mmd_bootstrap_null pool retained
 *  with always-zero count for backward-compat).
 *  Q69 Phase-3.d.D close: CAVEAT_EXEMPT_FAMILIES set retired (Q58 #14
 *  CAVEAT clause RETIRED-SPEC-SIDE per Q69.4 stamp); mmd_bootstrap_null
 *  pool retains always-zero attribution for schema backward-compat. */
export interface CompiledConfigVariantHints {
    baseline_cells?: {
        aggregate_fallback?: {
            family_C?: {
                hotelling_variant?: 'safe_test' | 'chi_square';
            };
        };
    };
}
//# sourceMappingURL=_per-detector-resampler-types.d.ts.map