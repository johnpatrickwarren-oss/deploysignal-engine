// engine/types/_config-compiled.ts — split from config.ts (god-file decomposition).
// The central versioned CompiledConfig shape emitted by tools/calibrate.ts.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.

import type { ConfiguredAgent } from './agent';
import type { TenantTier, TenantTierConfig } from './_config-tenant';
import type {
  BaselineCellsConfig,
  BakeProfile,
  PerShardCell,
} from './_config-cells';
import type {
  CompilePhases,
  Warning,
  BaselineProvenance,
} from './_config-regression';
import type {
  BaselineCurationDecisionId,
  BaselineCurationDecision,
} from './_config-curation';

/** Versioned detector configuration emitted by tools/calibrate.ts.
 *
 * Week 3 schema refactor (ARCHITECT-REPLY-09.md Q1): cell-segmented
 * baselines live under `baseline_cells`; Family B stays flat; Family C
 * scaffolds into the same cell blocks. The Week-2 `family_A` top-level
 * block is retired — its data moved under `baseline_cells.cells[key].family_A`. */
export interface CompiledConfig {
  version: string;
  compiler_version: string;
  compiled_at: string;
  baseline_ref: string;
  alpha_budget: {
    total: number;
    per_family: Record<string, number>;
  };
  /** Family-A-specific; preserved from W2 for audit provenance. */
  bonferroni_factor?: number;
  /** Family B structural-signatures config. REPLY-51b R4-4 relaxed
   *  this from required → optional per strict-additive schema change
   *  (matches REPLY-43 D5 family_C precedent; no COMPILER_VERSION
   *  bump). Absent when profile's `structural_detectors.enabled` is
   *  false (generic-microservice@1.0.0 pattern); legacy + streaming
   *  compiles continue to emit it. Runtime consumers MUST null-check
   *  (`if (!config.family_B) return`) before accessing cutoffs. */
  family_B?: {
    cutoffs: Record<string, number>;
    vote_thresholds: Record<string, number>;
  };
  /** Week 3: unified cell-segmented baselines. Absent for W1 legacy
   *  configs; present when Families A/C are compiled. Detectors read
   *  `baseline_cells.cells[key].family_A` and `.family_C`; fall back to
   *  `aggregate_fallback` when a cell's `confidence ∈ {aggregate, none}`. */
  baseline_cells?: BaselineCellsConfig;
  /** Tessera SLICE 1 Delta 4 — per-shard residual cells. Optional parallel to
   *  baseline_cells. Runtime population at SLICE 2; SLICE 1 ships type only. */
  per_shard_cells?: PerShardCell[];
  /** R34 Delta 5 — Phase 2 SLICE 4 event-driven freeze-hook activation flag.
   *  Default-absent equivalent to false. When true AND the runtime caller
   *  supplies a FreezeHookState with active=true (see
   *  engine/events/freeze-hook.ts), per-shard baseline accumulation pauses
   *  during the post-deploy-event window so event-driven drift is NOT
   *  absorbed into per-shard residual. Per SCOPING-MEMO-v0.3 § 2.4
   *  circular-coupling surface. */
  freeze_hook_enabled?: boolean;
  /** Week 3 (Addition #4): signal-level bake profile, keyed by signal id.
   *  Applies to Families A, C, D, E; Family B has its own warmup config. */
  bake_profiles?: Record<string, BakeProfile>;
  /** PM-critique item 4: detectors suppress fires when live traffic_pct
   *  is below this threshold. Optional — absence means no gate. */
  traffic_pct_gate?: { min_traffic_pct_for_fire: number };
  /** Addition #23 — runtime lookup table from `tenant_id` to `TenantTier`.
   *  Populated by the compiler when the baseline bundle carries
   *  `tenant_id` on its runs; absent for pre-#23 (no-tenant) bundles
   *  (runtime treats every request as `'aggregate'` tier). */
  tenant_tier_map?: Record<string, TenantTier>;
  /** Addition #23 — the boundaries + overrides the compiler used to
   *  bucket tenants. Carried on the config so audit provenance can hash
   *  it (`tenant_tier_config_hash`) and operators can verify the tiering
   *  rule didn't change silently between deploys. */
  tenant_tier_config?: TenantTierConfig;
  /** REPLY-50 D7 — compile-phase instrumentation. Optional for
   *  backward-compat with pre-streamlining configs that lack the
   *  field. Diagnostic-only (not load-bearing on correctness). */
  compile_phases?: CompilePhases;
  /** Addition #28 (ARCHITECT-REPLY-51 D6) — reference workload
   *  profile used to parameterize this compile. Format
   *  `<id>@<semver>`, e.g., `llm-inference-streaming@1.0.0`. Absent
   *  on legacy (pre-#28) compiles + compiles run without
   *  `CompilerOptions.profile_ref`. Audit reproducibility: given the
   *  profile_ref + customer_override_ref, an operator can look up
   *  the exact profile version via git history of the `profiles/`
   *  directory and re-derive the effective_config. */
  profile_ref?: string;
  /** Addition #28 (REPLY-51 D8) — customer override reference when
   *  an override layer composes on top of the base profile. Format
   *  `<customer_id>@<semver>`. Absent when no override was applied. */
  customer_override_ref?: string;
  /** REPLY-51b R4-3 — G1 policy-profile defaults sourced from the
   *  active profile's `policy_defaults` YAML block. Optional for
   *  backward-compat; legacy (pre-#51b) compiles omit the field.
   *  engine/gates/policy.ts reads with fallback to hardcoded. */
  policy_defaults?: {
    reversibility_threshold_minutes: number;
    auto_rollback_enabled: boolean;
    default_risk_tier: 'low' | 'medium' | 'high';
  };
  /** REPLY-51b v2 R4-1 — Family A monitored-signal inventory per
   *  Phase 4 compile-time shape resolution. Profile-routed compiles
   *  emit the effective `sli_list` signal array; legacy compiles
   *  omit the field. Runtime detectors (page-cusum, betting-e-
   *  process) read with fallback to hardcoded `FAMILY_A_PRIMARY_
   *  SIGNALS` when absent. Under A3, runtime operates on compiled
   *  shape; no per-tick signal projection. */
  family_a_signals?: string[];
  /** REPLY-51b v2 R4-1 — Family C/E joint-vector signal inventory.
   *  Profile-routed compiles emit the effective `joint_vector.
   *  signals` array; legacy compiles omit. Runtime detectors
   *  (hotelling, sequential-mmd, conformal) read with fallback to
   *  hardcoded `FAMILY_C_SIGNALS`. Compiled covariance matrix +
   *  mean_vector dimensions match this inventory's length. */
  family_c_signals?: string[];
  /** REPLY-51b R4-2 — compile-time warnings accumulated during
   *  dispatch (e.g., `CELL_DIM_BASELINE_DEFICIENCY` when profile
   *  requests a cell dimension the baseline lacks). Programmatic
   *  inspection channel; stderr emission is unconditional. Absent
   *  when the compile produced no warnings. */
  compile_warnings?: Warning[];
  /** REPLY-52 D3 — baseline-provenance tag. Populated by ingestion
   *  tooling (`tools/ingest-real-trace.ts`) when a real-data bundle
   *  was compiled; absent on pre-#52 synthetic-only bundles. v1
   *  string enum; v2 may evolve to a discriminated-union form with
   *  per-source metadata for mixed-baseline attribution. */
  baseline_provenance?: BaselineProvenance;
  /** Consolidated activation slice — runtime pass-through of the
   *  compile-time `CompilerOptions.agent` flag. Compiler copies this
   *  field forward so the orchestrator can gate agent invocation
   *  without re-reading CompilerOptions. Absent → agent disabled
   *  (byte-identical pre-#27 behavior). */
  agent?: ConfiguredAgent;

  /** Q2.A — per-signal class declarations driving compile-time
   *  transform + runtime dispatch. Operators can override defaults via
   *  CompilerOptions.signal_classes; absence here = lookup in
   *  DEFAULT_SIGNAL_CLASSES; absence in defaults = 'gaussian_like'.
   *  Compiler emits this field whenever any signal got a non-default
   *  classification or when emit-on-default mode is on. Absent on
   *  pre-Q2.A configs; runtime detector defaults to gaussian_like. */
  signal_classes?: Record<string, import('../signal-classes').SignalClass>;
  /** Q61 SPEC-1 — per-decision audit emission from the 10-decision
   *  baseline curation pipeline (`tools/curate-baseline-pipeline.ts`).
   *  SLICE 1 emits D1-D4; SLICE 2 emits D5-D7; SLICE 3 emits D8-D10.
   *  Sparse object during pipeline-phasing transition (only the
   *  implemented slices' decisions populated). Optional + additive;
   *  pre-Q61 consumers ignore the field. */
  baseline_curation_pipeline_diagnostics?: Partial<Record<BaselineCurationDecisionId, BaselineCurationDecision>>;
}
