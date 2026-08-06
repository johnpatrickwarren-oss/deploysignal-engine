# Pre-registration — contamination arm for the shape-kurtosis detector

**Registered 2026-08-05 before the harness was written.** The decisive arm: an empirical calibration
inherits whatever the baseline carries, and that is exactly what disqualified the C16 empirical
reference for Family C (`knowledge/stats/contamination-2026-08-04` — 5% contamination took its
false-alarm rate from 0.0005 to 0.9330).

## Why this is expected to be worse here, not better

Kurtosis is **more** outlier-sensitive than a mean embedding. A 4σ cluster at ε=0.05 moves `m4`
by roughly `ε·(4)⁴ = 12.8` against a Gaussian `m4` of 3 — a fourth-power lever. So the contaminated
baseline's `K` should sit far **above** clean, and clean live data will then read as anomalously
platykurtic and fire in the **lower** tail.

## Design

Baseline contaminated at `ε ∈ {0, 0.05, 0.10, 0.20}`, two shapes — **shift** (`+4σ` cluster) and
**scatter** (`9×` variance). Live stream **clean**. W=30, N=1000 × T=900, α=0.05.

Three calibration variants:

| id | calibration built from |
|---|---|
| **E** | all contaminated baseline rows (the shipped proposal) |
| **T** | MCD-retained rows only — the C17 "B2" hybrid |
| **G** | synthesized Gaussian — included as the already-refuted control |

Plus a power arm at each ε: clean baseline law switching to the moment-matched mixture at tick 300.

## Registered predictions

- **P1.** **E's false-alarm rate rises with ε and exceeds 0.10 by ε=0.05**, reproducing the C16
  failure shape in a more outlier-sensitive statistic.
- **P2.** The firing is **lower-tail** — clean data reads platykurtic against a leptokurtic
  contaminated calibration. Recorded by counting which tail the indicator fires in.
- **P3.** **T holds false alarm below 0.05 up to ε=0.10** and fails at ε=0.20, mirroring C17's B2,
  whose breakdown was 0.20.
- **P4.** Power survives under E at every ε — contamination makes the detector *more* trigger-happy,
  not less, so power is not the binding constraint here.
- **P5 — the one that decides shippability.** If **T** holds to ε=0.10 **and** power survives, the
  detector ships with a trimmed empirical calibration. If both E and T fail at ε=0.05, an empirical
  calibration is not viable and the construction has no calibration route — the same dead end Family
  C reached.

## What this cannot establish

- **Two contamination shapes**, both symmetric-ish and synthetic. Real baseline contamination is not
  a 4σ point mass.
- **It assumes contamination is possible at all.** The curation pipeline exists to prevent it; if
  ε is reliably 0 in production, this arm is moot and the plain empirical calibration is fine.
- **Synthetic only**; no real corpus compiles a multivariate detector.

## Disclosure

I proposed the empirical calibration one message ago on the strength of the N1–N7 battery. P1 is
registered as the outcome that would show that recommendation was premature.
