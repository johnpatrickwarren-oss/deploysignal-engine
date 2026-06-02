// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// _page-cusum-core.ts — shared substrate for the Page-CUSUM detector
// modules: per-signal CUSUM state, the classical update step, cell
// matching, and the shared traffic-gate / primary-signal-set helpers.
// Split out of page-cusum.ts (god-file refactor); behavior preserved
// verbatim. The classical-path and mixture-path evaluators each import
// from here rather than from the page-cusum.ts facade to keep the
// import-graph acyclic.

import type {
  MSPRTParams, CompiledConfig, DetectorVerdict, BaselineCell,
  BaselineCellEntry, TenantTier,
} from '../types';

// Family A default bake profile (Addition #4 table). Used when the
// compiled config doesn't carry a profile for a signal — guards against
// partially-populated configs and legacy (W2) configs without the
// `bake_profiles` block.
import type { BakeProfile } from '../types';
export const DEFAULT_BAKE: BakeProfile = {
  min_ticks_before_eligible: 3,
  min_observation_window: 3,
  max_deploy_window_days: 1,
};

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

export function freshCUSUM(): CUSUMState {
  return { S: 0, n: 0, alphaConsumed: 0 };
}

/** Per-deploy per-signal state store. Health gate reads/mutates through
 *  this map; caller (orchestrator / test harness) owns the lifetime. */
export type CUSUMStates = Record<string, CUSUMState>;

export function getOrCreateCUSUM(states: CUSUMStates, signal: string): CUSUMState {
  const s = states[signal];
  if (s) return s;
  const fresh = freshCUSUM();
  states[signal] = fresh;
  return fresh;
}

/** Page-CUSUM update. Mutates `state` in place and returns the new S_n. */
export function updateCUSUM(
  state: CUSUMState,
  x: number,
  sigmaSquared: number,
  tauSquared: number,
  perTickAlpha: number,
): number {
  // Guard against a degenerate cell (σ² = 0). If the cell has no
  // variance, any non-zero x_n is infinitely surprising under H₀ — the
  // correct behavior is immediate fire. The compiler applies a τ²
  // derivation that cannot be exactly zero (τ² = δ_min² / 4 and δ_min has
  // a 5% × mean floor), but σ² can be 0 if the generator clamps. Treat
  // σ² = 0 as "use τ² alone" — the mixture degenerates to a flat prior on
  // the shifted mean and z_n collapses to x²/(2τ²).
  let z: number;
  if (sigmaSquared <= 0) {
    if (tauSquared <= 0) z = 0;
    else z = (x * x) / (2 * tauSquared);
  } else {
    const denom = sigmaSquared + tauSquared;
    const logShrink = 0.5 * Math.log(sigmaSquared / denom);
    const quad = (x * x * tauSquared) / (2 * sigmaSquared * denom);
    z = logShrink + quad;
  }
  state.S = Math.max(0, state.S + z);
  state.n += 1;
  state.alphaConsumed += perTickAlpha;
  return state.S;
}

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
export function matchCellByHour(
  cells: BaselineCellEntry[],
  query: BaselineCell & { day_of_week?: number; tenant_tier?: TenantTier },
): BaselineCellEntry | undefined {
  const matchOne = (tier: TenantTier | undefined): BaselineCellEntry | undefined =>
    cells.find((c) => {
      if (c.key.hour_of_day !== query.hour_of_day) return false;
      if (query.day_of_week !== undefined && c.key.day_of_week !== undefined) {
        if (c.key.day_of_week !== query.day_of_week) return false;
      }
      if (tier !== undefined && c.key.tenant_tier !== undefined) {
        if (c.key.tenant_tier !== tier) return false;
      }
      return true;
    });
  const direct = matchOne(query.tenant_tier);
  if (direct) return direct;
  if (query.tenant_tier !== undefined && query.tenant_tier !== 'aggregate') {
    return matchOne('aggregate');
  }
  return undefined;
}

/** `traffic_pct_gate.min_traffic_pct_for_fire` or 0 if gate not compiled. */
export function trafficGateMin(cfg: CompiledConfig): number {
  return cfg.traffic_pct_gate?.min_traffic_pct_for_fire ?? 0;
}

/** Primary SLIs covered by Week-2 Family A. Kept in one place so health.ts,
 *  the compiler, and the parity test agree on the set. */
export const FAMILY_A_PRIMARY_SIGNALS = [
  'p99_latency', 'ttft', 'eval_score', 'tool_success_rate',
  'downstream_err', 'cost_req',
] as const;

export function suppressed(
  signal: string,
  reason: string,
  state: CUSUMState,
  threshold: number,
): DetectorVerdict {
  // Suppressed verdicts expose the current S_n so the shadow-compare
  // audit output can trace pre-eligibility accumulation. Not a fire, not
  // a clean — the caller treats this as "do not action".
  return {
    verdict: 'suppressed',
    statistic: state.S,
    threshold,
    alpha_consumed: state.alphaConsumed,
    alpha_spent: 0,
    reason_code: reason,
    family: 'A',
    signal,
  };
}
