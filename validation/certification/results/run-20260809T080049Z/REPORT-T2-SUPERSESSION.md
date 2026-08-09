# Re-score `run-20260809T080049Z` — the T2 A-placement supersession, and the golden delta that is empty

A companion to this directory's generated `REPORT.md`, **not an edit to it**: `REPORT.md`,
`COVERAGE.md` and the fifteen `*.card.json` are emitted by `validation/certification/verdict.mjs`
and are checked column-for-column by `validation/certification/test/report-consistency.test.mjs`,
so a narrative belongs beside them. Every number here is read from the committed JSON in this
directory and from the coverage run it consumed.

`report_format: 6`, `protocol_version: 1`, engine sha `5b6e611133038d3c92a2502969f1d69ccba69ede`,
node `v25.9.0`, 15 cards. The coverage run consumed:
`coverage-t2-clustersynth/run-t2-20260809T075607Z`, committed at
`5b6e611133038d3c92a2502969f1d69ccba69ede`.

## Why this re-score exists

Amendment **v2.K6A.7** (K6A.7.7) ruled the prior T2 run
`coverage-t2-clustersynth/run-t2-20260809T040552Z` **superseded as scored evidence** for
`shape_ecdf_accumulator` — detector-scoped, via the manifest array on the replacement run — because
its reference segment A was cut as a contiguous prefix, which is the degree of freedom the ratified
C50 ruling closes. **The prior run is not defective measurement:** it reproduces digit for digit, its
own stop condition cleared, and its confound append is the record that established the DOF. It is
retained byte-for-byte.

That changes the scored evidence pool, so the cards are re-scored rather than left citing a
superseded run.

## The golden delta: NONE

**Registered prediction (K6A.7.7), against the code rather than assumed: no tuple moves.**
Measured, comparing all fifteen cards' `(overall.verdict, overall.tier, s1, s2, s3, s4)` against
`run-20260809T040659Z`:

```
tuples moved: 0 of 15
```

`shape_ecdf_accumulator` reads **`USE`, tier `T1`, S1 `MISSING`, S2 `PASS`, S3 `PASS`, S4 `PASS`** —
identical to the prior re-score. `s2.perCell` and `s3.perCell` are each length `1`, both from
`coverage/run-20260809T035934Z` at `__tier: 'T1'`, exactly as before: **no T2 cell is in either.**

**The mechanism, which is why the prediction was safe to register.** T2 rows carry no `fault_class`,
and their fields are `t2_crossing_rate` / `t2_increment_mean` / `t2_verdict`, none of which are the
names `isValidityCell` (`lib/score.mjs:11`) or `isPowerCell` (`lib/score.mjs:16`) test. So a T2 row
is a candidate for nothing: `coverageFor` filters on `fault_class` (`lib/score.mjs:361`) and
`t2_verdict` is read by no code under `validation/certification/`. K6.1.3's field-name rule is what
buys this, and it held.

## The one observable that moved

`shape_ecdf_accumulator.card.json`, `generated_from.runs`:

```
old  ["coverage/run-20260809T035934Z", "coverage-t2-clustersynth/run-t2-20260809T040552Z"]
new  ["coverage/run-20260809T035934Z", "coverage-t2-clustersynth/run-t2-20260809T075607Z"]
```

`COVERAGE.md`'s header engine sha moves with the commit (`e62af91` to `5b6e611`), which every
re-score does. **Every `COVERAGE.md` row is byte-identical**, including `K6-slow`. No other card's
`generated_from.runs` changes.

## The evidence census

Verified against `lib/collect.mjs`: **606 cells dropped** from `run-t2-20260809T040552Z` for
`shape_ecdf_accumulator`, `source: manifest`, `superseded_by
coverage-t2-clustersynth/run-t2-20260809T075607Z`. The sibling T2 run `run-t2-20260808T121710Z`,
which scores `shape_block_conformal_bet`, is untouched — that is what detector-scoping buys, and it
is the reason a blanket run-level drop was not used.

**Corpus census unchanged at `2266` cells across `47` runs.** K6A.7.7 registered this as arithmetic
before the run: the replacement emits the same `600 + 5 + 1` rows the superseded one did, so
`2266 − 606 + 606 = 2266`. `collect.test.mjs`'s census literal therefore needed no change; its drop
table gained a seventh run.

## What this re-score does not do

It does not carry the T2 finding into any card. `run-t2-20260809T075607Z`'s section 4 answers K6.12's
contiguity question with **`gpu_temp_c` departing from block-exchangeability under a placement-free
reference** — 8 crossings of 120, on the same eight shards as under front-A, against at most `0.003`
expected at this geometry — and that finding **moves no tuple here**, by the same field-name
mechanism above. It is a per-coordinate finding about clustersynth telemetry recorded in the coverage
run's own REPORT, and `shape_ecdf_accumulator` is not refuted: the pooled row, which is what K6.13
gives verdict authority to, cleared at `t2_pooled_lower_95 = 0.007528 <= α`.

`cert:expiry` reads **all cards current** — no card pins the T2 harness, the coverage
pre-registration, or anything else this branch edited — and `cert:validate-cards` reads **15/15 OK**.

---

## Append, 2026-08-09 — the "one observable moved" accounting was incomplete

Registered in `../../../coverage/PREREGISTRATION.md`, v2.K6A.7's correction append, item F5. **No
tuple moves; the golden delta is still NONE, 0 of 15.**

The section above is headed "The one observable that moved". Diffing all fifteen `*.card.json`
against `run-20260809T040659Z` shows **two further movements, on every card**:

```
source_files[].sha  0522faf1586dbb544473067dcd92185b8b5d1228 -> 4a48450ce3d489c4354fd5b61455241a1203a092
source_files[]      + { path: "validation/certification/lib/collect.mjs",
                        sha256: "62389a1377c4f3e742c87c17069a4d839ae868e17f152ccef3cb567585e66e37" }
```

**Neither belongs to C50.** Both come from ancestor commits on `main` — `4a48450` ("pin
`lib/collect.mjs` on all fifteen cards") and its follow-on `07a0a54` — and the prior re-score
`run-20260809T040659Z` was emitted at `563bfee`, which `git merge-base --is-ancestor 563bfee
4a48450` confirms is an ancestor. **The card definitions themselves changed between the two
re-scores, independently of this branch.**

**The accounting rule this got wrong, registered:** a re-score diff against the previous re-score is
not a diff of this branch's effect unless the two re-scores share a card freeze. They do not here.
Scoped correctly, **C50's own effect on the fifteen cards is exactly one field —
`shape_ecdf_accumulator.card.json`'s `generated_from.runs` — plus `COVERAGE.md`'s header engine
sha.** The inherited pin movements change no tuple either, and `cert:expiry` reads all cards
current.
