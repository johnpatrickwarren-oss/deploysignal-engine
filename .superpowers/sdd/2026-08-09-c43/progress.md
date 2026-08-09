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
Task 1: COMPLETE (91e5532 Erratum v1.5 / a180acd disclosure pins / 5d07ef3 probe+self-corrections / 7b9668a ledger). PREMISE FALSE on operative claims: phi estimated TRUE, but regime tags derive from data-generating conditions not API shapes (nulls.mjs:28-49, ruled in code before the row existed); N1 -> phi_source oracle; coverage layer not regime-gated BY DESIGN (score.mjs:332 'power is not a validity claim'); safe_t S2 = 47 cells, 0 from this battery. K1/K2/K5 YES + tiers + rates UNCHANGED. Strict-reading price sheet registered (K2/K5 would flip NO if coverage were regime-gated) — OPERATOR PROTOCOL QUESTION, file as new row. Residual N1-stamp mislabel: RULED option 1, dispatched. grep-treats-score.mjs-as-binary tooling nuisance noted (NUL byte at 14217, known).

## Task 2 — the residual: per-detector `null_id` (operator ruling, option 1)

| # | item | registration | code | commit |
|---|---|---|---|---|
| 4 | C43.1 per-detector `null_id` | Amendment v2.C43.1 | none yet | `e5d8053` |
| 5 | the harness change + 3 tests | v2.C43.1 C43.1.5 | `nullIdFor`, 3 tests, 4 mutations killed | `431894a` |
| 6 | card identity re-freeze | C43.1.6 item 1 | pins only, dedicated commit | `c6a1a6b` |

Mapping: `safe_t`/`group_average_e_value` φ=0 `N1`→`N2-m100` (φ=0.6 unchanged);
`universal_inference` φ=0 `N1`→`N2-m100`, φ=0.6 `N3-p06`→`N4-p06`. Everything else unchanged,
per-detector reasons registered. New guard: throws outside φ ∈ {0, 0.6}.

Paired smoke `--n 20`, identical seeds: **103 rows both sides, 60 differ in `null_id` only, 0 differ
in any other field, 43 bit-identical.** Scoring priced against the real scorer over the committed
run: no stage status, class answer or pairing list moves on any of the four affected cards.

Suite deltas: `test:coverage-battery` 141 → **144**; `test:cert` 181 (task-1 delta held); `npm test`
351; `validate-cards` 15 OK; `cert:expiry` EXPIRED shape_ecdf_accumulator → **current** after the
pins-only freeze.

## Task 3 — review findings F1–F9 (review APPROVED with findings)

| # | item | commit |
|---|---|---|
| 7 | correction append F1–F9 + both probes committed to `tools/` (F5) + README rows | `830b916` |
| 8 | F4: `lib/score.mjs:265` literal NUL → `\0` escape | `d8e60eb` |
| 9 | card identity re-freeze, pins only (9 cards pin `score.mjs`) | `fcfb9b4` |

**F1 is the substantive one and it corrected my own price sheet.** A class answers YES iff a card
with overall `USE` has it `COVERED`, so the strict reading strikes a class through the CARRIER, not
the coverage layer. `point_tail_bet_e_value` and `group_average_e_value` are each one S2 cell wide →
both `NOT_EXECUTABLE`. **K4 flips YES→NO under the strict reading ALONE** (C43.5 had said no class
moves without a second change); K2 and K5 still need the second change; two card verdicts move.
`safe_t_e_value` unmoved, `USE`/T1 either way. Verified portfolio-wide with the real scorer through
`overallVerdict`; probe input limitation disclosed per card.

F2: 111 → **121** rows (UI's 10 `N3-p06` rows). F3: the "results/ untouched" sentence corrected
against its own commit. F6: filename misquote. F7: the cites this branch's own insertion moved,
tabulated. F8/F9: the `N2-m100`-beside-`params: 'oracle'` inconsistency named, and the four
held-out candidates' ids promoted from cosmetic choice to a named open item with a measured
consequence (they ARE the K4 exposure).

Suites at `fcfb9b4`: `npm test` 351 · `test:cert` 181 · `test:coverage-battery` 144 (143 + 1
skipped) · `validate-cards` 15 OK · `cert:expiry` all cards current. Zero NUL bytes remain in the
certification lib, the coverage harness or the probes.
