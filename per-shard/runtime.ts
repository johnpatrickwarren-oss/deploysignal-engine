// engine/per-shard/runtime.ts — Tessera SLICE 2b3: per-shard runtime composition.
//
// Composes the R03 state machine (observeSample) and R04 Welford accumulator
// (updateWelford) into a single pure-function update that threads accumulator
// state through PerShardResidual.welford_state across samples.
//
// Pure-function discipline (R03/R04 inherited): state in, state out, no mutation.
// The composition returns a NEW PerShardResidual per update; both input arguments
// are left unchanged. Internal calls to observeSample and updateWelford each
// preserve their own pure-function contracts.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close.

import type { PerShardResidual } from '../types/config';
import {
  observeSample,
  type SampleObservation,
} from './warm-start';
import {
  initialWelfordState,
  updateWelford,
  type WelfordState,
} from './welford';

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
export function updatePerShardResidual(
  current: PerShardResidual,
  obs: ExtendedSampleObservation,
): PerShardResidual {
  // 1. State-machine transition (observeSample takes only the SampleObservation parent shape).
  const stateTransition = observeSample(current, {
    observedAt: obs.observedAt,
    residualSeedHash: obs.residualSeedHash,
  });

  // 2. Accumulator lifecycle.
  // Replicate observeSample's seedChanged predicate (two-line duplication;
  // preserves observeSample's signature and the R03 SAS-2 module contract).
  const seedChanged =
    current.residual_seed_hash !== undefined &&
    current.residual_seed_hash !== obs.residualSeedHash;

  const accumulatorBase: WelfordState =
    seedChanged || current.welford_state === undefined
      ? initialWelfordState(obs.sampleVector.length)
      : current.welford_state;

  const newAccumulator = updateWelford(accumulatorBase, obs.sampleVector);

  // 3. Merge state-machine output with new accumulator.
  return {
    ...stateTransition,
    welford_state: newAccumulator,
  };
}
