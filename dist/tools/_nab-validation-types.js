"use strict";
// tools/_nab-validation-types.ts — Q64 SPEC-4 NAB validation public types
// + constants. Extracted verbatim from tools/run-nab-validation.ts to keep
// each module under 500 lines; re-exported from run-nab-validation.ts so
// every previously-importable name stays importable from the same path.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CALIBRATION_SIGNAL = exports.TOOL_VERSION = exports.DEFAULT_DETECTORS = exports.DEFAULT_SUB_BENCHMARKS = void 0;
exports.DEFAULT_SUB_BENCHMARKS = [
    'realKnownCause',
    'realAWSCloudwatch',
    'artificialNoAnomaly',
    'artificialWithAnomaly',
];
exports.DEFAULT_DETECTORS = [
    'family_A_betting',
    'family_A_page_cusum',
    'family_A_mixture_supermartingale',
    'family_D_spectral',
];
exports.TOOL_VERSION = 'Q64 SPEC-4 v1.0';
/** Q64 Phase 4 architect-disposed default calibration signal — heavy_tail
 *  signal class most representative of NAB time-series anomalies
 *  (realAWSCloudwatch CPU; realKnownCause sensor data). Settable via
 *  --calibration-signal CLI flag. */
exports.DEFAULT_CALIBRATION_SIGNAL = 'p99_latency';
//# sourceMappingURL=_nab-validation-types.js.map