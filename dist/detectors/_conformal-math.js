"use strict";
// engine/detectors/_conformal-math.ts — pure math primitives for Family E
// conformal novelty, extracted verbatim from conformal.ts to keep that file
// focused on the detector dispatch/state machinery.
//
// These are leaf functions: they depend only on linear-algebra helpers in
// `./_linalg` and must never import from `./conformal` (no cycle).
Object.defineProperty(exports, "__esModule", { value: true });
exports.mahalanobisDistance = mahalanobisDistance;
exports.relativeDeviation = relativeDeviation;
exports.conformalPValue = conformalPValue;
const _linalg_1 = require("./_linalg");
/** Mahalanobis distance √(r^T Σ⁻¹ r). Returns null if Σ is not PD.
 *  Exported so the compiler can precompute calibration scores with the
 *  same scoring function the detector uses at query time. */
function mahalanobisDistance(r, covariance) {
    const L = (0, _linalg_1.cholesky)(covariance);
    if (!L)
        return null;
    const y = (0, _linalg_1.forwardSolve)(L, r);
    let sum = 0;
    for (const v of y)
        sum += v * v;
    return Math.sqrt(sum);
}
/** Relative-deviation vector (x − μ) ./ μ, matching Family C's
 *  standardization. Falls back to additive (x − μ) when μ_i ≈ 0. */
function relativeDeviation(x, mean) {
    const p = mean.length;
    const r = new Array(p);
    for (let i = 0; i < p; i++) {
        const m = mean[i];
        r[i] = Math.abs(m) > 1e-12 ? (x[i] - m) / m : (x[i] - m);
    }
    return r;
}
/** Conformal p-value: (#{ s_c ≥ s_query } + 1) / (n_calibration + 1).
 *  `+1` in numerator and denominator makes this a valid (exchangeable)
 *  p-value even on exact ties. */
function conformalPValue(queryScore, calibrationScores) {
    if (calibrationScores.length === 0)
        return 1.0;
    let atLeast = 0;
    for (const s of calibrationScores)
        if (s >= queryScore)
            atLeast++;
    return (atLeast + 1) / (calibrationScores.length + 1);
}
//# sourceMappingURL=_conformal-math.js.map