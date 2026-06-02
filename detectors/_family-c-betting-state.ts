// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/family-c-betting-e-process.ts (split)
// Sync policy: vendored-at-pin
//
// State factory + per-tick projection/gating helpers extracted VERBATIM
// from family-c-betting-e-process.ts. No behavior change.

import type {
  CompiledConfig, DetectorVerdict, FamilyCBettingEProcessState,
} from '../types';
import { FAMILY_C_SIGNALS } from './hotelling';

/** Numerical guard for Math.log(0) on wealth-factor underflow. Mirrors
 *  evaluateEMmd's WEALTH_FLOOR convention. */
export const LOG_FACTOR_FLOOR = 1e-12;

/** Default λ_max if FamilyCBettingEProcessParams.lambda_max absent —
 *  canonical 0.5 per `ONSstrategy(F, lambda_max=0.5)` signature. */
export const DEFAULT_LAMBDA_MAX = 0.5;

/** Initial wealth state for a new (deploy, cell) Q67 v2 evaluation.
 *
 *  `p` is the input dimension (Family C joint-vector size, typically 11).
 *  `D` is optional Q72 SLICE 2 RFF feature dimension; when provided,
 *  the state pre-allocates q_running_phi_sum ∈ R^D for the unbiased
 *  RFF witness path. Absent ⇒ legacy state shape (q_running_phi_sum
 *  not initialized; runtime falls back to biased streaming witness). */
export function freshFamilyCBettingEProcessState(
  p: number, D?: number,
): FamilyCBettingEProcessState {
  const state: FamilyCBettingEProcessState = {
    log_S_t: 0,                  // S_0 = 1 ⇒ log_S_0 = 0
    ons_lambda: 0,               // canonical λ_0 = 0 (no bet at start)
    ons_inverse_hessian: 1,      // canonical A_0 = 1 (implicit regularization)
    n: 0,
    witness_running_max: 0,
    q_running_sum: new Array<number>(p).fill(0),
    q_count: 0,
    fired: false,
    tick_at_first_fire: null,
    alphaConsumed: 0,
  };
  if (D !== undefined && D > 0) {
    state.q_running_phi_sum = new Array<number>(D).fill(0);
  }
  return state;
}

/** Project live metrics into the Family C relative-deviation vector.
 *  Returns null when any consumed signal is missing (detector skips that
 *  tick) — same convention as evaluateEMmd / evaluateSequentialMMD. */
export function liveVectorFamilyC(
  liveMetrics: Record<string, number | undefined>,
  mean: number[],
  signals: readonly string[],
): number[] | null {
  const p = signals.length;
  const v = new Array<number>(p);
  for (let i = 0; i < p; i++) {
    const live = liveMetrics[signals[i]];
    if (live === undefined) return null;
    const m = mean[i];
    v[i] = Math.abs(m) > 1e-12 ? (live - m) / m : (live - m);
  }
  return v;
}

/** Most-constrained bake profile across Family C signals. Local copy
 *  (mirrors sequential-mmd.ts mmdBakeProfile) so this detector doesn't
 *  pull a private export from sibling. */
export function familyCBakeProfile(cfg: CompiledConfig): { min_ticks: number; max_days: number } {
  const profiles = cfg.bake_profiles ?? {};
  let maxMinTicks = 0;
  let maxMaxDays = Infinity;
  let any = false;
  const signals = cfg.family_c_signals ?? FAMILY_C_SIGNALS;
  for (const sig of signals) {
    const p = profiles[sig];
    if (!p) continue;
    any = true;
    if (p.min_ticks_before_eligible > maxMinTicks) maxMinTicks = p.min_ticks_before_eligible;
    if (p.max_deploy_window_days < maxMaxDays) maxMaxDays = p.max_deploy_window_days;
  }
  if (!any) return { min_ticks: 3, max_days: 1 };
  return { min_ticks: maxMinTicks, max_days: Number.isFinite(maxMaxDays) ? maxMaxDays : 1 };
}

export function suppressedVerdict(reason: string, threshold: number, statistic: number | null): DetectorVerdict {
  return {
    verdict: 'suppressed', statistic, threshold,
    alpha_consumed: 0, alpha_spent: 0,
    reason_code: reason, family: 'C',
    signal: 'sequential_mmd_betting_e_process',
  };
}
