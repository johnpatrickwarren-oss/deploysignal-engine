// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/hotelling.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/detectors/hotelling.ts — Family C: Hotelling T² multivariate drift.
//
// Per WEEK3-HANDOFF.md §3.1.d (architect-spec). The per-cell covariance
// and mean vector land in `baseline_cells.cells[key].family_C`; Page-CUSUM
// is the scalar per-signal test, Hotelling T² is the multivariate joint
// test. Family C catches correlated drifts that individual-signal CUSUMs
// miss because each component is under its own δ_min — the motivating
// case for the family.
//
// Statistic: T² = r^T Σ⁻¹ r
//   where r = (x − μ) ./ μ (element-wise) is the relative-deviation
//   vector at tick n, μ is the cell's mean vector, and Σ is the cell's
//   Ledoit-Wolf-shrunk covariance of relative deviations (both from the
//   compiler). Relative deviations keep the covariance dimensionless and
//   well-conditioned across signals with very different scales.
//
// Threshold: χ²(1 − α, p) quantile where p = dim(x). Wilson-Hilferty
// approximation (chi-squared ≈ normal after cube-root transform) is used
// — pure arithmetic, no stats library. Accuracy is within a few percent
// in the extreme right tail, adequate for a pass/fire decision.
//
// Suppression: if the Cholesky factorization of Σ fails, the cell's
// covariance is not positive-definite — detector returns
// `suppressed/covariance_singular` rather than fabricating a verdict.
//
// God-file decomposition: the Hotelling T² core math, the variant
// dispatch maps, and the safe-Hotelling e-process now live in sibling
// `_hotelling-*.ts` modules. This file remains the public facade —
// every name previously importable from `detectors/hotelling.ts` is
// re-exported here, so the import surface is byte-for-byte unchanged.

import type {
  CompiledConfig, DetectorVerdict, BaselineCellEntry, FamilyCPerCell,
  SchemaContinuityRecord, TenantTier, SafeHotellingState,
} from '../types';
import { resolveTenantTier } from '../types';
import { shouldSuppress } from '../l0/schema-continuity';
import { trafficGateMin } from './page-cusum';
import { chiSquareQuantile, hotellingT2 } from './_hotelling-core';
import {
  HOTELLING_EVALUATORS, hotellingVariantForDispatch,
} from './_hotelling-dispatch';
import { freshSafeHotellingState, evaluateSafeHotelling } from './_hotelling-safe';

// ── Re-exports preserving the public import surface ───────────────────
export { chiSquareQuantile, hotellingT2 } from './_hotelling-core';
export { freshSafeHotellingState, evaluateSafeHotelling } from './_hotelling-safe';

/** Exposed for dispatch-map parity testing. */
export const _HOTELLING_EVALUATORS_FOR_TEST = HOTELLING_EVALUATORS;
export const _hotellingVariantForDispatch = hotellingVariantForDispatch;

// Primary SLI vector for Family C — must agree with tools/calibrate.ts
// FAMILY_C_SIGNALS order. The covariance matrix's row/column indices are
// this list's positions.
export const FAMILY_C_SIGNALS = [
  'p99_latency', 'ttft', 'tokens_turn', 'kv_cache', 'cost_req',
  'downstream_err', 'mfu', 'hbm_spill', 'collective_ops',
  'corpus_delta', 'traffic_pct',
] as const;

/** Retrieve the Family C params for the cell matching `cell`. Falls back
 *  to `aggregate_fallback.family_C` when the cell's confidence is
 *  aggregate/none. Returns null if Family C isn't compiled.
 *
 *  Addition #23 — `cell.tenant_tier` routes the lookup through the tiered
 *  matrix. Two-stage match: exact tier first, then `'aggregate'` tier,
 *  then `aggregate_fallback.family_C` as the last resort. Pre-#23 configs
 *  (no tenant_tier on cells) match any tier query. */
function matchFamilyCCell(
  bc: NonNullable<CompiledConfig['baseline_cells']>,
  cell: { hour_of_day: number; day_of_week?: number; tenant_tier?: TenantTier },
  tier: TenantTier | undefined,
): BaselineCellEntry | undefined {
  return bc.cells.find((c) => {
    if (c.key.hour_of_day !== cell.hour_of_day) return false;
    if (cell.day_of_week !== undefined && c.key.day_of_week !== undefined) {
      if (c.key.day_of_week !== cell.day_of_week) return false;
    }
    if (tier !== undefined && c.key.tenant_tier !== undefined) {
      if (c.key.tenant_tier !== tier) return false;
    }
    return true;
  });
}

export function lookupFamilyCParams(
  cfg: CompiledConfig,
  cell: { hour_of_day: number; day_of_week?: number; tenant_tier?: TenantTier },
): { params: FamilyCPerCell; source: BaselineCellEntry | 'aggregate' } | null {
  const bc = cfg.baseline_cells;
  if (!bc) return null;
  let match = matchFamilyCCell(bc, cell, cell.tenant_tier);
  if ((!match || !match.family_C) && cell.tenant_tier !== undefined && cell.tenant_tier !== 'aggregate') {
    match = matchFamilyCCell(bc, cell, 'aggregate');
  }
  if (match?.family_C) return { params: match.family_C, source: match };
  if (bc.aggregate_fallback.family_C) return { params: bc.aggregate_fallback.family_C, source: 'aggregate' };
  return null;
}

/** Lookup the per-signal Family A bake profile as the Family C proxy —
 *  architect spec §Addition #4: bake profile is signal-level, not
 *  cell-level, and applies to Families A/C/D/E. Family C uses the
 *  most-constrained profile across its signals (max of each field)
 *  so the joint test only fires when every component signal is ready.
 *
 *  W4 §4.1.h (ARCHITECT-REPLY-12 S2 landing): adds `min_obs` as the
 *  joint `min_observation_window` clause-2 bound. */
function familyCBakeProfile(cfg: CompiledConfig): { min_ticks: number; min_obs: number; max_days: number } {
  const profiles = cfg.bake_profiles ?? {};
  let maxMinTicks = 0, maxMinObs = 0, maxMaxDays = Infinity;
  let any = false;
  // REPLY-51b v2 R4-1 — prefer config-provided signals (set when
  // compiled under a profile); fall back to hardcoded for legacy
  // configs. Same pattern at every runtime FAMILY_C_SIGNALS site.
  const signals = cfg.family_c_signals ?? FAMILY_C_SIGNALS;
  for (const sig of signals) {
    const p = profiles[sig];
    if (!p) continue;
    any = true;
    if (p.min_ticks_before_eligible > maxMinTicks) maxMinTicks = p.min_ticks_before_eligible;
    if (p.min_observation_window > maxMinObs) maxMinObs = p.min_observation_window;
    if (p.max_deploy_window_days < maxMaxDays) maxMaxDays = p.max_deploy_window_days;
  }
  if (!any) return { min_ticks: 3, min_obs: 3, max_days: 1 };
  return {
    min_ticks: maxMinTicks,
    min_obs: maxMinObs,
    max_days: Number.isFinite(maxMaxDays) ? maxMaxDays : 1,
  };
}

/** Schema-continuity + bake-profile + traffic suppression gate for
 *  Family C. Returns a `suppressed` verdict when any gate trips, or
 *  `null` to let `evaluateFamilyC` proceed to the multivariate test.
 *  Extracted from `evaluateFamilyC` verbatim (god-function decomposition);
 *  every branch and `reason_code` is unchanged. */
function familyCSuppressionGate(
  cfg: CompiledConfig,
  ctx: {
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
  },
  threshold: number,
): DetectorVerdict | null {
  // Addition #8 runtime consumer (W5 §S6): per-cell covariance is only
  // meaningful against the baseline's original schema. A breaking change
  // invalidates Σ; suppress without evaluating.
  if (ctx.schemaContinuityClass && shouldSuppress(ctx.schemaContinuityClass, 'C')) {
    return {
      verdict: 'suppressed', statistic: null, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: ctx.schemaContinuityClass === 'observability_stack'
        ? 'observability_stack_deploy' : 'schema_continuity_breaking',
      family: 'C',
    };
  }

  // Bake-profile gate (joint; takes max of per-signal min_ticks_before_eligible).
  const bake = familyCBakeProfile(cfg);
  if (ctx.ticksSinceDeploy < bake.min_ticks) {
    return {
      verdict: 'suppressed', statistic: null, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'bake_profile_not_met', family: 'C',
    };
  }
  // Addition #4 clause 2 — W4 §4.1.h lands the missing consumer. Family C
  // is per-tick single-shot, so ticksSinceDeploy is the post-deploy
  // sample count for this detector's purposes.
  if (ctx.ticksSinceDeploy < bake.min_obs) {
    return {
      verdict: 'suppressed', statistic: null, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'bake_profile_not_met', family: 'C',
    };
  }
  if (ctx.deployAgeDays > bake.max_days) {
    return {
      verdict: 'suppressed', statistic: null, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'bake_profile_not_met', family: 'C',
    };
  }

  // Traffic gate.
  if (ctx.trafficPct < trafficGateMin(cfg)) {
    return {
      verdict: 'suppressed', statistic: null, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'traffic_pct_below_gate', family: 'C',
    };
  }

  return null;
}

/** One Family C evaluation at one tick. Legacy `chi_square` path is
 *  stateless (per-tick joint test); the Addition #20 `safe_test` dispatch
 *  branch (activated when `cell.hotelling_variant === 'safe_test'` and
 *  `states` is provided) is stateful — it mutates the per-cell wealth
 *  martingale in `states[__sh_<tier>_<h>_<d>]`. */
export function evaluateFamilyC(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    /** Addition #23 — tenant_id resolved to tenant_tier via
     *  `cfg.tenant_tier_map`; drives per-tier cell lookup. */
    tenantId?: string;
  },
  states?: Record<string, SafeHotellingState>,
): DetectorVerdict | null {
  if (!cfg.baseline_cells) return null;
  const tier = resolveTenantTier(cfg, ctx.tenantId);
  const lookup = lookupFamilyCParams(cfg, {
    hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek, tenant_tier: tier,
  });
  if (!lookup) return null;
  const { params } = lookup;
  // Addition #18 D8: Family C α-budget splits 50/50 between Hotelling T²
  // and Sequential MMD. When the cell carries `mmd_params` (post-#18
  // recompile), Hotelling takes half; otherwise it uses the full budget
  // (backward compat for v4-and-earlier configs). Threshold uses
  // Wilson-Hilferty chi-square quantile at `1 − α_hotelling`.
  const alphaFamilyC = cfg.alpha_budget.per_family.C ?? 2e-4;
  const alphaHotelling = params.mmd_params ? alphaFamilyC * 0.5 : alphaFamilyC;
  // REPLY-51b v2 R4-1 — χ² degrees-of-freedom matches compiled
  // joint-vector dimension (profile-driven when present).
  const signalsForChi2 = cfg.family_c_signals ?? FAMILY_C_SIGNALS;
  // Q2.B.6.2 — sliding-buffer-aware threshold under joint AR(1) H₀.
  // Stamped by the calibrator post-cholesky_L_eps (per Q2-B-6-2 spec)
  // so per-trajectory FPR matches α under the runtime sliding-buffer
  // evaluation contract. Pre-Q2.B.6.2 configs lack the field; falls
  // through to the single-window Wilson-Hilferty χ²_p quantile (P3.7
  // backward-compat anchor).
  const threshold = params.hotelling_sliding_buffer_threshold
    ?? chiSquareQuantile(1 - alphaHotelling, signalsForChi2.length);

  const suppressed = familyCSuppressionGate(cfg, ctx, threshold);
  if (suppressed) return suppressed;

  // Addition #13 (per ARCHITECT-REPLY-31 correction): multivariate families
  // evaluate the full joint vector regardless of `ignore_thresholds` state.
  // An in-band signal contributes near-zero to the Mahalanobis quadratic
  // form naturally — (x − μ)ᵀ Σ⁻¹ (x − μ) with x ≈ μ for that component —
  // so explicit suppression would be redundant and would silence Family C
  // on other-signal drift the operator didn't intend to ignore.
  // ignore_thresholds are a per-signal suppression for single-signal
  // detectors (Family A) only; Family C is unaffected.

  // Gather the live vector, in the compiled joint-vector order.
  // REPLY-51b v2 R4-1 — project onto cfg.family_c_signals when
  // profile is active; fall back to hardcoded for legacy configs.
  // Missing signals kill the evaluation — the cov matrix dimensions
  // don't shrink.
  const cSignals = cfg.family_c_signals ?? FAMILY_C_SIGNALS;
  const x: number[] = new Array(cSignals.length);
  for (let i = 0; i < cSignals.length; i++) {
    const v = liveMetrics[cSignals[i]];
    if (v === undefined) return null;
    x[i] = v;
  }

  // Relative deviation vector r = (x − μ) ./ μ (element-wise), matching
  // the compiler's covariance standardization. Fallback to additive
  // (x − μ) when μ_i ≈ 0 — keeps the formula working on near-zero-mean
  // signals (no such signal in the current set, but defensive).
  const mu = params.mean_vector;
  const r: number[] = new Array(mu.length);
  for (let i = 0; i < mu.length; i++) {
    const m = mu[i];
    r[i] = Math.abs(m) > 1e-12 ? (x[i] - m) / m : (x[i] - m);
  }

  // D-54-2 dispatch — variant routing via HOTELLING_EVALUATORS map.
  // `chi_square` is the default when hotelling_variant is unset (pre-#20
  // configs). `safe_test` additionally requires compile-time params +
  // runtime state store; missing prereqs fall through to chi_square
  // (preserves pre-refactor semantics byte-for-byte). Unknown variant
  // strings throw — see dispatch-maps.ts.
  const variant = hotellingVariantForDispatch(
    params.hotelling_variant, !!params.safe_hotelling_params, !!states,
  );
  const evaluator = HOTELLING_EVALUATORS[variant];
  if (!evaluator) {
    throw new Error(
      `Unknown hotelling_variant: '${String(params.hotelling_variant)}'. `
      + `Known: ${Object.keys(HOTELLING_EVALUATORS).join(', ')}`,
    );
  }
  return evaluator({
    params, r, alphaHotelling, threshold, states, tier,
    hourOfDay: ctx.hourOfDay, dayOfWeek: ctx.dayOfWeek,
  });
}
