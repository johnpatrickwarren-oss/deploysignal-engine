"use strict";
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
// types/audit.ts — the detector registry's import path.
//
// ADR 0033 (v0.9.0-pre): DeploySignal's audit-record schema (AuditRecord, AuditRecordV2,
// DetectorTripV2, the audit-event payloads, AuditWriter) and its OrchestrateParams left this package;
// DeploySignal owns them in its own tree and no other consumer imported them. What remains here is
// the registry, re-exported so `types/audit` keeps resolving for the tests and consumers that use it.
__exportStar(require("./detector-registry"), exports);
//# sourceMappingURL=audit.js.map