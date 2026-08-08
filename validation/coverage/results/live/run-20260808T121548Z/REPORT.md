# Coverage battery `run-20260808T121548Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number and
verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`87f36b8` are unmodified, and no number below comes from a new run of the battery. Every table
below was generated mechanically from the committed `summary.json` beside this file, not
transcribed by hand. Follows the `run-20260808T010208Z/REPORT.md` precedent.

Written 2026-08-08 in the final fix wave.

**THIS RUN'S `shape_block_conformal_bet` ROWS ARE SUPERSEDED. It is the run whose defect the fix
wave exists for.** Amendment v2.C1 names the code defect: `heldoutRows` drew each of the 10,000
held-out rows as the first gaussian of its own arithmetically-spaced LCG stream, so both uniforms
`gaussFrom` consumes were affine in the row index and the "sample" was a **rank-1 Kronecker
lattice** with direction vector `(a·7919, a²·7919) mod 2³²  = (296471587, 1215975367)`. The
marginals were better than iid (mean 0.000200, sd 0.999968, raw kurtosis 2.989619 at cell 27's
seed); the joint was deterministic and seed-invariant (`acf(2) = -0.7513 ± 0.0003` across eight
unrelated held-out seeds, where an iid sample of 10,000 has sampling sd ≈ 0.01); and the
within-block moment spread the K6 rank is computed over was compressed ≈30%.

`run-20260808T133746Z` is the registered rerun and declares the supersession in its own manifest.
The six `shape_block_conformal_bet` rows below are withdrawn from scoring. The eight
`safe_t`/`universal_inference` rows are **not** superseded — they take no held-out calibration
and are bit-identical in the rerun (verified, 0 field diffs). §4 gives the corrected numbers.

| field | value |
|---|---|
| run id | `run-20260808T121548Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K6`, one invocation |
| `git_sha` at run | `b8b748e8106ff91d519e6afa89c5dd21fc164d51` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| classes run | `K6` |
| held-out draw | `HELDOUT_SEED = CELL_SEED + 500000; seed(j) = HELDOUT_SEED + 7919*j, j = 0..9999` |
| rows emitted | 14 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |

## 1. The endpoint table — every `(K6 cell, detector)` row

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 26 | K6 | `mix-d1.0` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `shape_block_conformal_bet` | 7/2000 | 0.0035 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `shape_block_conformal_bet` | 1/2000 | 0.0005 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `universal_inference` | 1/2000 | 0.0005 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `shape_block_conformal_bet` | 2000/2000 | 1 | POWERED |
| 28 | K6 | `mix-d2.0` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `shape_block_conformal_bet` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0 | INERT |

## 2. Arm 34 — validity (S2) and power (S3)

| idx | detector | arm | n | class instrument | reading | lower_95 | verdict |
|---|---|---|---|---|---|---|---|
| 34 | `shape_block_conformal_bet` | healthy | 2000 | `crossing_rate` / `k` | 0.0110 (k=22/n=2000) | 0.007770215376370452 | not-refuted |
| 34 | `shape_block_conformal_bet` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |

### Registered secondary fields

- **cell 26 `mix-d1.0`** — final_wealth mean 0.083354 / median 0.001174; degenerate_windows 0
- **cell 27 `mix-d1.5`** — final_wealth mean 0.016307 / median 0.002223; degenerate_windows 0
- **cell 28 `mix-d2.0`** — final_wealth mean 1258.750072 / median 1082.078924; degenerate_windows 0
- **cell 29 `mix-d1.5-ar1`** — final_wealth mean 0.001333 / median 0.000422; degenerate_windows 0
- **arm 34 healthy** — final_wealth mean 0.259744 / median 0.001825; degenerate_windows 0; increment_estimator n=2000 mean 0.825802767757456 sd 0.845800 se 0.018913 lower95_one_sided 0.7946914228537751; p_uniformity n=24000 deciles [4475, 2686, 2177, 2696, 2130, 2109, 1747, 2296, 1734, 1950] ks 0.10802919161676644 vs critical 0.008778762251403479; heldout_seed 20760841 / heldout_rows 10000
- **arm 34 power** — final_wealth mean 785.425276 / median 600.550403; degenerate_windows 0; heldout_seed 20760841 / heldout_rows 10000

## 3. Stop-condition readings

K6.13's registered T1 stop condition is arm 34's healthy `crossing_rate` Wilson 95% lower bound
against `alpha = 0.05`. As recorded: `k = 22`, `n = 2000`, `crossing_rate = 0.0110`,
`lower_95 = 0.007770215376370452`. **Under 0.05, so the stop condition did not fire** and S2
cleared as `not-refuted`.

That clearance was itself a consequence of the defect, and the direction is worth stating exactly:
the lattice reference **inflated** the healthy crossing rate, so this reading is *harder* to pass
than the truth, and the corrected rerun reads `k = 0`, `crossing_rate = 0.0000`,
`lower_95 = 0.0`. On the validity endpoint the defect was conservative. On the power endpoint it
was not — see §4.

## 4. The C1 delta on this run's rows (post-hoc, no verdict)

Labelled post-hoc per §11 rule 3. Numbers from `run-20260808T133746Z/summary.json`.

| row | this run (lattice) | rerun (corrected) | direction of this run's error |
|---|---|---|---|
| cell 26 `mix-d1.0` | 0.0035 | 0.0010 | anti-conservative, immaterial |
| cell 27 `mix-d1.5` **canonical** | 0.0005 | 0.0000 | anti-conservative, immaterial |
| cell 28 `mix-d2.0` | **1.0000 POWERED** | **0.0045 INERT** | **anti-conservative — power manufactured** |
| cell 29 `mix-d1.5-ar1` | 0.0000 | 0.0000 | none |
| arm 34 S2 `k` / `crossing_rate` | 22 / 0.0110 | 0 / 0.0000 | conservative |
| arm 34 S2 `increment_estimator.mean` | 0.825802767757456 | 0.44367965142547167 | — (verdict-free) |
| arm 34 S2 `p_uniformity.ks_statistic` | 0.10802919161676644 | 0.022903692614770432 | — (verdict-free) |
| arm 34 S2 first decile | 4475 / 24000 | 2229 / 24000 | — (verdict-free) |
| arm 34 S3 `detection_rate` | **1.0000 POWERED** | **0.0005 INERT** | **anti-conservative — the verdict that moved** |

**The one verdict this defect moved, end to end:** arm 34's S3 row falls below
`INERTNESS_FLOOR = 0.10`, so `scoreS3`'s status goes PASS → INERT, `s3Powered` is empty, and
`overallVerdict`'s valid-but-inert rule gives `shape_block_conformal_bet` **ADVISORY** instead
of `USE` — which is the verdict Amendments v2.K6/v2.K6.1 registered from a closed-form derivation
before any run.

**The mechanism, arithmetically.** At `d = 2.0` the injected law is exactly two-point ±1σ
(`s = sqrt(1 - d²/4) = 0`), so the live window's raw kurtosis is 1 against a reference median of
≈2.7. Against the lattice reference only **2 of 333** blocks had `|dev|` at least as large, giving
`p = 0.00898204` and `e_kurtosis = 6.9496`; against the corrected reference **10 of 333** do,
giving `p = 0.03293413` and `e_kurtosis = 2.1583`. Averaged over 1200 live windows: mean
`eAvg` 3.2841 vs 1.1525, mean `log(eAvg)` 1.1630 vs 0.1148, six-window cumulative **6.9778 vs
0.6890** against the bar `log(20) = 2.9957`. The lattice put the wealth process ≈4.0 nats above
the bar; a real reference leaves it ≈2.3 nats below it.

**Amendment v2.K6.2's premise survives and its conclusion does not.** `s = 0` at `d = 2.0` is
exact arithmetic about the injection and stands, as does K6.2.3's taxonomy point that `d = 2.0` is
a grid-parameterization boundary artifact rather than a stronger instance of the canonical mixture.
What is withdrawn is POWERED.

**The K6 class answer was never at risk**: it is decided by the canonical cell alone
(`0.0005 -> 0.0000` against `COVERAGE_FLOOR = 0.50`), so the answer is NO under both schemes,
and a fortiori under the corrected one.

## 5. Errata and carries

- **The `-ar1` cell 29 row is out of claim** (Amendment v2.C1 C1.3). Its held-out rows carried no
  serial structure: measured `acf(1) = 0.2687` against `φ = 0.600` and `acf(2) = -0.3155`
  against `φ² = 0.360`. It is re-registered as a mismatched-φ reading, not the matched-process
  replicate. Only the rerun's cell-29 row may be cited as matched `-ar1` evidence. (Both read
  0.0000, so the correction costs no endpoint — it costs a claim about what the row measured.)
- **`p_uniformity` did fire, and the run report adjudicated its direction wrongly.** KS
  0.10802919161676644 against critical 0.008778762251403479 is the reading that led to C1. Task
  11b recorded it as "refutation-direction only"; Amendment v2.C1 C1.11 corrects that endpoint by
  endpoint. The instrument worked; the reading of it did not.
- **This run carried no `cal_fingerprint`**, because the field did not exist. That absence is
  why the reference's shape had to be reconstructed from outside the run directory at all;
  Amendment v2.C1 C1.8 registers the field, and the rerun emits it.
