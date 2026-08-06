# Pre-registration — can the MMD witness be retuned to see shape?

**Registered 2026-08-04 before the harness was written.** Engine `v0.6.6-pre`.

## 1. Why, and the gap this fills

`stats/family-c-blind-to-shape-2026-08-04` measured **zero power** against a moment-matched shape
fault and concluded the witness is blind to shape. **That conclusion rests on an untested
assumption.** Both power harnesses used `bp.kernel_bandwidth_sigma` unchanged — the shipped median
heuristic. Power was swept over RFF dimension and covariance scale, **never over bandwidth**.

Bandwidth is the knob theory says controls this. A Gaussian RBF kernel is **characteristic**:
`MMD(P,Q) = 0` iff `P = Q`, so it *should* separate a Gaussian from a moment-matched mixture. At too
large a bandwidth the kernel flattens and MMD → 0. And `stats/bandwidth-scale-2026-08-04` already
measured `m = 0.71` giving **15× more** mixture sensitivity than `m = 1.00` on the null arms.

*Scale argument for where to look.* At p=11 the typical pairwise distance is `≈ √(2p)·σ ≈ 4.7σ`,
which is what the median heuristic returns. The mixture's distinguishing feature is the **1.8σ**
separation between components. So the resolving bandwidth should be several times **smaller** than
the median — roughly `m ≈ 0.2–0.4`. The sweep goes below that.

## 2. Design

All arms at `k = k_unbiased` (covariance corrected per bundle, as in the addendum that produced the
zero-power result), so bandwidth is the only thing moving.

`m ∈ {0.10, 0.15, 0.22, 0.32, 0.46, 0.68, 1.00}` — geometric, spanning 10× below the shipped value.

Three arms, because the same shape is healthy or faulty depending on the baseline:

| arm | baseline | live | wanted |
|---|---|---|---|
| **A — specificity, Gaussian** | Gaussian | Gaussian | no fire |
| **B — specificity, bimodal** | bimodal mixture | same mixture | no fire |
| **C — power** | Gaussian | switches to moment-matched mixture at tick 100 | fire |

N=1000 × T=300 × 5 bundles. Endpoint: crossing rate at α=0.05.

**A retune SUCCEEDS iff some `m` gives power ≥ 0.50 while both specificity arms stay ≤ 0.10.**

## 3. Registered predictions

- **P1 — the decisive one.** Such an `m` exists, and it lies in `[0.15, 0.46]`. If no `m` separates
  power from both specificity arms, blindness is established as a property of the construction rather
  than the tuning, and `WORKLIST` C21 stands as written.
- **P2.** Power is **monotone decreasing in `m`** across the swept range — a finer kernel resolves the
  shape difference the median heuristic averages away.
- **P3.** Both specificity arms **rise as `m` falls** below some point: a kernel narrow enough to
  resolve shape also starts resolving sampling noise. So there is an interior optimum, not a
  "smaller is always better".
- **P4.** The shipped `m = 1.00` is **far from optimal** — power there is below 0.05, reproducing the
  zero-power result that prompted this.
- **P5 — the one I am least sure of.** Arm B (bimodal baseline, bimodal live) stays low at the
  optimum. If B rises with power, the detector cannot distinguish "healthy traffic that happens to be
  bimodal" from "traffic that became bimodal", and a retune buys nothing operationally even if it
  buys power.

## 4. What this will not establish

- **One fault shape, one onset.** A moment-matched mixture is the hardest case by construction.
- **It does not fix the covariance dependence.** Every arm runs at the corrected covariance, which is
  not available in production; `stats/bandwidth-scale-2026-08-04` measured the false-alarm rate
  swinging 0.2%→90% across a ±15% covariance error, and a retune does not touch that.
- **It does not address the Gaussian-control supermartingale failure**, refuted under every
  configuration tested.
- **Nothing on real data**; the detector compiles on zero real cells.
- **If P1 holds, the median heuristic is wrong for this detector — not that the detector is right.**
  A tuned bandwidth that must be chosen per cell, against a covariance that is itself biased, is a
  new calibration problem and should be costed as one.

## 5. Disclosure

I wrote C21 recommending retirement on evidence that did not include this sweep. P1 is the outcome
that would show that recommendation was premature, and it is registered as the decisive one.
