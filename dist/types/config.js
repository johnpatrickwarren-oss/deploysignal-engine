"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenantTier = void 0;
var _config_tenant_1 = require("./_config-tenant");
Object.defineProperty(exports, "resolveTenantTier", { enumerable: true, get: function () { return _config_tenant_1.resolveTenantTier; } });
//# sourceMappingURL=config.js.map