import type { MSPRTParams, CompiledConfig, DetectorVerdict, BaselineCell, SchemaContinuityRecord, TenantTier } from '../types';
import { type CUSUMStates, type CUSUMInput } from './_page-cusum-core';
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
/** Shadow-evaluator context, shared by classical and (a superset of the)
 *  mixture path. */
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
/** Per-tick shadow evaluator. For each primary SLI:
 *  1. Look up the cell params at `ctx.hourOfDay`.
 *  2. Compute x_n = live − cell baseline mean.
 *  3. Advance the CUSUM state (state must be supplied by caller).
 *  4. Emit `DetectorVerdict`.
 *
 *  Signals missing from either the live metrics map or the cell's params
 *  list are skipped silently — the engine runs on scenarios that may omit
 *  quality-tier signals. */
export declare function evaluateFamilyAShadow(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: CUSUMStates, ctx: FamilyAShadowCtx): DetectorVerdict[];
//# sourceMappingURL=_page-cusum-classical.d.ts.map