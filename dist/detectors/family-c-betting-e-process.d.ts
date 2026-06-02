import type { CompiledConfig, DetectorVerdict, SchemaContinuityRecord, FamilyCBettingEProcessState } from '../types';
export { computeRffWitness, computeKernelMMDWitness, onsUpdate, } from './_family-c-betting-witness';
export { freshFamilyCBettingEProcessState } from './_family-c-betting-state';
/** Evaluate the canonical Shekhar-Ramdas-2023 betting-e-process variant
 *  at one tick. Pattern mirrors `evaluateEMmd`: shared cell lookup +
 *  bake-profile guard + traffic gate + schema-continuity suppression.
 *  Returns null when:
 *    - cfg.baseline_cells absent (pre-#18 config)
 *    - cell lookup fails
 *    - cell tagged with mmd_variant !== 'betting_e_process' (dispatcher route)
 *    - cell missing betting_e_process_params (pre-Q67 config or non-applicable cell)
 *    - liveMetrics missing any Family C signal */
export declare function evaluateFamilyCBettingEProcess(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: Record<string, FamilyCBettingEProcessState | number[][] | unknown>, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    tenantId?: string;
}): DetectorVerdict | null;
//# sourceMappingURL=family-c-betting-e-process.d.ts.map