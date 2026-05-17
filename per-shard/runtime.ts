// engine/per-shard/runtime.ts — Tessera SLICE 2b3 + SLICE 2b4 + SLICE 2 carry-forwards:
// per-shard runtime composition.
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
// R10 (SLICE 2b4): also exports projectTierGatedOutputs, which enforces the R02
// sparse-encoding inverse-convention at the emission boundary. Strict-tier atomically
// populates mean_vector + covariance from welford_state when welfordCovariance
// returns non-null (n ≥ 2). All other tiers emit without these fields (keys ABSENT,
// not present-with-undefined). Per-shard R10 spec: REVIEWER-REPORT-R10.md.
//
// R14 (SLICE 2 carry-forwards): updatePerShardResidual and projectTierGatedOutputs
// each accept an optional baselineCell: BaselineCellEntry | undefined argument.
// Warm-start tier emits mean_delta = welfordMean(welford_state) −
// baselineCell.family_C.mean_vector when baselineCell is provided and the
// mean_vector lengths match. mean_delta is absent when baselineCell is absent or
// has no usable family_C.mean_vector. Per-shard R14 spec: REVIEWER-REPORT-R14.md.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close.

import type { PerShardResidual, BaselineCellEntry } from '../types/config';
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
  baselineCell?: BaselineCellEntry,
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

  // 4. R10/R14 emission + sparse-encoding inverse-convention enforcement.
  return projectTierGatedOutputs(merged, baselineCell);
}

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
export function projectTierGatedOutputs(
  residual: PerShardResidual,
  baselineCell?: BaselineCellEntry,
): PerShardResidual {
  // Destructure mean_vector, covariance, AND mean_delta OUT of the input.
  // This enforces the sparse-encoding inverse-convention for all three fields:
  // they are only re-added below at the tiers where the convention permits them.
  // R14 (SLICE 2 carry-forward) extends the R10 two-field destructure to three.
  const { mean_vector: _omitMv, covariance: _omitCov, mean_delta: _omitMd, ...rest } = residual;

  // Strict-tier atomic emission gate (R10 behavior unchanged).
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
        // mean_delta intentionally absent at strict tier (inverse-convention)
      };
    }
  }

  // Warm-start tier: emit mean_delta when baselineCell provides a usable mean.
  if (
    residual.confidence === 'warm_start' &&
    residual.welford_state !== undefined &&
    baselineCell?.family_C?.mean_vector !== undefined
  ) {
    const perShardMean = welfordMean(residual.welford_state);
    const baselineMean = baselineCell.family_C.mean_vector;
    if (perShardMean.length === baselineMean.length) {
      return {
        ...rest,
        mean_delta: perShardMean.map((v, i) => v - baselineMean[i]),
      };
    }
  }

  // All other cases (non-warm_start non-strict, or warm_start without usable baselineCell):
  // emit without mean_vector / covariance / mean_delta.
  return rest;
}
