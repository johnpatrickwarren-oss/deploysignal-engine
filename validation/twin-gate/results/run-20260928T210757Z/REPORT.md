# 2026-09-twin-gate — run-20260928T210757Z

T = 2000, R = 1000, α = 0.05 (all three), bar B = 0.0678. Registered: ../../PREREGISTRATION.md.
Crossings are the shadow's full-horizon first crossings (fraction ± SE, median tick); gate = the gate's own verdict fractions.

| cell | rollback crossing | proceed crossing | guard crossing | comparator | gate R / P / I / inc | harness failures | bar | verdict |
|---|---|---|---|---|---|---|---|---|
| G1-N1 | 0.0160 ± 0.0040 (595) | 1.0000 ± 0.0000 (29) | 0.0000 ± 0.0000 (–) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G1-N3 | 0.0220 ± 0.0046 (461) | 1.0000 ± 0.0000 (191) | 0.0000 ± 0.0000 (–) | – | 0.012 / 0.988 / 0.000 / 0.000 | 0 | rollback | PASS |
| G1-N8 | 0.0230 ± 0.0047 (116) | 1.0000 ± 0.0000 (375) | 0.0000 ± 0.0000 (–) | – | 0.014 / 0.986 / 0.000 / 0.000 | 0 | rollback | PASS |
| G1-N3-dup | 0.0090 ± 0.0030 (769) | 1.0000 ± 0.0000 (29) | 0.0000 ± 0.0000 (–) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G2-null | 0.0170 ± 0.0041 (797) | 1.0000 ± 0.0000 (29) | 0.0000 ± 0.0000 (–) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | guard | PASS |
| G2-q0.49 | 0.0370 ± 0.0060 (631) | 1.0000 ± 0.0000 (29) | 1.0000 ± 0.0000 (374) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G2-q0.45 | 0.0190 ± 0.0043 (649) | 1.0000 ± 0.0000 (31) | 1.0000 ± 0.0000 (76) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G2-q0 | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 1.0000 ± 0.0000 (10) | – | 0.000 / 0.000 / 1.000 / 0.000 | 0 | rollback | PASS |
| G3-mcar0.1 | 0.0000 ± 0.0000 (–) | 1.0000 ± 0.0000 (85) | 0.0000 ± 0.0000 (–) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G3-mcar0.3 | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | – | 0.000 / 0.000 / 0.000 / 1.000 | 0 | rollback | PASS |
| G3-mnar-rb | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | – | 0.000 / 0.000 / 0.000 / 1.000 | 0 | rollback | PASS |
| G3-mnar-rb-skip | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | R 1.0000 ± 0.0000 (204); P 1.0000 ± 0.0000 (53) | 0.000 / 0.000 / 0.000 / 1.000 | 0 | report | – |
| G3-mnar-pr | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | – | 0.000 / 0.000 / 0.000 / 1.000 | 0 | proceed | PASS |
| G3-mnar-pr-skip | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | R 1.0000 ± 0.0000 (73); P 0.9990 ± 0.0010 (709) | 0.000 / 0.000 / 0.000 / 1.000 | 0 | report | – |
| G4-m0 | 1.0000 ± 0.0000 (77) | 1.0000 ± 0.0000 (55) | 0.0000 ± 0.0000 (–) | – | 0.276 / 0.724 / 0.000 / 0.000 | 0 | report | – |
| G4-m0.01 | 1.0000 ± 0.0000 (94) | 1.0000 ± 0.0000 (61) | 0.0000 ± 0.0000 (–) | – | 0.222 / 0.778 / 0.000 / 0.000 | 0 | report | – |
| G4-m0.02 | 1.0000 ± 0.0000 (114) | 1.0000 ± 0.0000 (72) | 0.0000 ± 0.0000 (–) | – | 0.236 / 0.764 / 0.000 / 0.000 | 0 | report | – |
| G4-m0.05 | 0.8290 ± 0.0119 (295) | 1.0000 ± 0.0000 (127) | 0.0000 ± 0.0000 (–) | – | 0.118 / 0.882 / 0.000 / 0.000 | 0 | report | – |
| G4-m0.1 | 0.0090 ± 0.0030 (79) | 0.1460 ± 0.0112 (153) | 0.0000 ± 0.0000 (–) | – | 0.008 / 0.143 / 0.000 / 0.849 | 0 | report | – |
| G4-m0.2 | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | 0.0000 ± 0.0000 (–) | – | 0.000 / 0.000 / 0.000 / 1.000 | 0 | report | – |
| G5-null-het | 0.0150 ± 0.0038 (1134) | 1.0000 ± 0.0000 (27) | 0.0000 ± 0.0000 (–) | – | 0.000 / 1.000 / 0.000 / 0.000 | 0 | rollback | PASS |
| G5-hom | 1.0000 ± 0.0000 (35) | 0.0220 ± 0.0046 (301) | 0.0000 ± 0.0000 (–) | – | 1.000 / 0.000 / 0.000 / 0.000 | 0 | proceed | PASS |
| G5-het0.5 | 1.0000 ± 0.0000 (45) | 1.0000 ± 0.0000 (125) | 0.0000 ± 0.0000 (–) | – | 0.960 / 0.040 / 0.000 / 0.000 | 0 | report | – |
| G5-het0.95 | 1.0000 ± 0.0000 (79) | 1.0000 ± 0.0000 (46) | 0.0000 ± 0.0000 (–) | – | 0.035 / 0.965 / 0.000 / 0.000 | 0 | report | – |

Harness failures: 0 in every cell (the shadow equalled the gate's reported `rollbackE`, `proceedE`
and `srmE` on every tick before the gate's terminal verdict). Run: 122.9 s, Node v25.9.0, engine
`v0.12.2-pre` dist at `0434afc` (the harness commit `2ec1e49` changed no engine file).

### Ship rule (§6): MET

| Bar | Cells | Result |
|---|---|---|
| rollback crossing ≤ B | G1-N1 / N3 / N8 / N3-dup | 0.016 / 0.022 / 0.023 / 0.009 — PASS ×4 |
| guard crossing ≤ B | G2-null | 0.000 — PASS |
| rollback crossing ≤ B | G2-q0.49 / q0.45 / q0 | 0.037 / 0.019 / 0.000 — PASS ×3 |
| rollback crossing ≤ B | G3-mcar0.1 / mcar0.3 / mnar-rb | 0.000 / 0.000 / 0.000 — PASS ×3 |
| proceed crossing ≤ B | G3-mnar-pr | 0.000 — PASS |
| rollback crossing ≤ B | G5-null-het | 0.015 — PASS |
| proceed crossing ≤ B | G5-hom | 0.022 — PASS |

No cell is NOT EXECUTABLE. The gate's three error statements held at the gate level in every
registered validity cell. Authority is unchanged (§6): this study cannot move it.

### Predictions (§4)

| Prediction | Held? | Numbers |
|---|---|---|
| G1 every cell ≤ B; ≤ 0.03 for N1, N3, N8; N3-dup ≤ 0.02 | HELD | 0.016, 0.022, 0.023; 0.009 |
| G2-null ≤ 0.03 | HELD | 0.000 |
| G2-q0.45 guard ≥ 99%, median ≤ 10 ticks | NOT HELD (speed) | 1.000, median 76 |
| G2-q0.49 guard ≥ 95%, median ≤ 100 | NOT HELD (speed) | 1.000, median 374 |
| G2-q0 guard in every run at tick 10 to 12 | HELD | 1.000; shadow index 10, gate tick 11 in every run |
| G2 rollback crossings ≤ B | HELD | 0.037, 0.019, 0.000 |
| G3 penalty cells ≤ B and below G1-N1 | HELD | 0.000 ×3 (rollback); 0.000 (proceed) |
| G3 comparators > 0.5 | HELD | skip-rb 1.000 (median 204); skip-pr 0.999 (median 709) |
| G4 m 0: ≥ 0.99, median 60 to 100 | HELD | 1.000, 77 |
| G4 m 0.01: ≥ 0.95, median 70 to 140 | HELD | 1.000, 94 |
| G4 m 0.02: ≥ 0.90, median 90 to 190 | HELD | 1.000, 114 |
| G4 m 0.05: detection < 0.8, or median > 4 × m 0's (308) | NOT HELD (marginal) | 0.829, median 295 |
| G4 m 0.1 and 0.2: detection ≤ 0.2 | HELD | 0.009, 0.000 |
| G5-null-het ≤ B | HELD | 0.015 |
| G5-hom ≤ B | HELD | 0.022 |
| G5-het0.95 false proceed > 0.5 | HELD | 1.000 (median 46) |
| G5-het0.5 exceeds B | HELD | 1.000 (median 125) |

**Why the G2 speed predictions failed.** The guard's bets are capped at λ ≤ ½ / (m − lo) = 1 for a
share on [0, 1] with null 0.5, so one tick multiplies the wealth by at most 1 + |q − 0.5|. The
prediction reasoned from the share's per-tick sd (≈ 0.011) as if the bet could scale to it. With
the cap, the fastest growth is ln(1.05) ≈ 0.049 nats per tick at q 0.45 and ln(1.01) ≈ 0.010 at
q 0.49; reaching an average wealth of 20 needs one side near 40, so ln 40 / 0.049 ≈ 75 and
ln 40 / 0.010 ≈ 370 ticks, which the run gives (76, 374). Post hoc; carries no verdict.

### Gate-level findings (report-only; the gate's own verdicts, not the shadow)

- **At a sub-tolerance regression the gate proceeds more often than it rolls back.** G4-m0 (canary
  bad-event rate ×1.2, tolerance ρ 0.5): the rollback test crosses in every run (median 77), but the
  proceed test crosses first (median 55), so the gate's verdict is `proceed` in 72.4% of runs and
  `rollback` in 27.6%. This is the gate's contract: ρ is the smallest regression worth blocking, and
  ×1.2 is below ×1.5. It means ρ must be set to the smallest regression an operator would block;
  at ρ 0.5 the gate is designed to pass a 20% regression most of the time. `2026-09-twin-null` P4
  reported only the per-metric rollback crossing and could not show this.
- **Missing ticks slow both sides, and 30% missing leaves the gate undecided.** Proceed median: 30
  ticks (G2-null, no missingness), 86 at MCAR 0.1; at MCAR 0.3 and in both MNAR cells every run
  ends `inconclusive` at T. Rollback power collapses between 5% and 10% missing (G4: 0.829 at 0.05,
  0.009 at 0.1); G4-m0.1 ends `inconclusive` in 84.9% of runs. A metric source that drops ≥ 10% of
  ticks makes the gate unable to roll back or proceed on that metric within 2000 ticks.
- **The penalty is what holds the bounds under outcome-dependent missingness.** Treating a hidden
  tick as a skip instead (the comparators) gave false rollback 1.000 and false proceed 0.999.
- **The guard is slower than the proceed test.** A routing fault at q 0.45 is flagged at median tick
  76; the A/A proceed test crosses at median 31, so in G2-q0.45 and G2-q0.49 the gate proceeds in
  every run before the guard fires. The rate test stays valid under an outcome-independent routing
  fault (its null is the observed share), so these proceeds are not errors here; a routing fault
  correlated with outcome was not simulated. With no canary traffic (G2-q0) the gate returns
  `invalid_experiment` at tick 11 in every run.
- **Heterogeneity: per-request and pooled "at tolerance" part, as §0 disclosed.** With every
  request's odds ×1.5, the pooled canary-to-control ratio of bad events per request is ×1.18 when
  1% of requests fail at 0.95 (G5-het0.95: 17.07 against 14.45 per 1000 requests at mean traffic)
  and ×1.35 at 0.5 (G5-het0.5: 13.41 against 9.95). The proceed test compares against the pooled
  odds, so G5-het0.95's gate verdict is `proceed` in 96.5% of runs: correct for a pooled tolerance,
  a false clear for a per-request one. At p_hot 0.5 the rollback test wins first (gate `rollback`
  96.0%). Rollback validity is unaffected by heterogeneity (G5-null-het 0.015).
- **Bonferroni at the gate.** With N metrics under A/A the gate's `rollback` verdict fraction was
  0.000 (N1), 0.012 (N3), 0.014 (N8): the proceed test usually ends the run first. The full-horizon
  crossings above (0.016 to 0.023) are the bound's test.

### Disclosures

- The G5 binomial draws use geometric waiting times between successes below variance 30: the same
  distribution as the registered Bernoulli sum, drawn by a different exact method.
- The Poisson draws above mean 30 are a rounded normal, as in `2026-09-twin-null` (traffic on every
  tick; bad events in no G1–G4 cell reach mean 30 at this traffic).

### Not measured by this study

Persistent arm-level state and per-tick arm shocks (see `2026-09-twin-null` P2); cold starts;
routing faults correlated with outcome; `sign` metrics under missingness; ties; metric dependence
other than none and identity; traffic below 2000 requests per tick; horizons other than 2000
ticks; real telemetry (T3).
