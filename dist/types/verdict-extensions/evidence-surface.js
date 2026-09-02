"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=evidence-surface.js.map