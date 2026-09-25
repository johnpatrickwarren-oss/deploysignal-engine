# Increment-arm addendum — the per-tick increment mean of the onset-mixture object (Amendment A6, 2026-09-24)

Governed by `PREREGISTRATION.md` Amendment A6, frozen at `126023a` before any harness or run
existed; predictions derived by quadrature (A6.3) before that commit. Canonical run:
`results/live/inc-20260925T044059Z` (study id `2026-09-h0-battery-onset-mixture-increment`,
engine `0.9.0-pre` at `c9de2de`, one attempt per A6.7): `node harness/run-increment-arm.mjs
--mode live`, N = 2000 trajectories × T = 2000 ticks = 4,000,000 pooled increments per cell,
45 cells (5 nulls × 9 increment kinds). Every number below is pinned to that run's cell JSON by
`tests/test_increment_arm_addendum.mjs`.

**What is measured.** The marginal mean of the shipped per-tick increment on the A5.2-standardised
residual, read through the engine's own `incrementEstimate` (Welford mean, normal-theory 95%
interval). A convex mixture of SR e-processes is an e-process exactly when each increment has
conditional mean ≤ 1, so this is the object's validity instrument (C26's for the class), not a
crossing rate at a horizon. **Verdict tokens (A6.2):** `REFUTED` iff the 95% lower bound exceeds
the card bound 1.0005; `CLEARED` iff the upper bound is below it. The detector-audit house rule
(REFUTED iff lower95 > 1) is recorded beside each cell and agrees with the scored token on every
cell. A `CLEARED` cell says the mean is below 1.0005 on this null at this size; it is not a proof
that the increment is an e-value.

## The summary: mean [95% interval] verdict, per null and increment kind

| increment kind | λ | N1 | N3-p09 | N5 | N6 | N8 |
|---|---|---|---|---|---|---|
| gaussian | — | 0.99677 [0.99519, 0.99834] CLEARED | 0.99736 [0.99578, 0.99894] CLEARED | 1.91179 [1.90231, 1.92127] REFUTED | 1.60769 [1.59971, 1.61568] REFUTED | 1.60769 [1.59970, 1.61568] REFUTED |
| bounded_lp01 | 0.1 | 0.99999 [0.99996, 1.00003] CLEARED | 0.99999 [0.99995, 1.00002] CLEARED | 0.99907 [0.99905, 0.99910] CLEARED | 1.00000 [0.99998, 1.00003] CLEARED | 1.00000 [0.99998, 1.00003] CLEARED |
| bounded_lp03 | 0.3 | 0.99998 [0.99989, 1.00008] CLEARED | 0.99996 [0.99986, 1.00005] CLEARED | 0.99722 [0.99714, 0.99731] CLEARED | 1.00001 [0.99993, 1.00010] CLEARED | 1.00001 [0.99993, 1.00010] CLEARED |
| bounded_lp06 | 0.6 | 0.99997 [0.99977, 1.00016] CLEARED | 0.99991 [0.99972, 1.00011] CLEARED | 0.99445 [0.99428, 0.99461] CLEARED | 1.00003 [0.99986, 1.00019] CLEARED | 1.00003 [0.99986, 1.00020] CLEARED |
| bounded_lp09 | 0.9 | 0.99995 [0.99966, 1.00024] CLEARED | 0.99987 [0.99957, 1.00016] CLEARED | 0.99167 [0.99142, 0.99192] CLEARED | 1.00004 [0.99979, 1.00029] CLEARED | 1.00004 [0.99979, 1.00029] CLEARED |
| bounded_lm01 | -0.1 | 1.00001 [0.99997, 1.00004] CLEARED | 1.00001 [0.99998, 1.00005] CLEARED | 1.00093 [1.00090, 1.00095] REFUTED | 1.00000 [0.99997, 1.00002] CLEARED | 1.00000 [0.99997, 1.00002] CLEARED |
| bounded_lm03 | -0.3 | 1.00002 [0.99992, 1.00011] CLEARED | 1.00004 [0.99995, 1.00014] CLEARED | 1.00278 [1.00269, 1.00286] REFUTED | 0.99999 [0.99990, 1.00007] CLEARED | 0.99999 [0.99990, 1.00007] CLEARED |
| bounded_lm06 | -0.6 | 1.00003 [0.99984, 1.00023] CLEARED | 1.00009 [0.99989, 1.00028] CLEARED | 1.00555 [1.00539, 1.00572] REFUTED | 0.99997 [0.99981, 1.00014] CLEARED | 0.99997 [0.99980, 1.00014] CLEARED |
| bounded_lm09 | -0.9 | 1.00005 [0.99976, 1.00034] CLEARED | 1.00013 [0.99984, 1.00043] CLEARED | 1.00833 [1.00808, 1.00858] REFUTED | 0.99996 [0.99971, 1.00021] CLEARED | 0.99996 [0.99971, 1.00021] CLEARED |

The A6.4 executability checks held: N1 Gaussian 0.99677 is within 0.003 of the derived 0.99775
and not REFUTED; N1 bounded λ = 0.1 is not REFUTED; the standardised generators' variances on
200,000 draws were 1.0009 (N1), 1.0009 (N3-p09), 0.9948 (N5), 0.9830 (N6), 0.9830 (N8)
(`manifest.json`, `generator_variances`).

## Against the registered predictions (A6.3): all 45 within tolerance

Every cell's verdict is the registered one and every measured mean lies within its registered
tolerance of the quadrature value. None of the three falsifiers accepted in advance triggered.

| null | kind | λ | registered | tolerance | measured | gap | within |
|---|---|---|---|---|---|---|---|
| N1 | gaussian | — | 0.99775 | 0.003 | 0.99677 | -0.00098 | yes |
| N1 | bounded_lp01 | 0.1 | 1.00000 | 0.001 | 0.99999 | -0.00001 | yes |
| N1 | bounded_lp03 | 0.3 | 1.00000 | 0.001 | 0.99998 | -0.00002 | yes |
| N1 | bounded_lp06 | 0.6 | 1.00000 | 0.001 | 0.99997 | -0.00003 | yes |
| N1 | bounded_lp09 | 0.9 | 1.00000 | 0.001 | 0.99995 | -0.00005 | yes |
| N1 | bounded_lm01 | -0.1 | 1.00000 | 0.001 | 1.00001 | +0.00001 | yes |
| N1 | bounded_lm03 | -0.3 | 1.00000 | 0.001 | 1.00002 | +0.00002 | yes |
| N1 | bounded_lm06 | -0.6 | 1.00000 | 0.001 | 1.00003 | +0.00003 | yes |
| N1 | bounded_lm09 | -0.9 | 1.00000 | 0.001 | 1.00005 | +0.00005 | yes |
| N3-p09 | gaussian | — | 0.99775 | 0.003 | 0.99736 | -0.00039 | yes |
| N3-p09 | bounded_lp01 | 0.1 | 1.00000 | 0.001 | 0.99999 | -0.00001 | yes |
| N3-p09 | bounded_lp03 | 0.3 | 1.00000 | 0.001 | 0.99996 | -0.00004 | yes |
| N3-p09 | bounded_lp06 | 0.6 | 1.00000 | 0.001 | 0.99991 | -0.00009 | yes |
| N3-p09 | bounded_lp09 | 0.9 | 1.00000 | 0.001 | 0.99987 | -0.00013 | yes |
| N3-p09 | bounded_lm01 | -0.1 | 1.00000 | 0.001 | 1.00001 | +0.00001 | yes |
| N3-p09 | bounded_lm03 | -0.3 | 1.00000 | 0.001 | 1.00004 | +0.00004 | yes |
| N3-p09 | bounded_lm06 | -0.6 | 1.00000 | 0.001 | 1.00009 | +0.00009 | yes |
| N3-p09 | bounded_lm09 | -0.9 | 1.00000 | 0.001 | 1.00013 | +0.00013 | yes |
| N5 | gaussian | — | 1.91833 | 0.05 | 1.91179 | -0.00654 | yes |
| N5 | bounded_lp01 | 0.1 | 0.99908 | 0.001 | 0.99907 | -0.00000 | yes |
| N5 | bounded_lp03 | 0.3 | 0.99723 | 0.001 | 0.99722 | -0.00000 | yes |
| N5 | bounded_lp06 | 0.6 | 0.99446 | 0.001 | 0.99445 | -0.00001 | yes |
| N5 | bounded_lp09 | 0.9 | 0.99168 | 0.001 | 0.99167 | -0.00001 | yes |
| N5 | bounded_lm01 | -0.1 | 1.00092 | 0.001 | 1.00093 | +0.00000 | yes |
| N5 | bounded_lm03 | -0.3 | 1.00277 | 0.001 | 1.00278 | +0.00000 | yes |
| N5 | bounded_lm06 | -0.6 | 1.00554 | 0.001 | 1.00555 | +0.00001 | yes |
| N5 | bounded_lm09 | -0.9 | 1.00832 | 0.001 | 1.00833 | +0.00001 | yes |
| N6 | gaussian | — | 1.61281 | 0.05 | 1.60769 | -0.00512 | yes |
| N6 | bounded_lp01 | 0.1 | 1.00000 | 0.001 | 1.00000 | +0.00000 | yes |
| N6 | bounded_lp03 | 0.3 | 1.00000 | 0.001 | 1.00001 | +0.00001 | yes |
| N6 | bounded_lp06 | 0.6 | 1.00000 | 0.001 | 1.00003 | +0.00003 | yes |
| N6 | bounded_lp09 | 0.9 | 1.00000 | 0.001 | 1.00004 | +0.00004 | yes |
| N6 | bounded_lm01 | -0.1 | 1.00000 | 0.001 | 1.00000 | -0.00000 | yes |
| N6 | bounded_lm03 | -0.3 | 1.00000 | 0.001 | 0.99999 | -0.00001 | yes |
| N6 | bounded_lm06 | -0.6 | 1.00000 | 0.001 | 0.99997 | -0.00003 | yes |
| N6 | bounded_lm09 | -0.9 | 1.00000 | 0.001 | 0.99996 | -0.00004 | yes |
| N8 | gaussian | — | 1.61281 | 0.05 | 1.60769 | -0.00512 | yes |
| N8 | bounded_lp01 | 0.1 | 1.00000 | 0.001 | 1.00000 | +0.00000 | yes |
| N8 | bounded_lp03 | 0.3 | 1.00000 | 0.001 | 1.00001 | +0.00001 | yes |
| N8 | bounded_lp06 | 0.6 | 1.00000 | 0.001 | 1.00003 | +0.00003 | yes |
| N8 | bounded_lp09 | 0.9 | 1.00000 | 0.001 | 1.00004 | +0.00004 | yes |
| N8 | bounded_lm01 | -0.1 | 1.00000 | 0.001 | 1.00000 | -0.00000 | yes |
| N8 | bounded_lm03 | -0.3 | 1.00000 | 0.001 | 0.99999 | -0.00001 | yes |
| N8 | bounded_lm06 | -0.6 | 1.00000 | 0.001 | 0.99997 | -0.00003 | yes |
| N8 | bounded_lm09 | -0.9 | 1.00000 | 0.001 | 0.99996 | -0.00004 | yes |

**Reading, group by group.**

- **N1, N3-p09 (Gaussian, whitened at the true φ).** Both increment kinds sit at or just below
  1: the Gaussian increment's mean is 1 uncapped and the cap at 100 removes about 0.2%, which is
  what the quadrature said (0.99775) and what the run measured (0.99677, 0.99736). The eight
  bounded cells are 1.0000 to four decimals. The construction as ported is at mean ≤ 1 on its own
  premise.
- **N6, N8 (t₃ innovation, oracle).** The Gaussian increment is **REFUTED**: mean 1.608 against
  the derived 1.613. This is the statement A5 registered as FAIL and could not see on the
  crossing-rate instrument: a standardised t₃ residual has no moment generating function, so the
  uncapped Gaussian-LR increment has infinite mean, and the cap at 100 brings it to 1.6, not to 1.
  Each increment multiplies the SR wealth by 1.6 in expectation, and A5's 0.012–0.024 crossing
  rates at T = 300 measured only how rarely that inflation reaches 1/α through the √E−1 adjuster.
  All eight bounded cells **CLEARED** at 1.0000: the t₃ tail is symmetric, so the clipped residual
  is mean-zero and the bounded increment is exactly mean-one, as its envelope claims.
- **N5 (standardised lognormal, σ = 0.75, oracle).** The Gaussian increment is **REFUTED** at
  1.912 against the derived 1.918, for the same reason as t₃. The bounded increment splits by the
  sign of λ, exactly as registered: the four positive-λ cells are **CLEARED** below 1 (0.99907
  down to 0.99167) and the four negative-λ cells are **REFUTED** above it (1.00093 up to
  1.00833), each within 0.00002 of its derived value. Clipping the long right tail at +3 removes
  positive mass, so the clipped residual has mean −0.0277 while the raw residual has mean 0. The
  bounded increment `1 + λ·clip(r)/3` therefore has mean `1 − 0.00924·λ`: below 1 for a bet in
  the direction of the skew, above it for a bet against. The envelope's "any tail" was wrong as
  written; the condition it needed is a **clip-mean-zero** residual, which a symmetric tail gives
  and a skewed one does not.

## What the N5 excess means for the object (derived from the measured means, not measured)

The object mixes the eight λ-wealths at the capital level, so the capital-level average of the
per-tick increments is 1 exactly (the ±λ excesses cancel), but the wealths compound separately
and the average of the compounded wealths does not. At A5's horizon T = 300 the from-onset
expected wealth is `(1 + ε_λ)^300`: 0.08 to 0.76 for the positive λ and 1.32, 2.30, 5.25, 12.0
for λ = −0.1, −0.3, −0.6, −0.9; the eight-way average is about 2.8. So under this skewed null
the bounded arm's expected wealth at T = 300 is about 2.8, not ≤ 1, and it grows without bound
in T. A5's 0.000 crossing rate at 1/α = 20 is consistent with this (the √E−1 adjuster needs the
raw mixture above 441 to cross) and says nothing against it. The row's axis 3 for the bounded
increment is therefore an ε-growing form with a measured per-tick excess of 0.0009 to 0.0083 on
this null, and the envelope's note is amended in the same PR (A6.7). Under symmetric tails
(N6, N8) the excess is zero to four decimals and the exact claim stands.

## Two observations outside the registered questions (recorded, not scored)

1. **N6 and N8 are a whitening check that the amendment did not register.** The A6.2 seed pattern
   keys on the null id's length, and `'N6'` and `'N8'` have the same length, so every
   trajectory pair draws the same t₃ innovation stream; N8 wraps it in AR(1) at φ = 0.9 and the
   A5.2 standardiser unwinds it from the second tick. The 18 cell means agree to four decimals
   (Gaussian 1.60769 / 1.60769; bounded λ = 0.9: 1.00004 / 1.00004), which is the whitening
   working, not two independent measurements. A6.1 named N3-p09 as the whitening check of N1;
   those two draw different streams (id lengths 2 and 6) and agree to about one standard error.
2. **The Gaussian-kind gaps are all negative.** Measured minus derived is −0.0010 (N1), −0.0004
   (N3-p09), −0.0065 (N5), −0.0051 (N6, N8): within tolerance on every cell, but in one
   direction. The interval half-widths are 0.0016 (N1) to 0.0095 (N5), so every gap is within
   about one half-width; no discrepancy is claimed. If a later run at larger N reproduces the
   sign, the quadrature's tail truncation is the first place to look.

**What this run does not establish.** That the object is an e-value on any null (§2); anything
about the plug-in nulls (A6.1: not re-measured); the conditional mean at each tick (the pooled
estimator reads the marginal mean of iid increments, which after whitening is the same thing
here and would not be under a mis-specified φ); any composition.

## Cells

family_A_onset_mixture_increment_bounded_lm01 N1 n=4000000 mean=1.00001 lower95=0.99997 upper95=1.00004 sd=0.033 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm01 N3-p09 n=4000000 mean=1.00001 lower95=0.99998 upper95=1.00005 sd=0.033 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm01 N5 n=4000000 mean=1.00093 lower95=1.00090 upper95=1.00095 sd=0.029 max/mean=1.0 predicted=1.00092 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_bounded_lm01 N6 n=4000000 mean=1.00000 lower95=0.99997 upper95=1.00002 sd=0.028 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm01 N8 n=4000000 mean=1.00000 lower95=0.99997 upper95=1.00002 sd=0.028 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm03 N1 n=4000000 mean=1.00002 lower95=0.99992 upper95=1.00011 sd=0.100 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm03 N3-p09 n=4000000 mean=1.00004 lower95=0.99995 upper95=1.00014 sd=0.100 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm03 N5 n=4000000 mean=1.00278 lower95=1.00269 upper95=1.00286 sd=0.086 max/mean=1.1 predicted=1.00277 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_bounded_lm03 N6 n=4000000 mean=0.99999 lower95=0.99990 upper95=1.00007 sd=0.085 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm03 N8 n=4000000 mean=0.99999 lower95=0.99990 upper95=1.00007 sd=0.085 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm06 N1 n=4000000 mean=1.00003 lower95=0.99984 upper95=1.00023 sd=0.200 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm06 N3-p09 n=4000000 mean=1.00009 lower95=0.99989 upper95=1.00028 sd=0.200 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm06 N5 n=4000000 mean=1.00555 lower95=1.00539 upper95=1.00572 sd=0.171 max/mean=1.2 predicted=1.00554 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_bounded_lm06 N6 n=4000000 mean=0.99997 lower95=0.99981 upper95=1.00014 sd=0.171 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm06 N8 n=4000000 mean=0.99997 lower95=0.99980 upper95=1.00014 sd=0.171 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm09 N1 n=4000000 mean=1.00005 lower95=0.99976 upper95=1.00034 sd=0.299 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm09 N3-p09 n=4000000 mean=1.00013 lower95=0.99984 upper95=1.00043 sd=0.299 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm09 N5 n=4000000 mean=1.00833 lower95=1.00808 upper95=1.00858 sd=0.257 max/mean=1.3 predicted=1.00832 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_bounded_lm09 N6 n=4000000 mean=0.99996 lower95=0.99971 upper95=1.00021 sd=0.256 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lm09 N8 n=4000000 mean=0.99996 lower95=0.99971 upper95=1.00021 sd=0.256 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp01 N1 n=4000000 mean=0.99999 lower95=0.99996 upper95=1.00003 sd=0.033 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp01 N3-p09 n=4000000 mean=0.99999 lower95=0.99995 upper95=1.00002 sd=0.033 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp01 N5 n=4000000 mean=0.99907 lower95=0.99905 upper95=0.99910 sd=0.029 max/mean=1.1 predicted=0.99908 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp01 N6 n=4000000 mean=1.00000 lower95=0.99998 upper95=1.00003 sd=0.028 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp01 N8 n=4000000 mean=1.00000 lower95=0.99998 upper95=1.00003 sd=0.028 max/mean=1.1 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp03 N1 n=4000000 mean=0.99998 lower95=0.99989 upper95=1.00008 sd=0.100 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp03 N3-p09 n=4000000 mean=0.99996 lower95=0.99986 upper95=1.00005 sd=0.100 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp03 N5 n=4000000 mean=0.99722 lower95=0.99714 upper95=0.99731 sd=0.086 max/mean=1.3 predicted=0.99723 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp03 N6 n=4000000 mean=1.00001 lower95=0.99993 upper95=1.00010 sd=0.085 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp03 N8 n=4000000 mean=1.00001 lower95=0.99993 upper95=1.00010 sd=0.085 max/mean=1.3 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp06 N1 n=4000000 mean=0.99997 lower95=0.99977 upper95=1.00016 sd=0.200 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp06 N3-p09 n=4000000 mean=0.99991 lower95=0.99972 upper95=1.00011 sd=0.200 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp06 N5 n=4000000 mean=0.99445 lower95=0.99428 upper95=0.99461 sd=0.171 max/mean=1.6 predicted=0.99446 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp06 N6 n=4000000 mean=1.00003 lower95=0.99986 upper95=1.00019 sd=0.171 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp06 N8 n=4000000 mean=1.00003 lower95=0.99986 upper95=1.00020 sd=0.171 max/mean=1.6 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp09 N1 n=4000000 mean=0.99995 lower95=0.99966 upper95=1.00024 sd=0.299 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp09 N3-p09 n=4000000 mean=0.99987 lower95=0.99957 upper95=1.00016 sd=0.299 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp09 N5 n=4000000 mean=0.99167 lower95=0.99142 upper95=0.99192 sd=0.257 max/mean=1.9 predicted=0.99168 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp09 N6 n=4000000 mean=1.00004 lower95=0.99979 upper95=1.00029 sd=0.256 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_bounded_lp09 N8 n=4000000 mean=1.00004 lower95=0.99979 upper95=1.00029 sd=0.256 max/mean=1.9 predicted=1.00000 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_gaussian N1 n=4000000 mean=0.99677 lower95=0.99519 upper95=0.99834 sd=1.609 max/mean=100.3 predicted=0.99775 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_gaussian N3-p09 n=4000000 mean=0.99736 lower95=0.99578 upper95=0.99894 sd=1.614 max/mean=100.3 predicted=0.99775 verdict=CLEARED house=CLEARED
family_A_onset_mixture_increment_gaussian N5 n=4000000 mean=1.91179 lower95=1.90231 upper95=1.92127 sd=9.676 max/mean=52.3 predicted=1.91833 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_gaussian N6 n=4000000 mean=1.60769 lower95=1.59971 upper95=1.61568 sd=8.150 max/mean=62.2 predicted=1.61281 verdict=REFUTED house=REFUTED
family_A_onset_mixture_increment_gaussian N8 n=4000000 mean=1.60769 lower95=1.59970 upper95=1.61568 sd=8.150 max/mean=62.2 predicted=1.61281 verdict=REFUTED house=REFUTED

