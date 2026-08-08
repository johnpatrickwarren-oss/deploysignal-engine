# Coverage battery `run-20260808T064039Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number and
verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`f84fadf` are unmodified, and no number below comes from a new run of the battery. Every table
below was generated mechanically from the committed `summary.json` beside this file, not
transcribed by hand. Follows the `run-20260808T010208Z/REPORT.md` precedent.

Written 2026-08-08 in the final fix wave, closing Task 5's own carry: "no in-repo run REPORT.md
(harness guard blocked it); endpoints have no tracked narrative outside JSON — fix at write-back."

**READ THIS RUN WITH ITS SUPERSESSION.** Amendment v2.C1 names a code defect in the held-out row
generator this run used (`heldoutRows`, `run-battery.mjs`: each of the 10,000 rows was the first
gaussian of its own arithmetically-spaced LCG stream, making the calibration reference a rank-1
Kronecker lattice rather than a sample). Every `family_E_conformal_heldout` and
`point_tail_bet_e_value` row below calibrated against that reference. The rows are preserved and
are real readings, but they are **superseded for scoring** by `run-20260808T133859Z`, which
declares the supersession in its own manifest. `safe_t` takes no held-out calibration and its
four rows are bit-identical in the rerun (verified, 0 field diffs). §4 gives the corrected numbers.

| field | value |
|---|---|
| run id | `run-20260808T064039Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K4`, one invocation |
| `git_sha` at run | `43f3386c7bd8a9963c1ce80988f35e57c7665383` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| classes run | `K4` |
| held-out draw | `HELDOUT_SEED = CELL_SEED + 500000; seed(j) = HELDOUT_SEED + 7919*j, j = 0..9999` |
| rows emitted | 16 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |

## 1. The endpoint table — every `(K4 cell, detector)` row

`COVERAGE_FLOOR = 0.50` applies at the φ=0 canonical cell only (§8, §10.1). Grid and `-ar1`
cells are recorded context and decide nothing.

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 18 | K4 | `3sigma-point` | no | 0 | `family_E_conformal_heldout` | 89/2000 | 0.0445 | INERT |
| 18 | K4 | `3sigma-point` | no | 0 | `point_tail_bet_e_value` | 1011/2000 | 0.5055 | POWERED |
| 18 | K4 | `3sigma-point` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `family_E_conformal_heldout` | 86/2000 | 0.0430 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `point_tail_bet_e_value` | 1950/2000 | 0.9750 | POWERED |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `family_E_conformal_heldout` | 104/2000 | 0.0520 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `point_tail_bet_e_value` | 2000/2000 | 1 | POWERED |
| 20 | K4 | `8sigma-point` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `family_E_conformal_heldout` | 268/2000 | 0.1340 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `point_tail_bet_e_value` | 1958/2000 | 0.9790 | POWERED |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0 | INERT |

## 2. The A1 arm rows — validity (S2) and power (S3)

| idx | detector | arm | n | class instrument | reading | lower_95 | verdict |
|---|---|---|---|---|---|---|---|
| 31 | `family_E_conformal_heldout` | healthy | 2000 | `exceedance` / `mean_e` | 0.028000 / mean_e 3.116048 | 0.02254017183440872 | not-refuted |
| 31 | `family_E_conformal_heldout` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |
| 32 | `point_tail_bet_e_value` | healthy | 2000 | `exceedance` / `mean_e` | 0.002530 / mean_e 0.635096 (k=1012/n_points=400000) | 0.002402661467871697 | not-refuted |
| 32 | `point_tail_bet_e_value` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |

### Registered secondary fields, `point_tail_bet_e_value`

- **cell 18 `3sigma-point`** — cal_median 0.00020601995399109694 / cal_mad 0.6707177384018341; window_crossing_rate 0.7115; point_non_finite 0; heldout_seed 20760825 / heldout_rows 10000
- **cell 19 `5sigma-point`** — cal_median -0.00019420715664679483 / cal_mad 0.6720358514211853; window_crossing_rate 0.9860; point_non_finite 0; heldout_seed 20760826 / heldout_rows 10000
- **cell 20 `8sigma-point`** — cal_median -0.0004685864892835873 / cal_mad 0.6749061580665298; window_crossing_rate 1; point_non_finite 0; heldout_seed 20760827 / heldout_rows 10000
- **cell 21 `5sigma-point-ar1`** — cal_median 0.0076767294056060975 / cal_mad 0.675161572502539; window_crossing_rate 0.9860; point_non_finite 0; heldout_seed 20760828 / heldout_rows 10000
- **arm 32 healthy** — cal_median 0.0002141666862827221 / cal_mad 0.6768543390645476; point_non_finite 0; heldout_seed 20760839 / heldout_rows 10000
- **arm 32 power** — cal_median 0.0002141666862827221 / cal_mad 0.6768543390645476; point_non_finite 0; heldout_seed 20760839 / heldout_rows 10000

### Registered secondary fields, `family_E_conformal_heldout`

- **cell 18 `3sigma-point`** — indicator_rate_at_injected_tick 0.8660; heldout_seed 20760825 / heldout_rows 10000
- **cell 19 `5sigma-point`** — indicator_rate_at_injected_tick 0.9990; heldout_seed 20760826 / heldout_rows 10000
- **cell 20 `8sigma-point`** — indicator_rate_at_injected_tick 1; heldout_seed 20760827 / heldout_rows 10000
- **cell 21 `5sigma-point-ar1`** — indicator_rate_at_injected_tick 1; heldout_seed 20760828 / heldout_rows 10000
- **arm 31 healthy** — heldout_seed 20760838 / heldout_rows 10000
- **arm 31 power** — heldout_seed 20760838 / heldout_rows 10000

## 3. Stop-condition readings

K4.7's registered stop condition is arm 32's **per-point** Wilson 95% lower bound on the healthy
exceedance rate, against `alpha = 0.05`. As recorded: `k = 1012`, `n_points = 400000`,
`exceedance = 0.00253`, `lower_95 = 0.002402661467871697`. **0.002402661467871697 <= 0.05, so
the stop condition did not fire** and the S2 row cleared as `not-refuted`. Recomputed from the
recorded `k` and `n_points` at `z = 1.645` by the harness's own `lower95` formula
(`run-battery.mjs`, copied from `terminal-evalue/harness/run.mjs:50-52`) — agrees to the last
digit.

Arm 31's own token also cleared (`lower_95 = 0.02254017183440872 <= 0.05`), and was then
**overridden at the card** by the terminal mean rule: `mean_e = 3.11604757789375` exceeds
`TERMINAL_MEAN_BOUND = 1`, which maps the cell REFUTED and the card REFUSE. That override is the
scorer's, not this run's; it is recorded here because a reader of `summary.json` alone would see
`not-refuted` and conclude the wrong thing about the card.

## 4. What the corrected rerun measured — the C1 delta on this run's rows (post-hoc, no verdict)

Labelled post-hoc per §11 rule 3, carrying no verdict of its own. Numbers from
`run-20260808T133859Z/summary.json`.

| row | this run (lattice reference) | `run-20260808T133859Z` (corrected) | direction of this run's error |
|---|---|---|---|
| `point_tail` cell 18 `3sigma-point` | 0.5055 POWERED | 0.4870 INERT | anti-conservative (power overstated) |
| `point_tail` cell 19 canonical | 0.9750 | 0.9780 | conservative (power understated) |
| `point_tail` cell 20 `8sigma-point` | 1.0000 | 1.0000 | none |
| `point_tail` cell 21 `-ar1` | 0.9790 | 0.9780 | anti-conservative, immaterial |
| `point_tail` arm 32 S2 exceedance | 0.00253 (k=1012) | 0.001855 (k=742) | conservative (false alarms overstated) |
| `point_tail` arm 32 S2 `mean_e` | 0.6350959226365732 | 0.5275562291180412 | both under the bound of 1 |
| `family_E` cell 18 | 0.0445 | 0.0765 | conservative |
| `family_E` cell 19 canonical | 0.0430 | 0.0360 | anti-conservative |
| `family_E` cell 20 | 0.0520 | 0.0450 | anti-conservative |
| `family_E` cell 21 `-ar1` | 0.1340 | 0.1155 | anti-conservative |
| `family_E` arm 31 S2 exceedance / `mean_e` | 0.0280 / 3.11604757789375 | 0.0455 / 4.175984181731008 | **anti-conservative — false alarms UNDERSTATED** |

**One per-cell verdict moved: cell 18, POWERED to INERT, across the `0.50` floor.** It is a grid
cell, so it decides nothing: `coverageFor` reads the canonical cell alone and a fault cell carries
no `shift_sigma`, so it never enters `scoreS3`. **No card verdict and no class answer moved.**

**Cell 21's `-ar1` reading here is out of claim.** Amendment v2.C1 C1.3 re-registers it: the
held-out rows for a φ=0.6 cell carried no serial structure at all under the old generator
(measured `acf(1) = 0.2683` against `φ = 0.600`, `acf(2) = -0.3164` against `φ² = 0.360`),
so this row is a mismatched-φ reading, not the matched-process replicate it was registered as. Only
the rerun's cell-21 row may be cited as matched `-ar1` evidence.

## 5. Errata carried, not resolved

- **Arm 31 stamps `params: "oracle"`** while calibrating from held-out empirical rows — the
  Erratum v1.3 defect class, predating this run and not corrected by it. `point_tail_bet_e_value`
  stamps the accurate `heldout-empirical` literal (K4.1.5); `family_E_conformal_heldout` does
  not.
- **K4.1.10 remains open**: this construction's conformal exchangeability is O(1/n)-approximate and
  mildly anti-conservative because the median/MAD are fit from the same rows they are ranked
  against. Carried on the card's `regime.exchangeability_note`; the card's guarantee sentence was
  corrected in the fix wave to stop contradicting that note, but the defect itself is unresolved.
