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
exports.DETECTOR_REGISTRY = exports.LEGACY_DEPLOYSIGNAL_HEURISTICS = exports.LEGACY_DEPLOYSIGNAL_FAMILY_D_SIGNALS = exports.LEGACY_DEPLOYSIGNAL_SIGNALS = void 0;
// ── Audit schema v2 registry + types (W4 §4.1.h) ──────────────────
//
// Per audit/SCHEMA.md v2. Shipped-in-W4 canonical detector_ids only; reserved
// entries live in the spec but aren't emitted. Readers that see an
// unknown_detector_id emit a warning and preserve the record.
const detector_registry_1 = require("./detector-registry");
__exportStar(require("./detector-registry"), exports);
// ── The DeploySignal instance ─────────────────────────────────────
//
// ADR 0033: these three lists are DEPLOYSIGNAL'S, not the engine's. They are held here, in one
// place and under one name, so that `DETECTOR_REGISTRY` / `DetectorId` keep their exact pre-0.7.0
// shape for DeploySignal's 16 importing files while the registry itself became generic. They leave
// for DeploySignal's own tree at ADR 0033 step 2; a new consumer builds its own registry with
// `detectorRegistryFor` and never imports these.
/** DeploySignal's six Family A signals. */
exports.LEGACY_DEPLOYSIGNAL_SIGNALS = Object.freeze([
    'p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req',
]);
/** The one signal DeploySignal's Family D spectral detectors run on. */
exports.LEGACY_DEPLOYSIGNAL_FAMILY_D_SIGNALS = Object.freeze(['kv_cache']);
/** DeploySignal's 16 Family B structural signatures — consumer policy, no engine implementation. */
exports.LEGACY_DEPLOYSIGNAL_HEURISTICS = Object.freeze([
    'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse',
    'slowbleed', 'collective', 'capacity', 'gpu_eff', 'compound_lat',
    'tok_econ', 'behavioral', 'eval_quality_drop', 'refusal_spike',
    'output_len_drift', 'tool_call_degradation', 'quality_warning',
]);
/** Canonical detector_ids per family for DeploySignal's signals. Normative for DeploySignal's
 *  audit writers and readers (audit/SCHEMA.md v2); readers that see an unknown id emit a warning
 *  and preserve the record. Built by `detectorRegistryFor` in kind-major order, which
 *  test/guarantees.test.ts holds equal to the literal list this replaced. */
exports.DETECTOR_REGISTRY = (0, detector_registry_1.detectorRegistryFor)({
    signals: exports.LEGACY_DEPLOYSIGNAL_SIGNALS,
    familyDSignals: exports.LEGACY_DEPLOYSIGNAL_FAMILY_D_SIGNALS,
    heuristics: exports.LEGACY_DEPLOYSIGNAL_HEURISTICS,
});
//# sourceMappingURL=audit.js.map