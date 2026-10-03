# Report — designed-null kinds, part 1 (`2026-10-designed-null-kinds`, ADR 0038, T1)

- **Registration:** `PREREGISTRATION.md` at `7c588e3` with ADR 0038, before any implementation; Amendment 1
  (the invariant's ceiling) at `dfef808`, found at the first unit test and before the harness existed;
  harness `5a67a3c`. Verdicts as computed; no bar moved.
- **Run:** `results/run-20261003T123340Z/`, engine `5a67a3c` (`0.13.0-pre` plus ADR 0038, unreleased), Node v25.9.0,
  R = 10,000 per cell, seeds `lcg(20261003 + 7919·i)`.
- **Verdicts:** E1 PASS, E2 PASS, E3 PASS, E4 PASS. **Ship rule MET.**

## 0. The headline

| Cell | Reads | Fired | Rollback tick: median, IQR, p90, range | Verdict |
|---|---|---|---|---|
| R0-rep (m 0, ψ 1, T 60) | reproduction of ADR 0036 | 0.0009 | 54, 48–57, 59, 39–59 | **E2 PASS** (within ±0.01; max score difference 0) |
| V-m0.2-ψ1 (T 300) | validity | 0.0000 | — | **E1 PASS** (bar 0.0556) |
| V-m0.2-ψ1.1 | validity at half the margin | 0.0000 | — | PASS |
| V-m0.2-ψ1.2 | validity at the null's boundary | 0.0113 | 180, 134–236, 283, 66–300 | PASS |
| H-m0.2-ψ1 | heterogeneity caveat | 0.0000 | — | reported |
| P-m0.2-ψ1.5 (T 60) | power at 1.25× the margined null | 0.2576 | 52, 47–57, 59, 24–60 | reported |
| P-m0.2-ψ2.0 | power | 0.9996 | 32, 28–35, 39, 18–60 | **E4 PASS** (≥ 0.95) |
| P-m0.2-ψ3.0 | power | 1.0000 | 19, 18–21, 22, 14–27 | reported |
| IV-ε0.002-f0 (T 300) | invariant validity | 0.0000 | — | **E3 PASS** |
| IV-ε0.002-f0.001 | at half the tolerance | 0.0000 | — | PASS |
| IV-ε0.002-f0.002 | at the boundary | 0.0000 | — | PASS |
| IV-ε0.002-λ50 | five-fold boundary noise | 0.0000 | — | reported |
| IP-ε0.002-f0.005 (T 60) | power at the reset cell's drop rate | 1.0000 | 9, 9–10, 10, 7–13 | **E4 PASS** |
| IP-ε0.002-f0.01 | power | 1.0000 | 6, 6–7, 7, 6–8 | reported |
| IP-ε0.002-f0.003 | power at 1.5× the tolerance | 1.0000 | 22, 19–25, 29, 11–46 | reported |

0 sample-ratio halts in 150,000 replications. The proceed side (α_P 1e-12, tolerance 0.5, registered)
ended 8,431 of the V-m0.2-ψ1 replications, 476 of V-m0.2-ψ1.1 and 9,995 of H-m0.2-ψ1 before tick
300, so those cells' rollback rates are over paths truncated at proceed. **Post-hoc, no verdict**
(`analysis/posthoc-noproceed.mjs`, `results/run-20261003T123340Z/posthoc-noproceed.json`): the same
four cells with the proceed side unreachable (α_P 1e-300), same seeds, give rollback 0.0000, 0.0000,
0.0113 and 0.0000, identical to the registered run, so the truncation did not hide a late rollback.

## 1. Readings

**The rate margin.** With m = 0.2 a persistent 10% excess in the canary's odds (ψ 1.1) never rolled
back in 10,000 runs of 300 ticks, and an excess exactly at the margin rolled back 1.13%, under the
5% the bound allows. Against that, the margin costs power: ×2 detects at a median of 32 ticks
instead of 26 and ×1.5 drops from 0.934 to 0.258 detected by tick 60 (`2026-10-twin-rate-random-arrivals`
for the unmargined figures). That is the trade the margin buys: ×1.5 at a 20% margin is a 25%
excess over the null and a one-hour bake at this traffic sees a quarter of them. The planner now
takes the margin (`marginOddsRatio`). At m = 0 the margined path computes the same `rollbackNull`
as ADR 0036's closed form on every tick of a seeded replication (max difference 0), and the cell's
0.0009 against the random-arrivals study's 0.0000 is the single-metric threshold (20) against the
two-metric one (40). The heterogeneity cell (1% of each arm's requests at p 0.5) fired in 0 of
10,000: the caveat at `twin-contrast.ts` line 21 has no measurable price at these counts.

**The invariant.** Under boundary noise alone, at half the tolerance and at the tolerance, 0 fires
in 30,000 runs of 300 ticks; at five times the boundary noise (λ 50, mean still 0) also 0. The
reset cell's drop rate (0.5%, 2.5× a 0.2% tolerance) fires at a median of 9 ticks with a range of
7–13, and 1.5× the tolerance fires in every run by tick 46. The construction is more powerful than
I registered (§2), because the ceiling of Amendment 1 sets the bet's scale to the fraction's own
order of magnitude.

## 2. Predictions against results

- P1 held in direction, not in figure: 0.000 at ψ 1 and 1.1 (predicted 0.000–0.010), 0.0113 at the
  boundary (predicted 0.02–0.05). The learning cost protects more at the boundary than I allowed.
- P2 held exactly.
- P3 held at f 0 and 0.001; the boundary cell was 0.000 against a predicted 0.02–0.05, same cause.
- P4 held on the bars. Margined ×2 median 32 (predicted 35–50); ×1.5 detection 0.258 (predicted
  0.3–0.6, so slightly below); ×3 median 19 (predicted under 20). Invariant at f 0.005 median 9
  (predicted 8–20); **f 0.003 detected 1.000 by 60 against a predicted 0.3–0.7**, wrong by the width
  of the range; f 0.01 median 6 (predicted under 8).
- P5 held: the heterogeneity price is 0.

Two predictions were too pessimistic by a lot (P3's boundary, P4's f 0.003) and one too optimistic by
a little (P4's ×1.5). I record the pattern: I under-predict the paired bet's power when the
observation's scale is small, and over-predict its false-rollback rate at the boundary.

## 3. Amendment 1, stated

At `hi 1` the invariant fired in 0 of 200 runs at 2.5× the tolerance (first unit test). The GRAPA
shrinkage pseudo-observation has second moment `((hi − lo)/4)²`; at `[0, 1]` that is 1/16 against
real increments of order 1e-6, so λ stayed near 0 for the whole bake. The ceiling (default
10 · tolerance) sets the range to the fraction's scale. Clamping x down to the ceiling cannot raise
its mean, so H0 is preserved and the validity cells' reading is unchanged; no bar, cell or
prediction was altered. Found before the harness existed; the registration says so.

## 4. Consequences

ADR 0038 ACCEPTED. `v0.14.0-pre` ships `TwinMetricSpec.margin.relative` for the `rate` kind,
`RatePlanInput.marginOddsRatio`, and `detectors/invariant.ts`. No consumer authority changes; the
running DeploySignal studies pin `v0.13.0-pre` and are untouched. The DeploySignal re-pin, the gate
HTTP contract for the invariant and a CloudWatch source for it are consumer work after the onebox
study closes.

## 5. Not measured

A real load balancer's in-flight distribution (the invariant's noise model is mine); unequal
weights; missingness; the margin beside other metrics under Bonferroni; power at margins other than
0.2 and tolerances other than 0.002; the peer-rank and two-sample kinds; any real service.
