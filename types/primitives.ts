// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/primitives.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/types/primitives.ts — Atomic type unions + keys.
//
// Zero-dep leaf module. Every other submodule imports from here; this
// file imports nothing from the types surface.

// ── Verdicts ──────────────────────────────────────────────────────

/** Final orchestrator verdict. `'baking'` is internal — never surfaced. */
export type Verdict = 'rollback' | 'extend' | 'proceed' | 'baking';

/** Risk tier — drives policy thresholds and approval requirements. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Author class — agent changes get tighter approval/escalation rules. */
export type Author = 'human' | 'agent';

/** Change classification — drives warmup behavior and threshold profile. */
export type ChangeType =
  | 'model_weights'
  | 'serving_code'
  | 'config'
  | 'infrastructure'
  | 'documentation';

/** Time window classification. Windows in BLOCKED_WINDOWS bar deploy. */
export type TimeWindow = 'ok' | 'friday' | 'weekend' | 'evening';

/** Operational mode — currently only `shadow` is implemented. */
export type Mode = 'shadow' | 'advise' | 'act';

/** Family identifier used across v2 records and registries. */
export type FamilyId = 'A' | 'B' | 'C' | 'D' | 'E';

/** Cell-matrix segmentation key. Week 2 used a single dimension; Week 3
 *  extends to `hour_of_day × day_of_week`. Extensible `Record` shape so
 *  later weeks can add workload_class, tenant_slice, region without a
 *  type bump. */
export type CellKey = Record<string, string | number>;

/** Legacy name — a single-dimension key used by Week-2 callers that
 *  haven't migrated to `CellKey`. Still emitted by detector lookup
 *  helpers for backward compat. */
export interface BaselineCell {
  hour_of_day: number;
}

// ── Per-shard accumulator state (ADR 0033) ───────────────────────
//
// Declared here rather than in per-shard/welford.ts so that types/ never imports from an
// implementation module; per-shard/welford.ts re-exports the name.

export interface WelfordState {
  /** Number of samples observed so far (n ≥ 0). */
  n: number;
  /** Running mean vector; length d. */
  mean: number[];
  /** Running M2 matrix (sum of (x_i − mean)(x_i − mean)^T); shape d × d.
   *  Sample covariance is M2 / (n − 1) for n ≥ 2. */
  m2: number[][];
}
