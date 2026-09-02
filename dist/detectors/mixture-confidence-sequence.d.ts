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
export declare function mixtureConfidenceSequence(a: MixtureConfidenceSequenceInput): MixtureConfidenceSequence;
//# sourceMappingURL=mixture-confidence-sequence.d.ts.map