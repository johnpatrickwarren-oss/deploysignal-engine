import { type NABDetectorFamily, type DetectorFiringDecision, type RunDetectorDispatchOpts } from './_nab-validation-types';
/** Run a single detector family over a NAB dataset and capture per-
 *  tick firing decisions. Pure wrapper-layer: imports orchestrate
 *  via shared.js (preserves Q58/Q59/Q60 anti-scope on engine/detectors/*).
 *
 *  Q64 Phase 4 STUB resolution per architect option (i.a) single-signal-
 *  detector emulation (ARCHITECT-REPLY-Q64-PHASE-4-NAB-ACQUISITION-STUB-
 *  DISPOSITION.md § Ask 1). Family A + Family D natively per-signal;
 *  NAB univariate maps cleanly. Calibration source: v5 substrate's
 *  family_A.per_signal[calibrationSignal] / family_D[calibrationSignal]
 *  (default 'p99_latency' heavy_tail signal class).
 *
 *  Architect pseudo-code uses `evaluatePageCusumPerSignal` /
 *  `evaluateBettingEProcessPerSignal` / `evaluateSpectralPeakAcfPerSignal`;
 *  codebase actuals are `evaluateFamilyAShadow` /
 *  `evaluateFamilyABettingShadow` / `evaluateFamilyD` — naming drift
 *  only; semantics match (single-signal evaluation per call). */
export declare function runDetectorOverDataset(family: NABDetectorFamily, values: number[], compiledConfigPath: string, calibrationSignal?: string, dispatchOpts?: RunDetectorDispatchOpts): DetectorFiringDecision[];
//# sourceMappingURL=_nab-validation-dispatch.d.ts.map