import type { LevelFreeMixtureCs } from '../types/verdict-extensions/evidence-surface';
export type { LevelFreeMixtureCs };
export interface MixtureConfidenceSequenceInput {
    /** the detector's centered (whitened) partial sum S_t. */
    S_t: number;
    /** wealth updates so far (t ≥ 1). */
    t: number;
    /** compiled per-tick variance σ². */
    sigma_squared: number;
    /** mixing variance ρ = gaussian_sigma_squared_prior. */
    sigma_squared_prior: number;
    /** the level the detector fires at (its 1/α). */
    alpha: number;
}
export interface MixtureConfidenceSequence {
    /** X̄_t = S_t / t — the running mean shift from the compiled baseline. */
    center: number;
    /** w_t as above. */
    half_width: number;
    lower: number;
    upper: number;
    /** true iff 0 ∉ C_t — identical to the detector's M_t ≥ 1/α. */
    excludes_zero: boolean;
}
/** ADR 0030 (C62 b) — the same interval at an arbitrary level from the level-free inputs. The
 *  e-process behind the CS does not depend on α (Ramdas–Wang 2025 Proposition 13.4), so one
 *  `(S_t, t, σ², ρ)` yields the whole family; `fleet/e-by.ts` re-inverts it at `δ|S|/K`. */
export declare function mixtureConfidenceSequenceAt(lf: LevelFreeMixtureCs, alpha: number): MixtureConfidenceSequence;
export declare function mixtureConfidenceSequence(a: MixtureConfidenceSequenceInput): MixtureConfidenceSequence;
//# sourceMappingURL=mixture-confidence-sequence.d.ts.map