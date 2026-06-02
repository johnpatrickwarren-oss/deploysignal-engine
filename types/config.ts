// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/config.ts (820 LOC)
// Sync policy: vendored-with-deltas (Tessera Phase 1 SLICE 1)
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
//
// ─── TESSERA DELTAS (5 changes to inherited 820 LOC) ───────────────────────
// Delta 1: BaselineCellsConfig.dimensions extended with 'shard_id' as 7th member.
// Delta 2: BaselineCellEntry.confidence extended with 'warm_start' as 5th member.
// Delta 3: PerShardResidual + PerShardCell new interface declarations at module level.
// Delta 4: CompiledConfig.per_shard_cells?: PerShardCell[] new optional field.
// Delta 5 (R34): CompiledConfig.freeze_hook_enabled?: boolean new optional field
//          (Phase 2 SLICE 4 event-driven freeze hook activation flag; default-absent
//          equivalent to false; consumed by engine/events/freeze-hook.ts wrapper).
// Convenience: CellDimension + CellConfidence type aliases added for test/type consumers.
// Inline union extensions are in-place per architect-pick (α); typedef-extract deferred to SLICE 2+.

// engine/types/config.ts — CompiledConfig, CompilerOptions, baseline
// bundle shapes, workload-profile types, tenant-tier configuration,
// compile-phase instrumentation.
//
// ─── GOD-FILE DECOMPOSITION (behavior-preserving, export-surface-stable) ────
// This module was a 928-line god-file. It has been split by concern into the
// `_config-*` submodules below; this file is now a FACADE that re-exports the
// exact same public surface. Every name previously exported from
// `types/config` remains importable from `types/config` unchanged. The only
// runtime value export (`resolveTenantTier`) lives in `_config-tenant`; all
// other exports are types/interfaces (erased at runtime). Cross-submodule
// references use `import type`, so the split introduces no runtime cycles.

export type {
  WarmupConfig,
  FpClassifierConfig,
  TenantTier,
  TenantTierConfig,
} from './_config-tenant';
export { resolveTenantTier } from './_config-tenant';

export type { CompiledConfig } from './_config-compiled';

export type {
  BaselineCurationDecisionId,
  BaselineCurationDecision,
  BundleMetadata,
} from './_config-curation';

export type {
  RegressionDeltaKind,
  RegressionInjectionPoint,
  RegressionProfile,
  BaselineProvenance,
  Warning,
  CompilePhases,
  BaselineBundle,
} from './_config-regression';

export type {
  BaselineCellEntry,
  BaselineCellsConfig,
  BakeProfile,
  CellDimension,
  CellConfidence,
  PerShardResidual,
  PerShardCell,
} from './_config-cells';

export type {
  CompilerOptions,
  ConfiguredTopologyRef,
} from './_config-compiler-options';

export type {
  WorkloadProfileSliEntry,
  WorkloadProfileBakeEntry,
  WorkloadProfile,
  CustomerOverride,
  EffectiveConfig,
} from './_config-profile';

export type {
  Q60DetectorFamily,
  ProfileReportCardBlock,
  ShadowCompareBlock,
  SweepCheckpoint,
} from './_config-report-card';
