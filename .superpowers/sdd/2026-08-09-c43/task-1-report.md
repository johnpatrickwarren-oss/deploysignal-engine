# C43 task 1 — the φ-known erratum resolved: the premise is false at HEAD

Worktree `~/.sdd-worktrees/engine-c43`, branch `c43/phi-regime` off `main@235efa8`.
Wiki read-only throughout; no file under `~/concord/knowledge` was touched.

## Verdict

**Premise FALSE at HEAD on its operative claim, TRUE on its factual half.** No run was registered
and none was needed. The deliverable is an erratum with the code cites, a committed probe that
prices the alternative reading, two mutation-killed disclosure pins, and a named WORKLIST
correction.

## Premise verification, claim by claim

The row (`~/concord/knowledge/WORKLIST.md`, written 2026-08-08):

> **NEW — φ-known erratum follow-up (I1).** K1's and K2's YES rest on cells measured with φ
> estimated, under `safe_t_e_value`'s card regime narrowed to `phi_known: true`. Either measure a
> φ-estimated variant of safe-t at the battery's own cells, or narrow the card's declared regime to
> match what was actually measured.

| claim | verdict | code |
|---|---|---|
| the canonical cells were measured with φ estimated | **TRUE** | `validation/coverage/harness/run-battery.mjs:616` `safeTOpts = (phi) => (phi > 0 ? { ar1Phi: phi } : undefined)`; `detectors/safe-t-e-value.ts:136` `opts?.ar1Phi ?? computePerSignalAr1Phi(...)` |
| that puts them out of regime | **FALSE** | `validation/certification/lib/collect.mjs:16-27` derives `phi_source: 'oracle'` from `null_id: 'N1'` (`lib/nulls.mjs:67-70`), so `lib/score.mjs:66`'s narrowing branch never fires. Verified in output: 14 of 47 S2 cells carry `out_of_regime: true` on this card and **all 14 are `N4-p*` rows from `terminal-evalue`/`phi-identifiability`** — zero from the coverage battery |
| — and under the accurate tag? | **still in regime** | `lib/nulls.mjs:28-49` records the ruling before the row existed: a regime bounds data-generating conditions, not API call shapes; an iid null's φ is 0 and known "whatever the detector does internally" (`'iid-by-construction'`, not `'estimated'`) |
| the class answers rest on out-of-regime evidence | **FALSE, independently** | `coverageFor` (`lib/score.mjs:358-404`) contains no `regimeCheck`/`inRegime`/`effectivePhi` call — those appear at `:61-78`, `:166`, `:218-229`, `:275-277` and nowhere in that span. Registered reason at `:332`: "power is not a validity claim" |
| the φ-estimated cells feed the validity stages | **FALSE** | `safe_t`'s S2 `perCell` holds 47 cells, **0 from this battery**; its 43 coverage rows carry no `shift_sigma`, so S3 files them as not-scored-for-INERT, and `safe_t` has no coverage healthy arm (arms 30/31/32/33/34/47 belong to other detectors) |
| remedy option 1, "measure a φ-estimated variant" | **incoherent as written** | the battery's cells *are* the φ-estimated variant; the missing one is the φ-KNOWN variant |
| scope "K1's and K2's" | **incomplete** | K5's canonical is `slope1e-2` after v2.K5R — φ=0, carried by `safe_t`. Three classes |

The USE half of each class answer rests on cells where φ **is** threaded: in the study that owns the
id grammar, `N1` is `oracle: true` and safe-t is handed `{ ar1Phi: 0 }`
(`validation/terminal-evalue/harness/run.mjs:28,43`; same table at
`validation/h0-battery/harness/nulls.mjs:53`).

## The defect the row missed, and it is smaller

`run-battery.mjs:1426` stamps `null_id: cell.phi === 0 ? 'N1' : 'N3-p06'`. In the two studies that
own that id, `N1` **threads φ**; this harness does not. The accurate id for a φ=0
`safe_t`/`universal_inference`/`group_average_e_value` row is `N2-m100` (iid, moments and φ from the
100-tick window, `CAL = {start: 0, len: ONSET}`, `ONSET = 100`, `:78-89`), deriving
`'iid-by-construction'`/`'estimated-moments'`. **Mechanically inert** — both tags are
non-`'estimated'`, `phi: 0` is on the row, `m_min` is `null`, and `derivePhiParams` propagates no
`m`. Same defect class as Erratum v1.3's `params: 'oracle'`, but on the field that is
scorer-mechanical. Left for its own amendment (emission change, cross-card blast radius, expires
`shape_ecdf_accumulator`'s card).

## The measurement (no run: committed JSON only)

Probe `validation/coverage/tools/strict-phi-counterfactual.mjs`, over
`validation/certification/results/run-20260809T080049Z`. Prices the stricter reading
`lib/nulls.mjs:43-49` rejected — φ known iff the harness passed `opts.ar1Phi`.

| stage | in regime at HEAD | strict | dropped | status |
|---|---|---|---|---|
| S2 | 33 | 12 (`N1`, `N3-p06`, `N3-p09`) | `CLEARED x21` (`N2-m30/m100/m500`, `N5`, `N6`) | **PASS → PASS** |
| S3 | 11 | 3 per-null + 2 pooled controls (kept by `score.mjs:275-276` under any reading) | 6 per-null rows, all rate `1.0000` | **PASS → PASS**, min surviving per-null rate `0.897` vs `INERTNESS_FLOOR 0.10` |

Every dropped cell was a clearing cell, so `overall USE` / `T1` hold under both readings. The class
answers move only under a **second**, unregistered change — gating the class-answer layer on the
regime — and then: K1 **YES** via `universal_inference_e_value` (`COVERED 0.9875`, `USE`, no
`phi_known`), K2 **NO** (only other COVERED card is `group_average_e_value` at `0.9985`, verdict
`REFUSE`), K5 **NO** (`universal_inference` `NOT_POWERED 0.003`).

## Why neither remedy ran

**Option 1 (φ-known variant cells): not registered.** It would answer a question already ruled on in
code, for a configuration the detector does not default to (`opts.ar1Phi` is an override,
`safe-t-e-value.ts:55-61`; the card's own `shipped_path.kind` is "terminal e-value, phi plug-in",
`cards/safe_t_e_value.json:59`). Re-registering K1/K2/K5's canonical designation onto φ-threaded
cells would move the class answers off the configuration the shipped path names. The reading is
measured identical under both regimes, and the class answers do not read the regime at all.

**Option 2 (narrow the card): not registered, and wrong.** `phi_known: true` is the machine form of
the frozen guarantee sentence's own "given known phi <= 0.95" (`:37,55`) and is doing exactly its
job — excluding the 14 `N4-p*` cells whose `mean_e` reaches `9,710` and `4.4e31`. Weakening it would
re-admit those refutations.

## Class-answer outcome

**K1 YES, K2 YES, K5 YES — unchanged, tiers T1 unchanged, canonical rates unchanged
(`1.0000` / `0.6105` / `0.9995`).** No re-score was run because nothing that feeds a verdict
changed: no harness, no scorer, no card, no cell. The evidence beneath the answers did not need to
move — it was in regime already, and the answers never passed through the regime check.

## Commits

| sha | what |
|---|---|
| `91e5532` | `prereg`: Erratum v1.5 (C43) — premise verification with cites, the strict-reading price sheet, both remedies declined with reasons, the `N1` residual named; plus the dated append into `results/live/run-20260808T010208Z/REPORT.md` where I1 was raised |
| `a180acd` | `cert tests`: two disclosure pins, mutation-killed |
| `5d07ef3` | `probe`: `tools/strict-phi-counterfactual.mjs` committed with its README row, and the correction append against Erratum v1.5's own scratchpad sentence and its S3 survivor count |

## Mutation kill

| mutation | pin that died | observed |
|---|---|---|
| `phiIsEstimated`'s derived branch → `!== 'oracle'` (`nulls.mjs:97`) | pin 1 | 1 red: `N2-m100 (annotated=false)` |
| `phiIsEstimated`'s annotated branch → `!== 'oracle'` (`:95`) | pin 1 | 1 red |
| `if (!inRegime(cell, card.guarantee.regime)) continue;` added to `coverageFor`'s survivor loop | pin 2 | 1 red: "the class-answer layer reads no regime…" |

Each mutation was applied, the suite run, and the file restored from a copy; `test:cert` back to
181/0 after each.

## Suites

| suite | base `main@235efa8` | after |
|---|---|---|
| `npm test` | 351 / 0 fail | **351 / 0 fail** |
| `npm run test:cert` | 179 / 0 fail | **181 / 0 fail** — registered delta, +2 disclosure pins |
| `npm run test:coverage-battery` | 141 (140 + 1 skipped) | **141 (140 + 1 skipped)** |
| `npm run cert:validate-cards` | 15 OK | **15 OK** |
| `npm run cert:expiry` | all cards current | **all cards current** |

**No card re-freeze.** Verified rather than assumed: no card's `source_files` pins a test file
(checked across all 15), and no harness, detector or scorer file changed.

## What I did not do

- **No wiki write.** The `C43` correction text is in Erratum v1.5 §C43.7 for write-back by whoever
  owns the wiki commit.
- **No `null_id` fix.** Named-not-done in §C43.8, recommended as its own row.
- **No run, no re-score, no golden update, no card freeze.** Nothing that feeds a verdict changed.
- **`validation/certification/README.md` not appended to.** The protocol-side statement of §C43.3
  belongs there; the erratum states it in the battery's document only.
- **Did not re-open the `phi_known` semantics.** If the operator wants the strict reading, §C43.5 is
  the price sheet; adopting it is a protocol change, not an erratum.
