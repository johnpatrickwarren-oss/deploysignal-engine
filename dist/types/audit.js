"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/audit.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// ── Audit schema v2 registry + types (W4 §4.1.h) ──────────────────
//
// Per audit/SCHEMA.md v2. Shipped-in-W4 canonical detector_ids only; reserved
// entries live in the spec but aren't emitted. Readers that see an
// unknown_detector_id emit a warning and preserve the record.
__exportStar(require("./detector-registry"), exports);
//# sourceMappingURL=audit.js.map