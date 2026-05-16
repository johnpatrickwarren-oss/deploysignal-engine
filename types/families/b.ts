// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/families/b.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/types/families/b.ts — Family B (structural signatures).
//
// Family B ships its config inline on CompiledConfig.family_B (see
// config.ts) and carries no per-cell detector state — structural
// signatures fire on absolute-threshold ratios, not cumulative or
// baseline-relative statistics. This file is intentionally empty
// type-wise; it exists to mirror the Family A/C/D/E layout for
// future extension (e.g., Family B per-cell tunings for follow-on).

export {};
