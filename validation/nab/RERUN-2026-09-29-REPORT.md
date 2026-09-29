# Report — the two NAB T3 harnesses at the DeploySignal pin (`2026-09-nab-rerun-v0.12.2`, C85 part 3)

- **Registration:** `RERUN-2026-09-29-PREREGISTRATION.md`, committed `137124f` before either harness ran.
- **Engine:** `0.12.2-pre` at `137124f` (tag `v0.12.2-pre` plus ADR 0036 text and two envelope note strings). NAB at `ea702d7`. Node v25.9.0. Exceptions: 0 in both runs.
- **Runs:** `time-to-alert/results/live/run-20260929T014900Z` beside `run-20260905T025224Z`; `null-survival/results/live/run-20260929T014948Z` beside `run-20260905T050636Z`. Each run's own `REPORT.md` is rendered by its study's `analysis/report.mjs` and re-checked by its `check_report.mjs` (both pass). `analysis/check_rerun_2026_09_29.mjs` pins this report to the four directories.

## D1 — the engine delta

**Zero.** Every cell of both 2026-09-05 runs is reproduced field for field at the pin: the 7 cells of `time-to-alert` (mixture and betting at α 0.05 and 0.01, the e-SR at α_ARL 10⁻³: `n_pre` 14/11/11/11/20, the falsifier-2 reading "does not fire" in every cell) and the 44 cells of `null-survival` (every construction, level and head-length arm, the survivor set unchanged: universal inference in every arm, the sequential UI at 0.15, the e-SR by its ARL contract in every arm, the mixture, betting and safe-t in none). Step 2 was licensed by step 1's exact reproduction of C75's counts (14, 11, 20), as registered.

**Four new cells.** The bounded-bet e-SR (ADR 0031), absent on 2026-09-05, is present at the pin and ran in `null-survival` at α_ARL 10⁻³: alerting 19/22/22/21 of 23 quiet stretches at arms tool/0.15/0.30/0.50 against ARL bars 24/29/27/24, so P1 reads HELD in every arm; by-end detection 0.957/1.000/1.000/1.000. It alerts on nearly every quiet stretch and holds its contract, because that contract is one alert per thousand ticks per stream, exactly as the Gaussian e-SR's row already showed.

## Predictions

- P1 held: step 1 reproduced (14, 11, 20). P2 held: the falsifier-2 reading is unchanged.
- P3 half held. The survivor set is unchanged. Its clause "the e-SR and bounded e-SR clear no arm" was wrong as written: the harness scores the e-SR family against its ARL contract, under which both kinds read HELD in every arm, on 2026-09-05 as now; what they do not survive is the per-stretch false-alert contract the wiki's narrative used. The registration should have said so.

## What this establishes

The wiki's T3 numbers for the temporal path's detector cards on NAB, recorded at engine v0.6.11-era commits, are the numbers at DeploySignal's pin: nothing between `eb60e63`/`4ce20f8` and `v0.12.2-pre` changed a single alert tick on these 23 series. The bounded e-SR is added to the record with the same reading as the Gaussian one. Nothing here bears on DeploySignal's gate, which the GWDG study (C85 part 1) measured.
