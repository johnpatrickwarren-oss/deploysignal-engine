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
= 0.1` (`:66`). BINS_K3 avoids both `{0, W/2} = {0, 15}` by construction — the module's own header
comment names this explicitly (`:57-66`'s doc block, "Neither touches {0, W/2}").

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
  cells: a trajectory is detected iff `spectralBetWealth`'s `log[]` array (`spectral-bet-e-process.ts:118-125`,
  the cumulative log-wealth at each window index) satisfies `wealth >= 20`
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
(`spectral-bet-e-process.ts:118-125`) for the any-prefix crossing check (`log[i] >= Math.log(20)`
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
`advanceLogWealth` (`detectors/_wealth.ts:31`, `Math.max(logFloor, next)`) only once the running
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
