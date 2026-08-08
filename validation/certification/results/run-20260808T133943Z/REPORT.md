# Certification re-score — protocol v1, engine 7ad0f3a

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

## Declared superseded but STILL SCORED (Amendment v2.C1.1 — a reported gap, not a decision)

These runs declared a prior run superseded for a named code defect, in the legacy `supersedes: {priorRun, defect}` manifest shape, and this scorer does NOT act on it: the superseded run's cells are still in every verdict below. Honouring the declaration would move card verdicts, which needs the declaring study's own pre-registration to authorize. Read every verdict below with this open.

- 2026-07-h0-battery/run-20260801T062824Z — declared superseded by 2026-07-h0-battery/run-20260801T064237Z, STILL SCORED. Stated defect: oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a detector unaware of phi, not the registered oracle-parameter cell
- 2026-07-h0-battery/run-20260801T062824Z — declared superseded by 2026-07-h0-battery/run-20260801T064627Z, STILL SCORED. Stated defect: oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell

## Standing caveats

- ADR-0012 real-telemetry anomaly (E[e|H0] = 24/9/9) attaches to every T1/T2 verdict until explained
- P1 unmet: assertValidForFdrPath has no production caller — every USE is advisory in practice until the gate is wired
