#!/usr/bin/env node
import type { ProductionArSubstrate } from '../types/production-ar-substrate';
export interface FitSubstrateOpts {
    signalName: string;
    description?: string;
    calibrationStart?: string;
    calibrationEnd?: string;
    fitArPCalibration?: boolean;
    arPMaxOrder?: number;
    arPInformationCriterion?: 'aic' | 'bic';
    fitSeasonalDecomposition?: boolean;
    seasonalMinAcf?: number;
    fitSpectral?: boolean;
}
export declare function fitProductionSubstrate(values: number[], opts: FitSubstrateOpts): ProductionArSubstrate;
//# sourceMappingURL=fit-production-substrate.d.ts.map