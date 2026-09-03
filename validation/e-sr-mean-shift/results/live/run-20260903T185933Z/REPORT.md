# 2026-09-e-sr-delay — run run-20260903T185933Z

Engine `0.6.10-pre` at `756a0adc8c907be70d9b2de280d3652744f11d19`; node v25.9.0; mode live. N = 2000.
Registration sha256 `698bdb682500` (with Amendment A1); module sha256 `23802080fc3d`; harness sha256 `edd50c9be3b1`.

**Verdicts:** H1 HELD · H2 HELD · H3 HELD · H4 FAILED · H5 HELD

## H1 — ARL at oracle parameters (claimed cells)

| null | α_ARL | T | p_alarm_T | arl0_T | 1/α | median N* | verdict |
|---|---|---|---|---|---|---|---|
| N1 | 0.01 | 2000 | 1.0000 | 177.2 | 100 | 137 | pass |
| N1 | 0.001 | 20000 | 1.0000 | 1793.0 | 1000 | 1259 | pass |
| N3-p03 | 0.01 | 2000 | 1.0000 | 176.9 | 100 | 136 | pass |
| N3-p03 | 0.001 | 20000 | 1.0000 | 1794.9 | 1000 | 1259 | pass |
| N3-p06 | 0.01 | 2000 | 1.0000 | 176.6 | 100 | 136 | pass |
| N3-p06 | 0.001 | 20000 | 1.0000 | 1793.4 | 1000 | 1258 | pass |
| N3-p09 | 0.01 | 2000 | 1.0000 | 158.6 | 100 | 121 | pass |
| N3-p09 | 0.001 | 20000 | 1.0000 | 1703.5 | 1000 | 1197 | pass |

Reported (no claim: N5/N6 outside the sub-Gaussian class; α = 1e-4 censored at T = 20,000):

| null | α | T | p_alarm_T | arl0_T | median N* |
|---|---|---|---|---|---|
| N1 | 0.0001 | 20000 | 0.6965 | 11715.8 | 11571 |
| N3-p03 | 0.0001 | 20000 | 0.6965 | 11715.1 | 11570 |
| N3-p06 | 0.0001 | 20000 | 0.6965 | 11715.1 | 11570 |
| N3-p09 | 0.0001 | 20000 | 0.7020 | 11531.1 | 11326 |
| N5 | 0.01 | 2000 | 1.0000 | 77.2 | 55 |
| N5 | 0.001 | 20000 | 1.0000 | 148.4 | 105 |
| N5 | 0.0001 | 20000 | 1.0000 | 245.3 | 172 |
| N6 | 0.01 | 2000 | 1.0000 | 105.6 | 80 |
| N6 | 0.001 | 20000 | 1.0000 | 213.8 | 147 |
| N6 | 0.0001 | 20000 | 1.0000 | 370.8 | 245 |

## H2 — delay against the onset time (N1, +1.5σ, censored at 800)

| detector | ν | α | p_pre_onset_alarm | p_detect | delay mean | median | p90 |
|---|---|---|---|---|---|---|---|
| e_sr_mean_shift | 200 | 0.001 | 0.0825 | 1.0000 | 7.0 | 7 | 11 |
| family_A_betting_e_process | 200 | 0.001 | 0.0010 | 1.0000 | 56.9 | 56 | 75 |
| family_A_mixture_supermartingale | 200 | 0.001 | 0.0005 | 1.0000 | 46.6 | 46 | 62 |
| e_sr_mean_shift | 200 | 0.0001 | 0.0060 | 1.0000 | 9.3 | 9 | 14 |
| family_A_betting_e_process | 200 | 0.0001 | 0.0000 | 1.0000 | 65.2 | 64 | 84 |
| family_A_mixture_supermartingale | 200 | 0.0001 | 0.0000 | 1.0000 | 52.4 | 52 | 68 |
| e_sr_mean_shift | 1000 | 0.001 | 0.4200 | 1.0000 | 6.9 | 7 | 11 |
| family_A_betting_e_process | 1000 | 0.001 | 0.0010 | 1.0000 | 113.9 | 114 | 149 |
| family_A_mixture_supermartingale | 1000 | 0.001 | 0.0005 | 1.0000 | 102.0 | 102 | 132 |
| e_sr_mean_shift | 1000 | 0.0001 | 0.0410 | 1.0000 | 9.2 | 9 | 14 |
| family_A_betting_e_process | 1000 | 0.0001 | 0.0000 | 1.0000 | 127.5 | 127 | 163 |
| family_A_mixture_supermartingale | 1000 | 0.0001 | 0.0000 | 1.0000 | 113.1 | 113 | 143 |
| e_sr_mean_shift | 2000 | 0.001 | 0.6775 | 1.0000 | 6.9 | 7 | 11 |
| family_A_betting_e_process | 2000 | 0.001 | 0.0010 | 1.0000 | 156.9 | 156 | 203 |
| family_A_mixture_supermartingale | 2000 | 0.001 | 0.0005 | 1.0000 | 143.9 | 144 | 185 |
| e_sr_mean_shift | 2000 | 0.0001 | 0.0975 | 1.0000 | 9.2 | 9 | 14 |
| family_A_betting_e_process | 2000 | 0.0001 | 0.0000 | 1.0000 | 174.9 | 174 | 221 |
| family_A_mixture_supermartingale | 2000 | 0.0001 | 0.0000 | 1.0000 | 159.1 | 159 | 201 |

- (a) e-SR at ν = 2,000 (6.9) ≤ 1.5 × e-SR at ν = 200 (7.0): pass
- (b) e-SR at ν = 2,000 (6.9) ≤ 0.5 × mixture at ν = 2,000 (143.9): pass

## H3 — delay at canonical against the Theorem 4.3 bound (N1, ν = 200, α_ARL = 1e-3)

| δ | p_pre_onset_alarm | p_detect | delay mean | median | p90 | g_α | bound | verdict |
|---|---|---|---|---|---|---|---|---|
| 0.75σ | 0.0860 | 1.0000 | 20.8 | 19 | 34 | 11.54 | 49.1 | pass |
| 1.5σ | 0.0860 | 1.0000 | 7.0 | 7 | 11 | 11.54 | 13.0 | pass |
| 3σ | 0.0860 | 1.0000 | 2.5 | 2 | 4 | 11.54 | 4.0 | pass |

## H4 — the estimation price (α_ARL = 1e-3, T = 20,000)

| null | p_alarm_T | arl0_T | median N* |
|---|---|---|---|
| N2-m30 | 0.9825 | 1128.4 | 173 |
| N2-m100 | 0.9895 | 1509.1 | 464 |
| N2-m500 | 1.0000 | 1587.2 | 868 |

- (a) monotone in m: pass; (b) arl0 at m = 30 (1128.4) < 1,000: FAIL

## H5 — structural (Amendment A1)

- H5a increment estimator per λ over 2000000 (trajectory, tick) pairs: HELD

| λ | mean L | se | |mean−1|/se |
|---|---|---|---|
| 0.2500 | 0.99999 | 1.80e-4 | 0.08 |
| -0.2500 | 1.00004 | 1.80e-4 | 0.20 |
| 0.3565 | 0.99999 | 2.61e-4 | 0.02 |
| -0.3565 | 1.00005 | 2.60e-4 | 0.19 |
| 0.5085 | 1.00003 | 3.85e-4 | 0.08 |
| -0.5085 | 1.00006 | 3.84e-4 | 0.16 |
| 0.7252 | 1.00015 | 5.90e-4 | 0.25 |
| -0.7252 | 1.00003 | 5.87e-4 | 0.04 |
| 1.0342 | 1.00060 | 9.85e-4 | 0.60 |
| -1.0342 | 0.99975 | 9.72e-4 | 0.25 |
| 1.4750 | 1.00247 | 2.01e-3 | 1.23 |
| -1.4750 | 0.99827 | 1.91e-3 | 0.90 |
| 2.1035 | 1.01072 | 6.12e-3 | 1.75 |
| -2.1035 | 0.98987 | 5.37e-3 | 1.89 |
| 3.0000 | 1.03198 | 2.82e-2 | 1.13 |
| -3.0000 | 0.93891 | 2.43e-2 | 2.51 |

- H5b mean M_20 on λ = ±0.25: 20.02 (band [16, 24], must exceed 5): pass
- Reported, unmeasurable: full-grid trajectory mean of M_1000 = 52.4 against an expectation of 1000 (the terminal-mean trap).

Wall time 87s.
