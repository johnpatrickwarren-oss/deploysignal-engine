# Pre-registration — bandwidth or covariance: which drives Family C's mixture collapse?

**Registered 2026-08-04 before the harness was written.** Engine `v0.6.6-pre`. Follows
`stats/family-c-shipped-2026-08-04`, which left its own explanation flagged as inferred.

Append-only; results in `results/`.

## 1. The claim under test, and a correction to it

`stats/family-c-shipped-2026-08-04` measured Family C's mixture crossing rate falling from **0.8960**
under `mcd` to **0.0065** under `mrcd`, and explained it:

> The kernel bandwidth is set by a median heuristic and the reference pool is drawn from `Σ̂`. Under
> `mcd` the covariance on mixture data is inflated 21%; under `mrcd` it is deflated 6%. The scale
> change moves the kernel's sensitivity to shape.

**The bandwidth half of that is wrong, and the code says so.** `_family-c-mmd.ts:123-125`:

```ts
const rawMean = columnMean(rows);
const rawZ = relativeDeviations(rows, rawMean);
const bandwidth = medianPairwiseDistance(rawZ);
```

`bandwidth` is a function of **rows alone** — it never sees the covariance method. That is also why
`family-c-shipped` found B1 **bit-identical** across `mcd` and `mrcd`: B1's reference depends only on
rows, `mean_vector` and bandwidth, all three method-independent. So the mixture collapse **cannot** be
a bandwidth effect, and the only thing that differs between the two arms is the **covariance the
synthesized pool is drawn from**.

This study measures both factors independently rather than reasoning about them.

## 2. Design

One base cell per null, built once at `covariance_method_override: 'mcd'` so shape is held fixed, then
a **factorial sweep** applied by recomputing the stamped `baseline_rff_mean` — the pattern
`../family-c-pool/harness/` established, whose recomputation is bit-identical to the calibrator's when
given the same inputs.

| factor | levels |
|---|---|
| **covariance scale `k`** — pool drawn from `k·Σ̂` | 0.70, **0.78**, 0.90, **1.00**, 1.15 |
| **bandwidth multiplier `m`** — `σ = m·σ_median` | 0.50, 0.71, **1.00**, 1.41, 2.00 |

`k = 1.00` is the shipped `mcd` cell. `k = 0.78` approximates `mrcd`, whose covariance on the mixture
arms measured 0.9472 against `mcd`'s 1.2153 — a ratio of 0.779. Sweeping a scalar multiple of one
base `Σ̂` holds the *shape* fixed, so any effect is attributable to scale and not to the two
estimators differing in structure.

Both bimodal mixture nulls and both Gaussian controls. N=1000 × T=300 × 5 bundles per cell — halved
from the usual N because the grid is 25 cells × 4 nulls.

**Endpoint:** crossing rate at α=0.05, plus `E[exp(Δ log M)]` with the usual one-sided bounds.

## 3. Registered predictions

- **P1 — the decisive one.** At the shipped bandwidth `m = 1.00`, sweeping `k` **reproduces the
  collapse**: mixture crossing above 0.60 at `k = 1.00` and below 0.10 at `k = 0.78`. If it does not,
  scale is not the mechanism and something else distinguishes the two estimators.
- **P2.** At fixed `k = 1.00`, sweeping `m` over a 4× range moves the mixture crossing rate by **less
  than the `k` sweep does** — bandwidth is the weaker lever. Registered because it is the direct test
  of the sentence being corrected.
- **P3.** The mixture crossing rate is **monotone increasing in `k`** across the whole grid at
  `m = 1.00`. A larger reference pool relative to the data makes the Gaussian-vs-bimodal mismatch
  easier for the bettor to exploit.
- **P4.** The **Gaussian control crossing rate is far less sensitive to `k`** than the mixture rate —
  it stays within a factor of 3 across the `k` sweep while the mixture rate moves by more than 10×.
  Mechanism: on Gaussian data the only mismatch *is* the scale error, so it responds smoothly; on
  mixture data the scale error gates whether a shape difference becomes visible.
- **P5 — the one I am least sure of.** There is an interior bandwidth optimum for mixture detection:
  crossing at `m = 0.71` or `m = 1.41` exceeds `m = 1.00` at `k = 0.78`. If a smaller bandwidth
  recovers mixture sensitivity on the shipped covariance, the median heuristic is leaving detection
  power on the table and that is worth a separate item.

**What would refute the framing.** P1 failing while P2 shows a large bandwidth effect — that would
mean the corrected sentence in §1 is also wrong and bandwidth matters after all, despite being
method-independent.

## 4. What this will not establish

- **It does not re-decide anything about shipping.** No arm here is a proposed configuration.
- **It holds `Σ̂` shape fixed by construction.** If `mcd` and `mrcd` differ in structure and not only
  scale, this design attributes that difference to nothing and will show up as P1 failing.
- **Nothing on real data**; the detector compiles on zero real cells.
- **N is halved to 1000.** Crossing rates near 0 or 1 are correspondingly noisier, and no claim below
  0.01 should be read from this study.
- **It does not touch the Gaussian-control supermartingale failure**, which survived `mrcd` and is the
  defect that matters most.

## 5. Disclosure

I wrote the sentence being corrected. §1's correction is from reading the code, and P2 is registered
so that the correction is tested rather than asserted.

## 6. Run discipline

1. This file is committed before the harness is written.
2. The `k = 1.00, m = 1.00` cell must reproduce `stats/family-c-shipped-2026-08-04`'s `mcd` numbers
   at the reduced N. If it does not, stop.
3. Predictions scored verbatim, including failures.

---

## 7. Addendum, registered 2026-08-04 after the main grid — the unbiased-covariance point

The grid swept `k` as a multiple of `Σ̂_mcd`. But `Σ̂_mcd` is **itself biased**: `family-c-shipped`
measured `trace(Σ̂)/trace(Σ_true)` at **1.2115** on `HC-mix-diag` and **1.2153** on `HC-mix-corr`. So
the *unbiased* covariance is not `k = 1` — it is **`k = 1/1.2115 = 0.8254`** (diag) and
**`0.8228`** (corr), which lands between the two lowest points measured (0.78 → 0.0020, 0.90 →
0.0040).

That matters for what the U-curve means. If the unbiased point sits in the trough, then **the 89.6%
headline is caused by covariance bias, not by the Gaussian reference law** — and the fix is the
estimator, which `stats/mcd-consistency-2026-08-04` already showed is correctable to 0.03%.

**A-P1.** At `m = 1.00` and `k = k_unbiased`, the mixture crossing rate is **below 0.02** on both
mixture arms — i.e. the detector does **not** false-alarm on healthy bimodal data once the covariance
is right. Registered range 0.000–0.02.

**A-P2.** The Gaussian controls at `k = k_unbiased` are **not** simultaneously at their minimum,
because the main grid put their minimum at `k = 0.90` — a different point. So no single covariance
scale minimises both, and I predict the Gaussian crossing at `k_unbiased` exceeds its `k = 0.90`
value of ~0.001.

**What this cannot show.** The mixture arms are **healthy** bimodal data, so a low rate here is
correct behaviour, not blindness. Whether the detector can *detect* a bimodality fault — healthy
Gaussian drifting to bimodal — is a **power** question no study in this repo has ever run, and it is
the question that decides whether Family C is worth keeping.

### A-P3 — the power arm, registered because §7 named it as the deciding question

`nulls.mjs:55-58` states Gaussian and mixture cells at the same `sigma` are **moment-matched
exactly**. So switching the live stream from `law:'gauss'` to `law:'mix'` at tick 100, holding
`sigma`, is a **pure distributional-shape fault with identical first two moments** — precisely what
`sequential-mmd.ts` names as the detector's purpose ("bimodality emergence, variance inflation
without mean-shift").

Baseline is Gaussian and healthy in both arms; only the live stream changes.

- **A-P3.** At `k = k_unbiased` — the covariance corrected — **power against this fault is below
  0.10**. Mechanism: if A-P1 holds, the witness is dominated by scale mismatch, and a fault that
  changes only shape leaves the scale untouched. **This is the prediction that decides the detector's
  fate**: a detector that does not false-alarm on healthy bimodality *because it cannot see
  bimodality at all* has no purpose, since Hotelling already covers mean and scale.
- **A-P4.** At `k = 1.00` (shipped, biased) power exceeds A-P3's value — but that is not evidence of
  capability, because the same configuration false-alarms at 0.906 on healthy bimodal data. Any
  apparent power there is the scale error firing, not shape detection. Registered so the comparison
  cannot be misread as a point in the shipped configuration's favour.

**If A-P1 and A-P3 both hold, the honest conclusion is that Family C's MMD witness measures
covariance scale error and is blind to distributional shape** — the opposite of its stated purpose —
and no reference-law fix addresses that.
