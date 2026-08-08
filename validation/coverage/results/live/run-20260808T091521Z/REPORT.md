# Coverage battery `run-20260808T091521Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number and
verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`e42c2c1` are unmodified, and no number below comes from a new run of the battery. Every table
below was generated mechanically from the committed `summary.json` beside this file, not
transcribed by hand. Follows the `run-20260808T010208Z/REPORT.md` precedent.

Written 2026-08-08 in the final fix wave.

**THIS RUN IS UNAFFECTED BY THE C1 DEFECT, and the reason is structural, not lucky.**
`spectral_bet_e_process` takes `sigma` as an oracle constant; K3.3/K3.6 register that it has no
held-out calibration stream at all, `assertRegistryAgreement` encodes the same fact (no
`HELDOUT_SEED` for arm 33), and no row in this run's `summary.json` carries a `heldout_seed`
field. `heldoutRows` was never called. Nothing here is superseded and nothing was rerun.

| field | value |
|---|---|
| run id | `run-20260808T091521Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs --classes K3`, one invocation |
| `git_sha` at run | `e42c2c1c924ad175d0b14be6f61d17c49fc6b7ac` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| classes run | `K3` |
| held-out draw | `HELDOUT_SEED = CELL_SEED + 500000; seed(j) = HELDOUT_SEED + 7919*j, j = 0..9999` |
| rows emitted | 23 |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |

## 1. The endpoint table — every `(K3 cell, detector)` row

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 12 | K3 | `A0.5sigma-f0.02` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 12 | K3 | `A0.5sigma-f0.02` | no | 0 | `spectral_bet_e_process` | 177/2000 | 0.0885 | INERT |
| 12 | K3 | `A0.5sigma-f0.02` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 13 | K3 | `A0.5sigma-f0.05` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 13 | K3 | `A0.5sigma-f0.05` | no | 0 | `spectral_bet_e_process` | 244/2000 | 0.1220 | INERT |
| 13 | K3 | `A0.5sigma-f0.05` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 14 | K3 | `A0.75sigma-f0.02` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 14 | K3 | `A0.75sigma-f0.02` | no | 0 | `spectral_bet_e_process` | 1017/2000 | 0.5085 | POWERED |
| 14 | K3 | `A0.75sigma-f0.02` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `family_D_spectral_e_detector` | 0/2000 | 0 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `spectral_bet_e_process` | 1308/2000 | 0.6540 | POWERED |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 16 | K3 | `A0.75sigma-f0.1` | no | 0 | `safe_t` | 0/2000 | 0 | INERT |
| 16 | K3 | `A0.75sigma-f0.1` | no | 0 | `spectral_bet_e_process` | 1774/2000 | 0.8870 | POWERED |
| 16 | K3 | `A0.75sigma-f0.1` | no | 0 | `universal_inference` | 0/2000 | 0 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `family_D_spectral_e_detector` | 0/2000 | 0 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `spectral_bet_e_process` | 1969/2000 | 0.9845 | POWERED |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0 | INERT |

## 2. Arm 33 — validity (S2), power (S3), and the verdict-free step probe

| idx | detector | arm | n | class instrument | reading | lower_95 | verdict |
|---|---|---|---|---|---|---|---|
| 33 | `spectral_bet_e_process` | step_blindness_probe | 2000 | `step_blindness_probe_rate` (verdict-free) | 0.0030 (k=6/n=2000) | — | (none — verdict-free row) |
| 33 | `spectral_bet_e_process` | healthy | 2000 | `crossing_rate` / `k` | 0.0030 (k=6/n=2000) | 0.0015520206386129389 | not-refuted |
| 33 | `spectral_bet_e_process` | power | 2000 | `detection_rate` (S3, shift 3σ) | 1 (2000/2000) | — | POWERED |

### Registered secondary fields

- **cell 12 `A0.5sigma-f0.02`** — final_wealth mean 13437.163335 / median 0.023730; degenerate_windows 0
- **cell 13 `A0.5sigma-f0.05`** — final_wealth mean 352.126681 / median 0.077302; degenerate_windows 0
- **cell 14 `A0.75sigma-f0.02`** — final_wealth mean 876732.783661 / median 4.261531; degenerate_windows 0
- **cell 15 `A0.75sigma-f0.05`** — final_wealth mean 52294241.951351 / median 56.987303; degenerate_windows 0
- **cell 16 `A0.75sigma-f0.1`** — final_wealth mean 220168176951.789734 / median 8607.656763; degenerate_windows 0
- **cell 17 `A0.75sigma-f0.05-ar1`** — final_wealth mean 6.622227665348892e+24 / median 149557993.471758; degenerate_windows 0
- **arm 33 healthy** — final_wealth mean 0.024754 / median 0.000766; degenerate_windows 0; increment_estimator n=2000 mean 0.6398446237098699 sd 1.493635 se 0.033399 lower95_one_sided 0.5849037737801418; p_uniformity n=36000 deciles [3547, 3549, 3562, 3567, 3604, 3672, 3569, 3605, 3618, 3707] ks 0.005923612314703397 vs critical 0.007167829363048327
- **arm 33 power** — final_wealth mean 1.6040355639960987e+195 / median 5.520258699802028e+151; degenerate_windows 0

## 3. Stop-condition readings

K3.13's registered stop condition is arm 33's healthy `crossing_rate` Wilson 95% lower bound
against `alpha = 0.05`. As recorded: `k = 6`, `n = 2000`, `crossing_rate = 0.0030`,
`lower_95 = 0.0015519...`. **Under 0.05, so the stop condition did not fire** and S2 cleared as
`not-refuted`. The `test_martingale` class carries no terminal mean rule, so nothing overrode
that clearance the way `meanRule` overrode `group_average_e_value`'s and
`family_E_conformal_heldout`'s.

The S3 arm is realized per class as an on-grid oscillation (amp 3σ at f = 3/30, bin k = 3), per
Amendment v2.K3.3 K3.3.2 — `injectStep` is DC-blind to every bin this detector scores (K3.3.1),
and survives only as the verdict-free `step_blindness_probe_rate` row above, which carries no
`detection_rate` and no `shift_sigma` and is therefore invisible to `scoreS3` by
construction.

## 4. Post-hoc observations (labelled, no verdict)

- **Step-blindness is measured, not asserted.** The verdict-free probe row records what a 3σ step
  does to this detector: read it against the healthy arm's own `k`, which is the comparison the
  row exists to make.
- **The bin-combination divergence stands as registered.** The module implements a
  product-of-window-averages; the design page describes an average-of-per-bin-wealths. Both are
  valid; the canonical-cell delta between them is 1.5pp. Amendment v2.K3 names the implemented
  form, not the page's.
- **The `-ar1` cell 17 reads 0.9845**, the class's highest. Amendment v2.K3 registers the
  boundary: there is no φ=0.6 *healthy* arm for this detector, so power and false-alarm rate are
  not separable at φ=0.6 from this run alone.
- **The wealth floor `log(1e-12)` binds at window 12**, unreachable at this run's 6-window span.
  Measured as binding on 87.2% of pairs at T2's 20-window span in the separate clustersynth arm —
  see `run-t2-20260808T121710Z/REPORT.md` §4, where the margin is quantified.
