# Pre-registration — the contrast null: a null by construction where a control arm exists (`2026-09-contrast-null`, C81 Part 1)

- **Study id:** `2026-09-contrast-null`
- **Register:** `~/concord/knowledge/WORKLIST.md` row C81; brief in `knowledge/PROMPTS.md` §C81.
- **What it serves:** claim (1) of `knowledge/methodology/pages/threshold-free-observability.md`
  after C75/C76 (`knowledge/stats/pages/nab-null-survival-2026-09-04.md`): the portfolio's
  guarantees hold where a null exists by construction and fail on a fitted temporal history,
  and the plug-in cards' false-alert rate on real telemetry is flat in the calibration length,
  so no head fixes it. A canary deploy has what a temporal series does not: a concurrent twin on
  the same version under the same traffic. The model-free contrast `d_t = treatment_t −
  control_t`, centered, whitened at the baseline φ and standardized on a healthy fit window, is
  Tessera's spatial null (`../tessera/tools/contrast.ts`, ADR 0019; validated in
  `knowledge/stats/pages/action-surface-2026-09-03.md`). This study ports it into the engine
  under the consumer charter (`knowledge/stats/pages/engine-consumer-charter.md`: what constructs
  a baseline and detects deviation, with its validity accounting, lives in the engine) and
  measures what its validity accounting is.
- **The premise, stated:** the contrast of two units on the same version under the same
  traffic is, after the fit, a conditionally mean-zero residual whose scale is 1 in the fit's
  units: what is shared between the units cancels in the difference, and what remains is the
  two units' idiosyncratic noise. The engine's `fleet/detection-common-mode.ts` (ADR 0017/0022)
  estimates a shared factor cross-sectionally from many shards and deflates each; its 2-member
  leave-one-out case is exactly a pair contrast, and its header says so. The contrast here is
  that object taken once, on a pair the deployment nominated, with no factor estimation: the
  twin carries everything shared, which is the point (WORKLIST C73: a shared outage is not the
  deploy's fault). What does not cancel is a fault in one unit, which is the deploy null.
- **Tier:** T1 (house synthetic nulls at oracle parameters, made into pairs). Nothing here is a
  real-trace claim; the wiki page names real deploy telemetry as unmeasured.
- **Engine:** at this commit (`d518190` on `main`). **No detector, calibrator or monitor
  changes.** The construction (`per-shard/contrast.ts`) is built after this registration and
  before the run, with a lockstep equivalence test against Tessera's compiled tools; the harness
  drives the committed `dist/`.
- **Status: REGISTERED, NOT RUN.** Committed before any harness or construction code so that the
  generator, the grid, the arms, the bars, the seeds and the predictions are fixed before a
  number is seen. A later change is an amendment, appended and dated.

## 1. The generator (the pair, registered)

Per replication three streams of length `T = m + T_mon` are drawn from one seeded generator (the
h0-battery's LCG + Box–Muller, `validation/h0-battery/harness/nulls.mjs`, imported; ticks outer,
streams inner in the order shared, treatment, control):

- `u_t`, `v_t`: two INDEPENDENT draws from the SAME null (the treatment's and the control's
  idiosyncratic noise; unit marginal variance);
- `c_t`: the SHARED component, `κ · z_t` with `z` the battery's AR(1) at φ = 0.9 with unit
  marginal variance (`N3-p09`'s generator) and **`κ = 1`** (registered size: the shared component
  has the same marginal σ as a unit's own noise).

The pair is `x_t = c_t + u_t + Δ_x(t)` (treatment), `y_t = c_t + v_t + Δ_y(t)` (control); the
contrast is `d_t = x_t − y_t`. Under the null `Δ_x = Δ_y = 0`, so `d_t = u_t − v_t` and the
shared component is gone by algebra; the study measures whether the FIT on `d` then delivers a
residual the constructions' contracts describe.

| null (the unit's law) | generator | φ (oracle) |
|---|---|---|
| `N1` | iid Gaussian | 0 |
| `N3-p03` | AR(1) | 0.3 |
| `N3-p06` | AR(1) | 0.6 |
| `N3-p09` | AR(1) | 0.9 |
| `N5` | lognormal, moment-matched | 0 |
| `N6` | t3, moment-matched | 0 |
| `N8` | AR(1) φ = 0.9 with t3 innovations | 0.9 |

`N2`, `N4` and `N7` are absent: estimation is this study's fit-length axis for every null, and
rolling windows are a windowed detector's question. `N5`, `N6` and `N8` are IN the grid, not a
sidebar: the brief's question is whether the contrast makes heavy tails survivable.

**Timeline** (0-indexed ticks): fit window `[0, m)`, **`m ∈ {60, 300, 2000}`**; monitoring
`[m, m + T_mon)`, `T_mon = 2000`; injection tick `ν = m + 500` (500 quiet monitoring ticks,
then 1,500 post-onset ticks).

**Three variants per replication, same draws** (paired by construction):

| variant | `Δ_x` | `Δ_y` | serves |
|---|---|---|---|
| `null` | 0 | 0 | P1, P2 |
| `shared` | `1.5·1[t ≥ ν]` | `1.5·1[t ≥ ν]` | P3 (a shared outage: both units step) |
| `treatment` | `1.5·1[t ≥ ν]` | 0 | P4 (a deploy fault: the canary steps) |

`1.5` is the K1 canonical (`knowledge/methodology/pages/fault-class-coverage-matrix.md`), in
units of a unit's marginal σ. On the contrast the treatment-only step is `1.5` in `d`'s units
and `1.5/√2 ≈ 1.06` in the residual's (two units' noise add), before whitening; that is the
price of a twin and the study reports it rather than hiding it.

**Grid:** null (7) × `m` (3) = **21 cells**, `N = 500` replications per cell, each replication
run through all three variants. Seeds `20260904 + 7919·i + 10⁶·j`, `i` the replication, `j` the
cell index in loop order (null outer in the table's order, then `m` ascending). The canonical
cell is **`N1`, `m = 300`** (`j = 1`).

## 2. The construction and the arms

**The contrast fit** (`per-shard/contrast.ts`, ported line for line from
`../tessera/tools/contrast.ts` and `../tessera/tools/per-shard-whitening.ts`): on `d[0, m)`,
`center = median`, `φ` = the Kendall-corrected lag-1 estimate on the centered window clipped to
±0.95, `loc/scale` = median and 1.4826·MAD of the whitened centered window; `applyContrast`
centers, whitens at `φ` (first tick unwhitened, as Tessera) and standardizes. The residual is
`r_t = applyContrast(d, fit)[t]`, read for `t ≥ m` (causal; applying to a prefix equals the prefix
of applying to the whole). **Equivalence is a precondition of the run**: the harness compares
`fitContrast` (every field), `applyContrast` (every tick), `composeFit` and `fitContrastFast`
against Tessera's compiled `tools/contrast.js` when that file is present at
`../tessera/tools/contrast.js`, over 200 seeded streams of mixed φ, offset and scale, and records
`comparisons` and `mismatches` in the manifest; a mismatch is NOT-EXECUTABLE. (The same
comparison is a committed test, `test/contrast.test.ts`, skipped with a message where Tessera is
absent; the C60 item 5 standard.)

**Arms on the contrast residual `r_t`, `t ≥ m`,** at `(μ, σ, φ) = (0, 1, 0)` (the fit has done the
standardizing; the cards are fed the residual raw):

| construction | driven as | levels | contract |
|---|---|---|---|
| Family A mixture | h0-battery adapter `family_A_mixture_supermartingale`, `cfg = {0, 1, 0, α}` | α ∈ {0.05, 0.01} per run | `P(ever M ≥ 1/α) ≤ α` |
| Family A betting | adapter `family_A_betting_e_process` | the same | the same |
| e-SR mean shift, Gaussian increment | `evaluateESrMeanShift(r_t)`, default λ grid | α_ARL = 10⁻³ | `E∞[N] ≥ 1/α_ARL` |
| bounded-bet e-SR (**conditional**, C77) | as the e-SR with `increment: 'bounded'` | the same | conditionally mean-zero residual |
| calibration monitor, 'gaussian' and 'bounded' | `freshCalibrationMonitor({alpha: 0.01, incrementKind})`, revocation = first tick `passing` is false | α_cal = 0.01 | `P(ever revoke) ≤ α_cal` under a valid null |

The bounded-bet e-SR is C77's module, not merged at this registration (engine PR #89 open;
`dist/detectors/e-sr-mean-shift.js` on `d518190` has no token `bounded`). As in C76 and C78:
**the arm runs iff, at run time, that file contains the token `bounded`**; otherwise the manifest
records `bounded_esr: absent` and the report and wiki page name the gap.

**The temporal comparator (the path C76 measured), on the treatment unit `x_t` alone,** with the
same head `[0, m)` fitted the way the engine's plug-in path fits it: `μ̂` = head mean, `σ̂²` = head
variance, `φ̂` = `computePerSignalAr1Phi(head, μ̂)` (`detectors/family-a-mixture-supermartingale.ts`),
then the mixture and betting adapters at `cfg = {μ̂, σ̂, φ̂, α}` on the raw `x_t` and the e-SR on
`standardizeAr1Residual(x_t, x_{t−1}, μ̂, σ̂, φ̂)`. Same levels, same bars. It sees the shared
component as part of its history, which is exactly the situation a canary gate is in.

The alert is the **first raw crossing**, no reset, no cooldown. A construction that has alerted
on the quiet stretch has alerted.

## 3. Endpoints, with bars

All T1. `t*` is the first alert tick, `∞` if none.

- **P1 — the increment estimator per λ on the contrast residual.** Per (null, `m`), over the
  pooled monitoring ticks of the `null` variant (`N·T_mon = 10⁶` residuals): for every λ of the
  Gaussian increment family (`±{0.5, 1, 2}`, `g_λ(r) = exp(λr − λ²/2)`, uncapped) and of the
  bounded family (`±{0.1, 0.3, 0.6, 0.9}`, `g_λ(r) = 1 + λ·clip(r, ±3)/3`), the sample mean
  `ḡ_λ`, its normal-theory `se`, and `max/mean`. **Bar: `ḡ_λ ≤ 1 + 3·se`** (the e-value premise
  `E[g_λ | H0] ≤ 1` is not refuted at 3 se; the reading the wiki's instrument makes,
  `fleet/calibration-monitor.ts`). Also reported, no verdict: `|ḡ_λ − 1| > 3·se` as
  *off-centre*, which at `n = 10⁶` any estimation price will trip. **P1 HELD for a cell iff at
  least one increment family holds at EVERY λ in that cell**; P1 HELD for the study iff every
  cell holds.
- **P2 — false alerts per 1,000 ticks against the contract, on the contrast residual and on
  the temporal comparator.** Per (null, `m`, construction, level), `null` variant: alerting
  replications, the rate per 1,000 monitoring ticks, and the bar:
  - per-run cards at α: HELD iff alerting ≤ `floor(N·α + 3·sqrt(N·α·(1 − α)))`;
  - the e-SR at α_ARL: geometric-hazard reference `E = N·(1 − exp(−α_ARL·T_mon))`; HELD iff
    alerting ≤ `floor(E + 3·sqrt(E))`;
  - the monitor at α_cal: revoking replications ≤ `floor(N·α_cal + 3·sqrt(N·α_cal·(1 − α_cal)))`.
  The fitted-history price C76 measured (0.32–0.40 per 1,000 for the plug-in cards on NAB, flat
  in the head) and C23's synthetic per-tick excess (1.002 at `m = 500`) are the comparison; the
  temporal comparator here is that path on a series with a shared AR(1) component in its history.
- **P3 — the shared component cancels.** Per (null, `m`), `shared` variant, contrast path: among
  replications with no alert before `ν`, the number alerting in `[ν, m + T_mon)`, for the mixture
  and betting at α = 0.05 and the e-SR at 10⁻³. **Bar: the same count bar as P2 for that
  construction and level** (a shared step must be detected at the false-alarm rate, no more).
  The temporal comparator's alerting on the same shared step is reported next to it: it is the
  false rollback the contrast is for. Instrument check (§4 ii) establishes the algebraic
  cancellation separately; P3 measures it through the fit and the detectors.
- **P4 — power on a treatment-only step, contrast vs temporal.** Per (null, `m`), `treatment`
  variant: among replications with no alert before `ν`, the fraction alerting in `[ν, m + T_mon)`
  and the median `t* − ν`, for the mixture and betting at both α and the e-SR, contrast path and
  temporal comparator. **Bar: the contrast path's mixture at α = 0.05 detects ≥ 0.50** (the
  coverage matrix's powered floor) in every cell. Reported, no ship consequence beyond the
  envelope's power note.

## 4. Instrument check and NOT-EXECUTABLE

Before the grid, on seed `20260904` under `N1`, `m = 300`, the harness requires:

- (i) on the `treatment` variant with a `3σ` step (not 1.5), every construction at its 0.05 level
  (e-SR at 10⁻³) alerts on the contrast path at some `t* ∈ [ν, m + T_mon)`;
- (ii) on the `shared` variant with a `3σ` step in both units, the contrast residual is
  tick-for-tick equal to the `null` variant's residual (`|Δr_t| < 10⁻⁹` for every `t`): the
  algebraic cancellation, before any detector sees it;
- (iii) on the `null` variant the mixture and betting at α = 10⁻⁴ do not alert by `m + T_mon`;
- (iv) the Tessera lockstep comparison (§2) reports 0 mismatches, or Tessera's compiled tools are
  absent and the manifest says so (`lockstep: absent`), in which case the committed test is the
  record and the run proceeds.

A failure of (i)–(iii), or a mismatch in (iv), is NOT-EXECUTABLE. Also NOT-EXECUTABLE: any
exception (the harness has no catch; a throw aborts and the partial directory is kept unscored);
a non-finite e-value that is NaN or negative (`+Infinity` is a legitimate alert, C76's lesson);
a non-finite contrast residual. No null, fit length, level, seed, horizon, κ or bar moves after
the run.

## 5. Predictions (no authority; a wrong prediction is reported as such)

From the construction's algebra, the h0-battery's record on these nulls
(`knowledge/stats/pages/validity-premise-chain.md`, `detector-audit-sequential-2026-08-05`), and
the delay floors (`knowledge/stats/pages/arl-delay-2026-09-03.md`):

**P1.** The contrast does NOT make heavy tails survivable for the Gaussian increment: the
contrast of two iid t3 draws has no moment generating function, so `E[exp(λr)]` is infinite at
every λ ≠ 0 and the pooled mean at `|λ| = 2` refutes on `N6` and `N8` at every `m`; on `N5`
the lognormal's right tail dominates the difference and `|λ| = 2` refutes too, while the
contrast's one gift on `N5` is symmetry (the skew cancels, so the median center is unbiased for
the mean). The bounded family holds at every λ in every cell (clipping and linearity absorb
tails and scale error; the center is the fit window's median of a symmetric residual). At
`m = 60` the Gaussian family at `|λ| ≥ 1` refutes on EVERY null (a MAD from 60 ticks has a
~10% scale error; a 10% under-estimate moves `E[g]` from ~1 to ~1.5 at λ = 2); at `m = 2000` it
holds on `N1` and `N3-*` at every λ. So **P1 HELD for the study, through the bounded family**,
and the envelope's admission is written per family.

**P2.** On the contrast residual, the mixture and betting cards at α = 0.05: HELD on `N1` and
`N3-*` at `m ∈ {300, 2000}` (rates 0.01–0.03 per 1,000; the whitening at the contrast's own φ̂
does what C23's oracle cells do), FAILED at `m = 60` on every null (rates 0.1–0.3 per 1,000:
the scale price), FAILED on `N6`/`N8` at every `m` (the Gaussian card on a t3 residual; C23's
8.5e46), and `N5` HELD at `m = 2000` (symmetry) — the one cell where the contrast buys the
Gaussian card something a temporal fit could not. The e-SR at 10⁻³: HELD on `N1`/`N3-*` at
every `m` on its ARL reading (about 0.9 alerts per 1,000 designed), FAILED on `N6`/`N8`. The
'bounded' monitor: HELD everywhere; the 'gaussian' monitor: FAILED on `N5`/`N6`/`N8` and at
`m = 60`. **The temporal comparator FAILS its bar in every cell**: with `κ = 1` the treatment
series has a φ = 0.9 component its head fits as a single φ̂ ≈ 0.6–0.8 and a σ̂ that includes it,
so the whitened residual is neither white nor unit-scale; rates ≥ 1 per 1,000 at every `m`, and
flat or rising in `m` — the C76 shape (flat in the head) reproduced synthetically with the
shared component as the named mechanism.

**P3.** HELD in every cell for the contrast path (alerting at the P2 rate, since the shared step
is not in `d` at all). The temporal comparator alerts on the shared step on ≥ 0.95 of
replications at `m ≥ 300` in every null: a shared outage rolls the canary back on the temporal
path and not on the contrast.

**P4.** Contrast mixture at α = 0.05 on `N1`: detection ≈ 1.00 over 1,500 post-onset ticks with
median delay ≈ 70 ticks (the arl-delay floor at 1.5σ is 35.5; the contrast's residual shift is
1.06σ, and delay scales like 1/δ²); at `N3-p09` the whitened shift is `1.06·(1−0.9)/sqrt(1−0.81)`
≈ 0.24σ on the residual after the first tick, so detection ≈ 0.6–0.8 with median delay ≈ 500;
at `N8` the same with the heavy-tail false alerts mixed in. e-SR ≈ 15-tick delay on `N1`
(twice its 7). The temporal comparator detects ≥ 0.99 in every cell with a shorter delay
(its residual sees the full 1.5σ before whitening) and a false-alert rate that makes the
number meaningless; the report prints both. **Bar: HELD on `N1`, `N3-p03`, `N3-p06`, `N5`,
`N6`; open on `N3-p09` and `N8` at `m = 60`.**

## 6. Ship rule and the envelope

- **P1 HELD and P3 HELD → the construction ships** in `per-shard/contrast.ts` with
  `CONTRAST_NULL_ENVELOPE`: baseline `'plug-in'` (a fit on a healthy contrast window),
  autocorrelation `'ar1-whitened'`, null `'mean-shift'`, variance `'robust'`, the premise stated
  in `notes`, and the fit-window length as the regime.
- **P2 decides admission, written into the envelope as numbers, not prose**: per (construction,
  level, `m`) the nulls on which the contract HELD and the measured rate per 1,000; the
  envelope's `minCalibration` is the smallest `m` at which the mixture at the shipped level
  holds on every Gaussian-innovation null (`N1`, `N3-*`); `validUnderEstimatedBaseline` is
  `true` iff that `m` exists (the fit is the estimate). `fleet/e-bh-guarded.ts` gains
  `contrast_null_mixture` and `contrast_null_betting` keyed to the envelope, so a consumer's FDR
  claim on the contrast residual passes through the gate with `calLen` checked against
  `minCalibration`. `guarantees.ts` gains one row (`contrast_null_`) whose evidence names this
  run, and `DETECTOR_REGISTRY.A` the six `contrast_null_{signal}` ids a consumer's audit can
  resolve.
- **P1 or P3 FAILED → nothing ships**; the port and its lockstep test stay as a measured
  construction with no envelope, and the wiki page says which premise failed.
- After merge the engine is tagged (`v0.6.12-pre`): DeploySignal's control arm (C81 Part 2)
  consumes it.

## 7. Harness rules

Deterministic (seeded LCG; nothing reads the clock into a tracked artifact except the run
directory's name); `results/live/run-<UTC>/` refuses an existing directory; the manifest records
the engine sha and version, node, the harness, registration and report hashes, the null module's
hash, the contrast module's hash, Tessera's sha and the lockstep counts (or `absent`),
`bounded_esr` presence, the instrument check, and `exceptions: 0` (structural: no catch);
`analysis/check_report.mjs` re-renders `REPORT.md` and requires byte equality, and takes
`--expect` in C76's form so the wiki page's numbers pin to the run. The h0-battery's `nulls.mjs`
and `detectors.mjs` are imported (they do not execute on import); nothing from another study is
imported.

## Amendment A1 — 2026-09-05, before any live run: instrument check (iii) narrowed to the mixture

On the first quick (sim, never scored) run, check (iii) failed on the betting card: at α = 10⁻⁴
on the `null` variant of the check seed (`N1`, `m = 300`) it alerted at tick 2140, while the
mixture did not. That is not an instrument defect: the betting card's GRAPA loop converges on the
fit's scale error (C58: a per-tick excess κ/m, κ = 0.8445), which on a 300-tick fit compounds to
E[M] ≈ e^{0.8445·2000/300} ≈ 280 over the 2,000-tick horizon, and a crossing of 10⁴ on one seed
is inside that law. Check (iii) as written tested P2's hypothesis on one seed, not the pipeline.
**(iii) now reads: on the `null` variant the MIXTURE at α = 10⁻⁴ does not alert by `m + T_mon`.**
The betting card's reading on the check seed stays in the manifest (`instrument.clean_quiet`)
and is reported; P2 measures it at N = 500. No other check, null, level, seed, bar or prediction
moves. The quick run was under `results/sim/` and is not scored.
