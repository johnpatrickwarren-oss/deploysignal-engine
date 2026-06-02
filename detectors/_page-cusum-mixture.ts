// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// _page-cusum-mixture.ts — Howard-Ramdas-2021 mixture-supermartingale
// Page-CUSUM path (Ville-bounded; AR(1) pre-whitening). Canonical Family A
// dispatch post-Q68 close. Split out of page-cusum.ts (god-file refactor);
// behavior preserved verbatim.
//
// ── Q66 Phase-3.d.A close (item g) → Q68 Phase-3.d.C consolidation ─────
// Howard-Ramdas-2021 mixture-supermartingale Page-CUSUM is the canonical
// Family A Page-CUSUM path post-Q68 close. Classical reset-at-zero variant
// retired from production dispatch at Q68 Phase-3.d.C consolidation
// (page_cusum_variant flag retired; no opt-in). evaluateFamilyAShadow
// (classical implementation) retained as exported helper for tools/run-nab-
// validation.ts consumption per Q64 anti-scope (full retirement at Q69 .D
// when NAB tooling re-derives for Ville-bounded variants).

import type {
  CompiledConfig, DetectorVerdict, BaselineCell,
  FamilyAPerSignalParams, TenantTier,
} from '../types';
import { resolveTenantTier } from '../types';
import { shouldSuppress } from '../l0/schema-continuity';
import {
  evaluatePageCusumMixtureSupermartingale,
  freshMixtureSupermartingaleState,
  deriveMixtureSupermartingaleParams,
  type MixtureSupermartingaleState,
} from './family-a-mixture-supermartingale';
import {
  matchCellByHour,
  trafficGateMin,
  FAMILY_A_PRIMARY_SIGNALS,
  type CUSUMStates,
} from './_page-cusum-core';
import type { FamilyAShadowCtx } from './_page-cusum-classical';

export type MixtureSupermartingaleStates = { [signal: string]: MixtureSupermartingaleState };

/** Resolve `FamilyAPerSignalParams` for the mixture-supermartingale path.
 *  Mirrors `lookupCellParams` cell-matching but returns the raw per-signal
 *  shape (mixture_supermartingale_params + ar1_phi + baseline_*_raw) rather
 *  than the classical-CUSUM `MSPRTParams` view-model. */
function lookupFamilyAPerSignal(
  cfg: CompiledConfig,
  cell: BaselineCell & { day_of_week?: number; tenant_tier?: TenantTier },
  signal: string,
): FamilyAPerSignalParams | null {
  const bc = cfg.baseline_cells;
  if (!bc) return null;
  const match = matchCellByHour(bc.cells, cell);
  if (!match) return null;
  let perSig: FamilyAPerSignalParams | undefined = match.family_A?.per_signal[signal];
  const aggregateFallback = match.confidence === 'aggregate' || match.confidence === 'none';
  if (!perSig && aggregateFallback) {
    perSig = bc.aggregate_fallback.family_A?.per_signal[signal];
  }
  return perSig ?? null;
}

/** Schema-continuity suppression mirrors classical path for symmetry. */
function mixtureSchemaContinuitySuppression(
  cfg: CompiledConfig,
  states: MixtureSupermartingaleStates,
  schemaContinuityClass: NonNullable<FamilyAShadowCtx['schemaContinuityClass']>,
): DetectorVerdict[] {
  const reason = schemaContinuityClass === 'observability_stack'
    ? 'observability_stack_deploy' : 'schema_continuity_breaking';
  const out: DetectorVerdict[] = [];
  for (const signal of (cfg.family_a_signals ?? FAMILY_A_PRIMARY_SIGNALS)) {
    const state = states[signal] ?? freshMixtureSupermartingaleState();
    states[signal] = state;
    out.push({
      verdict: 'suppressed',
      statistic: state.M_t,
      threshold: null,
      alpha_consumed: 0,
      alpha_spent: 0,
      reason_code: reason,
      family: 'A',
      signal,
    });
  }
  return out;
}

/** Evaluate one primary SLI for the mixture shadow path. Returns the
 *  verdict to push, or null when the signal should be skipped silently. */
function evaluateMixtureSignal(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  states: MixtureSupermartingaleStates,
  ctx: FamilyAShadowCtx,
  cell: BaselineCell & { day_of_week?: number; tenant_tier?: TenantTier },
  alphaFamilyA: number,
  bonf: number,
  signal: string,
): DetectorVerdict | null {
  if (ctx.ignoredSignals?.has(signal)) {
    const state = states[signal] ?? freshMixtureSupermartingaleState();
    states[signal] = state;
    return {
      verdict: 'suppressed',
      statistic: state.M_t,
      threshold: null,
      alpha_consumed: 0,
      alpha_spent: 0,
      reason_code: 'ignore_threshold',
      family: 'A',
      signal,
      ignore_threshold_trigger_signal: signal,
    };
  }
  const perSig = lookupFamilyAPerSignal(cfg, cell, signal);
  if (!perSig) return null;
  const live = liveMetrics[signal];
  if (live === undefined) return null;

  // Mixture-supermartingale operates on RAW observation space (Q2.B.5):
  // x_centered = live − baseline_mean_raw. Falls through to baseline_mean
  // (transformed) on pre-Q2.A configs.
  const baselineMeanRaw = perSig.baseline_mean_raw ?? perSig.baseline_mean;
  if (baselineMeanRaw === undefined) return null;
  const sigmaSquared = perSig.baseline_sigma_squared_raw
    ?? perSig.baseline_sigma_squared;
  if (sigmaSquared === undefined) return null;

  // Resolve mixture params: prefer compile-time stamp; derive on-the-fly
  // for pre-Phase-3.d.A-close configs lacking the field.
  const mixtureParams = perSig.mixture_supermartingale_params
    ?? deriveMixtureSupermartingaleParams(perSig);
  if (!mixtureParams) return null;

  // Per-signal alpha — same allocation as classical (split with betting
  // co-ship when present so the two Family A detectors share budget).
  const perSigBudget = alphaFamilyA / bonf;
  const alpha = perSig.betting_e_process_alpha !== undefined
    ? Math.max(perSigBudget - perSig.betting_e_process_alpha, perSigBudget * 0.5)
    : perSigBudget;

  let state = states[signal];
  if (!state) {
    state = freshMixtureSupermartingaleState();
    states[signal] = state;
  }

  const x_centered = live - baselineMeanRaw;
  const result = evaluatePageCusumMixtureSupermartingale({
    signal,
    x_centered,
    live_value: live,
    baseline_mean: baselineMeanRaw,
    sigma_squared: sigmaSquared,
    params: mixtureParams,
    ar1_phi: perSig.ar1_phi,
    state,
    alpha,
  });

  return {
    verdict: result.fire ? 'fire' : (state.S_t !== 0 ? 'indeterminate' : 'clean'),
    statistic: result.M_t,
    threshold: result.threshold,
    alpha_consumed: result.fire ? alpha : 0,
    alpha_spent: result.fire ? alpha : 0,
    reason_code: result.fire ? 'cusum_exceeded_threshold' : 'accumulating',
    family: 'A',
    signal,
  };
}

/** Per-tick mixture-supermartingale Page-CUSUM evaluator. Parallel to
 *  `evaluateFamilyAShadow` (classical) but consumes the Howard-Ramdas-2021
 *  Ville-bounded variant + AR(1) pre-whitening (Q66.A.b H1'). */
export function evaluateFamilyAShadowMixture(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  states: MixtureSupermartingaleStates,
  ctx: FamilyAShadowCtx,
): DetectorVerdict[] {
  if (!cfg.baseline_cells) return [];
  if (ctx.schemaContinuityClass && shouldSuppress(ctx.schemaContinuityClass, 'A')) {
    return mixtureSchemaContinuitySuppression(cfg, states, ctx.schemaContinuityClass);
  }
  const trafficGate = trafficGateMin(cfg);
  void trafficGate;
  const cell: BaselineCell & { day_of_week?: number; tenant_tier?: TenantTier } = { hour_of_day: ctx.hourOfDay };
  if (ctx.dayOfWeek !== undefined) cell.day_of_week = ctx.dayOfWeek;
  cell.tenant_tier = resolveTenantTier(cfg, ctx.tenantId);
  const out: DetectorVerdict[] = [];

  const alphaFamilyA = cfg.alpha_budget.per_family.A ?? 4e-4;
  const bonf = cfg.bonferroni_factor ?? 6;

  for (const signal of FAMILY_A_PRIMARY_SIGNALS) {
    const v = evaluateMixtureSignal(cfg, liveMetrics, states, ctx, cell, alphaFamilyA, bonf, signal);
    if (v !== null) out.push(v);
  }

  return out;
}

/** Q68 Phase-3.d.C consolidation — top-level Family A Page-CUSUM dispatch
 *  wrapper. Always delegates to Howard-Ramdas-2021 mixture-supermartingale
 *  variant (Ville-bounded; methodology-resampler-mode invariant by
 *  construction). Classical variant retired at Q68 close; the
 *  `cusumStates` parameter is preserved in the signature for caller
 *  backward-compat (TrendBuffer.cusumStates allocation pattern) but is
 *  unused in the runtime path. */
export function evaluateFamilyA(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  _cusumStates: CUSUMStates,
  mixtureStates: MixtureSupermartingaleStates,
  ctx: FamilyAShadowCtx,
): DetectorVerdict[] {
  return evaluateFamilyAShadowMixture(cfg, liveMetrics, mixtureStates, ctx);
}
