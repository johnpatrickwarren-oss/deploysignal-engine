// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/index.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/types/index.ts — Public type contract barrel.
//
// This file is the boundary between the decision engine and its consumers
// (Phase 2 Prometheus adapter, WS5 security gate, audit replay tooling).
// Types here are stable; widening or narrowing a field is a breaking change.
//
// Hybrid module layout per ARCHITECT-REPLY-54 D-54-1 (Option C):
//   - Semantic modules for cross-cutting types (primitives, metrics,
//     policy, verdict, agent, audit, orchestration, config).
//   - Family subdirectory for family-specific params/state.
// External consumers `from '../types'` resolve here; internal code can
// also tight-import from a submodule path like `from '../types/families/a'`.

export * from './primitives';
export * from './metrics';
export * from './families/a';
export * from './families/b';
export * from './families/c';
export * from './families/d';
export * from './families/e';
export * from './agent';
export * from './verdict';
export * from './policy';
export * from './audit';
export * from './config';
export * from './orchestration';
export * from './verdict-extensions/cluster-topology';
