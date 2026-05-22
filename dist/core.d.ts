import type { TrendSnapshot, TrendBufferI, TrendBufferOpts, WarmupConfig, WarmupState, Scenario, HealthResult, Verdict, FpClassifierConfig } from './types';
export interface TrendBufferCtor {
    new (windowSize?: number, opts?: TrendBufferOpts): TrendBufferI;
}
export declare const TrendBuffer: TrendBufferCtor;
export declare function trendStrength(t: TrendSnapshot | null | undefined, direction: 'rise' | 'fall'): number;
export declare function effectiveThreshold(baseThreshold: number, trendDiscount: number, t: TrendSnapshot | null | undefined, direction?: 'rise' | 'fall', rocBypass?: number | null): number;
export declare const WARMUP_CONFIG: WarmupConfig;
export declare function getWarmupState(sc: Scenario, hrs: number): WarmupState;
export declare function computeVerdict(signals: HealthResult, tick: number, totalTicks: number): Verdict;
export declare const FP_CLASSIFIER_CONFIG: FpClassifierConfig;
export declare const TOTAL_TICKS = 32;
//# sourceMappingURL=core.d.ts.map