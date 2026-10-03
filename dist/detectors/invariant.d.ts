import { type PairedBetState } from './_paired-bet';
export interface InvariantSpec {
    id: string;
    /** Declared ceiling on the mean unaccounted fraction under health, in (0, 1): the measurement's
     *  own boundary noise (for a one-minute ALB window, in-flight requests over requests per minute). */
    tolerance: number;
    alpha: number;
    /** Upper clamp on the scored fraction, in (tolerance, 1]; default min(1, 10 · tolerance). Clamping
     *  x down to it keeps H0 (E[min(x, c)] ≤ E[x] ≤ tolerance) and sets the bet's range: at hi = 1 the
     *  GRAPA shrinkage pseudo-observation (((hi − lo)/4)² = 1/16) swamps fractions of order 1e-3 and the
     *  bet has no power inside a bake (found at the first test, 0 of 200 at 2.5× the tolerance). */
    ceiling?: number;
}
export interface InvariantObservation {
    total: number;
    accounted: number;
}
export interface InvariantState {
    bet: PairedBetState;
    used: number;
    skipped: number;
    missing: number;
    fired: boolean;
    firedAt: number | null;
}
export interface InvariantStep {
    state: InvariantState;
    x: number | null;
    wealth: number;
    threshold: number;
    fire: boolean;
}
export declare function checkInvariantSpec(spec: InvariantSpec): void;
export declare function invariantCeiling(spec: InvariantSpec): number;
export declare function initInvariant(spec: InvariantSpec): InvariantState;
/** One tick. total = 0 is a skip (nothing routed); a non-finite count is missing (counted, not
 *  scored — the ½-penalty question of ADR 0036 does not arise, since an invariant has no proceed
 *  side to protect). Counts need not be integers: CloudWatch sums are. A negative discrepancy
 *  (more accounted than routed, in-flight from the previous window) clamps to 0; above the ceiling clamps to it. */
export declare function stepInvariant(spec: InvariantSpec, state: InvariantState, obs: InvariantObservation): InvariantStep;
//# sourceMappingURL=invariant.d.ts.map