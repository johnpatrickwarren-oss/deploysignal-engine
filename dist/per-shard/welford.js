"use strict";
// engine/per-shard/welford.ts — Tessera SLICE 2b2: Welford online statistics.
//
// Pure-function implementation of Welford's online algorithm for mean +
// covariance accumulation over a sequence of d-dimensional samples. Returns
// a NEW state per update; never mutates input.
//
// Algorithm (per Welford 1962; multivariate generalization per West 1979):
//   For each new sample x at step n:
//     mean_new ← mean_old + (x − mean_old) / n
//     M2_new   ← M2_old   + (x − mean_old) ⊗ (x − mean_new)
//   where ⊗ is the outer product on d-vectors yielding a d×d matrix.
//   Sample covariance emits as M2 / (n − 1) for n ≥ 2; undefined for n < 2.
//
// Numerical-stability advantage over naive two-pass (sum-of-squares minus
// square-of-sum): Welford avoids catastrophic cancellation when sample
// magnitudes are large relative to inter-sample variance — the regime PRD
// AC-P2 operates in (fleet-scale shard residuals where absolute magnitudes
// may shift but inter-sample variance stays moderate).
//
// R05 (SLICE 2b3) integrates this algorithm into PerShardResidual via
// engine/per-shard/runtime.ts (composition function updatePerShardResidual).
// Accumulator-strategy decision resolved at R05: option (a) — schema extension
// via PerShardResidual.welford_state? optional field. See Q-R05-SPEC.md.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the
// shared npm package at Tessera Phase 2 close alongside the vendored engine
// subset.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialWelfordState = initialWelfordState;
exports.updateWelford = updateWelford;
exports.welfordMean = welfordMean;
exports.welfordCovariance = welfordCovariance;
/** Initialize a Welford accumulator for d-dimensional samples.
 *  Returns { n: 0, mean: <d zeros>, m2: <d × d zeros> }. Throws if d < 1. */
function initialWelfordState(d) {
    if (d < 1) {
        throw new Error(`initialWelfordState: dimension must be >= 1, got ${d}`);
    }
    return {
        n: 0,
        mean: new Array(d).fill(0),
        m2: Array.from({ length: d }, () => new Array(d).fill(0)),
    };
}
/** Pure-function Welford update: state_new = state + sample.
 *  Returns a NEW WelfordState; does not mutate input state.
 *  Throws if sample.length !== state.mean.length (dimension mismatch). */
function updateWelford(state, sample) {
    const d = state.mean.length;
    if (sample.length !== d) {
        throw new Error(`updateWelford: dimension mismatch — state has dim ${d}, sample has dim ${sample.length}`);
    }
    const newN = state.n + 1;
    // mean_new[i] = mean_old[i] + (x[i] − mean_old[i]) / newN
    const deltaOld = new Array(d);
    const newMean = new Array(d);
    for (let i = 0; i < d; i++) {
        deltaOld[i] = sample[i] - state.mean[i];
        newMean[i] = state.mean[i] + deltaOld[i] / newN;
    }
    // M2_new[i][j] = M2_old[i][j] + (x[i] − mean_old[i]) * (x[j] − mean_new[j])
    const newM2 = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < d; i++) {
        const deltaNewJ_factor_i = deltaOld[i]; // (x[i] − mean_old[i])
        for (let j = 0; j < d; j++) {
            const deltaNewJ = sample[j] - newMean[j];
            newM2[i][j] = state.m2[i][j] + deltaNewJ_factor_i * deltaNewJ;
        }
    }
    return { n: newN, mean: newMean, m2: newM2 };
}
/** Returns the running mean as a defensive copy.
 *  Defensive copy prevents caller from mutating the WelfordState's internal mean. */
function welfordMean(state) {
    return [...state.mean];
}
/** Returns the sample covariance matrix M2 / (n − 1) for n ≥ 2.
 *  Returns null for n < 2 (covariance undefined with insufficient samples).
 *  Returns a defensive deep copy. */
function welfordCovariance(state) {
    if (state.n < 2) {
        return null;
    }
    const d = state.mean.length;
    const divisor = state.n - 1;
    const cov = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
            cov[i][j] = state.m2[i][j] / divisor;
        }
    }
    return cov;
}
//# sourceMappingURL=welford.js.map