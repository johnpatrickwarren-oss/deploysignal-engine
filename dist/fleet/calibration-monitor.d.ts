import { BOUND_CLIP, BOUND_LAMBDAS, gBounded, gInc, G_CAP, type IncrementKind } from '../detectors/_bounded-bet';
export { BOUND_CLIP, BOUND_LAMBDAS, gBounded, gInc, G_CAP, type IncrementKind };
export interface CalibrationMonitorOptions {
    /** Anytime-valid level: revoke when W ≥ 1/alpha. Default 0.01 — the false-revocation
     *  probability over ALL time is ≤ 1%. */
    alpha?: number;
    /** Which increment family to test (match the emitter). Default 'bounded'. Ignored when a custom
     *  `increment` is supplied. */
    incrementKind?: IncrementKind;
    /** A custom emitter increment under test (E[g|H0] ≤ 1) — single-product path. */
    increment?: (r: number) => number;
}
export interface CalibrationMonitorState {
    /** log of the calibration test martingale W. For the bounded kind, the log of the AVERAGE of
     *  the per-λ capitals. */
    logW: number;
    /** per-λ log-capitals (bounded kind only; null for gaussian/custom). */
    logWByLambda: number[] | null;
    /** running max of logW — the evidence-so-far e-value is exp(peakLogW). */
    peakLogW: number;
    /** believed-null residuals ingested. */
    ticks: number;
    /** false once revoked — STICKY. Anytime-valid evidence does not un-accumulate. */
    passing: boolean;
    /** log(1/alpha). */
    threshold: number;
    /** the increment under test (single-product path; placeholder for bounded). */
    increment: (r: number) => number;
}
export declare function freshCalibrationMonitor(opts?: CalibrationMonitorOptions): CalibrationMonitorState;
/** Ingest ONE believed-null residual; revoke (sticky) if W has ever crossed 1/alpha. Mutates and
 *  returns the state. */
export declare function updateCalibration(state: CalibrationMonitorState, r: number): CalibrationMonitorState;
export declare function updateCalibrationBatch(state: CalibrationMonitorState, rs: ReadonlyArray<number>): CalibrationMonitorState;
export interface CalibrationVerdict {
    passing: boolean;
    ticks: number;
    /** evidence-so-far against calibration as an e-value (exp of the running-max log martingale).
     *  NOTE: the running max is a valid ANYTIME P-VALUE's reciprocal (ramdas-2023 §2.7), not itself
     *  an e-process (§2.4); it is reported as the monitor's evidence, not merged anywhere. */
    eValue: number;
    /** the 1/alpha e-value at which the monitor revokes. */
    revokeAt: number;
}
/** The monitor's verdict (does NOT mutate). */
export declare function calibrationVerdict(state: CalibrationMonitorState): CalibrationVerdict;
/** Run the monitor over believed-null REFERENCE residuals — the CALLER owns choosing a genuinely
 *  null feed — and return the contract with `calibrationMonitorPassing` set. Several streams (one
 *  per control shard) are pooled into one martingale in order. */
export declare function applyCalibrationMonitor<C extends object>(contract: C, referenceNullResiduals: ReadonlyArray<number> | ReadonlyArray<ReadonlyArray<number>>, opts?: CalibrationMonitorOptions): {
    contract: C & {
        calibrationMonitorPassing: boolean;
    };
    monitor: CalibrationMonitorState;
    verdict: CalibrationVerdict;
};
export interface IncrementEstimatorState {
    /** increments ingested. */
    n: number;
    /** Welford running mean of exp(Δ log M). */
    mean: number;
    /** Welford running sum of squared deviations. */
    m2: number;
    /** running max of exp(Δ log M) — the heavy-tail tell: if this dominates the mean, the mean is
     *  understated and the interval below is not trustworthy. */
    max: number;
}
export declare function freshIncrementEstimator(): IncrementEstimatorState;
/** Ingest one LOG-increment Δ log M_t from a detector evaluated on a believed-null stream (the
 *  `evidence.log_increment` field of a wealth detector's verdict). Non-finite increments are
 *  skipped — a NaN or ±∞ carries no estimable evidence (detectors/_wealth.ts holds wealth on them
 *  for the same reason). Mutates and returns. */
export declare function updateIncrementEstimator(state: IncrementEstimatorState, logIncrement: number): IncrementEstimatorState;
export interface IncrementEstimate {
    n: number;
    /** sample mean of exp(Δ log M) — the marginal E[e_t] estimate. */
    mean: number;
    /** sample sd of exp(Δ log M). */
    sd: number;
    /** normal-theory 95% lower bound, mean − 1.96·sd/√n. NaN when n < 2. */
    lower95: number;
    /** normal-theory 95% upper bound. NaN when n < 2. */
    upper95: number;
    /** true iff lower95 > 1: the marginal increment mean exceeds 1 at 95%, which REFUTES the e-value
     *  premise on this stream. false establishes NOTHING (marginal ≤ 1 does not imply conditional
     *  ≤ 1; a heavy-tailed increment understates its own mean). */
    refutedAboveOne: boolean;
    /** max/mean — a heavy-tail diagnostic; large values mean the interval is optimistic. */
    maxToMean: number;
}
/** The estimate (does NOT mutate). */
export declare function incrementEstimate(state: IncrementEstimatorState): IncrementEstimate;
//# sourceMappingURL=calibration-monitor.d.ts.map