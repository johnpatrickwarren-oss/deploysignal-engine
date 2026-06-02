import type { CompiledConfig, DetectorVerdict, FamilyCBettingEProcessState } from '../types';
/** Numerical guard for Math.log(0) on wealth-factor underflow. Mirrors
 *  evaluateEMmd's WEALTH_FLOOR convention. */
export declare const LOG_FACTOR_FLOOR = 1e-12;
/** Default λ_max if FamilyCBettingEProcessParams.lambda_max absent —
 *  canonical 0.5 per `ONSstrategy(F, lambda_max=0.5)` signature. */
export declare const DEFAULT_LAMBDA_MAX = 0.5;
/** Initial wealth state for a new (deploy, cell) Q67 v2 evaluation.
 *
 *  `p` is the input dimension (Family C joint-vector size, typically 11).
 *  `D` is optional Q72 SLICE 2 RFF feature dimension; when provided,
 *  the state pre-allocates q_running_phi_sum ∈ R^D for the unbiased
 *  RFF witness path. Absent ⇒ legacy state shape (q_running_phi_sum
 *  not initialized; runtime falls back to biased streaming witness). */
export declare function freshFamilyCBettingEProcessState(p: number, D?: number): FamilyCBettingEProcessState;
/** Project live metrics into the Family C relative-deviation vector.
 *  Returns null when any consumed signal is missing (detector skips that
 *  tick) — same convention as evaluateEMmd / evaluateSequentialMMD. */
export declare function liveVectorFamilyC(liveMetrics: Record<string, number | undefined>, mean: number[], signals: readonly string[]): number[] | null;
/** Most-constrained bake profile across Family C signals. Local copy
 *  (mirrors sequential-mmd.ts mmdBakeProfile) so this detector doesn't
 *  pull a private export from sibling. */
export declare function familyCBakeProfile(cfg: CompiledConfig): {
    min_ticks: number;
    max_days: number;
};
export declare function suppressedVerdict(reason: string, threshold: number, statistic: number | null): DetectorVerdict;
//# sourceMappingURL=_family-c-betting-state.d.ts.map