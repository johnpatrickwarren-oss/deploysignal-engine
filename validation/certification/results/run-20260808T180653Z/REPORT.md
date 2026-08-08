# Certification re-score — protocol v1, engine 0a800b3

Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.

| detector | class | S1 | S2 | S3 | S4 | suppressed | verdict | tier |
|---|---|---|---|---|---|---|---|---|
| family_A_betting_e_process | test_martingale | MISSING | REFUTED | INERT | UNPRICED | CLEARED x1 | **REFUSE** | — |
| family_A_mixture_supermartingale | test_martingale | MISSING | REFUTED | PASS | PASS | NOT-EXECUTABLE x4, inconclusive x3 | **REFUSE** | — |
| family_C_safe_hotelling | test_martingale | MISSING | MISSING | PASS | UNPRICED | — | **NOT_EXECUTABLE** | — |
| family_D_spectral_e_detector | test_martingale | MISSING | REFUTED | INERT | PASS | — | **REFUSE** | — |
| family_E_conformal | terminal_e_value | DECLARED | VOID | MISSING | REFUSE | ANTI-CONSERVATIVE x25, conservative x23 | **NOT_EXECUTABLE** | — |
| family_E_conformal_heldout | terminal_e_value | MISSING | REFUTED | PASS | PASS | not-refuted x1 | **REFUSE** | — |
| group_average_e_value | terminal_e_value | MISSING | REFUTED | PASS | PASS | not-refuted x1 | **REFUSE** | — |
| point_tail_bet_e_value | terminal_e_value | MISSING | PASS | PASS | PASS | — | **USE** | T1 |
| safe_t_e_value | terminal_e_value | MISSING | PASS | PASS | PASS | not-refuted x7 | **USE** | T1 |
| sequential_mmd_betting_e_process | test_martingale | DECLARED | REFUTED | MISSING | PASS | — | **REFUSE** | — |
| sequential_ui_e_process | e_process | MISSING | PASS | MISSING | PASS | not-refuted x15, not-refuted BUT INERT x15 | **NOT_EXECUTABLE** | — |
| shape_block_conformal_bet | test_martingale | MISSING | PASS | INERT | PASS | — | **ADVISORY** | T1 |
| spectral_bet_e_process | test_martingale | MISSING | PASS | PASS | PASS | — | **USE** | T1 |
| universal_inference_e_value | terminal_e_value | MISSING | PASS | INERT | PASS | not-refuted x27, not-refuted BUT INERT x3 | **USE** | T1 |

## Superseded evidence (Amendment v2.C1 C1.6)

Rows a later run's manifest declared superseded. The prior run directories are preserved byte-for-byte; only their scoring is withdrawn, per the reason each declaring run states.

- coverage/run-20260808T010208Z — family_E_conformal_heldout: 6 cells dropped, superseded by coverage/run-20260808T133859Z (PREREGISTRATION.md Amendment v2.C1 (C1.1/C1.2/C1.6): the held-out row generator drew a rank-1 Kronecker lattice, so every family_E_conformal_heldout and point_tail_bet_e_value row in those runs calibrated against it; this run is the registered same-defect rerun under the corrected continuous-stream generator. run-20260808T010208Z's safe_t/universal_inference/group_average_e_value/family_D rows across five other classes take no held-out calibration and are NOT superseded. Both superseded directories are preserved byte-for-byte.)
- coverage/run-20260808T064039Z — family_E_conformal_heldout: 6 cells dropped, superseded by coverage/run-20260808T133859Z (PREREGISTRATION.md Amendment v2.C1 (C1.1/C1.2/C1.6): the held-out row generator drew a rank-1 Kronecker lattice, so every family_E_conformal_heldout and point_tail_bet_e_value row in those runs calibrated against it; this run is the registered same-defect rerun under the corrected continuous-stream generator. run-20260808T010208Z's safe_t/universal_inference/group_average_e_value/family_D rows across five other classes take no held-out calibration and are NOT superseded. Both superseded directories are preserved byte-for-byte.)
- coverage/run-20260808T064039Z — point_tail_bet_e_value: 6 cells dropped, superseded by coverage/run-20260808T133859Z (PREREGISTRATION.md Amendment v2.C1 (C1.1/C1.2/C1.6): the held-out row generator drew a rank-1 Kronecker lattice, so every family_E_conformal_heldout and point_tail_bet_e_value row in those runs calibrated against it; this run is the registered same-defect rerun under the corrected continuous-stream generator. run-20260808T010208Z's safe_t/universal_inference/group_average_e_value/family_D rows across five other classes take no held-out calibration and are NOT superseded. Both superseded directories are preserved byte-for-byte.)
- coverage/run-20260808T121548Z — shape_block_conformal_bet: 6 cells dropped, superseded by coverage/run-20260808T133746Z (PREREGISTRATION.md Amendment v2.C1 (C1.1/C1.2/C1.6): the held-out row generator drew a rank-1 Kronecker lattice, so every shape_block_conformal_bet row in that run calibrated against a reference with ~30% compressed within-block moment spread; this run is the registered rerun under the corrected continuous-stream generator. The superseded directory is preserved byte-for-byte.)

## Superseded evidence by study registry (h0-battery Amendment A1)

Rows a study's `results/live/SUPERSESSIONS.json` declares superseded. No later run declared these: the authority is the study's own pre-registration amendment, named in each line's `declared_by`. The superseded run directories are preserved byte-for-byte and the registry is a new file beside them, never inside one.

- 2026-07-h0-battery/run-20260801T062612Z — family_A_betting_e_process: 36 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 1), an UNDECLARED defect this amendment names as its own finding: this run shares git_sha 17cc3f8 and seed 20260801 with run-20260801T062824Z and all 144 of its endpoints.json rows are byte-identical to that run's, including the per-cell git_sha, so it carries both defects run-20260801T064627Z's manifest declares — quoted verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". No run declares this one superseded, which is why the amendment does. Every dropped cell has a replacement at the same (detector, null_id, alpha) key in run-20260801T064627Z. This run contributes 144 cells and no P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062612Z — family_A_mixture_supermartingale: 36 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 1), an UNDECLARED defect this amendment names as its own finding: this run shares git_sha 17cc3f8 and seed 20260801 with run-20260801T062824Z and all 144 of its endpoints.json rows are byte-identical to that run's, including the per-cell git_sha, so it carries both defects run-20260801T064627Z's manifest declares — quoted verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". No run declares this one superseded, which is why the amendment does. Every dropped cell has a replacement at the same (detector, null_id, alpha) key in run-20260801T064627Z. This run contributes 144 cells and no P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062612Z — family_C_safe_hotelling: 36 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 1), an UNDECLARED defect this amendment names as its own finding: this run shares git_sha 17cc3f8 and seed 20260801 with run-20260801T062824Z and all 144 of its endpoints.json rows are byte-identical to that run's, including the per-cell git_sha, so it carries both defects run-20260801T064627Z's manifest declares — quoted verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". No run declares this one superseded, which is why the amendment does. Every dropped cell has a replacement at the same (detector, null_id, alpha) key in run-20260801T064627Z. This run contributes 144 cells and no P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062612Z — family_D_spectral_e_detector: 36 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 1), an UNDECLARED defect this amendment names as its own finding: this run shares git_sha 17cc3f8 and seed 20260801 with run-20260801T062824Z and all 144 of its endpoints.json rows are byte-identical to that run's, including the per-cell git_sha, so it carries both defects run-20260801T064627Z's manifest declares — quoted verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". No run declares this one superseded, which is why the amendment does. Every dropped cell has a replacement at the same (detector, null_id, alpha) key in run-20260801T064627Z. This run contributes 144 cells and no P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062824Z — family_A_betting_e_process: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.1, A1.4), honouring the declaration both later runs have carried in the legacy {priorRun, defect} manifest shape since 2026-08-01. run-20260801T064627Z's manifest states the defect verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". run-20260801T064237Z's manifest states the same defect in its narrower earlier form, also verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell". Every dropped cell has a replacement at the same key in run-20260801T064627Z: 144 endpoint rows and 4 P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062824Z — family_A_mixture_supermartingale: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.1, A1.4), honouring the declaration both later runs have carried in the legacy {priorRun, defect} manifest shape since 2026-08-01. run-20260801T064627Z's manifest states the defect verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". run-20260801T064237Z's manifest states the same defect in its narrower earlier form, also verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell". Every dropped cell has a replacement at the same key in run-20260801T064627Z: 144 endpoint rows and 4 P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062824Z — family_C_safe_hotelling: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.1, A1.4), honouring the declaration both later runs have carried in the legacy {priorRun, defect} manifest shape since 2026-08-01. run-20260801T064627Z's manifest states the defect verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". run-20260801T064237Z's manifest states the same defect in its narrower earlier form, also verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell". Every dropped cell has a replacement at the same key in run-20260801T064627Z: 144 endpoint rows and 4 P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T062824Z — family_D_spectral_e_detector: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.1, A1.4), honouring the declaration both later runs have carried in the legacy {priorRun, defect} manifest shape since 2026-08-01. run-20260801T064627Z's manifest states the defect verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell". run-20260801T064237Z's manifest states the same defect in its narrower earlier form, also verbatim: "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell". Every dropped cell has a replacement at the same key in run-20260801T064627Z: 144 endpoint rows and 4 P2 cells. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T064237Z — family_A_betting_e_process: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 2). Its phi fix landed but the mixture adapter was still broken, the defect run-20260801T064627Z's manifest names, quoted verbatim: "the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all". Measured against run-20260801T064627Z on (detector, null_id, alpha): 24 rows differ, every one family_A_mixture_supermartingale, at the 8 nulls N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100 times 3 alpha values — those are the defective rows. The other 124 cells (120 endpoint rows and all 4 P2 cells) are byte-identical to the canonical run's, so scoring them counts one draw twice. Dropped whole because both halves are covered: the defect is replaced and the duplicates are removed. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T064237Z — family_A_mixture_supermartingale: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 2). Its phi fix landed but the mixture adapter was still broken, the defect run-20260801T064627Z's manifest names, quoted verbatim: "the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all". Measured against run-20260801T064627Z on (detector, null_id, alpha): 24 rows differ, every one family_A_mixture_supermartingale, at the 8 nulls N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100 times 3 alpha values — those are the defective rows. The other 124 cells (120 endpoint rows and all 4 P2 cells) are byte-identical to the canonical run's, so scoring them counts one draw twice. Dropped whole because both halves are covered: the defect is replaced and the duplicates are removed. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T064237Z — family_C_safe_hotelling: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 2). Its phi fix landed but the mixture adapter was still broken, the defect run-20260801T064627Z's manifest names, quoted verbatim: "the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all". Measured against run-20260801T064627Z on (detector, null_id, alpha): 24 rows differ, every one family_A_mixture_supermartingale, at the 8 nulls N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100 times 3 alpha values — those are the defective rows. The other 124 cells (120 endpoint rows and all 4 P2 cells) are byte-identical to the canonical run's, so scoring them counts one draw twice. Dropped whole because both halves are covered: the defect is replaced and the duplicates are removed. The directory is preserved byte-for-byte.)
- 2026-07-h0-battery/run-20260801T064237Z — family_D_spectral_e_detector: 37 cells dropped, superseded by h0-battery PREREGISTRATION.md Amendment A1 (PREREGISTRATION.md Amendment A1 (A1.2 Finding 2). Its phi fix landed but the mixture adapter was still broken, the defect run-20260801T064627Z's manifest names, quoted verbatim: "the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all". Measured against run-20260801T064627Z on (detector, null_id, alpha): 24 rows differ, every one family_A_mixture_supermartingale, at the 8 nulls N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100 times 3 alpha values — those are the defective rows. The other 124 cells (120 endpoint rows and all 4 P2 cells) are byte-identical to the canonical run's, so scoring them counts one draw twice. Dropped whole because both halves are covered: the defect is replaced and the duplicates are removed. The directory is preserved byte-for-byte.)

## Declared superseded in the legacy shape, and now closed by a registry (Amendment v2.C1.1 reported it; h0-battery Amendment A1 closed it)

These runs declared a prior run superseded for a named code defect in the legacy `supersedes: {priorRun, defect}` manifest shape. That shape is still not acted on — editing a preserved manifest to upgrade it would break the append-only guarantee that makes it citable. What acts on it is the registry above, authorized by the declaring study's own pre-registration. The declaration is kept here rather than removed, so the gap and its closure are both readable.

- 2026-07-h0-battery/run-20260801T062824Z — declared superseded by 2026-07-h0-battery/run-20260801T064237Z in the legacy `{priorRun, defect}` shape, and NOW DROPPED by a supersession registry. Stated defect: oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell
- 2026-07-h0-battery/run-20260801T062824Z — declared superseded by 2026-07-h0-battery/run-20260801T064627Z in the legacy `{priorRun, defect}` shape, and NOW DROPPED by a supersession registry. Stated defect: oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell

## Standing caveats

- ADR-0012 real-telemetry anomaly (E[e|H0] = 24/9/9) attaches to every T1/T2 verdict until explained
- P1 unmet: assertValidForFdrPath has no production caller — every USE is advisory in practice until the gate is wired

---

## C44 re-score narrative, appended 2026-08-08 — the registered supersession re-score

Appended, not edited: `results/` is append-only, so this narrative sits below the mechanically
emitted sections rather than rewriting them. **Every figure below is read out of a committed
artifact** — this run's `manifest.json`, its fourteen `*.card.json` files, its own `REPORT.md`
and `MISSING-CELLS.md`, the bracketing run `run-20260808T133943Z`'s card JSONs, and Amendment A1.6's
registered table parsed out of `validation/h0-battery/PREREGISTRATION.md`. The two quantities no
artifact records are labelled as re-derivations where they appear.

### What this run is

This is the re-score h0-battery `PREREGISTRATION.md` **Amendment A1** authorized and A1.6
registered the expectation for: the first certification run in which the h0-battery supersession
registry `validation/h0-battery/results/live/SUPERSESSIONS.json` is honoured.
`protocol_version` 1, `report_format` **4 → 5**, engine `0a800b3`,
14 cards. **No detector ran.** No h0-battery, coverage or other study run directory
was created, edited or re-run; the only new evidence-side artifact in this wave is the registry
file, committed before the collector that reads it.

### A1.6's registered expectation, against what this run emitted

The `expected` columns are parsed from A1.6's table in the committed pre-registration; the
`emitted` columns are read from this run's card JSONs, and the `before` figures from
`run-20260808T133943Z`'s. Matched-cell counts are the one re-derivation in this table (see the note below it).

| card | expected tuple | emitted tuple | matched cells expected | matched re-derived | S3 `perCell` expected | S3 `perCell` emitted |
|---|---|---|---|---|---|---|
| `family_A_betting_e_process` | MISSING / REFUTED / INERT / UNPRICED / **REFUSE** / — | MISSING / REFUTED / INERT / UNPRICED / **REFUSE** / — | 255 → 145 | 145 | 51 → 49 | 51 → 49 |
| `family_A_mixture_supermartingale` | MISSING / REFUTED / PASS / PASS / **REFUSE** / — | MISSING / REFUTED / PASS / PASS / **REFUSE** / — | 255 → 145 | 145 | 47 → 45 | 47 → 45 |
| `family_C_safe_hotelling` | MISSING / MISSING / PASS / UNPRICED / **NOT_EXECUTABLE** / — | MISSING / MISSING / PASS / UNPRICED / **NOT_EXECUTABLE** / — | 147 → 37 | 37 | 3 → 1 | 3 → 1 |
| `family_D_spectral_e_detector` | MISSING / REFUTED / INERT / PASS / **REFUSE** / — | MISSING / REFUTED / INERT / PASS / **REFUSE** / — | 259 → 149 | 149 | 51 → 49 | 51 → 49 |

**Every cell of that table agrees.**

**Re-derivation, disclosed.** `matched re-derived` and the pooled-corpus figure below are not
fields in any committed artifact — no run directory records how many cells the scorer pooled. They
are recomputed by loading `validation/` through the same `lib/collect.mjs` this run used, at the
same commit. Pooled corpus: **2108 → 1668** registered, **1668** re-derived.

### All fourteen cards: nothing moved

Read from both runs' card JSONs, all four stage statuses plus verdict, tier and the merged
suppressed-verdict tally:

| detector | S1 / S2 / S3 / S4 / verdict / tier | moved? | suppressed tally | moved? |
|---|---|---|---|---|
| `family_A_betting_e_process` | MISSING / REFUTED / INERT / UNPRICED / **REFUSE** / — | no | CLEARED x1 | no |
| `family_A_mixture_supermartingale` | MISSING / REFUTED / PASS / PASS / **REFUSE** / — | no | NOT-EXECUTABLE x4, inconclusive x3 | no |
| `family_C_safe_hotelling` | MISSING / MISSING / PASS / UNPRICED / **NOT_EXECUTABLE** / — | no | — | no |
| `family_D_spectral_e_detector` | MISSING / REFUTED / INERT / PASS / **REFUSE** / — | no | — | no |
| `family_E_conformal` | DECLARED / VOID / MISSING / REFUSE / **NOT_EXECUTABLE** / — | no | ANTI-CONSERVATIVE x25, conservative x23 | no |
| `family_E_conformal_heldout` | MISSING / REFUTED / PASS / PASS / **REFUSE** / — | no | not-refuted x1 | no |
| `group_average_e_value` | MISSING / REFUTED / PASS / PASS / **REFUSE** / — | no | not-refuted x1 | no |
| `point_tail_bet_e_value` | MISSING / PASS / PASS / PASS / **USE** / T1 | no | — | no |
| `safe_t_e_value` | MISSING / PASS / PASS / PASS / **USE** / T1 | no | not-refuted x7 | no |
| `sequential_mmd_betting_e_process` | DECLARED / REFUTED / MISSING / PASS / **REFUSE** / — | no | — | no |
| `sequential_ui_e_process` | MISSING / PASS / MISSING / PASS / **NOT_EXECUTABLE** / — | no | not-refuted x15, not-refuted BUT INERT x15 | no |
| `shape_block_conformal_bet` | MISSING / PASS / INERT / PASS / **ADVISORY** / T1 | no | — | no |
| `spectral_bet_e_process` | MISSING / PASS / PASS / PASS / **USE** / T1 | no | — | no |
| `universal_inference_e_value` | MISSING / PASS / INERT / PASS / **USE** / T1 | no | not-refuted x27, not-refuted BUT INERT x3 | no |

**0 of 14 verdict tuples moved. 0 of 14 suppressed tallies moved.**
That is the whole point of the registered expectation: withdrawing 440 pooled cells changed no
card's answer, because the withdrawn cells were duplicates of the surviving canonical run or were
read by no scoring stage at all (A1.3).

### Supersession provenance

Read off this file's own `Superseded evidence by study registry` section, which the scorer emits
from `lib/collect.mjs`'s drop map:

| superseded run | detectors named | cells dropped |
|---|---|---|
| `2026-07-h0-battery/run-20260801T062612Z` | 4 | 36 + 36 + 36 + 36 = **144** |
| `2026-07-h0-battery/run-20260801T062824Z` | 4 | 37 + 37 + 37 + 37 = **148** |
| `2026-07-h0-battery/run-20260801T064237Z` | 4 | 37 + 37 + 37 + 37 = **148** |
| | | **440 total** |

Every line names `declared_by` = the amendment, not a run, because no run declares these — two of
the three were never declared by anything until A1.2 named them. `run-20260801T064627Z` is not
superseded and is the sole scored h0-battery run.

The 2 legacy `{priorRun, defect}` declarations from 2026-08-01 are still reported, in the
section headed *Declared superseded in the legacy shape, and now closed by a registry*, each
annotated `NOW DROPPED by a supersession registry`. The phrase `STILL SCORED` occurs **0** times
in this report: it was true of those declarations in every run through
`run-20260808T133943Z` and is not true here. The legacy shape itself is still not the mechanism that acts —
a registry is.

### Disclosed deviation: `MISSING-CELLS.md` moves, and A1.6 did not name it

**A1.6 registered the verdict tuples, the matched-cell counts, the S3 `perCell` counts, the pooled
corpus and the suppressed tallies. It did not name `MISSING-CELLS.md`.** Two of its lines move, and
the change is disclosed here rather than amended, because it is the arithmetic consequence of a
drop A1.6 did register rather than a new effect:

| card | before | after |
|---|---|---|
| `family_A_betting_e_process` | `phi unmeasured on a power cell x3` | `x1` |
| `family_A_mixture_supermartingale` | `phi unmeasured on a power cell x3` | `x1` |

**2 of the 4 lines carrying that phrase move**, both on the family A cards. Mechanism: the h0-battery `P2__<detector>.json`
power cells carry no `null_id`, so `annotatePhi` derives no `phi` for them and `scoreS3` records
each as an untokened exclusion. Three such cells existed for each family A detector
(`run-20260801T062824Z`, `run-20260801T064237Z`, `run-20260801T064627Z`); the registry dropped two,
leaving one. It is the same 2-cell drop A1.6 registered as `S3 perCell 51 → 49` and `47 → 45`,
counted in a second place. Provenance: surfaced by review of Task 1 as Minor 3 and registered in
advance of this run by the C44 coordinator, as a named non-surprise. **No endpoint, floor, verdict
or tier moves and no amendment is needed** — a re-scored report naming one unmeasured-phi power
cell where it used to name three is the report telling the truth about a smaller pool.

The 2 other cards carrying that line are unchanged — `safe_t_e_value` at `x2` and `universal_inference_e_value` at `x2` —
because their power cells come from studies this registry does not touch.

### What this run does not establish

Restated because the verdict table is unchanged and an unchanged table invites the wrong reading.
**No detector became more or less valid.** Three cards still REFUSE, one is still NOT_EXECUTABLE,
and per A1.3 the S2 refutation behind three of those four is not h0-battery evidence at all — it
comes from `detector-audit-sequential/seq-20260805T025650Z`. What changed is that the corpus no
longer contains a run that declared itself defective, nor two runs that were defective and never
said so. `PREREGISTRATION.md` §2 still governs the h0-battery's own wording: a detector that
survives a null is "not refuted at these nulls", never "valid".
