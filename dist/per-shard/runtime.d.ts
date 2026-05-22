import type { PerShardResidual, BaselineCellEntry } from '../types/config';
import { type SampleObservation } from './warm-start';
/** R05 extension of the R03 SampleObservation surface — adds the d-dimensional
 *  sample vector that the Welford accumulator consumes. Backward-compatible:
 *  the SampleObservation parent shape (observedAt + residualSeedHash) is
 *  unchanged; ExtendedSampleObservation refines it with the sampleVector field.
 *
 *  Dimensionality d is established by the first sample under a given baseline
 *  (residual_seed_hash). Subsequent samples MUST match that dimensionality or
 *  updateWelford throws (per R04 AC-10). Baseline-refresh (seed_hash change)
 *  resets the accumulator, after which the new sample's dimensionality establishes
 *  d afresh. */
export interface ExtendedSampleObservation extends SampleObservation {
    /** d-dimensional sample vector consumed by the Welford recurrence at this
     *  (shard, cell). Length d is fixed across samples within a single baseline
     *  window; mismatch with the accumulator's existing dimensionality under a
     *  stable seed propagates updateWelford's throw. */
    sampleVector: number[];
}
/** Pure-function per-shard runtime update: composes observeSample (R03 state
 *  machine: n_samples, confidence, residual_seed_hash, last_observed_at) and
 *  updateWelford (R04 algorithm: n, mean, m2 accumulation).
 *
 *  Behavior:
 *    1. State-machine transition via observeSample (passes only the metadata
 *       fields observedAt + residualSeedHash; sampleVector is NOT consumed by
 *       observeSample per R03 contract).
 *    2. Accumulator lifecycle (mirrors observeSample's reset / increment branch):
 *       - On seedChanged (current.residual_seed_hash defined AND differs from
 *         obs.residualSeedHash): reset — initialize fresh accumulator at
 *         d = obs.sampleVector.length, then apply the first sample.
 *       - On absent current.welford_state (cold-start; n_samples === 0 at the
 *         input OR a malformed prior state): initialize fresh and apply.
 *       - Otherwise (stable seed AND accumulator present): apply updateWelford
 *         to the existing accumulator.
 *    3. Output: { ...stateTransition, welford_state: newAccumulator }.
 *
 *  Returned residual is a NEW object; current is not mutated. Safe under shared
 *  reference semantics. Throws on dimension mismatch (propagated from updateWelford)
 *  per R04 AC-10 / R05 AC-6.
 */
export declare function updatePerShardResidual(current: PerShardResidual, obs: ExtendedSampleObservation, baselineCell?: BaselineCellEntry): PerShardResidual;
/** R10 (SLICE 2b4) + R14 (SLICE 2 carry-forwards) — pure helper that enforces the
 *  R02 sparse-encoding convention at the per-shard runtime's emission boundary.
 *
 *  Strict-tier: atomically populates mean_vector AND covariance from welford_state
 *  when welfordCovariance returns non-null (n >= 2). Both absent when gate fails.
 *
 *  Warm-start tier (R14): emits mean_delta = welfordMean(welford_state) -
 *  baselineCell.family_C.mean_vector when baselineCell is provided and lengths match.
 *  mean_delta is absent when baselineCell is not provided or has no family_C.mean_vector.
 *
 *  All other tiers: mean_vector, covariance, AND mean_delta all absent (inverse-
 *  convention enforcement; keys ABSENT not present-with-undefined).
 *
 *  welford_state is carried through unchanged (not subject to the sparse-encoding
 *  convention; present whenever n_samples >= 1 regardless of tier).
 *
 *  Pure function: no mutation of input residual; returns a new object.
 */
export declare function projectTierGatedOutputs(residual: PerShardResidual, baselineCell?: BaselineCellEntry): PerShardResidual;
//# sourceMappingURL=runtime.d.ts.map