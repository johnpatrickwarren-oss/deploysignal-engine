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
/** Cap on the per-tick Gaussian increment: E[min(g, cap)] ≤ E[g] = 1 (conservative). */
export declare const G_CAP = 100;
/** Gaussian-LR mixture increment, capped. E[g | N(0,1)] ≤ 1 by construction. Validity needs the
 *  residual to be genuinely N(0,1): a 10% under-estimate of the standardizing scale moves the null
 *  mean from ~0.5 to ~7.6 (Tessera audit F7, measured), and heavy tails break E ≤ 1 outright. */
export declare function gInc(r: number): number;
/** 'gaussian' = gInc (max power, needs a genuinely N(0,1) residual); 'bounded' = linear bounded
 *  bets (distribution-robust; the FDR-bearing default in Tessera). */
export type IncrementKind = 'gaussian' | 'bounded';
//# sourceMappingURL=_bounded-bet.d.ts.map