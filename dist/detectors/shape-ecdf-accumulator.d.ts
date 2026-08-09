/** Live/reference window length. FROZEN (v2.K6A.1 K6A.1.2). */
export declare const W_K6SLOW = 150;
/** Reference-segment length: A = rows 1..25,000 of the 100,000-row draw. FROZEN. */
export declare const N_A_K6SLOW = 25000;
/** Disjoint contiguous B-blocks: 75,000/150 = 500 exactly, no remainder; SATURATED
 *  (v2.K6A Table 3 — the substrate stops paying above m ~ 500). FROZEN. */
export declare const M_K6SLOW = 500;
/** Calibration substrate rows per cell: 25,000 + 500*150. FROZEN. */
export declare const N_ROWS_K6SLOW: number;
/** kappa for the calibrator e = kappa*p^(kappa-1). FROZEN LITERAL 0.6820 — v2.K6A.1
 *  K6A.1.2 keeps it against its own fresh data's implied optimum 1/x = 0.680848
 *  (0.00115 below, worth < 0.001 in detection) because re-deriving kappa on the data
 *  that then reports the endpoint is the circularity v2.K6A K6A.6 removed. Do not
 *  "improve" this number: it is the freeze the passing gate rests on. */
export declare const KAPPA_K6SLOW = 0.682;
/** The healthy budget (v2.K6A.1 K6A.1.2 / K6A.1.10). */
export declare const ALPHA_K6SLOW = 0.05;
/** Endpoint: wealth >= 1/alpha = 20, i.e. log-wealth >= log 20 = 2.995732, at any
 *  window checkpoint (any-time, Ville). */
export declare const LOG_WEALTH_THRESHOLD_K6SLOW: number;
/** Wealth floor, log domain — the same value shape-block-conformal-bet.ts uses
 *  (LOG_WEALTH_FLOOR_K6 = log(1e-12), C1.9 I1); prevents underflow on long healthy runs.
 *  Unreachable inside the registered horizon: the worst attainable path over N = 40
 *  windows is 40*log(kappa) = -15.309, well above log(1e-12) = -27.631. */
export declare const LOG_WEALTH_FLOOR_K6SLOW: number;
/** The substrate split. The registered path uses `REGISTERED_GEOMETRY_K6SLOW` and takes
 *  no geometry argument; the override exists so the construction is testable on
 *  hand-computable geometries and so the T2 arm's m = 45 (K6A.1.11) has a legitimate
 *  route that does not touch the frozen literals. */
export interface EcdfAccumulatorGeometry {
    /** window / block length */
    W: number;
    /** reference-segment length (A) */
    nA: number;
    /** number of disjoint contiguous B-blocks */
    m: number;
}
export declare const REGISTERED_GEOMETRY_K6SLOW: Readonly<EcdfAccumulatorGeometry>;
/** C1.8's registered fingerprint construction (`cal_fingerprint`), applied to this
 *  construction's single block statistic. `absdev_*` are quantiles of the ascending
 *  |T(B_j) - median| distances under C1.8's convention q(p) = sortedAbsDev[round(p*(m-1))],
 *  and `absdev_max` is the last element. */
export interface EcdfAccumulatorFeatureFingerprint {
    median: number;
    absdev_p50: number;
    absdev_p90: number;
    absdev_max: number;
}
export interface EcdfAccumulatorFingerprint {
    W: number;
    m: number;
    n_A: number;
    blockT: EcdfAccumulatorFeatureFingerprint;
}
export interface EcdfAccumulatorCalibration {
    W: number;
    nA: number;
    m: number;
    /** ascending copy of A — the empirical reference measure Fhat_A */
    sortedA: number[];
    /** prefixA[i] = sum of sortedA[0..i-1]; length nA+1 */
    prefixA: number[];
    /** T(B_j) in block order (provenance: which block produced which statistic) */
    blockT: number[];
    /** T(B_j) ascending — what the live rank counts against */
    sortedBlockT: number[];
    cal_fingerprint: EcdfAccumulatorFingerprint;
}
export interface EcdfAccumulatorWindowResult {
    T: number;
    p: number;
    e: number;
}
export interface EcdfAccumulatorWealthResult {
    /** saturating linear view of the final log-wealth (never Infinity) */
    wealth: number;
    /** cumulative log-wealth through each window — the any-time crossing trajectory */
    log: number[];
    /** 0-based index of the first window whose cumulative log-wealth reaches
     *  LOG_WEALTH_THRESHOLD_K6SLOW, or -1 if none. Index i is post-onset tick (i+1)*W,
     *  so `crossingIndex === 1` is the 300-tick crossing K6A.1.5 identifies as the
     *  earliest arithmetically possible one. */
    crossingIndex: number;
}
export interface NullGrowthScreenOptions {
    /** MC seeds, one null window per seed. Mandatory: this module has no generator and no
     *  wall-clock or Math.random default (the screen is a registered stop condition and
     *  must be reproducible from its seeds). */
    seeds: ReadonlyArray<number>;
    /** the caller's own registered generator, seed -> one length-W null window. */
    drawNullWindow: (seed: number) => number[];
    /** defaults to the frozen KAPPA_K6SLOW; guarded to (0,1) either way. */
    kappa?: number;
}
export interface NullGrowthScreenResult {
    kappa: number;
    draws: number;
    /** Ehat[-log p | null, S] over the MC draws */
    meanNegLogP: number;
    /** g_null(S) = log kappa + (1-kappa)*Ehat[-log p | null, S] */
    gNull: number;
    /** gNull > 0 — the registered STOP condition for this calibration draw (K6A.1.10 (2)) */
    positive: boolean;
}
/** Calibrates the held-out draw: splits A = rows[0, nA) and B = rows[nA, nA + m*W),
 *  builds the ascending reference (Fhat_A) with its prefix sums, and computes T(B_j) for
 *  each of the m disjoint contiguous W-blocks under K6A.2's registered energy form.
 *
 *  The registered path passes the 100,000-row draw and nothing else: A = 25,000,
 *  B = 75,000 -> m = 500 blocks of 150 exactly, no remainder (v2.K6A.1 K6A.1.2/K6A.1.9).
 *  The split is exact, not floor-based: a substrate that does not divide evenly is a
 *  defect in the draw, and this function throws rather than dropping a remainder.
 *
 *  Throws on: a non-integral geometry; a row count that is not nA + m*W (reported as the
 *  B-remainder and the m mismatch separately, so an A/B boundary off-by-one names itself);
 *  a non-finite row; a degenerate reference ECDF; a constant reference block; zero spread
 *  across the m block statistics. */
export declare function calibrateEcdfAccumulator(rows: ReadonlyArray<number>, geom?: EcdfAccumulatorGeometry): EcdfAccumulatorCalibration;
/** One live window: T under K6A.2's registered energy form, the tie-inclusive
 *  block-conformal p = (1 + #{T(B_j) >= T(live)})/(m+1), and e = kappa*p^(kappa-1).
 *
 *  Requires `window.length === cal.W` (150 on the registered path) and every value
 *  finite. A non-finite value THROWS — see the module docstring for why this module has
 *  no neutral-e pathway where shape-block-conformal-bet.ts has one. */
export declare function ecdfAccumulatorWindow(window: ReadonlyArray<number>, cal: EcdfAccumulatorCalibration, kappa?: number): EcdfAccumulatorWindowResult;
/** Wealth over DISJOINT live windows: the product of per-window e, accumulated in the log
 *  domain (ADR 0026 / detectors/_wealth.ts) with the registered floor. `log[i]` is the
 *  cumulative log-wealth through window i — the trajectory an any-time (Ville) crossing
 *  check needs at every prefix, which is what makes the registered endpoint
 *  "wealth >= 20 at any window checkpoint" (K6A.1.2) readable off one call.
 *
 *  Always the frozen kappa: the wealth path is the endpoint, and a per-call kappa here
 *  would let a caller report a differently-calibrated accumulator under this class's name.
 *  Each window is validated by `ecdfAccumulatorWindow` (its guards propagate). */
export declare function ecdfAccumulatorWealth(windows: ReadonlyArray<ReadonlyArray<number>>, cal: EcdfAccumulatorCalibration): EcdfAccumulatorWealthResult;
/** The reference-conditional null-growth screen — the design page's mandatory pre-run
 *  check and, per v2.K6A.1 K6A.1.10 (2), a registered STOP condition: if >= 1 of 250 fresh
 *  calibration draws at the frozen kappa has positive null growth, STOP, investigate, do
 *  not run. The estimator is the one K6A.1.5 registers, verbatim:
 *
 *      g_null(S) = log kappa + (1 - kappa) * E[-log p | null, S]
 *
 *  This function screens ONE calibration draw S; aggregating over the 250+ draws is the
 *  caller's (the harness's) job, as is the null generator — the seeds and the sampler are
 *  supplied, never defaulted, so a screen reading is reproducible from what it reports.
 *  Measured for reference at the frozen configuration (K6A.1.5, not re-derived here):
 *  0/280 draws positive, per-draw mean -6.754e-2, max -1.501e-2, 4.30 sd below zero;
 *  for contrast, the prior K6E geometry at kappa* = 0.9126 read 48/250 POSITIVE. */
export declare function nullGrowthScreen(cal: EcdfAccumulatorCalibration, opts: NullGrowthScreenOptions): NullGrowthScreenResult;
//# sourceMappingURL=shape-ecdf-accumulator.d.ts.map