export type ThresholdKind = 
/** the analytical Ville threshold 1/α. */
'ville'
/** an empirical (1−α) quantile of max wealth under a bootstrap null — replaces 1/α on the
 *  shipped Family A betting and safe-Hotelling paths; a crossing-rate instrument, not an
 *  e-value bound. */
 | 'bootstrap'
/** c/α with a measured inflation bound c (Family D spectral e-detector). */
 | 'priced';
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
}
//# sourceMappingURL=evidence-surface.d.ts.map