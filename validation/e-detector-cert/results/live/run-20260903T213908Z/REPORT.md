# REPORT — 2026-09-e-detector-cert, run run-20260903T213908Z

Engine `f943b1c3fd49aab0ecd86aedf6ed45d492021be8`, N = 2000 per cell, alpha_arl = 0.001, S2 T = 20000, S3 nu = 200, T = 1200. Wall 28 s. Exceptions 0.

The verdict is the certification script's (`npm run cert:verdict`), not this file's. The tokens below are the harness's own reading of the registered rules (PREREGISTRATION §2) and the scorer recomputes every one of them from the fields; a disagreement voids the run.

## S2 — T-censored ARL under H0 (rule: arl0_T − 1.645·se ≥ 1/alpha_arl clears; arl0_T + 1.645·se < 1/alpha_arl refutes)

| null | params | phi | m | p_alarm_T | arl0_T | se | lower95 | 1/alpha | token |
|---|---|---|---|---|---|---|---|---|---|
| N1 | oracle | 0 | — | 1.000 | 1803.1 | 39.5 | 1738.1 | 1000 | not-refuted |
| N2-m30 | estimated | 0 | 30 | 0.985 | 1003.7 | 64.9 | 897.0 | 1000 | INCONCLUSIVE |
| N2-m100 | estimated | 0 | 100 | 0.992 | 1320.4 | 62.6 | 1217.4 | 1000 | not-refuted |
| N2-m500 | estimated | 0 | 500 | 0.999 | 1593.1 | 44.7 | 1519.6 | 1000 | not-refuted |
| N3-p03 | oracle | 0.3 | — | 1.000 | 1803.3 | 39.5 | 1738.4 | 1000 | not-refuted |
| N3-p06 | oracle | 0.6 | — | 1.000 | 1803.1 | 39.5 | 1738.2 | 1000 | not-refuted |
| N3-p09 | oracle | 0.9 | — | 1.000 | 1726.6 | 39.1 | 1662.3 | 1000 | not-refuted |
| N4-p06-m100 | estimated | 0.6 | 100 | 0.983 | 1510.6 | 77.8 | 1382.6 | 1000 | not-refuted |
| N4-p09-m100 | estimated | 0.9 | 100 | 0.985 | 1061.6 | 68.6 | 948.8 | 1000 | INCONCLUSIVE |
| N7 | oracle | 0 | — | 1.000 | 1803.1 | 39.5 | 1738.1 | 1000 | not-refuted |
| N5 | oracle | 0 | — | 1.000 | 154.8 | 3.3 | 149.3 | 1000 | FAIL |
| N6 | oracle | 0 | — | 1.000 | 229.6 | 5.1 | 221.2 | 1000 | FAIL |
| N8 | oracle | 0.9 | — | 1.000 | 221.0 | 5.1 | 212.5 | 1000 | FAIL |

## S3 — K1 step at onset nu (rule (a): detection_rate at 3σ ≥ 0.10; rule (b): delay_canonical + 1.645·se ≤ D*(alpha_arl, delta_eff) at 1.5σ)

| null | shift | delta_eff | p_pre | n_cond | detection | delay | se | upper95 | median | p90 | censored | D* | token |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| N1 | 0.75 | 0.750 | 0.089 | 1822 | 1.000 | 20.6 | 0.24 | 21.0 | 19 | 35 | 0.000 | — | REPORTED |
| N1 | 1.5 | 1.500 | 0.088 | 1824 | 1.000 | 7.0 | 0.07 | 7.1 | 7 | 11 | 0.000 | 13.0 | WITHIN_BOUND |
| N1 | 3 | 3.000 | 0.096 | 1809 | 1.000 | 2.5 | 0.02 | 2.6 | 2 | 4 | 0.000 | — | POWERED |
| N2-m30 | 0.75 | 0.750 | 0.511 | 977 | 1.000 | 24.7 | 0.64 | 25.8 | 20 | 49 | 0.000 | — | REPORTED |
| N2-m30 | 1.5 | 1.500 | 0.527 | 946 | 1.000 | 7.7 | 0.14 | 7.9 | 7 | 14 | 0.000 | 13.0 | WITHIN_BOUND |
| N2-m30 | 3 | 3.000 | 0.527 | 946 | 1.000 | 2.6 | 0.04 | 2.7 | 2 | 4 | 0.000 | — | POWERED |
| N2-m100 | 0.75 | 0.750 | 0.271 | 1458 | 1.000 | 21.4 | 0.34 | 22.0 | 19 | 38 | 0.000 | — | REPORTED |
| N2-m100 | 1.5 | 1.500 | 0.265 | 1471 | 1.000 | 7.1 | 0.09 | 7.3 | 7 | 12 | 0.000 | 13.0 | WITHIN_BOUND |
| N2-m100 | 3 | 3.000 | 0.272 | 1456 | 1.000 | 2.6 | 0.03 | 2.6 | 2 | 4 | 0.000 | — | POWERED |
| N2-m500 | 0.75 | 0.750 | 0.135 | 1731 | 1.000 | 20.7 | 0.26 | 21.2 | 19 | 35 | 0.000 | — | REPORTED |
| N2-m500 | 1.5 | 1.500 | 0.132 | 1736 | 1.000 | 6.9 | 0.07 | 7.0 | 7 | 11 | 0.000 | 13.0 | WITHIN_BOUND |
| N2-m500 | 3 | 3.000 | 0.120 | 1759 | 1.000 | 2.5 | 0.02 | 2.6 | 2 | 4 | 0.000 | — | POWERED |
| N3-p03 | 0.75 | 0.550 | 0.090 | 1820 | 1.000 | 33.3 | 0.42 | 34.0 | 30 | 58 | 0.000 | — | REPORTED |
| N3-p03 | 1.5 | 1.101 | 0.087 | 1825 | 1.000 | 10.7 | 0.12 | 10.9 | 10 | 18 | 0.000 | 23.3 | WITHIN_BOUND |
| N3-p03 | 3 | 2.201 | 0.096 | 1809 | 1.000 | 3.2 | 0.04 | 3.3 | 3 | 5 | 0.000 | — | POWERED |
| N3-p06 | 0.75 | 0.375 | 0.090 | 1820 | 1.000 | 60.5 | 0.86 | 61.9 | 53 | 109 | 0.000 | — | REPORTED |
| N3-p06 | 1.5 | 0.750 | 0.088 | 1823 | 1.000 | 18.1 | 0.24 | 18.5 | 17 | 31 | 0.000 | 49.1 | WITHIN_BOUND |
| N3-p06 | 3 | 1.500 | 0.096 | 1809 | 1.000 | 4.1 | 0.07 | 4.3 | 3 | 8 | 0.000 | — | POWERED |
| N3-p09 | 0.75 | 0.172 | 0.133 | 1734 | 0.998 | 214.2 | 4.14 | 221.0 | 171 | 444 | 0.002 | — | REPORTED |
| N3-p09 | 1.5 | 0.344 | 0.131 | 1738 | 1.000 | 49.9 | 1.08 | 51.7 | 42 | 110 | 0.000 | 229.6 | WITHIN_BOUND |
| N3-p09 | 3 | 0.688 | 0.132 | 1736 | 1.000 | 1.2 | 0.05 | 1.2 | 1 | 1 | 0.000 | — | POWERED |
| N4-p06-m100 | 0.75 | 0.375 | 0.354 | 1291 | 0.998 | 71.0 | 2.19 | 74.6 | 50 | 146 | 0.002 | — | REPORTED |
| N4-p06-m100 | 1.5 | 0.750 | 0.341 | 1319 | 1.000 | 19.8 | 0.39 | 20.5 | 17 | 38 | 0.000 | 49.1 | WITHIN_BOUND |
| N4-p06-m100 | 3 | 1.500 | 0.339 | 1323 | 1.000 | 4.3 | 0.10 | 4.5 | 3 | 9 | 0.000 | — | POWERED |
| N4-p09-m100 | 0.75 | 0.172 | 0.518 | 963 | 0.906 | 255.1 | 9.68 | 271.0 | 129 | 924 | 0.094 | — | REPORTED |
| N4-p09-m100 | 1.5 | 0.344 | 0.513 | 974 | 0.994 | 71.7 | 3.76 | 77.8 | 39 | 160 | 0.006 | 229.6 | WITHIN_BOUND |
| N4-p09-m100 | 3 | 0.688 | 0.500 | 1000 | 1.000 | 1.5 | 0.13 | 1.7 | 1 | 1 | 0.000 | — | POWERED |
| N7 | 0.75 | 0.750 | 0.089 | 1822 | 1.000 | 20.6 | 0.24 | 21.0 | 19 | 35 | 0.000 | — | REPORTED |
| N7 | 1.5 | 1.500 | 0.088 | 1824 | 1.000 | 7.0 | 0.07 | 7.1 | 7 | 11 | 0.000 | 13.0 | WITHIN_BOUND |
| N7 | 3 | 3.000 | 0.096 | 1809 | 1.000 | 2.5 | 0.02 | 2.6 | 2 | 4 | 0.000 | — | POWERED |

## Against the registered predictions (§4)

- S2 in-class cells: 8 of 10 clear; tokens N1:not-refuted, N2-m30:INCONCLUSIVE, N2-m100:not-refuted, N2-m500:not-refuted, N3-p03:not-refuted, N3-p06:not-refuted, N3-p09:not-refuted, N4-p06-m100:not-refuted, N4-p09-m100:INCONCLUSIVE, N7:not-refuted.
- S2 outside the class: N5:FAIL (arl0_T 154.8), N6:FAIL (arl0_T 229.6), N8:FAIL (arl0_T 221.0).
- S3 rule (a): 10 of 10 cells powered at 3σ (min detection 1.000).
- S3 rule (b): 10 of 10 canonical cells under D*; N1 7.1 vs 13.0; N2-m30 7.9 vs 13.0; N2-m100 7.3 vs 13.0; N2-m500 7.0 vs 13.0; N3-p03 10.9 vs 23.3; N3-p06 18.5 vs 49.1; N3-p09 51.7 vs 229.6; N4-p06-m100 20.5 vs 49.1; N4-p09-m100 77.8 vs 229.6; N7 7.1 vs 13.0.

