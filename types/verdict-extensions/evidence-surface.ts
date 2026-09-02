// engine/types/verdict-extensions/evidence-surface.ts — ADR 0027.
//
// The log-domain evidence surface a multiplicative wealth detector can attach to its per-tick
// DetectorVerdict as the optional `evidence` field. Everything here is derived from state the
// detector already holds (detectors/_wealth.ts keeps `log_M` as the single source of truth) and
// from the threshold it already compares against; nothing new is estimated.
//
// WHY LOG DOMAIN. Wealth compounds, so log-increments ADD and a growth rate is a mean
// (knowledge stats/wealth-growth-rate). The linear ratio `statistic / threshold` that consumers
// render as "progress" reads near zero until the tick it fires, because the shipped Family A
// threshold is a bootstrap quantile sitting at a median 2.4e4 × 1/α
// (knowledge stats/ville-guarantee-is-empirical). `nats_to_threshold` is the same distance on the
// scale evidence actually accrues on.
//
// THE BOUNDARY, stated where the numbers are. A wealth process is evidence only where its
// increment satisfies E[e_t | F_{t-1}] ≤ 1 under the reference law it was compiled against
// (knowledge stats/validity-premise-chain). In the shipped estimated-baseline regime the Family A
// plug-in detectors are recorded at E[e|H0] → ~1e8 (detectors/validity-envelope.ts). On those
// paths every field below is a SCORE describing the detector's own bookkeeping, not evidence
// against the null. The consumer owns the envelope check (fleet/e-bh-guarded.ts); this surface
// carries `threshold_kind` so a nats reading is never mistaken for a distance to Ville's 1/α.
//
// Two readings are certified regardless of the threshold in force, given a valid increment:
//   - `anytime_p = 1 / max_{s≤t} M_s` is an anytime-valid p-value (Ramdas 2023 §2.7). The running
//     max is NOT an e-value (§2.4) and must not be merged as one.
//   - `growth_rate_hat`, the realized mean log-increment, estimates μ = E[log e_t]; validity pins
//     μ ≤ 0 by Jensen, so a negative reading under H0 is the generic healthy state, and fire time
//     under the alternative is ≈ log(1/α)/μ (Grünwald 2024 §6, Breiman via Wald's identity).

export type ThresholdKind =
  /** the analytical Ville threshold 1/α. */
  | 'ville'
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
