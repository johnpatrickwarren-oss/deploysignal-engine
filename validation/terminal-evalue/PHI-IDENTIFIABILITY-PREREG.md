# Pre-registration — is the near-unit-root gap an identifiability limit?

**Registered 2026-08-05 before the run.** Redirects `WORKLIST` C28/C30 before building a repair that
would not work.

## Correction to the proposed repair

C28 proposed a **bounded-window sup** for sequential UI. That is unsound as specified: the numerator
accumulates conditional densities over `[1,s]` while a windowed denominator covers `[s−W,s]`, so the
two are no longer comparable and `E` is inflated rather than bounded. The sound windowed version is
a product of **disjoint** windowed e-values, numerator and denominator both on the window.

But that repair probably does not close the gap either, and the reason is worth testing before
building anything: **if each window's UI is inert at φ=0.9, their product is inert too.**

## The hypothesis

`stats/power-per-cell-2026-08-05` measured universal inference at power **0.0275** at φ=0.9 while
valid. The suspected cause is **identifiability, not construction**: the null class is AR(1) with any
φ, and as φ → 1 a near-random-walk null can absorb a sustained mean shift. A test that profiles over
the whole class then has nothing to distinguish. If so, **no construction whose null class includes
φ ≈ 1 can cover that cell**, and windowing, pre-whitening and bounded sups all fail for the same
reason.

## Design

Universal inference, +3σ shift in the test window, φ swept over
`{0, 0.3, 0.6, 0.8, 0.9, 0.95, 0.99}` at m=100, N=2000. Validity (exceedance) and power measured per φ.

## Registered predictions

- **P1.** Power **decays smoothly and monotonically toward 0 as φ → 1**, with no cliff. A smooth
  decay indicates identifiability; a cliff would indicate a numerical or construction defect and
  would make a repair worth building.
- **P2.** Power is already below 0.5 by **φ = 0.9** and below 0.1 by **φ = 0.95**.
- **P3.** Validity holds at every φ — exceedance ≤ α throughout. The detector does not become wrong,
  it becomes blind.

**What follows if P1–P3 hold.** The near-unit-root regime is **not coverable** by any detector
profiling over an unrestricted AR(1) null, and the honest response is C30's third option: bound the
null class, declare φ > φ_max out of scope, and **enforce** it — which nothing currently does, since
`assertValidForFdrPath` has no production caller.

## What this cannot establish

- **One detector, one fault shape.** A shift is the alternative UI is built for; a variance or shape
  fault might remain identifiable at high φ.
- It does not prove non-coverability in general — only that this class cannot, which is a claim about
  the profiled-null construction rather than about all possible detectors.
