import type { NABSubBenchmark, NABDatasetAnnotation } from './_nab-validation-types';
/** Discover NAB dataset CSV files under <nabRepoPath>/data/<sub>/*.csv. */
export declare function discoverNABDatasets(nabRepoPath: string, subBenchmarks: NABSubBenchmark[]): Array<{
    subBenchmark: NABSubBenchmark;
    relPath: string;
    absPath: string;
}>;
/** Parse NAB dataset CSV. Numenta convention: header row `timestamp,
 *  value`; per-tick observation. Returns per-tick value array (tick
 *  index = row index post-header). */
export declare function parseNABDatasetCsv(absPath: string): {
    values: number[];
    timestamps: string[];
};
/** Load NAB combined_windows.json labels file. Maps relative dataset
 *  path (e.g. 'realKnownCause/foo.csv') to array of [start_ts, end_ts]
 *  ISO strings. */
export declare function loadNABLabels(labelsPath: string): Record<string, Array<[string, string]>>;
export declare function annotationsFromLabels(labelWindows: Array<[string, string]>, timestamps: string[]): NABDatasetAnnotation[];
//# sourceMappingURL=_nab-validation-loading.d.ts.map