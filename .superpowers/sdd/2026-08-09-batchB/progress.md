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

### Review corrections 2026-08-10 (review APPROVED; movement and both instrument findings reproduced)

- `9dda837` prereg: review corrections append to A3 — C1 pairing counterfactual 12 -> **2**
  (`pairingGaps` fires only on in-regime CLEARED cells, and only N1/N7 cleared; the pre-run claim
  contradicted A3.6's own zero-CLEARED prediction), C2 stop-label collisions + the sim-mode
  deviation, C3 only phi=0.9 is signal (median bias measured at -0.040%; CLEARED 13.5% vs REFUTED
  2.0% at an exactly-calibrated null), C4 N6's NON_FINITE path separated from the negative-bound
  path, C5 "pooled but never recognised as candidates".
- `5d10922` harness: calibration-stream comment corrected against `run.mjs:44` (independent stream is
  a registered DEVIATION, not agreement), stop labels made unique. Comments and label strings only —
  a `--mode sim` re-run reproduces all 24 committed cells modulo `mode`/`git_sha`.
- `bedfcbb` cert: golden comment — counterfactual 12 -> 2, the 29 -> 11 split attributed to
  `safe_t` 8 + `universal_inference` 10, and the candidate-recognition wording.
- sdd: this ledger and the report — **deliberately not naming its own sha.** A first draft guessed
  one, an amend to fix it moved the sha again, and a commit cannot name itself: the same structural
  trap A3.5's correction append names for `freeze-cards.mjs` and for A3's own pin. `git log` is the
  authority for this line.

Arm A3-W stays independently justified. No verdict moves, nothing re-run, no run directory edited.
