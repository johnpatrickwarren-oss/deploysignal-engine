# 2026-09-nab-time-to-alert — run run-20260905T025224Z

Engine `0.6.11-pre` at `7ca59a96897085fe29d6126640726163a9978cf9`; NAB at `ea702d75cc2258d9d7dd35ca8e5e2539d71f3140`; node v25.9.0; mode live. Registration sha256 `1f4c12904445`; harness sha256 `9a0655587723`.
23 scored traces (registered 23) from realKnownCause + realAWSCloudwatch; probationary fraction 0.15; the tool's default calibration (`p99_latency`, pre-whitening on, innovation σ²); α scored 0.05, 0.01 for the two Ville cards, the compiled config's own level descriptive; e-SR at α_ARL = 0.001. Exceptions: 0.

**Tier T3 on every number below** (real telemetry, the traces that score). ARL₀ and delay are REPORTED endpoints with no verdict authority (protocol Amendment v1.C66); the falsifier-2 reading is the one registered reading (PREREGISTRATION §4).

## Endpoints per detector and α (T3)

| detector | α | pre | in | late | none | P1 strict | P1 by end | not by end | **falsifier 2** | P2 median in (ticks) | P2 median in (h) | P2 censored mean (ticks) | P2b median from point | P3 pre/N | P3 per 1,000 quiet | P4 median onset err | P4 inside window |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| family_A_mixture_supermartingale | 0.05 | 14 | 3 | 3 | 3 | 0.130 | 0.739 | 6 of 23 | **does not fire** | 203 | 16.9 | 203.4 | 11 | 0.609 | 0.33 | — | — |
| family_A_mixture_supermartingale | 0.01 | 11 | 5 | 4 | 3 | 0.217 | 0.696 | 7 of 23 | **does not fire** | 204 | 17.0 | 266.0 | 15 | 0.478 | 0.26 | — | — |
| family_A_mixture_supermartingale | tool (alpha_budget.A / bonferroni, per trace) (descriptive) | 8 | 3 | 7 | 5 | 0.130 | 0.478 | 12 of 23 | **FIRES** | 250 | 20.8 | 279.7 | 14 | 0.348 | 0.19 | — | — |
| family_A_betting_e_process | 0.05 | 11 | 2 | 6 | 4 | 0.087 | 0.565 | 10 of 23 | **does not fire** | 125 | 10.4 | 301.5 | -32 | 0.478 | 0.26 | — | — |
| family_A_betting_e_process | 0.01 | 11 | 1 | 6 | 5 | 0.043 | 0.522 | 11 of 23 | **does not fire** | 219 | 18.3 | 317.6 | 18 | 0.478 | 0.26 | — | — |
| family_A_betting_e_process | tool (alpha_budget.A / bonferroni, per trace) (descriptive) | 8 | 2 | 4 | 9 | 0.087 | 0.435 | 13 of 23 | **FIRES** | 277 | 23.1 | 306.3 | 76 | 0.348 | 0.19 | — | — |
| e_sr_mean_shift | 0.001 | 20 | 3 | 0 | 0 | 0.130 | 1.000 | 0 of 23 | **does not fire** | 99 | 8.3 | 120.7 | -1 | 0.870 | 0.48 | -1095 | 0.130 |

Classes: `pre` = first alert on the labelled-quiet stretch before the window; `in` = inside the window; `late` = after its end; `none` = no alert by the trace end. P2 medians are over `in` traces; the censored mean is over `in ∪ late ∪ none` with the delay censored at the window length. P2b is `t* − point` on `in` traces (negative = before NAB's own label). P3 counts `pre` traces; the quiet stretch is unlabelled real data, not a certified null. P4 is the e-SR onset estimate minus the window start on the traces where it alerted.

## Per trace (T3)

| trace | n | cadence | nProb | window | point | φ̂ | σ̂ (innov.) | window shift, marginal σ | whitened | mixture 0.05 | mixture 0.01 | betting 0.05 | betting 0.01 | e-SR 1e-3 (onset est.) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AWSCloudwatch/ec2_cpu_utilization_24ae8d | 4032 | 5 min | 604 | 3447–3647 | 3547 | -0.038 | 0.085 | 0.20 | 0.21 | none | none | none | none | pre (-2718) [-2718] |
| AWSCloudwatch/ec2_cpu_utilization_53ea38 | 4032 | 5 min | 604 | 1396–1596 | 1496 | -0.107 | 0.098 | 0.19 | 0.21 | late (+453) | late (+487) | late (+533) | late (+679) | pre (-661) [-662] |
| AWSCloudwatch/ec2_cpu_utilization_5f5533 | 4032 | 5 min | 604 | 1171–1371 | 1271 | -0.533 | 3.144 | -0.11 | -0.20 | late (+232) | late (+245) | late (+225) | late (+240) | in (+99) [+97] |
| AWSCloudwatch/ec2_cpu_utilization_77c1ca | 4032 | 5 min | 604 | 1765–2167 | 1966 | 0.740 | 19.344 | 0.18 | 0.07 | none | none | none | none | pre (-1137) [-1137] |
| AWSCloudwatch/ec2_cpu_utilization_825cc2 | 4032 | 5 min | 604 | 1526–1868 | 1626 | 0.483 | 2.009 | -9.17 | -5.41 | pre (-903) | pre (-892) | pre (-905) | pre (-895) | pre (-895) [-922] |
| AWSCloudwatch/ec2_cpu_utilization_ac20cd | 4032 | 5 min | 604 | 3374–3776 | 3575 | 0.950 | 5.367 | 2.12 | 0.34 | in (+332) | in (+370) | in (+125) | in (+219) | pre (-2640) [-2640] |
| AWSCloudwatch/ec2_cpu_utilization_fe7f93 | 4032 | 5 min | 604 | 698–832 | 765 | 0.720 | 4.968 | 1.37 | 0.55 | in (+78) | in (+82) | in (+35) | none | in (+62) [+62] |
| AWSCloudwatch/ec2_disk_write_bytes_1ef3de | 4730 | 5 min | 709 | 2399–2871 | 2635 | 0.439 | 15200884.768 | 0.47 | 0.29 | pre (-597) | pre (-566) | pre (-1601) | pre (-1553) | pre (-1540) [-1540] |
| AWSCloudwatch/ec2_disk_write_bytes_c0d644 | 4032 | 5 min | 604 | 1794–1928 | 1861 | 0.293 | 69305053.603 | 0.43 | 0.32 | pre (-345) | pre (-116) | late (+1837) | late (+1989) | pre (-1165) [-1165] |
| AWSCloudwatch/ec2_network_in_257a54 | 4032 | 5 min | 604 | 1437–1839 | 1638 | -0.180 | 1114401.373 | 0.83 | 1.00 | in (+203) | in (+204) | late (+456) | late (+482) | in (+201) [+201] |
| AWSCloudwatch/ec2_network_in_5abac7 | 4730 | 5 min | 709 | 2490–2726 | 2608 | -0.007 | 555849.348 | 0.59 | 0.60 | pre (-721) | pre (-710) | pre (-1706) | pre (-1666) | pre (-1631) [-1631] |
| AWSCloudwatch/elb_request_count_8c0756 | 4032 | 5 min | 604 | 683–883 | 783 | 0.135 | 57.651 | -0.12 | -0.10 | pre (-22) | in (+7) | pre (-56) | pre (-42) | pre (-14) [-77] |
| AWSCloudwatch/grok_asg_anomaly | 4621 | 5 min | 693 | 1177–1331 | 1254 | 0.270 | 1.042 | 0.12 | 0.09 | late (+319) | late (+376) | late (+743) | late (+801) | pre (-347) [-347] |
| AWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | 1243 | 5 min | 186 | 218–280 | 206 | 0.910 | 3550762.016 | 0.26 | 0.06 | none | none | late (+733) | late (+841) | pre (-16) [-17] |
| AWSCloudwatch/rds_cpu_utilization_cc0c53 | 4032 | 5 min | 604 | 2980–3180 | 3080 | 0.053 | 0.366 | 11.53 | 10.93 | pre (-1893) | pre (-1868) | pre (-2061) | pre (-1923) | pre (-2052) [-2249] |
| AWSCloudwatch/rds_cpu_utilization_e47b3b | 4032 | 5 min | 604 | 846–1046 | 946 | -0.061 | 0.496 | 3.78 | 4.02 | pre (-113) | pre (-103) | pre (-126) | pre (-113) | pre (-175) [-175] |
| KnownCause/ambient_temperature_system_failure | 7267 | 60 min | 1090 | 3540–3902 | 3721 | 0.946 | 0.981 | 2.42 | 0.40 | pre (-1060) | pre (-990) | pre (-1085) | pre (-1037) | pre (-2446) [-2447] |
| KnownCause/cpu_utilization_asg_misconfiguration | 18050 | 5 min | 2707 | 16551–18049 | 17002 | 0.270 | 14.234 | 0.53 | 0.41 | pre (-13718) | in (+745) | none | none | pre (-13721) [-13722] |
| KnownCause/ec2_request_latency_system_failure | 4032 | 5 min | 604 | 2014–2148 | 2081 | -0.317 | 1.574 | -0.21 | -0.29 | pre (-1168) | pre (-1161) | pre (-1329) | pre (-1150) | pre (-1334) [-1381] |
| KnownCause/machine_temperature_system_failure | 22695 | 5 min | 3404 | 3703–4269 | 3986 | 0.950 | 4.092 | -0.78 | -0.12 | pre (-299) | late (+1405) | pre (-248) | pre (-224) | pre (-261) [-299] |
| KnownCause/nyc_taxi | 10320 | 30 min | 1548 | 5839–6045 | 5942 | 0.950 | 2095.546 | 0.36 | 0.06 | pre (-4291) | pre (-4291) | none | none | pre (-4282) [-4288] |
| KnownCause/rogue_agent_key_hold | 1882 | 5 min | 282 | 669–763 | 716 | 0.093 | 0.053 | -0.83 | -0.75 | pre (-353) | pre (-349) | pre (-357) | pre (-352) | pre (-356) [-366] |
| KnownCause/rogue_agent_key_updown | 5315 | 5 min | 797 | 2243–2507 | 2375 | 0.048 | 2.299 | 0.06 | 0.05 | pre (-1095) | pre (-1095) | pre (-1213) | pre (-1184) | pre (-1095) [-1095] |

Class (delay in ticks from the window start) [e-SR: onset estimate minus window start]. "Window shift" is the window mean minus the probationary mean, in marginal σ and in whitened units `(1 − φ̂)/σ̂_innovation` — the size of the event to a whitened detector.

