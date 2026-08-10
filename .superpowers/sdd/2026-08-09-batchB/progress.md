# SDD ledger — plan: open-items batch B (C38.5 + C38.4)
# worktree: ~/.sdd-worktrees/engine-batchB (branch open/batch-b from main@3f556c1)

## Task 1 — C38.5 + C38.4 — DONE 2026-08-09

Commits, in order:
- `754787e` prereg: h0-battery Amendment A3 (registration act; predictions, bands, outcome mapping,
  stop conditions all registered before any code)
- `bc6a4f7` prereg: correction append to A3.5 (stop condition 1 was structurally unsatisfiable)
- `93d0f5b` harness + the one live run `inc-20260810T064226Z` (24 cells)
- `6b180cb` cert re-score `run-20260810T064520Z`, golden delta, corpus census 2266 -> 2290, README,
  and A3's results append with three corrections to my own registered derivation

Premise verdicts: **item 5 true on the consequence, incomplete on the reason** (36 validity cells are
pooled, not absent; `isValidityCell` recognises none of a P1 row's fields — A1.3's second gap).
**Item 4 premise false**: 29 is stale, the true figure is 11, all `sequential_ui_e_process`, and those
are named-not-filled because that detector has no registered fault construction anywhere.

Verdict movement: `family_C_safe_hotelling` **NOT_EXECUTABLE -> REFUSE**, S2 MISSING -> REFUTED, per
A3.7's registered mapping. S3 stayed PASS (perCell 1 -> 13). Nothing else moved.

Suites at the final commit: 351 / 181 / 150+1 skipped / 7 (h0) / 15 cards / all cards current. No
re-freeze needed or performed.

Full detail: `task-1-report.md`.
