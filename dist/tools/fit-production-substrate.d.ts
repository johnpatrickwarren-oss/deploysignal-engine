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
/** Parse the calibration CSV. Exported for the unit-test surface.
 *
 *  Validation (remediation 2026-06-10 M7): a single malformed/short row used
 *  to push NaN, silently poisoning mean/σ²/φ and serializing nulls into the
 *  production-consumed substrate JSON; an empty file crashed with a
 *  TypeError. This is an offline calibrator, so throwing with the offending
 *  row number is the right failure mode. */
export declare function parseCsv(csvPath: string): {
    values: number[];
    firstTs?: string;
    lastTs?: string;
};
interface CliArgs {
    csv?: string;
    out?: string;
    signalName?: string;
    description?: string;
    fitArPCalibration?: boolean;
    arPMaxOrder?: number;
    arPInformationCriterion?: 'aic' | 'bic';
    fitSeasonalDecomposition?: boolean;
    seasonalMinAcf?: number;
    fitSpectral?: boolean;
}
/** Parse CLI args. Exported for the unit-test surface (remediation
 *  2026-06-10 L5: unknown `--flags` were silently ignored — a typo like
 *  `--ar-p-max-orde` silently changed calibration behavior; now throws,
 *  matching run-nab-validation.ts). */
export declare function parseArgs(argv: string[]): CliArgs;
export {};
//# sourceMappingURL=fit-production-substrate.d.ts.map