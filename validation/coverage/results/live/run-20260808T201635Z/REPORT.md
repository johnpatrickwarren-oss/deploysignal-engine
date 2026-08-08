# Coverage battery `run-20260808T201635Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number
and verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at `0bc6537`
are unmodified, and no number below comes from a new run of the battery. Every table was
generated mechanically from the committed `summary.json` beside this file (and, for the
bit-identity table, from `run-20260808T010208Z/summary.json`), not transcribed by hand.

**THE RUN AMENDMENT v2.K5R AUTHORIZES.** K5's registered grid tested a drift no detector could
reach: `injectDrift` adds `slope*(t-at)*sigma` over `(t-at) = 0…199`, so the retired canonical
`slope1e-4` reaches a terminal shift of `0.0199σ` and a scored-window mean shift of `0.00995σ` —
`1/75` of K1's smallest registered step — and on 14,000 paired trajectories **0** changed their
`e >= 20` decision when that drift was applied (K5R.2; v2.K5R.1 K5R.1.4 corrects the zero to a
measurement on one seed family, order `1` flip in `10,000`–`40,000` across three). This run
measures the re-registered grid, whose canonical `slope1e-2` (idx 40) reaches `1.99σ` cumulative
while its per-tick increment stays `0.01σ`.

The three old grid cells and the old `-ar1` replicate are **re-measured, not withdrawn**: they are
correct measurements of a different question (K5R.4) and they decide nothing.

| field | value |
|---|---|
| run id | `run-20260808T201635Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K1,K2,K5 --supersedes ... --supersedes-reason ...`, one invocation |
| `git_sha` at run | `6f44f7b95213a09c819b67f6db6045fe89c04292` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`, unchanged — K5R.3 registers that `inject.mjs` is not edited) |
| tier | T1 (A7's registered fallback) |
| classes run | `K1, K2, K5` (K5R.6's verified lossless scope) |
| K5 cell indices | `[22,23,24,25,38,39,40,41,42]` — old 22-25, new 38-42 (K5R.5; 35-37 are reserved seeds) |
| rows emitted | 44 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |
| supersedes | `coverage/run-20260808T010208Z` → `safe_t`, `universal_inference`, `group_average_e_value` |

## 1. The stop/cancel checks, run before any number here was read as a result

K5R.9 registers one cancel-and-refile condition for this run: if any healthy-arm endpoint it
emits differs in any digit from the superseded run's, the run is cancelled and refiled, because
identical seeds through untouched code must give identical numbers. K5R.6 check (1) applies the
same bit-identity requirement to the K1/K2 fault rows and arm 30's power row, with a different
consequence: there a difference is a supersession-blocking code defect, not a cancelled run.
Both were evaluated first.

| check | consequence if it fails | result |
|---|---|---|
| arm 30 healthy row bit-identical (`exceedance`, `mean_e`, `lower_95`, `verdict`, `n`) | **cancel and refile** (K5R.9) | **PASS** — identical |
| all 26 re-measured K1/K2/arm rows bit-identical, field for field | **supersession blocked**, defect reported (K5R.6 check 1) | **PASS** — 26/26 identical |
| `substrate_sha256` equals the registered value | supersession blocked (K5R.6 check 2) | **PASS** |

Arm 30's healthy row, in full, both runs:

| run | n | `exceedance` | `mean_e` | `lower_95` | verdict |
|---|---|---|---|---|---|
| `run-20260808T010208Z` | 2000 | 0.0005 | 1.9140717432761356 | 0.00011154140419308663 | not-refuted |
| `run-20260808T201635Z` | 2000 | 0.0005 | 1.9140717432761356 | 0.00011154140419308663 | not-refuted |

The trigger did not fire. **The re-measurement is not a new measurement of the arm** — it is the
same measurement, which is what K5R.8 registered and what K5R.6 disclosed the scope forces.

## 2. The K5 endpoint table — every `(cell, detector)` row, with its registered prediction

`predicted` and the `±3 SE` band are K5R.7's, registered before this run. The widened band is
K5R.1.3's disclosed alternative reading (every SE inflated by `sqrt(1.857) = 1.363`, the largest
valid per-block dispersion measured in the probe).

| idx | severity | canonical | φ | detector | fires/n | detection_rate | verdict | predicted | ±3 SE band | in band | widened band |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 22 | `slope5e-5` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT | 0.0006 | [0.0000, 0.0022] | yes | [0.0000, 0.0028] |
| 22 | `slope5e-5` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT | 0.0001 | [0.0000, 0.0008] | yes | [0.0000, 0.0010] |
| 23 | `slope1e-4` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT | 0.0006 | [0.0000, 0.0022] | yes | [0.0000, 0.0028] |
| 23 | `slope1e-4` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT | 0.0001 | [0.0000, 0.0008] | yes | [0.0000, 0.0010] |
| 24 | `slope5e-4` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT | 0.0009 | [0.0000, 0.0029] | yes | [0.0000, 0.0036] |
| 24 | `slope5e-4` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT | 0.0003 | [0.0000, 0.0015] | yes | [0.0000, 0.0019] |
| 25 | `slope1e-4-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0.0000 | INERT | 0.0005 | [0.0000, 0.0020] | yes | [0.0000, 0.0025] |
| 25 | `slope1e-4-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0.0000 | INERT | 0.0003 | [0.0000, 0.0015] | yes | [0.0000, 0.0019] |
| 38 | `slope2.5e-3` | no | 0 | `safe_t` | 110/2000 | 0.0550 | INERT | 0.0518 | [0.0369, 0.0667] | yes | [0.0315, 0.0721] |
| 38 | `slope2.5e-3` | no | 0 | `universal_inference` | 20/2000 | 0.0100 | INERT | 0.0105 | [0.0037, 0.0173] | yes | [0.0012, 0.0198] |
| 39 | `slope5e-3` | no | 0 | `safe_t` | 1167/2000 | 0.5835 | POWERED | 0.5781 | [0.5450, 0.6112] | yes | [0.5330, 0.6232] |
| 39 | `slope5e-3` | no | 0 | `universal_inference` | 59/2000 | 0.0295 | INERT | 0.0324 | [0.0205, 0.0443] | yes | [0.0162, 0.0486] |
| 40 | `slope1e-2` | **yes** | 0 | `safe_t` | 1999/2000 | 0.9995 | POWERED | 0.9999 | [0.9992, 1.0000] | yes | [0.9990, 1.0000] |
| 40 | `slope1e-2` | **yes** | 0 | `universal_inference` | 6/2000 | 0.0030 | INERT | 0.0016 | [0.0000, 0.0043] | yes | [0.0000, 0.0053] |
| 41 | `slope2e-2` | no | 0 | `safe_t` | 2000/2000 | 1.0000 | POWERED | 1.0000 | [1.0000, 1.0000] | yes | [1.0000, 1.0000] |
| 41 | `slope2e-2` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT | 0.0000 | [0.0000, 0.0000] | yes | [0.0000, 0.0000] |
| 42 | `slope1e-2-ar1` | no | 0.6 | `safe_t` | 1241/2000 | 0.6205 | POWERED | 0.6165 | [0.5839, 0.6491] | yes | [0.5721, 0.6609] |
| 42 | `slope1e-2-ar1` | no | 0.6 | `universal_inference` | 15/2000 | 0.0075 | INERT | 0.0104 | [0.0036, 0.0172] | yes | [0.0011, 0.0197] |

**18 prediction rows, 0 outside the registered ±3 SE band.** No deviation to record.

The canonical decision, as `coverageFor` reads it (`score.mjs:397-402`):

| detector | canonical cell | detection_rate | `COVERAGE_FLOOR` | status |
|---|---|---|---|---|
| `safe_t` | idx 40 `slope1e-2` | 0.9995 | 0.50 | **COVERED** |
| `universal_inference` | idx 40 `slope1e-2` | 0.0030 | 0.50 | NOT_POWERED |

## 3. The re-measured K1 and K2 rows — every one bit-identical to the run it supersedes

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict | identical to superseded |
|---|---|---|---|---|---|---|---|---|---|
| 0 | K1 | `0.75sigma` | no | 0 | `safe_t` | 1967/2000 | 0.9835 | POWERED | yes |
| 0 | K1 | `0.75sigma` | no | 0 | `universal_inference` | 1308/2000 | 0.6540 | POWERED | yes |
| 1 | K1 | `1.5sigma` | **yes** | 0 | `safe_t` | 2000/2000 | 1.0000 | POWERED | yes |
| 1 | K1 | `1.5sigma` | **yes** | 0 | `universal_inference` | 1975/2000 | 0.9875 | POWERED | yes |
| 2 | K1 | `3sigma` | no | 0 | `safe_t` | 2000/2000 | 1.0000 | POWERED | yes |
| 2 | K1 | `3sigma` | no | 0 | `universal_inference` | 2000/2000 | 1.0000 | POWERED | yes |
| 3 | K1 | `1.5sigma-ar1` | no | 0.6 | `safe_t` | 1984/2000 | 0.9920 | POWERED | yes |
| 3 | K1 | `1.5sigma-ar1` | no | 0.6 | `universal_inference` | 1000/2000 | 0.5000 | POWERED | yes |
| 4 | K2 | `K5-e0.25sigma` | no | 0 | `group_average_e_value` | 235/2000 | 0.1175 | INERT | yes |
| 4 | K2 | `K5-e0.25sigma` | no | 0 | `safe_t` | 105/2000 | 0.0525 | INERT | yes |
| 5 | K2 | `K5-e0.5sigma` | no | 0 | `group_average_e_value` | 1946/2000 | 0.9730 | POWERED | yes |
| 5 | K2 | `K5-e0.5sigma` | no | 0 | `safe_t` | 1234/2000 | 0.6170 | POWERED | yes |
| 6 | K2 | `K10-e0.25sigma` | no | 0 | `group_average_e_value` | 366/2000 | 0.1830 | INERT | yes |
| 6 | K2 | `K10-e0.25sigma` | no | 0 | `safe_t` | 129/2000 | 0.0645 | INERT | yes |
| 7 | K2 | `K10-e0.5sigma` | **yes** | 0 | `group_average_e_value` | 1997/2000 | 0.9985 | POWERED | yes |
| 7 | K2 | `K10-e0.5sigma` | **yes** | 0 | `safe_t` | 1221/2000 | 0.6105 | POWERED | yes |
| 8 | K2 | `K10-e0.75sigma` | no | 0 | `group_average_e_value` | 2000/2000 | 1.0000 | POWERED | yes |
| 8 | K2 | `K10-e0.75sigma` | no | 0 | `safe_t` | 1966/2000 | 0.9830 | POWERED | yes |
| 9 | K2 | `K20-e0.25sigma` | no | 0 | `group_average_e_value` | 479/2000 | 0.2395 | INERT | yes |
| 9 | K2 | `K20-e0.25sigma` | no | 0 | `safe_t` | 107/2000 | 0.0535 | INERT | yes |
| 10 | K2 | `K20-e0.5sigma` | no | 0 | `group_average_e_value` | 2000/2000 | 1.0000 | POWERED | yes |
| 10 | K2 | `K20-e0.5sigma` | no | 0 | `safe_t` | 1250/2000 | 0.6250 | POWERED | yes |
| 11 | K2 | `K10-e0.5sigma-ar1` | no | 0.6 | `group_average_e_value` | 280/2000 | 0.1400 | INERT | yes |
| 11 | K2 | `K10-e0.5sigma-ar1` | no | 0.6 | `safe_t` | 104/2000 | 0.0520 | INERT | yes |

## 4. The arm-30 rows — validity (S2) and 3σ power (S3)

| idx | detector | arm | n | reading | lower_95 | shift_sigma | verdict | identical to superseded |
|---|---|---|---|---|---|---|---|---|
| 30 | `group_average_e_value` | healthy | 2000 | exceedance 0.0005 / mean_e 1.9140717432761356 | 0.00011154140419308663 | — | not-refuted | yes |
| 30 | `group_average_e_value` | power | 2000 | detection_rate 1.0000 | — | 3 | POWERED | yes |

## 5. Supersession provenance

K5R.6 registers why this declaration exists. `canonicalOf` (`run-battery.mjs:281`) writes the
`canonical` flag from `FAULT_CLASSES[K].canonical` at run time, `coverageFor` keys COVERED on
that field alone (`score.mjs:397-402`), and `loadEvidence` pools every run under
`validation/*/results/live/` with no cross-run dedup (`collect.mjs:311-341`). Without the
declaration, `run-20260808T010208Z`'s rows would still carry `canonical: true` at the RETIRED severity
`slope1e-4` and K5 would have two canonical cells at two severities with two different rates.

| declaration | detectors | rows dropped | replacement in this run |
|---|---|---|---|
| `coverage/run-20260808T010208Z` | `safe_t` | 30 | 21 rows here; classes not re-emitted: K3, K4, K6 |
| `coverage/run-20260808T010208Z` | `universal_inference` | 18 | 13 rows here; classes not re-emitted: K3, K6 |
| `coverage/run-20260808T010208Z` | `group_average_e_value` | 10 | 10 rows here; classes not re-emitted: none |

The classes not re-emitted survive in later runs, which is what makes the whole-run-per-detector
granularity lossless here: `safe_t`/`universal_inference` K3 in `run-20260808T091521Z`, `safe_t`
K4 in `run-20260808T133859Z`, `safe_t`/`universal_inference` K6 in `run-20260808T133746Z` and
`run-20260808T121548Z`. The superseded directory is preserved byte-for-byte; only its scoring is
withdrawn, and the certification `REPORT.md` prints every dropped row with its reason.

## 6. The class answer

**K5 = YES**, as K5R.10 registered before the run. `safe_t`'s canonical cell reads `0.9995` (1999/2000), above `COVERAGE_FLOOR = 0.50`, and `safe_t_e_value`'s card verdict is `USE`, so both
gates pass (`coverageFor`, then `verdict.mjs:272`). Tier T1. `universal_inference` reads `0.0030` (6/2000) — NOT_POWERED, so the class answer rests on one
detector, also as registered.

The falsifier registered for this run (A4's shape, `idx 23` superseded by `idx 40`): K5 would
have been falsified iff the canonical cell read `< 0.50` for **both** detectors. It did not.

## 7. Post-hoc — carries no verdict

Per §11 rule 3. Nothing here informed any threshold, grid, falsifier or verdict. Nothing was
tuned and nothing was re-run.

### Where `safe_t` crosses the floor: between `slope2.5e-3` and `slope5e-3`

`safe_t`'s measured rates across the four new severities are `0.0550` (0.4975σ), `0.5835` (0.995σ), `0.9995` (1.99σ), `1.0000` (3.98σ).
The `0.50` floor is bracketed by `slope2.5e-3` at `0.0550` (0.4975σ terminal)
and `slope5e-3` at `0.5835` (0.995σ terminal) — so the crossing sits
between a `0.4975σ` and a `0.995σ` cumulative drift, and the `0.995σ` cell clears
the floor by `0.08`. K5R.12 registered that no interpolated "detection threshold slope" would be
read off this grid, and none is.

### `universal_inference` is anti-powered against a ramp, and the run reproduces it

Measured here: `0.0100`, `0.0295`, `0.0030`, `0.0000` — non-monotone, peaking at the `1σ`
cell and falling to `0.0000` at the largest drift, exactly the shape K5R.7 registered from the
probe. The mechanism is in the split: the alternative's test-regime mean is fitted on
`[100,200)` and scored on `[200,300)` (`detectors/universal-inference-e-value.ts:216-226`), so
the plug-in mean is short by exactly `slope*100`. Filed as a finding, not resolved:
`sequential-ui.ts`'s predictable plug-in (ADR 0025) is the successor to test, and nothing about
it is registered.

### The preserved cells reproduce their own retired measurement

The four old cells were re-run at their own unchanged `CELL_SEED`s, and `safe_t` reads
`slope5e-5` 0.0005 → 0.0005, `slope1e-4` 0.0000 → 0.0000, `slope5e-4` 0.0005 → 0.0005, `slope1e-4-ar1` 0.0000 → 0.0000 — identical, as the seeds require. They are the same measurement of the
same question, now carrying `canonical: false`.

