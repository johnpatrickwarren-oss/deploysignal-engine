/** The lockstep comparison, exported for the study harness: counts every compared field/tick.
 *  Returns `independent: false` with zero comparisons when Tessera re-exports the engine. */
export declare function lockstepAgainstTessera(streams?: number): {
    comparisons: number;
    mismatches: number;
    dir: string;
    independent: boolean;
} | null;
//# sourceMappingURL=contrast.test.d.ts.map