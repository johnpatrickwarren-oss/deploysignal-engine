// engine/types/_config-cells.ts — split from config.ts (god-file decomposition).
// Baseline-cell + detector per-cell shapes, bake profiles, cell-dimension /
// confidence vocabularies, and Tessera per-shard residual types.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.

import type { CellKey } from './primitives';
import type { FamilyAPerSignalParams } from './families/a';
import type { FamilyCPerCell } from './families/c';
import type { FamilyDPerSignal } from './families/d';
import type { ConformalParams } from './families/e';
import type { WelfordState } from '../per-shard/welford';

// ── Baseline cells + detector types ──────────────────────────────
// Week 2 scaffolded Family A on a flat `family_A.cells[hour]` map;
// Week 3 (ARCHITECT-REPLY-09.md Q1) migrates that into a unified
// `baseline_cells` matrix and adds Family C per-cell covariance.

/** One cell in the `baseline_cells.cells` array. */
export interface BaselineCellEntry {
  key: CellKey;
  n_samples: number;
  confidence: CellConfidence;  // ─── Tessera SLICE 2a Delta 7: extracted-typedef ref
  /** Populated iff `confidence === 'pooled'`; lists the adjacent cells
   *  whose samples were combined to hit `min_samples_pooled`. */
  pooled_from?: CellKey[];
  /** True when pooling inflated the effective variance; Reviewer X4
   *  signals this so L3 fusion can widen thresholds conservatively. */
  variance_inflated?: boolean;
  family_A?: { per_signal: Record<string, FamilyAPerSignalParams> };
  family_C?: FamilyCPerCell;
  /** Week 4: per-cell conformal calibration for Family E novelty detection. */
  family_E?: ConformalParams;
  /** Week 4: per-cell spectral null distribution for Family D ACF peaks.
   *  Keyed by signal because ACF is per-signal. */
  family_D?: Record<string, FamilyDPerSignal>;
}

export interface BaselineCellsConfig {
  dimensions: CellDimension[];  // ─── Tessera SLICE 2a Delta 7: extracted-typedef ref
  cells: BaselineCellEntry[];
  aggregate_fallback: {
    family_A?: { per_signal: Record<string, FamilyAPerSignalParams> };
    family_C?: FamilyCPerCell;
    family_E?: ConformalParams;
    family_D?: Record<string, FamilyDPerSignal>;
  };
}

/** Signal-level bake profile per Addition #4. Not cell-varying — all cells
 *  for a given signal share the same profile; diurnal time-to-stability
 *  variation is encoded in per-cell `baseline_sigma_squared` instead. */
export interface BakeProfile {
  min_ticks_before_eligible: number;
  min_observation_window: number;
  max_deploy_window_days: number;
}

// ─── TESSERA SLICE 1 + SLICE 2a ADDITIONS ──────────────────────────────────

/** Tessera SLICE 1 Delta 1 + 2 + SLICE 2a Delta 7 — canonical typedef extractions.
 *  Single source of truth for the cell-dimension and confidence-tier vocabularies.
 *  Referenced from BaselineCellEntry.confidence, BaselineCellsConfig.dimensions[],
 *  and PerShardResidual.confidence. */
export type CellDimension =
  | 'hour_of_day' | 'day_of_week' | 'workload_class'
  | 'tenant_slice' | 'tenant_tier' | 'region'
  | 'shard_id';  // ─── Tessera SLICE 1 Delta 1: 'shard_id' added

export type CellConfidence =
  | 'strict' | 'pooled' | 'aggregate' | 'none'
  | 'warm_start';  // ─── Tessera SLICE 1 Delta 2: 'warm_start' added

/** Tessera SLICE 1 Delta 3 + SLICE 2a Delta 5 — per-shard residual delta from fleet-aggregate.
 *  Sparse-encoded by confidence tier (OUTPUT fields only — see below):
 *    - 'strict':     mean_vector + covariance present; mean_delta absent.
 *    - 'warm_start': mean_delta present; mean_vector + covariance absent.
 *    - 'pooled' / 'aggregate' / 'none': all delta fields absent; n_samples only.
 *  R10 (SLICE 2b4) emission contract — enforced by engine/per-shard/runtime.ts
 *  projectTierGatedOutputs (called as the final step of updatePerShardResidual):
 *    - At strict tier with welford_state present AND welfordCovariance(state) non-null
 *      (state.n >= 2): mean_vector AND covariance populated atomically from welfordMean
 *      + welfordCovariance.
 *    - At all other tiers ('none' / 'warm_start' / 'pooled' / 'aggregate') AND at
 *      strict-with-insufficient-welford: mean_vector AND covariance explicitly omitted
 *      from the output (destructure-then-spread; keys absent, not present-with-undefined).
 *    - mean_delta emission + inverse-convention enforcement remain R11+ scope; R10's
 *      runtime carries mean_delta through unchanged.
 *
 *  R05 (SLICE 2b3) addition: welford_state is INTERNAL ACCUMULATOR STATE, NOT subject
 *  to the sparse-encoding convention above. It is present whenever n_samples >= 1
 *  regardless of confidence tier (the Welford recurrence accumulates across tier
 *  transitions to preserve PRD AC-P2's "single-instance behavior" invariant).
 *  R10 (above) consumes welford_state at the strict-tier emission boundary. */
export interface PerShardResidual {
  /** Mandatory — sample count for this (shard, cell). Load-bearing for SLICE 2b
   *  warm-start (n ≥ 20) and strict-upgrade (n ≥ 60) transitions. */
  n_samples: number;
  /** Mandatory — confidence tier; discriminates which optional fields are populated. */
  confidence: CellConfidence;
  /** Optional — present only at confidence === 'strict' (full residual). */
  mean_vector?: number[];
  /** Optional — present only at confidence === 'strict' (full residual). */
  covariance?: number[][];
  /** Optional — present only at confidence === 'warm_start' (delta from fleet-aggregate
   *  mean; length matches BaselineCellEntry's effective mean-vector length, semantic-not-typed). */
  mean_delta?: number[];
  /** Optional — opaque identifier for the fleet-aggregate baseline this residual was
   *  computed against. Enables SLICE 2b runtime to detect fleet-aggregate-refresh
   *  invalidation. Hash function choice is SLICE 2b scope. */
  residual_seed_hash?: string;
  /** Optional — Unix epoch milliseconds of the most recent sample observed at this
   *  (shard, cell). Enables SLICE 2b warm-start eligibility window logic. */
  last_observed_at?: number;
  /** R05 (SLICE 2b3) — internal Welford accumulator carrying running mean + M2 across
   *  samples for this (shard, cell). Present iff n_samples >= 1 under stable seed; reset
   *  on baseline-refresh (residual_seed_hash change). Source of truth for SLICE 2b3+
   *  derivation of mean_vector / covariance / mean_delta at the orchestration boundary
   *  (R06 scope). NOT subject to the R02 sparse-encoding convention. */
  welford_state?: WelfordState;
}

/** Tessera SLICE 1 Delta 3 + SLICE 2a Delta 6 — one (shard_id, cell_key) entry in
 *  CompiledConfig.per_shard_cells. Mirrors BaselineCellEntry's `key: CellKey` shape
 *  so per-(shard_id, cell_key) lookup is the natural array iteration pattern. */
export interface PerShardCell {
  shard_id: string;
  key: CellKey;  // ─── Tessera SLICE 2a Delta 6: cell-key field added (restructure from SLICE 1)
  residual: PerShardResidual;
}
