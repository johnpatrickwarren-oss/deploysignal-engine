import type { SchemaContinuityRecord, MSPRTParams, CompiledConfig, DetectorVerdict, BaselineCell, BaselineCellEntry, TenantTier } from '../types';
import type { BakeProfile } from '../types';
export declare const DEFAULT_BAKE: BakeProfile;
/** Per-(signal) CUSUM state. One scalar per signal per deploy; carries
 *  across cell boundaries. Initialized to 0. */
export interface CUSUMState {
    /** Current S_n. Non-negative by construction (max(0, ...)). */
    S: number;
    /** Samples observed for this signal so far this deploy. Not gating — the
     *  CUSUM has no minimum-n requirement — but useful for diagnostics and
     *  bake-profile comparisons. */
    n: number;
    /** Running sum of per-tick α contributions, for audit provenance. */
    alphaConsumed: number;
}
export declare function freshCUSUM(): CUSUMState;
/** Per-deploy per-signal state store. Health gate reads/mutates through
 *  this map; caller (orchestrator / test harness) owns the lifetime. */
export type CUSUMStates = Record<string, CUSUMState>;
export declare function getOrCreateCUSUM(states: CUSUMStates, signal: string): CUSUMState;
/** Page-CUSUM update. Mutates `state` in place and returns the new S_n. */
export declare function updateCUSUM(state: CUSUMState, x: number, sigmaSquared: number, tauSquared: number, perTickAlpha: number): number;
/** Per-tick CUSUM evaluation input. */
export interface CUSUMInput {
    signal: string;
    params: MSPRTParams;
    state: CUSUMState;
    trafficPct: number;
    /** min_traffic_pct_for_fire from CompiledConfig.traffic_pct_gate. Absent
     *  → 0 (no gate). */
    trafficGate: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
}
/** Match a cell by `hour_of_day` (and `day_of_week` when present). Returns
 *  the first cell whose key agrees on every dimension supplied in `query`.
 *  Extra dimensions on the stored cell are ignored; extra dimensions on
 *  the query are respected (strict subset match).
 *
 *  Addition #23 — `tenant_tier` on the query participates in the match when
 *  the stored cell also carries a `tenant_tier`. Two-stage match: first
 *  attempt the requested tier; if no cell carries it, fall back to
 *  `'aggregate'` tier (pre-#23 backward compat). Cells without a
 *  `tenant_tier` key compare equal to any query tier (pre-#23 config
 *  shape keeps working). */
export declare function matchCellByHour(cells: BaselineCellEntry[], query: BaselineCell & {
    day_of_week?: number;
    tenant_tier?: TenantTier;
}): BaselineCellEntry | undefined;
/** `traffic_pct_gate.min_traffic_pct_for_fire` or 0 if gate not compiled. */
export declare function trafficGateMin(cfg: CompiledConfig): number;
/** Primary SLIs covered by Week-2 Family A. Kept in one place so health.ts,
 *  the compiler, and the parity test agree on the set. */
export declare const FAMILY_A_PRIMARY_SIGNALS: readonly ["p99_latency", "ttft", "eval_score", "tool_success_rate", "downstream_err", "cost_req"];
export declare function suppressed(signal: string, reason: string, state: CUSUMState, threshold: number): DetectorVerdict;
/** Q69.D (2026-08-18) — relocated from _page-cusum-classical.ts at the classical path's
 *  full retirement (validation/nab/RERUN-2026-08-18-PREREGISTRATION.md); the mixture shadow
 *  consumes this shape. */
export interface FamilyAShadowCtx {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    /** Addition #13: signals in the operator's ignore band; this detector
     *  emits `reason_code: 'ignore_threshold'` for any matching signal
     *  BEFORE cell/bake-profile/traffic checks and skips the CUSUM
     *  update — an "ignored" signal is not an observation the comparative
     *  test should consume. */
    ignoredSignals?: Set<string>;
    /** Addition #23 — tenant_id for the current request(s). Resolved to
     *  `tenant_tier` via `cfg.tenant_tier_map` and threaded into cell
     *  lookup. Absent → `'aggregate'` tier (pre-#23 semantics). */
    tenantId?: string;
}
//# sourceMappingURL=_page-cusum-core.d.ts.map