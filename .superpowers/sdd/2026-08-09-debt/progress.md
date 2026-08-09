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
