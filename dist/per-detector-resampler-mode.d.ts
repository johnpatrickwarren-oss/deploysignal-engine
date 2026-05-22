export type DetectorFamily = 'family_A_betting' | 'family_A_page_cusum' | 'family_C_safe_test' | 'family_C_chi_square' | 'family_D_spectral' | 'family_D_kv_cache' | 'family_E_conformal' | 'mmd_betting' | 'mmd_bootstrap_null' | 'family_B_pattern_match';
export type ResamplerMode = 'empirical' | 'parametric';
/** Enumerated detector-family list. Source-of-truth ordering for
 *  iteration in `mergePerDetectorAcrossPasses` and report-card
 *  emission loops. */
export declare const PER_DETECTOR_FAMILIES: readonly DetectorFamily[];
/** Per-detector resampler-mode dispatch table per Q58 amended spec
 *  § Q58.2 + detector-family enumeration table. Each detector
 *  evaluated against the methodology surface IT WAS CALIBRATED FOR
 *  (Q2.B.6.4 P4-β.7 ADR methodology-vs-detector-design alignment).
 *
 *  Parametric pass services 6 pools — calibrated against parametric
 *  H₀ surfaces (Cholesky-correct Σ_C draws + per-cell Mahalanobis +
 *  Q3 Ville-clean betting + parametric MMD nulls).
 *
 *  Empirical pass services 4 pools — calibrated against raw distribution
 *  shape (CUSUM raw-distribution + peak-ACF raw temporal structure +
 *  structural ratio observed). */
export declare const PER_DETECTOR_RESAMPLER_MODE: Record<DetectorFamily, ResamplerMode>;
/** Compile-output fields read by each detector's runtime evaluator.
 *  Per Q58 amended spec § Q58.3 + Step-0 Gap 4 disposition (6 missing
 *  fields added across pools).
 *
 *  P3.3 sub-pattern (compile-time-substrate-with-runtime-multiple-
 *  read-paths) anchored: each entry mirrors the actual read paths in
 *  engine/detectors/* runtime code. Mac-Claude-2 grep at Step Q58.0
 *  surfaced 6 missing fields; architect amended; this enumeration
 *  closes the gap. */
export declare const COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY: Record<DetectorFamily, readonly string[]>;
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
/** Merge per-detector firing-counts across the empirical + parametric
 *  passes, attributing each detector only to ITS methodology-aligned
 *  pass per `PER_DETECTOR_RESAMPLER_MODE`. Returns one
 *  `PerDetectorIidBootstrapPool` block per detector family. */
export declare function mergePerDetectorAcrossPasses(empirical: FprSweepResultLike, parametric: FprSweepResultLike, cfg: CompiledConfigVariantHints): Record<DetectorFamily, PerDetectorIidBootstrapPool>;
export type ResamplerMode3Way = 'iid_bootstrap' | 'parametric_gaussian' | 'parametric_ar1';
/** Per-detector 3-way resampler-mode dispatch table per Q58 Step-4
 *  amendment. Each detector evaluated against the methodology
 *  surface IT WAS CALIBRATED FOR (Q2.B.6.4 P4-β.7 ADR
 *  methodology-vs-detector-design alignment). 3-way granularity
 *  resolves the parametric_gaussian-vs-parametric_ar1 trade-off
 *  surfaced empirically at Step-Q58.4. */
export declare const PER_DETECTOR_RESAMPLER_MODE_3WAY: Record<DetectorFamily, ResamplerMode3Way>;
/** Per-detector α budgets for Step-4 acceptance check (mean ≤ α × N
 *  × marginMultiplier). Step-4 amendment per spec § Q58.4 acceptance.
 *  Family B is non-α-consuming (structural pattern match); auto-pass
 *  via `checkPerDetectorAcceptance`. */
export declare const PER_DETECTOR_ALPHA_BUDGETS: Record<DetectorFamily, number>;
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
/** Per-detector α-budget acceptance check per Step-4 amendment.
 *  Architect-pick: mean firing count across N seeds ≤ α × healthy_windows
 *  × marginMultiplier (default 1.2). Tighter than the report-card-level
 *  1.5 × α_total because per-detector α is already conservative. */
export declare function checkPerDetectorAcceptance(perDetectorMeans: Partial<Record<DetectorFamily, number>>, alphaBudgets: Partial<Record<DetectorFamily, number>>, healthyWindows: number, marginMultiplier?: number): Record<DetectorFamily, {
    pass: boolean;
    mean: number;
    expected: number;
    threshold: number;
}>;
/** Wilson-score upper bound for binomial proportion. Used for
 *  per-seed pass-rate confidence interval (architect-pick: ≥ 6/8 seeds
 *  pass under per-seed firing_count ≤ ceil(μ + 1.96 × √μ) Poisson
 *  upper bound). */
export declare function wilsonUpperBound(successes: number, trials: number, z?: number): number;
/** Compute per-detector mean firing-count across N seeds + per-seed
 *  pass count (against Poisson upper bound). */
export declare function summarizePerDetectorAcrossSeeds(perSeedFiringCounts: Array<Record<DetectorFamily, number>>, alphaBudgets: Partial<Record<DetectorFamily, number>>, healthyWindows: number): Record<DetectorFamily, {
    per_seed_counts: number[];
    mean: number;
    per_seed_pass_count: number;
    per_seed_pass_rate: number;
    poisson_upper_bound: number;
}>;
//# sourceMappingURL=per-detector-resampler-mode.d.ts.map