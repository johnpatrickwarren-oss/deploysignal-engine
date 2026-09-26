export interface RatePlanInput {
    kind: 'rate';
    /** Canary traffic share within the experiment, in (0, 1). */
    canaryShare: number;
    /** Odds ratio of the regression to detect, > 0 (1.2 = 20% more bad events per request). */
    oddsRatio: number;
    /** Expected bad events per tick across both arms, > 0. */
    badEventsPerTick: number;
    alpha: number;
}
export interface SignPlanInput {
    kind: 'sign';
    /** P(canary tick worse) − 1/2 to detect, in [0, 0.5). */
    excessProbability: number;
    /** Fraction of ticks that tie, in [0, 1). */
    tieRate: number;
    alpha: number;
}
export declare function ticksToDetect(input: RatePlanInput | SignPlanInput): number;
//# sourceMappingURL=twin-planning.d.ts.map