"use strict";
// engine/detectors/_hotelling-core.ts — Family C Hotelling T² core math.
//
// Split out of `hotelling.ts` (god-file decomposition). Internals moved
// VERBATIM; `hotelling.ts` re-exports `chiSquareQuantile` and
// `hotellingT2` so the public import surface is unchanged.
Object.defineProperty(exports, "__esModule", { value: true });
exports.chiSquareQuantile = chiSquareQuantile;
exports.hotellingT2 = hotellingT2;
const _linalg_1 = require("./_linalg");
/** Rational approximation to Φ⁻¹ (inverse standard normal CDF). Beasley-
 *  Springer-Moro, 1995 — sufficient accuracy for our purposes (err
 *  < 1e-7 in the tails we care about). */
function invStdNormalCDF(p) {
    if (p <= 0)
        return -Infinity;
    if (p >= 1)
        return Infinity;
    // Split at 0.5 to keep the approximation in one tail.
    const q = p < 0.5 ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(q));
    // Coefficients from Abramowitz & Stegun 26.2.23
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    const num = c0 + c1 * t + c2 * t * t;
    const den = 1 + d1 * t + d2 * t * t + d3 * t * t * t;
    const z = t - num / den;
    return p < 0.5 ? -z : z;
}
/** Wilson-Hilferty χ² quantile: χ²(q, k) ≈ k·(1 − 2/(9k) + z·√(2/(9k)))³
 *  where z = Φ⁻¹(q). Good to ~1% in the right tail for k ≳ 5. */
function chiSquareQuantile(q, k) {
    const z = invStdNormalCDF(q);
    const a = 1 - 2 / (9 * k);
    const b = z * Math.sqrt(2 / (9 * k));
    const root = a + b;
    return k * root * root * root;
}
/** Compute T² = r^T Σ⁻¹ r via Cholesky. Returns null if Σ is not PSD. */
function hotellingT2(r, covariance) {
    const L = (0, _linalg_1.cholesky)(covariance);
    if (!L)
        return null;
    // Σ⁻¹ = (L L^T)⁻¹ = L^-T L^-1 ; r^T Σ⁻¹ r = ||L⁻¹ r||².
    const y = (0, _linalg_1.forwardSolve)(L, r);
    let sum = 0;
    for (const v of y)
        sum += v * v;
    return sum;
}
//# sourceMappingURL=_hotelling-core.js.map