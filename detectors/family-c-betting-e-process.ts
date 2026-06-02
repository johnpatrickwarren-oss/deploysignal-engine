// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/family-c-betting-e-process.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/detectors/family-c-betting-e-process.ts — Family C canonical
// Shekhar-Ramdas-2023 betting-e-process variant (Q67 SPEC Phase-3.d.B).
//
// Per Q67-PHASE-3-D-B-MMD-BETTING-E-PROCESS-SPEC.md § Q67.2 v2 (architect-
// drafted; canonical-aligned via library cross-check at
// `github.com/sshekhar17/nonparametric-testing-by-betting`):
//
//   `kernelMMD.py kernelMMDprediction` lines 57-92 — predictable witness
//      F[i] with running-max normalization at i > 10.
//   `SeqTestsUtils.py:11-38 ONSstrategy(F, lambda_max=0.5)` — ONS update
//      with c = 2/(2−log(3)) ≈ 1.6336, A_0 = 1, two-sided clamp.
//   `kernelMMD.py computeMMD` lines 14-54 — biased V-statistic MMD
//      estimator (denominators include diagonal).
//
// Wealth recursion (Shekhar-Ramdas 2023):
//
//   F_t = W_{t−1}(x_t)                        (kernel-MMD witness payoff)
//   S_t = S_{t−1} · (1 + λ_{t−1} · F_t)       (multiplicative wealth)
//   Fire when S_t ≥ 1/α                       (Ville bound; anytime-valid)
//
// ONS update (predictable; A_t F_{t-1}-measurable):
//
//   z_t = −F_t / (1 + λ_{t−1}·F_t)             (gradient; canonical sign)
//   A_t = A_{t−1} + z_t²                       (accumulated Hessian)
//   λ_t = clamp(λ_{t−1} − c·z_t/A_t, ±λ_max)   (Cutkosky-Orabona 2018 step)
//
// Distinct from existing #20 evaluateEMmd in sequential-mmd.ts —
// evaluateEMmd implements the Option-B simplification (kernel-distance
// scalar fed through GRAPA/ONS-fallback `pickBet`); this file implements
// the canonical Shekhar-Ramdas-2023 ONS variant with split-sample witness
// + running-max normalization + canonical hyperparameters. Both coexist
// at SLICE 1 — runtime dispatcher (sequential-mmd.ts; Step 3) picks per
// `mmd_variant` flag on the per-cell calibration.
//
// State management mirrors Q66 Phase-3.d.A SLICE 1 pattern: per-(tier,
// hour, day) cell-keyed state on the caller's state bag; persists across
// ticks within a deploy; orchestrator caller owns lifetime (not re-keyed
// across deploys — same convention as evaluateEMmd).
//
// Streaming-adapted predictable witness — DeploySignal use case has P
// fixed (per-cell baseline) + Q streaming (1 obs/tick). Q-side empirical
// distribution stored as running-sum / running-count (O(d) state); Q-side
// kernel evaluated at the empirical mean per coordinate. Predictability
// preserved because state.q_running_sum / state.q_count reflect ONLY past
// observations (mutated AFTER witness computation; mirrors architect-
// drafted pseudo-code line ordering).
//
// ── Module layout (god-file split; behavior unchanged) ──────────────────
//   _family-c-betting-witness.ts  — witness payoffs (RFF / kernel-MMD) +
//                                    ONS bet update + canonical constants.
//   _family-c-betting-state.ts    — fresh-state factory + projection /
//                                    bake-profile / suppressed-verdict.
// This facade keeps the public export surface identical (re-export pattern)
// and hosts the per-tick evaluator decomposed into <100-line helpers.

import type {
  CompiledConfig, DetectorVerdict, FamilyCPerCell,
  SchemaContinuityRecord, FamilyCBettingEProcessState,
} from '../types';
import { resolveTenantTier } from '../types';
import { shouldSuppress } from '../l0/schema-continuity';
import { FAMILY_C_SIGNALS, lookupFamilyCParams } from './hotelling';
import { trafficGateMin } from './page-cusum';
import {
  generateBaselinePool, baselinePoolSeed, BASELINE_POOL_SIZE,
} from './sequential-mmd';
import {
  q72TraceEnabled, q72EmitProcessHeader, q72EmitCellHeader, q72EmitTick,
} from './_q72-trace';
import {
  computeRffFeatureMap, RFF_DEFAULT_DIM, type RffFeatureMap,
} from './family-c-rff';
import {
  computeRffWitness, computeKernelMMDWitness, onsUpdate,
} from './_family-c-betting-witness';
import {
  LOG_FACTOR_FLOOR, DEFAULT_LAMBDA_MAX,
  freshFamilyCBettingEProcessState, liveVectorFamilyC,
  familyCBakeProfile, suppressedVerdict,
} from './_family-c-betting-state';

// ── Public export surface (re-export facade; paths unchanged) ───────────
export {
  computeRffWitness, computeKernelMMDWitness, onsUpdate,
} from './_family-c-betting-witness';
export { freshFamilyCBettingEProcessState } from './_family-c-betting-state';

/** Resolved per-tick context once gating succeeds. */
interface BettingEvalSetup {
  params: FamilyCPerCell;
  bp: NonNullable<FamilyCPerCell['betting_e_process_params']>;
  tier: ReturnType<typeof resolveTenantTier>;
  lambdaMax: number;
  threshold: number;
  log_threshold: number;
  v: number[];
  rffActive: boolean;
  D: number;
}

type SetupResult =
  | { kind: 'eval'; setup: BettingEvalSetup }
  | { kind: 'verdict'; verdict: DetectorVerdict }
  | { kind: 'skip' };

interface EvalCtx {
  hourOfDay: number;
  dayOfWeek?: number;
  ticksSinceDeploy: number;
  deployAgeDays: number;
  trafficPct: number;
  schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
  tenantId?: string;
}

/** Cell lookup + schema-continuity / bake / traffic gating + live-vector
 *  projection. Returns a discriminated result: continue to evaluation,
 *  return a short-circuit verdict, or skip (null) this tick. Mirrors the
 *  original early-return ladder verbatim. */
function setupBettingEval(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  ctx: EvalCtx,
): SetupResult {
  if (!cfg.baseline_cells) return { kind: 'skip' };
  const tier = resolveTenantTier(cfg, ctx.tenantId);
  const lookup = lookupFamilyCParams(cfg, {
    hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek, tenant_tier: tier,
  });
  if (!lookup) return { kind: 'skip' };
  const params: FamilyCPerCell = lookup.params;

  // Q68 Phase-3.d.C consolidation — `mmd_variant` flag retired; Family C
  // MMD dispatch is unconditional Ville-bounded variant. Detector self-
  // gates on `betting_e_process_params` presence (Q67 v2 compile output).
  const bp = params.betting_e_process_params;
  if (!bp) return { kind: 'skip' };  // cell not compiled with Q67 params (pre-Phase-3.d.B)

  const lambdaMax = bp.lambda_max ?? DEFAULT_LAMBDA_MAX;
  const log_threshold = -Math.log(bp.alpha);  // log(1/α); compare in log-space

  // Schema continuity suppression — same rule as sibling Family C
  // detectors (Family C as a whole suppresses on breaking schema; #8).
  if (ctx.schemaContinuityClass && shouldSuppress(ctx.schemaContinuityClass, 'C')) {
    return { kind: 'verdict', verdict: suppressedVerdict(
      ctx.schemaContinuityClass === 'observability_stack'
        ? 'observability_stack_deploy' : 'schema_continuity_breaking',
      Math.exp(log_threshold), null,
    ) };
  }

  // Bake-profile + age gate — same most-constrained profile as Hotelling.
  const bake = familyCBakeProfile(cfg);
  const threshold = Math.exp(log_threshold);
  if (ctx.ticksSinceDeploy < bake.min_ticks) return { kind: 'verdict', verdict: suppressedVerdict('bake_profile_not_met', threshold, null) };
  if (ctx.deployAgeDays > bake.max_days) return { kind: 'verdict', verdict: suppressedVerdict('bake_profile_not_met', threshold, null) };
  if (ctx.trafficPct < trafficGateMin(cfg)) return { kind: 'verdict', verdict: suppressedVerdict('traffic_pct_below_gate', threshold, null) };

  // Project live metrics into the Family C relative-deviation vector.
  const v = liveVectorFamilyC(liveMetrics, params.mean_vector, cfg.family_c_signals ?? FAMILY_C_SIGNALS);
  if (v === null) return { kind: 'skip' };

  // Q72 SLICE 2 — RFF mode active when calibrator stamped baseline_rff_mean.
  // Falls through to legacy biased streaming witness when absent (preserves
  // replay of pre-Q72-SLICE-2 audit logs).
  const rffActive = bp.baseline_rff_mean !== undefined && bp.baseline_rff_mean.length > 0;
  const D = rffActive ? (bp.rff_dim ?? RFF_DEFAULT_DIM) : 0;

  return { kind: 'eval', setup: { params, bp, tier, lambdaMax, threshold, log_threshold, v, rffActive, D } };
}

/** Resolve (creating + caching as needed) the per-cell state, RFF feature
 *  map, and baseline pool from the caller's state bag. Mirrors evaluateEMmd's
 *  stateKey / poolKey caching verbatim. */
function resolveBettingResources(
  states: Record<string, FamilyCBettingEProcessState | number[][] | unknown>,
  setup: BettingEvalSetup,
  ctx: EvalCtx,
): { state: FamilyCBettingEProcessState; fm: RffFeatureMap | undefined; pool: number[][] | undefined; stateKey: string } {
  const { bp, tier, v, rffActive, D } = setup;

  // Per-(tier, hour, day) state. Mirrors evaluateEMmd's stateKey pattern.
  const stateKey = `__fc_betting_${tier ?? 'none'}_${ctx.hourOfDay}_${ctx.dayOfWeek ?? -1}`;
  let state = states[stateKey] as FamilyCBettingEProcessState | undefined;
  if (!state || typeof state.log_S_t !== 'number') {
    state = freshFamilyCBettingEProcessState(v.length, rffActive ? D : undefined);
    states[stateKey] = state;
  }
  // Lazy init for Q72 SLICE 2 RFF state when state was created pre-RFF
  // but cell config now carries RFF params (e.g., calibrator recompiled).
  if (rffActive && state.q_running_phi_sum === undefined) {
    state.q_running_phi_sum = new Array<number>(D).fill(0);
  }

  // Q72 SLICE 2 — RFF feature map cached per cell by stateKey + rff_seed.
  // Recomputed deterministically from seed if cache absent (e.g., first
  // dispatch after process boot). Same seed produces byte-identical
  // ω + b across Darwin/Linux per cross-platform-determinism gate.
  const fmKey = `__rff_fm_${stateKey}`;
  let fm: RffFeatureMap | undefined;
  if (rffActive) {
    fm = states[fmKey] as RffFeatureMap | undefined;
    if (!fm) {
      fm = computeRffFeatureMap(
        bp.rff_seed ?? 0, D, v.length, bp.kernel_bandwidth_sigma,
      );
      states[fmKey] = fm;
    }
  }

  // Baseline pool — reuse Sequential MMD's pseudo-sampling (Cholesky·w).
  // Cache by cell key; same seed function as evaluateEMmd / evaluateSequentialMMD
  // so all three variants agree on the P-side reference set under shadow-compare.
  // RFF mode skips building the pool at runtime (μ_P^φ is precomputed at
  // calibration time and stored in bp.baseline_rff_mean) — pool is only
  // needed for the legacy streaming-witness path.
  const poolKey = `__mmd_pool_${ctx.hourOfDay}_${ctx.dayOfWeek ?? -1}`;
  let pool = states[poolKey] as number[][] | undefined;
  if (!rffActive && (!pool || pool.length === 0)) {
    const poolSize = bp.baseline_sample_size && bp.baseline_sample_size > 0
      ? bp.baseline_sample_size : BASELINE_POOL_SIZE;
    pool = generateBaselinePool(
      setup.params, poolSize,
      baselinePoolSeed({ hour_of_day: ctx.hourOfDay, day_of_week: ctx.dayOfWeek }),
    );
    states[poolKey] = pool;
  }

  return { state, fm, pool, stateKey };
}

/** Q72 Phase 1 pre-state capture (BEFORE any mutation) + header emission.
 *  No-op fast path when Q72_TRACE unset (caller still constructs the snapshot
 *  fields cheaply; the loops run only under q72TraceEnabled()). */
interface Q72PreState {
  log_S_t_pre: number;
  lambda_pre: number;
  hessian_pre: number;
  witness_max_pre: number;
  q_count_pre: number;
  q_sum_hash: number;
  v_sum: number;
  tick_id: number;
}

function q72CapturePre(
  state: FamilyCBettingEProcessState,
  setup: BettingEvalSetup,
  pool: number[][] | undefined,
  stateKey: string,
): Q72PreState {
  const { bp, v, rffActive } = setup;
  if (q72TraceEnabled()) {
    q72EmitProcessHeader();
    q72EmitCellHeader(stateKey, {
      kernel_bandwidth_sigma: bp.kernel_bandwidth_sigma,
      lambda_max: bp.lambda_max,
      betting_strategy: bp.betting_strategy,
      ons_initial_lambda: bp.ons_initial_lambda,
      alpha: bp.alpha,
      baseline_sample_size: bp.baseline_sample_size,
      rff_active: rffActive,
      rff_seed: bp.rff_seed,
      rff_dim: bp.rff_dim,
    }, rffActive ? [] : (pool ?? []).slice(0, 5), rffActive ? 0 : (pool?.length ?? 0));
  }

  const pre: Q72PreState = {
    log_S_t_pre: state.log_S_t,
    lambda_pre: state.ons_lambda,
    hessian_pre: state.ons_inverse_hessian,
    witness_max_pre: state.witness_running_max,
    q_count_pre: state.q_count,
    q_sum_hash: 0,
    v_sum: 0,
    tick_id: state.n,  // pre-increment value
  };
  if (q72TraceEnabled()) {
    if (rffActive && state.q_running_phi_sum) {
      for (const x of state.q_running_phi_sum) pre.q_sum_hash += x;
    } else {
      for (const x of state.q_running_sum) pre.q_sum_hash += x;
    }
    for (const x of v) pre.v_sum += x;
  }
  return pre;
}

/** Per-tick core: predictable witness F_t, log-space wealth update, ONS bet
 *  update, then streaming Q-side bookkeeping + witness running-max. Mutates
 *  `state` exactly as the original inline block. Returns the values the fire
 *  check + trace emission need. */
function stepBettingTick(
  state: FamilyCBettingEProcessState,
  setup: BettingEvalSetup,
  fm: RffFeatureMap | undefined,
  pool: number[][] | undefined,
): { F_t: number; wealth_factor: number; log_factor: number } {
  const { bp, v, lambdaMax, rffActive } = setup;

  // ── Predictable witness F_t ────────────────────────────────────────
  // Computed BEFORE q_running_sum / q_running_phi_sum mutation — F_t is
  // F_{t-1}-measurable.
  let F_t: number;
  let phi_x: Float64Array | null = null;
  if (rffActive && fm && bp.baseline_rff_mean && state.q_running_phi_sum) {
    // Q72 SLICE 2 unbiased RFF witness: F_t = φ(x_t) · (μ_P^φ - μ_Q^φ).
    const w = computeRffWitness(
      v, bp.baseline_rff_mean, state.q_running_phi_sum,
      state.q_count, fm,
    );
    F_t = w.F_t;
    phi_x = w.phi_x;
  } else {
    // Legacy biased streaming witness (Q67 §Q67.4-ter; pre-Q72-SLICE-2
    // configs only — backward-compat for replay of pre-fix audit logs).
    F_t = computeKernelMMDWitness(
      v, pool ?? [], state.q_running_sum, state.q_count,
      bp.kernel_bandwidth_sigma, state.witness_running_max, state.n,
    );
  }

  // ── Wealth update: log_S_t += log(1 + λ_{t−1}·F_t) ──────────────────
  // Log-space comparison avoids exp(log_S_t) overflow at large wealth.
  const wealth_factor = 1 + state.ons_lambda * F_t;
  const log_factor = Math.log(Math.max(wealth_factor, LOG_FACTOR_FLOOR));
  state.log_S_t += log_factor;

  // ── ONS bet update for next tick (predictable; uses current F_t) ────
  onsUpdate(state, F_t, lambdaMax);

  // ── Streaming Q-side bookkeeping (mutate AFTER witness computation) ──
  if (rffActive && phi_x && state.q_running_phi_sum) {
    // Q72 SLICE 2: update RFF Q-side empirical-mean numerator with this
    // tick's φ(x_t). The legacy q_running_sum is also updated to keep
    // pre-Q72-SLICE-2 audit-replay state coherent (ignored by the RFF
    // witness path).
    const phiSum = state.q_running_phi_sum;
    for (let i = 0; i < phi_x.length; i++) phiSum[i] += phi_x[i];
  }
  for (let i = 0; i < v.length; i++) state.q_running_sum[i] += v[i];
  state.q_count += 1;
  state.n += 1;

  // Update witness running-max (used by next tick's normalization at n>10).
  const absF = Math.abs(F_t);
  if (absF > state.witness_running_max) state.witness_running_max = absF;

  return { F_t, wealth_factor, log_factor };
}

/** Ville-bound fire check (log-space) → DetectorVerdict, plus the trace
 *  bookkeeping fields. Mutates fire/alpha state exactly as original. */
function bettingFireCheck(
  state: FamilyCBettingEProcessState,
  setup: BettingEvalSetup,
): { result: DetectorVerdict; verdictLabel: string; firedThisTick: boolean; S_t_audit: number } {
  const { bp, log_threshold, threshold } = setup;

  // Materialize S_t for audit visibility; use Math.exp guarded against
  // inf overflow at extreme wealth (rare but real on prolonged H₁ runs).
  const S_t_audit = state.log_S_t > 700 ? Number.MAX_VALUE : Math.exp(state.log_S_t);
  if (state.log_S_t >= log_threshold) {
    const alphaSpent = Math.max(0, bp.alpha - state.alphaConsumed);
    state.alphaConsumed = bp.alpha;
    let firedThisTick = false;
    if (!state.fired) {
      state.fired = true;
      state.tick_at_first_fire = state.n;
      firedThisTick = true;
    }
    return {
      result: {
        verdict: 'fire', statistic: S_t_audit, threshold,
        alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
        reason_code: 'family_c_betting_wealth_exceeded',
        family: 'C',
        signal: 'sequential_mmd_betting_e_process',
      },
      verdictLabel: 'fire', firedThisTick, S_t_audit,
    };
  }
  return {
    result: {
      verdict: 'clean', statistic: S_t_audit, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'below_threshold', family: 'C',
      signal: 'sequential_mmd_betting_e_process',
    },
    verdictLabel: 'clean', firedThisTick: false, S_t_audit,
  };
}

/** Evaluate the canonical Shekhar-Ramdas-2023 betting-e-process variant
 *  at one tick. Pattern mirrors `evaluateEMmd`: shared cell lookup +
 *  bake-profile guard + traffic gate + schema-continuity suppression.
 *  Returns null when:
 *    - cfg.baseline_cells absent (pre-#18 config)
 *    - cell lookup fails
 *    - cell tagged with mmd_variant !== 'betting_e_process' (dispatcher route)
 *    - cell missing betting_e_process_params (pre-Q67 config or non-applicable cell)
 *    - liveMetrics missing any Family C signal */
export function evaluateFamilyCBettingEProcess(
  cfg: CompiledConfig,
  liveMetrics: Record<string, number | undefined>,
  states: Record<string, FamilyCBettingEProcessState | number[][] | unknown>,
  ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    tenantId?: string;
  },
): DetectorVerdict | null {
  const setupResult = setupBettingEval(cfg, liveMetrics, ctx);
  if (setupResult.kind === 'skip') return null;
  if (setupResult.kind === 'verdict') return setupResult.verdict;
  const setup = setupResult.setup;
  const { v } = setup;

  const { state, fm, pool, stateKey } = resolveBettingResources(states, setup, ctx);

  // Q72 trace — capture pre-state BEFORE any mutation + emit headers.
  const pre = q72CapturePre(state, setup, pool, stateKey);

  // Per-tick core: witness → wealth → ONS → bookkeeping.
  const { F_t, wealth_factor, log_factor } = stepBettingTick(state, setup, fm, pool);

  // Ville-bound fire check.
  const { result, verdictLabel, firedThisTick } = bettingFireCheck(state, setup);

  // Q72 Phase 1 instrumentation — emit per-tick record AFTER all
  // mutations. Captures pre + post state + computed-this-tick deltas.
  if (q72TraceEnabled()) {
    q72EmitTick({
      cell_key: stateKey,
      tick_id: pre.tick_id,
      log_S_t_pre: pre.log_S_t_pre,
      ons_lambda_pre: pre.lambda_pre,
      ons_inverse_hessian_pre: pre.hessian_pre,
      witness_running_max: pre.witness_max_pre,
      q_count: pre.q_count_pre,
      q_running_sum_hash: pre.q_sum_hash,
      v_first_3: v.slice(0, 3),
      v_sum: pre.v_sum,
      F_t,
      wealth_factor,
      log_factor,
      log_S_t_post: state.log_S_t,
      ons_lambda_post: state.ons_lambda,
      ons_inverse_hessian_post: state.ons_inverse_hessian,
      verdict: verdictLabel,
      fired_this_tick: firedThisTick,
    });
  }
  return result;
}
