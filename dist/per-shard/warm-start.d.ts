import type { PerShardResidual } from '../types/config';
/** Sample count at which a 'none'-tier residual transitions to 'warm_start'.
 *  Per PRD AC-P2 + SCOPING-MEMO § 2.2: alerts enable at n ≥ 20. */
export declare const WARM_START_THRESHOLD = 20;
/** Sample count at which a residual transitions to 'strict'.
 *  Per PRD AC-P2: strict-upgrade at n ≥ 60 preserves inherited single-instance
 *  behavior. A residual with current confidence === 'none' jumping directly past
 *  the warm_start threshold (e.g., n_samples preserved at 80 from a stable seed
 *  but with old confidence === 'none') also transitions directly to 'strict' —
 *  see § P3.1 corner case for cold-start-direct-to-strict. */
export declare const STRICT_UPGRADE_THRESHOLD = 60;
/** Minimal per-sample observation packet consumed by the state machine.
 *  Carries metadata only; sample numeric values are SLICE 2b2 scope. */
export interface SampleObservation {
    /** Unix epoch milliseconds when the sample was observed. */
    observedAt: number;
    /** Opaque identifier of the fleet-aggregate baseline this sample's
     *  residual will be computed against. Mismatch with the residual's
     *  cached residual_seed_hash triggers reset (baseline-refresh invalidation). */
    residualSeedHash: string;
}
/** Cold-start initializer — returns an empty PerShardResidual at confidence='none'.
 *  Use this when allocating a new (shard, cell) entry that has not yet observed
 *  any samples. */
export declare function initialPerShardResidual(): PerShardResidual;
/**
 * Pure-function state-machine transition for PerShardResidual when a new sample
 * is observed at the (shard, cell).
 *
 * Behavior:
 *   1. Baseline-refresh detection: if current.residual_seed_hash is defined AND
 *      differs from obs.residualSeedHash, the residual is reset (n_samples=1,
 *      confidence='none', statistical fields cleared, new seed adopted, timestamp
 *      adopted). First-time seed assignment (current.residual_seed_hash undefined)
 *      is NOT a reset — the residual adopts the seed via the normal increment path.
 *
 *   2. Normal increment: n_samples += 1; confidence transitions per thresholds
 *      (newN ≥ STRICT_UPGRADE_THRESHOLD → 'strict'; newN ≥ WARM_START_THRESHOLD →
 *      'warm_start'; else → 'none'); residual_seed_hash + last_observed_at refreshed
 *      from obs; statistical fields (mean_vector, covariance, mean_delta) preserved
 *      verbatim from current (NOT recomputed at SLICE 2b1; R04 layers Welford on top).
 *
 *   3. Terminal-state preservation: once confidence === 'strict', subsequent samples
 *      (under stable seed) keep confidence at 'strict'; the threshold ladder is
 *      monotone in n_samples and 'strict' is the terminal tier emitted by the state
 *      machine. ('pooled' and 'aggregate' are L3-pooling outputs on the fleet-aggregate
 *      baseline, not state-machine outputs on the per-shard residual — see § Open
 *      questions OQ-1.)
 *
 * Returned residual is a NEW object; current is not mutated. Safe to use under shared
 * reference semantics.
 */
export declare function observeSample(current: PerShardResidual, obs: SampleObservation): PerShardResidual;
//# sourceMappingURL=warm-start.d.ts.map