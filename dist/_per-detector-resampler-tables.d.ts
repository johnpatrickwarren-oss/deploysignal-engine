import type { DetectorFamily, ResamplerMode, ResamplerMode3Way } from './_per-detector-resampler-types';
/** Enumerated detector-family list. Source-of-truth ordering for
 *  iteration in `mergePerDetectorAcrossPasses` and report-card
 *  emission loops. */
export declare const PER_DETECTOR_FAMILIES: readonly DetectorFamily[];
/** Per-detector resampler-mode dispatch table per Q58 amended spec
 *  § Q58.2 + detector-family enumeration table. Each detector
 *  evaluated against the methodology surface IT WAS CALIBRATED FOR
 *  (Q2.B.6.4 P4-β.7 ADR methodology-vs-detector-design alignment).
 *
 *  Parametric pass services 6 pools — calibrated against parametric
 *  H₀ surfaces (Cholesky-correct Σ_C draws + per-cell Mahalanobis +
 *  Q3 Ville-clean betting + parametric MMD nulls).
 *
 *  Empirical pass services 4 pools — calibrated against raw distribution
 *  shape (CUSUM raw-distribution + peak-ACF raw temporal structure +
 *  structural ratio observed). */
export declare const PER_DETECTOR_RESAMPLER_MODE: Record<DetectorFamily, ResamplerMode>;
/** Compile-output fields read by each detector's runtime evaluator.
 *  Per Q58 amended spec § Q58.3 + Step-0 Gap 4 disposition (6 missing
 *  fields added across pools).
 *
 *  P3.3 sub-pattern (compile-time-substrate-with-runtime-multiple-
 *  read-paths) anchored: each entry mirrors the actual read paths in
 *  engine/detectors/* runtime code. Mac-Claude-2 grep at Step Q58.0
 *  surfaced 6 missing fields; architect amended; this enumeration
 *  closes the gap. */
export declare const COMPILE_SOURCE_FIELDS_BY_DETECTOR_FAMILY: Record<DetectorFamily, readonly string[]>;
/** Per-detector 3-way resampler-mode dispatch table per Q58 Step-4
 *  amendment. Each detector evaluated against the methodology
 *  surface IT WAS CALIBRATED FOR (Q2.B.6.4 P4-β.7 ADR
 *  methodology-vs-detector-design alignment). 3-way granularity
 *  resolves the parametric_gaussian-vs-parametric_ar1 trade-off
 *  surfaced empirically at Step-Q58.4. */
export declare const PER_DETECTOR_RESAMPLER_MODE_3WAY: Record<DetectorFamily, ResamplerMode3Way>;
/** Per-detector α budgets for Step-4 acceptance check (mean ≤ α × N
 *  × marginMultiplier). Step-4 amendment per spec § Q58.4 acceptance.
 *  Family B is non-α-consuming (structural pattern match); auto-pass
 *  via `checkPerDetectorAcceptance`. */
export declare const PER_DETECTOR_ALPHA_BUDGETS: Record<DetectorFamily, number>;
//# sourceMappingURL=_per-detector-resampler-tables.d.ts.map