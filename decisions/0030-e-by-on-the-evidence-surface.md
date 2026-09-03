# ADR 0030 — The mixture confidence sequence travels level-free on the evidence surface, and e-BY prices a selected set's intervals

- **Date:** 2026-09-03
- **Status:** ACCEPTED, gated on study `2026-09-e-by-fcr` (`validation/e-by-fcr/PREREGISTRATION.md`
  §4: P1 HELD in every cell is the ship condition; the results append below records it).
- **Register:** knowledge `WORKLIST` C62 (b); `stats/ramdas-wang-2025` §7 (Proposition 13.4,
  Definition 13.6, Theorem 13.7); `stats/mixture-cs-2026-09-02` (the CS); ADR 0027 (the surface).

## Decision

1. `EvidenceSurface.confidence_sequence` (optional): the Family A Gaussian-mixture path attaches
   its confidence sequence at the detector's own α **together with the level-free inputs**
   `(S_t, t, σ², ρ)`, from which the interval at any level is
   `S_t/t ± sqrt(v·log(v/(α²ρ)))/t`, `v = σ²t + ρ`. `mixtureConfidenceSequenceAt(level_free, α)`
   is that re-inversion; the existing `mixtureConfidenceSequence` is now a call to it.
2. `fleet/e-by.ts`: `eByLevel(δ, |S|, K) = δ|S|/K` and `eBenjaminiYekutieli(selected, K, δ)`,
   which re-inverts each selected signal's level-free inputs at `δ|S|/K`. Output carries the
   guarantee sentence verbatim.

## Why

Before this the CS was computed on every mixture tick and dropped before the `DetectorVerdict`
(`detectors/_page-cusum-mixture.ts`, the result → verdict projection), so no consumer could show
an effect-size interval for a signal it had selected, let alone one whose coverage survives the
selection. Theorem 13.7 is the composition the consumers asked for in C62: select by any rule
(DeploySignal's fired set; e-BH's selection in tessera-rng), report each selected signal at
`δ|S|/K`, and the false coverage rate is at most δ under any dependence. The only premise is that
the family is level-free e-CIs, which the mixture's CS is by Proposition 13.4 whenever the
mixture's own construction premise holds. The e-BY level needs `K`, the universe the selection
was made from, which only the consumer knows; hence a fleet-layer function with `K` as an
argument rather than a detector-side field.

## What it does not do

No verdict authority: e-BY prices intervals, it selects nothing (FDR is e-BH's). Under an
estimated baseline the intervals cover the shift from the estimate (mixture-cs P3/P4) at every
level; the surface says so. Only the Gaussian mixture has a CS; the betting e-process, Family C,
D and E carry no `confidence_sequence`. Dependence between signals is not exercised by the study
(independent signals only); the theorem does not need it, the measurement did not test it.

## Results append — 2026-09-03, run `run-20260903T235802Z`

18 cells × 3 δ, N = 2,000, 0 exceptions, 0 re-inversion deviations above 1e-12. **P1 HELD in
every cell at every δ**: the largest e-BY FCR relative to its δ is 0.270 (ρ = 1, the fired-set
rule read at each signal's first fire, no shift, δ = 0.05: 0.0135 — every false fire is a miss at
its fire tick by construction, so this cell's FCR is the false-fire rate); every other cell is at
or under 0.04 of its δ. *Correction, same day:* the first version of this append and the commit
that carried it said 0.032, read off the extremeness cell alone; the REPORT's figure is 0.270. Ship rule met; this ADR is ACCEPTED as built. **P2
FAILED**: the naive intervals at level δ never exceeded δ under the extremeness rule on this
substrate (δ = 0.05: 0.0047 at ρ = 1, 0.0147 at ρ = 38; the closest approach 0.085 vs 0.2 at
ρ = 38) — my registered prediction was wrong. The time-uniform interval read at a fixed T = 300 is
conservative enough that selecting the three most extreme of twenty signals does not push
miscoverage past the nominal level; the selection trap the e-BY guarantee closes is not visible
at this width. P3 HELD (closed form to 1e-12); the e-BY width ratio over naive is 1.2–1.5 at
|S|/K = 3/20 to 5/20. P4 HELD with P1. What this means for the consumer: the FCR guarantee is
real and cheap (a 20–50% wider interval), and on a Gaussian substrate at these horizons it buys
insurance against a failure the naive intervals did not exhibit. Not measured: dependent signals,
estimated baselines, AR(1), heavy tails.
