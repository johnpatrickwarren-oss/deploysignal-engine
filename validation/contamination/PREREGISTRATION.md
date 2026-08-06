# Pre-registration — contamination: what MRCD is biased by, and what an empirical reference costs

**Registered 2026-08-04, before any arm was run.** Engine `v0.6.6-pre`. Answers `WORKLIST.md` C17 and
closes the one stated blocker on shipping C16 (`stats/family-c-empirical-ref-2026-08-04`: "an
empirical reference inherits whatever contamination the baseline carries … the study is structurally
blind to the cost").

Two parts, one registration, because they share a generative model and the same blind spot.
Append-only; results in `results/`.

## 1. Why one study

- **`stats/mcd-consistency-2026-08-04` measured the wrong estimator.** It found two real defects in
  MCD worth an 11–24% inflation — but `stats/family-c-reachability-2026-08-04` found **every compiled
  cell in the corpus is MRCD**, which receives no correction at all. The path everything takes is
  unmeasured.
- **Both prior studies used clean Gaussian data**, and MCD exists for contaminated data.
- **C16's empirical P-side reference is unshipped for exactly one reason**: it inherits baseline
  contamination, and no arm has tested that.

## 2. What MRCD actually is here, read before measuring

`buildFamilyCPerCellMRCD` (`_family-c-mcd.ts:340-380`):

```ts
const alphaTight = Math.max(mcdAlpha, 0.9);         // 0.9, not 0.75
const mcd = fastMCD(rawZ, alphaTight, …);
const rawS = mcd.cov;                                // NO consistency correction
const ratio = Math.max(0, (2 * p + 1 - n) / Math.max(1, p + 1));
const rho = Math.min(0.5, Math.max(0, ratio));       // shrinkage weight
cov = rho · (muDiag·I) + (1 − rho) · rawS;
```

**`rho` is zero whenever `n > 2p + 1`** — which is every realistic cell. At p=11, n=600 the numerator
is `23 − 600`, clamped to 0. So the *regularized* in "Minimum Regularized Covariance Determinant" is
**inert in this deployment**, and MRCD reduces to a raw 90%-coverage MCD **with no consistency
correction at all**.

*Prediction that follows directly:* MRCD should be biased **low** by `1/c_{p,0.9}` — the correction it
never applies. That is the **opposite direction** from MCD, which
`stats/mcd-consistency-2026-08-04` measured as biased **high**.

## 3. Contamination model

`ε` of rows replaced by outliers, `ε ∈ {0, 0.05, 0.10, 0.20}`. Two shapes, run separately:

- **shift**: `N(4·σ·1, Σ)` — a mean-shifted cluster.
- **scatter**: `N(0, 9·Σ)` — same centre, inflated spread.

MCD at α=0.75 has breakdown 25%; MRCD's `alphaTight = 0.9` has breakdown **10%**, so `ε = 0.20` is
past MRCD's breakdown and inside MCD's. That asymmetry is deliberate and is what A-P4 tests.

## 4. Part A — the estimator

Extends `../mcd-consistency/harness/`. Known `Σ` in, `Σ̂` out, 200 replicates.
`p ∈ {5, 11}` × `n ∈ {600, 10000}` × `ε` (4) × shape (2) × variant (3: **V0** shipped MCD,
**V3** both C15 fixes, **MRCD** as shipped).

**Endpoint:** `trace(Σ̂)/trace(Σ_true)`, mean with two-sided 95% CI. BIASED iff the CI excludes 1.

### Registered predictions, Part A

- **A-P1 — the load-bearing one.** MRCD at `ε=0` is **biased low**, `trace` ratio `≈ 1/c_{p,0.9}`:
  **0.849 at p=5**, **0.903 at p=11**, each ±0.03. If MRCD comes out unbiased, §2's reading of the
  code is wrong.
- **A-P2.** `rho = 0` in **every** cell of the grid, so the shrinkage term never activates.
- **A-P3.** MCD's V0 inflation is roughly flat in `ε` up to 0.10 — trimming is doing its job — and
  moves by less than 0.05 between `ε=0` and `ε=0.10`.
- **A-P4.** At `ε=0.20`, MRCD (breakdown 0.10) degrades **sharply and upward** — `trace` ratio above
  1.5 on the shift shape — while MCD (breakdown 0.25) stays within 0.15 of its `ε=0` value. This is
  the prediction that most distinguishes the two estimators and I hold it with medium confidence.
- **A-P5.** V3 is consistent at `ε=0` (replicating C15) and tracks V0's shape under contamination.

## 5. Part B — the detector, and the shipping decision

Extends `../family-c-empirical-ref/harness/`. Gaussian baseline **contaminated at ε**; the live
stream is drawn from the **clean** law. N=2000 × T=300 × 10 bundles.

| arm | `μ_P^φ` from |
|---|---|
| **B0** | synthesized pool from `Σ̂` (shipped) |
| **B1** | all baseline rows (the C16 change) |
| **B2** | **the MCD-retained subset of baseline rows** — new here |

B2 is the hybrid the C16 result implies but did not test: a nonparametric reference that still gets
outlier resistance, by averaging `φ` over the rows the reweighting kept rather than all of them.

**Two endpoints, both needed:**

- **False alarm** — crossing rate at α=0.05 with a clean live stream. The system is healthy; any
  crossing is wrong.
- **Power** — crossing rate with a **×2 variance inflation from tick 100**, the shape
  `sequential-mmd.ts` names as the detector's purpose. Reused verbatim from the `family-ce-nulls`
  vacuous-pass guard.

### Registered predictions, Part B

- **B-P1.** At `ε=0`, B1 replicates C16: false-alarm rate below 0.01.
- **B-P2.** B1's false-alarm rate **rises with ε** — the reference absorbs the outliers, so a clean
  live stream no longer matches it. Above **0.10 at ε=0.20**.
- **B-P3.** B1's **power falls with ε**, because a reference that already contains fault-shaped mass
  cannot be surprised by a fault. Below **0.50 at ε=0.20** against its `ε=0` value.
- **B-P4 — the shipping test.** B2 holds false alarms below 0.05 **and** power above B1's at every
  `ε ≥ 0.05`.
- **B-P5.** B0's power is the least affected by `ε` of the three, because its reference is parametric
  and built from a trimmed covariance. If B0 also wins on power at `ε = 0`, the case for the C16
  change weakens considerably and the page must say so.

**What decides shipping.** C16 ships as **B1** only if B-P2 and B-P3 both fail (contamination costs
nothing). It ships as **B2** if B-P4 holds. If neither, it does not ship and
`stats/family-c-null-misspecification` option (3) — a flexible fitted reference — becomes the live
proposal.

## 6. What this will not establish

- **Nothing on real data.** Every baseline and null is synthetic, and the detector compiles on zero
  real cells.
- **It does not test MRCD *inside* the detector.** Part B builds cells with
  `covariance_method_override: 'mcd'` so it composes with C16 and C13; Part A measures MRCD as an
  estimator. Whether the detector behaves differently on an MRCD cell is a third question.
- **Two contamination shapes is not a survey.** Asymmetric, heavy-tailed and clustered contamination
  are all unexamined.
- **A-P1 concerns the estimator, not any shipped verdict.** If MRCD is biased low, what that does to
  Family E's Mahalanobis radius is arithmetic to be measured, not asserted.

## 7. Disclosure

I read §2 off the code and derived A-P1 from it before running anything. I also proposed the C16
change, proposed B2, and am running the study that decides whether either ships — so B-P5 is
registered specifically as the outcome that would undercut my own proposal.

## 8. Run discipline

1. This file is committed before either harness is written.
2. Part A's `ε=0` cells must replicate `../mcd-consistency` for V0 and V3; Part B's `ε=0` cells must
   replicate `../family-c-empirical-ref` for B0 and B1. Either failing stops that part.
3. Predictions scored verbatim against §4 and §5, including failures.
4. **C15's lesson applies**: those predictions failed because an asymptotic model was registered
   against the `n=600` cell. A-P1 is asymptotic too, and is registered at **both** `n` for that reason.
