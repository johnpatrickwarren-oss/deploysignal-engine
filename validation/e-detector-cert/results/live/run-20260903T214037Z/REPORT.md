# REPORT — 2026-09-e-detector-cert, run run-20260903T214037Z

Engine `8046dd201f47c3da77dcb54355044fca0917f20c`, N = 20000 per cell, alpha_arl = 0.001, S2 T = 20000, S3 nu = 200, T = 1200. Wall 29 s. Exceptions 0.

The verdict is the certification script's (`npm run cert:verdict`), not this file's. The tokens below are the harness's own reading of the registered rules (PREREGISTRATION §2) and the scorer recomputes every one of them from the fields; a disagreement voids the run.

## S2 — T-censored ARL under H0 (rule: arl0_T − 1.645·se ≥ 1/alpha_arl clears; arl0_T + 1.645·se < 1/alpha_arl refutes)

| null | params | phi | m | p_alarm_T | arl0_T | se | lower95 | 1/alpha | token |
|---|---|---|---|---|---|---|---|---|---|
| N2-m30 | estimated | 0 | 30 | 0.980 | 1147.8 | 23.5 | 1109.1 | 1000 | not-refuted |
| N4-p09-m100 | estimated | 0.9 | 100 | 0.980 | 1184.9 | 24.0 | 1145.4 | 1000 | not-refuted |

## S3 — K1 step at onset nu (rule (a): detection_rate at 3σ ≥ 0.10; rule (b): delay_canonical + 1.645·se ≤ D*(alpha_arl, delta_eff) at 1.5σ)

| null | shift | delta_eff | p_pre | n_cond | detection | delay | se | upper95 | median | p90 | censored | D* | token |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Against the registered predictions (§4)

- S2 in-class cells: 2 of 2 clear; tokens N2-m30:not-refuted, N4-p09-m100:not-refuted.
- S2 outside the class: .
- S3 rule (a): 0 of 0 cells powered at 3σ (min detection —).
- S3 rule (b): 0 of 0 canonical cells under D*; .

