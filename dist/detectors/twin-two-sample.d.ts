export interface TwinTwoSampleCoordinate {
    id: string;
    margin?: {
        relative?: number;
        absolute?: number;
    };
}
export interface TwinTwoSampleSpec {
    id: string;
    alpha: number;
    coordinates: readonly TwinTwoSampleCoordinate[];
    /** past pairs the witness averages over (default 200) */ window?: number;
    /** past pairs the local level and scale are taken from (default 20): a shared slow drift (seasonality) that both
     *  arms carry is removed by centring on the recent past; predictable, applied identically to both arms */ localWindow?: number;
    lambdaMax?: number;
}
export interface TwinTwoSampleState {
    pastX: number[][];
    pastY: number[][];
    recent: number[][];
    fMax: number;
    lambda: number;
    invHessian: number;
    logS: number;
    used: number;
    missing: number;
    fired: boolean;
    firedAt: number | null;
}
export interface TwinTwoSampleStep {
    state: TwinTwoSampleState;
    F: number | null;
    wealth: number;
    threshold: number;
    fire: boolean;
}
export declare function checkTwinTwoSampleSpec(spec: TwinTwoSampleSpec): void;
export declare function initTwinTwoSample(spec: TwinTwoSampleSpec): TwinTwoSampleState;
/** ADR 0042 §1: shrink the pair toward each other by the band; swapping x and y swaps the outputs. */
export declare function shrinkPair(spec: TwinTwoSampleSpec, x: readonly number[], y: readonly number[]): {
    x: number[];
    y: number[];
};
export declare function stepTwinTwoSample(spec: TwinTwoSampleSpec, state: TwinTwoSampleState, x: readonly number[], y: readonly number[]): TwinTwoSampleStep;
//# sourceMappingURL=twin-two-sample.d.ts.map