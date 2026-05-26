import type { DetectorFiringDecision, NABDatasetAnnotation } from './run-nab-validation';
export interface NABProfile {
    name: 'standard' | 'reward_low_fp' | 'reward_low_fn';
    /** TP coefficient — positive contribution per true-positive detection. */
    tp_weight: number;
    /** FP coefficient — negative contribution per false-positive (outside window). */
    fp_weight: number;
    /** FN coefficient — negative contribution per anomaly window with no detection. */
    fn_weight: number;
}
/** Lavin-Ahmad 2015 Table 1 application profiles (verbatim from paper).
 *  Standard balances TP/FP/FN; reward_low_fp scales FP penalty up;
 *  reward_low_fn scales TP reward + FN penalty up. */
export declare const NAB_PROFILES: Record<NABProfile['name'], NABProfile>;
/** Compute NAB score per detector per dataset per profile.
 *
 *  Algorithm:
 *  1. Sort annotations by window start.
 *  2. For each window: find first firing tick within [window_start,
 *     window_end]; if found, accumulate TP × tp_weight × sigmoidDecay.
 *     If no firing in window, accumulate fn_weight.
 *  3. For each firing outside any window: accumulate fp_weight.
 *  4. Normalize to 0-100 range:
 *     normalized = 100 × (raw - random_baseline) / (perfect_score - random_baseline)
 *     where random_baseline = 0 (Lavin-Ahmad 2015 reference);
 *     perfect_score = (#anomaly_windows × tp_weight × sigmoidDecay(1.0))
 *     (ideal: every window detected exactly at start with no FPs).
 */
export declare function computeNABScore(firings: DetectorFiringDecision[], annotations: NABDatasetAnnotation[], profile: NABProfile): number;
/** Aggregate per-dataset scores into per-family score (mean aggregation
 *  per Lavin-Ahmad 2015 standard). Empty perDatasetScores returns 0. */
export declare function aggregateFamilyScore(perDatasetScores: Record<string, number>): number;
//# sourceMappingURL=nab-scoring.d.ts.map