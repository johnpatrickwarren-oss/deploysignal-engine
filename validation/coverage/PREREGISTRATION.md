# Coverage battery: pre-registration

Frozen at this commit. Endpoints, grids, floors, seeds, and fallback rules below do not move for
any run under this study. A failed endpoint is a publishable result; thresholds do not move
afterward. This document follows the house design recorded in
`~/concord/knowledge/methodology/pages/pre-registration-discipline.md`; section 11 maps each of its
eight rules to where this study satisfies it.

Authority: `~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md` (RATIFIED
2026-08-07). Where this document and that page disagree, the page wins and the disagreement is a
bug in this document to report.

## 1. Normative source

`validation/certification/lib/constants.mjs` — `FAULT_CLASSES` and `COVERAGE_FLOOR` — is the
normative registry. This document mirrors it verbatim; the constants module is the source of
truth if the two ever diverge. The table below was cross-checked against
`validation/certification/lib/constants.mjs:57-64` string-for-string (result: section 12).

| id | class | canonical severity | grid |
|---|---|---|---|
| K1 | per-metric step shift | `1.5sigma` | `0.75sigma`, `1.5sigma`, `3sigma` |
| K2 | group-in-unison | `K10-e0.5sigma` | `K5-e0.25sigma`, `K5-e0.5sigma`, `K10-e0.25sigma`, `K10-e0.5sigma`, `K10-e0.75sigma`, `K20-e0.25sigma`, `K20-e0.5sigma` |
| K3 | sub-threshold oscillation | `A0.75sigma-f0.05` | `A0.5sigma-f0.02`, `A0.5sigma-f0.05`, `A0.75sigma-f0.02`, `A0.75sigma-f0.05`, `A0.75sigma-f0.1` |
| K4 | far-outside-norm point | `5sigma-point` | `3sigma-point`, `5sigma-point`, `8sigma-point` |
| K5 | slow drift | `slope1e-4` | `slope5e-5`, `slope1e-4`, `slope5e-4` |
| K6 | distributional shape change | `mix-d1.5` | `mix-d1.0`, `mix-d1.5`, `mix-d2.0` |

`COVERAGE_FLOOR = 0.50` (`constants.mjs:56`) — the floor a canonical-severity cell must reach for
the class to read COVERED (section 8).

## 2. Injection generators

Six pure functions in `validation/coverage/lib/inject.mjs`, each adding (or, for K6, replacing)
values on a series/matrix from index `at` onward. Grid labels parse unambiguously into these
functions' parameters (`sigma=1` throughout — the baseline is unit-variance):

| class | function | formula | source |
|---|---|---|---|
| K1 | `injectStep` | `v + delta*sigma` for `t>=at` | `inject.mjs:27-29` |
| K2 | `injectUnison` | per series, `injectStep` with `delta=eps`: `v + eps*sigma` for `t>=at`, applied to every series in the matrix | `inject.mjs:32-34` |
| K3 | `injectOscillation` | `v + amp*sigma*sin(2*pi*freq*(t-at))` for `t>=at` | `inject.mjs:37-41` |
| K4 | `injectPoint` | `v + mult*sigma` at exactly `t===at` | `inject.mjs:44-46` |
| K5 | `injectDrift` | `v + slope*(t-at)*sigma` for `t>=at` | `inject.mjs:49-51` |
| K6 | `injectShapeMix` | from `at`, replaces `v` with `sigma*z`, `z=(b?+d/2:-d/2)+w*s`, `b~Bernoulli(0.5)`, `w~N(0,1)`, `s=sqrt(max(0,1-d*d/4))` (matched mean 0, variance 1) | `inject.mjs:60-70` |

Grid-label parsing: `'0.75sigma'`→`delta=0.75`; `'K5-e0.25sigma'`→`K=5,eps=0.25`;
`'A0.5sigma-f0.02'`→`amp=0.5,freq=0.02`; `'3sigma-point'`→`mult=3`; `'slope5e-5'`→`slope=5e-5`;
`'mix-d1.0'`→`d=1.0`.

**Correction registered here, not inherited:** K5's formula in this battery is `injectDrift`'s
additive, onset-anchored form — `slope*(t-at)*sigma`, `at`=onset — copied directly from
`inject.mjs:49-51`. This is **not** the C35 drift-sweep study's formula, which is multiplicative
and anchored at `T_INJECT` rather than the onset used here; the two must not be conflated or
quoted interchangeably. See the correction note at
`docs/superpowers/plans/2026-08-07-coverage-matrix-v1.md:166`, which documents that an earlier
draft of the implementation plan misquoted both this formula's shape and its anchor. This battery
registers its own additive form as its own instrument, independent of C35.

The seeded generator behind all six functions is `rng`/`gaussFrom` at `inject.mjs:14-24`, copied
from `validation/h0-battery/harness/nulls.mjs:7-17`. Per `inject.mjs:9-13`'s own note: this is a
Numerical-Recipes-style linear congruential generator, kept under the name `rng`, **not**
mulberry32 — an earlier plan draft named it after the wrong algorithm. Cited here so this document
does not repeat that error.

## 3. Design parameters (fixed)

- **N = 2000** trajectories per cell.
- **T = 300** ticks per trajectory.
- **onset (`at`) = 100.** Pre-onset window: indices `[0, 100)`, 100 ticks. Post-onset window:
  indices `[100, 300)`, 200 ticks.
- **alpha = 0.05.** Crossing threshold `1/alpha = 20`.
- **sigma = 1** (unit-variance baseline throughout; grid labels are already expressed in units of
  sigma).

These three values (N, T, onset) match the existing convention at
`validation/detector-audit/harness/run-power.mjs:29-31` (`N=2000`, `T=300`, `ONSET=100`), which
this battery's family_D arm (section 7) reuses directly rather than re-deriving.

## 4. Null models

- **Baseline: iid Gaussian, oracle parameters.** `gaussFrom(rng(seed))`, mean 0, variance 1, known
  to the detector (`mu:0, sigma:1` passed directly — no calibration-window estimation). Applies to
  every cell in the grid.
- **AR(1) replicate, φ=0.6, oracle-known φ.** One replicate per class, built on that class's
  *canonical* cell only, labelled with the `-ar1` suffix (e.g. `1.5sigma-ar1`). Generated the same
  way `run.mjs`'s `N3-p06` null is (`ar1(r, 0.6)` at
  `validation/terminal-evalue/harness/run.mjs:19-20,32`), with the detector given the true φ
  (`ar1Phi: 0.6`, mirroring `run.mjs:42-43`'s `ns.oracle ? { ar1Phi: ns.phi } : undefined`).

Six classes × canonical-plus-grid-plus-ar1 gives **30 registered cells** total (enumerated with
seeds in section 6).

## 5. Windowing and the scored endpoint

**Terminal detectors** (`safe_t`, `universal_inference`, `group_average_e_value`,
`family_E_conformal_heldout`): each trajectory is split into a calibration slice and a test slice
and produces one e-value per trajectory, exactly the split
`validation/terminal-evalue/harness/run.mjs:86-87` performs:

```
{ start: 0, len: 100 }      // calibration: the pre-onset window
{ start: 100, len: 200 }    // test: the post-onset window (200 ticks here, vs. run.mjs's fixed
                             // NTEST=100 — this battery's test slice is exactly the post-onset
                             // window implied by T=300/onset=100, not copied from run.mjs's NTEST)
```

**Detection for a trajectory** = the terminal e-value from that split satisfies `e >= 1/alpha`,
the same threshold `run.mjs:112` (`good.filter((e) => e >= 1 / alpha)`) applies. **Detection rate
for a cell** = fraction of the cell's N=2000 trajectories meeting that condition.

**`family_D_spectral_e_detector`** (K3 only, section 7) is a running e-process, not a terminal
read. Its trajectories reuse the per-tick step loop at
`validation/detector-audit/harness/run-power.mjs:78-84` (`for t in [0,T): step(x); if v===true,
fired`), with one explicit change registered here: a crossing is counted as a **detection** only
if it occurs at `t >= onset` (t >= 100) — i.e., strictly within the post-onset window, per this
study's endpoint definition ("crosses 1/α within the post-onset window"). `run-power.mjs`'s own
loop does not gate firing by onset (it treats the whole trajectory as eligible); this battery's
stricter, onset-gated version is a registered choice, not a re-derivation error — see the
harder-to-pass note in section 10.

**Group-in-unison (K2) mechanics:** the injected object is a matrix of K series (K per the grid:
5, 10, or 20), each independently generated under the null and shifted by `eps*sigma` from onset
(section 2). `group_average_e_value` computes, per trajectory: a per-series terminal safe-t
e-value over that series' own calibration/test split (section 5's terminal split, applied K
times), then the arithmetic mean of the K e-values. That mean is scored against `1/alpha` exactly
as any other terminal e-value (`groupAverageEValue` itself is Task 6's deliverable and lands after
this document; its contract — arithmetic mean, one call per trajectory — is fixed by
`docs/superpowers/plans/2026-08-07-coverage-matrix-v1.md:210-212` and registered here as the
consuming convention this battery commits to).

## 6. Seeds (fixed and listed)

`BASE_SEED = 20260807`. Per cell: `CELL_SEED = BASE_SEED + cellIndex`. Per trajectory `i` within a
cell: `seed(i) = CELL_SEED + 7919*i`, `i = 0..1999` — the trajectory-step constant `7919` matches
the existing convention documented at `run-power.mjs:14` ("seeds are `SEED + 7919*i + <cell
salt>`") and used identically at `run.mjs:85`.

| idx | class | severity | φ | CELL_SEED |
|---|---|---|---|---|
| 0 | K1 | `0.75sigma` | 0 | 20260807 |
| 1 | K1 | `1.5sigma` (canonical) | 0 | 20260808 |
| 2 | K1 | `3sigma` | 0 | 20260809 |
| 3 | K1 | `1.5sigma-ar1` | 0.6 | 20260810 |
| 4 | K2 | `K5-e0.25sigma` | 0 | 20260811 |
| 5 | K2 | `K5-e0.5sigma` | 0 | 20260812 |
| 6 | K2 | `K10-e0.25sigma` | 0 | 20260813 |
| 7 | K2 | `K10-e0.5sigma` (canonical) | 0 | 20260814 |
| 8 | K2 | `K10-e0.75sigma` | 0 | 20260815 |
| 9 | K2 | `K20-e0.25sigma` | 0 | 20260816 |
| 10 | K2 | `K20-e0.5sigma` | 0 | 20260817 |
| 11 | K2 | `K10-e0.5sigma-ar1` | 0.6 | 20260818 |
| 12 | K3 | `A0.5sigma-f0.02` | 0 | 20260819 |
| 13 | K3 | `A0.5sigma-f0.05` | 0 | 20260820 |
| 14 | K3 | `A0.75sigma-f0.02` | 0 | 20260821 |
| 15 | K3 | `A0.75sigma-f0.05` (canonical) | 0 | 20260822 |
| 16 | K3 | `A0.75sigma-f0.1` | 0 | 20260823 |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | 0.6 | 20260824 |
| 18 | K4 | `3sigma-point` | 0 | 20260825 |
| 19 | K4 | `5sigma-point` (canonical) | 0 | 20260826 |
| 20 | K4 | `8sigma-point` | 0 | 20260827 |
| 21 | K4 | `5sigma-point-ar1` | 0.6 | 20260828 |
| 22 | K5 | `slope5e-5` | 0 | 20260829 |
| 23 | K5 | `slope1e-4` (canonical) | 0 | 20260830 |
| 24 | K5 | `slope5e-4` | 0 | 20260831 |
| 25 | K5 | `slope1e-4-ar1` | 0.6 | 20260832 |
| 26 | K6 | `mix-d1.0` | 0 | 20260833 |
| 27 | K6 | `mix-d1.5` (canonical) | 0 | 20260834 |
| 28 | K6 | `mix-d2.0` | 0 | 20260835 |
| 29 | K6 | `mix-d1.5-ar1` | 0.6 | 20260836 |

Within a cell, the same N=2000 trajectories (fixed by `CELL_SEED`) are generated once and shared
across every detector scored on that cell (section 7) — a paired comparison, not independently
resampled data per detector, mirroring `run.mjs`'s per-`(det,ns)` reuse of the same
`SEED + i*7919` trajectory stream.

**K4 held-out calibration (family_E_conformal_heldout only, cells 18/19/20/21):**
`HELDOUT_SEED = CELL_SEED + 500000`; `n = 10000` rows; `seed(j) = HELDOUT_SEED + 7919*j`,
`j = 0..9999`; drawn from the cell's healthy (pre-fault) null distribution (iid N(0,1) for
φ=0, AR(1) φ=0.6 for cell 21), independent of the N=2000 scored-trajectory stream above.

## 7. Detectors under test and class assignment

| detector | classes scored | role |
|---|---|---|
| `safe_t` | K1, K3, K5, K6 (all grid + ar1 cells) | certified USE, T1 |
| `universal_inference` | K1, K3, K5, K6 (all grid + ar1 cells) | certified USE, T1 |
| `group_average_e_value` | K2 only (all grid + ar1 cells) | K2 candidate; card lands Task 6 |
| `family_E_conformal_heldout` | K4 only (all grid + ar1 cells) | K4 candidate; card lands Task 7 |
| `family_D_spectral_e_detector` | K3 only (canonical + ar1 cells, 15 and 17) | measured for the record — its card verdict is REFUSE, which already bars USE regardless of any measured power rate here (`coverageFor`'s card-verdict gate, `constants.mjs`/`score.mjs`, Task 1) |

This assignment matches the harness architecture registered in the implementation plan at
`docs/superpowers/plans/2026-08-07-coverage-matrix-v1.md:241-243` ("K1/K3/K5/K6 drive safe-t and
UI per series; K3 additionally drives family_D...; K2 cells drive `group_average_e_value`...; K4
cells drive the held-out conformal evaluator") rather than the flatter "detectors under test" list
in the task brief, which does not itself state the per-class restriction. Where the two read
differently, this document follows the plan's explicit architecture, since that is what Task 8
builds.

## 8. Coverage floor and the canonical decision

`COVERAGE_FLOOR = 0.50` at the canonical, φ=0 cell only (`canonical: true`, the cell whose severity
string equals `FAULT_CLASSES[K].canonical` exactly). A class reads **COVERED** by a given detector
iff that detector's card verdict is USE (or, for the two new candidates, once their cards land)
**and** the canonical cell's detection rate is ≥ 0.50, per `coverageFor` (Task 1,
`constants.mjs`/`score.mjs`). Grid cells and the `-ar1` replicate are recorded and reported
alongside every canonical cell but do not by themselves decide COVERED/NOT_POWERED — see section
10 for why that is the registered, harder-to-pass reading.

## 9. Fallback rule

A detector/class cell whose adapter throws on more than 1% of that cell's trajectories is
**NOT-EXECUTABLE** for that cell. The condition is evaluated per `(detector, cell)` pair, not per
class as a whole — one detector's adapter failure does not mark a cell not-executable for a
different detector scored on the same cell. NOT-EXECUTABLE is reported by name in the results; it
is not silently folded into a 0% detection rate, and it does not move the 0.50 floor or the grid.
This mirrors the existing fallback convention at `run-power.mjs:93` (`notExecutable = (nonFinite +
explosions) > 0.01 * max(done,1)`), scoped here to adapter throws specifically, as the task brief
requires.

## 10. Harder-to-pass reading (choices left open by the brief, resolved here)

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`'s "harder-to-pass
reading" mechanism: where this document had a genuinely free choice, it took the reading that
makes the endpoint harder to pass, not easier.

1. **The `-ar1` replicate does not independently decide coverage** (section 8). A class cannot
   read COVERED on the strength of AR(1) robustness alone while failing at plain iid canonical —
   only the φ=0 canonical cell decides. The alternative (either cell sufficing) would have been a
   strictly easier bar.
2. **`family_D`'s crossings are gated to `t >= onset`** (section 5), stricter than
   `run-power.mjs`'s ungated loop, which would count a pre-onset false-positive crossing as a
   "fire." Gating to the post-onset window only can only lower family_D's measured rate relative
   to the ungated convention, never raise it.
3. **NOT-EXECUTABLE is scoped per `(detector, cell)`, not per class** (section 9). The finer scope
   means a single detector's adapter defect cannot mask a genuine measurement from a different
   detector on the same cell by forcing the whole cell not-executable.

## 11. House rules, mapped

| rule (`pre-registration-discipline.md`) | how this study satisfies it |
|---|---|
| 1. Committed before any data fetched | This document commits before `validation/coverage/harness/run-battery.mjs` (Task 8) exists or runs. |
| 2. A failed endpoint is a publishable result; thresholds do not move | Stated explicitly (section 0, this line, and section 13). |
| 3. Post-hoc analysis only in a clearly labelled section, no verdict | No post-hoc analysis exists yet; this document reserves the rule for the eventual report — any such section must be labelled and carry no verdict. |
| 4. A fallback rule written in advance | Section 9. |
| 5. Raw downloads frozen with `SHA256SUMS` + fetch timestamp | Does not apply as written — this is a synthetic injection battery, not a raw-data fetch. Its equivalent freeze is this document itself (the grid, floor, and seed table above) plus the engine git SHA each run's manifest records (rule 6). |
| 6. Results are append-only, `results/run-<UTC>/manifest.json` records code SHA, data hashes, seeds, command, versions; no result overwritten | Binding on Task 8/9: results land under `validation/coverage/results/live/run-<UTC>/summary.json` per the implementation plan (`docs/superpowers/plans/2026-08-07-coverage-matrix-v1.md:17`), manifested per run. |
| 7. Reruns only for a named code defect, fixed test-first, prior run preserved | Binding on any future rerun of this battery. |
| 8. The report states every endpoint's number and verdict | Binding on Task 9's report. |

## 12. Grid cross-check

Every grid, canonical severity, and class name string in section 1 was compared character-for-
character against `validation/certification/lib/constants.mjs:57-64` (`FAULT_CLASSES`). **Result:
no diff.**

## 13. Predictions, with falsifiers

Copied verbatim from `~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md`
(RATIFIED 2026-08-07), which states these are expectations to be tested, not results.

- **K1.** *Expected YES.* Falsifier: powered < 0.50 at canonical δ in every claimed cell.
- **K2.** *Expected YES via the composition; genuinely uncertain.* Falsifier: group-average
  powered < 0.50 at canonical while no other candidate covers.
- **K3.** *Expected NO this phase, with a qualified advisory-at-priced-c note.* Falsifier for the
  NO: any USE detector powered ≥ 0.50 on the battery.
- **K4.** *Expected YES at T2, real tier deferred.* Falsifier: the hedged indicator's validity or
  power fails on held-out synthetic calibration.
- **K5.** *Expected YES via safe-t; genuinely uncertain.* Falsifier: powered < 0.50 at canonical
  slope for both USE detectors.
- **K6.** *Expected NO, with the research direction carded.* Falsifier: any USE detector powered
  ≥ 0.50 against matched-moment shape faults — which would be a genuine discovery.

A failed endpoint is a publishable result. Thresholds do not move.

## 14. Scope

This document does not register real-data (T3) coverage for any class — blocked on C37/C14, as the
authority page states. It does not build or register the named-not-built candidates (K3's spectral
e-process on disjoint-window periodogram ordinates; K6's empirical-reference two-sample betting
e-process); those remain scoped cards, not batteries, under this document. It registers only the
six classes' injection batteries against the five detectors in section 7.

## Amendment v1.1 — 2026-08-07, before any run

Registered before any battery run under this study (no run exists at the time of this amendment).
Sections 1–14 above stay intact; this amendment adds and, where stated, supersedes. Every
supersession is named explicitly against the section it overrides. This amendment closes a prereg
review verdicted NEEDS-AMENDMENT-BEFORE-RUN; each numbered item below answers one review finding.

### A1. Healthy arms for the two new detectors (Critical 1)

**Adds to §7; does not supersede.** `group_average_e_value` and `family_E_conformal_heldout` are
class `terminal_e_value` (Task 6/7 card interfaces). Their own S2/S3 evidence — independent of the
fault-class cells in §6's table — is registered here so their cards can reach S2/S3 through the
standard pipeline (`isValidityCell`/`isPowerCell`, `validation/certification/lib/score.mjs:11-16`)
rather than only ever carrying fault-class cells.

**`group_average_e_value`, cell index 30, `CELL_SEED = 20260837`:**
- *Healthy (S2) arm.* K=10 independent iid-Gaussian series (K matches K2's canonical K), no
  injection. Series `k` of trajectory `i` seeded `seed(i) + 104729*k` (the per-series formula
  registered in A5), `seed(i) = CELL_SEED + 7919*i`, `i = 0..1999`. Per trajectory: 10 per-series
  terminal safe-t e-values over the §5 cal/test split (`{start:0,len:100}`/`{start:100,len:200}`),
  arithmetic-meaned into one group e-value. Cell carries this class's own instruments
  (`CLASS_INSTRUMENTS.terminal_e_value`, `constants.mjs:11`): `exceedance = k/n` where `k` is the
  count with `e >= 1/alpha`, and `mean_e` = the mean group e-value across the N=2000 trajectories —
  same two fields `run.mjs:101-104,113` computes, same names. `verdict`: `lower95(k,n) > alpha ?
  'FAIL' : 'not-refuted'`, mirroring `run.mjs:115` exactly (the `VERDICT_MAP`,
  `score.mjs:31`, reads either token).
- *Power (S3) arm, `shift_sigma: 3`.* Same 10 series/seeds, with a constant `+3` (raw units,
  sigma=1) added to indices `[100,300)` of every one of the 10 series — `injectUnison` at `eps=3`
  (`inject.mjs:32-34`), i.e. the certification's registered shift (`run.mjs:89-90`'s
  `CONTROL_power` construction: "same series with a 3-sigma shift in the test window") applied in
  unison across all K components rather than to a single series. `detection_rate` = fraction of
  N=2000 trajectories with the resulting group e-value `>= 1/alpha`; `verdict`:
  `detection_rate >= 0.50 ? 'POWERED' : 'INERT'` (the study's own token, §Fallback/§9 vocabulary,
  extended in A3).

**`family_E_conformal_heldout`, cell index 31, `CELL_SEED = 20260838`:**
- *Healthy (S2) arm.* Single iid-Gaussian series, `seed(i) = CELL_SEED + 7919*i`, `i = 0..1999`, no
  injection, 1-D covariance (A2). `exceedance`/`mean_e`/`verdict` computed identically to the group-
  average arm above, over the wealth process's terminal read (fires iff `M_T >= 1/alpha` anywhere
  in the post-onset window, per A2's firing rule — for the healthy arm this is a pure false-alarm
  measurement).
- *Power (S3) arm, `shift_sigma: 3`.* Same series + `injectStep(delta=3)` (`inject.mjs:27-29`) —
  the certification's registered sustained-step shift, `run.mjs:89-90`'s convention — **not** the
  K4 battery's own point injection; this arm tests the hedged-indicator construction against an
  ordinary sustained step as a basic sanity/power check independent of the point-outlier class it
  is built for. `detection_rate`/`verdict` as above.
- Held-out calibration for this arm's evaluator continues the same stream as the K4 held-out cells:
  `HELDOUT_SEED = CELL_SEED + 500000 = 20760838`, `n=10000`, `seed(j) = HELDOUT_SEED + 7919*j`,
  drawn from the healthy null (no injection) — per A7's tier finding, T1.

### A2. K4 read, interface, and derived prediction (Critical 2)

**Supersedes §13's K4 entry's *Expected/Falsifier* line for this battery's own construction; §13's
text stays as the ratified page's original wording.**

`family_E_conformal_heldout` is a per-tick wealth **process**, not a terminal read in the sense of
§5's single cal/test split — corrected here. Interface, cited precisely
(`detectors/conformal.ts:414-418,424-447,454-462`; state shape `types/families/e.ts:118-122`):

```
state = { M: 1, n: 0, alphaConsumed: 0 }                      // freshConformalEValueState, :416-418
s_t = sqrt(x_t^T Σ^-1 x_t)                                     // live Mahalanobis distance, :428
indicator = (den_raw < alpha_E * total_weight) ? 1 : 0         // rank against held-out calibration, :430-433
e_t = 1 + indicator − alpha_E                                  // :434
      indicator=0: e_t = 1 − alpha_E   (≈0.95 at alpha_E=0.05)
      indicator=1: e_t = 2 − alpha_E   (≈1.95 at alpha_E=0.05)
M_t = M_{t-1} * e_t                                             // :437
fire iff M_t >= 1/alpha_E                                       // :438
Ville: sup_t P(M_t >= 1/alpha_E | H0) <= alpha_E                // :447
```

This battery's K4 usage is **1-D**: `x_t = [v_t]` (a single scalar per tick, the injected series'
own value) and `Σ = [[1]]` (unit variance, matching §3's `sigma=1`), so `s_t = |v_t|` exactly — a
1×1 special case of the general multivariate `covariance: number[][]` parameter
(`conformal.ts:457`). `alpha_E` is set to this battery's own registered `alpha = 0.05` (§3), not
the module's own `DEFAULT_ALPHA_E = 1e-4` default.

**Derived prediction, registered before any run.** `injectPoint` (`inject.mjs:44-46`) touches
exactly one tick, `t === at`. Every other tick, pre- and post-onset, is an exact null draw. Let
`M_{at-1}` be the wealth accumulated over the pre-injection null-only ticks: `E[M_{at-1}] = 1`
exactly (pure H0 process), so by Markov/Ville, `P(M_{at-1} >= c) <= 1/c` for any `c`. At the single
injected tick, wealth can multiply by **at most `2 - alpha_E ≈ 1.95`** — the indicator is binary,
so this ceiling holds regardless of the injection's magnitude (3σ, 5σ, or 8σ): a larger point only
raises `P(indicator=1)` at that one tick, it does not raise the multiplier past 1.95. This is the
K4 severity grid's **zero-resolution property**, registered here: the grid can move the *probability*
of firing at the injected tick but cannot move the *size* of the wealth jump if it fires. For
`M_at` to reach the crossing threshold `1/alpha_E = 20`, `M_{at-1}` must be `>= 20/1.95 ≈ 10.26`,
so `P(M_{at-1} >= 10.26) <= 1/10.26 ≈ 0.0975` (v1.2: this is `P(crossing AT the injected tick)`,
not the whole-window bound — see v1.2 amendment). Ticks after `at` are again pure null (the
injection is a single point); by the same maximal (Ville) inequality applied to that pure-null
continuation starting from wealth `M_at`, the additional crossing probability contributed after the
injected tick is bounded by `E[M_at]/20 <= (1.95 * 1)/20 ≈ 0.0975` (`E[M_at] <= 2-alpha_E` since the
pre-injection wealth has mean 1 and the injected tick multiplies by at most `1.95`). **Registered
prediction: `family_E_conformal_heldout` reads NOT_POWERED at every K4 severity, canonical
included — derived ceiling `<= ~0.20` by union bound (`0.0975 + 0.0975`, rounded up), still far
below `COVERAGE_FLOOR = 0.50`.** Falsifier: any K4 severity's cell (canonical or grid) reads a
detection rate materially above ≈0.20 — that would mean either a construction/configuration defect
or a gap in this derivation, and is reported as a surprise, not tuned away.

This registered prediction **disagrees with** the ratified page's "*Expected YES at T2, real tier
deferred*" for K4 (`~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md`, K4
paragraph) — that expectation was written before this single-point wealth-bound was derived, and
concerned the construction's general validity, not its power against a single-tick injection
specifically. Per this document's own precedence rule (top of file), a disagreement between this
document and the ratified page is **reported, not silently resolved**: flagged here for wiki
write-back at Task 12, not corrected in the wiki by this document.

The crossing endpoint itself (detection = the process ever satisfies `M_t >= 1/alpha_E` within the
post-onset window) **stays** — the harder reading, unchanged from §5. Additionally, record as a
**descriptive secondary, carrying no verdict**: the indicator-flag rate at the injected tick alone
(`indicator=1` at `t=at`, independent of whether the running `M_t` ever crosses) — this isolates
"did the tail-rank fire" from "did accumulated wealth cross," which the derivation above shows can
diverge sharply.

**Named-not-built K4 candidate, one sentence, registered, built in a later phase:** a per-point
likelihood-ratio e-value with an unbounded increment (unlike the hedged-indicator's fixed ≈1.95×
per-tick ceiling, a likelihood-ratio construction's increment can scale with the injected point's
magnitude, which is what this derivation shows the current candidate structurally cannot do).

### A3. Fallbacks completed (Critical 3)

**Extends §9; does not contradict it.**

(a) **Non-finite condition.** Any cell — fault-class or the A1 S2/S3 arms — with `non_finite_wealth
> 0` carries that count in the cell. `applyGuards` (`validation/certification/lib/guards.mjs:12`,
`if (cell.non_finite_wealth > 0) return { status: 'NON_FINITE', ... }`) governs: such a cell is
excluded from scoring, named, counting toward neither COVERED nor NOT_POWERED — the same
suppression rule §8 already applies to guard-excluded cells. **Field-name correction, registered
here:** the compressed review language named this field `non_finite_count`; the actual field
`applyGuards` reads is `non_finite_wealth` (`guards.mjs:12`, and the same name in
`run-power.mjs`'s own power cells). This document registers `non_finite_wealth` as the emitted
field name — using any other name would silently defeat the very guard this amendment registers,
since `applyGuards` pattern-matches on the literal field.

(b) **`NOT-EXECUTABLE`** joins the verdict vocabulary a cell's `verdict` field may carry, alongside
`POWERED`/`INERT` (§9's existing fallback), with a `not_executable_reason` field naming the cause
— mirroring `run-power.mjs:102-106`'s `verdict`/`not_executable_reason` pair exactly. Applies both
to fault-class cells (§9's per-`(detector,cell)` scoping) and to the A1 S2/S3 arms.

(c) **Vacuity.** A cell whose detector never produced a single finite e-value across its N=2000
trajectories is `NOT-EXECUTABLE`, not `0.00` — a `0.00` detection rate asserts the detector ran and
found nothing; a cell with zero finite reads asserts nothing, and reporting it as `0.00` would be a
silent, false claim of measurement. The **denominator for `detection_rate` stays N=2000** even when
some trajectories are excluded for non-finiteness (not the count of finite reads) — deliberately
the stricter of the two choices, consistent with §10's harder-to-pass reading.

### A4. Decision rule attribution and mechanical falsifiers (Important 2, 4)

**Corrects §8's attribution; the floor value and canonical-only decision in §8 stand.**

§8 states the USE-gate lives in `coverageFor`. It does not: `coverageFor` (`score.mjs`, Task 1)
computes a class's `status` (`COVERED`/`NOT_POWERED`/`NO_EVIDENCE`) from the power cells alone,
independent of the card's overall verdict. The USE-gate — "a class reads YES only if a card whose
**overall verdict is USE** also has that class COVERED" — lives in `verdict.mjs`'s aggregation,
specifically `classRow`'s filter `emitted.filter(o => o.overall.verdict === 'USE' &&
o.coverage[classId].status === 'COVERED')` (`validation/certification/verdict.mjs:193-207`). This
document's decision rule is therefore: **`coverageFor` decides COVERED/NOT_POWERED/NO_EVIDENCE
per card from the canonical cell against `COVERAGE_FLOOR`; `verdict.mjs`'s aggregation additionally
requires that card's overall verdict be USE before a class's coverage counts toward a portfolio
YES.** Both gates apply; neither alone is "the" gate.

Every class falsifier, restated in mechanical, canonical-cell-only form (grid and `-ar1` cells
report context, never decide — §8, §10.1, reaffirmed here):

- K1: falsified iff canonical-cell detection rate `< 0.50`.
- K2: falsified iff `group_average_e_value`'s canonical-cell (idx 7) detection rate `< 0.50` **and**
  no other detector's canonical K2 cell reads `>= 0.50`.
- K3: falsified (i.e. the registered NO is wrong) iff any USE detector's canonical-cell (idx 15)
  detection rate is `>= 0.50`.
- K4: falsified iff any K4 severity cell's detection rate is materially above the A2-derived ≈0.20
  ceiling (supersedes the ratified page's generic K4 falsifier for this battery, per A2).
- K5: falsified iff canonical-cell (idx 23) detection rate `< 0.50` for **both** `safe_t` and
  `universal_inference`.
- K6: falsified (i.e. the registered NO is wrong) iff any USE detector's canonical-cell (idx 27)
  detection rate is `>= 0.50`.

### A5. Seeds completed (Important 5)

**Extends §6; the seed table and formula in §6 stand.**

- **K2 matrix streams.** Series `k` of trajectory `i`, for any K2 cell (fault-class idx 4–11 or the
  A1 general arm, idx 30): `seed(i, k) = seed(i) + 104729*k = CELL_SEED + 7919*i + 104729*k`. The
  constant `104729` reuses the prime already load-bearing in `run-power.mjs`'s own per-cell salt
  (`spec.id.length * 104729 + ...`, `run-power.mjs:67`) rather than introducing a new one.
- **K6 stream consumption, pinned from `inject.mjs:60-70` (`injectShapeMix`).** The baseline series
  for a K6 trajectory is generated first, in full (T=300 iid draws via `gaussFrom(r)`, i.e. 600 raw
  `r()` calls, using that cell's `seed(i)`); `injectShapeMix` is then called on it with the **same,
  now-advanced** `r`. For `t < at`: the function returns the already-generated `v` unchanged and
  draws nothing further (`inject.mjs:64`, the `if (t < at) return v;` branch). For `t >= at`: the
  already-generated baseline value at that index is **discarded, not reused** — the function draws
  3 fresh raw values from the same advanced stream per tick (1 for `b` via `r() < 0.5`, 2 more
  inside `gaussFrom(r)` for `w`) to build the replacement `sigma*z` (`inject.mjs:65-69`). Net raw
  `r()` draws consumed per K6 trajectory: `2*T + 3*(T-at) = 600 + 3*200 = 1200`.
- **`family_D_spectral_e_detector` cfg, registered fully** (K3 canonical + ar1 cells, idx 15/17),
  mirroring `run-power.mjs`'s own oracle-cfg construction for its `N1`/`N3-p06` cells
  (`run-power.mjs:71-72`, the `: { mu: 0, sigma: 1, phi: spec.phi ?? 0, alpha: ALPHA, windows:
  spec.windows }` branch, with `windows: 'disjoint'` per `nulls.mjs`'s `N1`/`N3-p06` entries):
  `{ mu: 0, sigma: 1, phi: 0 (idx 15) or 0.6 (idx 17), alpha: 0.05, windows: 'disjoint' }`. Where
  this contradicts any looser reading implied by §5/§7's prose, **this cfg block supersedes** —
  §5/§7 did not previously pin `windows`, and `'disjoint'` is the binding value.

### A6. `safe_t` added, measured for the record, on K2 and K4 (concern-2's harder-to-pass gap)

**Extends §7's table; `universal_inference`'s row is unchanged (still K1, K3, K5, K6 only).**

`safe_t` is added to K2 (series 0 of each unison matrix only — i.e. `safe_t` sees a single one of
the K component series, the same series indexed `k=0` under A5's per-series seed formula, and is
given no information about the other `K-1` series) and to K4 (the point-outlier series directly,
scored via §5's ordinary terminal cal/test split — `safe_t` is a certified USE detector already
scored on single series elsewhere in this battery, so this is the same call applied to the K4
generator's output). Both are recorded per K2/K4 cell (idx 4–11, 18–21) as additional `safe_t` rows
alongside `group_average_e_value`/`family_E_conformal_heldout`'s own rows for those cells — not a
replacement. Because `safe_t` already carries a USE card verdict, a `safe_t` row that happens to
clear `COVERAGE_FLOOR` on a K2 or K4 canonical cell **would independently cover that class** under
A4's decision rule — this closes the gap where, absent this measurement, a K2 or K4 NO could rest
entirely on the two unproven candidates' failure, with no certified-detector evidence checked at
all. No prediction is registered for these two added rows beyond the general single-metric-versus-
multivariate/point-outlier construction they measure; a surprise here is reported, not tuned away
(global constraint, `docs/superpowers/plans/2026-08-07-coverage-matrix-v1.md:18`).

### A7. K4 held-out substrate: clustersynth checked, found unfit, T1 fallback registered (Important 3)

**Supersedes §14's silence on substrate tier for K4; §6's `HELDOUT_SEED` formula is unchanged —
only the *source distribution* drawn under those seeds changes, from "this battery's own
generator" (as §6 implicitly assumed) to the explicit finding below.**

Checked before registering: `validation/shape-battery/harness/run-clustersynth.mjs` and
`CLUSTERSYNTH-PREREG.md`, the only existing clustersynth-driving harness in this repo.
`cs.realizeShard(...)` (`run-clustersynth.mjs`, `dist/index.js` from the sibling `clustersynth`
repo) emits **multivariate per-shard telemetry** — a named-counter row per tick
(`rec[names[0]]...rec[names[p-1]]`, `run-clustersynth.mjs`'s `rows.push(names.map(...))`) — built
for a multivariate (Mahalanobis / MCD-covariance) detector, not a single scalar stream. This
battery's K4 construction is deliberately 1-D (A2: `x_t=[v_t]`, `Σ=[[1]]`), matching
`injectPoint`'s univariate series. **Finding, registered:** clustersynth's shipped output does not
produce the 1-D scored stream this K4 held-out evaluator needs, and no existing harness in this
repo reduces it to one; manufacturing a scalar reduction (e.g. picking one counter) would not be
"clustersynth's own" data in the sense the ratified page's T2 expectation intends. **Fallback,
registered:** K4's held-out calibration rows (§6, cells 18–21, and A1's cell 31) are drawn from
this battery's own generator (`inject.mjs`'s `rng`/`gaussFrom`), as originally written in §6 — the
seed formula there is unchanged. **Tier registered explicitly as T1**, not T2. This leaves the
ratified page's "*Expected YES at T2*" **unmet by substrate**, not by construction — named here so
it is not silently absorbed into the A2 NOT_POWERED prediction, which is a separate, independent
finding.

### A8. Minor corrections

- **§5's "exactly the split" wording, corrected.** The terminal cal/test split in §5 uses
  `run.mjs:86-87`'s `{start,len}` **mechanism**, not its exact lengths: `run.mjs` splits
  `{start:0,len:ns.m}` / `{start:ns.m,len:NTEST=100}`; this battery splits `{start:0,len:100}` /
  `{start:100,len:200}` — the same two-slice structure, this battery's own lengths substituted, as
  §5 already parenthetically notes. "Exactly the split" in §5's lead sentence should be read as
  "exactly the splitting mechanism," not "identical lengths." No numeric value changes.
- **Manifest field list, registered** (binding on Task 8/9, extending §11's rule-6 mapping):
  `study`, `git_sha`, `engine_pin`/`engine_version`, `node`, `seed_scheme` (the formulas in §6/A5,
  quoted), `n` (2000), `ticks` (300), `onset` (100), `alpha` (0.05), `detectors` (§7/A6's list),
  `classes` (K1–K6 with cell indices), `substrate_sha256`, `generated_at`, `prereg: 'PREREGISTRATION.md'`
  — mirroring `run.mjs:155-162` and `run-power.mjs:134-145`'s manifest shape.
- **Substrate sha256 mechanism, registered**, per `run-power.mjs:120-123`'s precedent (hashing the
  module(s) actually driving the run): `sha256(validation/coverage/lib/inject.mjs)` — only that
  file, since `inject.mjs`'s own header (`inject.mjs:5-13`) states its RNG is copied into the file
  rather than imported from `h0-battery/harness/nulls.mjs`, so `nulls.mjs` does not drive this
  battery's runtime and hashing it would misrepresent what actually executed.
- **Emitted cell schema, registered:** every fault-class cell carries `fault_class`, `severity`,
  `canonical` (bool), `phi` (0 or 0.6), `detection_rate`, `n`, `verdict`
  (`POWERED`/`INERT`/`NOT-EXECUTABLE`, A3b), `not_executable_reason` (string or `null`, A3b),
  `non_finite_wealth` (int, A3a — corrected field name). The A1 S2/S3 arms additionally carry
  `exceedance`, `mean_e`, matching `run.mjs`'s terminal-evalue cell shape.

### Amendment summary

Superseded, with the section each override names explicitly in its own heading above: §5's "exactly
the split" wording (A8); §7's detector table, extended not replaced (A1, A6); §8's `coverageFor`
attribution (A4); §13's K4 *Expected/Falsifier* line, for this battery's own construction only —
the ratified page's original wording stands and the disagreement is reported, not resolved (A2);
§14's silence on K4's substrate tier (A7). Everything else in §1–14 stands as originally registered.

## Amendment v1.2 — 2026-08-07, corrections before any run

Three mechanical corrections to v1.1, registered before any battery run. None touches an endpoint,
floor, or falsifier's substance; each is applied in place at its erroring line (arithmetic and
citation defects, not design re-readings) and named here per rule 7's requirement that a correction
name the defect it fixes.

1. **Seed arithmetic, A1's `family_E_conformal_heldout` held-out stream.** v1.1's line read
   `HELDOUT_SEED = CELL_SEED + 500000 = 20261338` — the literal did not match the formula:
   `20260838 + 500000 = 20760838`, not `20261338`. **Registered value: `HELDOUT_SEED = 20760838`.**
   Corrected in place at A1; this is the only HELDOUT_SEED value that has ever been used to draw
   data, since no run has occurred under either the wrong or the corrected literal.
2. **Citation, A1's healthy-arm verdict-token paragraph.** `VERDICT_MAP` is defined at
   `validation/certification/lib/score.mjs:31`, not `:28` as v1.1 cited (confirmed by direct read
   of the file: `const VERDICT_MAP = { CLEARED: 'CLEARED', 'not-refuted': 'CLEARED', REFUTED:
   'REFUTED', FAIL: 'REFUTED' };` at line 31). Corrected in place.
3. **K4 ceiling bound, tightened.** A2's derivation asserted the post-injection continuation
   contributes "no further systematic crossing probability beyond the Ville bound a pure-null
   process already carries" — asserted, not derived. Corrected to an explicit maximal-inequality
   bound: the continuation after the injected tick is itself a pure-null process started from
   wealth `M_at`, so by the same Ville argument its own crossing probability is bounded by
   `E[M_at]/20`, and `E[M_at] <= 2-alpha_E ≈ 1.95` (pre-injection wealth has mean 1, the injected
   tick multiplies by at most `1.95`), giving `<= 1.95/20 ≈ 0.0975` for the continuation, added by
   union bound to the `≈0.0975` at-the-injected-tick term from A2's first half. **Registered ceiling
   is now `<= ~0.20`** (`0.0975 + 0.0975`, rounded up for the union bound's looseness), not `≈0.10`
   — still an order below `COVERAGE_FLOOR = 0.50`. The registered prediction is unchanged:
   `family_E_conformal_heldout` reads **NOT_POWERED at every K4 severity**. A4's mechanical K4
   falsifier is updated to match: falsified iff a K4 cell's detection rate is materially above
   `≈0.20` (was `≈0.10`).

No other text in §1–14 or Amendment v1.1 changes. This amendment's three items are corrections to
v1.1's own text, not new rulings — v1.1's design decisions (A1–A8) stand as registered.

## Erratum v1.3 — 2026-08-08 (post-run, discloses, changes nothing)

This is an **erratum, not an amendment**: it postdates the runs it describes
(`run-20260808T010208Z`, scored into `validation/certification/results/run-20260808T011035Z`),
so it cannot register anything. It **changes no endpoint, no floor, no threshold, no seed, no
grid, no falsifier, and no verdict.** Nothing in §1–14, Amendment v1.1, or Amendment v1.2 is
superseded. It records one defect in what §4 says the run did.

**The defect.** §4 registers the baseline as "iid Gaussian, oracle parameters … (`mu:0, sigma:1`
passed directly — no calibration-window estimation)", and every emitted cell carries
`params: 'oracle'`. For three of the five detectors that description is wrong: the parameters are
**estimated from the 100-tick calibration window**, not passed.

- `safeTwoSampleTEValue(values, cal, test, opts?)` (`detectors/safe-t-e-value.ts:103-108`) accepts
  no `mu` and no `sigma`. Its only relevant option is `ar1Phi`
  (`detectors/safe-t-e-value.ts:55-62`), documented as defaulting to the engine's
  Kendall-corrected `computePerSignalAr1Phi` estimated on the calibration window. The harness
  passes `safeTOpts(phi) = (phi > 0 ? { ar1Phi: phi } : undefined)`
  (`validation/coverage/harness/run-battery.mjs:215`), so at **φ=0 — every canonical cell — `opts`
  is `undefined` and φ is estimated**, not oracle-known. Only the four `-ar1` cells (φ=0.6) pass a
  known φ.
- `universalInferenceMeanShiftEValue(values, cal, test)`
  (`detectors/universal-inference-e-value.ts:186-190`) accepts nothing beyond the two windows;
  means, φ, and variance are all fit from the data by `fitAR1`.
- `group_average_e_value` is K per-series `safeTwoSampleTEValue` calls
  (`run-battery.mjs:230-236`) and inherits the same estimation.

**Scope — which cells.** Every cell scored by `safe_t`, `universal_inference`, or
`group_average_e_value`: all of K1, K2, K3, K5, K6, `safe_t`'s A6 rows on K4, and A1's arm 30. The
`params: 'oracle'` stamp on those rows is wrong and is **left as committed** (results are
append-only, §11 rule 6); this erratum is the correction.

**Scope — what stays valid.**

1. `family_D_spectral_e_detector` is **genuinely oracle**: `{ mu: 0, sigma: 1, phi: cell.phi,
   alpha: 0.05, windows: 'disjoint' }` is passed at `run-battery.mjs:263`, exactly as A5 registers.
2. `family_E_conformal_heldout` is neither: it uses a fixed `Σ = [[1]]` (A2) with an empirical
   held-out calibration set (§6's K4 block, A7's T1 substrate).
3. **The endpoint numbers are unaffected as measured quantities.** Each cell's detection rate is
   what the named detector did to the named data at the registered seeds; how the detector obtained
   its nuisance parameters does not change what it did. No rate, verdict, or class answer moves.
4. **Flagged, not resolved: the `phi_known` regime question.** K1's and K2's YES were measured with
   φ estimated, while `safe_t_e_value`'s card narrows its regime to known φ —
   `guarantee.regime.phi_known: true` (`validation/certification/cards/safe_t_e_value.json:51`).
   The mu/sigma half of this erratum does not conflict with that card: the same regime block
   already records `"baseline": "estimated"` (`:49`), so on mu/sigma only §4's own text was wrong.
   The φ half is a genuine mismatch between the card's declared regime and the regime the coverage
   cells were measured in. Whether a `phi_known` card may be credited with coverage measured at
   estimated φ is a question about the certification protocol, not about this battery, and it is
   reported here for the wiki write-back rather than answered.

Recorded in full, with the affected cell list, at
`validation/coverage/results/live/run-20260808T010208Z/REPORT.md` §4 (I1).

## Amendment v2.K4 — 2026-08-08, before any K4 candidate run

Registered before any run of the new candidate `point_tail_bet_e_value`
(`detectors/point-tail-bet-e-value.ts`, built and unit-tested at Task 1 of
`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`). Sections 1–14 above and Amendments
v1.1/v1.2 and Erratum v1.3 stay intact; this amendment adds. Every extension is cited against the
section it extends; nothing here supersedes a frozen value. Authority for this candidate, per the
plan's own Authority line: `~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`
(RATIFIED 2026-08-08), K4 section — then this document — then the plan.

### K4.1 Registered constants (verbatim, from the plan's Global Constraints)

Copied verbatim from `docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`'s Global
Constraints block:

> κ = 0.1 for every κp^(κ−1) calibrator (derivation registered: log-optimal κ\* = −1/E_alt[log p];
> at the registered alternatives p ≈ 1e-4 → κ\* ≈ 0.108, registered as 0.1); K4 calibration n =
> 10,000 held-out scores, score s = |x − median_ref| / MAD_ref.

**Cross-checked against `detectors/point-tail-bet-e-value.ts`'s exports — result: no diff.**
`export const KAPPA = 0.1` (`point-tail-bet-e-value.ts:38`). `calibrateTailBet` throws unless
`rows.length >= 10_000` (`:66-68`), matching the registered `n = 10,000` floor exactly (not
approximately — the module's guard is `< 10_000`, i.e. `>= 10,000` is the accepted floor). Score
computed at `pointTailBetEValue:88`, `const score = Math.abs(x - cal.median) / cal.mad;` — the
identical formula, `cal.median`/`cal.mad` being this module's names for `median_ref`/`MAD_ref`
(computed at `calibrateTailBet:70,72`, raw MAD with no consistency constant, per the module's own
docstring at `:9-14`: "the score is rank-based through the conformal p-value below, so any monotone
rescaling of the score ... leaves every rank and therefore every p-value unchanged").

### K4.2 Score and p formulas (verbatim from the code; tie direction is a validity property)

From `pointTailBetEValue` (`point-tail-bet-e-value.ts:83-93`):

```
score = |x - cal.median| / cal.mad                                  // :88
p      = (1 + #{s in cal.sortedScores : s >= score}) / (n + 1)      // :89-90, countGte
e      = kappa * p^(kappa - 1)                                       // :91
```

`countGte` (`:53-60`) counts calibration scores **greater than or equal to** the live score —
inclusive of exact ties. This is a validity property, not an implementation detail: the conformal
p-value's super-uniformity guarantee (K4.1's `∫₀¹ κp^(κ−1)dp = 1` calibrator identity depends on a
super-uniform input) requires the tie-inclusive `>=` rank; excluding ties (`>`) would make `p`
occasionally too small under exchangeability, breaking `E[e|H0] <= 1`. A regression test added at
this candidate's HEAD (`9c9c006`, "Add tie-direction regression test for K4 conformal rank count")
confirms this directly: a symmetric-integer fixture (`rows = 0..9999`) constructs an exact tie by
design and asserts `p` against the `>=`-derived count, checked to fail under a `>` mutation
(`test/point-tail-bet-e-value.test.ts:41-59`). Registered here because ties have probability 0 on
the continuous Gaussian draws this battery otherwise uses — the property is invisible on canonical
data and must be pinned by statement, not by the numeric endpoints alone.

### K4.3 Detector and cells (extends §7's table)

`point_tail_bet_e_value` joins §7 as a new row: **K4 only**, scored on the class's four frozen
fault cells — §6 indices 18 (`3sigma-point`), 19 (`5sigma-point`, canonical), 20 (`8sigma-point`),
21 (`5sigma-point-ar1`, φ=0.6) — reusing those cells' existing `CELL_SEED`s and N=2000 trajectory
streams unchanged. No new fault-cell seed is registered: this follows §6's paired-comparison
convention ("the same N=2000 trajectories ... are generated once and shared across every detector
scored on that cell") extended to this second K4 candidate exactly as it already governs
`family_E_conformal_heldout`'s and (per A6) `safe_t`'s shared use of the same cells. Card lands
Task 3 of this plan (`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`) — a separate
document from the plan §7 originally cited for other detectors' task numbers.

### K4.4 Held-out calibration streams — enumerated with arithmetic shown

Per K4.1/A7, the fallback substrate is this battery's own generator (T1), not clustersynth: A7's
finding — clustersynth's shipped shard output is multivariate per-tick telemetry with no existing
1-D reduction in this repo — applies without modification to this candidate, since
`point_tail_bet_e_value` is likewise 1-D (`calibrateTailBet(rows: number[])` takes scalar rows,
same as `family_E_conformal_heldout`'s 1×1 special case in A2). Cited, not restated: this
candidate's held-out tier is **T1**, for the same reason A7 already established.

**On the four fault cells (18–21), this candidate reuses the identical held-out stream already
registered for `family_E_conformal_heldout` on those same cells** (§6: "K4 held-out calibration ...
`HELDOUT_SEED = CELL_SEED + 500000`") — both detectors take the same `n=10,000` scalar rows, drawn
from the cell's healthy (pre-fault) null, as input; only what each detector computes from those
rows differs (covariance-based conformal state vs. median/MAD conformal score). This extends §6's
own "shared across every detector" convention from the N=2000 live-trajectory stream to the
held-out stream, registered explicitly here because §6 only stated it for the former.

**On the new arm (K4.5), a fresh held-out stream is registered**, `HELDOUT_SEED = CELL_SEED +
500000`, following the identical formula A1 already used for `family_E_conformal_heldout`'s own
arm — continuing the `+500000` pattern, not reusing another cell's stream, since cell 32 is a new
series with its own `CELL_SEED`.

Every value below is shown by arithmetic, per the v1.2 precedent (v1.1's `HELDOUT_SEED` literal for
`family_E_conformal_heldout`'s arm did not match its own stated formula, corrected in v1.2 item 1):

| cell | class/arm | `CELL_SEED` | `HELDOUT_SEED = CELL_SEED + 500000` | arithmetic |
|---|---|---|---|---|
| 18 | K4 `3sigma-point` | 20260825 | 20760825 | `20260825 + 500000 = 20760825` |
| 19 | K4 `5sigma-point` (canonical) | 20260826 | 20760826 | `20260826 + 500000 = 20760826` |
| 20 | K4 `8sigma-point` | 20260827 | 20760827 | `20260827 + 500000 = 20760827` |
| 21 | K4 `5sigma-point-ar1` (φ=0.6) | 20260828 | 20760828 | `20260828 + 500000 = 20760828` |
| 32 | `point_tail_bet_e_value` S2/S3 arm (K4.5) | 20260839 | 20760839 | `20260839 + 500000 = 20760839` |

`CELL_SEED` for cell 32 follows §6's own formula, `CELL_SEED = BASE_SEED + cellIndex`, continuing
directly from A1's last-used index (31, `family_E_conformal_heldout`'s arm): `20260807 + 32 =
20260839`. For every row: `n = 10,000`; `seed(j) = HELDOUT_SEED + 7919*j`, `j = 0..9999`; drawn
from the cell's healthy (pre-fault) null distribution (iid N(0,1) for φ=0 cells 18/19/20/32; AR(1)
φ=0.6 for cell 21) — the same seed-formula shape §6 and A1 already register, applied here with
every literal shown rather than left to be trusted.

### K4.5 New arm — cell 32, healthy (S2) and S3

**Extends A1's pattern to this candidate.** `point_tail_bet_e_value`, cell index 32, `CELL_SEED =
20260839`. Single iid-Gaussian series, `seed(i) = CELL_SEED + 7919*i`, `i = 0..1999`. Calibration
(`calibrateTailBet`) built once per cell from the K4.4 held-out stream, reused across all N=2000
trajectories — per the plan's Task 4 adapter description ("build calibration once per cell from the
registered held-out stream").

- *Healthy (S2) arm.* No injection. Test window is §5's post-onset slice, `[100, 300)` (200 ticks),
  applied per trajectory. Because this detector is a per-point terminal read with no running
  process (unlike `family_E_conformal_heldout`'s wealth process), the A1 exceedance/mean_e/verdict
  triple is computed **per point**, not per trajectory: `N_points = N * 200 = 2000 * 200 =
  400,000`. `exceedance = k / N_points` where `k` = count of points with `e >= 20`; `mean_e` = mean
  of `e` across all `N_points`; `verdict = lower95(k, N_points) > alpha ? 'FAIL' : 'not-refuted'`
  (`alpha = 0.05` per §3, `lower95` per the study's existing Wilson-bound convention, A1's
  verdict-token vocabulary via `VERDICT_MAP`, `score.mjs:31` per v1.2 item 2). This per-point
  denominator, rather than A1's per-trajectory `n=2000`, is required by the stop condition's own
  text (K4.7) — "healthy-arm **per-point** exceedance" — and is registered here as the explicit
  extension A1 did not need for a process-based detector.
- *Power (S3) arm, `shift_sigma: 3`.* Same series (same seeds as S2) + `injectStep(delta=3)`
  (`inject.mjs:27-29`), identical to A1's `family_E_conformal_heldout` S3 arm — the certification's
  registered sustained-step shift, applied here as the same basic sanity/power check independent of
  the point-outlier class this detector is built for. Detection is per-trajectory, mirroring A1's
  own "fires iff ... anywhere in the post-onset window" reading: a trajectory is detected iff **any**
  of its 200 post-onset ticks has `e >= 20`. `detection_rate` = fraction of N=2000 trajectories
  detected; `verdict: detection_rate >= 0.50 ? 'POWERED' : 'INERT'`, A1's own token pair.

### K4.6 K4 fault-cell endpoint — per-point-at-injected-tick detection is the class endpoint

**Extends §5's windowing and A2's descriptive-secondary pattern; does not alter §5's endpoint for
any other detector.** `injectPoint` (`inject.mjs:44-46`) touches exactly one tick, `t === at = 100`
— the first tick of the post-onset test window. For the four fault cells (K4.3):

- **Class endpoint (decisive): per-point `e >= 20` at the injected tick.** For each trajectory,
  compute `pointTailBetEValue(x_100, cal)` at the single injected tick only. `detection_rate` =
  fraction of N=2000 trajectories with that one point's `e >= 20`. This is the design page's
  one-point-decisive property, registered as this candidate's terminal read — because `injectPoint`
  places exactly one non-null tick per trajectory, "per-point at the injected tick" and
  "per-trajectory" are the same statistic here, unlike the S2 arm's necessarily per-point framing
  (K4.5) where every one of 200 ticks is independently null.
- **Window-crossing (descriptive secondary, no verdict).** Also recorded: the fraction of
  trajectories where **any** of the 200 post-onset ticks (not only the injected one) has `e >= 20`.
  This number conflates the single injected-tick signal with false-alarm noise from the other 199
  null ticks — at the K4.8 healthy per-point rate (≈0.0028), a 200-tick window carries a
  non-trivial compounded false-alarm chance on its own (≈0.56 expected false crossings per
  trajectory from noise alone, `200 * 0.0028`). Recording it separately, undecisive, keeps that
  multiple-testing exposure from being silently absorbed into the class endpoint — mirroring A2's
  registered distinction between the indicator-flag-at-the-injected-tick reading and the
  whole-window crossing reading for `family_E_conformal_heldout`, applied here in the opposite
  direction (there, the injected-tick read was the descriptive secondary; here, it is the class
  endpoint, because this construction's validity claim is specifically about a single point).

### K4.7 Stop condition (verbatim)

Copied verbatim from the plan's Global Constraints:

> Stop conditions (registered per group in the amendment): K4 — healthy-arm per-point exceedance
> Wilson 95% lower bound > α. ... A fired stop condition = REFUTED: record, file, class stays NO.

`α = 0.05` per §3 (unchanged, cited not redefined). Applies to K4.5's S2 arm's `exceedance`/`k`/
`N_points=400,000` (Wilson lower bound computed on that per-point count, not on any per-trajectory
count). A fired stop condition on this candidate refutes and records `point_tail_bet_e_value`;
K4 as a class stays NO only if every candidate scored on it (this one and
`family_E_conformal_heldout`) fails to cover — per A4's decision rule, unchanged here.

### K4.8 Predictions, with falsifiers

- **Healthy per-point exceedance.** *Prediction:* `≈ 200^(−1/0.9) ≈ 0.0028`, at or below `α = 0.05`
  — derived exactly as Task 1's own validity test derives it (`test/point-tail-bet-e-value.test.ts`,
  "validity: healthy exceedance at alpha=0.05 within binomial tolerance": `E[1{e>=20}] = P(p <=
  (20/kappa)^(1/(kappa-1))) = (200)^(-1/0.9) ≈ 0.00279`), applied here to the K4.5 S2 arm's
  400,000-point count rather than that unit test's own N=4000. *Falsifier:* the stop condition
  itself (K4.7) — Wilson 95% lower bound on the measured per-point exceedance exceeds `α = 0.05`.
- **K4 canonical (`5sigma-point`, cell 19) detection.** *Prediction:* `>= 0.50`, expected YES. A
  genuine 5σ point under the Gaussian null has tail probability on the order of `1e-6`, which ranks
  beyond essentially all `n=10,000` calibration scores (`p ≈ 1/10,001 ≈ 1e-4`), giving `e ≈
  0.1*(1e-4)^(-0.9) ≈ 398` — the same order Task 1's "beyond-calibration" test measures directly
  (`e > 300 && e < 500` for an extreme point) — far above the `e >= 20` bar, so canonical-severity
  detection is expected to clear `COVERAGE_FLOOR = 0.50` with room. This is the design page's "why
  one point can be decisive" argument, registered as this candidate's own prediction rather than
  restated from `family_E_conformal_heldout`'s A2 derivation — A2's `NOT_POWERED` ceiling is
  specific to the hedged indicator's fixed ≈1.95× per-tick multiplier and does not apply here: this
  construction's per-point increment is unbounded in rank, which is precisely the design page's
  named contrast between the two K4 candidates. *Falsifier:* canonical-cell (idx 19) detection rate
  `< 0.50`.
- Grid cells (18, 20) and the `-ar1` cell (21) are recorded for context; per §8/§10.1, only the
  canonical cell decides COVERED/NOT_POWERED for this candidate, unchanged by this amendment.

### K4.9 `-ar1` cell — measured out-of-claim (exchangeability regime)

Cell 21 (`5sigma-point-ar1`, φ=0.6) is scored and recorded but decides nothing, per §8/§10.1's
existing rule that the `-ar1` replicate never independently decides coverage. Specific to this
candidate: the validity argument in K4.1/K4.2 rests on **exchangeability** of the (calibration,
live) scores — the conformal super-uniformity step. Serial dependence under AR(1) breaks that
exchangeability premise, so cell 21 measures the construction's behavior under a regime the card's
guarantee does not claim, exactly as the design page states ("the `-ar1` cell measures marginal
validity under serial dependence and is out-of-claim (reported, not gated)"). A surprising result
on cell 21 is reported, not treated as a falsifier of K4.8's canonical prediction.

### K4.10 Fallbacks — inherited from A3, not restated

NOT-EXECUTABLE, non-finite, and vacuity handling for this candidate's cells (fault cells 18–21 and
arm cell 32) follow A3 unchanged — `non_finite_wealth` field name (A3a), `NOT-EXECUTABLE` verdict
token with `not_executable_reason` (A3b), and the N=2000-denominator vacuity rule (A3c). No new
fallback text is registered here; A3 already governs every candidate scored under this study,
`point_tail_bet_e_value` included.

### K4.11 House rules, mapped

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`: (1) committed before
any run of this candidate — no `point_tail_bet_e_value` run exists at this commit. (2) A failed
endpoint (K4.7's stop condition, or K4.8's falsifier) is a publishable result; nothing above moves
afterward. (3) No post-hoc analysis exists yet; reserved, to be labelled and carry no verdict if
written. (4) Fallback rule: K4.10, inherited from A3. (5) Does not apply, as §11 rule 5 already
states for this synthetic battery. (6) Results append-only: binding on this candidate's future
runs, same manifest shape as §11 rule 6 and A8's field list. (7) Reruns only for a named code
defect, prior run preserved: binding. (8) The report states every endpoint's number and verdict:
binding on this candidate's task report.

### Amendment summary

Adds, extending the sections named in each subsection above: a new §7 row (K4.3); held-out stream
reuse on the four fault cells plus a fresh stream on a new cell 32 (K4.4, extending §6/A1/A7); a new
arm at cell 32 (K4.5, extending A1); the per-point-at-injected-tick class endpoint with a
descriptive window-crossing secondary (K4.6, extending §5/A2); the K4 stop condition applied to this
candidate's own per-point count (K4.7, quoting the plan verbatim); predictions with falsifiers
(K4.8); the `-ar1` cell's out-of-claim scope (K4.9); fallback inheritance (K4.10, citing A3). Nothing
in §1–14, Amendment v1.1, Amendment v1.2, or Erratum v1.3 is superseded.

## Amendment v2.K4.1 — 2026-08-08, corrections before any K4 run

Closes a review verdicted NEEDS-AMENDMENT-BEFORE-RUN on Amendment v2.K4. Registered before any run
of `point_tail_bet_e_value`. Amendment v2.K4's text (K4.1–K4.11) stays intact; every item below
names the exact subsection it corrects or extends, per rule 7. All items are registrations: no
endpoint, floor, or seed moves.

### K4.1.1 A4's K4 falsifier scoped to `family_E_conformal_heldout` (Critical 1)

**Names a supersession of A4's K4 row.** A4 states: "K4: falsified iff any K4 severity cell's
detection rate is materially above the A2-derived ≈0.20 ceiling." That ceiling is specific to
`family_E_conformal_heldout`'s bounded-increment (≈1.95× per-tick) construction — A2 derives it
from that construction's fixed multiplier, not from anything general to K4. **Supersedes A4's K4
row for `point_tail_bet_e_value`:** the ≈0.20-ceiling falsifier applies to
`family_E_conformal_heldout` only; `point_tail_bet_e_value`'s K4 falsifier is K4.8's own (canonical
detection `< 0.50`), unbounded-increment and unrelated to the Ville-derived ceiling. A4's K4 row
for `family_E_conformal_heldout` is otherwise unchanged.

### K4.1.2 §6's "family_E_conformal_heldout only" scoping superseded, named (Important 1)

K4.4 registers `point_tail_bet_e_value` reusing the same held-out stream §6 states is for
"`family_E_conformal_heldout` only" (cells 18–21). That reuse **supersedes §6's *only* scoping**
for those four cells — named explicitly here, since K4.4's own text called this an "extension" of
§6's sharing convention, not a supersession of §6's literal restrictive wording, and the two are
different claims. §6's `HELDOUT_SEED` formula, `n`, and `seed(j)` formula are unchanged; only the
"only" qualifier is superseded, and only for cells 18–21.

### K4.1.3 K4 candidate set corrected to three (Important 2)

**Corrects K4.7's closing paragraph.** K4.7 read: "K4 as a class stays NO only if every candidate
scored on it (this one and `family_E_conformal_heldout`) fails to cover." That omits the third row
already registered on these same cells: A6 additionally scores `safe_t` on K4 (idx 18–21) and, per
A4's decision rule, "a `safe_t` row that happens to clear `COVERAGE_FLOOR` on a ... K4 canonical
cell would independently cover that class." **Corrected:** the K4 candidate set is three —
`point_tail_bet_e_value` (this amendment), `family_E_conformal_heldout` (A1/A2), and `safe_t` (A6)
— and a K4 class-level NO requires all three below `COVERAGE_FLOOR = 0.50` at the canonical cell
(idx 19). K4.7's stop condition and α = 0.05 are unchanged; only the candidate-set sentence is
corrected.

### K4.1.4 Cell-32 emitted fields, registered (Important 3)

**Extends K4.5; names the exact fields Task 4 must emit**, not stated as field names in K4.5:

- `n`: **2000** — trajectory count, unchanged shape from A1/A3(c).
- `n_points`: **400000** (new field) — the per-point denominator, `N * 200` (K4.5).
- `exceedance`: per-**point** rate, `k / n_points` (not `k / n`).
- `lower_95`: per-**point** Wilson 95% lower bound on `exceedance` (new field name for this
  candidate's healthy arm; distinct from A1's per-trajectory `k, n` pair, which this cell does not
  carry).
- `verdict`: derived directly from `lower_95` vs. `alpha` (`lower_95 > 0.05 ? 'FAIL' :
  'not-refuted'`) — not from `lower95(k, n)` computed fresh, since `lower_95` is already the
  registered field.
- `mean_e`: unchanged from K4.5 (mean of `e` across all `n_points`).

Task 4's adapter must emit exactly this field set for cell 32's S2 row; the S3 row keeps A1's
per-trajectory `detection_rate`/`verdict` pair (K4.5), which this item does not change.

### K4.1.5 `params` literal registered (Important 4)

**Registers a new `params` literal, closing the v1.3 defect class for this detector before it
ships.** Every `point_tail_bet_e_value` cell and arm (fault cells 18–21, arm cell 32) stamps
`params: 'heldout-empirical'` — a literal not used elsewhere in this study's registered vocabulary
(`oracle`, `estimated-moments`, `oracle-phi`, `estimated-phi`, `moment-matched`, per
`validation/certification/lib/nulls.mjs:60-86`). This is deliberately accurate rather than reusing
`'oracle'` (Erratum v1.3's defect): this candidate's `median_ref`/`MAD_ref` are neither oracle
constants nor a plug-in fit on the scored trajectory's own calibration window — they are empirical
statistics of an independent held-out sample (K4.4).

**Checked, not assumed:** `phiIsEstimated` (`validation/certification/lib/nulls.mjs:94-98`) reads
`cell.phi_source` first, then `cell.params === 'estimated-phi'` literally, then falls back to
`derivePhiParams(cell.null_id)`. Coverage-battery cells (this study's schema, A8) carry neither
`phi_source` nor `null_id` (those are fields the `NULL_ID` pattern in `nulls.mjs:60-86` reads for a
different study's cells — `guards.mjs`'s own comment names `N4-p09` as an example of that id
shape), and `'heldout-empirical'` does not equal `'estimated-phi'` — so `phiIsEstimated` reads
`false` for every `point_tail_bet_e_value` cell regardless of which literal is stamped. Registering
`'heldout-empirical'` is therefore not required to protect the `phi_known` regime check (it is
already mechanically inert on this schema either way); it is registered for accuracy of the stamp
itself, per Erratum v1.3's own standard ("a `0.00` detection rate asserts the detector ran and
found nothing ... reporting it as `0.00` would be a silent, false claim" — the same reasoning
applied here to `params`, not detection rate).

### K4.1.6 Non-finite fallback reading for this detector (Important 5)

**Extends A3 (K4.10); does not contradict it.** A3(a)'s `non_finite_wealth` field and guard apply
unchanged. §9's per-`(detector,cell)` adapter-throw fallback is unchanged: an adapter throw is
still counted per trajectory. Registered addition: once `calibrateTailBet` succeeds (mad ≠ 0, `n
>= 10,000`, per `point-tail-bet-e-value.ts:66,73`), every `pointTailBetEValue` call returns a
finite `e` in the closed interval **`[0.1, 398.14]`** — `p` ranges over `{1/10001, ..., 10001/10001}`
(never 0), so `e = 0.1 * p^(-0.9)` ranges from `0.1 * 1^(-0.9) = 0.1` (at `p = 1`) to `0.1 *
(10001)^0.9 ≈ 398.143` (at `p = 1/10001`) — both endpoints finite and computed directly (verified
here, not asserted). **`non_finite_wealth` is therefore identically 0 for every
`point_tail_bet_e_value` cell** once calibration succeeds — non-finiteness is structurally
impossible for this construction, unlike a running wealth process where multiplication can
overflow. The field name is a misnomer for a per-point (non-accumulating) detector — no "wealth" is
multiplied here — kept only so `applyGuards`' literal pattern-match (`guards.mjs:12`) continues to
apply uniformly across all cells regardless of detector shape.

### K4.1.7 Wilson interval caveat — anti-narrow, a trigger not a confidence statement (Important 6)

**Extends K4.7's stop condition; the trigger mechanics (K4.1.3) are unchanged.** The S2 healthy
arm's `n_points = 400,000` (K4.1.4) are **not** 400,000 independent draws against a fresh
reference each — every one is scored against the **same single** calibration draw (K4.4's `n =
10,000` held-out rows, drawn once per cell). The event `{e >= 20}` is `{score ranks in the top 27
of the calibration set}`, i.e. `{score <= q_27}` for a fixed empirical quantile `q_27` that is
itself a random variable of that one calibration draw: for `n = 10,000` iid calibration rows, the
CDF value at the 27th order statistic (of the absolute-deviation scores) is `Beta(27, 9974)`-
distributed (verified here): mean `27/10001 ≈ 0.0027`, sd `≈ 0.000519`. The binomial sd of the
exceedance proportion at `n_points = 400,000`, computed as if each point were an independent fresh
draw against the population quantile, is `sqrt(p(1-p)/400000) ≈ 0.0000820` — the calibration-draw
sd is **≈6.3×** larger (verified: `0.000519 / 0.0000820 ≈ 6.32`). **Registered caveat:** the Wilson
95% interval as computed on `(k, n_points)` treats all 400,000 points as independent given the
population quantile, which understates the true between-run uncertainty by roughly this factor —
it is **anti-narrow**, not a valid 95% confidence statement on the true exceedance probability. It
remains registered as **the stop-condition trigger exactly as K4.7 defines it** — a mechanical
threshold test on the recorded number, not a claim of calibrated coverage — and an anti-narrow
(too-tight) interval is the **harder-to-pass** reading per §10 (a tighter interval is more, not
less, likely to cross `alpha` on noise, so this choice does not favor a false NOT-REFUTED). Given
the ≈40×+ gap between the predicted rate (K4.1.9, `≈0.0027`) and `alpha = 0.05`, this caveat is not
expected to change any outcome; it is registered so the interval is never quoted as a calibrated
confidence statement in the eventual report.

### K4.1.8 `mean_e` prediction, registered (Important 7)

**Extends K4.5/K4.8.** Under continuous `p ~ Uniform(0,1)`, `∫₀¹ κp^(κ-1)dp = 1` (module docstring,
`point-tail-bet-e-value.ts:31-32`) — but this candidate's `p` is **discrete**, uniform over the
`n+1 = 10001` attainable values `{1/10001, ..., 10001/10001}` (K4.1.9), and the calibrator's steep
`p^(-0.9)` term is clipped at the discretization's minimum attainable `p = 1/10001`, capping the
maximum single-point `e` at `≈398.14` (K4.1.6) rather than letting it diverge as the continuous
integral implicitly allows arbitrarily close to `p=0`. On this registered `n = 10,000` grid, the
exact discretized expectation (verified here, summed directly over all 10001 attainable values,
each equally likely) is **`E[e] ≈ 0.6246`**, below the continuous integral's 1 because the grid's
clipped tail contributes less mass than the continuum's unclipped tail removes elsewhere. The naive
per-point sd (ignoring the K4.1.7 calibration-draw correlation) is `≈5.425`, giving a naive
standard error over `n_points = 400,000` of **`≈0.0086`**. **Prediction:** the healthy arm's
`mean_e` is expected near `0.6246 ± ~0.03` (3-sd band on the naive se), well under
`TERMINAL_MEAN_BOUND = 1` (`validation/certification/lib/constants.mjs:18`). `meanRule`
(`validation/certification/lib/guards.mjs:72-88`) applies to this candidate — its card class is
`terminal_e_value` (K4.5) — and overrides only if `mean_e` (or a recorded `mean_e_lower_95`)
exceeds `1`; **meanRule's override is not expected to fire**, and a fired override is registered
here as a surprise to report, not tuned away.

### K4.1.9 Minor corrections

- **K4.8's healthy per-point exceedance, corrected.** K4.8 registered `≈ 200^(-1/0.9) ≈ 0.0028` —
  the continuous approximation. **Corrected, exact:** `p` is discrete, uniform over `{k/10001 : k =
  1..10001}` under exchangeability (rank of the live point among 10001 exchangeable scores). The
  largest attainable `k` with `e = 0.1*(k/10001)^(-0.9) >= 20` is `k = 27` (verified by direct
  enumeration over all 10001 attainable values): `p = 27/10001 ≈ 0.0026997`. **Registered exact
  prediction: `27/10001 ≈ 0.002700`**, replacing the continuous `0.0027752` figure — this is exact
  under the registered discretization, not an approximation, and is the lower (harder-to-pass, per
  §10) of the two figures. Corrected in place at K4.8; no other text there changes.
- **K4.6's window-crossing arithmetic, corrected.** K4.6 estimated "≈0.56 expected false crossings
  ... `200 * 0.0028`" — both the multiplier and the rate were imprecise: the window-crossing count
  is over the **199** non-injected ticks (`t = 101..299`; the 200th tick, `t = 100`, is the injected
  one and is excluded from the false-alarm reading by construction), and the rate is the corrected
  exact `0.0027` above, not `0.0028`. **Corrected: `199 * 0.0027 ≈ 0.537` expected false crossings;
  `P(>= 1 false crossing) = 1 - e^{-0.537} ≈ 0.416`** (Poisson approximation to a 199-trial
  low-rate Bernoulli sum, verified here). This is a descriptive-secondary number only (K4.6); it
  decides nothing.
- **K4.11's rule-5 mapping, wording restored.** K4.11 paraphrased §11 rule 5 as "does not apply, as
  §11 rule 5 already states." **Restored to §11's own wording**, which this document's rule-5 row
  states in full: "Does not apply as written — this is a synthetic injection battery, not a
  raw-data fetch. Its equivalent freeze is this document itself (the grid, floor, and seed table
  above) plus the engine git SHA each run's manifest records (rule 6)." K4.11's rule-5 line is
  corrected to quote this in full rather than paraphrase it.
- **K4.2's citation, corrected.** K4.2 cited the `p` formula as `:89-90, countGte`. The `p`
  assignment itself is at `point-tail-bet-e-value.ts:90`; `countGte` is defined separately at
  `:53-60` and merely called at `:90`. Corrected: `p` at `:90`; `countGte` at `:53-60`, cited
  separately.
- **K4.5's card class, stated explicitly.** K4.5 did not name the card class its emitted fields
  serve. Registered explicitly: `point_tail_bet_e_value`'s card class is `terminal_e_value`, per
  the design page (`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`, K4 section:
  "Card. Class `terminal_e_value`"), matching the class `meanRule` (K4.1.8) and A1's
  exceedance/mean_e/verdict instrument set both already assume.

### K4.1.10 Exactness nuance — reported for wiki write-back, not resolved here (Minor 1)

**One sentence, registered for the eventual wiki write-back (Task 12), not adjudicated in this
document.** `calibrateTailBet` computes `median_ref`/`MAD_ref` from the same `n = 10,000` held-out
rows whose own scores (`cal.sortedScores`) are then built using those statistics
(`point-tail-bet-e-value.ts:69-77`) — each calibration row's score is computed against a reference
that included that row itself, while a live point's score is computed against a reference it never
contributed to; this asymmetry makes calibration-vs-live exchangeability **`O(1/n)`-approximate and
anti-conservative** (calibration scores run systematically slightly smaller than a same-sized
fresh-split reference would produce, since each is measured against a median/MAD pulled slightly
toward itself), not the exact identity K4.2 and the design page both state. This is a disagreement
with the design page's "exact" to **file**, per this document's own precedence rule (top of file),
not to silently repeat — flagged here for Task 12's wiki write-back, unresolved in this amendment.

### Amendment summary

Supersedes, named against the row each corrects: A4's K4 falsifier row, scoped to
`family_E_conformal_heldout` only (K4.1.1); §6's "`family_E_conformal_heldout` only" scoping on
cells 18–21 (K4.1.2). Corrects, named against the subsection each fixes: K4.7's candidate-set
sentence (K4.1.3); K4.8's healthy per-point exceedance figure (K4.1.9); K4.6's window-crossing
arithmetic (K4.1.9); K4.11's rule-5 wording (K4.1.9); K4.2's citation (K4.1.9). Registers new
content extending K4.5 (cell-32 field names, K4.1.4; card class, K4.1.9), a new `params` literal
(K4.1.5), a non-finite fallback reading (K4.1.6), a Wilson-interval caveat (K4.1.7), and a `mean_e`
prediction (K4.1.8). Files one disagreement for wiki write-back without resolving it (K4.1.10). No
endpoint, floor, or seed in §1–14, Amendment v1.1, Amendment v1.2, Erratum v1.3, or Amendment v2.K4
moves.

## Amendment v2.K3 — 2026-08-08, before any K3 candidate run

Registered before any run of the new candidate `spectral_bet_e_process`
(`detectors/spectral-bet-e-process.ts`, built and unit-tested at Task 6 of
`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`, commit `f843902`, review fix round 1
at `b8ba0e0`). Sections 1–14 above and Amendments v1.1/v1.2/v2.K4/v2.K4.1 and Erratum v1.3 stay
intact; this amendment adds. Every extension is cited against the section it extends; nothing here
supersedes a frozen value. Authority for this candidate, per the plan's own Authority line:
`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md` (RATIFIED 2026-08-08), K3 section
— then this document — then the plan.

### K3.1 Registered constants (verbatim, cross-checked against the module's exports)

Copied verbatim from `docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`'s Global
Constraints block:

> K3 **W = 30**, Fourier bins **k ∈ {1, 2, 3}** (f = k/30), ordinate `U = I(f_k)/σ²` with `I(f_k) =
> |Σ_{t<W} x_t · e^(−i2πkt/W)|² / W`, per-window `p = exp(−U)` (exact Uniform(0,1) for iid N(0, σ²),
> k ∉ {0, W/2}).

κ = 0.1 is the same shared-derivation constant K4.1 already registers (log-optimal κ* derivation,
not restated).

**Cross-checked against `detectors/spectral-bet-e-process.ts`'s exports — result: no diff.**
`export const W_K3 = 30` (`:57`); `export const BINS_K3 = [1, 2, 3]` (`:62`); `export const KAPPA_K3
= 0.1` (`:66`). BINS_K3 avoids both `{0, W/2} = {0, 15}` by construction — `BINS_K3`'s own JSDoc
names this explicitly (`:59-61`, "Neither touches {0, W/2} = {0, 15}, where the exactness
identity's hypotheses ... fail").

### K3.2 Ordinate/p/e formulas (verbatim from the code, line cites) and the exactness identity's hypotheses

From `spectralBetWindow` (`spectral-bet-e-process.ts:88-114`):

```
theta = (-2*pi*k*t) / W_K3                                    // :103
re += window[t]*cos(theta); im += window[t]*sin(theta)        // :104-105, summed over t<W_K3
I    = (re*re + im*im) / W_K3                                 // :107
U    = I / (sigma*sigma)                                      // :108
p    = exp(-U)                                                // :109
e    = kappa * p^(kappa-1)                                    // :110
eAvg = mean_k(e), k in BINS_K3                                // :113
```

**Exactness identity, hypotheses named** (module docstring, `:22-27`, cross-checked against the
formula above — result: no diff): for iid **N(0, σ²)** noise, **σ known**, at any Fourier frequency
`k ∉ {0, W/2}`, the real and imaginary DFT sums are iid N(0, σ²·W/2), so `2U_k ~ chi²_2` exactly,
`U_k ~ Exponential(1)` exactly, and `p_k = exp(−U_k)` is **exactly** Uniform(0,1) — not asymptotic,
true at every finite W. `BINS_K3 = [1,2,3]` satisfies `k ∉ {0,15}` by construction (K3.1). AR(1)
colors the spectrum and breaks the per-bin independence this identity assumes (module docstring,
`:29`), so the `-ar1` cell (idx 17) is out-of-claim by design — K3.14 registers this as measured,
not a falsifier.

### K3.3 Known-σ regime — genuinely oracle, closing the I1-class gap for this detector

**Registered in advance, distinguishing this candidate from Erratum v1.3's finding.** The battery
passes the generator's **true σ** (`SIGMA = 1`, §3) directly as `spectralBetWindow`'s `sigma`
argument, which the function guards and never estimates (`spectral-bet-e-process.ts:96`, `if
(!(sigma > 0)) throw ...` — a presence/sign guard on a caller-supplied literal, not a fitting step;
there is no calibration-window read anywhere in `spectralBetWindow`'s or `spectralBetWealth`'s
bodies). This is **genuinely oracle**, unlike Erratum v1.3's finding that `safe_t`,
`universal_inference`, and `group_average_e_value`'s `params: 'oracle'` stamps were wrong for
mu/sigma (estimated from the calibration window despite the label) — `family_D_spectral_e_detector`
was the one detector Erratum v1.3 confirmed stayed genuinely oracle (§1.3, "Scope — what stays
valid," item 1: `{ mu: 0, sigma: 1, phi: cell.phi, ... }` passed literally). This candidate shares
that same pass-through construction and closes the same class of gap for itself: `params: 'oracle'`
is registered here as **verified accurate for this detector specifically**, not assumed by
similarity to a sibling candidate — checked directly against the function bodies above, the same
standard Erratum v1.3 itself sets ("a `0.00` detection rate asserts the detector ran and found
nothing ... reporting it as `0.00` would be a silent, false claim," applied here to the `params`
stamp before any run exists to get it wrong, rather than after).

### K3.4 Bin-combination form — registered honestly, the implemented divergence from the design page named (binding obligation)

**The module implements product-over-windows of per-window bin-averages: `wealth = prod_w
mean_k(e_{k,w})`.** Per window: bins combine by AVERAGING e-values across `k ∈ BINS_K3`, `eAvg =
mean_k(e_k)` (`:113`, "never max: an average of e-values with `E[e]<=1` each still has
`E[eAvg]<=1`; a max does not preserve validity," module docstring `:43-45`). Across windows: the
per-window `eAvg` values combine by **product**, accumulated in the log domain per ADR 0026
(`spectralBetWealth`, `:128-135`; `logM = advanceLogWealth(logM, Math.log(eAvg), ...)`, `:133`, one
call per window) — disjoint windows are independent under the null, so this product is a genuine
test martingale (module docstring `:46-48`).

The design page's own prose (`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`, K3
section: "Per-bin wealth is a product over windows — a genuine test martingale. Bins combine by
**averaging wealths** across the registered frequency grid") reads as the **opposite composition
order**: an average, across bins, of each bin's OWN product-over-windows wealth — `mean_k(prod_w
e_{k,w})` — not the module's `prod_w(mean_k e_{k,w})`. **Both are valid e-processes** (a product of
per-window bin-averages is a martingale because disjoint windows are independent and each window's
bin-average has `E[e|H0]<=1`; an average of per-bin wealths is valid under arbitrary dependence
across bins because each per-bin wealth, itself a product over independent windows, has
`E[wealth|H0]<=1` and averaging preserves that bound) — **but they are not the same statistic** and
generally take different numeric values on the same data, since averaging and multiplying do not
commute.

**This battery registers and scores the form the module implements** — `prod_w(mean_k e_{k,w})` —
because that is the code Task 8 calls, not a re-derivation of the design page's phrasing. **Measured
canonical-cell delta between the two forms: 1.5 percentage points** (Task 6 code review,
`f843902..b8ba0e0`, an unregistered review-time probe on the implemented module — the same review
context K3.11 discloses for its own separate probe number; this is a different measurement, the
combination-order delta, not the fire-rate probe). **Filed for wiki write-back at Task 12, not
adjudicated here**, per the top-of-file precedence rule: the design page's "bins combine by
averaging wealths" sentence either needs correcting to describe what ships (`prod_w mean_k`) or the
module needs to change to match the page (`mean_k prod_w`) — this document does not choose between
them.

**The K3 card's guarantee sentence (Task 7's card, this document's companion commit) describes the
implemented form — `prod_w(mean_k e_{k,w})` — not the design page's prose.**

### K3.5 Detector and cells (extends §7's table)

`spectral_bet_e_process` joins §7 as a new row: **K3 only**, scored on all six of the class's
registered cells, reusing §6's existing `CELL_SEED`s and N=2000 trajectory streams unchanged (no
new fault-cell seed registered — §6's paired-comparison convention, already governing
`family_D_spectral_e_detector`'s shared use of idx 15/17, extended here to all six):

| idx | severity | phi | `CELL_SEED = BASE_SEED + idx` | arithmetic |
|---|---|---|---|---|
| 12 | `A0.5sigma-f0.02` | 0 | 20260819 | `20260807 + 12 = 20260819` |
| 13 | `A0.5sigma-f0.05` | 0 | 20260820 | `20260807 + 13 = 20260820` |
| 14 | `A0.75sigma-f0.02` | 0 | 20260821 | `20260807 + 14 = 20260821` |
| 15 | `A0.75sigma-f0.05` (canonical) | 0 | 20260822 | `20260807 + 15 = 20260822` |
| 16 | `A0.75sigma-f0.1` | 0 | 20260823 | `20260807 + 16 = 20260823` |
| 17 | `A0.75sigma-f0.05-ar1` | 0.6 | 20260824 | `20260807 + 17 = 20260824` |

Cross-checked against §6's own table — result: no diff. `spectral_bet_e_process` is scored on these
six cells alongside `safe_t`/`universal_inference` (all six) and `family_D_spectral_e_detector`
(idx 15/17 only, §7, measured for the record, REFUSE card). Card lands Task 7 of
`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`.

### K3.6 New arm — cell 33, seed arithmetic

No held-out calibration stream is registered for this candidate — K3.3 establishes σ is passed
directly, with no calibration step anywhere in the call path, so unlike the two K4 candidates this
detector has nothing analogous to `calibrateTailBet`/`heldoutRows` to seed. New arm cell,
continuing directly from `point_tail_bet_e_value`'s arm at idx 32 (Amendment v2.K4, K4.4/K4.5):

| cell | class/arm | `CELL_SEED = BASE_SEED + idx` | arithmetic |
|---|---|---|---|
| 33 | `spectral_bet_e_process` S2/S3 arm (K3.7) | 20260840 | `20260807 + 33 = 20260840` |

Trajectory seeds: `seed(i) = CELL_SEED + 7919*i`, `i = 0..1999`, §6's formula shape unchanged.

### K3.7 New arm — cell 33, healthy (S2) and S3

**Extends A1/K4.5's pattern to this candidate.** Single iid-Gaussian series (σ=1, §3), `seed(i) =
20260840 + 7919*i`, `i = 0..1999`. Test span is K3.9's registered 6-window partition of the
post-onset slice, `t = 100..279` (6 disjoint windows of `W_K3 = 30`), `t = 280..299` unused —
applied identically to both rows below (same span the fault cells use, K3.9).

- **Healthy (S2) arm.** No injection. Because this detector is a running, window-indexed process
  (like `family_D_spectral_e_detector`), not a per-point terminal read (unlike
  `point_tail_bet_e_value`'s K4.5 arm), detection is read the same way K3.9 reads it for the fault
  cells: a trajectory is detected iff `spectralBetWealth`'s `log[]` array (field declared
  `spectral-bet-e-process.ts:119`; semantics documented `:122-126`, "the cumulative log-wealth
  through window i"), the cumulative log-wealth at each window index, satisfies `wealth >= 20`
  (`log_M >= Math.log(20)`) at **any** of the 6 window checkpoints — the any-prefix, Ville-inequality
  reading, martingale time being the window index here rather than the tick index. Per-trajectory
  denominator (not per-point — this candidate has no per-tick reading the way `point_tail_bet_e_value`
  does; K3.13's own stop-condition text is "healthy-arm **crossing rate**," a per-trajectory
  quantity, matching this reading, not K4.7's per-point one).
- **Power (S3) arm, `shift_sigma: 3`.** Same series/seeds + `injectStep(delta=3)`
  (`inject.mjs:27-29`), the certification's registered sustained-step shift — the same basic
  sanity/power check independent of the oscillation class this detector targets, mirroring
  A1/K4.5's own S3 arms exactly (a step is not an oscillation; this is a construction sanity check,
  not a K3-class power measurement). Detection: any of the 6 window checkpoints crosses 20.

**Per-cell fields, registered** — chosen to avoid a collision with `CLASS_INSTRUMENTS`' foreign-
instrument strings (K3.15 explains why this matters for a `test_martingale`-class card):

- S2 row: `detector`, `arm: 'healthy'`, `cell_index: 33`, `null_id`, `phi: 0`, `params: 'oracle'`
  (K3.3), `alpha: 0.05`, `n: 2000`, `ticks: 300`, `onset: 100`, `windows: 6`, `window_len: 30`,
  `window_span: '[100,280)'`, `k` (count of trajectories crossing), `trajectory_crossing_rate =
  k/n`, `lower_95` (Wilson 95% lower bound on `trajectory_crossing_rate`, `k`/`n=2000` — the exact
  pair K3.13's stop condition tests), `final_wealth_mean`, `final_wealth_median` (wealth
  descriptives, across the N=2000 trajectories' window-5 wealth), `non_finite_wealth`,
  `adapter_failures`, `verdict: lower_95 > alpha ? 'FAIL' : 'not-refuted'` (A1's `VERDICT_MAP`
  token pair, `score.mjs:31`), `not_executable_reason`, `substrate_tier: 'T1'`.
- S3 row: `detector`, `arm: 'power'`, `cell_index: 33`, `null_id`, `phi: 0`, `params: 'oracle'`,
  `shift_sigma: 3`, `alpha: 0.05`, `n: 2000`, `ticks: 300`, `onset: 100`, `fires` (count crossing),
  `detection_rate = fires/n`, `final_wealth_mean`, `final_wealth_median`, `non_finite_wealth`,
  `adapter_failures`, `verdict: detection_rate >= 0.50 ? 'POWERED' : 'INERT'`,
  `not_executable_reason`, `substrate_tier: 'T1'`.

### K3.8 Fault-cell field registration (extends §7/A8's emitted-cell-schema convention)

Every fault cell (idx 12–17) scored by `spectral_bet_e_process` carries: `detector`, `fault_class:
'K3'`, `severity`, `canonical`, `cell_index`, `null_id`, `phi`, `params: 'oracle'` (K3.3), `alpha:
0.05`, `n: 2000`, `ticks: 300`, `onset: 100`, `windows: 6`, `window_len: 30`, `window_span:
'[100,280)'` (K3.9), `fires` (count of trajectories crossing 20 at any of the 6 window
checkpoints), `detection_rate = fires/n`, `final_wealth_mean`, `final_wealth_median`,
`non_finite_wealth` (A3a's field name), `adapter_failures`, `verdict:
'POWERED'/'INERT'/'NOT-EXECUTABLE'` (A3b's vocabulary — these are §8/A4 coverage-decision cells,
not S2/S3 card-protocol cells; K3.15 names the distinction), `not_executable_reason`,
`substrate_tier: 'T1'`.

### K3.9 Endpoint — window partition, registered exactly (read from run-battery.mjs's existing convention)

Test span is §5's post-onset slice, `[100, 300)`, 200 ticks. `W_K3 = 30` divides 200 into
`floor(200/30) = 6` complete disjoint windows (180 ticks), with **20 ticks left over**. Registered
partition, shown exactly: window 0 = `t ∈ [100,130)`, window 1 = `[130,160)`, window 2 =
`[160,190)`, window 3 = `[190,220)`, window 4 = `[220,250)`, window 5 = `[250,280)` — six windows
covering `t = 100..279` inclusive. **`t = 280..299` (the last 20 ticks) is unused** — `spectralBetWindow`
throws unless `window.length === W_K3` exactly (`spectral-bet-e-process.ts:93-95`), so a seventh,
partial (20-tick) window is not constructible without truncation or padding, and neither is
registered.

This is the reading run-battery.mjs's existing conventions support: `family_D_spectral_e_detector`'s
adapter is `kind: 'process'`, a `read(data, cell)` function that builds an instrument and steps it
(`run-battery.mjs:297-309`), but `spectralBetWealth`'s own interface (Task 6) takes pre-chunked
`windows: number[][]`, not a per-tick step call — so Task 8's adapter is registered here to slice
`data.series.slice(100, 280)` into six contiguous length-30 chunks and call
`spectralBetWealth(windows, SIGMA)` once per trajectory, reading the returned `log[]` array
(field declared `spectral-bet-e-process.ts:119`) for the any-prefix crossing check (`log[i] >= Math.log(20)`
for any `i = 0..5`) rather than re-deriving crossing from the final wealth alone — the any-time
(Ville-inequality) property K4's own A2/K4.6 registrations already establish as this study's house
reading for a running wealth process, applied here at window granularity since the martingale time
is the window index, not the tick index.

**Class endpoint (decisive): wealth ≥ 20 (`log_M ≥ Math.log(20) ≈ 2.9957`) at any of the 6 window
checkpoints within `[100,280)`.** `detection_rate` = fraction of N=2000 trajectories crossing.

### K3.10 f = 0.05 leakage note — registered in advance

Canonical severity injects `amp = 0.75σ` at `freq = 0.05` (`injectOscillation`, `inject.mjs:37-41`).
**`f = 0.05` is not a Fourier frequency of `W = 30`** — the registered grid's frequencies are `f_k =
k/30` for `k ∈ {1,2,3}`, i.e. `{0.0333, 0.0667, 0.1}`; `0.05` falls strictly between `k=1`
(`0.0333`) and `k=2` (`0.0667`), on neither grid point. **Spectral leakage across bins `k ∈ {1,2}`
is expected**, registered here in advance: canonical-cell power is expected to be carried by BOTH
`k=1` and `k=2`'s contribution to `eAvg` (partial energy split between two neighboring bins, neither
at the injected frequency exactly), not concentrated at a single bin the way grid cell idx 16
(`A0.75sigma-f0.1`, `f = 3/30 = 0.1` exactly, a clean hit on `k=3`) would show. **A low
canonical-cell detection rate alongside strong `k=3`-carrying grid-cell power (idx 16) — or grid
cell idx 14 (`f=0.02`, likewise off-grid, nearer `k=1`) reading much weaker than idx 13
(`f=0.05`, same off-grid distance from `k=1`/`k=2` but higher amplitude) — is registered here as a
**grid-vs-bin finding**: the fault-class table's frequency spacing (registered independently of this
detector, §1) missing this detector's own registered bins. Reported, not treated as a defect in the
construction itself.

### K3.11 Review-time power probe — disclosed by name and provenance (binding obligation)

**Register the K3 canonical prediction with the probe that produced it named, not silently absorbed
as an independent derivation.** During Task 6's code review (commit range `f843902..b8ba0e0`,
`.superpowers/sdd/2026-08-08-coverage-gap-detectors/review-f843902..b8ba0e0.diff`, carried forward
in `progress.md`'s Task 6 note), the reviewer ran an **unregistered, review-context probe** of the
implemented module: 6 windows, N=2000, threshold 20, canonical severity, seeds not the ones this
document registers (§6/K3.5's `CELL_SEED` formula was not the stream used in review context) —
**measured fire rate 0.642**. This number is disclosed here **by name and provenance**, not hidden
behind an independently-derived account: transparency over feigned ignorance.

**Registered prediction: expected YES at canonical** — the probe (0.642) sits well above
`COVERAGE_FLOOR = 0.50`, and K3.10's leakage note gives a mechanism (power split across two
neighboring bins, not lost) rather than a reason to expect the registered run to fall far short of
the probe. **Falsifier: canonical-cell (idx 15) detection rate at the REGISTERED §6 seeds `<
0.50`.** The probe is evidence toward the direction of this prediction, not a substitute for the
registered run — a materially different registered-seed result (e.g., far below 0.50) is reported
as a probe-vs-registered-run discrepancy in its own right, not silently reconciled or tuned away.

### K3.12 Wealth floor — registered, structurally unreachable at this span (binding obligation)

`LOG_WEALTH_FLOOR_K3 = Math.log(1e-12) ≈ -27.631` (`spectral-bet-e-process.ts:71`) binds inside
`advanceLogWealth` (`detectors/_wealth.ts:35`, `Math.max(logFloor, next)`) only once the running
cumulative log-wealth would fall below it. **At this document's registered 6-window test span
(K3.9), the floor is registered here as structurally unreachable** — Task 6 review's own finding
(carried forward in `progress.md`) is that the floor binds only at window ≥ 12, double this
battery's span. Registered so a healthy-arm run reading a small final wealth is read as "small, not
floored" — the floor's presence in the module (shared with every ADR 0026 detector, `_wealth.ts`)
is not evidence of an active guard at this span. Relevant only if a future variant of this study
extends the window count past 12; not expected to matter for any endpoint this amendment registers.

### K3.13 Stop condition (verbatim)

Copied verbatim from the plan's Global Constraints:

> Stop conditions (registered per group in the amendment): K3 — healthy-arm crossing rate Wilson LB
> > α. ... A fired stop condition = REFUTED: record, file, class stays NO.

`α = 0.05` per §3 (unchanged, cited not redefined). Applies to K3.7's S2 arm's
`trajectory_crossing_rate`/`k`/`n = 2000` (per-trajectory, K3.7's own registration — not per-point;
this candidate has no per-tick reading). A fired stop condition on this candidate refutes and
records `spectral_bet_e_process`; per §13/A4, the K3 class stays NO only if every USE detector
scored on it (canonical-cell idx 15, `safe_t`/`universal_inference`, and now this candidate) fails
to clear `COVERAGE_FLOOR` — `family_D_spectral_e_detector` is already REFUSE (§7) and its
card-verdict gate (§8/A4) bars it from ever counting toward YES regardless of any rate measured on
it, unchanged by this amendment.

### K3.14 Predictions, with falsifiers

- **Healthy crossing rate.** *Prediction:* `<= alpha = 0.05` (validity, per the exactness identity,
  K3.1/K3.2). *Falsifier:* the stop condition itself (K3.13).
- **K3 canonical (`A0.75sigma-f0.05`, idx 15) detection.** *Prediction:* `>= 0.50`, expected YES —
  per K3.11's disclosed probe (0.642) and K3.10's leakage note (power carried across `k=1`/`k=2`,
  not lost to the off-grid frequency). *Falsifier:* canonical-cell detection rate `< 0.50`.
- Grid cells (12, 13, 14, 16) are recorded for context; per §8/§10.1, only the canonical cell
  decides COVERED/NOT_POWERED for this candidate, unchanged by this amendment. Idx 16's clean-hit
  reading (K3.10) is registered in advance as the comparison point for the grid-vs-bin finding, not
  as a second decisive cell.
- **`-ar1` cell (idx 17) — measured out-of-claim.** Same reasoning as K4.9: the exactness identity
  (K3.2) assumes iid Gaussian noise; AR(1) colors the spectrum and breaks the per-bin independence
  the identity's `2U_k ~ chi²_2` step relies on (module docstring, `:29`), so cell 17 measures a
  regime the card's guarantee does not claim. A surprising result on cell 17 is reported, not
  treated as a falsifier of this section's canonical prediction.

### K3.15 Card-instrument field-name note — a registered gap, not resolved here

**Registered, not solved by this amendment.** The K3 card (Task 7's companion commit) is class
`test_martingale` (design-page K3 section: "genuine test martingale"; matches
`family_D_spectral_e_detector`'s own class). `CLASS_INSTRUMENTS['test_martingale'] =
['increment_estimator']` (`validation/certification/lib/constants.mjs:9-12`) — a validity (S2)
candidate under this class needs an `increment_estimator: {mean, sd, lower95_one_sided}` field
(`guards.mjs:25-28`'s shape) to be recognized by `isValidityCell`
(`validation/certification/lib/score.mjs:11-12`), which checks for `increment_estimator`,
`stopped_mean`, `exceedance`, `crossing_rate`, or `mean_e` — **not** `detection_rate`. K3.7/K3.8's
registered field names (`trajectory_crossing_rate`, `detection_rate`, `final_wealth_mean`, etc.) are
chosen deliberately to avoid the four foreign-instrument strings (`exceedance`, `mean_e`,
`crossing_rate`, `stopped_mean`) — `applyGuards` (`guards.mjs:14-19`) reads a cell carrying a
foreign instrument with no instance of its own class's instrument as `VOID`, and the field names
this document could otherwise have reused by analogy with A1/K4.5 (`exceedance`, `mean_e`) are
exactly two of those four strings.

**Consequence, registered plainly:** as this amendment's fields stand, arm cell 33's healthy row
will not be picked up by `isValidityCell` at all (no `increment_estimator`), so S2 is expected to
read MISSING even after a registered run lands — not just pre-run, unlike the K4 candidates, whose
`exceedance`/`mean_e` fields are exactly what `terminal_e_value`'s own instrument set names. Per
`family_C_safe_hotelling`'s own precedent in the golden table (`s2: MISSING, s3: PASS` →
`NOT_EXECUTABLE`, not `USE`), an S2-MISSING card cannot reach USE regardless of how strongly its S3
or the study's own registered endpoint (K3.13/K3.14) power out. **This document does not register a
formula for `increment_estimator`** — computing one (e.g., a mean/sd/one-sided-lower-CI on the
per-window `eAvg` sample, mirroring `family_D_spectral_e_detector`'s own card-falsifier shape,
"increment lower95 1.0011") is an adapter-design decision for Task 8, not adjudicated in advance
here. Flagged so Task 8 is not surprised if a fully successful, powerful registered run leaves this
card capped at `NOT_EXECUTABLE` — a mechanical consequence of the class/instrument pairing, not of
the detector's own validity or power.

### K3.16 Fallbacks — inherited from A3, not restated

NOT-EXECUTABLE, non-finite, and vacuity handling for this candidate's cells (fault cells 12–17 and
arm cell 33) follow A3 unchanged — `non_finite_wealth` field name (A3a), `NOT-EXECUTABLE` verdict
token with `not_executable_reason` (A3b), and the N=2000-denominator vacuity rule (A3c). No new
fallback text is registered here; A3 already governs every candidate scored under this study,
`spectral_bet_e_process` included.

### K3.17 House rules, mapped

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`: (1) committed before any
run of this candidate — no `spectral_bet_e_process` battery run exists at this commit. (2) A failed
endpoint (K3.13's stop condition, or K3.14's falsifier) is a publishable result; nothing above moves
afterward. (3) No post-hoc analysis exists yet; reserved, to be labelled and carry no verdict if
written. (4) Fallback rule: K3.16, inherited from A3. (5) Does not apply, as §11 rule 5 already
states for this synthetic battery (quoted in full at K4.1.9's own restoration, not repeated). (6)
Results append-only: binding on this candidate's future runs, same manifest shape as §11 rule 6 and
A8's field list. (7) Reruns only for a named code defect, prior run preserved: binding. (8) The
report states every endpoint's number and verdict: binding on this candidate's task report.

### Amendment summary

Adds, extending the sections named in each subsection above: a new §7 row (K3.5); a new arm at cell
33 with its own seed arithmetic (K3.6/K3.7); the window-partitioned endpoint (K3.9); the K3 stop
condition applied to this candidate (K3.13, quoting the plan verbatim); predictions with falsifiers
(K3.14); the `-ar1` cell's out-of-claim scope (K3.14); fallback inheritance (K3.16, citing A3).
Registers, without superseding anything: the constants cross-check (K3.1), the formula/exactness-
identity line cites (K3.2), the genuinely-oracle known-σ finding (K3.3), the bin-combination form
divergence from the design page with its measured 1.5pp delta (K3.4, filed for wiki write-back), the
f=0.05 leakage note (K3.10), the disclosed review-time power probe (K3.11), the structurally-
unreachable wealth floor (K3.12), and the card-instrument field-name gap for `test_martingale`
(K3.15, not resolved here). No endpoint, floor, or seed in §1–14, Amendment v1.1, Amendment v1.2,
Erratum v1.3, Amendment v2.K4, or Amendment v2.K4.1 moves.

## Amendment v2.K3.1 — 2026-08-08, before any K3 run

Closes a review verdicted FROZEN-SOUND-PENDING-K3.1 on Amendment v2.K3, adjudicating K3.15's
surfaced gap Critical. Registered before any run of `spectral_bet_e_process`. Amendment v2.K3's
text (K3.1–K3.17) stays intact; every item below names the exact subsection it corrects,
supersedes, or extends, per rule 7. All items are registrations: no endpoint, floor, or seed moves,
and — per this review's own resolution — the card JSON does not change (no re-freeze, no golden
delta): K3.1.1/K3.1.2 register per-cell fields the harness (Task 8) must emit; they do not touch
`guarantee.regime`, whose schema already accepts arbitrary keys.

### K3.1.1 S2 healthy row (cell 33) gains `increment_estimator` — the martingale's own increments (Critical, resolves K3.15)

**Extends K3.7's S2 row.** Per trajectory, the increment sample is that trajectory's six per-window
`eAvg` values — identically `exp(log[i] - log[i-1])` with `log[-1] = 0` (wealth starts at 1,
`log(1) = 0`, `spectral-bet-e-process.ts:129`'s `logM = 0` before the loop) and `log[i]` the
cumulative log-wealth `spectralBetWealth` returns through window `i` (field declared `:119`). **These
are the test martingale's own increments** — `spectralBetWealth` (`:128-136`) is a product of
per-window `eAvg` accumulated in the log domain (K3.4's own registered form,
`wealth = prod_w eAvg_w`), so `eAvg_w` **is** the martingale's per-window multiplicative increment
by construction, not a derived or approximate proxy for it. A trajectory's own increment MEAN is the
mean of its six `eAvg` values (mirroring `run-sequential.mjs:93`'s per-trajectory mean-of-per-tick-
increments, applied here per-window rather than per-tick, matching this candidate's martingale time
being the window index — K3.7's own registration). Collecting this one number per trajectory across
the N=2000 trajectories gives the sample `summarise()` (`validation/detector-audit/harness/run-sequential.mjs:37-44`)
consumes:

```
function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a,b)=>a+b,0)/n;
  const varr = n>1 ? xs.reduce((a,b)=>a+(b-mean)**2,0)/(n-1) : 0;
  const se = Math.sqrt(varr/n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645*se, upper95_one_sided: mean + 1.645*se };
}
```

**Registered field, cell 33's S2 row only:** `increment_estimator: {n, mean, sd, se,
lower95_one_sided, upper95_one_sided}`, the exact shape above, `n` expected `2000` absent a
degenerate window (K3.1.6). This satisfies `CLASS_INSTRUMENTS['test_martingale'] =
['increment_estimator']` (`constants.mjs:10`) and `isValidityCell`
(`score.mjs:11-12`), closing K3.15's gap: the S2 row now carries its class's own instrument, not
merely a study-house field name `isValidityCell` does not recognize.

### K3.1.2 S2 row's rate field renamed to the class-recognized name (Critical, supersedes K3.7)

**Supersedes K3.7's S2 field name only:** `trajectory_crossing_rate` → **`crossing_rate`** (`k`,
`n`, `lower_95` unchanged — same computation, same meaning, K3.7's own text otherwise stands). Two
reasons, both mechanical: (1) with `increment_estimator` now present (K3.1.1), `applyGuards`
(`guards.mjs:14-19`) finds `ownPresent = ['increment_estimator']` nonempty, so a foreign field
present alongside it — `crossing_rate` (e_process's own instrument name, `constants.mjs:12`) — is
read as annotation, `status: 'OK'`, not `VOID` (`guards.mjs:32-34`, "foreign fields present
alongside the class instrument"); under the old name `trajectory_crossing_rate` this branch was
moot because the field was invisible to `applyGuards` either way. (2) `internalConsistency`
(`guards.mjs:95-110`) reads `c.crossing_rate` **literally** — the canonical name is what lets its
mean/crossing-rate impossibility check (K3.1.6) re-engage on this cell at all; the old house name
was invisible to it too.

### K3.1.3 The S2 verdict token is unchanged — and does not come from the increment estimator (Critical)

**K3.7's verdict rule stands, unchanged:** `verdict: lower_95 > alpha ? 'FAIL' : 'not-refuted'`,
computed from `crossing_rate`'s own Wilson bound (K3.1.2), **not** from
`increment_estimator.lower95_one_sided`. Registered why, with the reviewer's disclosed,
unregistered probe named as the basis (K3.11's own convention, applied again here): at `κ = 0.1`
(K3.1), the per-window increment `e = κ·p^(κ-1)` has a Pareto-type right tail with index
`1/(1-κ) = 1/0.9 ≈ 1.111` (`E[e|H0] = 1` exactly, by the calibrator identity, K3.1/K3.2 — but
`1/0.9 < 2` means **`Var[e]` is infinite**: a moment of order `r` of a Pareto-tailed variable with
index `α` is finite only for `r < α`, and `2 > 1.111`). A Wald interval (`mean ± 1.645·se`, exactly
`summarise()`'s construction, K3.1.1) assumes the CLT applies to the sampling distribution of the
mean at the registered N — infinite population variance is precisely the condition under which that
assumption is not automatic. The reviewer disclosed an unregistered review-context probe measuring
this directly on `detector-audit-sequential`'s own `1.0005`-bar increment-estimator verdict rule
(`run-sequential.mjs:105-106`, `inc.lower95_one_sided > 1 ? 'REFUTED' : inc.upper95_one_sided <
1.0005 ? 'CLEARED' : 'inconclusive'`): **9/40 cells REFUTED on `lower95_one_sided > 1`, with 32/40
clearances arriving from below 1, and 8/40 reading unmapped/`'inconclusive'`** (`'inconclusive'` is
not in `VERDICT_MAP`, `score.mjs:31`, so those cells are unmapped-verdict misses, not clearances).
**Disclosed as the reviewer's own measurement, not independently re-run here** — same convention as
K3.11's probe.

**Registered reporting rule:** if a future run's `increment_estimator.lower95_one_sided > 1` on
cell 33's S2 row, that reading is **filed as a discrepancy to
`~/concord/knowledge/stats/pages/terminal-mean-rule-contested.md`** — the reviewer's 9/40 measurement
is named as **new Claim-B-side evidence** for that page (Claim B: the coverage run's above-1
mean-rule readings are single-path-dominated statistics whose behavior at N=2000 is itself in
dispute, not settled excess) for Task 12's write-back — **it is not scored, and it does not move
this card's S2 verdict.** Transparency over feigned ignorance: `increment_estimator` is registered
(K3.1.1) precisely so this reading is visible and auditable, not to let an infinite-variance Wald
bound silently gate a fresh detector's certification the way the terminal mean rule's own contested
history (`stats/terminal-mean-is-not-measurable`) already warns against for a different, but
structurally related, statistic.

### K3.1.4 Instrument-only fields excluded from S3 and the fault cells — a registered adapter constraint (Critical)

**Registered constraint, binding on Task 8's adapter and its smoke test.** The S3 power row (cell
33) and all six fault cells (idx 12–17) carry **none** of the five instrument-named fields —
`increment_estimator`, `crossing_rate`, `stopped_mean`, `exceedance`, `mean_e` — for any detector
row `spectral_bet_e_process` emits on those cells. Reason, mechanical and severe: `scoreS2`'s
per-run voiding (`score.mjs`, `mismatchVoidedRuns` / `voidedRuns`) excludes **every cell sharing
`cell.__run`** once any one candidate cell in that run reads `VOID` — not just the offending cell.
A single fault-cell or S3-row field carrying a foreign instrument with no own-instrument present
(`ownPresent.length === 0 && foreignPresent.length > 0`, `guards.mjs:18-19`) would `VOID` that
cell, which would `VOID` the **entire run's** S2 evidence for this card — silently, since `VOID`
reads as a stage status, not a thrown error the harness would surface. K3.8's fault-cell fields
(`detection_rate`, `n`, `verdict`, wealth descriptives, `final_wealth_mean`,
`final_wealth_median`) and K3.7's S3 fields (`fires`, `detection_rate`, wealth descriptives)
already avoid all five strings — this item makes that avoidance a **named, binding constraint**
Task 8's adapter must satisfy by construction (not merely by accident of the field names K3.7/K3.8
already chose), and its smoke run must assert (e.g., a fixture check that no fault-cell or S3-row
object's own keys intersect the five-string instrument set).

### K3.1.5 `null_id` for cell 33, and reconciliation with K4.1.5 (Minor 5)

**Registered, cell 33 only (both rows):** `null_id: 'K3-arm-oracle'` — a single literal, identical
on the S2 and S3 rows (both `phi: 0`) — chosen **outside** the `NULL_ID` grammar
(`validation/certification/lib/nulls.mjs:54`, `/^N([1-7])(?:-p(\d{2,3}))?(?:-m(\d+))?$/`), verified
directly: `'K3-arm-oracle'` does not match (does not begin `N` followed by a digit 1–7). Consequence,
checked against the actual functions: `derivePhiParams('K3-arm-oracle')` returns `null` (`nulls.mjs:62-63`,
`if (!m) return null`), so `effectivePhi` falls through to its first branch, `cell.phi != null`
(`nulls.mjs:103`) — the registered `phi: 0` this document already stamps on both rows governs
directly, with no dependence on the grammar resolving anything. This card's regime does not set
`phi_known`, so `phiIsEstimated`/`derivePhiParams` do not gate this card's `regimeCheck` at all
(`score.mjs`'s `regime.phi_known === true` branch never fires) — the out-of-grammar choice is
registered as defensive hygiene, not a functional necessity for this specific card, matching the
spirit of K4.1.5's own registration for a candidate whose regime similarly does not lean on the
derived-phi path.

**Reconciliation (K3.7/K3.8-vs-K4.1.5 wording, checked against the code — Minor 5).** K3.7/K3.8
list `null_id` as a field these cells carry, without pinning its value — implicitly assuming
run-battery.mjs's existing, shared per-cell convention (`null_id: cell.phi === 0 ? 'N1' :
'N3-p06'`, `run-battery.mjs:497`, stamped **unconditionally on every detector's row for a given
cell**, `safe_t`/`universal_inference`/`family_D_spectral_e_detector`/`point_tail_bet_e_value`
included). K4.1.5 stated the opposite — "Coverage-battery cells ... carry neither `phi_source` nor
`null_id`" — checked directly against `run-battery.mjs:497` here: **that premise is factually
wrong**; `null_id` is present, unconditionally, on every emitted coverage-battery cell already in
this study, `point_tail_bet_e_value`'s own K4 fault-cell rows included. K4.1.5's **conclusion**
(`phiIsEstimated` reads `false` for `point_tail_bet_e_value`'s cells) is still correct, but by a
different mechanism than K4.1.5 stated: `'N1'` **is** in the `NULL_ID` grammar (`n='1'`, no `-p`/`-m`
suffix matches `nulls.mjs:66-70`'s case `'1'`), so `derivePhiParams('N1')` returns `{phi: 0,
phi_source: 'oracle', params: 'oracle'}` — `phiIsEstimated` reads `false` because the derived
`phi_source` is `'oracle'`, not because the field is absent. **This correction does not reopen
K4.1.5's own text or any run made under it** — K4's registered run (Task 5) already executed under
`null_id: 'N1'`/`'N3-p06'` per `run-battery.mjs`'s actual, unconditional behavior, and its card's
functional scoring is unaffected by which of the two reasons explains `phiIsEstimated`'s `false`
reading. Fault cells 12–17 are **not** changed by this item: they keep the existing, shared
per-cell `'N1'`/`'N3-p06'` convention every other detector already carries on these same cells
(§6) — only cell 33, this candidate's own arm with no other detector sharing it, takes the
out-of-grammar literal.

### K3.1.6 Guards that cannot fire, with reasons, and `degenerate_windows` registered (resolves the reviewer's item 6)

**`VACUOUS` (`guards.mjs:29`, `inc.sd === 0` exactly).** Requires the entire N=2000-trajectory
sample of per-trajectory increment-means to be bit-for-bit identical — each trajectory is an
independently-seeded, continuous Gaussian draw (§6/K3.6), so exact equality across 2000 draws has
probability 0 under any non-degenerate implementation. The reviewer's disclosed, unregistered probe
measured `sd ≈ 4.1` on a healthy increment-mean sample of this shape — far from the `0` trigger.
Disclosed, not independently re-run here, same convention as K3.11/K3.1.3's probes.

**`internalConsistency`'s conjunction (`guards.mjs:100`, `inc.mean > 1e6 && c.crossing_rate === 0`),
mutually exclusive here on two independent grounds.** First, `E[eAvg | H0] = 1` exactly (K3.1/K3.2's
calibrator identity, `mean_k E[e_k] = mean_k 1 = 1`), so the population-level expectation of
`increment_estimator.mean` is `1`, not anywhere near `1e6` — a measured value near `1e6` would
itself be a K3.13 stop-condition-relevant surprise long before this guard's threshold mattered.
Second, even granting an extreme realized `inc.mean > 1e6`, a single window's multiplier that large
applied to a wealth process starting near `1` would very likely push at least some of the 2000
trajectories' wealth past the `20` crossing bar, making `crossing_rate === 0` implausible in
conjunction — not a proof, a practical argument, registered as such.

**`NON_FINITE` (`guards.mjs:27-28`, any of `inc.mean`/`inc.sd`/`inc.lower95_one_sided` non-finite) —
not expected to fire, on grounds distinct from `wealth`'s own strict guarantee.** `wealthView`
(`detectors/_wealth.ts:15-17`) and `advanceLogWealth`'s NaN-hold/Infinity-cap/floor logic
(`_wealth.ts:31-35`) keep `log[]` **always finite**, bounded within `[LOG_WEALTH_FLOOR_K3,
LOG_MAX_WEALTH] ≈ [-27.631, 709.783]` — but the increment sample (K3.1.1) is `exp(log[i] -
log[i-1])`, a quantity computed **outside** `wealthView`, and the maximum possible span of that
difference, `709.783 - (-27.631) = 737.414`, itself overflows `Math.exp` in IEEE-754 double
precision (`Math.exp(737.414) = Infinity`; the overflow threshold is `Math.exp(709.783) ≈
Number.MAX_VALUE`, checked directly) — so `log[]`'s own boundedness does not, by itself, guarantee
every increment-sample value is finite in the pathological case. The narrower, checked reason this
is not expected to fire: within this battery's **registered** injection amplitudes (oscillation
`amp <= 0.75σ`, canonical/grid; step `delta = 3σ`, the S3 sanity arm), no bin's `U = I/σ²`
approaches the `~745` threshold where `p = exp(-U)` underflows to exactly `0` in double precision —
the only path to a non-finite `eAvg` (`e = κ·p^(κ-1)` with `κ-1 = -0.9`, so `p = 0` gives `e =
Infinity`) — so no single window's `eAvg` is expected to be non-finite under this battery's own
registered cells. This is an **empirical bound tied to this battery's registered amplitudes**, not
a strict identity the way `wealthView`'s clamp is for the `wealth` field itself — which is exactly
why the field below is registered, rather than treating "not expected to fire" as "cannot fire."

**Registered field, added to both cell-33 rows (S2, S3) and all fault rows (idx 12–17):**
`degenerate_windows` — the count of individual `spectralBetWindow` calls, across every trajectory
and window scored for that cell, whose returned `eAvg` was non-finite (`!Number.isFinite(eAvg)`),
**counted before** `advanceLogWealth` absorbs it (the module's own docstring, `:51-52`: "a
degenerate (NaN or zero) window's e-value holds/floors the books rather than poisoning the run" —
absorption the module performs by design, which is exactly why a separate counter is needed to see
the condition at all; `log[]`/`wealth` alone would not show it). Distinct from `non_finite_wealth`
(A3a), which is a trajectory-level count of degenerate **final** wealth reads; `degenerate_windows`
is a window-level count, visible pre-accumulation.

### K3.1.7 `p_uniformity`, reported, no verdict authority (resolves the reviewer's item 7)

**Registered field, cell 33's S2 row.** Every individual per-bin `p` value
(`spectralBetWindow`'s `perBin[].p`, `spectral-bet-e-process.ts:109`) across the healthy arm's
2000 trajectories × 6 windows × 3 bins = **36,000** values is pooled into `p_uniformity: {n: 36000,
decile_counts: [10 integers], ks_statistic, ks_critical_at_alpha}` — `decile_counts[j]` the count of
pooled values in `[j/10, (j+1)/10)`, each expected `≈ 3600` under the registered exactness identity
(K3.2); `ks_statistic` the one-sample Kolmogorov–Smirnov statistic of the pooled sample against
Uniform(0,1); `ks_critical_at_alpha` the registered asymptotic critical value at this sample size,
`1.36/√36000 ≈ 0.007168` (`c(α=0.05) = 1.36`, the standard one-sample KS asymptotic constant,
computed here, not measured). **Reported, no verdict authority** — this field does not drive S2's
`CLEARED`/`REFUTED` mapping (K3.1.3's verdict stays `crossing_rate`-derived) and carries no `verdict`
key of its own. Registered scope caveat: pooling across bins is a diagnostic convenience, not a
formal exchangeability claim — this document registers per-window, per-bin uniformity (K3.2) and
independence **across windows** (disjointness), not independence **across the 3 bins within a
window**, so the pooled KS statistic's nominal size is a diagnostic approximation, not a certified
test. Cited to the design page's own reversal criterion
(`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md:149-153`, "What would reverse
this decision": "A validity identity failing where the design says it is exact ( ... the
periodogram p not uniform under the registered null) — that is a construction error, and the
one-attempt rule sends it to the record, not to a patch") — `p_uniformity` is the field that makes
that specific, named reversal condition checkable directly against a run, without itself being the
mechanism that fires a verdict.

### K3.1.8 Expected post-run scoring (resolves the reviewer's item 8)

**Registered prediction**, contingent on K3.13's stop condition not firing: **S1 MISSING** (v1
floor — `scoreS1` reads the card's `prior_evidence` stage tokens, `'design'` per K3's card, not
`'S1'`, same as every sibling candidate in this study); **S2 PASS** (K3.1.1's `increment_estimator`
present satisfies `isValidityCell`; `applyGuards` reads `OK` per K3.1.2/K3.1.6; the registered
verdict token, K3.1.3, is expected `'not-refuted'` per K3.14's own healthy-crossing-rate
prediction); **S3 PASS** (arm 33's power row, K3.7, `shift_sigma: 3` `injectStep`, expected
`detection_rate` near-certain given a sustained 3σ step against a `wealth >= 20` bar over 6
windows); **S4 PASS** (`budget.participating: true`, nothing yet priced against it, matching every
sibling candidate's pre-run and post-run S4 in this study). **Composed: `USE` at tier `T1`**, per
`verdict.mjs`'s aggregation (§8/A4) — absent a fired stop condition. A fired K3.13 stop condition
instead REFUTES this candidate (S2 `REFUTED`, overall `REFUSE`), per this study's one-attempt rule;
this prediction is falsified by that outcome, not tuned around it.

### K3.1.9 Minor corrections (Minor 6, Minor 7)

- **Three loose cites, corrected in place at their K3.1/K3.9/K3.12 locations** (v1.2's own
  precedent for citation corrections registered before any run uses the wrong value — no run has
  occurred under either the loose or the corrected cite). `BINS_K3`'s "Neither touches {0, W/2}"
  quote is at `spectral-bet-e-process.ts:59-61` (was cited as the looser `:57-66` doc-block range).
  `SpectralWealthResult`'s `log: number[]` field is declared at `:119` (was folded into a single
  `:118-125` range that conflated the interface declaration with the docstring above the function,
  now cited separately: field at `:119`, `log[i]` semantics at `:122-126`). `advanceLogWealth`'s
  floor line is `detectors/_wealth.ts:35` (was cited as `:31`, off by four lines — checked directly
  against the file: `export function advanceLogWealth(...)` opens at `:31`, `return
  Math.max(logFloor, next);` is the fourth line of the body, `:35`).
- **`regime.sigma_known` is descriptive, not scorer-mechanical.** `regimeCheck`
  (`score.mjs`) reads `regime.phi_max`, `regime.phi_known`, and `regime.m_min` only — it does not
  inspect `sigma_known` at all (checked directly against the function body). The card's
  `sigma_known: true` is a human-readable annotation of K3.1/K3.3's known-σ finding, not a field
  the scorer enforces. The actual mechanical encoding of the known-σ regime is (a) the module's own
  argument-presence guard, `spectralBetWindow`'s `if (!(sigma > 0)) throw` (`:96-98`), which ensures
  a positive `sigma` is always supplied by the caller, and (b) the harness's own registered choice
  (K3.3) to pass `SIGMA = 1`, the generator's literal true value — the guard alone cannot verify
  oracularity, only presence and sign; oracularity is a registered harness commitment, not a
  runtime-checked property.

### Amendment summary

Resolves K3.15 (Critical): registers `increment_estimator` on cell 33's S2 row (K3.1.1), renames
that row's rate field to `crossing_rate` (K3.1.2, supersedes K3.7's field name only), and confirms
the verdict token stays `crossing_rate`-derived, with the reviewer's disclosed 9/40-cell probe and
the calibrator's own infinite-variance tail (`1/0.9 < 2`) registered as the reason
`increment_estimator.lower95_one_sided > 1` is filed to `stats/terminal-mean-rule-contested` rather
than scored (K3.1.3). Registers a binding adapter constraint excluding all five instrument-named
strings from the S3 row and the six fault cells (K3.1.4, Critical). Registers cell 33's
out-of-grammar `null_id` and reconciles K3.7/K3.8's wording against K4.1.5's incorrect premise
without reopening K4.1.5 or any run made under it (K3.1.5, Minor). Registers why `VACUOUS`,
`internalConsistency`, and `NON_FINITE` are not expected to fire, and adds `degenerate_windows` to
every cell-33 row and every fault row as the field that can see a degenerate window `advanceLogWealth`
would otherwise silently absorb (K3.1.6). Adds `p_uniformity`, reported with no verdict authority,
cited to the design page's own named reversal criterion (K3.1.7). Registers the expected post-run
scoring, S1 MISSING → S2/S3/S4 PASS → USE at T1 absent a fired stop condition (K3.1.8). Corrects
three loose citations in place and clarifies `sigma_known` is descriptive, not scorer-mechanical
(K3.1.9, Minor). **The card JSON (`spectral_bet_e_process.json`) does not change — this amendment
registers fields Task 8's adapter must emit, not a card revision — so no re-freeze and no golden
delta follow this commit.** No endpoint, floor, or seed in §1–14, Amendment v1.1, Amendment v1.2,
Erratum v1.3, Amendment v2.K4, Amendment v2.K4.1, or Amendment v2.K3 moves.

## Amendment v2.K3.2 — 2026-08-08, probe-citation correction

Corrects K3.1.3's transcription of the Task-7 reviewer's disclosed 40-block
`detector-audit-sequential` probe, registered before any run of `spectral_bet_e_process`.
K3.1.1–K3.1.9 stay intact except for the one sentence quoted and corrected below; nothing else in
Amendment v2.K3.1 moves.

**K3.1.3 read:** "**9/40 cells REFUTED on `lower95_one_sided > 1`, with 32/40 clearances arriving
from below 1, and 8/40 reading unmapped/`'inconclusive'`**" — arithmetic check, run now rather than
assumed: `9 + 32 + 8 = 49 ≠ 40`. That inequality is the defect; the sentence conflated two
different measurements of the same 40-block probe into one count.

**Corrected, both metrics named separately, as the reviewer actually disclosed them:**

1. **Wald-interval coverage of the known true value.** `summarise()`'s `mean ± 1.645·se` interval
   (K3.1.1's shape, a nominal 90% two-sided interval) was checked against the *known* true value
   this null guarantees, `E[e|H0] = 1` exactly (K3.1/K3.2's calibrator identity) — **captured `1`
   in only 9 of the 40 blocks**, against a nominal 90% (≈36/40 expected if the interval's stated
   coverage held). This is the undercoverage measurement K3.1.3's infinite-variance argument
   predicts: a Wald interval built on a statistic whose population variance is infinite is not
   safely CLT-backed at this N, and severe undercoverage of the *known* truth is a direct,
   independent demonstration of exactly that failure mode — sharper evidence than a REFUTED count
   would have been, not weaker.
2. **`run-sequential.mjs:105-106`'s own token distribution.** `inc.lower95_one_sided > 1 ?
   'REFUTED' : inc.upper95_one_sided < 1.0005 ? 'CLEARED' : 'inconclusive'`, run over the same 40
   blocks: **`CLEARED` 32/40, `'inconclusive'` 8/40, `REFUTED` 0/40** (`32 + 8 + 0 = 40`, checked).
   Every one of the 32 clearances arrived from *below* 1 (block means ranging `0.591`–`1.641`,
   median `0.693`) — disclosed by the reviewer, not independently re-run here, same convention as
   every other probe this study discloses rather than reproduces.

**The original sentence's "9/40 ... REFUTED" was wrong on both counts** — the true REFUTED count
is `0/40`, and `9/40` is the *coverage* metric (item 1), not a token count at all. **Provenance,
named plainly:** this conflation originated in the coordinator's fix-dispatch message relaying the
Task-7 reviewer's probe, not in this document's own transcription of that message (which
transcribed the relayed figures faithfully, including the arithmetic defect) and not in the
Task-7 reviewer's original probe (which reported the two metrics separately and correctly, per the
coordinator's own account). Registered here, not assigned as a defect to the probe itself.

**What is unaffected, checked, not assumed:**

- **The tail-index derivation is independently re-verified, unaffected by the count correction.**
  `1/(1-κ) = 1/0.9 ≈ 1.111 < 2` (K3.1.3) is a property of the calibrator formula `e =
  κ·p^(κ-1)` alone — re-derived here from the formula itself, not from either of the 40-block
  probe's two disclosed numbers. It stands regardless of which count was right.
- **The verdict rule is unaffected.** K3.1.3's registered reporting rule — a future
  `increment_estimator.lower95_one_sided > 1` on cell 33's S2 row is filed to
  `stats/terminal-mean-rule-contested` as Claim-B-side evidence, not scored, and does not move
  this card's S2 verdict — never depended on the exact REFUTED count. The corrected figures (0/40
  REFUTED by the naive rule, yet only 9/40 achieving nominal coverage of the *known* true value)
  support the rule's underlying reasoning more directly than the wrong figures did: the naive
  token rule's near-total absence of REFUTED reads is not evidence the interval is trustworthy —
  the coverage measurement shows the same interval failing to bracket a value it is guaranteed to
  equal, most of the time.
- **`stats/terminal-mean-rule-contested`'s citation stands, strengthened.** K3.1.3's Claim-B
  filing pointed at single-path-dominated, high-variance terminal statistics as the reason an
  above-1 reading should not be trusted uncritically; the corrected coverage figure (9/40 against
  90% nominal) is independent, complementary evidence for that same page — filed for Task 12,
  unresolved here, per this document's own precedence rule.

No endpoint, floor, or seed moves. No card field registered by K3.1.1–K3.1.9 changes shape or
name; this amendment corrects one mistranscribed sentence's numbers and adds the metric it
conflated, nothing else.

## Amendment v2.K3.3 — 2026-08-08, S3 probe corrected before any run

Registered before any run of `spectral_bet_e_process`. The adapter review derived that K3.7's
registered S3 arm cannot work as constructed: `injectStep`'s constant offset is invisible to every
bin this detector scores. Sections K3.1–K3.17 and Amendments v2.K3.1/v2.K3.2 stay intact except
where named below.

### K3.3.1 DC-blindness, derived and disclosed

**Derivation, independently re-verified here, not merely relayed.** `injectStep(series, {sigma, at,
delta})` (`inject.mjs:27-29`) adds a **constant** `delta*sigma` to every tick `t >= at`. Every one
of K3.9's six registered windows starts at or after `at = 100 = ONSET`
(`t ∈ {100,130,160,190,220,250}`), so **every window is entirely inside the shifted region** — the
step contributes the identical constant to all 30 ticks of every window, not a partial-window
discontinuity. For a constant `c` added to a window, the DFT at bin `k`:

```
Σ_{τ=0}^{29} c · e^(−i2πkτ/30) = c · Σ_{τ=0}^{29} e^(−i2πkτ/30) = c · (1 − e^(−i2πk))/(1 − e^(−i2πk/30)) = c · 0
```

for any integer `k` not a multiple of `30` — the geometric-series sum over one full period is
exactly zero (checked: `e^(−i2πk) = 1` for integer `k`, so the numerator is exactly `0`, and the
denominator is nonzero for `k ∈ {1,...,29}`). **`BINS_K3 = [1,2,3]`** (K3.1) excludes `k = 0` by
the **same registration** that makes the exactness identity exact — `k ∉ {0, W/2}` is the identity's
own hypothesis (K3.2) — so the step's entire contribution lands exactly on the one bin this
detector never scores. `I(f_k)`, `U_k`, `p_k`, `e_k` for `k ∈ {1,2,3}` are therefore **identical, in
exact arithmetic, between the healthy and step-shifted series on every registered window** — not
approximately robust to the step, structurally blind to it.

**The reviewer's diagnostic probe, disclosed in full, with provenance** — arm 33's own registered
seeds (`CELL_SEED = 20260840`, K3.6), run at `N = 2000` as a diagnostic (not the registered run):
**`max |log_healthy − log_stepped| = 2.3e-14`** across all `2000 × 6 = 12,000` window reads (checked:
`12,000` matches K3.6/K3.9's own registered trajectory-and-window count) — the residual is
floating-point rounding noise at roughly double-precision epsilon scale, consistent with the exact
theoretical zero above, not a real signal. **Healthy fires `6/2000`** (checked: `6/2000 = 0.003`,
matches the stated crossing rate exactly) — the step arm's own fire count is not reported separately
because the derivation above says it cannot differ from the healthy arm's, and the probe's own
near-zero log-difference confirms that directly.

**Disclosed as the reviewer's own measurement, not independently re-run here** — same convention as
K3.11's 0.642 probe and K3.1.3's 40-block probe. **The registered run's own stop-condition reading
(K3.13) stands independently of this diagnostic** — this disclosure exists only so no number in a
future run's report surprises anyone, the same reason K3.11's probe was disclosed rather than left
implicit.

### K3.3.2 S3 arm superseded: the class-appropriate severity-3 waveform (named supersession of K3.7)

**Supersedes K3.7's S3 bullet only** ("Power (S3) arm, `shift_sigma: 3`. Same series/seeds +
`injectStep(delta=3)` ... a step is not an oscillation; this is a construction sanity check, not a
K3-class power measurement.") — K3.7's S2 bullet, the seed arithmetic, and the field list (K3.7's
own closing paragraph, extended by K3.1.1/K3.1.2/K3.1.6) are unchanged.

**Registered S3 construction:** `injectOscillation(series, {sigma: 1, at: 100, amp: 3, freq:
3/30})` (`inject.mjs:37-41`, `v + amp*sigma*sin(2*pi*freq*(t-at))` for `t >= at`) — same series,
same seeds as K3.6/K3.7 (`CELL_SEED = 20260840`, `seed(i) = 20260840 + 7919*i`). `freq = 3/30`
lands **exactly** on bin `k = 3` (`BINS_K3`'s own registered third bin, K3.1) — checked directly
against `injectOscillation`'s formula: within window `w` (local index `τ = 0..29`, absolute tick
`t = 100 + 30w + τ`), the injected term is `3·sin(2π·(3/30)·(30w+τ)) = 3·sin(2π·3τ/30 + 2π·3w) =
3·sin(2π·3τ/30)` (`sin` is `2π`-periodic and `3w` is always an integer, so the `2π·3w` term drops
exactly) — the window-local waveform is a pure period-`10`-tick sinusoid at exactly bin `3`,
**identical** across all six windows, not merely same-magnitude-different-phase. Registered more
generally, independent of that stronger fact: **the periodogram ordinate `I(f_k) = |Σ x_t
e^(−i2πkt/W)|²/W` depends only on the DFT coefficient's magnitude, never its phase** — so even where
a window's start introduces a nonzero phase offset relative to the injection's own clock (the
general on-grid case, `freq = k/30` for any `k`), `I(f_k)` for a pure on-grid sinusoid at that `k`
is phase-invariant by construction. This candidate's own on-grid case additionally has zero phase
drift (previous paragraph); the phase-invariance-of-the-ordinate fact is registered as the robust
claim that does not depend on that stronger, more specific one.

**The cell keeps `shift_sigma: 3`.** Registered explicitly: `shift_sigma` is not a literal
sigma-shift magnitude, it is the **certification scorer's severity-3 key** — `scoreS3`
(`score.mjs`) filters candidates on `cell.shift_sigma === INERTNESS_SHIFT_SIGMA`
(`INERTNESS_SHIFT_SIGMA = 3`, `constants.mjs:21`) — **realized per class**: A1/K4.5's own S3 arms
already realize "severity 3" as `injectStep(delta=3)` (a K1-shaped 3σ level shift, appropriate for
their terminal/point-outlier constructions) and `injectUnison(eps=3)` (K2-shaped, A1). This
candidate's own class is K3 (sub-threshold oscillation), so its severity-3 realization is `amp = 3σ`
**oscillation**, not a level shift — the scorer's `shift_sigma: 3` key is unchanged and still means
"the registered severity-3 power probe," carried by the construction each class's own detector can
actually see.

**Cross-reference, named:** probing a spectral (K3, oscillation-only) detector's power arm with a
step is the class the knowledge wiki's `~/concord/knowledge/WORKLIST.md` C26 finding names — "the class determines the
instrument," there about a scoring instrument mismatched to a detector's class (`increment_estimator`
scored against an `e_process` cell it cannot speak about); here the same lesson recurs one stage
earlier, at **injection** rather than instrument: a fault-class waveform (K1's step) mismatched to
the detector-class (K3's oscillation-only construction) it is meant to power-test. Registered as the
same category of error, not the identical finding.

**Provenance correction, 2026-08-08 (before any K3 run):** the sentence above read "this study's own
`WORKLIST.md`"; C26 lives in the knowledge wiki (`~/concord/knowledge/WORKLIST.md:97`) and this study
carries no `WORKLIST.md` of its own — one word corrected, no claim, endpoint, floor, or seed moves.

### K3.3.3 The original step probe, retained as a verdict-free descriptive row

**Not deleted — retained, relabeled.** The same construction K3.7 originally registered for S3
(`injectStep(delta=3)`, arm 33's same seeds) is kept as an **additional, verdict-free descriptive
row**, documenting the K3.3.1 finding directly against a run rather than only in prose:

- Field name: **`step_blindness_probe_rate`** (not `detection_rate` — deliberately, so `isPowerCell`
  (`score.mjs:16`, `'detection_rate' in c || 'rate_e_ge_20' in c`) does not pick this row up as an
  S3 candidate at all). `k` (count crossing, expected `6` per K3.3.1's disclosed probe), `n: 2000`,
  `step_blindness_probe_rate = k/n`.
- **No `shift_sigma` field** — not merely a different value, its **absence** is the registration:
  with no `shift_sigma`, `scoreS3` cannot filter this row into or out of the `INERTNESS_SHIFT_SIGMA`
  gate at all, because `isPowerCell` never admits it as a candidate in the first place (previous
  bullet) — belt-and-suspenders with K3.1.4's already-registered instrument-name exclusion.
- **No `verdict` field, no instrument-named field** (`increment_estimator`, `crossing_rate`,
  `stopped_mean`, `exceedance`, `mean_e`) — K3.1.4's binding adapter constraint, extended explicitly
  to this new row: it must carry none of the five, on the same "one offending cell VOIDs the whole
  run's S2 evidence" reasoning.
- **Filed for the coverage matrix's cross-class notes at Task 12's write-back**: documentation that
  `spectral_bet_e_process` is structurally blind to K1-type (step) faults by the same construction
  that makes its own null exact — a scope statement about the detector, not a K3 or K1 coverage
  finding, carrying no verdict of its own.

### K3.3.4 K3.1.8 corrected: the S3 expectation rides the oscillation probe

**K3.1.8 read:** "**S3 PASS** (arm 33's power row, K3.7, `shift_sigma: 3` `injectStep`, expected
`detection_rate` near-certain given a sustained 3σ step against a `wealth >= 20` bar over 6
windows)". **Corrected: impossible as registered**, per K3.3.1's derivation — a sustained step
contributes exactly zero energy to `BINS_K3`'s bins on every window fully inside the shifted region
(all six registered windows are), so `detection_rate` on the **original** S3 construction cannot
exceed the healthy arm's own false-alarm rate (disclosed at `0.003`, K3.3.1) — nowhere near
`near-certain`, and nowhere near `POWERED` (`>= 0.50`) either. That sentence's prediction was never
reachable by the construction it named.

**Corrected prediction, registered:** S3 PASS now rides **K3.3.2's on-grid oscillation probe**
(`amp = 3σ`, `freq = 3/30`, bin `k = 3` exactly), expected **near-certain** — independently derived
here, not merely asserted: a pure on-grid sinusoid of amplitude `A = 3σ` over a `W = 30` window
contributes periodogram ordinate `I(f_3) = (A·W/2)²/W = A²W/4 = 9·30/4 = 67.5` exactly (checked by
direct DFT-orthogonality computation — bins `k=1,2` receive exactly zero of this energy, by the same
orthogonality argument K3.3.1 uses), giving `U_3 = 67.5` (`σ = 1`), `p_3 = e^{-67.5}` (astronomically
small, order `10^{-30}`), and `e_3 = 0.1·p_3^{-0.9}` of order `10^{25}` — a single window's `eAvg`
this large saturates `wealthView` at `Number.MAX_VALUE` (`_wealth.ts:16`) on effectively every
trajectory's very first window, far above the `20` crossing bar. This is **far above** the
K3-battery's own already-disclosed smoke rate at the weaker, off-grid canonical amplitude — K3.11's
`0.642` probe (`amp = 0.75σ`, `f = 0.05`, off-grid, leaking across two bins) — since this probe is
`4×` the amplitude and lands exactly on-grid with no leakage loss. **Falsifier, registered:** S3
`detection_rate < 0.50` on the corrected oscillation construction would itself be a surprise
requiring investigation (a defect in the DFT-orthogonality reasoning above, or in the harness's
wiring of the injection), not a tuning target.

### K3.3.5 Adapter/smoke constraint deltas — Task 8's fix must satisfy

**Extends K3.1.4/K3.7; registers exactly what changes and what does not.**

- **The descriptive step row (K3.3.3), new:** fields `step_blindness_probe_rate`, `k`, `n: 2000`,
  plus the row's own `detector`/`arm`/`cell_index: 33`/`null_id`/`phi: 0`/`params: 'oracle'`/
  `alpha: 0.05`/`ticks: 300`/`onset: 100`/`substrate_tier: 'T1'` identification fields (K3.1.5's
  `null_id` literal applies here too — same cell, same out-of-grammar value). **No** `shift_sigma`,
  **no** `verdict`, **no** instrument-named field (K3.1.4's five-string set) — checked by Task 8's
  smoke the same way K3.1.4 already requires for the fault cells and the oscillation S3 row.
- **The oscillation S3 row (K3.3.2), unchanged in shape:** every field K3.7's original S3 bullet and
  K3.1.6 already registered — `fires`, `detection_rate`, `final_wealth_mean`, `final_wealth_median`,
  `non_finite_wealth`, `adapter_failures`, `verdict: detection_rate >= 0.50 ? 'POWERED' : 'INERT'`,
  `not_executable_reason`, `substrate_tier: 'T1'`, `shift_sigma: 3`, `degenerate_windows` (K3.1.6) —
  **only the injection call underneath changes**, `injectOscillation({amp:3, freq: 3/30, at:100,
  sigma:1})` in place of `injectStep({delta:3, at:100, sigma:1})`. K3.1.4's exclusion of the five
  instrument-named strings from this row is unaffected and still binding.

### Amendment summary

Derives and discloses the S3 step arm's DC-blindness (K3.3.1: exact zero energy at every registered
bin, `BINS_K3`'s own `k ≠ 0` hypothesis; the reviewer's diagnostic probe in full, `2.3e-14` max
log-difference, `6/2000` healthy fires — disclosed, the registered stop condition unaffected).
Supersedes K3.7's S3 bullet only with a class-appropriate on-grid oscillation construction, `amp =
3σ` at `freq = 3/30` (bin `k=3`), registering `shift_sigma: 3` as the scorer's severity-3 key
realized per class, and naming the cross-reference to `WORKLIST.md`'s C26 class-instrument lesson
(K3.3.2). Retains the original step construction as a new, verdict-free `step_blindness_probe_rate`
row excluded from S2/S3 scoring by field-name absence, filed for the coverage matrix's cross-class
notes (K3.3.3). Corrects K3.1.8's S3 prediction, quoted and replaced with the oscillation probe's
own independently-derived near-certain expectation (K3.3.4). Registers the adapter/smoke field-set
deltas Task 8 must satisfy (K3.3.5). No endpoint, floor, or seed in §1–14 or any earlier amendment
moves; K3.13's stop condition and K3.9's window partition are unchanged.

## Amendment v2.K6 — 2026-08-08, before any K6 candidate run

Registered before any run of the new candidate `shape_block_conformal_bet`
(`detectors/shape-block-conformal-bet.ts`, built and unit-tested at Task 9 of
`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`, commit `b1ab444`, review fix round 1
at `a947668`; ledger `.superpowers/sdd/2026-08-08-coverage-gap-detectors/progress.md`, Task 9's
rulings section, binding on this amendment). Sections 1–14 above and Amendments
v1.1/v1.2/v2.K4/v2.K4.1/v2.K3/v2.K3.1/v2.K3.2/v2.K3.3 and Erratum v1.3 stay intact; this amendment
adds. Every extension is cited against the section it extends; nothing here supersedes a frozen
value. Authority for this candidate, per the plan's own Authority line:
`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md` (RATIFIED 2026-08-08), K6 section
— then this document — then the plan.

**This amendment is unusual, registered plainly.** Task 9's review round derived, before any
battery run, that this construction is NOT_POWERED at the class's canonical geometry (K6.4 below).
K6's class answer is therefore a **derivation the registered run confirms**, not a discovery the
run makes — the run still executes in full (T1 battery + T2 clustersynth arm, K6.12/K6.13), and a
result materially above the derived ceiling is a **surprise to investigate**, not a target.

### K6.1 Registered constants (verbatim, cross-checked against the module's exports)

Copied verbatim from `docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`'s Global
Constraints block:

> K6 **W = 30**, features **{sample kurtosis, |sample skew|}**, **m = 300** disjoint contiguous
> reference blocks, distance-rank conformal p per feature `p = (1 + #{ref blocks with |T_ref −
> med_T| ≥ |T_live − med_T|}) / (m + 1)` where `med_T` is the reference-block median of that
> feature.

κ = 0.1 is the same shared-derivation constant K4.1/K3.1 already register (log-optimal κ*
derivation, not restated).

**Cross-checked against `detectors/shape-block-conformal-bet.ts`'s exports — result: no diff on
W and κ; `m = 300` is not an exported constant and is resolved explicitly at K6.3, below.**
`export const W_K6 = 30` (`:87`). `export const KAPPA_K6 = 0.1` (`:91`, "shared derivation with
K3/K4"). `export const M_MIN_K6 = 100` (`:96`) — the module's own registered FLOOR on `m`, not a
target value; the plan's Global Constraints `m = 300` is a specific calibration size, checked
against actual usage at K6.3. `LOG_WEALTH_FLOOR_K6 = Math.log(1e-12)` (`:100`), identical value to
`LOG_WEALTH_FLOOR_K3` (K3.12), same ADR 0026 convention (`_wealth.ts`).

### K6.2 Formulas (verbatim from the code, line cites)

Per reference block or live window (`shapeMoments`, `:157-174`):

```
mean = (1/n) * sum(x)                                          // :159-161
m2 = mean((x-mean)^2); m3 = mean((x-mean)^3); m4 = mean((x-mean)^4)   // :162-170, population moments, divide by n
kurtosis = m4 / (m2*m2)                                         // :171, RAW convention (Gaussian = 3)
absSkew  = |m3| / m2^1.5                                        // :172
```

Per feature, calibration (`buildFeatureCalibration`, `:176-180`): `median` of the m reference
blocks' own statistic; `sortedAbsDev` = the m `|stat − median|` values, ascending.

Per feature, per live window (`featureResult`, `:255-281`):

```
dev   = |T_live - median_ref|                                   // :276
count = #{ref |dev| >= dev}  (tie-inclusive >=, countGte, :142-152)  // :277
p     = (1 + count) / (m + 1)                                   // :278
e     = kappa * p^(kappa - 1)                                   // :279
```

Non-finite `T_live` (a degenerate window, e.g. a constant block) contributes `e = 1` explicitly
(`:262-275`) — neutral, holds the books, matching K3's registered NaN pathway, not a fall-through
to the `dev`/`countGte` path (module comment `:262-274` explains why the fall-through would be
silently wrong: `Math.abs(NaN - median)` is `NaN`, and `countGte`'s binary search on a `NaN` query
converges to "0 excluded, all m counted", a real, wrong `p=1`).

Per window (`shapeBetWindow`, `:287-302`): `eAvg = mean(e_kurtosis, e_absSkew)` (`:300`, "never
max" — same argument K3/K4's docstrings give, cited not restated). Across windows
(`shapeBetWealth`, `:309-318`): `logM = advanceLogWealth(logM, log(eAvg), LOG_WEALTH_FLOOR_K6)`
per window (`:314`), product of per-window `eAvg` in the log domain, same ADR 0026 pattern K3/K4
already use.

**Validity argument, hypotheses named** (module docstring `:43-53`, cross-checked against the code
above — result: no diff): under block exchangeability of the `m` reference blocks' own statistic
together with the live window's own distance-to-median statistic — the registered regime is
**stationarity across the calibration+test span**, not independence within a block — `p` is
super-uniform, `∫₀¹ κp^(κ-1)dp = 1` makes `e` a valid e-value with `E[e|H0] <= 1` per feature per
window, exactly the K4 conformal-rank argument applied to block-level statistics. Contiguous
reference blocks (not overlapping, not a synthesized single-φ null) is this construction's
answer to C22 (module header `:1-16`, `~/concord/knowledge/stats/pages/shape-clustersynth-2026-08-05.md`):
each block carries its own within-block serial dependence, so validity does not require knowing φ
— it requires calibration and live to share the SAME dependence structure (K6.11 registers the
qualifier this buys and does not buy).

### K6.3 Held-out arithmetic — `m` resolved explicitly, the plan/page discrepancy named

**Neither the design page nor the plan is silently followed here; both are checked against the
actual arithmetic, per this document's own precedence rule (page > this document > plan).**

The ratified design page (`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`, K6
section) states: "a held-out reference segment (**n >= 10,000** contiguous ticks, registered
stream)" — an `n`, not an `m`. The plan's Global Constraints (K6.1, above) states "**m = 300**
disjoint contiguous reference blocks" directly — an `m`, not an `n`, and does not show the
arithmetic that produced it. **These two do not obviously agree**: `calibrateShapeBlocks` computes
`m = Math.floor(rows.length / W)` (`:234`, the module's own remainder-dropping rule, docstring
`:224`, "the remainder, if any, is dropped, not padded") — at `n = 10,000`, `W = 30`:
`Math.floor(10000/30) = 333`, not `300` (`333*30 = 9990`; the last **10** of the 10,000 rows are
unused, per the module's own rule).

**Registered resolution, checked against where each figure actually originates, not silently
picked:**

- **The T1 (this battery's own) held-out stream follows K4.4's already-frozen convention exactly**
  — `HELDOUT_SEED = CELL_SEED + 500000`, `n = 10,000` rows, `seed(j) = HELDOUT_SEED + 7919*j`,
  `j = 0..9999` — reusing the identical `n = 10,000` literal the design page's own "n >= 10,000"
  sentence names and the K4/K3 precedent already established for every held-out stream in this
  study. **Registered: `m = 333` for every T1 K6 calibration** (fault cells 26–29 and arm cell 34,
  K6.6/K6.7), `333*30 = 9990 <= 10000`, arithmetic shown, not asserted. `333 >= M_MIN_K6 = 100`
  (K6.1) with wide margin.
- **The T2 clustersynth arm's own registered per-coordinate reference (K6.12) is each coordinate's
  first 9,000 ticks** — a DIFFERENT, independently registered slice, chosen for T2's own reasons
  (a round per-shard tick budget against clustersynth's own `window.steps` parameter, not this
  study's `n = 10,000` convention). `Math.floor(9000/30) = 300` **exactly** — no remainder dropped.
  **This is registered here as the origin of the plan's "m = 300" figure**: it is T2's own exact
  block count, not T1's. The plan's Global Constraints paragraph states a single `m = 300` without
  distinguishing the two arms, conflating T2's own exact figure with T1's, which is 333, not 300.
- **Filed, not silently corrected in the plan text itself** (this document's precedence rule): the
  plan's bare "m = 300" is read here as T2's figure, generalized to the class in error. T1's
  registered `m` is 333, T2's is 300, both shown by arithmetic above and both `>= M_MIN_K6 = 100`
  — the discrepancy is a documentation-provenance question, not a validity question, and neither
  reading was ever at risk of the module's own floor. Consequence, registered: the `κ* >= 0.175`
  floor-bound figure disclosed at K6.5, below, is recomputed at `m = 333` (T1's registered value,
  not the plan's `m = 300`), since T1 is what the registered run actually calibrates against.

### K6.4 THE DERIVED NOT_POWERED PREDICTION — the closed-form chain

**Registered before any run, per Task 9's ledger ruling** (`progress.md`: "W ADJUDICATED: keep
W=30, register DERIVED NOT_POWERED"). Every step below is either (a) independently re-derived in
this document (marked CLOSED-FORM, verified here, not assumed), or (b) a disclosed, unregistered
probe from Task 9's review, named with provenance and NOT independently re-run here (marked
DISCLOSED, same convention K3.11/K3.1.3/K3.3.1 already use in this document). The closed-form
chain stands alone; the disclosed probes corroborate it.

**Step 1 — the mixture's exact fourth moment at d=1.5 (CLOSED-FORM, re-derived here).**
`injectShapeMix` (`inject.mjs:60-70`, §2) draws `Z = M + W*s`, `M = +d/2` w.p. 1/2, `-d/2` w.p.
1/2 (independent of `W ~ N(0,1)`), `s = sqrt(max(0, 1 - d^2/4))`. Since `M` and `W` are
independent and `E[W]=E[W^3]=0`:

```
E[Z^4] = E[M^4] + 6*E[M^2]*E[(Ws)^2] + E[(Ws)^4]           (odd-power cross terms vanish)
       = (d/2)^4 + 6*(d/2)^2*s^2 + 3*s^4                    (E[W^2]=1, E[W^4]=3; M^2=(d/2)^2 always)
```

At `d = 1.5`: `d/2 = 0.75`, `(d/2)^2 = 0.5625`, `(d/2)^4 = 0.31640625`; `s^2 = 1 - 2.25/4 =
0.4375`, `s^4 = 0.19140625`.

```
E[Z^4] = 0.31640625 + 6*0.5625*0.4375 + 3*0.19140625
       = 0.31640625 + 1.4765625 + 0.57421875
       = 2.3671875                                          exact, verified by direct arithmetic
```

Variance check (also exact): `E[Z] = 0` (both terms symmetric/mean-zero); `E[Z^2] = (d/2)^2 + s^2
= 0.5625 + 0.4375 = 1` — confirms `inject.mjs`'s own "matched mean 0, variance 1" comment (§2)
exactly, so raw kurtosis = `E[Z^4]/Var(Z)^2 = E[Z^4] = 2.3671875` directly, no rescaling needed.

**Step 2 — raw-kurtosis deficit (CLOSED-FORM).** Gaussian raw kurtosis = 3 exactly. **Deficit:
`3 - 2.3671875 = 0.6328125 ≈ 0.6328`.** The mixture at d=1.5 is *platykurtic* relative to the
Gaussian reference — a genuine, exact population-level departure `shapeMoments`'s `kurtosis`
feature (K6.2) is built to see.

**Step 3 — plug-in sampling noise at W=30 swamps the deficit (DISCLOSED, Task 9 review, not
re-run here).** The standard asymptotic variance of the sample (raw) kurtosis estimator under
normality is `Var(b2) ≈ 24/n`; at `W=30`, `sqrt(24/30) = sqrt(0.8) ≈ 0.8944` — this asymptotic
figure **overstates** the true small-sample sd (re-derived here as a standard large-sample result,
not itself in question). **Measured (disclosed): sd ≈ 0.7031** at `W=30`. **Median separation:
0.59 sd** — disclosed together with the sd measurement, not independently recomputed from the
raw deficit/sd ratio here: at finite `n=30` the sampling distribution of raw kurtosis is skewed,
so a median-based separation is not simply `deficit/sd`, and this document registers the
review's own measured figure rather than a mismatched analytic proxy for it.

**Step 4 — the growth criterion, measured (DISCLOSED, Task 9 review round 1, carried forward in
`progress.md`; per-seed table relayed in this task's own dispatch, not independently re-run
here).** `E[log eAvg]` under the mixture alternative, by registered `W`:

| `W` | `E[log eAvg \| alt]` | draws positive | reading |
|---|---|---|---|
| 30 (registered) | **-1.414 ± 0.047** | 0/40 | **anti-informative** |
| 300 | **+0.012 ± 0.251** | 1/20 clears the floor | coin-flip |

**Break-even (where growth turns reliably positive): W ≈ 400–600** (disclosed, not independently
re-run).

**The anti-informative regime, named explicitly.** In LINEAR wealth space (not log): `E[eAvg |
alt] ≈ 0.265 < E[eAvg | null] ≈ 0.398` — the mixture's own average per-window bet payout is
LOWER than a genuinely null (Gaussian) window's, at `W=30`. Disclosed mechanism (the review's own
account, not verified by simulation in this document): **the mixture compresses the sample
kurtosis/|skew| estimates into the reference bulk** at this window length — the finite-sample
noise structure at `n=30` happens to pull the mixture's typical `|deviation from the reference
median|` statistic CLOSER to the reference's own bulk than a fresh Gaussian draw's typical
deviation, which is the opposite of what the raw-moment deficit (Step 2) alone would suggest. This
is registered as a genuinely counter-intuitive, disclosed finding — the closed-form population
deficit (Step 2) establishes that a real departure exists; it does not by itself establish that
the RANK-based, small-sample conformal statistic detects it in the informative direction at
`W=30`. Both are true simultaneously, and the growth-criterion measurement is what shows the
second fact the first does not imply.

**Step 5 — the predicted detection grid (registered).** Consistent with Steps 1–4:

| severity | `d` | predicted canonical-cell detection rate |
|---|---|---|
| idx 26 | 1.0 | **~0.000** |
| idx 27 (canonical) | 1.5 | **~0.000** |
| idx 28 | 2.0 | **~0.03** |

**Registered prediction: `shape_block_conformal_bet` reads NOT_POWERED at K6's canonical severity
(idx 27, `mix-d1.5`), well below `COVERAGE_FLOOR = 0.50`, DERIVED before the run rather than
discovered by it.** Falsifier: K6.14, below.

### K6.5 The kappa misfit — registered design limitation, not a tuning license

**Registered as a successor-design input.** The shared `κ = 0.1` calibrator (K6.1) is log-optimal
for the K4/K3 candidates' own registered alternatives, not derived for K6's. Two effects, both
disclosed:

**Floor bound (CLOSED-FORM, re-derived here at the K6.3-registered `m = 333`).** Since `p >=
1/(m+1)` always (the rank cannot exceed `m`), `log(p) >= log(1/(m+1)) = -log(m+1)` always, so
`E[log p] >= -log(m+1)`. Log-optimal `κ* = -1/E[log p]`, and since `E[log p] <= 0`: `κ* =
1/(-E[log p]) >= 1/log(m+1)`. At `m = 333`: `log(334) ≈ 5.81124`, `1/5.81124 ≈ 0.1721`.
**Registered: `κ* >= 0.172` at this document's registered `m = 333`** — recomputed from the
K6.3 resolution, not the plan's `m = 300` value (which would give `1/log(301) ≈ 0.175`, the
figure this task's own dispatch named; the ~0.003 difference is a direct, checked consequence of
the K6.3 `m` resolution, registered here rather than silently carried over).

**Measured at the alternative (DISCLOSED, Task 9 review, not re-run here): `κ* ≈ 0.32–0.4`** — the
alternative-optimal calibrator constant, well above both the floor bound and the registered
`κ = 0.1`. **Cost of using `κ = 0.1` instead: -1.30 nats/window** (disclosed growth-rate gap,
relative to the alternative-optimal `κ*`, at the registered `W = 30`).

**Registered scope.** This is filed as a **successor-design input** — a different κ, chosen for
K6's own alternative rather than inherited from K3/K4, is a candidate for a future registered
attempt, per this study's one-attempt rule (a second attempt at THIS construction with a
retuned κ would be a new design, ratified separately, not a patch to this run). It is **not** a
tuning license for this run: `κ = 0.1` stays fixed for the run this amendment registers (K6.1),
and a misfit already visible in the closed-form floor bound is exactly the kind of finding this
document exists to carry forward, not to quietly correct before the run that would have exposed
it.

### K6.6 Fault cells + new arm — seed arithmetic (extends §6/§7)

`shape_block_conformal_bet` joins §7 as a new row: **K6 only**, scored on the class's four
registered fault cells, reusing §6's existing `CELL_SEED`s unchanged (§6's paired-comparison
convention, extended to this fourth candidate exactly as it already governs the other three):

| idx | severity | phi | `CELL_SEED = BASE_SEED + idx` | `HELDOUT_SEED = CELL_SEED + 500000` |
|---|---|---|---|---|
| 26 | `mix-d1.0` | 0 | 20260833 | 20760833 |
| 27 | `mix-d1.5` (canonical) | 0 | 20260834 | 20760834 |
| 28 | `mix-d2.0` | 0 | 20260835 | 20760835 |
| 29 | `mix-d1.5-ar1` | 0.6 | 20260836 | 20760836 |

Arithmetic: `20260807 + {26,27,28,29} = {20260833, 20260834, 20260835, 20260836}` (matches §6's
own table, cross-checked, no diff); `+ 500000` per cell, per K6.3/K4.4's registered pattern. Every
`HELDOUT_SEED`'s `n = 10,000`, `seed(j) = HELDOUT_SEED + 7919*j`, `j = 0..9999`, drawn from the
cell's healthy (pre-fault, pre-`at=100`) null distribution — iid N(0,1) for idx 26/27/28, AR(1)
φ=0.6 for idx 29 — `m = 333` per cell (K6.3).

**New arm, continuing directly from `spectral_bet_e_process`'s arm at idx 33 (Amendment v2.K3,
K3.6):**

| cell | class/arm | `CELL_SEED = BASE_SEED + idx` | `HELDOUT_SEED` | arithmetic |
|---|---|---|---|---|
| 34 | `shape_block_conformal_bet` S2/S3 arm | 20260841 | 20760841 | `20260807+34=20260841`; `+500000=20760841` |

Trajectory seeds: `seed(i) = 20260841 + 7919*i`, `i = 0..1999`, §6's formula shape unchanged.

### K6.7 Arm cell 34 — healthy (S2) and S3, fields registered up front (mirrors K3.1.1/K3.1.2/K3.1.4, not deferred to a correction round)

**Registered directly here, not left for a post-review amendment** — Task 9's ledger already
carries the K3.15 lesson (a `test_martingale`-class card needs `increment_estimator` on its S2
row to be seen by `isValidityCell` at all, `validation/certification/lib/score.mjs:11-12`,
`CLASS_INSTRUMENTS.test_martingale`, `constants.mjs:10`), so this amendment applies that lesson to
`shape_block_conformal_bet` (also class `test_martingale`, K6's card, this document's companion
commit) up front rather than waiting for a review to catch the same gap twice.

Single iid-Gaussian series (idx 26/27/28-shaped), `seed(i) = 20260841 + 7919*i`, `i = 0..1999`.
Test span is K3.9's already-registered 6-window partition of the post-onset slice — `t =
100..279` (six disjoint `W=30` windows), `t = 280..299` unused — cited, not re-derived: identical
arithmetic (`W = 30`, span `[100,300)`), reused here because it is the same construction shape
(disjoint-window product martingale), not restated.

**S2 row (healthy, no injection):**

- `crossing_rate` (the class-recognized field name, K3.1.2's precedent applied here directly
  rather than via a later rename), `k` (count of trajectories crossing 20 at any of the 6 window
  checkpoints), `n = 2000`, `lower_95` (Wilson 95% lower bound on `crossing_rate`) — the exact
  triple K6.13's stop condition tests.
- `increment_estimator: {n, mean, sd, se, lower95_one_sided, upper95_one_sided}` — per trajectory,
  the increment sample is the trajectory's six per-window `eAvg` values (identically
  `exp(log[i]-log[i-1])`, `log[-1]=0`; `shapeBetWealth`'s own product-of-`eAvg` construction,
  K6.2, means `eAvg_w` **is** the martingale's per-window multiplicative increment by
  construction). Per-trajectory increment MEAN is the mean of its six `eAvg` values; `summarise()`
  over the N=2000 trajectory means (K3.1.1's exact function, reused verbatim, not restated):
  `mean`, `sd`, `se = sd/sqrt(n)`, `lower95_one_sided = mean - 1.645*se`, `upper95_one_sided =
  mean + 1.645*se`. Satisfies `CLASS_INSTRUMENTS.test_martingale` directly.
- **Verdict stays `crossing_rate`-derived, NOT `increment_estimator`-derived** — `verdict:
  lower_95 > alpha ? 'FAIL' : 'not-refuted'` (`VERDICT_MAP`, `score.mjs:31`). Same reason as
  K3.1.3, cited not re-derived: the calibrator `e = κ*p^(κ-1)` at `κ=0.1` (K6.1, shared with
  K3/K4) has Pareto-type tail index `1/(1-κ) = 1/0.9 ≈ 1.111 < 2`, so `Var[e]` is infinite and a
  Wald interval (`mean ± 1.645*se`) is not safely CLT-backed at N=2000 — K3.1.3/K3.1.2's
  disclosed 9-of-40-blocks undercoverage measurement is the same formula's own failure mode,
  registered here by reference, not re-measured for this candidate. **Registered reporting
  rule, identical to K3.1.3:** a future `increment_estimator.lower95_one_sided > 1` on cell 34's
  S2 row is filed to `~/concord/knowledge/stats/pages/terminal-mean-rule-contested.md` as
  additional Claim-B-side evidence at Task 12's write-back, not scored, and does not move this
  card's S2 verdict.
- `p_uniformity: {n, decile_counts, ks_statistic, ks_critical_at_alpha}` (K3.1.7's pattern, applied
  here): every individual per-feature `p` (kurtosis + absSkew) across 2000 trajectories × 6
  windows × 2 features = **24,000** values, pooled. `ks_critical_at_alpha = 1.36/sqrt(24000) ≈
  0.008780`. **Reported, no verdict authority** — same registered caveat as K3.1.7: `p` is
  DISCRETE at this `m` (K4.1.9-style; `m=333` gives `n+1=334` attainable values, K6.11 registers
  this as the O(1/m) qualifier), so a KS statistic against continuous Uniform(0,1) is a
  diagnostic approximation, not a certified test; pooling across the two features is a
  diagnostic convenience, not an independence claim (this document registers per-window,
  per-feature super-uniformity, K6.2, and independence ACROSS windows, not across the 2
  features within a window).
- `degenerate_windows`, `non_finite_wealth` — registered STRUCTURALLY ZERO for this candidate, a
  stronger claim than K3.1.6's "not expected to fire": `p` is bounded in `(1/(m+1), 1]` by
  construction (`countGte`'s range, K6.2), so `e = κ*p^(κ-1)` is bounded in `[κ, κ*(m+1)^(1-κ)]`
  — at `m=333`, `κ=0.1`: `[0.1, 0.1*334^0.9] ≈ [0.1, 18.68]` — always finite, with no `p=0`
  underflow pathway (unlike K3's `p=exp(-U)`, which CAN underflow to exactly 0 for large `U`).
  The module's own explicit NaN-guard (`featureResult`, `e=1` on non-finite `T`, K6.2) further
  guarantees `eAvg` is always finite even on a degenerate window. Both fields are carried for
  uniformity with `applyGuards`'s literal field-name match (`guards.mjs:12`), and are expected
  identically `0` on every cell this candidate scores, not merely on this arm.
- `null_id: 'K6-arm-heldout'` — an out-of-grammar literal (K3.1.5's defensive-hygiene precedent,
  adapted: K3's arm was genuinely oracle, so it used `'K3-arm-oracle'`; this arm's calibration is
  EMPIRICAL, K6.7's own `params` stamp below, so the analogous literal names that instead).
  `params: 'heldout-empirical'` (K4.1.5's literal, reused: this candidate's calibration is
  neither oracle nor a plug-in fit on the scored trajectory's own window — it is empirical
  statistics of an independent held-out sample, K6.6). `phi: 0`.
- `alpha: 0.05`, `n: 2000`, `ticks: 300`, `onset: 100`, `windows: 6`, `window_len: 30`,
  `window_span: '[100,280)'`, `final_wealth_mean`, `final_wealth_median`, `adapter_failures`,
  `not_executable_reason`, `substrate_tier: 'T1'`.

**S3 row — the class-appropriate severity-3 probe (K6.8, below, registers the construction).**
`detector`, `arm: 'power'`, `cell_index: 34`, `null_id: 'K6-arm-heldout'`, `phi: 0`, `params:
'heldout-empirical'`, `shift_sigma: 3` (the scorer's severity-3 key, K3.3.2's convention, realized
per class at K6.8 — not a literal sigma-shift), `alpha: 0.05`, `n: 2000`, `ticks: 300`, `onset:
100`, `fires` (count crossing), `detection_rate = fires/n`, `final_wealth_mean`,
`final_wealth_median`, `non_finite_wealth` (structurally 0, K6.7), `degenerate_windows`
(structurally 0), `adapter_failures`, `verdict: detection_rate >= 0.50 ? 'POWERED' : 'INERT'`,
`not_executable_reason`, `substrate_tier: 'T1'`.

**Binding adapter constraint (K3.1.4's pattern, applied here directly, up front):** the S3 row and
all four fault cells (idx 26–29) carry **none** of the five instrument-named fields
(`increment_estimator`, `crossing_rate`, `stopped_mean`, `exceedance`, `mean_e`) — the same
"one offending cell VOIDs the whole run's S2 evidence" mechanism K3.1.4 derives
(`score.mjs`'s `mismatchVoidedRuns`, keyed on `cell.__run`). Task 11's adapter and its smoke test
must satisfy this by construction, checked the same way K3.1.4/K3.3.5 require for
`spectral_bet_e_process`.

### K6.8 S3 construction — the class-appropriate probe, registered honestly (not a stronger probe chosen to dodge the inert outcome)

**The S3 arm's job is "can this detector detect SOMETHING at severity 3" — a basic sanity/power
check, not a K6-canonical-severity power measurement (A1/K4.5/K3.7's own convention, restated for
this class).** For K1/K2/K4 candidates, severity 3 is realized as a `3σ` level/group shift
(`injectStep`/`injectUnison`); for the K3 candidate, as an on-grid `3σ` oscillation
(`injectOscillation`, K3.3.2). **For this K6 candidate, the class has no `3σ`-shaped severity
axis at all** — `injectShapeMix`'s own severity parameter is `d`, a moment-matched mixture
separation, not a sigma-multiplier (§2), and the class's own registered grid tops out at `d =
2.0` (idx 28, the class's own maximal registered severity).

**Registered S3 construction: `injectShapeMix(series, {sigma:1, at:100, d:2.0})` (`inject.mjs:60-70`),
sustained across the full test span** — the same series/seeds as K6.7's S2 row (`CELL_SEED =
20260841`), the class's OWN maximal registered severity (idx 28's own `d`), not a stronger,
invented probe chosen to avoid the outcome K6.4's derivation predicts. **The cell keeps
`shift_sigma: 3`** (K3.3.2's convention: the scorer's severity-3 key, realized per class — here as
`d=2.0`, the class's own analogue of "severity 3," not a literal sigma-shift).

**Registered prediction, honest, not tuned around: `detection_rate ≈ 0.03`** (K6.4's own Step-5
grid, idx 28's own predicted rate, directly — the S3 arm uses the identical construction the
fault-class grid's own strongest registered cell uses, so the two predictions are the SAME
number, not independently derived). At `0.03 < INERTNESS_FLOOR = 0.10`
(`validation/certification/lib/constants.mjs:19`), `scoreS3` (`score.mjs:340-345`) reads this
cell **INERT**, not `PASS` — registered here explicitly, before any run, as the expected outcome:
**S3 is expected to read INERT, and this document does not treat that as a defect to route
around.** Per `overallVerdict`'s own "valid-but-inert" rule (`score.mjs:564-568`: `s3Powered.length
=== 0` → `ADVISORY`, not `USE`, regardless of how strongly S2 clears), a card whose only claimed
S3 evidence is INERT caps at ADVISORY — **registered explicitly: this card's expected overall
verdict, absent a fired stop condition, is ADVISORY, not USE, per K6.14/K6.16.**

**Falsifier, registered:** `detection_rate` materially above `0.03` (approaching or exceeding
`0.50`) at `d=2.0` would itself be a surprise requiring investigation — either a defect in the
K6.4 derivation or in this construction's wiring — not a target to reach by strengthening the
probe further. **This document does NOT register a stronger d, or any other adjustment, chosen
to avoid the inert reading** — the derivation says the detector is inert at this class's own
maximal registered geometry, and the certification is registered to say so plainly.

### K6.9 Fault-cell field registration (extends §7/K3.8's convention)

Every fault cell (idx 26–29) scored by `shape_block_conformal_bet` carries: `detector`,
`fault_class: 'K6'`, `severity`, `canonical`, `cell_index`, `null_id` (`'N1'`/`'N3-p06'`, the
shared per-cell convention every other detector on these cells already carries, per
`run-battery.mjs:497`, cited via K3.1.5's own reconciliation finding — NOT the out-of-grammar arm
literal, which is cell-34-only), `phi`, `params: 'heldout-empirical'`, `alpha: 0.05`, `n: 2000`,
`ticks: 300`, `onset: 100`, `windows: 6`, `window_len: 30`, `window_span: '[100,280)'`, `fires`
(count crossing 20 at any of the 6 window checkpoints — K3.9's endpoint reading, reused directly,
K6.10), `detection_rate = fires/n`, `final_wealth_mean`, `final_wealth_median`,
`non_finite_wealth` (structurally 0, K6.7), `degenerate_windows` (structurally 0, K6.7),
`adapter_failures`, `verdict: 'POWERED'/'INERT'/'NOT-EXECUTABLE'` (A3b's vocabulary — coverage
cells, not S2/S3 card-protocol cells, K3.8's own distinction, unchanged here), `not_executable_reason`,
`substrate_tier: 'T1'`. **No `shift_sigma` field** (K3.8's own convention: fault cells carry no
`shift_sigma`, so `scoreS3` never admits them as S3 candidates — belt-and-suspenders with K6.7's
binding instrument-field exclusion).

### K6.10 Endpoint — window partition reused from K3.9, class endpoint stated

**Test span and partition are IDENTICAL arithmetic to K3.9** (`W=30` over the post-onset
`[100,300)` slice: six disjoint windows `t ∈ [100,130), [130,160), [160,190), [190,220),
[220,250), [250,280)`, `t=280..299` unused) — cited by reference, not re-derived, because the
construction shape (disjoint-window product martingale, `shapeBetWealth`'s `windows: number[][]`
interface, K6.2) is the same as `spectralBetWealth`'s.

**Class endpoint (decisive): wealth `>= 20` (`log_M >= Math.log(20) ≈ 2.9957`) at any of the 6
window checkpoints within `[100,280)`, the any-prefix Ville-inequality reading** (K3.9/K4's own
house convention for a running wealth process, applied here at window granularity). `detection_rate`
= fraction of N=2000 trajectories crossing (K6.9).

### K6.11 The O(1/m) qualifier + the phi-mismatch out-of-claim measurements

**O(1/m) qualifier on the proof tag, registered (the formula is unchanged; only the finite-sample
qualifier is named).** At finite `m`, `p` is drawn from a DISCRETE distribution over `{1/(m+1),
..., (m+1)/(m+1)}` under exchangeability, not the continuous Uniform(0,1) the calibrator identity
(K6.2) integrates over exactly — the same discretization K4.1.9 registers for
`point_tail_bet_e_value`'s own conformal rank, applied here. The deviation from continuous
uniformity is `O(1/m)`. **Disclosed measurement (Task 9 review, not re-run here): healthy
per-feature exceedance at `alpha=0.05`, `m` in the ~300 class, measures **+0.0010** above nominal**
— a small, `O(1/m)`-consistent discretization effect, not a validity defect (same reading K4.1.9
gives its own discretization gap). `M_MIN_K6 = 100` (K6.1) is the module's own registered floor
below which this coarseness would widen past an acceptable qualifier; both this study's registered
`m` values (333 T1, 300 T2, K6.3) sit well above it.

**Phi-mismatch, OUT OF CLAIM, measured for the record (Task 9's own fix-round measurement,
`task-9-report.md` "Phi-mismatch numbers, reproduced," reproduced here verbatim from that report,
not re-derived independently in this document):**

| scenario | mean of kurtosis + absSkew exceedance rates | out-of-claim because |
|---|---|---|
| cal φ=0.6 / live φ=0 | **0.0584–0.0589** (two seeds) | calibration and live drawn from DIFFERENT processes |
| cal φ=0.9 / live φ=0.6 | **0.0532–0.0577** (two seeds) | calibration and live drawn from DIFFERENT processes |

Pooled methodology (K=30 replicate (calibration, live) pairs, `N_LIVE=2000` each, sample SE
across replicates, per `task-9-report.md`'s Important-6 fix). **Asymmetric per feature, not
visible in the pooled figure:** mismatch consistently **inflates** the kurtosis exceedance rate
and **mildly deflates** the absSkew rate below nominal — the averaged figure above masks this
split; both directions are named here so a future reader does not read the pooled number as
"kurtosis and absSkew equally affected." **This construction's own registered regime is matched
process** (K6.2's validity argument: calibration and live must share the SAME dependence
structure, not merely the same numeric φ label) — these two scenarios are explicitly **out of
that claim**, measured only so a future mismatch is not mistaken for a fresh finding.

### K6.12 THE T2 CLUSTERSYNTH ARM, VALIDITY-ONLY (the ruling)

**Per Task 9's ledger ruling (`progress.md`): "T2 clustersynth arm runs VALIDITY-ONLY (the C22-fix
vindication test — the predecessor's graveyard)." Registered here, before any run, following the
plan's own instruction (Task 10: "READ [`validation/shape-battery`'s csui harness] for the
shard-realization call") and `~/concord/knowledge/stats/pages/shape-clustersynth-2026-08-05.md`'s
own history (the predecessor, `shape-kurtosis-e-value.ts`, fired on 82% of healthy clustersynth
shards, root cause C22: per-coordinate φ spanning two orders of magnitude within one calibration
window — the diagnosis this construction's own CONTIGUITY answer is built to fix).**

**Shard-realization call, checked against `validation/shape-battery/harness/run-clustersynth.mjs`
(the only existing clustersynth-driving harness in this repo — the plan's own citation for "how
the engine consumes it"):** `cs.buildScenario({family, pods, seed, window:{steps, dt_s}, faults})`
→ `sc.gpuIds` (shard ids) → per shard, `cs.realizeShard(sc.seed, gid, sc.ctx, sc.graph,
sc.applier, undefined, heavyTailsDf)` → a named-counter row per tick (`COUNTERS`,
`clustersynth/dist/harness/factor-model.js:28-33`: `gpu_temp_c`, `power_w`, `sm_util`,
`hbm_bw_gbps`, `nvlink_tx_gbps` — **p=5 coordinates**, checked directly against the export).

**Registered T2 construction:**

- Scenario: `cs.buildScenario({family: 'gb200', pods: 1, seed: K6_T2_SCENARIO_SEED, window:
  {steps: 9600, dt_s: 30}, faults: false})` — **healthy only** (`faults: false`, matching the
  predecessor's own C1 healthy-arm convention, `CLUSTERSYNTH-PREREG.md`), no fault injection of
  any kind: this arm answers ONE question, whether the construction's own validity survives
  independent telemetry, not a power question (K6's own T2-YES-bar is moot given K6.4's derived
  NO, per this section's own closing paragraph).
  `K6_T2_SCENARIO_SEED = BASE_SEED + 35 = 20260807 + 35 = 20260842` — continuing this study's own
  `BASE_SEED + idx` arithmetic for traceability, consumed as `cs.buildScenario`'s own `seed`
  parameter (a different namespace from this battery's per-trajectory `rng`/`gaussFrom`, named
  explicitly so the two are never confused).
- **Shards: `sc.gpuIds.slice(0, 120)`** — 120, matching `CLUSTERSYNTH-PREREG.md`'s own registered
  default shard count for its C1–C3 arms, reused here rather than an independently chosen number.
- `T = 9600` ticks per shard (`window.steps = 9600`, `dt_s = 30`) — **reference (calibration) =
  each coordinate's own first 9,000 ticks; live = the remaining 600 ticks.** `Math.floor(9000/30)
  = 300` reference blocks per coordinate per shard (K6.3's own registered origin for the plan's
  "m=300" figure); `Math.floor(600/30) = 20` disjoint live windows per coordinate per shard.
- **Per coordinate, per shard: `calibrateShapeBlocks(coordinate_reference_9000_ticks, W=30)`**,
  independently per coordinate (5 independent calibrations per shard, one per counter) — the
  construction's own registered unit of calibration (K6.2), not a pooled or cross-coordinate
  calibration.
- **Registered behavior on the degenerate-reference guard (`assertNonDegenerate`, K6.2 module
  cite `:206-222`), on quantized telemetry — registered as a finding to make, not assumed away.**
  clustersynth's counters are continuous-valued in the harness's own model (no explicit
  quantization in `COUNTERS`, checked against `factor-model.js:28-33`), but any coordinate whose
  9,000-tick reference happens to trip the guard (a constant block within some 30-tick slice, or
  zero spread across all 300 reference blocks for either feature) is **recorded skipped-with-
  reason, not scored** — `calibrateShapeBlocks` THROWS (K6.2), so Task 11's adapter must catch
  that throw per `(shard, coordinate)` and record it, not let it abort the whole arm. **The guard
  firing on real (independently-generated) telemetry is itself a registered finding, not an
  error to suppress** — this is the SAME predecessor's-mechanism probe C22 exposed
  (`shape-clustersynth-2026-08-05.md`: "per-coordinate φ spanning two orders of magnitude"), now
  checked directly against this construction's own guard rather than inferred after an 82%
  false-alarm rate. A nonzero skip count is disclosed in the eventual report by name, per
  coordinate, not folded into the crossing-rate denominator.

**Endpoint: healthy crossing rate vs `alpha=0.05`, per coordinate AND pooled. NO power claim** —
no fault is ever injected in this arm (`faults: false` above), so there is no `detection_rate`,
no `shift_sigma`, and no S3 candidacy of any kind for these cells. Per `(shard, coordinate)`: a
crossing iff wealth `>= 20` at any of the 20 disjoint live-window checkpoints (K6.10's own
any-prefix reading, reused at this arm's own 20-window span rather than K6.10's 6). Per-coordinate
crossing rate = crossings / (shards not skipped by the degenerate guard, that coordinate). Pooled
crossing rate = total crossings / total (shard, coordinate) pairs scored.

**Binding field-name constraint, registered before Task 11 builds the adapter (K3.1.4/K6.7's
convention, extended one arm earlier than K3 needed it):** T2's emitted cells carry a field named
**`t2_crossing_rate`** (NOT the literal `crossing_rate`) and, if a verdict-shaped field is
useful for the eventual report, **`t2_verdict`** (NOT `verdict`) — deliberately avoiding all
five instrument-named strings (`increment_estimator`, `crossing_rate`, `stopped_mean`,
`exceedance`, `mean_e`), the same reason K3.1.4/K6.7 register for the S3/fault-cell rows: `cellsFor`
(`validation/certification/lib/collect.mjs`) matches cells to this card purely by `detector` field,
regardless of study directory, so a T2 cell carrying the literal `crossing_rate` with no
`increment_estimator` present would read `ownPresent=[]`, `foreignPresent=['crossing_rate']` under
`applyGuards` (`guards.mjs:14-19`) — a `VOID`, which would exclude T2's own evidence from the
card's S2 stage with a confusing "instrument-class mismatch" reason that misdescribes a
deliberately out-of-instrument arm. Naming the field distinctly keeps T2 invisible to
`isValidityCell`/`isPowerCell` (`score.mjs:11-16`) entirely — matching K3.3.3's
`step_blindness_probe_rate` precedent exactly: T2 is descriptive evidence for the record and the
wiki write-back, not S2/S3 card-scoring evidence. Emitted cells: `{detector:
'shape_block_conformal_bet', arm: 'T2-clustersynth', counter, shard_id, n_reference_blocks: 300,
n_live_windows: 20, k, n, t2_crossing_rate, skipped: bool, skip_reason: string|null,
substrate_tier: 'T2'}` per (coordinate, shard), plus a pooled summary row per coordinate and one
overall pooled row.

**K6 T2-required-for-YES rule, and why the arm still runs.** Per Global Constraints (K6.1's
sibling line, quoted at §Amendment-summary K6.13, below): "K6 — healthy crossing Wilson LB > α on
the T1 battery **or** on the T2 clustersynth arm; T2 is required for a K6 YES." **This bar is
moot given K6.4's derived NO** — a construction already predicted NOT_POWERED at canonical cannot
reach YES regardless of T2's outcome (A4/§8's decision rule: COVERED requires the canonical cell
`>= 0.50`, independent of T2; T2 only ever ADDS a second way to REFUTE). **The arm runs anyway,
registered explicitly as the C22-fix vindication test**, with its own stop condition (K6.13):
**does this construction's validity — the entire reason it was built, not its power — survive
independent telemetry, where its predecessor did not?** This is filed as its own finding
regardless of K6's already-derived class answer.

### K6.13 Stop conditions (verbatim, T1 and T2 separately)

Copied verbatim from the plan's Global Constraints:

> K6 — healthy crossing Wilson LB > α on the T1 battery **or on the T2 clustersynth arm**; T2 is
> required for a K6 YES. A fired stop condition = REFUTED: record, file, class stays NO.

`α = 0.05` per §3 (unchanged, cited not redefined).

- **T1 stop condition.** Applies to K6.7's arm-34 S2 row's `crossing_rate`/`k`/`n=2000`
  (per-trajectory, same shape as K3.13). A fired T1 stop condition REFUTES `shape_block_conformal_bet`
  on the record; per §13/A4, K6 as a class stays NO regardless (every K1–K6 detector this study
  scores on K6's canonical cell is already 0.0000 or NOT_POWERED per the existing corpus, and
  K6.4 already derives this candidate's own canonical rate at ~0.000).
- **T2 stop condition.** Applies to K6.12's pooled `t2_crossing_rate` (Wilson 95% lower bound on
  the pooled crossing rate across all scored (shard, coordinate) pairs, computed on the pooled
  `k`/`n`, NOT on any single coordinate's own rate — matching the "pooled healthy shards" wording
  this task's own dispatch registers). **If the T2 stop condition fires: the construction's
  validity is refuted on independent telemetry — filed as a REFUTED record, the same
  vindication-test outcome the predecessor's own 82% false-alarm history warns is live for any
  shape-class construction until checked directly.** If it does NOT fire: filed as the positive
  vindication result (validity survives telemetry a synthetic battery alone cannot speak to, per
  `~/concord/knowledge/stats/pages/simulation-validates-instances-not-statements.md`, cited by the
  design page's own T2-bar reasoning, K6 authority section).

A fired stop condition on EITHER arm REFUTES `shape_block_conformal_bet` on the record; K6 as a
class stays NO either way, since K6.4's derived NOT_POWERED already independently accounts for
the canonical-cell answer regardless of T1/T2's own validity readings.

### K6.14 Predictions, with falsifiers

- **T1 healthy crossing rate.** *Prediction:* `<= alpha = 0.05` (validity, per the block-conformal
  exactness argument, K6.2, subject to K6.11's O(1/m) qualifier). *Falsifier:* the T1 stop
  condition itself (K6.13).
- **K6 canonical (`mix-d1.5`, idx 27) detection.** *Prediction:* **`~0.000`, expected NOT_POWERED**
  — K6.4's derived chain (Steps 1–5), corroborated by the disclosed growth-criterion measurement
  (`E[log eAvg|alt] = -1.414 ± 0.047` at `W=30`, anti-informative). *Falsifier:* canonical-cell
  detection rate materially above the derived ceiling (approaching or exceeding `0.50`) — reported
  as a surprise requiring investigation of the derivation or the wiring, not tuned toward.
- **Grid cells.** idx 26 (`d=1.0`): predicted `~0.000`. idx 28 (`d=2.0`): predicted `~0.03`
  (INERT-floor-adjacent, K6.4 Step 5). idx 29 (`mix-d1.5-ar1`, φ=0.6): matched-process regime
  (K6.2/K6.11), so — UNLIKE K3/K4's own `-ar1` cells — this is not automatically out-of-claim;
  registered prediction is the SAME `~0.000` as idx 27 (the construction's validity argument does
  not distinguish φ=0 from matched φ=0.6, only mismatched φ is out-of-claim, K6.11). Per §8/§10.1,
  only the canonical cell (idx 27) decides COVERED/NOT_POWERED; grid and `-ar1` cells are recorded
  for context.
- **S3 arm (cell 34).** *Prediction:* `~0.03`, expected INERT (K6.8). *Falsifier:* materially
  above `0.03` — a surprise, not a target (K6.8's own closing paragraph).
- **T2 pooled crossing rate.** *Prediction:* `<= alpha = 0.05` — the construction's own validity
  claim, unqualified by T1's own registered regime restrictions, since T2's whole purpose is to
  test that claim against telemetry the design was never fit to. *Falsifier:* the T2 stop
  condition (K6.13). **No power prediction is registered for T2** (K6.12: NO power claim, by
  design).

A failed endpoint is a publishable result on this candidate exactly as it is everywhere else in
this document (§0/rule 2); the DERIVED NOT_POWERED prediction being confirmed rather than
falsified is not this document treating the run as unnecessary — every falsifier above stands,
and a surprise on any of them is reported in full.

### K6.15 Fallbacks — inherited from A3, not restated

NOT-EXECUTABLE, non-finite, and vacuity handling for this candidate's T1 cells (fault cells 26–29
and arm cell 34) follow A3 unchanged — `non_finite_wealth` field name (A3a, structurally 0 here
per K6.7), `NOT-EXECUTABLE` verdict token with `not_executable_reason` (A3b), and the
N=2000-denominator vacuity rule (A3c). The T2 arm (K6.12) is NOT a coverage-battery cell in A3's
sense (no `CELL_SEED`, no N=2000 trajectory stream) and carries its own registered fallback: a
`(shard, coordinate)` pair whose calibration throws (the degenerate-reference guard, K6.12) is
recorded `skipped: true` with `skip_reason`, excluded from both the per-coordinate and pooled
crossing-rate denominators, never silently folded into a `0` reading.

### K6.16 House rules, mapped

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`: (1) committed before
any run of this candidate — no `shape_block_conformal_bet` battery or T2 run exists at this
commit. (2) A failed endpoint (K6.13's stop conditions, or K6.14's falsifiers) is a publishable
result; nothing above moves afterward — **including the DERIVED NOT_POWERED prediction itself**,
which is registered as a prediction to be confirmed or falsified by the run, not as a
pre-decided answer that makes the run optional. (3) No post-hoc analysis exists yet; reserved, to
be labelled and carry no verdict if written. (4) Fallback rule: K6.15, inherited from A3 (T1) plus
a new registered rule for T2. (5) Does not apply, as §11 rule 5 already states for this synthetic
battery (T1) — the T2 arm draws from clustersynth, an independent generator this study does not
control the seeds of beyond its own registered `seed` parameter (K6.12), which is this document's
equivalent freeze for that arm. (6) Results append-only: binding on this candidate's future runs
(T1 and T2), same manifest shape as §11 rule 6 and A8's field list, extended with K6.12's own T2
field set. (7) Reruns only for a named code defect, prior run preserved: binding, both arms. (8)
The report states every endpoint's number and verdict, both arms: binding on Task 11's report.

### Amendment summary

Registers, without superseding anything: the constants cross-check with `m` explicitly resolved
against the plan/page discrepancy (K6.1/K6.3: T1's `m=333`, T2's `m=300`, arithmetic shown for
both, the plan's bare "m=300" read as T2's own figure conflated into the class); the formula/
validity-argument line cites (K6.2); the derived NOT_POWERED prediction's full closed-form chain
(K6.4: mixture `E[Z^4]=2.3671875` exact at d=1.5, re-derived here; raw-kurtosis deficit `0.6328`;
the disclosed growth-criterion table, anti-informative at `W=30`, coin-flip at `W=300`,
break-even `W≈400-600`; the predicted detection grid `d=1.0→~0.000, d=1.5→~0.000, d=2.0→~0.03`);
the kappa misfit as a registered design limitation for a successor design, not a tuning license
(K6.5: floor bound `κ*>=0.172` at the registered `m=333`, measured `κ*≈0.32-0.4` at the
alternative, cost `-1.30` nats/window at the registered `κ=0.1`); a new §7 row on the four fault
cells (K6.6/K6.9) plus a new arm at cell 34 with `increment_estimator`/`crossing_rate` registered
up front rather than deferred to a correction round (K6.7, applying the K3.15/K3.1.1/K3.1.2
lesson directly); the class-appropriate S3 probe honestly registered at the class's own maximal
severity (d=2.0) with its expected INERT/ADVISORY outcome stated plainly, not routed around
(K6.8); the window-partitioned endpoint reused from K3.9 (K6.10); the O(1/m) qualifier and the
phi-mismatch out-of-claim measurements (K6.11); the T2 clustersynth arm, validity-only, with the
shard-realization call, the degenerate-reference-guard-on-telemetry finding registered as a
finding to make, the binding field-name constraint keeping T2 invisible to card scoring, and the
T2-required-for-YES bar named moot given the already-derived NO (K6.12); stop conditions for both
arms (K6.13); predictions with falsifiers for every cell and both arms (K6.14); fallback
inheritance plus a new T2-specific rule (K6.15). No endpoint, floor, or seed in §1–14, Amendment
v1.1, Amendment v1.2, Erratum v1.3, Amendment v2.K4, Amendment v2.K4.1, Amendment v2.K3, Amendment
v2.K3.1, Amendment v2.K3.2, or Amendment v2.K3.3 moves.

## Amendment v2.K6.1 — 2026-08-08, corrections before any K6 run

Closes a review verdicted NEEDS-AMENDMENT-BEFORE-RUN on Amendment v2.K6. Registered before any run
of `shape_block_conformal_bet`. Amendment v2.K6's text (K6.1–K6.16) stays intact; every item below
names the exact subsection it corrects, per rule 7 (K3.1.9/v1.2's own precedent for citation and
arithmetic corrections registered before any run uses the wrong value). All items are
registrations: no frozen endpoint, floor, or seed moves.

### K6.1.1 The d=2.0 prediction, corrected: the per-window ceiling was already registered, its consequence was not drawn (K6.4 Step 5, K6.8, K6.14, Amendment summary)

**The closed-form argument is not new — it is already present in this amendment's own arithmetic.**
K6.7 registers (and this document's own commit `8e98da6` corrected the rounding of):
`e = κ*p^(κ-1)` is bounded in `[κ, κ*(m+1)^(1-κ)]` — at the registered `m=333`, `κ=0.1`: `[0.1,
0.1*334^0.9] ≈ [0.1, 18.68]` (re-verified here: `0.1*334^0.9 = 18.6798`, node-computed). K6.7 drew
this bound only for a different point (`non_finite_wealth`/`degenerate_windows` are structurally
zero); it did not draw the consequence for K6.4/K6.8/K6.14's own predictions, which is registered
here: **`18.68 < 20 = 1/alpha`, so NO SINGLE WINDOW's `eAvg`, at any severity, can ever cross the
wealth bar alone.** Wealth is a PRODUCT across windows (K6.2), so crossing at all requires the
CUMULATIVE product across at least two windows to clear 20 — a materially rarer event than K6.8's
original `~0.03` figure assumed. That figure read "INERT-floor-adjacent" off the single-window
ceiling's proximity to 20 without accounting for the compounding the ceiling itself makes
necessary.

**Disclosed (Task 9 review, not independently re-run here): the registered endpoint, measured
directly, reads `1/20000`, `1/20000`, `0/20000` across three independent calibration draws** — order
`0.00003`–`0.00005`, not `0.03`.

**K6.4's Step 5 table is corrected. Original text read:**

> | idx 28 | 2.0 | **~0.03** |

**Corrected: `idx 28 | 2.0 | ~0.000`** — every severity in the registered grid, including `d=2.0`,
now predicts `~0.000`, per the ceiling argument and the disclosed measurement above.

**K6.8's prediction paragraph is corrected. Original text read:**

> **Registered prediction, honest, not tuned around: `detection_rate ≈ 0.03`** (K6.4's own Step-5
> grid, idx 28's own predicted rate, directly — the S3 arm uses the identical construction the
> fault-class grid's own strongest registered cell uses, so the two predictions are the SAME
> number, not independently derived). At `0.03 < INERTNESS_FLOOR = 0.10`
> (`validation/certification/lib/constants.mjs:19`), `scoreS3` (`score.mjs:340-345`) reads this
> cell **INERT**, not `PASS`

**Corrected: `detection_rate ≈ 0.000`** (this section's own ceiling argument, not merely echoed
from K6.4 — the two predictions stay the SAME number, now `~0.000` instead of `~0.03`, for the same
reason K6.8 originally gave). `INERTNESS_FLOOR = 0.10` is at `validation/certification/lib/
constants.mjs:20` (K6.1.4 corrects this citation separately, below). **`0.000 < 0.10` exactly as
`0.03 < 0.10` did** — `scoreS3` still reads this cell INERT, `overallVerdict` still caps at
ADVISORY (`score.mjs:564-568`'s valid-but-inert rule, cited unchanged): **the routing is verified
robust to this correction — S3 expected INERT, overall expected ADVISORY, exactly as K6.8
originally concluded, for a corrected reason.** K6.8's falsifier line ("`detection_rate` materially
above `0.03`") is corrected to **"materially above `~0.000` (approaching or exceeding `0.50`)"**.

**K6.14's two bullets are corrected. Original text read:**

> - **Grid cells.** idx 26 (`d=1.0`): predicted `~0.000`. idx 28 (`d=2.0`): predicted `~0.03`
>   (INERT-floor-adjacent, K6.4 Step 5).
> - **S3 arm (cell 34).** *Prediction:* `~0.03`, expected INERT (K6.8). *Falsifier:* materially
>   above `0.03` — a surprise, not a target (K6.8's own closing paragraph).

**Corrected: idx 28 predicted `~0.000` (ceiling-bound, K6.1.1, not "INERT-floor-adjacent" — the
figure is now two orders of magnitude below the INERT floor, not adjacent to it); S3 arm prediction
`~0.000`, expected INERT (K6.8 as corrected above); falsifier "materially above `~0.000`."**

**The Amendment summary's own recap line is corrected. Original text read:** "the predicted
detection grid `d=1.0→~0.000, d=1.5→~0.000, d=2.0→~0.03`" — **corrected: `d=1.0→~0.000,
d=1.5→~0.000, d=2.0→~0.000`.**

### K6.1.2 The O(1/m) qualifier, corrected: conservative, not anti-conservative (K6.11)

**K6.11's disclosed-measurement sentence is untraceable and directionally wrong, corrected here
with a closed-form re-derivation rather than a fresh disclosure. Original text read:**

> **Disclosed measurement (Task 9 review, not re-run here): healthy per-feature exceedance at
> `alpha=0.05`, `m` in the ~300 class, measures **+0.0010** above nominal** — a small, `O(1/m)`-
> consistent discretization effect, not a validity defect

**Corrected, CLOSED-FORM (re-derived here, not disclosed).** Under exchangeability, `p` is uniform
on the discrete set `{1/(m+1), ..., (m+1)/(m+1)}` (K6.11's own registered premise, unchanged). The
floor-type event `{p <= alpha}` has probability exactly `floor(alpha*(m+1)) / (m+1)`, and since
`floor(x) <= x` for any real `x`: `floor(alpha*(m+1))/(m+1) <= alpha*(m+1)/(m+1) = alpha`, **ALWAYS**
— the discretization is **CONSERVATIVE** (a discrete p-value's exceedance rate under this
floor-type rule is never above the nominal `alpha`), the OPPOSITE sign from the withdrawn
"+0.0010 above nominal" claim. Computed directly (node-verified, not assumed):

```
m=300: floor(0.05*301)/301 = floor(15.05)/301 = 15/301 ≈ 0.049834   (below 0.05)
m=333: floor(0.05*334)/334 = floor(16.7)/334  = 16/334 ≈ 0.047904   (below 0.05)
```

**Both registered `m` values (K6.3) give an exceedance rate below nominal — the qualifier
(`O(1/m)`, finite-sample discreteness) stays; its sign and value are what move.** Corroborated,
not merely asserted: the module's own COMMITTED unit-test measurement at `m=200` (matched
`φ=0.6/0.6`, `task-9-report.md` "Important 6," reproduced verbatim, not re-derived here): kurtosis
`0.04618`, absSkew `0.04950` — **both below that test's own nominal `0.04975`**, consistent with
the corrected conservative direction, not the withdrawn claim. `M_MIN_K6 = 100` (K6.1) remains the
registered floor below which this qualifier would widen past acceptable; unchanged by this
correction.

### K6.1.3 T2 field list — the plan's literal line superseded, named explicitly (K6.12)

**The plan's own text (`docs/superpowers/plans/2026-08-08-coverage-gap-detectors.md`, Task 11
"Files:" bullet) reads:**

> Create `validation/coverage/harness/run-clustersynth-arm.mjs` (T2: walks healthy clustersynth
> shards, per-coordinate calibrate-then-score, emits cells `{detector, fault_class: 'K6', arm:
> 'T2-clustersynth', counter, crossing_rate, n_windows, verdict}` to the same run-dir shape,
> sim/live routing per registered N).

**Followed literally, this field list VOIDs the run.** K6.12's own mismatch-mechanism derivation
(`cellsFor`'s detector-name-only matching, `validation/certification/lib/collect.mjs`, plus
`applyGuards`'s foreign-instrument rule, `guards.mjs:14-19`) shows a T2 cell carrying the literal
`crossing_rate` field with no `increment_estimator` present reads `ownPresent=[]`,
`foreignPresent=['crossing_rate']` — a `VOID`, excluding T2's own evidence from this card's S2
stage under a confusing "instrument-class mismatch" reason that misdescribes a deliberately
out-of-instrument arm (K6.12's own text, unchanged, already derives this; this item names the
supersession explicitly rather than leaving the plan's contradicting literal line unaddressed).

**Registered: K6.12's own field set — `t2_crossing_rate` (not `crossing_rate`), `t2_verdict` (not
`verdict`) — SUPERSEDES the plan's literal line above, named explicitly, per K3.3.4's pattern
(quote, correct, name the supersession rather than silently follow or silently correct the plan
text itself).** One additional supersession, not previously named as such: **T2 cells carry NO
`fault_class` field at all** (the plan's literal line stamps `fault_class: 'K6'`; K6.12 never
registers that as an intended path). Reason, checked directly against `coverageFor`
(`score.mjs`'s fault-class grouping layer): a `fault_class: 'K6'` stamp would make a T2 cell
visible to `coverageFor`'s own `classCells = cells.filter(c => c.fault_class === classId)` filter;
since T2 cells carry no `canonical`, `severity`, or `detection_rate` (K6.12: NO power claim), such
a cell would clear `applyGuards` (no instrument fields present at all under the corrected naming,
so neither `ownPresent` nor `foreignPresent` is nonempty, falling through to `status: 'OK'`) and
then fail `coverageFor`'s own `Number.isFinite(powerRate(cell))` check, landing in K6's coverage
`excluded[]` list with the misleading reason "no finite power rate recorded" — a shapeless,
power-free cell cluttering K6's coverage report for no registered reason. Omitting `fault_class`
keeps T2 fully outside `coverageFor` as well as outside S2/S3, not merely outside S2/S3 as K6.12's
original text stated. **Task 11's adapter must emit K6.12's registered field set, not the plan's
own literal example.**

### K6.1.4 Minor corrections, and two fields the T2 arm's registration names explicitly

- **`INERTNESS_FLOOR` citation, corrected.** K6.8 cited `validation/certification/lib/
  constants.mjs:19`; the actual line is `:20` (`export const INERTNESS_FLOOR = 0.10;`, checked
  directly). Corrected in place at K6.8 (via K6.1.1's own quote-and-correct, above) and registered
  here as its own citation fix, independent of the numeric correction K6.1.1 makes.
- **`ln(334)` transcription, corrected.** K6.5 wrote "`log(334) ≈ 5.81124`" — a transcription slip;
  `Math.log(334) = 5.8111409929767`, i.e. **`5.811141`**, not `5.81124`. The registered numeric
  CONSEQUENCE (`κ* >= 0.172` at `m=333`, K6.5) was computed directly from `1/Math.log(334)` and is
  unaffected — only the prose citation of `ln(334)` itself was wrong, corrected here.
- **KS critical value, precision corrected.** K6.7 wrote "`1.36/sqrt(24000) ≈ 0.008780`";
  node-verified: `1.36/sqrt(24000) = 0.0087788`. Corrected to the stated precision.
- **`inject.mjs` citations in K6.4 and K6.8 gain their directory.** Both cite `inject.mjs:60-70`
  bare (matching §2's own original table, which this document does not touch); within THIS
  amendment's own new sections, the fuller, unambiguous path is registered:
  `validation/coverage/lib/inject.mjs:60-70`, matching the fully-pathed citation style every other
  new citation in this amendment already uses (e.g. `detectors/shape-block-conformal-bet.ts:87`).
- **Module docstring line, corrected.** K6.3 cited `detectors/shape-block-conformal-bet.ts:224`
  for "the remainder, if any, is dropped, not padded" — checked directly: `:224` is
  `/** Slices \`rows\` into m disjoint CONTIGUOUS length-W blocks (m = floor(rows.length/W);`; the
  quoted text itself is on the next line, `:225`. Corrected.
- **`t2_pooled_lower_95`, registered.** K6.12/K6.13 describe a "Wilson 95% lower bound on the
  pooled crossing rate" (K6.13's own T2 stop-condition text) without naming its field. Registered:
  the pooled row (K6.12's "one overall pooled row") carries `t2_pooled_lower_95` — the exact field
  K6.13's stop condition tests, named to avoid the same kind of ambiguity K6.1.3 corrects for
  `crossing_rate`/`verdict`.
- **`k`/`n` on the T2 per-(shard, coordinate) rows, defined.** K6.12 registers "a crossing iff
  wealth `>= 20` at any of the 20 disjoint live-window checkpoints" and "per-coordinate crossing
  rate = crossings / (shards not skipped ...)" without naming the fields those counts live in.
  Registered: each per-(shard, coordinate) row carries `k` (`1` if that pair crossed, `0`
  otherwise — a single binary outcome per pair, not a sub-count over its 20 windows) and `n`
  (always `1` per row, the row's own weight); the per-coordinate and pooled summary rows aggregate
  these as `k = sum(k_i)`, `n = count of non-skipped pairs`, matching every other Wilson-bound
  `k`/`n` pair already registered throughout this document (§7, A1, K3.7, K4.5).
- **The review's superseded phi-mismatch figures, named beside the reproduced ranges (K6.11).**
  K6.11's table registers the reproduced ranges `0.0584–0.0589` and `0.0532–0.0577`
  (`task-9-report.md`'s own reproduction). The review's ORIGINALLY reported figures, which
  `task-9-report.md` names and does not claim to bit-exactly match, are registered here beside
  them for completeness: **cal φ=0.6/live φ=0 → `0.0608`; cal φ=0.9/live φ=0.6 → `0.0572`**
  (`task-9-report.md`: "Review's reported figures... My per-feature rates don't individually match
  either figure, but the mean of kurtosis and absSkew rates... lands close to both"). **Not
  bit-exact** — the reproduction and the original probe used different seeds/N and, per
  `task-9-report.md`'s own account, likely different per-feature-vs-pooled methodology; both
  numbers are registered so a future reader has the full provenance chain, not only the
  reproduction's own range.

### Amendment summary

Corrects K6.4's Step 5 table, K6.8's S3 prediction/falsifier, K6.14's grid-cell and S3-arm
bullets, and the prior amendment summary's own recap line — quoted and replaced, `d=2.0`'s
predicted rate `~0.03 → ~0.000` throughout, on the closed-form per-window ceiling argument
(`κ*(m+1)^(1-κ) = 0.1*334^0.9 = 18.68 < 20`, already present in K6.7's own arithmetic but its
consequence not previously drawn), corroborated by a disclosed reviewer measurement
(`1/20000, 1/20000, 0/20000`); S3-INERT and overall-ADVISORY are unchanged, registered as robust
to the correction (K6.1.1). Corrects K6.11's `O(1/m)` disclosed-measurement sentence from
"+0.0010 above nominal" (untraceable, directionally wrong) to a closed-form conservative bound,
`floor(alpha*(m+1))/(m+1) <= alpha` always, `0.049834` at `m=300` and `0.047904` at `m=333`, both
below nominal, corroborated by the committed `m=200` unit-test measurements (K6.1.2). Registers
K6.12's field set (`t2_crossing_rate`, `t2_verdict`, no `fault_class`) as a named supersession of
the plan's own literal, VOID-inducing Task 11 field list (K6.1.3). Corrects five citations/
transcriptions in place (`INERTNESS_FLOOR` line, `ln(334)`, KS critical precision, `inject.mjs`'s
directory, the module docstring line) and registers two field names the T2 arm's own text implied
but did not name (`t2_pooled_lower_95`, per-row `k`/`n`), plus the review's original (superseded,
not bit-exactly reproduced) phi-mismatch figures beside the reproduced ranges (K6.1.4). **No
endpoint, floor, or seed in §1–14 or any earlier amendment moves — including K6.1–K6.16's own
registered constants, seeds, and stop conditions, which stand exactly as Amendment v2.K6
registered them.**

## Amendment v2.K6.2 — 2026-08-08, d=2.0 degeneracy correction, before any run

Registered before any run of `shape_block_conformal_bet`, closing a finding the Task-11a adapter
smoke surfaced: `d=2.0` trips Amendment v2.K6.1's own named falsifier ("materially above `~0.000`
(approaching or exceeding `0.50`)"), and the closed-form reason is a degeneracy Amendments v2.K6
and v2.K6.1 both missed. Amendments v2.K6 (K6.1–K6.16) and v2.K6.1 (K6.1.1–K6.1.4) stay intact;
every item below names the exact text it corrects, per rule 7. All items are registrations: no
frozen endpoint, floor, or seed moves — the correction is entirely to this candidate's own
PREDICTIONS at the grid's top severity, not to any constant, seed, or decision rule.

### K6.2.1 The d=2.0 degeneracy, re-derived here, and the corrected predictions (supersedes K6.1.1's `~0.000` at d=2.0)

**Re-derived independently before writing (node-verified), not assumed.** `injectShapeMix`'s own
scale factor is `s = sqrt(max(0, 1 - d*d/4))` (`inject.mjs:60-70`, §2/K6.4 Step 1). At `d = 2.0`:
`d*d/4 = 1`, so **`s^2 = 1 - 1 = 0` EXACTLY** — not small, not asymptotically negligible, exactly
zero. The injected series at this severity is therefore **`Z = M` alone** (the `W*s` term vanishes
identically): a **pure two-point `±1σ` distribution** (`M = +1` or `-1`, each w.p. 1/2), not an
overlapping continuous mixture the way every other registered severity (`d=1.0, 1.5`, and the
matched-process `-ar1` cell at `d=1.5`) is. K6.4's own closed-form machinery (Step 1) still
applies exactly, at this degenerate parameter value:

```
E[Z^4] = (d/2)^4 + 6*(d/2)^2*s^2 + 3*s^4 = (d/2)^4 = 1^4 = 1              (s=0 kills the other two terms)
Var(Z) = (d/2)^2 + s^2 = 1 + 0 = 1                                        (still unit variance)
raw kurtosis = E[Z^4]/Var(Z)^2 = 1                                        exact, not estimated
deficit from Gaussian (3) = 3 - 1 = 2.0                                   (vs. the canonical d=1.5
                                                                            deficit of 0.6328125,
                                                                            a ratio of ≈3.16, not
                                                                            the ≈3x this section's
                                                                            own dispatch estimated
                                                                            loosely)
```

**Consequence for the live-window statistic, each step derivable from the construction, not
merely asserted:**

- A live window of 30 iid draws from a genuine **two-point** distribution has a sample raw
  kurtosis that **concentrates tightly** near its population value (1.0) — a two-point sample's
  possible outcomes are far more constrained than a continuous Gaussian sample's, so its sampling
  distribution is far narrower than the reference blocks' own (K6.4 Step 3's `sd≈0.70` figure was
  measured for the mixture/Gaussian regime; it does not apply to this degenerate two-point
  regime, which is why this document did not catch the consequence earlier).
- The reference blocks (K6.1's own `m=333` calibration, drawn from the healthy Gaussian null)
  scatter around raw kurtosis 3 with their own sampling spread; **disclosed median (Task-11a
  adapter smoke, not independently re-derived here): ≈2.66** — below the population value 3,
  consistent with K6.4 Step 3's own registered note that the small-sample kurtosis estimator's
  sampling distribution is right-skewed (mean above median).
- **Live `|dev| = |1.0 - 2.66| ≈ 1.66`** — large relative to the reference blocks' own typical
  `|deviation from their median|` (on the order of the reference sd, well under 1) — so this
  live value exceeds essentially every one of the 333 reference blocks' own deviations, driving
  the kurtosis-feature `p` to or near the registered floor `1/(m+1) ≈ 1/334`, and the
  kurtosis-feature `e` to or near the registered ceiling **`κ*(m+1)^(1-κ) ≈ 18.68`**
  (K6.1.1's own bound, re-cited not re-derived: `0.1*334^0.9 = 18.6798`, node-verified again
  here). The `absSkew` feature, by contrast, stays near its typical reference range (the two-point
  construction is symmetric, `M=±1` each w.p. 1/2, so live skew is not driven extreme the way
  kurtosis is) — **disclosed `eAvg ≈ 9–10`** (the average of the near-ceiling kurtosis `e` and a
  middling `absSkew` `e`), giving **`log(eAvg) ≈ 2.25`** (re-verified: `log(9.5) = 2.2513`) per
  window — **disclosed range "~2.2–2.3 per window."** Across the registered 6-window span
  (K6.10): **`6 * log(9.5) ≈ 13.51`** (re-verified), matching the disclosed **"~13–14"** figure,
  and both are **far above `log(20) ≈ 2.9957`** — crossing is expected well before the sixth
  window (a cumulative log-wealth this large after even two windows, `≈4.5`, already clears the
  bar).

**The earlier disclosed `1/20000, 1/20000, 0/20000` measurement (K6.1.1) is WITHDRAWN, not merely
superseded by a stronger number.** Stated plainly, per this task's own instruction: **the
construction that produced those three figures cannot be identified from what was disclosed, and
those figures no longer carry any evidential weight.** In its place: **the implementer confirmed
`~0.96–1.0` three independent ways** (the `run-battery` harness at `n=20` and `n=500`
trajectories, and a standalone driver calling `shapeBetWealth` directly against the module) —
disclosed with this provenance, not independently re-run inside this document, same convention as
every other Task-9/Task-11 probe this document discloses rather than reproduces.

**K6.1.1's own corrected text is now itself corrected — quoted, then replaced:**

> **Corrected: `idx 28 | 2.0 | ~0.000`** — every severity in the registered grid, including `d=2.0`,
> now predicts `~0.000`, per the ceiling argument and the disclosed measurement above.

**Re-corrected: `idx 28 | 2.0 | ~0.95–1.0`, expected POWERED** — the per-window ceiling argument
(K6.1.1) is NOT wrong as a general statement (no single window can cross alone, at any severity);
what was wrong was assuming the *typical* per-window `eAvg` stays near 1 (the null expectation)
at every severity. At the degenerate `d=2.0` boundary, the typical `eAvg` itself is `≈9–10`, so
the "at least two windows" compounding K6.1.1 correctly derives is *easily* satisfied, not
*prevented* — the earlier correction conflated "no single window suffices" with "crossing is
therefore rare," which does not follow once the per-window `eAvg` is this far from 1.

> **Corrected: `detection_rate ≈ 0.000`** ... **`0.000 < 0.10` exactly as `0.03 < 0.10` did** —
> `scoreS3` still reads this cell INERT, `overallVerdict` still caps at ADVISORY

**Re-corrected: `detection_rate ≈ 0.95–1.0`.** `0.95 >= INERTNESS_FLOOR = 0.10` (indeed
`>= COVERAGE_FLOOR = 0.50`): `scoreS3` reads this cell **POWERED**, not INERT (K6.2.2, below,
registers the consequence for the card's overall verdict). Falsifier, re-corrected: `detection_rate`
materially BELOW `~0.95` (approaching or below `0.50`) at `d=2.0` is now the surprise requiring
investigation.

> - **Grid cells.** ... idx 28 (`d=2.0`): predicted `~0.000` (ceiling-bound, K6.1.1, not
>   "INERT-floor-adjacent" — the figure is now two orders of magnitude below the INERT floor, not
>   adjacent to it); S3 arm prediction `~0.000`, expected INERT (K6.8 as corrected above);
>   falsifier "materially above `~0.000`."

**Re-corrected: idx 28 predicted `~0.95–1.0` (the s=0 two-point degeneracy, this section); S3 arm
prediction `~0.95–1.0`, expected POWERED. Falsifier: materially below `~0.95` (approaching or
below `0.50`).**

**The Amendment-summary recap lines (Amendment v2.K6's own, and Amendment v2.K6.1's own
restatement of it) are corrected a second time: `d=1.0→~0.000, d=1.5→~0.000, d=2.0→~0.95-1.0`.**
`d=1.0` (idx 26) and `d=1.5` canonical/`-ar1` (idx 27, 29) are **unaffected by this correction** —
`s^2 = 1 - d^2/4` is `0.75` at `d=1.0` and `0.4375` at `d=1.5` (K6.4 Step 1's own computation,
re-cited), both strictly positive, so those three cells remain genuine overlapping mixtures, not
two-point degeneracies, and their predicted rates stay `~0.000` exactly as K6.4/K6.1.1 registered.

### K6.2.2 Corrected stage tuple and overall verdict; the K6 class answer is UNCHANGED

**Corrects K6.7/K6.8's own expected-outcome language (not a quoted single sentence — the
conclusion K6.7's S2 paragraph and K6.8's closing paragraph both state) and K6.14/K6.16's
"expected ADVISORY" framing.** With the S3 arm re-corrected to POWERED (K6.2.1), the expected
post-run stage tuple, checked against `overallVerdict` (`score.mjs:505-587`, cited unchanged, not
re-read for this correction — its logic was already checked in K6.8's original text and does not
change): **S1 MISSING** (v1 floor, unaffected — this card's `prior_evidence` carries stage
`'design'`, not `'S1'`, K6's card, unchanged), **S2 PASS** (K6.7's `increment_estimator`/
`crossing_rate` registration, unaffected by this correction — the healthy arm carries no
injection at all, so `d=2.0`'s degeneracy is irrelevant to S2), **S3 POWERED, not INERT**
(K6.2.1), **S4 PASS** (unaffected). **Composed: expected overall verdict `USE`, not `ADVISORY`**
— `overallVerdict`'s `s3Powered.length === 0` branch (the valid-but-inert rule that capped this
card at ADVISORY under the withdrawn `~0.000` S3 prediction) no longer applies once at least one
claimed S3 cell clears `INERTNESS_FLOOR`; the function falls through to its `S4.status !== REFUSE
&& !== UNPRICED` path, `USE` at tier `T1`.

**The K6 CLASS answer is UNCHANGED, and this is registered explicitly so the correction above is
not misread as a class-level reversal.** `coverageFor`'s decision rule (§8/A4, unchanged, cited
not restated) reads the **canonical cell only** — idx 27, `mix-d1.5` — and that cell's predicted
rate is `~0.000` (K6.4 Step 5, K6.1.1, unaffected by this correction, K6.2.1's own closing
paragraph). **`~0.000 < COVERAGE_FLOOR = 0.50`: K6 stays NO.** The corrected expected COVERAGE.md
row context, registered here in place of K6.8/K6.16's withdrawn "best: `shape_block_conformal_bet`
ADVISORY (derived not-powered at class geometry)" framing:

> **K6 row: NO. Context: "best: `shape_block_conformal_bet` COVERED?-no: NOT_POWERED at canonical
> (powered only at the degenerate d=2.0 endpoint)."**

A card reading overall `USE` while its own class reads NO is not a contradiction under this
study's decision rule (A4, cited unchanged): `coverageFor`'s COVERED/NOT_POWERED status is
computed per class from the canonical cell alone, independent of the card's overall verdict; a
`USE` card whose canonical-severity power is genuinely absent simply does not carry that class,
exactly the same structural shape `point_tail_bet_e_value`'s own `USE`-but-only-because-of-a-
different-cell reasoning already establishes elsewhere in this document (A4's own text), applied
here in the opposite direction (a `USE` card that does NOT cover the class it was built for,
rather than a class covered by a card built for something else).

### K6.2.3 Taxonomy note for the write-back: d=2.0 is a boundary-artifact severity, not a stronger instance of the same family

**Registered for Task 12's wiki write-back, not adjudicated further here.** The grid's top
severity (`d=2.0`) is not "the mixture, more separated" — per K6.2.1, it is a **different
distribution family entirely** (a two-point `±1σ` law, `s=0` exactly, vs. every other registered
severity's genuine overlapping-Gaussian-components mixture, `s>0`). This is a **boundary artifact
of the grid's own parameterization** (`s = sqrt(max(0, 1-d²/4))` reaches its zero exactly at
`d=2.0`, `inject.mjs:60-70`), not a property of "distributional shape change" as a fault class
that happens to get easier to detect at higher severity. **This is why the decision rule reads
the canonical cell only, and not the grid's max**: the canonical cell (`d=1.5`, idx 27) is the
class-representative geometry this construction is meant to answer for, and the grid's own top
cell, at this particular class's own injection formula, is not a scaled-up version of that
geometry — it is a qualitatively different, considerably easier one. A future grid revision that
wants a genuine "very separated mixture" cell at higher `d` would need `s>0` preserved (e.g. a
grid point below `d=2.0`, or a differently-parameterized severity axis) — this document does not
register such a revision, it only names the boundary artifact so the write-back does not read
`d=2.0`'s power as evidence the class "is powerable at extreme severity" in the sense the
canonical-cell decision rule cares about.

### K6.2.4 Golden expectation, corrected

**Pre-run golden expectation is UNCHANGED**: `shape_block_conformal_bet` enters at
`NOT_EXECUTABLE` (S1/S2/S3 MISSING, S4 PASS, tier null) — no run of this candidate exists at this
commit, and nothing in this amendment changes that pre-run state (`validation/certification/test/
golden-verdicts.test.mjs`, committed at `657301a`, is not touched by this amendment). **Post-run
expected golden delta, registered for Task 11's own commit, not made here**: `NOT_EXECUTABLE →
USE`, tier `null → T1`, `S2 MISSING → PASS`, `S3 MISSING → POWERED`-mapped-`PASS` (S1 MISSING and
S4 PASS unchanged) — per K6.2.2's corrected stage tuple. The named delta will be registered
against the actual run's numbers when Task 11 lands it, not asserted here as already true.

### Amendment summary

Re-corrects Amendment v2.K6.1's own `d=2.0` correction (K6.1.1), a second-order correction: the
`s = sqrt(max(0, 1-d²/4))` term is exactly zero at `d=2.0` (re-derived here, node-verified), so
this severity is a pure two-point `±1σ` distribution, not an overlapping mixture — `E[Z^4]=1`,
raw kurtosis `1.0`, deficit `2.0` (vs. canonical `0.6328`, ratio `≈3.16`). The live-window
kurtosis statistic (tightly concentrated, two-point data) sits `≈1.66` from the Gaussian
reference blocks' own disclosed median (`≈2.66`), driving the kurtosis feature to its registered
ceiling `≈18.68` essentially every window; disclosed `eAvg≈9–10`, `log(eAvg)≈2.25`/window,
`≈13–14` cumulative over 6 windows, far above `log(20)≈2.9957` — crossing near-certain. The
earlier `1/20000,1/20000,0/20000` disclosed measurement is WITHDRAWN, its construction
unidentifiable, no evidential weight; the implementer's `≈0.96–1.0`, confirmed three independent
ways, is registered in its place with that provenance (K6.2.1). Corrects the expected stage
tuple and overall verdict: S3 POWERED not INERT, overall expected `USE` not `ADVISORY` — the K6
CLASS answer is explicitly UNCHANGED, still NO, decided by the canonical cell alone (`~0.000 <
0.50`), with a corrected expected COVERAGE.md row context naming the degenerate d=2.0 endpoint as
the only powered cell (K6.2.2). Registers the taxonomy point for the write-back: `d=2.0` is a
grid-parameterization boundary artifact, a different distribution family, not a stronger instance
of the canonical mixture — the reason the decision rule reads canonical only (K6.2.3). Golden
expectation: pre-run `NOT_EXECUTABLE` unchanged; post-run expected `USE`, delta to be named at
the run, not asserted here (K6.2.4). **No endpoint, floor, or seed in §1–14 or any earlier
amendment moves — K6.1–K6.16's and K6.1.1–K6.1.4's registered constants, seeds, m-values, and
stop conditions stand exactly as registered; only this candidate's own d=2.0 predictions and
their downstream stage/verdict/coverage-context expectations move, a second time.**

## Amendment v2.C1 — 2026-08-08, held-out row generator: a named code defect, registered reruns

Registered **after** the K4/K3/K6 runs and **before** the two reruns this amendment authorizes. This
is the one amendment class the study's own house rules admit post-run: **house rule 7** — "Reruns
only for a named code defect, fixed test-first, prior run preserved" (§11, `PREREGISTRATION.md:249`).
*Correction of the ruling's own citation: the rule is §11 item 7, not "§17 rule 7"; there is no §17 in
this document.* Everything below is either (a) the naming of the defect with its measured signatures,
(b) the corrected generator registered exactly, (c) corrected predictions with falsifiers, or (d) new
emitted fields. **No floor, no seed, no window partition, no stop condition, and no decision rule
moves.** The prior run directories are preserved byte-for-byte and are not edited by this amendment or
by the reruns it authorizes.

The defect was found by the whole-branch review, not by this study's own instrumentation. That is
recorded as a fact about the study, not softened: `p_uniformity` (K3.1.7/K6.7) *did* fire — the T1 KS
statistic 0.1080 against critical 0.0087788 is exactly the reading that led here — but the run report
(Task 11b §deviation (a)) adjudicated the direction wrongly, as "refutation-direction only". C1.11
below corrects that adjudication endpoint by endpoint.

### C1.1 The defect, named: `heldoutRows` draws a rank-1 Kronecker lattice, not a sample

**Code, at a path and a line.** `validation/coverage/harness/run-battery.mjs:503-511`, as registered
by K4.4 / K6.3 / K6.6 and as recorded in every run manifest's `seed_scheme.heldout`
(`"HELDOUT_SEED = CELL_SEED + 500000; seed(j) = HELDOUT_SEED + 7919*j, j = 0..9999"`):

```js
function heldoutRows(cell) {
  const heldoutSeed = cell.seed + HELDOUT_OFFSET;
  const rows = new Array(HELDOUT_ROWS);
  for (let j = 0; j < HELDOUT_ROWS; j++) {
    const r = rng(heldoutSeed + TRAJ_STEP * j);   // a FRESH stream per row
    rows[j] = drawFor(r, cell.phi)();             // its FIRST draw only
  }
  return { rows, heldoutSeed };
}
```

**The mechanism, derived.** `rng` is the Numerical-Recipes LCG `s <- (a*s + c) mod 2^32` with
`a = 1664525`, `c = 1013904223` (`validation/coverage/lib/inject.mjs:14-17`; the file's own comment
already records that it is an LCG and not the mulberry32 the name suggests). `gaussFrom` consumes
exactly two uniforms per gaussian (`inject.mjs:19-24`): `u1` is the first state after the seed, `u2`
the second. Both are **affine in the seed**, hence affine in `j`:

```
u1(j) = (a*(H + 7919 j) + c)                mod 2^32 = (A1 + B1*j) mod 2^32,  B1 = a*7919      mod 2^32
u2(j) = (a^2*(H + 7919 j) + a*c + c)        mod 2^32 = (A2 + B2*j) mod 2^32,  B2 = a^2*7919    mod 2^32
```

Recomputed here (node, BigInt, this session):

```
B1 = a*7919   mod 2^32 = 296471587    (= 0.069027670 in [0,1))    gcd(B1, 2^32) = 1
B2 = a^2*7919 mod 2^32 = 1215975367   (= 0.283116327 in [0,1))    gcd(B2, 2^32) = 1
```

So the pair `(u1(j), u2(j))` walks a single arithmetic progression on the 2-torus with fixed direction
vector `(B1, B2)/2^32` — **a rank-1 Kronecker lattice**, not a sample. Two consequences follow, and
both are measured below rather than asserted:

1. **The marginals are better than iid**, because both coordinate progressions are full-period
   (`gcd = 1`), so 10,000 terms are a low-discrepancy set rather than a random one. This is why every
   marginal check the study ran passed, and passed *too well*.
2. **The joint is deterministic and seed-invariant.** `H` only translates the lattice; it cannot
   change `(B1, B2)`. Therefore every lag autocorrelation of the emitted rows is a **constant of the
   scheme**, identical across unrelated held-out seeds — a property no iid sample of size 10,000 can
   have.

**Measured signatures (recomputed this session, `n = 10,000` rows per seed).** Marginals, K6 canonical
cell 27 (`HELDOUT_SEED 20760834`): mean `0.000200`, sd `0.999968`, raw kurtosis `2.989619` — all
nominal. Joint, same rows: `acf(1) = -0.182899`, `acf(2) = -0.751460`, `acf(3) = 0.455165`.
Seed-invariance across eight unrelated `H`:

| `H` | `acf(1)` | `acf(2)` | `acf(3)` |
|---|---|---|---|
| 20760825 | −0.182949 | −0.751602 | 0.455193 |
| 20760834 | −0.182899 | −0.751460 | 0.455165 |
| 20760841 | −0.182957 | −0.751353 | 0.455106 |
| 1 | −0.183056 | −0.751411 | 0.455210 |
| 999983 | −0.182353 | −0.751054 | 0.454709 |
| 123456789 | −0.182701 | −0.751489 | 0.455030 |
| 4000000000 | −0.182318 | −0.751350 | 0.454716 |
| 777 | −0.182737 | −0.751448 | 0.455088 |

`acf(2)` spans `-0.751054` to `-0.751602` — a range of `5.5e-4` — across seeds covering the whole
32-bit range. The sampling sd of an iid
`acf` at `n = 10,000` is `≈ n^(-1/2) = 0.01`, so `-0.7514` is a `≈75σ` departure that does not move
when the seed does. Under the corrected generator (C1.2) the same eight seeds give `acf(2)` in
`[-0.00837, +0.00541]` — inside `±1σ`, and seed-dependent, as an iid sample must be.

**Why it reached a verdict, and not merely a descriptive field.** K6's own module docstring states the
construction's answer to the predecessor's C22 failure is **CONTIGUITY** — "reference blocks are
disjoint contiguous slices of the held-out segment, so each block carries its own within-block serial
dependence" (`detectors/shape-block-conformal-bet.ts:12-16`). Under the spaced-seed scheme there was
no held-out *segment* to slice: there were 10,000 one-draw streams, and each 30-row "block" was a
30-step arc of the same fixed lattice line. Every block therefore looked like every other block, and
the reference `|dev from median|` distribution was **compressed**. Measured, `W = 30`, block raw
kurtosis, sd across the 333 blocks:

| held-out seed | lattice sd | corrected sd |
|---|---|---|
| 20760825 (K4 cell 18) | 0.4835 | 0.6962 |
| 20760826 (K4 cell 19) | 0.4858 | 0.7747 |
| 20760833 (K6 cell 26) | 0.4973 | 0.7217 |
| 20760834 (K6 cell 27) | 0.4794 | 0.6206 |
| 20760835 (K6 cell 28) | 0.4926 | 0.6733 |
| 20760839 (K4 arm 32) | 0.4788 | 0.7962 |
| 20760841 (K6 arm 34) | 0.4971 | 0.7064 |

A compressed reference makes *every* live window rank as more extreme than it is. That inflates the
healthy false-alarm rate **and** the power reading, in the same direction, which is why C1.11's
per-endpoint direction table is necessary and a single global "conservative/anti-conservative" label
is not.

**The decisive per-window arithmetic at `d = 2.0`** (cell 28, `HELDOUT_SEED 20760835`; the two-point
degeneracy v2.K6.2 registered, live raw kurtosis exactly 1 in expectation). Recomputed this session:

```
                    ref kurtosis median   live |dev|   #{ref |dev| >= live}   p          e_kurtosis
lattice reference          2.721146        1.721146           2/333        0.00898204     6.9496
corrected reference        2.744525        1.744525          10/333        0.03293413     2.1583
```

and, averaged over 1200 live windows (200 trajectories × 6 windows) at `d = 2.0`:

```
                 mean e_kurtosis   mean e_absSkew   mean eAvg   mean log(eAvg)   6-window cumulative   bar log(20)
lattice                 5.8269          0.7412        3.2841        1.1630             6.9778            2.9957
corrected               1.8845          0.4205        1.1525        0.1148             0.6890            2.9957
```

The lattice put the wealth process `≈4.0` nats **above** the crossing bar on the average trajectory;
the corrected reference leaves it `≈2.3` nats **below** it. That is the whole distance between
`detection_rate 1.0000` and `detection_rate ≈0.004`, and it is the single verdict this defect moved.

### C1.2 The corrected generator, registered exactly (supersedes K4.4 / K6.3 / K6.6's `seed(j)` clause)

The `seed(j) = HELDOUT_SEED + 7919*j` clause in K4.4, K6.3 and K6.6 is **superseded** — named
supersession, not silent replacement. `HELDOUT_SEED = CELL_SEED + 500000` and `HELDOUT_ROWS = 10,000`
are **unchanged**; only the way the 10,000 rows are drawn from that one seed changes. Registered form,
verbatim:

```js
function heldoutRows(cell) {
  const heldoutSeed = cell.seed + HELDOUT_OFFSET;
  const r = rng(heldoutSeed);              // ONE stream per held-out draw
  const draw = drawFor(r, cell.phi);       // ONE generator over that stream
  const rows = new Array(HELDOUT_ROWS);
  for (let j = 0; j < HELDOUT_ROWS; j++) rows[j] = draw();   // 10,000 CONSECUTIVE draws
  return { rows, heldoutSeed };
}
```

Three properties this registers, each of which the old form failed:

- **One continuous LCG stream per held-out draw.** `rng(heldoutSeed)` is advanced continuously;
  `gaussFrom` is applied serially to it. The rows are 10,000 consecutive draws, the same way a live
  window is 30 consecutive draws — which is the comparability the block-conformal rank assumes.
- **For `phi > 0` cells the `drawFor` chain runs on that continuous stream**, so the AR(1) recursion
  `p <- phi*p + sqrt(1-phi^2)*g()` actually carries state across rows and `phi` is real. C1.3.
- **`heldoutSeed` remains the row-set's identity** and remains emitted on every row that carries a
  held-out calibration, so the existing provenance fields (`heldout_seed`, `heldout_rows`) keep their
  meaning and every registered seed literal in `assertRegistryAgreement` stands unchanged.

**Registered runtime guard (new, and the mechanical kill for a regression to the old form).**
`heldoutRows` asserts the drawn rows carry the serial structure their own `phi` implies, and throws
otherwise — so a mutation back to the spaced-seed scheme cannot produce a run at all, rather than
producing a run that has to be caught by reading a report:

```
phi = 0 :  |acf(1)| <= 0.10  and  |acf(2)| <= 0.10
phi > 0 :  |acf(1) - phi| <= 0.10  and  |acf(2) - phi^2| <= 0.10
```

The bound `0.10` is registered and derived, not tuned: the iid sampling sd of `acf(k)` at
`n = 10,000` is `≈0.01`, so `0.10` is a `10σ` bound (false-crash probability negligible), while the
lattice reads `acf(2) = -0.7514` at `phi = 0` — outside by a factor of `7.5` — and, at `phi = 0.6`,
`acf(1) = 0.2687` against `phi = 0.6` (deviation `0.331`) and `acf(2) = -0.3155` against
`phi^2 = 0.36` (deviation `0.676`). The old scheme fails the guard on **both** the iid and the AR(1)
cells. Measured margins under the corrected form: `phi = 0`, max `|acf|` over eight seeds `0.0167`;
`phi = 0.6`, cell 21 `acf(1) = 0.5946 / acf(2) = 0.3500` (deviations `0.0054 / 0.0100`), cell 29
`acf(1) = 0.5957 / acf(2) = 0.3616` (deviations `0.0043 / 0.0016`).

`acf(k)` is registered as the standard biased sample autocorrelation on the drawn rows:
`acf(k) = sum_{i<n-k} (x_i - xbar)(x_{i+k} - xbar) / sum_{i<n} (x_i - xbar)^2`.

### C1.3 C3: the `-ar1` held-out rows carried no serial structure at all (cells 21 and 29 re-registered)

**Quote and correct.** K6.6's cell-29 registration, and §4's `N3-p06` framing that both `-ar1` held-out
cells inherit, describe the calibration as drawn from **the cell's own matched AR(1) process** — the
whole point of an `-ar1` replicate being that calibration and live data share the dependence structure.
That sentence was **false of the artifact**. Under the spaced-seed scheme `drawFor(r, 0.6)` was
constructed and then called **once** per row, so the AR(1) recursion never advanced: each row was the
first output of a fresh chain, i.e. `phi*g_0 + sqrt(1-phi^2)*g_1` with independent `g` per row. The
rows carried the correct *marginal* variance and no serial dependence whatsoever beyond the lattice's
own artefact. Measured (recomputed this session, `n = 10,000`):

| cell | scheme | `acf(1)` | `acf(2)` | `acf(3)` |
|---|---|---|---|---|
| theory, AR(1) `phi = 0.6` | — | 0.600 | 0.360 | 0.216 |
| 21 (`5sigma-point-ar1`) | lattice | 0.2683 | −0.3164 | −0.2029 |
| 21 | corrected | 0.5946 | 0.3500 | 0.1986 |
| 29 (`mix-d1.5-ar1`) | lattice | 0.2687 | −0.3155 | −0.2029 |
| 29 | corrected | 0.5957 | 0.3616 | 0.2091 |

**What is re-registered.** Cells 21 and 29, *as they were actually run in
`run-20260808T064039Z` and `run-20260808T121548Z`*, are **out-of-claim** rows: the matched-process
registration they were run under does not describe them. They are not withdrawn (the runs are
preserved and the numbers are real readings of *something*), they are relabelled: **mismatched-`phi`
calibration** — an iid-marginal reference scored against AR(1)-correlated live windows, which is the
same out-of-claim regime K6.11's phi-mismatch measurements already register as out-of-claim. The
reruns this amendment authorizes restore the matched-process reading, and **only the rerun rows may be
cited as the matched `-ar1` evidence**.

**Consequence for the `-ar1` endpoints, registered before the rerun:** none of them decides anything.
K6's `-ar1` cell 29 reads `0.0000` under both schemes (C1.4). K4's `-ar1` cell 21 reads `0.9790`
(lattice) and `0.9780` (corrected), both far above the `0.50` floor, and it is not the canonical cell.
So C3 costs the study no answer; it costs the study a *claim* about what two of its rows measured, and
that correction is the deliverable.

### C1.4 Counterfactual measurements, disclosed with provenance (the predictions below are measured, not blind)

**Disclosure, in the K3.11 tradition this study already set** (a review-time probe is named with its
provenance rather than pretended away): every number in C1.5 was **measured before being registered**,
by a standalone re-implementation of the harness's own read paths written this session
(`rng`/`gaussFrom`/`injectShapeMix`/`injectPoint`/`injectStep` imported from
`validation/coverage/lib/inject.mjs`; `calibrateShapeBlocks`/`shapeBetWealth`/`calibrateTailBet`/
`pointTailBetEValue`/`stampHeldoutFamilyE` from the built modules; window partition, onset gate and
threshold re-derived, not imported from the harness). It is not a blind pre-registration and is not
presented as one.

**The refuter is validated against the artifacts it must reproduce.** Run under the *old* scheme it
reproduces **thirty-nine** committed T1 endpoints to the last digit: K6's four grid `detection_rate`s
(`0.0035 / 0.0005 / 1.0000 / 0.0000`), arm 34's `k = 22`, `crossing_rate 0.0110`,
`increment_estimator.mean 0.825802767757456`, `p_uniformity.ks_statistic 0.10802919161676644`, first
decile count `4475`, and S3 `detection_rate 1.0000`; K4's four `point_tail_bet_e_value` grid rates
(`0.5055 / 0.9750 / 1.0000 / 0.9790`) with all four `cal_median` and all four `cal_mad`
(`0.00020601995399109694 / 0.6707177384018341` on cell 18, and the other three), the four
`family_E_conformal_heldout` grid rates (`0.0445 / 0.0430 / 0.0520 / 0.1340`) with all four
`indicator_rate_at_injected_tick` (`0.866 / 0.999 / 1 / 1`), arm 31's `exceedance 0.0280`,
`mean_e 3.11604757789375`, `lower_95 0.02254017183440872` and S3 `1.0000`, and arm 32's `k = 1012`,
`exceedance 0.00253`, `mean_e 0.6350959226365732`, `lower_95 0.002402661467871697` and S3 `1.0000`.
**Not cross-checked** (so the C1.5 predictions for them are the harness's own output, not independently
predicted): `final_wealth_mean`/`final_wealth_median` on any row, `p_uniformity.decile_counts` beyond
the first decile, and `window_crossing_rate`. A refuter that reproduces the committed run to the last
digit on thirty-nine endpoints under the old scheme is the right instrument to predict the rerun under
the new one.

**Prior figures disclosed and reconciled.** The review reported the corrected `d = 2.0` reading as
`~0.002` and `0.000` "across three refuters"; this session's refuter reads `0.0045` (cell 28) and
`0.0005` (arm 34 S3). The figures disagree in magnitude and agree in every consequence: all of them
are two orders of magnitude below the `COVERAGE_FLOOR = 0.50` and below the
`INERTNESS_FLOOR = 0.10`, so all of them give S3 INERT and card ADVISORY. C1.5 registers **this
session's recomputed values as the point predictions** and a band as the falsifier-bearing form, so a
small disagreement between refuters cannot read as a failed prediction and a large one still can.

### C1.5 Corrected predictions, with falsifiers

**K6 T1 (`--classes K6`, `n = 2000`).** Registered point predictions and, in the same row, the band
whose violation is the falsifier:

| row | lattice (run-20260808T121548Z) | corrected prediction | band (falsifier if outside) | verdict |
|---|---|---|---|---|
| cell 26 `mix-d1.0` | 0.0035 | **0.0010** | `<= 0.02` | INERT |
| cell 27 `mix-d1.5` (canonical) | 0.0005 | **0.0000** | `<= 0.02` | INERT |
| cell 28 `mix-d2.0` | **1.0000** | **0.0045** | `<= 0.02` | **INERT** (was POWERED) |
| cell 29 `mix-d1.5-ar1` | 0.0000 | **0.0000** | `<= 0.02` | INERT |
| arm 34 S2 `k` / `crossing_rate` | 22 / 0.0110 | **0 / 0.0000** | `crossing_rate <= 0.02` | not-refuted |
| arm 34 S2 `lower_95` | 0.007770215376370452 | **0.0000** | `<= alpha = 0.05` | (stop condition clear) |
| arm 34 S2 `increment_estimator.mean` | 0.825802767757456 | **0.44367965142547167** | `<= 1` | no verdict authority |
| arm 34 S2 `p_uniformity` `P(p<=0.05)` | 0.10017 | **0.050167** | `[0.03, 0.07]` | no verdict authority |
| arm 34 S2 `p_uniformity.ks_statistic` | 0.10802919161676644 | **0.022903692614770432** | `<= 0.04` | no verdict authority |
| arm 34 S3 `detection_rate` | **1.0000** | **0.0005** | `<= 0.02` | **INERT** (was POWERED) |
| `degenerate_windows`, every row | 0 | **0** | `= 0` | K6.7's structural-zero claim |

`p_uniformity.ks_critical_at_alpha` stays `1.36/sqrt(24000) = 0.008778762251403479` (unchanged: `n` is
unchanged). **The KS statistic is still above its critical value under the corrected scheme**
(`0.0229 > 0.0088`) — the `2×`-nominal inflation collapses to `1.003×` nominal at the `alpha = 0.05`
point, but the full-distribution KS test still rejects uniformity. That is registered here as an
*expected, not-yet-explained* residual, carrying no verdict (K6.7 gives `p_uniformity` no verdict
authority), and it is filed for the write-back rather than resolved: K6.1.2's closed-form
"`P(p<=alpha) <= 0.047904` ALWAYS at `m=333`" is **still contradicted in the tail shape** even after
C1 is fixed, and the remaining mechanism is unidentified. Naming it now prevents the rerun from being
read as having closed a question it does not close.

**K6 card stage tuple and overall verdict — reverting to what v2.K6/K6.1 originally registered.**
S1 `MISSING`, S2 `PASS`, **S3 `INERT`**, S4 `PASS` → overall **`ADVISORY`**, tier `T1`. The chain,
narrated:

1. **v2.K6 / v2.K6.1** derived, before any run, that this candidate is NOT_POWERED at canonical *and*
   inert on its own S3 arm, and registered the expected card verdict as **ADVISORY** (K6.4, K6.8;
   golden-verdicts.test.mjs:161-168 carries that registration verbatim).
2. **v2.K6.1 (K6.1.1)** corrected an arithmetic slip in K6.4's ceiling (`e_max 18.69 -> 18.68`) and
   kept ADVISORY.
3. **v2.K6.2 (K6.2.1/K6.2.2)** overturned it: `s = sqrt(1 - d^2/4) = 0` exactly at `d = 2.0`, the
   Task-11a smoke read `1.0000` there, so S3 was re-registered `POWERED` and the expected card verdict
   moved to **USE**. That derivation is *correct arithmetic about the injection* and it stands.
4. **This amendment** removes the reason the smoke read `1.0000`: the ceiling `e_max ≈ 18.68` was
   reachable only because the *reference* was a lattice. Against a real reference the same `d = 2.0`
   two-point law produces `mean eAvg 1.1525` (C1.1), which cannot cross. So v2.K6.2's **step 3
   conclusion is withdrawn while its premise is kept**: `d = 2.0` is still exactly a two-point law,
   still a boundary artifact in the sense K6.2.3 registers, but it is **not** powered. S3 returns to
   `INERT` and the card returns to **ADVISORY** — the verdict v2.K6/K6.1 registered from a derivation,
   arrived at now from a measurement.

**The K6 CLASS answer is unchanged: `NO`.** It was decided by the canonical cell alone under both
schemes (`0.0005 -> 0.0000`, against `COVERAGE_FLOOR 0.50`), and it is now a fortiori: the corrected
canonical reading is *lower*. `COVERAGE.md`'s K6 detail line is expected to continue naming
`safe_t_e_value NOT_POWERED 0.0005` — the three-way tie at `0.0005` (safe_t / universal_inference /
shape_block_conformal_bet) becomes a two-way tie at `0.0005` (safe_t / universal_inference) once
shape_block drops to `0.0000`, and `betterBlocked`'s lexicographic tie-break
(`verdict.mjs:233-239`) still resolves to `safe_t_e_value`. C1.9 registers that the tie is now
*rendered* rather than silently resolved.

**K4 T1 (`--classes K4`, `n = 2000`).** Registered as a same-defect rerun: cells 18-21 and arms 31/32
all calibrate on `heldoutRows`, so their rows change. Predictions:

| row | lattice (run-20260808T064039Z) | corrected prediction | band | verdict |
|---|---|---|---|---|
| `point_tail_bet_e_value` cell 18 `3sigma-point` | 0.5055 | **0.4870** | `[0.45, 0.53]` | **INERT** (was POWERED) |
| `point_tail_bet_e_value` cell 19 (canonical) | 0.9750 | **0.9780** | `>= 0.95` | POWERED |
| `point_tail_bet_e_value` cell 20 `8sigma-point` | 1.0000 | **1.0000** | `>= 0.99` | POWERED |
| `point_tail_bet_e_value` cell 21 `-ar1` | 0.9790 | **0.9780** | `>= 0.95` | POWERED |
| `point_tail_bet_e_value` arm 32 S2 `k` / `n_points` | 1012 / 400000 | **742 / 400000** | — | — |
| arm 32 S2 `exceedance` | 0.00253 | **0.001855** | `<= 0.01` | — |
| arm 32 S2 `mean_e` | 0.6350959226365732 | **0.527556** | `< 1` (mean rule) | not-refuted |
| arm 32 S2 `lower_95` | 0.002402661467871697 | **0.0017464** | `<= alpha = 0.05` | stop condition clear |
| arm 32 S3 `detection_rate` | 1.0000 | **1.0000** | `>= 0.99` | POWERED |
| `family_E_conformal_heldout` cell 18 | 0.0445 | **0.0765** | `<= 0.15` | INERT |
| `family_E_conformal_heldout` cell 19 (canonical) | 0.0430 | **0.0360** | `<= 0.15` | INERT |
| `family_E_conformal_heldout` cell 20 | 0.0520 | **0.0450** | `<= 0.15` | INERT |
| `family_E_conformal_heldout` cell 21 `-ar1` | 0.1340 | **0.1155** | `<= 0.20` | INERT |
| `family_E_conformal_heldout` arm 31 S2 `exceedance` | 0.0280 | **0.0455** | `<= 0.05` | — |
| arm 31 S2 `mean_e` | 3.11604757789375 | **4.175984** | `> 1` (mean rule fires) | REFUTED-mapped |
| arm 31 S2 `lower_95` | 0.02254017183440872 | **0.0384292** | `<= alpha = 0.05` | not-refuted token |
| arm 31 S3 `detection_rate` | 1.0000 | **1.0000** | `>= 0.99` | POWERED |
| `safe_t` cells 18-21 | 0 / 0.0005 / 0 / 0 | **bit-identical** | exact | INERT |

**Two K4 movements are registered here so they cannot be reported as surprises, and one boundary is
named as the reason this rerun is not cosmetic:**

- **Cell 18 crosses the coverage floor downward: `0.5055 -> 0.4870`, POWERED -> INERT.** It is a grid
  cell, not the canonical one (`coverageFor` reads canonical only, `score.mjs:397-402`), and it carries
  no `shift_sigma`, so it never enters `scoreS3` (`score.mjs:264-266`). No card verdict and no class
  answer moves. It is registered because a `0.50`-floor crossing on a registered row is exactly the
  kind of change that must be named in advance rather than absorbed.
- **Arm 31's S2 exceedance rises `0.0280 -> 0.0455` and its `mean_e` rises `3.1160 -> 4.1760`.** The
  lattice was *understating* this card's false-alarm rate. The card is `REFUSE` either way — the
  terminal mean rule fires at `4.176 > 1` exactly as it fired at `3.116 > 1` — and the Wilson
  `lower_95 0.0384 <= 0.05` still clears the cell's own token. But the direction is
  **anti-conservative in the validity direction**, which is the second place the run report's
  "refutation-direction only" adjudication was wrong (C1.11).

**K4 CLASS answer unchanged: `YES`**, carried by `point_tail_bet_e_value` at canonical cell 19,
`0.9780 >= 0.50`, tier T1. **K4 card verdicts unchanged**: `point_tail_bet_e_value` `USE`/T1,
`family_E_conformal_heldout` `REFUSE`, `safe_t_e_value` `USE`/T1. **Any K4 card-verdict or
class-answer movement is a SURPRISE to be reported, not absorbed.**

**K3 does not rerun and is not affected.** `spectral_bet_e_process` passes `sigma` as an oracle
constant and K3.3/K3.6 register that it has no held-out stream at all; `assertRegistryAgreement`
encodes the same fact (`run-battery.mjs:211-214`, no `HELDOUT_SEED` for arm 33), and
`run-20260808T091521Z` carries no `heldout_seed` on any row. K3's answer (`YES`, 0.654, T1) is
untouched.

**T2 does NOT rerun.** `validation/coverage/harness/run-clustersynth-arm.mjs` never calls
`heldoutRows`: its reference blocks are per-shard **prefixes of the shard's own coordinate series**
(K6.12's registered construction), so the defect cannot reach it. `run-t2-20260808T121710Z` stands as
registered evidence, and the T2 vindication result (0 of 600 healthy pairs fire, against the
predecessor's 82% of shards) is unaffected. **This is also why the T2 arm is now the stronger of the
two K6 validity readings**, and the amendment records that ordering explicitly.

### C1.6 Rerun scope, supersession, and the prior artifacts

**Two reruns, once each, in this order:** (1) K6 T1 `--classes K6`; (2) K4 T1 `--classes K4`. Both at
the registered `n = 2000`, both into `validation/coverage/results/live/run-<UTC>/`, append-only. Then
one certification re-score. Nothing else runs, and neither battery is run twice.

**Prior run directories are preserved and untouched.** `run-20260808T010208Z`,
`run-20260808T064039Z`, `run-20260808T091521Z`, `run-20260808T121548Z` and
`run-t2-20260808T121710Z` keep every byte.

**A preserved prior run is still in the evidence corpus, and that is a scoring problem this amendment
must solve rather than leave implicit.** `loadEvidence` (`validation/certification/lib/collect.mjs:135-167`)
pools cells from every directory under `validation/*/results/live/` with no cross-run dedup. If the
lattice arm-34 S3 row (`detection_rate 1.0000`) stays in the pool alongside the corrected one
(`0.0005`), `overallVerdict`'s `s3Powered` set (`score.mjs:555`) is non-empty and the card stays `USE`
— the rerun would change nothing. Registered mechanism, added before the reruns:

- **A rerun declares what it supersedes, in its own manifest** (an A8 field-list extension):
  `"supersedes": [{ "study", "run", "detectors": [...], "reason" }]`. `run-battery.mjs` gains
  `--supersedes <study/run:detector,detector>` plus `--supersedes-reason <text>`; the named run
  directory must exist or the harness throws.
- **`loadEvidence` drops exactly the declared `(study, run, detector)` rows** and records each drop in
  its returned `runs` list, so the exclusion is derived from a registered field, never hardcoded, and
  is reported rather than silent. The certification `REPORT.md` gains a **Superseded evidence**
  section naming every dropped `(study, run, detector)` and the declaring run's reason.
- **No existing manifest declares `supersedes`**, so the mechanism is inert on the current corpus
  except where these two reruns declare it.

**The declared supersessions, registered exactly:**

| declaring run | supersedes study/run | detectors dropped | why |
|---|---|---|---|
| K6 rerun | `coverage/run-20260808T121548Z` | `shape_block_conformal_bet` | every row of this detector calibrates on `heldoutRows` |
| K4 rerun | `coverage/run-20260808T064039Z` | `family_E_conformal_heldout`, `point_tail_bet_e_value` | same |
| K4 rerun | `coverage/run-20260808T010208Z` | `family_E_conformal_heldout` | that run's only held-out-bearing rows (K4 cells 18-21 + arm 31); its K1/K2/K3/K5/K6 rows for `safe_t`, `universal_inference`, `group_average_e_value`, `family_D_spectral_e_detector` touch no held-out stream and are **kept** |

`safe_t` rows are **not** superseded anywhere: they take no held-out calibration and the rerun
reproduces them bit-identically, so both copies are the same evidence.

### C1.7 I2 — the calibration-draw lottery, ruled and implemented

Task 9's Important 7 registered that a single calibration draw makes every `p` in a run share one
reference, so an endpoint carries across-draw spread that a single run cannot show. **Ruling,
implemented here rather than deferred again:** the spread is disclosed and the draw is fingerprinted,
and the endpoint stays a single-draw endpoint.

- **Disclosed, with provenance** (Task 11b's own 9-draw probe, `task-11b-report.md:222-235`, run
  against the *lattice* scheme and therefore describing the lattice's spread, not the corrected one):
  `P(p <= 0.05)` across the registered draw plus 8 independently-seeded draws read
  `0.10017 / 0.08837 / 0.09733 / 0.09754 / 0.09104 / 0.08654 / 0.10737 / 0.09700 / 0.10304`, mean
  `0.09649`, spread `0.08654–0.10737`. Every draw was roughly `2×` nominal, which is how the run
  report established the effect was in the *scheme* and not the draw — the measurement that made C1
  findable. **The equivalent spread under the corrected scheme is NOT measured**, and the single-draw
  caveat therefore stands undischarged.
- **Registered caveat, binding on the rerun's report:** every `shape_block_conformal_bet` endpoint in
  the rerun is conditional on one held-out draw per cell/arm; the run reports one number, and the
  across-draw spread is unmeasured at the corrected scheme.
- **Implemented as an emission:** C1.8's `cal_fingerprint`, so a reader can tell whether two rows
  shared a reference and how extreme the draw was, without re-running anything.

### C1.8 I3 — `cal_fingerprint` registered on every `shape_block_conformal_bet` row

New emitted field, on all six K6 rows (four fault cells + arm 34 S2 + arm 34 S3), read straight off the
`ShapeCalibration` the row actually used — not re-derived:

```
cal_fingerprint: {
  W: 30, m: 333,
  kurtosis: { median, absdev_p50, absdev_p90, absdev_max },
  absSkew:  { median, absdev_p50, absdev_p90, absdev_max }
}
```

`absdev_*` are quantiles of the calibration's own ascending `sortedAbsDev` array under the registered
convention `q(p) = sortedAbsDev[round(p * (m - 1))]`, and `absdev_max` is its last element. This is the
K6 analogue of `point_tail_bet_e_value`'s already-registered `cal_median`/`cal_mad` (K4.4 provenance),
extended to a two-feature block calibration, and it is what makes C1's signature readable off a future
run directory instead of only off this amendment. Registered predicted values for the rerun
(recomputed this session under the corrected generator):

| cell | `kurtosis.median` | `k.absdev_p50` | `k.absdev_p90` | `k.absdev_max` | `absSkew.median` | `a.absdev_p50` | `a.absdev_p90` | `a.absdev_max` |
|---|---|---|---|---|---|---|---|---|
| 26 | 2.638979 | 0.376396 | 1.049984 | 3.560917 | 0.250198 | 0.154060 | 0.405068 | 1.035884 |
| 27 | 2.631062 | 0.327118 | 0.979450 | 2.991298 | 0.253978 | 0.149195 | 0.367313 | 1.012357 |
| 28 | 2.744525 | 0.409764 | 0.966277 | 3.178961 | 0.252180 | 0.158769 | 0.405196 | 0.926275 |
| 29 | 2.576336 | 0.353472 | 0.834166 | 4.386241 | 0.283840 | 0.163843 | 0.373426 | 1.160256 |
| 34 | 2.664436 | 0.342515 | 1.003665 | 5.341915 | 0.255445 | 0.162661 | 0.414810 | 1.551302 |

For the contrast the field exists to make visible, the same fingerprints under the lattice scheme —
`absdev_p90` on `kurtosis` reads `0.717098 / 0.708021 / 0.743996 / 0.923496 / 0.725049` for cells
26/27/28/29/34, i.e. `≈30%` compressed against the corrected values above, with `absdev_max`
compressed by more.

### C1.9 Corrections carried by this amendment, each naming its own target

- **I1 — the K6 wealth floor, reasoning restated (corrects Task 11b §5.3's framing).** The T2 finding
  is that `LOG_WEALTH_FLOOR_K6 = log(1e-12) = -27.6310` binds on 523 of 600 pairs (87.2%) at the
  20-window span. The protection is **not** the direction argument alone; it is a **measurement**:
  the maximum prefix log-wealth over all 600 pairs is `-0.3772`, against the bar
  `log(20) = 2.995732273553991`, so the closest pair finished **3.372932 nats short** (recomputed).
  Nothing came near the bar, floor or no floor. The direction argument is then a fortiori and is
  stated in that order: the floor clamps wealth from **below** while every endpoint in this study is
  an **upper**-bar crossing, so removing the floor could only move trajectories further from firing —
  a floor-free run has at most the observed crossings, and the observed count is zero. The floor
  cannot manufacture the clean T2 validity reading; the 3.37-nat margin is what rules that out
  directly.
- **I5 — the K4 card's guarantee sentence contradicts its own `exchangeability_note`.**
  `validation/certification/cards/point_tail_bet_e_value.json` asserts super-uniformity
  "(distribution-free, **exact**)" in `guarantee.sentence` while `guarantee.regime.exchangeability_note`
  records the opposite: "O(1/n)-approximate, anti-conservative, under this construction's self-fit
  median/MAD held-out calibration (K4.1.10) — not the exact identity the module docstring and design
  page state". The sentence is qualified to match the note, and
  `detectors/point-tail-bet-e-value.ts`'s module docstring is corrected the same way. The card is
  re-frozen by identity (`tools/freeze-cards.mjs`); **no stage status, tier, or verdict moves** — this
  is the claim text agreeing with its own regime field, K4.1.10's defect remains carried on the card,
  unresolved.
- **`verdict.mjs` tie-break rendering.** `blockedLine` (`verdict.mjs:240-244`) reports one detector for
  a NO row; when several detectors tie at the same `(status, canonical rate)` — as all three K6
  detectors did at `0.0005`, which Task 11b recorded as an unexplained-looking deviation — the
  lexicographic winner was rendered and the tie was invisible. The line now names **every** tied
  detector. **Future runs only**: committed `COVERAGE.md` files are not rewritten.
- **Module domain guards (no behaviour change on any registered path).**
  `spectral_bet_e_process`'s `sigma > 0` check (`detectors/spectral-bet-e-process.ts:96-98`) admits
  `Infinity`, which yields `U = 0`, `p = 1`, `e = kappa` on every bin — a silent, wrong, finite
  answer; it now requires a finite `sigma`. All three K3/K4/K6 modules take `kappa` as a defaulted
  parameter and none validated it, while each module's own validity argument holds only for
  `kappa in (0, 1)` (`integral_0^1 kappa*p^(kappa-1) dp = 1`); each now throws outside that open
  interval. Registered `kappa = 0.1` and `sigma = 1` are unaffected, and no emitted number changes.
- **`npm run cert:validate-cards` and `npm run cert:expiry` wrappers**, with the card-schema
  validation added to CI as a gating step. Expiry stays reported-not-gating for the reason already in
  `.github/workflows/ci.yml` (family_E's card pins a file in a sibling repo a CI runner does not check
  out).

### C1.10 The withdrawn `1/20000` probe — the reviewer's reading, recorded as a hypothesis and nothing more

Amendment v2.K6.2's summary WITHDREW a disclosed pre-run measurement (`1/20000, 1/20000, 0/20000`) as
"its construction unidentifiable, no evidential weight", after the Task-11a smoke read `≈1.0` at
`d = 2.0`. The review's hypothesis is that the withdrawn probe was **right**, and differed from the
harness in exactly the way C1 names: it drew its reference from a continuous stream, so it saw the
real, non-crossing `d = 2.0` behaviour that the corrected rerun is predicted to reproduce.

**Recorded as a hypothesis, with the arithmetic that neither confirms nor dismisses it.** Consistent:
both readings sit in the same regime, `INERT` at every floor this study uses. Not consistent:
`1/20000 = 0.00005` against the corrected prediction `0.0045` (`90/20000`) is a factor of `90`, so the
two are not the same measurement. **The probe stays withdrawn** — its construction is still
unidentifiable, and an unidentifiable construction that happens to land in the right regime is not
evidence. This paragraph exists so that if the probe's provenance is ever recovered, the question is
already on the record with its numbers.

### C1.11 The `p_uniformity` adjudication, corrected per endpoint (supersedes Task 11b §deviation (a)'s direction claim)

**Quote and correct.** Task 11b's run report concluded: "Direction is toward refutation, so the
not-refuted T1 reading is conservative and no endpoint moves." The first clause is true of the
validity endpoints and **false of the power endpoints**, which is where the verdict actually lived. A
compressed reference inflates *every* rank, so it inflates false alarms and power together; there is no
single direction to report, and the study's own ledger carried the wrong one.

| endpoint | lattice | corrected | lattice's direction | verdict effect |
|---|---|---|---|---|
| K6 arm 34 S2 `crossing_rate` (validity) | 0.0110 | 0.0000 | **conservative** — false alarms inflated, so `not-refuted` was harder to earn | none (not-refuted both) |
| K6 arm 34 S2 `p_uniformity P(p<=0.05)` (descriptive) | 0.10017 | 0.050167 | **conservative** in the same sense | none (no verdict authority) |
| K6 arm 34 S3 `detection_rate` (power) | 1.0000 | 0.0005 | **ANTI-CONSERVATIVE** — power manufactured out of the reference | **S3 POWERED -> INERT; card USE -> ADVISORY** |
| K6 cell 28 `mix-d2.0` (power) | 1.0000 | 0.0045 | **ANTI-CONSERVATIVE** | cell POWERED -> INERT |
| K6 cells 26 / 27 / 29 (power) | 0.0035 / 0.0005 / 0.0000 | 0.0010 / 0.0000 / 0.0000 | anti-conservative, immaterial | none |
| K4 arm 32 S2 `exceedance` (validity) | 0.00253 | 0.001855 | **conservative** | none |
| K4 arm 31 S2 `exceedance` / `mean_e` (validity) | 0.0280 / 3.1160 | 0.0455 / 4.1760 | **ANTI-CONSERVATIVE** — false alarms *understated* | none (REFUSE both) |
| K4 `point_tail` cell 18 (power) | 0.5055 | 0.4870 | **ANTI-CONSERVATIVE** | cell POWERED -> INERT |
| K4 `point_tail` cell 19 canonical (power) | 0.9750 | 0.9780 | **conservative** — power *understated* | none (POWERED both) |
| K4 `family_E` cells 19 / 20 / 21 (power) | 0.0430 / 0.0520 / 0.1340 | 0.0360 / 0.0450 / 0.1155 | anti-conservative | none |
| K4 `family_E` cell 18 (power) | 0.0445 | 0.0765 | conservative | none |

**The rule this replaces the single-direction claim with:** a reference-distribution defect has no
global sign. Its sign is a property of the endpoint — validity endpoints and power endpoints move the
same way in the *statistic* and opposite ways in the *conclusion*. The `family_E` arm-31 row is the
counterexample that kills even the weaker "conservative on validity" version: there the lattice
understated the false-alarm rate.

### C1.12 Golden expectation, corrected, and the registered class-answer table

**Registered expected golden delta, ONE row:**
`shape_block_conformal_bet`: `USE -> ADVISORY`, tier `T1 -> T1` (unchanged: `minTier` of the supporting
S2 evidence, `score.mjs:567`), `s1 MISSING` (unchanged), `s2 PASS` (unchanged), **`s3 PASS -> INERT`**,
`s4 PASS` (unchanged). Mechanism: arm 34's single S3 cell falls below `INERTNESS_FLOOR = 0.10`, so
`scoreS3`'s status becomes `INERT` (`score.mjs:342-343`) and `s3Powered` is empty, which is
`overallVerdict`'s valid-but-inert `ADVISORY` (`score.mjs:566-570`).

**Registered expected golden non-deltas:** all thirteen other rows unchanged, including
`point_tail_bet_e_value` `USE`/T1 and `family_E_conformal_heldout` `REFUSE`. **Registered expected
class answers, unchanged:** K1 NO, K2 YES, K3 YES (0.654), K4 YES (`point_tail_bet_e_value`, 0.9780),
K5 NO, K6 NO. Any other golden movement is a **surprise to report, not to absorb**.

### Amendment summary

Names, as a code defect under §11 house rule 7, that `heldoutRows`
(`validation/coverage/harness/run-battery.mjs:503-511`) drew each held-out row as the FIRST gaussian of
its own arithmetically-spaced LCG stream, making the 10,000-row "sample" a rank-1 Kronecker lattice
with direction vector `(a*7919, a^2*7919) mod 2^32 = (296471587, 1215975367)`, both coprime to `2^32`:
marginals better than iid (mean `0.000200`, sd `0.999968`, kurtosis `2.989619`), joint deterministic
and seed-invariant (`acf(2) = -0.7514 ± 0.0006` across eight unrelated seeds, a `≈75σ` departure that
does not move with the seed), and within-block moment spread compressed `≈30%` (block-kurtosis sd
`0.479–0.497` vs `0.621–0.796`). Registers the corrected generator — one continuous LCG stream per
held-out draw, `gaussFrom` applied serially, the `drawFor` AR(1) chain running on that continuous
stream so `phi` is real — with `HELDOUT_SEED` and `HELDOUT_ROWS` unchanged, plus a registered runtime
`acf` guard (`|acf(1)|,|acf(2)| <= 0.10` at `phi = 0`; `|acf(1)-phi|,|acf(2)-phi^2| <= 0.10` at
`phi > 0`; a `10σ` bound that the old scheme fails on both cell types) so a regression cannot produce a
run at all. Registers C3: the `-ar1` held-out rows (cells 21, 29) carried NO serial structure
(`acf(1) = 0.2687` vs `phi = 0.600`, `acf(2) = -0.3155` vs `phi^2 = 0.360`), so those two rows as run
are re-registered out-of-claim mismatched-`phi`, quote-and-correcting the matched-process text; the
corrected stream measures `0.5946/0.3500` and `0.5957/0.3616`. Discloses, with provenance and a
validation that reproduces all thirty committed T1 endpoints exactly under the old scheme, the
counterfactual measurements behind every prediction here: K6 grid `0.0035/0.0005/1.0000/0.0000 ->
0.0010/0.0000/0.0045/0.0000`, arm 34 S2 `0.0110 -> 0.0000` and S3 `1.0000 -> 0.0005`, K4 canonical
`0.9750 -> 0.9780` (robust), K4 grid cell 18 `0.5055 -> 0.4870` (a `0.50`-floor crossing, POWERED ->
INERT, grid-only), arm 31 S2 `0.0280/3.1160 -> 0.0455/4.1760`. Corrects the expected K6 card tuple back
to S1 MISSING / S2 PASS / **S3 INERT** / S4 PASS -> **ADVISORY**, the verdict v2.K6/K6.1 registered
from a derivation and v2.K6.2 overturned on a lattice-driven smoke — v2.K6.2's `s = 0` premise is kept,
its POWERED conclusion withdrawn. Registers the two reruns (K6 T1, then K4 T1), T2's exemption with its
reason (per-shard prefixes, `heldoutRows` never called), K3's non-involvement (oracle `sigma`, no
held-out stream), and a manifest-declared `supersedes` mechanism with the exact `(study, run, detector)`
rows it drops — without which a preserved prior run keeps the old POWERED S3 row in the corpus and the
rerun changes nothing. Implements I2 as a registered emission plus a binding single-draw caveat with the
9-draw lattice spread disclosed (`0.08654–0.10737`, mean `0.09649`; the corrected-scheme spread is
UNMEASURED), and I3 as `cal_fingerprint` on every K6 row with its predicted values tabulated. Restates
I1 with the measurement first (closest T2 pair finished `3.372932` nats short of `log(20)`) and the
a-fortiori direction second. Fixes I5 by qualifying the K4 card's guarantee sentence to match its own
`exchangeability_note` (identity re-freeze, no verdict moves) and corrects the module docstring the
same way. Adds the `verdict.mjs` all-tied-detectors rendering (future runs only), a finite-`sigma`
guard, `kappa in (0,1)` guards in all three modules, and the two npm card wrappers with CI. Records the
review's hypothesis about the withdrawn `1/20000` probe as a hypothesis, with the factor-of-90 gap that
prevents confirming it. Corrects, endpoint by endpoint, the run report's "refutation-direction only"
adjudication: the lattice was conservative on the K6/K4-point-tail validity endpoints and
**anti-conservative on the power endpoints and on `family_E`'s arm-31 validity endpoint** — a
reference-distribution defect has no global sign. **The K6 class answer is unchanged (NO, a fortiori:
canonical `0.0005 -> 0.0000`), the K4 class answer is unchanged (YES, `0.9780`), the K3 class answer is
untouched, and no floor, seed, window partition, stop condition, or decision rule in §1-14 or any
earlier amendment moves. One expected golden delta: `shape_block_conformal_bet` USE -> ADVISORY. The
residual `p_uniformity` KS rejection under the corrected scheme (`0.0229 > 0.0088`) is registered as
expected and unexplained, carrying no verdict, filed for the write-back rather than resolved here.**

## Amendment v2.C1.1 — 2026-08-08, a second finding: `supersedes` already existed and nothing read it

Registered before the C1 code fix lands and before either rerun. **Lead with the correction to
C1.6:** C1.6 registered a manifest-declared `supersedes` mechanism as if it were new. It is not.
The field name, and a working declaration in it, have been in this repo's evidence corpus since
2026-08-01 — and the certification scorer has never read it.

### C1.1.1 What is there, verbatim

`validation/h0-battery/results/live/run-20260801T064237Z/manifest.json` and
`.../run-20260801T064627Z/manifest.json` each carry:

```json
"supersedes": {
  "priorRun": "run-20260801T062824Z",
  "defect": "oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1)
             pre-whitening disabled; ... The prior runs measure detectors unaware of phi, not the
             registered oracle-parameter cell"
}
```

That is house rule 7 applied correctly and in good faith: a named code defect, a rerun, the prior
run preserved with a declaration attached. **`validation/certification/lib/collect.mjs` never
looked at the field.** Measured this session against the real corpus: `run-20260801T062824Z`
contributes **148 cells** to every certification run — 144 from its `endpoints.json` plus 4 more
that `scanCellsDirExtras` merges from its `cells/` directory — across
`family_A_betting_e_process`, `family_A_mixture_supermartingale`, `family_C_safe_hotelling` and
`family_D_spectral_e_detector`, 36 each in the aggregate. Those cells have been scored alongside
their own correction in every certification run since, including `run-20260808T122216Z`, the
official re-score this branch's K6 phase produced.

### C1.1.2 What this amendment does about it: reports, does not resolve

**Registered decision: the legacy shape is RECOGNIZED and REPORTED, and NOT acted on.** Three
reasons, in order of weight:

1. **Acting on it would move card verdicts that this branch's registered scope does not cover.**
   The four affected cards are `family_A_betting_e_process` (REFUSE), `family_A_mixture_supermartingale`
   (REFUSE), `family_C_safe_hotelling` (NOT_EXECUTABLE) and `family_D_spectral_e_detector` (REFUSE).
   Dropping 148 cells could move any of them, and none of that is C1's defect or this study's
   evidence.
2. **The authority is the wrong study's.** The declaration lives in `h0-battery`'s artifacts, so
   the amendment that honours it belongs in `h0-battery`'s own pre-registration, not in
   `coverage`'s. A coverage amendment that silently re-scored four unrelated cards would be
   exactly the boundary violation house rule 7 exists to prevent.
3. **It is a week old and nobody noticed, which is the finding.** The value here is the
   disclosure, not the fix.

**Implemented, therefore:** `collect.mjs` accepts the legacy `{priorRun, defect}` object, records
it as an unhonoured declaration, and the certification `REPORT.md` carries a section headed
**"Declared superseded but STILL SCORED"** naming the run, the declaring runs, and the stated
defect verbatim. `report_format` goes `3 -> 4`. A `supersedes` value that is neither the legacy
object nor C1.6's array is a crash, not a silently ignored field.

### C1.1.3 C1.6, corrected in place by supersession, not by deletion

C1.6's array shape stands exactly as registered — `[{ study, run, detectors, reason }]` — and it
is now explicitly an **extension of an existing field**, not a new one. What is corrected is
C1.6's framing ("Registered mechanism, added before the reruns"), which implied novelty it did not
have. The extension earns its keep on two counts the legacy shape does not cover, and both are the
reason C1 could not simply reuse it:

- **Per-detector granularity.** `coverage/run-20260808T010208Z` holds
  `family_E_conformal_heldout` rows that DO calibrate on the defective substrate alongside
  `safe_t`, `universal_inference`, `group_average_e_value` and `family_D_spectral_e_detector` rows
  across five other classes that take no held-out calibration and are bit-identical under the fix.
  A whole-run declaration would delete four classes of sound evidence to correct one detector's
  rows.
- **Cross-study addressing.** `{study, run}` rather than a bare `priorRun`, so a locator is
  unambiguous when the same run stamp exists under two studies.

### C1.1.4 Write-back obligation, named

For the wiki write-back, as a finding and not a resolved item: **the certification protocol had no
supersession mechanism, and one existed in its data that it ignored.** A run declaring itself
defective is the strongest evidence there is that its numbers should not be cited, and the scorer
treated it as prose. The h0-battery amendment that honours the 2026-08-01 declarations, and the
re-score that follows it, are named-not-done work. Until then every certification `REPORT.md`
carries the disclosure and every reader of those four cards has it in front of them.

### Amendment summary

Corrects C1.6's claim of novelty: `supersedes` is a pre-existing manifest field
(`h0-battery/run-20260801T064237Z` and `run-20260801T064627Z`, since 2026-08-01) declaring
`run-20260801T062824Z` superseded for a named code defect — oracle `phi` never threaded into the
detector config, so N3/N4 ran with AR(1) pre-whitening disabled — which
`validation/certification/lib/collect.mjs` never read, so that run's **148 measured cells** across
four cards have been scored alongside their own correction in every certification run since,
including this branch's own `run-20260808T122216Z`. Registers the decision NOT to act on it here:
honouring it could move four cards' verdicts outside coverage's registered scope, and the
authorizing amendment belongs to `h0-battery`'s pre-registration. Registers what IS done: the
legacy `{priorRun, defect}` shape is recognized, recorded, and disclosed in every certification
`REPORT.md` under "Declared superseded but STILL SCORED", naming the run and the stated defect
verbatim; `report_format` `3 -> 4`; an unrecognized `supersedes` value is a crash rather than a
silently ignored field. C1.6's array shape stands unchanged and is reframed as an extension of the
existing field, earning per-detector granularity (needed because `coverage/run-20260808T010208Z`
mixes defective `family_E_conformal_heldout` rows with five classes of sound rows) and
cross-study addressing. **No endpoint, floor, seed, or verdict moves as a result of this
amendment; one disclosure section is added to a report that previously carried none.**

## Amendment v2.C1.2 — 2026-08-08, three transcription corrections to v2.C1 and v2.C1.1

Registered after the two reruns and the certification re-score, and it moves **no** endpoint, floor,
seed, prediction, or verdict. All three items are wrong numbers or wrong words in this wave's own
amendment text, corrected by quote-and-correct per rule 7. Every corrected figure was recomputed
this session against the committed artifacts named beside it.

### C1.2.1 C1.12's expected class-answer list says `K1 NO`. K1 is YES, and always was.

**Quote, C1.12 (`PREREGISTRATION.md:3592`):**

> **Registered expected class answers, unchanged:** K1 NO, K2 YES, K3 YES (0.654), K4 YES
> (`point_tail_bet_e_value`, 0.9780), K5 NO, K6 NO.

**Correct: `K1 YES`.** Verified in both certification runs that bracket this wave —
`validation/certification/results/run-20260808T122216Z/COVERAGE.md` (before the reruns) and
`run-20260808T133943Z/COVERAGE.md` (after) — each reading, character for character:

```
| K1 | YES | safe_t_e_value, universal_inference_e_value | T1 | 1, 0.9875 |
```

carried by `safe_t_e_value` at `detection_rate 1.0000` and `universal_inference_e_value` at
`0.9875` on canonical cell 1 (`1.5sigma`), both far above `COVERAGE_FLOOR = 0.50`, tier T1. The rest
of C1.12's list is correct as registered.

**The error contradicted this same wave's own golden-table comment**, which was written from the
run and reads "Class answers unchanged: K1 YES, K2 YES, K3 YES 0.654, K4 YES
(point_tail_bet_e_value, canonical 0.9780), K5 NO, K6 NO"
(`validation/certification/test/golden-verdicts.test.mjs`, committed at `2638650`). So the wave
carried both the right list and the wrong one, one commit apart, and the machine-checked artifact
was the right one. Recorded that way rather than as a bare typo: the amendment text was the only
place the error lived, and nothing downstream of it consumed the wrong value — `coverageFor`
computes the K1 answer from evidence and never reads this document.

### C1.2.2 C1.4's own count, restated in the Amendment summary as `thirty` instead of `thirty-nine`

**Quote, the v2.C1 Amendment summary (`PREREGISTRATION.md:3613`):**

> Discloses, with provenance and a validation that reproduces all thirty committed T1 endpoints
> exactly under the old scheme, ...

**Correct: `thirty-nine`.** C1.4 enumerates the endpoints it cross-checked and the figure there is
thirty-nine; the summary's `thirty` disagrees with the section it is summarizing. The enumeration
stands: 10 K6 endpoints (four grid `detection_rate`s, arm 34's `k`, `crossing_rate`,
`increment_estimator.mean`, `p_uniformity.ks_statistic`, first decile count, and S3
`detection_rate`) plus 29 K4 endpoints (four `point_tail` grid rates with all four `cal_median` and
all four `cal_mad`, four `family_E` grid rates with all four
`indicator_rate_at_injected_tick`, arm 31's `exceedance`/`mean_e`/`lower_95`/S3, and arm 32's
`k`/`exceedance`/`mean_e`/`lower_95`/S3). C1.4's own "not cross-checked" list is unchanged and still
binding: `final_wealth_mean`/`final_wealth_median`, `p_uniformity.decile_counts` beyond the first
decile, and `window_crossing_rate`.

### C1.2.3 C1.1.1's per-detector count: 148 scored is 37 each, not 36

**Quote, C1.1.1 (`PREREGISTRATION.md:3667-3670`):**

> `run-20260801T062824Z` contributes **148 cells** to every certification run — 144 from its
> `endpoints.json` plus 4 more that `scanCellsDirExtras` merges from its `cells/` directory —
> across `family_A_betting_e_process`, `family_A_mixture_supermartingale`,
> `family_C_safe_hotelling` and `family_D_spectral_e_detector`, 36 each in the aggregate.

The `148` and the `144 + 4` split are correct. **"36 each" is the aggregate's per-detector count and
was placed where the scored total belongs**, so the sentence's own two halves do not reconcile:
`36 x 4 = 144`, not 148. Correct, stating both counts explicitly rather than one:

> **148 cells scored, 37 per detector** across the four cards — of which 144 (**36 per detector**)
> come from `endpoints.json` and 4 (**one per detector**) are merged from `cells/` by
> `scanCellsDirExtras`.

Recomputed this session by loading the real corpus through
`validation/certification/lib/collect.mjs`: total 148, and
`family_A_betting_e_process=37  family_A_mixture_supermartingale=37  family_C_safe_hotelling=37
family_D_spectral_e_detector=37`. The same slip is corrected in the two code comments that carried
it (`collect.mjs`'s supersession docstring, `verdict.mjs`'s `unhonouredLines` comment) in the
commit that follows this amendment.

**C1.1.2's registered decision is unaffected**: the count was never the reason for it. The
declaration stays recognized, reported and NOT acted on, and the write-back obligation in C1.1.4
stands as registered.

### Amendment summary

Three transcription corrections to this wave's own amendment text, no endpoint or verdict touched.
C1.12's expected class-answer list said `K1 NO`; K1 is **YES**, carried by `safe_t_e_value` (1.0000)
and `universal_inference_e_value` (0.9875) at canonical cell 1 in **both** bracketing certification
runs — and the same wave's golden-table comment, written from the run one commit later, already said
K1 YES, so the document carried both readings and the machine-checked one was right (C1.2.1). The
v2.C1 Amendment summary said the disclosed refuter reproduced `thirty` committed T1 endpoints where
C1.4 enumerates **thirty-nine**; the enumeration is restated (10 K6 + 29 K4) and C1.4's
"not cross-checked" list is unchanged and still binding (C1.2.2). C1.1.1 gave the superseded
h0-battery run's per-detector count as 36 where 148 scored is **37 each**; corrected to state both
counts — 148 scored / 37 per detector, of which 144 / 36 per detector from `endpoints.json` and 4 /
one per detector merged from `cells/` — recomputed by loading the real corpus through
`collect.mjs`, with the same slip fixed in the two code comments that carried it (C1.2.3).
**C1.1.2's ruling that the legacy declaration is reported and not acted on is unaffected, and
C1.1.4's write-back obligation stands as registered.**

## Amendment v2.K6E — 2026-08-08, the design gate for `shape_ecdf_conformal_bet`, before any artifact

Registered before any artifact of the second registered K6 attempt exists: no detector module, no
card, no adapter, no run. Authority, per this document's own precedence rule:
`~/concord/knowledge/methodology/pages/k6-ecdf-successor.md` (RATIFIED 2026-08-08, the binding
construction) — then this document — then
`docs/superpowers/plans/2026-08-08-k6-ecdf-successor.md`. Sections 1–14 and every earlier amendment
stay intact; this amendment adds, and moves no endpoint, floor, seed or verdict belonging to
`shape_block_conformal_bet` or to any other candidate.

**What this amendment is for.** The design page requires a *design gate*: the growth criterion
`E[log eAvg]` at the canonical K6 cell, computed for this feature before anything is built, with
three outcomes registered in advance (page §"The design gate"). This amendment computes it,
registers the computation verbatim, states the verdict, and registers every endpoint the runs
would read. **The gate result is outcome 3 of the three registered outcomes — positive but
marginal — and the canonical-detection prediction it implies is `0.0000`, structurally rather than
statistically.** K6E.5 and K6E.6 state that in full, including what it does and does not refute.

### K6E.1 Registered constants, with the arithmetic shown

| constant | value | origin |
|---|---|---|
| held-out stream | the corrected post-C1 continuous-stream draw, `n = 10,000` rows per metric | `run-battery.mjs:585-599`, Amendment v2.C1 C1.2 (supersedes the `seed(j)` form) |
| reference segment A | held-out ticks 1–4,000 → `n_A = 4,000`, fixed reference ECDF `F̂_A` | design page §Construction |
| block segment B | held-out ticks 4,001–10,000, cut into contiguous disjoint blocks of `W` | design page §Construction |
| `W` | **30** | design page; identical to `W_K6` (K6.1), so the successor is measured at the predecessor's geometry |
| `m` (T1) | **200** — `(10000 - 4000)/30 = 200` exactly, **no remainder dropped** | arithmetic here; `200 >= M_MIN_K6 = 100` (K6.1) with margin |
| `m` (T2) | **200** — `9000 = 3000 + 200*30`, K6E.10 | arithmetic here |
| `κ*` | **0.9126** | derived at K6E.4, frozen here, derivation quoted |
| live windows, T1 | **6** disjoint `W=30` windows over `[100,280)`, `t=280..299` unused | K6.10, reused unchanged |
| live windows, T2 | **20** disjoint `W=30` windows over the final 600 of 9,600 ticks | K6.12, reused unchanged |
| decisive endpoint | wealth `>= 20` (`log >= log 20 ≈ 2.99573`) at any window checkpoint | K6.10, unchanged |
| `α` | 0.05 (§3); `COVERAGE_FLOOR = 0.50`; `INERTNESS_FLOOR = 0.10` | `constants.mjs:56`, `:20` |

**The `m` figures do not agree with the predecessor's, and that is by construction, not drift.**
`shape_block_conformal_bet` blocks the *whole* 10,000-row stream (`m = 333`, K6.3); the successor
spends the first 4,000 rows on the reference ECDF and blocks only the remaining 6,000 (`m = 200`).
Both exceed `M_MIN_K6 = 100`. Nothing in K6.1–K6.16 moves: `m = 333` remains the predecessor's
registered value on its own cells.

**Difference from the predecessor that the gate exists to test, stated so it cannot be lost:** the
feature is the only thing that changes. Same stream, same `W`, same cells, same seeds, same
endpoint, same 6-window accounting. A comparison across any other difference would mean nothing
(design page §"What this page does not claim").

### K6E.2 The feature, frozen exactly

The design page states the form and delegates the exact discrete convention to this amendment
("exact form frozen in the amendment"). **Frozen, with the convention named at every point it could
be read two ways:**

```
Fhat_A(x) = (1/n_A) * #{a in A : a <= x}                      right-continuous ECDF of segment A, n_A = 4000
x_(1) <= ... <= x_(W)                                         the live window's ascending order statistics
T(w)      = SUM_{i=1..W} ( i/W - Fhat_A(x_(i)) )^2            i/W, the right-continuous ECDF of the window
                                                              at its own i-th order statistic
```

`T(w)` is `W` times the Cramér–von-Mises criterion `∫ (F̂_w − F̂_A)² dF̂_w` with the window's own
ECDF as the integrating measure — the two-sample-against-fixed-reference form, standard reference
Anderson (1962), *On the distribution of the two-sample Cramér–von Mises criterion*, Ann. Math.
Statist. 33(3). **Three deliberate departures from Anderson's statistic, each stated with why it
cannot matter here:** no `nm/(n+m)²` normalization, no pooled-sample integrating measure, and no
`1/(12W)`-type centering term. All three are strictly monotone or additive-constant
transformations of the same quantity across the objects being compared, and **the only use made of
`T` is its rank among the `m+1` exchangeable values `{T(B_1) … T(B_m), T(live)}`** (K6E.3), which
no such transformation changes. The convention `i/W` rather than the midpoint `(2i−1)/(2W)` *is*
a real choice, since the difference is not additive; it is registered because the design page's own
formula states `F̂_w(x_(i))`, and its consequence is measured and disclosed at K6E.4 (the midpoint
variant reads `E[log p|alt] = −1.10281 ± 0.00432` against the registered form's
`−1.09715 ± 0.00420`, a 1.3-SE difference that moves no verdict — the form was not chosen by
outcome).

**Single feature, so no cross-feature averaging** (design page §Construction): `eAvg ≡ e` for this
candidate, and the K6.2 "never max" argument has nothing to apply to. Every `eAvg` in this
amendment is a single feature's `e`.

**Why the K4 self-fit defect (C47) has no analogue** (design page, restated here as the tag this
card will carry): `F̂_A` is fitted on A alone, and every ranked object — the `m` B-blocks and the
live window — is drawn from `B ∪ live`, disjoint from A. Nothing is ranked against a reference
fitted on itself. The rank identity is exact, not `O(1/n_A)`.

### K6E.3 The block-conformal `p`, and its exact null law (closed form)

```
p = (1 + #{ j : T(B_j) >= T(live) }) / (m + 1)                 tie-inclusive >=, K6.2's validity-bearing rule
e = kappa * p^(kappa - 1),  kappa in (0,1)
log wealth after t windows = SUM_{w<=t} log e_w = t*log kappa + (1 - kappa) * S_t,
                                                  S_t = SUM_{w<=t} ( -log p_w )
```

Conditional on A, `T(B_1) … T(B_m)` and `T(live)` are i.i.d. under the registered null (each is the
same functional of 30 draws from the same stationary law, against the same fixed `F̂_A`), hence
exchangeable, hence **`p` is exactly uniform on the `m+1` point grid `{1/(m+1), …, 1}`** — not
merely super-uniform. At `m = 200` that grid has 201 points and the following closed forms hold
exactly (all re-derived here, node-verified, reproducible with a calculator):

```
E[p | null]     = (m+2) / (2(m+1))                                  = 0.502488
P(p <= 0.05)    = floor(0.05*(m+1)) / (m+1) = 10/201                = 0.049751      (K6.1.2's rule, at m=200)
E[log p | null] = ( log((m+1)!) - (m+1)*log(m+1) ) / (m+1)           = -0.982234
E[e | null]     = kappa * (m+1)^(-kappa) * SUM_{k=1..m+1} k^(kappa-1)
```

| `kappa` | exact `E[e \| null]` at `m=200` | gap below the continuous identity's 1 |
|---|---|---|
| 0.05 | 0.255044 | 0.744956 |
| 0.1 | 0.445371 | 0.554629 |
| 0.2 | 0.693218 | 0.306782 |
| 0.3 | 0.830939 | 0.169061 |
| 0.5 | 0.949741 | 0.050259 |
| 0.7 | 0.986278 | 0.013722 |
| **0.9126 (`κ*`)** | **0.998021** | **0.001979** |

**`E[e | null] < 1` strictly, at every `κ`, and the gap is `O(m^(-κ))`, not `O(1/m)`** — by
Euler–Maclaurin, `E[e|null] = 1 + κ/(2m) + κ*ζ(1-κ)*(m+1)^(-κ) + …`, and `ζ(1-κ) < 0` for
`κ ∈ (0,1)`, so the dominant correction is negative and of order `m^(-κ)`. This is the conservative
direction (validity is not at risk; it is strengthened), and it is the reason **this amendment does
not register a null `E[e] = 1` check.** The registered identity check is against the exact discrete
values in the table above; a construction whose measured null `E[e]` came out at 1.0 at `κ = 0.1`
and `m = 200` would be evidence that the `p` formula was **not** the registered rank. Measured
result: K6E.7(b). One consequence of the same arithmetic is filed as a correction to K6.11 at
K6E.15, rider 2.

### K6E.4 THE GATE — method, seeds, and the measured tables

**A disclosed probe on non-registered seeds** (this document's own DISCLOSED convention,
K6.4/K3.11). Two independent probes plus closed-form arithmetic. Scripts live outside the repo
(scratchpad `c46/gate-probe.mjs`, `cells-and-W.mjs`, `requirement.mjs`); every number below is
reproducible from what this section states, and the method is stated in full rather than referenced
to a file nobody can open.

**Generators.** `rng` (the Numerical-Recipes LCG) and `gaussFrom` copied verbatim from
`inject.mjs:14-24`; the AR(1) draw from `run-battery.mjs:302-308`; the alternative's per-tick draw
verbatim from `injectShapeMix` (`inject.mjs:60-70`), i.e. `z = (b ? +d/2 : -d/2) + w*s`,
`s = sqrt(max(0, 1 - d²/4))`, three raw uniforms per tick, **the registered generator, not a
re-derivation of it**. Held-out reference stream drawn as one continuously advanced stream, the
post-C1 form (`run-battery.mjs:593-596`).

**Seed provenance.** Probe 1 uses seeds `3.0e9 + {1000003, 7000019, 13000027}*rep`; probe 2 uses
`3.5e9 + {1000003, 17000041}*rep`. Every seed this study registers is `<= 1.0e8` — `CELL_SEED`
max `20260842`, trajectory seed max `20260841 + 7919*1999 = 36095122`, `+ 104729*k` for K2's
series salt, `HELDOUT_SEED = CELL_SEED + 500000`, and even the retired pre-C1 lattice form maxed at
`20760841 + 7919*9999 = 99942922`. **No registered seed, and no arithmetic derivation of one, can
reach `3.0e9`.** `CELL_SEED`/`HELDOUT_SEED`-derived values were not touched.

**Replicate counts.** Probe 1: `R = 400` independent held-out references × 100 six-window
trajectories per arm per reference = **240,000 live windows and 40,000 trajectories per arm**.
Probe 2: `R = 200` references × 100 trajectories per arm per cell = **120,000 windows per arm per
cell**. Standard errors are **cluster-robust over references** (the unit of independence is the
reference draw: the windows sharing one reference are dependent through it, the C1.7
calibration-draw lottery), computed as `sd(per-reference means)/sqrt(R)`.

**Table 1 — `E[log p]` at the canonical cell (`d = 1.5`, `W = 30`, `m = 200`, `n_A = 4000`).**

| arm | probe 1 (240,000 windows) | probe 2, independent seeds (120,000 windows) | exact null value |
|---|---|---|---|
| null (healthy) | `-0.98187 ± 0.00361` | `-0.98049 ± 0.00526` | `-0.982234` |
| canonical alt | `-1.09715 ± 0.00420` | `-1.09277 ± 0.00614` | — |

Inverse-variance pooling of the two canonical readings (`w = SE^-2`: `56689` and `26526`):
**`x ≡ -E[log p | alt] = 1.09576 ± 0.00347`**. Against the null value `0.982234`, the alternative is
informative **in direction** at `32.7` SE — the opposite of the predecessor's reading at the same
geometry (K6.7's anchor, K6E.7a).

**Table 2 — the `κ` sweep. `E[log e] = log κ + (1-κ)*(-E[log p])` exactly, so the sweep is an
identity in the two numbers of Table 1 rather than a separate simulation; SEs propagate as
`(1-κ)*SE`.** Measured mean `e` under the null is shown against the exact discrete value of
K6E.3 as the construction check.

| `κ` | `E[log e \| null]` | SE | `E[log e \| alt]` | SE | measured mean `e \| null` | exact `E[e \| null]` | max `log e` per window |
|---|---|---|---|---|---|---|---|
| 0.05 | -2.06296 | 0.00343 | -1.95344 | 0.00399 | 0.2547 | 0.2550 | 2.0424 |
| 0.1 | -1.41890 | 0.00325 | -1.31515 | 0.00378 | 0.4448 | 0.4454 | 2.4704 |
| 0.2 | -0.82394 | 0.00289 | -0.73172 | 0.00336 | 0.6924 | 0.6932 | 2.6332 |
| 0.3 | -0.51667 | 0.00253 | -0.43597 | 0.00294 | 0.8302 | 0.8309 | 2.5083 |
| 0.32 | -0.47176 | 0.00246 | -0.39337 | 0.00286 | 0.8493 | 0.8500 | 2.4668 |
| 0.35 | -0.41161 | 0.00235 | -0.33667 | 0.00273 | 0.8740 | 0.8747 | 2.3973 |
| 0.4 | -0.32717 | 0.00217 | -0.25800 | 0.00252 | 0.9067 | 0.9074 | 2.2657 |
| 0.5 | -0.20221 | 0.00181 | -0.14457 | 0.00210 | 0.9492 | 0.9497 | 1.9585 |
| 0.7 | -0.06211 | 0.00108 | -0.02753 | 0.00126 | 0.9860 | 0.9863 | 1.2343 |
| 0.8 | -0.02677 | 0.00072 | -0.00371 | 0.00084 | 0.9934 | 0.9936 | 0.8375 |
| 0.9 | -0.00717 | 0.00036 | **+0.00435** | 0.00042 | 0.9976 | 0.9976 | 0.4250 |
| **0.9126 (`κ*`)** | **-0.00563** | 0.00032 | **+0.00431** | 0.00030 | — | 0.9980 | **0.3721** |
| 0.95 | -0.00220 | 0.00018 | +0.00356 | 0.00021 | 0.9990 | 0.9990 | 0.2139 |
| 0.99 | -0.00023 | 0.00004 | +0.00092 | 0.00004 | 0.9998 | 0.9998 | 0.0430 |

**Table 3 — the optimizing `κ`, in closed form.** For a single feature the growth criterion is
exactly `g(κ) = log κ + (κ-1)*E[log p|alt]`, so `g'(κ) = 1/κ + E[log p|alt] = 0` gives

```
kappa*  = -1 / E[log p | alt] = 1/x = 1/1.09576 = 0.912608   ->  REGISTERED kappa* = 0.9126
g(kappa*) = x - 1 - log x     = 0.09576 - 0.091448 = 0.004312 nats/window
95% CI (from x's CI [1.08897, 1.10257]):  [0.003738, 0.004926] nats/window
```

Two structural facts about this criterion, registered because they decide how the three outcomes
are read at all:

- **`κ*` lies in `(0,1)` only if `x > 1`.** `g(κ) = x - 1 - log x > 0` whenever `x > 1`; if
  `x <= 1` then `g(κ) < 0` for **every** `κ ∈ (0,1)` and the construction is anti-informative at
  that cell with no calibrator able to rescue it. The gate's outcome 2 is therefore exactly the
  event `-E[log p|alt] <= 1`.
- **Under the null, `x_null = 0.982234 < 1`** (K6E.3, exact), so no `κ ∈ (0,1)` has positive growth
  under the null. The criterion is not vacuous, and the sweep's null column is a calibration check
  on the probe, not a finding.

`κ* = 0.9126` is **not** in the `{0.05 … 0.7}` band the plan's dispatch suggested sweeping, and it
is far above the predecessor's disclosed alternative-optimal `κ ≈ 0.32–0.4` (K6.5). That is a
consequence of the feature change, not a tuning choice: the predecessor's `κ ≈ 0.32–0.4` was
measured for a *two-feature average*, where the single-feature identity above does not apply.

**Table 4 — the `W` sensitivity, disclosed (probe 2, `m` held at 200 by extending the B segment to
`200*W` rows — a probe-only variation, registered as such, so `W` is isolated from `m`).** This
answers "what would have to change", and nothing in it is a registered endpoint.

| `W` | `E[log p \| alt]` | `x` | `κ*` | growth, nats/window | windows to reach `log 20` on drift alone |
|---|---|---|---|---|---|
| **30 (registered)** | `-1.09510 ± 0.00733` | 1.0951 | 0.9132 | **0.00425** | 705 |
| 60 | `-1.17269 ± 0.00809` | 1.1727 | 0.8527 | 0.01339 | 224 |
| 120 | `-1.34634 ± 0.01063` | 1.3463 | 0.7428 | **0.04895** | 62 |
| 240 | `-1.65049 ± 0.01474` | 1.6505 | 0.6059 | 0.14942 | 21 |
| 480 | `-2.17028 ± 0.02393` | 2.1703 | 0.4608 | 0.39542 | 8 |

The feature reaches the design page's own 0.05 nats/window marginality floor at `W ≈ 120` and needs
`≈ 62` windows at that `W` — `7,440` ticks — to reach `log 20` on drift. The registered battery
geometry (`T = 300`, `ONSET = 100`) provides 200 post-onset ticks.

### K6E.5 THE GATE VERDICT — outcome 3 of the three registered outcomes

Mapped against the design page's three registered outcomes, verbatim:

1. *"`E[log e] > 0` at canonical with the optimizing κ → freeze card, proceed to the runs."*
   The measured growth is **positive**: `+0.004312` nats/window at `κ* = 0.9126`, `95% CI
   [0.003738, 0.004926]`. Delta-method SE `0.00030` (`dg/dx = 1 - 1/x = 0.0874`), `t = 14.2`;
   equivalently, the sign of the growth is exactly the event `x > 1`, which holds at `27.6` SE.
   So outcome 1's condition holds.
2. *"`E[log e] <= 0` at canonical → the successor is refuted at design time."* **NOT the measured
   result.** `x = 1.09576 ± 0.00347 > 1` at `27.6` SE. **This amendment does not file a design-time
   refutation of the growth criterion, and does not claim one.** The design page's central
   mechanism claim — that a CvM-type statistic accumulates where a kurtosis statistic cancels — is
   **confirmed in sign** at the canonical geometry: the same probe reads the predecessor's feature
   as anti-informative (`E[log eAvg|alt] = -1.4132` against its own null `-1.3212`, K6E.7a) and
   this feature as informative (`E[log p|alt] = -1.0958` against the null's `-0.9822`).
3. *"Positive but marginal (< 0.05 nats/window) → proceed, with the expectation registered as
   NOT_POWERED-at-floor and the run treated as a measurement of the margin, not a likely YES."*
   `0.004312 < 0.05`, by a factor of **11.6**. **REGISTERED GATE VERDICT: OUTCOME 3.**

**Registered alongside it, because outcome 3's own wording understates what the numbers say.**
Outcome 3 anticipates a detector *near* the floor. The canonical-detection prediction this gate
produces is not near a floor: it is **exactly `0.0000`, structurally**, at the registered
6-window horizon and the registered `κ*` — the wealth process **cannot** reach 20, not "is
unlikely to". K6E.6 derives it. The design page's coverage rule ("K6 = YES iff card USE and
canonical detection `>= 0.50`") therefore has a determined answer before any run: **K6 stays NO**,
and it stays NO under *every* `κ ∈ (0,1)`, not only at `κ*` (K6E.6, Table 6). What outcome 3's
"measurement of the margin" buys is a measurement of `0.0000` against a prediction of `0.0000`.

### K6E.6 The canonical-detection prediction, derived from the crossing arithmetic

The endpoint is not the sign of `E[log e]`; it is `P(max_{t<=6} log wealth_t >= log 20)`
(K6.10). From K6E.3's identity, a crossing at window `t` is exactly the event

```
S_t >= c_t(kappa) = ( log 20 - t*log kappa ) / (1 - kappa),      S_t = SUM_{w<=t}( -log p_w )
```

and `S_t <= t*log(m+1) = t*5.30330` always, because `p >= 1/(m+1)`.

**At the registered `κ* = 0.9126`:**

```
per-window ceiling  = log kappa* + (1-kappa*)*log(m+1) = -0.091448 + 0.0874*5.303305 = 0.372061 nats
6-window ceiling    = 6 * 0.372061 = 2.232366    <    log 20 = 2.995732
windows needed for the ceiling to reach log 20   = ceil(2.995732 / 0.372061) = 9
```

**A crossing is impossible.** Even if every one of the six live windows returned the smallest
attainable `p = 1/201`, wealth reaches `e^2.2324 = 9.32 < 20`. Nine windows would be needed;
`[100,280)` provides six, and the whole post-onset span `[100,300)` cannot provide nine (`9*30 =
270 > 200`). **Registered prediction: canonical (`idx 27`) detection `= 0.0000` exactly, and the
same `0.0000` for every T1 cell and for the S3 arm, at `κ*`.** Measured, as a check on the
arithmetic rather than as its source: `0/40,000` trajectories at `κ*` in probe 1 and `0/20,000` in
probe 2, on every cell including `d = 2.0`.

**Table 5 — measured 6-window crossing across the whole `κ` grid (probe 1, 40,000 trajectories per
arm), disclosed so that no reader concludes another `κ` would have delivered the floor.**

| `κ` | 6-window ceiling | healthy crossing | canonical crossing |
|---|---|---|---|
| 0.05 | 12.2544 | 0.00028 | 0.00038 |
| 0.1 | 14.8223 | 0.00088 | 0.00208 |
| 0.2 | 15.7992 | 0.00375 | 0.00683 |
| 0.3 | 15.0500 | 0.00568 | 0.01110 |
| 0.35 | 14.3840 | 0.00622 | **0.01205** |
| 0.4 | 13.5942 | 0.00585 | **0.01205** |
| 0.5 | 11.7510 | 0.00410 | 0.00873 |
| 0.7 | 7.4059 | 0.00015 | 0.00070 |
| 0.8 | 5.0251 | 0.00003 | 0.00003 |
| **0.9126 (`κ*`)** | **2.2324** | **0.00000 (impossible)** | **0.00000 (impossible)** |
| 0.95 | 1.2832 | 0.00000 (impossible) | 0.00000 (impossible) |

The maximum canonical detection anywhere on the grid is **0.01205** at `κ ≈ 0.35–0.40`, **41×**
below `COVERAGE_FLOOR = 0.50`, against a healthy crossing of `0.00622` at the same `κ` — a
detector firing on 1.2% of faulty scenarios and 0.6% of healthy ones.

**Table 6 — the closed-form requirement, which bounds every `κ` at once.** Minimising `c_t(κ)`
over `κ ∈ (0,1)`:

| `t` | `min_κ c_t` | argmin `κ` | max attainable `S_t` | reachable? | required mean `-log p` per window |
|---|---|---|---|---|---|
| 1 | 5.7439 | 0.174 | 5.3033 | **no — impossible for every `κ`** | 5.7439 |
| 2 | 7.6890 | 0.260 | 10.6066 | yes | 3.8445 |
| 3 | 9.4323 | 0.318 | 15.9099 | yes | 3.1441 |
| 4 | 11.0661 | 0.362 | 21.2132 | yes | 2.7665 |
| 5 | 12.6282 | 0.396 | 26.5165 | yes | 2.5256 |
| 6 | 14.1386 | 0.425 | 31.8198 | yes | **2.3564** |

**Registered reading: a detection rate of `0.50` at the 6-window horizon requires the feature to
deliver a median `S_6` of at least `14.14` nats — about `2.36` nats per window — at some `κ`. This
feature delivers `1.0958` nats per window at the canonical cell. It is short by a factor of
`2.15`, and no choice of `κ` closes a gap in the statistic itself.** Per-window terms, the same
fact: `P(p <= 0.05)` at canonical measures `0.0626` against the null's `0.0498` — the whole ECDF
departure of the `d = 1.5` mixture at `W = 30` is worth about 1.3 percentage points of per-window
rejection rate.

### K6E.7 Sanity anchors

**(a) The predecessor's anti-informativeness, reproduced qualitatively AND quantitatively** —
the tie between this probe and the measured record. Same probe, same references, same alternative
draws; feature swapped for `shapeMoments`' `{kurtosis, absSkew}` with `m = 333` blocks over the
full 10,000 rows, distance-from-median rank, `κ = 0.1`, `eAvg` = mean of the two feature `e`s
(K6.2's construction, verbatim):

```
E[log eAvg | null] = -1.3212 +- 0.0027
E[log eAvg | alt ] = -1.4132 +- 0.0024        registered K6.4 Step 4: -1.414 +- 0.047
```

Both signs and the magnitude agree with the registered figure (`-1.4132` against `-1.414`, inside
K6.4's own SE by a factor of 20), and `E[log eAvg|alt] < E[log eAvg|null]` reproduces K6.4's
"anti-informative" reading directly: the mixture's own average payout is *worse* than a healthy
window's. **The probe reproduces the record it is being asked to extend.**

**(b) The null identity, checked against the exact discrete law rather than against 1.** Probe 1,
240,000 healthy windows:

```
mean p          measured 0.50221   exact 0.502488
P(p <= 0.05)    measured 0.04983   exact 0.049751
P(p = 1/201)    measured 0.00496   exact 0.004975
E[log p]        measured -0.98187 +- 0.00361   exact -0.982234
mean e          matches the exact E[e|null] column of Table 2 to within 0.0007 at every kappa
```

Every marginal matches its exact value; the construction and the `p` formula are right. **The
`E[e|null] = 1` form of this check is not applicable and is not registered** — see K6E.3: the exact
value is `0.998021` at `κ*` and `0.445371` at `κ = 0.1`, and a measured 1.0 would have indicated a
defect, not health. A `χ²` over the 201-point grid reads `689.8` on 200 df and is **reported as a
diagnostic with no test authority**: the 600 windows sharing a reference are dependent through it,
which inflates the statistic; the marginal rates above are the checks that hold under that
dependence.

**(c) The calibration-draw lottery, quantified (C1.7's caveat, made numerical for this feature).**
Between-reference `sd` of the per-reference mean `log p`: `0.0723` (null), `0.0840` (alt). Of 400
references, **50 (12.5%) have their own `x <= 1`** — for those held-out draws the feature is
anti-informative at canonical, and the registered run draws exactly one reference per cell.
Per-reference growth at that reference's own optimizing `κ`: median `0.0038`, p90 `0.0179`, max
`0.0631`; **1 of 400 references reaches the 0.05 nats/window floor.** Registered consequence: the
run's realized canonical reading is a draw from this spread, and `0.0000` detection is predicted
regardless, since the structural ceiling of K6E.6 does not depend on the reference at all.

### K6E.8 Per-cell and per-arm predictions (probe 2, 120,000 windows per cell)

| cell | `E[log p]` | `x` | own `κ*` | growth at own `κ*` | mean `p` | `P(p<=0.05)` | detection at `κ*=0.9126` |
|---|---|---|---|---|---|---|---|
| arm healthy (S2) | `-0.98049 ± 0.00526` | 0.9805 | none in (0,1) | `<= 0` | 0.5039 | 0.04879 | **0.0000** (impossible) |
| idx 26 `mix-d1.0` | `-0.98666 ± 0.00544` | 0.9867 | **none in (0,1)** | `<= 0` | 0.5017 | 0.04909 | **0.0000** |
| idx 27 `mix-d1.5` **canonical** | `-1.09277 ± 0.00614` | 1.0928 | 0.9151 | +0.00405 | 0.4689 | 0.06263 | **0.0000** |
| idx 28 `mix-d2.0` | `-4.90875 ± 0.02485` | 4.9088 | 0.2037 | **+2.3177** | 0.0084 | 1.00000 | **0.0000** |
| idx 29 `mix-d1.5-ar1` | `-0.44667 ± 0.00330` | 0.4467 | **none in (0,1)** | `<= 0` | 0.6887 | 0.00052 | **0.0000** |
| idx 29 healthy analogue (φ=0.6 both sides) | `-0.98819 ± 0.00518` | 0.9882 | none in (0,1) | `<= 0` | 0.5014 | 0.04975 | **0.0000** |

Three findings registered off this table:

- **`d = 1.0` is anti-informative** (`x = 0.9867 < 1`): no `κ ∈ (0,1)` gives positive growth. The
  informative direction at `d = 1.5` does not extend downward.
- **`d = 2.0` is strongly informative** (`x = 4.909`, mean `p = 0.0084`, `P(p<=0.05) = 1.000`) —
  and it is **not** evidence about shape sensitivity. At `d = 2.0`, `s = sqrt(1 - 4/4) = 0`
  exactly, so the injection is a pure two-point `±1σ` distribution, not an overlapping mixture:
  the boundary artifact K6.2.1/K6.2.3 already registered for the predecessor, confirmed here for a
  second, independent feature. An ECDF with two distinct values is far from a Gaussian reference for
  reasons that have nothing to do with the canonical geometry. **At the registered `κ*` even this
  cell reads `0.0000`**, because the ceiling of K6E.6 binds at every severity.
- **`idx 29` (`mix-d1.5-ar1`, φ=0.6) is strongly anti-informative** (`x = 0.4467`, mean
  `p = 0.6887`). Mechanism, registered: `injectShapeMix` **replaces** post-onset values with i.i.d.
  mixture draws (`inject.mjs:60-70`, §2), so on this cell the live windows are i.i.d. while the
  reference blocks are AR(1) φ=0.6, whose 30-tick ECDFs wobble far more (effective sample size
  `30(1-φ)/(1+φ) = 7.5`). The live `T` is therefore *smaller* than the reference blocks' typical
  `T`, and the one-sided upper-tail rank sends `p` toward 1. **This is a serial-structure mismatch
  created by the injection, not by the detector**, and the healthy-analogue row above shows validity
  is intact at matched φ=0.6 (`x = 0.9882`, `P(p<=0.05) = 0.04975`, exactly nominal). K6.11's
  matched-process regime holds; the `-ar1` **power** cell is out of the feature's reach for a reason
  the class's own injection creates.

### K6E.9 T1 cell and arm registration (extends §6/§7, mirrors K6.6/K6.7/K6.9)

`shape_ecdf_conformal_bet` joins §7 as a new row, **K6 only**, scored on the class's four
registered fault cells with §6's `CELL_SEED`s and K6.6's `HELDOUT_SEED`s **unchanged** (§6's
paired-comparison convention, extended to a fifth candidate; the successor must see the identical
trajectories the predecessor saw or the comparison means nothing):

| idx | severity | φ | `CELL_SEED` | `HELDOUT_SEED` |
|---|---|---|---|---|
| 26 | `mix-d1.0` | 0 | 20260833 | 20760833 |
| 27 | `mix-d1.5` (canonical) | 0 | 20260834 | 20760834 |
| 28 | `mix-d2.0` | 0 | 20260835 | 20760835 |
| 29 | `mix-d1.5-ar1` | 0.6 | 20260836 | 20760836 |

**New arm cell, continuing the index sequence past the predecessor's arm (idx 34) and past
`K6_T2_SCENARIO_SEED` (idx 35, K6.12):**

| cell | arm | `CELL_SEED = BASE_SEED + idx` | `HELDOUT_SEED = CELL_SEED + 500000` | arithmetic |
|---|---|---|---|---|
| **36** | `shape_ecdf_conformal_bet` S2/S3 | **20260843** | **20760843** | `20260807+36=20260843`; `+500000=20760843` |

`K6E_T2_SCENARIO_SEED = BASE_SEED + 37 = 20260844` (K6E.10). Trajectory seeds
`seed(i) = 20260843 + 7919*i`, `i = 0..1999`, §6's formula shape unchanged.

**Field lists are registered BY REFERENCE, not re-derived** (the plan's own instruction, and the
only way the two candidates stay comparable): the S2 row carries exactly K6.7's field set
(`crossing_rate`, `k`, `n=2000`, `lower_95`, `increment_estimator{n,mean,sd,se,lower95_one_sided,
upper95_one_sided}`, `p_uniformity{...}`, `degenerate_windows`, `non_finite_wealth`, `null_id`,
`params`, `phi`, `alpha`, `n`, `ticks`, `onset`, `windows`, `window_len`, `window_span`,
`final_wealth_mean`, `final_wealth_median`, `adapter_failures`, `not_executable_reason`,
`substrate_tier`), with three substitutions and one deletion, each named:

- `null_id: 'K6E-arm-heldout'`, `params: 'heldout-empirical'` (K6.7's convention, own literal).
- `p_uniformity` pools **one** feature, so `n = 2000 × 6 × 1 = 12,000` values and
  `ks_critical_at_alpha = 1.36/sqrt(12000) ≈ 0.012415` — K6.7's 24,000/0.008780 was a two-feature
  figure. Same registered caveat as K6.7/K3.1.7: reported, **no verdict authority**, `p` is
  discrete on 201 values.
- The `increment_estimator`-vs-`crossing_rate` verdict rule is K6.7's, unchanged and cited:
  **the verdict stays `crossing_rate`-derived.** At `κ* = 0.9126` the tail index is
  `1/(1-κ*) = 11.4 > 2`, so `Var[e]` is finite here (unlike K6.7's `κ=0.1` case, tail index 1.111)
  and a Wald interval on the increment mean would in fact be CLT-backed — **registered anyway as
  non-authoritative**, because changing which field carries an S2 verdict is a protocol change, not
  an amendment's call. The finite-variance fact is filed for
  `~/concord/knowledge/stats/pages/terminal-mean-rule-contested.md` at write-back, same routing
  K6.7 registers.
- **No `shift_sigma` on fault cells** (K6.9's convention). S3 row carries `shift_sigma: 3`
  realized as `injectShapeMix(..., d: 2.0)` — K6.8's construction, reused verbatim, **including its
  registered honesty clause: no stronger or invented probe is substituted to avoid the outcome the
  derivation predicts.** Predicted S3 `detection_rate = 0.0000` at `κ*` (K6E.6), which
  `scoreS3` reads **INERT** (`0.0000 < INERTNESS_FLOOR = 0.10`, `constants.mjs:20`).
- **Binding adapter constraint, K6.7's, restated as binding here:** the S3 row and all four fault
  cells carry **none** of the five instrument-named fields; one offending cell VOIDs the whole run's
  S2 evidence (`score.mjs`'s `mismatchVoidedRuns`).

### K6E.10 T2 clustersynth arm registration

K6.12's construction, reused unchanged except for the one thing the successor's feature requires —
an A/B split inside the already-registered 9,000-tick reference:

- Scenario: `cs.buildScenario({family:'gb200', pods:1, seed: 20260844, window:{steps:9600, dt_s:30},
  faults:false})`; shards `sc.gpuIds.slice(0,120)`; the five `COUNTERS` coordinates
  (`gpu_temp_c`, `power_w`, `sm_util`, `hbm_bw_gbps`, `nvlink_tx_gbps`) — all K6.12's own values,
  cited not re-chosen.
- **Registered split: per coordinate, A = ticks 1–3,000 (reference ECDF); B = ticks 3,001–9,000 →
  `m = floor(6000/30) = 200` blocks exactly; live = the final 600 ticks → 20 disjoint windows.**
  Arithmetic: `3000 + 200*30 = 9000`, `600/30 = 20`. **`m = 200` matches T1's `m` exactly**, which
  is why this split and not a 4,000-tick A (which would give `m = 166`): one `m` for both tiers
  makes the two arms one construction, and K6.3's T1-333/T2-300 split — the predecessor's own
  documentation-provenance defect — is not repeated.
- Degenerate-reference behaviour, endpoint (`wealth >= 20` at any of the 20 checkpoints, per
  coordinate and pooled), skip-with-reason accounting, and the **binding field names**
  (`t2_crossing_rate` not `crossing_rate`, `t2_verdict` not `verdict`, **and no `fault_class`
  field at all**) are K6.12 + K6.1.3's registered set, applied unchanged with `detector:
  'shape_ecdf_conformal_bet'`. A degenerate-reference throw is per-`(shard, coordinate)`
  skip-with-reason, excluded from both denominators, never folded in as a `0`.
- **The T2 falsifier is not vacuous at `κ*`, unlike T1's** (K6E.11): the 20-window ceiling is
  `20 × 0.372061 = 7.4412 >= log 20`, so a crossing is possible in principle. A crossing needs
  `S_20 >= (log 20 - 20 log κ*)/(1-κ*) = 55.20` against `E[S_20|null] = 19.64` with
  `sd = 4.26` — `8.3` sd. Measured on the i.i.d.-Gaussian analogue at this accounting:
  `0/20,000` trajectories.
- **T2 is required for a K6 YES** (design page §"Card and certification path"), and, exactly as
  K6.12 registers for the predecessor, **that bar is moot here**: canonical detection is
  predetermined at `0.0000` (K6E.6), so no T2 outcome can produce a YES. The arm's registered
  purpose is unchanged and is the reason it still runs if the plan proceeds: **it is the C22-fix
  vindication test**, and the successor keeps the predecessor's contiguity answer intact (blocks are
  contiguous slices of the coordinate's own history), so whether validity survives independent
  telemetry is a finding either way.

### K6E.11 Stop conditions, and one vacuity disclosed

Verbatim from the design page (§"Card and certification path": "Falsifier: healthy crossing above α
on either tier. Stop conditions checked first, before any power reading") and the plan's Global
Constraints ("healthy crossing Wilson lower-95 ≤ α on either tier"):

- **T1**: arm cell 36's S2 `crossing_rate`/`k`/`n=2000`; Wilson 95% lower bound `> α = 0.05` fires.
- **T2**: K6.12's pooled `t2_crossing_rate` Wilson 95% lower bound on the pooled `k`/`n` across
  scored `(shard, coordinate)` pairs — pooled, not any single coordinate's rate.
- A fired stop condition on either tier REFUTES `shape_ecdf_conformal_bet` on the record; K6 stays
  NO either way (K6E.6).

**Disclosed, not routed around: at `κ* = 0.9126` the T1 stop condition CANNOT fire.** Healthy
crossing is structurally `0.0000` (K6E.6 — the ceiling argument is indifferent to which arm the
windows come from), so the T1 falsifier is unfalsifiable at the registered `κ*`, and a T1 "PASS"
on validity would carry no information. This is registered as a **limitation of the design page's
own κ rule at this horizon**, not corrected here: the page registers `κ` as the output of the
growth derivation, and substituting a κ chosen to keep the falsifier live — `κ ≈ 0.35`, where
healthy crossing is `0.0062` and canonical `0.0121` — would be selecting a constant on an endpoint
after seeing the numbers, which the page's own "No tuning after the gate" clause forbids and which
this amendment will not do. **The T2 falsifier remains live (K6E.10), so the construction's
validity claim is still testable on the tier that killed the predecessor's own predecessor.**
Changing the κ rule is a design-page decision; it is named here as the one open question this gate
produced (K6E.14).

### K6E.12 Predictions, with falsifiers, for every endpoint the runs would read

All at the registered `κ* = 0.9126`.

| endpoint | prediction | falsifier |
|---|---|---|
| T1 healthy crossing (cell 36 S2 `crossing_rate`, `k/2000`) | **`0.0000`, `k = 0`**, Wilson LB `0.0000` | any crossing at all — a single one falsifies K6E.6's ceiling arithmetic and is a defect in the wiring or in this amendment, not a power finding |
| T1 S2 `increment_estimator.mean` | `0.998 ± 0.001` (exact `E[e\|null] = 0.998021`, K6E.3) | outside `[0.99, 1.01]` |
| T1 S2 `p_uniformity` first-decile count of 12,000 | `1194 ± 33` (sd 32.8) (exact `P(p<=0.1) = floor(0.1*201)/201 = 20/201 = 0.099502`) | reported, no verdict authority (K6.7's caveat) |
| T1 S2 `degenerate_windows`, `non_finite_wealth` | **structurally 0**: `p ∈ [1/201, 1]` so `e ∈ [κ*, κ*·201^(1-κ*)] = [0.9126, 1.4507]`, always finite, no `p=0` pathway; `T(w)` is a finite sum of squares of bounded quantities, so the predecessor's `m2 = 0` NaN pathway has no analogue and a constant live window yields a finite, large `T` rather than `NaN` | any nonzero count |
| idx 26 `mix-d1.0` detection | **`0.0000`** | any crossing |
| **idx 27 `mix-d1.5` canonical detection** | **`0.0000`** — NOT_POWERED, `< COVERAGE_FLOOR = 0.50`, **structurally** (K6E.6) | any crossing; and materially above `0.50` would falsify the whole gate derivation |
| idx 28 `mix-d2.0` detection | **`0.0000`** at `κ*`, despite `x = 4.909` at that cell (K6E.8) — the ceiling binds, not the signal | any crossing |
| idx 29 `mix-d1.5-ar1` detection | **`0.0000`** | any crossing |
| S3 arm (cell 36, `shift_sigma:3` = `d=2.0`) | **`0.0000`** → **INERT** (`< 0.10`) | materially above `0.10` |
| T2 pooled healthy crossing | **`0.0000`**, `<= α = 0.05` (validity; exactness argument of K6E.3 plus the 8-sd margin of K6E.10) | the T2 stop condition |
| T2 degenerate-reference skips | **not predicted** — registered as a finding to make (K6.12), disclosed per coordinate, never folded into a denominator | — |
| K6 class answer | **NO**, canonical `0.0000 < 0.50`, decided at design time by this gate | canonical `>= 0.50` |

A failed endpoint is a publishable result (§0 rule 2); nothing above moves afterward, **including
the `0.0000` predictions** — they are registered as predictions to be confirmed or falsified, and a
single crossing anywhere is a surprise to investigate, not a result to absorb.

### K6E.13 Golden card-tuple expectation

**Pre-run** (the state at the commit that would freeze the card, following K6.2.4's precedent
exactly): `shape_ecdf_conformal_bet` enters `validation/certification/test/golden-verdicts.test.mjs`
at **`NOT_EXECUTABLE`, tier `null`, S1 `MISSING`, S2 `MISSING`, S3 `MISSING`, S4 `PASS`** — no run
of this candidate exists, and a card with no evidence has no other correct verdict.

**Post-run expected delta, registered here and to be named against the actual numbers at the run's
own commit, not asserted as already true:** `NOT_EXECUTABLE → ADVISORY`, tier `null → T1`,
S2 `MISSING → PASS` (`crossing_rate = 0.0000`, Wilson LB `<= α` → `not-refuted`), S3
`MISSING → INERT` (`detection_rate = 0.0000 < INERTNESS_FLOOR`), S1 `MISSING` and S4 `PASS`
unchanged. `overallVerdict`'s valid-but-inert rule (`score.mjs:564-567`: `s3Powered.length === 0` →
`ADVISORY`) caps this card at **ADVISORY**, and this amendment registers that plainly as the
expected outcome rather than as a defect to route around. **The other fourteen cards' tuples do not
move** — no existing card, cell, or run is touched.

### K6E.14 The one open question this gate produced, named and not resolved here

The gate's registered rule selects `κ` by growth at the canonical cell. At this horizon that rule
selects `κ* = 0.9126`, and at `κ* = 0.9126` **every T1 endpoint — power and validity alike — is
structurally `0.0000`, and the T1 falsifier cannot fire** (K6E.11). A `κ` chosen instead to
maximize 6-window canonical detection would be `≈ 0.35–0.40`, where canonical detection is `0.0121`
and healthy crossing `0.0062` — still `41×` below the coverage floor, so **the class answer is NO
under either rule** and nothing about K6's coverage turns on this choice. What turns on it is
whether the registered run measures a live falsifier or a pair of predetermined zeros.

**This amendment does not choose.** Selecting `κ` on the crossing endpoint after seeing these
numbers is exactly the tuning the design page's gate forbids, and the κ rule lives in the design
page, not here. Registered instead: the fact, the two candidate readings, and that resolving it is
an operator/design-page decision. **Nothing in this amendment is contingent on the outcome:** the
constants of K6E.1, the feature of K6E.2, the null law of K6E.3, the gate tables of K6E.4, the
verdict of K6E.5, the requirement arithmetic of K6E.6 and the class answer NO all stand at every
`κ ∈ (0,1)`.

### K6E.15 Housekeeping riders (quote-and-correct, per §11 rule 7)

**Rider 1 — this document's own v2.C1.1 Amendment summary describes a disclosure section that no
longer exists.** Quote (`PREREGISTRATION.md:3733-3736`):

> Registers what IS done: the legacy `{priorRun, defect}` shape is recognized, recorded, and
> disclosed in every certification `REPORT.md` under "Declared superseded but STILL SCORED",
> naming the run and the stated defect verbatim; `report_format` `3 -> 4`;

**Correct: since h0-battery Amendment A1 (merged PR #54), the two 2026-08-01 legacy declarations
are disclosed under a different heading, and the phrase "STILL SCORED" no longer applies to them.**
A1 registered a supersession registry (`results/live/SUPERSESSIONS.json`), `report_format` went
`4 → 5`, and `validation/certification/verdict.mjs:141-145,166-175` now splits the legacy
declarations: one a registry covers gains `covered_by_registry: true` and moves to **"Declared
superseded in the legacy shape, and now closed by a registry"**, annotated `NOW DROPPED by a
supersession registry`; registry-driven drops get their own **"Superseded evidence by study
registry (h0-battery Amendment A1)"** section (`verdict.mjs:158-165`). The
"Declared superseded but STILL SCORED" heading remains in the generator
(`verdict.mjs:176-184`) and stays verbatim for any legacy declaration a registry does **not**
cover, per A1's own registered wording — there are currently none, and the most recent
certification run states so in its own text:
`validation/certification/results/run-20260808T180653Z/REPORT.md:146` reads "The phrase `STILL
SCORED` occurs **0** times in this report". **Nothing else in v2.C1.1 moves**: C1.1.2's ruling that
the legacy shape itself is still not the mechanism that acts is unaffected (a registry is), and
C1.1.4's write-back obligation is **discharged** by A1 rather than outstanding — recorded here
because C1.1.4 named it "named-not-done work" and it is now done.

**Rider 2 — K6.11's `O(1/m)` qualifier is the right order for the exceedance rate and the wrong
order for the calibrator identity.** Quote (`PREREGISTRATION.md:2392-2396`):

> At finite `m`, `p` is drawn from a DISCRETE distribution over `{1/(m+1), ..., (m+1)/(m+1)}` under
> exchangeability, not the continuous Uniform(0,1) the calibrator identity (K6.2) integrates over
> exactly [...] The deviation from continuous uniformity is `O(1/m)`.

**Correct, in two parts.** For the *exceedance* rate the order is right and K6.1.2's closed form
already pins the value (`floor(α(m+1))/(m+1)`, within `1/(m+1)` of `α`, conservative). For the
*calibrator identity* — the sentence's own named subject — the deviation is `O(m^(-κ))`, not
`O(1/m)`, and at small `κ` it is large:

```
E[e | null] = kappa*(m+1)^(-kappa) * SUM_{k=1..m+1} k^(kappa-1)
            = 1 + kappa/(2m) + kappa*zeta(1-kappa)*(m+1)^(-kappa) + ...      zeta(1-kappa) < 0 on (0,1)
kappa=0.1, m=333 (the predecessor's registered values):  E[e|null] = 0.472747  — a 52.7% shortfall, not 0.3%
kappa=0.1, m=200:                                        E[e|null] = 0.4454
kappa=0.9126, m=200 (this candidate):                    E[e|null] = 0.9980
```

**Direction: conservative, exactly as K6.1.2 corrected — validity is strengthened, not
threatened, and no endpoint, floor, seed or verdict moves in K6 or anywhere else.** What moves is
how a reader interprets a K6 row: `shape_block_conformal_bet`'s registered per-window `e` averages
`0.4727` under the null at its registered `κ = 0.1`, not `≈ 1`, so its wealth process drifts
*down* on healthy data by construction and its near-zero healthy crossing rate is in part this
conservativeness rather than only the feature's behaviour. Filed here rather than in a K6 amendment
because this amendment's own null-identity check (K6E.3/K6E.7b) is where the arithmetic was
re-derived. For write-back:
`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`'s K6 section and any page quoting
the `O(1/m)` qualifier need the split.

**Rider 3 — the dispatch's window accounting, corrected against the registered accounting.** This
task's own dispatch reads "6 live windows per 600-tick scenario arm". The registered accounting is
two different things and neither is that: **T1 is 6 windows of 30 over `[100,280)` of a 300-tick
trajectory** (K6.10), and **T2 is 20 windows of 30 over the final 600 of 9,600 ticks** (K6.12).
Both are registered above (K6E.1, K6E.9, K6E.10) in their own terms. No endpoint moves; the
dispatch is not a registered artifact, and this is recorded so the "600-tick" figure is never read
as a T1 span.

### K6E.16 House rules, mapped

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`: (1) **committed before
any artifact it authorizes** — at this commit there is no `shape_ecdf_conformal_bet` module, card,
adapter, run or result, and this amendment is the only change. (2) A failed endpoint is a
publishable result; nothing above moves afterward, **including the `0.0000` predictions and the
gate verdict itself** (K6E.12). (3) No post-hoc analysis exists; the probe of K6E.4 is a
**pre-registration-time derivation disclosed with provenance**, not a post-hoc reading of a run —
there is no run. (4) Fallback rules: A3 for T1 (K6.15's inheritance, applied to cell 36 and cells
26–29), K6.12's skip-with-reason for T2. (5) Freeze: T1's seeds are frozen by K6E.9's arithmetic;
T2's by `K6E_T2_SCENARIO_SEED = 20260844`, this document's equivalent freeze for a generator it does
not own (K6.16's rule 5, unchanged). (6) Results append-only, binding on both arms. (7) Reruns only
for a named code defect, prior run preserved; **and quote-and-correct for text**, which is what
K6E.15's three riders do. (8) The report states every endpoint's number and verdict, both arms.

### Amendment summary

Registers, superseding nothing: the successor's constants with all arithmetic shown (K6E.1 —
`n_A = 4000`, `W = 30`, T1 `m = 200` exactly with no remainder dropped, T2 `m = 200` from a
`3000 + 200*30 = 9000` split, and the 6-window T1 / 20-window T2 accounting reused from
K6.10/K6.12); the CvM feature frozen to an exact discrete form with its three departures from
Anderson (1962) each shown to be rank-irrelevant, and the `i/W`-vs-midpoint choice measured and
disclosed as verdict-neutral (K6E.2); the exact null law of the block-conformal rank, including the
closed-form `E[log p|null] = -0.982234` and an `E[e|null]` table whose gap below 1 is `O(m^(-κ))`
(K6E.3). **The design gate, computed: `E[log p|alt] = -1.09576 ± 0.00347` at the canonical cell
(pooled over two probes on non-registered seeds `>= 3.0e9`, 360,000 live windows), giving
`κ* = -1/E[log p|alt] = 0.9126` and growth `+0.004312` nats/window, 95% CI
`[0.003738, 0.004926]` (K6E.4). GATE VERDICT: OUTCOME 3 of the three registered outcomes —
positive, so no design-time refutation of the growth criterion is filed and the design page's
mechanism claim is confirmed in sign, but `11.6×` below the page's own 0.05 nats/window marginality
floor (K6E.5).** The canonical-detection prediction derived from the endpoint the coverage floor
actually tests, not from the sign: at `κ*` the 6-window ceiling is `2.2324 < log 20 = 2.9957`, so a
crossing is **impossible** and canonical detection is **`0.0000` structurally**; nine windows would
be needed and the post-onset span cannot host them; across the whole `κ` grid canonical detection
never exceeds `0.01205`, `41×` below `COVERAGE_FLOOR = 0.50`; and the closed-form requirement
(`min_κ c_6 = 14.14`, `2.3564` nats/window) is `2.15×` more than the feature's measured `1.0958`
(K6E.6). Sanity anchors: the predecessor's feature reproduced at `E[log eAvg|alt] = -1.4132 ±
0.0024` against K6.4's registered `-1.414 ± 0.047`, anti-informative in the same direction; the
null identity checked against the exact discrete law rather than against 1, every marginal matching
(mean `p` `0.50221`/`0.502488`, `P(p<=0.05)` `0.04983`/`0.049751`); and the calibration-draw lottery
quantified — 50 of 400 references are anti-informative at canonical on their own draw and 1 of 400
reaches the marginality floor (K6E.7). Per-cell predictions with mechanisms: `d=1.0`
anti-informative (`x = 0.9867`), `d=2.0` strongly informative (`x = 4.909`) but confirmed a
two-point boundary artifact (`s = 0` exactly), `mix-d1.5-ar1` strongly anti-informative
(`x = 0.4467`) because the injection replaces AR(1) values with i.i.d. mixture draws while the
reference stays AR(1), with validity intact at matched φ (K6E.8). Cell/arm registration on §6's
unchanged K6 seeds plus new arm cell 36 (`CELL_SEED 20260843`, `HELDOUT_SEED 20760843`) and
`K6E_T2_SCENARIO_SEED 20260844`, field lists by reference to K6.7/K6.9 with the one-feature
`p_uniformity` recount (12,000, `ks_critical 0.012417`) named (K6E.9); the T2 arm on K6.12/K6.1.3's
registered construction and field names, with the A/B split registered so T2's `m` equals T1's
(K6E.10); stop conditions for both tiers, **with the T1 falsifier's vacuity at `κ*` disclosed
rather than routed around, and the T2 falsifier shown still live** (K6E.11); predictions with
falsifiers for every endpoint (K6E.12); the golden tuple, pre-run `NOT_EXECUTABLE` and post-run
expected `ADVISORY`/T1 (K6E.13); and the one open question — that the page's own κ rule selects a
constant under which no T1 endpoint can move — named, with both readings and the class answer NO
under either, and deliberately **not** resolved here (K6E.14). Three quote-and-correct riders: this
document's `:3733-3736` claim that legacy supersessions are disclosed under "Declared superseded
but STILL SCORED" is stale since h0-battery Amendment A1 (merged PR #54, `report_format 4 → 5`,
`verdict.mjs:141-145,166-175`), and C1.1.4's write-back obligation is discharged rather than
outstanding; K6.11's `O(1/m)` qualifier is right for the exceedance rate and wrong for the
calibrator identity, which deviates `O(m^(-κ))` — `E[e|null] = 0.472747` at the predecessor's
registered `κ = 0.1, m = 333`, a 52.7% conservative shortfall, no endpoint moved; and the dispatch's
"6 windows per 600-tick arm" corrected to the registered T1/T2 accountings (K6E.15). **No endpoint,
floor, seed, prediction or verdict in §1–14 or in any earlier amendment moves. `K6` stays `NO`, now
decided at design time for the successor as it already was for the predecessor, and no run has been
spent to learn it.**

## Amendment v2.K6E.17 — 2026-08-08, the ruling: the second K6 attempt is refuted at design time and the run is cancelled

Registered after Amendment v2.K6E's gate and after an **independent adversarial verification** of it,
and before any artifact of `shape_ecdf_conformal_bet` exists — there is still no module, no card, no
adapter, no run, and after this amendment there will be none. **This amendment cancels a registered
run rather than reporting one.** It supersedes exactly one clause, named at K6E.17.1, and corrects
five items in v2.K6E's own text by quote-and-correct with the original left intact. No endpoint,
floor, seed or verdict belonging to any other candidate moves.

**Authority chain, stated because a cancellation needs one.** Operator directive 2026-08-08
("continue through recommended actions … until all detectors are complete"), under which the
controller of `docs/superpowers/plans/2026-08-08-k6-ecdf-successor.md` ruled on the gate's own
option list (`.superpowers/sdd/2026-08-08-c46-k6-ecdf/task-1-report.md` §9, option 1). **The
controller's ruling is named as such and is the authority for K6E.17.1; it is not a finding of this
document.** The verification is named at K6E.17.2 with its own provenance.

### K6E.17.1 THE RULING, and the one clause it supersedes

**Quoted, from the ratified design page**
(`~/concord/knowledge/methodology/pages/k6-ecdf-successor.md` §"The design gate", outcome 3):

> 3. **Positive but marginal (< 0.05 nats/window)** → proceed, with the expectation registered as
>    NOT_POWERED-at-floor and the run treated as a measurement of the margin, not a likely YES.

**SUPERSEDED FOR THIS CONSTRUCTION, by the controller's ruling.** The clause assumes the run
measures something. It does not, and the gate proved it before the clause could apply:

- **No T1 power endpoint can move.** At the registered `κ* = 0.9126` the six-window wealth ceiling
  is `2.2323 < log 20 = 2.9957` (K6E.6, re-pinned at K6E.17.3(d)) — a crossing is arithmetically
  impossible on every cell and on the S3 arm, so every predicted `detection_rate` is a
  pre-registered constant `0.0000` that the run can only reproduce.
- **No T1 validity endpoint can move, so the T1 falsifier cannot fire** (K6E.11) — a healthy
  crossing is impossible by the same ceiling, and an unfalsifiable falsifier is not evidence of
  validity.
- **No `κ ∈ (0,1)` reaches the coverage floor**, now by a tail bound rather than a mean heuristic:
  `detection(κ) <= 0.3014` for every admissible `κ` (K6E.17.2), against
  `COVERAGE_FLOOR = 0.50`.

**REGISTERED RULING: the T1 battery run and the T2 clustersynth arm for `shape_ecdf_conformal_bet`
are CANCELLED. Tasks 2–5 of the plan do not execute. No detector module, card, adapter, harness
change, run or result is created. `K6 = NO`; the second registered K6 attempt is REFUTED AT DESIGN
TIME; no run was spent.** The one-attempt rule is satisfied by this refutation exactly as it would
have been by a run: a third candidate is a new decision page, not a retune of this one (design page
§"The design gate", final paragraph, which this amendment does **not** supersede).

**Write-back obligation, named and NOT done here.** The design page is a ratified wiki page and this
document cannot overrule it — this document's own precedence rule is that the page wins and a
disagreement is a bug in this document to report. What is registered here is the **ruling** and the
supersession it carries **for this construction**; the page itself must record the cancelled run and
this superseded clause at write-back (plan Task 6). Until it does, the page's outcome-3 clause and
this amendment disagree on the record, deliberately, with the ruling named as the reason.

### K6E.17.2 THE VERIFIER'S STRENGTHENING, adopted as the binding bound

**Provenance: independent adversarial verification of Amendment v2.K6E, on the verifier's own code
and own seed families (`1.7e9`, `2.6e9` — disjoint from this amendment's `3.0e9`/`3.5e9`/`4.1e9`),
300,000 windows per cell. Verdict: DERIVATION-SOUND; every load-bearing number of v2.K6E
reproduced.** The verification also strengthened the argument, and the strengthening is adopted here
in preference to v2.K6E's own framing.

**Quoted, v2.K6E K6E.6 (`PREREGISTRATION.md:4158-4161`):**

> **Registered reading: a detection rate of `0.50` at the 6-window horizon requires the feature to
> deliver a median `S_6` of at least `14.14` nats — about `2.36` nats per window — at some `κ`. This
> feature delivers `1.0958` nats per window at the canonical cell. It is short by a factor of
> `2.15`, and no choice of `κ` closes a gap in the statistic itself.**

**Corrected: that is a mean-against-threshold heuristic and it controls no tail.** A mean of
`1.0958` against a required `2.3564` does not bound `P(S_6 >= 14.14)`, because `S_6` has a right
tail and the required median is not a function of the mean. The comparison is retained as
descriptive; **it is not the argument, and Table 6 must not be read as one.** The binding argument is
the over-all-`κ` bound:

```
crossing at window t   =>  S_t >= c_t(kappa) >= b_t = min_kappa c_t          (Table 6's own b_t)
t = 1 is unreachable for every kappa:  max S_1 = log(m+1) = 5.3033 < b_1 = 5.7439
for t in 2..6:  S_t <= S_6  and  b_t >= b_2 = 7.6890
=>  ANY crossing, at ANY t, under ANY kappa in (0,1)  =>  S_6 >= b_2 = 7.6890
=>  detection(kappa) <= P( S_6 >= 7.6890 )   for every kappa in (0,1)
```

**Measured at the canonical alternative: `P(S_6 >= 7.6890) = 0.30140 ± 0.0021`** (the verifier's
figure, adopted). **Reproduced independently on this amendment's own probe-2 streams:
`0.29975 ± 0.00324` on 20,000 trajectories** — the two agree within `0.5` SE. **Registered binding
bound: `detection(κ) <= 0.3014` for every `κ ∈ (0,1)`, against `COVERAGE_FLOOR = 0.50`.** This is
the argument the class answer rests on: it holds without choosing a `κ`, without a distributional
assumption on `S_6`, and without the mean heuristic above.

**One correction to the strengthening itself, in the same spirit.** The verifier's "below the floor
by 95 SE" uses a trajectory-level binomial SE, and trajectories are **not** independent here: the
100 trajectories sharing one reference are dependent through it (the C1.7 lottery, made numerical at
K6E.7c). Cluster-robust over references, this amendment measures the same quantity at
`0.29975 ± 0.00561` — a **design effect of `1.73×`** on the binomial SE — so the honest margin is
`35.7` cluster-robust SE on this amendment's sample, and the verifier's `±0.0021` needs the same
inflation (`≈ ±0.0036`, `≈ 55` SE) before it is quoted. **The conclusion is unchanged and the
direction of the correction is against this document's own interest: `0.30` versus `0.50` survives
any plausible variance inflation, and `35` SE is not a close call.**

### K6E.17.3 Corrections from the verification, each with the original intact

**(a) The grid maximum, and the "41×" that followed from it.** Quoted, K6E.6
(`PREREGISTRATION.md:4142-4144`):

> The maximum canonical detection anywhere on the grid is **0.01205** at `κ ≈ 0.35–0.40`, **41×**
> below `COVERAGE_FLOOR = 0.50`

**Correct: `0.01272 ± 0.00050` at `κ = 0.38`, and `39×` below the floor** (`0.50/0.01272 = 39.3`).
The verifier's finer grid found the maximum between v2.K6E's own grid points. Adopted. The same
`41×` appears twice more and is corrected to `39×` at both: K6E.14 (`:4403`) and the Amendment
summary (`:4515`).

**Registered qualifier on the argmax, which the verification's own numbers require.** This
amendment's grid reads `0.01130 (κ=0.34)`, `0.01170 (κ=0.36)`, `0.01145 (κ=0.38)`,
`0.01125 (κ=0.40)`, `0.01090 (κ=0.42)`, each `± 0.00075` on 20,000 trajectories — **flat in `κ`
within noise across `0.34–0.42`.** Naming `κ = 0.38` as *the* argmax overstates the resolution of
either sample; what is registered is the **magnitude** (`≈ 0.0127`, `39×` below the floor) and that
it is attained somewhere in `0.34–0.42`. The bound of K6E.17.2 does not depend on the argmax at all.

**(b) "The rank identity is exact" overstates what is exact.** Quoted, K6E.2
(`PREREGISTRATION.md:3921`):

> fitted on itself. The rank identity is exact, not `O(1/n_A)`.

**Correct, in two parts.** The rank identity **is** exact *per window* and *marginally* — the
statement about `F̂_A` being fitted on A alone and every ranked object coming from `B ∪ live` stands,
and K6E.7b's measured marginals confirm it. What the sentence should not be read as claiming is
**joint** exactness across windows: the six live windows are ranked against **one shared** `{T(B_j)}`
draw, so their `p`s — and their `e`s — are **positively dependent**, and **the six-window product is
NOT a martingale in the filtration that includes the shared reference.** Measured (verifier, own
seeds; direction and order independently reproduced here on seed family `4.1e9`, 300 references ×
100 trajectories):

| `κ` | `E[W_6 \| null]` (verifier) | product of marginals (verifier) | verifier ratio | this amendment's ratio |
|---|---|---|---|---|
| 0.1 | 0.0094 | 0.0078 | +20% | +15.8% (`0.0084` vs `0.0072`) |
| 0.2 | 0.1322 | 0.1110 | +19% | +14.0% (`0.1193` vs `0.1047`) |
| **0.9126 (`κ*`)** | 0.9887 | 0.9882 | **+0.05%** | **+0.05%** (`0.9869` vs `0.9864`) |

**Registered reading.** The two measurements of the `κ = 0.1` and `κ = 0.2` ratios differ (`+20%`
vs `+15.8%`) and **neither should be quoted as a precise value**: at those `κ` the calibrator's tail
index is `1/(1-κ) ≈ 1.11–1.25 < 2`, so `Var[e]` is infinite and `E[W_6]` is a heavy-tailed mean
whose sample estimate converges slowly — the same infinite-variance fact K6.7/K3.1.3 already
register for the predecessor's `κ = 0.1`. What replicates exactly, and is what this item registers:
**the dependence is positive; `E[W_6 | null] < 1` at every `κ` measured, so the discrete
conservativeness of K6E.3 (`O(m^(-κ))`) absorbs it with room to spare; and at the registered `κ*`
the effect is `+0.05%`, negligible.** **No endpoint, prediction or verdict moves** — and every
endpoint this would have touched is now cancelled anyway (K6E.17.1).

**Consequence on the T2 accounting, which does move by a stated amount.** Quoted, K6E.10
(`PREREGISTRATION.md:4322-4323`):

> A crossing needs `S_20 >= (log 20 - 20 log κ*)/(1-κ*) = 55.20` against `E[S_20|null] = 19.64` with
> `sd = 4.26` — `8.3` sd.

**Correct: `sd(S_20 | null) = 4.46` measured under the shared reference** (verifier; this amendment
measures `4.4434` on its own seeds), against the i.i.d.-exact `4.2586` this document used — the same
positive dependence, at the 20-window horizon. **The registered T2 margin is `8.0` sd, not `8.3`**
(`(55.20 − 19.60)/4.4434 = 8.01`). The T2 prediction (`pooled crossing <= α`, expected `0.0000`) is
unchanged, and the arm is cancelled by K6E.17.1 in any case; the correction is registered because
the number was pinned.

**(c) Table 4's `W = 30` row is mislabelled, and its true provenance is worse than a third probe.**
Quoted, K6E.4 (`PREREGISTRATION.md:4053-4055`):

> **Table 4 — the `W` sensitivity, disclosed (probe 2, `m` held at 200 by extending the B segment to
> `200*W` rows — a probe-only variation, registered as such, so `W` is isolated from `m`).**

The row reads `-1.09510 ± 0.00733` where probe 2's canonical cell reads `-1.09277 ± 0.00614`, under
one "probe 2" label. **Correct, checked against the scratch record rather than guessed
(`c46/cells-and-W.mjs`, part B's `arm({... windows: 2})` against part A's `arm({... windows: 6})`):
it is neither a third probe nor an independent measurement. Both calls use the identical reference
seed `3.5e9 + 1000003·rep + 7` and the identical live seed `3.5e9 + 17000041·rep + 23`, and each
trajectory consumes windows sequentially from that one stream, so part B's `2 × 100 = 200` windows
per reference are exactly the FIRST 200 of the same 600 windows part A averaged. Table 4's `W = 30`
row is a NESTED SUBSET — a 40,000-window prefix of probe 2's own canonical arm, not a replication of
it.** Reproduced to five decimals this session: the first 200 windows per reference average
`-1.09510 ± 0.00733`, all 600 average `-1.09277 ± 0.00614`. **Registered consequence: the `W = 30`
row of Table 4 carries no independent evidential weight beyond probe 2's canonical row, and the
canonical value of record stays the pooled `x = 1.09576 ± 0.00347` (K6E.4).** The `W ∈ {60, 120,
240, 480}` rows are genuinely separate computations, but they share the same seed families across
`W`, so they are correlated with each other and with the `W = 30` row — **Table 4 is a disclosed
sensitivity sweep, never a set of independent measurements**, and nothing in this document's
registered predictions rests on it.

**(d) Two pinned numbers that were not evaluated at a single `κ`.** Quoted, K6E.6
(`PREREGISTRATION.md:4112-4114`):

> per-window ceiling = log kappa* + (1-kappa*)*log(m+1) = -0.091448 + 0.0874*5.303305 = 0.372061 nats
> 6-window ceiling   = 6 * 0.372061 = 2.232366    <    log 20 = 2.995732
> windows needed for the ceiling to reach log 20   = ceil(2.995732 / 0.372061) = 9

**Correct: `0.372061` is a mixed evaluation** — the `log κ*` term was taken at the unrounded
`1/x = 0.912608` and the `(1-κ*)` term at the registered literal `0.9126`. **Registered: `κ*` is
pinned at the literal `0.9126`, and every quantity derived from it is evaluated there:**

```
per-window ceiling at kappa* = 0.9126:      0.372051 nats        (at 1/x = 0.912608 it is 0.372018)
6-window ceiling at kappa* = 0.9126:        6 * 0.372051 = 2.232306   <   log 20 = 2.995732
windows needed:                             ceil(2.995732 / 0.372051) = 9      unchanged
```

The verifier's own attribution ("0.372061 was evaluated at 0.912608") is likewise not right —
`0.912608` gives `0.372018`; **`0.372061` corresponds to neither `κ`.** Nothing downstream moves
(`2.2323` and `2.2324` are both far below `2.9957`; the impossibility and the nine-window figure are
unchanged), and the correction is registered because this document pins numbers.

Second pinned inconsistency, same class. Quoted, K6E.9 (`PREREGISTRATION.md:4279`):

> `ks_critical_at_alpha = 1.36/sqrt(12000) ≈ 0.012415`

against `0.012417` in the same wave's report text. **Correct and pinned: `1.36/sqrt(12000) =
0.0124150`** (7 significant figures, node-verified). No endpoint moves; the field is
`ks_critical_at_alpha` on a row that carries no verdict authority (K6.7's caveat) and is cancelled
in any case.

**(e) Two cleaner statements, adopted.**

```
6-window crossing is structurally IMPOSSIBLE for every kappa > 0.8822
   (6*(log kappa + (1-kappa)*log 201) = log 20 at kappa = 0.8822; ceiling 2.99586 there)
No substrate split rescues kappa*:  the ceiling reaches log 20 only at m+1 >= 861.88,
   i.e. m >= 861 blocks = 25,830 B-ticks, against the registered 10,000-row substrate whose
   maximum possible block count is m = 333 (ceiling 2.4986 < 2.9957 even then)
```

Both node-verified this session. The first replaces "at `κ*` the crossing is impossible" with the
whole region it belongs to: **`κ*` is not near the impossibility boundary, it is `0.03` inside it,
and every `κ` above `0.8822` shares the property.** The second closes the obvious escape — enlarging
`m` — by arithmetic: the successor would need a `25,830`-tick B segment where the registered
substrate provides `6,000`, and even spending all `10,000` rows on blocks leaves the ceiling short.

### K6E.17.4 Named-not-done

- **The T2-only CvM validity reading — the one live falsifier this design had.** K6E.10's 20-window
  ceiling (`7.4412 >= log 20`) means a T2 crossing is possible in principle, so the T2 arm alone
  could still answer "does the contiguity construction's validity survive independent telemetry",
  the question that killed `shape-kurtosis-e-value.ts` (C22,
  `~/concord/knowledge/stats/pages/shape-clustersynth-2026-08-05.md`). **It is not part of this
  plan and is not registered here.** It needs its own decision: it would require the module and the
  T2 adapter that K6E.17.1 just declined to build, it can produce no coverage answer (K6 is NO
  either way), and its value is methodological. **Filed as named-not-done work, not as a
  recommendation.**
- **The verifier's replication of the calibration-draw lottery (K6E.7c), recorded because it is a
  second measurement of a registered number.** Verifier: **12.0%** of 500 references have their own
  `x <= 1`, per-reference growth median `0.0039`, and **3 of 500** reach the `0.05` nats/window
  floor. This amendment: **12.5%** of 400, median `0.0038`, **1 of 400**. The two agree on the
  fraction (`12.0%` vs `12.5%`) and the median (`0.0039` vs `0.0038`); the floor-reaching count is
  `0.6%` against `0.25%`, both a handful of draws in the far tail of a heavy-tailed statistic and
  **neither a precise rate**. Registered reading, unchanged from K6E.7c: **roughly one held-out draw
  in eight is anti-informative at canonical on its own reference, and roughly one in 200–400 would
  have cleared the marginality floor** — and the structural detection prediction never depended on
  the draw.
- **`~/concord/knowledge/methodology/pages/coverage-gap-detectors.md`'s K6 section, the
  fault-class-coverage-matrix page, and the design page's own outcome-3 clause** all need the
  write-back K6E.17.1 names. Not done here; the wiki is not this document's to edit.

### K6E.17.5 House rules, mapped

(1) Committed before any artifact — and now before **no** artifact: this amendment's own act is to
cancel the run, and at this commit nothing of `shape_ecdf_conformal_bet` exists or will.
(2) A failed endpoint is a publishable result; **a cancelled run is one too, and this is where it is
published.** Nothing in v2.K6E moves except the five items corrected above, each quoted with the
original intact. (3) No post-hoc analysis: there is no run to analyse. (4)–(6) Moot for the
cancelled arms; v2.K6E's registrations stand as the record of what would have been run, deliberately
not deleted. (7) **Quote-and-correct for text**, which is what K6E.17.2 and K6E.17.3's five items
do; and the supersession of K6E.17.1 is named, with its authority, rather than applied silently.
(8) The report states every endpoint's number and verdict — discharged by v2.K6E's prediction table
plus this amendment: **every endpoint's number is a registered prediction that no run will now
measure, and the class answer is stated plainly.**

### Amendment summary

Registers **the controller's ruling** (authority: operator directive 2026-08-08 → the controller of
the C46 plan, taking option 1 of the gate report's own option list): the design page's outcome-3
clause ("proceed, with the expectation registered as NOT_POWERED-at-floor and the run treated as a
measurement of the margin") is quoted and **superseded for this construction**, because the gate
proved that no T1 endpoint a run reads can move any verdict — the falsifier cannot fire at `κ*` and
detection cannot reach the floor at any `κ`. **The T1 battery run and the T2 clustersynth arm are
CANCELLED; Tasks 2–5 do not execute; no module, card, adapter or run is created; `K6 = NO`, the
second registered attempt REFUTED AT DESIGN TIME, no run spent** — with the design page's own
write-back named as not-done, since a prereg amendment cannot overrule a ratified page (K6E.17.1).
Adopts, from an **independent adversarial verification** that reproduced every load-bearing number
of v2.K6E (own code, own seed families `1.7e9`/`2.6e9`, 300,000 windows/cell, verdict
DERIVATION-SOUND), **a strengthened binding bound in place of K6E.6's mean-against-threshold
framing**, which is quoted and corrected as controlling no tail: since `t = 1` is unreachable for
every `κ` (`max S_1 = 5.3033 < b_1 = 5.7439`) and `S_t <= S_6`, any crossing at any `t` under any
`κ` implies `S_6 >= b_2 = 7.6890`, so **`detection(κ) <= P(S_6 >= 7.6890) = 0.3014 ± 0.0021` for
every `κ ∈ (0,1)`**, below `COVERAGE_FLOOR = 0.50`; independently reproduced here at
`0.29975 ± 0.00324` (0.5 SE apart), with the verifier's "95 SE" margin corrected to a
cluster-robust `≈ 55` SE — this amendment measures the design effect of the shared reference at
`1.73×` and reads `35.7` cluster-robust SE on its own sample, a correction against this document's
own interest that leaves the conclusion untouched (K6E.17.2). Five quote-and-correct items, originals
intact (K6E.17.3): the grid maximum `0.01205` at `κ ≈ 0.35–0.40` → **`0.01272 ± 0.00050` at
`κ = 0.38`** and `41×` → **`39×`** at all three sites, with the argmax registered as **flat within
noise across `κ ∈ [0.34, 0.42]`** so the single argmax is not over-read; **"the rank identity is
exact" narrowed to per-window and marginal** — the six windows share one `{T(B_j)}` draw, so their
`e`s are positively dependent and **the six-window product is not a martingale in the
shared-reference filtration** (`E[W_6|null]` above the product of marginals by `+20%`/`+19%`
verifier, `+15.8%`/`+14.0%` here at `κ = 0.1`/`0.2`, the discrepancy registered as an
infinite-variance heavy-tailed mean at those `κ` and neither figure quotable as precise; `+0.05%` at
`κ*`, `E[W] < 1` everywhere, discrete conservativeness absorbing it, no endpoint moved), with the
T2 margin re-pinned **`8.3` sd → `8.0` sd** on the measured `sd(S_20|null) = 4.46` rather than the
i.i.d.-exact `4.2586`; **Table 4's `W = 30` row re-provenanced against the scratch record as a
NESTED 40,000-window prefix of probe 2's own canonical arm** — same reference and live seeds, the
first 200 of the same 600 windows, reproduced to five decimals — not a third probe and carrying no
independent weight, with Table 4 as a whole registered as a correlated sensitivity sweep;
`κ*` **pinned at the literal `0.9126`**, where the per-window ceiling is `0.372051` and the
six-window ceiling `2.232306` (v2.K6E's `0.372061` was a mixed evaluation at two different `κ`, and
`0.912608` gives `0.372018` — the verifier's attribution is also not right), and
`ks_critical_at_alpha` pinned at `0.0124150`; and two cleaner statements adopted — **crossing is
structurally impossible for every `κ > 0.8822`** (so `κ*` sits `0.03` inside the region, not at its
edge) and **no substrate split rescues `κ*`** (`m >= 861` blocks = `25,830` B-ticks needed; the
registered 10,000-row substrate maxes at `m = 333`, ceiling `2.4986 < 2.9957`). Names as
not-done: the T2-only validity reading, the one live falsifier, as its own future decision and not a
recommendation; the verifier's replication of the calibration lottery (`12.0%`/500 vs `12.5%`/400
own-`x <= 1`, growth median `0.0039` vs `0.0038`, `3/500` vs `1/400` at the floor, the counts
registered as tail handfuls rather than rates); and the three wiki pages the ruling obliges.
**No endpoint, floor, seed or verdict in §1–14 or in any earlier amendment moves, and no artifact
was created; the whole content of this amendment is a ruling, a strengthened bound, five corrections
to this wave's own text, and a K6 class answer of NO reached without spending a run.**

## Amendment v2.K5R — 2026-08-08, the K5 drift grid re-registered: the old grid tested a shift no detector could reach

Authority: operator directive 2026-08-08 (WORKLIST C42). Committed **before** any artifact this
amendment authorizes: no run, no re-score, no new cell exists at this commit. The code change that
adds the cells below is a separate, later commit on the same branch, and the runs are a separate
task after both.

### K5R.1 The defect, named: what the registered K5 grid actually injects

`injectDrift` (`validation/coverage/lib/inject.mjs:49-51`, `series.map((v, t) => (t >= at ? v +
slope * (t - at) * sigma : v))`) adds `slope*(t-at)*sigma` from the onset. `at = ONSET = 100`,
`T = 300`, `SIGMA = 1` (`run-battery.mjs:75-78`), and the scored post-onset slice is
`TEST = { start: 100, len: 200 }` (`run-battery.mjs:87`), so `(t - at)` runs `0…199` and the
injected component reaches its maximum at the last scored tick `t = 299`.

Three quantities follow, and they are not the same number:

- **terminal shift** (the displacement at end-of-window): `slope * 199 * sigma`;
- **mean shift over the scored window** (what a two-sample mean test sees):
  `slope * (0+1+…+199)/200 = slope * 99.5 * sigma`, exactly half the terminal shift;
- **ramp sd within the window** (the variance the drift adds to the test window):
  `slope * sqrt((200² - 1)/12) = slope * 57.7345 * sigma`.

| registered severity | slope = per-tick increment | terminal shift at `t=299` | mean shift over `TEST` | ramp sd |
|---|---|---|---|---|
| `slope5e-5` | `5e-5 σ` | **`0.009950 σ`** | `0.004975 σ` | `0.002887 σ` |
| `slope1e-4` (canonical) | `1e-4 σ` | **`0.019900 σ`** | `0.009950 σ` | `0.005773 σ` |
| `slope5e-4` | `5e-4 σ` | **`0.099500 σ`** | `0.049750 σ` | `0.028867 σ` |

Every figure above was read off the generator itself on a zero baseline (`injectDrift` called with
`sigma: 1, at: 100, slope`), not re-derived by hand, and each matched its closed form to the printed
precision.

**Quote-and-correct 1, the run report's own post-hoc.** `results/live/run-20260808T010208Z/REPORT.md`
§3 states: *"the canonical `slope1e-4` integrates to a test-window mean shift of `1e-4 * 99.5 =
0.00995σ` and the largest registered slope `slope5e-4` to `0.04975σ`."* Both numbers are right and
both are MEAN shifts. Read as "the cumulative shift", `0.00995σ` understates the canonical cell's
end-of-window displacement by exactly `2×`; the terminal figures are `0.0199σ` and `0.0995σ`. This
amendment registers all three quantities per cell so no later reader has to guess which one a bare
"≈0.01σ" names.

**Quote-and-correct 2, §13's K5 prediction.** §13 registers *"K5. Expected YES via safe-t; genuinely
uncertain. Falsifier: powered < 0.50 at canonical slope for both USE detectors."* The prediction was
met as a measurement and the class answer NO stands for the grid as it was run. What the sentence
does not say, and could not have said before the arithmetic above was written down, is that the
canonical cell's injected mean shift is `0.00995σ` — `75×` smaller than K1's smallest registered step
(`0.75σ`) and `151×` smaller than K1's own canonical (`1.5σ`). The class claim in
`~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md` — a per-tick increment below
every level threshold that an anytime-valid detector should nevertheless accumulate — requires a
cumulative shift that is reachable and a per-tick increment that is not. The registered grid
delivered the second half and not the first. **§13's K5 entry is therefore not withdrawn and not
falsified; it is re-scoped: it was answered against a grid whose largest cell moves the scored window
mean by `0.0498σ`.**

**Quote-and-correct 3, A4's mechanical falsifier.** A4 registers *"K5: falsified iff canonical-cell
(idx 23) detection rate `< 0.50` for both `safe_t` and `universal_inference`."* `idx 23` is the cell
id of `slope1e-4`. K5R.5 moves the canonical to a new cell id, so **A4's `idx 23` is superseded by
`idx 40` for every K5 decision taken after the code commit that follows this amendment**; A4's text
is left intact and its clause remains the correct falsifier shape.

**Not a defect in the run.** The measured rows (`0.0005 / 0.0000 / 0.0005 / 0.0000` for `safe_t`,
`0.0000` throughout for `universal_inference`, `REPORT.md` lines 81-88) are correct measurements of
the registered grid, taken under a frozen design, and they are preserved. The defect is in the grid's
scope, which was registered without this arithmetic written down. §11 rule 7 governs the code change
that follows: a named defect, fixed test-first, prior runs preserved.

### K5R.2 The measured proof that the registered grid tested nothing the class claim is about

A grid whose cells cannot be distinguished from **no injection at all** is not a weak test of the
class claim; it is not a test of it. Measured, paired, on non-registered seeds (probe 3, K5R.7's
method and seed provenance): 14,000 baseline trajectories, each scored twice — once clean, once with
the drift added to the same trajectory — so the only difference between the two arms is the
injection.

| slope | `safe_t` crossing decisions that change vs no injection | `universal_inference` | max abs Δ log e (`safe_t` / UI) |
|---|---|---|---|
| `5e-5` | **0 / 14,000** | **0 / 14,000** | `0.1900` / `0.4268` |
| `1e-4` (old canonical) | **0 / 14,000** | **0 / 14,000** | `0.3818` / `0.8544` |
| `5e-4` | 7 / 14,000 | 3 / 14,000 | `1.9792` / `4.3000` |
| `2.5e-3` | 763 / 14,000 | 126 / 14,000 | `11.3860` / `21.9487` |
| `5e-3` | 8,037 / 14,000 | 411 / 14,000 | `26.5560` / `44.9430` |
| `1e-2` | **13,993 / 14,000** | 27 / 14,000 | `58.5286` / `119.3998` |

At the retired canonical slope, **not one trajectory in 14,000 changes its `e >= 20` decision when
the drift is applied.** The e-values move (`|Δ log e| <= 0.38`), so the cell is not a no-op on the
statistic; it is a no-op on the endpoint. The same probe reads the old cells' detection rates as
indistinguishable from a clean series: `safe_t` `0.00057 ± 0.00020` at `slope5e-5`,
`0.00057 ± 0.00020` at `slope1e-4`, `0.00086 ± 0.00025` at `slope5e-4`, against
**`0.00057 ± 0.00020` with no injection at all** (`8/14,000` in each of the first, second and
no-injection arms — the same count). This is consistent with the committed run's own
`0.0005 / 0.0000 / 0.0005` at `N = 2000`.

### K5R.3 The new grid, derived exactly from the injection formula

Slopes are chosen so the terminal shift lands on `{0.5σ, 1σ, 2σ, 4σ}` to within `0.5%` while the
slope constants stay exact powers-of-ten multiples (`2.5e-3`, `5e-3`, `1e-2`, `2e-2`), spaced by a
factor of two. The generator is **unchanged** — `injectDrift` already takes any slope, `inject.mjs`
is not edited, and `substrate_sha256` therefore stays
`0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf`, the hash every committed run of
this study already records.

`slope = target_terminal / 199`, then rounded to the exact constant below; the realized terminal
shift is `slope * 199`:

| new severity | slope = per-tick increment | terminal shift | mean shift over `TEST` | ramp sd | target |
|---|---|---|---|---|---|
| `slope2.5e-3` | `2.5e-3 σ` | `0.497500 σ` | `0.248750 σ` | `0.144336 σ` | `0.5σ` (`-0.50%`) |
| `slope5e-3` | `5e-3 σ` | `0.995000 σ` | `0.497500 σ` | `0.288672 σ` | `1σ` (`-0.50%`) |
| **`slope1e-2` (canonical)** | `1e-2 σ` | **`1.990000 σ`** | `0.995000 σ` | `0.577343 σ` | `2σ` (`-0.50%`) |
| `slope2e-2` | `2e-2 σ` | `3.980000 σ` | `1.990000 σ` | `1.154686 σ` | `4σ` (`-0.50%`) |

Read off the generator, same method as K5R.1's table: every terminal, mean, sum and ramp-sd figure
matched its closed form to the printed precision.

**The per-tick increment stays far below any level threshold, which is what makes these cells honest
to the class definition.** Against the registered severities of the two level-shift classes:

| comparison | canonical `slope1e-2` per-tick `0.01σ` | largest new cell `slope2e-2` per-tick `0.02σ` |
|---|---|---|
| K1 smallest step `0.75σ` | `75×` smaller | `37.5×` smaller |
| K1 canonical step `1.5σ` | `150×` smaller | `75×` smaller |
| K1 largest step `3σ` | `300×` smaller | `150×` smaller |
| K3 smallest amplitude `0.5σ` | `50×` smaller | `25×` smaller |
| K4 smallest point `3σ` | `300×` smaller | `150×` smaller |
| two-sided `z` at `α = 0.05` (`1.96σ`) | `196×` smaller | `98×` smaller |

No per-tick level rule in this battery, at any registered severity of any class, would respond to a
`0.01σ` or `0.02σ` increment. The class claim is tested by the cumulative displacement; no tick of
these cells is itself detectable.

**Canonical is the `2σ`-terminal cell (`slope1e-2`)**, mid-grid among the four new cells, which is
how every other class picks its canonical: K1's `1.5sigma` is 2nd of 3, K3's `A0.75sigma-f0.05` is
4th of 5, K4's `5sigma-point` is 2nd of 3, K6's `mix-d1.5` is 2nd of 3.

### K5R.4 The old cells are preserved evidence of a different question

The three old grid cells and the old `-ar1` replicate (idx 22-25) **stay registered, stay in the
grid, and are re-measured by the run this amendment authorizes.** They are not withdrawn, not
superseded, and not corrected: they are correct measurements of a `0.0199σ`-terminal drift, which is
a different question from the one the class claim asks. Their committed rows on disk are untouched
(§11 rule 6, append-only). What changes is which cell carries the class decision — K5R.5 — and
K5R.6 registers the one mechanical consequence that has to be handled for the corpus to stay
readable.

### K5R.5 Cell registration (extends §6/§7; nothing in §6's formula shape moves)

Five new cells. `CELL_SEED = BASE_SEED + idx` with `BASE_SEED = 20260807`, §6's formula unchanged;
trajectory seeds `seed(i) = CELL_SEED + 7919*i`, `i = 0…1999`, §6 unchanged; no held-out stream (no
K5 detector calibrates — §6/K3.3's oracle case).

**Index provenance.** Fault cells 0-29 (§6), arms 30-34 (A1, v2.K4 K4.4, v2.K3 K3.6, v2.K6 K6.6),
`K6_T2_SCENARIO_SEED` idx 35 (K6.12, `20260842`, asserted in
`harness/run-clustersynth-arm.mjs:67-68`), `shape_ecdf_conformal_bet` arm idx 36 (K6E.9, `20260843`),
`K6E_T2_SCENARIO_SEED` idx 37 (K6E.10, `20260844`). Indices 36 and 37 were registered by v2.K6E and
its run was cancelled by v2.K6E.17; **a cancelled run does not release a registered index** — reusing
36 or 37 would make two different registrations share a seed. These cells therefore start at 38.

| idx | fault class | severity | φ | `CELL_SEED` | arithmetic |
|---|---|---|---|---|---|
| 38 | K5 | `slope2.5e-3` | 0 | **20260845** | `20260807+38` |
| 39 | K5 | `slope5e-3` | 0 | **20260846** | `20260807+39` |
| **40** | K5 | **`slope1e-2` (canonical)** | 0 | **20260847** | `20260807+40` |
| 41 | K5 | `slope2e-2` | 0 | **20260848** | `20260807+41` |
| 42 | K5 | `slope1e-2-ar1` | 0.6 | **20260849** | `20260807+42` |

**Registered K5 grid, after this amendment** (the order is the cell-table order, which
`assertRegistryAgreement` compares string-for-string against `FAULT_CLASSES.K5.grid`):
`['slope5e-5', 'slope1e-4', 'slope5e-4', 'slope2.5e-3', 'slope5e-3', 'slope1e-2', 'slope2e-2']`,
canonical `slope1e-2`. §1's table and §6's seed table mirror `constants.mjs` and are superseded for
K5's `canonical` and `grid` fields by this section; their text stays intact.

**Severity grammar: unchanged.** `run-battery.mjs:293` parses K5 severities with
`/^slope(\d+(?:\.\d+)?e-\d+)$/`, which already accepts `slope2.5e-3`, `slope5e-3`, `slope1e-2` and
`slope2e-2`. No grammar amendment is needed and none is registered.

**Detector assignment: unchanged.** §7's K5 row (`safe_t`, `universal_inference`) applies to the new
cells with no addition; `detectorsFor` (`run-battery.mjs:510`) needs no edit. No new detector, card,
module or arm is registered by this amendment.

**Two `-ar1` rows in one class, registered deliberately.** §4 gives each class one φ=0.6 replicate of
its own canonical. K5 now carries two: `slope1e-4-ar1` (idx 25, preserved — K5R.4) and
`slope1e-2-ar1` (idx 42, the current canonical's replicate). `assertRegistryAgreement`
(`run-battery.mjs:218-221`) currently demands **exactly one** φ=0.6 row per class whose severity is
`${canonical}-ar1`; the code commit that follows replaces that with three checks, each registered
here: (1) the current canonical's `-ar1` replicate is present; (2) every `-ar1` row's base severity
is a registered grid entry; (3) the per-class `-ar1` row count equals a registered literal table
(`K1 1, K2 1, K3 1, K4 1, K5 2, K6 1`). The third clause is what keeps this from being a loosening —
a stray fourth K5 replicate still crashes the run at startup. §10.1 is untouched: **no `-ar1` cell
decides coverage, either of them.**

**Census after the change**, all figures derived from the assignment above, not retyped from the
current test: 35 fault cells (was 30) and 11 arm rows; 86 fault-class rows (was 76) across
detectors, of which `safe_t` 35 (was 30) and `universal_inference` 23 (was 18); 97 emitted cells
(was 87).

### K5R.6 How the scorer decides K5 after the change, and the two-canonical disambiguation

**The mechanism, at code.** The battery emits a per-cell boolean: `canonicalOf(cell) = cell.severity
=== FAULT_CLASSES[cell.fault_class].canonical` (`run-battery.mjs:281`), written to the cell as
`canonical` (`run-battery.mjs:826`). The scorer keys on that field and on nothing else:
`coverageFor` filters `survivors.filter((c) => c.canonical === true)`, takes
`covering = canonicalCells.find((c) => powerRate(c) >= COVERAGE_FLOOR)` and reports
`canonicalCell = covering ?? canonicalCells[0] ?? null`
(`validation/certification/lib/score.mjs:397-402`), with `powerRate = (c) => c.detection_rate ??
c.rate_e_ge_20` (`score.mjs:17`). `verdict.mjs:272` then requires the card's overall verdict to be
`USE` before a COVERED class counts toward a portfolio YES.

**Registered: `idx 40` (`slope1e-2`, φ=0) is K5's canonical cell**, and it is the only K5 cell that
decides. Every other K5 cell — the three old grid cells, the three other new grid cells, both `-ar1`
replicates — reports context and decides nothing (§8, §10.1).

**The problem this creates, stated exactly.** `loadEvidence` pools every run under
`validation/*/results/live/` with no cross-run dedup (`collect.mjs:311-341`). The committed run
`coverage/run-20260808T010208Z` carries `severity: 'slope1e-4', canonical: true` for both `safe_t`
and `universal_inference`, at `detection_rate` `0.0000`. After the constants change, a new run emits
`canonical: true` at `slope1e-2` and `canonical: false` at `slope1e-4`. Both runs' rows would be
pooled, so **K5 would have two canonical cells per detector, at different severities and different
rates.** With `.find`, a covering new cell still yields COVERED; but when nothing covers,
`canonicalCells[0]` is whichever row `readdir` reached first, and the reported canonical rate is then
indeterminate. Two canonicals is not a state this study is willing to publish either way.

**Registered disambiguation: the mechanism that already exists, used at the granularity it has.**
Amendment v2.C1 C1.6's manifest-declared `supersedes` drops rows per `(study, run, detector)`
(`collect.mjs:217-221, 353-370`); it never touches the superseded directory. The run this amendment
authorizes therefore declares:

```
--supersedes "coverage/run-20260808T010208Z:safe_t,universal_inference,group_average_e_value"
--supersedes-reason "PREREGISTRATION.md Amendment v2.K5R (K5R.5/K5R.6): K5's canonical moved from
  slope1e-4 (idx 23) to slope1e-2 (idx 40), so that run's safe_t and universal_inference rows carry
  canonical: true at a severity that no longer decides the class; this run re-measures every row
  those three detectors had in it, at identical seeds, and carries the current canonical flag."
```

**Registered run scope, and why it makes the supersession lossless.** `--classes K1,K2,K5`. Verified
against the corpus, cell by cell: `coverage/run-20260808T010208Z` is the **sole** surviving source of
`safe_t` K1, `safe_t` K2, `safe_t` K5, `universal_inference` K1, `universal_inference` K5,
`group_average_e_value` K2, and arm 30's healthy/power rows. Its `safe_t`/`universal_inference` K3
rows survive in `run-20260808T091521Z`, its `safe_t`/`family_E` K4 rows in `run-20260808T133859Z`,
and its `safe_t`/`universal_inference` K6 rows in `run-20260808T133746Z` and
`run-20260808T121548Z`. `--classes K1,K2,K5` re-emits exactly the set the supersession drops, so no
`(detector, class)` pair loses its only evidence and no pair gains a duplicate.

**Two machine checks on that run, registered as binding.** (1) Every K1 and K2 row it emits for
those three detectors, and both arm-30 rows, must reproduce the superseded run's numbers
**bit-identically**: the seeds are `CELL_SEED = BASE_SEED + idx` for the same indices, the code path
for those classes is untouched by this amendment, and the new cells sit at indices 38-42, so they
cannot perturb any earlier cell's stream. (2) `substrate_sha256` must equal
`0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf`. A failure of either is a code
defect to report under §11 rule 7 and **blocks the supersession declaration** — a rerun that does not
reproduce what it supersedes is not a rerun.

**Disclosed, because the scope forces it:** `--classes K1,K2,K5` re-emits arm 30
(`group_average_e_value`'s healthy S2 and 3σ power S3 rows). That is a healthy-arm endpoint inside
the run's output. It is not a *changed* endpoint — check (1) covers it, and identical seeds through
identical code must give identical numbers — but the honest statement is that the run touches the
arm by re-measuring it, not that it leaves it alone. See K5R.9.

### K5R.7 Expectations, from a disclosed probe on non-registered seeds

**A disclosed probe** (this document's DISCLOSED convention, K6.4/K3.11/K6E.4). Three probes: two
independent detection-rate probes and one paired decision-flip probe (K5R.2). Scripts live outside
the repo (scratchpad `c42/derive-shift.mjs`, `k5-probe.mjs`, `decision-flip.mjs`, `pool.mjs`,
`safet-arith.mjs`); every number below is reproducible from what this section states.

**Mechanism, copied rather than re-derived.** `rng`, `gaussFrom` and `injectDrift` are imported from
`validation/coverage/lib/inject.mjs` — the registered generators themselves, not a re-implementation.
The AR(1) draw is `run-battery.mjs:302-308`'s `ar1`/`drawFor`, copied verbatim. `T = 300`,
`ONSET = 100`, `SIGMA = 1`, `ALPHA = 0.05`, `THRESHOLD = 20`, `CAL = {0,100}`, `TEST = {100,200}`
are `run-battery.mjs:75-87`'s literals. The two adapters are `run-battery.mjs:353-361`'s, called
identically, including `safeTOpts` (`:347`): `{ ar1Phi: phi }` is passed only when `phi > 0`, so the
φ=0 cells run `safe_t`'s ESTIMATED φ exactly as the battery does. The detectors are the built
artifacts the battery loads (`dist/detectors/safe-t-e-value.js`,
`dist/detectors/universal-inference-e-value.js`).

**Seed provenance.** Probe 1: four blocks based at `3.70e9, 3.71e9, 3.72e9, 3.73e9`, 1,000
trajectories each. Probe 2 (independent): `3.80e9, 3.81e9, 3.82e9, 3.83e9`, 2,500 each. Probe 3
(paired): `3.70e9`, 14,000. All use the harness's own trajectory step 7919, so within-block
independence structure is identical to a registered run's. Maximum seed reached
`3.83e9 + 7919*2499 = 3,849,789,581 < 2^32`, so no seed wraps in `rng`'s `s >>> 0`. **Every seed this
study registers is `<= 1.0e8`**: `CELL_SEED` max `20260849` after K5R.5, trajectory seed max
`20260849 + 7919*1999 = 36,095,130`, `HELDOUT_SEED = CELL_SEED + 500000`, `+104729*k` for K2's series
salt, and even the retired pre-C1 lattice form maxed at `20760841 + 7919*9999 = 99,942,922`. **No
registered seed, and no arithmetic derivation of one, can reach `3.70e9.`** No `CELL_SEED`- or
`HELDOUT_SEED`-derived value was touched.

**Replicates and standard errors.** `n = 4,000` (probe 1) and `n = 10,000` (probe 2) per cell per
detector, `14,000` pooled. Trajectories are independent draws, so the endpoint is a binomial
proportion and the pooled SE is `sqrt(p(1-p)/14000)`; the four-block spread is reported alongside as
a consistency check and agrees with it. Where a cell reads 0 or n, the one-sided 95% rule-of-three
bound `3/14000 = 0.000214` is given instead of an SE of zero.

**Table 1 — `safe_t`, detection rate (`e >= 20` on the windowed terminal read).**

| cell | probe 1 (n=4,000) | probe 2 (n=10,000) | pooled | pooled rate ± SE |
|---|---|---|---|---|
| `slope5e-5` (old) | `4/4000` | `4/10000` | `8/14000` | `0.00057 ± 0.00020` |
| `slope1e-4` (old canonical) | `5/4000` | `3/10000` | `8/14000` | `0.00057 ± 0.00020` |
| `slope5e-4` (old) | `5/4000` | `7/10000` | `12/14000` | `0.00086 ± 0.00025` |
| `slope1e-4-ar1` (old) | `5/4000` | `2/10000` | `7/14000` | `0.00050 ± 0.00019` |
| `slope2.5e-3` | `212/4000` | `513/10000` | `725/14000` | `0.05179 ± 0.00187` |
| `slope5e-3` | `2327/4000` | `5767/10000` | `8094/14000` | `0.57814 ± 0.00417` |
| **`slope1e-2` (canonical)** | `3999/4000` | `10000/10000` | `13999/14000` | **`0.99993 ± 0.00007`** |
| `slope2e-2` | `4000/4000` | `10000/10000` | `14000/14000` | `1.00000` (`>= 0.99979`) |
| `slope1e-2-ar1` | `2473/4000` | `6158/10000` | `8631/14000` | `0.61650 ± 0.00411` |
| no injection (sanity) | `4/4000` | `4/10000` | `8/14000` | `0.00057 ± 0.00020` |

**Table 2 — `universal_inference`, same trajectories.**

| cell | probe 1 | probe 2 | pooled | pooled rate ± SE | median `e` |
|---|---|---|---|---|---|
| `slope5e-5` (old) | `2/4000` | `0/10000` | `2/14000` | `0.00014 ± 0.00010` | `4.8e-2` |
| `slope1e-4` (old canonical) | `2/4000` | `0/10000` | `2/14000` | `0.00014 ± 0.00010` | `4.8e-2` |
| `slope5e-4` (old) | `3/4000` | `1/10000` | `4/14000` | `0.00029 ± 0.00014` | `4.7e-2` |
| `slope1e-4-ar1` (old) | `3/4000` | `1/10000` | `4/14000` | `0.00029 ± 0.00014` | `4.1e-2` |
| `slope2.5e-3` | `53/4000` | `94/10000` | `147/14000` | `0.01050 ± 0.00086` | `2.2e-2` |
| `slope5e-3` | `139/4000` | `315/10000` | `454/14000` | `0.03243 ± 0.00150` | `5.7e-4` |
| **`slope1e-2` (canonical)** | `2/4000` | `20/10000` | `22/14000` | **`0.00157 ± 0.00033`** | `1.4e-12` |
| `slope2e-2` | `0/4000` | `0/10000` | `0/14000` | `0.00000` (`<= 0.00021`) | `2.0e-40` |
| `slope1e-2-ar1` | `43/4000` | `102/10000` | `145/14000` | `0.01036 ± 0.00086` | `1.0e-4` |
| no injection (sanity) | `2/4000` | `0/10000` | `2/14000` | `0.00014 ± 0.00010` | `4.8e-2` |

**Mechanism, `safe_t`: it accumulates the mean.** `safeTwoSampleTEValue`
(`detectors/safe-t-e-value.ts:135-159`) whitens with the calibration-window φ̂, then forms
`t = (mean(w_test) - mean(w_cal)) / (s_p * sqrt(1/n1 + 1/n2))` with `n1 = 99`, `n2 = 200`,
`ν = 297`, and returns `r^(-1/2) * [(1 + t²/ν)/(1 + (t²/ν)/r)]^((ν+1)/2)` with
`r = 1 + n_eff*g`, `n_eff = 99*200/299 = 66.22`, `g = 25` (`DEFAULT_EFFECT_PRIOR_VAR`), so
`r = 1656.5` and `r^(-1/2) = 0.024570`. Setting that expression to 20 and solving gives the crossing
condition **`|t| >= 3.6976`**. The drift supplies a mean shift of `slope*99.5` and inflates the test
window's pooled variance by the ramp (`ramp sd` column, K5R.3), so
`E[t] = slope*99.5 / (sqrt(((n1-1) + (n2-1)*(1 + ramp_var))/297) * 0.12289)`:

| cell | mean shift | ramp var | pooled `s_p²` | `E[t]` | predicted rate `P(\|t\| >= 3.6976)` | probe measured |
|---|---|---|---|---|---|---|
| `slope2.5e-3` | `0.24875σ` | `0.02083` | `1.01396` | `2.010` | `0.0458` | `0.0518 ± 0.0019` |
| `slope5e-3` | `0.49750σ` | `0.08333` | `1.05583` | `3.940` | `0.5957` | `0.5781 ± 0.0042` |
| **`slope1e-2`** | `0.99500σ` | `0.33333` | `1.22334` | `7.321` | `0.9999` | `0.99993 ± 0.00007` |
| `slope2e-2` | `1.99000σ` | `1.33330` | `1.89336` | `11.769` | `1.0000` | `1.00000` |

The predicted column treats `t` as unit-sd about `E[t]`, which is an approximation; it lands within
`12%` of the measurement at every powered cell and undershoots at the retired canonical
(`0.0002` predicted against `0.00057` measured, where the reading is `safe_t`'s own null exceedance
rather than drift power — the no-injection arm reads the same `0.00057`). **A `2σ` cumulative
drift's detectability inside 200 ticks is a computed quantity here, not an expectation.**

**Mechanism, `universal_inference`: the fixed split defeats a ramp, and the e-value is driven below
1.** `universalInferenceMeanShiftEValue` fits the alternative's test-regime mean on
`tTrain = [100,200)` and scores it on `tEval = [200,300)`
(`detectors/universal-inference-e-value.ts:216-226`), while the null's common mean is fitted on the
eval halves themselves (`:223`). The injected component's mean is `slope*49.5` over the train half
and `slope*149.5` over the eval half, so **the plug-in mean is short by exactly `slope*100`** —
`0.25σ`, `0.50σ`, `1.00σ`, `2.00σ` across the four new cells. Measured consequence: UI's median
`e` falls monotonically as the drift grows — `2.2e-2`, `5.7e-4`, `1.4e-12`, `2.0e-40` — i.e. `log e`
of `-3.8, -7.5, -27.3, -91.2`. A crude Gaussian mean-mismatch penalty (`n_eval*mismatch²/2` with
`n_eval = 100`: `3.1, 12.5, 50, 200`) has the right sign and the right ordering and over-predicts the
magnitude by roughly `2×`, because the null's mean is also misfitted; **the arithmetic of the
shortfall is exact, the size of the penalty is measured, and no closed form for it is registered
here.** This is anti-power, not absence of power: UI's rate at the canonical cell (`0.00157`) is
above its own no-injection rate (`0.00014`) only because the smaller-drift tail still helps, and at
`slope2e-2` it is `0/14,000`. Registered as a finding, **not resolved here**: the fixed-split UI is
the wrong instrument for a monotone ramp, and `sequential-ui.ts`'s predictable-plug-in variant
(ADR 0025) is the obvious successor to test. No card, module or claim about `sequential_ui` is
registered by this amendment.

**Registered per-cell predictions for the run, at `N = 2000`.** The probe rate is the point
prediction; the tolerance is `±3` binomial SE **at `N = 2000`** (`sqrt(p(1-p)/2000)`), which is the
run's own sampling noise, not the probe's.

| cell | `safe_t` predicted | tolerance (±3 SE at N=2000) | `universal_inference` predicted | tolerance |
|---|---|---|---|---|
| `slope5e-5` (old) | `0.0006` | `± 0.0016` | `0.0001` | `± 0.0008` |
| `slope1e-4` (old canonical) | `0.0006` | `± 0.0016` | `0.0001` | `± 0.0008` |
| `slope5e-4` (old) | `0.0009` | `± 0.0020` | `0.0003` | `± 0.0011` |
| `slope1e-4-ar1` (old) | `0.0005` | `± 0.0015` | `0.0003` | `± 0.0011` |
| `slope2.5e-3` | `0.0518` | `± 0.0148` | `0.0105` | `± 0.0068` |
| `slope5e-3` | `0.5781` | `± 0.0331` | `0.0324` | `± 0.0119` |
| **`slope1e-2` (canonical)** | **`0.9999`** | `± 0.0006` | **`0.0016`** | `± 0.0026` |
| `slope2e-2` | `1.0000` | `-0.0000/+0` | `0.0000` | `+0.0026/-0` |
| `slope1e-2-ar1` | `0.6165` | `± 0.0326` | `0.0104` | `± 0.0068` |

A reading outside its tolerance is **reported as a deviation, not absorbed**, and does not move any
threshold, grid or falsifier. The old cells' predicted rows are the probe's, not the committed run's;
check (1) of K5R.6 pins those against the committed numbers exactly, which is the stronger test.

### K5R.8 The healthy arms do not change, and why

Every cell this amendment registers is a **power** cell: a fault-injected trajectory scored for
detection rate, contributing to S3 evidence through `coverageFor` and to nothing else. No validity
(S2) arm, no healthy stream, no calibration draw, and no `exceedance`/`mean_e`/`crossing_rate`/
`increment_estimator`/`p_uniformity` field is registered, emitted or moved here. `safe_t` and
`universal_inference` already carry their own S2 evidence from the studies their cards rest on; a new
K5 severity adds no arm and can change no validity endpoint. `ARM_CELLS`
(`run-battery.mjs:193-207`) is not edited, and no `HELDOUT_SEED` is registered — no K5 detector
calibrates. **No new validity arm exists in this amendment.**

The one honest qualification is K5R.6's: the registered run scope re-emits arm 30 because
`group_average_e_value`'s K2 rows and its arm live in the same superseded run. Re-emitting is not
changing; check (1) requires bit-identity.

### K5R.9 Stop conditions

**Unchanged from the standing battery registration.** §9's NOT-EXECUTABLE fallback (adapter throws
on `> 1%` of a cell's trajectories, scoped per `(detector, cell)`), A3c's vacuity rule, and every
validity endpoint in §1-14 and in Amendments v1.1 through v2.K6E.17 stand exactly as written. This
amendment registers power cells only; it touches no validity endpoint and moves no threshold, floor,
seed formula, window partition or decision rule.

**The one cancel-and-refile condition, stated for this run.** If any healthy-arm endpoint the run
emits — arm 30's `exceedance`, `mean_e`, or S2 verdict — differs in any digit from the superseded
run's, the run is **cancelled and refiled**, not interpreted: identical seeds through untouched code
must give identical numbers, so a difference is a code defect, and the amendment authorizing the run
would be describing a run that did not happen. K5R.6's check (1) is the mechanical form of this
condition, and it also covers the K1/K2 fault rows.

### K5R.10 Predicted class answer, with falsifiers

**K5 = YES.** Registered plainly, from the probe's number and the two gates as they are coded:
`safe_t`'s canonical cell (idx 40, `slope1e-2`) is predicted at `0.9999`, above
`COVERAGE_FLOOR = 0.50`, and `safe_t_e_value`'s card verdict is `USE`
(`validation/certification/results/run-20260808T180653Z/COVERAGE.md`, K1 row), so `coverageFor`
reads K5 COVERED for that card and `verdict.mjs:272`'s USE gate passes. The supporting tier is T1.

`universal_inference_e_value` is predicted **NOT_POWERED** at the canonical cell (`0.0016`), so it
does not appear on the YES row, and the class answer rests on one detector.

**Falsifiers, mechanical:**

- **K5's YES is falsified iff the canonical cell (idx 40) reads `detection_rate < 0.50` for both
  `safe_t` and `universal_inference`.** A4's shape, with A4's `idx 23` superseded by `idx 40`.
- The per-detector predictions above are falsified cell by cell by any reading outside its registered
  `±3` SE tolerance. Such a falsification is reported and carries no threshold movement.
- The mechanism claim for `safe_t` (K5R.7) is falsified if the canonical cell's measured rate is
  inconsistent with `|t| >= 3.6976` at `E[t] = 7.321` — concretely, any canonical reading below
  `0.99` would contradict the derivation and is to be reported as such rather than absorbed.

**A failed endpoint is a publishable result and thresholds do not move.** This prediction was
registered from a measurement whose number could equally have been below the floor: `slope5e-3`, one
cell down, reads `0.578` and `slope2.5e-3` reads `0.052`. Had the `2σ` cell landed under `0.50`, the
NO would have been registered here as written.

### K5R.11 Golden expectation

**One expected class-answer delta: `K5 NO -> YES`**, detector `safe_t_e_value`, tier T1, canonical
rate `≈ 1.0000` at severity `slope1e-2`. `COVERAGE.md`'s K5 row moves from
`| K5 | NO | — | — | — |` to a YES row naming `safe_t_e_value`, and the detail line
`K5: NO — best: safe_t_e_value, universal_inference_e_value (2-way tie) NOT_POWERED 0 (verdict USE)`
disappears.

**Expected golden non-deltas:** every card tuple unchanged, including `safe_t_e_value` `USE`/T1 and
`universal_inference_e_value` `USE`/T1 — `coverageFor` is a grouping layer over S3 evidence and no
card's S1/S2/S3/S4 status is a function of a K5 severity. Class answers K1 YES, K2 YES, K3 YES, K4
YES, K6 NO unchanged; C1.12's list is otherwise untouched (and its `K1 NO` entry was already
corrected to YES by C1.2.1). **Any other golden movement is a surprise to report, not to absorb.**

### K5R.12 Named-not-done

- **No wiki page is written by this amendment.** `~/concord/knowledge` is read-only for this task.
  The write-back obligation is named and outstanding: the ratified authority page
  `methodology/pages/fault-class-coverage-matrix.md` states K5's expectation against a grid whose
  cumulative reach it does not quantify, and `stats/` carries no page for the fixed-split UI's
  anti-power against a monotone ramp. Both are for the operator to route.
- **`sequential_ui` is not registered, built, carded or run.** K5R.7 names it as the obvious
  successor for the ramp geometry and stops there.
- **The old cells are not re-scoped as a separate class.** They stay K5 grid cells that decide
  nothing, which is the weakest claim that keeps them readable.
- **No T2 or T3 K5 evidence is registered.** §14's scope limit stands.
- **The `slope5e-3` cell straddles the floor** (`0.578 ± 0.004` probe, `± 0.033` at N=2000). It is a
  grid cell and decides nothing; no attempt is made here to place a cell exactly at the floor, and no
  interpolated "detection threshold slope" is registered.

### K5R.13 House rules, mapped

| rule (`pre-registration-discipline.md`) | how this amendment satisfies it |
|---|---|
| 1. Committed before any data fetched | This amendment commits alone, before the code change that adds the cells and before any run of them. |
| 2. A failed endpoint is publishable; thresholds do not move | K5R.10, stated with the counterfactual that would have produced a NO. |
| 3. Post-hoc analysis labelled, no verdict | The probe is disclosed as a probe on non-registered seeds (K5R.7), and it is the basis of a PREDICTION registered before the run, not a post-hoc reading of one. |
| 4. A fallback rule written in advance | §9, unchanged (K5R.9). |
| 5. Raw downloads frozen | Not applicable (synthetic injection). The equivalent freeze is this amendment plus `substrate_sha256` and the git SHA each run's manifest records. |
| 6. Results append-only, nothing overwritten | K5R.4: old cells and their committed rows are untouched. K5R.6's supersession is a declaration on the NEW run's manifest; the superseded directory is never modified (`collect.mjs:147-149`). |
| 7. Reruns only for a named code defect, fixed test-first, prior run preserved | K5R.1 names the defect (a grid whose scope was registered without its cumulative arithmetic) and K5R.2 measures it (0 decision flips in 14,000 at the retired canonical). The code change lands test-first in its own commit; the prior run is preserved and superseded by declaration, not deletion. |
| 8. The report states every endpoint's number and verdict | Binding on the run's report: every cell in K5R.7's prediction table, old and new, with its measured rate and verdict. |

### Amendment summary

Names, as a scope defect under §11 rule 7, that the registered K5 grid tested a drift no detector
could reach: `injectDrift` adds `slope*(t-at)*sigma` over `(t-at) = 0…199`, so the three registered
slopes reach terminal shifts of `0.00995σ / 0.0199σ / 0.0995σ` and scored-window MEAN shifts of
`0.004975σ / 0.00995σ / 0.04975σ` — the canonical cell moving the window mean by `1/75` of K1's
smallest step. Quote-and-corrects the run report's `0.00995σ` (a mean shift, `2×` below the terminal
displacement a bare "cumulative shift" would name), §13's K5 prediction (re-scoped, not withdrawn:
answered against a grid whose largest cell moves the mean `0.0498σ`), and A4's `idx 23` (superseded
by `idx 40`). Measures the defect rather than arguing it: on 14,000 paired trajectories, **0 change
their `e >= 20` decision** at the retired canonical slope when the drift is applied, and the old
cells' detection rates are the same `8/14,000` as no injection at all. Registers a new grid derived
exactly from the injection formula — `slope2.5e-3 / slope5e-3 / slope1e-2 / slope2e-2`, terminal
shifts `0.4975σ / 0.995σ / 1.99σ / 3.98σ`, canonical the `2σ` cell `slope1e-2` (idx 40, `CELL_SEED
20260847`) — with the per-tick increment `0.01σ` at canonical, `75×` below K1's smallest step and
`196×` below the two-sided `z` at `α = 0.05`, so the class definition's sub-threshold-per-tick
requirement is met by construction. Registers five cells at indices **38-42** (`20260845`-`20260849`),
starting past the indices v2.K6E reserved and its cancellation did not release, with §6's seed
formula, §7's detector assignment (`safe_t`, `universal_inference`) and `run-battery.mjs:293`'s
severity grammar all unchanged, and `inject.mjs` not edited (`substrate_sha256` stays
`0d25265f…349edf`). Keeps the old cells registered and re-measured as **preserved evidence of a
different question** — not withdrawn, not superseded, not corrected — and registers the two-`-ar1`-
rows-in-one-class consequence with a per-class `-ar1` count table so the relaxation cannot hide a
stray cell. Registers the canonical mechanism at code (`canonicalOf` at `run-battery.mjs:281` →
`coverageFor`'s `canonical === true` filter at `score.mjs:397-402` → `verdict.mjs:272`'s USE gate)
and the disambiguation it forces: because `loadEvidence` pools runs with no dedup, the committed
`run-20260808T010208Z` would leave a second canonical K5 cell at `slope1e-4`, so the new run declares
C1.6's manifest `supersedes` on that run for `safe_t`, `universal_inference` and
`group_average_e_value`, at the verified scope `--classes K1,K2,K5` that re-emits exactly the rows
the supersession drops — **one canonical, no orphaned `(detector, class)` pair, no duplicate row** —
gated on two binding checks (bit-identical reproduction of the superseded K1/K2/arm-30 rows, and the
substrate hash), with the arm-30 re-emission disclosed rather than described as untouched. Registers
expectations from a disclosed probe on non-registered seeds (`3.70e9`/`3.80e9` families, harness step
7919, 4,000 + 10,000 trajectories per cell, binomial SEs, four-block spreads shown, no registered
seed reachable above `1.0e8`): `safe_t` `0.0518 / 0.5781 / 0.99993 ± 0.00007 / 1.0000` and
`universal_inference` `0.0105 / 0.0324 / 0.00157 ± 0.00033 / 0.0000` across the four new cells, plus
the φ=0.6 replicate at `0.6165 / 0.0104`, each with the mechanism: `safe_t`'s crossing condition is
`|t| >= 3.6976` and the drift's `E[t]` is `2.010 / 3.940 / 7.321 / 11.769`, predicting
`0.0458 / 0.5957 / 0.9999 / 1.0000` against the measured rates. Discloses, as a finding and not a resolution, that the
fixed-split `universal_inference` is **anti-powered** against a ramp — its alternative's mean is
fitted on `[100,200)` and scored on `[200,300)`, short by exactly `slope*100`, driving median `e` to
`1.4e-12` at the canonical cell and `2.0e-40` at the largest — with the exact shortfall arithmetic
given, the penalty size measured, no closed form registered, and `sequential-ui.ts`'s predictable
plug-in named as the successor to test and nothing more. States that the healthy-arm endpoints do not
change and why (every cell here is a power cell; no arm, no calibration stream, no instrument-named
field), and that stop conditions are unchanged, with the single cancel-and-refile condition written
for this run. **Registers the class answer the probe's number supports, whatever it said: K5 = YES,
canonical `slope1e-2` at `0.9999` with `safe_t_e_value`'s USE card, tier T1 — one expected golden
delta (`K5 NO -> YES`), every card tuple and every other class answer unchanged. No floor, seed
formula, window partition, validity endpoint, stop condition or decision rule in §1-14 or in any
earlier amendment moves.** Names not-done: the two wiki write-backs, `sequential_ui`, any T2/T3 K5
evidence, and any interpolated detection-threshold slope.

## Amendment v2.K5R.1 — 2026-08-08, three corrections to v2.K5R from an independent review, one of them against this document's own claim

Authority: reviewer of the C42 Task-1 artifact (spec PASS, quality APPROVED, one Important finding),
2026-08-08. Committed **before** the code change that acts on it and before any run. Nothing in
v2.K5R's grid, canonical, seeds, probe numbers, predictions or class answer moves.

### K5R.1.1 IMPORTANT — the `-ar1` invariant relaxation IS a loosening, and K5R.5's claim that it is not was false

**Lead with the correction.** K5R.5 states, of the three checks that replaced
`assertRegistryAgreement`'s "exactly one `-ar1` row per class":

> The third clause is what keeps this from being a loosening — a stray fourth K5 replicate still
> crashes the run at startup.

**That is false as written**, and the reviewer proved it with a mutation this amendment reproduces
before quoting it. **Mutation R1:** relabel the preserved cell 25 from `slope1e-4-ar1` to
`slope5e-4-ar1` — one token, no other edit. Result, measured here: `test:coverage-battery`
**90 pass / 0 fail**, `test:cert` **171 pass / 0 fail**. **Both suites stay green.** Under the
pre-K5R assertion (`ar1Rows.length !== 1 || ar1Rows[0].severity !== ${canonical}-ar1`) that same
mutation crashed the harness at startup.

Why the three checks all pass on R1: the count is still 2 (clause 3 counts rows, it does not name
them); `slope5e-4` is a registered grid entry, so clause 2 passes; and cell 42 still carries
`slope1e-2-ar1`, so clause 1 passes. **Cell 42 is pinned by name, φ and `CELL_SEED` in K5R.5's index
table. Cell 25 was pinned nowhere** — the old assertion had been the only thing naming it, and
replacing that assertion removed the pin without replacing it. The count clause bounds *how many*
replicates exist; it says nothing about *which*.

**Registered correction.** K5R.5's index table is extended with the preserved replicate, pinned by
value on the same four fields:

| idx | fault class | severity | φ | `CELL_SEED` | arithmetic |
|---|---|---|---|---|---|
| **25** | K5 | **`slope1e-4-ar1`** | 0.6 | **20260832** | `20260807+25` |

This is the cell §6's own seed table already registers (`| 25 | K5 | slope1e-4-ar1 | 0.6 | 20260832 |`);
what is new is that the harness and its test now assert it, so a relabelling is a startup crash and a
test failure rather than a silent re-registration. The corrected sentence reads: **clause 3 bounds
the number of replicates per class; what stops a replicate being relabelled is the index table, which
now names both of K5's.**

The correction does not change any cell, seed, grid, canonical, prediction or class answer. It changes
what the suite can detect.

### K5R.1.2 K5R.1's ramp-sd constant: `57.7345` → `57.734305`

K5R.1 gives the within-window sd of the injected ramp as
`slope * sqrt((200² - 1)/12) = slope * 57.7345 * sigma`. The constant is
`sqrt(39999/12) = 57.7343052266155`, so `57.7345` is wrong in its fifth significant digit.

**No figure in any table moves.** Every ramp-sd entry in K5R.1 and K5R.3 was read off `injectDrift`
itself, not computed from the quoted constant. Checked at the cell where the discrepancy is largest:
`slope1e-2` reads `0.577343` from the generator, `0.577343` from `57.734305`, and `0.577345` from the
erroneous `57.7345` — the tables carry `0.577343`, the correct value. `slope2e-2`: generator and
correct constant both `1.154686`; the erroneous constant gives `1.154690`; the table carries
`1.154686`. K5R.7's `ramp var` column and the `E[t]` derivation used `(200²-1)/12` in code, not the
quoted decimal, so `E[t]` and every predicted rate stand unchanged.

### K5R.1.3 Minor — the per-block spread of the probe rates, disclosed, with the direction NOT confirmed

The reviewer records that the `universal_inference` probe's block-to-block spread exceeds binomial,
citing `chi2 ≈ 4.1`. Measured on this document's own probe data, across all eight blocks
(4 × 1,000 + 4 × 2,500), Pearson `chi2` at `df = 7`, expected counts from the pooled rate, **reported
only where the approximation is valid (`min np >= 5`)**:

| cell | detector | pooled fires | min expected | `chi2/df` |
|---|---|---|---|---|
| `slope2.5e-3` | `safe_t` | 725 | 51.79 | `0.457` |
| `slope2.5e-3` | `universal_inference` | 147 | 10.50 | **`1.797`** (`chi2 = 12.58`, `p ≈ 0.08`) |
| `slope5e-3` | `safe_t` | 8,094 | 578.14 | `0.855` |
| `slope5e-3` | `universal_inference` | 454 | 32.43 | **`0.588`** (`chi2 = 4.12`) |
| `slope1e-2` (canonical) | `safe_t` | 13,999 | 999.93 | **`1.857`** (`chi2 = 13.00`, `p ≈ 0.072`) |
| `slope1e-2-ar1` | `safe_t` | 8,631 | 616.50 | `0.629` |
| `slope1e-2-ar1` | `universal_inference` | 145 | 10.36 | `0.887` |

Every other (cell, detector) pair has `min np < 5` (the old cells' fires are single digits) or is
degenerate at 0/n, so no `chi2` is quotable for them and none is quoted.

**Three statements, and one of them is a disagreement this amendment does not resolve.**

1. The largest valid `universal_inference` dispersion is `1.797` at `slope2.5e-3` — above binomial,
   `p ≈ 0.08`, not significant at `0.05`.
2. **The `chi2 = 4.12` figure is this document's `slope5e-3` UI row, where `chi2` is BELOW its
   `df = 7`** — under-dispersed, not over. Read as evidence that UI's spread exceeds binomial,
   `4.1` points the other way. Whether the reviewer's `≈4.1` is this statistic at a different `df`
   or a different statistic entirely cannot be determined from what was received.
3. The excess is **not specific to `universal_inference`**: `safe_t` at the canonical cell reads
   `1.857`, the largest dispersion in the table, driven by a single miss (`3999/4000` in probe 1
   against `10000/10000` in probe 2).

**Registered a fortiori, so the disagreement moves nothing.** Inflating **every** registered SE in
K5R.7's prediction table by `sqrt(1.857) = 1.363` — the largest valid dispersion measured, applied
uniformly — widens the canonical bands to `safe_t 0.9999 +0.0001/-0.0008` and
`universal_inference 0.0016 ± 0.0036`, i.e. `[0, 0.0052]`. **No band crosses `COVERAGE_FLOOR = 0.50`,
no predicted verdict changes, and K5R.10's class answer is unaffected.** The registered tolerances
stay as K5R.7 wrote them (binomial); this widened band is registered alongside as the disclosed
alternative reading, and the run's report states the result against both.

### K5R.1.4 Minor — K5R.2's `0 / 14,000` is a measurement on one seed family, not a structural zero

K5R.2 reports 0 of 14,000 paired crossing-decision changes at the retired canonical slope, for both
detectors, on the `3.70e9` family. The reviewer measured **1 in 4,000** `universal_inference` flips at
`slope1e-4` on their own seeds. Checked here on two further families, same method, `n = 14,000` each:

| seed family | `safe_t` flips | `universal_inference` flips | max abs Δ log e (UI) |
|---|---|---|---|
| `3.70e9` (K5R.2's) | 0 | 0 | `0.8544` |
| `3.80e9` | **2** | 0 | `0.6624` |
| `3.90e9` (fresh) | **1** | **1** (`e 19.820 -> 24.354`, seed `3989777703`) | `0.6575` |

**The reviewer is right and K5R.2's phrasing was too strong.** A flip requires a trajectory sitting
within `|Δ log e| <= 0.85` of `log 20`; such trajectories exist and the retired canonical's drift can
push one across. Pooled over the three families measured here — `42,000` paired trajectories —
`safe_t` flips `3` (`7.1e-5`) and `universal_inference` flips `1` (`2.4e-5`).

**The claim that survives, stated quantitatively rather than as a zero:** at the retired canonical
slope the injection changes the `e >= 20` endpoint on the order of `1` trajectory in `10,000` to
`40,000` — the same order as, and below, the endpoint's own no-injection exceedance rate of
`5.7e-4`. The cell's measured detection rate is therefore indistinguishable from the healthy arm's,
which is what K5R.2 was for, and it is not indistinguishable because the effect is exactly zero.
K5R.2's table stands as the `3.70e9` measurement it reports; the words "not one trajectory in
14,000 changes its endpoint" are true of that family and must not be generalized to "no trajectory
can".

### Amendment summary

Three corrections to v2.K5R from an independent review, none of which moves a cell, seed, grid,
canonical, probe number, prediction, tolerance or class answer. **Important:** the `-ar1` invariant
relaxation IS a loosening and K5R.5's sentence claiming otherwise is quoted and corrected —
reproduced here, the reviewer's one-token mutation R1 (preserved cell 25 relabelled
`slope1e-4-ar1` → `slope5e-4-ar1`) leaves `test:coverage-battery` at 90/0 and `test:cert` at 171/0,
where the pre-K5R assertion crashed at startup, because clause 3 counts replicates without naming
them and cell 25 was pinned nowhere once the old assertion was replaced; the correction extends
K5R.5's index table with `[25, slope1e-4-ar1, 0.6, 20260832]` so the harness and its test assert the
preserved replicate by value, and restates the invariant honestly (the count bounds how many
replicates exist; the index table is what stops one being relabelled). Corrects K5R.1's ramp-sd
constant `57.7345` → `57.734305` (`sqrt(39999/12) = 57.7343052266155`), with the verification that no
table figure moves — every entry was read off `injectDrift`, and at the worst cell the tables carry
the generator's `0.577343`, not the erroneous constant's `0.577345`. Discloses the per-block
dispersion of the probe rates under a validity filter (`min np >= 5`, five (cell, detector) pairs
qualify), and **records a disagreement rather than resolving it**: the largest valid
`universal_inference` dispersion is `1.797` at `slope2.5e-3` (`p ≈ 0.08`), the cited `chi2 ≈ 4.1` is
this document's `slope5e-3` UI row where the statistic sits BELOW its `df = 7` (under-dispersed), and
the largest dispersion of all is `safe_t`'s `1.857` at the canonical cell — so the excess is neither
significant nor specific to UI; registered a fortiori, inflating every SE by `sqrt(1.857) = 1.363`
widens the canonical bands to `[0.9991, 1]` and `[0, 0.0052]` and crosses no floor. Discloses that
K5R.2's `0 / 14,000` is a measurement on the `3.70e9` family and not a structural zero: two further
families measured here give `safe_t` `2` and `1` flips and `universal_inference` `0` and `1`
(`e 19.820 -> 24.354` at seed `3989777703`), so the surviving claim is quantitative — the retired
canonical's injection moves the endpoint on the order of `1` trajectory in `10,000`-`40,000`, at or
below the endpoint's own `5.7e-4` no-injection exceedance — and the phrase "not one trajectory in
14,000" is true of one family and must not be read as "no trajectory can".

## Amendment v2.K6A — 2026-08-08, the design gate for the K6-slow accumulator: REFUTED at design time inside the design page's own sweep box

Registered before any artifact of the third registered K6 candidate exists: no detector module, no
card, no adapter, no harness change, no constants-table entry, no run — and, after this amendment,
there will be none. Authority, per this document's own precedence rule:
`~/concord/knowledge/methodology/pages/k6-accumulator.md` (RATIFIED 2026-08-08, the binding design
and the source of every constant this gate was allowed to move) — then this document. Sections 1–14
and every earlier amendment stay intact. **This amendment moves no endpoint, floor, seed,
prediction or verdict belonging to `shape_block_conformal_bet`, to `shape_ecdf_conformal_bet`, or to
any other candidate, and — because the gate fails — it registers no cell, no seed, no scenario, no
golden row and no prediction of its own.** It files a refutation and nothing else, which is what the
design page instructs for this outcome.

**What this amendment is for.** The design page requires a *design gate* computed before anything is
built, and states the bar and its two outcomes in advance. This amendment computes the gate,
registers the sweep verbatim, and states the verdict. **The verdict is the page's own second gate
outcome: no swept configuration inside the page's design space reaches the bar, so the accumulator
claim is refuted at design time and nothing is built.** K6A.7 states that in full, including what it
does and does not refute — and K6A.8 states, with the measurements that decide it, the two specific
changes that would clear the bar, both of which are design-page decisions this document cannot take.

### K6A.1 The claim and the bar, quoted verbatim

From the design page, §"The design gate":

> - **YES requires: predicted detection ≥ 0.50 within H = 3,000 post-onset ticks at the
>   canonical cell** (equivalently, median time-to-cross ≤ H), with the full time-to-detection
>   curve reported. At 1–10 s tick cadence H is roughly 1–8 hours — the operator's stated
>   envelope.

and the outcome rule, same section:

> - Gate outcomes: best-achievable median time-to-cross ≤ H → freeze and build; > H at every
>   swept configuration → the accumulator claim is refuted at design time, filed, nothing
>   built — same discipline that closed the last candidate for free.

and the design space the sweep is authorized to cover, same section:

> The derivation **sweeps the design space** the deploy-gate geometry never let matter:
> window length W (30–150; longer windows see bimodality better), reference block count m
> (with the A/B split and, if needed, an enlarged registered held-out substrate for this
> class — n is a registered constant, not a law), κ chosen for growth, and the feature (CvM
> against Anderson–Darling-weighted and energy-distance variants; one winner registered).
> The known tension is W vs m on a fixed substrate; enlarging the substrate is the honest
> resolution if the derivation needs it.

**The bar this gate is measured against, restated as the single decisive number:** detection of
`wealth >= 20` (`log >= log 20 = 2.995732`) within `H = 3,000` post-onset ticks at the canonical cell
`mix-d1.5`, `>= 0.50`. The healthy budget is `α = 0.05`. `W ∈ {30, 60, 90, 120, 150}` is the page's
range and is treated here as binding: `n` is explicitly *not* a law and was enlarged; `W`'s range is
stated as a range and was not exceeded inside the gate's own verdict (out-of-box `W` is measured and
reported at K6A.8 as disclosed sensitivity, never as a swept configuration the verdict rests on).

### K6A.2 The construction swept, frozen exactly

Same family as `shape_ecdf_conformal_bet` (Amendment v2.K6E): block-conformal rank of a
distribution-distance feature against a held-out reference ECDF fitted on a disjoint segment. What
this gate varies is `W`, the substrate `(n, n_A, m)`, `κ`, and the feature. What it does not vary:
the injection, the calibrator, the rank rule, and the endpoint.

```
substrate      n rows, ONE continuously advanced stream (the post-C1 draw, run-battery.mjs:650-653)
segment A      rows 1..n_A            ->  fixed reference ECDF Fhat_A(x) = (1/n_A)*#{a in A : a <= x}
segment B      rows n_A+1..n_A+m*W    ->  m contiguous DISJOINT blocks of W
live           the post-onset stream, consumed in disjoint W-blocks: N = floor(H/W) windows
p              (1 + #{j : T(B_j) >= T(live)}) / (m + 1)                 tie-inclusive >=, K6.2's rule
e              kappa * p^(kappa - 1),  kappa in (0,1)
log wealth     after t windows = t*log(kappa) + (1-kappa)*S_t,  S_t = SUM_{w<=t}(-log p_w)
detection      P( max_{t <= N} log wealth_t >= log 20 )
```

**The three candidate features, each frozen as an explicit formula.** `x_(1) <= ... <= x_(W)` are
the live window's ascending order statistics; `u_i = Fhat_A(x_(i))`; `A` sorted ascending.

```
CvM      T_cvm(w)    = SUM_{i=1..W} ( i/W - u_i )^2
                       the frozen v2.K6E K6E.2 discrete form, verbatim, i/W convention included

AD       T_ad(w)     = SUM_{i=1..W} ( i/W - u_i )^2 / ( uc_i * (1 - uc_i) )
                       uc_i = min(max(u_i, c), 1-c),  c = 1/(2*n_A)     the Anderson-Darling weight
                       1/(F(1-F)); c is a registered clamp, needed because Fhat_A is exactly 0 or 1
                       for live values outside A's range

energy   T_energy(w) = (2/(W*n_A)) * SUM_{i,j} |x_i - a_j|  -  (1/W^2) * SUM_{i,k} |x_i - x_k|
                       the two-sample energy distance against A with the constant
                       -(1/n_A^2)*SUM|a-a'| term DROPPED: it is identical for every object ranked
                       against the same A, and only the rank is used
```

**Why dropping that term, and the three v2.K6E departures from Anderson (1962), cannot matter here
is unchanged and is not re-derived:** the only use made of `T` is its rank among the `m+1`
exchangeable values, which no additive constant or strictly monotone transformation changes
(K6E.2). **The AD clamp `c` is a real choice, not a rank-irrelevant one** — it is registered as
part of the feature's definition, and the AD variant lost on the endpoint by a wide margin
(K6A.5), so no verdict turns on it.

**Exchangeability, and therefore the null law, is identical for all three features.** Conditional on
`A`, `T(B_1) … T(B_m)` and `T(live)` are i.i.d. under the null (each is the same functional of `W`
draws from the same stationary law against the same fixed `Fhat_A`), so `p` is exactly uniform on the
`m+1` point grid and K6E.3's closed forms hold at every `m` used here:

```
E[log p | null] = ( SUM_{k=1..m+1} log k ) / (m+1) - log(m+1)
E[e | null]     = kappa * (m+1)^(-kappa) * SUM_{k=1..m+1} k^(kappa-1)      < 1 strictly, O(m^(-kappa))
```

### K6A.3 Method, seeds, replicate counts, and the C1 guard on every candidate substrate

**A disclosed probe on non-registered seeds** (this document's DISCLOSED convention, K6.4/K3.11).
Scripts live outside the repo (scratchpad `c49/lib.mjs`, `anchor.mjs`, `box.mjs`, `boundary.mjs`,
`cell.mjs`, `final.mjs`, `headline.mjs`, `hfine.mjs`, `horizon.mjs`, `validity.mjs`, `paired.mjs`);
every number below is reproducible from what this section states.

**Generators, copied verbatim rather than re-derived.** `rng` (the Numerical-Recipes LCG) and
`gaussFrom` from `inject.mjs:14-24`; `ar1`/`drawFor` from `run-battery.mjs:302-308,365`; the
alternative's per-tick draw from `injectShapeMix` (`inject.mjs:60-70`), i.e.
`z = (b ? +d/2 : -d/2) + w*s`, `s = sqrt(max(0, 1 - d^2/4))`, three raw uniforms per tick, at
`SIGMA = 1`; the substrate as ONE continuously advanced stream (`run-battery.mjs:650-653`).

**Seed provenance.** Fresh bands, disjoint from everything already used: substrate
`6.00e8 + 300007*rep + 7919*cfg`, canonical alt live `7.50e8 + …`, healthy live `9.00e8 + …`; the
K6E-reproduction anchor of K6A.4 additionally uses `1.1e9 + {1000003, 7000019, 13000027}*rep`.
Registered seeds are all `<= 1e8` (K6E.4's arithmetic, unchanged); earlier K6 probes used
`1.7e9`/`2.5e9`/`2.6e9`/`3.0e9`/`3.5e9`/`3.7e9`/`3.8e9`/`4.1e9`. **All seeds used here are below
`2^32`, so the LCG's `seed >>> 0` performs no wrap and the stated band is the band actually used.**

**Trajectories come from ONE continuously advanced stream per (reference, arm)**, consumed as
consecutive disjoint blocks — never from arithmetically spaced per-trajectory seeds, which would
rebuild exactly the rank-1 Kronecker lattice Amendment v2.C1 (C1.1) rejects.

**The C1.2 serial-structure guard was RUN on every candidate substrate draw, not assumed.**
`acfAt` and the `HELDOUT_ACF_BOUND = 0.10` bound copied from `run-battery.mjs:595-611`; the guard
throws rather than counting a fallback, and no draw at any `n` from `10,000` to `625,000` was
rejected. Representative readings at the cells the verdict rests on: `n = 100,000` over 250 draws,
mean `acf(1) = -0.00021`, `acf(2) = 0.00020`; `n = 275,000` over 150 draws, `0.00028` / `0.00005`;
`n = 10,000` over 250 draws, `-0.00066` / `0.00002`. **The enlarged draws' lattice-freedom is
checked, not inherited.**

**Standard errors are cluster-robust over references** — the unit of independence is the reference
draw, since every window sharing one reference is dependent through it (the C1.7
calibration-draw lottery) — computed as `sd(per-reference means)/sqrt(R)`.

**Replicate counts.** Sweep box: `R = 100` references × `25` trajectories = **2,500 trajectories per
arm per cell**. Isolated boundary sweeps: `R = 40 × 25 = 1,000`. High-precision cells:
`R = 250 × 20 = 5,000`. **The headline endpoint: 4 disjoint seed offsets × `R = 250 × 20` =
20,000 trajectories per arm** (K6A.6). The design page's bar is a detection rate, so the brief's
`SE <= 0.01` floor is met on the headline by a wide margin and is stated with the between-offset
spread as well as the within-offset SE.

**One disclosed limitation of the registered generator, which no number here rests on.** The
registered `rng` is a 32-bit LCG with a single full-period orbit, so distinct seeds are offsets into
one sequence rather than independent streams. At this probe's consumption (of order `1e8` uniforms
per script against an orbit of `2^32 ≈ 4.3e9`) a small number of segment overlaps among the ~750
streams of a high-precision cell is expected — of order tens of pairs out of ~280,000 — and the
cluster-robust SEs treat references as independent. **Registered as a limitation, not corrected:
it is the harness's own generator, the effect on the variance is of order `1e-4` of the pairs, and
the verdict margin (K6A.7) is a factor of two, not a standard error.**

### K6A.4 Sanity anchors — both required, both passed

**(a) v2.K6E's canonical reading, reproduced inside this harness before any other cell was
trusted.** Same geometry (`W = 30`, `m = 200`, `n_A = 4,000`, CvM, canonical `d = 1.5`), two
independent readings on two different seed bands:

| reading | `x = -E[log p \| alt]` | `κ* = 1/x` | growth `x - 1 - log x` |
|---|---|---|---|
| **v2.K6E, registered (pooled, 360,000 windows)** | **`1.09576 ± 0.00347`** | **`0.9126`** | **`+0.004312`**, CI `[0.003738, 0.004926]` |
| this gate, band `6.0e8`, 250 refs × 20 × 100 windows | `1.09574 ± 0.00514` | `0.912627` | `+0.004310` |
| this gate, band `1.1e9`, 400 refs × 600 windows | `1.08995 ± 0.00434` | `0.917472` | `+0.003818` |

The first reading agrees with the registered value to `2e-5` and the second to `1.05` SE. **The
`2e-5` agreement is coincidence at this precision and is not quoted as a tighter reproduction than
the SEs support; the honest statement is that both readings reproduce `x` within one SE and both
growths sit inside v2.K6E's registered 95% CI.** The anchor passes, so the rest of the sweep is
trusted.

**(b) The exact discrete null law, checked against the closed form rather than against 1**
(K6E.3/K6E.7b's convention: a measured `E[e|null] = 1` would indicate a defect, not health).
At `m = 200`, `W = 30`, 240,000 healthy windows on band `1.1e9`:

| quantity | measured | exact |
|---|---|---|
| mean `p` | `0.501870` | `0.502488` |
| `P(p <= 0.05)` | `0.048100` | `0.049751` |
| `P(p = 1/(m+1))` | `0.004812` | `0.004975` |
| `E[log p]` | `-0.98074 ± 0.00384` | `-0.982234` |
| `E[e]` at `κ = 0.1` | `0.441455` | `0.445371` |
| `E[e]` at `κ = 0.5` | `0.947113` | `0.949741` |
| `E[e]` at `κ* = 0.9126` | `0.997844` | `0.998021` |

Every marginal matches its exact value and **every measured mean `e` sits slightly BELOW the exact
discrete value** (by `0.0002`–`0.004`), i.e. on the conservative side. The same check at the cell the
verdict rests on (`m = 500`, `κ = 0.6820`): exact `E[e|null] = 0.991433`, MC `0.990241`. **`E[e|null]
<= 1` holds by the closed form at every `m` and `κ` this gate considered, so the per-window
calibrator identity is not where this candidate fails.**

### K6A.5 THE SWEEP — the registered box

`H = 3,000`; `N = floor(H/W)` disjoint live windows; canonical cell `mix-d1.5`; `κ*` is the closed
form `1/x` where `x > 1` and "none in (0,1)" where `x <= 1` (K6E.4's structural fact: `x <= 1` means
`E[log e] < 0` at every `κ`, and no calibrator rescues that cell). `drift over H` is
`N * growth` in nats, against `log 20 = 2.995732`. "median t-t-c" is the median time-to-cross in
ticks, and reads `> H` whenever detection `< 0.50` — the two are the same statement, per the page's
own "equivalently".

**Three substrates: `S1` the registered `n = 10,000` with `A = 4,000` unchanged; `S2` the brief's
candidate `n = 40,000` with `A = 10,000 / B = 30,000`; `S3` a further disclosed enlargement
`n = 100,000` with `A = 25,000 / B = 75,000`.** On a fixed substrate `m = floor(B/W)`, which is the
`W`-vs-`m` tension in its exact form. **At `W = 90` the block arithmetic leaves a remainder** —
`floor(6000/90) = 66` blocks consume `5,940` of `S1`'s `6,000` B-rows, so `n` reads `9,940` and 60
rows go unused; the same at `S2`/`S3` (`39,970`, `99,970`). Recorded rather than rounded away, since
v2.K6E registered "no remainder dropped" as a property of its own arithmetic and this sweep cannot
claim it at every `W`.

**Table 1 — the registered box: `W` × substrate × feature, `H = 3,000`, canonical `d = 1.5`, `R = 100` references × 25 trajectories = 2,500 trajectories per arm per cell.**

| substrate | `n` | `n_A` | `W` | `m` | `N` | feature | `x = −E[log p\|alt]` | `κ*` | growth | drift over `H` | detection@`κ*` | median t-t-c | healthy@`κ*` | best on grid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 10000 | 4000 | 30 | 200 | 100 | cvm | 1.09028 ± 0.00826 | 0.9172 | 0.00385 | 0.385 | 0.0100 ± 0.0040 | > H | 0.0008 | 0.1440 @ 0.75 |
| S1 | 10000 | 4000 | 30 | 200 | 100 | ad | 0.96665 ± 0.00778 | none in (0,1) | ≤ 0 | — | — | > H | — | 0.0156 @ 0.7 |
| S1 | 10000 | 4000 | 30 | 200 | 100 | energy | 1.08367 ± 0.00774 | 0.9228 | 0.00332 | 0.332 | 0.0052 ± 0.0017 | > H | 0.0004 | 0.1340 @ 0.75 |
| S1 | 10000 | 4000 | 60 | 100 | 50 | cvm | 1.15066 ± 0.01130 | 0.8691 | 0.01032 | 0.516 | 0.0280 ± 0.0051 | > H | 0.0012 | 0.1448 @ 0.7 |
| S1 | 10000 | 4000 | 60 | 100 | 50 | ad | 1.05999 ± 0.01050 | 0.9434 | 0.00173 | 0.087 | 0.0000 ± 0.0000 | > H | 0.0000 | 0.0652 @ 0.65 |
| S1 | 10000 | 4000 | 60 | 100 | 50 | energy | 1.14286 ± 0.01116 | 0.8750 | 0.00933 | 0.466 | 0.0196 ± 0.0038 | > H | 0.0004 | 0.1420 @ 0.7 |
| S1 | 9940 | 4000 | 90 | 66 | 33 | cvm | 1.21162 ± 0.01560 | 0.8253 | 0.01966 | 0.649 | 0.0524 ± 0.0112 | > H | 0.0032 | 0.1552 @ 0.65 |
| S1 | 9940 | 4000 | 90 | 66 | 33 | ad | 1.13723 ± 0.01455 | 0.8793 | 0.00863 | 0.285 | 0.0028 ± 0.0013 | > H | 0.0000 | 0.0928 @ 0.65 |
| S1 | 9940 | 4000 | 90 | 66 | 33 | energy | 1.20832 ± 0.01545 | 0.8276 | 0.01909 | 0.630 | 0.0512 ± 0.0104 | > H | 0.0040 | 0.1500 @ 0.65 |
| S1 | 10000 | 4000 | 120 | 50 | 25 | cvm | 1.26586 ± 0.01719 | 0.7900 | 0.03011 | 0.753 | 0.0644 ± 0.0139 | > H | 0.0032 | 0.1444 @ 0.6 |
| S1 | 10000 | 4000 | 120 | 50 | 25 | ad | 1.20844 ± 0.01672 | 0.8275 | 0.01911 | 0.478 | 0.0232 ± 0.0065 | > H | 0.0004 | 0.1076 @ 0.6 |
| S1 | 10000 | 4000 | 120 | 50 | 25 | energy | 1.27308 ± 0.01724 | 0.7855 | 0.03164 | 0.791 | 0.0736 ± 0.0135 | > H | 0.0028 | 0.1612 @ 0.6 |
| S1 | 10000 | 4000 | 150 | 40 | 20 | cvm | 1.36911 ± 0.02189 | 0.7304 | 0.05495 | 1.099 | 0.1208 ± 0.0191 | > H | 0.0088 | 0.1904 @ 0.6 |
| S1 | 10000 | 4000 | 150 | 40 | 20 | ad | 1.32438 ± 0.01996 | 0.7551 | 0.04344 | 0.869 | 0.0748 ± 0.0153 | > H | 0.0040 | 0.1484 @ 0.6 |
| S1 | 10000 | 4000 | 150 | 40 | 20 | energy | 1.37930 ± 0.02144 | 0.7250 | 0.05772 | 1.154 | 0.1388 ± 0.0209 | > H | 0.0076 | 0.1996 @ 0.55 |
| S2 | 40000 | 10000 | 30 | 1000 | 100 | cvm | 1.11228 ± 0.00454 | 0.8991 | 0.00587 | 0.587 | 0.0292 ± 0.0045 | > H | 0.0020 | 0.1660 @ 0.75 |
| S2 | 40000 | 10000 | 30 | 1000 | 100 | ad | 0.98347 ± 0.00460 | none in (0,1) | ≤ 0 | — | — | > H | — | 0.0168 @ 0.7 |
| S2 | 40000 | 10000 | 30 | 1000 | 100 | energy | 1.10245 ± 0.00434 | 0.9071 | 0.00492 | 0.492 | 0.0184 ± 0.0031 | > H | 0.0008 | 0.1564 @ 0.75 |
| S2 | 40000 | 10000 | 60 | 500 | 50 | cvm | 1.19018 ± 0.00602 | 0.8402 | 0.01608 | 0.804 | 0.0696 ± 0.0064 | > H | 0.0016 | 0.1848 @ 0.7 |
| S2 | 40000 | 10000 | 60 | 500 | 50 | ad | 1.07898 ± 0.00671 | 0.9268 | 0.00296 | 0.148 | 0.0000 ± 0.0000 | > H | 0.0000 | 0.0652 @ 0.65 |
| S2 | 40000 | 10000 | 60 | 500 | 50 | energy | 1.18581 ± 0.00622 | 0.8433 | 0.01538 | 0.769 | 0.0676 ± 0.0068 | > H | 0.0024 | 0.1804 @ 0.7 |
| S2 | 39970 | 10000 | 90 | 333 | 33 | cvm | 1.27688 ± 0.00952 | 0.7832 | 0.03246 | 1.071 | 0.1292 ± 0.0128 | > H | 0.0040 | 0.2096 @ 0.65 |
| S2 | 39970 | 10000 | 90 | 333 | 33 | ad | 1.19027 ± 0.00972 | 0.8401 | 0.01609 | 0.531 | 0.0164 ± 0.0033 | > H | 0.0004 | 0.1172 @ 0.65 |
| S2 | 39970 | 10000 | 90 | 333 | 33 | energy | 1.27721 ± 0.00933 | 0.7830 | 0.03253 | 1.074 | 0.1260 ± 0.0125 | > H | 0.0052 | 0.2192 @ 0.65 |
| S2 | 40000 | 10000 | 120 | 250 | 25 | cvm | 1.34966 ± 0.00914 | 0.7409 | 0.04981 | 1.245 | 0.1504 ± 0.0107 | > H | 0.0084 | 0.2216 @ 0.6 |
| S2 | 40000 | 10000 | 120 | 250 | 25 | ad | 1.28279 ± 0.00989 | 0.7796 | 0.03375 | 0.844 | 0.0720 ± 0.0076 | > H | 0.0028 | 0.1724 @ 0.6 |
| S2 | 40000 | 10000 | 120 | 250 | 25 | energy | 1.35716 ± 0.00913 | 0.7368 | 0.05177 | 1.294 | 0.1636 ± 0.0109 | > H | 0.0084 | 0.2348 @ 0.6 |
| S2 | 40000 | 10000 | 150 | 200 | 20 | cvm | 1.43187 ± 0.01243 | 0.6984 | 0.07289 | 1.458 | 0.2076 ± 0.0136 | > H | 0.0068 | 0.2620 @ 0.55 |
| S2 | 40000 | 10000 | 150 | 200 | 20 | ad | 1.38420 ± 0.01215 | 0.7224 | 0.05908 | 1.182 | 0.1420 ± 0.0105 | > H | 0.0068 | 0.2280 @ 0.55 |
| S2 | 40000 | 10000 | 150 | 200 | 20 | energy | 1.44801 ± 0.01279 | 0.6906 | 0.07782 | 1.556 | 0.2356 ± 0.0148 | > H | 0.0084 | 0.2868 @ 0.55 |
| S3 | 100000 | 25000 | 30 | 2500 | 100 | cvm | 1.11915 ± 0.00317 | 0.8935 | 0.00658 | 0.658 | 0.0448 ± 0.0045 | > H | 0.0016 | 0.1852 @ 0.75 |
| S3 | 100000 | 25000 | 30 | 2500 | 100 | ad | 0.98714 ± 0.00314 | none in (0,1) | ≤ 0 | — | — | > H | — | 0.0136 @ 0.75 |
| S3 | 100000 | 25000 | 30 | 2500 | 100 | energy | 1.11136 ± 0.00329 | 0.8998 | 0.00578 | 0.578 | 0.0336 ± 0.0039 | > H | 0.0008 | 0.1696 @ 0.75 |
| S3 | 100000 | 25000 | 60 | 1250 | 50 | cvm | 1.20438 ± 0.00481 | 0.8303 | 0.01842 | 0.921 | 0.0936 ± 0.0072 | > H | 0.0040 | 0.2044 @ 0.65 |
| S3 | 100000 | 25000 | 60 | 1250 | 50 | ad | 1.09089 ± 0.00461 | 0.9167 | 0.00390 | 0.195 | 0.0000 ± 0.0000 | > H | 0.0000 | 0.0596 @ 0.65 |
| S3 | 100000 | 25000 | 60 | 1250 | 50 | energy | 1.19863 ± 0.00477 | 0.8343 | 0.01745 | 0.873 | 0.0880 ± 0.0066 | > H | 0.0024 | 0.1996 @ 0.65 |
| S3 | 99970 | 25000 | 90 | 833 | 33 | cvm | 1.29092 ± 0.00650 | 0.7746 | 0.03556 | 1.174 | 0.1416 ± 0.0090 | > H | 0.0060 | 0.2252 @ 0.65 |
| S3 | 99970 | 25000 | 90 | 833 | 33 | ad | 1.19886 ± 0.00663 | 0.8341 | 0.01749 | 0.577 | 0.0256 ± 0.0036 | > H | 0.0020 | 0.1140 @ 0.6 |
| S3 | 99970 | 25000 | 90 | 833 | 33 | energy | 1.29205 ± 0.00635 | 0.7740 | 0.03582 | 1.182 | 0.1476 ± 0.0087 | > H | 0.0052 | 0.2328 @ 0.65 |
| S3 | 100000 | 25000 | 120 | 625 | 25 | cvm | 1.36365 ± 0.00740 | 0.7333 | 0.05349 | 1.337 | 0.1672 ± 0.0100 | > H | 0.0080 | 0.2372 @ 0.6 |
| S3 | 100000 | 25000 | 120 | 625 | 25 | ad | 1.29243 ± 0.00751 | 0.7737 | 0.03591 | 0.898 | 0.0736 ± 0.0065 | > H | 0.0040 | 0.1660 @ 0.6 |
| S3 | 100000 | 25000 | 120 | 625 | 25 | energy | 1.37074 ± 0.00734 | 0.7295 | 0.05539 | 1.385 | 0.1784 ± 0.0099 | > H | 0.0072 | 0.2504 @ 0.6 |
| S3 | 100000 | 25000 | 150 | 500 | 20 | cvm | 1.43763 ± 0.00795 | 0.6956 | 0.07464 | 1.493 | 0.1912 ± 0.0102 | > H | 0.0060 | 0.2468 @ 0.6 |
| S3 | 100000 | 25000 | 150 | 500 | 20 | ad | 1.38026 ± 0.00843 | 0.7245 | 0.05799 | 1.160 | 0.1248 ± 0.0091 | > H | 0.0032 | 0.1932 @ 0.55 |
| S3 | 100000 | 25000 | 150 | 500 | 20 | energy | 1.45377 ± 0.00813 | 0.6879 | 0.07961 | 1.592 | 0.2184 ± 0.0105 | > H | 0.0064 | 0.2724 @ 0.55 |

**Reading Table 1, registered.** Detection at `κ*` rises monotonically in `W` at every substrate and
monotonically in the substrate at every `W`, and **the maximum anywhere in the box is at `S3`,
`W = 150`, energy** — the box's own 2,500-trajectory reading of that cell is `0.2184 ± 0.0105` at its
sample's `κ* = 0.6879`, with the maximum over the whole `κ` grid at that cell `0.2724`. **That same
cell is re-measured at 20,000 trajectories with `κ` frozen in K6A.6, where it reads
`0.2493 ± 0.0052`; the `2.6` SE gap between the two is the `κ*`-re-estimation coupling K6A.6
documents and removes, and the higher figure is the one the verdict is stated against.** **The median
time-to-cross reads `> H` in all 45 rows of the box.**

**The scaling that decides the gate, measured and stated as arithmetic.** The `d = 1.5` mixture's
per-window evidence at `W = 30` is the `1.0958` nats v2.K6E already registered; at `W = 150` it is
`1.45`–`1.48` nats. **The design page's offered hypothesis — "`E[log p|alt]` grows superlinearly in
`W`" — is measured here and is NOT confirmed: `x - 1` grows very slightly SUBlinearly in `W`.** On the
isolated-`W` sweep the ratio `(x-1)/W` *declines* monotonically-in-trend across a 25× range of `W`,
from `3.63e-3` to `2.65e-3` (CvM) and `3.23e-3` to `2.90e-3` (energy); the `W = 150 / W = 30` ratio of
`x - 1` is `4.22` (CvM) and `4.91` (energy) against the `5.0` exact linearity would give. What *is*
superlinear is the growth criterion built from it, because `g(κ*) = x - 1 - log x ≈ (x-1)²/2` near
`x = 1`, so `g` grows about quadratically in `W`. Against that, the window count `N = floor(H/W)`
falls as `1/W`. **Net: the total drift available in a fixed horizon, `N·g`, grows roughly LINEARLY in
`W`** — measured `0.441, 0.859, 1.028, 1.552, 1.730` nats at `W = 30, 60, 90, 120, 150` (energy),
continuing `2.015, 2.361, 2.515, 2.811, 3.231` at `W = 200, 250, 300, 400, 500`. **The endpoint needs
`log 20 = 2.9957`. At the top of the page's `W` range the drift available is `1.73` nats — short by a
factor of `1.73` — and the drift first reaches `log 20` at `W ≈ 445`.** That is the gate, in one
line: the accumulator is not short of horizon-per-window or of reference, it is short of window
length, and the page's range stops at `150`.

**The `W`-vs-`m` trade, as measured rather than asserted.** On the registered substrate `S1` the
trade is severe: `m = floor(6000/W)` falls from `200` at `W = 30` to `40` at `W = 150`, and the rank
floor `1/(m+1)` coarsens with it. At `W = 150` the registered substrate reads `x = 1.37930 ± 0.02144`
with detection `0.1388 ± 0.0209` (energy), against `x = 1.45377 ± 0.00813` and detection
`0.2184 ± 0.0105` at the same `W` on `S3`'s `m = 500`. **So enlarging the substrate is worth roughly
`+0.08` in `x` and `+0.08` in detection at `W = 150` — real, and nowhere near the factor of two the
bar needs.** Table `m` isolates it: `x` saturates by `m ≈ 500` (`1.4884`, `1.4861`, `1.4686`,
`1.4771` at `m = 500, 1000, 2000, 4000`, flat within their SEs), so **`B >= 500W = 75,000` rows
exhausts what reference count can buy at `W = 150`, and `m` beyond that buys nothing.** Table `nA`
isolates the reference size: `x` moves from `1.4659` at `n_A = 2,000` to `1.4678` at
`n_A = 100,000`, **flat across a 50× range** — the reference ECDF's own estimation error is not a
binding constraint at these `W`. **Registered consequence: the substrate is not the reason this
candidate fails.** The design page anticipated the opposite failure mode — "the sweep may find the
substrate cannot supply enough reference at the W the fault needs" — and that is not the mechanism
that fired; `n = 100,000` with `A = 25,000 / B = 75,000` saturates the design, and the binding
constraint is `W` against `H`. The page's own text needs that correction at write-back (K6A.11).

**The feature winner, on a paired comparison.** All three features are evaluated on the IDENTICAL
substrate draws and the IDENTICAL trajectories, so the difference is a paired per-reference quantity
and its SE is far smaller than the difference of the two marginal SEs. At the in-box best cell
(`n_A = 25,000`, `m = 500`, `W = 150`, 250 refs × 20):

| comparison | at `κ = 0.55` | at `κ* = 0.6807` |
|---|---|---|
| energy − CvM | `+0.0222 ± 0.0038` (`t = 5.87`) | `+0.0212 ± 0.0040` (`t = 5.34`) |
| CvM − AD | `+0.0462 ± 0.0051` (`t = 9.12`) | `+0.0480 ± 0.0051` (`t = 9.49`) |
| energy − AD | `+0.0684 ± 0.0053` (`t = 12.99`) | `+0.0692 ± 0.0050` (`t = 13.74`) |

**Registered feature ordering inside the box: energy > CvM > AD, and the energy-over-CvM margin is
real rather than a tie** (`t = 5.3`–`5.9` paired), so the design page's tie-break toward CvM does not
apply and is not invoked. **The Anderson–Darling-weighted variant is the worst of the three at every
in-box cell, and at `W = 30` it is anti-informative outright** (`x = 0.96665 ± 0.00778 < 1` on `S1`,
`0.98347` on `S2`, `0.98714` on `S3`: no `κ ∈ (0,1)` has positive growth). Mechanism, registered:
the `d = 1.5` mixture at matched mean and variance has *thinner* tails than its Gaussian reference
(components `N(±0.75, 0.6614²)`, so `P(|Z| > 3) = 1.7e-4` against the normal's `1.35e-3`) and its
departure is concentrated in the shoulders and the central dip, which is exactly where AD's
`1/(F(1-F))` weight is smallest. **The ordering reverses out of box at `W >= 400`** (Table `W`: AD
`0.4540` vs energy `0.4550` at `W = 400`; AD `0.5710` vs energy `0.5480` at `W = 500`), where a
window is long enough for its extreme order statistics to carry the tail difference. Disclosed
because it is the one place the feature ranking is not stable, and no verdict rests on it.

**Table 2 — `W` isolated (`m = 500`, `n_A = 25,000` held fixed, so `W` is separated from `m`; `R = 40 × 25 = 1,000`). `W > 150` is OUT OF BOX and is disclosed sensitivity, not a swept configuration the verdict rests on.**

| `n_A` | `m` | `W` | `n` | `N` | feature | `x = −E[log p\|alt]` | `κ*` | growth | drift over `H` | detection@`κ*` | median t-t-c | healthy@`κ*` | best on grid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25000 | 500 | 30 | 40000 | 100 | cvm | 1.10895 ± 0.00677 | 0.9018 | 0.00554 | 0.554 | 0.0230 ± 0.0057 | > H | 0.0040 | 0.1610 @ 0.75 |
| 25000 | 500 | 30 | 40000 | 100 | ad | 0.97767 ± 0.00652 | none in (0,1) | ≤ 0 | — | — | > H | — | 0.0140 @ 0.7 |
| 25000 | 500 | 30 | 40000 | 100 | energy | 1.09683 ± 0.00676 | 0.9117 | 0.00441 | 0.441 | 0.0100 ± 0.0031 | > H | 0.0010 | 0.1410 @ 0.75 |
| 25000 | 500 | 60 | 55000 | 50 | cvm | 1.19634 ± 0.00894 | 0.8359 | 0.01707 | 0.854 | 0.0640 ± 0.0089 | > H | 0.0020 | 0.1770 @ 0.7 |
| 25000 | 500 | 60 | 55000 | 50 | ad | 1.09195 ± 0.00864 | 0.9158 | 0.00398 | 0.199 | 0.0000 ± 0.0000 | > H | 0.0000 | 0.0520 @ 0.65 |
| 25000 | 500 | 60 | 55000 | 50 | energy | 1.19701 ± 0.00957 | 0.8354 | 0.01718 | 0.859 | 0.0670 ± 0.0115 | > H | 0.0050 | 0.1800 @ 0.65 |
| 25000 | 500 | 90 | 70000 | 33 | cvm | 1.27065 ± 0.01046 | 0.7870 | 0.03112 | 1.027 | 0.1080 ± 0.0140 | > H | 0.0060 | 0.1760 @ 0.65 |
| 25000 | 500 | 90 | 70000 | 33 | ad | 1.17609 ± 0.01089 | 0.8503 | 0.01389 | 0.458 | 0.0090 ± 0.0034 | > H | 0.0000 | 0.0860 @ 0.65 |
| 25000 | 500 | 90 | 70000 | 33 | energy | 1.27077 ± 0.01014 | 0.7869 | 0.03115 | 1.028 | 0.1030 ± 0.0137 | > H | 0.0060 | 0.1900 @ 0.65 |
| 25000 | 500 | 120 | 85000 | 25 | cvm | 1.38727 ± 0.01243 | 0.7208 | 0.05993 | 1.498 | 0.2220 ± 0.0183 | > H | 0.0110 | 0.2950 @ 0.55 |
| 25000 | 500 | 120 | 85000 | 25 | ad | 1.31422 ± 0.01148 | 0.7609 | 0.04098 | 1.024 | 0.1010 ± 0.0124 | > H | 0.0030 | 0.2060 @ 0.6 |
| 25000 | 500 | 120 | 85000 | 25 | energy | 1.39484 ± 0.01353 | 0.7169 | 0.06206 | 1.552 | 0.2530 ± 0.0211 | > H | 0.0110 | 0.3040 @ 0.6 |
| 25000 | 500 | 150 | 100000 | 20 | cvm | 1.46000 ± 0.01400 | 0.6849 | 0.08156 | 1.631 | 0.2420 ± 0.0164 | > H | 0.0070 | 0.2920 @ 0.6 |
| 25000 | 500 | 150 | 100000 | 20 | ad | 1.40465 ± 0.01345 | 0.7119 | 0.06486 | 1.297 | 0.1730 ± 0.0148 | > H | 0.0060 | 0.2440 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | energy | 1.47553 ± 0.01400 | 0.6777 | 0.08651 | 1.730 | 0.2710 ± 0.0166 | > H | 0.0090 | 0.3100 @ 0.55 |
| 25000 | 500 | 200 | 125000 | 15 | cvm | 1.57836 ± 0.01632 | 0.6336 | 0.12197 | 1.830 | 0.2730 ± 0.0202 | > H | 0.0050 | 0.3140 @ 0.55 |
| 25000 | 500 | 200 | 125000 | 15 | ad | 1.55870 ± 0.01733 | 0.6416 | 0.11485 | 1.723 | 0.2630 ± 0.0199 | > H | 0.0060 | 0.3070 @ 0.55 |
| 25000 | 500 | 200 | 125000 | 15 | energy | 1.61148 ± 0.01655 | 0.6205 | 0.13433 | 2.015 | 0.3270 ± 0.0204 | > H | 0.0090 | 0.3560 @ 0.55 |
| 25000 | 500 | 250 | 150000 | 12 | cvm | 1.71509 ± 0.01699 | 0.5831 | 0.17563 | 2.108 | 0.3340 ± 0.0192 | > H | 0.0030 | 0.3590 @ 0.5 |
| 25000 | 500 | 250 | 150000 | 12 | ad | 1.72692 ± 0.01708 | 0.5791 | 0.18058 | 2.167 | 0.3580 ± 0.0214 | > H | 0.0030 | 0.3820 @ 0.5 |
| 25000 | 500 | 250 | 150000 | 12 | energy | 1.76470 ± 0.01760 | 0.5667 | 0.19672 | 2.361 | 0.3930 ± 0.0212 | > H | 0.0050 | 0.4100 @ 0.5 |
| 25000 | 500 | 300 | 175000 | 10 | cvm | 1.83034 ± 0.02147 | 0.5463 | 0.22584 | 2.258 | 0.3370 ± 0.0221 | > H | 0.0070 | 0.3530 @ 0.5 |
| 25000 | 500 | 300 | 175000 | 10 | ad | 1.86923 ± 0.02192 | 0.5350 | 0.24370 | 2.437 | 0.4120 ± 0.0234 | > H | 0.0090 | 0.4170 @ 0.5 |
| 25000 | 500 | 300 | 175000 | 10 | energy | 1.88598 ± 0.02139 | 0.5302 | 0.25153 | 2.515 | 0.4080 ± 0.0221 | > H | 0.0090 | 0.4100 @ 0.5 |
| 25000 | 500 | 400 | 225000 | 7 | cvm | 2.10383 ± 0.02568 | 0.4753 | 0.36007 | 2.521 | 0.3920 ± 0.0232 | > H | 0.0090 | 0.3950 @ 0.4 |
| 25000 | 500 | 400 | 225000 | 7 | ad | 2.18046 ± 0.02796 | 0.4586 | 0.40092 | 2.806 | 0.4540 ± 0.0244 | > H | 0.0090 | 0.4550 @ 0.4 |
| 25000 | 500 | 400 | 225000 | 7 | energy | 2.18171 ± 0.02655 | 0.4584 | 0.40160 | 2.811 | 0.4550 ± 0.0241 | > H | 0.0090 | 0.4550 @ 0.4584 |
| 25000 | 500 | 500 | 275000 | 6 | cvm | 2.32296 ± 0.02662 | 0.4305 | 0.48012 | 2.881 | 0.4560 ± 0.0206 | > H | 0.0030 | 0.4580 @ 0.4 |
| 25000 | 500 | 500 | 275000 | 6 | ad | 2.44173 ± 0.02817 | 0.4095 | 0.54903 | 3.294 | 0.5710 ± 0.0208 | 3000 | 0.0030 | 0.5720 @ 0.4 |
| 25000 | 500 | 500 | 275000 | 6 | energy | 2.42393 ± 0.02854 | 0.4126 | 0.53854 | 3.231 | 0.5480 ± 0.0208 | 3000 | 0.0050 | 0.5480 @ 0.4126 |
| 25000 | 500 | 600 | 325000 | 5 | cvm | 2.63782 ± 0.03554 | 0.3791 | 0.66786 | 3.339 | 0.5710 ± 0.0266 | 3000 | 0.0090 | 0.5710 @ 0.3791 |
| 25000 | 500 | 600 | 325000 | 5 | ad | 2.81405 ± 0.03615 | 0.3554 | 0.77942 | 3.897 | 0.6740 ± 0.0229 | 2400 | 0.0100 | 0.6740 @ 0.3554 |
| 25000 | 500 | 600 | 325000 | 5 | energy | 2.78078 ± 0.03699 | 0.3596 | 0.75805 | 3.790 | 0.6540 ± 0.0250 | 3000 | 0.0110 | 0.6540 @ 0.3596 |
| 25000 | 500 | 750 | 400000 | 4 | cvm | 2.98587 ± 0.03776 | 0.3349 | 0.89198 | 3.568 | 0.6190 ± 0.0258 | 3000 | 0.0090 | 0.6190 @ 0.3349 |
| 25000 | 500 | 750 | 400000 | 4 | ad | 3.21840 ± 0.03859 | 0.3107 | 1.04951 | 4.198 | 0.7380 ± 0.0233 | 2250 | 0.0100 | 0.7400 @ 0.4 |
| 25000 | 500 | 750 | 400000 | 4 | energy | 3.17171 ± 0.03798 | 0.3153 | 1.01744 | 4.070 | 0.7220 ± 0.0215 | 3000 | 0.0100 | 0.7230 @ 0.4 |

**Table 3 — `m` isolated (`W = 150`, `n_A = 25,000` held fixed; `R = 40 × 25 = 1,000`).**

| `n_A` | `m` | `W` | `n` | `N` | feature | `x = −E[log p\|alt]` | `κ*` | growth | drift over `H` | detection@`κ*` | median t-t-c | healthy@`κ*` | best on grid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25000 | 40 | 150 | 31000 | 20 | cvm | 1.36728 ± 0.03966 | 0.7314 | 0.05446 | 1.089 | 0.1580 ± 0.0383 | > H | 0.0070 | 0.2240 @ 0.6 |
| 25000 | 40 | 150 | 31000 | 20 | ad | 1.30563 ± 0.03558 | 0.7659 | 0.03895 | 0.779 | 0.0880 ± 0.0254 | > H | 0.0040 | 0.1730 @ 0.55 |
| 25000 | 40 | 150 | 31000 | 20 | energy | 1.37855 ± 0.03734 | 0.7254 | 0.05752 | 1.150 | 0.1830 ± 0.0367 | > H | 0.0060 | 0.2380 @ 0.6 |
| 25000 | 100 | 150 | 40000 | 20 | cvm | 1.39397 ± 0.02410 | 0.7174 | 0.06181 | 1.236 | 0.1440 ± 0.0214 | > H | 0.0090 | 0.2160 @ 0.6 |
| 25000 | 100 | 150 | 40000 | 20 | ad | 1.35289 ± 0.02561 | 0.7392 | 0.05065 | 1.013 | 0.1090 ± 0.0215 | > H | 0.0110 | 0.1810 @ 0.6 |
| 25000 | 100 | 150 | 40000 | 20 | energy | 1.41121 ± 0.02444 | 0.7086 | 0.06676 | 1.335 | 0.1720 ± 0.0258 | > H | 0.0090 | 0.2280 @ 0.6 |
| 25000 | 200 | 150 | 55000 | 20 | cvm | 1.42321 ± 0.01725 | 0.7026 | 0.07029 | 1.406 | 0.1900 ± 0.0232 | > H | 0.0060 | 0.2350 @ 0.55 |
| 25000 | 200 | 150 | 55000 | 20 | ad | 1.36867 ± 0.01626 | 0.7306 | 0.05483 | 1.097 | 0.1030 ± 0.0154 | > H | 0.0040 | 0.1900 @ 0.55 |
| 25000 | 200 | 150 | 55000 | 20 | energy | 1.43712 ± 0.01661 | 0.6958 | 0.07448 | 1.490 | 0.2120 ± 0.0241 | > H | 0.0100 | 0.2640 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | cvm | 1.47344 ± 0.01373 | 0.6787 | 0.08584 | 1.717 | 0.2510 ± 0.0182 | > H | 0.0080 | 0.3040 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | ad | 1.42509 ± 0.01319 | 0.7017 | 0.07086 | 1.417 | 0.1880 ± 0.0156 | > H | 0.0070 | 0.2580 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | energy | 1.48837 ± 0.01472 | 0.6719 | 0.09069 | 1.814 | 0.2810 ± 0.0197 | > H | 0.0100 | 0.3250 @ 0.55 |
| 25000 | 1000 | 150 | 175000 | 20 | cvm | 1.47183 ± 0.01214 | 0.6794 | 0.08532 | 1.706 | 0.2610 ± 0.0157 | > H | 0.0090 | 0.2990 @ 0.6 |
| 25000 | 1000 | 150 | 175000 | 20 | ad | 1.41539 ± 0.01158 | 0.7065 | 0.06799 | 1.360 | 0.1890 ± 0.0145 | > H | 0.0060 | 0.2540 @ 0.55 |
| 25000 | 1000 | 150 | 175000 | 20 | energy | 1.48606 ± 0.01177 | 0.6729 | 0.08993 | 1.799 | 0.2810 ± 0.0162 | > H | 0.0100 | 0.3240 @ 0.55 |
| 25000 | 2000 | 150 | 325000 | 20 | cvm | 1.45047 ± 0.01134 | 0.6894 | 0.07858 | 1.572 | 0.2280 ± 0.0162 | > H | 0.0040 | 0.2870 @ 0.55 |
| 25000 | 2000 | 150 | 325000 | 20 | ad | 1.40040 ± 0.01299 | 0.7141 | 0.06364 | 1.273 | 0.1650 ± 0.0152 | > H | 0.0040 | 0.2400 @ 0.55 |
| 25000 | 2000 | 150 | 325000 | 20 | energy | 1.46860 ± 0.01126 | 0.6809 | 0.08429 | 1.686 | 0.2640 ± 0.0169 | > H | 0.0030 | 0.3200 @ 0.55 |
| 25000 | 4000 | 150 | 625000 | 20 | cvm | 1.45638 ± 0.01075 | 0.6866 | 0.08043 | 1.609 | 0.2270 ± 0.0132 | > H | 0.0100 | 0.2830 @ 0.55 |
| 25000 | 4000 | 150 | 625000 | 20 | ad | 1.40473 ± 0.01260 | 0.7119 | 0.06488 | 1.298 | 0.1590 ± 0.0128 | > H | 0.0030 | 0.2320 @ 0.55 |
| 25000 | 4000 | 150 | 625000 | 20 | energy | 1.47707 ± 0.01090 | 0.6770 | 0.08701 | 1.740 | 0.2670 ± 0.0142 | > H | 0.0070 | 0.3190 @ 0.55 |

**Table 4 — `n_A` isolated (`W = 150`, `m = 500` held fixed; `R = 40 × 25 = 1,000`).**

| `n_A` | `m` | `W` | `n` | `N` | feature | `x = −E[log p\|alt]` | `κ*` | growth | drift over `H` | detection@`κ*` | median t-t-c | healthy@`κ*` | best on grid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2000 | 500 | 150 | 77000 | 20 | cvm | 1.45222 ± 0.02474 | 0.6886 | 0.07913 | 1.583 | 0.2480 ± 0.0268 | > H | 0.0070 | 0.2790 @ 0.6 |
| 2000 | 500 | 150 | 77000 | 20 | ad | 1.40593 ± 0.02542 | 0.7113 | 0.06523 | 1.305 | 0.1880 ± 0.0249 | > H | 0.0030 | 0.2530 @ 0.55 |
| 2000 | 500 | 150 | 77000 | 20 | energy | 1.46594 ± 0.02605 | 0.6822 | 0.08344 | 1.669 | 0.2760 ± 0.0297 | > H | 0.0080 | 0.3110 @ 0.6 |
| 4000 | 500 | 150 | 79000 | 20 | cvm | 1.42899 ± 0.01744 | 0.6998 | 0.07202 | 1.440 | 0.1860 ± 0.0187 | > H | 0.0070 | 0.2440 @ 0.55 |
| 4000 | 500 | 150 | 79000 | 20 | ad | 1.40068 ± 0.01752 | 0.7139 | 0.06372 | 1.274 | 0.1620 ± 0.0174 | > H | 0.0060 | 0.2340 @ 0.55 |
| 4000 | 500 | 150 | 79000 | 20 | energy | 1.44544 ± 0.01728 | 0.6918 | 0.07703 | 1.541 | 0.2130 ± 0.0206 | > H | 0.0080 | 0.2620 @ 0.6 |
| 10000 | 500 | 150 | 85000 | 20 | cvm | 1.43736 ± 0.01336 | 0.6957 | 0.07455 | 1.491 | 0.1970 ± 0.0177 | > H | 0.0060 | 0.2510 @ 0.6 |
| 10000 | 500 | 150 | 85000 | 20 | ad | 1.39280 ± 0.01346 | 0.7180 | 0.06148 | 1.230 | 0.1410 ± 0.0127 | > H | 0.0040 | 0.2020 @ 0.55 |
| 10000 | 500 | 150 | 85000 | 20 | energy | 1.45263 ± 0.01248 | 0.6884 | 0.07925 | 1.585 | 0.2170 ± 0.0171 | > H | 0.0060 | 0.2730 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | cvm | 1.47344 ± 0.01373 | 0.6787 | 0.08584 | 1.717 | 0.2510 ± 0.0182 | > H | 0.0080 | 0.3040 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | ad | 1.42509 ± 0.01319 | 0.7017 | 0.07086 | 1.417 | 0.1880 ± 0.0156 | > H | 0.0070 | 0.2580 @ 0.55 |
| 25000 | 500 | 150 | 100000 | 20 | energy | 1.48837 ± 0.01472 | 0.6719 | 0.09069 | 1.814 | 0.2810 ± 0.0197 | > H | 0.0100 | 0.3250 @ 0.55 |
| 50000 | 500 | 150 | 125000 | 20 | cvm | 1.47877 ± 0.01498 | 0.6762 | 0.08756 | 1.751 | 0.2740 ± 0.0209 | > H | 0.0130 | 0.3090 @ 0.55 |
| 50000 | 500 | 150 | 125000 | 20 | ad | 1.43028 ± 0.01647 | 0.6992 | 0.07241 | 1.448 | 0.2100 ± 0.0201 | > H | 0.0100 | 0.2610 @ 0.55 |
| 50000 | 500 | 150 | 125000 | 20 | energy | 1.49365 ± 0.01518 | 0.6695 | 0.09243 | 1.849 | 0.3030 ± 0.0225 | > H | 0.0120 | 0.3350 @ 0.6 |
| 100000 | 500 | 150 | 175000 | 20 | cvm | 1.45327 ± 0.01748 | 0.6881 | 0.07945 | 1.589 | 0.2340 ± 0.0224 | > H | 0.0030 | 0.2880 @ 0.55 |
| 100000 | 500 | 150 | 175000 | 20 | ad | 1.39785 ± 0.01553 | 0.7154 | 0.06292 | 1.258 | 0.1440 ± 0.0171 | > H | 0.0050 | 0.2190 @ 0.55 |
| 100000 | 500 | 150 | 175000 | 20 | energy | 1.46780 ± 0.01761 | 0.6813 | 0.08404 | 1.681 | 0.2650 ± 0.0240 | > H | 0.0030 | 0.3090 @ 0.6 |


**Provenance of Tables 2–4, stated so no row is double-counted as independent evidence** (the defect
v2.K6E.17.3(c) corrected in the previous wave, avoided here by checking rather than by assuming).
The three isolated sweeps were separate invocations that assign their seed offsets by position
within their own sweep. **Table 3's `m = 500` row and Table 4's `n_A = 25,000` row are therefore the
IDENTICAL sample, not two measurements of it** — same substrate, alt and healthy streams, reading
`x = 1.48837 ± 0.01472` (energy) in both. Table 2's `W = 150` row is a different offset
(`x = 1.47553 ± 0.01400`), and the box's `S3`/`W = 150` row a third (`1.45377 ± 0.00813`). **Every
row within one table is a genuinely separate computation, and rows across tables that name the same
`(n_A, m, W)` are related as stated above and nowhere else.** No verdict rests on Tables 2–4: they
locate the boundaries, and the verdict rests on K6A.6's own 20,000-trajectory measurement.

### K6A.6 The best-achievable cell, measured at the precision the verdict needs

**The best-achievable configuration inside the design page's sweep box**, on the endpoint the page's
coverage rule actually tests:

```
W       = 150            the top of the page's registered range
n       = 100,000        enlarged substrate (the page: "n is a registered constant, not a law")
A / B   = 25,000 / 75,000
m       = 500            = floor(75000/150), and m is SATURATED here (Table m)
feature = energy distance against Fhat_A, the form frozen at K6A.2
kappa*  = 0.6820         = 1/x, closed form, chosen for GROWTH, on the x pooled over three earlier
                           independent-offset samples of this cell (1.4884 +- 0.0147, 1.4538 +- 0.0081,
                           1.46902 +- 0.00588 -> 1.4662 +- 0.0071 after inflating for a chi2 of 4.85
                           on 2 df, i.e. the over-dispersion is carried rather than assumed away)
H       = 3,000  ->  N = 20 disjoint windows of 150
```

**`κ*` is frozen as a literal from the pooled `x` BEFORE the headline endpoint was measured, and the
headline was then measured on four fresh, disjoint seed offsets at that fixed `κ`.** This is
deliberate: re-estimating `κ*` from the same sample that reports the detection rate couples the two,
and an earlier pass of this gate saw `det@κ*` move `0.218`–`0.281` across samples whose own
cluster-robust SEs were `0.008`–`0.011`, purely because `κ*` moved with the sampled `x`. **The
headline below has that circularity removed.** The headline sample's own `x = 1.46793` implies
`1/x = 0.68123`, `0.0008` from the frozen literal; the `κ` grid's local slope is about `-0.85` per
unit `κ`, so the difference is worth `< 0.001` in detection — disclosed, not corrected.

| offset | `x` | detection-within-`H` | healthy `H`-crossing |
|---|---|---|---|
| 1001 | `1.46851 ± 0.00602` | `0.2548 ± 0.0091` | `0.0104 ± 0.0014` |
| 1002 | `1.45831 ± 0.00610` | `0.2350 ± 0.0084` | `0.0088 ± 0.0013` |
| 1003 | `1.47656 ± 0.00578` | `0.2586 ± 0.0083` | `0.0072 ± 0.0013` |
| 1004 | `1.46834 ± 0.00602` | `0.2488 ± 0.0086` | `0.0096 ± 0.0014` |
| **all four, 20,000 trajectories/arm** | **`1.46793`** | **`0.2493`** | **`0.0090`** |

**Registered headline, with the wider of the two uncertainties quoted:** cluster-robust SE over all
1,000 references is `0.0043`; the between-offset sd is `0.0104`, giving SE of the mean `0.0052`, a
`1.5×` over-dispersion on the cluster-robust figure. **Detection-within-`H` = `0.2493 ± 0.0052`.**
The same cell's CvM reading at its own frozen `κ = 0.6931` is `0.2177 ± 0.0033`.

**Median time-to-cross: `> H = 3,000`, censored — 4,986 of 20,000 trajectories crossed at all, so the
median trajectory never crosses inside the horizon.** Of those that did cross, the crossing tick
quartiles are `p25 = 1,650`, `p50 = 2,250`, `p75 = 2,700`. **The full time-to-detection curve at
`κ*`** (ticks : detection, 5,000 trajectories):

```
 150:0.000   300:0.000   450:0.000   600:0.001   750:0.003   900:0.009  1050:0.013  1200:0.023
1350:0.034  1500:0.050  1650:0.066  1800:0.082  1950:0.101  2100:0.123  2250:0.145  2400:0.165
2550:0.188  2700:0.211  2850:0.231  3000:0.254
```

**Two structural facts about this cell, registered because they distinguish it from both earlier K6
candidates.** (1) **The wealth ceiling is NOT binding.** Per-window ceiling
`log κ* + (1-κ*)·log(m+1) = -0.382668 + 0.318 × 6.216606 = 1.594213` nats, so over `N = 20` windows
the ceiling is `31.88` nats against `log 20 = 2.9957`; a crossing is arithmetically possible from
window 2 onward (`t = 1` is unreachable — `max S_1 = log 501 = 6.2166 < c_1(κ*) = 10.62` — and
`c_2(κ*) = 11.83 <= max S_2 = 12.43`), which the time-to-detection curve confirms by being nonzero
from `450`–`600` ticks. **Neither v2.K6 nor v2.K6E died of insufficient evidence rate; both died of
an arithmetic ceiling at a 6-window horizon. This candidate has no ceiling problem and dies of the
evidence rate itself** — a different refutation, reached on a different quantity, and the reason the
over-all-`κ` ceiling bound machinery of K6E.17.2 is not the argument here. (2) **The drift-only
estimate is pessimistic and is not what was reported.** `ceil(log 20 / g) = ceil(2.995732/0.084064)
= 36` windows `= 5,400` ticks on drift alone, whereas the measured horizon at which detection reaches
`0.50` is `≈ 4,650` ticks (K6A.8) — variance brings the median crossing in earlier than the drift
line, so **quoting `log 20 / g` as a time-to-detection would have understated this candidate**, and
every number in this amendment's verdict is a measured first-passage distribution, not a drift
extrapolation.

**The `κ` grid at that cell, so no reader concludes another `κ` would have delivered the floor**
(detection / healthy, 5,000 trajectories, energy):

```
0.05:0.001/0.000  0.1:0.012/0.002  0.2:0.052/0.005  0.3:0.140/0.010  0.4:0.219/0.014
0.5:0.280/0.015   0.55:0.294/0.017 0.6:0.293/0.015  0.65:0.276/0.012 0.6807:0.254/0.009
0.7:0.234/0.008   0.75:0.168/0.004 0.8:0.085/0.001  0.85:0.016/0.000 0.88:0.003/0.000
0.9:0.000/0.000   0.92:0.000/0.000 0.94:0.000/0.000 0.96:0.000/0.000 0.98:0.000/0.000
```

**The grid maximum is `0.294 ± 0.0087` at `κ = 0.55`** (an independent sample of the same cell reads
`0.3046 ± 0.0089`), attained on a plateau that is flat within noise across `κ ∈ [0.5, 0.6]` and
`0.05`-spaced through the maximum — so no unswept `κ` plausibly hides a factor-of-1.7 improvement.
**Registered: over the whole admissible `κ` range, the best in-box detection is `≈ 0.30`, against
`COVERAGE_FLOOR = 0.50`.** Choosing `κ = 0.55` over the growth-derived `κ* = 0.6820` would be
selecting a constant on the endpoint after seeing the numbers, which the design page's own rule
forbids ("κ chosen for growth"); it is reported and not adopted, exactly as v2.K6E.11 reported and
declined its own `κ ≈ 0.35`. **The class answer is the same under either rule.**

### K6A.7 THE GATE VERDICT — refuted at design time, nothing built

Mapped against the design page's two registered outcomes, verbatim:

1. *"best-achievable median time-to-cross ≤ H → freeze and build"* — **NOT the measured result.**
   The median time-to-cross is `> H` at **every one of the 45 configurations in the box**, and at the
   best-achievable cell it is censored with detection `0.2493 ± 0.0052` against the required `0.50`.
2. *"> H at every swept configuration → the accumulator claim is refuted at design time, filed,
   nothing built"* — **THIS IS THE MEASURED RESULT. REGISTERED GATE VERDICT: FAIL.**

**REGISTERED RULING: the K6-slow accumulator claim is REFUTED AT DESIGN TIME inside the design
page's own sweep box. No detector module, card, adapter, harness change, constants-table entry, run
or result is created; no cell, seed, scenario, golden row or prediction is registered by this
amendment. The K6-slow row does not enter the coverage matrix. `K6` stays `NO`, and no run was
spent to learn it.** The design page's coverage rule for this row ("YES iff card USE and canonical
detection `>= 0.50` within `H`") has a determined answer before any artifact exists: **NO**, by a
factor of `2.0` on detection at the growth-derived `κ*` and `1.7` at the grid maximum.

**What this refutes, stated precisely, and what it does not.**

- **Refuted:** that this construction family, swept over `W ∈ {30…150}`, any substrate up to
  `n = 625,000`, any `κ ∈ (0,1)` and the three registered features, reaches detection `0.50` within
  `H = 3,000` post-onset ticks at the canonical cell.
- **NOT refuted, and explicitly not claimed:** that the construction is uninformative. It is
  strongly informative — `x = 1.468`, i.e. `x − 1` at `125` SE on the pooled between-offset SE `0.0037`, growth `+0.0841` nats/window, `19.5×` the
  growth v2.K6E measured at its own geometry and `1.7×` the design page's own `0.05` nats/window
  marginality floor. The mechanism claim the design page rests on (a CvM-type statistic accumulates
  where a kurtosis statistic cancels) is confirmed, and confirmed more strongly than at `W = 30`.
- **NOT refuted:** that an accumulator in this family can reach the bar at all. **It can, and this
  gate located where** — two measured routes, K6A.8, both outside what the page authorizes.
- **Untouched:** the deploy-gate K6 answer (`NO`, two attempts, `k6-ecdf-successor`), every K6/K6E
  registration, and every other candidate's endpoints.

**The one-attempt rule is satisfied by this refutation exactly as it would have been by a run.** A
fourth K6 candidate — or this construction at a wider `W` range or a longer `H` — is a new decision
page, not a retune of this one.

### K6A.8 What would have to change, measured rather than speculated

Two routes reach the bar. Both are changes to constants the design page fixes, so **neither is taken
here and neither is registered**; they are recorded because a refutation that cannot say what would
have worked is not a finding.

**Route 1 — the same configuration, a longer horizon. `H ≈ 4,650` ticks instead of `3,000`
(`1.55×`).** Detection and the healthy page rate read at the same `H` on the same 5,000 trajectories
(`W = 150`, `m = 500`, `n_A = 25,000`, energy, `κ* = 0.6807`):

| `H` (ticks) | detection (`d = 1.5`) | healthy page rate |
|---|---|---|
| 3,000 | `0.2678 ± 0.0089` | `0.0076 ± 0.0013` |
| 3,900 | `0.3982 ± 0.0105` | `0.0110 ± 0.0016` |
| 4,350 | `0.4620 ± 0.0110` | `0.0126 ± 0.0017` |
| **4,800** | **`0.5146 ± 0.0113`** | `0.0144 ± 0.0018` |
| 5,700 | `0.6106 ± 0.0117` | `0.0164 ± 0.0019` |
| 7,500 | `0.7472 ± 0.0109` | `0.0218 ± 0.0024` |

Linear interpolation puts detection `= 0.50` at `H ≈ 4,675` ticks. **At `1–10 s` cadence that is
`1.3`–`13` hours against the page's stated `1`–`8` hour envelope, and the healthy page rate at that
`H` is `0.013`, comfortably inside `α = 0.05`.** So the bar is missed by a factor of `1.56` in
horizon, not by an order of magnitude — the closest any K6 candidate has come.

**Route 2 — the same horizon, a longer window. `W ≈ 500` instead of `150` (`3.3×` the page's upper
bound), on a `275,000`-row substrate.** High-precision (`R = 150 × 34 = 5,100` trajectories/arm,
`n_A = 25,000`, `m = 500`, `H = 3,000`):

| `W` | `n` | `N` | feature | `x` | `κ*` | detection-within-`H` | median t-t-c | healthy |
|---|---|---|---|---|---|---|---|---|
| 500 | 275,000 | 6 | CvM | `2.36109 ± 0.01541` | `0.4235` | `0.5029 ± 0.0128` | **3,000** | `0.0088 ± 0.0014` |
| 500 | 275,000 | 6 | energy | `2.47219 ± 0.01592` | `0.4045` | `0.5851 ± 0.0123` | **3,000** | `0.0102 ± 0.0015` |
| 500 | 275,000 | 6 | AD | `2.48824 ± 0.01599` | `0.4019` | `0.5918 ± 0.0119` | **3,000** | `0.0098 ± 0.0014` |
| 600 | 325,000 | 5 | AD | `2.77683 ± 0.01858` | `0.3601` | `0.6594 ± 0.0120` | **2,400** | `0.0043 ± 0.0010` |
| 600 | 325,000 | 5 | energy | `2.74756 ± 0.01818` | `0.3640` | `0.6445 ± 0.0125` | 3,000 | `0.0039 ± 0.0009` |

**All three features clear `0.50` at `W = 500` with the healthy rate at `≈ 0.01`.** Three costs are
registered with it, none of them dismissable: the substrate is `275,000` rows per metric per
coordinate (`27.5×` the registered `10,000`; at `1–10 s` cadence, `3`–`32` days of clean history);
the horizon holds only `N = 6` windows, so the time-to-detection curve has six points and the
earliest possible page is at `1,000` ticks (window 2); and `κ* ≈ 0.40` puts the calibrator's tail
index `1/(1-κ*) ≈ 1.67 < 2`, so `Var[e]` is infinite and the terminal-mean estimator has no CLT
backing — the same infinite-variance fact K6.7/K3.1.3 register for `κ = 0.1`, which is why the
verdict field on such an arm would have to stay `crossing_rate`-derived.

**Both routes are design-page decisions.** `H = 3,000` and `W ∈ [30, 150]` are the page's, this
document cannot overrule a ratified page (the precedence rule, and v2.K6E.17.1's precedent), and
adopting either after seeing these numbers would be selecting a constant on the endpoint. **Filed as
the two things that would have to change, with their measured numbers and their costs, and with the
write-back named at K6A.11.**

### K6A.9 A second, independent obstacle the sweep surfaced: the α = 0.05 unbounded-horizon claim does not hold at κ near 1

The design page's claim for this class is anytime validity: *"the 5% false-page budget holds over an
unbounded horizon with no repeated-look penalty."* **That claim is not established for a
block-conformal accumulator with a single fixed reference, and at the `κ` the growth rule selects at
small `W` it is measurably false.** This is registered as a finding of the gate, independent of the
detection verdict.

**The mechanism, stated as arithmetic.** Ville's inequality needs a nonnegative supermartingale.
Conditional on the substrate `S` — the one held-out draw the whole run shares — the live windows are
i.i.d. with per-window mean `mu(S) = E[e | null, S]`, so `E[W_t] = E_S[ mu(S)^t ]`. **`E[e|null] <= 1`
marginally, exactly, by the discrete law (K6A.2/K6A.4b) — but that is `E_S[mu(S)]`, and
`E_S[mu(S)^t] -> infinity` whenever `P(mu(S) > 1) > 0`.** Worse for the page rate: whenever a
reference's own null GROWTH `log κ + (1-κ)·E[-log p | null, S]` is positive, the wealth process on
that reference drifts up and crosses any threshold with probability `1` given enough windows. This is
v2.K6E.17.3(b)'s "the six-window product is not a martingale in the shared-reference filtration",
measured at the horizon an always-on accumulator actually runs at.

**Measured (250 references × 2 healthy trajectories, crossing of `20` tracked to 90,000 ticks):**

| cell | refs with `mu_hat(S) > 1` | refs with own null growth `> 0` | healthy crossing by 3,000 | 9,000 | 30,000 | 90,000 |
|---|---|---|---|---|---|---|
| **`W=30, m=200, n_A=4000`, CvM, `κ* = 0.9126`** (v2.K6E's own geometry) | 97/250 | **48/250** | `0.0080` | **`0.0480`** | **`0.1580`** | **`0.2080`** |
| `W=150, m=500, n_A=25000`, energy, `κ* = 0.6807` | 70/250 | **0/250** | `0.0100` | `0.0180` | `0.0220` | `0.0220` |
| `W=150, m=500, n_A=25000`, energy, `κ = 0.55` | 68/250 | **0/250** | `0.0140` | `0.0180` | `0.0180` | `0.0180` |

**Registered readings.** (1) **At `κ* = 0.9126`, `W = 30`, `m = 200` the healthy page rate reaches
`α = 0.05` by `9,000` ticks and `0.208` by `90,000`, still rising, against a claimed budget of
`0.05` over an UNBOUNDED horizon — `4.2×` over budget and not a bounded excess.** The limiting rate
is governed by `P(null growth > 0) = 48/250 = 19.2%`, and the mean healthy log wealth at that cell
still *falls* (`-15.48` at 90,000), so the paging is entirely the unlucky-substrate tail, not a
drift the average run shows. (2) **At the `κ ≈ 0.55–0.68` the winning cell selects, `0/250`
references have positive null growth** (margin `-0.070`, per-reference sd `0.017`, `4.1` sd) **and the
healthy crossing saturates at `0.018`–`0.022 <= α`.** The obstacle is a `κ → 1` phenomenon:
`-log κ/(1-κ) -> 1` as `κ -> 1` while `E[-log p|null] -> 1` from below, so the margin that keeps the
null drift negative vanishes and the per-reference spread swamps it. (3) **Consequence for the
obvious successor idea, registered so it is not proposed as free:** "take v2.K6E's configuration,
which had positive growth `+0.0043` nats/window, and just run it for `21,000` ticks" **does not
work** — the horizon probe reads detection `0.5750 ± 0.0417` at 21,000 ticks on that cell against a
healthy page rate of `0.1240 ± 0.0250` at the same horizon, i.e. it buys power by spending `2.5×` the
whole false-page budget. (4) The correct repairs are a larger `m`, a `κ` bounded away from `1`, or a
reference that is re-drawn rather than fixed; **the third changes the construction and is not in this
family. None is adopted here.**

**This finding does not change the gate verdict** (the winning cell's null side is intact, `0/250`
and `<= α`), and it moves no registered endpoint of any candidate: v2.K6E's arms were cancelled by
v2.K6E.17.1 before any run, so there is no `shape_ecdf_conformal_bet` validity number on the record
for this to correct. **It is registered as the reason a κ-selection rule that reads only growth is
unsafe for an always-on accumulator, and as a write-back obligation (K6A.11).**

### K6A.10 Limitations of this gate, disclosed

- **The sweep is at the canonical cell only.** `d = 1.5`, `φ = 0`. No `d = 1.0`, `d = 2.0` or
  `-ar1` grid was run: the gate's bar is stated at the canonical cell, the gate failed there, and
  measuring the rest of a grid for a refuted candidate would spend compute to no verdict. v2.K6E's
  own per-cell findings (`d = 1.0` anti-informative at `W = 30`; `d = 2.0` a two-point boundary
  artifact at `s = 0` exactly; `-ar1` strongly anti-informative because `injectShapeMix` replaces
  AR(1) values with i.i.d. draws while the reference stays AR(1)) are cited, not re-derived, and
  none of them is a reason the canonical bar was missed.
- **No T2 clustersynth arm was run**, and none is registered. The T2 validity question — whether the
  contiguity construction survives independent telemetry, the question that killed
  `shape-kurtosis-e-value.ts` (C22) — remains exactly where v2.K6E.17.4 left it: named-not-done, its
  own decision, and now with K6A.9 as an additional reason it matters.
- **The AD clamp `c = 1/(2 n_A)` and the dropped constant term in the energy statistic are
  registered choices**, not derivations. The energy term is provably rank-irrelevant; the AD clamp is
  not, and the AD variant lost by `t = 9`–`14` paired, so no verdict depends on it.
- **Cluster-robust SEs treat reference draws as independent**, which the single-orbit LCG makes
  approximately rather than exactly true (K6A.3). The headline quotes the wider between-offset
  spread for this reason.
- **`E[log p|null]` was measured against its exact value at every cell and matched**, but the
  measured values sit systematically `0.001`–`0.004` *below* the exact discrete `E[e|null]`, i.e.
  conservative. Not diagnosed further; the direction cannot inflate a detection rate.

### K6A.11 House rules, mapped

Per `~/concord/knowledge/methodology/pages/pre-registration-discipline.md`: (1) **committed before
any artifact it authorizes** — at this commit there is no K6-slow module, card, adapter, harness
change, run or result, and this amendment authorizes none; the amendment is the only change in its
commit. (2) A failed endpoint is a publishable result, **and a design-time refutation is one too;
this is where it is published.** Nothing above moves afterward, including the gate verdict itself.
(3) No post-hoc analysis: there is no run to analyse — the sweep of K6A.5–K6A.6 is a
pre-registration-time derivation disclosed with its provenance, seeds, and replicate counts.
(4)–(6) Moot: no arm, no fallback rule, no seed and no result is registered, so there is nothing to
freeze or to append to. (7) **Reruns only for a named code defect; and quote-and-correct for
text — this amendment corrects no earlier text and files no rider**, deliberately: the design page's
three claims that this gate bears on (the superlinear-`W` hypothesis, the anticipated
substrate-starvation failure mode, and the unbounded-horizon `α` claim) live in a **ratified wiki
page that this document cannot overrule**, and the correct instrument is a write-back to that page,
named below and not done here. (8) The report states every endpoint's number and verdict — discharged
by K6A.5–K6A.8: every quantity this gate measured is stated with its SE, and the class answer is
stated plainly.

**Write-back obligations, named and NOT done here** (the wiki is not this document's to edit):

- `~/concord/knowledge/methodology/pages/k6-accumulator.md` — the gate verdict FAIL and the
  refutation; that its superlinear-`W` hypothesis is measured and not confirmed (K6A.5); that its
  anticipated failure mode (substrate cannot supply enough reference) is **not** the one that fired,
  the substrate saturating at `m ≈ 500` while `W` against `H` binds (K6A.5); the two measured routes
  that clear the bar and their costs (K6A.8); and that its unbounded-horizon `α` claim needs the
  qualifier of K6A.9.
- `~/concord/knowledge/methodology/pages/coverage-gap-detectors.md` and
  `~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md` — that the K6-slow row does
  not enter the matrix, and why.
- A page for K6A.9's shared-reference result, which is a property of the whole block-conformal
  betting family and not of this candidate: `E[e|null] <= 1` marginally does not make the product a
  supermartingale, and at `κ → 1` the unbounded-horizon false-page rate approaches
  `P(per-reference null growth > 0)` rather than `α`.

### K6A.12 Named-not-done

- **The three routes of K6A.8/K6A.9 that would clear the bar** (`H ≈ 4,675`; `W ≈ 500` on a
  `275,000`-row substrate; a re-drawn rather than fixed reference). Measured, costed, **not
  recommended and not registered** — each needs a design-page decision, and the third leaves this
  construction family.
- **The T2-only validity reading**, still the family's one live falsifier (v2.K6E.17.4), still
  unbuilt, now with K6A.9 as a second reason it is the interesting measurement.
- **The full severity grid and the `-ar1` cell at long span** for this construction — not run, per
  K6A.10.

### Amendment summary

Registers, superseding nothing and registering no cell, seed, scenario, prediction, golden row or
artifact: **the design gate for the third K6 candidate, the K6-slow accumulator, computed before any
artifact exists — and its FAILURE.** The bar is quoted verbatim from the ratified design page
(detection `>= 0.50` within `H = 3,000` post-onset ticks at canonical `mix-d1.5`, equivalently median
time-to-cross `<= H`), as is the outcome rule that a median `> H` at every swept configuration
refutes the claim at design time with nothing built (K6A.1). The construction is frozen with all
three candidate features written as explicit formulas — the v2.K6E K6E.2 CvM discrete form verbatim,
an Anderson–Darling-weighted variant with its clamp `c = 1/(2 n_A)` named as a registered choice, and
the two-sample energy distance with its rank-irrelevant constant term dropped — and the exact
discrete null law shown to be feature-independent by exchangeability (K6A.2). Method, seeds and
guards: fresh disclosed seed bands `6.0e8`/`7.5e8`/`9.0e8` (registered seeds are `<= 1e8`; earlier
probes used `1.7e9`–`4.1e9`), all below `2^32` so the LCG does not wrap; trajectories drawn from one
continuously advanced stream per (reference, arm) rather than spaced seeds, which would rebuild
Amendment v2.C1's rank-1 lattice; **the C1.2 serial-structure guard RUN on every candidate substrate
draw from `n = 10,000` to `n = 625,000` and passed by all of them** (`n = 100,000`: mean
`acf(1) = -0.00021`, `acf(2) = 0.00020` over 250 draws); cluster-robust SEs over reference draws
(K6A.3). **Both required anchors pass:** v2.K6E's canonical reading reproduced inside this harness at
`x = 1.09574 ± 0.00514` and `1.08995 ± 0.00434` on two bands against its registered
`1.09576 ± 0.00347`, with growth `+0.004310`/`+0.003818` inside its registered CI `[0.003738,
0.004926]` — the `2e-5` agreement of the first explicitly disclaimed as coincidence at that
precision — and the exact discrete null law matched at every marginal, with every measured `E[e|null]`
on the conservative side of its closed form (K6A.4). **The sweep: 45 in-box configurations
(`W ∈ {30,60,90,120,150}` × three substrates `n = 10,000`/`40,000`/`100,000` × three features) plus
three isolated one-dimensional sweeps (`W` to 750, `m` to 4,000, `n_A` to 100,000), 2,500 trajectories
per arm per cell.** Findings registered off it: **the median time-to-cross reads `> H` in all 45 box
rows**; the design page's superlinear-`W` hypothesis is measured and **not confirmed** (`x − 1` grows
slightly *sub*linearly, `(x−1)/W` falling from `3.63e-3` to `2.65e-3` over a 25× range), while the
growth criterion `≈ (x−1)²/2` does grow quadratically, so total drift `N·g` grows roughly **linearly**
in `W` and reaches `log 20` only at `W ≈ 445`; `m` **saturates by `m ≈ 500`** (`x` flat at
`1.47`–`1.49` for `m = 500…4,000`) and `n_A` is **flat across a 50× range**, so **the substrate is not
why this fails** — the page's anticipated failure mode is not the one that fired; and the feature
ordering is **energy > CvM > AD** on a paired comparison (`+0.0212 ± 0.0040`, `t = 5.3`;
`+0.0480 ± 0.0051`, `t = 9.5`), with AD anti-informative outright at `W = 30` (`x = 0.967 < 1`) for a
stated reason (the matched-moment mixture has thinner tails than its reference, where AD's weight is
smallest) and the ordering reversing only out of box at `W >= 400` (K6A.5). **The best-achievable
in-box cell, measured with the `κ*`-estimation circularity removed — `κ*` frozen as the literal
`0.6820` from a pooled `x` before the endpoint was measured, then 20,000 trajectories on four
disjoint offsets: `W = 150`, `n = 100,000`, `A/B = 25,000/75,000`, `m = 500` (saturated), energy
distance, `κ* = 0.6820`. Detection-within-`H` = `0.2493 ± 0.0052` (between-offset spread, `1.5×` the
cluster-robust `0.0043`); median time-to-cross `> H = 3,000`, CENSORED — 4,986 of 20,000 crossed at
all, quartiles of the crossing tick `1,650 / 2,250 / 2,700`; healthy `H`-crossing `0.0090 <= α`; full
time-to-detection curve reported; grid maximum `≈ 0.30` at `κ = 0.55` on a plateau flat across
`[0.5, 0.6]`, reported and NOT adopted since the page's rule selects `κ` by growth.** Registered
alongside it: unlike both earlier K6 candidates **this one has no binding wealth ceiling** (per-window
ceiling `1.5942` nats, `31.88` over the horizon against `log 20`; crossing possible from window 2, and
observed from `450` ticks), so it dies of evidence rate rather than of arithmetic, and the over-all-`κ`
ceiling bound of v2.K6E.17.2 is not the argument; and the drift-only figure `ceil(log 20/g) = 36`
windows `= 5,400` ticks is **pessimistic** against the measured `≈ 4,650`, so no verdict here rests on
a drift extrapolation (K6A.6). **REGISTERED GATE VERDICT: FAIL — outcome 2 of the page's two
registered outcomes. The K6-slow accumulator claim is REFUTED AT DESIGN TIME inside the page's own
sweep box; nothing is built; the K6-slow row does not enter the coverage matrix; `K6` stays `NO`; no
run was spent** — short by a factor of `2.0` on detection at the growth-derived `κ*` and `1.7` at the
grid maximum, with what is NOT refuted stated as plainly as what is: the construction is strongly
informative at `W = 150` (`x = 1.468`, i.e. `x − 1` at `125` SE on the pooled between-offset SE `0.0037`, growth `+0.0841` nats/window, `19.5×`
v2.K6E's reading at `W = 30` and `1.7×` the page's own marginality floor), the page's mechanism claim
is confirmed more strongly than before, and an accumulator in this family **can** reach the bar
(K6A.7). What would have to change, measured rather than speculated, and adopted nowhere: **`H ≈ 4,675`
ticks instead of `3,000`** (`1.56×`; detection `0.4620 ± 0.0110` at `4,350` and `0.5146 ± 0.0113` at
`4,800`, healthy `0.013` at that horizon), **or `W ≈ 500` instead of `150`** (`3.3×` the page's upper
bound, on a `275,000`-row substrate: CvM `0.5029 ± 0.0128`, energy `0.5851 ± 0.0123`, AD
`0.5918 ± 0.0119`, all with healthy `≈ 0.01`, at the costs of `27.5×` the registered substrate, only
`N = 6` windows in the horizon, and `κ* ≈ 0.40` where `1/(1−κ) < 2` makes `Var[e]` infinite) — both
being changes to constants a ratified page fixes, hence write-backs and operator decisions, not this
document's to take (K6A.8). **A second, independent obstacle the sweep surfaced and registered as a
family-level finding: the design page's `α = 0.05`-over-an-unbounded-horizon claim is not established
for a block-conformal accumulator on a single FIXED reference, and at `κ` near `1` it is measurably
false.** `E[e|null] <= 1` holds marginally and exactly, but `E[W_t] = E_S[mu(S)^t]` diverges when
`P(mu(S) > 1) > 0`, and a reference whose own null growth is positive crosses a.s.: at v2.K6E's own
geometry (`W = 30`, `m = 200`, `κ* = 0.9126`) **48/250 references have positive null growth and the
healthy page rate runs `0.0080 → 0.0480 → 0.1580 → 0.2080` at `3,000 → 9,000 → 30,000 → 90,000`
ticks, `4.2×` over budget and still rising**, which kills the obvious "run v2.K6E's configuration
longer" successor (detection `0.575 ± 0.042` at 21,000 ticks bought with a healthy rate of
`0.124 ± 0.025`); at the winning cell's `κ ≈ 0.55–0.68` it is `0/250` and the healthy rate saturates
at `0.018`–`0.022 <= α`, so **the verdict's null side is intact and the obstacle is specifically a
`κ → 1` phenomenon** (K6A.9). Limitations disclosed: canonical cell only, no T2 arm, the AD clamp as
a registered choice, cluster-robust SEs against a single-orbit LCG, and the conservative direction of
the measured-vs-exact `E[e|null]` gap (K6A.10). House rules mapped, with **no rider and no
quote-and-correct filed** — the three page claims this gate bears on are in a ratified wiki page and
the instrument is a write-back, named as not-done (K6A.11); named-not-done also covers the three
clearing routes, the T2-only validity reading, and the unrun severity grid (K6A.12). **No endpoint,
floor, seed, prediction or verdict in §1–14 or in any earlier amendment moves; no artifact was
created; the whole content of this amendment is a gate, a refutation, the two measured changes that
would clear it, and one family-level validity finding — reached without spending a run.**

## Amendment v2.K6A.1 — 2026-08-08, the FRESH H = 6,000 re-gate: the K6-slow accumulator PASSES, and the build is registered

Registered before any artifact of the K6-slow candidate exists: no detector module, no card, no
adapter, no harness change, no constants-table entry, no run. Authority chain, stated because this
amendment rests on a relaxed bar: **operator decision 2026-08-08, option 1 of the decision package
v2.K6A filed**, recorded in the binding design page
`~/concord/knowledge/methodology/pages/k6-accumulator.md` §"Re-ratification — 2026-08-08: H = 6,000,
by operator decision, disclosed as post-measurement" — then this document. Sections 1–14 and every
earlier amendment stay intact, **including Amendment v2.K6A in full: its H = 3,000 refutation is not
withdrawn, not superseded, and not re-read.**

### K6A.1.1 The operator decision, quoted, with its provenance chain

**Quoted, design page §Re-ratification:**

> The operator chose option 1 of the filed decision package: **the bar is re-ratified at
> H = 6,000 post-onset ticks** (margin above the measured ≈4,675 crossing point; ~1.7–17 hours
> at 1–10 s cadence, inside the stated "hours" envelope). On the record in full: this is a
> relaxation of a registered bar *after* a measurement missed it — the original H = 3,000 was
> the controller's drafting proxy, the operator's stated envelope was "hours," and the
> relaxation is legitimate only because it is disclosed here, decided by the operator, and paid
> for with a **fresh registered gate**: new probe draws on new seeds, prediction bands for
> detection-within-6,000 and median time-to-cross at the frozen configuration
> (W=150, n=100,000, A/B 25,000/75,000, m=500, energy distance, κ = 0.6820), the
> reference-conditional null-growth check as a registered stop condition, and the healthy
> 6,000-tick paging bound. Re-reading the failed gate's tables at the new bar does not count.
> The H = 3,000 refutation stands as the answer to the question as first registered.

**The provenance chain, in three links, each named rather than implied.** (1) `H = 3,000` was the
**controller's drafting proxy** for the operator's stated "hours scale" envelope — it was never an
operator-stated number, which is why relaxing it is a bar correction and not a moved goalpost;
the operator's own words, quoted in the design page's RATIFIED header, are *"hours scale is fine."*
(2) v2.K6A measured the miss and **filed a decision package rather than acting on it**
(v2.K6A K6A.8: `H ≈ 4,675` and `W ≈ 500` recorded, "adopted nowhere"). (3) The **operator** took
option 1. **This amendment does not decide the bar and could not: a prereg amendment cannot
overrule a ratified page, and it cannot ratify one either.**

**What this amendment therefore is, and is not.** It is the fresh gate the re-ratification requires,
plus the registrations a passing gate obliges. **It is not a re-reading of v2.K6A's tables**: every
number in K6A.1.4–K6A.1.8 comes from calibration draws and live streams that have never been used by
any probe in this document, and the frozen configuration was frozen *before* the operator's decision
existed, which is the property that makes this measurement a test rather than a selection.

**Registered, so the record cannot be read as a clean pass:** the bar this amendment clears is a
**post-measurement relaxation**, disclosed as such here and on the page. A reader comparing K6-slow
to any other class row must know that this class's `H` was set after a first bar was missed, and
that the H = 3,000 answer for the same construction is **NO** (v2.K6A). Both answers stand, at their
own bars, and neither is the other's correction.

### K6A.1.2 The frozen configuration, and the freeze discipline

Frozen by v2.K6A K6A.6 and quoted by the design page. **Nothing here was re-optimized, re-chosen or
re-tuned for the new bar — that is the entire point of having frozen it before the bar moved:**

```
W        = 150                     window length, disjoint W-blocks of the post-onset stream
n        = 100,000                 calibration substrate rows per cell (ONE continuously advanced stream)
A / B    = 25,000 / 75,000         A -> the fixed reference ECDF Fhat_A; B -> m contiguous disjoint blocks
m        = 500                     = 75,000/150 exactly, no remainder; SATURATED (v2.K6A Table 3)
feature  = energy distance vs Fhat_A, the form frozen at v2.K6A K6A.2, verbatim
kappa    = 0.6820                  FROZEN LITERAL. Not re-derived on this amendment's data.
H        = 6,000  ->  N = 40       disjoint windows of 150
endpoint = wealth >= 20  (log >= log 20 = 2.995732) at any window checkpoint
```

The construction, the rank rule `p = (1 + #{j : T(B_j) >= T(live)})/(m+1)`, the calibrator
`e = kappa*p^(kappa-1)`, the wealth recursion, and the exact discrete null law are **cited from
v2.K6A K6A.2, not re-derived here.**

**The freeze cost, disclosed.** This amendment's own fresh data reads `x = -E[log p|alt] =
1.46876 ± 0.00465`, whose closed-form optimum would be `1/x = 0.680848`. The frozen literal is
`0.6820`, **`0.00115` above it**. On the measured `κ`-grid slope near the optimum (about `-0.85` per
unit `κ`, v2.K6A K6A.6) that difference is worth under `0.001` in detection. **The frozen value is
kept. Re-deriving `κ` on the data that then reports the endpoint is exactly the circularity v2.K6A
K6A.6 removed, and moving it now — after a bar relaxation — would be indefensible.**

### K6A.1.3 The fresh probe: seeds, replicates, and the C1 guard

**FRESH seed bands, disjoint from every band used anywhere in this document, stated so the
disjointness is checkable rather than asserted:**

```
calibration substrate   1.30e9 + 300007*rep + 7919*offset      spans [1.300e9, 1.321e9]
canonical alt live      1.42e9 + 300007*rep + 7919*offset      spans [1.420e9, 1.441e9]
healthy live            1.54e9 + 300007*rep + 7919*offset      spans [1.540e9, 1.561e9]
```

`rep <= 69`, `offset ∈ {1,2,3,4}` for the gate and `{11,12,13,14}` for the grid cells (K6A.1.8).
**Every registered seed of this study is `<= 1e8`** (`CELL_SEED` max `20260855` after K6A.1.9,
trajectory seed max `36,090,935`, `HELDOUT_SEED` max `20760855`); earlier K6 probes used
`1.7e9`/`2.5e9`/`2.6e9`/`3.0e9`/`3.5e9`/`3.7e9`/`3.8e9`/`4.1e9`; **v2.K6A's own probe used
`1.1e9` (anchor) and `6.0e8`/`7.5e8`/`9.0e8` (sweep)**. The three bands above are mutually disjoint,
disjoint from all of those, below `1.7e9`, and all `< 2^32`, so the LCG's `seed >>> 0` performs no
wrap and the stated band is the band actually used.

**Replicates.** `4` offsets × `R = 70` calibration draws × `TJ = 72` trajectories =
**280 calibration draws and 20,160 trajectories per arm** (canonical alt and healthy), above the
`20,000` the task sets and the `250` draws the null-growth screen needs.

**Generators** copied verbatim from `inject.mjs:14-24,60-70` and `run-battery.mjs:302-308,365,
650-653`, as v2.K6A K6A.3 states; **trajectories are consecutive disjoint blocks of ONE continuously
advanced stream per (calibration draw, arm)**, never spaced per-trajectory seeds.

**The C1.2 serial-structure guard was RUN on every one of the 280 fresh calibration draws and on
every grid-cell draw, and threw on none.** `φ = 0` draws: mean `acf(1) = 0.00010`,
`acf(2) = 0.00008` (bound `0.10`). `φ = 0.6` draws (the `-ar1` cells, K6A.1.8): mean
`acf(1) = 0.5999`, `acf(2) = 0.3594`/`0.3600` against the `(0.6, 0.36)` their own `φ` implies.
**The `n = 100,000` draw's lattice-freedom is checked at every draw, not inherited from v2.K6A.**

### K6A.1.4 THE FRESH GATE at H = 6,000

| quantity | measured | bar |
|---|---|---|
| **detection-within-`H` (canonical `mix-d1.5`)** | **`0.6207`**, cluster-robust SE `0.0091`, between-offset SE `0.0089` | **`>= 0.50`** |
| **median time-to-cross** | **`4,950` ticks** | **`<= H = 6,000`** |
| quartiles of time-to-cross, over ALL trajectories | `q25 = 3,000`, `q50 = 4,950`, `q75 > 6,000` (censored) | — |
| quartiles among the `12,513/20,160` that crossed | `2,400 / 3,450 / 4,650` | — |
| **healthy `6,000`-tick paging** | **`0.0181 ± 0.0014`** | `<= α = 0.05` |
| **null-growth screen** | **`0/280` calibration draws with positive null growth** | `0` required |

**Per-offset readings, so the four are visible rather than pooled away:** detection
`0.6268`, `0.6165`, `0.6409`, `0.5986` (between-offset sd `0.0178`); healthy `0.0188`, `0.0185`,
`0.0181`, `0.0169`. **The cluster-robust SE (`0.0091`) and the between-offset SE (`0.0089`) agree**,
so unlike v2.K6A's first pass there is no over-dispersion to carry: the `κ`-re-estimation coupling
that caused it is gone, because `κ` is a frozen literal here.

**The full time-to-detection curve** (ticks : detection, 20,160 trajectories, every window):

```
 150:0.000   300:0.000   450:0.000   600:0.002   750:0.004   900:0.009  1050:0.016  1200:0.024
1350:0.035  1500:0.048  1650:0.063  1800:0.080  1950:0.095  2100:0.117  2250:0.139  2400:0.161
2550:0.182  2700:0.204  2850:0.226  3000:0.250  3150:0.274  3300:0.296  3450:0.319  3600:0.342
3750:0.363  3900:0.384  4050:0.404  4200:0.424  4350:0.442  4500:0.462  4650:0.480  4800:0.498
4950:0.513  5100:0.531  5250:0.548  5400:0.564  5550:0.579  5700:0.594  5850:0.607  6000:0.621
```

**Two checks on this curve that were not free, registered because they are what makes the fresh
measurement trustworthy rather than merely new.**

1. **The fresh draw reproduces v2.K6A's H = 3,000 headline exactly.** This curve reads `0.250` at
   `3,000` ticks; v2.K6A K6A.6 registered `0.2493 ± 0.0052` at the same configuration on
   **disjoint** seed bands. **The H = 3,000 refutation is independently reproduced, on new draws, by
   the same probe that now clears H = 6,000.** The relaxed bar did not repair a bad measurement;
   it moved the horizon past a correctly measured crossing point.
2. **The crossing point agrees with v2.K6A's interpolation to within two windows.** v2.K6A K6A.8
   interpolated detection `= 0.50` at `H ≈ 4,675`; this fresh measurement puts the median at
   `4,950` — `1.8` windows later, and `4,800` reads `0.498`, a whisker under the floor. Registered
   as agreement, not as a correction: the two differ by less than the `150`-tick granularity plus
   sampling.

### K6A.1.5 The null side, and the null-growth screen

**The exact discrete null law, checked at the frozen `m = 500`** (11.2M healthy windows):

| quantity | measured | exact |
|---|---|---|
| `E[log p \| null]` | `-0.99114` | `-0.991961` |
| mean `p` | `0.501023` | `0.500998` |
| `E[e \| null]` at `κ = 0.6820` | `0.990924` | `0.991433` |

**`E[e|null] <= 1` holds by closed form and is matched by MC on the conservative side**, as in
v2.K6A K6A.4b. Per-window ceiling at the frozen constants: `log κ + (1-κ)·log(m+1) = -0.382726 +
0.318 × 6.216606 = 1.594155` nats, so `N = 40` windows give `63.77` against `log 20`; the earliest
arithmetically possible crossing is **window 2 (`300` ticks)**, which needs `S_2 >= 11.8276` of a
maximum `12.4332`. The curve's first nonzero reading at `600` ticks and the `mix-d2.0` cell's
measured median of **exactly `300`** (K6A.1.8) both confirm that arithmetic.

**The null-growth screen — the design page's mandatory pre-run check, measured on the fresh band.**
Per calibration draw `S`, the screen reads `g_null(S) = log κ + (1-κ)·E[-log p | null, S]`:

```
draws screened                 280      (>= 250 required)
draws with g_null(S) > 0         0
per-draw g_null: mean       -6.754e-2   sd 1.571e-2   max -1.501e-2   p99 -2.428e-2
margin                        4.30 sd below zero
```

**`0/280`, with the worst draw still `1.5e-2` below zero.** For contrast, and cited not re-measured:
at the prior K6E geometry (`W = 30`, `m = 200`, `κ* = 0.9126`) v2.K6A K6A.9 read `48/250` positive.
**The frozen `κ = 0.6820` at `m = 500` is in the safe regime by a wide margin, and this is the
measurement the design page requires before any accumulator card is built.**

### K6A.1.6 THE GATE VERDICT — PASS at the re-ratified bar

Mapped against the design page's outcome rule, at `H = 6,000`:

1. *"best-achievable median time-to-cross ≤ H → freeze and build"* — **THIS IS THE MEASURED
   RESULT.** Median time-to-cross `4,950 <= 6,000`; equivalently detection-within-`H`
   `0.6207 ± 0.0091 >= 0.50`, clearing the floor by `13.3` cluster-robust SE.
2. *"> H at every swept configuration → refuted at design time"* — not the measured result.

**REGISTERED GATE VERDICT: PASS.** The healthy side holds (`0.0181 <= α = 0.05`), the null-growth
screen is clean (`0/280`), the exact null law is matched, and the configuration was frozen before the
bar moved. **The K6-slow accumulator proceeds to build, under the registrations of K6A.1.9–K6A.1.14
and subject to the two-sided reading of K6A.1.7, which is part of the verdict and not a footnote to
it.**

**What this verdict does not do.** It does not disturb `K6 = NO` at the deploy-gate geometry (two
attempts, `k6-ecdf-successor`). It does not disturb v2.K6A's `H = 3,000` refutation, which this
amendment's own fresh draw reproduces at `0.250` (K6A.1.4). It is not a coverage answer: the class
row's YES/NO is decided by the run against `COVERAGE_FLOOR`, on one calibration draw, per K6A.1.13.

### K6A.1.7 The single-calibration-draw lottery — registered as a two-sided prediction, not a caveat

**The gate's `0.6207` is a mean over 280 calibration draws. The registered run draws ONE**
(`HELDOUT_SEED = CELL_SEED + 500000`, §6), so the realized endpoint is a single draw from a
distribution, not an estimate of its mean with a shrinking SE. This is C1.7's calibration-draw
lottery and K6E.7c's quantification, and at this bar it is **the dominant uncertainty in the whole
registration** — the per-draw sd is `0.1527` against a within-draw binomial noise of
`sqrt(0.62·0.38/2000) = 0.0109`, a factor of `14`.

**Measured distribution over the 280 fresh draws:**

| endpoint | p05 | p25 | p50 | p75 | p95 | min | max |
|---|---|---|---|---|---|---|---|
| canonical detection-within-`H` | `0.333` | `0.528` | `0.625` | `0.726` | `0.848` | `0.181` | `0.958` |
| median time-to-cross (ticks) | `3,300` | `4,050` | `4,650` | `5,250` | `5,700` | — | `6,000` |
| healthy `6,000`-tick paging | — | — | `0.0139` | — | `0.0556` | — | `0.1389` |

**Three consequences registered in advance, each a prediction this amendment is willing to be
judged on:**

1. **`60/280 = 21.4%` of calibration draws read canonical detection BELOW `0.50`.** So the
   registered run has roughly a **one-in-five** chance of reading `K6-slow = NO` **while the gate is
   correct**. **Registered: a canonical reading in `[0.333, 0.848]` CONFIRMS this gate; a NO from a
   reading inside that band is the lottery, not a falsification, and must be reported as
   "class NO at this calibration draw" rather than "the gate was wrong."** The gate is falsified by a
   reading **outside** the band — below `0.333` or above `0.958` — or by a systematic disagreement
   across several cells.
2. **`65/280 = 23.2%` of draws have a median time-to-cross `> H`**, the same event seen through the
   equivalent endpoint.
3. **The class answer for K6-slow is therefore genuinely uncertain before the run, and that is
   registered rather than smoothed.** The honest one-line prediction is: **`P(K6-slow = YES) ≈ 0.79`
   conditional on the card reaching USE**, not "YES."

**Registered mitigation, and the reason none is adopted here.** Averaging over several calibration
draws per cell would collapse this variance, and it is the obvious design improvement — but the
substrate draw is `HELDOUT_SEED`-derived and one-per-cell by §6/C1.2's registered construction, and
changing that is a protocol change affecting every candidate scored on a held-out stream, not this
amendment's call. **Filed as named-not-done (K6A.1.15), with the consequence registered above so no
reader mistakes a single-draw NO for a refutation.**

### K6A.1.8 The rest of the grid at the frozen configuration and H = 6,000

Fresh offsets `{11,12,13,14}`, `140` calibration draws × `24` trajectories = `3,360` per cell.
`κ` frozen at `0.6820` for every cell — **no per-cell re-optimization**, which is why the cells whose
own optimum is elsewhere read low.

| cell | `φ` | `x = −E[log p\|alt]` | own `1/x` | growth at frozen `κ` | detection-within-`H` | median t-t-c |
|---|---|---|---|---|---|---|
| `mix-d1.0` | 0 | `1.00208 ± 0.00410` | `0.9979` | `≈ 0.0000` | **`0.0220 ± 0.0028`** | `> H` |
| **`mix-d1.5` (canonical)** | 0 | **`1.46876 ± 0.00465`** | `0.6808` | `+0.084340` | **`0.6207 ± 0.0091`** | **`4,950`** |
| `mix-d2.0` | 0 | `6.21661 ± 0.00000` | `0.1609` | `+3.38938` | **`1.0000 ± 0.0000`** | **`300`** |
| `mix-d1.5-ar1` | 0.6 | `0.53275 ± 0.00324` | none in (0,1) | `≤ 0` | **`0.0000 ± 0.0000`** | `> H` |
| healthy analogue, `φ=0.6` | 0.6 | `0.99393 ± 0.00442` | none in (0,1) | `≤ 0` | paging `0.0170 ± 0.0023` | `> H` |

**Mechanisms registered with the numbers, so no row is over-read:**

- **`mix-d1.0` is uninformative at this `W`, not merely under-powered.** `x = 1.00208 ± 0.00410` is
  `0.5` SE above `1`, i.e. indistinguishable from the boundary where growth changes sign; the
  measured detection `0.0220` is barely above the healthy paging rate. At `W = 30` v2.K6E measured
  this cell **anti**-informative (`x = 0.9867`); longer windows move it to the boundary and no
  further. **Registered prediction `0.0220`, NOT_POWERED, and the class's own grid floor is
  therefore `d = 1.5`.**
- **`mix-d2.0` reads `x = 6.216606` with SE exactly `0.00000` because `log(m+1) = log 501 =
  6.216606` — EVERY window returned the minimum attainable `p = 1/501`.** This is the `s = 0`
  degeneracy K6.2.1/K6.2.3 and K6E.8 already registered, confirmed for a third feature:
  `s = sqrt(1 - d²/4) = 0` exactly at `d = 2.0`, so the injection is a pure two-point `±1σ`
  distribution, not an overlapping mixture. **Its `1.0000` is a boundary artifact and is NOT evidence
  of shape sensitivity.** Its median of exactly `300` ticks is the earliest arithmetically possible
  crossing (window 2, K6A.1.5) — a check on the ceiling arithmetic, not a performance claim.
- **`mix-d1.5-ar1` is strongly anti-informative (`x = 0.5328`), predicted `0.0000`, for a reason the
  class's own injection creates and the detector cannot fix.** `injectShapeMix`
  (`inject.mjs:60-70`) **REPLACES** post-onset values with i.i.d. mixture draws, so on this cell the
  live windows are i.i.d. while the calibration blocks are AR(1) `φ = 0.6`, whose `150`-tick ECDFs
  wobble far more; the live `T` is therefore *smaller* than a typical reference block's and the
  one-sided upper-tail rank sends `p` toward `1`. K6E.8's registered mechanism, reproduced at
  `W = 150`. **Validity is intact at matched `φ`:** the `φ = 0.6` healthy analogue pages at
  `0.0170 <= α` with `0/140` positive null growth. **The `-ar1` POWER cell is out of reach and is
  registered as such, at `0.0000`, not excused.**

### K6A.1.9 T1 long-span scenario and cell registration (extends §6/§7)

**The long-span scenario, registered for this class only.** The `T = 300 / ONSET = 100` scenario is
the deploy-gate registration and is **untouched for every existing cell**:

```
T_K6SLOW      = 6,300 ticks      baseline 300 + 6,000 post-onset
ONSET_K6SLOW  = 300
TEST_K6SLOW   = { start: 300, len: 6000 }      -> 40 disjoint windows of W=150, NO remainder
N (trajectories) = 2,000         REGISTERED_N, §6, unchanged
substrate      = 100,000 rows per cell, drawn under HELDOUT_SEED as ONE continuously advanced
                 stream (the post-C1 form, run-battery.mjs:650-653); A = rows 1..25,000,
                 B = rows 25,001..100,000 -> m = 500 blocks of 150 exactly
```

**New cells, continuing the index sequence past the highest registered index `42`** (v2.K5R K5R.5;
indices `35`–`37` remain reserved by K6.12/K6E.9/K6E.10 and **a cancelled run does not release a
registered index**, so `36`/`37` are not reused):

| idx | class | severity | `φ` | `CELL_SEED = BASE_SEED + idx` | `HELDOUT_SEED = CELL_SEED + 500000` | arithmetic |
|---|---|---|---|---|---|---|
| 43 | `K6-slow` | `mix-d1.0` | 0 | **20260850** | **20760850** | `20260807+43`; `+500000` |
| **44** | `K6-slow` | **`mix-d1.5` (canonical)** | 0 | **20260851** | **20760851** | `20260807+44` |
| 45 | `K6-slow` | `mix-d2.0` | 0 | **20260852** | **20760852** | `20260807+45` |
| 46 | `K6-slow` | `mix-d1.5-ar1` | 0.6 | **20260853** | **20760853** | `20260807+46` |
| 47 | arm | `shape_ecdf_accumulator` S2/S3 | 0 | **20260854** | **20760854** | `20260807+47` |

`K6SLOW_T2_SCENARIO_SEED = BASE_SEED + 48 = 20260855` (K6A.1.11). Trajectory seeds
`seed(i) = CELL_SEED + 7919*i`, `i = 0..1999`, §6's formula shape unchanged. **Seed-ceiling check:
`CELL_SEED` max `20260855`, trajectory-seed max `20260854 + 7919*1999 = 36,090,935`, `HELDOUT_SEED`
max `20760855` — every registered seed stays `<= 1e8`, so no registered seed can collide with any
probe band this document has used** (all `>= 6e8`).

**Detector assignment: `K6-slow` cells are scored by `shape_ecdf_accumulator` ALONE.** `safe_t` and
`universal_inference` are **not** registered on this class, deliberately: scoring them on a
`6,300`-tick scenario would be a new measurement of two existing detectors under a geometry nothing
registers for them, and it would put a second detector's name on this class's row for free.
**Registered consequence, disclosed: the K6-slow row rests on ONE detector, so it has no
paired-comparison partner and `pairingGaps` will name it.** That is the honest cost of a
single-candidate class row.

### K6A.1.10 Healthy arm and stop conditions, both tiers, checked first

**The healthy arm (cell 47)** carries K6.7's field set by reference — the same substitution pattern
v2.K6E K6E.9 registers (`null_id: 'K6slow-arm-heldout'`, `params: 'heldout-empirical'`), with
`p_uniformity` pooling one feature over `2,000 × 40 = 80,000` values and
`ks_critical_at_alpha = 1.36/sqrt(80000) = 0.0048083`. Reported, **no verdict authority** (K6.7/K3.1.7's
caveat: `p` is discrete on 501 values). The verdict stays `crossing_rate`-derived. **At `κ = 0.6820`
the calibrator's tail index is `1/(1-κ) = 3.14 > 2`, so `Var[e]` is finite here** — recorded, and the
field is still non-authoritative, because changing which field carries an S2 verdict is a protocol
change and not an amendment's call (K6E.9's ruling, reused).

**Registered stop conditions, checked BEFORE any power reading, on both tiers:**

1. **T1 healthy paging bound.** Cell 47's S2 `crossing_rate` over `n = 2000`; the condition fires if
   the **Wilson one-sided 95% lower bound `> α = 0.05`**. Predicted point value `0.0181`.
2. **The null-growth screen, as a registered stop condition** (the design page's mandatory check):
   **if `>= 1` of `250` fresh calibration draws at the frozen `κ = 0.6820` has positive null growth
   `log κ + (1-κ)·E[-log p|null,S] > 0`, STOP, investigate, do not run.** Measured `0/280` here
   (K6A.1.5), margin `4.30` sd. **This screen is run on fresh draws at run time, not inherited from
   this amendment** — that is what makes it a stop condition rather than a citation.
3. **T2 pooled healthy crossing**, K6.12's pooled `t2_crossing_rate` Wilson 95% lower bound across
   scored `(shard, coordinate)` pairs — pooled, not any single coordinate's rate (K6A.1.11).

A fired stop condition on either tier **REFUTES** `shape_ecdf_accumulator` on the record.

**The T1 stop condition's own false-fire rate, measured and registered, because an unfalsifiable or
over-firing falsifier is not evidence either way.** The healthy paging rate is a **marginal**
`0.0181 <= α`, which is what `α` bounds (Ville applies to the marginal supermartingale, v2.K6A
K6A.9). Conditional on the single calibration draw it is a distribution: **`22/280 = 7.9%` of draws
page above `α` within `6,000` ticks (max `0.1389`), and the Wilson-LB stop condition above would fire
on `11/280 = 3.9%` of draws** (the LB crosses `0.05` at a point rate of `0.0585`). **Registered: the
T1 healthy stop condition has an approximately `4%` false-fire rate from the calibration lottery
alone, and the null-growth screen does NOT catch those draws — all `280` passed the screen.** The two
checks are complementary, not redundant: the screen tests the asymptotic drift sign, the paging bound
tests a finite-horizon rate that has variance around it. **A fired T1 stop condition must therefore
be reported with the null-growth screen's reading beside it**; screen-clean plus paging-fired is the
lottery's signature, screen-dirty plus paging-fired is a construction defect.

### K6A.1.11 T2 clustersynth validity arm — K6.12's construction, unchanged, with its arithmetic consequence at W = 150 disclosed

**Cited, not re-registered:** the scenario
(`cs.buildScenario({family:'gb200', pods:1, seed: <K6SLOW_T2_SCENARIO_SEED>, window:{steps:9600,
dt_s:30}, faults:false})`), `sc.gpuIds.slice(0,120)`, the five `COUNTERS` coordinates, the
skip-with-reason accounting for degenerate references, and the binding field names
(`t2_crossing_rate` not `crossing_rate`, `t2_verdict` not `verdict`, **no `fault_class` field at
all**) are **K6.12 + K6.1.3's registered set, applied unchanged** with
`detector: 'shape_ecdf_accumulator'`. The design page requires this arm unchanged, and a successor
that fails it is REFUTED.

**What W = 150 does to that arm, stated as arithmetic rather than discovered at run time.** The
scenario supplies `9,000` reference ticks and a `600`-tick live span per `(shard, coordinate)`.
The frozen `m = 500` needs `500 × 150 = 75,000` reference ticks. **It cannot be had: `75,000 >>
9,000`.** Preserving the frozen `1:3` A/B ratio instead gives

```
A = 2,250 ticks (reference ECDF)    B = 6,750 ticks -> m = floor(6750/150) = 45 blocks exactly
   check: 2,250 + 45*150 = 9,000                    live: 600/150 = 4 windows
```

**Registered, with both consequences named:**

- **T2's `m` is `45`, NOT T1's `500`.** This breaks K6E.10's "one `m` for both tiers makes the two
  arms one construction" property, deliberately and for a stated reason: `W` is frozen and the
  telemetry length is fixed. The A-segment shrinking to `2,250` costs nothing measurable — v2.K6A
  Table 4 measured `x` **flat** across `n_A ∈ [2,000, 100,000]` — so the ratio, not the absolute
  A-size, is what is preserved.
- **The T2 healthy falsifier is very nearly VACUOUS at this `W`, and this is disclosed rather than
  routed around.** With `m = 45` and `4` live windows, the per-window ceiling is `0.834782` nats, so
  a crossing is possible **only at window 4** and requires `S_4 >= 14.2347` against a maximum
  attainable `4·log 46 = 15.3146` — **`93%` of the theoretical maximum, i.e. all four windows within
  a whisker of the `p`-floor** — against `E[S_4|null] = 3.7535`. Predicted T2 pooled healthy crossing:
  **`0.0000`**. **Registered reading: a T2 PASS on validity carries little information at `W = 150`,
  exactly as v2.K6E K6E.11 disclosed for T1 at `κ*`.** The arm still runs, because K6.12's contiguity
  question — does the construction's validity survive independent telemetry, the question that killed
  `shape-kurtosis-e-value.ts` (C22) — is answered by its skip/degeneracy accounting and its `p`
  marginals whether or not the crossing endpoint can move. **Whether this class needs a longer
  clustersynth window to restore a live T2 falsifier is a design-page decision and is named
  not-done (K6A.1.15); this amendment does not change K6.12.**

### K6A.1.12 Predictions with bands, for every endpoint the runs will read

All at the frozen `κ = 0.6820`, `H = 6,000`, `N = 40`. **Bands are per-calibration-draw (K6A.1.7),
which is the quantity a one-draw run realizes — not SEs of this probe's mean.**

| endpoint | prediction | registered band | falsifier |
|---|---|---|---|
| **cell 44 `mix-d1.5` canonical detection** | **`0.62`** | `[0.333, 0.848]` (p05–p95 per draw); `21.4%` of draws `< 0.50` | outside the band, or `< 0.333`/`> 0.958` |
| cell 44 median time-to-cross | `4,950` ticks | `[3,300, 5,700]`; `23.2%` of draws censored at `> H` | a median `< 3,000` or a censored median with detection `> 0.50` |
| cell 43 `mix-d1.0` detection | `0.0220` | `[0.010, 0.040]` | `> 0.10` |
| cell 45 `mix-d2.0` detection | **`1.0000`** | `[0.999, 1.000]` | `< 0.99`; **a boundary artifact, not shape sensitivity** (K6A.1.8) |
| cell 46 `mix-d1.5-ar1` detection | **`0.0000`** | `[0.000, 0.002]` | any material crossing |
| cell 47 S2 healthy `crossing_rate` | `0.0181` | `[0.000, 0.056]` p05–p95 per draw; `7.9%` of draws `> α` | the Wilson-LB stop condition (fires on `≈3.9%` of draws by lottery alone) |
| cell 47 S2 `increment_estimator.mean` | `0.9914` | `[0.985, 0.998]` (exact `E[e\|null] = 0.991433`) | outside `[0.97, 1.01]` |
| cell 47 S2 `degenerate_windows`, `non_finite_wealth` | **structurally 0** | — | any nonzero count |
| cell 47 S3 arm (`shift_sigma: 3` = `d = 2.0`) | `1.0000` → **POWERED** | `[0.999, 1.000]` | `< INERTNESS_FLOOR = 0.10` |
| null-growth screen, 250 fresh draws | **`0/250` positive** | `0` | `>= 1` → STOP (K6A.1.10) |
| T2 pooled healthy crossing | **`0.0000`** | `<= α` | the T2 stop condition |
| T2 degenerate-reference skips | **not predicted** — a finding to make (K6.12), disclosed per coordinate, never folded into a denominator | — | — |
| **K6-slow class answer** | **YES** iff card USE and cell-44 detection `>= 0.50`; `P(YES) ≈ 0.79` | — | see K6A.1.13 |

`degenerate_windows`/`non_finite_wealth` are structurally `0` for the reason K6E.12 registers:
`p ∈ [1/501, 1]` so `e ∈ [κ, κ·501^(1-κ)] = [0.6820, 4.9242]`, always finite, no `p = 0` pathway, and
`T` is a finite sum of bounded quantities.

**A failed endpoint is a publishable result (§0 rule 2). Nothing above moves afterward** — including
the `0.0000` predictions, the `1.0000` artifact, and the `P(YES) ≈ 0.79`.

### K6A.1.13 Golden expectation — a NEW COVERAGE.md row, and how a class row actually enters

**Checked against the code rather than assumed.** `coverageFor`
(`validation/certification/lib/score.mjs:358`) iterates **`Object.keys(FAULT_CLASSES)`**, and
`FAULT_CLASSES` is a **hardcoded `Object.freeze({...})` of `K1`–`K6`**
(`validation/certification/lib/constants.mjs:57-74`). **A `K6-slow` row therefore does not exist —
at all — until that object gains an entry: no cell carrying `fault_class: 'K6-slow'` can create a
row by itself, because nothing iterates the cells' own class values.** Per the task's instruction,
the code change is registered here and **assigned to the build tasks, NOT to this commit**:

| # | file:line | change | why it is required |
|---|---|---|---|
| 1 | `certification/lib/constants.mjs:57-74` | add `'K6-slow': { name: 'distributional shape change, hours-scale accumulator', canonical: 'mix-d1.5', grid: ['mix-d1.0','mix-d1.5','mix-d2.0'] }` | `coverageFor` iterates these keys; without it there is no row |
| 2 | `coverage/harness/run-battery.mjs:176-196` | four `F(43..46, 'K6-slow', …)` rows per K6A.1.9 | the cells themselves |
| 3 | `run-battery.mjs:220` `REGISTERED_AR1_ROWS` | add `'K6-slow': 1` | `assertRegistryAgreement` throws at startup otherwise (`:248-250`) |
| 4 | `run-battery.mjs:343-359` `parseSeverity` | `case 'K6-slow':` sharing K6's `/^mix-d(\d*\.?\d+)$/` grammar | every K6-slow severity throws otherwise (`:358`) |
| 5 | `run-battery.mjs:370-400` `generate` | `case 'K6-slow':` → `injectShapeMix` | `no generator for K6-slow` otherwise |
| 6 | `run-battery.mjs:565` `detectorsFor` | `case 'K6-slow': return ['shape_ecdf_accumulator']` | K6A.1.9's single-detector assignment |
| 7 | `run-battery.mjs:75-87` `T`/`ONSET`/`TEST` | make the scenario span **per class**, `T_K6SLOW = 6,300`, `ONSET_K6SLOW = 300` | they are module scalars today; the long-span scenario needs its own, and **every existing cell must keep `T = 300`/`ONSET = 100` bit-for-bit** |
| 8 | `run-battery.mjs:84` + `:293` `HELDOUT_ROWS` | make the substrate size **per class** (`100,000` for K6-slow) and split the `assertRegisteredConstants` literal check accordingly | `HELDOUT_ROWS = 10000` is asserted against §6 today, so a `100,000`-row draw crashes at startup |
| 9 | `run-battery.mjs:202-218` `ARM_CELLS` | arm `idx 47` per K6A.1.9 | the healthy/S3 arm |

**Items 7 and 8 are the load-bearing ones and are named as the build's real risk:** they change
constants every existing cell reads, so the build task that makes them must prove **bit-for-bit
invariance of every current cell's trajectories** (the existing suites' 90 coverage-battery and 171
certification assertions are the instrument), not merely that the new cells run.

**The golden expectation, registered.** Pre-run (the state at the commit that freezes the card,
K6.2.4/K6E.13's precedent): `shape_ecdf_accumulator` enters
`validation/certification/test/golden-verdicts.test.mjs` at **`NOT_EXECUTABLE`, tier `null`, S1
`MISSING`, S2 `MISSING`, S3 `MISSING`, S4 `PASS`**.

**Post-run expected delta, registered against the code path rather than asserted:**
`NOT_EXECUTABLE → USE`, tier `null → T1`, S2 `MISSING → PASS`, S3 `MISSING → PASS`.
**Unlike v2.K6E, this card is NOT capped at ADVISORY by the valid-but-inert rule:** the S3 arm at
`d = 2.0` reads `1.0000 >= INERTNESS_FLOOR = 0.10`, so `s3Powered.length !== 0` and
`score.mjs:568`'s `ADVISORY` return is not taken. **The remaining gate to USE is S4**
(`score.mjs:578-585`: `REFUSE` → ADVISORY, `UNPRICED` → ADVISORY, else USE) and **S1 blocks nothing**
by design (`score.mjs:514`, the v1 floor, named in `reasons[]` only).

**The new COVERAGE.md row, with its condition stated in full:** `K6-slow` reads **YES** iff at least
one card with overall verdict **USE** has the class **COVERED** (`verdict.mjs:249`), and COVERED
requires the **canonical cell 44** to read `powerRate >= COVERAGE_FLOOR = 0.50`
(`score.mjs:397-402`). **Predicted: YES, tier T1 — conditional on two things this amendment names
rather than assumes: (a) the card's own S4 landing `PASS`, which depends on card text that does not
yet exist, and (b) the single calibration draw clearing `0.50`, which K6A.1.7 puts at `≈ 79%`.**
**If either fails the row reads NO and that is a registered outcome, not a surprise.** The other
fifteen cards' tuples and every existing class row **do not move**.

### K6A.1.14 House rules, mapped

(1) **Committed before any artifact it authorizes** — at this commit there is no K6-slow module,
card, adapter, cell, harness change or run; this amendment is prereg text alone, in its own commit,
and the code changes of K6A.1.13 are registered *for* the build tasks and deliberately not made here.
(2) A failed endpoint is a publishable result; nothing above moves afterward, **including the
`P(YES) ≈ 0.79`, the `1.0000` artifact and the `0.0000` predictions.** (3) No post-hoc analysis: the
gate of K6A.1.4 is a pre-registration-time measurement on fresh draws, disclosed with its seeds,
replicate counts and guard results; there is no run. (4) Fallback rules: A3 for T1 (K6.15's
inheritance, applied to cells 43–47), K6.12's skip-with-reason for T2. (5) Freeze: T1's seeds are
frozen by K6A.1.9's arithmetic, T2's by `K6SLOW_T2_SCENARIO_SEED = 20260855`. (6) Results
append-only, binding on both arms. (7) Reruns only for a named code defect, prior run preserved; **no
rider and no quote-and-correct is filed** — the design page's own §gate and
§what-this-page-does-not-claim corrections were already made by the operator on the page itself
(§Outcome's two quote-and-corrects), so there is nothing left for this document to correct.
(8) The report states every endpoint's number and verdict — discharged by K6A.1.12.

**Write-back obligations, named and NOT done here** (the wiki is not this document's to edit):
the design page needs the fresh gate's result (PASS, `0.6207`, median `4,950`, healthy `0.0181`,
screen `0/280`); **the single-draw lottery of K6A.1.7 as a property of its own coverage rule** — a
`>= 0.50` threshold read on one calibration draw makes this class's YES/NO a `79/21` coin at a true
detection of `0.62`, which the page's "YES iff canonical detection ≥ 0.50 within H" does not
anticipate; the T2 near-vacuity at `W = 150` (K6A.1.11); and the `mix-d1.0` boundary reading, which
makes `d = 1.5` this class's effective grid floor.

### K6A.1.15 Named-not-done

- **Averaging the calibration draw.** The one-draw-per-cell construction (§6/C1.2) is what makes the
  class answer a `79/21` coin; averaging or re-drawing would collapse it. **A protocol change across
  every held-out-stream candidate, not this amendment's call.** Named with its measured consequence.
- **A longer T2 clustersynth window for this class**, to restore a live T2 falsifier at `W = 150`
  (K6A.1.11). Its own decision; K6.12 is unchanged here.
- **`safe_t` and `universal_inference` on the long-span scenario** — not registered (K6A.1.9), so
  this class row has no paired-comparison partner.
- **The T3 real-data claim, contamination robustness, and any wall-clock guarantee** — all out of
  claim, per the design page's §what-this-page-does-not-claim, unchanged.

### Amendment summary

Registers **the fresh `H = 6,000` gate the design page's re-ratification section requires, and its
PASS**, plus every registration a passing gate obliges — prereg text only, in its own commit, with no
module, card, adapter, cell, harness or constants-table change made here. Authority: **operator
decision 2026-08-08 taking option 1 of the decision package v2.K6A filed**, recorded in the ratified
design page and quoted here verbatim with its three-link provenance chain named (`H = 3,000` was the
**controller's drafting proxy**, not an operator number; v2.K6A filed the miss without acting on it;
the operator moved the bar). **Registered on the record, twice, that this is a post-measurement
relaxation of a bar that a first measurement missed, and that v2.K6A's `H = 3,000` refutation stands
un-withdrawn** — indeed this amendment's fresh draw **independently reproduces it** at `0.250`
against v2.K6A's registered `0.2493 ± 0.0052` on disjoint seed bands, which is what makes the new
horizon a moved goalpost that was honestly measured rather than a repaired measurement (K6A.1.1,
K6A.1.4). The configuration is the one **frozen before the bar moved** and is not re-optimized:
`W = 150`, `n = 100,000`, `A/B = 25,000/75,000`, `m = 500` (saturated), energy distance,
`κ = 0.6820` — a frozen literal now `0.00115` above the freshly-implied `1/x = 0.680848`, worth
`< 0.001` in detection, and **kept, because re-deriving `κ` on the data that reports the endpoint is
the circularity v2.K6A removed and moving it after a bar relaxation would be indefensible**
(K6A.1.2). Fresh probe: **new seed bands `1.30e9`/`1.42e9`/`1.54e9`**, disjoint from the registered
`<= 1e8` family, from the earlier `1.7e9`–`4.1e9` probes and from v2.K6A's own `1.1e9`/`6.0e8`/
`7.5e8`/`9.0e8`, all `< 2^32`; **280 calibration draws × 72 trajectories = 20,160 per arm**; the
**C1.2 serial-structure guard RUN on all 280 `φ=0` draws (mean `acf` `0.00010`/`0.00008`) and on the
`φ=0.6` grid draws (`0.5999`/`0.3594` against `(0.6, 0.36)`), rejected none** (K6A.1.3).
**GATE VERDICT: PASS. Detection-within-6,000 `0.6207`** (cluster-robust SE `0.0091`, between-offset
SE `0.0089`, in agreement — the `κ`-re-estimation over-dispersion of v2.K6A's first pass is gone
because `κ` is frozen), **median time-to-cross `4,950 <= 6,000`**, quartiles over all trajectories
`3,000 / 4,950 / >6,000`, **healthy 6,000-tick paging `0.0181 ± 0.0014 <= α = 0.05`**, **null-growth
screen `0/280` with a `4.30` sd margin**, exact discrete null law matched (`E[e|null]` MC `0.990924`
vs exact `0.991433`, `<= 1`), full 40-point time-to-detection curve reported, and the earliest
arithmetically possible crossing (window 2, `300` ticks) confirmed by the `mix-d2.0` cell's measured
median of exactly `300` (K6A.1.4–K6A.1.6). **Registered as part of the verdict, not as a footnote:
the gate's `0.6207` is a mean over 280 calibration draws and the run draws ONE, with per-draw sd
`0.1527` against within-draw binomial noise of `0.0109` — a factor of 14 — so `60/280 = 21.4%` of
draws read canonical detection BELOW `0.50` and `23.2%` have a censored median. The registered
canonical band is `[0.333, 0.848]` p05–p95, a reading inside it CONFIRMS this gate, and
`P(K6-slow = YES) ≈ 0.79` conditional on the card reaching USE — a single-draw NO is the lottery and
must be reported as "class NO at this calibration draw", not as a falsification** (K6A.1.7). Grid at
the frozen `κ`, `140` draws × `24` per cell: `mix-d1.0` **uninformative at this `W`, not merely
under-powered** (`x = 1.00208 ± 0.00410`, `0.5` SE above the sign-change boundary; `0.0220`
predicted, making `d = 1.5` the class's effective grid floor); `mix-d2.0` `1.0000` with
`x = 6.216606 = log 501` and SE exactly `0.00000` because **every window returned the minimum
attainable `p = 1/501`** — the `s = sqrt(1-d²/4) = 0` two-point degeneracy K6.2.1/K6E.8 registered,
**a boundary artifact and not shape sensitivity**; `mix-d1.5-ar1` **`0.0000`** (`x = 0.5328`,
strongly anti-informative because `injectShapeMix` REPLACES post-onset values with i.i.d. draws while
the calibration blocks stay AR(1) — K6E.8's mechanism at `W = 150`), with **validity intact at
matched `φ = 0.6`** (`0.0170 <= α`, `0/140` positive null growth) (K6A.1.8). Registers the long-span
T1 scenario for this class only (`T = 6,300`, `ONSET = 300`, `TEST = {300, 6000}` → 40 windows of 150
with no remainder, `100,000`-row substrate, `A/B = 25,000/75,000`, `N = 2,000`), **cells 43–46 plus
arm 47 and `K6SLOW_T2_SCENARIO_SEED = 20260855`, continuing past the highest registered index 42 and
NOT reusing the reserved 36/37**, with the seed-ceiling check shown (`<= 1e8`, so no registered seed
can collide with any probe band), and the deliberate single-detector assignment whose cost —
**no paired-comparison partner, `pairingGaps` will name it** — is registered rather than hidden
(K6A.1.9). Stop conditions on both tiers, checked first, **including the null-growth screen as a
registered stop condition run on FRESH draws at run time (`>= 1` of `250` positive → STOP,
investigate, do not run)** — and, measured rather than assumed, **the T1 healthy paging bound's own
false-fire rate: `22/280 = 7.9%` of draws page above `α` and the Wilson-LB condition fires on
`11/280 = 3.9%` by calibration lottery alone, which the null-growth screen does NOT catch (all 280
passed it), so the two checks are complementary and a fired paging bound must be reported with the
screen's reading beside it** (K6A.1.10). T2: **K6.12/K6.1.3's construction, scenario, spans and field
names cited UNCHANGED**, with the arithmetic consequence of the frozen `W = 150` disclosed rather
than discovered at run time — the `9,000` reference ticks cannot supply `m = 500` (`75,000` needed),
so preserving the frozen `1:3` ratio gives `A = 2,250 / B = 6,750 / m = 45` and `4` live windows;
**T2's `m` therefore differs from T1's, breaking K6E.10's one-`m` property for a stated reason, and
the T2 healthy falsifier is very nearly VACUOUS** (a crossing needs `S_4 >= 14.2347` of a maximum
`15.3146`, `93%` of the theoretical ceiling, against `E[S_4|null] = 3.7535`), disclosed exactly as
K6E.11 disclosed T1's vacuity, with the arm still running for its contiguity/skip-accounting evidence
and a longer T2 window named not-done (K6A.1.11). Predictions with **per-calibration-draw bands** for
every endpoint the runs will read, including the structural zeros and the `1.0000` artifact
(K6A.1.12). **Golden expectation, checked against the code and not assumed: `coverageFor`
(`score.mjs:358`) iterates `Object.keys(FAULT_CLASSES)` and that object is a hardcoded frozen
`K1`–`K6` (`constants.mjs:57-74`), so a `K6-slow` row CANNOT exist until the class list gains an
entry — no cell's own `fault_class` creates a row.** The nine-item code change is registered with
file:line and **assigned to the build tasks, not to this commit**, with items 7–8 (per-class scenario
span and per-class substrate size, both currently module scalars asserted against §6) named as the
build's real risk requiring proof of **bit-for-bit invariance of every existing cell**. Pre-run golden
tuple `NOT_EXECUTABLE`/`null`/S1 `MISSING`/S2 `MISSING`/S3 `MISSING`/S4 `PASS`; post-run expected
`USE`/T1 — **not capped at ADVISORY, unlike v2.K6E, because the S3 arm at `d = 2.0` reads `1.0000 >=
INERTNESS_FLOOR`** so `score.mjs:568`'s valid-but-inert return is not taken, leaving S4 as the only
gate to USE and S1 blocking nothing by design; **the new COVERAGE.md row is predicted YES at tier T1
conditional on (a) the card's own S4 landing PASS and (b) the `≈79%` single-draw event, with a NO
registered in advance as a possible and non-surprising outcome** (K6A.1.13). House rules mapped, with
**no rider and no quote-and-correct filed** — the page's own two corrections were already made by the
operator on the page — and four write-back obligations named, the sharpest being that **this class's
own coverage rule (a `0.50` threshold read on one calibration draw) turns a true `0.62` into a
`79/21` coin**, which the page does not anticipate (K6A.1.14). Named-not-done: averaging the
calibration draw, a longer T2 window, the two moment detectors on the long span, and the unchanged
out-of-claim items (K6A.1.15). **No endpoint, floor, seed, prediction or verdict in §1–14 or in any
earlier amendment moves; v2.K6A's `H = 3,000` refutation and `K6 = NO` at the deploy-gate geometry
both stand; and no artifact was created by this commit.**

## Amendment v2.K6A.2 — 2026-08-08, the build-readiness repair: three missing code items, the lottery rule closed, and a false freshness argument withdrawn

Registered after an independent review of Amendment v2.K6A.1 verdicted **NOT-SOUND for
build-readiness**, and before any artifact of the K6-slow candidate exists — still no module, card,
adapter, cell, harness change or run, and none is created here. **Prereg text only, own commit.**
This amendment corrects v2.K6A.1 by quote-and-correct with the original left intact; **no endpoint,
floor, seed, prediction or verdict belonging to any candidate moves**, and the gate verdict does not
move either.

**The review's own finding on the measurement, recorded first because it bounds what this amendment
is.** The reviewer re-measured the gate independently and **CONFIRMED it**: detection
`0.6208` (cluster-SE `0.0092`) against v2.K6A.1's `0.6207 ± 0.0091`; median time-to-cross `4,950`
identical; crosser quartiles `2,400 / 3,450 / 4,650` identical; null-growth screen `0/280`; the
`H = 3,000` reproduction `0.2435` against v2.K6A.1's `0.250` and v2.K6A's registered
`0.2493 ± 0.0052`; **every closed form exact.** **Nothing in K6A.1.4–K6A.1.8 re-measures and nothing
is withdrawn. The NOT-SOUND verdict is about the REGISTRATION's build-readiness, not the gate**, and
this amendment repairs exactly that.

**Status after this amendment: the build tasks STOP pending the controller's go.** Nothing in
K6A.2.1's code table is executed here.

### K6A.2.1 Three code items v2.K6A.1's nine-item table MISSED (items 10–12), each verified at HEAD

v2.K6A.1 K6A.1.13 registered nine code changes and asserted they were what a `K6-slow` row requires.
**Three more are required, and without them the build either fails its own suites or — item 12 —
runs the WRONG PROBE and still passes.** All line numbers verified against HEAD in this worktree.

| # | file:line | change | what breaks without it |
|---|---|---|---|
| **10** | `validation/certification/test/coverage-score.test.mjs:15-16` | the test `'registry: six classes, frozen shape'` asserts `deepEqual(Object.keys(FAULT_CLASSES), ['K1','K2','K3','K4','K5','K6'])`; register its update to the seven-key shape **and its name**, which states "six classes" as a frozen property | **item 1 breaks it immediately** — the deepEqual is exact, so adding `'K6-slow'` fails this assertion |
| **11** | `validation/certification/test/report-consistency.test.mjs:58-60` | `classIds = Object.keys(FAULT_CLASSES)`; `rows` = COVERAGE.md lines starting `\| <classId> \|`; `assert.equal(rows.length, classIds.length, …)` **for every committed run directory** | **item 1 alone takes `test:cert` from `171/0` to `169/2`** (reviewer-measured), and one of those failures is this assertion **enforcing append-only across eight committed run dirs**: their COVERAGE.md files have six class rows and a seventh class would demand seven. See the RULING below. |
| **12** | `run-battery.mjs:986` | `const shapeKind = detId === 'shape_block_conformal_bet';` — a **literal detector-id equality**, not a kind test. Register its extension to cover both shape detectors, **with per-detector `W`** | **a silent wrong-probe failure that still reads POWERED** — derived below |

**Item 12's failure mode, named in full, because it is the one that would not announce itself.**
With `detId = 'shape_ecdf_accumulator'` and the dispatch unextended, `shapeKind` is `false` and
`pointKind` is `false`, so:

- **No held-out stream is fetched at all** (`:988-993`): the `if (detId === 'family_E_conformal_heldout' || pointKind || shapeKind)` block is skipped, so `ctx.heldoutSeed` and `ctx.shapeCal` are `undefined` — arm 47 would run with **no calibration substrate**, contradicting K6A.1.9's registered `HELDOUT_SEED 20760854` and 100,000-row draw.
- **The S3 injection falls through to the final ternary branch** (`:1028-1033`):
  `{ series: injectStep(base.series, { sigma: SIGMA, at: ONSET, delta: 3 }) }` — **a K1-type 3σ mean
  step, NOT the registered `injectShapeMix` at `d = 2.0`.** A mean shift of `3σ` moves the whole ECDF
  away from `F̂_A`, so **the arm would read POWERED on the wrong fault class entirely** and S3 would
  pass on evidence about K1, not about distributional shape.
- **The emitted provenance would contradict K6A.1.10 verbatim**: `:1073` gives
  `null_id: arm.phi === 0 ? 'N1' : 'N3-p06'` → **`'N1'`**, and `:1075` gives
  `params: (pointKind || shapeKind) ? 'heldout-empirical' : 'oracle'` → **`'oracle'`**, against
  K6A.1.10's registered `null_id: 'K6slow-arm-heldout'`, `params: 'heldout-empirical'`. The S3 twins
  of both ternaries are `:1132` and `:1134`.

**Registered as the fix, not merely the diagnosis:** the dispatch becomes a **kind test covering both
shape detectors with a per-detector window length**, because `K6_WINDOW_LEN` is **hardwired to
`shapeBlockBet.W_K6` at `:103` and asserted `!== 30 → throw` at `:105`**, so a `W = 150` detector
cannot reuse it. **Downstream sites the extension must carry, as enumerated by the review:**
`:988-993` (the ctx block), `:1028-1033` (the injection ternary), `:1073`, `:1075`, `:1082`, `:1088`,
`:1102`, `:1132`, `:1134`, `:1149`, `:1161-1170`, `:1204`.

**THE CONTROLLER'S RULING on item 11, registered as the controller's and not as this document's
finding.** Quoted:

> repair via the `report_format` gate precedent (the C1.9 pattern, and today's format 4→5) — the
> K6-slow build bumps `report_format` to 6; the row-count assertion checks the seven-class shape for
> runs at format `>= 6` and the frozen six-class shape for older formats; committed results are never
> rewritten.

**The constraint this honors, cited:** `validation/certification/verdict.mjs:322` —
*"FUTURE RUNS ONLY -- committed COVERAGE.md files are not rewritten."* `report_format` is already the
registered instrument for exactly this: it is *"the shape of this run's emitted markdown, NOT the
protocol version"* (`verdict.mjs:64`) and currently reads `5` (`verdict.mjs:76`), having gone `4 → 5`
at h0-battery Amendment A1 for a comparable shape change. **Registered: `report_format 5 → 6` at the
K6-slow build, the row-count assertion gated on it, and the eight committed run directories left
byte-for-byte alone.** The ruling is the controller's; the citations are this document's.

### K6A.2.2 The mix-d2.0 conjunction, stated plainly — and my own report's claim corrected

**Registered, in one sentence, the conjunction v2.K6A.1 left implicit across two sections:**
**the card's route to `USE` rests on the `mix-d2.0` cell that K6A.1.8 itself rules a boundary artifact
and NOT evidence of shape sensitivity.** K6A.1.8 registers `mix-d2.0`'s `1.0000` as the `s =
sqrt(1-d²/4) = 0` two-point degeneracy — *"a boundary artifact and is NOT evidence of shape
sensitivity"* — and K6A.1.13 registers that this same cell is what makes `s3Powered.length !== 0`, so
`score.mjs:567`'s valid-but-inert `ADVISORY` return is not taken and S4 becomes the only remaining
gate to `USE`. **Both statements were registered; their conjunction was not, and it is the
consequence that matters: without the degenerate cell this card caps at ADVISORY, and with it the
card's USE — and therefore the class row's YES — is carried by an injection the amendment itself
declines to call evidence.** Nothing is withdrawn: K6.8's construction is reused verbatim, including
its honesty clause that no stronger or invented probe is substituted. **What is registered is the
dependency, so no reader can find it only by intersecting two sections.** K6A.1.12's cell-47 S3 row
is corrected to carry the note: `1.0000 → POWERED`, **on the `d = 2.0` boundary artifact of K6A.1.8 —
this cell alone lifts the card off the ADVISORY cap.**

**Quote-and-correct, my own, owned rather than absorbed.** The C49 task-2 report
(`.superpowers/sdd/2026-08-08-c49-k6-accumulator/task-2-report.md` §6 concern 5) states:

> That is K6.8's registered construction reused verbatim (no stronger probe substituted), but the
> card's USE consequently rests on a boundary artifact, **which I registered plainly.**

**Correct: it was NOT registered plainly.** The two halves were registered in K6A.1.8 and K6A.1.13
separately; the conjunction appeared only in the report, which is not a registered artifact. The
claim that the prereg carried it was wrong, and the sentence above (K6A.2.2, first paragraph) is
where it becomes registered.

### K6A.2.3 The freshness argument, replaced: exact-seed disjointness holds, "below 1.7e9" is FALSE

**Quoted, v2.K6A.1 K6A.1.3:**

> The three bands above are mutually disjoint,
> disjoint from all of those, below `1.7e9`, and all `< 2^32`, so the LCG's `seed >>> 0` performs no
> wrap and the stated band is the band actually used.

**Correct: the band-ordering half of that argument is FALSE and is withdrawn.** Band ordering proves
nothing about disjointness of the seeds actually drawn, for two reasons the review makes concrete:

- **v2.K6A's own `1.1e9` anchor family climbs straight through all three fresh bands.** Its form is
  `1.1e9 + {1000003, 7000019, 13000027}·rep` with `rep` to 400, so its raw values reach
  `≈ 6.3e9` — passing through `[1.30e9, 1.321e9]`, `[1.42e9, 1.441e9]` and `[1.54e9, 1.561e9]` on the
  way. "Below `1.7e9`" excludes nothing.
- **Families at or above `1.7e9` wrap `mod 2^32` and re-enter the fresh bands from below.** The
  `>>> 0` that v2.K6A.1 cited as a *reason* the bands are clean is in fact the mechanism by which a
  higher family lands inside them.

**What freshness actually rests on, registered as the sole ground:** **exact-seed disjointness,
established by enumeration.** The reviewer enumerated every seed this probe draws against every prior
registered and probe family and found **no exact collision** — reported as 1,680 seeds; this
document's own count is 1,960 (gate `4 offsets × 70 reps × 3 bands = 840`; grid
`4 cells × 140 reps × 2 bands = 1,120`), the difference being a counting convention over the fourth
grid cell, which shares the healthy band. **The conclusion is identical either way and it is the
enumeration, not the band arithmetic, that carries it.**

**And v2.K6A's one-orbit disclosure, restated because K6A.1.3 dropped it.** Quoted, v2.K6A K6A.10:

> **Cluster-robust SEs treat reference draws as independent**, which the single-orbit LCG makes
> approximately rather than exactly true (K6A.3).

**This still applies to every number in v2.K6A.1.** The registered `rng` is a 32-bit LCG with a
single full-period orbit, so distinct seeds are **offsets into one sequence**, not independent
streams; exact-seed disjointness guarantees no two streams *start* at the same point, **not** that
their consumed segments never overlap. At this probe's consumption a small number of segment overlaps
among its streams is expected, and the cluster-robust SEs do not model them. **Registered as a
limitation, not corrected — it is the harness's own generator, and the gate's margin is a factor of
`1.24` on the floor with an independent replication agreeing to `0.0001`, not a standard error.**

### K6A.2.4 The lottery rule, closed: the gap dispositioned, a mirror rule for YES, and the sd corrected

**(a) The self-contradiction, quoted and resolved.** v2.K6A.1 K6A.1.7 says:

> **Registered: a canonical reading in `[0.333, 0.848]` CONFIRMS this gate** […] The gate is falsified
> by a reading **outside** the band — below `0.333` or above `0.958` […]

A reading in `(0.848, 0.958]` is simultaneously "outside the band" (falsifies) and not "above
`0.958`" (does not falsify). **Corrected by separating two objects v2.K6A.1 conflated, and the rule
below is registered IDENTICALLY here and in the correction to K6A.1.12:**

```
PREDICTION BAND (what to expect, 90% central):        [0.333, 0.848]
CONSISTENCY INTERVAL (what confirms the gate):        [0.333, 0.958]
FALSIFIED:                                            < 0.333  or  > 0.958
DISPOSITION OF (0.848, 0.958]:  CONSISTENT with the gate — an upper-tail calibration draw,
   inside the 280-draw observed support (whose maximum was 0.958). NOT a falsification, and
   NOT to be reported as one.
```

`0.958` is the **observed maximum over the 280 draws**, so a reading above it is the surprise that
warrants investigation; `0.848` is merely p95. **Registered rationale: the band answers "what will
the run read?", the interval answers "what would refute the gate?", and they are not the same
question.**

**(b) The MIRROR rule for YES, which v2.K6A.1 registered only in the NO direction.** K6A.1.7 required
a single-draw NO to be reported as *"class NO at this calibration draw"* rather than as a
falsification. **The symmetric obligation is registered here: a single-draw YES is reported as
"class K6-slow YES at this calibration draw; gate `P(YES) ≈ 0.79`" and NEVER as a settled class
answer.** A YES at `p50 ≈ 0.625` is the same coin landing the other way; the asymmetry in
v2.K6A.1 — caveating only the outcome that would disappoint — is exactly the direction a reader
should distrust, and it is corrected.

**(c) The per-draw sd, corrected by deconvolution; the "factor of 14" mixed two different `n`.**
Quoted, K6A.1.7:

> the per-draw sd is `0.1527` against a within-draw binomial noise of
> `sqrt(0.62·0.38/2000) = 0.0109`, a factor of `14`

**Correct: those two numbers come from different trajectory counts and are not comparable as
written.** `0.1527` is the sd of 280 draw-means each computed from `TJ = 72` trajectories, so it
**already contains** within-draw binomial noise at `n = 72` (`sqrt(0.6207·0.3793/72) = 0.0572`);
`0.0109` is binomial noise at `n = 2000`. Deconvolving:

```
observed sd of draw means (TJ=72)      0.1527
within-draw binomial at n=72           0.0572
TRUE calibration-draw sd               sqrt(0.1527^2 - 0.0572^2) = 0.1416
run's binomial noise at n=2000         0.0108
correct ratio                          0.1416 / 0.0108 = 13.0
```

**Registered: the calibration-draw sd is `0.1416`** (the review's `≈ 0.143` agrees to rounding),
**and the correct statement of dominance is a factor of `13.0`, not `14`.** The qualitative
conclusion is unchanged and the direction of the correction is against this document's own
convenience.

**Consequent band correction, stated with which interval is operative.** Scaling the observed central
interval by `0.1416/0.1527 = 0.9272` about the mean gives a run-predictive band of
**`[0.354, 0.831]`**; `P(detection < 0.50)` falls from the empirical `21.4%` (at `TJ = 72`) to
**`≈ 19.6%`** on the deconvolved sd, so `P(YES) ≈ 0.79`–`0.80`. **Registered: the operative band
stays the empirical `[0.333, 0.848]` and the consistency interval `[0.333, 0.958]`, both of which are
CONSERVATIVE (wider than the run's predictive band by the `TJ = 72` measurement noise), and the
operative `P(YES)` stays `≈ 0.79`, the lower of the two** — a wider band cannot manufacture a
confirmation and the lower `P(YES)` cannot oversell the class. The deconvolved figures are registered
as the correct measures of calibration spread; the conservative ones remain the test.

### K6A.2.5 Citation corrections, and two under-scoped code items

**Five citations in v2.K6A.1 are wrong or imprecise; corrected against HEAD, originals intact. No
claim they support moves.**

| v2.K6A.1 said | correct at HEAD | what is actually there |
|---|---|---|
| `parseSeverity` at `:343-359` (item 4) | **`:342-355`, the throw at `:354`** | `function parseSeverity` opens `:342`; `case 'K6'` `:351`; `throw new Error(… §2's grammar)` `:354` |
| `score.mjs:568` (valid-but-inert `ADVISORY`) | **`score.mjs:567`** | `return done('ADVISORY', minTier(s2Supporting.map((c) => c.__tier)));` |
| `score.mjs:578-585` (S4 gate) | **REFUSE at `:576`, the `USE` return at `:587`** | `if (s4.status === 'REFUSE')` `:576`; `return done('USE', tier)` `:587` |
| `verdict.mjs:249` (the class-YES rule) | **`validation/certification/verdict.mjs:272`** — **not** `lib/` | inside `classRow(classId)` (`:270`): `.filter((o) => o.overall.verdict === 'USE' && o.coverage[classId].status === 'COVERED')` |

**Items 7 and 8 were under-scoped.** v2.K6A.1 cited `HELDOUT_ROWS` at `:84` and `:293` only.
**`HELDOUT_ROWS` is read at nine further sites, every one of which a per-class substrate size must
carry:** `:644`, `:648`, `:652` (the draw itself, including the `FORCE_HELDOUT_LATTICE` control
path), `:913`, `:925`, `:966` (per-cell `c.heldout_rows` emission), `:1164`, `:1165` (the arm's S2/S3
`heldout_rows`), and **`:1272`, the run manifest's own provenance string**, which would otherwise
state `10000` for a 100,000-row draw and put a false constant in the emitted record.

**And one mechanism v2.K6A.1 did not register at all: arms are keyed by `hint`, not by class.**
`:979` reads `for (const arm of ARM_CELLS.filter((a) => CLASSES_RUN.includes(a.hint)))`, so arm 47
must carry `hint: 'K6-slow'` to be selected under `--classes K6-slow`, **and its scenario span comes
from the module-level `T`/`ONSET` at `:1013-1018`, not from the fault-cell path.** **Registered: arm
47's long span (`T = 6,300`, `ONSET = 300`) must be wired through the ARM path explicitly** — item 7's
per-class span is necessary but not sufficient, because the arm loop reads the scalars directly.

### K6A.2.6 T2 addendum: the null law shifts at m = 45, so T1's number must not be carried across

v2.K6A.1 K6A.1.11 registered T2's `m = 45` and K6A.1.12 registered the T1 arm's
`increment_estimator.mean` prediction of `0.9914` (exact `E[e|null] = 0.991433` at `m = 500`).
**The T2 arm's `m` is 45, where the discrete null law is materially different, and v2.K6A.1
registered no T2 counterpart — so the T1 figure could be carried across by default. Closed here:**

| quantity, at `κ = 0.6820` | T1, `m = 500` | **T2, `m = 45`** |
|---|---|---|
| `E[log p \| null]` | `-0.991961` | **`-0.938368`** |
| `E[e \| null]` — the `increment_estimator.mean` prediction | `0.991433` | **`0.960274`** |
| mean `p` | `0.500998` | `0.510870` |

**Registered T2 prediction: `t2` increment mean `0.960274`, band `[0.94, 0.98]`; the T1 value
`0.9914` is NOT the T2 expectation and a T2 reading near `0.99` would indicate the wrong `m` was
used.** Reported with no verdict authority, as K6.7/K6.12's caveat requires; the T2 verdict stays
`t2_crossing_rate`-derived, predicted `0.0000` (K6A.1.11).

**One correction in the review's own direction, because this document pins numbers.** The review
gives `E[log p|null] = -0.938375` at `m = 45`. **The exact value is `-0.938368`**
(`(log((m+1)!) − (m+1)·log(m+1))/(m+1)`, computed two independent ways — `lgamma(47)` and a
Kahan-summed `Σ log k` — agreeing to nine decimals at `-0.938368026`). The review's figure differs in
the sixth significant figure. **No endpoint moves; the `E[e|null]` prediction above is unaffected**,
and the correction is registered only because a pinned number should be right.

**The review's two higher readings, recorded as replications rather than as disagreements.** The
reviewer measured healthy `6,000`-tick paging at **`0.0206`** against v2.K6A.1's `0.0181 ± 0.0014`
(both `<= α = 0.05`, `1.8` SE apart), and characterized the T1 conditional false-fire rate as
**"a few percent, quantization-dominated"** against v2.K6A.1's `3.9%`. **Registered: both replicate.**
The quantization point is adopted and is worth stating, since v2.K6A.1 quoted `3.9%` to two
significant figures: the Wilson lower bound at `n = 2000` moves in steps of one crossing
(`1/2000 = 5e-4`), so the count of draws on either side of the threshold is granular and **`3.9%`
should be read as "a few percent", not as a two-figure rate.** The registered stop condition and its
reporting rule (K6A.1.10 — a fired paging bound must be reported with the null-growth screen's
reading beside it) are unchanged.

### K6A.2.7 House rules, mapped

(1) **Committed before any artifact it authorizes** — nothing of K6-slow exists at this commit, and
**the build tasks of K6A.1.13 + K6A.2.1 items 10–12 STOP here pending the controller's go.** (2) A
failed endpoint is a publishable result; nothing above moves afterward. (3) No post-hoc analysis: no
run exists, and **this amendment re-measures nothing** — every number in it is either quoted from
v2.K6A.1, quoted from the review, or arithmetic on v2.K6A.1's already-registered sample (the
deconvolution of K6A.2.4c and the `m = 45` null law of K6A.2.6, both closed-form). (4)–(6) Moot: no
new cell, seed, fallback or result is registered. (7) **Quote-and-correct for text, which is what
K6A.2.2, K6A.2.3, K6A.2.4 and K6A.2.5 do**, each with the original quoted and left intact —
including a correction to **this author's own task report** (K6A.2.2) and one to **the review's own
arithmetic** (K6A.2.6). (8) Every endpoint's number and verdict stand as K6A.1.12 registers them,
with the two corrections named above.

**Write-back obligations, unchanged from v2.K6A.1 K6A.1.14 and still NOT done here**, plus one added:
that the `report_format` gate is now the registered mechanism by which a new fault class enters
COVERAGE.md without rewriting committed results.

### Amendment summary

Registers the **build-readiness repair** of Amendment v2.K6A.1 after an independent review verdicted
it **NOT-SOUND for build-readiness while CONFIRMING the gate measurement itself** (reviewer's own MC:
detection `0.6208` cluster-SE `0.0092`, median `4,950`, crosser quartiles identical, screen `0/280`,
`H = 3,000` reproduction `0.2435`, every closed form exact). **Nothing re-measures; no endpoint,
floor, seed, prediction or verdict moves; the gate verdict PASS stands; and the build tasks STOP here
pending the controller's go.** Adds **three code items v2.K6A.1's nine-item table missed**, verified
at HEAD (K6A.2.1): **item 10**, `coverage-score.test.mjs:15-16`'s `deepEqual` on the six-key
`FAULT_CLASSES` shape, which item 1 breaks immediately, name included; **item 11**,
`report-consistency.test.mjs:58-60`'s per-run-directory assertion that every committed COVERAGE.md
has exactly `Object.keys(FAULT_CLASSES).length` class rows — reviewer-measured to take `test:cert`
from `171/0` to **`169/2`** on item 1 alone, one failure **enforcing append-only across eight
committed run dirs** — carrying **the CONTROLLER'S RULING**, quoted as the controller's: repair by the
`report_format` gate precedent (the C1.9 pattern and today's `4 → 5`), **`report_format 5 → 6` at the
K6-slow build, the row-count assertion checking the seven-class shape at format `>= 6` and the frozen
six-class shape below it, committed results never rewritten** — honoring
`verdict.mjs:322`'s *"FUTURE RUNS ONLY -- committed COVERAGE.md files are not rewritten"* and using
the field `verdict.mjs:64` already defines as emitted-markdown shape rather than protocol version;
and **item 12**, `run-battery.mjs:986`'s literal `detId === 'shape_block_conformal_bet'`, whose
**silent wrong-probe failure mode is named in full**: unextended, arm 47 fetches **no held-out
stream** (`:988-993`), its S3 injection **falls through to `injectStep` at `delta = 3`**
(`:1028-1033`) — a K1-type mean step, not the registered `d = 2.0` shape mix — which an ECDF feature
**still reads POWERED**, while `:1073`/`:1075` emit `null_id 'N1'` and `params 'oracle'`
contradicting K6A.1.10's registered `'K6slow-arm-heldout'`/`'heldout-empirical'`; the fix is
registered as a **kind test over both shape detectors with per-detector `W`**, since `K6_WINDOW_LEN`
is hardwired to `W_K6` at `:103` and asserted `!== 30 → throw` at `:105`, with the downstream sites
enumerated (`:988-993, :1028-1033, :1073, :1075, :1082, :1088, :1102, :1132, :1134, :1149,
:1161-1170, :1204`). States **in one plain sentence the conjunction v2.K6A.1 left implicit across two
sections — the card's route to `USE` rests on the `mix-d2.0` cell that K6A.1.8 itself rules a boundary
artifact and not evidence of shape sensitivity** — cross-referencing both, adding the artifact note to
K6A.1.12's cell-47 S3 row, and **correcting this author's own task report by quote-and-correct for
claiming the conjunction was already registered plainly, which it was not** (K6A.2.2). **Withdraws a
FALSE freshness argument**: v2.K6A.1's "below `1.7e9`" band-ordering claim is quoted and withdrawn,
because v2.K6A's own `1.1e9` anchor family climbs through all three fresh bands (raw values to
`≈ 6.3e9`) and families `>= 1.7e9` wrap `mod 2^32` back into them — **the `>>> 0` cited as a reason
the bands were clean is the mechanism by which they are not**; freshness rests **solely on exact-seed
disjointness by enumeration** (no collision; 1,680 seeds by the review's count, 1,960 by this
document's, a counting convention over the fourth grid cell, same conclusion), and **v2.K6A's
one-orbit disclosure — dropped in K6A.1.3 — is restated: distinct seeds are offsets into ONE
full-period orbit, so exact disjointness bounds start points, not segment overlap** (K6A.2.3). Closes
**three gaps in the lottery rule** (K6A.2.4): the self-contradiction between "outside the band" and
the glossed bounds is resolved by separating **prediction band `[0.333, 0.848]`** from **consistency
interval `[0.333, 0.958]`**, with `(0.848, 0.958]` **explicitly dispositioned as CONSISTENT** — an
upper-tail draw inside the 280-draw observed support whose maximum was `0.958` — and the rule stated
identically in both sections; a **MIRROR rule for YES** is added, since v2.K6A.1 caveated only the
disappointing outcome (**a single-draw YES reads "class YES at this calibration draw; gate
`P(YES) ≈ 0.79`", never as settled**); and the **per-draw sd is corrected by deconvolution** — the
quoted "factor of `14`" compared an sd of `TJ = 72` draw-means against binomial noise at `n = 2000`,
two different `n`; the **true calibration-draw sd is `0.1416`** (`sqrt(0.1527² − 0.0572²)`, the
review's `≈ 0.143` to rounding) and the correct dominance ratio is **`13.0`**, implying a
run-predictive band `[0.354, 0.831]` and `P(detection < 0.50) ≈ 19.6%`, **with the conservative
empirical band `[0.333, 0.848]` and `P(YES) ≈ 0.79` kept operative** because a wider band cannot
manufacture a confirmation. Corrects **five citations** against HEAD — `parseSeverity`
`:343-359 → :342-355` with the throw at `:354`; `score.mjs:568 → :567`; `score.mjs:578-585 →` REFUSE
`:576` and the `USE` return `:587`; `verdict.mjs:249 → validation/certification/verdict.mjs:272`,
**not** `lib/` — and **re-scopes items 7 and 8**, which cited `HELDOUT_ROWS` at `:84`/`:293` only,
against its nine further sites (`:644, :648, :652, :913, :925, :966, :1164, :1165`, and **`:1272`,
the run manifest's provenance string**, which would otherwise record `10000` for a `100,000`-row
draw), plus one mechanism v2.K6A.1 never registered: **arms are keyed by `hint` (`:979`) and the arm
loop reads the module-level `T`/`ONSET` directly (`:1013-1018`), so arm 47 needs `hint: 'K6-slow'`
AND its long span wired through the ARM path — item 7 is necessary but not sufficient** (K6A.2.5).
Adds the **T2 addendum**: at `m = 45` the discrete null law shifts, so T1's `0.9914` must not be
carried across — **registered T2 `increment_estimator.mean` prediction `0.960274`, band
`[0.94, 0.98]`, with a reading near `0.99` indicating the wrong `m`** — and, **correcting the review
in its own direction because this document pins numbers, `E[log p|null]` at `m = 45` is
`-0.938368` and not the review's `-0.938375`** (two independent computations agreeing to nine
decimals at `-0.938368026`; no endpoint moves). Records the review's **two higher readings as
replications**: healthy paging `0.0206` vs `0.0181 ± 0.0014` (both `<= α`, `1.8` SE apart) and the T1
conditional false-fire rate as **"a few percent, quantization-dominated"**, whose quantization point
is **adopted** — the Wilson bound at `n = 2000` moves in `5e-4` steps, so v2.K6A.1's `3.9%` is to be
read as "a few percent" and not as a two-figure rate (K6A.2.6). **The gate verdict, the frozen
configuration, the H = 6,000 PASS, v2.K6A's H = 3,000 refutation and `K6 = NO` at the deploy-gate
geometry all stand unchanged; no artifact was created; and the build does not start until the
controller says so.**

---

## Amendment v2.K6A.3 — 2026-08-08, the micro-amendment rider: the null-growth screen gets a registered DRIVER, `class_spans` is named as an A8 extension, arm 47's S3 saturation is registered as mechanism, and four cosmetic defects in v2.K6A.2 are corrected

Registered after an independent review of the C49 build (task-4 spec PASS, quality APPROVED; the
invariance proof independently reproduced to identical digests) found **three things the build
depends on that no amendment registers**, and after a re-review of v2.K6A.2 itself found **four
cosmetic defects**. **Prereg text only, own commit, before the code it authorizes.** Nothing here
re-measures anything. **No endpoint, band, floor, seed, prediction or verdict of any candidate
moves**, the H = 6,000 gate verdict PASS stands, v2.K6A's H = 3,000 refutation stands, and
`K6 = NO` at the deploy-gate geometry stands.

**What this rider is NOT.** It does not relax the stop conditions of K6A.1.10, does not change the
frozen configuration of K6A.1.2, and does not touch K6.12's T2 construction. K6A.3.1 registers the
*driver* for a check K6A.1.10 already registered as mandatory; K6A.3.2 names a manifest field the
build already emits; K6A.3.3 states a mechanism that makes an already-registered dependency worse,
not better.

### K6A.3.1 THE NULL-GROWTH SCREEN DRIVER — registered, because the check was mandatory and nothing called it

**The gap, stated exactly.** K6A.1.10 registers the null-growth screen as **registered stop
condition (2)**, quoted:

> **if `>= 1` of `250` fresh calibration draws at the frozen `κ = 0.6820` has positive null growth
> `log κ + (1-κ)·E[-log p|null,S] > 0`, STOP, investigate, do not run.**

and adds, quoted: *"This screen is run on fresh draws at run time, not inherited from this
amendment — that is what makes it a stop condition rather than a citation."* K6A.1.10 further binds
the screen to the OTHER stop condition's reporting: *"a fired T1 stop condition must therefore be
reported with the null-growth screen's reading beside it."*

**The module exports `nullGrowthScreen` (C49 task 3) and NOTHING CALLS IT.** No item of K6A.1.13's
nine-item table and no item of K6A.2.1's three name a driver, so the build wired every other
registered mechanism and left the run-time stop condition unexecuted. **A stop condition with no
caller is a citation, which is precisely what K6A.1.10 said it must not be.** Registered here, in
full, as the thirteenth code item of this build.

**Placement.** In `run-battery.mjs`, the driver runs **after `assertRegistryAgreement()` and after
`--classes` is resolved, and BEFORE the first trajectory of any cell of any class is generated.** It
runs **if and only if `K6-slow` is in `CLASSES_RUN`** — the screen is a property of this
construction's calibrator, so it is neither run nor reported for a scope that contains no K6-slow
cell. Ordering is registered, not incidental: the screen exists to stop a run before it reads an
endpoint.

**The screen's own construction, per draw `S`.** `g_null(S) = log κ + (1-κ)·Ê[-log p | null, S]`,
the estimator K6A.1.5 registers verbatim, at the frozen `κ = 0.6820`, with `S` a **fresh** 100,000-row
calibration draw at the registered geometry (`W = 150`, `n_A = 25,000`, `m = 500`) and each MC term a
**fresh independent length-150 null window** scored against `S`. Draws are at `φ = 0`.

```
SCREEN_DRAWS               = 250        K6A.1.10's own number ("250 fresh calibration draws")
SCREEN_MC_WINDOWS          = 8000       null windows per draw; the precision derivation below
draw substrate             = 100,000 rows, ONE continuously-advanced stream (C1.2's form)
kappa                      = 0.6820     the frozen literal; NOT re-derived here or anywhere
STOP if                    #{d : g_null(S_d) > 0} >= 1
```

**Why `M = 8,000` and not a round smaller number — the screen's own false-fire rate, bounded before
it can fire.** `Ê[-log p|null,S]` is an MC mean, so `g_null` carries MC noise of
`(1-κ)·sd(-log p)/sqrt(M)`. Under the exact discrete null law at `m = 500`, `sd(-log p) = 0.975005`
(computed from `-log(k/501)`, `k = 1..501`, the same law whose mean `0.991961` K6A.1.5 already
registers; the same computation gives `g_null = -0.067282` at the exact mean, reproducing
K6A.1.5's measured per-draw mean `-6.754e-2`). So:

| `M` | MC SE on `g_null` | worst registered draw (`-1.501e-2`, K6A.1.5) in SE |
|---|---|---|
| 200 | `0.021924` | `0.68` — **unusable: MC noise alone exceeds the margin** |
| 1,000 | `0.009805` | `1.53` |
| 2,000 | `0.006933` | `2.17` |
| 4,000 | `0.004902` | `3.06` |
| **8,000** | **`0.003466`** | **`4.33`** |

**Registered: `M = 8,000`, because the screen must not fire on its own noise.** At `M = 8,000` the
worst draw K6A.1.5 measured sits `4.33` MC-SE below zero, so a clean draw's chance of a spurious
positive is `≈ 7e-6`, and across 250 draws the screen's **false-STOP rate is `≈ 0.2%`** — stated up
front, the same discipline K6A.1.10 applied to the paging bound's own `≈ 4%` lottery. **A screen
whose false-fire rate is not bounded is not evidence either way, and `M = 200` would have made this
falsifier fire more often on noise than on a defect.**

**Seeds — a registered fresh band, disjoint by enumeration.** Freshness rests on exact-seed
disjointness (K6A.2.3's sole registered ground; the band-ordering argument is withdrawn and is not
re-used here):

```
calibration draws   seed(d)    = 41,000,000 + d                      d = 0..249
MC null windows     seed(d, j) = 42,000,000 + 10,000*d + j           j = 0..M-1, M <= 10,000
```

Both ranges are contiguous and enumerable: `[41000000, 41000249]` and, at `M = 8,000`,
`[42000000, 44497999]` — `2,000,250` seeds, mutually disjoint. **The maximum seed any registered
stream of this study starts at is `37,033,479`** (arm 30's K2 matrix, `CELL_SEED 20260837 +
7919*1999 + 104729*9`; the next highest is arm 47's own trajectory maximum `36,090,935`, and the
highest `HELDOUT_SEED` is `20,760,855`). **Every screen seed exceeds `37,033,479`, so exact-seed
disjointness from every registered seed of this study holds by the bound and is checkable by
arithmetic rather than by trust.** All screen seeds are `< 2^32`, so `seed >>> 0` performs no wrap on
them — **stated as a fact about the seeds, NOT as a freshness argument** (K6A.2.3 withdrew that
inference). **The one-orbit limitation K6A.2.3 registered applies here unchanged and is inherited,
not re-argued:** distinct seeds are offsets into ONE full-period LCG orbit, so disjoint start points
do not guarantee disjoint consumed segments, and the probe families of v2.K6A/v2.K6A.1 are not
archived at seed level in this document. **Disclosed, not corrected** — it is the harness's own
generator, and the screen is a validity check on the calibrator rather than an endpoint.

**Wiring of the outcome — both branches registered.**

- **FAILED screen (`>= 1` positive draw): the run ABORTS before any registered endpoint is read.**
  No `summary.json`, no cell, no manifest, no trajectory of any class generated. The harness writes a
  **screen-failure record** to `<results-root>/screen-failed/screen-<stamp>.json` — deliberately
  **outside `live/` and `sim/`**, because `loadEvidence` enumerates *every* directory under
  `validation/*/results/live/` (`collect.mjs:320-324`) and a failure record inside it would be
  reported as a skipped run forever. The record carries: the per-draw `g_null` readings, the seeds
  that produced them, the positive draws named individually, `draws`, `mc_windows_per_draw`, `kappa`,
  the geometry, `classes_run`, `git_sha`, `engine_pin`, `node`, and the `screen_mode` below. The
  harness then exits non-zero. **A failed screen is a publishable result (§0 rule 2) and REFUTES
  `shape_ecdf_accumulator` on the record** (K6A.1.10: "A fired stop condition on either tier
  REFUTES `shape_ecdf_accumulator` on the record"); the record is the artifact that makes it
  citable.
- **PASSED screen: the reading is recorded in two places, and neither is optional.** (1) the run
  manifest gains `null_growth_screen` — `{draws, mc_windows_per_draw, positive, kappa, seed_bands,
  g_null: {mean, sd, max, p99}, screen_mode}` — present as `null` on any run whose scope contains no
  K6-slow cell, so a consumer can distinguish "screened and passed" from "not applicable" without
  reading the class list; and (2) **cell 47's S2 row carries `null_growth_screen: {draws, positive,
  g_null_max}`**, which is what makes K6A.1.10's reporting obligation mechanical rather than a
  reader's duty: the paging bound and the screen's reading are then on the same row, so
  screen-clean-plus-paging-fired (the lottery's signature) cannot be reported as a construction
  defect by omission.

**The smoke path, registered so it cannot be mistaken for the stop condition.** A run at the
registered `n = 2000` with no test hook engaged — the only run that may write to `results/live` —
**must screen at `250 × 8,000` and may not override either number**; the harness refuses
`--screen-draws`/`--screen-mc` at `n === REGISTERED_N`. Every other run (`n != 2000`, or any hook
engaged: `MODE = 'sim'`) screens at a reduced **`SCREEN_DRAWS_SMOKE = 5`, `SCREEN_MC_WINDOWS_SMOKE =
200`**, overridable by those two flags, and records `screen_mode: 'smoke'` in the manifest.
**Registered reading: a smoke screen is a WIRING CHECK and is not the registered stop condition** —
at `M = 200` its MC noise (`0.0219`) exceeds the margin it would be testing, which is exactly why
the registered path is not allowed to use it. The manifest's existing `smoke` flag and `results/sim`
routing already prevent such a run from being evidence.

**Cost, measured on the build machine rather than estimated:** `21 ms` per 100,000-row calibration
and `22.5 µs` per scored window, so the registered screen is `≈ 5 s + 45 s ≈ 50 s`, against `≈ 21 s`
for the K6-slow battery itself. **The stop condition costs more than the measurement it guards, and
that is accepted rather than optimized away**: the alternative registered in the table above is a
falsifier that fires on noise.

**Boundary, named because it is a real limit of what this screens.** The screen runs on `φ = 0`
draws only. Cell 46 (`mix-d1.5-ar1`, `φ = 0.6`) has its own calibration draw, and **that draw is not
screened** — K6A.1.10 registers ONE screen and K6A.1.5 measured ONE law (`φ = 0`), and screening a
second law would be a new measurement this rider is not entitled to register. **Disclosed: a
positive-null-growth defect confined to the `φ = 0.6` calibrator would pass this screen.**

**Mutation obligations for the implementing task** (house rule 7's discipline, stated so the driver
cannot be wired inertly): removing the driver must fail a test; inverting the stop comparison
(`> 0` → `< 0`) must fail a test; and a **positive control** — a synthetic calibration draw
constructed to have positive null growth — must trip the abort, produce the failure record, and
leave no `summary.json`. Without the positive control, a screen that cannot fire is
indistinguishable from a screen that never fires.

### K6A.3.2 `manifest.class_spans` — named as an A8 additive extension, with the consumer rule

The C49 build emits a manifest field A8's registered field list does not name. Registered here
rather than left as an unregistered addition in a task report.

**The field.** `class_spans: { default: {ticks, onset}, 'K6-slow': {ticks, onset, windows,
window_len, window_span} }`.

**Why it exists.** K6A.1.9 makes the scenario span per class. `manifest.ticks`/`manifest.onset` are
A8-registered scalars, and on a run whose scope includes K6-slow cells they describe only the
deploy-gate classes — **a manifest reading `ticks: 300` for a run containing 6,300-tick cells states
a false constant about its own run, which is the identical defect K6A.2.5 named at the
`HELDOUT_ROWS` provenance site.**

**The precedent this follows, cited.** `supersedes` entered the manifest the same way: Amendment
v2.C1 (C1.6) registered it in one line as *"an A8 field-list extension"*
(`validation/coverage/PREREGISTRATION.md:3421`), with the mechanism, the consumer and the inertness
on the existing corpus all stated. **`class_spans` is registered on that precedent: additive, never
replacing a registered field, and inert for any consumer that does not read it.**

**The consumer rule, registered so two fields cannot disagree about the same run.**

- **`ticks`/`onset` keep A8's registered meaning and their registered values (`300`/`100`).** They
  are the deploy-gate scenario, which every class but K6-slow still runs at. They are NOT redefined
  and NOT made per class.
- **A consumer that needs a cell's span reads `class_spans`, keyed by the cell's own
  `fault_class`** — or, for an arm, by the class its `hint` names — **and falls back to
  `class_spans.default`.** Every emitted cell also carries its own `ticks`/`onset`, and those are
  authoritative for that cell.
- **`class_spans` is always present** (both entries, always true statements of the registered
  design), so it does not vary with run scope and no consumer must branch on the class list.

**Registered consequence, disclosed:** the eight committed certification run directories and every
committed coverage run manifest predate this field and are **not rewritten** — the same append-only
rule the `report_format` gate honours (K6A.2.1's ruling). A manifest without `class_spans` is a
pre-K6-slow run, and its `ticks`/`onset` describe it completely.

### K6A.3.3 ARM 47'S S3 SATURATION, registered as MECHANISM — one level beyond K6A.2.2

K6A.2.2 registered, in one sentence, that **the card's route to `USE` rests on the `mix-d2.0` cell
that K6A.1.8 itself rules a boundary artifact and NOT evidence of shape sensitivity.** The C49 build
**measured the mechanism underneath that sentence, and it is worse than the sentence says.**

**The arithmetic, and it is arithmetic rather than an observation.** At `d = 2.0` the mixture's
component sd is `s = sqrt(1 - d²/4) = 0` exactly, so `injectShapeMix` emits a two-point `±1σ` law
(K6A.1.8's own reading). Every live window's energy distance against `F̂_A` then exceeds
`max_j T(B_j)`, so the tie-inclusive rank returns the floor `p = 1/(m+1) = 1/501` at **every one of
the 40 windows**, and the wealth path is a CONSTANT independent of the data:

```
e            = kappa * p^(kappa-1) = 0.682 * 501^0.318 = 4.924167       (every window)
wealth(40)   = e^40               = 4.9352693425143e+27                (every trajectory)
```

**A `3σ` mean step saturates the same rank.** The energy feature reads a mean-shifted window as
extreme too (live `~N(3,1)` against `F̂_A` of `N(0,1)`: `T ≈ 4.87` against a reference maximum
`≈ 1.17`), so it also returns `p = 1/501` at every window and the identical wealth. **Measured on
the build: substituting `injectStep(delta = 3)` for the registered `injectShapeMix(d = 2.0)` on
arm 47 leaves the emitted S3 row BIT-IDENTICAL** — `detection_rate 1`, `fires` unchanged,
`final_wealth_mean 4.935269342514303e+27`, `verdict POWERED`, `null_id` and `params` unchanged.

**REGISTERED, plainly: arm 47's S3 `POWERED` carries no information about WHICH fault produced it.**
The row is a saturated rank, and a saturated rank is compatible with a distributional shape change,
a mean step, and any other perturbation that leaves every window outside the reference support.
**This is one level beyond K6A.2.2**: that section registered a *cell*-level dependency (the class's
`USE` route runs through a severity the amendment declines to call evidence of shape sensitivity);
this section registers that **the ARM row — the candidate's own S3 power evidence, the row that makes
`s3Powered` non-empty and lifts the card off `score.mjs:567`'s valid-but-inert `ADVISORY` cap — is
itself uninformative about its own fault class.** Cross-reference K6A.2.2 in both directions: the
conjunction it registered stands, and this is the mechanism that makes it bind on the arm as well as
on cell 45.

**Three consequences, registered, and none of them a repair.**

1. **The card must carry this.** The `shape_ecdf_accumulator` claim card states the dependency in its
   own notes: the route past the ADVISORY cap runs through a row that cannot evidence its own fault
   class. A reader must not have to intersect an amendment and a task report to find it.
2. **No behavioural test can guard the arm's injection kind, and the build's structural test is
   registered as the substitute.** The kill for an arm-47 injection substitution is a source-level
   assertion on the dispatch (the C49 build's own choice, adopted here), because every emitted field
   is invariant to the substitution. **The behavioural kill lives on cell 44 (`mix-d1.5`), which is
   NOT saturated** and whose reading an independent reconstruction pins exactly.
3. **What would restore an informative S3 arm is named and NOT done.** An arm at a non-degenerate
   severity — `d = 1.5`, the class canonical, where the wealth path is data-dependent — would carry
   shape information, and its registered power would be the canonical `≈ 0.62` rather than `1.0000`.
   **Changing the S3 arm's severity is a protocol change and not this rider's call** (the same ruling
   K6E.9 made about which field carries an S2 verdict), and K6.8's construction is reused verbatim
   throughout this class precisely so that no stronger or invented probe is substituted. **Named as
   not-done, with its cost: the S3 arm as registered proves the module fires, not what it fires on.**

### K6A.3.4 Four cosmetic defects in v2.K6A.2, corrected by quote-and-correct

Originals quoted and left intact. **No claim any of them supports moves.**

**(a) "registered IDENTICALLY here and in the correction to K6A.1.12" — the duplication does not
exist.** Quoted, K6A.2.4(a):

> **Corrected by separating two objects v2.K6A.1 conflated, and the rule below is registered
> IDENTICALLY here and in the correction to K6A.1.12:**

and the amendment summary repeats it as *"the rule stated identically in both sections"*.
**Correct: the rule's text appears ONCE, in K6A.2.4(a)'s block.** K6A.1.12's cell-44 row was written
before it and is not restated. **Registered wording, replacing the claim: K6A.2.4(a)'s block is the
SINGLE registered statement of the band/interval/disposition rule, and it GOVERNS K6A.1.12's cell-44
row.** One statement governing two sections is what was meant; two identical statements is what was
written, and a reader who went looking for the second copy would not find it. The rule itself —
prediction band `[0.333, 0.848]`, consistency interval `[0.333, 0.958]`, `(0.848, 0.958]` CONSISTENT,
falsified below `0.333` or above `0.958` — is unchanged.

**(b) "sixth significant figure" is the fifth.** Quoted, K6A.2.6:

> The review's figure differs in the sixth significant figure.

**Correct: the fifth.** `-0.938368` against the review's `-0.938375`: the significant digits are
`9,3,8,3,6,8` and `9,3,8,3,7,5`, which first differ at position **5**. The exact value
`-0.938368026` and the conclusion that no endpoint moves are unchanged.

**(c) The review's own false-fire count was omitted, and it is recorded here beside v2.K6A.1's.**
Quoted, K6A.2.6:

> characterized the T1 conditional false-fire rate as **"a few percent, quantization-dominated"**
> against v2.K6A.1's `3.9%`. **Registered: both replicate.**

**The review reported a count, `19/280`, and K6A.2.6 recorded only its adjective.** Both readings,
registered side by side with their sources and their arithmetic, neither superseding the other:

| source | count | rate | what it measures |
|---|---|---|---|
| v2.K6A.1 K6A.1.10 | `11/280` | `3.9%` | draws on which the Wilson-LB stop condition would fire |
| the C49 review, independent | `19/280` | `6.8%` | the same quantity, independently measured |

**They differ by 8 draws of 280 (`2.9` percentage points) and both are "a few percent".** The
difference is the quantization K6A.2.6 already adopted: the Wilson lower bound at `n = 2000` moves in
steps of one crossing (`5e-4`), so the count of draws either side of the `0.05` threshold is granular
and a two-figure rate over-reports the precision of either number. **Registered: the T1 healthy stop
condition's false-fire rate from the calibration lottery alone is "a few percent", bracketed by the
two independent readings `3.9%` and `6.8%`; the stop condition and its reporting rule (K6A.1.10) do
not move, and neither reading is withdrawn.** Recording only the adjective made the two
measurements look like one.

**(d) The `1.8`-SE separation uses one study's SE where two are being compared.** Quoted, K6A.2.6:

> the reviewer measured healthy `6,000`-tick paging at **`0.0206`** against v2.K6A.1's
> `0.0181 ± 0.0014` (both `<= α = 0.05`, `1.8` SE apart)

**Correct: `1.8` divides the difference by ONE measurement's SE.** Comparing two independent
measurements uses the combined SE:

```
difference                       0.0206 - 0.0181 = 0.0025
v2.K6A.1's SE                                     0.0014
the review's SE (same 280-draw probe design)      0.0014   <- stated as an assumption, not a datum
combined SE                      sqrt(0.0014^2 + 0.0014^2) = 0.0019799
separation                       0.0025 / 0.0019799 = 1.2 SE     (not 1.8)
```

**Registered: the two readings are `1.2` combined-SE apart, not `1.8`.** The assumption that the
review's probe has v2.K6A.1's precision is **named as an assumption** — the review reported no SE of
its own, and if its probe were smaller the separation would be smaller still, never larger. **The
correction is in the direction of MORE agreement between the two measurements, i.e. against this
document's rhetorical convenience in the direction that matters: it makes the replication stronger,
so the temptation was to leave it.** Both readings remain `<= α = 0.05` and the "both replicate"
conclusion is unchanged.

### K6A.3.5 House rules, mapped

(1) **Committed before any artifact it authorizes** — the screen driver, its tests, the card and the
golden-verdicts row are all commits AFTER this one, and no K6-slow run exists at this commit.
(2) A failed endpoint is a publishable result: **a failed null-growth screen is registered as exactly
that**, with a named artifact (the screen-failure record) so the refutation is citable.
(3) No post-hoc analysis: **this rider re-measures nothing.** Its only new numbers are closed-form
(the `sd(-log p) = 0.975005` MC-precision table, computed from the discrete null law K6A.1.5 already
registers) or arithmetic on already-registered quantities (the saturation constant of K6A.3.3, the
combined SE of K6A.3.4d, the seed-band bound of K6A.3.1). The one measured statement — that the
step-substituted arm-47 S3 row is bit-identical — is a property of the HARNESS, not of an endpoint,
and it was measured before this rider was written and is registered here rather than left in a task
report. (4) New seeds ARE registered here (the screen's two bands), with their disjointness shown by
enumeration and their one-orbit limitation inherited from K6A.2.3 rather than re-argued.
(5)–(6) No new cell, fallback or result; `results/` stays append-only and no committed manifest is
rewritten. (7) **Quote-and-correct for text**, which is what K6A.3.4 does four times with the
originals intact — including one correction (d) that strengthens the claim it corrects, and one (c)
that records a reading this document had omitted. (8) Every endpoint's number and verdict stand as
K6A.1.12 registers them.

**Write-back obligations, unchanged and still NOT done, plus one added:** the design page must carry
K6A.3.3's mechanism — that the registered S3 arm proves the module fires and not what it fires on —
alongside the `d = 2.0` boundary-artifact disclosure it already owes from v2.K6A K6A.11.

### Amendment summary

Registers the **micro-amendment rider** the C49 build review requires, prereg text only, before the
code it authorizes, with **nothing re-measured and no endpoint, band, floor, prediction or verdict
moved**. **(1) The null-growth screen gets a DRIVER** (K6A.3.1): K6A.1.10 registered the screen as
run-time stop condition (2) — *"run on fresh draws at run time, not inherited from this amendment"* —
and the module exports `nullGrowthScreen`, but **nothing called it and no code item named a driver**,
leaving a stop condition that was a citation. Registered as the build's thirteenth item: placement
**after `assertRegistryAgreement()` and the `--classes` resolution and BEFORE any trajectory of any
class**, run **iff `K6-slow` is in scope**; `250` draws (K6A.1.10's own number) × **`8,000` MC null
windows per draw**, the count **derived rather than chosen** — `sd(-log p) = 0.975005` at the exact
`m = 500` law gives MC SE `0.003466` on `g_null`, putting K6A.1.5's worst measured draw
(`-1.501e-2`) `4.33` SE below zero and the screen's own **false-STOP rate at `≈ 0.2%` over 250
draws**, where `M = 200` would have made MC noise (`0.0219`) exceed the margin it tests; a
**registered fresh seed band** (`41,000,000 + d`; `42,000,000 + 10,000d + j`) whose every member
exceeds the study's maximum registered seed `37,033,479`, **disjoint by enumeration**, with
K6A.2.3's withdrawn band-ordering argument NOT re-used and its one-orbit limitation inherited;
**a failed screen ABORTS before any endpoint is read**, writes a screen-failure record to
`<results-root>/screen-failed/` (outside `live/`, because `collect.mjs:320-324` enumerates every
directory under it) and **REFUTES the candidate on the record**; **a passed screen is reported
twice** — the manifest's `null_growth_screen` (`null` when out of scope) and **cell 47's S2 row**,
which makes K6A.1.10's obligation to report the screen beside a fired paging bound mechanical; a
**smoke path** (`5 × 200`, refused at `n = 2000`) registered explicitly as a WIRING CHECK and not the
stop condition; cost `≈ 50 s` against the battery's `≈ 21 s`, accepted; and the `φ = 0.6`
calibrator's **non-screening disclosed** as a real limit. **(2) `manifest.class_spans` is named as an
A8 additive extension** (K6A.3.2) on the `supersedes` precedent (`:3421`), with the consumer rule
registered: `ticks`/`onset` keep A8's registered meaning and values (`300`/`100`), a consumer needing
a span reads `class_spans` keyed by the cell's own class (arms by their `hint`) with
`class_spans.default` as fallback, every cell carries its own authoritative `ticks`/`onset`, the field
is always present, and committed manifests are not rewritten. **(3) Arm 47's S3 SATURATION is
registered as mechanism** (K6A.3.3), one level beyond K6A.2.2's cell-level statement: at `d = 2.0`,
`s = sqrt(1-d²/4) = 0` exactly, so every one of the 40 windows returns the rank floor `p = 1/501`,
`e = 4.924167` and a data-independent `wealth = 4.9352693425143e+27` — **and a `3σ` mean step
saturates identically, measured: substituting `injectStep(delta=3)` for the registered
`injectShapeMix(d=2.0)` leaves arm 47's emitted S3 row bit-identical.** Registered plainly: **the arm
row that lifts the card off `score.mjs:567`'s ADVISORY cap cannot evidence its own fault class**;
consequences registered are that the card must state the dependency, that the injection-kind kill is
therefore structural on the arm and behavioural only on the non-saturated cell 44, and that an
informative `d = 1.5` arm is **named not-done** because changing the S3 severity is a protocol change
(K6E.9's ruling reused). **(4) Four cosmetic defects in v2.K6A.2 corrected by quote-and-correct**
(K6A.3.4): the claim that the lottery rule is *"registered IDENTICALLY here and in the correction to
K6A.1.12"* is corrected to **one statement in K6A.2.4(a) that GOVERNS K6A.1.12's row** — the second
copy a reader would go looking for does not exist; *"the sixth significant figure"* is **the fifth**
(`9,3,8,3,6,8` against `9,3,8,3,7,5`); the review's **omitted count `19/280` (`6.8%`) is recorded
beside v2.K6A.1's `11/280` (`3.9%`)**, 8 draws of 280 apart, both "a few percent" under the
quantization K6A.2.6 already adopted, **neither withdrawn**; and the *"`1.8` SE apart"* separation is
corrected to **`1.2` combined-SE** (`0.0025 / sqrt(0.0014² + 0.0014²)`), with the equal-precision
assumption named and the correction acknowledged as **strengthening the replication it corrects**.
**The gate verdict, the frozen configuration, the H = 6,000 PASS, v2.K6A's H = 3,000 refutation and
`K6 = NO` at the deploy-gate geometry all stand unchanged.**

---

## Amendment v2.K6A.4 — 2026-08-08, correcting v2.K6A.3's own smoke screen: it FIRED on noise on the first run, the count is raised, and a suspected lattice defect is measured and found ABSENT

**Registered because the code v2.K6A.3 authorized was run and the rider's own smoke path aborted a
clean run.** This corrects **this document's own amendment of the same day**, by quote-and-correct,
with the original intact. **No candidate endpoint, band, floor, prediction or verdict moves. The
candidate is NOT refuted by the event described here** — the reason it is not is the whole content of
K6A.4.1. **Prereg text only, own commit, before the corrected code lands.**

### K6A.4.1 The smoke screen fired on MC noise — quoted, measured, and the count raised

**Quoted, v2.K6A.3 K6A.3.1:**

> Every other run (`n != 2000`, or any hook engaged: `MODE = 'sim'`) screens at a reduced
> **`SCREEN_DRAWS_SMOKE = 5`, `SCREEN_MC_WINDOWS_SMOKE = 200`**

and, in the same section, the reason that count is too small, which the rider **stated and then wired
the stop rule to anyway**:

> | 200 | `0.021924` | `0.68` — **unusable: MC noise alone exceeds the margin** |

**What happened, first run of the driver** (`--n 5 --classes K6-slow`, `MODE = sim`, smoke screen
`5 × 200`): draw 3 (`cal_seed 41000003`) read `g_null = +0.008760`, the stop condition fired, the
run aborted and wrote its screen-failure record. **The abort was mechanically correct and the reading
was noise.** Re-measured on the same draw, same seeds, nothing else changed:

| draw (`cal_seed`) | `M = 200` | `M = 2,000` | `M = 8,000` |
|---|---|---|---|
| **3 (41000003)** | **`+0.008760` POSITIVE** | `-0.041339` | `-0.047401` |
| 2 (41000002) | `-0.025797` | `-0.072754` | `-0.072265` |
| 0 (41000000) | `-0.089994` | `-0.053410` | `-0.061964` |

**Registered: draw 41000003 does NOT have positive null growth. `shape_ecdf_accumulator` is NOT
refuted by this event**, and the screen-failure record it produced is a record of a smoke-path
defect in this document's own rider, not of a construction defect. Nothing about the frozen `κ`, the
`m = 500` law, or K6A.1.5's `0/280` is disturbed.

**The correction, with the arithmetic the rider should have done before wiring the count.** The
quantity that matters is not MC noise alone but the probability that a draw whose true `g_null` is
negative READS positive, composing MC noise with the across-draw spread K6A.1.5 registers
(`sd = 1.571e-2` about a mean of `-6.754e-2`):

| `M` | MC SE | combined sd | `z` | P(one draw reads positive) | P(any draw in the run) |
|---|---|---|---|---|---|
| `200` (as registered) | `0.021924` | `0.026966` | `2.50` | `6.2e-3` | **`3.0%` over 5 draws** |
| **`2,000` (registered here)** | `0.006933` | `0.017163` | `3.93` | `4.2e-5` | **`2.1e-4` over 5 draws** |
| `8,000` (the registered run) | `0.003466` | `0.016078` | `4.20` | `1.3e-5` | **`0.34%` over 250 draws** |

**Registered: `SCREEN_MC_WINDOWS_SMOKE = 2,000`, superseding K6A.3.1's `200`.** At `5 × 2,000` the
smoke screen's own false-STOP probability is `2.1e-4` per run instead of `3.0%`, and it costs
`10,000` scored windows — `≈ 0.34 s` at the measured `22.5 µs`, against `≈ 0.11 s` for the count it
replaces. **A falsifier that fires on 3% of clean smoke runs is not a wiring check, it is a flaky
test that would eventually be silenced**, which is the failure mode this correction exists to
prevent.

**And a correction to K6A.3.1's own false-STOP figure for the REGISTERED path, in the conservative
direction.** Quoted:

> across 250 draws the screen's **false-STOP rate is `≈ 0.2%`**

**Correct: `≈ 0.34%`.** The `0.2%` composed MC noise alone against K6A.1.5's single worst observed
draw; the figure above composes MC noise with the across-draw distribution, which is the population
the 250 draws are actually sampled from. **The registered `250 × 8,000` does not change. Only the
number stating its own false-fire rate does, upward.**

**The enforcement rule, made explicit because this event raised it.** The obvious alternative repair
— have the smoke screen REPORT without stopping — is **rejected and registered as rejected**: a
screen that does not stop is the citation K6A.1.10 forbade, and a rule that enforces on one path and
not another is a rule a reader cannot check. **Registered: the screen ENFORCES on every run it runs
on, one rule for both paths, and the smoke count is set high enough that enforcement is not
noise-driven.** The positive control still exercises the abort, because the control's whole purpose
is a draw that genuinely has positive null growth.

### K6A.4.2 A suspected lattice defect, MEASURED and found ABSENT — the seed scheme stands

**The first hypothesis for the false fire was that K6A.3.1's MC seed scheme reproduces C1.1's defect
in a new place**, and it is registered here as **not supported**, because a suspicion recorded
without its measurement becomes folklore.

K6A.3.1 draws the MC null windows at arithmetically-spaced seeds (`42,000,000 + 10,000d + j`), which
is the same *shape* as the pre-C1 held-out draw Amendment v2.C1 (C1.1) found to be a rank-1
Kronecker lattice. **Measured against the alternative** — one continuously-advanced stream per draw,
consumed as `M` consecutive disjoint 150-blocks, which is C1.2's corrected form and K6A.1.3's own
"consecutive disjoint blocks of ONE continuously advanced stream":

| draw | spaced-seed `M = 8,000` | one-stream `M = 8,000` | difference |
|---|---|---|---|
| 3 | `-0.047401` | `-0.048393` | `0.000992` |
| 2 | `-0.072265` | `-0.078611` | `0.006346` |
| 0 | `-0.061964` | `-0.062194` | `0.000230` |

**All three agree inside the `M = 8,000` MC SE of `0.003466` except draw 2, which is `1.8` SE — i.e.
sampling noise, with no consistent sign.** No bias is detectable, and the reason is mechanical and
worth stating: **C1.1's lattice arose because each spaced seed produced exactly ONE gaussian**, so
both uniforms `gaussFrom` consumes were affine in the seed index. **Here each seed produces a whole
150-value window from its own stream**, so the affine-in-`j` structure is confined to the first draw
of each window and is diluted 150-fold. **Registered: K6A.3.1's MC seed scheme STANDS as registered.
The one-orbit limitation K6A.2.3 registered still applies and is still inherited, unchanged — this
measurement bounds a bias, not the segment-overlap question.**

**Named not-done:** the same check at the registered `250 × 8,000` (this compares three draws, not
250), and any characterization of the spaced-seed scheme at consumption levels other than one
150-block per seed.

### K6A.4.3 House rules, mapped

(1) **Committed before the corrected code** — the driver's smoke count is changed in the commit that
follows this one, and no K6-slow run exists. (2) **A failed endpoint is a publishable result, and
this amendment is one**: the rider's own smoke path was refuted by its first execution, the record it
wrote is retained in the build scratchpad, and nothing is quietly retuned. (3) No post-hoc analysis
of any candidate endpoint: the numbers here are the screen's own diagnostics (`g_null` at three MC
counts on three screen draws) plus closed-form probability arithmetic on already-registered
quantities (`sd = 1.571e-2`, mean `-6.754e-2`, `sd(-log p) = 0.975005`). **No candidate cell, arm or
class endpoint was read to produce them** — the aborted run generated no trajectory of any class.
(4) No new seeds: the bands of K6A.3.1 stand and are re-affirmed by K6A.4.2's measurement.
(5)–(6) No new cell, fallback or result; `results/` untouched. (7) **Quote-and-correct**, twice
against **this document's own amendment of the same day** (the smoke count and its own false-STOP
figure), with the originals intact and both corrections against this author's convenience: one
admits the rider wired a count it had itself called unusable, the other raises the screen's stated
false-fire rate. (8) Every candidate endpoint and verdict stands as K6A.1.12 registers them.

### Amendment summary

Corrects **v2.K6A.3, the same day, after its own driver was run**: the registered smoke screen
(`5 × 200`) **fired on the first execution** — draw `41000003` read `g_null = +0.008760` and the run
aborted — and **re-measurement on the same draw and the same seeds gives `-0.041339` at `M = 2,000`
and `-0.047401` at `M = 8,000`, so the reading was MC noise and the candidate is NOT refuted**. The
rider had itself tabulated `M = 200` as *"unusable: MC noise alone exceeds the margin"* and then
wired the stop rule to it. **Registered: `SCREEN_MC_WINDOWS_SMOKE = 2,000`**, which takes the smoke
path's false-STOP probability from **`3.0%` per run to `2.1e-4`** at a cost of `≈ 0.34 s`, composing
MC noise with K6A.1.5's across-draw spread rather than MC noise alone; **and K6A.3.1's own
false-STOP figure for the registered `250 × 8,000` path is corrected upward from `≈ 0.2%` to
`≈ 0.34%`** by the same composition. The obvious alternative repair — a smoke screen that reports
without stopping — is **registered as REJECTED**, because a screen that does not stop is the citation
K6A.1.10 forbade: **the screen enforces on every run it runs on, and the count is what makes
enforcement honest.** Separately, the first hypothesis for the fire — that the MC seed scheme
reproduces C1.1's rank-1 lattice — is **measured and found ABSENT** (spaced-seed against
one-continuous-stream at `M = 8,000` on three draws: `0.000992`, `0.006346`, `0.000230` apart, no
consistent sign, all within or at `1.8` MC SE), with the mechanical reason registered (C1.1's lattice
came from ONE gaussian per spaced seed; here each seed yields a whole 150-value window, diluting the
affine structure 150-fold), so **K6A.3.1's seed bands stand** and K6A.2.3's one-orbit limitation is
still inherited unchanged. **The gate verdict, the frozen configuration, the H = 6,000 PASS and
`K6 = NO` at the deploy-gate geometry all stand.**

---

## Amendment v2.K6A.5 — 2026-08-08, the pre-run fix round: an eighth manifest field, a boundary stated two incompatible ways, a silent 14-card re-freeze disclosed, and three cosmetic corrections

Registered after the C49 task-5 review (spec PASS, quality APPROVED, RUNS-MAY-PROCEED) found four
things, **before the registered runs**. **Prereg text only, own commit.** Nothing re-measures. **No
candidate endpoint, band, floor, seed, prediction or verdict moves**; the H = 6,000 gate verdict PASS
stands. Two of the four corrections are against **this author's own amendments of the same day**, and
one discloses **a change that rode silently in this author's own commit**.

### K6A.5.1 `manifest.null_growth_screen` has an EIGHTH field the rider did not name — the same defect class K6A.3.2 exists for, inside the rider's own enumerated object

**Quoted, v2.K6A.3 K6A.3.1**, enumerating the manifest field it registers:

> the run manifest gains `null_growth_screen` — `{draws, mc_windows_per_draw, positive, kappa,
> seed_bands, g_null: {mean, sd, max, p99}, screen_mode}`

**The driver emits an eighth key: `forced_positive_hook`.** Registered here as part of the object.

**And the defect class is worth naming rather than just fixing, because it is the second instance in
two days.** K6A.3.2 exists precisely because the build emitted a manifest field (`class_spans`) that
no registration named. **The rider that registered that field then enumerated its own new object and
under-counted it** — same class, one level deeper: an enumeration is a specification, and a
specification that omits an emitted key is exactly as wrong as an unregistered field. **Registered as
a standing reading rule for this document: an enumerated manifest object is a CLOSED list, and any
key the code emits beyond it is a registration defect, not an addition.**

**The duplication, named, with one side made authoritative.** The same fact is now recorded twice on a
run manifest: `screen_positive_hook` at the top level (the harness's registered hook-recording
convention, beside `force_throw_hook`, `spectral_force_degenerate_hook`,
`shape_force_degenerate_hook`, `heldout_lattice_hook`) and `null_growth_screen.forced_positive_hook`
inside the screen object. **Registered: on a RUN MANIFEST the top-level `screen_positive_hook` is
authoritative** — it is the field a reader already checks for every other hook, and a consumer
scanning hooks must not have to know which nested objects also carry them. **Inside a
screen-failure record the nested `forced_positive_hook` is authoritative, because that artifact has
no manifest and no top-level hook block.** Both are emitted; neither is removed; a disagreement
between them is a defect in the harness.

### K6A.5.2 The smoke/registered boundary is stated two incompatible ways — the code's reading is registered

**Quoted, v2.K6A.3 K6A.3.1**, two sentences that do not describe the same set of runs:

> A run at the registered `n = 2000` with no test hook engaged — the only run that may write to
> `results/live` — **must screen at `250 × 8,000` and may not override either number**; the harness
> refuses `--screen-draws`/`--screen-mc` at `n === REGISTERED_N`.

**The first clause is `MODE === 'live'` (`n = 2000` AND no hook). The second is `n === REGISTERED_N`
ALONE.** They differ on exactly one kind of run: `n = 2000` **with** a hook engaged — which the first
clause calls a smoke run and the second forbids from overriding the counts. **The implementation
takes the first reading** (`const registered = MODE === 'live';`, governing both the count selection
and the override refusal, and its error message says so: *"n === 2000, no hook engaged"*).

**Registered, as the single reading: `registered = MODE === 'live'`, i.e. `n === REGISTERED_N` AND no
test hook engaged.** A run at `n = 2000` with a hook engaged is a **smoke** run for every purpose —
it screens at the smoke counts, accepts the overrides, is flagged `smoke` only via `mode: 'sim'`
routing, and can never reach `results/live`. **Rationale, so the choice is not merely a deference to
the code: the property that matters is "may this run become evidence", and that property is exactly
`MODE === 'live'`. A hook-engaged run at the registered `n` is already barred from the evidence path,
so binding it to the registered screen counts would cost 50 s to protect a run nothing can cite.**
The second clause is corrected, not the first.

### K6A.5.3 DISCLOSURE: a 14-card re-freeze rode silently inside this author's card commit, and it un-expired 9 cards this author's own earlier commit had expired

**Measured, not recalled** (card `source_files` shas against the file contents at each commit):

| commit | what it changed | cards EXPIRED at that commit |
|---|---|---|
| `d281e3d` (BASE) | — | **0** |
| `8486229` (C49 task 4, item 11) | `verdict.mjs` `report_format 5 → 6` | **9** |
| `6d51dc5` (C49 task 4, items 1–10, 12) | harness, constants, tests | 9 |
| `77b86ee` (C49 task 5, the card) | the new card **+ a 14-card re-freeze** | **0** |

**Nine cards pin `validation/certification/verdict.mjs`** (`family_A_betting_e_process`,
`family_A_mixture_supermartingale`, `family_C_safe_hotelling`, `family_D_spectral_e_detector`,
`family_E_conformal`, `safe_t_e_value`, `sequential_mmd_betting_e_process`,
`sequential_ui_e_process`, `universal_inference_e_value`), and five of them pin
`lib/score.mjs` as well. **The `report_format 5 → 6` bump of item 11 therefore EXPIRED nine cards,
and that commit did not re-freeze them or say so.** The freeze in `77b86ee` re-stamped every card's
`source_files` sha as well as its `engine_pin`, which **cleared all nine** — and that commit's
message described the operation only as *"freeze-cards re-stamped all fifteen cards' engine_pin, the
same way every prior freeze did"*. **The engine_pin half was disclosed; the source-sha half — the
half that silently un-expired nine cards — was not.**

**Registered, so the record is not left resting on a commit message:**

- **The re-freeze was PINS-ONLY.** No `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`,
  `prior_evidence`, `class` or `aliases` field of any of the fourteen sibling cards changed; the diff
  is `engine_pin.sha` on all fourteen plus `source_files[].sha256` on the nine that pin the two
  certification files. **No claim any card makes moved.** (Verifiable from `git show 77b86ee` —
  fourteen 2-to-4-line diffs.)
- **What the expiry actually meant, stated rather than waved past:** `report_format` is
  *"the shape of this run's emitted markdown, NOT the protocol version"* (`verdict.mjs:64`), so the
  edit that expired nine cards changed no scoring rule and no guarantee. **The expiry was correct
  anyway and the mechanism worked as designed** — a card pins the file that produces its verdicts,
  and that file changed. **The defect was the silence, not the expiry.**
- **The ordering lesson, registered because this build will not be the last to hit it:** a commit
  that touches a file any card pins **must either re-freeze in the same commit and say so, or state
  that it leaves cards expired and name them.** Nine cards spent two commits expired with nothing in
  the record saying so.

**And the gap that let it pass every gate, MEASURED and corrected against the review's own
statement.** The review reported that `expiry-check.mjs` *"exits 0 even when reporting EXPIRED"*.
**That is not what it does:** on a drifted card it prints `EXPIRED <card>: <path> (changed)` to stderr
and **exits 1** (`process.exit(drifted.length ? 1 : 0)`, verified by injecting a wrong sha). **The
real gap is that NOTHING RUNS IT.** `test:cert`'s `expiry.test.mjs` exercises `checkExpiry` against
temp fixtures only and never against the real `cards/` directory, and `cert:expiry` is a separate
npm script in no suite. **So a drifted real card passes `npm test`, `test:cert` and
`test:coverage-battery`, and only a manual `npm run cert:expiry` catches it.** That is the same shape
as C48(3) — *changes to the evidence path expire nothing that any gate enforces*. **Filed as a
write-back obligation, NOT fixed here** (adding a real-cards assertion to `test:cert` would fail the
suite the moment any pinned file is edited, which is a protocol decision about when a card must be
re-frozen and belongs to the certification protocol's own rules, not to this coverage amendment).

### K6A.5.4 Three cosmetic corrections, quote-and-correct

**(a) The `4.30`-sd margin belongs to the MEAN, not to the worst draw, and the card juxtaposed them.**
Quoted, the `shape_ecdf_accumulator` card's third quantifier:

> measured 0/280 draws positive, worst draw 1.501e-2 below zero, 4.30 sd margin

**Correct: K6A.1.5's `4.30 sd` is the MEAN's margin** (`6.754e-2 / 1.571e-2 = 4.30` across-draw sd
below zero); **the worst observed draw's own margin is `1.501e-2`, which is `0.96` across-draw sd.**
Reading the two clauses in sequence implies the worst draw is 4.30 sd clear of zero, which is `4.5×`
its actual distance. **Registered wording: the per-draw mean sits `4.30` across-draw sd below zero
and the worst of the 280 draws sits `1.501e-2` (`0.96` sd) below zero.** The card is corrected in the
commit that follows this one; K6A.1.5's own text, which states the two figures on separate lines of
its own table, is not at fault and is unchanged.

**(b) The lottery band/interval rule is K6A.2.4(a), not (b).** Quoted, the same card's notes:

> THE LOTTERY REPORTING RULE, BOTH DIRECTIONS, quoted from Amendment v2.K6A.2 K6A.2.4(b)

**Correct: (b) registers only the MIRROR rule for YES.** The prediction band `[0.333, 0.848]`, the
consistency interval `[0.333, 0.958]` and the `(0.848, 0.958]` disposition — all of which that
passage also states — are **K6A.2.4(a)**, as K6A.3.4(a) itself records. **Registered attribution:
the single-draw NO wording and the mirror single-draw YES wording are K6A.2.4(b); the band, the
interval and the disposition are K6A.2.4(a).**

**(c) The smoke screen's superseded cost is `0.128 s`, not `0.11 s`.** Quoted, v2.K6A.4 K6A.4.1:

> `10,000` scored windows — `≈ 0.34 s` at the measured `22.5 µs`, against `≈ 0.11 s` for the count it
> replaces

**Correct: `≈ 0.128 s`.** The `5 × 200` count costs `1,000` windows at `22.5 µs` (`0.0225 s`) **plus
the five 100,000-row calibrations at `21 ms` each (`0.105 s`)**, which the `0.11 s` figure left out of
one side of a comparison it included on the other. The `0.34 s` for `5 × 2,000` is unchanged
(`0.225 + 0.105`). **No decision rests on either figure**; the correction is registered because a
document that pins numbers may not round one side of its own comparison.

### K6A.5.5 House rules, mapped

(1) **Committed before the runs it clears the way for**, and before the card re-freeze it authorizes.
(2) A failed endpoint is a publishable result; nothing here is an endpoint. (3) No post-hoc analysis:
**this amendment re-measures no candidate quantity.** Its only measurements are of the REPOSITORY —
card expiry at four commits, and the `expiry-check` CLI's exit code under an injected wrong sha —
both properties of the record-keeping, not of the accumulator. (4)–(6) No new cell, seed, fallback or
result. (7) **Quote-and-correct five times**: twice against this author's own v2.K6A.3, once against
this author's own v2.K6A.4, once against this author's own card, and **once against the review's own
statement about `expiry-check.mjs`** — with the originals intact. (8) Every candidate endpoint and
verdict stands as K6A.1.12 registers them.

**Write-back obligations, unchanged, plus one added:** the certification protocol needs a rule for
when a card must be re-frozen and a gate that enforces it — nine cards were expired for two commits
and every suite stayed green.

### Amendment summary

The **pre-run fix round**, prereg text only, with no candidate quantity moved. **(1)** The rider's own
enumerated manifest object under-counted itself: `manifest.null_growth_screen` emits an **eighth key,
`forced_positive_hook`**, now registered — **the same defect class K6A.3.2 exists for, recurring one
level deeper inside the amendment that registered it**, so an enumerated manifest object is registered
as a CLOSED list and any extra emitted key is a registration defect; the duplication with the
top-level `screen_positive_hook` is named and resolved by making the **top-level field authoritative
on a run manifest and the nested one authoritative inside a screen-failure record**, which has no
manifest (K6A.5.1). **(2)** K6A.3.1 stated the smoke/registered boundary **two incompatible ways** —
`MODE === 'live'` for the counts, `n === REGISTERED_N` alone for the override refusal — differing on a
run at the registered `n` with a hook engaged; **the code's reading is registered
(`registered = MODE === 'live'`)** on the stated ground that the property that matters is whether a
run can become evidence, which a hook-engaged run cannot (K6A.5.2). **(3) DISCLOSED: a 14-card
re-freeze rode silently inside this author's own card commit.** Nine cards pin
`validation/certification/verdict.mjs`, so task 4's `report_format 5 → 6` bump (`8486229`)
**EXPIRED nine cards** — measured: 0 expired at BASE, 9 from `8486229`, 0 after `77b86ee` — and
`77b86ee`'s freeze re-stamped `source_files[].sha256` as well as `engine_pin`, clearing all nine while
its message disclosed only the `engine_pin` half. **The re-freeze was PINS-ONLY** (no guarantee,
regime, falsifier, shipped_path, budget, prior_evidence, class or alias field of any sibling card
changed), the expiry itself was correct and the mechanism worked, and **the defect was the silence**;
registered as an ordering rule for future commits, plus the gap that let it pass — **and the review's
own claim that `expiry-check.mjs` "exits 0 even when reporting EXPIRED" is CORRECTED: it prints
`EXPIRED` to stderr and exits 1; the real gap is that NO SUITE RUNS IT**, `expiry.test.mjs` testing
only temp fixtures, so a drifted real card passes every suite — filed as a write-back obligation and
deliberately not fixed here (K6A.5.3). **(4)** Three cosmetic corrections (K6A.5.4): the card's
**`4.30`-sd juxtaposition** is corrected — `4.30` sd is the per-draw MEAN's margin, the worst of the
280 draws is `1.501e-2` = **`0.96` sd** below zero, and reading the clauses in sequence overstated the
worst draw's clearance by `4.5×`; the lottery **band/interval/disposition is K6A.2.4(a)**, not (b),
which registers only the mirror YES rule; and the superseded smoke screen's cost is **`0.128 s`**, not
`0.11 s`, the quoted figure having omitted the five calibrations from one side of its own comparison.
**The gate verdict, the frozen configuration, the H = 6,000 PASS and `K6 = NO` at the deploy-gate
geometry all stand.**

---

### Erratum to K6A.5.3, dated 2026-08-08 (carry-tier, appended not edited)

**Quoted, v2.K6A.5 K6A.5.3:**

> **The real gap is that NOTHING RUNS IT.**

**Correct: CI runs it, non-gating.** `.github/workflows/ci.yml:92-95` has a step
*"Certification card expiry (reported, not gating — see comment)"* running `npm run cert:expiry`
with `continue-on-error: true`, and the workflow's own comment states why: a runner checks out this
repo only, `family_E_conformal` pins `../deploysignal/tools/calibrators/family-e.ts`, and
`expiry-check.mjs` cannot distinguish *"changed"* from *"not present here"*, so a gating step would
fail every run for a reason that says nothing about the cards.

**The corrected statement of the gap: the expiry check RUNS on every CI run and its finding reaches
a log, but NO GATE ENFORCES IT** — not the CI step (`continue-on-error`), and not any suite
(`expiry.test.mjs` exercises `checkExpiry` on temp fixtures only). So a drifted card still passes
`npm test`, `test:cert`, `test:coverage-battery` and CI. **The correction is against this
document's own convenience: "nothing runs it" made the gap sound like an oversight, and the truth is
that it is run deliberately in a non-gating shape for a stated reason. That is a harder gap to
close, and the write-back obligation K6A.5.3 filed now has the sibling-pin problem attached to it:
making the check gating requires either checking out the sibling repo with `CERT_SIBLING_ROOT` set,
or teaching the tool to report an unreadable sibling pin separately from a changed hash.** No claim
of K6A.5.3 moves otherwise, and the 0/9/9/0 expiry measurement stands.


---

## Amendment v2.K6A.6 — 2026-08-08, the ACROSS-DRAW replication study: the single-draw lottery measured directly, before the driver exists

Registered before `validation/coverage/harness/run-acrossdraw.mjs` exists and before one draw of it
runs. **Every prior K6-slow amendment registers the calibration-draw lottery as the dominant
uncertainty and then reports a single draw** (K6A.1.7's `sd = 0.1527`, corrected to `0.1416` at
K6A.2.4c; K6A.2.4b's mirror rule; the run's own "class K6-slow YES **at this calibration draw**").
This amendment registers the study that measures the across-draw distributions instead of citing
them, on 100 fresh calibration draws at the frozen geometry, on the real harness path.

**What this study is NOT, registered first so no reader has to infer it.** It does **not** re-score
`shape_ecdf_accumulator`'s card, does **not** move the K6-slow class row, does **not** touch
`COVERAGE.md`, and does **not** replace or supplement the registered single-draw run
`run-20260809T035934Z`. **The one-attempt rule is untouched and the class answer stays
"K6-slow YES at this calibration draw" exactly as K6A.2.4b requires.** Its write-back is to the
WORDING of the wiki's context sentences — "across-draw mean detection X ± Y, `P(< 0.50)` Z" in place
of a citation to a 280-draw probe — and to the contested-page question of K6A.6.5.

### K6A.6.1 The frozen configuration, transcribed from K6A.1.2, nothing re-derived

```
W        = 150                     window length, disjoint W-blocks of the post-onset stream
n        = 100,000                 calibration substrate rows per draw (ONE continuously advanced stream)
A / B    = 25,000 / 75,000         A -> the fixed reference ECDF Fhat_A; B -> m contiguous disjoint blocks
m        = 500                     = 75,000/150 exactly, no remainder
feature  = energy distance vs Fhat_A, the form frozen at v2.K6A K6A.2, verbatim
kappa    = 0.6820                  FROZEN LITERAL, not re-derived on this study's data
H        = 6,000  ->  N = 40       disjoint windows of 150; span [300, 6300), T = 6,300, ONSET = 300
endpoint = wealth >= 20  (log >= log 20 = 2.995732) at any window checkpoint
```

**Every per-window number comes from the shipped module**, `dist/detectors/shape-ecdf-accumulator.js`
(source `detectors/shape-ecdf-accumulator.ts` at HEAD): `calibrateEcdfAccumulator` (`:336`),
`ecdfAccumulatorWindow` (`:419`), `ecdfAccumulatorWealth` (`:458`), `nullGrowthScreen` (`:487`).
The driver is an orchestrator and **reimplements no scored quantity**. The generators are
`inject.mjs`'s `rng` (`:14-17`), `gaussFrom` (`:19-24`) and `injectShapeMix` (`:60-70`), imported
not copied.

**The per-draw reads reproduce the registered run's own arithmetic, at the HEAD line numbers:**

| quantity | the registered run's site at HEAD | this study |
|---|---|---|
| canonical alt series | `run-battery.mjs:607` (`injectShapeMix`, `d = 1.5`, A5's `r` pinning) | same call, same pinning |
| healthy series | `run-battery.mjs:1505` (`span.T` draws, `drawFor(r, 0)`) | same |
| per-window `p`, `e` | `run-battery.mjs:807` (`ecdfAccumulatorWindow`) | same |
| crossing | `run-battery.mjs:811-812` (`ecdfAccumulatorWealth`, `log.some(l => l >= log 20)`) | same |
| detection / crossing rate | `run-battery.mjs:1045-1046` (`fires` / `finite`) | same |
| `increment_estimator` | `run-battery.mjs:1053` + `summarise` (`:1102-1108`) | same, `mean(out.eAvgs)` per trajectory |
| `p_uniformity` | `computePUniformity` (`:1114-1123`) | same |
| C1.2 serial guard | `assertHeldoutSerialStructure` (`:903-916`), bound `0.10` (`:902`) | same, on every one of the 100 draws |
| geometry enforcement | `assertRegisteredGeometryK6slow` (`:208-214`) against `:161` | same |
| null-growth screen | `nullGrowthScreen` via `run-battery.mjs:1210`, `screenNullWindow` (`:1177-1180`) | same |

**One registered departure from the registered run's path, with its citation.** The registered run
seeds each live trajectory separately (`cellSeed(cell, i) = cell.seed + 7919*i`,
`run-battery.mjs:572`, used at `:593` and `:1504`). **This study instead consumes ONE continuously
advanced stream per (calibration draw, arm), as consecutive disjoint blocks** — which is what
K6A.1.3 registers for the 280-draw MC that supplies every prediction below ("trajectories are
consecutive disjoint blocks of ONE continuously advanced stream per (calibration draw, arm), never
spaced per-trajectory seeds") and what K6A.3 registers for the sweep. **Registered rationale: the
object being replicated is the gate's across-draw MC, so the MC's own convention governs; the
scored path — every `p`, `e`, wealth and rate — is the shipped module's, bit for bit.** This is a
deviation from the task brief's "same scoring path", recorded rather than silently resolved, and it
is the prereg's convention that is kept.

### K6A.6.2 The NEW seed band, with exact-seed disjointness ENUMERATED (the K6A.2.3 standard)

```
calibration substrate   51,000,000 + d                  d = 0..99          100 seeds
canonical alt live      52,000,000 + d                  d = 0..99          100 seeds
healthy live            53,000,000 + d                  d = 0..99          100 seeds
null-growth screen MC   57,000,000 + 10,000*d + j       j = 0..7,999   800,000 seeds
                                                        (stride 10,000 > M = 8,000, so no
                                                         two draws' MC bands can overlap —
                                                         K6A.3.1's own discipline)
```

**Band ordering is NOT the argument. K6A.2.3 withdrew that argument and it is not re-used here.**
Disjointness rests on **exact-seed enumeration modulo `2^32`**, asserted by
`test/run-acrossdraw.test.mjs` rather than claimed: every seed of this study is compared against
every seed of every prior family whose FORM this document states, all reduced `mod 2^32` so a
wrapping family is caught re-entering from below:

| prior family, as this document states its form | enumerated |
|---|---|
| registered study `20260807 + idx + 7919*i + 104729*k`, `idx 0..47`, `i 0..1999`, `k 0..9` | 960,048 |
| `HELDOUT_SEED = 20260807 + idx + 500000`, `idx 0..47` | (in the above) |
| K6A.3.1 screen `41,000,000 + d` and `42,000,000 + 10,000*d + j`, `d 0..249`, `j 0..7,999` | 2,000,250 |
| K6A.1.3 probe `{1.30e9, 1.42e9, 1.54e9} + 300007*rep + 7919*offset`, `rep 0..400`, 8 offsets | 9,624 |
| K6A.3 sweep `{6.0e8, 7.5e8, 9.0e8} + 300007*rep + 7919*cfg`, `rep 0..400`, `cfg 0..60` | 73,383 |
| K6A.4 anchor `1.1e9 + {1000003, 7000019, 13000027}*rep`, `rep 0..800` | 2,401 |
| **total** | **3,045,706** |

**Measured: 0 collisions.** The `13000027` family is the one K6A.2.3 names as wrapping, and the
enumeration confirms it: from `rep = 246` it re-enters low as `3,039,346 + 13,000,027*(rep-246)`,
putting members at `42,039,427`, `55,039,454` and `68,039,481`. **`55,039,454` lies between this
study's healthy band and its MC band and `53,041,520` lies just above its healthy band — which is
precisely why the bands were chosen against the enumeration rather than by ordering.**

**One limitation of the enumeration, registered because it is a real gap and not a formality.**
This document names eight earlier K6-probe seed *bases* (`1.7e9`, `2.5e9`, `2.6e9`, `3.0e9`,
`3.5e9`, `3.7e9`, `3.8e9`, `4.1e9`, K6A.1.3/K6A.3) **without stating their forms**, so those
families cannot be enumerated and are **not** covered by the `0 collisions` above. Manufacturing
plausible forms and then enumerating against the manufacture would be an argument about this
author's own invention, and it is refused. What can be said: all eight bases are `>= 1.7e9`, so a
member can reach this study's bands only by wrapping `mod 2^32`, and no such family's form is on
record to check. **Registered as a disclosed gap in the freshness argument, not as a clean sheet.**

**And the one-orbit limitation, restated with THIS study's own consumption, which is worse than
any prior probe's.** K6A.2.3, quoted:

> the registered `rng` is a 32-bit LCG with a single full-period orbit, so distinct seeds are
> **offsets into one sequence**, not independent streams; exact-seed disjointness guarantees no two
> streams *start* at the same point, **not** that their consumed segments never overlap.

Arithmetic for this study, stated rather than gestured at. `gaussFrom` draws 2 uniforms per
gaussian; `injectShapeMix` draws 3 per post-onset tick (1 for `b`, 2 for `w`). Per draw:
alt arm `500 × (6,300×2 + 6,000×3) = 15.3e6` uniforms; healthy arm `500 × 6,300×2 = 6.3e6`;
substrate `2e5`; screen MC `8,000 × 150 × 2 = 2.4e6`. **Total over 100 draws `≈ 2.42e9` uniforms
against an orbit of `2^32 = 4.295e9` — 56% of the orbit.** At that consumption, of the 2.42e9
positions drawn an expected `2.42e9 − 4.295e9·(1 − e^{−0.564}) ≈ 5.6e8` (23%) are re-visits of
positions some other stream already used. **Registered consequence: the 100 draws are NOT
independent, and the measured across-draw sd is therefore an estimate whose own error is not
quantified by `sd/sqrt(100)` alone.** Not corrected — the generator is the harness's, and changing
it would make the study measure a different object than the gate's 280-draw MC did (whose own
consumption was `≈ 8.7e8`, 20% of the orbit, the same limitation one third as large).
**This is the study's principal limitation and it is registered before the run, not after it.**

### K6A.6.3 Replicates, and the precision this buys

`R = 100` calibration draws × `TJ = 500` trajectories per arm = **50,000 trajectories per arm**.
`TJ = 500` is a runtime bound, chosen and disclosed as one.

**The per-draw binomial SE this leaves, stated because it is the thing that must be small relative
to what is being measured:** at a detection near `0.62`,
`sqrt(0.62 × 0.38 / 500) = 0.0217`. **Against the `0.1416` calibration-draw sd of K6A.2.4c that is
a ratio of `6.5`, so the measured spread is calibration-draw variance and not trajectory noise** —
but it is not negligible, and it is **registered that the raw sd of the 100 draw-means CONTAINS it**
and must be deconvolved exactly as K6A.2.4c deconvolved the gate's `TJ = 72` figure:

```
reported: raw sd of the 100 draw-means (contains TJ = 500 binomial noise)
reported: deconvolved sd = sqrt(raw_sd^2 - phat*(1-phat)/500), the K6A.2.4c form
```

**Registered: the DECONVOLVED sd is the estimate of calibration spread and the RAW sd is reported
beside it.** Reporting only the raw sd would overstate the lottery by the amount of this study's own
measurement noise, in the direction that makes the study look more necessary.

### K6A.6.4 REGISTERED ENDPOINTS AND PREDICTIONS — every prediction from the gate's own 280-draw MC

All predictions come free from already-registered numbers (K6A.1.4, K6A.1.5, K6A.1.7, K6A.1.10,
K6A.2.4c). **Nothing below is fitted on this study's data, and no prediction is stated as a range
wide enough to be unfalsifiable.**

| # | endpoint | prediction | band / falsified if | source |
|---|---|---|---|---|
| **E1** | across-draw MEAN canonical detection-within-6,000 | **`0.6207`** | `± 1.96 × 0.1416/sqrt(100) = ± 0.0278` → **`[0.593, 0.648]`**; outside is a DEVIATION | K6A.1.4 mean, K6A.2.4c sd |
| **E2** | across-draw sd of canonical detection (deconvolved) | **`0.1416`** | `[0.117, 0.166]` (the chi-square 95% interval at `df = 99`) | K6A.2.4c |
| **E3** | `P(canonical detection < 0.50)` | **`0.196`** | `[0.12, 0.28]` (binomial 95% at `n = 100`); the empirical `TJ = 72` figure `0.214` is inside it and is NOT the operative prediction | K6A.2.4c |
| **E4** | fraction of draws with healthy 6,000-tick rate `> α = 0.05` | **`0.079`** | `[0.03, 0.15]` | K6A.1.10 (`22/280`) |
| **E5** | fraction of draws where the T1 Wilson-LB stop condition WOULD fire | **`0.039`** | `[0.01, 0.10]`; reported, **no verdict authority** — this study cannot refute the card | K6A.1.10 (`11/280`) |
| **E6** | across-draw MEAN of `increment_estimator.mean` | **`0.991433`** | see K6A.6.5 — **the claim-settling endpoint** | K6A.1.5 exact null |
| **E7** | draws with positive null growth at the registered `M = 8,000` | **`0.0013` expected count of 100** | `>= 1` is a DEVIATION to record, not a stop | K6A.4.1 (`1.3e-5` per draw) |
| **E8** | across-draw median of `p_uniformity` KS | **no prediction is registered** | this document has never measured the KS statistic's across-draw distribution; **registered as descriptive, exploratory, with no band and no verdict** | — |

**E7's arithmetic, because the task brief states it differently and the prereg governs.** The brief
predicts "`≈ 0.03` of 100 from K6A.4.1". **That figure is K6A.4.1's `3.0% over 5 draws` at the
SUPERSEDED `M = 200`**, which K6A.4.1 replaced precisely because it was too noisy to enforce on.
At the registered `M = 8,000` K6A.4.1 gives `1.3e-5` per draw, so the expected count over 100 draws
is **`0.0013`, not `0.03`** — 23× smaller. **Registered: E7 as stated above; the brief's figure is
recorded as a mis-citation of a superseded count, and this study screens at `M = 8,000`, the
registered path's own number.** A positive draw is **RECORDED, FLAGGED and INCLUDED** in every
distribution — K6A.1.10's stop condition is a rule for the registered scoring run, and this study is
exactly where a screen-positive draw belongs rather than where it aborts.

**The registered run's own three values, located as quantiles of the measured distributions.**
Transcribed from `results/live/run-20260809T035934Z/summary.json` at HEAD: canonical cell 44
`detection_rate = 0.8515`; arm 47 healthy `crossing_rate = 0.054`; arm 47
`increment_estimator.mean = 1.0249590993997122`. **Registered as DESCRIPTIVE, with no verdict
attached and no disposition contingent on where they land** — a quantile read on 100 draws has a
resolution of one percentile and the run draw is one draw; reporting where it sits is context for
K6A.2.4b's "at this calibration draw" wording, not a test of anything.

### K6A.6.5 E6, the claim-settling endpoint: BOTH readings dispositioned IN ADVANCE

The contested wiki page `stats/terminal-mean-rule-contested` carries a third claim, filed 2026-08-08
by ruling as its own claim: `shape_ecdf_accumulator`'s S2 `increment_estimator.mean = 1.024959` fired
its registered `[0.97, 1.01]` range at a κ where `Var[e]` is finite (tail index
`1/(1−κ) = 3.145 > 2`, K6A.1.10), putting it `16.26` SE above the exact null `0.991433` — the first
reading on that page whose variance objection does not apply. **That page names what would settle
it, verbatim: "the across-draw distribution of `increment_estimator.mean` at κ = 0.682 under the
corrected substrate".** E6 is that distribution.

**Both dispositions are registered here, before the run, so neither can be chosen after seeing the
number:**

```
READING A — TAIL DRAW.
  Condition: the across-draw mean of increment_estimator.mean is consistent with the exact
  null 0.991433 (|mean - 0.991433| <= 1.96 * sd/sqrt(100)), AND 1.024959 lies inside the
  measured across-draw support.
  Disposition: THE LOTTERY EXPLANATION GAINS ITS EVIDENCE. The 1.024959 reading is a
  calibration-draw tail, the distribution is where the exact null puts it, and the
  finite-variance claim does not acquire across-draw support. The 16.26-SE figure is then
  correctly read as a WITHIN-draw SE against a BETWEEN-draw spread it does not model — the
  same category error K6A.2.4c corrected on detection.

READING B — DISPLACED DISTRIBUTION.
  Condition: the across-draw mean of increment_estimator.mean is above 0.991433 by more than
  1.96 * sd/sqrt(100).
  Disposition: THE FINITE-VARIANCE CLAIM GAINS ITS ACROSS-DRAW EVIDENCE. The displacement is
  a property of the construction at kappa = 0.6820 and m = 500, not of one draw, and the
  contested page's third claim is supported by the measurement it asked for.

READING C — registered because A and B do not partition the outcomes.
  Condition: the across-draw mean is BELOW 0.991433 by more than 1.96 * sd/sqrt(100), or
  1.024959 lies OUTSIDE the measured support.
  Disposition: NEITHER claim gains evidence and the result is filed as a new contradiction
  under SCHEMA section 9 (both claims recorded, confidence: contested, no resolution) — a
  distribution centred below the exact null, or a run draw outside 100 draws' support, is
  not something either claim predicts.
```

**What E6 cannot do, registered.** It does not restore S2 authority to `increment_estimator` (a
protocol decision, K6A.1.10/K6E.9's ruling, not an amendment's call), does not re-score the card,
and does not withdraw the `[0.97, 1.01]` range — K6A.5's rejection of "withdrawing the range after
watching it fire" stands. **The write-back is to the contested page, as evidence for one of three
dispositions chosen before the number existed.**

### K6A.6.6 Execution, output, and the tests

- **Driver** `validation/coverage/harness/run-acrossdraw.mjs`. Results to
  `validation/coverage/results/live/run-acrossdraw-<stamp>/`, **append-only** — no existing run
  directory is read, written or superseded, and this study emits no card and no `COVERAGE.md` row.
- **Registered field list.** `rows.json`: one object per draw with
  `draw`, `cal_seed`, `alt_seed`, `healthy_seed`, `cal_fingerprint`, `acf1`, `acf2`,
  `canonical_detection`, `canonical_fires`, `canonical_n`, `healthy_crossing_rate`, `healthy_k`,
  `healthy_n`, `healthy_lower95`, `healthy_above_alpha`, `healthy_lb_would_fire`,
  `increment_estimator` (the `summarise` object), `p_uniformity` (the `computePUniformity` object),
  `null_growth_screen` (`{ mc_windows, mean_neg_log_p, g_null, positive, mc_seed_first,
  mc_seed_last }`), `screen_positive`.
  `distributions.json`: for each of `canonical_detection`, `healthy_crossing_rate`,
  `increment_mean`, `ks_statistic`, `g_null` — `{ n, mean, sd, min, p05, p25, p50, p75, p95, max }`,
  plus `deconvolved_sd` for `canonical_detection`, plus the E1–E8 verification table, plus the
  three run-draw quantile reads. `manifest.json`: geometry, seed bands, module path and `sha256`,
  `git_sha`, `engine_pin`, node version, `draws`, `traj_per_arm`, `screen_mc_windows`, `mode`,
  `prereg` = `Amendment v2.K6A.6`, and `replication_control` (the hook, `false` on the study run).
- **Tests**, `validation/coverage/test/run-acrossdraw.test.mjs`, each with its mutation kill:
  1. **driver census** — 100 draws × 4 registered endpoints present and finite on every row.
  2. **seed-band guard** — the driver THROWS when asked for a draw index outside `0..99`, so a
     seed outside the registered band cannot be drawn.
  3. **exact-seed disjointness** — the enumeration of K6A.6.2, run as an assertion.
  4. **module-path assertion, positive control** — the driver's scored numbers are asserted
     EQUAL to `dist/detectors/shape-ecdf-accumulator.js` called directly on the same window, and
     the test fails if the driver ever computes a `p` or `e` itself.
  5. **replication control** — under the named test-only hook the driver re-scores the registered
     run's own draw and reproduces `run-20260809T035934Z`'s `0.8515` / `0.054` / `1.0249590993997122`
     exactly. **This is the strongest available evidence that the path is the registered path**, and
     it is a test rather than a claim.
- **Run once.** Every registered prediction is verified in `distributions.json`. **Deviations are
  RECORDED, not corrected.** `REPORT.md` is generated from the committed JSON.
- **Stop condition: none.** Beyond the per-draw screen of E7, which records and flags rather than
  aborting, this study has no stop condition, because it has no verdict to protect.

### K6A.6.7 House rules, mapped

(1) **Committed before the driver exists and before any draw of it runs.** (2) A failed endpoint is
a publishable result: E1–E7 each have a band and a deviation is reported as one. (3) No post-hoc
analysis — every prediction above is arithmetic on numbers already registered at K6A.1.4, K6A.1.5,
K6A.1.7, K6A.1.10, K6A.2.4c and K6A.4.1, and E8 is registered as having NO prediction rather than
given a band this document cannot justify. (4) **A new seed band is registered, with its
enumeration and with the gap in that enumeration named** (K6A.6.2). (5) No fallback is registered:
a draw that throws the C1.2 guard or the geometry assertion crashes the study, because a defective
substrate is not an observation. (6) The result is append-only and touches no existing record.
(7) **Quote-and-correct once, against the task brief**: its `≈ 0.03 of 100` screen prediction cites
a superseded `M = 200` count (K6A.6.4 E7), and its "same scoring path" is departed from in the
trajectory-seed dimension for the reason K6A.6.1 states. (8) **Every K6-slow endpoint and verdict
of K6A.1.12 stands unchanged**, including `K6-slow YES at this calibration draw`.

**Write-back obligations this study creates:** the wiki's K6-slow context sentences move from
citing a 280-draw probe to citing a measured across-draw distribution; the contested page
`stats/terminal-mean-rule-contested` receives whichever of K6A.6.5's three dispositions the
measurement selects. **Neither is done in this commit.**

### Amendment summary

The **across-draw replication study**, registered before its driver exists. **100 fresh calibration
draws** at the frozen K6-slow geometry (`W = 150`, `n = 100,000`, `A/B = 25,000/75,000`, `m = 500`,
`κ = 0.6820`, `H = 6,000`), `500` trajectories per arm per draw, on a **NEW seed band whose
disjointness is established by exact enumeration of 3,045,706 prior seeds modulo `2^32` with
0 collisions** — band ordering is not the argument, K6A.2.3's withdrawal is honoured, and **the gap
is named: eight earlier K6-probe bases whose FORMS this document never states cannot be enumerated
and are excluded from that claim**. The one-orbit limitation is restated with this study's own
arithmetic: **`≈ 2.42e9` uniforms against a `4.295e9` orbit, 56%, an expected 23% of drawn positions
re-visited — so the 100 draws are NOT independent and `sd/sqrt(100)` is not the whole error.**
**Eight registered endpoints, every prediction free from the gate's own 280-draw MC**: mean
detection `0.6207 [0.593, 0.648]`; deconvolved across-draw sd `0.1416`; `P(detection < 0.50)`
`0.196`; healthy-above-α fraction `0.079`; Wilson-LB would-fire fraction `0.039`; the increment
mean against the exact null `0.991433`; screen positives `0.0013` expected of 100 — **correcting
the brief, whose `0.03` cites the superseded `M = 200` smoke count**; and the KS statistic
registered with **NO prediction**, because this document has never measured its across-draw
distribution. **E6 is the claim-settling endpoint for the contested page
`stats/terminal-mean-rule-contested`, and all THREE dispositions are registered in advance** —
tail-draw → the lottery explanation gains its evidence; displaced-distribution → the
finite-variance claim gains its across-draw evidence; centred-below-null or run-draw-outside-support
→ a new contradiction filed under SCHEMA §9 with neither claim gaining. **This study re-scores no
card, moves no class row, touches no `COVERAGE.md` row, and leaves the one-attempt rule and
`K6-slow YES at this calibration draw` exactly as they stand.**

---

### Results append to v2.K6A.6, dated 2026-08-08 (appended not edited)

`run-acrossdraw-20260809T065107Z`, one run, `mode: live`, at `e61e0ca`, `227.97 s`. Numbers are
readable off `results/live/run-acrossdraw-20260809T065107Z/{rows,distributions,manifest}.json`;
the narrative is that directory's `REPORT.md`. **Six of seven banded predictions HELD.**

| # | predicted | band | measured | verdict |
|---|---|---|---|---|
| E1 | `0.6207` | `[0.593, 0.648]` | `0.62514` | HELD (`+0.29` SE) |
| E2 | `0.1416` | `[0.117, 0.166]` | `0.151398` | HELD |
| E3 | `0.196` | `[0.12, 0.28]` | `0.21` | HELD |
| E4 | `0.079` | `[0.03, 0.15]` | `0.03` | HELD, at the lower edge |
| E5 | `0.039` | `[0.01, 0.10]` | `0.00` | **DEVIATION** |
| E6 | `0.991433` | disposition rule | `0.989903` (`−0.80` SE) | **READING A — TAIL DRAW** |
| E7 | `0.0013` | `0` | `0` | HELD |
| E8 | none registered | — | KS median `0.036537` | DESCRIPTIVE |

**E6's disposition, selected by K6A.6.5's rule and not after the fact.** The across-draw
distribution of `increment_estimator.mean` is centred on the exact null (`0.989903` against
`0.991433`, `−0.80` SE of the across-draw mean), across-draw sd `0.019139`, and the registered
run's `1.024959` lies inside the measured support at the 97th percentile, **`1.75` across-draw sd**
above the exact null. **READING A: the lottery explanation gains its across-draw evidence; the
finite-variance claim does not acquire across-draw support.** The registered run's `16.26 SE`
figure quoted the **within-draw** Wald SE `0.002062` against a **between-draw** spread of
`0.019139`, a factor of `9.3` — **K6A.2.4c's category error, now measured on the increment field
rather than on detection.** No card is re-scored, no S2 authority moves, and the `[0.97, 1.01]`
range is not withdrawn.

**E7 reproduces K6A.1.5's screen distribution on a disjoint seed band**, unprompted: `g_null` mean
`−6.821e-2` against `−6.754e-2`, sd `1.379e-2` against `1.571e-2`, `0/100` positive.

**DEVIATION E5, and its measured mechanism — filed against this document's own REGISTRATION, not
against the endpoint, which stands as measured.** `0/100` at a registered `p = 0.039` is a `1.9%`
outcome. **E4 and E5 are both defined on an OBSERVED healthy rate, so both are functions of the
trajectory count at which that rate is observed, and K6A.1.10 estimated them from a `TJ = 72`
probe while this study measures at `TJ = 500`.** Replaying K6A.1.10's own two rules on this study's
own 100 draw-level rates, at the gate's own `TJ = 72`: the `> α` rule gives **`0.081`** against the
gate's `22/280 = 0.079`, and the Wilson-LB rule gives **`0.039`** against the gate's
`11/280 = 0.039`. **The draw-level healthy-rate distribution REPLICATES the gate's; only `TJ`
differs.** At `TJ = 500` the same rules give `0.041` and `0.011` against measured `0.030` and
`0.000`, both inside binomial noise on 100 draws.

**The registration defect this exposes, filed as a write-back obligation and NOT fixed here.**
K6A.1.10's E5 rule applies an `n = 2000` Wilson threshold (point rate `0.0585`) to a rate measured
on `72` trajectories, where the granularity is `1/72 = 0.0139` and the threshold is effectively
"`k >= 5`". **A stop condition's false-fire rate estimated that way is a property of the probe's
trajectory count, not of the stop condition.** Nothing in K6A.1.10 moves: this study has no
authority over a stop condition, and the `≈ 4%` figure it registers is left standing with this
measurement recorded beside it.

**Quote-and-correct against THIS amendment's own text, in the direction against its convenience.**
Quoted, K6A.6.4 E2:

> `[0.117, 0.166]` (the chi-square 95% interval at `df = 99`)

**Correct: the exact chi-square 95% interval about `0.1416` at `df = 99` is `[0.1219, 0.1613]`.**
The registered band is **wider** than the interval it names, so it was easier to hit than it
claimed to be. E2's `0.151398` is inside both and the verdict does not change; the correction is
recorded because a band that misdescribes itself is a band a reader cannot check.

**One comparability limit on E8, stated because the number invites a comparison it cannot carry.**
`p_uniformity` pools `TJ × 40` values, so this study reads KS at `n = 20,000` and the registered run
read it at `n = 80,000`. **The KS statistic exceeds its critical value on `100/100` draws here, the
smallest at `1.88×`** — so the registered run's `8.56×` is not a hot-draw property but what this
discrete-`p` construction does on every draw, which is the ground K6.7/K3.1.7 stripped the field's
verdict authority on. E8 registered no prediction and none is claimed.

**The registered run located, descriptive per K6A.6.4:** canonical `0.8515` at fraction `0.93`,
healthy `0.0540` at `0.97`, increment `1.024959` at `0.97`, **all three inside the measured
support**. The "hot draw" is measured rather than asserted, and it is one draw of the 100.

**Unchanged by this run:** `K6-slow YES at this calibration draw`, the one-attempt rule, every
K6A.1.12 endpoint, `K6 = NO` at the deploy-gate geometry, and every `COVERAGE.md` row.

---

### Correction append to v2.K6A.6's results, dated 2026-08-09 (appended not edited)

Four corrections from an independent review of `run-acrossdraw-20260809T065107Z`, three of them
against this amendment's own text and one against a band v2.K6A.1 registered and this amendment's
summary declared unchanged. **No measurement is re-run and no endpoint verdict moves**; the review
re-derived the rows byte-identically and confirmed E6's disposition was forced by the registered
rule.

#### (1) The E5 replay MIXED TWO RULES — corrected with the like-for-like table

**Quoted, the results append:**

> At `TJ = 500` the same rules give `0.041` and `0.011`, against measured `0.030` and `0.000`

**Correct: "the same rules" is FALSE for E5.** The `0.039` replayed at `TJ = 72` is the
**point-rate `> 0.0585`** rule; the `0.011` quoted at `TJ = 500` is the **Wilson-LB-at-`n`** rule.
Those are two different rules, so the pair is not a like-for-like comparison. **Like-for-like at
`TJ = 500` for the point-rate rule is `0.0229`, not `0.011`.** All three rules at all three counts,
computed on this study's own 100 draw-level rates:

| rule | `TJ = 72` | `TJ = 500` | `TJ = 2000` |
|---|---|---|---|
| observed rate `> α = 0.05` (**E4's own rule**) | `0.0807` | **`0.0413`** | `0.0380` |
| observed rate `> 0.0585` (the `n = 2000` LB proxy) | **`0.0395`** | `0.0229` | `0.0231` |
| Wilson LB at `n` `> α` (**E5's own rule**) | `0.0084` | **`0.0109`** | `0.0240` |

**Each endpoint against its OWN rule, which is the honest comparison:**

- **E4**'s rule is `rate > α`. Its registered `0.079` is that rule at `TJ = 72` (replicated here at
  `0.0807`); at `TJ = 500` the same rule predicts `0.0413`; measured `0.030`. Consistent.
- **E5**'s rule is the Wilson LB at `n`. Its registered `0.039` is **NOT that rule** — it is the
  point-rate proxy at `TJ = 72` (replicated at `0.0395`). E5's own rule at `TJ = 500` predicts
  `0.0109`, i.e. `1.09` draws of 100, and `P(0 | 1.09) = 0.34`. **Measured `0`: unremarkable
  against the rule E5 actually applies.** The DEVIATION verdict against the registered
  `[0.01, 0.10]` band stands as recorded — the band is what was registered.

#### (2) "A property of the probe's trajectory count, not of the stop condition" OVERSTATES

**Quoted, the results append and K6A.6's REPORT.md §5:**

> **A stop condition's false-fire rate estimated that way is a property of the probe's trajectory
> count, not of the stop condition.**

**Correct, and against this document's own rhetorical convenience: the `TJ = 72` estimate inflates
the figure, it does not create it.** At the stop condition's real `n = 2000` the Wilson-LB rule
still false-fires on **`2.40%`** of calibration draws from the lottery alone (table above). The
gate's `3.9%` came from the point-rate proxy at `TJ = 72`, which reads `0.0395` — an inflation of
**`×1.64`**, not a fabrication. **The stop condition genuinely has a lottery-driven false-fire rate
of about `2.4%`, and K6A.1.10's qualitative claim that it has one is CORRECT.**

**Consequence, stated because it weakens this document's own filing: the write-back obligation
against K6A.1.10 is WEAKER than the results append claimed.** It is no longer "the registered
figure measures the wrong object"; it is "the registered `≈ 4%` should read `≈ 2.4%`, the `1.6×`
gap being the `TJ = 72` proxy". A number to correct, not a method to withdraw. K6A.1.10's two-sided
reporting rule (screen-clean plus paging-fired is the lottery's signature) is untouched and is
confirmed by the `2.4%`.

#### (3) READING A has stronger evidence than the results append reported — and it CONTRADICTS a band K6A.1.12 registered

**Unreported by this author, measured by the review on the committed `rows.json`:**

```
draws outside the registered FALSIFIER range [0.97, 1.01]       32/100   (15 above, 17 below)
draws whose one-sided LB > 1.01 (the run's own filing condition)  9/100
draws outside K6A.1.12's registered per-draw band [0.985, 0.998] 74/100
measured p05-p95                                    [0.9609, 1.0229]
                                                     width 0.061995  vs  0.013 registered
                                                     -> 4.77x wider
```

**This is the strongest single piece of READING-A evidence in the study and it was left out.** The
`[0.97, 1.01]` range fires on **roughly a third of calibration draws from the lottery alone**, and
the run's own filing condition (`LB > 1.01`) is met on `9/100`. A range that fires on `32%` of clean
draws is not an instrument that detected something on the registered run.

**And a MEASURED CONTRADICTION of a registered band, filed as an erratum to v2.K6A.1 K6A.1.12.**
Quoted, K6A.1.12:

> | cell 47 S2 `increment_estimator.mean` | `0.9914` | `[0.985, 0.998]` (exact `E[e|null] = 0.991433`) | outside `[0.97, 1.01]` |

with K6A.1.12's own framing: *"Bands are per-calibration-draw (K6A.1.7), which is the quantity a
one-draw run realizes."* **Measured: `74/100` draws fall outside `[0.985, 0.998]`. As a
per-calibration-draw band it is wrong by a factor of `4.77` in width.**

**The erratum is to the BAND, not to the field or the point prediction.** K6A.1.12's point
prediction `0.9914` and the exact null `0.991433` are **CONFIRMED** by this study
(measured across-draw mean `0.989903`, `−0.80` SE). What was wrong was the spread attached to it:
`[0.985, 0.998]` is approximately the interval a *within-draw* SE implies, not the across-draw
spread K6A.1.12 said its bands were. **Registered: the per-calibration-draw band for
`increment_estimator.mean` is the measured `[0.9609, 1.0229]` (p05–p95, `R = 100`), superseding
`[0.985, 0.998]`; the falsifier range `[0.97, 1.01]` is left as registered with its measured
`32%` lottery false-fire rate recorded beside it.** K6A.5's rejection of withdrawing a range after
watching it fire still stands: the range is not withdrawn, it is characterised.

**The precision that matters, because it isolates the defect rather than smearing it across
K6A.1.12.** The other two per-draw bands in the same table are RIGHT: detection's `[0.333, 0.848]`
excludes `8/100` and healthy's `[0.000, 0.056]` excludes `3/100`, both what a p05–p95 band should
do. **Only the increment row's band is wrong. The band-setting method is not in question; one row
is.**

**Quote-and-correct against this amendment's own summary, twice.** Quoted, K6A.6.7 (8):

> **Every K6-slow endpoint and verdict of K6A.1.12 stands unchanged**

and, quoted, the results append:

> **Unchanged by this run:** `K6-slow YES at this calibration draw`, the one-attempt rule, every
> K6A.1.12 endpoint, [...]

**Correct: K6A.1.12's `increment_estimator.mean` BAND does NOT stand — it is contradicted at
`74/100`.** Every K6A.1.12 **endpoint, point prediction and verdict** does stand, including
`K6-slow YES at this calibration draw`, the class row, `K6 = NO` at the deploy-gate geometry and
every `COVERAGE.md` row. **The blanket "stands unchanged" was written before the review measured
the band and is corrected here rather than quietly narrowed.**

#### (4) Four errata, one line each

- **K6A.6.5's readings B and C OVERLAP.** B fires on `gap > 1.96·SE`; C fires on
  `gap < −1.96·SE` **OR** the run draw outside the measured support. A result with
  `gap > 1.96·SE` *and* the run draw outside support satisfies both. **The driver resolves it
  B-first, which K6A.6.5 never registered** — an unregistered precedence rule in the disposition
  code. **Not triggered here** (`gap = −0.80` SE, run draw inside support → A unambiguously), and
  registered now so a future run cannot have it chosen after the fact.
- **K6A.6.5 says `sd` without saying which.** The driver uses the sample sd (`n − 1`),
  `0.019139`; the population form (`n`) gives `0.019043`. Gaps `−0.799` and `−0.803` SE
  respectively — **both select READING A**, so nothing turns on it, and the `n − 1` convention is
  registered as the operative one.
- **E4's band comparison is INCLUSIVE in the driver and unstated in the prereg.** Measured `0.03`
  equals the band's lower bound `0.03` exactly; `measured >= band[0]` returns HELD. **Under an
  exclusive reading E4 would be a DEVIATION.** Registered: the comparison is inclusive at both
  ends, stated now because a boundary hit is exactly where an unstated convention decides a
  verdict.
- **E1's `+0.29 SE` mixes denominators.** REPORT.md §2 divides the `0.00444` gap by this study's
  *measured* SE `0.015294`, giving `+0.29`; against the *registered* `0.1416/sqrt(100) = 0.01416`
  the gap is **`+0.31` SE**. Both are far inside the band and E1 holds either way; the registered
  denominator is the one E1's band was built from and `+0.31` is the figure that matches it.

---

## Amendment v2.K6A.7 — 2026-08-09, the strided reference: executing the C50 ruling, with the overlap it forces measured and the T2 increment estimator registered

Registered before the stride exists in code and before one tick of the T2 rerun. Authority:
`knowledge/methodology/pages/t2-reference-placement.md`, **RATIFIED 2026-08-08** (operator: "1, 3,
4"), which closes the A-placement degree of freedom the confound append to
`results/live/run-t2-20260809T040552Z/REPORT.md` measured. That page's execution section is quoted
as this amendment's scope:

> One amendment registering the stride (n_A unchanged, phase stated), the
> `run-clustersynth-arm.mjs` change, tests (stride guard + positive control + the flip probe
> re-run as a regression: with strided A the front/back flip must collapse), one registered T2
> rerun (validity-only, prior run preserved append-only with the confound note), and **K6.12's
> contiguity question re-posed** on the rerun's per-coordinate rows.

Three things in this document are not in that page and are registered because the code will emit
them: the overlap the stride's arithmetic forces and its measured cost (K6A.7.3), the residual
B-placement DOF the ruling does not close (K6A.7.4), and the T2 increment estimator's definition,
which has been an unregistered code choice since the arm was wired (K6A.7.5). **One prediction in
the ratified page's own execution sentence — "with strided A the front/back flip must collapse" — is
contradicted by this amendment's pre-registration probe and is registered as a competing hypothesis
rather than as the expectation** (K6A.7.8).

### K6A.7.1 The stride, as arithmetic

`REFERENCE_TICKS = 9000`, `W = 150`, `n_A = 2250`, `m = 45` — every one unchanged from K6A.1.11.
The stride is exact and forces no adjustment to `n_A`:

```
k = REFERENCE_TICKS / n_A = 9000 / 2250 = 4     exactly, no remainder
phase = 0
A = reference ticks {0, 4, 8, ..., 8996}                      -> 2250 ticks
B = reference ticks [2250, 9000), tiled into 45 blocks of 150 -> 6750 ticks
    each block 150 CONSECUTIVE original ticks
check: 2250 + 45*150 = 9000; live = ticks [9000, 9600) -> 4 windows of 150
```

**`k = 4` and `phase = 0` are registered literals.** No search over `k` or phase was run and none
may be run afterwards: `k` is fixed by `9000/2250` and phase 0 is the first tick of the span.

**What the code will do, stated at the field level.** `calibrateEcdfAccumulator(rows, geom)`
(`detectors/shape-ecdf-accumulator.ts:336`) splits `A = rows[0, nA)` and `B = rows[nA, nA + m*W)`
from one array and takes no placement argument. The harness therefore builds that array under a
registered layout rather than passing the raw reference slice:

```
rows = [ ...A_strided (2250) , ...reference[2250..9000) (6750) ]     length 9000
```

The detector module is **unchanged** by this amendment. `B`'s blocks are the same 45 slices of the
same 6750 ticks the pre-C50 code used; **only A moves.** The manifest gains
`reference_a_layout: 'strided'`, `reference_a_stride: 4`, `reference_a_phase: 0`, and the
`shape_block_conformal_bet` arm — which has no A/B split at all (`aTicks: null`) — records
`reference_a_layout: null` and is otherwise untouched.

### K6A.7.2 Why the stride cannot be made disjoint, and why that is arithmetic rather than a choice

`n_A + m*W = 2250 + 6750 = 9000` **exactly saturates the span**. So a disjoint A and B forces B onto
the exact complement of A — the 6750 ticks the stride does not take — and that complement is the
3-of-every-4 pattern, whose 150-value blocks each span 200 original ticks with every fourth tick
removed. A decimated block is not a contiguous slice, and the ruling's own parenthetical forbids it:

> B's blocks stay contiguous — the C22 serial-structure requirement applies to the *ranked*
> objects, not the reference sample.

**Registered: under the ratified geometry, A overlapping B is forced, not selected.** Each B block
shares `150/4 = 37.5` of its 150 ticks with A — 37 or 38 depending on the block's offset modulo 4.
The live windows share **none** (A's last tick is 8996; live begins at 9000).

### K6A.7.3 The overlap's cost, measured — and a registered contradiction with the ratified ruling

The ruling states:

> **Validity is untouched.** The block-conformal rank identity requires only that A is fixed
> before B and live are scored — A shapes the statistic T, not the exchangeability of T(live)
> with T(B_j). Any fixed A yields the exact rank law.

**That argument is incomplete, and the gap is measurable.** The rank identity needs `T(live)` and
`T(B_1)..T(B_m)` **conditionally i.i.d. given A**. Conditioning on A does not make the `B_j`
independent of A when `B_j` contributes 37–38 of its own values to A: each `T(B_j)` is an energy
distance from a reference that partly contains `B_j`, while `T(live)` is a distance from a reference
containing none of the live window. B and live are therefore not conditionally identically
distributed, and the direction is anti-conservative (a block pulled toward its own reference scores
a smaller `T`, which raises `T(live)`'s rank and lowers `p`).

**Measured, on an i.i.d. substrate where drift is absent by construction so the overlap is the only
thing left.** Probe `overlap-screen.mjs`, disclosed with its generator and seeds:
`mulberry32(710000000 + r)` uniforms → Box–Muller standard normals; `R = 10,000` draws × 4 live
windows at `W = 150`, `n_A = 2250`, `m = 45`, `κ = 0.6820`. Probe base `7.1e8` — above every
registered seed (all `<= 1e8`) and not one of the eight named K6-probe bases (`1.7e9`–`4.1e9`). No
registered seed and no registered study RNG is touched. Three arms score **the same live windows**
against differently-built references, so the arm difference is paired:

| arm | mean `e` | gap vs exact null `0.960274` | mean `p` | `P(p <= 1/46)` | crossings |
|---|---|---|---|---|---|
| **overlap** (strided A over the span B tiles) | **`0.971052`** | **`+6.48` SE** | `0.497951` | `0.0231` | `0/10,000` |
| disjoint (A = ticks 0..2250, the pre-C50 layout) | `0.958981` | `-0.80` SE | `0.511259` | `0.0210` | `0/10,000` |
| strided A from an INDEPENDENT span | `0.959075` | `-0.74` SE | `0.510984` | `0.0209` | `0/10,000` |

```
PAIRED  overlap - disjoint               delta E[e] = +0.012070 +- 0.000771   (15.66 SE)
                                         delta E[p] = -0.013309 +- 0.000729  (-18.25 SE)
PAIRED  overlap - strided_independent_A  delta E[e] = +0.011977 +- 0.000855   (14.01 SE)
                                         delta E[p] = -0.013034 +- 0.000820  (-15.89 SE)
uniform-grid reference: mean p = 0.510870, P(p <= 1/46) = 0.021739
```

**Three readings, registered separately because they point different ways.**

1. **The ruling's "validity is untouched" is wrong as stated, and the error is `+1.26%` on `E[e]`.**
   The overlap arm sits `6.48` SE above the exact null while both non-overlap arms sit within
   `1` SE of it, and the two non-overlap arms agree with each other to `0.0001`. **The stride is not
   the cause — the overlap is:** striding A from an independent span reproduces the disjoint
   reading exactly. This is filed as a **contradiction with a ratified page, recorded and not
   resolved** (the page is not this document's to edit; the write-back obligation is named in
   K6A.7.11).
2. **The registered endpoint is unaffected at this geometry, and this is arithmetic rather than
   reassurance.** A crossing needs `S_4 >= 14.2337` of a maximum `4·log 46 = 15.3146`, which
   requires `p = 1/46` at **three of the four** windows (three at `1/46` plus one at `2/46` gives
   `14.6214`, clears; two and two gives `13.9282`, fails). At the measured floor rates that is
   `~4.9e-5` per pair under overlap against `~3.7e-5` disjoint — `0.03` versus `0.02` expected
   crossings over `n = 600`. **Measured directly: `0/10,000` pairs crossed in every arm.**
3. **So the overlap moves the increment field and not the verdict field.** `t2_increment_mean`
   carries a registered `+0.0121` anti-conservative bias under this layout that the pre-C50 layout
   did not have. **Registered now, before the run, so it cannot be read afterwards as a substrate
   finding.**

### K6A.7.4 The residual B-placement DOF, which the ruling does not close

The ruling removes the choice of where A is cut. It leaves the choice of **which contiguous 6750 of
the 9000 ticks B tiles** — `[2250, 9000)` or `[0, 6750)` — and that choice moves the reading by more
than the A-placement question did on three of twelve probe scenarios.

Measured on 12 fresh scenario seeds × 120 shards (`placement-probe.mjs`, K6A.7.8's probe), strided A
throughout, only B moving:

| coordinate | B = `[2250,9000)` (registered) | B = `[0,6750)` | seeds where they differ |
|---|---|---|---|
| `gpu_temp_c` | `7 / 1440` crossings | **`25 / 1440`** | `700000002`: 6 → 21; `700000011`: 0 → 4 |
| `power_w` | `33 / 1440` | `31 / 1440` | `700000002`: 30 → 30; `700000004`: 0 → 1 |
| `sm_util`, `hbm_bw_gbps`, `nvlink_tx_gbps` | `0 / 1440` | `0 / 1440` | none |

**Registered: `B = reference[2250, 9000)` — the pre-C50 B, unchanged.** Chosen because it changes
exactly one thing about the construction, which is what the ruling authorizes and what makes the
rerun a clean read on A placement. **The B DOF is disclosed as OPEN, with its magnitude measured, and
is named not-done** (K6A.7.11). It is not closed by striding B's blocks across the span at block
level: that would be a second unregistered design move in the same commit, and it substitutes a
slot-phase choice for an end choice rather than removing one.

**And the ruling's mechanism claim does not survive the probe either.** The page argues a strided A
is "the time-averaged marginal of the whole reference period", which would put its reading between
the two placements'. Measured across 12 seeds × 5 coordinates, `strided − mean(front, back)` on the
increment mean has mean `−0.00204` but **sd `0.10620`, range `[−0.1714, +0.3557]`**, and on seed
`700000008` `gpu_temp_c` reads `1.1915` strided against `1.0010` front and `0.8555` back — **outside
the envelope of both placements.** Registered: **striding removes the front/back question; it does
not average the two answers, and it can read more extreme than either.**

### K6A.7.5 The T2 increment estimator, registered — an unregistered code choice since the arm was wired

K6A.2.6 registered the T2 increment mean's **value** (`0.960274`, band `[0.94, 0.98]`) and never its
**definition or scope**. Three pooling steps have been in the code, unregistered, since the arm was
wired at `43dbe37`. Registered now, at the lines that implement them, as the operative estimator:

| level | row `arm` | definition | site |
|---|---|---|---|
| pair | `T2-clustersynth` | **unweighted mean of `e` over the pair's live windows** (4 at the registered geometry), `e` from `ecdfAccumulatorWindow(...).e` | `run-clustersynth-arm.mjs:263` + `:283` |
| coordinate | `T2-clustersynth-coordinate` | **unweighted mean of the pair-means** over that coordinate's non-skipped pairs | `:299` + `:307` |
| pooled | `T2-clustersynth-pooled` | **unweighted mean of the pair-means over ALL non-skipped pairs, every coordinate together** | `:323` + `:331` |

Field name `t2_increment_mean` at all three levels — never `increment_estimator`, which is K6.1.3's
binding rule and is what keeps the field invisible to `isValidityCell`
(`validation/certification/lib/score.mjs:11`).

**The pooled level is where the unregistered choice bites, and the C51 branch's finding is the
reason it is registered here.** The C51 review recorded that this estimator's definition and scope
were an unregistered code choice which moves the headline by about `2.5×` under a different pooling.
**That finding's ledger is not committed to this repository, so it is recorded as reported and the
arithmetic is re-derived here from the committed
`results/live/run-t2-20260809T040552Z/summary.json` rather than taken on report:**

```
pooled t2_increment_mean, as the code computes it (mean over 600 pair-means)   1.0510733694967698
unweighted mean of the five coordinate means                                  1.0510733694967693
  -> the two agree to 15 decimal places ONLY because every coordinate scored n = 120 with 0 skips;
     they diverge as soon as skips differ per coordinate, and nothing registers which one is meant
median of the 600 pair-means                                                  0.807700
geometric mean of the 600 pair-means                                          0.968588   <- INSIDE [0.94, 0.98]
gpu_temp_c  2.028722  against the mean of the other four  0.806661            = 2.515x
```

**So the verifiable `2.5×` is `gpu_temp_c` against its four siblings, and the consequence is that the
registered band's status turns on the pooling rule.** The arithmetic mean reads `1.051073` and lands
**outside** `[0.94, 0.98]`; the geometric mean of the same 600 numbers reads `0.968588` and lands
**inside** it. **Registered: the arithmetic mean of pair-means, at all three levels, is the operative
estimator, and the geometric mean is NOT adopted** — even though it is the aggregation the wealth
path actually uses (`ecdfAccumulatorWealth` sums `log e`,
`detectors/shape-ecdf-accumulator.ts:467`), because changing which functional carries a registered
prediction after watching the registered one fire is the move K6A.5 refused and this document
refuses it too. **The mismatch between the reported estimator (arithmetic) and the scored
functional (geometric) is registered as a disclosed property of the field, and named not-done.**

**Quote-and-correct against K6A.2.6, which this amendment's own probe contradicts.** Quoted:

> **Registered T2 prediction: `t2` increment mean `0.960274`, band `[0.94, 0.98]`; the T1 value
> `0.9914` is NOT the T2 expectation and a T2 reading near `0.99` would indicate the wrong `m` was
> used.**

**Correct: the point value `0.960274` stands — it is the exact `E[e|null]` at `m = 45` and this
amendment's own i.i.d. screen reproduces it to `−0.80` SE (K6A.7.3, the disjoint arm). The BAND
`[0.94, 0.98]` does not stand as a per-scenario-draw band for the T2 arm.** Measured over 12 fresh
scenario seeds × 120 shards, the per-coordinate T2 increment mean on clustersynth ranges
`[0.7321, 1.8914]` under front-A, `[0.7277, 1.3981]` under back-A and `[0.7373, 1.8907]` under
strided A — **under every placement, and on 5 of 5 coordinates.** `[0.94, 0.98]` is the spread of
the exact null under exchangeability, attached to a quantity whose scenario-to-scenario spread on
this substrate is roughly `20×` wider. **This is the same defect the C51 branch filed against
K6A.1.12's T1 increment band (`74/100` draws outside a band `4.77×` too narrow), now found in the T2
counterpart.** The band is **characterised, not withdrawn**: K6A.7.8 registers the per-coordinate
bands this amendment's probe supports, and `[0.94, 0.98]` is recorded as the exchangeability band it
actually is.

### K6A.7.6 A fail-open path on the crossing endpoint, named and fixed

**The defect, at the line.** `run-clustersynth-arm.mjs:252` cuts live windows with
`for (let w = 0; (w + 1) * W <= live.length; w++)`, so a geometry with `live.length < W` yields
`windows = []`. Then:

- `:256-257` `SPEC.wealthLog([], cal)` returns `log = []` and `[].some(...)` is `false`, so
  `crossed = false` → `k = 0`, `n = 1`. **A pair that scored nothing files as a pair that cleared.**
  It enters the pooled denominator and lowers the pooled rate.
- `:263` `windowEs = []`, and `:283`'s guard is `windowEs ? {...} : {}` — **`[]` is truthy**, so the
  row emits `t2_increment_mean: 0/0 = NaN`.
- `:299` and `:323` filter with `typeof x === 'number'`, and **`typeof NaN === 'number'`**, so the
  NaN propagates into the coordinate and pooled means.
- `:340` `t2_verdict` then reads `t2PooledLower95 > ALPHA` with a NaN bound; `NaN > 0.05` is
  `false` → **`'not-refuted'`**. A run that measured nothing reads as cleared.

This is the same fail-open shape as the `n === 0` bug the Task-11a review fixed at `:340` and it sits
one level below it: that fix caught "every pair skipped", this one is "every pair scored zero
windows". **Unreachable on the registered geometry** (`600/150 = 4` windows) and reachable under any
`--steps` in `9001..9149` at `W = 150`, or `9001..9029` at `W = 30`.

**Registered fix, fail closed, three parts:**

1. **Startup refusal, W-relative:** after `LIVE_TICKS` is computed (`:143`), throw if
   `LIVE_TICKS < W`. A geometry that cannot score one full live window is refused before any shard
   is realized. **W-relative and not a literal**, because the existing suite's `--steps 9060` smoke
   is legitimate at `W = 30` (2 windows) and must stay bit-for-bit unchanged.
2. **Per-pair guard, defence in depth:** throw if `windows.length === 0` at `:253`. Unreachable
   after (1); registered so that a future change to the window-cutting rule cannot re-open the path
   silently.
3. **The NaN filters hardened:** `typeof x === 'number'` → `Number.isFinite(x)` at `:299` and
   `:323`, and `:283`'s emission guard to `windowEs && windowEs.length`. A non-finite increment must
   never enter a mean, whatever produced it.

**Registered consequence: none of the three can change any committed row.** The registered geometry
has 4 live windows and 0 skips, so `LIVE_TICKS >= W` holds, `windows.length === 4`, and every
`t2_increment_mean` in `run-t2-20260809T040552Z/summary.json` is finite (verified: 600 of 600).

### K6A.7.7 Supersession: the prior run is retained with its confound, the new run is the scored T2 evidence

**Ruling.** `run-t2-20260809T040552Z` is **not defective measurement** — it is the evidence that
established the confound, it reproduces digit for digit, and its stop condition cleared on its
registered instrument. What disqualifies it as *scored* T2 evidence is that its A placement is a
degree of freedom the ratified page has since closed. **So: the NEW run is registered as the scored
T2 evidence for `shape_ecdf_accumulator`; the prior run is retained, preserved byte-for-byte, with
its confound append standing; and the supersession mechanism carries the reason.**

**Route: the manifest array on the superseding run** (`validation/certification/lib/collect.mjs:269`,
`:283-297`), the shape the three existing coverage declarations use. Not the registry file: A2.3's
survivor predicate (`collect.mjs:340-355`) is evaluated over registries only, and the registry route
would additionally have to argue its `declared_by` authority across a study-name boundary. The
manifest route binds the declaration to the run that replaces the evidence, which is the semantics
the mechanism was built for.

**The declaration, registered literally:**

```json
[{"study": "coverage-t2-clustersynth",
  "run": "run-t2-20260809T040552Z",
  "detectors": ["shape_ecdf_accumulator"],
  "reason": "PREREGISTRATION.md Amendment v2.K6A.7 (K6A.7.7): the A-placement degree of freedom the ratified ruling knowledge/methodology/pages/t2-reference-placement.md closes. Cutting reference segment A from the front rather than the back of the same 9,000-tick span erased all 8 recorded crossings and flipped 112-120 of 120 shards per coordinate (this run's own REPORT.md confound append). Not defective measurement: the run reproduces exactly and its stop condition cleared. Superseded as SCORED T2 evidence only, detector-scoped; the directory is preserved byte-for-byte and its confound append stands as the record of the DOF."}]
```

**`detectors` carries the CELL string `shape_ecdf_accumulator`, not a card id** — `collect.mjs:420`
keys on `cell.detector`. **Detector-scoped and therefore narrow by construction:** the sibling run
`run-t2-20260808T121710Z` scores `shape_block_conformal_bet` and is untouched, as is every
`shape_block_conformal_bet` row anywhere.

**Registered code change: `run-clustersynth-arm.mjs` gains `--supersedes` / `--supersedes-reason`,
mirroring `run-battery.mjs:271-294`** — it has no way to declare a supersession today, which is why
this is a code item and not just a run argument. **One registered difference from run-battery's
copy, because copying it verbatim would silently supersede nothing.** run-battery resolves the
target as `path.resolve(STUDY, '..', s.study, 'results', 'live', s.run)`, which assumes the study
name equals its directory name. **It does not here: the study is `coverage-t2-clustersynth` and the
directory is `validation/coverage/results/live/`.** So the T2 arm resolves the target under its own
`STUDY/results/live/<run>` and, additionally, **reads the target's `manifest.json` and asserts its
`study` field equals the locator's study** — a stronger check than path existence, and the one that
catches exactly this mismatch.

**Registered consequences on the certification side, checked against the code rather than assumed.**
T2 rows carry no `fault_class`, and `t2_crossing_rate`/`t2_increment_mean` are not the field names
`isValidityCell` (`score.mjs:11`) or `isPowerCell` (`score.mjs:16`) test, so T2 cells are candidates
for nothing: `coverageFor` filters on `fault_class` (`score.mjs:361`), and `t2_verdict` is read by no
code in `validation/certification/`. **Registered prediction: superseding these rows moves no tuple
in `golden-verdicts.test.mjs` — no `overall.verdict`, no `overall.tier`, no S1–S4 status, on any of
the 15 cards — and the only observable that moves is `generated_from.runs`** (`verdict.mjs:58`).
**Two test-side consequences are registered as expected, not discovered:** `collect.test.mjs:657`'s
census literal and `:660-667`'s drop table gain the new declaration, and the census arithmetic is
`2266 − 606 + 606 = 2266` (the new run emits the same `600 + 5 + 1` rows the superseded one did), so
the count is predicted **unchanged at `2266`** with one new key in the drop map.

### K6A.7.8 Registered predictions, with the probe they come from

**The probe, disclosed in full because the predictions are derived from it rather than asserted.**
`placement-probe.mjs`: the registered T2 construction — `cs.buildScenario({family:'gb200', pods:1,
seed:<probe>, window:{steps:9600, dt_s:30}, faults:false})`, `sc.gpuIds.slice(0,120)`, `W = 150`,
`n_A = 2250`, `m = 45`, `κ = 0.6820` — on **12 fresh scenario seeds `700000001..700000012`**, each at
the full 120 shards × 5 coordinates, scoring four A/B layouts per pair. Probe base `7.0e8`: above
every registered seed (`<= 1e8`), not one of the eight named K6-probe bases, and disjoint from the
two registered T2 scenario seeds (`20260842`, `20260855`).

**The probe machinery is validated against committed evidence before any prediction is read off it.**
Run on the registered seed `20260855` with **only the two already-published layouts enabled**, it
reproduces the confound append digit for digit: `gpu_temp_c` `8/120` crossings under front-A and
`0/120` under back-A; first-shard front-A `p` `0.0435 / 0.0217 / 0.0217 / 0.0435` and back-A
`0.9783 / 0.9130 / 0.8478 / 0.9783`; front-A `gpu_temp_c` `t2_increment_mean` `2.028722`, matching
the committed `summary.json` to six decimals. **The strided layout was NOT run on seed `20260855` at
any point before this amendment was committed** — that is the registered endpoint and peeking at it
would void the rerun.

**The flip-collapse prediction, and why it is registered AGAINST the ratified page's expectation.**
The page's execution sentence says "with strided A the front/back flip must collapse". The probe
says otherwise: **across all 12 fresh seeds, strided-A `gpu_temp_c` crossings equal front-A
`gpu_temp_c` crossings exactly — 12 of 12, including both informative seeds (`6 → 6`, `1 → 1`).**
The scenario draw, not the A placement, is what carries the crossings: 10 of 12 seeds give `0` on
every coordinate under every layout, and 2 seeds carry essentially all of them.

Two hypotheses are therefore registered, with near-disjoint bands, and the rerun discriminates:

| | prediction for strided-A `gpu_temp_c` crossings | basis |
|---|---|---|
| **H_substrate (this amendment's registered prediction)** | **`8`**, band **`[2, 20]`** | 12/12 exact agreement with front-A on fresh seeds; registered front-A value is `8` |
| H_placement (the ratified page's expectation) | `[0, 3]` | the front/back flip being wholly an A-placement artifact |

**Every endpoint the rerun will read, with its band and its falsifier:**

| endpoint | prediction | registered band | falsifier |
|---|---|---|---|
| `gpu_temp_c` crossings | **`8`** / 120 | `[2, 20]` | outside → H_substrate refuted; `<= 3` → H_placement instead |
| `power_w` crossings | `0` / 120 | `[0, 30]` | `> 30` |
| `sm_util`, `hbm_bw_gbps`, `nvlink_tx_gbps` crossings | `0` / 120 each | `[0, 2]` each | any of the three `> 2` |
| **pooled `t2_crossing_rate`** | **`0.013333`** (`8/600`) | `[0.0033, 0.0533]` | outside |
| **pooled `t2_pooled_lower_95`** | **`0.007528`** | `< 0.05` | `> 0.05` → **STOP, REFUTED** |
| **the T2 stop condition** | **CLEARS** | — | fires at `k >= 39` of 600 (`LB = 0.050319`; `k = 38` gives `0.048856`) |
| `gpu_temp_c` `t2_increment_mean` | `1.9343` | `[1.4308, 2.4150]` | outside |
| `power_w` `t2_increment_mean` | `0.7945` | `[0.7392, 0.8486]` | outside |
| `sm_util` `t2_increment_mean` | `0.8191` | `[0.6987, 0.9509]` | outside |
| `hbm_bw_gbps` `t2_increment_mean` | `0.8343` | `[0.7160, 0.9462]` | outside |
| `nvlink_tx_gbps` `t2_increment_mean` | `0.8502` | `[0.7422, 0.9502]` | outside |
| pooled `t2_increment_mean` | `1.0512` | `[0.9143, 1.1014]` | outside |
| degenerate-reference skips | **`0`** | — | any nonzero is a finding, disclosed per coordinate, never folded into a denominator (K6.12) |
| `n_reference_blocks` every pair | **`45`** | — | anything else crashes the arm (`:247-250`) |
| `n_live_windows` every pair | **`4`** | — | anything else |

**The increment bands' method, stated because it is not a textbook band.** Each is the registered
seed's own **published front-A value** multiplied by the min / median / max of the strided-to-front
ratio measured across the 12 fresh seeds for that coordinate. Anchoring on the registered seed's
front-A reading uses the one thing already known about this scenario; the ratio spread comes from
seeds that are not it. **Not `[0.94, 0.98]`: K6A.7.5 corrects that band, and none of these five
predictions is near `0.960274`.** Registered plainly: **the m = 45 exchangeability null is not where
the T2 increment mean lives on clustersynth telemetry under any placement**, and predicting it near
`0.960274` would be predicting exchangeability, which is the question rather than the expectation.

**A property of the pooled denominator, registered because it inflates every T2 reading's apparent
precision.** The 120 shards of one scenario share that scenario's load cycle — the probe's
block-mean traces show `sm_util` moving `0.35 → 1.00 → 0.23` across the 9,600-tick span on every
shard together. So `n = 600` pooled `(shard, coordinate)` pairs are **not 600 independent draws**;
the effective unit is the scenario, of which there is one. **Registered: the pooled Wilson lower
bound treats correlated pairs as independent and is therefore narrower than the evidence supports.**
This is the same single-draw structure K6A.1.7 registered for the T1 calibration draw, in the T2
arm's own denominator. It is **not** repaired here — the stop condition stays exactly as K6.13/K6.1.4
register it, on `t2_pooled_lower_95` over `n = 600` — because changing a registered instrument on the
run that reads it is the move house rule 7 forbids. Named not-done.

### K6A.7.9 K6.12's contiguity question, re-posed

**The registered question, in the form the rerun can answer:** *with the A-placement degree of
freedom closed, does any of the five coordinates depart from block-exchangeability between the live
span and the reference span's blocks?* The instrument is the per-coordinate row — crossings against
`α`, the increment mean against its band, and the skip accounting — and the pooled row carries the
stop condition.

**What each outcome files. Registered before the run, so none of the four can be chosen afterwards:**

1. **Pooled LB `<= 0.05` and all five coordinates inside their bands** → **the construction's
   validity survives independent telemetry with a placement-free reference.** C22's question is
   answered in `shape_ecdf_accumulator`'s favour at this geometry, with the near-vacuity of the
   `W = 150` crossing endpoint (K6A.1.11) restated as the limit on how much that PASS is worth.
2. **Pooled LB `<= 0.05`, but `gpu_temp_c` alone outside its band with crossings in
   `[2, 20]`** — the registered prediction — → **a per-coordinate departure that survives the
   placement fix, filed as a real finding about `gpu_temp_c` on clustersynth and NOT as a refutation
   of the detector**, because the pooled instrument is what K6.13 gives verdict authority to.
   H_substrate holds, H_placement is refuted, and the prior run's `2.028722` stops being explicable
   as placement alone.
3. **Crossings `<= 3` on every coordinate** → **H_placement holds**: the prior deviation was wholly
   the A cut, the ratified page's expectation is confirmed, and the confound append's reading is the
   complete explanation.
4. **Pooled LB `> 0.05`** → **the T2 stop condition FIRES and `shape_ecdf_accumulator` is REFUTED on
   the record** (K6A.1.10's ruling, unchanged), reported with the per-coordinate rows beside it.

**What no outcome licenses.** The B-placement DOF stays open under all four (K6A.7.4), so a PASS
here is a PASS at `B = [2250, 9000)` and not at every contiguous B. And the `+0.0121` overlap bias on
`t2_increment_mean` (K6A.7.3) is subtracted from no reading and explains no deviation larger than
itself.

### K6A.7.10 Registered code and test items

| # | file | change |
|---|---|---|
| 1 | `coverage/harness/run-clustersynth-arm.mjs` | the strided-A layout per K6A.7.1, as a per-detector `referenceLayout` on `T2_DETECTORS`; `shape_block_conformal_bet` keeps `null` |
| 2 | same | three manifest fields: `reference_a_layout`, `reference_a_stride`, `reference_a_phase` |
| 3 | same | the stride assertion: `REFERENCE_TICKS % nA === 0`, `k === 4`, `phase === 0`, and `A.length === nA` after building, all before any shard is realized |
| 4 | same | K6A.7.6's three fail-closed parts |
| 5 | same | `--supersedes` / `--supersedes-reason` per K6A.7.7, with the study-field assertion |
| 6 | `coverage/test/run-clustersynth-arm.test.mjs` | the tests below |
| 7 | `certification/test/collect.test.mjs` | the census and drop-table update K6A.7.7 predicts |

**Registered tests, each with the mutation that kills it** (the convention
`test/run-acrossdraw.test.mjs:1-2` states):

1. **Stride guard.** The manifest records `reference_a_layout: 'strided'`, `stride 4`, `phase 0`; the
   accumulator arm's `A` is `{0, 4, ..., 8996}` re-derived from clustersynth in the test, and
   `n_reference_blocks === 45` on every pair. *Kill: change the stride to 3 or the phase to 1 and
   the re-derivation fails.*
2. **Positive control that the stride is actually consumed.** Rebuild the calibration both ways from
   the manifest's own constants and assert `cal.sortedA` differs between strided and prefix layouts
   while `cal.blockT` is **identical** — B did not move. *Kill: leave the harness passing the raw
   prefix and `sortedA` matches, failing the test.*
3. **Flip-collapse regression, on a NON-REGISTERED seed.** Front-A, back-A and strided-A scored on
   one shard of scenario seed `700000002` (the probe's crossing-carrying seed), with the three
   readings pinned as frozen literals in the `golden-verdicts.test.mjs:24-38` style. *Kill: swap
   which layout the harness builds and the pinned triple fails.*
4. **Fail-closed on zero live windows.** `--detector shape_ecdf_accumulator --steps 9060` (60 live
   ticks at `W = 150`) exits non-zero, stderr names the geometry, and **no run directory is written
   under either `live` or `sim`**. *Kill: delete the throw, or weaken `<` to `<=`, and the harness
   produces a `not-refuted` pooled row from zero measurements.*
5. **The NaN filters.** `Number.isFinite` rejects a NaN increment where `typeof === 'number'`
   admitted it. *Kill: restore `typeof x === 'number'` and a NaN reaches the pooled mean.*
6. **`--supersedes` shape and the study-field check.** Both flags required together; a locator whose
   target manifest carries a different `study` throws. *Kill: drop the study-field assertion and a
   locator naming `coverage/run-t2-...` is accepted, declaring a supersession no code will apply.*

**Suite arithmetic, registered:** `test:coverage-battery` `125 → 131` (six new tests in
`run-clustersynth-arm.test.mjs`, `14 → 20`), no subtests. `npm test` unchanged at `351` — nothing
under `test/*.test.ts` is touched. `test:cert` changes count only if the census update adds a test;
it updates literals in place, so it stays as it stands at this HEAD. **`cert:expiry` stays current:
no card pins `run-clustersynth-arm.mjs`, `PREREGISTRATION.md` or `collect.mjs`'s neighbours that this
work touches** — checked, `shape_ecdf_accumulator.json` pins `run-battery.mjs`, which is not edited.

### K6A.7.11 House rules, mapped, and write-backs

(1) **Committed before any artifact it authorizes** — at this commit there is no stride, no test, no
rerun and no supersession declaration; this amendment is prereg text alone in its own commit. (2) A
failed endpoint is a publishable result; **nothing above moves afterward, including the `8` crossings
prediction, the five increment bands, and the prediction that no golden tuple moves.** (3) No
post-hoc analysis: every number in K6A.7.3, K6A.7.4, K6A.7.5 and K6A.7.8 is either quoted from a
committed artifact or measured at pre-registration time on disclosed fresh seeds, and **the strided
layout has never been run on the registered scenario seed.** (4) Fallback rules: K6.12's
skip-with-reason, unchanged. (5) Freeze: `k = 4`, `phase = 0`, `n_A = 2250`, `m = 45`, `W = 150`,
`B = [2250, 9000)`, scenario seed `20260855` — all frozen here. (6) Results append-only; the prior
T2 run is preserved byte-for-byte and its confound append stands. (7) Reruns only for a named cause,
prior run preserved — the cause is named in K6A.7.7 and it is a **closed degree of freedom, not a
code defect**, which is why the prior run is superseded as scored evidence rather than called wrong.
(8) The report states every endpoint's number and verdict — discharged by K6A.7.8's table.

**Write-back obligations, named and NOT done here** (the wiki is not this document's to edit):

- **`knowledge/methodology/pages/t2-reference-placement.md` claims "Validity is untouched" and
  "Any fixed A yields the exact rank law". K6A.7.3 measures `+0.012070 ± 0.000771` on `E[e]`
  (`15.66` SE, paired) from the overlap the ruling's own geometry forces.** The page needs the
  overlap named as a cost, with the arithmetic that makes it unavoidable at `n_A + m·W = 9000`.
  **Filed as a contradiction with a ratified page, not resolved here.**
- **The page's "with strided A the front/back flip must collapse" is contradicted at 12 of 12 fresh
  seeds** (K6A.7.8). The page needs the scenario-draw lottery as the dominant term.
- **The page's "time-averaged marginal" mechanism implies an intermediate reading; measured
  `sd = 0.106` around the placements' midpoint, with readings outside both** (K6A.7.4).
- **The B-placement DOF is open**, at `25/1440` against `7/1440` on `gpu_temp_c` (K6A.7.4).

### K6A.7.12 Named-not-done

- **The B-placement DOF** (K6A.7.4) — measured, disclosed, not closed. A block-level stride over B
  is the candidate and is its own decision.
- **The arithmetic/geometric mismatch in the increment field** (K6A.7.5): the reported estimator is
  the arithmetic mean of pair-means; the functional the wealth path scores is the geometric one.
- **The pooled denominator's independence assumption** (K6A.7.8): `n = 600` correlated pairs from one
  scenario, read as 600 independent draws by `t2_pooled_lower_95`.
- **A longer T2 clustersynth window** to restore a non-vacuous live crossing endpoint at `W = 150`
  — K6A.1.15's item, unchanged and still not done.
- **T1 is untouched.** Its held-out substrate is i.i.d. by construction, so neither placement nor
  overlap can arise there, and this amendment changes no T1 constant, cell, seed or prediction.

### Amendment summary

Executes the ratified C50 ruling: **A becomes a stride-4, phase-0 sample of the full 9,000-tick
reference span (`n_A = 2250` unchanged, `m = 45` unchanged, `B = [2250, 9000)` unchanged)**, in
prereg text alone with no code at this commit. Registers three things the ruling does not: **the
A/B overlap the geometry forces** — `2250 + 6750 = 9000` saturates the span, so a disjoint B would
have to be decimated, which the ruling forbids — **with its measured cost of `+0.012070 ± 0.000771`
on `E[e]` (`15.66` SE, paired, on an i.i.d. substrate), filed as a contradiction with the ratified
page's "validity is untouched"** while showing the crossing endpoint unmoved (`0/10,000` in every
arm, `~4.9e-5` against `~3.7e-5` per pair by the three-of-four-floors arithmetic); **the residual
B-placement DOF**, open and measured at `25/1440` against `7/1440` `gpu_temp_c` crossings; and
**the T2 increment estimator's definition and scope at all three pooling levels**, an unregistered
code choice since `43dbe37`, whose pooling rule decides whether the headline `1.051073` sits outside
K6A.2.6's band or the same 600 numbers' geometric mean `0.968588` sits inside it. **Corrects
K6A.2.6's band `[0.94, 0.98]`** — the point `0.960274` stands and is reproduced to `−0.80` SE, the
band does not, at `[0.7277, 1.8914]` measured across 12 fresh scenarios under every placement.
**Names a fail-open path** at `:252-283` where zero live windows produced `k = 0`, a NaN increment
past a `typeof`-based filter, and a `not-refuted` verdict from nothing measured, with a W-relative
startup refusal as the fix. **Rules the prior T2 run superseded as scored evidence and retained as
the record of the DOF**, detector-scoped via the manifest array, with the study-name/directory
mismatch that would have made the declaration inert named and asserted against. **Registers the
rerun's twelve endpoints with bands, derived from a 12-seed pre-registration probe whose machinery
reproduces the committed confound append digit for digit and which was never run on the registered
seed's strided layout** — including a prediction that **contradicts the ratified page's own
expectation**: crossings `8`, band `[2, 20]`, against the page's implied `[0, 3]`, registered as two
competing hypotheses the rerun discriminates. **Re-poses K6.12's contiguity question with four
pre-registered outcomes.** No T1 constant, cell, seed, prediction or card tuple moves, and the
predicted golden delta is **none**.

---

## Amendment v2.K6A.7 — correction append, 2026-08-09: the overlap was NOT forced, and four numbers that were wrong

Filed after an independent review of the C50 branch returned NOT-APPROVED. **The review's central
finding refutes a claim this amendment made in its own summary, and it is corrected here rather than
narrowed.** Five items. Nothing below moves a scored endpoint of `run-t2-20260809T075607Z`: that run
stays the scored T2 evidence, its stop condition stays cleared, and **no third T2 run is authorized.**

**First, the one thing the review CONFIRMED, because it is the load-bearing measurement of the
original amendment.** The overlap's cost reproduced independently: the reviewer measured
`+0.012202 ± 0.000454` against K6A.7.3's registered `+0.012142 ± 0.000223` (this document's own
`R = 120,000` re-measurement of the `R = 10,000` figure `+0.012070 ± 0.000771`). Three independent
measurements, one of them not by this author, agree. **And the review adds a reading K6A.7.3 did not
state: `E[e] <= 1` survives.** The overlap spends `0.012142` of the exact null's margin below one
(`1 − 0.960274 = 0.039726`), i.e. **`30.6%` of the margin, not the guarantee.** `E[e] = 0.972328`
remains below `1`, so the e-value property — and with it Ville's bound and the `α` guarantee — is
intact. **Registered: the overlap degrades the null's conservatism, it does not break validity.**
That is a materially weaker statement than "a measured violation of the exact rank law", and it is
the correct one.

### F2 — K6A.7.2's central claim is FALSE: a disjoint full-span layout exists at the frozen geometry

Quoted, K6A.7.2, and again in this amendment's summary:

> **Registered: under the ratified geometry, A overlapping B is forced, not selected.**

and

> **the A/B overlap the geometry FORCES.** `2250 + 6750 = 9000` saturates the span, so a disjoint B
> would have to be decimated, which the ruling forbids

**Both are WRONG.** The reviewer constructed the counterexample, and it is embarrassingly simple:
**stride at BLOCK granularity instead of tick granularity.**

```
the span is 9000 ticks = 60 blocks of W = 150
A = every 4th BLOCK  = blocks {0, 4, 8, ..., 56} = 15 blocks = 2250 ticks   <- full-span spread
B = the other 45 blocks, in order                = 45 blocks = 6750 ticks   <- contiguous slices
A n B = 0                       n_A = 2250 exactly       m = 45 exactly
```

**Disjoint, full-span, and every B block is still 150 consecutive ticks — at the frozen `n_A = 2250`
and `m = 45`, changing nothing else.** K6A.7.2's saturation arithmetic (`2250 + 6750 = 9000`) is
correct and its conclusion does not follow from it: saturation forces B onto A's complement, and the
complement of a *block*-stride is 45 whole contiguous blocks. **The overlap was forced only under an
unstated choice this document never registered as a choice — that A strides tick by tick.** The
ruling says A is "a strided sample" and never fixes the granularity.

**Measured, `R = 120,000` i.i.d. draws, `validation/coverage/tools/overlap-screen.mjs`, paired
against the same live windows:**

| layout | mean `e` | gap vs exact null `0.960274` | mean `p` | `P(p <= 1/46)` | crossings |
|---|---|---|---|---|---|
| **block-strided A (disjoint, full-span)** | **`0.960131`** | **`−0.30` SE** | `0.511214` | `0.0218` | `0/120,000` |
| tick-strided A (this run's layout, overlapping) | `0.972328` | `+24.91` SE | `0.498242` | `0.0237` | `0/120,000` |
| disjoint prefix A (pre-C50) | `0.960186` | `−0.19` SE | `0.510904` | `0.0217` | `0/120,000` |
| strided A from an independent span | `0.960055` | `−0.46` SE | `0.511025` | `0.0217` | `0/120,000` |

```
PAIRED  tick-strided - block-strided   delta E[e] = +0.012198 +- 0.000237   (51.52 SE)
                                       delta E[p] = -0.012972 +- 0.000215  (-60.33 SE)
```

**Block-strided A sits on the exact null (`−0.30` SE) and matches the uniform-grid
`P(p <= 1/46) = 0.021739` to `0.0218`.** It has the full-span property the ruling wants and the exact
null the overlap gives up. The reviewer's own figures (`−1.99` SE for block-strided;
`+0.012245 ± 0.000973`, `12.58` SE for tick-striding) agree at their `R`.

**REGISTERED: block-strided A is the layout for any FUTURE T2 run of this arm.**
`A = ticks of blocks {0, 4, ..., 56}`, `B = the other 45 blocks in order`, `n_A = 2250`, `m = 45`,
`W = 150`, block-stride `4`, block-phase `0`. **No rerun is performed and none is authorized.**
`run-t2-20260809T075607Z` remains the scored T2 evidence: its bias is measured, registered, and
endpoint-safe (`E[e] <= 1` holds; `0/120,000` false crossings in every arm; F4 below puts the exact
per-pair null crossing probability at `1.1167e-6`), and a third run of the same arm to move a field
that carries no verdict authority would be a rerun to improve a number, which house rule 7 forbids.

**What the switch would cost, measured on clustersynth so the registration is not blind** — 12 fresh
seeds × 120 shards, `validation/coverage/tools/placement-probe.mjs`:

| coordinate | crossings, tick-strided | crossings, block-strided | increment mean, tick | block |
|---|---|---|---|---|
| `gpu_temp_c` | `7/1440` | **`7/1440`** | `1.1196` | `1.1127` |
| `power_w` | `33/1440` | `40/1440` | `1.0139` | `1.0103` |
| `sm_util` / `hbm_bw_gbps` / `nvlink_tx_gbps` | `0/1440` each | `0/1440` each | `0.8745`–`0.8827` | `0.8666`–`0.8928` |

**The substantive reading does not move** — `gpu_temp_c` identical, increment means within `0.01` —
so the future switch removes the bias without disturbing what the arm reports. **Registered
consequence: this also means the switch would NOT have changed §4's contiguity answer**, which is
why leaving the current run scored is not a convenience.

**And the mechanism claim that produced the error is corrected.** K6A.7.2 reasoned from saturation
to necessity. Saturation is a constraint on B's *tick count*, never on its *block structure*. The
general statement, registered so this class of error is nameable: **at any geometry where `W` divides
both `n_A` and `m·W`, a disjoint full-span A exists by striding at block granularity, and a
tick-granularity stride is a choice that must be registered as one.**

### F3 — K6A.7.10 item 4's registered mutation is wrong-direction

Quoted, K6A.7.10 item 4:

> *Kill: delete the throw, or weaken `<` to `<=`, and the harness produces a `not-refuted` pooled row
> from zero measurements.*

**`<=` is STRICTER than `<`, not weaker.** `if (LIVE_TICKS <= W) throw` refuses everything `<` refuses
and additionally refuses `LIVE_TICKS === W`, a legitimate one-window geometry. **Measured: the
mutation SURVIVES at `131` tests, `130` pass, `0` fail, `1` skip** — no test exercises a
one-live-window geometry, so nothing sees it. **Corrected: the registered kill for item 4 is
deleting the throw** (measured: kills the fail-closed test), and `<= ` is registered as a **surviving
mutation with its reason** — the guard's boundary at exactly one window is untested, and adding a
one-window smoke to close it is named not-done rather than done here, because it is a new registered
geometry for this arm and not a correction.

### F4 — the per-pair null crossing figures were 36× too high

Quoted, K6A.7.3 reading 2, and repeated in `run-t2-20260809T075607Z/REPORT.md` §4:

> that is `~4.9e-5` per pair under overlap against `~3.7e-5` disjoint

**Both are `P(>= 3 of 4 windows at the p-floor)`, and `>= 3 floors` is NOT the clearing condition.**
Three floors plus a fourth window anywhere gives `S_4 = 11.4859 + (−log p_4)`, which clears only if
`−log p_4 >= 2.7488`, i.e. `p_4 <= 2/46`. Three floors plus `p_4 = 46/46` gives `S_4 = 11.4859`, far
short. So the published figure counts vectors that do not cross.

**The exact condition, and the exact probability.** Only window 4 can cross (three windows attain at
most `3 × 0.834782 = 2.504 < log 20 = 2.9957323`), so the per-pair crossing probability is exactly
`P(S_4 >= 14.2347005)` with `p_w` i.i.d. uniform on the 46-point grid. Enumerated over all `46^4 =
4,477,456` vectors:

```
clearing vectors: 5 of 4,477,456   ->   P(cross per pair) = 1.1167e-6   (exact, not a bound)
   the five: (1/46, 1/46, 1/46, 1/46) and the four permutations of (1/46, 1/46, 1/46, 2/46)
expected crossings over n = 120:  1.340e-4        over n = 600:  6.700e-4
published approximation 4.042e-5  ->  36.2x too high
```

**The error's direction is CONSERVATIVE and it weakened this document's own finding.** An overstated
null crossing probability understates how extreme `8/120` is. Corrected, `gpu_temp_c`'s departure is
stronger than §4 claimed: **`1.34e-4` expected against `8` observed**, not `0.003` against `8`.

**And a transcription correction, three amendments deep.** K6A.1.11 registered the required
`S_4 >= 14.2347`; K6A.7.3 and the run REPORT both quote **`14.2337`**, a digit-transposition.
`(log 20 − 4 log 0.682)/(1 − 0.682) = 14.2347005`. **The correct value is `14.23470` and K6A.1.11 had
it right.** No endpoint moves — `8` crossings are `8` crossings — and the maximum
`4 log 46 = 15.3145656` is unchanged.

### F5 — the supersession re-score's "one observable moved" accounting was incomplete

Quoted, `validation/certification/results/run-20260809T080049Z/REPORT-T2-SUPERSESSION.md`:

> ## The one observable that moved

**Incomplete.** Diffing all fifteen `*.card.json` against `run-20260809T040659Z` shows two further
movements on **every** card:

```
source_files[].sha  0522faf1586dbb544473067dcd92185b8b5d1228 -> 4a48450ce3d489c4354fd5b61455241a1203a092
source_files[]      + { path: "validation/certification/lib/collect.mjs",
                        sha256: "62389a1377c4f3e742c87c17069a4d839ae868e17f152ccef3cb567585e66e37" }
```

**Neither is C50's.** Both come from ancestor commits on `main` — `4a48450` ("pin `lib/collect.mjs`
on all fifteen cards") and its follow-on `07a0a54` — and the prior re-score `run-20260809T040659Z`
was emitted at `563bfee`, which `git merge-base --is-ancestor` confirms is an ancestor of `4a48450`.
**So the card definitions themselves changed between the two re-scores, independently of this
branch.** The claim should have been scoped to *what C50 moved* and instead read as *what moved*.

**Corrected, and registered as the accounting rule this branch got wrong:** a re-score diff against
the previous re-score is not a diff of this branch's effect unless the two share a card freeze.
**C50's own effect on the fifteen cards is exactly one field —
`shape_ecdf_accumulator.card.json`'s `generated_from.runs` — plus `COVERAGE.md`'s header sha.
Every tuple is unchanged (0 of 15 moved), which is what K6A.7.7 predicted and what stands.** The
inherited pin movements change no tuple either, and `cert:expiry` reads all cards current.

### F6 — the probe scripts are committed

K6A.7.3, K6A.7.4 and K6A.7.8 quote figures from two scripts that existed only in a task scratch
directory. **Registered and committed: `validation/coverage/tools/`**, with a `README.md` stating
that its contents are **probe provenance, not harnesses** — nothing there writes a run directory,
emits a cell, or is read by `validation/certification/lib/collect.mjs`.

| script | figures |
|---|---|
| `overlap-screen.mjs` | K6A.7.3's overlap cost and F2's four-layout table, i.i.d. substrate, paired |
| `placement-probe.mjs` | K6A.7.4's B-DOF, K6A.7.8's 12-seed bands and the front/back/strided/block arms |

Both are made path-portable in the same commit (they carried this author's absolute scratch paths)
and both resolve clustersynth through the harness's own `git rev-parse --git-common-dir` form, so
they run inside a worktree. The `README.md` binds the seed discipline: probe bases `>= 6e8`,
registered seeds `<= 1e8`, and **no probe may be run on a registered scenario seed in a layout whose
endpoint has not been read** — the rule K6A.7.8 depended on when it withheld the strided arm from
seed `20260855`.

### What this append does not change

`run-t2-20260809T075607Z`'s stop condition (`t2_pooled_lower_95 = 0.007528`, cleared), its `8/120`
`gpu_temp_c` crossings, the same-eight-shards result, H_substrate holding and H_placement refuted,
the two recorded deviations (`power_w` and pooled increment), the contiguity answer of §4 — which F4
strengthens rather than weakens — all fifteen card tuples, every `COVERAGE.md` row, and the T1 arm.
The four wiki write-back obligations of K6A.7.11 stand, and **F2 adds a fifth: the ratified page's
"strided sample" is granularity-ambiguous, and the block-granularity reading is the one that keeps
the exact null.**

### F5 addendum, 2026-08-09 — two field labels in F5 above, one of them wrong

F5 lists the two per-card movements as `source_files[].sha` and `source_files[]`. **Checked against
the committed JSON: the first label is wrong.** The sha that moved is
**`card.engine_pin.sha`**, not a `source_files` entry:

```
card.engine_pin.sha        0522faf1586dbb544473067dcd92185b8b5d1228 -> 4a48450ce3d489c4354fd5b61455241a1203a092
card.source_files[]        gained index [4] = validation/certification/lib/collect.mjs
                           (sha256 62389a1377c4f3e742c87c17069a4d839ae868e17f152ccef3cb567585e66e37)
```

**Two fields, and `source_files[]` entries carry `sha256` rather than `sha`** — so `source_files[].sha`
names nothing that exists on these cards. F5's substance is untouched: two per-card movements, both
inherited, neither C50's, and no tuple moves.

**And the provenance sentence is corrected.** F5 says the prior re-score was *"emitted at
`563bfee`"*, which conflates two shas. `563bfee` is the commit that **committed** that run
directory; the run's own `manifest.json` records `git_sha:
e62af91be3af27c952216dc1181e6082cc0d0cf9`, so `e62af91` is the engine sha it was **produced at**.
**The ancestry argument holds under either, and both are checked:** `git merge-base --is-ancestor`
confirms `e62af91` and `563bfee` are each ancestors of `4a48450`, so the card definitions the prior
re-score read predate the `collect.mjs` pin however the sha is named.

---

## Erratum v1.4 — 2026-08-09 (post-run, discloses, changes nothing): `family_E_conformal_heldout` stamps `params: 'oracle'`, and Erratum v1.3 named the class without naming these rows

WORKLIST `C47` item (2). This is an **erratum, not an amendment**: it postdates every run it
describes, so it cannot register anything. It **changes no endpoint, no floor, no threshold, no
seed, no grid, no falsifier, and no verdict.** Nothing in §1–14, any Amendment, or Erratum v1.3 is
superseded. No cell is edited and no run is re-run — the disclosure is the correction (§11 rule 6).

### The mis-stamped field, quoted

Every row this battery emits for `family_E_conformal_heldout` carries

```
params: 'oracle'
```

reached through the `else` branch of two ternaries, both of which enumerate the calibrated
candidates by name and omit this one:

| site | expression | rows it stamps |
|---|---|---|
| `harness/run-battery.mjs:1364` | `params: (detId === 'point_tail_bet_e_value' \|\| shapeSpecOf(detId) !== null) ? 'heldout-empirical' : 'oracle'` | the K4 fault cells 18, 19, 20, 21 |
| `harness/run-battery.mjs:1572` | `params: (pointKind \|\| shapeKind) ? 'heldout-empirical' : 'oracle'` | arm 31's healthy (S2) row |
| `harness/run-battery.mjs:1631` | same expression | arm 31's power (S3) row |

### The true provenance, at the lines

`family_E_conformal_heldout` takes **neither** §4's passed oracle constants **nor** the
calibration-window estimation Erratum v1.3 found in the other three detectors. Its nuisance route
is a fixed `Σ = [[1]]` (A2) plus an **empirical held-out calibration set**: `HELDOUT_ROWS = 10,000`
rows drawn at `HELDOUT_SEED = CELL_SEED + HELDOUT_OFFSET` (§6's K4 block, A7's T1 substrate),
turned into the detector's parameters by `stampHeldoutFamilyE`
(`tools/stamp-heldout-family-e.mjs`, wrapped at `run-battery.mjs:974`) and threaded into the read
at `run-battery.mjs:1324` (fault cells) and `:1482` (the arm). **The same rows that mis-name the
provenance record it correctly two fields later:** `heldout_seed` and `heldout_rows`
(`:1380-1381`, `:1660-1664`).

**The accurate literal already exists and is already registered — for three sibling candidates and
not for this one.** `'heldout-empirical'` is registered at **K4.1.5** for
`point_tail_bet_e_value` ("stamps its own accurate literal rather than reusing `'oracle'`
(Erratum v1.3's defect class)"), at **K6.9** for `shape_block_conformal_bet`, and at **K6A.1.10**
for `shape_ecdf_accumulator`. Each of those three registrations cites Erratum v1.3's defect class
as its reason. `family_E_conformal_heldout` — the candidate v1.3 actually singled out — never got
one.

### Where the correct calibration route is registered

1. **A2** — the fixed `Σ = [[1]]` construction and its per-tick wealth reading.
2. **§6's K4 block** and **A7** — the held-out stream: `HELDOUT_ROWS`, `HELDOUT_OFFSET`, and the
   T1 substrate the rows are drawn from.
3. **Amendment v2.K4, K4.4** — the identical held-out stream reused by `point_tail_bet_e_value`,
   "drawn once here, so both candidates calibrate from the same rows".
4. **Erratum v1.3's own "Scope — what stays valid", item 2**, quoted verbatim:

   > `family_E_conformal_heldout` is neither: it uses a fixed `Σ = [[1]]` (A2) with an empirical
   > held-out calibration set (§6's K4 block, A7's T1 substrate).

### Quote-and-correct against Erratum v1.3, which had the provenance right and the scope short

v1.3, "Scope — which cells", quoted:

> Every cell scored by `safe_t`, `universal_inference`, or `group_average_e_value`: all of K1, K2,
> K3, K5, K6, `safe_t`'s A6 rows on K4, and A1's arm 30. The `params: 'oracle'` stamp on those rows
> is wrong and is **left as committed** (results are append-only, §11 rule 6); this erratum is the
> correction.

**That list is correct for the defect v1.3 was describing** — parameters estimated from the
100-tick calibration window while stamped oracle. **What it does not say is that
`family_E_conformal_heldout`'s own rows carry the same wrong literal for a third reason.** v1.3
classified this candidate as "neither" in a *stays-valid* section and stopped there, so the reader
is left with the stamp unchallenged on those rows. **Correct: the stamp is wrong on
`family_E_conformal_heldout`'s rows too, and the accurate literal for them is
`'heldout-empirical'`** — the same literal the three siblings were given, for the same reason.

### Scope — which rows, enumerated

**Six rows per affected run, not one.** Cells 18, 19, 20, 21 (the K4 fault rows) plus arm 31's
`healthy` and `power` rows. Three live runs carry them:

| run | rows | manifest `git_sha` |
|---|---|---|
| `results/live/run-20260808T010208Z` | 18, 19, 20, 21, arm 31 healthy, arm 31 power | `5ae5076` |
| `results/live/run-20260808T064039Z` | the same six | `43f3386` |
| `results/live/run-20260808T133859Z` | the same six | `ef58647` |

**18 rows total.** Two of those three REPORTs already carried a one-line note that *"Arm 31 stamps
`params: 'oracle'`"* (`run-20260808T064039Z` §5, `run-20260808T133859Z` §7). **Those notes
understate the scope by four rows each**, and the dated appends this erratum files into all three
REPORTs correct that.

### What stays valid, and why "changes nothing" is checkable rather than asserted

1. **The endpoint numbers are unaffected as measured quantities.** Each row's rate is what the
   named detector did to the named data at the registered seeds; how it obtained its nuisance
   parameters does not change what it did.
2. **No verdict reads this field on these rows.** `params` reaches the certification scorer only
   through `phiIsEstimated` (`validation/certification/lib/nulls.mjs`), which tests
   `cell.phi_source` first and then the single literal `params === 'estimated-phi'`. All six rows
   carry `null_id` `N1` or `N3-p06`, so `annotatePhi` (`lib/collect.mjs:16-27`) annotates
   `phi_source: 'oracle'` and the `params` value is never consulted; `annotatePhi` also only fills
   `params` when it is absent, so it never overwrites the wrong literal with a right one.
   `params` appears **zero** times in `validation/certification/lib/score.mjs`. So the mis-stamp
   is inert to the mechanical verdict — it misleads a **reader**, which is why the correction is a
   disclosure and not a re-score.
3. **The `phi_known` question of v1.3 item 4 is untouched** and stays open as WORKLIST `C43`.

### Named-not-done

- **The harness is NOT changed.** Emitting `'heldout-empirical'` for this candidate on future runs
  would change a registered field's value, and on the three sibling candidates that took a
  registration each (K4.1.5, K6.9, K6A.1.10). This erratum cannot register it — an erratum
  registers nothing. **The forward fix requires its own amendment**, and until one exists the stamp
  on future runs will still read `'oracle'`. Named here so the gap is a stated boundary rather
  than a silence.
- **C47 item (1)** — the O(1/n)-approximate, mildly anti-conservative conformal exchangeability
  identity (K4.1.10) — is untouched by this erratum and remains open.

---

## Amendment v2.C38.1 — 2026-08-09, before the emission exists: `mean_e_lower_95` on this battery's terminal-class S2 rows, and a WORKLIST claim corrected at HEAD

WORKLIST `C38` item (1). Sections §1–14 and every prior Amendment and Erratum stay intact; this
amendment **adds two fields to one row shape** and moves no endpoint, floor, threshold, seed, grid,
falsifier or verdict. Registered **before** the harness change it authorizes, and **no run is
re-run**: the fields appear on the next run that touches these rows.

### C38.1.1 LEAD WITH THE CORRECTION — "no run anywhere in the repo records that field" is FALSE at HEAD

The WORKLIST row reads:

> safe-t's frozen falsifier names `mean_e_lower_95`, a one-sided lower bound on the mean, and no
> run anywhere in the repo records that field — the scorer falls back to testing the point estimate.

**Measured over the corpus `validation/certification/lib/collect.mjs`'s `loadEvidence` actually
returns, at this commit: 54 cells record it.** Census, by card and by run, counting cells that carry
either terminal instrument (`mean_e` or `exceedance`):

| card | validity-candidate cells | of which carry `mean_e_lower_95` |
|---|---|---|
| `safe_t_e_value` | 47 | **27** — `2026-08-terminal-evalue/run-20260807T215034Z` (20/20), `2026-08-phi-identifiability/run-20260807T215105Z` (7/7); `2026-08-terminal-evalue/run-20260802T041353Z` 0/20 |
| `universal_inference_e_value` | 77 | **27** — the same two runs at 20/20 and 7/7; `run-20260802T041353Z` 0/20, `clustersynth-ui` 0/30 |
| `family_E_conformal_heldout` | 1 | 0 |
| `point_tail_bet_e_value` | 1 | 0 |
| `group_average_e_value` | 1 | 0 |
| `family_E_conformal` | 0 | — |

The field was registered by `validation/terminal-evalue/POWER-PER-CELL-ADDENDUM-2026-08-07.md`
change (a) and emitted at `validation/terminal-evalue/harness/run.mjs:116`
(`mean_e: mean, mean_e_sd: sd, mean_e_lower_95: meanLo`). `validation/certification/README.md`'s
"Which run is current" section already describes what it did and did not fire on. **So safe-t's
frozen falsifier is evaluable today, on 27 of its 47 candidate cells.**

**The residue the row is right about, restated exactly: THIS battery records neither field on any
of its terminal-class S2 rows.** Three such rows exist in the corpus, and all three are
scored on the point estimate:

| run | card | `exceedance` | `mean_e` | recorded token |
|---|---|---|---|---|
| `run-20260808T133859Z` | `family_E_conformal_heldout` | `0.0455` | **`4.175984181731008`** | `not-refuted` |
| `run-20260808T133859Z` | `point_tail_bet_e_value` | `0.001855` | `0.5275562291180412` | `not-refuted` |
| `run-20260808T201635Z` | `group_average_e_value` | `0.0005` | **`1.9140717432761356`** | `not-refuted` |

Two of the three carry `mean_e` above `TERMINAL_MEAN_BOUND = 1`, so
`meanRule` (`validation/certification/lib/guards.mjs`) already overrides their recorded
`not-refuted` to REFUTED on the point estimate — **those are the two historical mean-rule
overrides, and this amendment recomputes nothing about them** (see C38.1.5).

### C38.1.2 The emission, registered: which rows, and the exact estimator

**WHICH ROWS.** The S2 (`arm: 'healthy'`) row of any A1 arm whose emission takes the
**terminal instrument pair** branch — the `else` of the ternary at
`harness/run-battery.mjs:1585-1592`, which emits `exceedance` and `mean_e`, the pair
`CLASS_INSTRUMENTS.terminal_e_value` registers (`validation/certification/lib/constants.mjs:11`).
At this commit that is exactly three arms: **30** (`group_average_e_value`, `kind: 'terminal'`),
**31** (`family_E_conformal_heldout`, `kind: 'process'`) and **32** (`point_tail_bet_e_value`,
`kind: 'point'`). The scoping is the branch, not a detector-id list, so a future terminal-class arm
inherits it without a further amendment. `spectral_bet_e_process` and the two shape detectors take
the other branch (K3.1.1/K3.1.2, K6.7) and are **excluded**: they carry no `mean_e` and this field
would be meaningless on them.

**THE ESTIMATOR.** Transcribed from the addendum that owns the field name, so one field name cannot
mean two things across two studies
(`validation/terminal-evalue/POWER-PER-CELL-ADDENDUM-2026-08-07.md`, change (a)):

```
n     = the count of finite reads in the row's own sample   (the sample mean_e is the mean of)
mu    = mean_e
s^2   = sum (e_i - mu)^2 / (n - 1)                          (sample variance, n-1 denominator)
lower = max(0, mu - 1.645 * s / sqrt(n))                    -> mean_e_lower_95
```

`NaN` when `n < 2`. `z = 1.645` is the constant `lower95(k, n)`
(`harness/run-battery.mjs:1086-1090`) already uses for the exceedance bound on the same row, so
both intervals on a row use one quantile. **`mean_e_sd` (`s`) is registered alongside it**, for the
addendum's own stated reason — the bound cannot be read without the spread that produced it, and
recording both makes the bound recomputable by a reader from `mean_e`, `mean_e_sd` and `n` without
a re-run.

**WHICH SAMPLE, per adapter kind.** The sample is always the one `mean_e` on that row is already
the mean of — this amendment introduces no second sample:

| kind | arm | the sample | `n` field on the row |
|---|---|---|---|
| `terminal` | 30 | the per-trajectory terminal e-values, `acc.es` | `n` (`healthy.finite`) |
| `process` | 31 | the per-trajectory final wealth `M_T`, `acc.es` | `n` (`healthy.finite`) |
| `point` | 32 | the per-POINT e-values across the whole post-onset window (K4.1.4's per-point row) | `n_points` (`healthy.pointFinite`) |

**CONSISTENCY WITH `lower95_one_sided`, and the ONE difference, stated because it is a real
difference.** `summarise` (`harness/run-battery.mjs:1101-1108`, K3.1.1's verbatim copy) computes
`lower95_one_sided = mean - 1.645 * se` with the same `n-1` variance and the same `z`. It is
**unclamped**; `mean_e_lower_95` is **clamped at 0**. The clamp is part of the field's own
registered estimator (`e >= 0`, and it can only lower the bound, so it can never make a falsifier
fire), and it is kept rather than dropped so that a `mean_e_lower_95` emitted by this battery and
one emitted by `terminal-evalue` are the same statistic. On the terminal path the relation is
therefore exactly `mean_e_lower_95 === max(0, summarise(sample).lower95_one_sided)`, and Amendment
v2.C39 registers that identity as a checked invariant.

**NUMERICAL NOTE, disclosed.** On the `terminal`/`process` path the whole sample is in memory
(`acc.es`), so `s` is the two-pass sample sd. On the `point` path only running aggregates are kept
(`pointSumE`, `pointFinite`), so `s` is accumulated by **Welford** in `record()`. `mean_e` itself
is **unchanged, bit-for-bit**: it stays `pointSumE / pointFinite`, and Welford's running mean is
used only for the variance. The two means agree to floating-point rounding and the recorded `mean_e`
remains the one a reader recomputes from.

### C38.1.3 What this changes in the scorer: nothing, and the direction is checked

`mean_e_lower_95` is read at exactly one site, `meanRule`
(`validation/certification/lib/guards.mjs`), and that rule is **refusal-only**. Its FIX 1 form
tests the recorded bound and the point estimate **independently**, and neither branch can clear:

- recorded bound `> 1` → override to REFUTED;
- otherwise point estimate `mean_e > 1` → override to REFUTED, with the recorded bound named as
  *uninformative, not exculpatory*.

So emitting the field on a row **can only add refutations, never remove one**. It is not an
instrument under `CLASS_INSTRUMENTS`, so `applyGuards` cannot read it as a foreign instrument and
no cell can be VOIDed by its presence. `isValidityCell` (`lib/score.mjs:11`) already admits these
rows on `exceedance`/`mean_e`, so candidacy does not move either.

### C38.1.4 When the falsifier becomes evaluable, stated plainly

**On this battery's rows it is NOT evaluable now and will not be until a run emits it.** The three
rows above stay exactly as committed. The next `run-battery.mjs` run that scores a terminal-class
arm — any run of classes K2 or K4, or of arms 30/31/32 — will carry `mean_e_sd` and
`mean_e_lower_95`, and safe-t's frozen falsifier clause *"one-sided 95% lower bound of mean(e) > 1"*
becomes literally evaluable on that row at that point. **No such run is authorized by this
amendment and none is performed with it.**

### C38.1.5 Named-not-done

1. **No rerun.** The three existing rows are not re-measured. The bound is **not recoverable** from
   them: only the sample mean was recorded, so `s` cannot be reconstructed without re-running.
2. **The two historical mean-rule overrides are not recomputed** (`group_average_e_value`,
   `family_E_conformal_heldout`). Re-examining them requires reruns, which are out of scope here.
3. **`safe_t`'s own coverage rows are untouched.** Its A6 rows on K2/K4 are fault (S3) rows carrying
   `detection_rate`, not S2 rows carrying `mean_e`, so no field of theirs moves.
4. **WORKLIST `C38` items (2)–(6) are untouched** and each stays open independently.
5. **The WORKLIST row itself is not edited** — the wiki is not this repository's to correct; the
   census in C38.1.1 is filed for write-back.

### C38.1.6 Registered code and test items

| # | item | site |
|---|---|---|
| 1 | Welford `pointM2`/`pointMeanW` accumulators, updated beside the existing `pointFinite`/`pointSumE` and never replacing them | `harness/run-battery.mjs` `freshAcc` + `record` (`point` branch) |
| 2 | `mean_e_sd` and `mean_e_lower_95` on the terminal-instrument S2 branch, per-kind sample as tabled | `harness/run-battery.mjs` S2 emission |
| 3 | the estimator as one helper (`meanLower95`), so the clamp and the `z` exist once | `harness/run-battery.mjs` |
| 4 | test: the two fields are present on a terminal-class S2 row and absent from spectral/shape S2 rows | `test/run-battery.test.mjs` |
| 5 | test: `mean_e_lower_95 === max(0, mu - 1.645*s/sqrt(n))` recomputed from the row's own `mean_e`, `mean_e_sd` and `n` — **mutation kill: drop the clamp, or move `z` to `1.96`, and the test fails** | `test/run-battery.test.mjs` |
| 6 | test: `n < 2` gives `NaN`, not a number | `test/run-battery.test.mjs` |

### C38.1.7 DISCLOSURE — this change EXPIRES one card, and the card is deliberately NOT re-frozen

`validation/certification/cards/shape_ecdf_accumulator.json` pins
`validation/coverage/harness/run-battery.mjs` in its `source_files[]` expiry surface (the only card
that does). So the moment the harness changes, `npm run cert:expiry` reports

```
EXPIRED shape_ecdf_accumulator: validation/coverage/harness/run-battery.mjs (changed)
```

**That is the mechanism working, not a defect**, and it is disclosed here rather than discovered by
the next reader of CI. Three facts about it:

1. **No claim, endpoint or verdict of that card moves.** The change adds two fields to a row shape
   that card does not read: `shape_ecdf_accumulator`'s arm-47 S2 row takes the `crossing_rate`
   branch (K6.7/K6A.1.10), so it gains neither field. Verified by a paired smoke run at the same
   seeds: **0 pre-existing fields changed on any of the 66 emitted rows, 2 new fields added**, and
   the new fields appear on 3 rows and no others.
2. **The card is NOT re-frozen by this amendment.** `validation/certification/tools/freeze-cards.mjs`
   has no per-card mode — it restamps `engine_pin.sha` on **all 15 cards** — and a re-freeze riding
   silently inside an unrelated commit is the exact defect **K6A.5.3** disclosed and this document
   refuses to repeat. A freeze is a deliberate act with its own row in
   `validation/certification/README.md`'s freeze table.
3. **The expiry check is a reported, non-gating CI step** (`validation/certification/README.md`,
   `CERT_SIBLING_ROOT` section), so the EXPIRED status blocks nothing and hides nothing. It stands
   until a freeze is taken as its own decision.

### C38.1.8 House rules, mapped

(1) **Committed before the code**: this section commits in the commit that precedes the harness
change, and no run of the changed harness exists. (2) No endpoint or threshold moves, so nothing
can move under a reading. (3) The census in C38.1.1 is a **corpus count, not a post-hoc analysis of
a candidate endpoint** — it reads which cells carry a field, no rate and no verdict.
(4) The fallback rule (§9) is untouched; a `NaN` bound at `n < 2` is the field's own registered
absence, not a fallback. (5) No new substrate. (6) `results/` untouched — **no run is written, and
none of the three existing rows is edited.** (7) No rerun. (8) Binding on the report of the next
run that emits these fields: it must state both numbers with the row's `n`. **And the card expiry of
C38.1.7 is part of the record, not a side effect left unstated.**

### Amendment summary

**Registers `mean_e_sd` and `mean_e_lower_95` on this battery's terminal-instrument S2 rows**
(arms 30, 31, 32 at this commit; the scoping is the `exceedance`/`mean_e` branch, so a future
terminal-class arm inherits it), with the estimator transcribed verbatim from the addendum that
owns the field name — `max(0, mu - 1.645*s/sqrt(n))`, `n-1` variance, `NaN` at `n < 2`, clamped
where `summarise`'s `lower95_one_sided` is not, and the clamp kept so the field means one thing
across studies. **And corrects the WORKLIST claim it is filed against:** "no run anywhere in the
repo records that field" is **false at HEAD — 54 cells record it**, on
`terminal-evalue/run-20260807T215034Z` and `phi-identifiability/run-20260807T215105Z`, so safe-t's
frozen falsifier is already evaluable on 27 of its 47 candidate cells. The residue is real and is
this battery's alone: **0 of its 3 terminal-class S2 rows carry the bound**, and two of those three
already refute on the point estimate at `mean_e` `4.176` and `1.914`. **Nothing is re-run and
nothing is recomputed** — the bound is not recoverable from a recorded mean, so it becomes evaluable
on this battery only on the next run that touches these rows, which this amendment does not
authorize.

---

## Amendment v2.C39 — 2026-08-09, before the emission exists: the increment estimator becomes the terminal class's REPORTED mean instrument, with no verdict authority and a mandatory across-draw caveat

WORKLIST `C39`. Sections §1–14 and every prior Amendment and Erratum stay intact; this amendment
**adds one field to one row shape** and moves no endpoint, floor, threshold, seed, grid, falsifier or
verdict. Registered **before** the harness change it authorizes; **no run is re-run**.

### C39.1 What is missing, and what already exists

The WORKLIST row reads:

> No `terminal_e_value` card computes an increment-style reading; `TERMINAL_MEAN_BOUND` gates only
> on the raw 300-tick sample mean, whose N=2000 behavior is exactly what
> `stats/terminal-mean-rule-contested` leaves unresolved. Build and pre-register (before use) either
> the increment estimator or a trimmed/bootstrap-lower-bound instrument for terminal cards.

**The instrument itself does not need building.** `summarise()`
(`harness/run-battery.mjs`, K3.1.1's verbatim copy of
`validation/detector-audit/harness/run-sequential.mjs:37-44`) already computes it, and three
`test_martingale`-class rows already carry it: cell 33 (K3.1.1), cell 34 (K6.7) and arm 47
(K6A.1.12). Amendment v2.K6A.7 K6A.7.5 registered the T2 counterpart's three pooling levels. **What
is missing is the registration of that instrument on the terminal class's row, and the caveat that
must travel with it.** This amendment supplies both and builds nothing new.

### C39.2 The instrument, registered: which rows, which sample, which shape

**WHICH ROWS.** The same rows Amendment v2.C38.1 scopes: the S2 (`arm: 'healthy'`) row of any A1
arm whose emission takes the **terminal instrument pair** branch (`exceedance` + `mean_e`,
`CLASS_INSTRUMENTS.terminal_e_value`, `validation/certification/lib/constants.mjs:11`). At this
commit: arms **30**, **31**, **32**. **Not** the S3 row, **not** any fault cell — K3.1.4's binding
exclusion is inherited unchanged and extended to this field by name.

**WHICH SAMPLE, and why "increment" is the right word for a terminal read.** A terminal e-value's
wealth path has **exactly one increment per replicate** — the terminal e itself, `M_T/M_0` — so the
increment sample and the terminal sample are the same numbers. There is nothing to choose:

| kind | arm | the sample | `n` |
|---|---|---|---|
| `terminal` | 30 | per-trajectory terminal e-values (`acc.es`) | `healthy.finite` |
| `process` | 31 | per-trajectory final wealth `M_T` (`acc.es`) | `healthy.finite` |
| `point` | 32 | the per-POINT e-values of K4.1.4's per-point row | `healthy.pointFinite` |

**This is the same sample `mean_e` is the mean of.** No second sample is introduced, and no
trimming, bootstrap or re-weighting is registered — the WORKLIST row's alternative
("trimmed/bootstrap-lower-bound instrument") is **NOT adopted**, because a bootstrap needs a new
seeded stream and would make the run non-reproducible from its recorded fields, where this estimator
is closed form and recomputable from `n`, `mean_e` and `mean_e_sd` alone.

**SHAPE.** `summarise()`'s object verbatim: `{ n, mean, sd, se, lower95_one_sided,
upper95_one_sided }`, `n-1` variance, `z = 1.645`. On the `terminal`/`process` path this is
`summarise(acc.es)` literally. On the `point` path the sample is not in memory, so the identical
algebra is applied to the running moments (`pointSumE`, and the Welford `pointM2` Amendment v2.C38.1
registered), through one helper whose only job is to be that algebra once.

**THE FIELD NAME IS `increment_estimator`, AND `increment_verdict` IS EXPLICITLY NOT EMITTED.**
`lib/score.mjs:182` routes a non-`test_martingale` cell that carries `increment_verdict` and no
class verdict into `missing[]` as *"foreign increment_verdict ignored"*. These rows carry their
class's own `verdict`, so that branch cannot fire — and it stays that way because **no verdict field
derived from this instrument is emitted, on any row, ever.**

### C39.3 NO VERDICT AUTHORITY — the mechanism, and the boundary named as out of scope

**The field is REPORTED. It decides nothing.** Three independent reasons it cannot, each checkable:

1. **The recorded token does not move.** The S2 `verdict` stays
   `s2Lower95 > ALPHA ? 'FAIL' : 'not-refuted'` — derived from the exceedance's own Wilson bound,
   exactly as it is today. This amendment does not touch that expression.
2. **The scorer treats it as annotation.** `applyGuards`
   (`validation/certification/lib/guards.mjs`) implements Finding 4: a foreign instrument present
   **alongside** the class's own instrument is *"annotation, not a veto"*. Quoted:

   > A foreign instrument present ALONGSIDE the class's own instrument is annotation, not a veto —
   > e.g. a sequential_ui_e_process (e_process) cell that carries increment_estimator
   > (test_martingale's instrument) next to its own crossing_rate scores by crossing_rate.

   These rows carry `exceedance` and `mean_e`, so `ownPresent.length > 0` and the VOID branch cannot
   be reached. The returned `{status: 'OK', reason}` string is **not read anywhere** in
   `lib/score.mjs` (only `'VOID'`, `'NON_FINITE'` and `'VACUOUS'` are branched on), so the field's
   presence has **no observable effect on any stage score**. `increment_estimator`'s own
   finiteness/vacuousness guards are gated `cls === 'test_martingale'` and do not apply here, and
   `internalConsistency` returns `[]` for every other class.
3. **`isValidityCell` already admits these rows** on `exceedance`/`mean_e` (`lib/score.mjs:11`), so
   candidacy does not move either.

**THE AUTHORITY PATTERN THIS FOLLOWS, cited rather than invented.** K3.1.3 (Critical) registered
exactly this arrangement for cell 33: the instrument is emitted *"precisely so this reading is
visible and auditable, not to let an infinite-variance Wald bound silently gate a fresh detector's
certification"*, while the verdict stays with the other instrument. K6.7 applied the same split to
cell 34. **This amendment is the third application of that pattern and adds nothing to it.**

**AND THE REPORTING RULE, transcribed from K3.1.3 clause 2.** If a future run reads
`increment_estimator.lower95_one_sided > 1` on a terminal-class S2 row, that reading is **filed as a
discrepancy to `~/concord/knowledge/stats/pages/terminal-mean-rule-contested.md`** — it is **not
scored**, and it does not move the card's S2 verdict.

**OUT OF SCOPE, NAMED.** Giving this field verdict authority on the terminal class means changing
`CLASS_INSTRUMENTS.terminal_e_value` and the S2 scoring path in
`validation/certification/lib/score.mjs`. **That is a certification-protocol change, not a battery
amendment**, and it is **explicitly not done here**. No protocol page is edited, no constant in
`lib/constants.mjs` moves, and this document has no authority to make that change.

### C39.4 THE ACROSS-DRAW CAVEAT — registered text, and it is mandatory

**Registered: no reading of `increment_estimator` on any row this battery emits may be reported
without the following caveat beside it.** This is not stylistic. WORKLIST `C51` recorded a category
error committed on this exact field, by this author's own filing, and the correction is measured:

> **CAVEAT (registered, v2.C39.4 — mandatory beside any `increment_estimator` reading).** This
> field's `se`, `lower95_one_sided` and `upper95_one_sided` are **within-draw** quantities: they
> describe the spread of the mean over trajectories **at one calibration draw**, and they are not
> the uncertainty on the class's answer. The spread that governs a reading's distance from its null
> is the **between-draw** spread, and on the one construction where both have been measured it is
> **9.3× larger**: `shape_ecdf_accumulator`'s registered single-draw reading was framed as
> **16.26 SE** above the exact null `0.991433` using the within-draw Wald SE **`0.00206`**, where
> the across-draw sd of the same field over 100 fresh calibration draws is **`0.01914`**
> (`results/live/run-acrossdraw-20260809T065107Z`, Amendment v2.K6A.6). The across-draw
> distribution is **centred on the exact null** (mean `0.989903` vs `0.991433`, `−0.80` SE) and the
> single-draw `1.024959` sits at its **97th percentile** — a tail draw, by the disposition rule
> registered before that run. Two further measured consequences: the registered range
> `[0.97, 1.01]` **false-fires on 32/100 draws from the calibration lottery alone**, and
> K6A.1.12's per-draw band `[0.985, 0.998]` for this field is **contradicted at 74/100**. So a
> within-draw interval on this field **cannot** be read as evidence about the class, and an
> apparent departure of many within-draw SEs is the expected appearance of a single draw.

**Scope of the caveat, stated exactly.** The `9.3×` and the two false-fire rates are measured on
**one construction** — `shape_ecdf_accumulator` at `κ = 0.682`, `m = 500`, `W = 150`. **The
across-draw spread of this field on the three terminal-class rows is UNMEASURED**, and the caveat
does not claim otherwise: what transfers is the **category** (within-draw SE is not between-draw
spread), which is a property of the single-draw-per-cell protocol and not of one κ. The ratio on the
terminal rows could be larger or smaller and nothing here predicts it.

### C39.5 The invariants against Amendment v2.C38.1's fields, and the one boundary where they part

On every terminal-instrument S2 row with `n >= 2`, registered as **checked** rather than asserted:

```
increment_estimator.n                      === n  (n_points on the K4.1.4 per-point row)
increment_estimator.mean                   === mean_e
increment_estimator.sd                     === mean_e_sd
max(0, increment_estimator.lower95_one_sided) === mean_e_lower_95
```

The fourth line is an identity with a `max`, not an equality, and the reason is registered at
C38.1.2: `mean_e_lower_95` is **clamped at 0** because the addendum that owns that field name
clamps it; `summarise`'s `lower95_one_sided` is **unclamped** because K3.1.1 does not clamp. **Each
field keeps its own owner's convention** so one field name never means two statistics across two
studies, and the relation between them is registered here instead of being left for a reader to
guess.

**THE ONE BOUNDARY: `n < 2`.** `summarise` returns `sd: 0` with a zero-width interval at `n <= 1`
(its `varr = 0` branch); the addendum's rule for `mean_e_sd`/`mean_e_lower_95` is `NaN`. **So at
`n < 2` the three fields disagree by construction, and that is registered rather than smoothed
over:** `increment_estimator` follows K3.1.1, `mean_e_sd`/`mean_e_lower_95` follow the addendum.
Every registered run of this battery is at `N = 2000`, so the boundary is reachable only on a smoke
run — where a test pins it, so it cannot drift unnoticed.

### C39.6 Named-not-done

1. **The two historical mean-rule overrides get NOTHING recomputed.**
   `group_average_e_value` (`mean_e 1.9140717432761356`, `run-20260808T201635Z`) and
   `family_E_conformal_heldout` (`mean_e 4.175984181731008`, `run-20260808T133859Z`) were overridden
   to REFUTED on the point estimate. Their increment estimators are **not recoverable** from what
   was recorded — only the sample mean exists — so re-examining them **requires reruns**, and no
   rerun is performed or authorized here.
2. **No verdict authority transfer.** C39.3's boundary: a protocol change, out of scope.
3. **No trimmed or bootstrap instrument.** C39.2: considered and not adopted, with the reason.
4. **The across-draw spread of this field on the terminal rows is unmeasured.** C39.4's scope
   clause. Measuring it is the terminal-class analogue of Amendment v2.K6A.6 and is not attempted.
5. **`safe_t_e_value`'s and `universal_inference_e_value`'s rows are untouched** — this battery
   emits no terminal-class S2 row for either (their coverage rows are fault/S3 rows), so the field
   appears for them only if `terminal-evalue`'s own harness registers it, which this amendment does
   not do.
6. **The card expiry of C38.1.7 applies unchanged** and no card is re-frozen.

### C39.7 Registered code and test items

| # | item | site |
|---|---|---|
| 1 | `summariseFromMoments(n, mean, varr)` — `summarise()`'s own tail algebra, for the point path where the sample is not held | `harness/run-battery.mjs` |
| 2 | `increment_estimator` on the terminal-instrument S2 branch, per-kind sample as tabled | `harness/run-battery.mjs` S2 emission |
| 3 | test: the field is present on all three terminal-class S2 rows and absent from their S3 rows and from every fault cell | `test/run-battery.test.mjs` |
| 4 | test: the four C39.5 invariants hold on every terminal-class S2 row at `n >= 2` — **mutation kill: feed the estimator a different sample (e.g. the per-trajectory `es` on the point row) and the `n`/`mean`/`sd` identities fail** | `test/run-battery.test.mjs` |
| 5 | test: the `n < 2` boundary of C39.5 is exactly as registered (`sd: 0` and a zero-width interval beside a `null` `mean_e_sd`) | `test/run-battery.test.mjs` |
| 6 | test: no row of any kind carries `increment_verdict` | `test/run-battery.test.mjs` |

### C39.8 House rules, mapped

(1) **Committed before the code.** (2) No endpoint or threshold moves. (3) The two `mean_e` figures
quoted in C39.6 are **already-published readings of already-scored rows**, quoted to say what is
*not* being recomputed — no new analysis of any candidate endpoint. (4) §9's fallback untouched.
(5) No new substrate. (6) `results/` untouched; **no run written, no row edited.** (7) No rerun.
(8) Binding on the next report that emits this field: it must state the estimator's `n`, `mean`,
`sd` and one-sided bound **and carry C39.4's caveat verbatim**.

### Amendment summary

**Registers `increment_estimator` — `summarise()`'s object, unchanged — on this battery's
terminal-instrument S2 rows, as a REPORTED instrument with no verdict authority.** The instrument
needed no building: K3.1.1's `summarise()` already computes it and three `test_martingale` rows
already carry it; what was missing was its registration on the terminal row and the caveat that must
travel with it. For a terminal e-value the wealth path has exactly one increment per replicate, so
the increment sample **is** the sample `mean_e` is the mean of — no second sample, no bootstrap
(rejected: it would break recomputability from the recorded fields). **Authority does not move, on
three independently checkable grounds:** the S2 token stays exceedance-derived, `applyGuards`
Finding 4 treats a foreign instrument beside the class's own as *"annotation, not a veto"* and its
`OK` reason string is read nowhere in `lib/score.mjs`, and `isValidityCell` already admitted these
rows. **This is K3.1.3/K6.7's pattern applied a third time**, including its reporting rule: a
`lower95_one_sided > 1` reading is filed to `stats/terminal-mean-rule-contested`, not scored.
**Transferring verdict authority is a certification-protocol change and is explicitly out of scope.**
**And C39.4 registers a MANDATORY caveat** — no reading of this field may be reported without it —
built on the C51 category error measured on this exact field: a **16.26-SE** framing that used the
**within-draw** Wald SE `0.00206` where the **between-draw** sd is `0.01914`, **9.3× larger**, with
the across-draw distribution centred on the exact null and the registered single-draw reading at its
97th percentile. The caveat's numbers are scoped to the one construction they were measured on and
the terminal rows' own across-draw spread is named unmeasured. **The two historical mean-rule
overrides are not recomputed** — their increment estimators are unrecoverable from a recorded mean,
so re-examination needs reruns, and none is performed.
