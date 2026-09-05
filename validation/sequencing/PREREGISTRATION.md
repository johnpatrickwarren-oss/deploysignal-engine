# Pre-registration — sequencing from crossings: does first-crossing order recover injected order? (`2026-09-sequencing`, engine substrate)

- **Study id:** `2026-09-sequencing` (engine half; the tessera-rng half is
  `../tessera-rng/design/research/2026-09-sequencing/PREREGISTRATION.md`, mirrored).
- **Register:** `knowledge/WORKLIST.md` C74; `knowledge/methodology/pages/threshold-free-observability.md`
  claim (4) and falsifier 3 ("first-crossing order on injected multi-fault incidents recovers
  injection order at better than chance — a testable endpoint no study yet has");
  `knowledge/stats/pages/e-sr-delay-2026-09-03.md` (the e-SR's `onset_estimate`, "the first
  engine output built for sequencing, unmeasured against injected order");
  `knowledge/stats/pages/arl-delay-2026-09-03.md` (the delay harness and its injection at ν).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`;
  `knowledge/methodology/harness-discipline`.
- **Status: REGISTERED, NOT RUN.** No `.ts` file changes; the harness drives the shipped
  `dist/` through the h0-battery adapters and the e-SR adapter of `validation/e-sr-mean-shift`,
  copied not imported. This file is committed first so that no endpoint, bar, grid, prediction
  or seed below can be chosen after a number is seen. Later commits must not edit it; a change
  is an amendment, appended and dated.

## 1. The claim under test

Thesis claim (4): first-crossing times order an incident. Falsifier 3: if first-crossing order on
injected multi-fault incidents does not recover injection order at better than chance, the
sequencing half of (4) fails. Three orderings are compared against the injected order:

- **O_mix** — the 0-indexed first-fire tick of the Family A mixture supermartingale
  (`family_A_mixture_supermartingale`, per-run α = 0.01);
- **O_bet** — the 0-indexed first-fire tick of the Family A betting e-process
  (`family_A_betting_e_process`, per-run α = 0.01);
- **O_sr** — the e-SR mean-shift e-detector's `onset_estimate` (`detectors/e-sr-mean-shift.ts`,
  a 0-indexed first post-change tick) read at the e-SR's own first crossing of `1/α_ARL`,
  `α_ARL = 10⁻³` (the shipped default). This is the design claim: the estimate should recover
  the onset itself, not the crossing, and so should order faults at gaps smaller than the
  detectors' delay spread.

Reported without a bar: **O_srx**, the e-SR's own first-crossing tick, so that the estimate can
be compared with the crossing it was read at.

## 2. The study

Substrate: the h0-battery's N1 null (iid Gaussian, oracle μ = 0, σ = 1, φ = 0) per signal,
`K = 20` signals per replication. `F ∈ {3, 5}` of them (indices `0..F−1`) are faulted with a
K1 step of `δ ∈ {1.5, 3}` σ from onset `ν_k = ν_0 + k·g`, `k = 0..F−1`, `ν_0 = 200`
(arl-delay's onset), gap `g ∈ {5, 20, 50}` ticks. Horizon `T = ν_0 + (F−1)·g + 800`
(arl-delay's 800-tick censor after the last onset). A signal that never fires by `T` has
crossing tick `∞`. 12 cells (F × δ × g); every ordering is read on the same replication, so
orderings are paired.

Trajectory construction copied from `validation/e-sr-mean-shift/harness/run.mjs` (itself
from arl-delay and the battery): one LCG + Box–Muller generator per replication, ticks outer,
signals inner (`K` draws per tick), so the three detectors see identical draws. Seeds
`20260912 + 7919·i + 10⁶·j`, `i` the replication, `j` the cell index in loop order (F outer,
then δ, then g). `N = 1,000` per cell.

### 2.1 Scoring

**Pair agreement `A`** per replication: over the `F(F−1)/2` faulted pairs `(a, b)` with
`ν_a < ν_b`, a pair scores 1 if `o_a < o_b`, 0 if `o_a > o_b`, and **0.5 on a tie** (`o_a = o_b`,
including both `∞`); a crossed signal orders before an uncrossed one. `A` is the mean pair
score; the cell reports its mean over replications and the standard error over replications.
Chance is 0.5 under any exchangeable ordering. Ties are never broken by index.

**False sequencing `Φ`** per replication: the fraction of the `K − F` null signals whose
crossing tick (per detector; for O_sr the e-SR's crossing) is `< ν_{F−1}`, the last true
onset. Mean and se over replications.

**Onset error** (O_sr only, reported): mean `|onset_estimate − ν_k|` over crossed faulted
signals, and the fraction of crossed faulted signals with `onset_estimate` within ±g/2 of `ν_k`.

Also reported: each detector's `p_detect` (fraction of faulted signals crossing by `T`), the
mean and sd of its delay, and the fraction of pairs with at least one uncrossed member.

## 3. Endpoints (HELD/FAILED on their own bars)

- **E1 — better than chance (the falsifier's endpoint).** Per cell and ordering:
  `A − 3·se(A) > 0.5`. Registered prediction: HELD for every ordering in every cell.
- **E2 — the floor at the widest gap.** At `g = 50`, both F, both δ: `A ≥ 0.8` for every
  ordering. Prediction: HELD, with `A ≥ 0.97` (the delay sd at 1.5σ is ≈ 10–12 ticks from
  arl-delay's median/p90, so a 50-tick gap is ≈ 3 sd of the pairwise difference).
- **E3 — the e-SR's design claim at small gaps.** At `g = 5`, `δ = 1.5`, both F: `A_sr − A_mix`
  and `A_sr − A_bet` each exceed `3·se` of the paired per-replication difference. Prediction:
  HELD. Why: crossing order at `g = 5` is the sign of a difference of two delays with sd ≈ 15,
  `Φ(5/15) ≈ 0.63`; the onset estimate's error is the distance to the CUSUM companion's last
  reset before the onset, a few ticks, so the pairwise difference has sd ≈ 5 and
  `Φ(5/5) ≈ 0.84`. Predicted `A_sr ≈ 0.75–0.85`, `A_mix ≈ 0.60–0.66`, `A_bet ≈ 0.58–0.64`. At
  `δ = 3` all three are higher and the margin narrower (reported, no bar).
- **E4 — false sequencing is the detector's error contract.** Per cell, `Φ_mix ≤ 0.02` and
  `Φ_bet ≤ 0.02` (a per-run α = 0.01 spent over at most 400 ticks). Prediction: HELD.
  For O_sr no bar: predicted `Φ_sr ∈ [0.08, 0.25]`, rising with `ν_{F−1}` (the ARL of ≈ 1,800
  at oracle parameters gives ≈ `1 − exp(−ν_{F−1}/1800)`, 0.11 at 200 and 0.20 at 400). This is
  the price the e-SR study named and is what a consumer that sequences from the e-SR must carry.

Registered predictions for the crossing orderings by gap at `δ = 1.5`: `A ≈ 0.63 / 0.88 / 0.99`
at `g = 5 / 20 / 50`; at `δ = 3`: `≈ 0.85 / 0.99 / 1.0`. Predictions carry no authority.

## 4. NOT-EXECUTABLE conditions

- Any replication throws: the run aborts (no catch), is preserved unscored, and the study is
  reported not-executable at that harness sha.
- A cell where a detector's `p_detect < 0.5` is not scored for that ordering (its `A` would be
  mostly ties) and is listed; arl-delay measured 1.000 at 1.5σ for both Family A cards at
  α ≥ 0.01, so none is expected.

## 5. Ship rule and the falsifier

Nothing ships either way (no `.ts` changes). **Falsifier 3 fires only if NO ordering beats
chance (E1) in ANY cell** — every ordering fails E1 in all 12 cells. If it fires, the thesis
page's falsifier 3 state is set to fired with the numbers and its confidence set accordingly;
the claim is not softened. If it does not fire, the state records which orderings beat chance
at which gaps, and E2–E4 are the measured shape of "recovers injection order".

## 6. What this study does not measure

Estimated baselines (N2), serial dependence (N3), faults of unequal size, faults that end,
more than 5 concurrent faults, ties in the injected order, any real trace, and location
(the other half of claim 4). The tessera-rng half measures the same orderings on a fabric with
resource-level onsets and adds the e-BH selection order.
