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

## Results append — 2026-09-03

(Filled after the registered run; see `validation/e-by-fcr/results/live/`.)
