# REPORT — H0 battery: do the detectors produce e-values?

Run: `run-20260801T062824Z`  ·  engine `0.6.6-pre`  ·  registration sha 17cc3f8

**Verdict wording is fixed by PREREGISTRATION §2.** A detector that survives a null is
"not refuted at these nulls". It is NOT evidence that the detector is an e-value.

## P1 — false-alarm rate against nominal

P1: detector=family_A_betting_e_process verdict=FAIL failed_cells=16
P1: detector=family_A_mixture_supermartingale verdict=FAIL failed_cells=17
P1: detector=family_C_safe_hotelling verdict=FAIL failed_cells=17
P1: detector=family_D_spectral_e_detector verdict=FAIL failed_cells=2

## P2 — vacuous-pass guard (3 sigma step, detect within 200 ticks)

P2: detector=family_A_betting_e_process detection_rate=0.9730 verdict=pass
P2: detector=family_A_mixture_supermartingale detection_rate=0.9820 verdict=pass
P2: detector=family_C_safe_hotelling detection_rate=0.9725 verdict=pass
P2: detector=family_D_spectral_e_detector detection_rate=0.0075 verdict=FAIL

## Secondary endpoints (§6) — subordinate, no verdict

S1: mean_logM_under_N1=-15.3021 mean_logM_all_nulls=-12.0917 note=heavy-tailed, descriptive only per PREREGISTRATION §6
S2: shipped_alpha=1e-4 cells=48 max_rate=0.8795 note=measured, scored by no endpoint per PREREGISTRATION §4
S3: not_measured_in_this_run=true note=threshold-vs-1/alpha ratio requires compiled configs, which this harness does not read; measured separately 2026-07-31 at median 2.4e4 and 3.6e76
S4: not_measured_in_this_run=true note=integrated autocorrelation time of the per-tick increment was not instrumented in this harness

## Cells

family_A_betting_e_process N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_betting_e_process N1 alpha=0.01 rate=0.0055 lower95=0.0034 verdict=not-refuted
family_A_betting_e_process N1 alpha=0.05 rate=0.0310 lower95=0.0252 verdict=not-refuted
family_A_betting_e_process N2-m100 alpha=0.0001 rate=0.0250 lower95=0.0199 verdict=FAIL (descriptive)
family_A_betting_e_process N2-m100 alpha=0.01 rate=0.0990 lower95=0.0886 verdict=FAIL
family_A_betting_e_process N2-m100 alpha=0.05 rate=0.1805 lower95=0.1668 verdict=FAIL
family_A_betting_e_process N2-m30 alpha=0.0001 rate=0.1565 lower95=0.1436 verdict=FAIL (descriptive)
family_A_betting_e_process N2-m30 alpha=0.01 rate=0.3030 lower95=0.2864 verdict=FAIL
family_A_betting_e_process N2-m30 alpha=0.05 rate=0.3930 lower95=0.3752 verdict=FAIL
family_A_betting_e_process N2-m500 alpha=0.0001 rate=0.0005 lower95=0.0001 verdict=FAIL (descriptive)
family_A_betting_e_process N2-m500 alpha=0.01 rate=0.0160 lower95=0.0120 verdict=FAIL
family_A_betting_e_process N2-m500 alpha=0.05 rate=0.0595 lower95=0.0514 verdict=FAIL
family_A_betting_e_process N3-p03 alpha=0.0001 rate=0.0045 lower95=0.0026 verdict=FAIL (descriptive)
family_A_betting_e_process N3-p03 alpha=0.01 rate=0.0770 lower95=0.0678 verdict=FAIL
family_A_betting_e_process N3-p03 alpha=0.05 rate=0.1955 lower95=0.1813 verdict=FAIL
family_A_betting_e_process N3-p06 alpha=0.0001 rate=0.0990 lower95=0.0886 verdict=FAIL (descriptive)
family_A_betting_e_process N3-p06 alpha=0.01 rate=0.3820 lower95=0.3643 verdict=FAIL
family_A_betting_e_process N3-p06 alpha=0.05 rate=0.5970 lower95=0.5788 verdict=FAIL
family_A_betting_e_process N3-p09 alpha=0.0001 rate=0.7190 lower95=0.7022 verdict=FAIL (descriptive)
family_A_betting_e_process N3-p09 alpha=0.01 rate=0.9435 lower95=0.9344 verdict=FAIL
family_A_betting_e_process N3-p09 alpha=0.05 rate=0.9875 lower95=0.9827 verdict=FAIL
family_A_betting_e_process N4-p06-m100 alpha=0.0001 rate=0.3390 lower95=0.3218 verdict=FAIL (descriptive)
family_A_betting_e_process N4-p06-m100 alpha=0.01 rate=0.6005 lower95=0.5824 verdict=FAIL
family_A_betting_e_process N4-p06-m100 alpha=0.05 rate=0.7475 lower95=0.7312 verdict=FAIL
family_A_betting_e_process N4-p09-m100 alpha=0.0001 rate=0.8475 lower95=0.8338 verdict=FAIL (descriptive)
family_A_betting_e_process N4-p09-m100 alpha=0.01 rate=0.9690 lower95=0.9620 verdict=FAIL
family_A_betting_e_process N4-p09-m100 alpha=0.05 rate=0.9925 lower95=0.9886 verdict=FAIL
family_A_betting_e_process N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_betting_e_process N5 alpha=0.01 rate=0.0100 lower95=0.0069 verdict=not-refuted
family_A_betting_e_process N5 alpha=0.05 rate=0.0465 lower95=0.0393 verdict=not-refuted
family_A_betting_e_process N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_betting_e_process N6 alpha=0.01 rate=0.0075 lower95=0.0049 verdict=not-refuted
family_A_betting_e_process N6 alpha=0.05 rate=0.0315 lower95=0.0257 verdict=not-refuted
family_A_betting_e_process N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_betting_e_process N7 alpha=0.01 rate=0.0055 lower95=0.0034 verdict=not-refuted
family_A_betting_e_process N7 alpha=0.05 rate=0.0310 lower95=0.0252 verdict=not-refuted
family_A_mixture_supermartingale N1 alpha=0.0001 rate=0.0005 lower95=0.0001 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N1 alpha=0.01 rate=0.0035 lower95=0.0019 verdict=not-refuted
family_A_mixture_supermartingale N1 alpha=0.05 rate=0.0195 lower95=0.0150 verdict=not-refuted
family_A_mixture_supermartingale N2-m100 alpha=0.0001 rate=0.0260 lower95=0.0208 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N2-m100 alpha=0.01 rate=0.0960 lower95=0.0857 verdict=FAIL
family_A_mixture_supermartingale N2-m100 alpha=0.05 rate=0.1625 lower95=0.1494 verdict=FAIL
family_A_mixture_supermartingale N2-m30 alpha=0.0001 rate=0.1845 lower95=0.1707 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N2-m30 alpha=0.01 rate=0.3250 lower95=0.3080 verdict=FAIL
family_A_mixture_supermartingale N2-m30 alpha=0.05 rate=0.4070 lower95=0.3891 verdict=FAIL
family_A_mixture_supermartingale N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_A_mixture_supermartingale N2-m500 alpha=0.01 rate=0.0130 lower95=0.0094 verdict=not-refuted
family_A_mixture_supermartingale N2-m500 alpha=0.05 rate=0.0495 lower95=0.0421 verdict=not-refuted
family_A_mixture_supermartingale N3-p03 alpha=0.0001 rate=0.0040 lower95=0.0023 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N3-p03 alpha=0.01 rate=0.0780 lower95=0.0687 verdict=FAIL
family_A_mixture_supermartingale N3-p03 alpha=0.05 rate=0.1870 lower95=0.1731 verdict=FAIL
family_A_mixture_supermartingale N3-p06 alpha=0.0001 rate=0.1225 lower95=0.1109 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N3-p06 alpha=0.01 rate=0.3835 lower95=0.3658 verdict=FAIL
family_A_mixture_supermartingale N3-p06 alpha=0.05 rate=0.5420 lower95=0.5236 verdict=FAIL
family_A_mixture_supermartingale N3-p09 alpha=0.0001 rate=0.7105 lower95=0.6935 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N3-p09 alpha=0.01 rate=0.8810 lower95=0.8686 verdict=FAIL
family_A_mixture_supermartingale N3-p09 alpha=0.05 rate=0.9365 lower95=0.9269 verdict=FAIL
family_A_mixture_supermartingale N4-p06-m100 alpha=0.0001 rate=0.3860 lower95=0.3683 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N4-p06-m100 alpha=0.01 rate=0.6115 lower95=0.5934 verdict=FAIL
family_A_mixture_supermartingale N4-p06-m100 alpha=0.05 rate=0.7345 lower95=0.7179 verdict=FAIL
family_A_mixture_supermartingale N4-p09-m100 alpha=0.0001 rate=0.8795 lower95=0.8670 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N4-p09-m100 alpha=0.01 rate=0.9555 lower95=0.9473 verdict=FAIL
family_A_mixture_supermartingale N4-p09-m100 alpha=0.05 rate=0.9725 lower95=0.9658 verdict=FAIL
family_A_mixture_supermartingale N5 alpha=0.0001 rate=0.0065 lower95=0.0041 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N5 alpha=0.01 rate=0.0330 lower95=0.0270 verdict=FAIL
family_A_mixture_supermartingale N5 alpha=0.05 rate=0.0625 lower95=0.0542 verdict=FAIL
family_A_mixture_supermartingale N6 alpha=0.0001 rate=0.0075 lower95=0.0049 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N6 alpha=0.01 rate=0.0255 lower95=0.0203 verdict=FAIL
family_A_mixture_supermartingale N6 alpha=0.05 rate=0.0480 lower95=0.0407 verdict=not-refuted
family_A_mixture_supermartingale N7 alpha=0.0001 rate=0.0005 lower95=0.0001 verdict=FAIL (descriptive)
family_A_mixture_supermartingale N7 alpha=0.01 rate=0.0035 lower95=0.0019 verdict=not-refuted
family_A_mixture_supermartingale N7 alpha=0.05 rate=0.0195 lower95=0.0150 verdict=not-refuted
family_C_safe_hotelling N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_C_safe_hotelling N1 alpha=0.01 rate=0.0070 lower95=0.0045 verdict=not-refuted
family_C_safe_hotelling N1 alpha=0.05 rate=0.0275 lower95=0.0221 verdict=not-refuted
family_C_safe_hotelling N2-m100 alpha=0.0001 rate=0.0290 lower95=0.0234 verdict=FAIL (descriptive)
family_C_safe_hotelling N2-m100 alpha=0.01 rate=0.0660 lower95=0.0574 verdict=FAIL
family_C_safe_hotelling N2-m100 alpha=0.05 rate=0.1030 lower95=0.0924 verdict=FAIL
family_C_safe_hotelling N2-m30 alpha=0.0001 rate=0.1565 lower95=0.1436 verdict=FAIL (descriptive)
family_C_safe_hotelling N2-m30 alpha=0.01 rate=0.2080 lower95=0.1935 verdict=FAIL
family_C_safe_hotelling N2-m30 alpha=0.05 rate=0.2495 lower95=0.2339 verdict=FAIL
family_C_safe_hotelling N2-m500 alpha=0.0001 rate=0.0005 lower95=0.0001 verdict=FAIL (descriptive)
family_C_safe_hotelling N2-m500 alpha=0.01 rate=0.0095 lower95=0.0065 verdict=not-refuted
family_C_safe_hotelling N2-m500 alpha=0.05 rate=0.0320 lower95=0.0261 verdict=not-refuted
family_C_safe_hotelling N3-p03 alpha=0.0001 rate=0.0010 lower95=0.0003 verdict=FAIL (descriptive)
family_C_safe_hotelling N3-p03 alpha=0.01 rate=0.0165 lower95=0.0124 verdict=FAIL
family_C_safe_hotelling N3-p03 alpha=0.05 rate=0.0435 lower95=0.0366 verdict=not-refuted
family_C_safe_hotelling N3-p06 alpha=0.0001 rate=0.0130 lower95=0.0094 verdict=FAIL (descriptive)
family_C_safe_hotelling N3-p06 alpha=0.01 rate=0.0625 lower95=0.0542 verdict=FAIL
family_C_safe_hotelling N3-p06 alpha=0.05 rate=0.1295 lower95=0.1176 verdict=FAIL
family_C_safe_hotelling N3-p09 alpha=0.0001 rate=0.1945 lower95=0.1804 verdict=FAIL (descriptive)
family_C_safe_hotelling N3-p09 alpha=0.01 rate=0.3160 lower95=0.2992 verdict=FAIL
family_C_safe_hotelling N3-p09 alpha=0.05 rate=0.3800 lower95=0.3623 verdict=FAIL
family_C_safe_hotelling N4-p06-m100 alpha=0.0001 rate=0.1395 lower95=0.1272 verdict=FAIL (descriptive)
family_C_safe_hotelling N4-p06-m100 alpha=0.01 rate=0.2380 lower95=0.2227 verdict=FAIL
family_C_safe_hotelling N4-p06-m100 alpha=0.05 rate=0.2930 lower95=0.2765 verdict=FAIL
family_C_safe_hotelling N4-p09-m100 alpha=0.0001 rate=0.5540 lower95=0.5357 verdict=FAIL (descriptive)
family_C_safe_hotelling N4-p09-m100 alpha=0.01 rate=0.6280 lower95=0.6101 verdict=FAIL
family_C_safe_hotelling N4-p09-m100 alpha=0.05 rate=0.6555 lower95=0.6378 verdict=FAIL
family_C_safe_hotelling N5 alpha=0.0001 rate=0.2075 lower95=0.1930 verdict=FAIL (descriptive)
family_C_safe_hotelling N5 alpha=0.01 rate=0.3110 lower95=0.2942 verdict=FAIL
family_C_safe_hotelling N5 alpha=0.05 rate=0.3750 lower95=0.3574 verdict=FAIL
family_C_safe_hotelling N6 alpha=0.0001 rate=0.1795 lower95=0.1658 verdict=FAIL (descriptive)
family_C_safe_hotelling N6 alpha=0.01 rate=0.2510 lower95=0.2354 verdict=FAIL
family_C_safe_hotelling N6 alpha=0.05 rate=0.3015 lower95=0.2849 verdict=FAIL
family_C_safe_hotelling N7 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_C_safe_hotelling N7 alpha=0.01 rate=0.0070 lower95=0.0045 verdict=not-refuted
family_C_safe_hotelling N7 alpha=0.05 rate=0.0275 lower95=0.0221 verdict=not-refuted
family_D_spectral_e_detector N1 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N1 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N1 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_D_spectral_e_detector N2-m100 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N2-m100 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N2-m100 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_D_spectral_e_detector N2-m30 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N2-m30 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N2-m30 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N2-m500 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N2-m500 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N2-m500 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_D_spectral_e_detector N3-p03 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N3-p03 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N3-p03 alpha=0.05 rate=0.0005 lower95=0.0001 verdict=not-refuted
family_D_spectral_e_detector N3-p06 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N3-p06 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N3-p06 alpha=0.05 rate=0.0020 lower95=0.0009 verdict=not-refuted
family_D_spectral_e_detector N3-p09 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N3-p09 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N3-p09 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N4-p06-m100 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N4-p06-m100 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N4-p06-m100 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N4-p09-m100 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N4-p09-m100 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N4-p09-m100 alpha=0.05 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N5 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N5 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N5 alpha=0.05 rate=0.0020 lower95=0.0009 verdict=not-refuted
family_D_spectral_e_detector N6 alpha=0.0001 rate=0.0000 lower95=0.0000 verdict=not-refuted (descriptive)
family_D_spectral_e_detector N6 alpha=0.01 rate=0.0000 lower95=0.0000 verdict=not-refuted
family_D_spectral_e_detector N6 alpha=0.05 rate=0.0010 lower95=0.0003 verdict=not-refuted
family_D_spectral_e_detector N7 alpha=0.0001 rate=0.3280 lower95=0.3110 verdict=FAIL (descriptive)
family_D_spectral_e_detector N7 alpha=0.01 rate=0.5025 lower95=0.4841 verdict=FAIL
family_D_spectral_e_detector N7 alpha=0.05 rate=0.5760 lower95=0.5577 verdict=FAIL

## Out of scope (PREREGISTRATION §8.4 — named, not silently passed)

- **safe_t_e_value** — Fixed-window terminal e-value, not a sequential wealth process. P1 is a sup-crossing endpoint and is undefined for it. Needs a separate terminal-E[e] study.
- **universal_inference_e_value** — Same: fixed split, terminal e-value (engine ADR 0010).
- **sequential_ui_e_process** — Has a wealth process, but its interface consumes a whole prefix per tick (O(T^2)); driving it needs a different adapter shape. Deferred, not excluded on principle.
- **family_C_mmd_betting** — Requires a compiled baseline pool (baseline_rff_mean or a synthesized P-side pool) that this harness does not build. The non-Gaussian-null cell registered in PREREGISTRATION §3 needs that pool and is deferred with it.
- **family_E_conformal** — The default compiler path emits the `unweighted` kind, which has no wealth process. PREREGISTRATION §3 says report that rather than score it. The forced weighted_e_value kind needs a 20k-draw calibration bundle this harness does not build.
