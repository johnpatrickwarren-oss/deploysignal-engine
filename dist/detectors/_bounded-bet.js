"use strict";
// detectors/_bounded-bet.ts — the increment family: the Gaussian-LR mixture increment and the
// distribution-robust linear bounded bet g_λ(r) = 1 + λ·clip(r, ±B)/B.
//
// Moved out of fleet/calibration-monitor.ts on 2026-09-23 (ADR 0033, the library boundary): the
// e-SR detector (detectors/e-sr-mean-shift.ts) took its λ grid and wealth factor from the fleet
// layer, an upward import. The constants and the function are verbatim; the monitor imports and
// re-exports them, so its callers see no change.
Object.defineProperty(exports, "__esModule", { value: true });
exports.G_CAP = exports.BOUND_LAMBDAS = exports.BOUND_CLIP = void 0;
exports.gBounded = gBounded;
exports.gInc = gInc;
/** Clip bound for the bounded-bet increment (residual σ-units). Same B as the Family A betting
 *  path's BOUNDED_SCALE_B (detectors/betting-e-process.ts). */
exports.BOUND_CLIP = 3;
/** Linear-bet grid: |λ| < 1 keeps every wealth factor strictly positive. */
exports.BOUND_LAMBDAS = [0.1, 0.3, 0.6, 0.9, -0.1, -0.3, -0.6, -0.9];
/** Distribution-robust linear bounded-bet wealth factor g_λ(r) = 1 + λ·c/B, c = clip(r, ±B).
 *  E[g_λ | F] = 1 exactly whenever the clipped residual is conditionally mean-zero — any tail, any
 *  standardizing-scale error. The one surviving nuisance is the CENTER, which is what the monitor
 *  tests best. */
function gBounded(r, lam) {
    const c = r > exports.BOUND_CLIP ? exports.BOUND_CLIP : r < -exports.BOUND_CLIP ? -exports.BOUND_CLIP : r;
    return 1 + (lam * c) / exports.BOUND_CLIP;
}
// ── The Gaussian-LR mixture increment (moved here from fleet/calibration-monitor.ts, ADR 0034) ──
const LAMBDAS = [0.5, 1, 2, -0.5, -1, -2];
/** Cap on the per-tick Gaussian increment: E[min(g, cap)] ≤ E[g] = 1 (conservative). */
exports.G_CAP = 100;
/** Gaussian-LR mixture increment, capped. E[g | N(0,1)] ≤ 1 by construction. Validity needs the
 *  residual to be genuinely N(0,1): a 10% under-estimate of the standardizing scale moves the null
 *  mean from ~0.5 to ~7.6 (Tessera audit F7, measured), and heavy tails break E ≤ 1 outright. */
function gInc(r) {
    let s = 0;
    for (const lam of LAMBDAS)
        s += Math.exp(lam * r - 0.5 * lam * lam);
    return Math.min(exports.G_CAP, s / LAMBDAS.length);
}
//# sourceMappingURL=_bounded-bet.js.map