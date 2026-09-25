# Family-A increment addendum — the betting e-process and the mixture supermartingale on the A6 nulls (Amendment A7, 2026-09-25)

Governed by `PREREGISTRATION.md` Amendment A7, frozen at `98f9e88` before any harness or run
existed; predictions derived by quadrature before that commit. Canonical run:
`results/live/inc-20260925T174222Z` (study id `2026-09-h0-battery-family-a-increment`, engine
`0.10.0-pre` at `4f18035`, one attempt per A7.7): `node harness/run-increment-arm-a7.mjs --mode
live`, N = 2000 trajectories × T = 2000 ticks per cell, 10 cells (2 constructions × 5 nulls).
Every number below is pinned to that run's cell JSON by `tests/test_increment_arm_a7_addendum.mjs`.

**What is measured.** The per-tick wealth ratio `M_t / M_{t−1}` of the shipped module, read
through the battery's own adapters (oracle μ = 0, σ = 1, the null's φ, the module's own AR(1)
whitening, the raw series fed as the battery feeds it). **Two estimators (A7.1):** the pooled
`increment_estimator` (the engine's, recorded) and the `trajectory_estimator` (mean per
trajectory, two-sided 95% over the 2000 independent trajectory means), **which carries the
verdict**: `REFUTED` iff its lower bound exceeds 1.0005, `CLEARED` iff its upper bound is below it.
**I2, the divergence rule:** a pooled mean ≥ 10⁴ of a non-negative increment is `DIVERGENT` and
scored REFUTED (Markov, level 10⁻⁴), for the cells where the increment has no finite variance and
no interval can decide. The house rule at 1 is recorded beside each cell.

**The two corrections A7 was registered on stand.** The betting increment is `1 + λ_t·z_t` with
z clipped at ±3σ, premise clip-mean-zero (not mgf, as engine ADR 0035 said); and every
detector-audit arm's N5 cells are void (its harness handed the lognormal a function as σ, every
draw NaN). This run's N5 draws were checked finite before it ran (A7.4.3, `manifest.json`).

## The summary

| construction | null | trajectory mean [95%] | pooled mean | max/mean | registered | verdict |
|---|---|---|---|---|---|---|
| betting | N1 | 1.000002 [0.999951, 1.000053] | 1.000002 | 2 | CLEARED | CLEARED |
| betting | N3-p09 | 0.999985 [0.999941, 1.000028] | 0.999985 | 2 | CLEARED | CLEARED |
| betting | N5 | 1.001179 [1.001080, 1.001278] | 1.001179 | 2 | REFUTED | REFUTED |
| betting | N6 | 0.999977 [0.999928, 1.000027] | 0.999977 | 2 | CLEARED | CLEARED |
| betting | N8 | 0.999995 [0.999953, 1.000038] | 0.999995 | 2 | CLEARED | CLEARED |
| mixture | N1 | 1.000021 [0.999935, 1.000108] | 1.000021 | 121 | CLEARED | CLEARED |
| mixture | N3-p09 | 0.998307 [0.998292, 0.998321] | 0.998307 | 24 | CLEARED | CLEARED |
| mixture | N5 | 7.709e+11 [-7.400e+11, 2.282e+12] | 7.709e+11 | 4000000 | DIVERGENT | REFUTED (divergent) |
| mixture | N6 | 1.013e+25 [-9.687e+24, 2.995e+25] | 1.013e+25 | 3992343 | DIVERGENT | REFUTED (divergent) |
| mixture | N8 | 2.199222 [0.580236, 3.818209] | 2.199222 | 1370655 | DIVERGENT | inconclusive |

## Against the registered predictions (A7.3): nine of ten as registered

| construction | null | registered value | tolerance | measured | gap | expectation | held |
|---|---|---|---|---|---|---|---|
| betting | N1 | 1.00000 | 0.0005 | 1.000002 | +2.32e-6 | CLEARED | yes |
| betting | N3-p09 | 1.00000 | 0.0005 | 0.999985 | -1.52e-5 | CLEARED | yes |
| betting | N5 | 1.00105 | 0.0003 | 1.001179 | +1.32e-4 | REFUTED | yes |
| betting | N6 | 1.00000 | 0.0005 | 0.999977 | -2.29e-5 | CLEARED | yes |
| betting | N8 | 1.00000 | 0.0005 | 0.999995 | -4.58e-6 | CLEARED | yes |
| mixture | N1 | 1.00000 | 0.003 | 1.000021 | +2.11e-5 | CLEARED | yes |
| mixture | N3-p09 | 1.00000 | 0.003 | 0.998307 | -1.69e-3 | CLEARED | yes |
| mixture | N5 | — | — | 7.709e+11 | — | DIVERGENT | yes |
| mixture | N6 | — | — | 1.013e+25 | — | DIVERGENT | yes |
| mixture | N8 | — | — | 2.199222 | — | DIVERGENT | NO |

**Reading, construction by construction.**

- **Betting, symmetric nulls (N1, N3-p09, N6, N8).** 1.00000 to five decimals on every one, CLEARED
  with interval half-widths of 0.00005: the increment `1 + λ_t z_t` is exactly mean-one whenever
  the clipped residual is conditionally mean-zero, whatever λ_t the running moments pick and
  whatever the tail. The t₃ cells (N6, N8) are the first valid measurement of this increment under
  heavy tails at oracle parameters: detector-audit's 1.000128 on N6 at T = 300 is consistent, and
  its N5 reading was void.
- **Betting, the skewed null (N5).** **1.00118 [1.00108, 1.00128], REFUTED**, against the derived
  1.00105 (gap +0.00013, within the 0.0003 tolerance). The mechanism is the one registered: the
  raw residual is mean-zero, the clipped one is not (E[z] = −0.00924), aGRAPA's λ_t converges on
  E[z]/E[z²] = −0.113 and the bet earns 1 + E[z]²/E[z²] per tick. The plug-in centre is not
  involved (μ is the true 0) and the scale is not involved (σ is the true 1). This is
  [[grapa-stability-2026-08-18]]'s law, λ∞ ≈ b/s turning a bias into evidence, with the bias
  supplied by the clip on a skewed tail rather than by an estimated centre. The residual excess
  0.00013 above the derivation is the running-moment ratio's Jensen term, which the derivation
  put at about 0.4% of λ∞ and which reads as 12% of the excess here; recorded, within tolerance.
- **Mixture, light-tailed nulls (N1, N3-p09).** N1 at 1.00002 (CLEARED), the martingale exact.
  N3-p09 at **0.99831 [0.99829, 0.99832]**, CLEARED and within the 0.003 tolerance, but 0.17%
  below 1 with an interval that excludes 1 by a wide margin. The cause is the battery's
  standardisation convention, not the construction: the adapter passes the marginal variance
  σ² = 1 and the module whitens at φ = 0.9, so the residual it sums has variance 1 − φ² = 0.19
  against a claimed 1. A Gaussian mixture run at five times the true variance is a valid,
  conservative supermartingale; its per-tick ratio sits below 1. Detector-audit's 0.9918 on
  N3-p09 at T = 300 is the same effect with more weight on the unwhitened first tick. Falsifier
  (iv) did not trigger; the deficit is explained and is the A5.2 comparability note again.
- **Mixture, heavy tails (N5, N6).** Pooled means **7.7 × 10¹¹** and **1.0 × 10²⁵** with max/mean
  at the 4,000,000 ceiling (one increment carries the mean): **DIVERGENT, scored REFUTED** under
  I2. The trajectory intervals are inconclusive and negative-bounded, which is what an
  infinite-variance increment does to a normal-theory interval and why I2 was registered.
  E[g | S_{t−1}] is infinite for these tails; the sample mean reaches the Markov bound at level
  10⁻⁴ with 10⁷ to spare.
- **Mixture, N8 — the registered prediction did not hold.** Pooled mean **2.20**, max/mean
  1.4 × 10⁶, trajectory interval [0.58, 3.82]: not DIVERGENT, inconclusive. N6 and N8 draw the same
  t₃ innovation stream under the seed pattern (both ids have length 2), so the difference is
  entirely the whitening scale above: on N8 the mixture sums increments of standard deviation
  0.436 against σ = 1, and the exponent that drives the divergence, r²/(2d_t), is 5.3 times
  smaller. The expectation is still infinite (any positive scale diverges on a t₃ tail), but at
  4,000,000 draws the pooled mean sits at 2.2, not 10⁴. The derivation omitted the scale; the
  tail argument is unchanged; the cell is recorded inconclusive with its tell and is not re-cut.
  A rerun at the innovation scale would decide it and is not part of this attempt.

**What this run establishes.** The betting increment is exactly mean-one under symmetric tails
and above one under a skewed tail at oracle parameters, by the mechanism registered — its
premise is clip-mean-zero, and it fails it the way A6's fixed-λ bounded increment did, with the
bet choosing the losing sign. The mixture's premise is mgf and it fails it on t₃ and lognormal
tails by many orders of magnitude at unit scale; at a mis-stated scale it fails more slowly than
the run could see.

**What this run does not establish.** Anything under plug-in parameters (A6.1; the plug-in
price is measured elsewhere, C58 and the contrast null); the mixture's per-tick mean at the
innovation scale on N8; the conditional property (both estimators read marginal means; the
betting increment's dependence through λ_t is why the trajectory interval, not the pooled one,
carries the verdict); any composition.

## Cells

family_A_betting_e_process_increment N1 n=4000000 traj=1.00000 lower95=0.999951 upper95=1.00005 pooled=1.00000 max/mean=2.0 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_betting_e_process_increment N3-p09 n=4000000 traj=0.999985 lower95=0.999941 upper95=1.00003 pooled=0.999985 max/mean=1.7 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_betting_e_process_increment N5 n=4000000 traj=1.00118 lower95=1.00108 upper95=1.00128 pooled=1.00118 max/mean=2.0 expected=REFUTED verdict=REFUTED divergent=false house=REFUTED
family_A_betting_e_process_increment N6 n=4000000 traj=0.999977 lower95=0.999928 upper95=1.00003 pooled=0.999977 max/mean=2.0 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_betting_e_process_increment N8 n=4000000 traj=0.999995 lower95=0.999953 upper95=1.00004 pooled=0.999995 max/mean=2.0 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_mixture_supermartingale_increment N1 n=4000000 traj=1.00002 lower95=0.999935 upper95=1.00011 pooled=1.00002 max/mean=121.4 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_mixture_supermartingale_increment N3-p09 n=4000000 traj=0.998307 lower95=0.998292 upper95=0.998321 pooled=0.998307 max/mean=23.6 expected=CLEARED verdict=CLEARED divergent=false house=CLEARED
family_A_mixture_supermartingale_increment N5 n=4000000 traj=7.70880e+11 lower95=-7.40044e+11 upper95=2.28180e+12 pooled=7.70880e+11 max/mean=4000000.0 expected=DIVERGENT verdict=REFUTED divergent=true house=inconclusive
family_A_mixture_supermartingale_increment N6 n=4000000 traj=1.01301e+25 lower95=-9.68687e+24 upper95=2.99470e+25 pooled=1.01301e+25 max/mean=3992342.6 expected=DIVERGENT verdict=REFUTED divergent=true house=inconclusive
family_A_mixture_supermartingale_increment N8 n=4000000 traj=2.19922 lower95=0.580236 upper95=3.81821 pooled=2.19922 max/mean=1370655.1 expected=DIVERGENT verdict=inconclusive divergent=false house=inconclusive

