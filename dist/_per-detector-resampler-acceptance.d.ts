import type { DetectorFamily } from './_per-detector-resampler-types';
/** Per-detector α-budget acceptance check per Step-4 amendment.
 *  Architect-pick: mean firing count across N seeds ≤ α × healthy_windows
 *  × marginMultiplier (default 1.2). Tighter than the report-card-level
 *  1.5 × α_total because per-detector α is already conservative. */
export declare function checkPerDetectorAcceptance(perDetectorMeans: Partial<Record<DetectorFamily, number>>, alphaBudgets: Partial<Record<DetectorFamily, number>>, healthyWindows: number, marginMultiplier?: number): Record<DetectorFamily, {
    pass: boolean;
    mean: number;
    expected: number;
    threshold: number;
}>;
/** Wilson-score upper bound for binomial proportion. Used for
 *  per-seed pass-rate confidence interval (architect-pick: ≥ 6/8 seeds
 *  pass under per-seed firing_count ≤ ceil(μ + 1.96 × √μ) Poisson
 *  upper bound). */
export declare function wilsonUpperBound(successes: number, trials: number, z?: number): number;
/** Compute per-detector mean firing-count across N seeds + per-seed
 *  pass count (against Poisson upper bound). */
export declare function summarizePerDetectorAcrossSeeds(perSeedFiringCounts: Array<Record<DetectorFamily, number>>, alphaBudgets: Partial<Record<DetectorFamily, number>>, healthyWindows: number): Record<DetectorFamily, {
    per_seed_counts: number[];
    mean: number;
    per_seed_pass_count: number;
    per_seed_pass_rate: number;
    poisson_upper_bound: number;
}>;
//# sourceMappingURL=_per-detector-resampler-acceptance.d.ts.map