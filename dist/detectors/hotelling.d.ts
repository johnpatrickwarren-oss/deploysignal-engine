import type { CompiledConfig, DetectorVerdict, BaselineCellEntry, FamilyCPerCell, SchemaContinuityRecord, TenantTier, SafeHotellingState } from '../types';
export declare const FAMILY_C_SIGNALS: readonly ["p99_latency", "ttft", "tokens_turn", "kv_cache", "cost_req", "downstream_err", "mfu", "hbm_spill", "collective_ops", "corpus_delta", "traffic_pct"];
/** Wilson-Hilferty χ² quantile: χ²(q, k) ≈ k·(1 − 2/(9k) + z·√(2/(9k)))³
 *  where z = Φ⁻¹(q). Good to ~1% in the right tail for k ≳ 5. */
export declare function chiSquareQuantile(q: number, k: number): number;
/** Compute T² = r^T Σ⁻¹ r via Cholesky. Returns null if Σ is not PSD. */
export declare function hotellingT2(r: number[], covariance: number[][]): number | null;
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
/** Unified context the Record<HotellingVariant, Evaluator> receives.
 *  Each evaluator reads only the fields its variant needs. */
interface HotellingDispatchCtx {
    params: FamilyCPerCell;
    r: number[];
    alphaHotelling: number;
    threshold: number;
    states?: Record<string, SafeHotellingState>;
    tier: TenantTier | null;
    hourOfDay: number;
    dayOfWeek?: number;
}
type HotellingVariant = 'chi_square' | 'safe_test';
type HotellingEvaluator = (ctx: HotellingDispatchCtx) => DetectorVerdict;
/** Resolve a cell's declared variant to the effective dispatch key.
 *  Normalizes `undefined` → `'chi_square'` for backward-compat. Falls
 *  `safe_test` back to `chi_square` when compile-time params or
 *  runtime state is missing (preserves pre-D-54-2 semantics). Passes
 *  through any other value so the caller's Record lookup can throw
 *  on unknowns (feedback_no_skip_test_policy). */
declare function hotellingVariantForDispatch(raw: FamilyCPerCell['hotelling_variant'], hasParams: boolean, hasStates: boolean): HotellingVariant;
/** Exposed for dispatch-map parity testing. */
export declare const _HOTELLING_EVALUATORS_FOR_TEST: Record<HotellingVariant, HotellingEvaluator>;
export declare const _hotellingVariantForDispatch: typeof hotellingVariantForDispatch;
/** Fresh wealth state for a new (deploy, cell) safe-Hotelling evaluation.
 *  `M₀ = 1` is the Ville-inequality convention (log-wealth starts at 0). */
export declare function freshSafeHotellingState(): SafeHotellingState;
/** Addition #20 (ARCHITECT-REPLY-43 D4) — safe-Hotelling per-tick
 *  evaluation against a cell with populated `safe_hotelling_params`.
 *  The caller owns the state object; this function mutates `state.M` /
 *  `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (z_t derived inline for future auditors):
 *    Multivariate-Gaussian log-density under null N(0, Σ):
 *      log p₀(x) = -(p/2) log(2π) - ½ log det(Σ) - ½ xᵀ Σ⁻¹ x
 *    Marginal under alternative prior μ ~ N(0, τ²I_p):
 *      p_A(x) = ∫ N(x | μ, Σ) · N(μ | 0, τ²I) dμ = N(x | 0, Σ + τ²I)
 *      log p_A(x) = -(p/2) log(2π) - ½ log det(Σ+τ²I) - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    Log-likelihood ratio:
 *      z_t = log p_A(x) - log p₀(x)
 *          = -½ [log det(Σ+τ²I) - log det(Σ)]
 *            + ½ xᵀ Σ⁻¹ x
 *            - ½ xᵀ (Σ+τ²I)⁻¹ x
 *          = -precompiled_log_det_shrink + ½ xᵀ Σ⁻¹ x - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    M_t = M_{t-1} · exp(z_t); fire when M_t ≥ 1/alpha.
 *
 *  Practice-5 anchors (healthy p=11 cell, τ²≈δ_min²/4):
 *    - Healthy x near zero:        z_t ≈ -0.055, M drifts ~0.946×/tick.
 *    - Drifted x = [3σ, 3σ, 0, …]: z_t ≈  0.445, M grows   ~1.56×/tick.
 *    - Fire horizon on moderate shift: ~log(1/α)/z_t ≈ 9.2/0.445 ≈ 20 ticks.
 */
export declare function evaluateSafeHotelling(input: {
    cell: FamilyCPerCell;
    alpha: number;
}, x: number[], state: SafeHotellingState): DetectorVerdict;
export {};
//# sourceMappingURL=hotelling.d.ts.map