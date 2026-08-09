# Coverage battery `run-20260808T133859Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number and
verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`7ad0f3a` are unmodified, and no number below comes from a new run of the battery. Every table
below was generated mechanically from the committed `summary.json` beside this file, not
transcribed by hand.

**THE REGISTERED SAME-DEFECT RERUN.** Amendment v2.C1 C1.5 registers this run: K4's cells 18-21 and
arms 31/32 all calibrate on `heldoutRows`, so their rows change under the C1 fix even though no
K4 card verdict and no K4 class answer does. It is run for consistency of the corpus, not because a
K4 endpoint was in doubt — and the amendment registered in advance that **any** K4 card-verdict or
class-answer movement would be a surprise to report, not to absorb. None occurred.

Prior runs `run-20260808T064039Z` and `run-20260808T010208Z` are preserved byte-for-byte. This
run's manifest declares supersession at `(run-20260808T064039Z, family_E_conformal_heldout +
point_tail_bet_e_value)` and `(run-20260808T010208Z, family_E_conformal_heldout)` — **not** at
whole-run granularity: `run-20260808T010208Z` holds `safe_t`, `universal_inference`,
`group_average_e_value` and `family_D_spectral_e_detector` rows across five other classes that
take no held-out calibration, and dropping the directory would have deleted four classes of sound
evidence to correct one detector's rows.

| field | value |
|---|---|
| run id | `run-20260808T133859Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K4 --supersedes ... --supersedes-reason ...`, one invocation |
| `git_sha` at run | `ef586477e4b403e676ab3a9b0529306f43a53337` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| classes run | `K4` |
| held-out draw | `HELDOUT_SEED = CELL_SEED + 500000; rows are 10000 CONSECUTIVE draws from one continuously-advanced rng(HELDOUT_SEED) stream (Amendment v2.C1 C1.2, superseding the pre-C1 seed(j) = HELDOUT_SEED + 7919*j scheme)` |
| rows emitted | 16 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |
| supersedes | `coverage/run-20260808T064039Z` → `family_E_conformal_heldout`, `point_tail_bet_e_value`; `coverage/run-20260808T010208Z` → `family_E_conformal_heldout` |

## 1. The endpoint table — every `(K4 cell, detector)` row

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 18 | K4 | `3sigma-point` | no | 0 | `family_E_conformal_heldout` | 153/2000 | 0.0765 | INERT |
| 18 | K4 | `3sigma-point` | no | 0 | `point_tail_bet_e_value` | 974/2000 | 0.4870 | INERT |
| 18 | K4 | `3sigma-point` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `family_E_conformal_heldout` | 72/2000 | 0.0360 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `point_tail_bet_e_value` | 1956/2000 | 0.9780 | POWERED |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `family_E_conformal_heldout` | 90/2000 | 0.0450 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `point_tail_bet_e_value` | 2000/2000 | 1 | POWERED |
| 20 | K4 | `8sigma-point` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `family_E_conformal_heldout` | 231/2000 | 0.1155 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `point_tail_bet_e_value` | 1956/2000 | 0.9780 | POWERED |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0 | INERT |

## 2. The A1 arm rows — validity (S2) and power (S3)

| idx | detector | arm | n | class instrument | reading | lower_95 | verdict |
|---|---|---|---|---|---|---|---|
| 31 | `family_E_conformal_heldout` | healthy | 2000 | `exceedance` / `mean_e` | 0.045500 / mean_e 4.175984 | 0.038429145301453534 | not-refuted |
| 31 | `family_E_conformal_heldout` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |
| 32 | `point_tail_bet_e_value` | healthy | 2000 | `exceedance` / `mean_e` | 0.001855 / mean_e 0.527556 (k=742/n_points=400000) | 0.0017464003916289452 | not-refuted |
| 32 | `point_tail_bet_e_value` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |

### Registered secondary fields, `point_tail_bet_e_value`

- **cell 18 `3sigma-point`** — cal_median 0.03458090874019333 / cal_mad 0.6765566855256222; window_crossing_rate 0.7020; point_non_finite 0; heldout_seed 20760825 / heldout_rows 10000
- **cell 19 `5sigma-point`** — cal_median -0.021820976775561135 / cal_mad 0.6823154246507988; window_crossing_rate 0.9885; point_non_finite 0; heldout_seed 20760826 / heldout_rows 10000
- **cell 20 `8sigma-point`** — cal_median 0.010798604565185742 / cal_mad 0.6740057849804615; window_crossing_rate 1; point_non_finite 0; heldout_seed 20760827 / heldout_rows 10000
- **cell 21 `5sigma-point-ar1`** — cal_median 0.002586783233511497 / cal_mad 0.6762580993856622; window_crossing_rate 0.9850; point_non_finite 0; heldout_seed 20760828 / heldout_rows 10000
- **arm 32 healthy** — cal_median 0.022480571769161267 / cal_mad 0.6649691709484897; point_non_finite 0; heldout_seed 20760839 / heldout_rows 10000
- **arm 32 power** — cal_median 0.022480571769161267 / cal_mad 0.6649691709484897; point_non_finite 0; heldout_seed 20760839 / heldout_rows 10000

### Registered secondary fields, `family_E_conformal_heldout`

- **cell 18 `3sigma-point`** — indicator_rate_at_injected_tick 0.8695; heldout_seed 20760825 / heldout_rows 10000
- **cell 19 `5sigma-point`** — indicator_rate_at_injected_tick 0.9990; heldout_seed 20760826 / heldout_rows 10000
- **cell 20 `8sigma-point`** — indicator_rate_at_injected_tick 1; heldout_seed 20760827 / heldout_rows 10000
- **cell 21 `5sigma-point-ar1`** — indicator_rate_at_injected_tick 1; heldout_seed 20760828 / heldout_rows 10000
- **arm 31 healthy** — heldout_seed 20760838 / heldout_rows 10000
- **arm 31 power** — heldout_seed 20760838 / heldout_rows 10000

## 3. Stop-condition readings

K4.7's registered stop condition is arm 32's **per-point** Wilson 95% lower bound on the healthy
exceedance rate against `alpha = 0.05`. **As recorded: `k = 742`, `n_points = 400000`,
`exceedance = 0.001855`, `lower_95 = 0.0017464003916289452`.** Recomputed from `k` and
`n_points` at `z = 1.645` through the harness's own `lower95` formula — agrees to the last
digit. **0.0017464003916289452 <= 0.05, so the stop condition did not fire** and S2 cleared as
`not-refuted`. `mean_e = 0.5275562291180412` sits under `TERMINAL_MEAN_BOUND = 1`, so the
terminal mean rule did not override that clearance — which is the whole difference between this
card's USE and `family_E_conformal_heldout`'s REFUSE.

Arm 31's own token also cleared (`lower_95 = 0.038429145301453534 <= 0.05`) and was overridden at
the card exactly as before: `mean_e = 4.175984181731008` exceeds `TERMINAL_MEAN_BOUND = 1`, so
the cell maps REFUTED and the card REFUSE. **The margin over the bound grew** (3.1160 → 4.1760):
the lattice had been understating this card's false-alarm rate.

## 4. Every registered prediction against its reading

**All eighteen held. Zero surprises.**

| row | prior (lattice) | registered prediction | band | MEASURED | held |
|---|---|---|---|---|---|
| `point_tail` cell 18 `3sigma-point` | 0.5055 POWERED | 0.4870 | [0.45, 0.53] | **0.4870 INERT** | ✓ |
| `point_tail` cell 19 **canonical** | 0.9750 | 0.9780 | ≥ 0.95 | **0.9780 POWERED** | ✓ |
| `point_tail` cell 20 `8sigma-point` | 1.0000 | 1.0000 | ≥ 0.99 | **1.0000 POWERED** | ✓ |
| `point_tail` cell 21 `-ar1` | 0.9790 | 0.9780 | ≥ 0.95 | **0.9780 POWERED** | ✓ |
| `point_tail` arm 32 S2 `k`/`n_points` | 1012 / 400000 | 742 / 400000 | — | **742 / 400000** | ✓ exact |
| arm 32 S2 `exceedance` | 0.00253 | 0.001855 | ≤ 0.01 | **0.001855** | ✓ exact |
| arm 32 S2 `mean_e` | 0.6350959226365732 | 0.527556 | < 1 | **0.5275562291180412** | ✓ |
| arm 32 S2 `lower_95` | 0.002402661467871697 | 0.0017464 | ≤ 0.05 | **0.0017464003916289452** | ✓ |
| arm 32 S3 `detection_rate` | 1.0000 | 1.0000 | ≥ 0.99 | **1.0000** | ✓ |
| `family_E` cell 18 | 0.0445 | 0.0765 | ≤ 0.15 | **0.0765** | ✓ exact |
| `family_E` cell 19 **canonical** | 0.0430 | 0.0360 | ≤ 0.15 | **0.0360** | ✓ exact |
| `family_E` cell 20 | 0.0520 | 0.0450 | ≤ 0.15 | **0.0450** | ✓ exact |
| `family_E` cell 21 `-ar1` | 0.1340 | 0.1155 | ≤ 0.20 | **0.1155** | ✓ exact |
| `family_E` arm 31 S2 `exceedance` | 0.0280 | 0.0455 | ≤ 0.05 | **0.0455** | ✓ exact |
| arm 31 S2 `mean_e` | 3.11604757789375 | 4.175984 | > 1 (rule fires) | **4.175984181731008** | ✓ |
| arm 31 S2 `lower_95` | 0.02254017183440872 | 0.0384292 | ≤ 0.05 | **0.038429145301453534** | ✓ |
| arm 31 S3 `detection_rate` | 1.0000 | 1.0000 | ≥ 0.99 | **1.0000** | ✓ |
| `safe_t` cells 18-21 | 0 / 0.0005 / 0 / 0 | bit-identical | exact | **bit-identical, 0 field diffs** | ✓ |

## 5. The one movement, named in advance

**`point_tail_bet_e_value` cell 18 crosses the coverage floor downward: 0.5055 → 0.4870, POWERED
→ INERT.** Registered in C1.5 rather than absorbed, because a `0.50`-floor crossing on a
registered row is exactly the kind of change that must be named before the run. It decides nothing:
`coverageFor` reads the canonical cell alone (`score.mjs:397-402`) and a fault cell carries no
`shift_sigma`, so it never enters `scoreS3` (`score.mjs:264-266`).

**No card verdict moved.** `point_tail_bet_e_value` USE / T1; `family_E_conformal_heldout`
REFUSE; `safe_t_e_value` USE / T1.

**K4 CLASS ANSWER UNCHANGED: YES**, carried by `point_tail_bet_e_value` at canonical cell 19,
`0.9780 >= COVERAGE_FLOOR 0.50`, tier T1.

## 6. The direction of this run's correction (post-hoc, no verdict)

Amendment v2.C1 C1.11 corrects the earlier "refutation-direction only" adjudication endpoint by
endpoint. Two rows in this run are the counterexamples:

- **`family_E` arm 31 S2 rose, 0.0280 → 0.0455 and `mean_e` 3.1160 → 4.1760.** The lattice was
  **understating** a card's false-alarm rate — anti-conservative in the *validity* direction, which
  the single-sign claim did not allow for.
- **`point_tail` cell 19 canonical rose, 0.9750 → 0.9780.** The lattice was understating *power*
  on the very cell that decides the class — conservative there, in the opposite direction from cell
  18's anti-conservative 0.5055 → 0.4870, two cells of the same detector on the same grid.

A reference-distribution defect has no global sign. Its sign is a property of the endpoint.

## 7. Errata carried, not resolved

- **Arm 31 still stamps `params: "oracle"`** while calibrating from held-out empirical rows — the
  Erratum v1.3 defect class, predating C1 and untouched by it.
- **K4.1.10 remains open.** The conformal exchangeability is O(1/n)-approximate and mildly
  anti-conservative because the median/MAD are fit from the same rows they are ranked against. The
  card's guarantee sentence was corrected in this fix wave to stop contradicting the card's own
  `regime.exchangeability_note`; the defect itself is unresolved and filed for write-back.
- **Cell 21's `-ar1` row is now a genuine matched-process reading** (C1.3): the corrected draw
  measures `acf(1) = 0.5946`, `acf(2) = 0.3500`, `acf(3) = 0.1986` against AR(1) theory
  0.600 / 0.360 / 0.216, where the pre-C1 draw measured 0.2683 / −0.3164 / −0.2029. Only this row,
  not the superseded one, may be cited as matched `-ar1` evidence.

## Append, dated 2026-08-09 — Erratum v1.4: the `params: 'oracle'` stamp on `family_E_conformal_heldout`, and its true scope on this run

Appended, not edited (§11 rule 6). Registered at `../../../PREREGISTRATION.md` **Erratum v1.4**
(WORKLIST `C47` item 2). **No cell, endpoint, threshold, seed or verdict on this run moves.**

**The field, quoted.** Every `family_E_conformal_heldout` row of this run carries `params:
'oracle'`, from the `else` branch of `harness/run-battery.mjs:1364` (fault cells) and `:1572` /
`:1631` (the arm's S2 / S3 rows).

**The true provenance.** This candidate takes neither §4's passed oracle constants nor the
100-tick calibration-window estimation Erratum v1.3 found in `safe_t` / `universal_inference` /
`group_average_e_value`. It uses a fixed `Σ = [[1]]` (A2) with an **empirical held-out calibration
set** — `HELDOUT_ROWS = 10,000` rows at `HELDOUT_SEED = CELL_SEED + HELDOUT_OFFSET` (§6's K4
block, A7's T1 substrate), stamped by `tools/stamp-heldout-family-e.mjs` — which this row records
correctly in its own `heldout_seed` and `heldout_rows` fields. The accurate literal is
`'heldout-empirical'`, registered for the three sibling calibrated candidates at K4.1.5, K6.9 and
K6A.1.10 and never for this one.

**Scope on this run: six rows, not one.** Cells **18, 19, 20, 21** (the K4 fault rows) *and* arm
**31**'s `healthy` and `power` rows. Where an earlier section of this report noted the stamp on
"arm 31" alone, that note understated the scope by the four fault rows; this append is the
correction.

**Why nothing is re-scored.** `params` reaches the certification scorer only through
`phiIsEstimated` (`validation/certification/lib/nulls.mjs`), which reads `phi_source` first and
then the single literal `'estimated-phi'`. All six rows carry `null_id` `N1` or `N3-p06`, so
`lib/collect.mjs`'s `annotatePhi` sets `phi_source: 'oracle'` and the `params` value is never
consulted; the literal appears zero times in `lib/score.mjs`. The mis-stamp misleads a reader, not
the mechanical verdict.

**Named-not-done.** The harness stamp is **not** changed by this erratum: the forward fix changes
a registered field's value and needs its own amendment, so future runs will still emit `'oracle'`
until one exists.
