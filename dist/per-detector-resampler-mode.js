"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePerDetectorAcrossSeeds = exports.wilsonUpperBound = exports.checkPerDetectorAcceptance = exports.buildAllThreeModePoolsPerDetector = exports.mergePerDetectorAcrossThreePasses = exports.mergePerDetectorAcrossPasses = exports.extractPerDetectorCounts = exports.resolveHotellingVariant = exports.PER_DETECTOR_ALPHA_BUDGETS = exports.PER_DETECTOR_RESAMPLER_MODE_3WAY = exports.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY = exports.PER_DETECTOR_RESAMPLER_MODE = exports.PER_DETECTOR_FAMILIES = void 0;
var _per_detector_resampler_tables_1 = require("./_per-detector-resampler-tables");
Object.defineProperty(exports, "PER_DETECTOR_FAMILIES", { enumerable: true, get: function () { return _per_detector_resampler_tables_1.PER_DETECTOR_FAMILIES; } });
Object.defineProperty(exports, "PER_DETECTOR_RESAMPLER_MODE", { enumerable: true, get: function () { return _per_detector_resampler_tables_1.PER_DETECTOR_RESAMPLER_MODE; } });
Object.defineProperty(exports, "COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY", { enumerable: true, get: function () { return _per_detector_resampler_tables_1.COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY; } });
Object.defineProperty(exports, "PER_DETECTOR_RESAMPLER_MODE_3WAY", { enumerable: true, get: function () { return _per_detector_resampler_tables_1.PER_DETECTOR_RESAMPLER_MODE_3WAY; } });
Object.defineProperty(exports, "PER_DETECTOR_ALPHA_BUDGETS", { enumerable: true, get: function () { return _per_detector_resampler_tables_1.PER_DETECTOR_ALPHA_BUDGETS; } });
var _per_detector_resampler_counts_1 = require("./_per-detector-resampler-counts");
Object.defineProperty(exports, "resolveHotellingVariant", { enumerable: true, get: function () { return _per_detector_resampler_counts_1.resolveHotellingVariant; } });
Object.defineProperty(exports, "extractPerDetectorCounts", { enumerable: true, get: function () { return _per_detector_resampler_counts_1.extractPerDetectorCounts; } });
var _per_detector_resampler_merge_1 = require("./_per-detector-resampler-merge");
Object.defineProperty(exports, "mergePerDetectorAcrossPasses", { enumerable: true, get: function () { return _per_detector_resampler_merge_1.mergePerDetectorAcrossPasses; } });
Object.defineProperty(exports, "mergePerDetectorAcrossThreePasses", { enumerable: true, get: function () { return _per_detector_resampler_merge_1.mergePerDetectorAcrossThreePasses; } });
Object.defineProperty(exports, "buildAllThreeModePoolsPerDetector", { enumerable: true, get: function () { return _per_detector_resampler_merge_1.buildAllThreeModePoolsPerDetector; } });
var _per_detector_resampler_acceptance_1 = require("./_per-detector-resampler-acceptance");
Object.defineProperty(exports, "checkPerDetectorAcceptance", { enumerable: true, get: function () { return _per_detector_resampler_acceptance_1.checkPerDetectorAcceptance; } });
Object.defineProperty(exports, "wilsonUpperBound", { enumerable: true, get: function () { return _per_detector_resampler_acceptance_1.wilsonUpperBound; } });
Object.defineProperty(exports, "summarizePerDetectorAcrossSeeds", { enumerable: true, get: function () { return _per_detector_resampler_acceptance_1.summarizePerDetectorAcrossSeeds; } });
//# sourceMappingURL=per-detector-resampler-mode.js.map