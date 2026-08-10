# Batch C — the heavy tail. Task 1 report

Branch `open/batch-c` off `main@9430b64`. Three separable items, each landed as its own
amendment-then-commits sequence. Suites green at baseline throughout.

## Premise verdicts first

| item | row's claim | verdict at HEAD |
|---|---|---|
| **C38.2** | "the 2026-08-05 power-per-cell/phi-sweep runs exist only under `results/sim`; no live run backs the page's numbers" | **FALSE — stale.** Two live runs exist since 2026-08-07 (`run-20260807T215034Z` N=4000, `run-20260807T215105Z` φ sweep) and the wiki page carries a `LIVE-REPLICATED 2026-08-07` banner. A **narrower** gap was real and is now closed: the page's power table is a sim run at **N=2000** and the live run is at **N=4000**, so no live run existed at the page's own `N`. |
| **C38.6** | "`c`-bounds unmeasured behind two bootstrap-substituted thresholds, so S4 UNPRICED has no measured artifact" | **TRUE**, with three corrections. |
| **C51.4** | "single-draw-per-cell protocol amendment" | **TRUE.** The caveat exists three times, each bound to one artifact, none as a standing rule. |

Three corrections to C38.6's premise as the brief stated it:

1. **There is no `PRICED-at-c` S4 outcome.** `scoreS4` (`validation/certification/lib/score.mjs:423-465`)
   returns only `PASS`, `REFUSE`, `UNPRICED`. A measured `c` cited as `prior_evidence[stage=S4]` with
   `runs != null` resolves the stage to **`PASS`**; the number lives in the run and the card citation,
   never in the status token.
2. **The two cards fail the gate differently.** `family_C_safe_hotelling` has an `S4` entry with
   `runs: null` (a declared question). **`family_A_betting_e_process` has no `S4` entry at all.**
3. **S4 pricing is moot for BOTH verdicts, not just family_C's.** Both cards are `REFUSE` on in-regime
   S2 refutation. S4 *does* still compute on a `REFUSE` card (`verdict.mjs:50` calls it
   unconditionally, and both rows carry an S4 token beside `REFUSE`).

## Item 1 — C38.2, the live replication. DONE.

`3da2ff0` registration → `5bff888` run.
`validation/terminal-evalue/POWER-PER-CELL-ADDENDUM-2026-08-10.md`,
`results/live/run-20260810T073954Z/`.

One attempt, `--mode live --n 2000`, 3.9 s, 90 cells. **All five predictions held exactly: 827
fields compared across the 61 shared cell keys, 0 deviations.** The page's four published power
figures reproduce to the digit at their own `N` (safe-t N2 `1`, safe-t N4-p09 `0.7125`, UI
N3-p09/N4-p09 `0.0275`, pooled UI `0.70155`). The φ sweep was verified cell by cell against the
existing live run — all twenty published figures exact — and not re-run.

**Cross-`N` deviations, recorded not corrected** (sim N=2000 → live N=4000):

| cell | N=2000 | N=4000 | Δ rel |
|---|---|---|---|
| UI N3-p09 / N4-p09 power | 0.0275 | 0.02225 | **−19.1%** |
| safe-t N4-p09 `mean_e` | 2,112 | 9,710 | **+360%** |
| safe-t N4-p09 exceedance @.05 | 0.0175 | 0.0160 | −8.6% |
| UI pooled power | 0.70155 | 0.703025 | +0.21% |
| safe-t N2 m=30/100/500 power | 1.0000 | 1.0000 | 0 |

**Two contradictions recorded, not resolved.** (a) The page's banner says *"Every number this page
publishes reproduces exactly"* while its own body says two numbers move with `N` — one artifact
against itself. (b) `sim/run-20260805T230306Z` stamps `git_sha 4b31a12`, and the committed harness at
that sha throws `ReferenceError: c is not defined` on the first cell before writing any
`power_this_cell` field (confirmed by executing the same scoping shape under Node v25.9.0); all 58 of
its validity cells carry that field. **Its numbers came from uncommitted working-tree code.** The
append-only sim run keeps its wrong stamp; the registered run is the first execution of committed
code at the page's `N`.

## Item 2 — C38.6, the c-bounds. RUN COMPLETE, NO `c` REPORTED.

`61daee1` amendment → `88616e1` harness → `4bc6fe6` run.
`validation/bootstrap-overshoot/PREREGISTRATION.md` Amendment A1, `harness/run.mjs`,
`results/live/run-20260810T074653Z/`.

The study had a pre-registration and nothing else — no harness, no results, never executed. A1
registered two instruments (`c_markov = max(1, E[M_T])`; `c_ville_emp = α·q_{1−α}(sup M_t)`),
`T ∈ {300, 900, 2000}` as nested snapshots of one trajectory, 5 seeded replicates as the uncertainty
instrument, log-sum-exp throughout, and D1–D4 as divergence criteria fixed **before** the run. One
attempt, `--n 4000 --b 5`, 2 min 17 s, 24 cells.

**P-C9's control stop condition fired and is honoured: no `c` is reported for any detector.** Family
D's disjoint control reads `E[M_300] = 1.1200381826911874` against the registered band `[1.02, 1.12]`
— outside by `3.8e-5` — with two of five replicates above the edge. The larger half is `T = 900`:
**1.7018–1.9517 against the committed 1.1076** (`types/families/d.ts:91-93`,
`test/spectral-inflation-bound.test.ts`), implying `b ≈ 1.0210` per wealth update where the committed
decomposition has `b ≈ 1.00203` — **ten times the growth rate.** Recorded as a contradiction between
this harness and a committed artifact a shipped detector prices against; the doubt runs against the
harness first, because the control is what missed.

**Estimability is reported, since it is a property of the estimator and not of its value:**

- **`c_markov` is NOT MEASURABLE on 5 of the 6 primary cells at every horizon.** `top1_share = 1.0000`
  on four of them — the log-sum-exp mean is one trajectory out of 4,000. safe-Hotelling N4-p09 at
  `T = 2000` spans `log10 E[M] = 1350.9` to `2157.4` across five replicates: **806 orders of magnitude
  on one estimand.** Only betting N1 (φ=0 oracle) is measurable at all three horizons.
- **`c_ville_emp` is measurable on 10 of 18 primary cells**, including every oracle cell of both
  detectors. It fails only on the estimated-φ cells at the longer horizons.
- **Eight of ten predictions held.** P-C7 **REFUTED** 12/14, and the two exceptions earn a sharper
  hypothesis: D1 does not fire until `log10 E[M] ≈ 0.9`, so a `c` near 1 — the only `c` worth pricing
  — is exactly where the estimator works. P-C8 **SPLIT**: `E[M_T]` *falls* with `T` on both
  oracle-AR(1) cells (safe-Hotelling N3-p09: `10^21.1 → 10^11.5 → 10^-37.5`), refuting that clause.
- **P-C2 held both clauses**, confirming `stats/ville-guarantee-is-empirical`'s partial retraction of
  the betting φ=0.9 oracle cell on its own criterion: the five replicates span `0.863`–`1.146`.
- **A defect in my own criterion, named.** D3 (replicates straddle `E[M] = 1`) is too strict at
  `c ≈ 1` — it would call the one successfully priced route in the portfolio unmeasurable. Registered
  before the run, so not moved; a lower-confidence-bound replacement is named-not-done.

Both cards stay S4 `UNPRICED`. **No card edited, no card re-frozen, golden verdict table untouched**
— A1.5 disposition 3 barred a card edit on either branch in advance, because resolving
`UNPRICED → PASS` flips a token `golden-verdicts.test.mjs:372,374` freezes, which is a
protocol-version action.

## Item 3 — C51.4, the single-draw protocol. DONE. No runs.

`edf7274`. `validation/coverage/PREREGISTRATION.md` Amendment v2.C51.4.

Text change only: no run, no rerun, no endpoint, no card field, no pinned file. Existing runs keep
their own caveats verbatim.

**Where the caveat lived, before:** §C1.7 I2 (`shape_block_conformal_bet`'s rerun),
Amendment v2.K6A.2 K6A.2.4(b) (the K6-slow class answer), Amendment v2.C39.4
(`increment_estimator`) — three artifact-scoped instances, so a new candidate on a new class
inherited none. **The certification protocol names no card-note requirement** and
`validation/certification/lib/schema.mjs` has no field for one, contrary to what the brief allowed
for; a protocol-page clause is owed upward.

**Scope is a code predicate, not prose:** `calibratesFromHeldout(detId)`
(`harness/run-battery.mjs:901-905`) — four detectors at this commit (`family_E_conformal_heldout`,
`point_tail_bet_e_value`, `shape_block_conformal_bet`, `shape_ecdf_accumulator`), extending
automatically.

**The floor is `D = 100`**, on three grounds and not precision alone: the driver has been executed at
that size (`harness/run-acrossdraw.mjs:6`, `run-acrossdraw-20260809T065107Z`); the one measured
across-draw sd `0.151398` is a `D = 100` reading, so future readings stay comparable; and it puts the
se of the across-draw mean at `0.0151`, an order of magnitude below the sd and small against
`COVERAGE_FLOOR = 0.50`. `D = 30` gives `0.0276` and `D = 20` gives `0.0338`. **It is a floor, not a
sufficiency claim** — the `1/sqrt(2(D-1))` table assumes an approximately Gaussian across-draw law
and the measured detection distribution has p05–p95 `[0.333, 0.848]`, which is not demonstrated
Gaussian.

Both branches are registered verbatim in C51.4.3: **(a)** `D >= 100` draws per cell with
draw-conditional **and** across-draw reporting, the class answer being the across-draw reading; or
**(b)** the single-draw reading carrying the registered caveat text, which cites `0.151398` and the
`13.0×` and `9.3×` within-draw ratios and requires the phrasing *"<endpoint> at this calibration
draw"*. Neither branch may be selected after the run. **The rule is not machine-checked**, and says
so rather than implying enforcement.

## Suites

| suite | baseline | final |
|---|---|---|
| `npm test` | 351 / 0 fail | **351 / 0 fail** |
| `npm run test:cert` | 181 / 0 fail | **181 / 0 fail** |
| `npm run test:coverage-battery` | 150 pass / 1 skip | **150 pass / 1 skip** |
| `node --test validation/h0-battery/tests/*.mjs` | 7 / 0 fail | **7 / 0 fail** |
| `npm run cert:validate-cards` | 15 OK | **15 OK** |
| `npm run cert:expiry` | all cards current | **all cards current** |

One test moved: `validation/certification/test/collect.test.mjs:666`'s corpus census, `2290 → 2404`,
with the arithmetic recorded beside it (+90 replication, +24 c-bound). The assertion is exact by its
own comment so a vanishing cell is caught; it is updated the way Amendment A3 updated it. **No card
was re-frozen and none needed to be** — no card's `source_files` names any file this batch touched
(audited across all 15).

**Certification re-scored to prove nothing moved** (`4cbf898`, `run-20260810T075659Z` against
`run-20260810T064520Z`): all 15 verdicts, tiers and S1–S4 tokens identical; two lines differ, both
suppressed-verdict counts.

## Owed upward (wiki is read-only to this task)

1. **`WORKLIST` C38 item (2) is stale, not open** — answered 2026-08-07, refined 2026-08-10.
2. **`stats/power-per-cell-2026-08-05`'s banner over-claims.** *"Every number this page publishes
   reproduces exactly"* is false of the `N = 4000` run it cites. The earned sentence: *every number
   reproduces exactly at the `N` it was measured at.*
3. **The C51 row contradicts itself** — it says items (4)+(5) are DONE (text belonging to C38) and
   then lists item (4) under "Remaining".
4. **A committed-artifact contradiction on Family D's `c`:** this harness reads `E[M_900] = 1.70–1.95`
   where `types/families/d.ts` records `1.1076`. Surfaced, not resolved; the control failed, so the
   harness carries the doubt.
5. **A protocol-page calibration-draw clause** — C51.4 lands entirely in the coverage prereg because
   the protocol names no card note.
6. **`family_A_betting_e_process` has no `S4` `prior_evidence` entry at all** — a card edit, not done.
