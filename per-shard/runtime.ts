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
  welfordMean,
  welfordCovariance,
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
  const merged: PerShardResidual = {
    ...stateTransition,
    welford_state: newAccumulator,
  };

  // 4. R10 (SLICE 2b4) emission + sparse-encoding inverse-convention enforcement.
  return projectTierGatedOutputs(merged);
}

/** R10 (SLICE 2b4) — pure helper that enforces the R02 sparse-encoding convention
 *  at the per-shard runtime's emission boundary. Atomically populates mean_vector
 *  AND covariance at strict tier (when welford_state has accumulated enough samples
 *  for a valid covariance, i.e., welfordCovariance returns non-null) and explicitly
 *  omits both fields at all other tiers.
 *
 *  Gate criterion (all three clauses required for emission):
 *    1. residual.confidence === 'strict'
 *    2. residual.welford_state !== undefined
 *    3. welfordCovariance(residual.welford_state) !== null  (i.e., welford_state.n >= 2)
 *
 *  When the gate fires: emit mean_vector = welfordMean(state) AND covariance = (the
 *  non-null welfordCovariance return), overriding any stale spread of those fields
 *  from the input residual.
 *
 *  When the gate does NOT fire (non-strict tier OR strict-with-insufficient-welford):
 *  return the input residual with mean_vector and covariance keys destructured-out
 *  (keys ABSENT, not present-with-undefined). This strips any stale spread of those
 *  fields from a malformed input.
 *
 *  mean_delta is untouched (R11+ scope per R10-SAS-4 + R10-SAS-5); the helper carries
 *  it through unchanged via the `...rest` spread.
 *
 *  welford_state is untouched (the helper reads it at strict tier to derive emission
 *  values but does not modify or remove it on the output).
 *
 *  Pure function: no mutation of input residual; returns a new object (the destructure-
 *  spread always constructs a fresh object literal).
 */
export function projectTierGatedOutputs(
  residual: PerShardResidual,
): PerShardResidual {
  // Destructure mean_vector and covariance OUT of the input. `rest` contains everything
  // else, including welford_state, mean_delta, and the state-machine fields. This is the
  // sparse-encoding inverse-convention enforcement at non-strict tiers.
  const { mean_vector: _omitMv, covariance: _omitCov, ...rest } = residual;

  // Strict-tier atomic emission gate.
  if (
    residual.confidence === 'strict' &&
    residual.welford_state !== undefined
  ) {
    const cov = welfordCovariance(residual.welford_state);
    if (cov !== null) {
      return {
        ...rest,
        mean_vector: welfordMean(residual.welford_state),
        covariance: cov,
      };
    }
  }

  // Non-strict OR strict-but-insufficient: emit without mean_vector / covariance.
  return rest;
}
