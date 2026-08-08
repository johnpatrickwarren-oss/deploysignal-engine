# Certification re-score — protocol v1, engine c1f6875

Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.

| detector | class | S1 | S2 | S3 | S4 | suppressed | verdict | tier |
|---|---|---|---|---|---|---|---|---|
| family_A_betting_e_process | test_martingale | MISSING | REFUTED | INERT | UNPRICED | CLEARED x1 | **REFUSE** | — |
| family_A_mixture_supermartingale | test_martingale | MISSING | REFUTED | PASS | PASS | NOT-EXECUTABLE x4, inconclusive x3 | **REFUSE** | — |
| family_C_safe_hotelling | test_martingale | MISSING | MISSING | PASS | UNPRICED | — | **NOT_EXECUTABLE** | — |
| family_D_spectral_e_detector | test_martingale | MISSING | REFUTED | INERT | PASS | — | **REFUSE** | — |
| family_E_conformal | terminal_e_value | DECLARED | VOID | MISSING | REFUSE | ANTI-CONSERVATIVE x25, conservative x23 | **NOT_EXECUTABLE** | — |
| family_E_conformal_heldout | terminal_e_value | MISSING | REFUTED | PASS | PASS | not-refuted x2 | **REFUSE** | — |
| group_average_e_value | terminal_e_value | MISSING | REFUTED | PASS | PASS | not-refuted x1 | **REFUSE** | — |
| point_tail_bet_e_value | terminal_e_value | MISSING | PASS | PASS | PASS | — | **USE** | T1 |
| safe_t_e_value | terminal_e_value | MISSING | PASS | PASS | PASS | not-refuted x7 | **USE** | T1 |
| sequential_mmd_betting_e_process | test_martingale | DECLARED | REFUTED | MISSING | PASS | — | **REFUSE** | — |
| sequential_ui_e_process | e_process | MISSING | PASS | MISSING | PASS | not-refuted x15, not-refuted BUT INERT x15 | **NOT_EXECUTABLE** | — |
| spectral_bet_e_process | test_martingale | MISSING | PASS | PASS | PASS | — | **USE** | T1 |
| universal_inference_e_value | terminal_e_value | MISSING | PASS | INERT | PASS | not-refuted x27, not-refuted BUT INERT x3 | **USE** | T1 |

## Standing caveats

- ADR-0012 real-telemetry anomaly (E[e|H0] = 24/9/9) attaches to every T1/T2 verdict until explained
- P1 unmet: assertValidForFdrPath has no production caller — every USE is advisory in practice until the gate is wired
