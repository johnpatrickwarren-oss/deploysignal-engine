# Pre-registration — Family C on the only covariance method that carries it

**Registered 2026-08-04 before the harness was written.** Engine `v0.6.6-pre`. Answers `WORKLIST.md`
C19 clause 1. Clause 2 was settled by inspection and needs no run — recorded in §2.

Append-only; results in `results/`.

## 1. The objection

`stats/shipped-path-2026-08-04` showed Family E's entire recorded behaviour was an artifact of
`covariance_method_override: 'mcd'`. **Family C is in the same position and worse.** The D7 gate
stamps `mmd_params` only for `mcd` or `mrcd`, and `chooseCovarianceMethod` returns `mcd` only when
`n ≥ max(5p, 200)`. Corpus cells that carry the betting detector have `n_samples ∈ [101, 114]`
(`stats/family-c-reachability-2026-08-04`), so **every cell that actually carries Family C is `mrcd`**
— and all four Family C studies used the `mcd` override.

Under `mcd` the covariance is **inflated** to ~1.12; under `mrcd` it is **deflated** to ~0.90
(`stats/contamination-2026-08-04`, `stats/shipped-path-2026-08-04`). The synthesized P-side pool is
drawn from that covariance, so the sign of the reference-vs-live mismatch reverses.

## 2. Clause 2, settled by inspection — no study required

`_calibrate-derive-cells.ts:37-39, 86-90`: the 840 cells are 168 `hour×day` × 5 tenant tiers, and the
aggregate cell is built by the same `dispatchBuildCell` on pooled rows across all cells and tiers.
Read from a compiled artifact (`runs/compiled-configs/slice-3c-parity-runA.json`):

- `aggregate_fallback.family_C.covariance_method` = **`ledoit_wolf`**, with
  `mcd_skip_reason: 'low_variance'` — it took the MCD branch and was **D6b-demoted**.
- All **672** cells labelled `aggregate_fallback` carry a covariance **identical** to it.
- `covariance_shrinkage` = 1.885×10⁻⁴, so LW's λ is negligible and it is effectively the sample
  covariance.

**Corpus by effective estimator: 749 of 840 (89.2%) Ledoit-Wolf, 91 (10.8%) mrcd.** Recorded here
rather than measured, and it materially softens `stats/shipped-path-2026-08-04` — the
anti-conservative path is a tenth of the corpus, not the whole of it. **It does not soften Family C,
because Family C exists only on the mrcd tenth.**

## 3. Design

Nulls, cell, calibrators and harness reused verbatim from `../family-ce-nulls/`. N=2000 × T=300 × 10
bundles, all four nulls.

| axis | levels |
|---|---|
| covariance | `mcd` (every prior study), **`mrcd`** (the only method that carries Family C in the corpus) |
| baseline n | 600 (prior-study comparability), **120** (corpus-realistic) |
| reference | **B0** synthesized pool (shipped), **B1** empirical over baseline rows (the C16 change) |

**Endpoints**, by `../family-ce-nulls/` §6 conventions: `E[exp(Δ log M)]` with one-sided 95% bounds
(REFUTED iff lower bound > 1; CLEARED iff upper bound < 1.0005), and the crossing rate at
α ∈ {0.05, 0.01}. `trace(Σ̂)/trace(Σ_true)` recorded per cell.

## 4. Registered predictions

- **P1 — the gate.** `mcd` / n=600 / B0 reproduces `stats/family-ce-nulls-2026-08-03`: increment
  1.006840 and crossing 0.1365 on `HC-gauss-corr`, 1.012538 / 0.8960 on `HC-mix-diag`. If it fails,
  nothing else is scored.
- **P2.** Under `mrcd` / B0 the Gaussian controls are still **REFUTED**, and the crossing rate is
  **comparable in magnitude to `mcd`, not obviously worse** — registered range **0.05–0.30** at
  n=600. Mechanism: MMD's witness responds to *any* reference-vs-live mismatch, and `|k−1|` is 0.116
  under mcd against 0.098 under mrcd, so the mismatch is similar in size and opposite in sign. **This
  is the prediction I am least sure of** — if the sign matters to the ONS bettor the two could differ
  a lot.
- **P3.** At n=120 both methods are **worse** than at n=600 on the crossing rate, by at least 2×.
  `stats/shipped-path-2026-08-04` found detector bias grows sharply as the cell shrinks even where
  covariance bias does not.
- **P4 — the one that matters for C16.** **B1 is insensitive to the covariance method.** Its `μ_P^φ`
  is computed from the real rows and touches `Σ̂` only through `mean_vector`, so the mixture crossing
  rate should stay near **0.0000** under `mrcd` exactly as it did under `mcd`
  (`stats/family-c-empirical-ref-2026-08-04`). If P4 holds, the C16 change is robust to the estimator
  question that invalidated everything else — which is an argument in its favour that its own study
  could not make.
- **P5.** `trace(Σ̂)/trace(Σ_true)` reproduces ≈1.12 under mcd and ≈0.90 under mrcd at n=600, and
  ≈0.92 under mrcd at n=120, matching `stats/shipped-path-2026-08-04`.

**What would refute the premise.** P2 failing *downward* — if `mrcd` crossing comes out at or below
nominal, then Family C is fine on the path it actually takes and the four prior studies were
pessimistic rather than merely misdirected.

## 5. What this will not establish

- **It does not revisit the C16 shipping decision.** That was settled on false-alarm and power
  evidence in `stats/contamination-2026-08-04` and `stats/shipped-path-2026-08-04`. P4 tests
  robustness, not merit, and a favourable P4 does not reopen it.
- **Nothing on real data**, and the detector compiles on zero real cells.
- **It does not test contaminated baselines** — `../contamination/` did that under `mcd` only, and
  redoing it under `mrcd` is a further study.
- **It does not measure the 89.2% Ledoit-Wolf majority for Family C**, because Family C does not
  exist there. What those cells run instead — safe-Hotelling, Family E — is out of scope.

## 6. Disclosure

I ran four Family C studies on an override before checking which estimator the corpus uses, and C18
exposed that for Family E. This study exists to find out how much of my own Family C record survives.
P4 is the outcome that would favour a change I proposed and that has already been rejected for other
reasons; §5 states in advance that it cannot reopen that decision.

## 7. Run discipline

1. This file is committed before the harness is written.
2. P1 runs first; failure stops the study.
3. Predictions scored verbatim, including failures.
4. Both `n` levels registered in advance — the C15 lesson, fourth application.
