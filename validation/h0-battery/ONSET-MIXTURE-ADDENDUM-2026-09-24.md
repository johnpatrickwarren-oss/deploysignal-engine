# Onset-mixture addendum — the promoted e-value object on the battery's nulls (Amendment A5, 2026-09-24)

Governed by `PREREGISTRATION.md` Amendment A5, frozen at `81f45d4` before any adapter or run
existed. Canonical run: `results/live/run-20260925T023228Z` (study id
`2026-09-h0-battery-onset-mixture`, engine `0.9.0-pre`, one attempt per A5.7):
`node harness/run.mjs --mode live --arm onset-mixture`, N = 2000, T = 300, 156 P1 cells + 4 P2
cells. Every number below is pinned to that run's cell JSON by
`tests/test_onset_mixture_addendum.mjs`.

**Verdict wording is fixed by PREREGISTRATION §2.** An arm that survives a null is "not refuted at
these nulls". It is NOT evidence that the object is an e-value.

## The summary at α = 0.05 (P1 verbatim: FAIL iff the one-sided 95% lower bound exceeds α)

| adapter | N1 | N2-m30 | N2-m100 | N2-m500 | N3-p03 | N3-p06 | N3-p09 | N4-p06-m100 | N4-p09-m100 | N5 | N6 | N7 | N8 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| family_A_onset_mixture_geometric_gaussian | 0.0005 (not-refuted) | 0.2065 (FAIL) | 0.0235 (not-refuted) | 0.0015 (not-refuted) | 0.0005 (not-refuted) | 0.0005 (not-refuted) | 0.0005 (not-refuted) | 0.0275 (not-refuted) | 0.0535 (not-refuted) | 0.0330 (not-refuted) | 0.0120 (not-refuted) | 0.0005 (not-refuted) | 0.0125 (not-refuted) |
| family_A_onset_mixture_geometric_bounded | 0.0000 (not-refuted) | 0.2325 (FAIL) | 0.0465 (not-refuted) | 0.0020 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0745 (FAIL) | 0.2005 (FAIL) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) |
| family_A_onset_mixture_normalized_gaussian | 0.0010 (not-refuted) | 0.2285 (FAIL) | 0.0365 (not-refuted) | 0.0025 (not-refuted) | 0.0010 (not-refuted) | 0.0010 (not-refuted) | 0.0010 (not-refuted) | 0.0390 (not-refuted) | 0.0670 (FAIL) | 0.0555 (not-refuted) | 0.0235 (not-refuted) | 0.0010 (not-refuted) | 0.0240 (not-refuted) |
| family_A_onset_mixture_normalized_bounded | 0.0000 (not-refuted) | 0.2325 (FAIL) | 0.0485 (not-refuted) | 0.0020 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0770 (FAIL) | 0.2090 (FAIL) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) | 0.0000 (not-refuted) |

## Against the registered expectations (A5.4), group by group

| null group | registered | measured | reading |
|---|---|---|---|
| N1, N3-p03/p06/p09, N7 (Gaussian, oracle) | not-refuted, all arms | **not-refuted, all arms**, rates ≤ 0.001 at α = 0.05 | confirmed. The construction as ported does not fire on its own premise; falsifier (i) did not trigger. The rates sit far below α — the √E−1 adjuster and the per-tick cap are conservative at T = 300 (S1 below). |
| N2-m30 | FAIL, all arms | **FAIL, all arms** (0.21–0.23) | confirmed: the plug-in centre from 30 samples is a mean shift every arm bets on. |
| N2-m100 | Gaussian FAIL expected; bounded either | Gaussian **not-refuted** (0.024 / 0.037); bounded not-refuted at 0.05, **FAIL at 0.01** (0.047 / 0.049) | **surprise on the Gaussian arms**, in the direction of validity. Recorded, not re-cut. |
| N2-m500 | either | not-refuted, all arms (≤ 0.003) | in band. |
| N4-p06-m100, N4-p09-m100 (estimated φ) | Gaussian FAIL; bounded either | Gaussian: geometric FAILs only N4-p09 at 0.01; normalized FAILs N4-p09 at both α and N4-p06 at 0.01. Bounded: **FAIL both nulls, both α** (0.075 / 0.20) | **the bounded arms are the more inflated under a mis-estimated φ** (0.20 at φ = 0.9 against the Gaussian arms' 0.05–0.07): scale-robustness does not help when the residual is left autocorrelated, and the bounded bet's surviving nuisance — the centre — is exactly what a wrong φ corrupts. Consistent with the bounded envelope's own statement. |
| N5 (lognormal), N6 (t₃), N8 (AR(1) φ = 0.9, t₃ innovations) | Gaussian **FAIL**; bounded not-refuted | Gaussian arms **not-refuted** (0.033 / 0.056, 0.012 / 0.024, 0.013 / 0.024); bounded arms **0.000** | **the registered FAIL expectations for the Gaussian arms did not materialise.** They rested on the increment's expectation (a standardised lognormal or t₃ has no mgf, so E[g] = ∞ before the cap); P1 measures the crossing rate at T = 300, and a capped increment whose mean exceeds 1 can still cross 1/α rarely over 300 ticks. The per-tick increment mean — the C26 instrument for this class — is out of scope by A5.8 and is the follow-up that decides it. The bounded arms confirm their envelope's variance-robustness claim exactly (0.000 on all three); falsifier (ii) did not trigger. |
| P2 (3σ at tick 100, N1) | pass, ≥ 0.95 | **0.9995 / 1.0000 / 1.0000 / 1.0000** | confirmed; no arm passes vacuously. |

**What this run establishes.** On every null whose premise the envelopes state — Gaussian, oracle
centre and scale, whitened at the true φ — none of the four arms is refuted, at either α, on the
crossing-rate instrument. On the plug-in nulls the arms fail as every plug-in wealth in this
battery fails, and the arm count is the one new number: at m = 30 the object is as inflated as
the betting e-process (0.21–0.23 against betting's 0.40 at α = 0.05 — less, not more). On
estimated φ the bounded arms fail and the Gaussian arms are marginal.

**What this run does not establish.** That the object is an e-value (§2); the increment's mean
under heavy tails (A5.8), which is where the three unconfirmed expectations must be decided; any
composition (rack, fleet, cascade); power beyond the P2 step. N7 equals N1 for this object
(nothing windowed) and is reported once.

**Comparability (A5.2).** This arm standardises the whitened residual by the innovation scale;
the battery's betting adapter lets the engine standardise by the marginal σ. The two arms' N3 rows
are therefore not comparable and are not compared here.

## P2 — vacuous-pass guard

P2: detector=family_A_onset_mixture_geometric_bounded detection_rate=1.0000 verdict=pass
P2: detector=family_A_onset_mixture_geometric_gaussian detection_rate=0.9995 verdict=pass
P2: detector=family_A_onset_mixture_normalized_bounded detection_rate=1.0000 verdict=pass
P2: detector=family_A_onset_mixture_normalized_gaussian detection_rate=1.0000 verdict=pass

## S1 (descriptive, §6) — mean log e at α = 0.05

Per adapter: N1, then the mean over all thirteen nulls. The normalized Gaussian arm's large
negative means come from the √E−1 clamp: a trajectory whose peak mixture value never exceeds 1
reads e = 0, logged at the 1e-300 floor, so the mean is dominated by the fraction of clamped
trajectories, not by wealth. Descriptive only.

```
family_A_onset_mixture_geometric_gaussian N1 -3.091 all -2.297
family_A_onset_mixture_geometric_bounded N1 -2.454 all -1.872
family_A_onset_mixture_normalized_gaussian N1 -60.305 all -46.910
family_A_onset_mixture_normalized_bounded N1 -2.667 all -2.133
```

## Cells

family_A_onset_mixture_geometric_bounded N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N1 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N1 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N2-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_bounded N2-m100 alpha=0.01 rate=0.0160 lower95=0.0120 verdict=FAIL
family_A_onset_mixture_geometric_bounded N2-m100 alpha=0.05 rate=0.0465 lower95=0.0393 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N2-m30 alpha=0.0001 rate=0.0450 lower95=0.0380 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_bounded N2-m30 alpha=0.01 rate=0.1415 lower95=0.1292 verdict=FAIL
family_A_onset_mixture_geometric_bounded N2-m30 alpha=0.05 rate=0.2325 lower95=0.2173 verdict=FAIL
family_A_onset_mixture_geometric_bounded N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N2-m500 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N2-m500 alpha=0.05 rate=0.0020 lower95=0.0009 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p03 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N3-p03 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p03 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p06 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N3-p06 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p06 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p09 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N3-p09 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N3-p09 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N4-p06-m100 alpha=0.0001 rate=0.0040 lower95=0.0023 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_bounded N4-p06-m100 alpha=0.01 rate=0.0335 lower95=0.0275 verdict=FAIL
family_A_onset_mixture_geometric_bounded N4-p06-m100 alpha=0.05 rate=0.0745 lower95=0.0654 verdict=FAIL
family_A_onset_mixture_geometric_bounded N4-p09-m100 alpha=0.0001 rate=0.0410 lower95=0.0343 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_bounded N4-p09-m100 alpha=0.01 rate=0.1210 lower95=0.1095 verdict=FAIL
family_A_onset_mixture_geometric_bounded N4-p09-m100 alpha=0.05 rate=0.2005 lower95=0.1862 verdict=FAIL
family_A_onset_mixture_geometric_bounded N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N5 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N5 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N6 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N6 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N7 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N7 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N8 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_bounded N8 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_bounded N8 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N1 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N1 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N2-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_gaussian N2-m100 alpha=0.01 rate=0.0095 lower95=0.0065 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N2-m100 alpha=0.05 rate=0.0235 lower95=0.0185 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N2-m30 alpha=0.0001 rate=0.0870 lower95=0.0772 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_gaussian N2-m30 alpha=0.01 rate=0.1600 lower95=0.1470 verdict=FAIL
family_A_onset_mixture_geometric_gaussian N2-m30 alpha=0.05 rate=0.2065 lower95=0.1920 verdict=FAIL
family_A_onset_mixture_geometric_gaussian N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N2-m500 alpha=0.01 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N2-m500 alpha=0.05 rate=0.0015 lower95=0.0006 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p03 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N3-p03 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p03 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p06 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N3-p06 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p06 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p09 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N3-p09 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N3-p09 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N4-p06-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_gaussian N4-p06-m100 alpha=0.01 rate=0.0125 lower95=0.0090 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N4-p06-m100 alpha=0.05 rate=0.0275 lower95=0.0221 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N4-p09-m100 alpha=0.0001 rate=0.0135 lower95=0.0099 verdict=FAIL (descriptive)
family_A_onset_mixture_geometric_gaussian N4-p09-m100 alpha=0.01 rate=0.0335 lower95=0.0275 verdict=FAIL
family_A_onset_mixture_geometric_gaussian N4-p09-m100 alpha=0.05 rate=0.0535 lower95=0.0458 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N5 alpha=0.01 rate=0.0050 lower95=0.0030 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N5 alpha=0.05 rate=0.0330 lower95=0.0270 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N6 alpha=0.01 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N6 alpha=0.05 rate=0.0120 lower95=0.0086 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N7 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N7 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N8 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_geometric_gaussian N8 alpha=0.01 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_geometric_gaussian N8 alpha=0.05 rate=0.0125 lower95=0.0090 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N1 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N1 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N2-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_bounded N2-m100 alpha=0.01 rate=0.0155 lower95=0.0116 verdict=FAIL
family_A_onset_mixture_normalized_bounded N2-m100 alpha=0.05 rate=0.0485 lower95=0.0412 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N2-m30 alpha=0.0001 rate=0.0435 lower95=0.0366 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_bounded N2-m30 alpha=0.01 rate=0.1435 lower95=0.1311 verdict=FAIL
family_A_onset_mixture_normalized_bounded N2-m30 alpha=0.05 rate=0.2325 lower95=0.2173 verdict=FAIL
family_A_onset_mixture_normalized_bounded N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N2-m500 alpha=0.01 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N2-m500 alpha=0.05 rate=0.0020 lower95=0.0009 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p03 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N3-p03 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p03 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p06 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N3-p06 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p06 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p09 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N3-p09 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N3-p09 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N4-p06-m100 alpha=0.0001 rate=0.0040 lower95=0.0023 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_bounded N4-p06-m100 alpha=0.01 rate=0.0330 lower95=0.0270 verdict=FAIL
family_A_onset_mixture_normalized_bounded N4-p06-m100 alpha=0.05 rate=0.0770 lower95=0.0678 verdict=FAIL
family_A_onset_mixture_normalized_bounded N4-p09-m100 alpha=0.0001 rate=0.0405 lower95=0.0338 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_bounded N4-p09-m100 alpha=0.01 rate=0.1215 lower95=0.1100 verdict=FAIL
family_A_onset_mixture_normalized_bounded N4-p09-m100 alpha=0.05 rate=0.2090 lower95=0.1944 verdict=FAIL
family_A_onset_mixture_normalized_bounded N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N5 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N5 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N6 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N6 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N7 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N7 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N8 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_bounded N8 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_bounded N8 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N1 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N1 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N2-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_gaussian N2-m100 alpha=0.01 rate=0.0120 lower95=0.0086 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N2-m100 alpha=0.05 rate=0.0365 lower95=0.0302 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N2-m30 alpha=0.0001 rate=0.0890 lower95=0.0791 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_gaussian N2-m30 alpha=0.01 rate=0.1715 lower95=0.1581 verdict=FAIL
family_A_onset_mixture_normalized_gaussian N2-m30 alpha=0.05 rate=0.2285 lower95=0.2134 verdict=FAIL
family_A_onset_mixture_normalized_gaussian N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N2-m500 alpha=0.01 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N2-m500 alpha=0.05 rate=0.0025 lower95=0.0012 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p03 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N3-p03 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p03 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p06 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N3-p06 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p06 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p09 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N3-p09 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N3-p09 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N4-p06-m100 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_gaussian N4-p06-m100 alpha=0.01 rate=0.0155 lower95=0.0116 verdict=FAIL
family_A_onset_mixture_normalized_gaussian N4-p06-m100 alpha=0.05 rate=0.0390 lower95=0.0325 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N4-p09-m100 alpha=0.0001 rate=0.0140 lower95=0.0103 verdict=FAIL (descriptive)
family_A_onset_mixture_normalized_gaussian N4-p09-m100 alpha=0.01 rate=0.0395 lower95=0.0329 verdict=FAIL
family_A_onset_mixture_normalized_gaussian N4-p09-m100 alpha=0.05 rate=0.0670 lower95=0.0584 verdict=FAIL
family_A_onset_mixture_normalized_gaussian N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N5 alpha=0.01 rate=0.0105 lower95=0.0074 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N5 alpha=0.05 rate=0.0555 lower95=0.0477 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N6 alpha=0.01 rate=0.0025 lower95=0.0012 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N6 alpha=0.05 rate=0.0235 lower95=0.0185 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N7 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N7 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N8 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_onset_mixture_normalized_gaussian N8 alpha=0.01 rate=0.0025 lower95=0.0012 verdict=not-refuted
family_A_onset_mixture_normalized_gaussian N8 alpha=0.05 rate=0.0240 lower95=0.0190 verdict=not-refuted
