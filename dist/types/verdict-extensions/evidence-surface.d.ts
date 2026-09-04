export type ThresholdKind = 
/** the analytical Ville threshold 1/α. */
'ville'
/** an empirical (1−α) quantile of max wealth under a bootstrap null — replaces 1/α on the
 *  shipped Family A betting and safe-Hotelling paths; a crossing-rate instrument, not an
 *  e-value bound. */
 | 'bootstrap'
/** c/α with a measured inflation bound c (Family D spectral e-detector). */
 | 'priced';
/** ADR 0030 (C62 b) — the LEVEL-FREE inputs of the mixture confidence sequence: the interval at
 *  ANY level α is `S_t/t ± sqrt(v·log(v/(α²ρ)))/t`, `v = σ²t + ρ` (Howard 2021 eq. 14; Ramdas–Wang
 *  2025 Proposition 13.4: the e-process `M_t(S_t − tm)` does not involve α, so its stopped CS is a
 *  level-free family of e-CIs). Carried so a consumer can re-invert at the e-BY level `δ|S|/K`
 *  (`fleet/e-by.ts`) without re-running the detector. */
export interface LevelFreeMixtureCs {
    /** the detector's centered (whitened) partial sum S_t. */
    S_t: number;
    /** wealth updates so far, t ≥ 1. */
    t: number;
    /** compiled per-tick variance σ². */
    sigma_squared: number;
    /** mixing variance ρ = gaussian_sigma_squared_prior. */
    sigma_squared_prior: number;
}
/** ADR 0030 — the confidence sequence as the detector reported it at its own level, plus the
 *  level-free inputs. REPORTED, no verdict authority (study 2026-09-mixture-cs). The interval is
 *  for the shift FROM THE COMPILED BASELINE MEAN in whitened units; the estimation-premise price
 *  (μ̂, σ̂² from a window) is on the detector result's docstring and applies at every level. */
export interface ConfidenceSequenceEvidence {
    level_free: LevelFreeMixtureCs;
    /** the level the detector inverted at (its own fire α). */
    alpha: number;
    center: number;
    half_width: number;
    lower: number;
    upper: number;
    /** identical to the detector's fire rule at `alpha`. */
    excludes_zero: boolean;
}
export interface EvidenceSurface {
    /** exact log-wealth log M_t in nats (the ADR 0026 books; floors and saturation included). */
    log_wealth: number;
    /** realized change in log-wealth this tick, log M_t − log M_{t−1}, in nats. `null` when the
     *  tick did not advance the wealth (a gate, a disjoint-window wait, a NaN observation held). */
    log_increment: number | null;
    /** the bet λ_t applied this tick; `null` for likelihood-ratio and mixture detectors, which
     *  place no bet. */
    bet: number | null;
    /** wealth updates so far (the detector's own tick count). */
    n: number;
    /** log of the threshold in force, or `null` when the verdict carries no threshold. */
    log_threshold: number | null;
    /** what the threshold is — see ThresholdKind. `null` when there is no threshold. */
    threshold_kind: ThresholdKind | null;
    /** nats still needed to cross: log_threshold − log_wealth. ≤ 0 once crossed. `null` when
     *  there is no threshold. */
    nats_to_threshold: number | null;
    /** realized mean log-increment, log_wealth / n, in nats per update; `null` when n = 0 (kept
     *  JSON-safe — NaN would serialize to null anyway, and an explicit null is honest about it).
     *  Under a valid null this is ≤ 0 in expectation; a sustained positive reading is the growth
     *  rate the fire-time arithmetic runs on. */
    growth_rate_hat: number | null;
    /** log of the running maximum of the wealth, max_{s≤t} log M_s. */
    log_peak_wealth: number;
    /** min(1, exp(−log_peak_wealth)) — an anytime-valid p-value for the detector's null given a
     *  valid increment. */
    anytime_p: number;
    /** ADR 0030 — present on the Family A Gaussian-mixture path only; absent elsewhere. */
    confidence_sequence?: ConfidenceSequenceEvidence;
}
//# sourceMappingURL=evidence-surface.d.ts.map