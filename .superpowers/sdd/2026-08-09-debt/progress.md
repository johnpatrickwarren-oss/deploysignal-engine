# SDD ledger — plan: debt batch 1 (C47.2, C38.1, C39, C45 probe; operator: '1, 3, 4')
# worktree: ~/.sdd-worktrees/engine-debt (branch debt/batch-1 from main@8d3f789)

## Item order (prereg before code, every item)

| # | item | registration | code | commit |
|---|---|---|---|---|
| 1 | C47.2 — family_E `params: 'oracle'` mis-stamp | Erratum v1.4 + 3 dated REPORT appends | none by design (named-not-done) | `c232345` |
| 2 | C38.1 — `mean_e_lower_95` emission | Amendment v2.C38.1 | harness + 3 tests | `ee0d188` |
| 3 | C39 — increment estimator as the terminal-class REPORTED mean instrument | Amendment v2.C39 | harness + 3 tests | `6bc0afa` |
| 4 | C45 probe — KS residual decomposition | Amendment v2.C45 (design + numbers) | probe script | (in flight) |

## Suite baseline at main@8d3f789

`npm test` 351 · `test:cert` 179 · `test:coverage-battery` 131 (130 + 1 skipped) ·
`cert:validate-cards` 15 OK · `cert:expiry` all cards current.

## Registered suite deltas from this batch

- `test:coverage-battery` 131 → **137** (+3 for C38.1, +3 for C39).
- `cert:expiry` → **EXPIRED shape_ecdf_accumulator** (it is the one card pinning
  `validation/coverage/harness/run-battery.mjs`). Disclosed at Amendment v2.C38.1 §C38.1.7 and
  deliberately NOT resolved by a re-freeze: `tools/freeze-cards.mjs` has no per-card mode and a
  silent 15-card re-freeze is the defect K6A.5.3 itself disclosed. The check is a reported,
  non-gating CI step.
- `npm test` 351 and `test:cert` 179 unchanged.

## Verified invariance of the emissions

Paired smoke runs (`--n 20`, same seeds, COVERAGE_RESULTS_DIR redirected) before/after each harness
commit: **0 pre-existing fields changed on any of the 66 emitted rows.** New fields, on 3 rows only
(the terminal-instrument S2 rows of arms 30, 31, 32): `mean_e_sd`, `mean_e_lower_95`,
`increment_estimator`.

## Mutation kills recorded

| mutation | suite result |
|---|---|
| drop the `max(0, …)` clamp in `meanLower95` | 2 fail |
| `z` 1.645 → 1.96 | 1 fail |
| delete the Welford `pointM2` update | 2 fail |
| point-row estimator over the per-trajectory sample instead of per-point | 1 fail |
| `mean_e_sd` reads `.se` instead of `.sd` | 2 fail |

## Excluded, by the brief

C38.2–6 · C47.1 · C43. Each named in the task report.
Task 1: COMPLETE (c232345 C47.2 erratum / ee0d188 C38.1 / 6bc0afa C39 / f6608fb C45 probe / 3a846aa census append). C45 MECHANISM CLOSED: the KS excess is the shared calibration draw's own m-sample Kolmogorov statistic — 0.8687/sqrt(m) predicts the 100-draw mean to 0.969 and sd to 0.901; residual 0.61-3.70%; diagnostic tested against 1.36/sqrt(n_p) where the governing size is m; arm 34 a -0.87 sd draw, arm 47 +0.99 sd. Five independent confirmations. Concerns: expiry delta needs dedicated re-freeze (RULED, dispatched); C47.2 forward fix dispatched; three WORKLIST rows wrong at HEAD (C38.1 'no run records' FALSE — falsifier already evaluable 27/47 cells; C47.2 scope 18 rows; C45 row pairs unlike statistics) — wiki write-back items; K6.1.2 side-finding (T2 confirmation cannot distinguish claim from nominal, -1.02 draw-sd); C38.3 possibly part-stale (a wide adapter exists at collect.mjs:66-95).
Fix round: re-freeze (last, dedicated) + C47.2 forward micro-amendment+code dispatched.

## Fix round — executed 2026-08-09, in the coordinator's REORDERED sequence

The two additions were dispatched as "1. re-freeze / 2. C47.2 forward fix" and are committed in the
**reverse** order, on the coordinator's own instruction: the harness change re-expires the card, so
the re-freeze must be LAST for `cert:expiry` to be current at branch HEAD.

| order | item | commit | expiry after |
|---|---|---|---|
| 1st | C47.2 forward fix — Amendment v2.C47.2 + `calibratesFromHeldout` + 3 tests | `3f55f55` | **EXPIRED** (by design — the harness pin moved) |
| 2nd | dedicated card re-freeze, carrying nothing else | `f3503ce` | **all cards current** |

- `test:coverage-battery` 137 → **140** (+3 for C47.2). `npm test` 351, `test:cert` 179,
  `validate-cards` 15 OK — all unchanged.
- Re-freeze diff, at the git level: **15 files, 16 insertions, 16 deletions, and the only changed
  lines are `"sha"` and `"sha256"` values.** Fourteen cards moved `engine_pin.sha` alone
  (`4a48450` → `3f55f55`); `shape_ecdf_accumulator` also moved `source_files[1].sha256` — its
  `run-battery.mjs` pin, `e7d47350a6a5…` → `26f3e0789742…`. No detector source sha moved anywhere.
- C47.2 paired smoke diff: **103 rows compared, exactly 6 fields changed** — `params` on
  `family_E_conformal_heldout` cells 18–21 and arm 31's two rows. No other field, no new field.
- Mutation kills for C47.2: revert either arm ternary (2 fail), revert the fault-cell ternary
  (2 fail), make the predicate a `kind` test (3 fail).
- Corrected by append in the same round: C38.1.7's and v2.C39's paired-smoke row count was `66`
  (a live run's cell count transcribed into a smoke run's description); the smoke run emits `103`.
  The check covered more rows than claimed, not fewer.
- Also named in the README's freeze table: the gap it inherited — the table's last recorded pin was
  `597a97c` while the cards stood at `4a48450`, with four merges touching `cards/` in between and no
  row for any of them. Not reconstructed; named.

## Review fix round — executed 2026-08-09 (review APPROVED, four items)

| order | item | commit | expiry after |
|---|---|---|---|
| 1 | code: `mean_e_lower_95` identity made structural + comment overclaim corrected | `b74803b` | EXPIRED (by design) |
| 2 | prereg correction append to v2.C45 / v2.C38.1 (items 2 and 4) + probe `--shared-only` mode | `3b09139` | EXPIRED |
| 3 | README freeze-table column corrected by a row, blank line restored, snippet extended | `3952ea0` | EXPIRED |
| 4 | dedicated card re-freeze, LAST | `00131c1` | **all cards current** |

- `test:coverage-battery` 140 → **141** (+1: the source pin that kills the recompute mutation).
- **Every reviewer figure verified independently before use.** `K_0.95 = 1.358099` →
  `0.074423` (m=333) / `0.060736` (m=500); `sd[K] = 0.260333` from
  `pi^2/12 - (sqrt(pi/2)ln2)^2`; shared arm at `R = 80` reproduced at `0.038451` (K6-slow, ratio to
  closed form **0.9897**) and `0.035812` (K6, ratio **0.7523**), both CIs containing the review's
  ranges.
- **One reviewer claim I had to correct in the other direction:** my new exact assertion does NOT
  kill the recompute mutation behaviourally at these seeds — I measured it surviving. That is the
  finding restated, not a gap, so the kill is a source pin (K6A.3.1's precedent) and the comment
  claiming a behavioural kill is corrected in the same commit.
- Paired smoke diff for the structural change: **103 rows, 0 fields changed** — bit-for-bit
  identical output.
- Re-freeze diff: 15 files, **16 insertions / 16 deletions, only `"sha"` and `"sha256"` lines**.
  Fourteen cards moved `engine_pin.sha` alone (`3f55f55` → `3952ea0`); `shape_ecdf_accumulator` also
  moved its `run-battery.mjs` pin (`26f3e078…` → `6d3ccb16…`).
- Named-not-done, registered: the `heldout_seed`/`params` invariant test is one-directional
  (6 of 24 pairs) and is **not** expanded; v2.C45's arms other than `D = 1` are not settled at
  higher `R`.
