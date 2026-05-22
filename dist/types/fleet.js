"use strict";
// engine/types/fleet.ts — Tessera SLICE 3 (R11): fleet-level e-process state type.
//
// Single source of truth for the FleetEProcessState shape consumed by
// engine/fleet/combine.ts's updateFleetEProcessState. Mirrors the inherited
// per-shard wealth-process state interfaces (BettingEProcessState at
// engine/types/families/a.ts:20; FamilyCBettingEProcessState at
// engine/types/families/c.ts:297) in mutation contract (in-place) and field
// composition (current value + running max + sticky-fire latch + tick count).
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close per SCOPING-MEMO-v0.3 § 9.
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=fleet.js.map