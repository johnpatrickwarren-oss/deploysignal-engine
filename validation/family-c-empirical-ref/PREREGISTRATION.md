# Pre-registration — does an empirical P-side reference stop Family C firing on healthy data?

**Registered 2026-08-04, before the code change was made.** Engine `v0.6.6-pre`. Wiki item
`WORKLIST.md` C16; the thesis under test is `knowledge/stats/family-c-null-misspecification`, which
registered a falsifier on 2026-08-04 in commit `52bffd3`. This file restates it with the full arm set
and the numbers it will be scored against.

Append-only. Results in `results/`, one directory per run.

## 1. The claim

Family C's betting e-process crosses on **89.6%** of healthy trajectories when healthy traffic is
bimodal with mean and covariance matched to its Gaussian control
(`knowledge/stats/family-ce-nulls-2026-08-03`). The thesis says this is **not a defect in the betting
construction**: the reference arm is synthesized as `z = L·w` from the compiled covariance, so H₀
asserts Gaussianity, and a correct test of a false null rejects it.

Replacing the synthesized pool with the **real baseline rows** makes H₀ "the live window is
distributed like the baseline" — what MMD two-sample testing is for, and what Shekhar–Ramdas build.

## 2. The change, stated exactly

**Correction to how this was scoped.** `knowledge/stats/family-c-null-misspecification` and
`WORKLIST` C16 both call it a **one-line** change. That is wrong: `rows` is not in scope at the
stamping site. `stampEMmdAndBettingParams` (`_family-c-build.ts:253-258`) takes
`(cell, n, alphaMMD, key)` — the row *count*, not the rows. It is **three edits**:

1. add a `rows: number[][]` parameter to `stampEMmdAndBettingParams`;
2. pass `rows` at the single call site, `_family-c-build.ts:414`, where it is already in scope;
3. replace the pool construction with `relativeDeviations(rows, cell.mean_vector)`.

`relativeDeviations` is already imported at `_family-c-build.ts:20`. **Still no schema change and no
runtime change** — the runtime consumes only the stamped 256-vector, and in RFF mode never builds a
pool (`family-c-betting-e-process.ts:220-222`). Both claims are re-checked in §5 rather than assumed.

## 3. Design

The four nulls, harness and cell of `../family-ce-nulls/` reused **verbatim**, so the comparison is
against a measured baseline rather than a re-derivation. N=2000 × T=300 × 10 bundles per arm.

| arm | `μ_P^φ` from |
|---|---|
| **B0** | synthesized pool (shipped) — must replicate 2026-08-03 |
| **B1** | `relativeDeviations(rows, cell.mean_vector)` — the change |

Both mixture arms **and** both Gaussian control arms. The controls are included because the thesis
makes a second, weaker claim about them: an empirical reference removes the route by which an
inflated `Σ̂` reaches the witness, so D-A may partly close as a side effect.

## 4. Endpoints

Identical conventions to `../family-ce-nulls/` §6, so the numbers compose directly.

**Primary — crossing rate at α=0.05 on the two mixture arms.**

> **The thesis SURVIVES iff the mixture crossing rate falls below 0.20 on both arms.**
> **It is REFUTED iff either stays at or above 0.20.** (Registered on the thesis page as
> "if it stays above ~0.20, the misspecification is not what drives the false alarms".)

**Secondary — `E[exp(Δ log M)]` on all four arms**, with the one-sided 95% bounds and the same
REFUTED / CLEARED rule as `../family-c-pool/` (refuted iff lower bound > 1; cleared iff upper bound <
1.0005).

**Reported, scored by nothing:** crossing at α ∈ {0.01, 1e-4}; per-block increment means;
`‖μ_P^φ(empirical) − μ_P^φ(synthetic)‖`; and the effective `N_P`, which becomes the baseline row count
(600) instead of 500.

## 5. Registered checks on the change itself

Run before the arms, and a failure stops the study:

- **C-1.** The compiled `betting_e_process_params` under B1 has the same **key set** as under B0. Any
  new or missing field means the "no schema change" claim is false.
- **C-2.** The engine's `dist/detectors/*` is **byte-identical** before and after, proving no runtime
  change. `../family-ce-nulls/harness/bundle.mjs#verifyProvenance` already enforces the related
  invariant and runs anyway.
- **C-3.** B0 reproduces 2026-08-03 to six digits: 1.012538 / 0.8960 (mix-diag), 1.006840 / 0.1365
  (gauss-corr).

## 6. Registered predictions

**P1 — primary.** Mixture crossing at α=0.05 falls from **0.896 / 0.859** to **below 0.20** on both
arms. I expect near-nominal but register the threshold the thesis committed to.

**P2.** The mixture increment estimator falls from 1.012538 to **below 1.008** — i.e. at least half
the excess over the Gaussian control's 1.00684 disappears, since that excess is what the
misspecification contributes.

**P3.** The Gaussian control arms **improve but are not cleared**: increment falls below 1.00684 and
stays above 1.0005, so still REFUTED. Mechanism: the empirical reference removes the `Σ̂` route, worth
~70% post-hoc, but the residual measured in `../family-c-pool/` survives.

**P4 — the one I expect to fail.** No arm is CLEARED. If any arm clears, the empirical reference
fixed more than the thesis claims and D-A is smaller than `../family-c-pool/` measured.

**P5.** `N_P` becomes 600 (the baseline row count), so `μ̂_P^φ` carries *more* Monte Carlo error than
the 500-draw pool it replaces, and `../family-c-pool/` measured that class of error at ~1.6% — too
small to offset P1.

**What refutes the thesis.** P1 failing. Then the reference law is not what drives the 89.6%, and
`family-c-null-misspecification` is wrong and must be marked so.

## 7. What this will not establish

- **It does not make Family C valid.** D-A and D-B are independent; P3 registers in advance that this
  change is not expected to close D-A.
- **Nothing on real data.** `family-c-reachability-2026-08-04` found this detector compiles on **zero**
  real cells.
- **It does not test contaminated baselines.** An empirical reference inherits whatever contamination
  the baseline carries — the thing MCD trimming exists to handle and this change routes around. Every
  null here is clean by construction, so the study cannot see that cost.
- **It says nothing about the legacy streaming witness**, which still needs a real pool at runtime and
  is unaffected.

## 8. Disclosure

I wrote the thesis, I proposed the change, and I am running the study that scores it. P1's threshold
(0.20) was fixed on the thesis page before any of this was built, and P4 registers the outcome that
would mean I over-claimed the size of D-A.

## 9. Run discipline

1. This file is committed before the code change is made.
2. C-1 to C-3 run first; any failure stops the study.
3. Predictions scored verbatim against §6, including failures.
4. The code change ships on a branch and is not merged on the strength of this study alone.

---

## 10. Addendum, registered 2026-08-04 before the run — no repo change

**`deploysignal`'s HEAD is `drift-regime-sweep`, not `main`.** Another session owns that tree (it is
running the C11 drift-regime sweep). Under
`knowledge/methodology/concurrent-session-convention`, a non-`main` HEAD means the tree is not mine
to write to, so §2's three edits are **not being made**.

They are not needed. The quantity under test is the stamped `baseline_rff_mean` vector, and
`../family-c-pool/harness/run-pool.mjs` already established the pattern of **recomputing it in place
on the compiled bundle** after the shipped calibrator has run — with a self-test showing the
recomputation is bit-identical to the calibrator's when given the same inputs
(`l2_from_shipped = 0`). B1 therefore overrides the vector with
`mean over φ(relativeDeviations(rows, cell.mean_vector))` instead of editing the calibrator.

**What this changes about the study: nothing measurable.** The compiled artifact reaching the
detector is identical either way, because the calibrator's only output on this path is that vector.

**What it changes about the conclusion:** check **C-1** (schema key set unchanged) becomes vacuous —
no code is edited, so no field can appear or disappear — and it is withdrawn rather than reported as
passed. **C-2** (engine `dist` byte-identical) still runs and still means what it meant. §9 rule 4
already said the change would not be merged on this study's strength; it now additionally has not
been written, and shipping it stays a separate task requiring `deploysignal` to be back on `main`.
