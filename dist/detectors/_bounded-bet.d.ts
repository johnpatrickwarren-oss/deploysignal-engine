/** Clip bound for the bounded-bet increment (residual σ-units). Same B as the Family A betting
 *  path's BOUNDED_SCALE_B (detectors/betting-e-process.ts). */
export declare const BOUND_CLIP = 3;
/** Linear-bet grid: |λ| < 1 keeps every wealth factor strictly positive. */
export declare const BOUND_LAMBDAS: number[];
/** Distribution-robust linear bounded-bet wealth factor g_λ(r) = 1 + λ·c/B, c = clip(r, ±B).
 *  E[g_λ | F] = 1 exactly whenever the clipped residual is conditionally mean-zero — any tail, any
 *  standardizing-scale error. The one surviving nuisance is the CENTER, which is what the monitor
 *  tests best. */
export declare function gBounded(r: number, lam: number): number;
//# sourceMappingURL=_bounded-bet.d.ts.map