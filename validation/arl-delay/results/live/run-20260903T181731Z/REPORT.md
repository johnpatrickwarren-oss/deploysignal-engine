# 2026-09-arl-delay — run run-20260903T181731Z

Engine `0.6.9-pre` at `6c874fad9f4558abf59a3de0e2d6136bafe1c2d9`; node v25.9.0; mode live.
Registration sha256 `58bbacda06bf`; harness sha256 `54978e532720`.
N = 2000; arm A T = 3000; arm B T = 1000, ν = 200; α scored 0.05, 0.01; α = 0.0001 descriptive.

The two endpoints carry no verdict authority (Amendment v1.C66, C66.3). The gates below are instrument checks (G1, G2) and one construction prediction (G3).

## Gates

- **G1 (instrument reproduces the battery): HELD** — 0 of 104 cells outside 3 pooled se; 104 of 104 exact count matches.
- **G2 (delay executability, N1, α = 0.05, class-own injection):**
  - family_D_spectral_e_detector @ K3: p_detect = 0.1740 → NOT-EXECUTABLE (delay cells for this pair are not quoted)
  - family_A_betting_e_process @ K1: p_detect = 1.0000 → EXECUTABLE
  - family_A_mixture_supermartingale @ K1: p_detect = 1.0000 → EXECUTABLE
  - family_C_safe_hotelling @ K2: p_detect = 0.0000 → NOT-EXECUTABLE (delay cells for this pair are not quoted)
- **G3 (Ville extends to T = 3000): HELD** — 0 of 18 cells above α + 3 se.
  - pass family_A_betting_e_process N1 α=0.05: p_alarm_T = 0.0350 (bound 0.0646)
  - pass family_A_betting_e_process N1 α=0.01: p_alarm_T = 0.0070 (bound 0.0167)
  - pass family_A_betting_e_process N3-p03 α=0.05: p_alarm_T = 0.0360 (bound 0.0646)
  - pass family_A_betting_e_process N3-p03 α=0.01: p_alarm_T = 0.0060 (bound 0.0167)
  - pass family_A_betting_e_process N3-p06 α=0.05: p_alarm_T = 0.0360 (bound 0.0646)
  - pass family_A_betting_e_process N3-p06 α=0.01: p_alarm_T = 0.0060 (bound 0.0167)
  - pass family_A_betting_e_process N3-p09 α=0.05: p_alarm_T = 0.0325 (bound 0.0646)
  - pass family_A_betting_e_process N3-p09 α=0.01: p_alarm_T = 0.0070 (bound 0.0167)
  - pass family_A_mixture_supermartingale N1 α=0.05: p_alarm_T = 0.0225 (bound 0.0646)
  - pass family_A_mixture_supermartingale N1 α=0.01: p_alarm_T = 0.0040 (bound 0.0167)
  - pass family_A_mixture_supermartingale N3-p03 α=0.05: p_alarm_T = 0.0160 (bound 0.0646)
  - pass family_A_mixture_supermartingale N3-p03 α=0.01: p_alarm_T = 0.0020 (bound 0.0167)
  - pass family_A_mixture_supermartingale N3-p06 α=0.05: p_alarm_T = 0.0015 (bound 0.0646)
  - pass family_A_mixture_supermartingale N3-p06 α=0.01: p_alarm_T = 0.0005 (bound 0.0167)
  - pass family_A_mixture_supermartingale N3-p09 α=0.05: p_alarm_T = 0.0000 (bound 0.0646)
  - pass family_A_mixture_supermartingale N3-p09 α=0.01: p_alarm_T = 0.0000 (bound 0.0167)
  - pass family_C_safe_hotelling N1 α=0.05: p_alarm_T = 0.0275 (bound 0.0646)
  - pass family_C_safe_hotelling N1 α=0.01: p_alarm_T = 0.0070 (bound 0.0167)

## Arm A — ARL₀ (T-censored, T = 3000)

| detector | null | α | p_alarm_300 | p_alarm_T | arl0_T | median N* | exc |
|---|---|---|---|---|---|---|---|
| family_D_spectral_e_detector | N1 | 0.05 | 0.0005 | 0.0995 | 2854.2 | > 3000 | 0 |
| family_D_spectral_e_detector | N1 | 0.01 | 0.0000 | 0.0340 | 2963.0 | > 3000 | 0 |
| family_D_spectral_e_detector | N1 | 0.0001 | 0.0000 | 0.0010 | 2999.5 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m30 | 0.05 | 0.0000 | 0.0970 | 2857.0 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m30 | 0.01 | 0.0000 | 0.0350 | 2964.5 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m30 | 0.0001 | 0.0000 | 0.0020 | 2999.0 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m100 | 0.05 | 0.0005 | 0.0955 | 2857.8 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m100 | 0.01 | 0.0000 | 0.0375 | 2963.1 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m100 | 0.0001 | 0.0000 | 0.0020 | 2999.7 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m500 | 0.05 | 0.0005 | 0.0840 | 2872.4 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m500 | 0.01 | 0.0000 | 0.0350 | 2964.3 | > 3000 | 0 |
| family_D_spectral_e_detector | N2-m500 | 0.0001 | 0.0000 | 0.0020 | 2998.9 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p03 | 0.05 | 0.0005 | 0.0975 | 2857.6 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p03 | 0.01 | 0.0000 | 0.0370 | 2958.7 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p03 | 0.0001 | 0.0000 | 0.0025 | 2998.5 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p06 | 0.05 | 0.0020 | 0.0950 | 2858.9 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p06 | 0.01 | 0.0000 | 0.0335 | 2961.5 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p06 | 0.0001 | 0.0000 | 0.0025 | 2998.4 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p09 | 0.05 | 0.0000 | 0.0830 | 2878.8 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p09 | 0.01 | 0.0000 | 0.0295 | 2965.3 | > 3000 | 0 |
| family_D_spectral_e_detector | N3-p09 | 0.0001 | 0.0000 | 0.0015 | 2998.9 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p06-m100 | 0.05 | 0.0000 | 0.0810 | 2879.3 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p06-m100 | 0.01 | 0.0000 | 0.0320 | 2965.0 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p06-m100 | 0.0001 | 0.0000 | 0.0005 | 2999.9 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p09-m100 | 0.05 | 0.0000 | 0.0855 | 2877.1 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p09-m100 | 0.01 | 0.0000 | 0.0280 | 2968.8 | > 3000 | 0 |
| family_D_spectral_e_detector | N4-p09-m100 | 0.0001 | 0.0000 | 0.0025 | 2998.4 | > 3000 | 0 |
| family_D_spectral_e_detector | N5 | 0.05 | 0.0020 | 0.1010 | 2846.8 | > 3000 | 0 |
| family_D_spectral_e_detector | N5 | 0.01 | 0.0000 | 0.0435 | 2956.2 | > 3000 | 0 |
| family_D_spectral_e_detector | N5 | 0.0001 | 0.0000 | 0.0005 | 2999.9 | > 3000 | 0 |
| family_D_spectral_e_detector | N6 | 0.05 | 0.0010 | 0.1055 | 2847.7 | > 3000 | 0 |
| family_D_spectral_e_detector | N6 | 0.01 | 0.0000 | 0.0380 | 2954.7 | > 3000 | 0 |
| family_D_spectral_e_detector | N6 | 0.0001 | 0.0000 | 0.0030 | 2998.1 | > 3000 | 0 |
| family_D_spectral_e_detector | N7 | 0.05 | 0.5760 | 0.6445 | 1163.7 | 158 | 0 |
| family_D_spectral_e_detector | N7 | 0.01 | 0.5025 | 0.5895 | 1341.2 | 297 | 0 |
| family_D_spectral_e_detector | N7 | 0.0001 | 0.3280 | 0.4585 | 1765.8 | > 3000 | 0 |
| family_D_spectral_e_detector | N8 | 0.05 | 0.0000 | 0.0820 | 2885.5 | > 3000 | 0 |
| family_D_spectral_e_detector | N8 | 0.01 | 0.0000 | 0.0275 | 2971.3 | > 3000 | 0 |
| family_D_spectral_e_detector | N8 | 0.0001 | 0.0000 | 0.0005 | 2999.6 | > 3000 | 0 |
| family_A_betting_e_process | N1 | 0.05 | 0.0310 | 0.0350 | 2899.7 | > 3000 | 0 |
| family_A_betting_e_process | N1 | 0.01 | 0.0055 | 0.0070 | 2980.2 | > 3000 | 0 |
| family_A_betting_e_process | N1 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N2-m30 | 0.05 | 0.4020 | 0.7500 | 1173.4 | 545 | 0 |
| family_A_betting_e_process | N2-m30 | 0.01 | 0.3125 | 0.7020 | 1352.9 | 809 | 0 |
| family_A_betting_e_process | N2-m30 | 0.0001 | 0.1725 | 0.6260 | 1657.7 | 1425 | 0 |
| family_A_betting_e_process | N2-m100 | 0.05 | 0.1855 | 0.5650 | 1781.9 | 1970 | 0 |
| family_A_betting_e_process | N2-m100 | 0.01 | 0.1050 | 0.4985 | 2024.6 | > 3000 | 0 |
| family_A_betting_e_process | N2-m100 | 0.0001 | 0.0275 | 0.3870 | 2360.7 | > 3000 | 0 |
| family_A_betting_e_process | N2-m500 | 0.05 | 0.0640 | 0.2355 | 2563.3 | > 3000 | 0 |
| family_A_betting_e_process | N2-m500 | 0.01 | 0.0170 | 0.1565 | 2771.9 | > 3000 | 0 |
| family_A_betting_e_process | N2-m500 | 0.0001 | 0.0010 | 0.0570 | 2931.8 | > 3000 | 0 |
| family_A_betting_e_process | N3-p03 | 0.05 | 0.0315 | 0.0360 | 2897.5 | > 3000 | 0 |
| family_A_betting_e_process | N3-p03 | 0.01 | 0.0050 | 0.0060 | 2982.8 | > 3000 | 0 |
| family_A_betting_e_process | N3-p03 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N3-p06 | 0.05 | 0.0310 | 0.0360 | 2898.0 | > 3000 | 0 |
| family_A_betting_e_process | N3-p06 | 0.01 | 0.0045 | 0.0060 | 2983.9 | > 3000 | 0 |
| family_A_betting_e_process | N3-p06 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N3-p09 | 0.05 | 0.0220 | 0.0325 | 2913.4 | > 3000 | 0 |
| family_A_betting_e_process | N3-p09 | 0.01 | 0.0015 | 0.0070 | 2982.8 | > 3000 | 0 |
| family_A_betting_e_process | N3-p09 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N4-p06-m100 | 0.05 | 0.2505 | 0.6060 | 1623.1 | 1454 | 0 |
| family_A_betting_e_process | N4-p06-m100 | 0.01 | 0.1575 | 0.5415 | 1864.4 | 2343 | 0 |
| family_A_betting_e_process | N4-p06-m100 | 0.0001 | 0.0490 | 0.4240 | 2260.2 | > 3000 | 0 |
| family_A_betting_e_process | N4-p09-m100 | 0.05 | 0.3965 | 0.7255 | 1229.8 | 537 | 0 |
| family_A_betting_e_process | N4-p09-m100 | 0.01 | 0.2870 | 0.6565 | 1481.9 | 1038 | 0 |
| family_A_betting_e_process | N4-p09-m100 | 0.0001 | 0.1225 | 0.5450 | 1874.5 | 2317 | 0 |
| family_A_betting_e_process | N5 | 0.05 | 0.0465 | 0.0765 | 2823.7 | > 3000 | 0 |
| family_A_betting_e_process | N5 | 0.01 | 0.0100 | 0.0185 | 2962.1 | > 3000 | 0 |
| family_A_betting_e_process | N5 | 0.0001 | 0.0000 | 0.0010 | 2999.3 | > 3000 | 0 |
| family_A_betting_e_process | N6 | 0.05 | 0.0315 | 0.0360 | 2899.1 | > 3000 | 0 |
| family_A_betting_e_process | N6 | 0.01 | 0.0075 | 0.0085 | 2976.2 | > 3000 | 0 |
| family_A_betting_e_process | N6 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N7 | 0.05 | 0.0310 | 0.0350 | 2899.7 | > 3000 | 0 |
| family_A_betting_e_process | N7 | 0.01 | 0.0055 | 0.0070 | 2980.2 | > 3000 | 0 |
| family_A_betting_e_process | N7 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_betting_e_process | N8 | 0.05 | 0.0155 | 0.0250 | 2936.2 | > 3000 | 0 |
| family_A_betting_e_process | N8 | 0.01 | 0.0040 | 0.0075 | 2982.9 | > 3000 | 0 |
| family_A_betting_e_process | N8 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N1 | 0.05 | 0.0195 | 0.0225 | 2935.6 | > 3000 | 0 |
| family_A_mixture_supermartingale | N1 | 0.01 | 0.0035 | 0.0040 | 2988.4 | > 3000 | 0 |
| family_A_mixture_supermartingale | N1 | 0.0001 | 0.0005 | 0.0005 | 2998.5 | > 3000 | 0 |
| family_A_mixture_supermartingale | N2-m30 | 0.05 | 0.4270 | 0.7690 | 1100.4 | 444 | 0 |
| family_A_mixture_supermartingale | N2-m30 | 0.01 | 0.3325 | 0.7165 | 1282.4 | 701 | 0 |
| family_A_mixture_supermartingale | N2-m30 | 0.0001 | 0.2025 | 0.6510 | 1576.4 | 1294 | 0 |
| family_A_mixture_supermartingale | N2-m100 | 0.05 | 0.1770 | 0.5750 | 1783.6 | 2007 | 0 |
| family_A_mixture_supermartingale | N2-m100 | 0.01 | 0.0970 | 0.5045 | 2013.8 | 2962 | 0 |
| family_A_mixture_supermartingale | N2-m100 | 0.0001 | 0.0290 | 0.3990 | 2353.2 | > 3000 | 0 |
| family_A_mixture_supermartingale | N2-m500 | 0.05 | 0.0510 | 0.2245 | 2602.2 | > 3000 | 0 |
| family_A_mixture_supermartingale | N2-m500 | 0.01 | 0.0145 | 0.1575 | 2780.9 | > 3000 | 0 |
| family_A_mixture_supermartingale | N2-m500 | 0.0001 | 0.0010 | 0.0585 | 2932.2 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p03 | 0.05 | 0.0145 | 0.0160 | 2953.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p03 | 0.01 | 0.0020 | 0.0020 | 2994.1 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p03 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p06 | 0.05 | 0.0015 | 0.0015 | 2995.6 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p06 | 0.01 | 0.0005 | 0.0005 | 2998.5 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p06 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p09 | 0.05 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p09 | 0.01 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N3-p09 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p06-m100 | 0.05 | 0.1275 | 0.4895 | 2020.4 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p06-m100 | 0.01 | 0.0750 | 0.4240 | 2202.7 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p06-m100 | 0.0001 | 0.0240 | 0.3145 | 2489.2 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p09-m100 | 0.05 | 0.0960 | 0.3645 | 2287.1 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p09-m100 | 0.01 | 0.0680 | 0.3165 | 2418.1 | > 3000 | 0 |
| family_A_mixture_supermartingale | N4-p09-m100 | 0.0001 | 0.0340 | 0.2270 | 2610.1 | > 3000 | 0 |
| family_A_mixture_supermartingale | N5 | 0.05 | 0.0625 | 0.0640 | 2810.6 | > 3000 | 0 |
| family_A_mixture_supermartingale | N5 | 0.01 | 0.0330 | 0.0330 | 2901.7 | > 3000 | 0 |
| family_A_mixture_supermartingale | N5 | 0.0001 | 0.0065 | 0.0065 | 2980.5 | > 3000 | 0 |
| family_A_mixture_supermartingale | N6 | 0.05 | 0.0480 | 0.0535 | 2847.0 | > 3000 | 0 |
| family_A_mixture_supermartingale | N6 | 0.01 | 0.0255 | 0.0270 | 2921.4 | > 3000 | 0 |
| family_A_mixture_supermartingale | N6 | 0.0001 | 0.0075 | 0.0085 | 2975.4 | > 3000 | 0 |
| family_A_mixture_supermartingale | N7 | 0.05 | 0.0195 | 0.0225 | 2935.6 | > 3000 | 0 |
| family_A_mixture_supermartingale | N7 | 0.01 | 0.0035 | 0.0040 | 2988.4 | > 3000 | 0 |
| family_A_mixture_supermartingale | N7 | 0.0001 | 0.0005 | 0.0005 | 2998.5 | > 3000 | 0 |
| family_A_mixture_supermartingale | N8 | 0.05 | 0.0095 | 0.0100 | 2970.3 | > 3000 | 0 |
| family_A_mixture_supermartingale | N8 | 0.01 | 0.0065 | 0.0065 | 2980.5 | > 3000 | 0 |
| family_A_mixture_supermartingale | N8 | 0.0001 | 0.0015 | 0.0015 | 2995.5 | > 3000 | 0 |
| family_C_safe_hotelling | N1 | 0.05 | 0.0275 | 0.0275 | 2917.9 | > 3000 | 0 |
| family_C_safe_hotelling | N1 | 0.01 | 0.0070 | 0.0070 | 2979.1 | > 3000 | 0 |
| family_C_safe_hotelling | N1 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m30 | 0.05 | 0.2495 | 0.2670 | 2225.1 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m30 | 0.01 | 0.2080 | 0.2310 | 2338.9 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m30 | 0.0001 | 0.1565 | 0.1965 | 2459.8 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m100 | 0.05 | 0.1030 | 0.1055 | 2689.5 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m100 | 0.01 | 0.0660 | 0.0690 | 2800.3 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m100 | 0.0001 | 0.0290 | 0.0370 | 2899.9 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m500 | 0.05 | 0.0320 | 0.0320 | 2904.5 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m500 | 0.01 | 0.0095 | 0.0095 | 2971.7 | > 3000 | 0 |
| family_C_safe_hotelling | N2-m500 | 0.0001 | 0.0005 | 0.0005 | 2998.6 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p03 | 0.05 | 0.0435 | 0.0435 | 2870.3 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p03 | 0.01 | 0.0165 | 0.0165 | 2950.9 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p03 | 0.0001 | 0.0010 | 0.0010 | 2997.0 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p06 | 0.05 | 0.1295 | 0.1295 | 2613.8 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p06 | 0.01 | 0.0625 | 0.0625 | 2814.0 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p06 | 0.0001 | 0.0130 | 0.0130 | 2961.5 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p09 | 0.05 | 0.3800 | 0.3830 | 1866.2 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p09 | 0.01 | 0.3160 | 0.3200 | 2055.7 | > 3000 | 0 |
| family_C_safe_hotelling | N3-p09 | 0.0001 | 0.1945 | 0.1990 | 2416.0 | > 3000 | 0 |
| family_C_safe_hotelling | N4-p06-m100 | 0.05 | 0.2930 | 0.3075 | 2100.4 | > 3000 | 0 |
| family_C_safe_hotelling | N4-p06-m100 | 0.01 | 0.2380 | 0.2580 | 2255.3 | > 3000 | 0 |
| family_C_safe_hotelling | N4-p06-m100 | 0.0001 | 0.1395 | 0.1760 | 2518.8 | > 3000 | 0 |
| family_C_safe_hotelling | N4-p09-m100 | 0.05 | 0.6555 | 0.6900 | 982.3 | 50 | 0 |
| family_C_safe_hotelling | N4-p09-m100 | 0.01 | 0.6280 | 0.6675 | 1059.3 | 71 | 0 |
| family_C_safe_hotelling | N4-p09-m100 | 0.0001 | 0.5540 | 0.6130 | 1246.1 | 163 | 0 |
| family_C_safe_hotelling | N5 | 0.05 | 0.3750 | 0.3835 | 1868.1 | > 3000 | 0 |
| family_C_safe_hotelling | N5 | 0.01 | 0.3110 | 0.3210 | 2056.0 | > 3000 | 0 |
| family_C_safe_hotelling | N5 | 0.0001 | 0.2075 | 0.2180 | 2365.1 | > 3000 | 0 |
| family_C_safe_hotelling | N6 | 0.05 | 0.3015 | 0.3610 | 1984.4 | > 3000 | 0 |
| family_C_safe_hotelling | N6 | 0.01 | 0.2510 | 0.3140 | 2126.9 | > 3000 | 0 |
| family_C_safe_hotelling | N6 | 0.0001 | 0.1795 | 0.2460 | 2336.5 | > 3000 | 0 |
| family_C_safe_hotelling | N7 | 0.05 | 0.0275 | 0.0275 | 2917.9 | > 3000 | 0 |
| family_C_safe_hotelling | N7 | 0.01 | 0.0070 | 0.0070 | 2979.1 | > 3000 | 0 |
| family_C_safe_hotelling | N7 | 0.0001 | 0.0000 | 0.0000 | 3000.0 | > 3000 | 0 |
| family_C_safe_hotelling | N8 | 0.05 | 0.3620 | 0.4225 | 1803.5 | > 3000 | 0 |
| family_C_safe_hotelling | N8 | 0.01 | 0.3220 | 0.3865 | 1916.3 | > 3000 | 0 |
| family_C_safe_hotelling | N8 | 0.0001 | 0.2410 | 0.3100 | 2149.2 | > 3000 | 0 |

## Arm B — detection delay (ν = 200, T = 1000, delay censored at 800)

| detector | injection | null | α | p_pre_onset_alarm | p_detect | delay mean (cens.) | median | p90 | censored | exc |
|---|---|---|---|---|---|---|---|---|---|---|
| family_D_spectral_e_detector | K1 (cross-class) | N1 | 0.05 | 0.0005 | 0.0260 | 791.3 | > 800 | > 800 | 1947 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N1 | 0.01 | 0.0000 | 0.0030 | 799.1 | > 800 | > 800 | 1994 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N1 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m30 | 0.05 | 0.0000 | 0.0240 | 792.6 | > 800 | > 800 | 1952 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m30 | 0.01 | 0.0000 | 0.0020 | 799.4 | > 800 | > 800 | 1996 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m30 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m100 | 0.05 | 0.0000 | 0.0315 | 789.8 | > 800 | > 800 | 1937 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m100 | 0.01 | 0.0000 | 0.0050 | 799.1 | > 800 | > 800 | 1990 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m100 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m500 | 0.05 | 0.0000 | 0.0330 | 789.8 | > 800 | > 800 | 1934 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m500 | 0.01 | 0.0000 | 0.0050 | 799.2 | > 800 | > 800 | 1990 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N2-m500 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p03 | 0.05 | 0.0000 | 0.0315 | 788.6 | > 800 | > 800 | 1937 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p03 | 0.01 | 0.0000 | 0.0080 | 798.1 | > 800 | > 800 | 1984 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p03 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p06 | 0.05 | 0.0000 | 0.0420 | 786.6 | > 800 | > 800 | 1916 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p06 | 0.01 | 0.0000 | 0.0045 | 799.1 | > 800 | > 800 | 1991 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p06 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p09 | 0.05 | 0.0000 | 0.0320 | 792.4 | > 800 | > 800 | 1936 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p09 | 0.01 | 0.0000 | 0.0045 | 799.4 | > 800 | > 800 | 1991 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N3-p09 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p06-m100 | 0.05 | 0.0000 | 0.0270 | 792.7 | > 800 | > 800 | 1946 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p06-m100 | 0.01 | 0.0000 | 0.0045 | 799.2 | > 800 | > 800 | 1991 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p06-m100 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p09-m100 | 0.05 | 0.0000 | 0.0275 | 790.7 | > 800 | > 800 | 1945 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p09-m100 | 0.01 | 0.0000 | 0.0010 | 799.6 | > 800 | > 800 | 1998 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N4-p09-m100 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N5 | 0.05 | 0.0000 | 0.0320 | 790.8 | > 800 | > 800 | 1936 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N5 | 0.01 | 0.0000 | 0.0010 | 799.8 | > 800 | > 800 | 1998 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N5 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N6 | 0.05 | 0.0000 | 0.0375 | 786.2 | > 800 | > 800 | 1925 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N6 | 0.01 | 0.0000 | 0.0045 | 798.7 | > 800 | > 800 | 1991 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N6 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N7 | 0.05 | 0.5015 | 0.2317 | 663.6 | > 800 | > 800 | 766 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N7 | 0.01 | 0.4210 | 0.2349 | 662.3 | > 800 | > 800 | 886 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N7 | 0.0001 | 0.2470 | 0.2205 | 675.8 | > 800 | > 800 | 1174 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N8 | 0.05 | 0.0000 | 0.0265 | 792.8 | > 800 | > 800 | 1947 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N8 | 0.01 | 0.0000 | 0.0015 | 799.8 | > 800 | > 800 | 1997 | 0 |
| family_D_spectral_e_detector | K1 (cross-class) | N8 | 0.0001 | 0.0000 | 0.0000 | 800.0 | > 800 | > 800 | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N1 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1652 | 0 |
| family_D_spectral_e_detector | K3 | N1 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1921 | 0 |
| family_D_spectral_e_detector | K3 | N1 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N2-m30 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1626 | 0 |
| family_D_spectral_e_detector | K3 | N2-m30 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1913 | 0 |
| family_D_spectral_e_detector | K3 | N2-m30 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1999 | 0 |
| family_D_spectral_e_detector | K3 | N2-m100 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1607 | 0 |
| family_D_spectral_e_detector | K3 | N2-m100 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1908 | 0 |
| family_D_spectral_e_detector | K3 | N2-m100 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1999 | 0 |
| family_D_spectral_e_detector | K3 | N2-m500 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1633 | 0 |
| family_D_spectral_e_detector | K3 | N2-m500 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1910 | 0 |
| family_D_spectral_e_detector | K3 | N2-m500 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N3-p03 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1591 | 0 |
| family_D_spectral_e_detector | K3 | N3-p03 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1892 | 0 |
| family_D_spectral_e_detector | K3 | N3-p03 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N3-p06 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1420 | 0 |
| family_D_spectral_e_detector | K3 | N3-p06 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1826 | 0 |
| family_D_spectral_e_detector | K3 | N3-p06 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N3-p09 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1411 | 0 |
| family_D_spectral_e_detector | K3 | N3-p09 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1854 | 0 |
| family_D_spectral_e_detector | K3 | N3-p09 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N4-p06-m100 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1431 | 0 |
| family_D_spectral_e_detector | K3 | N4-p06-m100 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1815 | 0 |
| family_D_spectral_e_detector | K3 | N4-p06-m100 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1997 | 0 |
| family_D_spectral_e_detector | K3 | N4-p09-m100 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1388 | 0 |
| family_D_spectral_e_detector | K3 | N4-p09-m100 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1842 | 0 |
| family_D_spectral_e_detector | K3 | N4-p09-m100 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_D_spectral_e_detector | K3 | N5 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 922 | 0 |
| family_D_spectral_e_detector | K3 | N5 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1495 | 0 |
| family_D_spectral_e_detector | K3 | N5 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1992 | 0 |
| family_D_spectral_e_detector | K3 | N6 | 0.05 | 0.0005 | NOT-EXECUTABLE | — | — | — | 1061 | 0 |
| family_D_spectral_e_detector | K3 | N6 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1601 | 0 |
| family_D_spectral_e_detector | K3 | N6 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1992 | 0 |
| family_D_spectral_e_detector | K3 | N7 | 0.05 | 0.5060 | NOT-EXECUTABLE | — | — | — | 199 | 0 |
| family_D_spectral_e_detector | K3 | N7 | 0.01 | 0.4195 | NOT-EXECUTABLE | — | — | — | 235 | 0 |
| family_D_spectral_e_detector | K3 | N7 | 0.0001 | 0.2365 | NOT-EXECUTABLE | — | — | — | 339 | 0 |
| family_D_spectral_e_detector | K3 | N8 | 0.05 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1151 | 0 |
| family_D_spectral_e_detector | K3 | N8 | 0.01 | 0.0000 | NOT-EXECUTABLE | — | — | — | 1745 | 0 |
| family_D_spectral_e_detector | K3 | N8 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_A_betting_e_process | K1 | N1 | 0.05 | 0.0285 | 1.0000 | 41.8 | 42 | 59 | 0 | 0 |
| family_A_betting_e_process | K1 | N1 | 0.01 | 0.0050 | 1.0000 | 48.5 | 48 | 67 | 0 | 0 |
| family_A_betting_e_process | K1 | N1 | 0.0001 | 0.0000 | 1.0000 | 65.5 | 65 | 85 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m30 | 0.05 | 0.3290 | 1.0000 | 46.0 | 42 | 81 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m30 | 0.01 | 0.2335 | 1.0000 | 53.0 | 49 | 95 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m30 | 0.0001 | 0.1000 | 1.0000 | 70.9 | 66 | 125 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m100 | 0.05 | 0.1320 | 1.0000 | 44.3 | 43 | 71 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m100 | 0.01 | 0.0670 | 1.0000 | 50.4 | 49 | 80 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m100 | 0.0001 | 0.0120 | 1.0000 | 67.4 | 66 | 103 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m500 | 0.05 | 0.0535 | 1.0000 | 42.2 | 41 | 63 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m500 | 0.01 | 0.0150 | 1.0000 | 48.8 | 48 | 71 | 0 | 0 |
| family_A_betting_e_process | K1 | N2-m500 | 0.0001 | 0.0005 | 1.0000 | 66.1 | 65 | 89 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p03 | 0.05 | 0.0245 | 1.0000 | 54.4 | 54 | 78 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p03 | 0.01 | 0.0075 | 1.0000 | 63.3 | 63 | 88 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p03 | 0.0001 | 0.0000 | 1.0000 | 86.0 | 85 | 112 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p06 | 0.05 | 0.0230 | 1.0000 | 77.0 | 76 | 111 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p06 | 0.01 | 0.0060 | 1.0000 | 90.4 | 90 | 127 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p06 | 0.0001 | 0.0000 | 1.0000 | 124.9 | 125 | 166 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p09 | 0.05 | 0.0145 | 1.0000 | 171.2 | 167 | 270 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p09 | 0.01 | 0.0005 | 1.0000 | 211.9 | 208 | 317 | 0 | 0 |
| family_A_betting_e_process | K1 | N3-p09 | 0.0001 | 0.0000 | 1.0000 | 330.2 | 324 | 447 | 0 | 0 |
| family_A_betting_e_process | K1 | N4-p06-m100 | 0.05 | 0.1745 | 1.0000 | 81.2 | 73 | 145 | 0 | 0 |
| family_A_betting_e_process | K1 | N4-p06-m100 | 0.01 | 0.1030 | 1.0000 | 94.6 | 86 | 166 | 0 | 0 |
| family_A_betting_e_process | K1 | N4-p06-m100 | 0.0001 | 0.0235 | 1.0000 | 129.2 | 118 | 218 | 0 | 0 |
| family_A_betting_e_process | K1 | N4-p09-m100 | 0.05 | 0.3330 | 0.9820 | 175.0 | 123 | 384 | 24 | 0 |
| family_A_betting_e_process | K1 | N4-p09-m100 | 0.01 | 0.2090 | 0.9722 | 207.8 | 149 | 458 | 44 | 0 |
| family_A_betting_e_process | K1 | N4-p09-m100 | 0.0001 | 0.0625 | 0.9280 | 289.9 | 227 | 667 | 135 | 0 |
| family_A_betting_e_process | K1 | N5 | 0.05 | 0.0485 | 1.0000 | 53.6 | 47 | 90 | 0 | 0 |
| family_A_betting_e_process | K1 | N5 | 0.01 | 0.0135 | 1.0000 | 60.2 | 53 | 96 | 0 | 0 |
| family_A_betting_e_process | K1 | N5 | 0.0001 | 0.0000 | 1.0000 | 75.1 | 69 | 109 | 0 | 0 |
| family_A_betting_e_process | K1 | N6 | 0.05 | 0.0375 | 1.0000 | 38.7 | 37 | 59 | 0 | 0 |
| family_A_betting_e_process | K1 | N6 | 0.01 | 0.0055 | 1.0000 | 44.6 | 43 | 65 | 0 | 0 |
| family_A_betting_e_process | K1 | N6 | 0.0001 | 0.0000 | 1.0000 | 59.7 | 58 | 80 | 0 | 0 |
| family_A_betting_e_process | K1 | N7 | 0.05 | 0.0285 | 1.0000 | 41.8 | 42 | 59 | 0 | 0 |
| family_A_betting_e_process | K1 | N7 | 0.01 | 0.0050 | 1.0000 | 48.5 | 48 | 67 | 0 | 0 |
| family_A_betting_e_process | K1 | N7 | 0.0001 | 0.0000 | 1.0000 | 65.5 | 65 | 85 | 0 | 0 |
| family_A_betting_e_process | K1 | N8 | 0.05 | 0.0145 | 0.9939 | 178.7 | 157 | 286 | 12 | 0 |
| family_A_betting_e_process | K1 | N8 | 0.01 | 0.0000 | 0.9905 | 223.6 | 197 | 350 | 19 | 0 |
| family_A_betting_e_process | K1 | N8 | 0.0001 | 0.0000 | 0.9645 | 358.4 | 320 | 596 | 71 | 0 |
| family_A_mixture_supermartingale | K1 | N1 | 0.05 | 0.0220 | 1.0000 | 35.5 | 35 | 50 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N1 | 0.01 | 0.0055 | 1.0000 | 40.4 | 40 | 55 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N1 | 0.0001 | 0.0000 | 1.0000 | 52.6 | 52 | 68 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m30 | 0.05 | 0.3420 | 1.0000 | 37.7 | 34 | 69 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m30 | 0.01 | 0.2560 | 1.0000 | 42.7 | 39 | 79 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m30 | 0.0001 | 0.1320 | 1.0000 | 54.9 | 50 | 100 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m100 | 0.05 | 0.1185 | 1.0000 | 36.5 | 35 | 60 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m100 | 0.01 | 0.0695 | 1.0000 | 41.4 | 40 | 66 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m100 | 0.0001 | 0.0120 | 1.0000 | 53.6 | 52 | 83 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m500 | 0.05 | 0.0405 | 1.0000 | 35.7 | 35 | 53 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m500 | 0.01 | 0.0115 | 1.0000 | 40.7 | 40 | 59 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N2-m500 | 0.0001 | 0.0005 | 1.0000 | 52.9 | 52 | 72 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p03 | 0.05 | 0.0140 | 1.0000 | 51.8 | 51 | 73 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p03 | 0.01 | 0.0035 | 1.0000 | 59.4 | 59 | 81 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p03 | 0.0001 | 0.0000 | 1.0000 | 78.5 | 78 | 101 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p06 | 0.05 | 0.0030 | 1.0000 | 98.0 | 97 | 134 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p06 | 0.01 | 0.0000 | 1.0000 | 113.7 | 113 | 151 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p06 | 0.0001 | 0.0000 | 1.0000 | 154.5 | 154 | 197 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p09 | 0.05 | 0.0000 | 0.7285 | 683.3 | 702 | > 800 | 543 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p09 | 0.01 | 0.0000 | 0.3535 | 763.3 | > 800 | > 800 | 1293 | 0 |
| family_A_mixture_supermartingale | K1 | N3-p09 | 0.0001 | 0.0000 | 0.0040 | 799.8 | > 800 | > 800 | 1992 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p06-m100 | 0.05 | 0.0895 | 1.0000 | 103.2 | 92 | 181 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p06-m100 | 0.01 | 0.0510 | 0.9995 | 118.4 | 105 | 209 | 1 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p06-m100 | 0.0001 | 0.0110 | 0.9995 | 157.4 | 139 | 274 | 1 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p09-m100 | 0.05 | 0.0725 | 0.7477 | 432.9 | 368 | > 800 | 468 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p09-m100 | 0.01 | 0.0470 | 0.6988 | 470.8 | 440 | > 800 | 574 | 0 |
| family_A_mixture_supermartingale | K1 | N4-p09-m100 | 0.0001 | 0.0205 | 0.5870 | 544.9 | 612 | > 800 | 809 | 0 |
| family_A_mixture_supermartingale | K1 | N5 | 0.05 | 0.0540 | 1.0000 | 36.0 | 36 | 49 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N5 | 0.01 | 0.0235 | 1.0000 | 40.8 | 41 | 54 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N5 | 0.0001 | 0.0040 | 1.0000 | 52.9 | 53 | 68 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N6 | 0.05 | 0.0475 | 1.0000 | 35.1 | 35 | 49 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N6 | 0.01 | 0.0220 | 1.0000 | 40.1 | 40 | 55 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N6 | 0.0001 | 0.0100 | 1.0000 | 52.3 | 52 | 68 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N7 | 0.05 | 0.0220 | 1.0000 | 35.5 | 35 | 50 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N7 | 0.01 | 0.0055 | 1.0000 | 40.4 | 40 | 55 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N7 | 0.0001 | 0.0000 | 1.0000 | 52.6 | 52 | 68 | 0 | 0 |
| family_A_mixture_supermartingale | K1 | N8 | 0.05 | 0.0110 | 0.7386 | 685.8 | 704 | > 800 | 517 | 0 |
| family_A_mixture_supermartingale | K1 | N8 | 0.01 | 0.0070 | 0.3570 | 764.1 | > 800 | > 800 | 1277 | 0 |
| family_A_mixture_supermartingale | K1 | N8 | 0.0001 | 0.0025 | 0.0015 | 800.0 | > 800 | > 800 | 1992 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N1 | 0.05 | 0.0230 | 1.0000 | 45.9 | 45 | 62 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N1 | 0.01 | 0.0035 | 1.0000 | 47.5 | 47 | 63 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N1 | 0.0001 | 0.0000 | 1.0000 | 52.4 | 52 | 68 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m30 | 0.05 | 0.2400 | 1.0000 | 64.0 | 48 | 131 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m30 | 0.01 | 0.1945 | 1.0000 | 63.2 | 47 | 131 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m30 | 0.0001 | 0.1430 | 1.0000 | 65.2 | 49 | 138 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m100 | 0.05 | 0.0875 | 1.0000 | 49.9 | 45 | 87 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m100 | 0.01 | 0.0490 | 1.0000 | 50.4 | 45 | 88 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m100 | 0.0001 | 0.0165 | 1.0000 | 54.1 | 49 | 94 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m500 | 0.05 | 0.0345 | 1.0000 | 46.5 | 45 | 67 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m500 | 0.01 | 0.0110 | 1.0000 | 47.8 | 46 | 70 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N2-m500 | 0.0001 | 0.0000 | 1.0000 | 52.6 | 51 | 75 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p03 | 0.05 | 0.0370 | 1.0000 | 46.5 | 45 | 66 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p03 | 0.01 | 0.0095 | 1.0000 | 48.1 | 47 | 68 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p03 | 0.0001 | 0.0010 | 1.0000 | 52.9 | 52 | 72 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p06 | 0.05 | 0.1095 | 1.0000 | 48.5 | 46 | 74 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p06 | 0.01 | 0.0530 | 1.0000 | 49.9 | 48 | 76 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p06 | 0.0001 | 0.0085 | 1.0000 | 54.3 | 52 | 82 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p09 | 0.05 | 0.3455 | 1.0000 | 64.5 | 56 | 121 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p09 | 0.01 | 0.2835 | 1.0000 | 65.9 | 57 | 123 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N3-p09 | 0.0001 | 0.1575 | 1.0000 | 68.3 | 59 | 127 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p06-m100 | 0.05 | 0.2745 | 1.0000 | 58.5 | 48 | 112 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p06-m100 | 0.01 | 0.2045 | 0.9994 | 58.0 | 48 | 111 | 1 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p06-m100 | 0.0001 | 0.1155 | 0.9994 | 59.5 | 49 | 115 | 1 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p09-m100 | 0.05 | 0.6185 | 0.9751 | 112.8 | 63 | 249 | 19 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p09-m100 | 0.01 | 0.5755 | 0.9764 | 110.2 | 62 | 249 | 20 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N4-p09-m100 | 0.0001 | 0.4945 | 0.9802 | 104.2 | 58 | 239 | 20 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N5 | 0.05 | 0.3540 | 1.0000 | 59.0 | 57 | 93 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N5 | 0.01 | 0.3015 | 1.0000 | 59.7 | 58 | 94 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N5 | 0.0001 | 0.1955 | 1.0000 | 63.2 | 62 | 99 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N6 | 0.05 | 0.3005 | 1.0000 | 65.0 | 66 | 93 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N6 | 0.01 | 0.2475 | 1.0000 | 66.1 | 67 | 94 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N6 | 0.0001 | 0.1715 | 1.0000 | 69.8 | 71 | 99 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N7 | 0.05 | 0.0230 | 1.0000 | 45.9 | 45 | 62 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N7 | 0.01 | 0.0035 | 1.0000 | 47.5 | 47 | 63 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N7 | 0.0001 | 0.0000 | 1.0000 | 52.4 | 52 | 68 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N8 | 0.05 | 0.3650 | 1.0000 | 79.7 | 71 | 144 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N8 | 0.01 | 0.3225 | 1.0000 | 80.2 | 71 | 145 | 0 | 0 |
| family_C_safe_hotelling | K1 (cross-class) | N8 | 0.0001 | 0.2370 | 1.0000 | 83.0 | 74 | 150 | 0 | 0 |
| family_C_safe_hotelling | K2 | N1 | 0.05 | 0.0205 | NOT-EXECUTABLE | — | — | — | 1959 | 0 |
| family_C_safe_hotelling | K2 | N1 | 0.01 | 0.0045 | NOT-EXECUTABLE | — | — | — | 1991 | 0 |
| family_C_safe_hotelling | K2 | N1 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_C_safe_hotelling | K2 | N2-m30 | 0.05 | 0.2390 | NOT-EXECUTABLE | — | — | — | 1251 | 0 |
| family_C_safe_hotelling | K2 | N2-m30 | 0.01 | 0.2000 | NOT-EXECUTABLE | — | — | — | 1278 | 0 |
| family_C_safe_hotelling | K2 | N2-m30 | 0.0001 | 0.1500 | NOT-EXECUTABLE | — | — | — | 1294 | 0 |
| family_C_safe_hotelling | K2 | N2-m100 | 0.05 | 0.0995 | NOT-EXECUTABLE | — | — | — | 1555 | 0 |
| family_C_safe_hotelling | K2 | N2-m100 | 0.01 | 0.0500 | NOT-EXECUTABLE | — | — | — | 1602 | 0 |
| family_C_safe_hotelling | K2 | N2-m100 | 0.0001 | 0.0160 | NOT-EXECUTABLE | — | — | — | 1637 | 0 |
| family_C_safe_hotelling | K2 | N2-m500 | 0.05 | 0.0375 | NOT-EXECUTABLE | — | — | — | 1880 | 0 |
| family_C_safe_hotelling | K2 | N2-m500 | 0.01 | 0.0095 | NOT-EXECUTABLE | — | — | — | 1938 | 0 |
| family_C_safe_hotelling | K2 | N2-m500 | 0.0001 | 0.0005 | NOT-EXECUTABLE | — | — | — | 1968 | 0 |
| family_C_safe_hotelling | K2 | N3-p03 | 0.05 | 0.0490 | NOT-EXECUTABLE | — | — | — | 1902 | 0 |
| family_C_safe_hotelling | K2 | N3-p03 | 0.01 | 0.0115 | NOT-EXECUTABLE | — | — | — | 1977 | 0 |
| family_C_safe_hotelling | K2 | N3-p03 | 0.0001 | 0.0010 | NOT-EXECUTABLE | — | — | — | 1998 | 0 |
| family_C_safe_hotelling | K2 | N3-p06 | 0.05 | 0.1235 | NOT-EXECUTABLE | — | — | — | 1729 | 0 |
| family_C_safe_hotelling | K2 | N3-p06 | 0.01 | 0.0600 | NOT-EXECUTABLE | — | — | — | 1860 | 0 |
| family_C_safe_hotelling | K2 | N3-p06 | 0.0001 | 0.0130 | NOT-EXECUTABLE | — | — | — | 1963 | 0 |
| family_C_safe_hotelling | K2 | N3-p09 | 0.05 | 0.3455 | NOT-EXECUTABLE | — | — | — | 1046 | 0 |
| family_C_safe_hotelling | K2 | N3-p09 | 0.01 | 0.2840 | NOT-EXECUTABLE | — | — | — | 1153 | 0 |
| family_C_safe_hotelling | K2 | N3-p09 | 0.0001 | 0.1785 | NOT-EXECUTABLE | — | — | — | 1338 | 0 |
| family_C_safe_hotelling | K2 | N4-p06-m100 | 0.05 | 0.2815 | NOT-EXECUTABLE | — | — | — | 1141 | 0 |
| family_C_safe_hotelling | K2 | N4-p06-m100 | 0.01 | 0.2195 | NOT-EXECUTABLE | — | — | — | 1191 | 0 |
| family_C_safe_hotelling | K2 | N4-p06-m100 | 0.0001 | 0.1250 | NOT-EXECUTABLE | — | — | — | 1275 | 0 |
| family_C_safe_hotelling | K2 | N4-p09-m100 | 0.05 | 0.6280 | NOT-EXECUTABLE | — | — | — | 475 | 0 |
| family_C_safe_hotelling | K2 | N4-p09-m100 | 0.01 | 0.5945 | NOT-EXECUTABLE | — | — | — | 509 | 0 |
| family_C_safe_hotelling | K2 | N4-p09-m100 | 0.0001 | 0.5115 | NOT-EXECUTABLE | — | — | — | 575 | 0 |
| family_C_safe_hotelling | K2 | N5 | 0.05 | 0.3640 | NOT-EXECUTABLE | — | — | — | 1088 | 0 |
| family_C_safe_hotelling | K2 | N5 | 0.01 | 0.3075 | NOT-EXECUTABLE | — | — | — | 1197 | 0 |
| family_C_safe_hotelling | K2 | N5 | 0.0001 | 0.1990 | NOT-EXECUTABLE | — | — | — | 1387 | 0 |
| family_C_safe_hotelling | K2 | N6 | 0.05 | 0.2800 | NOT-EXECUTABLE | — | — | — | 1256 | 0 |
| family_C_safe_hotelling | K2 | N6 | 0.01 | 0.2340 | NOT-EXECUTABLE | — | — | — | 1342 | 0 |
| family_C_safe_hotelling | K2 | N6 | 0.0001 | 0.1675 | NOT-EXECUTABLE | — | — | — | 1464 | 0 |
| family_C_safe_hotelling | K2 | N7 | 0.05 | 0.0205 | NOT-EXECUTABLE | — | — | — | 1959 | 0 |
| family_C_safe_hotelling | K2 | N7 | 0.01 | 0.0045 | NOT-EXECUTABLE | — | — | — | 1991 | 0 |
| family_C_safe_hotelling | K2 | N7 | 0.0001 | 0.0000 | NOT-EXECUTABLE | — | — | — | 2000 | 0 |
| family_C_safe_hotelling | K2 | N8 | 0.05 | 0.3685 | NOT-EXECUTABLE | — | — | — | 1017 | 0 |
| family_C_safe_hotelling | K2 | N8 | 0.01 | 0.3200 | NOT-EXECUTABLE | — | — | — | 1091 | 0 |
| family_C_safe_hotelling | K2 | N8 | 0.0001 | 0.2315 | NOT-EXECUTABLE | — | — | — | 1235 | 0 |

## Not measured

- NOT DEFINED (terminal class, no run length): safe_t_e_value, universal_inference_e_value.
- MISSING (no battery adapter): group_average_e_value, point_tail_bet_e_value, spectral_bet_e_process, shape_block_conformal_bet, shape_ecdf_accumulator, sequential_mmd_betting_e_process, family_E_conformal, family_E_conformal_heldout, sequential_ui_e_process.
  - safe_t_e_value: Fixed-window terminal e-value, not a sequential wealth process. P1 is a sup-crossing endpoint and is undefined for it. Needs a separate terminal-E[e] study.
  - universal_inference_e_value: Same: fixed split, terminal e-value (engine ADR 0010).
  - sequential_ui_e_process: Has a wealth process, but its interface consumes a whole prefix per tick (O(T^2)); driving it needs a different adapter shape. Deferred, not excluded on principle.
  - family_C_mmd_betting: Requires a compiled baseline pool (baseline_rff_mean or a synthesized P-side pool) that this harness does not build. The non-Gaussian-null cell registered in PREREGISTRATION §3 needs that pool and is deferred with it.
  - family_E_conformal: The default compiler path emits the `unweighted` kind, which has no wealth process. PREREGISTRATION §3 says report that rather than score it. The forced weighted_e_value kind needs a 20k-draw calibration bundle this harness does not build.
- T1 only; one onset ν; Lorden/Pollak worst-case delays not estimated; α = 1e-4 cells cannot resolve 1/α = 10,000 at T = 3,000.

Wall time 384s.
