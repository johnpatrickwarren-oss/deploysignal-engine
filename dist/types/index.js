"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/index.ts
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
__exportStar(require("./primitives"), exports);
__exportStar(require("./metrics"), exports);
__exportStar(require("./families/a"), exports);
__exportStar(require("./families/b"), exports);
__exportStar(require("./families/c"), exports);
__exportStar(require("./families/d"), exports);
__exportStar(require("./families/e"), exports);
__exportStar(require("./agent"), exports);
__exportStar(require("./verdict"), exports);
__exportStar(require("./policy"), exports);
__exportStar(require("./audit"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./orchestration"), exports);
__exportStar(require("./verdict-extensions/cluster-topology"), exports);
//# sourceMappingURL=index.js.map