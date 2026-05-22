"use strict";
// engine/per-shard/warm-start.ts — Tessera SLICE 2b1: per-shard confidence-tier state machine.
//
// Pure-function transitions for the (n_samples, confidence) state machine on
// PerShardResidual entries. Does NOT compute mean_delta / mean_vector / covariance —
// statistical-residual computation is SLICE 2b2 (R04) scope.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close alongside the vendored engine subset.
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRICT_UPGRADE_THRESHOLD = exports.WARM_START_THRESHOLD = void 0;
exports.initialPerShardResidual = initialPerShardResidual;
exports.observeSample = observeSample;
/** Sample count at which a 'none'-tier residual transitions to 'warm_start'.
 *  Per PRD AC-P2 + SCOPING-MEMO § 2.2: alerts enable at n ≥ 20. */
exports.WARM_START_THRESHOLD = 20;
/** Sample count at which a residual transitions to 'strict'.
 *  Per PRD AC-P2: strict-upgrade at n ≥ 60 preserves inherited single-instance
 *  behavior. A residual with current confidence === 'none' jumping directly past
 *  the warm_start threshold (e.g., n_samples preserved at 80 from a stable seed
 *  but with old confidence === 'none') also transitions directly to 'strict' —
 *  see § P3.1 corner case for cold-start-direct-to-strict. */
exports.STRICT_UPGRADE_THRESHOLD = 60;
/** Cold-start initializer — returns an empty PerShardResidual at confidence='none'.
 *  Use this when allocating a new (shard, cell) entry that has not yet observed
 *  any samples. */
function initialPerShardResidual() {
    return { n_samples: 0, confidence: 'none' };
}
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
function observeSample(current, obs) {
    const seedChanged = current.residual_seed_hash !== undefined &&
        current.residual_seed_hash !== obs.residualSeedHash;
    if (seedChanged) {
        // Reset: discard accumulated state. The new sample counts as the first under
        // the new seed (n=1, not n=0); confidence='none' regardless of what it was.
        return {
            n_samples: 1,
            confidence: 'none',
            residual_seed_hash: obs.residualSeedHash,
            last_observed_at: obs.observedAt,
            // mean_vector / covariance / mean_delta intentionally absent (object spread
            // would copy from current; explicit construction omits them).
        };
    }
    const newN = current.n_samples + 1;
    const newConfidence = newN >= exports.STRICT_UPGRADE_THRESHOLD ? 'strict'
        : newN >= exports.WARM_START_THRESHOLD ? 'warm_start'
            : 'none';
    return {
        ...current,
        n_samples: newN,
        confidence: newConfidence,
        residual_seed_hash: obs.residualSeedHash,
        last_observed_at: obs.observedAt,
    };
}
//# sourceMappingURL=warm-start.js.map