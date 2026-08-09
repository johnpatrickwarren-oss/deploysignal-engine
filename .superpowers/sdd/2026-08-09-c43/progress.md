# SDD ledger — plan: C43 phi-known erratum resolution (operator: '1, 3, 4')
# worktree: ~/.sdd-worktrees/engine-c43 (branch c43/phi-regime from main@235efa8)

## Suite baseline at main@235efa8

`npm test` 351 · `test:cert` 179 · `test:coverage-battery` 141 (140 + 1 skipped) ·
`cert:validate-cards` 15 OK · `cert:expiry` all cards current.

## Item order (registration before code)

| # | item | registration | code | commit |
|---|---|---|---|---|
| 1 | C43 premise verification + verdict | Erratum v1.5 + dated REPORT append | none | `91e5532` |
| 2 | disclosure pins for the two behaviours the verdict rests on | Erratum v1.5 C43.9 | 2 tests, mutation-killed | `a180acd` |
| 3 | probe provenance (tools/README.md standard) + 2 self-corrections | correction append to v1.5 | probe script | `5d07ef3` |

## Registered suite deltas

- `test:cert` 179 → **181** (+2 disclosure pins). Everything else unchanged; `cert:expiry` stays
  "all cards current" — no card pins a test file and no harness/detector/scorer file changed.

## Outcome

Premise FALSE at HEAD on its operative claim (the cells are in regime; the class-answer layer reads
no regime), TRUE on its factual half (φ is estimated at every φ=0 cell). No run registered — see
task-1-report.md.
