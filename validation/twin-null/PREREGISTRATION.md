# Pre-registration — the randomized twin null (`2026-09-twin-null`, ADR 0036)

- **Study id:** `2026-09-twin-null`
- **What it serves:** ADR 0036's claim that a canary-vs-control e-process with an observed or fixed
  null mean holds its Ville contract with nothing estimated, and where its pairing premise breaks.
- **Tier:** T1 (synthetic, oracle generator). No real-deploy claim; T3 is Follow-on Plan D.
- **Engine:** 4e4f555 (full 4e4f555e8d85841be758fc38c461d03cffe54543), on branch wt/twin-gate,
  engine 0.11.0-pre + ADR 0036 unreleased.
- **Status: REGISTERED, NOT RUN.** A later change is an amendment, appended and dated.

## 0. Disclosures

- Pilot seen before registration: during the whole-branch code review (2026-09-25) a reviewer ran
  this plan's Task 10 harness text unmodified against the committed dist/ on 5 `rate` cells at
  R = 200 to check the harness runs against the API. One number was reported to the controller:
  P2-rate-w0.1-phi0-s0.3 false-rollback fraction 0.74; the other four cells were reported within B
  without numbers. All-cell crash smoke at R = 2. No other result was seen. The P2 prediction below
  for `rate` at w = 0.1 was changed after that review, on the analytic ground stated with it.
- Scope: the study measures the per-metric e-processes of detectors/twin-contrast.ts only. The gate
  (per-shard/twin-gate.ts) — its sample-ratio guard, Bonferroni split and missingness penalty — is
  not exercised; the harness never calls stepTwinGate. No missing observations are generated.

## 1. Generator

T = 2000 ticks, R = 1000 replications per cell, α = 0.05 for both tests (single metric per cell,
so no Bonferroni). Seed per cell i: `lcg(20260925 + 7919·i)`, one stream across its replications;
cells in the order of §3. Per tick:

- traffic N_t ~ Poisson(2000 · s_t), s_t = 1 + 0.5 sin(2πt / 1440);
- canary requests n_c = round(N_t w + √(N_t w (1−w)) z) clamped to [0, N_t]; control n_k = N_t − n_c;
- arm-specific persistent state a_t (one per arm, independent): AR(1), marginal sd σ_arm, coefficient φ,
  started at stationarity;
- cold start (CS cells only): canary a_t += 0.3 · exp(−t / 30);
- **rate**: bad-event probability p_t = 0.01 · s_t · o_t with shared outage o_t = 5 on t ∈ [800, 900),
  1 otherwise; bad events per arm ~ Poisson(n · p_t · exp(a_t)) (Poisson thinning: the regime where
  the conditional allocation is exactly binomial; the binomial correction at p = 0.01 is not measured);
- **sign**: tick value per arm = 100 · s_t · (3 on t ∈ [800, 900), else 1) + 10 · a_t + 30 · ℓ / √max(n, 1),
  ℓ a centered lognormal (σ 0.75): exp(0.75 z) − exp(0.28125);
- **sign-direct** (P5 only): canary worse with probability exactly 0.5 + τ.

Warm-up exclusion W: ticks t < W are generated and not fed to the detector.

Default tolerances: rate ρ = 0.5, sign τ = 0.1.

## 2. Measured quantities

Per cell: false-rollback rate (rollback wealth ≥ 1/α at any tick ≤ T), false-proceed rate (proceed
wealth ≥ 1/α), median crossing tick among crossings, each with its binomial SE. Bar
B = α + 2.58 · √(α(1−α)/R) = 0.0678.

## 3. Cells

| Group | Kind | w | φ | σ_arm | other | Bar |
|---|---|---|---|---|---|---|
| P1 | rate | 0.5, 0.1 | – | 0 | – | false rollback ≤ B |
| P1 | sign | 0.5 | – | 0 | – | false rollback ≤ B |
| P2 | rate, sign | 0.5, 0.1 | 0, 0.5, 0.9, 0.99 | 0.1, 0.3 | – | report only |
| P3 | sign | 0.1 | – | 0 | worse = higher, lower | report vs B |
| CS | rate, sign | 0.5 | – | 0 | cold start, W = 0 and W = 150 | W = 150: false rollback ≤ B |
| P4 | rate | 0.5, 0.1 | – | 0 | canary rate × 1.2 | report power, median tick, plan ratio |
| P4 | sign | 0.5 | – | 0 | canary value + 0.5, + 2 | report power, median tick |
| P5 | rate | 0.5, 0.1 | – | 0 | canary rate × 1.5 (ψ at the tolerance) | false proceed ≤ B |
| P5 | sign-direct | – | – | – | τ = 0.1 | false proceed ≤ B |

## 4. Predictions (registered)

- P1: PASS in every cell, false rollback ≤ 0.03 (the capped bet is conservative).
- P2: at w = 0.5, φ = 0: within B for every σ_arm (iid arm shocks symmetric between equal arms
  cancel). At w = 0.1, `rate`: FAILS at φ = 0 for σ_arm = 0.3 and likely at 0.1 — per-tick arm
  shocks alone break the rollback null at an unequal split (the canary share given E is a logistic
  in a_c − a_k, convex at logit(0.1), so its mean exceeds w by Jensen; second-order bias ≈ 0.0065
  at σ_arm = 0.3). At σ_arm = 0.3 and φ ≥ 0.9, FAIL for both kinds at both weights. This is the
  premise boundary, not a defect.
- P3: w = 0.1 with worse = lower FAILS (the larger-spread arm's median sits below its mean for a
  right-skewed ℓ, so the small arm reads as worse on 'lower'); worse = higher stays within B.
- CS: W = 0 FAILS for both kinds; W = 150 PASSES.
- P4: rate × 1.2 at w = 0.5 detected in ≥ 80% of runs; measured median / `ticksToDetect` between 1 and 3.
- P5: PASS in every cell. P5-rate is conservative by construction: its arms are Poisson-thinned, so
  given E the canary count is Binomial(E, 1.5n_c/(1.5n_c + n_k)), whose mean exceeds the Fisher
  noncentral mean at ψ = 1.5 by roughly 5e-4 to 5e-3; P5-rate therefore sits strictly inside the
  proceed null. The generator is homogeneous within each arm-tick, so the proceed premise (one
  bad-event probability per arm per tick) is not exercised. The binomial-arm proceed boundary is
  covered by the unit test in test/twin-contrast.test.ts.

## 5. Ship rule

The twin path may be PROPOSED for DeploySignal rollback authority (Follow-on Plan B) only if every
P1 and P5 cell and the CS W = 150 cells pass. Any failure there: the envelope records it, no
authority. P2 and P3 results are written into the envelope notes as the premise boundary.
Authority additionally requires Follow-on Plan D (real-service A/A, T3). A P5 pass does not clear
the rate proceed side under within-arm heterogeneity; that remains unmeasured.

## Amendment 1 — 2026-09-25, before any harness code (P4-sign prediction; P2 coverage made explicit)

Registered after the review of the registration commit found no §4 prediction for the P4 `sign` cells. No harness exists at this commit; no result beyond §0's disclosure has been seen.

- **P4-sign (added):** per-arm tick noise sd ≈ 30 · 1.15 / √1000 ≈ 1.09 (ℓ is a centered lognormal with σ 0.75, sd ≈ 1.15; n ≈ 1000 per arm at w = 0.5), so the per-tick difference has sd ≈ 1.54. A shift of +0.5 gives P(canary tick worse) ≈ 0.63 (τ-excess ≈ 0.13; `ticksToDetect` sign figure ≈ 89 ticks); +2 gives ≈ 0.90 (≈ 11 ticks). Prediction: both P4-sign cells roll back in ≥ 95% of runs within T; median crossing tick between 1× and 3× those figures. The normal approximation ignores the lognormal's skew, which shifts P(worse) by a small amount in either direction.
- **P2 cells without a prediction (made explicit):** φ = 0.5 at σ_arm ∈ {0.1, 0.3} (both kinds, both weights); φ ≥ 0.9 at σ_arm = 0.1 (both kinds, both weights); `sign` at w = 0.1 for every φ and σ_arm. No prediction is registered for these; they are reported against B only.
