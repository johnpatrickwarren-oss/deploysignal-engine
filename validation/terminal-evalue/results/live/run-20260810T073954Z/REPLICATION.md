# run-20260810T073954Z — the like-for-like live replication at N = 2000

Governed by `../../../POWER-PER-CELL-ADDENDUM-2026-08-10.md`, registered and committed at `3da2ff0`
before this run existed. One attempt, as registered. `node harness/run.mjs --mode live --n 2000`,
90 cells, wall clock 3.9 s.

Reference: `../../sim/run-20260805T230306Z` — the run the wiki page
`knowledge/stats/power-per-cell-2026-08-05` reads its power table from, `n: 2000`.

## Every registered prediction held, and the comparison is exact

| # | prediction | band | result |
|---|---|---|---|
| **PR1** | all 61 shared cell keys equal in full double precision | exact | **HELD — 827 fields compared, 0 deviations** |
| **PR2** | 90 cells written; 29 `POWER__*` arms whose `rate_e_ge_20` equals their validity cell's `power_this_cell` | exact | **HELD — 90 cells, 29 arms, 0 mismatches** |
| **PR3** | `mean_e_sd` / `mean_e_lower_95` present on all 58 validity cells and absent from the sim run | — | **HELD — 58/58 and 58/58 here, 0 in the sim run** |
| **PR4** | safe-t N2 power `1`; safe-t N4-p09 `0.7125`; UI N3-p09 and N4-p09 `0.0275`; pooled UI `0.70155`, safe-t `0.96085`, bf `0.9531701890989989` | exact | **HELD — every figure to the digit** |
| **PR5** | the cross-`N` deviations of the addendum's §2 do not shrink | — | **HELD by construction — nothing was re-measured at `N = 4000`** |

The 827 fields are every numeric and string field on the 61 shared keys except `mode`, `git_sha` and
`engine_version`, which are provenance and differ by design (`mode`: `sim` → `live`; `git_sha`:
`4b31a12` → `3da2ff0`).

## What this closes, stated at its actual size

**`knowledge/stats/power-per-cell-2026-08-05`'s power table now has a live run at its own `N`,
produced by committed code.** Both halves of the page are live-replicated at the `N` they were
measured at: the φ sweep by `run-20260807T215105Z` (verified cell by cell, addendum §2) and the
power table by this run.

**The provenance defect the addendum's §3 records is now the only thing separating the published
numbers from committed code, and it is closed in the direction that matters.** The sim run's stamped
`git_sha 4b31a12` still cannot have produced its own cells — that code throws
`ReferenceError: c is not defined` before writing a `power_this_cell` field — but this run shows the
committed harness at `3da2ff0` produces those cells' numbers exactly. The wrong stamp stays on the
append-only sim run as the record of it.

## What it does not close

- **The banner over-claim stands.** *"Every number this page publishes reproduces exactly"* is still
  false of the `N = 4000` live run it cites: UI's inert cells read `0.02225` there against the
  page's `0.0275`, a **−19.1%** relative gap, and safe-t's N4-p09 `mean_e` reads `9,710` against the
  page's `2,112`. What is true is the narrower sentence this run earns: *every number reproduces
  exactly at the `N` it was measured at.*
- **`WORKLIST` C38 item (2) is stale, not open.** It was answered on 2026-08-07 and refined here.
- **The heavy-tailed mean is no more measurable than it was.** A determinism check cannot move it.
- **This run's manifest does not cite the addendum that governs it.** `harness/run.mjs:160` hard-codes
  `addenda: ['POWER-PER-CELL-ADDENDUM-2026-08-07.md']`. The addendum authorized one execution and no
  code change, so the harness was not touched to fix the citation; the run is identified by
  `mode: live` with `n: 2000`, a combination no other run in the tree carries. Owed as a one-line
  recording fix on the next registration that touches this harness.
- One fault shape (+3σ mean shift) and synthetic nulls only.

---

## Correction append, 2026-08-10 (appended not edited): the provenance finding overstated, and the field-count rule stated

From an independent review. **No number in the comparison changed**: 61 shared keys, 827 fields, 0
deviations, all five predictions held.

**X1. "Uncommitted working-tree code" is wrong. The manifest stamps a sha that was rebased out.** The
addendum's §3 and this file's "what this closes" section concluded from the `ReferenceError` at
`4b31a12` that the sim run's numbers came from uncommitted code. The correct conclusion is narrower:
**the producing code is committed at `f02a12b`, and `run-20260805T230306Z`'s manifest and all 58 of
its cells stamp `4b31a12`, which is not in HEAD's history at all** (`git merge-base --is-ancestor
4b31a12 HEAD` exits non-zero; the commit exists as *"prereg + patch: un-pool the terminal study's
power control"* but was rebased away, and `f02a12b` is the surviving commit carrying that work with
the scoping defect already fixed).

`f02a12b` is pinned three ways, each an independent structural match against the run's own artifacts:

1. **The write site.** `f02a12b`'s `harness/run.mjs` sets `power_this_cell` and `power_verdict`
   **inside** the alpha loop and writes each cell once — which is why all 58 validity cells carry the
   field, and is exactly what `4b31a12`'s post-loop `c.power_this_cell` cannot do.
2. **The manifest key set.** `f02a12b` writes `{study, mode, engine_version, git_sha, node, seed, n,
   n_test, alphas, generated_at}` and no `prereg` / `addenda` keys. `run-20260805T230306Z`'s manifest
   has exactly those ten keys — the `prereg`/`addenda` keys arrive with `fc74a61`.
3. **The cell field set.** `f02a12b` emits no `mean_e_sd` and no `mean_e_lower_95`; the run's cells
   carry neither, and both arrive with `fc74a61`.

**So the sim run is reproducible from committed code and the defect is a wrong provenance stamp, not
missing provenance.** That is a smaller finding than the one filed and it is the one that is true. The
append-only run keeps its wrong stamp; this file is the record of which commit produced it.

**X2. The 827-field rule, stated so the count is checkable.** "827 fields" is the count over the
**intersection** of the two cells' key sets on the 61 shared keys — every key present in **both**
runs' cells — minus `mode`, `git_sha` and `engine_version`. Keys present in only one run are not
compared and are reported separately: 3 new fields on the live side (`mean_e_sd`,
`mean_e_lower_95`, and `power_verdict` where absent), and 29 live-only `POWER__*` cells, scored under
PR2 and PR3 rather than PR1. **No key present in the sim run is missing from the live run**, which is
the direction that would matter.
