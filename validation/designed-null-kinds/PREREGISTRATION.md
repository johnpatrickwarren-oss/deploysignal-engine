# Pre-registration — designed-null kinds, part 1 (`2026-10-designed-null-kinds`, ADR 0038)

- **Study id:** `2026-10-designed-null-kinds`
- **What it serves:** ADR 0038's two constructions: the `rate` kind's rollback margin and the
  invariant e-process. Validity (Ville at α under the designed null, including a persistent
  sub-margin excess), reproduction of ADR 0036 at m = 0, and power at declared effects.
- **Tier:** T1, synthetic, oracle generator, through the committed `dist/` (the twin gate for §1,
  the new module for §2). No real service.
- **Engine:** the commit carrying this file and ADR 0038, before any implementation; `v0.13.0-pre`
  plus the two constructions, unreleased.
- **Status: REGISTERED, NOT RUN.** A later change is an amendment, appended and dated.

## 0. Disclosures

- The rate kind's unmargined tick distributions at ψ = 1.5 and 2.0 under random arrivals are known
  (`2026-10-twin-rate-random-arrivals`: medians 43 and 26, detection by 60 0.934 and 1.000). The
  margined cells below are expected to be slower; the comparison is stated in §5.
- Nothing has been implemented at registration. The paired bet and `fisherNoncentralMean` exist and
  are unchanged.
- The invariant's boundary-noise model (§2) is mine; a real ALB's in-flight distribution has not
  been measured. The cells say what the construction does under the stated noise, not under a
  real load balancer.

## 1. Rate margin — generator and cells

The `2026-10-twin-rate-random-arrivals` generator, random arrivals: N_t ~ Poisson(2440), canary
Binomial(N_t, ½), control p = 0.005, canary p · ψ in odds (`oddsShift`); one `rate` metric
`{ worse: 'higher', tolerance: 0.5, margin: { relative: m } }` alone (threshold 1/α = 20, α 0.05),
gate `alphaProceed 1e-12, alphaSrm 0.001, canaryWeight 0.5, maxTicks T`. Seeds `lcg(20261003 + 7919·i)`
in cell order, R = 10,000, T = 60 unless stated. Within-arm heterogeneity cell H: each arm's
requests are 1% "hot" at p_hot = 0.5 and 99% at p = 0.005 (the `twin-gate` study's G5 shape), the
canary at ψ = 1 on both.

| Cell | m | ψ | T | Reads |
|---|---|---|---|---|
| R0-rep | 0 | 1.0 | 60 | reproduction: false rollback within ±0.01 of N-R's 0.000 and identical per-tick scores to ADR 0036's path |
| V-m0.2-ψ1 | 0.2 | 1.0 | 300 | false rollback ≤ B |
| V-m0.2-ψ1.1 | 0.2 | 1.1 | 300 | false rollback ≤ B (persistent excess at half the margin) |
| V-m0.2-ψ1.2 | 0.2 | 1.2 | 300 | false rollback ≤ B (excess equal to the margin: the null's boundary) |
| H-m0.2-ψ1 | 0.2 | 1.0 | 300 | reported: the heterogeneity caveat's price |
| P-m0.2-ψ1.5 | 0.2 | 1.5 | 60 | reported: detection by 60, tick median/IQR/p90 |
| P-m0.2-ψ2.0 | 0.2 | 2.0 | 60 | detection by 60 ≥ 0.95 |
| P-m0.2-ψ3.0 | 0.2 | 3.0 | 60 | reported |

## 2. Invariant — generator and cells

Per tick: total N_t ~ Poisson(4870) (one minute at 81 rps); in-flight at each window boundary
I_t ~ Poisson(λ_in = 10), independent across boundaries; genuine drops D_t ~ Binomial(N_t, f);
accounted = N_t − D_t − I_t + I_{t−1}, clamped to [0, N_t]. The unaccounted fraction has mean f and
boundary noise of standard deviation about √20 / 4870 ≈ 0.0009. Spec `{ tolerance: ε, alpha: 0.05 }`,
fires at wealth ≥ 20. Seeds continue the §1 sequence. R = 10,000.

| Cell | ε | f | T | Reads |
|---|---|---|---|---|
| IV-ε0.002-f0 | 0.002 | 0 | 300 | false fire ≤ B |
| IV-ε0.002-f0.001 | 0.002 | 0.001 | 300 | false fire ≤ B (drops at half the tolerance) |
| IV-ε0.002-f0.002 | 0.002 | 0.002 | 300 | false fire ≤ B (the boundary) |
| IV-ε0.002-λ50 | 0.002 | 0 | 300 | reported: λ_in = 50 (boundary noise sd ≈ 0.002, mean still 0) |
| IP-ε0.002-f0.005 | 0.002 | 0.005 | 60 | detection by 60 ≥ 0.95 (the reset cell's drop rate) |
| IP-ε0.002-f0.01 | 0.002 | 0.01 | 60 | reported |
| IP-ε0.002-f0.003 | 0.002 | 0.003 | 60 | reported: 1.5× the tolerance |

## 3. Bars

B = α + 2.58 · √(α(1 − α)/R) = **0.0556** at R = 10,000. Reproduction tolerance ±0.01 and
score-for-score equality on one seeded replication (the margined path at m = 0 must compute the
same `rollbackNull` as the unmargined path to within 1e-12 on every tick).

## 4. Endpoints

- **E1 (rate margin validity).** V-m0.2-ψ1, V-m0.2-ψ1.1 and V-m0.2-ψ1.2 each ≤ B over T = 300.
- **E2 (reproduction).** R0-rep within ±0.01 of 0.000 and score-for-score equal to ADR 0036's path.
- **E3 (invariant validity).** IV-ε0.002-f0, -f0.001 and -f0.002 each ≤ B over T = 300.
- **E4 (power).** P-m0.2-ψ2.0 ≥ 0.95 by tick 60; IP-ε0.002-f0.005 ≥ 0.95 by tick 60. The other P/IP
  and the H and λ50 cells are reported with no bar.

**Ship rule:** E1–E4 hold → ADR 0038 ACCEPTED, `v0.14.0-pre`. Any fails → REJECTED with the figure;
no bar moves.

## 5. Predictions (registered)

- P1: E1 holds; point figures 0.000–0.010 at ψ = 1 and 1.1, rising toward 0.02–0.05 at ψ = 1.2 (the
  null's boundary over 300 ticks, where the learning cost no longer protects).
- P2: E2 holds exactly.
- P3: E3 holds; 0.000–0.010 at f = 0 and 0.001, 0.02–0.05 at f = 0.002; λ50 reported under 0.02
  (mean-zero noise does not move a mean test).
- P4: E4 holds. P-m0.2-ψ2.0 median tick 35–50 (against 26 unmargined), P-m0.2-ψ1.5 detection by
  60 in 0.3–0.6 (against 0.934 unmargined), ψ3.0 under 20. IP-f0.005 median tick 8–20; IP-f0.003
  detection by 60 in 0.3–0.7; IP-f0.01 median under 8.
- P5 (H cell): the heterogeneity price at ψ = 1 is small at these counts, under 0.02; if above B
  the ADR states the premise clause for the rate margin as it does for the proceed side.

## 6. Not measured

A real load balancer's in-flight distribution; unequal weights; missingness; the margin's
interaction with Bonferroni beside other metrics; an absolute margin for rates (refused by
construction); the peer-rank and two-sample kinds (later ADRs); any real service.

## Amendment 1 — 2026-10-03, before run 0 (the invariant's range)

Found at the first unit test, before the harness existed: with the paired bet's range `[0, 1]` the
GRAPA shrinkage pseudo-observation (second moment `((hi − lo)/4)² = 1/16`) swamps observations of
order 1e-3, so the invariant fired in 0 of 200 runs at f = 0.005 (2.5× the tolerance) inside 60
ticks. The construction gains a declared `ceiling` c ∈ (tolerance, 1], default min(1, 10 ·
tolerance), and scores x = min(c, max(0, (total − accounted)/total)) with `hi = c`. Clamping down
preserves H0 (E[min(x, c)] ≤ E[x] ≤ tolerance), so the validity cells' reading is unchanged; the
power cells now read the construction as it will ship. §2's cells, bars and predictions are
unchanged; the default ceiling (0.02 at ε = 0.002) is what they run with. ADR 0038 §2 amended to
match.
