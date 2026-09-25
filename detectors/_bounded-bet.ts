// detectors/_bounded-bet.ts — the increment family: the Gaussian-LR mixture increment and the
// distribution-robust linear bounded bet g_λ(r) = 1 + λ·clip(r, ±B)/B.
//
// Moved out of fleet/calibration-monitor.ts on 2026-09-23 (ADR 0033, the library boundary): the
// e-SR detector (detectors/e-sr-mean-shift.ts) took its λ grid and wealth factor from the fleet
// layer, an upward import. The constants and the function are verbatim; the monitor imports and
// re-exports them, so its callers see no change.

/** Clip bound for the bounded-bet increment (residual σ-units). Same B as the Family A betting
 *  path's BOUNDED_SCALE_B (detectors/betting-e-process.ts). */
export const BOUND_CLIP = 3;
/** Linear-bet grid: |λ| < 1 keeps every wealth factor strictly positive. */
export const BOUND_LAMBDAS = [0.1, 0.3, 0.6, 0.9, -0.1, -0.3, -0.6, -0.9];

/** Distribution-robust linear bounded-bet wealth factor g_λ(r) = 1 + λ·c/B, c = clip(r, ±B).
 *  E[g_λ | F] = 1 exactly whenever the clipped residual is conditionally mean-zero — any tail, any
 *  standardizing-scale error. The one surviving nuisance is the CENTER, which is what the monitor
 *  tests best. */
export function gBounded(r: number, lam: number): number {
  const c = r > BOUND_CLIP ? BOUND_CLIP : r < -BOUND_CLIP ? -BOUND_CLIP : r;
  return 1 + (lam * c) / BOUND_CLIP;
}

// ── The Gaussian-LR mixture increment (moved here from fleet/calibration-monitor.ts, ADR 0034) ──

const LAMBDAS = [0.5, 1, 2, -0.5, -1, -2];
/** Cap on the per-tick Gaussian increment: E[min(g, cap)] ≤ E[g] = 1 (conservative). */
export const G_CAP = 100;

/** Gaussian-LR mixture increment, capped. E[g | N(0,1)] ≤ 1 by construction. Validity needs the
 *  residual to be genuinely N(0,1): a 10% under-estimate of the standardizing scale moves the null
 *  mean from ~0.5 to ~7.6 (Tessera audit F7, measured), and heavy tails break E ≤ 1 outright. */
export function gInc(r: number): number {
  let s = 0;
  for (const lam of LAMBDAS) s += Math.exp(lam * r - 0.5 * lam * lam);
  return Math.min(G_CAP, s / LAMBDAS.length);
}

/** 'gaussian' = gInc (max power, needs a genuinely N(0,1) residual); 'bounded' = linear bounded
 *  bets (distribution-robust; the FDR-bearing default in Tessera). */
export type IncrementKind = 'gaussian' | 'bounded';
