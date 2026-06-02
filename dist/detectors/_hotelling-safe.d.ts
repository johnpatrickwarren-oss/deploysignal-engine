import type { DetectorVerdict, FamilyCPerCell, SafeHotellingState } from '../types';
/** Fresh wealth state for a new (deploy, cell) safe-Hotelling evaluation.
 *  `M₀ = 1` is the Ville-inequality convention (log-wealth starts at 0). */
export declare function freshSafeHotellingState(): SafeHotellingState;
/** Addition #20 (ARCHITECT-REPLY-43 D4) — safe-Hotelling per-tick
 *  evaluation against a cell with populated `safe_hotelling_params`.
 *  The caller owns the state object; this function mutates `state.M` /
 *  `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (z_t derived inline for future auditors):
 *    Multivariate-Gaussian log-density under null N(0, Σ):
 *      log p₀(x) = -(p/2) log(2π) - ½ log det(Σ) - ½ xᵀ Σ⁻¹ x
 *    Marginal under alternative prior μ ~ N(0, τ²I_p):
 *      p_A(x) = ∫ N(x | μ, Σ) · N(μ | 0, τ²I) dμ = N(x | 0, Σ + τ²I)
 *      log p_A(x) = -(p/2) log(2π) - ½ log det(Σ+τ²I) - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    Log-likelihood ratio:
 *      z_t = log p_A(x) - log p₀(x)
 *          = -½ [log det(Σ+τ²I) - log det(Σ)]
 *            + ½ xᵀ Σ⁻¹ x
 *            - ½ xᵀ (Σ+τ²I)⁻¹ x
 *          = -precompiled_log_det_shrink + ½ xᵀ Σ⁻¹ x - ½ xᵀ (Σ+τ²I)⁻¹ x
 *    M_t = M_{t-1} · exp(z_t); fire when M_t ≥ 1/alpha.
 *
 *  Practice-5 anchors (healthy p=11 cell, τ²≈δ_min²/4):
 *    - Healthy x near zero:        z_t ≈ -0.055, M drifts ~0.946×/tick.
 *    - Drifted x = [3σ, 3σ, 0, …]: z_t ≈  0.445, M grows   ~1.56×/tick.
 *    - Fire horizon on moderate shift: ~log(1/α)/z_t ≈ 9.2/0.445 ≈ 20 ticks.
 */
export declare function evaluateSafeHotelling(input: {
    cell: FamilyCPerCell;
    alpha: number;
}, x: number[], state: SafeHotellingState): DetectorVerdict;
//# sourceMappingURL=_hotelling-safe.d.ts.map