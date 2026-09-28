# Pre-registration — the randomized twin as a gate (`2026-09-twin-gate`, ADR 0036)

- **Study id:** `2026-09-twin-gate`
- **What it serves:** ADR 0036's three gate-level error statements (`per-shard/twin-gate.ts` header)
  and the parts of the gate study `2026-09-twin-null` did not exercise: the Bonferroni split across
  metrics, the sample-ratio guard, the ½ missingness penalty (validity under an outcome-dependent
  mechanism, and its power cost), and the `rate` proceed null under within-arm heterogeneity.
- **Tier:** T1 (synthetic, oracle generator). No real-deploy claim; the real-service A/A (T3) is
  DeploySignal's `2026-10-twin-aa-real`, registered and not run.
- **Engine:** `v0.12.2-pre` (`0434afc`). The harness drives `dist/per-shard/twin-gate.js`
  (`stepTwinGate`), and keeps a shadow of the gate's evidence with `dist/detectors/twin-contrast.js`
  and `dist/detectors/_paired-bet.js` (§2).
- **Status: REGISTERED, NOT RUN.** No harness exists at this commit. A later change is an
  amendment, appended and dated, before the first run it affects.

## 0. Disclosures

- No pilot of this design has been run. The author has seen `2026-09-twin-null`'s results
  (run-20260926T053339Z), which set the G4 predictions: its P4 `rate` ×1.2 cell at w 0.5 crossed at
  median tick 77 at α 0.05.
- The gate stops at its first terminal verdict, so under an A/A truth a correct early `proceed`
  ends the run before a late false rollback could occur, and under a regression a correct
  `rollback` ends it before a false `proceed`. No α setting avoids this (an α of 1e-12 is 27.6
  nats, which a regression's rollback wealth passes within the horizon). The bars are therefore on
  full-horizon first crossings kept by a shadow of the gate's state (§2), which bound the gate's
  verdict rates from above; the gate's own verdicts are reported beside them.
- G5's regression is defined per request: every request's bad-event odds are multiplied by
  1 + ρ = 1.5. With heterogeneous per-request probabilities the pooled odds ratio of the arms is
  below 1.5, so G5 measures how far the per-request and pooled definitions of "at tolerance" part
  (the gap ADR 0036 premise (ii) names), not a defect in the Fisher mean.

## 1. Generator

T = 2000 ticks (`maxTicks` 2000), R = 1000 replications per cell. Seed per cell i (the §3 order):
`lcg(20260928 + 7919·i)`, one stream across its replications; the LCG, Gaussian (Box–Muller),
Poisson (exact below mean 30, rounded normal above) and traffic split are `2026-09-twin-null`'s,
unchanged. Per tick:

- traffic N_t ~ Poisson(2000 · s_t), s_t = 1 + 0.5 sin(2πt / 1440);
- canary requests n_c = round(N_t q + √(N_t q (1 − q)) z) clamped to [0, N_t], control
  n_k = N_t − n_c, where q is the TRUE routing share: q = w = 0.5 except in the G2 routing-fault
  cells (§3). The gate is always configured with `canaryWeight` 0.5;
- **rate metric** (Poisson arms, G1–G4): bad events per arm ~ Poisson(n · 0.01 · s_t · mult), with
  mult = 1.2 on the canary in G4 and 1 otherwise; each rate metric draws its own events;
- **sign metric** (G1): tick value per arm = 100 · s_t + 30 · ℓ / √max(n, 1), ℓ a centered lognormal
  (σ 0.75), independent per metric and arm;
- **rate metric, Bernoulli arms** (G5): each arm's requests are split into hot, a fraction h
  (rounded), with base probability p_hot, and cold, the rest, with base probability 0.005. Bad events
  per arm and type ~ Binomial(n_type, p), drawn exactly (Bernoulli sum) when n_type · p · (1 − p) < 30
  and as a rounded, clamped normal otherwise. On the canary every request's odds are multiplied by
  ψ (ψ = 1 in G5-null, 1.5 in the G5 proceed cells): p' = ψp / (1 − p + ψp).

Missingness (G3, G4): on a tick with n_c > 0, a metric's observation is passed to the gate as absent
(`observations[id]` undefined). MCAR: absent with probability m, independent of everything.
Outcome-dependent (MNAR): the tick's observation is computed first; with X = b_c / (b_c + b_k)
against the traffic share n_c / (n_c + n_k), it is absent with probability 0.5 when X is below the
share (G3 rollback cells: the canary looked better) or above it (G3 proceed cells: the canary looked
worse), and present otherwise. Ticks with no bad events are never made absent.

Tolerances: rate ρ = 0.5, sign τ = 0.1 (as `2026-09-twin-null`). `worse` = higher throughout.

## 2. Measured quantities

All cells: `alphaRollback` = `alphaProceed` = `alphaSrm` = 0.05, `canaryWeight` 0.5.

**Shadow.** Beside the gate, the harness keeps its own per-metric states and sample-ratio wealths,
advanced over all T ticks with the engine's functions and the gate's branching
(`updateTwinMetric` on a present observation, `missTwinMetric` on an absent one while n_c > 0,
`skipTwinMetric` otherwise; `updatePairedBet` on the share and its complement). While the gate has
not reached a terminal verdict, every tick's shadow `rollbackE`, `proceedE` and `srmE` must equal
the gate's reported values exactly; any difference is a harness failure (§5).

Per cell, from the shadow, each with its binomial SE and the median first-crossing tick:
- **rollback crossing**: some metric's `rollbackE` ≥ N / 0.05 at some tick ≤ T (N = metric count);
- **proceed crossing**: every metric's `proceedE` ≥ 1 / 0.05 at the same tick, at some tick ≤ T;
- **guard crossing**: `srmE` ≥ 1 / 0.05 at some tick ≤ T.

From the gate: the fraction of replications ending in each verdict (`rollback`, `proceed`,
`invalid_experiment`, `inconclusive`) and the median terminal tick. Report only.

Bar B = α + 2.58 · √(α(1 − α)/R) = 0.0678 at α = 0.05.

A comparator cell (G3 `-skip`) keeps a second shadow that treats an absent observation as a
structural skip (`skipTwinMetric`) instead of the ½ penalty. Report-only: it shows what the penalty
prevents.

## 3. Cells

"Crossing" is the §2 shadow quantity named in the Measured column.

| Cell | Metrics | Truth | Measured (shadow) | Bar |
|---|---|---|---|---|
| G1-N1 | 1 rate | A/A | rollback crossing | ≤ B |
| G1-N3 | 2 rate + 1 sign | A/A | rollback crossing | ≤ B |
| G1-N8 | 4 rate + 4 sign | A/A | rollback crossing | ≤ B |
| G1-N3-dup | one rate observation under 3 ids | A/A | rollback crossing | ≤ B |
| G2-null | 1 rate | A/A, q 0.5 | guard crossing | ≤ B |
| G2-q0.49 | 1 rate | A/A, q 0.49 | guard crossing, median tick; rollback crossing | report; rollback ≤ B |
| G2-q0.45 | 1 rate | A/A, q 0.45 | guard crossing, median tick; rollback crossing | report; rollback ≤ B |
| G2-q0 | 1 rate | A/A, q 0 (canary gets no traffic) | guard crossing, median tick; rollback crossing | report; rollback ≤ B |
| G3-mcar0.1 | 1 rate | A/A, MCAR m 0.1 | rollback crossing | ≤ B |
| G3-mcar0.3 | 1 rate | A/A, MCAR m 0.3 | rollback crossing | ≤ B |
| G3-mnar-rb | 1 rate | A/A, MNAR hide canary-better | rollback crossing | ≤ B |
| G3-mnar-rb-skip | 1 rate, comparator shadow | as G3-mnar-rb | rollback crossing | report |
| G3-mnar-pr | 1 rate | canary ×1.5, MNAR hide canary-worse | proceed crossing | ≤ B |
| G3-mnar-pr-skip | 1 rate, comparator shadow | as G3-mnar-pr | proceed crossing | report |
| G4-m0, -m0.01, -m0.02, -m0.05, -m0.1, -m0.2 | 1 rate | canary ×1.2, MCAR m | rollback crossing (detection), median tick | report vs §4 |
| G5-null-het | 1 rate, Bernoulli | ψ 1, h 0.01, p_hot 0.95 | rollback crossing | ≤ B |
| G5-hom | 1 rate, Bernoulli | ψ 1.5, h 0 | proceed crossing | ≤ B |
| G5-het0.5 | 1 rate, Bernoulli | ψ 1.5, h 0.01, p_hot 0.5 | proceed crossing | report vs §4 |
| G5-het0.95 | 1 rate, Bernoulli | ψ 1.5, h 0.01, p_hot 0.95 | proceed crossing | report vs §4 |

G3-mnar-pr uses the G4 generator with mult 1.5 on the canary (a regression at the tolerance, where
the proceed test's null holds with equality in the Poisson regime, slightly inside it per
`2026-09-twin-null` P5).

## 4. Predictions (registered)

- **G1:** every cell ≤ B. False rollback ≤ 0.03 in G1-N1, G1-N3 and G1-N8 (each metric's capped bet
  at threshold N/α is conservative, and the union over N is bounded by α). G1-N3-dup ≈ one metric at
  α/3: ≤ 0.02.
- **G2:** G2-null ≤ 0.03 (the guard averages two one-sided wealths). The per-tick share has sd
  ≈ 0.5/√2000 ≈ 0.011. G2-q0.45: guard crossing in ≥ 99% of runs, median ≤ 10 ticks; G2-q0.49:
  ≥ 95%, median ≤ 100. G2-q0: guard crossing in every run at tick 10 to 12 (the downward wealth's
  bet is 0 on the first tick and at its cap of 1 afterwards, so it grows by 1.5 per tick while the
  upward wealth stays at 1; the average reaches 20 when 1.5^(t−1) ≥ 39, t = 11). Rollback crossings
  in G2 are ≤ B (the rate null is the observed share, so a routing fault does not move it); in the
  gate, `invalid_experiment` is checked first.
- **G3:** G3-mcar and G3-mnar-rb ≤ B, below G1-N1 (the penalty only lowers wealth). G3-mnar-pr ≤ B.
  The comparators exceed B: hiding half the canary-better ticks moves the kept ticks' mean X above
  the share by about 0.03 against a per-tick sd near 0.11 (≈ 20 bad events per tick), about 0.035
  nats of drift per tick, so G3-mnar-rb-skip crosses in > 50% of runs; G3-mnar-pr-skip likewise
  > 50%.
- **G4:** with g = ln 20 / 77 ≈ 0.039 nats per used tick and ln 2 lost per missing tick, the drift is
  (1 − m)g − m ln 2. Detection within T and median tick:
  - m 0: ≥ 0.99; median 60 to 100 (twin-null P4: 77).
  - m 0.01: ≥ 0.95; median 70 to 140 (drift ≈ 0.032, ≈ 95 ticks).
  - m 0.02: ≥ 0.90; median 90 to 190 (drift ≈ 0.024, ≈ 123 ticks).
  - m 0.05: drift ≈ 0.002: detection < 0.8, or the median among detected runs > 4× m 0's.
  - m 0.1 and m 0.2: drift negative: detection ≤ 0.2.
- **G5:** G5-null-het ≤ B (the rollback null holds under within-arm heterogeneity: b_c is central
  hypergeometric given the totals). G5-hom ≤ B. G5-het0.95 FAILS, false proceed > 0.5: the hot
  requests' events barely respond to a ×1.5 odds change (p 0.95 → 0.966), so the canary's share of
  events sits near 0.54 against a proceed null near 0.6. G5-het0.5 exceeds B.

## 5. Harness failure and NOT EXECUTABLE

A harness failure is: a shadow-to-gate mismatch (§2), an exception from the engine, or a
non-finite count reaching the gate. A cell with any harness failure is NOT EXECUTABLE: its numbers
are reported and not scored. A harness defect found this way is fixed test-first and the study
rerun under pre-registration rule 7, with the first run preserved.

## 6. Ship rule

This study cannot move authority. The gate's validity claims survive only if every cell with a bar
in §3 is within it: G1, G2-null's guard crossing and every G2 cell's rollback crossing, G3's
non-comparator cells, G5-null-het and G5-hom, and no cell is NOT EXECUTABLE. Any failure there is recorded in
ADR 0036's premise section and the twin envelopes, and DeploySignal's T3 plan is re-read against it
before any run. G4 and G5-het are the gate's measured costs and boundaries. They are written into
the envelope notes and into operator guidance (a metric source that drops ticks; the proceed side on
a heterogeneous `rate` metric) whatever they show.

## 7. Not measured

Persistent arm-level state and per-tick arm shocks (`2026-09-twin-null` P2); cold starts; unequal
routing weights beyond G2's faults; `sign` metrics under missingness; ties; dependence between
metrics other than none and identity (G1-N3-dup); traffic below 2000 requests per tick; any
horizon other than 2000 ticks; real telemetry.
