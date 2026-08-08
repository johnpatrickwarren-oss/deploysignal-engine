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
