import type { CompiledConfig, DetectorVerdict, SchemaContinuityRecord, FamilyCBettingEProcessState } from '../types';
import { type RffFeatureMap } from './family-c-rff';
/** Initial wealth state for a new (deploy, cell) Q67 v2 evaluation.
 *
 *  `p` is the input dimension (Family C joint-vector size, typically 11).
 *  `D` is optional Q72 SLICE 2 RFF feature dimension; when provided,
 *  the state pre-allocates q_running_phi_sum ∈ R^D for the unbiased
 *  RFF witness path. Absent ⇒ legacy state shape (q_running_phi_sum
 *  not initialized; runtime falls back to biased streaming witness). */
export declare function freshFamilyCBettingEProcessState(p: number, D?: number): FamilyCBettingEProcessState;
/** Q72 SLICE 2 (Phase 3.A) — unbiased RFF witness payoff F_t at
 *  observation x_t.
 *
 *  Witness construction:
 *    F_t = φ(x_t) · (μ_P^φ - μ_Q^φ)
 *    μ_Q^φ = (1/q_count) · q_running_phi_sum
 *
 *  Predictability: μ_Q^φ at tick t reflects ONLY past observations —
 *  caller MUST invoke this BEFORE updating q_running_phi_sum with
 *  the current φ(x_t). At q_count = 0 (first observation) the Q-side
 *  contribution is zero — F_1 carries only P-side anchor information,
 *  matching the canonical kernelMMDprediction i=0 boundary.
 *
 *  Linearity → unbiased: φ is a fixed linear feature map, so the
 *  Q-side empirical-mean of φ(X_j) is unbiased for E_X[φ(X)] (no
 *  Jensen's-inequality bias as in the legacy kernel-of-empirical-mean
 *  approximation; see `coordination/DIAGNOSTIC-Q72-PHASE-1-...md`).
 *
 *  Returns { F_t, phi_x } so the caller can update q_running_phi_sum
 *  AFTER computing F_t without re-applying the feature map. */
export declare function computeRffWitness(x_t: number[], baseline_rff_mean: ReadonlyArray<number> | Float64Array, q_running_phi_sum: ReadonlyArray<number> | Float64Array, q_count: number, fm: RffFeatureMap): {
    F_t: number;
    phi_x: Float64Array;
};
/** Compute the kernel-MMD witness payoff F_t at observation x_t.
 *
 *  Per canonical kernelMMD.py:57-92 kernelMMDprediction (streaming-adapted
 *  per Q67.4-ter "Witness paired-samples vs streaming adaptation"):
 *
 *    F_t = (1/N_P) Σ_i K(x_t, x_P_i)  −  K(x_t, μ_{Q_{t−1}})
 *
 *  where x_P_i are P-side baseline samples (size N_baseline; deterministic
 *  pseudo-pool from Cholesky(Σ) — same generator as sequential-mmd.ts) and
 *  μ_{Q_{t−1}} = (q_running_sum / q_count) is the empirical mean of past
 *  Q-side observations. Streaming approximation (kernel-of-empirical-mean
 *  vs sum-of-kernels) preserves O(d) state per Q67.4-ter; predictability
 *  preserved because q_running_sum reflects only past observations.
 *
 *  Running-max normalization at n > WITNESS_NORMALIZATION_THRESHOLD —
 *  divides F_t by max of past |F| values to keep witness bounded around
 *  unity (canonical comment: "heuristic that significantly improves the
 *  practical performance"). */
export declare function computeKernelMMDWitness(x_t: number[], baseline_pool: number[][], q_running_sum: number[], q_count: number, bandwidth: number, witness_running_max: number, n: number): number;
/** ONS predictable bet update per canonical SeqTestsUtils.py:11-38
 *  ONSstrategy. Mutates `state.ons_lambda` and `state.ons_inverse_hessian`
 *  in-place; clamps λ_t to two-sided range [-λ_max, +λ_max] per Q67.4-bis
 *  v2 amendment (canonical default λ_max = 0.5).
 *
 *  Update rule:
 *    z_t = −F_t / (1 + λ_{t−1}·F_t)      gradient (canonical sign convention)
 *    A_t = A_{t−1} + z_t²                 accumulated Hessian (init A_0 = 1)
 *    λ_t = λ_{t−1} − c·z_t/A_t            ONS step (c = 2/(2−log(3)) ≈ 1.6336)
 *
 *  Numerical guard: if |1 + λ·F| < 1e-12 (wealth-factor near zero — would
 *  produce ±∞ gradient), skip the update and preserve λ unchanged.
 *  Practical edge case only at boundary |λ·F| ≈ 1; the wealth-factor floor
 *  in the caller's wealth update prevents log(0). */
export declare function onsUpdate(state: FamilyCBettingEProcessState, F_t: number, lambda_max: number): void;
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