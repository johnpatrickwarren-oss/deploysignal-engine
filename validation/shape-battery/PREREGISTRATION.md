# Pre-registration — N1–N7 for the shape-kurtosis detector, under estimated parameters

**Registered 2026-08-05 before the harness was written.** Engine `v0.6.6-pre`, detector at
`feat/shape-kurtosis-detector` `9d79e1c`. The build measured only the **oracle** regime — calibration
from the true Cholesky. This is the regime the detector audit says breaks wealth processes.

## Arms

Multivariate analogues of `../h0-battery/` N1–N7, p=11, in the relative-deviation space of
`../family-ce-nulls/harness/`.

| arm | law | covariance used for calibration |
|---|---|---|
| N1 | Gaussian | **true** Σ (oracle) |
| N2-m30/100/500 | Gaussian | `Σ̂` from m baseline rows |
| N3-p06/p09 | AR(1) in time | true Σ |
| N4-p06/p09 | AR(1) in time | `Σ̂` from m=100 |
| N5 | lognormal, moment-matched | `Σ̂` from m=100 |
| N6 | t₃, moment-matched | `Σ̂` from m=100 |
| N7 | Gaussian, **rolling** evaluation | `Σ̂` from m=100 |

N5 and N6 additionally run an **empirical-calibration** variant, where K's null distribution is built
from baseline *windows of the actual law* rather than synthesized Gaussian ones. That is the design
question those two arms exist to settle.

**Instrument:** test-martingale class, so the increment estimator `E[exp(Δ log M)]` with the standard
rule — REFUTED iff the one-sided 95% lower bound exceeds 1, CLEARED iff the upper bound is below
1.0005 — plus the crossing rate at α=0.05, reported.

## Registered predictions

- **P1.** N1 is not refuted, reproducing the build (0.9993–1.0001).
- **P2.** N2 is **refuted at m=30** and improves with m. The score is scale-invariant, so a
  multiplicative σ̂ error cancels — but the **calibration** is built from `Σ̂`'s *correlation*
  structure, which scale-invariance does not protect. This is the failure the envelope already
  declares with `validUnderEstimatedBaseline: false`.
- **P3.** N3 and N4 are **refuted**, and worse at φ=0.9. The window statistic assumes iid draws;
  serial dependence inflates the variance of `m4/m2²` and the Gaussian-window calibration does not
  know about it.
- **P4 — the one that decides whether this ships at all.** With the **synthesized Gaussian**
  calibration, N5 and N6 are **badly refuted** — healthy non-Gaussian traffic reads as a shape fault,
  because the calibration asserts Gaussian kurtosis. This is Family C's misspecification failure in a
  new form, and if it holds, a Gaussian-synthesized calibration is not shippable.
- **P5.** The **empirical-calibration** variant of N5/N6 is **not refuted**, because K's null
  distribution is then taken from the law the data actually has. If P4 holds and P5 fails, the
  detector has no calibration route and should be abandoned.
- **P6.** N7 (rolling) is **refuted**, confirming the disjoint fix is load-bearing rather than
  incidental — the build measured 0.206 crossing before it.

## What this cannot establish

- **Synthetic only**, and no real corpus compiles a multivariate detector.
- **One fault shape** for power; these arms are nulls.
- **It does not test contamination** of the baseline, which is what disqualified the C16 empirical
  reference. If P5 holds, that arm is the immediate next question, not a clearance.

## Disclosure

I designed, built and am now testing this detector. P4 is registered as the outcome that would make
it unshippable as calibrated.
