"use strict";
// engine/ds-integration/index.ts — Phase 3 SLICE 3 WU-Phase3-3A (R62) barrel.
//
// Single import surface for the DS integration interface contract. Both
// directions (Tessera→DS feed; DS→Tessera event) are re-exported from this
// barrel. Tessera-side WU-3B + WU-3C (R63+) import the contract types from
// this path; DS-side (separate PR after Wave 10) implements against the
// same shape independently.
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
__exportStar(require("./feed-contract"), exports);
__exportStar(require("./event-contract"), exports);
__exportStar(require("./feed"), exports);
__exportStar(require("./event-consumer"), exports); // R66 addition
__exportStar(require("./freeze-hook-factory"), exports); // R66 addition
//# sourceMappingURL=index.js.map