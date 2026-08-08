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
