# Pre-registration — e-BY false-coverage control on the mixture confidence sequence under selection (`2026-09-e-by-fcr`)

- **Study id:** `2026-09-e-by-fcr`
- **Register:** `knowledge/WORKLIST.md` C62 (b); `knowledge/stats/pages/ramdas-wang-2025.md` §7
  (Proposition 13.4, Definition 13.6, Theorem 13.7); `knowledge/stats/pages/mixture-cs-2026-09-02.md`
  (the confidence sequence this study composes).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`;
  `knowledge/methodology/harness-discipline`.
- **Status: REGISTERED, NOT RUN.** At this commit no e-BY module exists in `fleet/`, the mixture
  verdict does not carry its confidence sequence (the `PageCusumMixtureSupermartingaleResult`
  field is dropped before the `DetectorVerdict`, `detectors/_page-cusum-mixture.ts:165-175`), and
  no harness exists. This file is committed first so that no endpoint, band, grid or seed below
  can be chosen after a number is seen. Later commits must not edit it; a change is an amendment,
  appended and dated.

## 1. The claim under test

Ramdas–Wang 2025 Theorem 13.7: for a **level-free** family of e-CIs `{C_i(α)}` per signal
`i ∈ K`, the e-BY procedure — report each selected `i ∈ S` at `α_i = δ|S|/K` — has
`FCR = E[#{i ∈ S : θ_i ∉ C_i(α_i)} / (|S| ∨ 1)] ≤ δ` under any dependence and **any selection
rule**. Proposition 13.4: a confidence sequence built from an e-process that does not depend on
α, stopped at any stopping time, is such a family. The engine's mixture CS
(`detectors/mixture-confidence-sequence.ts`) inverts `log M_t(S_t − tm)`, which does not involve
α, so `C_t(α) = S_t/t ± sqrt(v·log(v/(α²ρ)))/t`, `v = σ²t + ρ`, is level-free: one set of inputs
`(S_t, t, σ², ρ)` yields the interval at every level. This is what the engine will expose and
what e-BY will re-invert.

## 2. What will be built (registered, not yet written)

- `detectors/mixture-confidence-sequence.ts`: `LevelFreeMixtureCs = {S_t, t, sigma_squared,
  sigma_squared_prior}` and `mixtureConfidenceSequenceAt(lf, alpha)`; the existing function
  becomes a call to it (byte-identical output, asserted by test).
- `types/verdict-extensions/evidence-surface.ts`: optional `confidence_sequence` on
  `EvidenceSurface`: `{ level_free, alpha, center, half_width, lower, upper, excludes_zero }`.
  Attached by `detectors/_page-cusum-mixture.ts` on the Gaussian path only. Additive; every
  existing consumer of `evidence` is unchanged.
- `fleet/e-by.ts`: `eByLevel(delta, selectedCount, K)` = `δ|S|/K` and
  `eBenjaminiYekutieli(selected, K, delta)` returning per-selected `{id, alpha_i, center,
  half_width, lower, upper}` from each signal's `level_free` inputs. Guarantee stated on the type
  exactly as Theorem 13.7 states it, with the premise (level-free e-CIs, i.e. the mixture's
  construction premise: conditionally sub-Gaussian(σ) residuals under the reference law).
- ADR 0030.

## 3. The study

Substrate: the engine's own `evaluatePageCusumMixtureSupermartingale` (dist), per signal, oracle
`μ = 0`, `σ² = 1`, no AR(1); `ρ ∈ {1, 38}` (the mixture-cs study's two values); the detector's
own `α = 1e-3` for its fire rule (irrelevant to the CS family; recorded). `K = 20` signals,
`T = 300` ticks, iid N(θ_i, 1) with `θ_i = δ_shift` on the first `L = 5` signals and 0 on the
rest, `δ_shift ∈ {0, 0.75, 1.5}`. The estimand for signal `i` is `θ_i`; a miss is `θ_i ∉ C_i`.

Two selection rules, both applied at the report tick `τ = T` (a stopping time) and, for rule A,
also at each selected signal's own first-fire tick `τ_i` (a stopping time per signal):

- **Rule A — the DeploySignal rule**: `S` = the signals whose mixture has fired by `T`.
- **Rule B — extremeness**: `S` = the 3 signals with the largest `|S_T|`, always non-empty.

Per (ρ, δ_shift, rule, τ) cell, `N = 2,000` replications, seeds `20260906 + 7919·i + SALT[cell]`,
`SALT` = 10⁶·(cell index). Every cell records `n`, `mean |S|`, `fcp` per replication → `fcr`,
`fcr_se`, and for the naive comparator the same with `α_i = δ` for every selected signal.

**Endpoints, HELD/FAILED on their own bars (FCR levels δ ∈ {0.05, 0.10, 0.20}):**

- **P1 — e-BY controls FCR (validity, the ship gate).** In every cell and at every δ:
  `fcr_eBY ≤ δ + 3·fcr_se`. Registered prediction: HELD everywhere, with `fcr_eBY` well below δ
  (the Ville bound on the CS is loose by the same factor the mixture-cs study measured, P1 there
  0.023–0.030 at α = 0.05).
- **P2 — the naive intervals fail under extremeness selection (reported, no ship consequence).**
  Rule B, `δ_shift = 0`: `fcr_naive(δ) > δ` at δ = 0.05 for at least one ρ. Registered
  prediction: HELD (the miss event and the selection event both live in the tail of `|S_T|`).
  Under rule A the naive FCR is reported without a bar.
- **P3 — the e-BY price is the closed form (reported).** Half-width ratio e-BY/naive at `τ = T`
  equals `sqrt(log(v/(α_i²ρ)) / log(v/(δ²ρ)))` to 1e-9 in every replication (a consistency check
  on the re-inversion), and its mean per cell is reported.
- **P4 — the two rules agree with the theorem's "any selection rule"** (structural): P1 holds
  under rule B as well as rule A; there is no separate bar, it is P1's cell set.

Harness rules: no catch anywhere; the CS at level `δ|S|/K` is recomputed by the e-BY module from
the evidence surface's `level_free` inputs (not from the harness's own arithmetic), and the
harness independently asserts the interval against the closed form at 1e-12 on every
replication; the mixture is driven through its shipped evaluator so `S_t` is the shipped `S_t`.

Output: `results/live/run-<UTC>/{manifest.json, cells.json, REPORT.md}` and
`analysis/check_report.mjs` re-deriving every number in the report from `cells.json`.

## 4. Ship rule

P1 HELD in every cell → the module, the evidence field and ADR 0030 ship, and DeploySignal may
report e-BY intervals for its fired set (its C62 (b) half, a separate PR after the engine tag).
P1 FAILED in any cell → nothing ships; the cell is filed on the wiki as a contradiction between
the measurement and Theorem 13.7 (which can only mean the CS is not level-free as built, or the
harness is wrong), `confidence: contested`, and the study stops.

## 5. What this study does not measure

The estimation premise (μ̂, σ̂² from a window; mixture-cs P3/P4 price it and the same price
applies to every interval here); AR(1) whitening; heavy tails; the DeploySignal wiring itself;
FDR of the selection (e-BH's, not this study's). Theorem 13.7's "any dependence" is exercised
only through independent signals here; a dependent-signal arm is a named non-measurement.
