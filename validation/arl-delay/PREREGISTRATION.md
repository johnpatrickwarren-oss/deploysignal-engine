# Pre-registration — ARL₀ and detection delay on the battery substrates (`2026-09-arl-delay`)

- **Study id:** `2026-09-arl-delay`
- **Register:** `knowledge/WORKLIST.md` C66; protocol Amendment v1.C66
  (`knowledge/methodology/pages/detector-certification-protocol.md`, wiki commit `742c92e`).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`; harness rules per
  `knowledge/methodology/harness-discipline`; the run-study skill.
- **Engine:** branch `feat/c66-arl-delay` from `main` at `d6785f3` (v0.6.9-pre + ADR 0028,
  untagged). `dist/` is tracked and was rebuilt at `d6785f3`; the harness drives `dist/`.
- **Committed before the harness exists.** Every definition, size, seed scheme, gate and band
  below is frozen at this commit. The two endpoints carry **no verdict authority** (C66.3); the
  gates in §4 are instrument checks and one construction prediction, not card verdicts.

## 1. The endpoints

Ticks are 0-indexed in the harness (`t = 0` is the first observation, as in
`validation/h0-battery/harness/run.mjs:71`); run lengths below are reported 1-indexed
(`N* = t_fire + 1`) so that `N* = 1` means the first observation fired.

- **Run length** `N*` — the first tick the adapter's `step()` returns `true`; `N* = ∞` if it
  never does within the horizon.
- **`arl0_T`** — `mean_i min(N*_i, T)`, the T-censored average run length under H₀. A lower
  bound on `E∞[N*]` at every T. Reported with `p_alarm_T = P(N* ≤ T)`, `p_alarm_300` (the
  h0-battery's horizon, for G1), and the censored fraction `1 − p_alarm_T`. The median run
  length is reported when `p_alarm_T ≥ 0.5`, else `> T`.
- **Detection delay** at onset ν with injection I — for trajectories with `N* > ν` (no alarm
  before the first injected observation): `D = N* − ν` in ticks (`D ≥ 1`), censored at `T − ν`.
  Reported: `p_pre_onset_alarm = P(N* ≤ ν)`, `p_detect = P(N* ≤ T | N* > ν)`,
  `delay_mean_censored = mean min(D, T − ν)` over the `N* > ν` trajectories, `delay_median`
  and `delay_p90` (each `> T − ν` when censoring prevents it). This is the SRR §5 simulation's
  conditional average delay at a fixed ν (their Figures 4–5), **not** Lorden's `J_L` or Pollak's
  `J_P`, which are not estimable from one ν.

## 2. Substrates, detectors, α — inherited, not chosen

- **Nulls:** `NULLS` and `N8_COMBINED` from `validation/h0-battery/harness/nulls.mjs`, imported
  unchanged (N1, N2-m30/m100/m500, N3-p03/p06/p09, N4-p06-m100/p09-m100, N5, N6, N7, N8).
- **Detectors:** `DETECTORS` from `validation/h0-battery/harness/detectors.mjs`, imported
  unchanged: `family_A_betting_e_process`, `family_A_mixture_supermartingale`,
  `family_C_safe_hotelling` (2-vector adapter), `family_D_spectral_e_detector`. Its
  `OUT_OF_SCOPE` list is inherited with its reasons. Cards without a battery adapter
  (`group_average_e_value`, `point_tail_bet_e_value`, `spectral_bet_e_process`,
  `shape_block_conformal_bet`, `shape_ecdf_accumulator`, `sequential_mmd_betting_e_process`,
  `family_E_conformal*`, `sequential_ui_e_process`) are **MISSING** in the report, by name. The
  terminal cards (`safe_t_e_value`, `universal_inference_e_value`) are **NOT DEFINED** (C66.2).
- **Trajectory construction:** copied from `validation/h0-battery/harness/run.mjs:44-79`
  (oracle φ threading, the N2/N4 calibration window drawn from the same stream, `det.calibrate`
  on a 3,000-draw sample), with the horizon loop continued past 300. The copy is verbatim so that
  G1 can be an exact reproduction, not a resemblance.
- **α ∈ {0.05, 0.01}** for the gates; **α = 1e-4** (the shipped Family A α) run and reported as
  descriptive, the battery's §4 convention.
- **Canonical severities** (`validation/coverage/PREREGISTRATION.md` severity table, rows 1, 7,
  15): K1 step `1.5σ`; K2 unison `ε = 0.5σ` per coordinate; K3 oscillation `A = 0.75σ,
  f = 0.05` in the `injectOscillation` form of `validation/coverage/lib/inject.mjs:37-41`
  (`v + A·σ·sin(2π f (t − ν))` for `t ≥ ν`).

## 3. Arms

**Arm A — ARL₀.** Every (detector, null, α): `N = 2,000` trajectories, `T = 3,000`. Seeds
`SEED + 7919·i`, `SEED = 20260801` — the battery's own seeds and draw order, so the first 300
ticks of every trajectory are the battery's trajectories. Per cell: `n`, `fires_300`,
`p_alarm_300`, `fires_T`, `p_alarm_T`, `arl0_T`, `median_run_length`, `exceptions`.

**Arm B — delay.** `N = 2,000`, `T = 1,000`, onset `ν = 200` (the first injected observation is
`t = 200`, the battery's `t >= ONSET` semantics). Injection pairs, every null, every α:

| detector | injection | severity | reason |
|---|---|---|---|
| all four | K1 step | `+1.5σ` on every coordinate | the mean-shift canonical; for Family D a cross-class cell (peak\|ACF\| is level-blind by construction), reported as such |
| `family_C_safe_hotelling` | K2 unison | `+0.5σ` on both coordinates | K2's canonical ε at the adapter's `K = 2`; the registered K2 canonical is `K = 10`, which the adapter cannot represent — this is the nearest admissible cell, not that one |
| `family_D_spectral_e_detector` | K3 oscillation | `A = 0.75σ, f = 0.05` | its class canonical |

Seeds `SEED_B + 7919·i + SALT[pair]`, `SEED_B = 20260903`, `SALT = {K1: 0, K2: 1_000_003,
K3: 2_000_003}` (the coverage convention `SEED + 7919·i + cell salt`). Per cell: `n`,
`n_post_onset` (trajectories with `N* > ν`), `p_pre_onset_alarm`, `p_detect`,
`delay_mean_censored`, `delay_median`, `delay_p90`, `censored`, `exceptions`.

Sizes are fixed. No re-run for a "tighter" number; a re-run happens only for a named harness
defect, fixed test-first, with the prior run preserved and superseded by manifest.

## 4. Gates (verdict authority HELD/FAILED — instrument checks and one construction prediction)

**G1 — the instrument reproduces the battery.** For each of the 104 (detector, null,
α ∈ {0.05, 0.01}) cells, arm A's `fires_300` against the battery's `fires` in
`validation/h0-battery/results/live/run-20260801T064627Z` (N1–N7) and
`run-20260819T014934Z` (N8): pass iff `|fires_300 − fires_battery| ≤ max(3, 3·sqrt(2·2000·p̄(1−p̄)))`
with `p̄` the pooled rate. **HELD iff at most 2 of 104 cells fail.** Exact equality per cell is
also reported: it is expected wherever the detector's fire behaviour has not changed since the
battery ran at `17cc3f8`, and an inexact cell with G1 HELD is reported as behavioural drift of
that detector, unscored. **G1 FAILED is a harness stop:** nothing else from the run is reported
until the defect is named, fixed test-first and re-run under this registration.

**G2 — executability of the delay arm (vacuous-pass guard).** On N1 at α = 0.05, each
(detector, class-own injection) pair must reach `p_detect ≥ 0.50` (the battery P2 shape: a
detector that cannot see its own canonical fault within 800 ticks has no delay to report).
Pairs: Family A betting and mixture at K1; safe-Hotelling at K2; Family D at K3. A pair below the
floor is **NOT-EXECUTABLE** for delay: its delay cells are reported with that label and no
number is quoted from them. Expected: the three USE-adjacent pairs pass; Family D at K3 is
genuinely uncertain (its card is REFUSE; the coverage battery's K3 YES belongs to
`spectral_bet_e_process`, not to this detector).

**G3 — Ville extends past the battery's horizon.** On the cells where the card is CLEARED at
T = 300 and oracle parameters hold — Family A betting and Family A mixture on N1, N3-p03,
N3-p06, N3-p09; safe-Hotelling on N1 — at α ∈ {0.05, 0.01}: `p_alarm_3000 ≤ α + 3·sqrt(α(1−α)/2000)`
(0.0646 at α = 0.05; 0.0167 at α = 0.01). 18 cells. **Registered prediction: HELD on all 18** —
Ville's inequality is horizon-free. A FAILED cell is a finding on the record: the T = 300
clearance does not extend to T = 3,000 for that card on that null, and the card's guarantee
sentence is wrong as written. Not a card re-score (C66.5); a WORKLIST item.

## 5. Registered predictions without verdict authority (reported beside the numbers)

- **Mixture delay at (N1, K1, α = 0.05, ν = 200).** The single-onset statistic carries the
  pre-onset partial sum `S_ν ~ N(0, 200)`; the fire condition `(S_ν + 1.5k)² ≥ 2(200 + k + 1)·
  (log 20 + ½·log(201 + k))` is met near `k ≈ 34` at `S_ν = 0` (k = 30: 2025 < 2599;
  k = 40: 3600 > 2712). Predicted `delay_mean_censored ∈ [20, 60]`. This is the pre-change
  dilution the e-SR design (`knowledge/stats/e-sr-mean-shift-design`) is built to remove; the
  same cell at ν = 2,000 is the e-SR study's H1, not measured here.
- **Under estimation the ARL collapses.** N2-m30 at α = 0.05 already fires on 40–43% of
  trajectories by T = 300 for both Family A cards (battery); predicted `p_alarm_3000 > 0.90` and
  `arl0_3000 < 1,000` there. The estimation premise (`knowledge/stats/validity-premise-chain`)
  in run-length units.
- **Family D on N7** (rolling, its shipped configuration) fires on 57.6% by 300 at α = 0.05;
  predicted `arl0_3000 < 500`.
- **The betting e-process** (GRAPA/ONS λ adaptation) has no closed-form delay; reported.

## 6. NOT-EXECUTABLE conditions and stop rules

- A thrown exception or non-finite `logM` inside a trajectory is caught **at the trajectory
  level only**, counted per cell, printed in the report, and the trajectory excluded. A cell with
  `exceptions > 1% of N` is NOT-EXECUTABLE; its numbers are not quoted. No other catch exists in
  the harness.
- `--quick` (N = 20) writes under `results/sim/` (git-ignored) and is never scored; only a
  `--mode live` run at registered size is.
- The output directory is append-only (`run-<UTC>/`, refuses to exist).

## 7. What this study does not do

- It issues no verdict on any card and proposes no floor (C66.3).
- T1 only (house synthetic nulls). Nothing here bears on real traces; falsifier 2 of
  `knowledge/methodology/threshold-free-observability` remains untested.
- It measures no e-detector. The e-SR study is registered separately at
  `validation/e-sr-mean-shift/PREREGISTRATION.md` and is not run until the module exists.
- Lorden/Pollak worst-case delays are not estimated; one ν is run.
- The shipped α = 1e-4 cells are descriptive; at T = 3,000 they cannot resolve `1/α = 10,000`.

## 8. Outputs

`results/live/run-<UTC>/`: `manifest.json` (study id, engine sha, node, seeds, N, T, ν, the two
battery run ids read for G1, sha256 of this file and of the harness), `arl.json` (arm A cells),
`delay.json` (arm B cells), `gates.json` (G1–G3, per-cell), `REPORT.md`. Cells carry
`detector_id`, never `detector`, and no `summary.json`/`endpoints.json` is written, so
`validation/certification/lib/collect.mjs` pools none of it (C66.4). `analysis/check_report.mjs`
pins every number in `REPORT.md` and in the wiki page's table to the run JSON and exits 1 on
drift. `npm run cert:verdict` is run to a scratch `CERT_RESULTS_DIR` after the live run and its
fifteen card verdicts compared field-by-field with `results/run-20260902T*` to show the
collector ignored the new study.
