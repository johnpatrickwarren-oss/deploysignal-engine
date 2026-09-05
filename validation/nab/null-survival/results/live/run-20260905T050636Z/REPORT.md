# REPORT — 2026-09-nab-null-survival (C76), run run-20260905T050636Z

Engine `0.6.11-pre` at `b4000a331f03ca00e7899eaee7ae69ccbbc68f8d`; NAB at `ea702d75cc2258d9d7dd35ca8e5e2539d71f3140`; node v25.9.0; mode live. Registration sha256 `9fc1547bfd26`; harness sha256 `6f30ccdcfe90`. 23 scored traces (registered 23); arms tool, 0.15, 0.30, 0.50; α 0.05, 0.01 for per-run and per-window cards; α_ARL 0.001; monitor α_cal 0.01; terminal window L = 100. Bounded e-SR: **absent**. Exceptions: 0.

**Tier T3 on every number below** (real telemetry, unlabelled quiet stretches). P1 bars are the constructions' own contracts read on this corpus (PREREGISTRATION §4); a FAILED is "the contract does not describe this corpus at this calibration", not a certification verdict.

Instrument check (§5, the tool arm reproduces C75): family_A_mixture_supermartingale 14 of 14 ok; family_A_betting_e_process 11 of 11 ok; e_sr_mean_shift 20 of 20 ok.

## P1 — false alerts on the quiet stretches against the contract, and the gate

| arm | construction | level | contract | alerting | bar | **P1** | per 1,000 quiet ticks | quiet ticks / windows | alerting stretches | gaussian abstained | bounded abstained | counted after gaussian gate | P2 gaussian before alert | P2 bounded before alert |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tool | family_A_mixture_supermartingale | 0.05 | per-run | 14 | 4 | **FAILED** | 0.33 | 41983 | 14 | 1 | 3 | 13 | 0.07 | 0.21 |
| tool | family_A_mixture_supermartingale | 0.01 | per-run | 11 | 1 | **FAILED** | 0.26 | 41983 | 11 | 1 | 5 | 10 | 0.09 | 0.45 |
| tool | family_A_betting_e_process | 0.05 | per-run | 11 | 4 | **FAILED** | 0.26 | 41983 | 11 | 1 | 1 | 10 | 0.09 | 0.09 |
| tool | family_A_betting_e_process | 0.01 | per-run | 11 | 1 | **FAILED** | 0.26 | 41983 | 11 | 1 | 2 | 10 | 0.09 | 0.18 |
| tool | e_sr_mean_shift | 0.001 | arl | 20 | 24 | **HELD** | 0.48 | 41983 | 20 | 3 | 2 | 17 | 0.15 | 0.10 |
| tool | sequential_ui_e_process | 0.05 | per-run | 2 | 4 | **HELD** | 0.05 | 41983 | 2 | 1 | 2 | 1 | 0.50 | 1.00 |
| tool | sequential_ui_e_process | 0.01 | per-run | 2 | 1 | **FAILED** | 0.05 | 41983 | 2 | 1 | 2 | 1 | 0.50 | 1.00 |
| tool | safe_t_e_value | 0.05 | per-window | 21 | 33 | **HELD** | 0.52 | 405 windows | 10 | 0 | 1 | 10 | 0.00 | 0.10 |
| tool | safe_t_e_value | 0.01 | per-window | 14 | 10 | **FAILED** | 0.35 | 405 windows | 6 | 0 | 1 | 6 | 0.00 | 0.17 |
| tool | universal_inference_e_value | 0.05 | per-window | 4 | 33 | **HELD** | 0.10 | 405 windows | 1 | 0 | 1 | 1 | 0.00 | 1.00 |
| tool | universal_inference_e_value | 0.01 | per-window | 4 | 10 | **HELD** | 0.10 | 405 windows | 1 | 0 | 1 | 1 | 0.00 | 1.00 |
| 0.15 | family_A_mixture_supermartingale | 0.05 | per-run | 21 | 4 | **FAILED** | 0.40 | 52677 | 21 | 2 | 6 | 19 | 0.10 | 0.29 |
| 0.15 | family_A_mixture_supermartingale | 0.01 | per-run | 19 | 1 | **FAILED** | 0.36 | 52677 | 19 | 2 | 10 | 17 | 0.11 | 0.53 |
| 0.15 | family_A_betting_e_process | 0.05 | per-run | 19 | 4 | **FAILED** | 0.36 | 52677 | 19 | 3 | 2 | 16 | 0.16 | 0.11 |
| 0.15 | family_A_betting_e_process | 0.01 | per-run | 15 | 1 | **FAILED** | 0.28 | 52677 | 15 | 4 | 7 | 11 | 0.27 | 0.47 |
| 0.15 | e_sr_mean_shift | 0.001 | arl | 23 | 29 | **HELD** | 0.44 | 52677 | 23 | 4 | 2 | 19 | 0.17 | 0.09 |
| 0.15 | sequential_ui_e_process | 0.05 | per-run | 1 | 4 | **HELD** | 0.02 | 52677 | 1 | 0 | 1 | 1 | 0.00 | 1.00 |
| 0.15 | sequential_ui_e_process | 0.01 | per-run | 1 | 1 | **HELD** | 0.02 | 52677 | 1 | 0 | 1 | 1 | 0.00 | 1.00 |
| 0.15 | safe_t_e_value | 0.05 | per-window | 64 | 40 | **FAILED** | 1.24 | 516 windows | 10 | 2 | 2 | 8 | 0.20 | 0.20 |
| 0.15 | safe_t_e_value | 0.01 | per-window | 57 | 11 | **FAILED** | 1.10 | 516 windows | 9 | 2 | 4 | 7 | 0.22 | 0.44 |
| 0.15 | universal_inference_e_value | 0.05 | per-window | 5 | 40 | **HELD** | 0.10 | 516 windows | 4 | 1 | 1 | 3 | 0.25 | 0.25 |
| 0.15 | universal_inference_e_value | 0.01 | per-window | 5 | 11 | **HELD** | 0.10 | 516 windows | 4 | 1 | 1 | 3 | 0.25 | 0.25 |
| 0.30 | family_A_mixture_supermartingale | 0.05 | per-run | 14 | 4 | **FAILED** | 0.32 | 43382 | 14 | 2 | 8 | 12 | 0.14 | 0.57 |
| 0.30 | family_A_mixture_supermartingale | 0.01 | per-run | 13 | 1 | **FAILED** | 0.30 | 43382 | 13 | 3 | 8 | 10 | 0.23 | 0.62 |
| 0.30 | family_A_betting_e_process | 0.05 | per-run | 16 | 4 | **FAILED** | 0.37 | 43382 | 16 | 2 | 4 | 14 | 0.13 | 0.25 |
| 0.30 | family_A_betting_e_process | 0.01 | per-run | 13 | 1 | **FAILED** | 0.30 | 43382 | 13 | 3 | 7 | 10 | 0.23 | 0.54 |
| 0.30 | e_sr_mean_shift | 0.001 | arl | 22 | 27 | **HELD** | 0.51 | 43382 | 22 | 4 | 2 | 18 | 0.18 | 0.09 |
| 0.30 | sequential_ui_e_process | 0.05 | per-run | 3 | 4 | **HELD** | 0.07 | 43382 | 3 | 1 | 3 | 2 | 0.33 | 1.00 |
| 0.30 | sequential_ui_e_process | 0.01 | per-run | 3 | 1 | **FAILED** | 0.07 | 43382 | 3 | 1 | 3 | 2 | 0.33 | 1.00 |
| 0.30 | safe_t_e_value | 0.05 | per-window | 45 | 34 | **FAILED** | 1.07 | 420 windows | 10 | 2 | 3 | 8 | 0.20 | 0.30 |
| 0.30 | safe_t_e_value | 0.01 | per-window | 37 | 10 | **FAILED** | 0.88 | 420 windows | 8 | 2 | 4 | 6 | 0.25 | 0.50 |
| 0.30 | universal_inference_e_value | 0.05 | per-window | 5 | 34 | **HELD** | 0.12 | 420 windows | 2 | 0 | 2 | 2 | 0.00 | 1.00 |
| 0.30 | universal_inference_e_value | 0.01 | per-window | 4 | 10 | **HELD** | 0.10 | 420 windows | 1 | 0 | 1 | 1 | 0.00 | 1.00 |
| 0.50 | family_A_mixture_supermartingale | 0.05 | per-run | 11 | 4 | **FAILED** | 0.35 | 30986 | 11 | 1 | 5 | 10 | 0.09 | 0.45 |
| 0.50 | family_A_mixture_supermartingale | 0.01 | per-run | 10 | 1 | **FAILED** | 0.32 | 30986 | 10 | 3 | 5 | 7 | 0.30 | 0.50 |
| 0.50 | family_A_betting_e_process | 0.05 | per-run | 12 | 4 | **FAILED** | 0.39 | 30986 | 12 | 3 | 3 | 9 | 0.25 | 0.25 |
| 0.50 | family_A_betting_e_process | 0.01 | per-run | 11 | 1 | **FAILED** | 0.35 | 30986 | 11 | 3 | 6 | 8 | 0.27 | 0.55 |
| 0.50 | e_sr_mean_shift | 0.001 | arl | 21 | 24 | **HELD** | 0.68 | 30986 | 21 | 4 | 1 | 17 | 0.19 | 0.05 |
| 0.50 | sequential_ui_e_process | 0.05 | per-run | 4 | 4 | **HELD** | 0.13 | 30986 | 4 | 1 | 4 | 3 | 0.25 | 1.00 |
| 0.50 | sequential_ui_e_process | 0.01 | per-run | 4 | 1 | **FAILED** | 0.13 | 30986 | 4 | 1 | 4 | 3 | 0.25 | 1.00 |
| 0.50 | safe_t_e_value | 0.05 | per-window | 34 | 26 | **FAILED** | 1.14 | 298 windows | 8 | 1 | 2 | 7 | 0.13 | 0.25 |
| 0.50 | safe_t_e_value | 0.01 | per-window | 30 | 8 | **FAILED** | 1.01 | 298 windows | 7 | 0 | 1 | 7 | 0.00 | 0.14 |
| 0.50 | universal_inference_e_value | 0.05 | per-window | 1 | 26 | **HELD** | 0.03 | 298 windows | 1 | 1 | 1 | 0 | 1.00 | 1.00 |
| 0.50 | universal_inference_e_value | 0.01 | per-window | 1 | 8 | **HELD** | 0.03 | 298 windows | 1 | 1 | 1 | 0 | 1.00 | 1.00 |

## P2 — the monitor's revocations per arm and kind

| arm | kind | revoked | of | rate | median revocation offset after cut (ticks) |
|---|---|---|---|---|---|
| tool | gaussian | 5 | 23 | 0.217 | 18 |
| tool | bounded | 15 | 23 | 0.652 | 272 |
| 0.15 | gaussian | 10 | 23 | 0.435 | 90 |
| 0.15 | bounded | 19 | 23 | 0.826 | 200 |
| 0.30 | gaussian | 7 | 23 | 0.304 | 11 |
| 0.30 | bounded | 14 | 23 | 0.609 | 254 |
| 0.50 | gaussian | 8 | 23 | 0.348 | 17 |
| 0.50 | bounded | 17 | 23 | 0.739 | 327 |

## P3 — detection retained on the labelled windows (C75's classes)

| arm | construction | level | pre | in | late | none | by end | strict in | clears P1 in this arm |
|---|---|---|---|---|---|---|---|---|---|
| tool | family_A_mixture_supermartingale | 0.05 | 14 | 3 | 3 | 3 | 0.739 | 0.130 | no |
| tool | family_A_mixture_supermartingale | 0.01 | 11 | 5 | 4 | 3 | 0.696 | 0.217 | no |
| tool | family_A_betting_e_process | 0.05 | 11 | 2 | 6 | 4 | 0.565 | 0.087 | no |
| tool | family_A_betting_e_process | 0.01 | 11 | 1 | 6 | 5 | 0.522 | 0.043 | no |
| tool | e_sr_mean_shift | 0.001 | 20 | 3 | 0 | 0 | 1.000 | 0.130 | yes |
| tool | sequential_ui_e_process | 0.05 | 2 | 0 | 1 | 20 | 0.087 | 0.000 | no |
| tool | sequential_ui_e_process | 0.01 | 2 | 0 | 1 | 20 | 0.087 | 0.000 | no |
| tool | safe_t_e_value | 0.05 | 11 | 6 | 2 | 4 | 0.739 | 0.261 | no |
| tool | safe_t_e_value | 0.01 | 6 | 8 | 5 | 4 | 0.609 | 0.348 | no |
| tool | universal_inference_e_value | 0.05 | 1 | 4 | 3 | 15 | 0.217 | 0.174 | yes |
| tool | universal_inference_e_value | 0.01 | 1 | 4 | 2 | 16 | 0.217 | 0.174 | yes |
| 0.15 | family_A_mixture_supermartingale | 0.05 | 21 | 1 | 0 | 1 | 0.957 | 0.043 | no |
| 0.15 | family_A_mixture_supermartingale | 0.01 | 19 | 1 | 0 | 3 | 0.870 | 0.043 | no |
| 0.15 | family_A_betting_e_process | 0.05 | 19 | 1 | 1 | 2 | 0.870 | 0.043 | no |
| 0.15 | family_A_betting_e_process | 0.01 | 15 | 1 | 3 | 4 | 0.696 | 0.043 | no |
| 0.15 | e_sr_mean_shift | 0.001 | 23 | 0 | 0 | 0 | 1.000 | 0.000 | yes |
| 0.15 | sequential_ui_e_process | 0.05 | 1 | 0 | 0 | 22 | 0.043 | 0.000 | yes |
| 0.15 | sequential_ui_e_process | 0.01 | 1 | 0 | 0 | 22 | 0.043 | 0.000 | yes |
| 0.15 | safe_t_e_value | 0.05 | 10 | 4 | 4 | 5 | 0.609 | 0.174 | no |
| 0.15 | safe_t_e_value | 0.01 | 9 | 5 | 4 | 5 | 0.609 | 0.217 | no |
| 0.15 | universal_inference_e_value | 0.05 | 4 | 4 | 3 | 12 | 0.348 | 0.174 | yes |
| 0.15 | universal_inference_e_value | 0.01 | 4 | 4 | 2 | 13 | 0.348 | 0.174 | yes |
| 0.30 | family_A_mixture_supermartingale | 0.05 | 14 | 2 | 4 | 3 | 0.696 | 0.087 | no |
| 0.30 | family_A_mixture_supermartingale | 0.01 | 13 | 2 | 4 | 4 | 0.652 | 0.087 | no |
| 0.30 | family_A_betting_e_process | 0.05 | 16 | 2 | 3 | 2 | 0.783 | 0.087 | no |
| 0.30 | family_A_betting_e_process | 0.01 | 13 | 2 | 5 | 3 | 0.652 | 0.087 | no |
| 0.30 | e_sr_mean_shift | 0.001 | 22 | 1 | 0 | 0 | 1.000 | 0.043 | yes |
| 0.30 | sequential_ui_e_process | 0.05 | 3 | 0 | 0 | 20 | 0.130 | 0.000 | no |
| 0.30 | sequential_ui_e_process | 0.01 | 3 | 0 | 0 | 20 | 0.130 | 0.000 | no |
| 0.30 | safe_t_e_value | 0.05 | 11 | 3 | 4 | 5 | 0.609 | 0.130 | no |
| 0.30 | safe_t_e_value | 0.01 | 8 | 5 | 5 | 5 | 0.565 | 0.217 | no |
| 0.30 | universal_inference_e_value | 0.05 | 2 | 3 | 2 | 16 | 0.217 | 0.130 | yes |
| 0.30 | universal_inference_e_value | 0.01 | 1 | 4 | 2 | 16 | 0.217 | 0.174 | yes |
| 0.50 | family_A_mixture_supermartingale | 0.05 | 11 | 3 | 6 | 3 | 0.609 | 0.130 | no |
| 0.50 | family_A_mixture_supermartingale | 0.01 | 10 | 3 | 5 | 5 | 0.565 | 0.130 | no |
| 0.50 | family_A_betting_e_process | 0.05 | 12 | 2 | 4 | 5 | 0.609 | 0.087 | no |
| 0.50 | family_A_betting_e_process | 0.01 | 11 | 1 | 5 | 6 | 0.522 | 0.043 | no |
| 0.50 | e_sr_mean_shift | 0.001 | 21 | 2 | 0 | 0 | 1.000 | 0.087 | yes |
| 0.50 | sequential_ui_e_process | 0.05 | 4 | 0 | 1 | 18 | 0.174 | 0.000 | no |
| 0.50 | sequential_ui_e_process | 0.01 | 4 | 0 | 1 | 18 | 0.174 | 0.000 | no |
| 0.50 | safe_t_e_value | 0.05 | 8 | 10 | 1 | 4 | 0.783 | 0.435 | no |
| 0.50 | safe_t_e_value | 0.01 | 7 | 9 | 2 | 5 | 0.696 | 0.391 | no |
| 0.50 | universal_inference_e_value | 0.05 | 2 | 5 | 2 | 14 | 0.304 | 0.217 | yes |
| 0.50 | universal_inference_e_value | 0.01 | 2 | 5 | 2 | 14 | 0.304 | 0.217 | yes |

## P4 — the estimation price: rate per 1,000 quiet ticks by head fraction

| construction | level | 0.15 | 0.30 | 0.50 | monotone non-increasing |
|---|---|---|---|---|---|
| family_A_mixture_supermartingale | 0.05 | 0.40 | 0.32 | 0.35 | no |
| family_A_mixture_supermartingale | 0.01 | 0.36 | 0.30 | 0.32 | no |
| family_A_betting_e_process | 0.05 | 0.36 | 0.37 | 0.39 | no |
| family_A_betting_e_process | 0.01 | 0.28 | 0.30 | 0.35 | no |
| e_sr_mean_shift | 0.001 | 0.44 | 0.51 | 0.68 | no |
| sequential_ui_e_process | 0.05 | 0.02 | 0.07 | 0.13 | no |
| sequential_ui_e_process | 0.01 | 0.02 | 0.07 | 0.13 | no |
| safe_t_e_value | 0.05 | 1.24 | 1.07 | 1.14 | no |
| safe_t_e_value | 0.01 | 1.10 | 0.88 | 1.01 | no |
| universal_inference_e_value | 0.05 | 0.10 | 0.12 | 0.03 | no |
| universal_inference_e_value | 0.01 | 0.10 | 0.10 | 0.03 | yes |

## Survivors (clear P1 at every level in the arm)

- family_A_mixture_supermartingale: none
- family_A_betting_e_process: none
- e_sr_mean_shift: tool, 0.15, 0.30, 0.50
- sequential_ui_e_process: 0.15
- safe_t_e_value: none
- universal_inference_e_value: tool, 0.15, 0.30, 0.50

Survivor set non-empty: **yes**. Bounded e-SR arm: absent.

## Calibration per (trace, arm)

| trace | arm | cut | quiet ticks | μ̂ | φ̂ | σ̂ (innov.) |
|---|---|---|---|---|---|---|
| AWSCloudwatch/ec2_cpu_utilization_24ae8d | tool | 604 | 2843 | 0.12 | -0.038 | 0.085 |
| AWSCloudwatch/ec2_cpu_utilization_24ae8d | 0.15 | 517 | 2930 | 0.12 | -0.033 | 0.091 |
| AWSCloudwatch/ec2_cpu_utilization_24ae8d | 0.30 | 1034 | 2413 | 0.13 | -0.037 | 0.090 |
| AWSCloudwatch/ec2_cpu_utilization_24ae8d | 0.50 | 1723 | 1724 | 0.13 | -0.045 | 0.087 |
| AWSCloudwatch/ec2_cpu_utilization_53ea38 | tool | 604 | 792 | 1.81 | -0.107 | 0.098 |
| AWSCloudwatch/ec2_cpu_utilization_53ea38 | 0.15 | 209 | 1187 | 1.82 | -0.036 | 0.104 |
| AWSCloudwatch/ec2_cpu_utilization_53ea38 | 0.30 | 418 | 978 | 1.82 | -0.092 | 0.096 |
| AWSCloudwatch/ec2_cpu_utilization_53ea38 | 0.50 | 698 | 698 | 1.81 | -0.117 | 0.097 |
| AWSCloudwatch/ec2_cpu_utilization_5f5533 | tool | 604 | 567 | 46.48 | -0.533 | 3.144 |
| AWSCloudwatch/ec2_cpu_utilization_5f5533 | 0.15 | 175 | 996 | 46.75 | -0.519 | 3.099 |
| AWSCloudwatch/ec2_cpu_utilization_5f5533 | 0.30 | 351 | 820 | 46.52 | -0.533 | 3.103 |
| AWSCloudwatch/ec2_cpu_utilization_5f5533 | 0.50 | 585 | 586 | 46.50 | -0.534 | 3.141 |
| AWSCloudwatch/ec2_cpu_utilization_77c1ca | tool | 604 | 1161 | 11.98 | 0.740 | 19.344 |
| AWSCloudwatch/ec2_cpu_utilization_77c1ca | 0.15 | 264 | 1501 | 14.76 | 0.691 | 22.575 |
| AWSCloudwatch/ec2_cpu_utilization_77c1ca | 0.30 | 529 | 1236 | 13.04 | 0.737 | 20.091 |
| AWSCloudwatch/ec2_cpu_utilization_77c1ca | 0.50 | 882 | 883 | 10.31 | 0.749 | 17.899 |
| AWSCloudwatch/ec2_cpu_utilization_825cc2 | tool | 604 | 922 | 93.23 | 0.483 | 2.009 |
| AWSCloudwatch/ec2_cpu_utilization_825cc2 | 0.15 | 228 | 1298 | 92.66 | 0.387 | 2.048 |
| AWSCloudwatch/ec2_cpu_utilization_825cc2 | 0.30 | 457 | 1069 | 93.30 | 0.433 | 1.971 |
| AWSCloudwatch/ec2_cpu_utilization_825cc2 | 0.50 | 763 | 763 | 93.59 | 0.513 | 1.942 |
| AWSCloudwatch/ec2_cpu_utilization_ac20cd | tool | 604 | 2770 | 30.21 | 0.950 | 5.367 |
| AWSCloudwatch/ec2_cpu_utilization_ac20cd | 0.15 | 506 | 2868 | 34.60 | 0.950 | 4.529 |
| AWSCloudwatch/ec2_cpu_utilization_ac20cd | 0.30 | 1012 | 2362 | 31.79 | 0.950 | 4.206 |
| AWSCloudwatch/ec2_cpu_utilization_ac20cd | 0.50 | 1687 | 1687 | 32.66 | 0.949 | 3.320 |
| AWSCloudwatch/ec2_cpu_utilization_fe7f93 | tool | 604 | 94 | 3.47 | 0.720 | 4.968 |
| AWSCloudwatch/ec2_cpu_utilization_fe7f93 | 0.15 | 104 | 594 | 7.00 | 0.659 | 10.384 |
| AWSCloudwatch/ec2_cpu_utilization_fe7f93 | 0.30 | 209 | 489 | 4.97 | 0.703 | 7.467 |
| AWSCloudwatch/ec2_cpu_utilization_fe7f93 | 0.50 | 349 | 349 | 3.88 | 0.710 | 5.793 |
| AWSCloudwatch/ec2_disk_write_bytes_1ef3de | tool | 709 | 1690 | 2786800.44 | 0.439 | 15200884.768 |
| AWSCloudwatch/ec2_disk_write_bytes_1ef3de | 0.15 | 359 | 2040 | 0.00 | 0.000 | 0.000 |
| AWSCloudwatch/ec2_disk_write_bytes_1ef3de | 0.30 | 719 | 1680 | 2748041.05 | 0.440 | 15095759.412 |
| AWSCloudwatch/ec2_disk_write_bytes_1ef3de | 0.50 | 1199 | 1200 | 3297223.77 | 0.389 | 17348983.376 |
| AWSCloudwatch/ec2_disk_write_bytes_c0d644 | tool | 604 | 1190 | 19065265.81 | 0.293 | 69305053.603 |
| AWSCloudwatch/ec2_disk_write_bytes_c0d644 | 0.15 | 269 | 1525 | 22497381.17 | 0.265 | 75859453.551 |
| AWSCloudwatch/ec2_disk_write_bytes_c0d644 | 0.30 | 538 | 1256 | 21404127.42 | 0.287 | 73268837.769 |
| AWSCloudwatch/ec2_disk_write_bytes_c0d644 | 0.50 | 897 | 897 | 16465523.26 | 0.270 | 66389945.268 |
| AWSCloudwatch/ec2_network_in_257a54 | tool | 604 | 833 | 774905.44 | -0.180 | 1114401.373 |
| AWSCloudwatch/ec2_network_in_257a54 | 0.15 | 215 | 1222 | 769799.92 | -0.196 | 1118371.335 |
| AWSCloudwatch/ec2_network_in_257a54 | 0.30 | 431 | 1006 | 771375.06 | -0.170 | 1119466.886 |
| AWSCloudwatch/ec2_network_in_257a54 | 0.50 | 718 | 719 | 769987.35 | -0.173 | 1113994.069 |
| AWSCloudwatch/ec2_network_in_5abac7 | tool | 709 | 1781 | 68067.32 | -0.007 | 555849.348 |
| AWSCloudwatch/ec2_network_in_5abac7 | 0.15 | 373 | 2117 | 70.21 | -0.502 | 22.357 |
| AWSCloudwatch/ec2_network_in_5abac7 | 0.30 | 747 | 1743 | 64608.31 | -0.006 | 541716.517 |
| AWSCloudwatch/ec2_network_in_5abac7 | 0.50 | 1245 | 1245 | 98754.79 | -0.011 | 663738.780 |
| AWSCloudwatch/elb_request_count_8c0756 | tool | 604 | 79 | 70.25 | 0.135 | 57.651 |
| AWSCloudwatch/elb_request_count_8c0756 | 0.15 | 102 | 581 | 59.42 | 0.008 | 47.743 |
| AWSCloudwatch/elb_request_count_8c0756 | 0.30 | 204 | 479 | 71.20 | 0.100 | 58.769 |
| AWSCloudwatch/elb_request_count_8c0756 | 0.50 | 341 | 342 | 67.71 | 0.077 | 55.831 |
| AWSCloudwatch/grok_asg_anomaly | tool | 693 | 484 | 33.49 | 0.270 | 1.042 |
| AWSCloudwatch/grok_asg_anomaly | 0.15 | 176 | 1001 | 33.48 | 0.082 | 0.254 |
| AWSCloudwatch/grok_asg_anomaly | 0.30 | 353 | 824 | 33.49 | 0.268 | 1.426 |
| AWSCloudwatch/grok_asg_anomaly | 0.50 | 588 | 589 | 33.48 | 0.268 | 1.122 |
| AWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | tool | 186 | 32 | 5715611.05 | 0.910 | 3550762.016 |
| AWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | 0.15 | 32 | 186 | 17154731.24 | 0.817 | 8344456.907 |
| AWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | 0.30 | 65 | 153 | 13343521.48 | 0.839 | 5930242.203 |
| AWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | 0.50 | 109 | 109 | 8894259.72 | 0.888 | 4628031.721 |
| AWSCloudwatch/rds_cpu_utilization_cc0c53 | tool | 604 | 2376 | 6.19 | 0.053 | 0.366 |
| AWSCloudwatch/rds_cpu_utilization_cc0c53 | 0.15 | 447 | 2533 | 6.18 | 0.055 | 0.360 |
| AWSCloudwatch/rds_cpu_utilization_cc0c53 | 0.30 | 894 | 2086 | 6.17 | 0.023 | 0.356 |
| AWSCloudwatch/rds_cpu_utilization_cc0c53 | 0.50 | 1490 | 1490 | 6.15 | -0.007 | 0.354 |
| AWSCloudwatch/rds_cpu_utilization_e47b3b | tool | 604 | 242 | 13.71 | -0.061 | 0.496 |
| AWSCloudwatch/rds_cpu_utilization_e47b3b | 0.15 | 126 | 720 | 13.99 | -0.013 | 0.528 |
| AWSCloudwatch/rds_cpu_utilization_e47b3b | 0.30 | 253 | 593 | 13.83 | -0.018 | 0.531 |
| AWSCloudwatch/rds_cpu_utilization_e47b3b | 0.50 | 423 | 423 | 13.77 | -0.028 | 0.509 |
| KnownCause/ambient_temperature_system_failure | tool | 1090 | 2450 | 70.16 | 0.946 | 0.981 |
| KnownCause/ambient_temperature_system_failure | 0.15 | 531 | 3009 | 69.73 | 0.949 | 0.934 |
| KnownCause/ambient_temperature_system_failure | 0.30 | 1062 | 2478 | 70.27 | 0.942 | 0.994 |
| KnownCause/ambient_temperature_system_failure | 0.50 | 1770 | 1770 | 69.93 | 0.944 | 0.940 |
| KnownCause/cpu_utilization_asg_misconfiguration | tool | 2707 | 13844 | 37.47 | 0.270 | 14.234 |
| KnownCause/cpu_utilization_asg_misconfiguration | 0.15 | 2482 | 14069 | 37.15 | 0.244 | 13.777 |
| KnownCause/cpu_utilization_asg_misconfiguration | 0.30 | 4965 | 11586 | 37.07 | 0.288 | 13.055 |
| KnownCause/cpu_utilization_asg_misconfiguration | 0.50 | 8275 | 8276 | 37.38 | 0.295 | 13.249 |
| KnownCause/ec2_request_latency_system_failure | tool | 604 | 1410 | 44.74 | -0.317 | 1.574 |
| KnownCause/ec2_request_latency_system_failure | 0.15 | 302 | 1712 | 44.75 | -0.277 | 1.542 |
| KnownCause/ec2_request_latency_system_failure | 0.30 | 604 | 1410 | 44.74 | -0.317 | 1.574 |
| KnownCause/ec2_request_latency_system_failure | 0.50 | 1007 | 1007 | 44.88 | -0.286 | 1.653 |
| KnownCause/machine_temperature_system_failure | tool | 3404 | 299 | 83.04 | 0.950 | 4.092 |
| KnownCause/machine_temperature_system_failure | 0.15 | 555 | 3148 | 83.01 | 0.950 | 2.169 |
| KnownCause/machine_temperature_system_failure | 0.30 | 1110 | 2593 | 80.35 | 0.950 | 2.669 |
| KnownCause/machine_temperature_system_failure | 0.50 | 1851 | 1852 | 81.21 | 0.950 | 2.583 |
| KnownCause/nyc_taxi | tool | 1548 | 4291 | 15025.88 | 0.950 | 2095.546 |
| KnownCause/nyc_taxi | 0.15 | 875 | 4964 | 14756.04 | 0.950 | 2098.055 |
| KnownCause/nyc_taxi | 0.30 | 1751 | 4088 | 14948.52 | 0.950 | 2087.457 |
| KnownCause/nyc_taxi | 0.50 | 2919 | 2920 | 14805.69 | 0.950 | 2031.678 |
| KnownCause/rogue_agent_key_hold | tool | 282 | 387 | 0.07 | 0.093 | 0.053 |
| KnownCause/rogue_agent_key_hold | 0.15 | 100 | 569 | 0.06 | 0.267 | 0.030 |
| KnownCause/rogue_agent_key_hold | 0.30 | 200 | 469 | 0.07 | 0.168 | 0.050 |
| KnownCause/rogue_agent_key_hold | 0.50 | 334 | 335 | 0.06 | 0.205 | 0.052 |
| KnownCause/rogue_agent_key_updown | tool | 797 | 1446 | 0.41 | 0.048 | 2.299 |
| KnownCause/rogue_agent_key_updown | 0.15 | 336 | 1907 | 0.37 | 0.220 | 1.197 |
| KnownCause/rogue_agent_key_updown | 0.30 | 672 | 1571 | 0.49 | 0.043 | 2.497 |
| KnownCause/rogue_agent_key_updown | 0.50 | 1121 | 1122 | 0.34 | 0.065 | 1.983 |

