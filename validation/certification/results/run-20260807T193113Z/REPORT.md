# Certification re-score — protocol v1, engine 5a9363f

Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.

| detector | class | S2 | S3 | S4 | suppressed | verdict | tier |
|---|---|---|---|---|---|---|---|
| family_A_betting_e_process | test_martingale | REFUTED | INERT | UNPRICED | CLEARED x1 | **REFUSE** | — |
| family_A_mixture_supermartingale | test_martingale | REFUTED | PASS | PASS | NOT-EXECUTABLE x4, inconclusive x3 | **REFUSE** | — |
| family_C_safe_hotelling | test_martingale | MISSING | PASS | UNPRICED | — | **NOT_EXECUTABLE** | — |
| family_D_spectral_e_detector | test_martingale | REFUTED | INERT | PASS | — | **REFUSE** | — |
| family_E_conformal | terminal_e_value | VOID | MISSING | REFUSE | ANTI-CONSERVATIVE x25, conservative x23 | **NOT_EXECUTABLE** | — |
| safe_t_e_value | terminal_e_value | PASS | PASS | PASS | — | **USE** | T1 |
| sequential_mmd_betting_e_process | test_martingale | REFUTED | MISSING | PASS | — | **REFUSE** | — |
| sequential_ui_e_process | e_process | PASS | MISSING | PASS | — | **NOT_EXECUTABLE** | — |
| universal_inference_e_value | terminal_e_value | PASS | PASS | PASS | — | **USE** | T1 |
