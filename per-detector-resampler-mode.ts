// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/per-detector-resampler-mode.ts — Topic 58 per-detector
// resampler-mode dispatch (facade).
//
// Per Q2.B.6.4 P4-β.7 ADR (declined-feature disposition; per-detector
// iid_bootstrap pool committed) + Q58 amended spec (post-Step-0
// architect amendment; ARCHITECT-REPLY-Q58-STEP-0-COVERAGE-GAP-
// DISPOSITION). Resolves the Family E weighted-conformal Mahalanobis
// novelty detection methodology-vs-detector-design alignment by
// running TWO FPR-sweep passes (empirical + parametric); each detector
// family's firing count is attributed only from its design-intent
// methodology-aligned pass.
//
// Anti-scope (Memorial F ADR-anti-scope-preservation sub-rule):
//  1. NO Family E aggregate-only Mahalanobis (per-cell-preferred per
//     engine/detectors/conformal.ts:137; preserved).
//  2. NO change to Family E calibration_scores source (aggregate per
//     ARCHITECT-REPLY-16 Q2; preserved).
//  3. NO touch to engine/detectors/* runtime code.
//  4. NO refactor of TrendBuffer or orchestrator dispatch.
//  5. NO per-detector row-pool data structure (this file replaces the
//     earlier per-detector-pool-sizes.ts + iid-bootstrap-pool.ts
//     module-pair conceptualization).
//
// FACADE NOTE: the former 680-line monolith was decomposed (no
// behavior change) into cohesive sibling modules, re-exported here so
// every importable name remains importable from THIS path:
//   * _per-detector-resampler-types.ts      — shared type vocabulary
//   * _per-detector-resampler-tables.ts     — dispatch tables / budgets
//   * _per-detector-resampler-counts.ts     — single-pass attribution
//   * _per-detector-resampler-merge.ts      — cross-pass merge / build
//   * _per-detector-resampler-acceptance.ts — α-budget + seed stats
// Shared types live in their own module (NOT this facade) to avoid
// circular imports.

export type {
  DetectorFamily,
  ResamplerMode,
  ResamplerMode3Way,
  PerDetectorPoolFiringId,
  PerDetectorIidBootstrapPool,
  FprSweepResultLike,
  CompiledConfigVariantHints,
} from './_per-detector-resampler-types';

export {
  PER_DETECTOR_FAMILIES,
  PER_DETECTOR_RESAMPLER_MODE,
  COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY,
  PER_DETECTOR_RESAMPLER_MODE_3WAY,
  PER_DETECTOR_ALPHA_BUDGETS,
} from './_per-detector-resampler-tables';

export {
  resolveHotellingVariant,
  extractPerDetectorCounts,
} from './_per-detector-resampler-counts';

export {
  mergePerDetectorAcrossPasses,
  mergePerDetectorAcrossThreePasses,
  buildAllThreeModePoolsPerDetector,
} from './_per-detector-resampler-merge';

export {
  checkPerDetectorAcceptance,
  wilsonUpperBound,
  summarizePerDetectorAcrossSeeds,
} from './_per-detector-resampler-acceptance';
