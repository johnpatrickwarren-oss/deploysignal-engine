# Coverage battery `run-20260808T133746Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number and
verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`ef58647` are unmodified, and no number below comes from a new run of the battery. Every table
below was generated mechanically from the committed `summary.json` beside this file, not
transcribed by hand.

**THE REGISTERED RERUN for the named code defect Amendment v2.C1 names (house rule 7, §11:249).**
The prior run `run-20260808T121548Z` is preserved byte-for-byte; this run's manifest declares its
`shape_block_conformal_bet` rows superseded, and only those rows — that run's eight
`safe_t`/`universal_inference` rows take no held-out calibration and are bit-identical here
(verified: 8 rows, 0 field diffs).

The corrected held-out generator (C1.2) draws the 10,000 rows as **consecutive** gaussians from one
continuously-advanced `rng(HELDOUT_SEED)` stream, the same way a live window is 30 consecutive
draws. `HELDOUT_SEED` and `HELDOUT_ROWS` are unchanged. The harness now refuses to run on rows
whose autocorrelation does not match the φ they were drawn under
(`|acf(k) − φ^k| <= 0.10`, a 10σ bound), so the pre-C1 draw cannot produce a run at all.

| field | value |
|---|---|
| run id | `run-20260808T133746Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K6 --supersedes ... --supersedes-reason ...`, one invocation |
| `git_sha` at run | `40d4cb37e36a895800988c1c3518141266f2d97c` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| classes run | `K6` |
| held-out draw | `HELDOUT_SEED = CELL_SEED + 500000; rows are 10000 CONSECUTIVE draws from one continuously-advanced rng(HELDOUT_SEED) stream (Amendment v2.C1 C1.2, superseding the pre-C1 seed(j) = HELDOUT_SEED + 7919*j scheme)` |
| rows emitted | 14 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |
| supersedes | `coverage/run-20260808T121548Z` → `shape_block_conformal_bet` |

## 1. The endpoint table — every `(K6 cell, detector)` row

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 26 | K6 | `mix-d1.0` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `shape_block_conformal_bet` | 2/2000 | 0.0010 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `shape_block_conformal_bet` | 0/2000 | 0 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `universal_inference` | 1/2000 | 0.0005 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `shape_block_conformal_bet` | 9/2000 | 0.0045 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `shape_block_conformal_bet` | 0/2000 | 0 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0 | INERT |

## 2. Arm 34 — validity (S2) and power (S3)

| idx | detector | arm | n | class instrument | reading | lower_95 | verdict |
|---|---|---|---|---|---|---|---|
| 34 | `shape_block_conformal_bet` | healthy | 2000 | `crossing_rate` / `k` | 0 (k=0/n=2000) | 0 | not-refuted |
| 34 | `shape_block_conformal_bet` | power | 2000 | `detection_rate` (S3, shift 3σ) | 0.0005 (1/2000) | — | INERT |

### Registered secondary fields, including C1.8's new `cal_fingerprint`

- **cell 26 `mix-d1.0`** — final_wealth mean 0.005337 / median 0.000178; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.638979, |dev| p50 0.376396 p90 1.049984 max 3.560917; absSkew median 0.250198, |dev| p50 0.154060 p90 0.405068 max 1.035884; heldout_seed 20760833 / heldout_rows 10000
- **cell 27 `mix-d1.5`** — final_wealth mean 0.000778 / median 0.000242; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.631062, |dev| p50 0.327118 p90 0.979450 max 2.991298; absSkew median 0.253978, |dev| p50 0.149195 p90 0.367313 max 1.012357; heldout_seed 20760834 / heldout_rows 10000
- **cell 28 `mix-d2.0`** — final_wealth mean 2.402955 / median 1.795337; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.744525, |dev| p50 0.409764 p90 0.966277 max 3.178961; absSkew median 0.252180, |dev| p50 0.158769 p90 0.405196 max 0.926275; heldout_seed 20760835 / heldout_rows 10000
- **cell 29 `mix-d1.5-ar1`** — final_wealth mean 0.000815 / median 0.000217; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.576336, |dev| p50 0.353472 p90 0.834166 max 4.386241; absSkew median 0.283840, |dev| p50 0.163843 p90 0.373426 max 1.160256; heldout_seed 20760836 / heldout_rows 10000
- **arm 34 healthy** — final_wealth mean 0.006919 / median 0.000254; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.664436, |dev| p50 0.342515 p90 1.003665 max 5.341915; absSkew median 0.255445, |dev| p50 0.162661 p90 0.414810 max 1.551302; increment_estimator n=2000 mean 0.44367965142547167 sd 0.394292 se 0.008817 lower95_one_sided 0.4291762955382734; p_uniformity n=24000 deciles [2229, 2386, 2687, 2565, 2274, 2122, 2445, 2426, 2427, 2439] ks 0.022903692614770432 vs critical 0.008778762251403479; heldout_seed 20760841 / heldout_rows 10000
- **arm 34 power** — final_wealth mean 1.774886 / median 1.423974; degenerate_windows 0; cal_fingerprint m=333: kurtosis median 2.664436, |dev| p50 0.342515 p90 1.003665 max 5.341915; absSkew median 0.255445, |dev| p50 0.162661 p90 0.414810 max 1.551302; heldout_seed 20760841 / heldout_rows 10000

## 3. Stop-condition readings

K6.13's registered T1 stop condition is arm 34's healthy `crossing_rate` Wilson 95% lower bound
against `alpha = 0.05`. **As recorded: `k = 0`, `n = 2000`, `crossing_rate = 0.0000`,
`lower_95 = 0.0`.** Recomputed from `k` and `n` at `z = 1.645` through the harness's own
`lower95` formula: `p = 0`, so the numerator `c − h = z²/(2n) − z·sqrt(z²/(4n²)) = 0`
exactly, and `max(0, 0/d) = 0`. **0.0 <= 0.05, so the stop condition did not fire** and S2
cleared as `not-refuted`. The `test_martingale` class carries no terminal mean rule, so nothing
overrode that clearance.

## 4. Every registered prediction against its reading

Amendment v2.C1 C1.5 registered a point prediction AND a falsifier-bearing band for each row, with
the counterfactual measurements disclosed by provenance (C1.4: they were measured before being
registered, by a standalone refuter validated to reproduce thirty-nine committed pre-C1 endpoints
exactly). **All eleven held. Zero surprises.**

| row | prior (lattice) | registered prediction | band | MEASURED | held |
|---|---|---|---|---|---|
| cell 26 `mix-d1.0` | 0.0035 | 0.0010 | ≤ 0.02 | **0.0010** (2/2000) | ✓ |
| cell 27 `mix-d1.5` **canonical** | 0.0005 | 0.0000 | ≤ 0.02 | **0.0000** (0/2000) | ✓ |
| cell 28 `mix-d2.0` | 1.0000 | 0.0045 | ≤ 0.02 | **0.0045** (9/2000) | ✓ |
| cell 29 `mix-d1.5-ar1` | 0.0000 | 0.0000 | ≤ 0.02 | **0.0000** (0/2000) | ✓ |
| arm 34 S2 `k` / `crossing_rate` | 22 / 0.0110 | 0 / 0.0000 | ≤ 0.02 | **0 / 0.0000** | ✓ |
| arm 34 S2 `lower_95` | 0.007770215376370452 | 0.0000 | ≤ 0.05 | **0.0** | ✓ |
| arm 34 S2 `increment_estimator.mean` | 0.825802767757456 | 0.44367965142547167 | ≤ 1 | **0.44367965142547167** | ✓ exact |
| arm 34 S2 `p_uniformity.ks_statistic` | 0.10802919161676644 | 0.022903692614770432 | ≤ 0.04 | **0.022903692614770432** | ✓ exact |
| arm 34 S3 `detection_rate` | 1.0000 | 0.0005 | ≤ 0.02 | **0.0005** (1/2000) | ✓ |
| `degenerate_windows`, all six rows | 0 | 0 | = 0 | **0** | ✓ |
| `cal_fingerprint` (C1.8), five draws | (field absent) | tabulated in C1.8 | exact | **exact on all 40 values** | ✓ |

## 5. The verdict migration this run lands

| stage | prior run | this run | mechanism |
|---|---|---|---|
| S1 | MISSING | MISSING | unchanged |
| S2 | PASS | PASS | `crossing_rate` clears; `increment_estimator` present so `isValidityCell` recognizes the row |
| **S3** | **PASS** | **INERT** | 0.0005 < `INERTNESS_FLOOR` 0.10 → `scoreS3` status INERT |
| S4 | PASS | PASS | unchanged |
| **overall** | **USE** / T1 | **ADVISORY** / T1 | `s3Powered` empty → `overallVerdict`'s valid-but-inert rule; tier is `minTier` of the supporting S2 evidence, so T1 survives |

**ADVISORY is the verdict Amendments v2.K6 and v2.K6.1 registered before any run**, from a
closed-form derivation (K6.4/K6.8). Amendment v2.K6.2 overturned it on a smoke reading of
`detection_rate = 1.0` at `d = 2.0`; that reading was the lattice. v2.K6.2's PREMISE stands —
`s = sqrt(1 − d²/4)` is exactly 0 at `d = 2.0`, so that severity is genuinely a two-point ±1σ
law, and K6.2.3's boundary-artifact taxonomy stands with it — and only its POWERED CONCLUSION is
withdrawn. Reached the same verdict twice by two routes, three amendments apart.

## 6. The K6 class answer

**NO, unchanged, and now a fortiori.** It is decided by the canonical cell alone (K6.2.2): cell 27
reads `0.0000` against `COVERAGE_FLOOR = 0.50`, where the superseded run read `0.0005`. The
class answer never depended on the defect.

`COVERAGE.md`'s K6 detail line now reads a **2-way tie** at 0.0005 between `safe_t_e_value` and
`universal_inference_e_value` — it was a silent 3-way tie including `shape_block_conformal_bet`
before, which Task 11b had to record as an unexplained deviation. The tie was the explanation, and
`verdict.mjs` now renders it.

## 7. Post-hoc observations (labelled, no verdict)

- **The `p_uniformity` KS test still rejects uniformity** (0.022903692614770432 against critical
  0.008778762251403479) after C1 is fixed. The `P(p <= 0.05)` inflation collapses from ≈2×
  nominal to ≈1.003× nominal, and the first-decile pile-up from 4475/24000 to 2229/24000, so the
  lattice explains most of the departure — but not the tail shape. Amendment v2.C1 C1.5 registered
  this residual **in advance** as expected and unexplained; it carries no verdict authority (K6.7)
  and is filed for write-back, not closed here.
- **The `-ar1` cell 29 row is now a genuine matched-process reading.** Under C1.3 the pre-C1
  held-out rows for this cell carried no serial structure at all (`acf(1) = 0.2687` against
  `φ = 0.600`); the corrected draw measures `acf(1) = 0.5957`, `acf(2) = 0.3616`,
  `acf(3) = 0.2091` against theory 0.600 / 0.360 / 0.216. Both runs read `0.0000`, so the
  correction moves no endpoint — it makes the row mean what it was registered to mean.
- **Non-monotonicity across the grid persists**: `d = 1.0` reads 0.0010 (2 crossings) and
  `d = 1.5` reads 0.0000 (0), so the higher severity detects less. At counts of 2 and 0 out of
  2000 this is noise, not a mechanism, and it is recorded without one.
- **`increment_estimator.lower95_one_sided = 0.4291762955382734`** does not meet K6.7's
  `> 1` filing condition, so `stats/terminal-mean-rule-contested` gains nothing from this arm.
