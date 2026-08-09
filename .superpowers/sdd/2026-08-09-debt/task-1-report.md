# Task 1 report — debt batch 1 (C47.2, C38.1, C39, C45 probe)

Worktree `~/.sdd-worktrees/engine-debt`, branch `debt/batch-1` from `main@8d3f789`.
Four items, four commits, one per item, each pathspec-scoped. Prereg before code on every item.

| # | item | commit | registration | code |
|---|---|---|---|---|
| 1 | C47.2 — `family_E` `params: 'oracle'` mis-stamp | `c232345` | Erratum v1.4 + 3 dated REPORT appends | none, by design |
| 2 | C38.1 — `mean_e_lower_95` | `ee0d188` | Amendment v2.C38.1 | harness + 3 tests |
| 3 | C39 — increment estimator as the terminal-class REPORTED mean instrument | `6bc0afa` | Amendment v2.C39 | harness + 3 tests |
| 4 | C45 probe — KS residual decomposition | `f6608fb` | Amendment v2.C45 (design + numbers) | `tools/ks-decomposition.mjs` |

## Three corrections this batch had to make first

1. **C38.1's premise is false at HEAD.** The WORKLIST says *"no run anywhere in the repo records
   that field"*. **54 cells record `mean_e_lower_95`** — `terminal-evalue/run-20260807T215034Z`
   (40 cells) and `phi-identifiability/run-20260807T215105Z` (14) — registered by
   `POWER-PER-CELL-ADDENDUM-2026-08-07.md` change (a) and described in
   `validation/certification/README.md`. safe-t's frozen falsifier is already evaluable on **27 of
   its 47** candidate cells. The residue is real and is this battery's alone: **0 of its 3
   terminal-class S2 rows** carry the bound. Census in C38.1.1.
2. **C47.2's scope is six rows per run, not one.** Cells 18–21 (K4 fault) plus arm 31's S2 and S3
   rows, across three live runs — **18 rows**. Two REPORTs already noted "arm 31" alone and
   understate it by four rows each.
3. **C45 pairs two different statistics.** `0.02290` is a KS statistic on T1 arm 34; `0.01671` is
   `P(p <= 0.05)` on the T2 arm. Not "the same formula, opposite readings". The T2 REPORT is not at
   fault — it compares α-point rates across tiers and mentions the KS separately.

## C45 probe verdict — MECHANISM CLOSED

The excess is **the shared calibration draw's own `m`-sample Kolmogorov statistic**.

| component | K6-slow (`m = 500`) | K6 (`m = 333`) |
|---|---|---|
| (a) atom, exact `1/(m+1)` | `0.001996` | `0.002994` |
| (a) lattice-only MC at `n_p = 20,000` | `0.007326` (critical `0.009617` — does not reject) | `0.008697` |
| (b) shared, `D = 1` | `0.042637` (sd `0.016530`) | `0.037574` (sd `0.016908`) |
| (c) residual = independent − atom, matched `n_p` | `0.001516` = **3.70%** | `0.000219` = **0.61%** |

`D`-sweep decays as `1/sqrt(D)` onto the (a) floor (`KS(D)*sqrt(D)` flat at `0.0426 / 0.0465 /
0.0431 / 0.0410` over `D = 1,2,5,10`). Closed form `0.8687/sqrt(m)` predicts the registered 100-draw
mean to `0.969` and its sd to `0.901`, and all five measured quantiles to within `6%`. The shared arm
is **flat across a 40× range of `n_p`** (`0.0324 / 0.0354 / 0.0337 / 0.0335` on K6) where sampling
noise falls `6×` — a bias, not noise. Reproduced under a **different PRNG** than the study's.

**Consequence:** `computePUniformity` tests against `1.36/sqrt(n)`, which assumes independence and a
continuous reference; the construction has neither. The governing sample size is **`m`**, not `n_p`.
At `m = 500`, `0.0376` is the **median** outcome. Arm 34's `0.022904` is a `−0.87` sd draw; arm 47's
`0.041150` a `+0.99` sd draw.

**Not claimed:** validity. `E[e|H0] <= 1` rests on the marginal, which the exact null `0.991433` and
the across-draw increment centring speak to and this probe does not touch.

## Suites

| suite | baseline at `main@8d3f789` | after |
|---|---|---|
| `npm test` | 351 / 0 fail | **351 / 0 fail** |
| `npm run test:cert` | 179 / 0 fail | **179 / 0 fail** |
| `npm run test:coverage-battery` | 131 (130 + 1 skipped) | **137 (136 + 1 skipped)** — +3 C38.1, +3 C39 |
| `npm run cert:validate-cards` | 15 OK | **15 OK** |
| `npm run cert:expiry` | all cards current | **EXPIRED shape_ecdf_accumulator** — registered delta |

**The expiry delta.** `cards/shape_ecdf_accumulator.json` is the one card pinning
`validation/coverage/harness/run-battery.mjs`, so any change to the harness expires it. Disclosed at
Amendment v2.C38.1 §C38.1.7 and **deliberately not resolved**: `tools/freeze-cards.mjs` has no
per-card mode (it restamps all 15 `engine_pin.sha`s), and a re-freeze riding inside an unrelated
commit is the defect K6A.5.3 itself disclosed. The check is a reported, non-gating CI step. **A
freeze is the operator's decision, not this batch's.**

## Emission invariance, verified

Paired smoke runs (`--n 20`, same seeds, `COVERAGE_RESULTS_DIR` redirected) before/after each harness
commit: **0 pre-existing fields changed on any of the 66 emitted rows.** New fields appear on 3 rows
only (the terminal-instrument S2 rows of arms 30, 31, 32): `mean_e_sd`, `mean_e_lower_95`,
`increment_estimator`.

## Mutation kills

| mutation | result |
|---|---|
| drop `max(0, …)` in `meanLower95` | 2 fail |
| `z` 1.645 → 1.96 | 1 fail |
| delete the Welford `pointM2` update | 2 fail |
| point-row estimator over the per-trajectory sample | 1 fail |
| `mean_e_sd` reads `.se` instead of `.sd` | 2 fail |

## Named-not-done (inside the four items)

- **C47.2: the harness stamp is not fixed.** Emitting `'heldout-empirical'` for
  `family_E_conformal_heldout` changes a registered field's value and needs its own amendment — the
  three siblings each took one (K4.1.5, K6.9, K6A.1.10). An erratum registers nothing. Future runs
  still emit `'oracle'`.
- **C38.1 / C39: no rerun, nothing recomputed.** The two historical mean-rule overrides
  (`group_average_e_value` `mean_e 1.914`, `family_E_conformal_heldout` `mean_e 4.176`) keep their
  REFUSEs. Neither the bound nor the increment estimator is recoverable from a recorded mean.
- **C39: no verdict authority transfer.** That means changing `CLASS_INSTRUMENTS.terminal_e_value`
  and `lib/score.mjs` — a certification-protocol change, out of scope.
- **C39: the across-draw spread of `increment_estimator` on the terminal rows is unmeasured.** The
  registered caveat's `9.3×` is scoped to `shape_ecdf_accumulator` at `κ = 0.682`.
- **C45: `computePUniformity`'s critical value is not changed.** A different reference distribution
  for a registered emission needs its own amendment with its own null.
- **C45: the single-draw protocol question stays open** — WORKLIST C51 item (4).

## Excluded by the brief

- **C38.2** — live replication of the 2026-08-05 power-per-cell/phi-sweep runs (sim-only today).
- **C38.3** — the 426-cell `clustersynth-ui` wide-format adapter. Note: a `sui_`/`ui_` wide adapter
  already exists at `lib/collect.mjs:66-95`; whether it covers the 426 cells was not assessed.
- **C38.4** — per-null power pairing for the 29 in-regime validity cells.
- **C38.5** — `family_C_safe_hotelling`'s zero S2 audit cells.
- **C38.6** — the unmeasured `c`-bounds behind two bootstrap-substituted thresholds.
- **C47.1** — the O(1/n) exchangeability quantification / out-of-fold restructure (K4.1.10).
- **C43** — the φ-estimated safe-t measurement (separate task).

## Wiki write-backs owed (wiki is READ-ONLY here)

1. `C38` row (1): the "no run records that field" claim is false at HEAD — 54 cells, two runs.
2. `C47` row (2): scope is 6 rows per run × 3 runs = 18, not arm 31 alone.
3. `C45` row: `0.02290` (KS, T1) and `0.01671` (`P(p<=0.05)`, T2) are different statistics; the
   mechanism is closed; the diagnostic's critical value never applied and `m` is the governing `n`.
4. `stats/terminal-mean-rule-contested`: C39's registered mandatory caveat, and K3.1.3's filing rule
   now extended to the terminal class.
5. `K6.1.2`'s α-point conservativeness claim: the T2 reading cited as confirming it sits `−1.02`
   draw-sd from nominal at `m = 45` and cannot distinguish it from nominal. No verdict.
