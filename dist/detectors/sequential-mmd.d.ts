import type { CompiledConfig, DetectorVerdict, FamilyCPerCell, MMDParams, SchemaContinuityRecord, EMmdState } from '../types';
/** Running window of relative-deviation vectors. One window per deploy;
 *  orchestrator caller owns the lifetime (same shape as TrendBuffer). */
export interface SequentialMMDState {
    /** Most-recent `window_size` tick vectors in chronological order. */
    window: number[][];
    /** Total ticks observed this deploy (for bake/min-window eligibility). */
    ticks_observed: number;
}
export declare function freshMMDState(): SequentialMMDState;
/** Retrieve or allocate the Sequential MMD state on the caller's state
 *  store. Keyed by a single global key (one MMD state per deploy);
 *  callers that care about cell-context can key by cell if desired. */
export declare function getOrCreateMMDState(states: Record<string, SequentialMMDState>): SequentialMMDState;
/** Gaussian RBF kernel (square-exponential) with given bandwidth.
 *  k(x, y) = exp(-||x − y||² / (2·σ²)). Exported for reuse by the Q67
 *  Phase-3.d.B canonical betting-e-process variant. */
export declare function rbf(x: number[], y: number[], bandwidth: number): number;
/** Compute U_t for the current window against the baseline set `baseline`.
 *  `mmdParams.baseline_baseline_sum` already carries the third term.
 *  Returns U_t as defined in the Li/Chen 2019 streaming recurrence. */
export declare function computeUt(window: number[][], baseline: number[][], mmdParams: MMDParams): number;
/** Generate a deterministic baseline pool for the MMD cross-term. We
 *  pseudo-sample the cell's distribution via L·w where w ~ N(0, I) and
 *  L = Cholesky(Σ). This matches Family E's parametric-bootstrap approach
 *  and keeps the detector self-contained (no need to ship the raw baseline
 *  rows on every CompiledConfig). Deterministic across runs via seed. */
export declare function generateBaselinePool(params: FamilyCPerCell, size: number, seed: number): number[][];
export declare const BASELINE_POOL_SIZE = 500;
/** Per-cell seeding for the baseline pool so cells yield deterministic,
 *  distinct pools (matches Family E's pattern). Exported for reuse by the
 *  Q67 Phase-3.d.B canonical betting-e-process variant. */
export declare function baselinePoolSeed(cellKey: {
    hour_of_day: number;
    day_of_week?: number;
}): number;
/** Initial wealth state for a new (deploy, cell) e-MMD evaluation. */
export declare function freshEMmdState(): EMmdState;
/** Evaluate the e-MMD betting e-process at one tick per REPLY-43 D3.
 *
 *  Semantic note on `pickBet` input moments (flagged for architect
 *  review at slice-2 landing): REPLY-43 D3 pseudo-code passes
 *  `(runningMean, runningSecondMoment)` — the moments of the raw
 *  kernel-distance scalar `d_t` — to `pickBet`. REPLY-34's primitives
 *  were designed for bounded z_t ∈ [−1, 1] with E[z] near 0 under H₀;
 *  feeding d-moments (E[d] > 0 under H₀) produces a different bet
 *  shape than the canonical bounded-z form. Implemented literally per
 *  brief; empirical fire horizons on canned demos are the ground
 *  truth in slice-2 integration tests. If those diverge, architect
 *  re-dispositions pickBet-input semantics.
 *
 *  Pattern mirrors `evaluateSequentialMMD` for cell lookup + guards;
 *  shares the same tier-aware `lookupFamilyCParams` and same
 *  pseudo-baseline pool generator. */
export declare function evaluateEMmd(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: Record<string, EMmdState | number[][] | unknown>, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    tenantId?: string;
}): DetectorVerdict | null;
//# sourceMappingURL=sequential-mmd.d.ts.map