import type { CompiledConfig, DetectorVerdict, BaselineCellEntry, ConformalParams, FamilyCPerCell, SchemaContinuityRecord, TenantTier, ConformalEValueState } from '../types';
/** Mahalanobis distance √(r^T Σ⁻¹ r). Returns null if Σ is not PD.
 *  Exported so the compiler can precompute calibration scores with the
 *  same scoring function the detector uses at query time. */
export declare function mahalanobisDistance(r: number[], covariance: number[][]): number | null;
/** Conformal p-value: (#{ s_c ≥ s_query } + 1) / (n_calibration + 1).
 *  `+1` in numerator and denominator makes this a valid (exchangeable)
 *  p-value even on exact ties. */
export declare function conformalPValue(queryScore: number, calibrationScores: number[]): number;
/** Retrieve Family E calibration + matching Family C mean/covariance.
 *
 *  W5 §REPLY-16 Q2: Family E always consults `aggregate_fallback.family_E`
 *  for calibration_scores, never per-cell. Rationale: per-cell calibration
 *  would have far fewer samples than the aggregate's pooled baseline (16K+
 *  samples), risking the underpowered-guard tripping at the project's
 *  α_E=1e-4 default (which needs ≥9999 samples). The aggregate's pooled
 *  scores are statistically richer than any per-cell slice and the
 *  exchangeability assumption underlying conformal p-values is preserved
 *  (calibration draws are independent of the query).
 *
 *  The Family C mean/covariance used for the Mahalanobis distance still
 *  comes from the per-cell match when present — that's a different
 *  contract (per-cell baseline distribution shape, not nonconformity
 *  scoring tail), so per-cell μ/Σ continues to apply.
 */
export declare function lookupFamilyEParams(cfg: CompiledConfig, cell: {
    hour_of_day: number;
    day_of_week?: number;
    tenant_tier?: TenantTier;
}): {
    params: ConformalParams;
    famC: FamilyCPerCell;
    source: BaselineCellEntry | 'aggregate';
} | null;
/** Evaluate Family E at one tick. Legacy unweighted/weighted paths are
 *  stateless (per-tick single-shot). Addition #22 `weighted_e_value`
 *  variant is stateful — requires the `state` parameter; function
 *  mutates `state.M` / `state.n` / `state.alphaConsumed` in place on
 *  that dispatch branch.
 *
 *  Returns null when Family E isn't compiled for this cell/config. */
export declare function evaluateFamilyE(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    /** Addition #23 — tenant_id resolved to tenant_tier via
     *  `cfg.tenant_tier_map`; drives per-tier cell lookup for μ/Σ. */
    tenantId?: string;
}, state?: ConformalEValueState): DetectorVerdict | null;
type ConformalKind = 'unweighted' | 'weighted' | 'weighted_e_value';
/** Unified context the Record<ConformalKind, Evaluator> receives.
 *  `state` is only required by `weighted_e_value`. */
interface ConformalDispatchCtx {
    params: ConformalParams;
    s: number;
    r: number[];
    alphaE: number;
    covariance: number[][];
    state?: ConformalEValueState;
}
type ConformalEvaluator = (ctx: ConformalDispatchCtx) => DetectorVerdict;
/** Resolve ConformalParams.kind to the dispatch key. Normalizes
 *  undefined (pre-#19 shape) → 'unweighted'. */
declare function conformalKindForDispatch(params: ConformalParams): ConformalKind;
/** Exposed for dispatch-map parity testing. */
export declare const _CONFORMAL_EVALUATORS_FOR_TEST: Record<ConformalKind, ConformalEvaluator>;
export declare const _conformalKindForDispatch: typeof conformalKindForDispatch;
/** Fresh wealth state for a new (deploy, cell) weighted-e-value
 *  evaluation. `M₀ = 1` per Ville-inequality convention. */
export declare function freshConformalEValueState(): ConformalEValueState;
/** Addition #22 (ARCHITECT-REPLY-46b corrected D3) — weighted e-value
 *  per-tick evaluation against a cell with `kind: 'weighted_e_value'`
 *  ConformalParams. Caller owns the state object; this function mutates
 *  `state.M` / `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (hedged-indicator betting form; λ=1 special case of
 *  Shekhar-Ramdas 2023):
 *
 *    Let s_t = √(xᵀ Σ⁻¹ x) be the live Mahalanobis distance against
 *    the cell's robust covariance.
 *    k = findFirstGE(sorted_scores, s_t)     // O(log M) rank
 *    den_raw = cumulative_weights_above[k]   // O(1) reverse-cumsum,
 *              0 if k === scores.length (s_t exceeds all calibration)
 *    indicator = (den_raw < α_E · total_weight) ? 1 : 0
 *    e_t = 1 + indicator − α_E
 *        ⇒ indicator=0: e_t = 1 − α_E ≈ 1 (slight wealth decay)
 *        ⇒ indicator=1: e_t = 2 − α_E ≈ 2 (wealth doubles on fire tick)
 *    M_t = M_{t-1} · e_t
 *    fire iff M_t ≥ 1/α_E
 *
 *  Validity (why this IS an e-value under weighted exchangeability):
 *
 *    Under H₀, P(indicator = 1 | H₀) = P(s_t is in upper α_E tail of
 *    calibration distribution) = α_E by construction of the weighted
 *    rank. So E[e_t | H₀] = α_E · (2 − α_E) + (1 − α_E) · (1 − α_E)
 *                          = 2α_E − α_E² + 1 − 2α_E + α_E²
 *                          = 1  exactly.
 *    Ville's inequality applies: sup_t P(M_t ≥ 1/α_E | H₀) ≤ α_E.
 *
 *  Replaces REPLY-46's original D3 formula `e_t = total_weight / den`
 *  which was 1/p-conformal inversion (not a valid e-value — E[e_t|H₀]
 *  ≈ log(M) + γ, wealth grew multiplicatively under H₀). REPLY-46b
 *  corrects by swapping to the hedged-indicator form that preserves
 *  the martingale property under weighted exchangeability. */
export declare function evaluateConformalWeightedEValue(input: {
    params: Extract<ConformalParams, {
        kind: 'weighted_e_value';
    }>;
    covariance: number[][];
    alpha: number;
}, x_t: number[], state: ConformalEValueState): DetectorVerdict;
export {};
//# sourceMappingURL=conformal.d.ts.map