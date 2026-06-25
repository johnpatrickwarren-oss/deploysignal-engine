# ADR 0009 — the φ-floor near unit root is fundamental (frontier #1), and robust e-process stays open (frontier #3)

- **Date:** 2026-06-24
- **Status:** Research findings (exploratory; NO engine change). Both frontier items investigated to a
  firm negative/bounded conclusion. Corrects an overclaim in ADR 0007 #1.
- **Builds on / corrects:** ADR 0005 (safe-t; the φ-floor reattribution), ADR 0007 (#1 HAC-validity
  claim, #3 MoM negative), ADR 0008 (multi-factor common-mode). **This ADR corrects ADR 0007 #1.**
- **Process note:** every claim below was put through an independent fresh-context cold-eye that was
  told to REFUTE. It found a real validity violation in the first (productionised-then-reverted)
  construction; that catch is why this ADR documents a wall instead of shipping an invalid e-value.

## #1 — integrate the AR(1) φ nuisance out — the near-unit-root MEAN is FUNDAMENTALLY uncontrollable at short cal

ADR 0007 reported that the HAC factor `(1−φ)/(1+φ)` gives "uniform-over-φ validity incl. φ=0.95". **That
is a TAIL statement, not the quantity the e-BH FDR path needs.** Re-derived from the MC ground-truth:

- **Tail vs mean (the correction).** Applied consistently (the effective sample enters the t-stat SE
  `→ t·√κ`, the d.o.f. ν, and `n_eff`), `(1−φ)/(1+φ)` does control the **tail** `P(fire) ≤ α` from cal ≈
  50. But the **mean** `E[e|H0]` — what e-BH relies on — still explodes at small cal + high φ
  (cal=10/φ=0.95: `E[e|H0] ≈ 1e15`; max single e `~1e18`). ADR 0007's "uniformly valid" conflated the two.

- **Why it cannot be fixed by a deflation.** The heavy-tailed mean is dominated by *rare catastrophic
  φ̂-error* events: a short window estimates true φ=0.95 as ≈0, the test window stays under-whitened, a
  large spurious t-stat results, and the `(ν+1)/2` exponent amplifies it to ~1e14. **Four independent
  control mechanisms were built and all fail** (12 disjoint seed families, K=8000 each):
  1. **Deflate on an upper-confidence φ_U = |φ̂|+z·sd(φ̂)** (z=3). Robustly valid only to **φ ≤ ~0.85**;
     leaks at φ=0.9 (worst mean 3.6) and φ=0.95 (worst mean 368, single e 5.5e6). The deflation is keyed
     on φ̂, but the catastrophes are exactly where φ̂ underestimates — it cannot see its own failure.
  2. **Deflate on the observable residual autocorrelation** of the whitened series. Recovers more power
     (φ=0.8/cal=200: 73%) but (a) still leaks at φ≥0.9, and (b) is **confounded with H1**: a real mean
     shift inflates the measured residual autocorrelation, collapsing power under the alternative
     (φ=0/cal=100 power → 1%). Disqualifying.
  3. **Cap the per-window e-value `min(e, C)`.** The near-unit-root catastrophe *rate* (~0.8% at φ=0.95)
     is too high — even C=200 leaves `E[e|H0] ≈ 1.6`, and a C low enough to fix it blocks legitimate firing.
  4. **Abstain (return 1) when near-unit-root is indicated.** Keyed on φ̂ it misses the underestimate
     cases; keyed on residual autocorrelation it both misses low-autocorr catastrophes (a large spurious
     t with *low* measured autocorrelation slips through at large cal — cal=200/φ=0.95 → mean 3380) and
     inherits the H1 confounding. Abstaining broadly enough to be valid drives power to 0.

- **Root cause / the wall.** Mean-offset and autocorrelation are *different statistics*; the catastrophic
  realisation need not look autocorrelated, so **no single observable signal predicts it**. Combined with
  the `(ν+1)/2` exponent's outlier-fragility and the genuine non-identifiability of φ from a short window,
  the FDR-relevant `E[e|H0] ≤ 1` near unit root (φ ≳ 0.9) at small/mid cal is **not attainable** by
  deflation, capping, or abstention. This sharpens ADR 0007's vague "partly fundamental" into a definite
  result. The only airtight-and-useful envelope found is **φ ≤ 0.5** — a narrow win not worth a new API.

- **Decision.** Keep the shipped safe-t (`SAFE_T_ENVELOPE`, ADR 0005) and its **cal ≈ 100 φ-floor for
  the FDR path**. The wall is specific to *re-weighting the safe-t's exponent-fragile statistic*; a
  structurally different, less-fragile e-statistic CAN do better. **→ RESOLVED in ADR 0010: a split
  likelihood-ratio (universal-inference) e-value drops the `(ν+1)/2` exponent entirely and gives
  `E[e|H0] ≤ 1` BY CONSTRUCTION for any φ incl. near unit root (bounded; cold-eye SOUND).** Status: **#1
  — the deflation approach is fundamentally bounded (this ADR); the guarantee is delivered by the
  different construction in ADR 0010.**

## #3 — principled robust / contaminated e-process — STILL OPEN (reconfirmed)

Re-ran the ADR 0008 fleet contamination harness across fault fractions for the candidate centers, with
**randomised fault placement** (a first pass put faults in the first `mfail` shards, which a contiguous
block-MoM discards wholesale — a harness artifact, caught and corrected, that had made MoM look *best*):

- 10% faults: **median 0.015 ≈ tukey 0.015** (both ≤ q); **MoM 0.043** (worse); scalar-mean 0.063 (fails).
  Reconfirms ADR 0007: MoM's block-averaging amplifies contamination; the plain median ties the ad-hoc
  Tukey biweight.
- 25% faults: **median 0.159 < tukey 0.361** — the plain median **degrades more gracefully** past the
  design point, with a provable 50% breakdown. Neither controls FDP ≤ q this far out.
- **Bounded-influence e-value clipping** (cap each per-shard e before e-BH) does **not** help — it drives
  power to 0 without improving the center-driven FDP. Robustness must live in the *center*, not the merge.

**Conclusion.** A principled robust *e-value* with a formal breakdown guarantee (beyond a robust *center*)
still has **no construction** — MoM is worse, clipping is inert, and the ADR 0006 deep-dive found nothing
off-the-shelf. The pragmatic best remains a robust center; the plain **median** is the principled choice
(provable 50% breakdown, ties Tukey at the design point, degrades more gracefully past it). Switching the
default center Tukey→median is a small available simplification (deferred — not in this ADR).

## Recommendation / carry-forward

- **#1** — do NOT productionise a φ-adaptive deflation; the near-unit-root mean is fundamentally
  uncontrollable at short cal *for that approach*. The open avenue named here — a **structurally
  different, less exponent-fragile e-statistic** — was then FOUND: **ADR 0010** ships a split
  likelihood-ratio (universal-inference) e-value that gives the guarantee for any φ. Keep the safe-t for
  the long-cal, well-whitened regime (higher power there).
- **#3** — remains open research; keep the median/Tukey center. Optional shippable: Tukey→median default.

Prototypes (h1/h3 harnesses + the four #1 control mechanisms) validated in the session scratchpad; this
ADR ships findings only — no engine code.
