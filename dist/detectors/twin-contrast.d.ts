import type { ValidityEnvelope } from './validity-envelope';
import { type PairedBetState } from './_paired-bet';
export type TwinMetricKind = 'rate' | 'sign';
export interface TwinMetricSpec {
    /** Free-form metric name; the gate keys observations by it. */
    id: string;
    kind: TwinMetricKind;
    /** Which direction of the metric is a regression. For 'rate', 'lower' means the events are
     *  successes and the bad events are total − events. */
    worse: 'higher' | 'lower';
    /** Smallest regression worth blocking on; sets the PROCEED test only, never rollback.
     *  rate: excess odds ratio ρ in (0, 10] (0.2 = 20% more bad events per request).
     *  sign: excess probability τ in (0, 0.5) that the canary's tick is worse (0.1 = 60% of ticks). */
    tolerance: number;
}
export interface RateObservation {
    canaryEvents: number;
    canaryTotal: number;
    controlEvents: number;
    controlTotal: number;
}
export interface SignObservation {
    canary: number;
    control: number;
}
export type TwinObservation = RateObservation | SignObservation;
export interface TwinScore {
    x: number;
    rollbackNull: number;
    proceedNull: number;
}
export interface TwinMetricState {
    rollback: PairedBetState;
    proceed: PairedBetState;
    used: number;
    skipped: number;
    ties: number;
    missing: number;
}
export interface TwinMetricEvidence {
    rollbackE: number;
    proceedE: number;
    used: number;
    skipped: number;
    ties: number;
    missing: number;
}
export declare function checkTwinMetricSpec(spec: TwinMetricSpec): void;
/** Mean of Fisher's noncentral hypergeometric: X = canary's count of `total` events over arms of
 *  nc and nk requests, odds ratio psi. Weights by the ratio recurrence, in the log domain. The
 *  running maximum is tracked inside the recurrence loop rather than via `Math.max(...logW)`,
 *  which spreads the whole support onto the call stack and overflows it once the support exceeds
 *  the engine's argument-count limit (observed at N ≈ 5e5 requests per tick with E ≈ N/2). */
export declare function fisherNoncentralMean(nc: number, nk: number, total: number, psi: number): number;
export declare function twinScore(spec: TwinMetricSpec, obs: TwinObservation): TwinScore | 'skip' | 'tie' | 'missing';
export declare function initTwinMetric(): TwinMetricState;
export declare function skipTwinMetric(state: TwinMetricState): TwinMetricState;
/** A tick whose observation is missing (outcome-dependent or not) gets a ½ wealth factor on BOTH
 *  sides rather than being skipped. Every attainable paired-bet factor is ≥ 1/2 (λ ≤ ½/(m − lo)
 *  caps the factor 1 + λ(x − m) from below at 1 − λmax(m − lo) = 1/2 over x ∈ [lo, hi]), so a ½
 *  factor is dominated by whatever factor the true, unobserved value would have produced. Both
 *  Ville bounds therefore hold under ANY missingness mechanism, including one that depends on the
 *  unobserved outcome itself (ADR 0036) — no missing-at-random premise is needed. */
export declare function missTwinMetric(state: TwinMetricState): TwinMetricState;
export declare function updateTwinMetric(spec: TwinMetricSpec, state: TwinMetricState, obs: TwinObservation): TwinMetricState;
export declare function twinMetricEvidence(state: TwinMetricState): TwinMetricEvidence;
/** ADR 0036 — rate kind. */
export declare const TWIN_RATE_ENVELOPE: Readonly<ValidityEnvelope>;
/** ADR 0036 — sign kind. */
export declare const TWIN_SIGN_ENVELOPE: Readonly<ValidityEnvelope>;
//# sourceMappingURL=twin-contrast.d.ts.map