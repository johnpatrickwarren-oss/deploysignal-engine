import type { MSPRTParams, CompiledConfig, DetectorVerdict, BaselineCell, SchemaContinuityRecord, TenantTier } from '../types';
import { type MixtureSupermartingaleState } from './family-a-mixture-supermartingale';
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
/** Evaluate one (signal, cell) at the current tick. Mutates `state` (S_n
 *  and n advance regardless of suppression, per architect spec). */
export declare function evaluateCUSUM(input: CUSUMInput, x: number): DetectorVerdict;
/** Retrieve the per-signal `MSPRTParams` for the cell matching `cell`.
 *  Navigates the Week-3 `baseline_cells` schema; returns null if Family A
 *  isn't compiled or the signal is absent.
 *
 *  Addition #23 — `cell.tenant_tier` routes the lookup through the tiered
 *  cell matrix. On miss, falls back to `'aggregate'` tier (handled by
 *  `matchCellByHour` internally). */
export declare function lookupCellParams(cfg: CompiledConfig, cell: BaselineCell & {
    day_of_week?: number;
    tenant_tier?: TenantTier;
}, signal: string): MSPRTParams | null;
/** `traffic_pct_gate.min_traffic_pct_for_fire` or 0 if gate not compiled. */
export declare function trafficGateMin(cfg: CompiledConfig): number;
/** Primary SLIs covered by Week-2 Family A. Kept in one place so health.ts,
 *  the compiler, and the parity test agree on the set. */
export declare const FAMILY_A_PRIMARY_SIGNALS: readonly ["p99_latency", "ttft", "eval_score", "tool_success_rate", "downstream_err", "cost_req"];
/** Per-tick shadow evaluator. For each primary SLI:
 *  1. Look up the cell params at `ctx.hourOfDay`.
 *  2. Compute x_n = live − cell baseline mean.
 *  3. Advance the CUSUM state (state must be supplied by caller).
 *  4. Emit `DetectorVerdict`.
 *
 *  Signals missing from either the live metrics map or the cell's params
 *  list are skipped silently — the engine runs on scenarios that may omit
 *  quality-tier signals. */
export declare function evaluateFamilyAShadow(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: CUSUMStates, ctx: {
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
}): DetectorVerdict[];
export type MixtureSupermartingaleStates = {
    [signal: string]: MixtureSupermartingaleState;
};
/** Per-tick mixture-supermartingale Page-CUSUM evaluator. Parallel to
 *  `evaluateFamilyAShadow` (classical) but consumes the Howard-Ramdas-2021
 *  Ville-bounded variant + AR(1) pre-whitening (Q66.A.b H1'). */
export declare function evaluateFamilyAShadowMixture(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: MixtureSupermartingaleStates, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    ignoredSignals?: Set<string>;
    tenantId?: string;
}): DetectorVerdict[];
/** Q68 Phase-3.d.C consolidation — top-level Family A Page-CUSUM dispatch
 *  wrapper. Always delegates to Howard-Ramdas-2021 mixture-supermartingale
 *  variant (Ville-bounded; methodology-resampler-mode invariant by
 *  construction). Classical variant retired at Q68 close; the
 *  `cusumStates` parameter is preserved in the signature for caller
 *  backward-compat (TrendBuffer.cusumStates allocation pattern) but is
 *  unused in the runtime path. */
export declare function evaluateFamilyA(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, _cusumStates: CUSUMStates, mixtureStates: MixtureSupermartingaleStates, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    ignoredSignals?: Set<string>;
    tenantId?: string;
}): DetectorVerdict[];
//# sourceMappingURL=page-cusum.d.ts.map