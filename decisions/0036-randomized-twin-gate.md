# ADR 0036 — The randomized twin: a deploy null by construction, with nothing estimated

- **Date:** 2026-09-25
- **Status:** PROPOSED. Library only; no consumer authority. Study `2026-09-twin-null` registered
  (validation/twin-null/PREREGISTRATION.md), not run.
- **Register:** ADR 0032 (the contrast null, refused on its estimated offset); knowledge
  `stats/contrast-null`, `stats/nab-null-survival-2026-09-04`,
  `methodology/threshold-free-observability` claim (1).

## The gap

Every construction the portfolio gates on tests against a baseline estimated from history. The
envelopes say so (`validUnderEstimatedBaseline: false` for both Family A wealths), NAB null-survival
measured the plug-in false-alert rate flat in calibration length on real telemetry, and ADR 0032's
contrast null — which cancels the shared component exactly — was refused on the offset it
estimates from a fit window. A detector meant for any metric on any service cannot carry a fitted
baseline, because nobody will fit and certify one per metric.

## Decision

Test the canary against a CONCURRENT control arm on the old version under RANDOMIZED per-request
routing, with statistics whose null mean is observed in the same tick or fixed, so that no
parameter is estimated:

- `rate` — per tick, the canary's share X = b_c / (b_c + b_k) of bad events. Conditional on the arm
  totals and the bad-event total, b_c is Fisher noncentral hypergeometric in the odds ratio ψ of the
  arms' per-request bad-event probabilities. Rollback null ψ ≤ 1 ⇒ E[X] ≤ n_c / (n_c + n_k), the
  observed traffic share. Proceed null ψ ≥ 1 + ρ ⇒ E[X] ≥ the noncentral mean at 1 + ρ, computed
  exactly from the observed totals. Rollback holds under randomized routing with no arm-level effect
  on any tick; at canaryWeight 0.5 a per-tick arm-level shock cancels by symmetry, at unequal weights
  it does not (see "The premise, stated").
- `sign` — per tick, S = 1 if the canary's value is worse than the control's. Under exchangeable
  arms of equal routing weight P(S = 1 | no tie) = 1/2. Proceed null P ≥ 1/2 + τ.

Each null is a bounded mean with a known null value, tested by the one-sided betting e-process
`detectors/_paired-bet.ts` (λ predictable, capped at half the positivity bound). Ville bounds
every look. Across N metrics rollback uses N/α (Bonferroni, valid under any dependence); proceed
requires every metric's proceed wealth over 1/α_P (intersection–union, no split). A sample-ratio
guard on the traffic share returns `invalid_experiment`.

## The premise, stated

Rollback (`pairingPremise: 'exchangeable-arms'`): under H0, requests are routed to the two arms at
random, independent of outcome, and neither arm carries an effect on any tick. This holds even when
per-request bad-event probabilities are heterogeneous within a tick, as long as no arm shifts them.
What the two arms share — traffic level, seasonality, a shared outage, any shared autocorrelation —
cancels by conditioning. Two distinct things break it:

- ARM-SPECIFIC PERSISTENT STATE under H0 — a cold canary fleet, a control arm pinned to a degraded
  host, an AZ imbalance — breaks validity at ANY routing split.
- A PER-TICK, ARM-LEVEL SHOCK (pod-level noise: iid across ticks, zero-mean, symmetric between
  arms, no persistent state) cancels exactly at canaryWeight 0.5 by symmetry, but NOT at an unequal
  split: the canary's posterior share given the tick's bad-event total is logistic in the shock
  difference and convex there below w = 0.5, so Jensen's inequality biases E[X] above the traffic
  share.

`sign` additionally needs equal routing weights (`exchangeable-equal-weight-arms`): with unequal arm
sizes a skewed tick statistic has different medians in the two arms. The study measures these
boundaries.

Not premised: tails, scale, φ of shared components, a baseline, a calibration length.

Proceed rests on everything rollback does, PLUS one bad-event probability per arm per tick within a
tick (the Fisher noncentral mean is the law of a homogeneous arm-tick); heterogeneous per-request
probabilities within an arm-tick can make it anticonservative — a false clear — which rollback does
not need. Only ROLLBACK twin e-values are candidates for the FDR (e-BH) path; PROCEED e-values test
a different null and must not be pooled with them.

## Consequences

- A missing observation (a non-finite value, or `undefined` while the canary is taking traffic) gets
  a ½ wealth factor on BOTH the rollback and proceed sides (`missTwinMetric`) rather than being
  skipped. Every attainable paired-bet factor is ≥ ½, so ½ is dominated by whatever factor the true,
  unobserved value would have produced — the Ville bounds hold under ANY missingness mechanism,
  including one that depends on the unobserved outcome itself; no missing-at-random premise is
  needed. Consequence: a metric that stops reporting while the canary is taking traffic decays both
  wealths toward 1 and the gate ends `inconclusive` on that metric alone, never `rollback`. The
  `missing` counter in `TwinMetricEvidence` reports the count; a consumer policy (DeploySignal, Plan
  B) should halt on a high missing rate rather than read the resulting inconclusiveness as a pass.
- The FDR gate learns a third premise axis (`pairingAdmissible`) beside φ and tails.
- Rollback authority in DeploySignal is out of scope; it is conditional on the registered study
  and a real-service A/A test.
- Deployment topology matters: a CodeDeploy-style canary against the warm production fleet
  violates the premise at start-up (cold canary). A fresh control arm on the old version at the
  canary's weight satisfies it; a warm-up exclusion window is the fallback the study prices.
