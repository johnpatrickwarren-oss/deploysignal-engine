# Pre-registration — what Family E does on the covariance path that actually ships

**Registered 2026-08-04 before either harness was written.** Engine `v0.6.6-pre`. Answers
`WORKLIST.md` C18, both clauses.

Append-only; results in `results/`.

## 1. Why this exists

`stats/contamination-2026-08-04` measured MRCD's covariance at **0.90 of truth** — deflated — where
MCD is **inflated** to 1.13. `stats/family-c-reachability-2026-08-04` found **every compiled cell in
the corpus is MRCD**. Every Family C and Family E measurement on record used
`covariance_method_override: 'mcd'`, so **the entire evidence base describes a path the product does
not take, and it is biased in the opposite direction from the one that ships.**

A deflated `Σ̂` inflates `s² = rᵀΣ̂⁻¹r`, which pushes Family E toward **more** firing — the reverse of
the 240× silence recorded in `stats/family-ce-nulls-2026-08-03`.

## 2. Why n matters, and what routing actually happens

`chooseCovarianceMethod(p, n, opts)` (`_family-c-build.ts:87-97`):

```
if (p > 20) return 'ledoit_wolf';
if (n >= max(5p, 200)) return 'mcd';
return 'mrcd';
```

At p=11 the MCD branch needs `n ≥ 200`. **Corpus cells carry n_samples 86–114**
(`stats/family-c-reachability-2026-08-04`), so they route to **mrcd**. Every prior study used
n=600 baselines, which route to `mcd` and are then demoted by D6b to `ledoit_wolf` unless overridden.

So the baseline size is not a free parameter — **it selects the estimator**, and no prior study ran
at the size the corpus actually has.

## 3. Part 1 — Family E across the three covariance methods

Nulls, cell and harness reused verbatim from `../family-ce-nulls/`. N=2000 × T=300 × 10 bundles.

| axis | levels |
|---|---|
| covariance | `mcd` (override — what every prior study used), `mrcd` (**what ships**), `ledoit_wolf` |
| baseline n | **120** (corpus-realistic) and 600 (prior-study comparability) |
| null | the four `family-ce-nulls` nulls |

**Endpoints.** Family E's per-tick **indicator rate** at α ∈ {0.05, 0.01}, and the trajectory
**crossing rate**, both by the `family-ce-nulls` §6 conventions. Alongside each cell,
`trace(Σ̂)/trace(Σ_true)`, so the detector result and its cause are recorded together.

**Anti-conservative iff the one-sided 95% lower bound on the indicator rate exceeds α.**

### Registered predictions

The first-order model is `s² = χ²_p / k` for `Σ̂ = k·Σ_true`, giving indicator rate
`P(χ²_p > k·q_{p,1−α})`.

- **P1 — the direction, which is the point of the study.** Under **mrcd**, Family E's indicator rate
  is **above nominal** at α=0.05 on the Gaussian arms, and **at least 2× the 0.0332 measured under
  the mcd override**. Point estimate 0.087; registered range **0.06–0.15**. The range is wide because
  the model predicted 0.0225 for the mcd cell where 0.0332 was measured — a 1.5× under-prediction —
  so the calibration cutoff is not exactly `χ²_{p,1−α}` and the point estimate is not to be trusted
  to better than that factor.
- **P2.** Under **mcd** at n=600 the study reproduces `family-ce-nulls`: indicator 0.0332 ± 0.005.
  This is the replication gate; if it fails, nothing else is scored.
- **P3.** `trace(Σ̂)/trace(Σ_true)` comes out ≈1.13 under mcd, ≈0.90 under mrcd, replicating
  `stats/contamination-2026-08-04` inside the detector harness rather than in an estimator-only one.
- **P4.** At α=0.01 the mrcd over-firing is **proportionally worse** than at α=0.05 (2.19× vs 1.74×
  nominal by the model), because the deflation acts further into the tail.
- **P5 — the one I am least sure of.** `ledoit_wolf` lands **between** mcd and mrcd on the trace
  ratio and produces an indicator rate closer to nominal than either. LW shrinks toward a diagonal
  target, and whether that inflates or deflates the trace is not something I have derived.
- **P6.** At n=120 all three methods are noisier and further from nominal than at n=600, but the
  **sign** of each method's bias is unchanged.

**What refutes the concern.** P1 failing — if Family E is conservative or nominal under mrcd, then
the deflation does not propagate to the detector and C18's premise is wrong.

## 4. Part 2 — the power endpoint, re-run near the detection boundary

`stats/contamination-2026-08-04` recorded its own defect: every arm detected the ×2 variance fault at
**1.0000** at every ε, so the specification-versus-contamination trade was only half measured. The
fault shape was taken from the `family-ce-nulls` vacuous-pass guard, which exists as a floor.

Re-run `../contamination/harness/run-part-b.mjs` arms **B0 / B1 / B2** × `ε ∈ {0, 0.05, 0.10, 0.20}`
with a fault near the detection boundary: a **+0.75σ mean shift from tick 100**, the `δ*` the
effect-size sweep located (`stats/effect-size-sweep-2026-08-04`).

### Registered predictions

- **P7.** No arm saturates: every power figure lands strictly inside (0.05, 0.95) for at least one ε.
  If everything is again 1.0000 or 0.0000, the endpoint is still mis-specified and I say so rather
  than reporting the numbers.
- **P8.** **B1's power falls with ε** — the claim `contamination-2026-08-04` could not test. Below
  0.5× its ε=0 value by ε=0.20.
- **P9.** B0's power is the flattest in ε of the three.
- **P10.** The shipping verdict does **not** change. C16 stays unshipped on the false-alarm evidence
  alone, whatever the power arm shows. Registered so that a favourable power result cannot be used to
  reopen a decision the false-alarm data already settled.

## 5. What this will not establish

- **Nothing on real data**, and the detector compiles on zero real cells.
- **It does not re-measure Family C under mrcd.** Family C's betting e-process needs `mmd_params`,
  which the D7 gate stamps only for mcd/mrcd — so an mrcd Family C cell is reachable and worth
  measuring, but it is a third study and mixing it in would confound Part 1's single-detector focus.
- **n=120 is one point, not a sweep.** The corpus range is 86–114 and the D7 minimum is 100, so
  cell-size effects near that threshold are unexamined.
- **It does not test contaminated baselines in Part 1.** Part 2 does; Part 1's baselines are clean.

## 6. Disclosure

C18 exists because I ran four studies on an `mcd` override without checking which estimator the
corpus uses. P2 is the gate that proves the harness still reproduces those studies, and P1 is
registered with a deliberately wide range because the model that generates it already mispredicted
the one cell where I have a measurement.

## 7. Run discipline

1. This file is committed before either harness is written.
2. P2 runs first. If the mcd/n=600 cell does not reproduce `family-ce-nulls`, stop.
3. Predictions scored verbatim, including failures.
4. Both `n` levels are registered in advance — the C15 lesson, applied for the third time.
