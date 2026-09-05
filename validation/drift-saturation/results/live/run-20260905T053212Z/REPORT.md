# REPORT — 2026-09-drift-saturation (C78), run run-20260905T053212Z

Engine `0.6.11-pre` at `697da9588ecf939f921b819abfd620bb00f9a67f`; node v25.9.0; mode live. Registration sha256 `61e1b7480088`; harness sha256 `b6d33a3bbf43`; nulls sha256 `5f6746bfbeca`. N = 500 per cell, seed 20260904; m = 100, ν = 500, post = 500; capacity 4σ, κ = 4, 5 steps, latency step 1.5σ; shapes linear, exponential, staircase; horizons 500, 2000; nulls N1, N3-p06; α 0.05, 0.0001; α_ARL 0.001, 0.0001; monitor α_cal 0.01 ('bounded'); K5 instrument window 200, e ≥ 20. Bounded e-SR: **absent**. Exceptions: 0.

**Tier T1 on every number below** (house synthetic nulls, oracle parameters). P1's bar is the coverage matrix's 0.50 floor read on the unconditional fraction; nothing here ships (PREREGISTRATION §6).

Instrument check (§4): passed — 3σ step fires at e_sr_mean_shift 502, universal_inference_e_value 599, sequential_ui_e_process 2038, family_A_mixture_supermartingale 524; clean at 10⁻⁴: family_A_mixture_supermartingale quiet, universal_inference_e_value quiet, sequential_ui_e_process quiet.

## P1 / P2 — alerting before saturation and lead time, per cell (rate signal)

| cell | construction | level | baseline alerts | before S | after S | never | **P1** | bar | P1c | abstained | P1g | lead median | lead/H | censored mean | monitor revoked before S | monitor offset median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| linear-H500-N1 | e_sr_mean_shift | 0.001 | 88 | 412 | 0 | 0 | **0.824** | **HELD** | 1.000 | 0 | 0.824 | 428 | 0.86 | 430 | 1.00 | -349 |
| linear-H500-N1 | e_sr_mean_shift | 0.0001 | 12 | 488 | 0 | 0 | **0.976** | **HELD** | 1.000 | 2 | 0.972 | 413.5 | 0.83 | 414 | 1.00 | -349 |
| linear-H500-N1 | universal_inference_e_value | 0.05 | 0 | 497 | 3 | 0 | **0.994** | **HELD** | 0.994 | 477 | 0.040 | 301 | 0.60 | 276 | 1.00 | -349 |
| linear-H500-N1 | universal_inference_e_value | 0.0001 | 0 | 496 | 4 | 0 | **0.992** | **HELD** | 0.992 | 496 | 0.000 | 201 | 0.40 | 211 | 1.00 | -349 |
| linear-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -349 |
| linear-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -349 |
| linear-H500-N1 | family_A_mixture_supermartingale | 0.05 | 15 | 485 | 0 | 0 | **0.970** | **HELD** | 1.000 | 7 | 0.956 | 356 | 0.71 | 358 | 1.00 | -349 |
| linear-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 326 | 0.65 | 328 | 1.00 | -349 |
| linear-H500-N3-p06 | e_sr_mean_shift | 0.001 | 97 | 403 | 0 | 0 | **0.806** | **HELD** | 1.000 | 0 | 0.806 | 393 | 0.79 | 397 | 1.00 | -281 |
| linear-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 11 | 489 | 0 | 0 | **0.978** | **HELD** | 1.000 | 0 | 0.978 | 370 | 0.74 | 372 | 1.00 | -281 |
| linear-H500-N3-p06 | universal_inference_e_value | 0.05 | 1 | 425 | 57 | 17 | **0.850** | **HELD** | 0.852 | 370 | 0.110 | 201 | 0.40 | 145 | 1.00 | -281 |
| linear-H500-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 97 | 172 | 231 | **0.194** | **FAILED** | 0.194 | 97 | 0.000 | 1 | 0.00 | 12 | 1.00 | -281 |
| linear-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -281 |
| linear-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -281 |
| linear-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 1 | 499 | 0 | 0 | **0.998** | **HELD** | 1.000 | 499 | 0.000 | 262 | 0.52 | 267 | 1.00 | -281 |
| linear-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 214 | 0.43 | 216 | 1.00 | -281 |
| linear-H2000-N1 | e_sr_mean_shift | 0.001 | 77 | 423 | 0 | 0 | **0.846** | **HELD** | 1.000 | 0 | 0.846 | 1840 | 0.92 | 1843 | 1.00 | -1683 |
| linear-H2000-N1 | e_sr_mean_shift | 0.0001 | 6 | 494 | 0 | 0 | **0.988** | **HELD** | 1.000 | 1 | 0.986 | 1796 | 0.90 | 1799 | 1.00 | -1683 |
| linear-H2000-N1 | universal_inference_e_value | 0.05 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 451 | 0.098 | 1501 | 0.75 | 1529 | 1.00 | -1683 |
| linear-H2000-N1 | universal_inference_e_value | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 499 | 0.002 | 1301 | 0.65 | 1306 | 1.00 | -1683 |
| linear-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 2 | 0 | 498 | **0.004** | **FAILED** | 0.004 | 2 | 0.000 | 958.5 | 0.48 | 4 | 1.00 | -1683 |
| linear-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1683 |
| linear-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 15 | 485 | 0 | 0 | **0.970** | **HELD** | 1.000 | 10 | 0.950 | 1696 | 0.85 | 1697 | 1.00 | -1683 |
| linear-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 1628 | 0.81 | 1629 | 1.00 | -1683 |
| linear-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 103 | 397 | 0 | 0 | **0.794** | **HELD** | 1.000 | 0 | 0.794 | 1751 | 0.88 | 1761 | 1.00 | -1532 |
| linear-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 6 | 494 | 0 | 0 | **0.988** | **HELD** | 1.000 | 5 | 0.978 | 1682.5 | 0.84 | 1690 | 1.00 | -1532 |
| linear-H2000-N3-p06 | universal_inference_e_value | 0.05 | 0 | 480 | 7 | 13 | **0.960** | **HELD** | 0.960 | 464 | 0.032 | 1201 | 0.60 | 1052 | 1.00 | -1532 |
| linear-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 259 | 63 | 178 | **0.518** | **HELD** | 0.518 | 259 | 0.000 | 401 | 0.20 | 224 | 1.00 | -1532 |
| linear-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1532 |
| linear-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1532 |
| linear-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 1482 | 0.74 | 1481 | 1.00 | -1532 |
| linear-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 1367 | 0.68 | 1366 | 1.00 | -1532 |
| exponential-H500-N1 | e_sr_mean_shift | 0.001 | 90 | 410 | 0 | 0 | **0.820** | **HELD** | 1.000 | 0 | 0.820 | 280 | 0.56 | 290 | 1.00 | -163 |
| exponential-H500-N1 | e_sr_mean_shift | 0.0001 | 11 | 489 | 0 | 0 | **0.978** | **HELD** | 1.000 | 5 | 0.968 | 248 | 0.50 | 252 | 1.00 | -163 |
| exponential-H500-N1 | universal_inference_e_value | 0.05 | 0 | 358 | 142 | 0 | **0.716** | **HELD** | 0.716 | 307 | 0.102 | 101 | 0.20 | 81 | 1.00 | -163 |
| exponential-H500-N1 | universal_inference_e_value | 0.0001 | 0 | 145 | 355 | 0 | **0.290** | **FAILED** | 0.290 | 144 | 0.002 | 101 | 0.20 | 24 | 1.00 | -163 |
| exponential-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -163 |
| exponential-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -163 |
| exponential-H500-N1 | family_A_mixture_supermartingale | 0.05 | 19 | 481 | 0 | 0 | **0.962** | **HELD** | 1.000 | 10 | 0.942 | 171 | 0.34 | 176 | 1.00 | -163 |
| exponential-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 133.5 | 0.27 | 135 | 1.00 | -163 |
| exponential-H500-N3-p06 | e_sr_mean_shift | 0.001 | 91 | 409 | 0 | 0 | **0.818** | **HELD** | 1.000 | 0 | 0.818 | 217 | 0.43 | 237 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 4 | 496 | 0 | 0 | **0.992** | **HELD** | 1.000 | 2 | 0.988 | 175.5 | 0.35 | 183 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | universal_inference_e_value | 0.05 | 1 | 143 | 341 | 15 | **0.286** | **FAILED** | 0.287 | 104 | 0.078 | 1 | 0.00 | 13 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 6 | 230 | 264 | **0.012** | **FAILED** | 0.012 | 5 | 0.002 | 1 | 0.00 | 0 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 1 | 498 | 1 | 0 | **0.996** | **HELD** | 0.998 | 498 | 0.000 | 67 | 0.13 | 70 | 1.00 | -85.5 |
| exponential-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 470 | 30 | 0 | **0.940** | **HELD** | 0.940 | 470 | 0.000 | 28 | 0.06 | 28 | 1.00 | -85.5 |
| exponential-H2000-N1 | e_sr_mean_shift | 0.001 | 104 | 396 | 0 | 0 | **0.792** | **HELD** | 1.000 | 1 | 0.790 | 1409 | 0.70 | 1461 | 1.00 | -1064 |
| exponential-H2000-N1 | e_sr_mean_shift | 0.0001 | 15 | 485 | 0 | 0 | **0.970** | **HELD** | 1.000 | 10 | 0.950 | 1262 | 0.63 | 1289 | 1.00 | -1064 |
| exponential-H2000-N1 | universal_inference_e_value | 0.05 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 491 | 0.018 | 701 | 0.35 | 737 | 1.00 | -1064 |
| exponential-H2000-N1 | universal_inference_e_value | 0.0001 | 0 | 499 | 1 | 0 | **0.998** | **HELD** | 0.998 | 499 | 0.000 | 501 | 0.25 | 483 | 1.00 | -1064 |
| exponential-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1064 |
| exponential-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1064 |
| exponential-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 12 | 488 | 0 | 0 | **0.976** | **HELD** | 1.000 | 167 | 0.642 | 1067.5 | 0.53 | 1085 | 1.00 | -1064 |
| exponential-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 942 | 0.47 | 949 | 1.00 | -1064 |
| exponential-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 96 | 404 | 0 | 0 | **0.808** | **HELD** | 1.000 | 1 | 0.806 | 1254 | 0.63 | 1333 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 7 | 493 | 0 | 0 | **0.986** | **HELD** | 1.000 | 18 | 0.950 | 1006 | 0.50 | 1058 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | universal_inference_e_value | 0.05 | 0 | 459 | 28 | 13 | **0.918** | **HELD** | 0.918 | 443 | 0.032 | 401 | 0.20 | 337 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 107 | 184 | 209 | **0.214** | **FAILED** | 0.214 | 107 | 0.000 | 101 | 0.05 | 21 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 3 | 497 | 0 | 0 | **0.994** | **HELD** | 1.000 | 497 | 0.000 | 695 | 0.35 | 703 | 1.00 | -796.5 |
| exponential-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 539.5 | 0.27 | 544 | 1.00 | -796.5 |
| staircase-H500-N1 | e_sr_mean_shift | 0.001 | 101 | 399 | 0 | 0 | **0.798** | **HELD** | 1.000 | 0 | 0.798 | 385 | 0.77 | 386 | 1.00 | -289 |
| staircase-H500-N1 | e_sr_mean_shift | 0.0001 | 10 | 490 | 0 | 0 | **0.980** | **HELD** | 1.000 | 0 | 0.980 | 376 | 0.75 | 375 | 1.00 | -289 |
| staircase-H500-N1 | universal_inference_e_value | 0.05 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 323 | 0.354 | 301 | 0.60 | 249 | 1.00 | -289 |
| staircase-H500-N1 | universal_inference_e_value | 0.0001 | 0 | 498 | 2 | 0 | **0.996** | **HELD** | 0.996 | 482 | 0.032 | 201 | 0.40 | 186 | 1.00 | -289 |
| staircase-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -289 |
| staircase-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -289 |
| staircase-H500-N1 | family_A_mixture_supermartingale | 0.05 | 11 | 489 | 0 | 0 | **0.978** | **HELD** | 1.000 | 3 | 0.972 | 296 | 0.59 | 299 | 1.00 | -289 |
| staircase-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 272 | 0.54 | 271 | 1.00 | -289 |
| staircase-H500-N3-p06 | e_sr_mean_shift | 0.001 | 94 | 406 | 0 | 0 | **0.812** | **HELD** | 1.000 | 0 | 0.812 | 356 | 0.71 | 354 | 1.00 | -233 |
| staircase-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 13 | 487 | 0 | 0 | **0.974** | **HELD** | 1.000 | 1 | 0.972 | 326 | 0.65 | 326 | 1.00 | -233 |
| staircase-H500-N3-p06 | universal_inference_e_value | 0.05 | 1 | 421 | 59 | 19 | **0.842** | **HELD** | 0.844 | 372 | 0.098 | 101 | 0.20 | 108 | 1.00 | -233 |
| staircase-H500-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 82 | 173 | 245 | **0.164** | **FAILED** | 0.164 | 82 | 0.000 | 1 | 0.00 | 7 | 1.00 | -233 |
| staircase-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -233 |
| staircase-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -233 |
| staircase-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 4 | 496 | 0 | 0 | **0.992** | **HELD** | 1.000 | 496 | 0.000 | 209.5 | 0.42 | 213 | 1.00 | -233 |
| staircase-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 163 | 0.33 | 162 | 1.00 | -233 |
| staircase-H2000-N1 | e_sr_mean_shift | 0.001 | 84 | 416 | 0 | 0 | **0.832** | **HELD** | 1.000 | 0 | 0.832 | 1586 | 0.79 | 1624 | 1.00 | -1452 |
| staircase-H2000-N1 | e_sr_mean_shift | 0.0001 | 6 | 494 | 0 | 0 | **0.988** | **HELD** | 1.000 | 0 | 0.988 | 1577 | 0.79 | 1581 | 1.00 | -1452 |
| staircase-H2000-N1 | universal_inference_e_value | 0.05 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 258 | 0.484 | 1501 | 0.75 | 1378 | 1.00 | -1452 |
| staircase-H2000-N1 | universal_inference_e_value | 0.0001 | 0 | 499 | 1 | 0 | **0.998** | **HELD** | 0.998 | 483 | 0.032 | 1101 | 0.55 | 1094 | 1.00 | -1452 |
| staircase-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1452 |
| staircase-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1452 |
| staircase-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 8 | 492 | 0 | 0 | **0.984** | **HELD** | 1.000 | 2 | 0.980 | 1463.5 | 0.73 | 1462 | 1.00 | -1452 |
| staircase-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 1402 | 0.70 | 1400 | 1.00 | -1452 |
| staircase-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 85 | 415 | 0 | 0 | **0.830** | **HELD** | 1.000 | 0 | 0.830 | 1561 | 0.78 | 1604 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 12 | 488 | 0 | 0 | **0.976** | **HELD** | 1.000 | 0 | 0.976 | 1523 | 0.76 | 1523 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | universal_inference_e_value | 0.05 | 0 | 484 | 10 | 6 | **0.968** | **HELD** | 0.968 | 451 | 0.066 | 1001 | 0.50 | 880 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 0 | 205 | 100 | 195 | **0.410** | **FAILED** | 0.410 | 205 | 0.000 | 301 | 0.15 | 158 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | 0 | 500 | **0.000** | **FAILED** | 0.000 | 0 | 0.000 | — | — | 0 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 2 | 498 | 0 | 0 | **0.996** | **HELD** | 1.000 | 498 | 0.000 | 1216 | 0.61 | 1233 | 1.00 | -1298 |
| staircase-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 0 | 500 | 0 | 0 | **1.000** | **HELD** | 1.000 | 500 | 0.000 | 1120 | 0.56 | 1120 | 1.00 | -1298 |

## P2 — the latency comparator (K1 step of 1.5σ at S on the latency signal)

| cell | construction | level | latency alerts in [S, T) | latency alerts before S | latency delay median | both alerted | lead over latency alarm, median |
|---|---|---|---|---|---|---|---|
| linear-H500-N1 | e_sr_mean_shift | 0.001 | 294 | 206 | 6 | 500 | 423 |
| linear-H500-N1 | e_sr_mean_shift | 0.0001 | 480 | 20 | 8 | 500 | 422 |
| linear-H500-N1 | universal_inference_e_value | 0.05 | 500 | 0 | 99 | 500 | 400 |
| linear-H500-N1 | universal_inference_e_value | 0.0001 | 477 | 0 | 99 | 477 | 300 |
| linear-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| linear-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| linear-H500-N1 | family_A_mixture_supermartingale | 0.05 | 481 | 19 | 75 | 500 | 430 |
| linear-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 108 | 500 | 434 |
| linear-H500-N3-p06 | e_sr_mean_shift | 0.001 | 302 | 198 | 16 | 500 | 392 |
| linear-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 474 | 26 | 25 | 500 | 397 |
| linear-H500-N3-p06 | universal_inference_e_value | 0.05 | 331 | 1 | 99 | 319 | 300 |
| linear-H500-N3-p06 | universal_inference_e_value | 0.0001 | 8 | 0 | 149 | 6 | 50 |
| linear-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| linear-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| linear-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 499 | 1 | 204 | 500 | 472 |
| linear-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 292.5 | 500 | 511 |
| linear-H2000-N1 | e_sr_mean_shift | 0.001 | 130 | 370 | 5 | 500 | 792.5 |
| linear-H2000-N1 | e_sr_mean_shift | 0.0001 | 438 | 62 | 8 | 500 | 1796.5 |
| linear-H2000-N1 | universal_inference_e_value | 0.05 | 499 | 0 | 99 | 499 | 1600 |
| linear-H2000-N1 | universal_inference_e_value | 0.0001 | 484 | 0 | 99 | 484 | 1500 |
| linear-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| linear-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| linear-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 489 | 11 | 121 | 500 | 1822 |
| linear-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 170 | 500 | 1798.5 |
| linear-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 116 | 384 | 15.5 | 500 | 725 |
| linear-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 442 | 58 | 25 | 500 | 1700.5 |
| linear-H2000-N3-p06 | universal_inference_e_value | 0.05 | 321 | 3 | 199 | 319 | 1300 |
| linear-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 6 | 0 | 149 | 5 | 800 |
| linear-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| linear-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| linear-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 498 | 0 | 315 | 498 | 1800.5 |
| linear-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 364 | 0 | 421.5 | 364 | 1785 |
| exponential-H500-N1 | e_sr_mean_shift | 0.001 | 311 | 189 | 6 | 500 | 271.5 |
| exponential-H500-N1 | e_sr_mean_shift | 0.0001 | 477 | 23 | 8 | 500 | 255.5 |
| exponential-H500-N1 | universal_inference_e_value | 0.05 | 496 | 0 | 99 | 496 | 200 |
| exponential-H500-N1 | universal_inference_e_value | 0.0001 | 465 | 0 | 99 | 465 | 0 |
| exponential-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| exponential-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| exponential-H500-N1 | family_A_mixture_supermartingale | 0.05 | 495 | 5 | 74 | 500 | 250 |
| exponential-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 107 | 500 | 242 |
| exponential-H500-N3-p06 | e_sr_mean_shift | 0.001 | 321 | 179 | 16 | 500 | 218 |
| exponential-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 485 | 15 | 25 | 500 | 202 |
| exponential-H500-N3-p06 | universal_inference_e_value | 0.05 | 319 | 1 | 199 | 312 | 100 |
| exponential-H500-N3-p06 | universal_inference_e_value | 0.0001 | 8 | 0 | 249 | 2 | -200 |
| exponential-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| exponential-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| exponential-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 500 | 0 | 191.5 | 500 | 261 |
| exponential-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 283 | 500 | 310 |
| exponential-H2000-N1 | e_sr_mean_shift | 0.001 | 145 | 355 | 5 | 500 | 569.5 |
| exponential-H2000-N1 | e_sr_mean_shift | 0.0001 | 440 | 60 | 8 | 500 | 1254.5 |
| exponential-H2000-N1 | universal_inference_e_value | 0.05 | 498 | 0 | 99 | 498 | 800 |
| exponential-H2000-N1 | universal_inference_e_value | 0.0001 | 474 | 0 | 99 | 474 | 600 |
| exponential-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| exponential-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| exponential-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 487 | 13 | 122 | 500 | 1193 |
| exponential-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 171.5 | 500 | 1110.5 |
| exponential-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 117 | 383 | 18 | 500 | 309.5 |
| exponential-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 438 | 62 | 25 | 500 | 1010.5 |
| exponential-H2000-N3-p06 | universal_inference_e_value | 0.05 | 323 | 1 | 99 | 318 | 500 |
| exponential-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 9 | 0 | 199 | 4 | 350 |
| exponential-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| exponential-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| exponential-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 493 | 2 | 317 | 495 | 1008 |
| exponential-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 363 | 0 | 418 | 363 | 947 |
| staircase-H500-N1 | e_sr_mean_shift | 0.001 | 317 | 183 | 6 | 500 | 386 |
| staircase-H500-N1 | e_sr_mean_shift | 0.0001 | 480 | 20 | 8 | 500 | 384 |
| staircase-H500-N1 | universal_inference_e_value | 0.05 | 498 | 1 | 99 | 499 | 400 |
| staircase-H500-N1 | universal_inference_e_value | 0.0001 | 478 | 0 | 99 | 478 | 300 |
| staircase-H500-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| staircase-H500-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| staircase-H500-N1 | family_A_mixture_supermartingale | 0.05 | 490 | 10 | 77.5 | 500 | 376 |
| staircase-H500-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 109 | 500 | 379 |
| staircase-H500-N3-p06 | e_sr_mean_shift | 0.001 | 316 | 184 | 16 | 500 | 358 |
| staircase-H500-N3-p06 | e_sr_mean_shift | 0.0001 | 478 | 22 | 25.5 | 500 | 348.5 |
| staircase-H500-N3-p06 | universal_inference_e_value | 0.05 | 312 | 0 | 199 | 299 | 300 |
| staircase-H500-N3-p06 | universal_inference_e_value | 0.0001 | 6 | 0 | 249 | 2 | 300 |
| staircase-H500-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| staircase-H500-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| staircase-H500-N3-p06 | family_A_mixture_supermartingale | 0.05 | 496 | 4 | 198 | 500 | 414.5 |
| staircase-H500-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 291 | 500 | 452 |
| staircase-H2000-N1 | e_sr_mean_shift | 0.001 | 125 | 375 | 6 | 500 | 455.5 |
| staircase-H2000-N1 | e_sr_mean_shift | 0.0001 | 439 | 61 | 8 | 500 | 1582 |
| staircase-H2000-N1 | universal_inference_e_value | 0.05 | 495 | 2 | 99 | 497 | 1600 |
| staircase-H2000-N1 | universal_inference_e_value | 0.0001 | 475 | 0 | 99 | 475 | 1200 |
| staircase-H2000-N1 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| staircase-H2000-N1 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| staircase-H2000-N1 | family_A_mixture_supermartingale | 0.05 | 485 | 15 | 125 | 500 | 1584 |
| staircase-H2000-N1 | family_A_mixture_supermartingale | 0.0001 | 500 | 0 | 174.5 | 500 | 1572.5 |
| staircase-H2000-N3-p06 | e_sr_mean_shift | 0.001 | 128 | 372 | 16 | 500 | 580.5 |
| staircase-H2000-N3-p06 | e_sr_mean_shift | 0.0001 | 441 | 59 | 24 | 500 | 1542 |
| staircase-H2000-N3-p06 | universal_inference_e_value | 0.05 | 301 | 3 | 199 | 300 | 1200 |
| staircase-H2000-N3-p06 | universal_inference_e_value | 0.0001 | 3 | 0 | 299 | 0 | — |
| staircase-H2000-N3-p06 | sequential_ui_e_process | 0.05 | 0 | 0 | — | 0 | — |
| staircase-H2000-N3-p06 | sequential_ui_e_process | 0.0001 | 0 | 0 | — | 0 | — |
| staircase-H2000-N3-p06 | family_A_mixture_supermartingale | 0.05 | 493 | 0 | 325 | 493 | 1547 |
| staircase-H2000-N3-p06 | family_A_mixture_supermartingale | 0.0001 | 353 | 0 | 428 | 353 | 1538 |

## P3 — false alerts on the baseline [m, ν) against the contract, pooled per null

| null | construction | level | contract | pooled N | alerting | bar | **P3** | per 1,000 baseline ticks |
|---|---|---|---|---|---|---|---|---|
| N1 | e_sr_mean_shift | 0.001 | arl | 3000 | 544 | 1083 | **HELD** | 0.45 |
| N1 | e_sr_mean_shift | 0.0001 | arl | 3000 | 60 | 150 | **HELD** | 0.05 |
| N1 | universal_inference_e_value | 0.05 | per-window | 3000 | 0 | 671 | **HELD** | 0.00 |
| N1 | universal_inference_e_value | 0.0001 | per-window | 3000 | 0 | 4 | **HELD** | 0.00 |
| N1 | sequential_ui_e_process | 0.05 | per-run | 3000 | 0 | 185 | **HELD** | 0.00 |
| N1 | sequential_ui_e_process | 0.0001 | per-run | 3000 | 0 | 1 | **HELD** | 0.00 |
| N1 | family_A_mixture_supermartingale | 0.05 | per-run | 3000 | 80 | 185 | **HELD** | 0.07 |
| N1 | family_A_mixture_supermartingale | 0.0001 | per-run | 3000 | 0 | 1 | **HELD** | 0.00 |
| N3-p06 | e_sr_mean_shift | 0.001 | arl | 3000 | 566 | 1083 | **HELD** | 0.47 |
| N3-p06 | e_sr_mean_shift | 0.0001 | arl | 3000 | 53 | 150 | **HELD** | 0.04 |
| N3-p06 | universal_inference_e_value | 0.05 | per-window | 3000 | 3 | 671 | **HELD** | 0.00 |
| N3-p06 | universal_inference_e_value | 0.0001 | per-window | 3000 | 0 | 4 | **HELD** | 0.00 |
| N3-p06 | sequential_ui_e_process | 0.05 | per-run | 3000 | 0 | 185 | **HELD** | 0.00 |
| N3-p06 | sequential_ui_e_process | 0.0001 | per-run | 3000 | 0 | 1 | **HELD** | 0.00 |
| N3-p06 | family_A_mixture_supermartingale | 0.05 | per-run | 3000 | 11 | 185 | **HELD** | 0.01 |
| N3-p06 | family_A_mixture_supermartingale | 0.0001 | per-run | 3000 | 0 | 1 | **HELD** | 0.00 |

## P4 — the K5 instrument (safe-t on cal [0, m) vs [ν, ν + 200), e ≥ 20)

| cell | fraction e ≥ 20 |
|---|---|
| linear-H500-N1 | 0.998 |
| linear-H500-N3-p06 | 0.348 |
| linear-H2000-N1 | 0.024 |
| linear-H2000-N3-p06 | 0.002 |
| exponential-H500-N1 | 0.002 |
| exponential-H500-N3-p06 | 0.002 |
| exponential-H2000-N1 | 0.000 |
| exponential-H2000-N3-p06 | 0.000 |
| staircase-H500-N1 | 0.248 |
| staircase-H500-N3-p06 | 0.032 |
| staircase-H2000-N1 | 0.002 |
| staircase-H2000-N3-p06 | 0.000 |

## P1 bar summary (cells HELD of 12, per construction and level)

- e_sr_mean_shift@0.001: 12 of 12 HELD; canonical (linear-H2000-N1) P1 0.846
- e_sr_mean_shift@0.0001: 12 of 12 HELD; canonical (linear-H2000-N1) P1 0.988
- universal_inference_e_value@0.05: 11 of 12 HELD; canonical (linear-H2000-N1) P1 1.000
- universal_inference_e_value@0.0001: 6 of 12 HELD; canonical (linear-H2000-N1) P1 1.000
- sequential_ui_e_process@0.05: 0 of 12 HELD; canonical (linear-H2000-N1) P1 0.004
- sequential_ui_e_process@0.0001: 0 of 12 HELD; canonical (linear-H2000-N1) P1 0.000
- family_A_mixture_supermartingale@0.05: 12 of 12 HELD; canonical (linear-H2000-N1) P1 0.970
- family_A_mixture_supermartingale@0.0001: 12 of 12 HELD; canonical (linear-H2000-N1) P1 1.000

