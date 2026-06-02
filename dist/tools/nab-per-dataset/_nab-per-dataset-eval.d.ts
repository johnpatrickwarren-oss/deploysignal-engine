import { type NABDatasetAnnotation, type DetectorFiringDecision } from '../run-nab-validation';
import { type NABProfile } from '../nab-scoring';
import type { PerDatasetNABValidationOpts, PerDatasetNABValidationReport } from './_nab-per-dataset-types';
/** Score firings against annotations, restricted to ticks ≥ probationary
 *  cutoff. Standard NAB convention: scoring starts after the probationary
 *  window so the detector has a chance to calibrate. */
export declare function scorePostProbationary(firings: DetectorFiringDecision[], annotations: NABDatasetAnnotation[], nProbationary: number, profile: NABProfile): number;
export declare function runPerDatasetNABValidation(opts: PerDatasetNABValidationOpts): PerDatasetNABValidationReport;
//# sourceMappingURL=_nab-per-dataset-eval.d.ts.map