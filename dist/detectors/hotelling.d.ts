import type { CompiledConfig, DetectorVerdict, BaselineCellEntry, FamilyCPerCell, SchemaContinuityRecord, TenantTier, SafeHotellingState } from '../types';
import { hotellingVariantForDispatch } from './_hotelling-dispatch';
export { chiSquareQuantile, hotellingT2 } from './_hotelling-core';
export { freshSafeHotellingState, evaluateSafeHotelling } from './_hotelling-safe';
/** Exposed for dispatch-map parity testing. */
export declare const _HOTELLING_EVALUATORS_FOR_TEST: Record<import("./_hotelling-dispatch").HotellingVariant, (ctx: import("./_hotelling-dispatch").HotellingDispatchCtx) => DetectorVerdict>;
export declare const _hotellingVariantForDispatch: typeof hotellingVariantForDispatch;
export declare const FAMILY_C_SIGNALS: readonly ["p99_latency", "ttft", "tokens_turn", "kv_cache", "cost_req", "downstream_err", "mfu", "hbm_spill", "collective_ops", "corpus_delta", "traffic_pct"];
export declare function lookupFamilyCParams(cfg: CompiledConfig, cell: {
    hour_of_day: number;
    day_of_week?: number;
    tenant_tier?: TenantTier;
}): {
    params: FamilyCPerCell;
    source: BaselineCellEntry | 'aggregate';
} | null;
/** One Family C evaluation at one tick. Legacy `chi_square` path is
 *  stateless (per-tick joint test); the Addition #20 `safe_test` dispatch
 *  branch (activated when `cell.hotelling_variant === 'safe_test'` and
 *  `states` is provided) is stateful — it mutates the per-cell wealth
 *  martingale in `states[__sh_<tier>_<h>_<d>]`. */
export declare function evaluateFamilyC(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    /** Addition #23 — tenant_id resolved to tenant_tier via
     *  `cfg.tenant_tier_map`; drives per-tier cell lookup. */
    tenantId?: string;
}, states?: Record<string, SafeHotellingState>): DetectorVerdict | null;
//# sourceMappingURL=hotelling.d.ts.map