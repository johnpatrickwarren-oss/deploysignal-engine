# Coverage battery `run-20260808T010208Z` — study report

The registered report for this run, per PREREGISTRATION.md §11 rule 8 (every endpoint's number
and verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at `0d05e02`
are unmodified, and no number below was recomputed from a new run of the battery. Every rate and
verdict in §1 is transcribed from the committed `summary.json` beside this file.

| field | value |
|---|---|
| run id | `run-20260808T010208Z` |
| mode | `live`, N=2000, T=300, onset=100, alpha=0.05 |
| invocation | `node validation/coverage/harness/run-battery.mjs`, one invocation, all six classes |
| `git_sha` at run | `5ae50765a3d44ade3bc9dc4cc7dce4b5ea8a52a6` |
| `engine_pin` | `0.6.6-pre` |
| `substrate_sha256` | `0d25265f6af237e94b79cc8a09c0e5d11f6033da3e9581eddfce02efca349edf` (`validation/coverage/lib/inject.mjs`) |
| tier | T1 (A7's registered fallback) |
| rows emitted | 66 (62 fault-class + 4 A1 arm) |
| guard state | cells with `non_finite_wealth > 0`: 0. With `adapter_failures > 0`: 0. With `NOT-EXECUTABLE`: 0. |

Written 2026-08-08, after the run. The class-by-class narrative analysis lives in the Task 9
session artifact, which this repository does not track (see §2's provenance note); this file is
the in-repo record of the endpoints, the K4 materiality rule, the post-hoc observations, and two
errata.

## 1. The endpoint table — every `(class, detector)` cell

`COVERAGE_FLOOR = 0.50` applies at the φ=0 canonical cell only (§8, §10.1). Grid and `-ar1`
cells are recorded context and decide nothing. `POWERED`/`INERT` is the per-cell verdict
`run-battery.mjs` emitted against that floor; the class-level answer is `verdict.mjs`'s and
lives in `validation/certification/results/run-20260808T014809Z/COVERAGE.md`.

| idx | class | severity | canonical | φ | detector | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 0 | K1 | `0.75sigma` | no | 0 | `safe_t` | 1967/2000 | 0.9835 | POWERED |
| 0 | K1 | `0.75sigma` | no | 0 | `universal_inference` | 1308/2000 | 0.6540 | POWERED |
| 1 | K1 | `1.5sigma` | **yes** | 0 | `safe_t` | 2000/2000 | 1.0000 | POWERED |
| 1 | K1 | `1.5sigma` | **yes** | 0 | `universal_inference` | 1975/2000 | 0.9875 | POWERED |
| 2 | K1 | `3sigma` | no | 0 | `safe_t` | 2000/2000 | 1.0000 | POWERED |
| 2 | K1 | `3sigma` | no | 0 | `universal_inference` | 2000/2000 | 1.0000 | POWERED |
| 3 | K1 | `1.5sigma-ar1` | no | 0.6 | `safe_t` | 1984/2000 | 0.9920 | POWERED |
| 3 | K1 | `1.5sigma-ar1` | no | 0.6 | `universal_inference` | 1000/2000 | 0.5000 | POWERED |
| 4 | K2 | `K5-e0.25sigma` | no | 0 | `group_average_e_value` | 235/2000 | 0.1175 | INERT |
| 4 | K2 | `K5-e0.25sigma` | no | 0 | `safe_t` | 105/2000 | 0.0525 | INERT |
| 5 | K2 | `K5-e0.5sigma` | no | 0 | `group_average_e_value` | 1946/2000 | 0.9730 | POWERED |
| 5 | K2 | `K5-e0.5sigma` | no | 0 | `safe_t` | 1234/2000 | 0.6170 | POWERED |
| 6 | K2 | `K10-e0.25sigma` | no | 0 | `group_average_e_value` | 366/2000 | 0.1830 | INERT |
| 6 | K2 | `K10-e0.25sigma` | no | 0 | `safe_t` | 129/2000 | 0.0645 | INERT |
| 7 | K2 | `K10-e0.5sigma` | **yes** | 0 | `group_average_e_value` | 1997/2000 | 0.9985 | POWERED |
| 7 | K2 | `K10-e0.5sigma` | **yes** | 0 | `safe_t` | 1221/2000 | 0.6105 | POWERED |
| 8 | K2 | `K10-e0.75sigma` | no | 0 | `group_average_e_value` | 2000/2000 | 1.0000 | POWERED |
| 8 | K2 | `K10-e0.75sigma` | no | 0 | `safe_t` | 1966/2000 | 0.9830 | POWERED |
| 9 | K2 | `K20-e0.25sigma` | no | 0 | `group_average_e_value` | 479/2000 | 0.2395 | INERT |
| 9 | K2 | `K20-e0.25sigma` | no | 0 | `safe_t` | 107/2000 | 0.0535 | INERT |
| 10 | K2 | `K20-e0.5sigma` | no | 0 | `group_average_e_value` | 2000/2000 | 1.0000 | POWERED |
| 10 | K2 | `K20-e0.5sigma` | no | 0 | `safe_t` | 1250/2000 | 0.6250 | POWERED |
| 11 | K2 | `K10-e0.5sigma-ar1` | no | 0.6 | `group_average_e_value` | 280/2000 | 0.1400 | INERT |
| 11 | K2 | `K10-e0.5sigma-ar1` | no | 0.6 | `safe_t` | 104/2000 | 0.0520 | INERT |
| 12 | K3 | `A0.5sigma-f0.02` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 12 | K3 | `A0.5sigma-f0.02` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 13 | K3 | `A0.5sigma-f0.05` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 13 | K3 | `A0.5sigma-f0.05` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 14 | K3 | `A0.75sigma-f0.02` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 14 | K3 | `A0.75sigma-f0.02` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `family_D_spectral_e_detector` | 0/2000 | 0.0000 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 15 | K3 | `A0.75sigma-f0.05` | **yes** | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 16 | K3 | `A0.75sigma-f0.1` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 16 | K3 | `A0.75sigma-f0.1` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `family_D_spectral_e_detector` | 0/2000 | 0.0000 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 17 | K3 | `A0.75sigma-f0.05-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 18 | K4 | `3sigma-point` | no | 0 | `family_E_conformal_heldout` | 89/2000 | 0.0445 | INERT |
| 18 | K4 | `3sigma-point` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `family_E_conformal_heldout` | 86/2000 | 0.0430 | INERT |
| 19 | K4 | `5sigma-point` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `family_E_conformal_heldout` | 104/2000 | 0.0520 | INERT |
| 20 | K4 | `8sigma-point` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `family_E_conformal_heldout` | 268/2000 | 0.1340 | INERT |
| 21 | K4 | `5sigma-point-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 22 | K5 | `slope5e-5` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 22 | K5 | `slope5e-5` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 23 | K5 | `slope1e-4` | **yes** | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 23 | K5 | `slope1e-4` | **yes** | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 24 | K5 | `slope5e-4` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 24 | K5 | `slope5e-4` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 25 | K5 | `slope1e-4-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 25 | K5 | `slope1e-4-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 26 | K6 | `mix-d1.0` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `safe_t` | 1/2000 | 0.0005 | INERT |
| 27 | K6 | `mix-d1.5` | **yes** | 0 | `universal_inference` | 1/2000 | 0.0005 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 28 | K6 | `mix-d2.0` | no | 0 | `universal_inference` | 0/2000 | 0.0000 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `safe_t` | 0/2000 | 0.0000 | INERT |
| 29 | K6 | `mix-d1.5-ar1` | no | 0.6 | `universal_inference` | 0/2000 | 0.0000 | INERT |

Two registered descriptive secondaries, each carrying no verdict. `family_E_conformal_heldout`'s
indicator-flag rate at the injected tick (A2): 0.866 at idx 18, 0.999 at idx 19, 1.000 at idx 20,
1.000 at idx 21. `family_D_spectral_e_detector`'s `fired_pre_onset`: 0 at idx 15 and 0 at idx 17,
so §5's onset gate had no overlap to resolve on this run.

### A1's own arms for the two new candidates (cells 30, 31)

| idx | detector | arm | exceedance | mean_e | Wilson lower_95 | fires/n | detection_rate | verdict |
|---|---|---|---|---|---|---|---|---|
| 30 | `group_average_e_value` | healthy (S2) | 0.0005 | 1.9141 | 0.000112 | 1/2000 | — | `not-refuted` |
| 30 | `group_average_e_value` | power (S3), `shift_sigma` 3 | — | — | — | 2000/2000 | 1.0000 | POWERED |
| 31 | `family_E_conformal_heldout` | healthy (S2) | 0.0280 | 3.1160 | 0.022540 | 56/2000 | — | `not-refuted` |
| 31 | `family_E_conformal_heldout` | power (S3), `shift_sigma` 3 | — | — | — | 2000/2000 | 1.0000 | POWERED |

Both S2 arms read `not-refuted` under A1's registered rule (`lower95(k,n) > alpha ? 'FAIL' :
'not-refuted'`, `run-battery.mjs:365-369,507`). Both were then mapped `REFUTED` by the
certification's frozen mean rule on `mean_e`, a separate instrument registered in a separate
document. §3 records what that verdict does and does not establish.

## 2. K4 materiality, operationalized before the results were opened

The rule-3 reading applied to A2's falsifier ("any K4 severity's cell reads a detection rate
materially above ≈0.20"), quoted verbatim from the sentence fixed before `run-battery.mjs` was
invoked:

> **A K4 canonical detection rate is "material" — in the sense of Amendment v1.1 A2's falsifier
> ("materially above ≈0.20") and A4's mechanical restatement — if and only if that rate's exact
> binomial (Clopper–Pearson) 95% lower confidence bound at N = 2000 exceeds 0.20.**

Mechanically, for a cell firing on `k` of `n = 2000`, the bound is the 0.05 quantile of
`Beta(k, n-k+1)` — the one-sided 95% lower confidence limit, `0` when `k = 0`. The two-sided-95%
variant (the 0.025 quantile, strictly lower and so harder to exceed) is reported alongside so the
verdict cannot turn on which convention a reader assumes. This is the exact binomial bound,
deliberately, not the Wilson bound `run-battery.mjs:365-369` computes for the A1 healthy arms.

**Provenance, stated exactly.** That sentence was written into the Task 9 session report
(`.superpowers/sdd/2026-08-07-coverage-matrix-v1/task-9-report.md`, above a "nothing below this
line was written before the run" marker) before the harness was invoked and before any run output
existed on disk. Nothing under `.superpowers/` is tracked by this repository (`git ls-files
.superpowers` returns nothing), so this file is the **first committed record** of the rule and it
postdates the run. The rule's pre-run status therefore rests on the session artifact and
transcript, not on a git object. That gap is why this report exists, and writing the rule down
afterwards does not close it.

| idx | severity | φ | fires/n | rate | exact lower (1-sided 95%) | exact lower (2-sided 95%) | material? |
|---|---|---|---|---|---|---|---|
| 18 | `3sigma-point` | 0 | 89/2000 | 0.0445 | 0.0372 | 0.0359 | no |
| 19 | `5sigma-point` (canonical) | 0 | 86/2000 | 0.0430 | 0.0358 | 0.0345 | no |
| 20 | `8sigma-point` | 0 | 104/2000 | 0.0520 | 0.0441 | 0.0427 | no |
| 21 | `5sigma-point-ar1` | 0.6 | 268/2000 | 0.1340 | 0.1216 | 0.1194 | no |

The largest lower bound anywhere in K4 is 0.1216, on the `-ar1` replicate, under either
convention. No K4 cell is material, so A2's registered NOT_POWERED prediction held and so did its
≤~0.20 derived ceiling (maximum observed rate 0.1340).

## 3. Post-hoc — carries no verdict

Per §11 rule 3. Nothing in this section informed any threshold, grid, falsifier, or verdict.
Nothing was tuned and nothing was re-run.

### K5's injection magnitude

`injectDrift` (`validation/coverage/lib/inject.mjs:49-51`) adds `slope*(t-at)*sigma`. Over the
200-tick test window `t-at` runs 0…199, mean 99.5, so the canonical `slope1e-4` integrates to a
test-window mean shift of `1e-4 * 99.5 = 0.00995σ` and the largest registered slope `slope5e-4`
to `0.04975σ`. The same `safe_t` that reads 0.9835 against a 0.75σ step reads 0.0000 at a
0.00995σ mean shift. The K5 result is consistent with the injection's magnitude in the
terminal-split metric rather than with a detector defect. Whether that is the right operating
point for the class is an instrument-scope question for the authority page. The grid is frozen,
the falsifier was met as written, and the registered NO stands as measured.

### The two REFUSE verdicts rest on tail-dominated sample means

Read off the committed arms and reproduced independently from the registered seeds
(`CELL_SEED = BASE_SEED + 30` / `+ 31`, `seed(i) = CELL_SEED + 7919*i`, `seed(i,k) = seed(i) +
104729*k`) at the same N=2000:

| arm | detector | mean_e | largest single path | its share of the mean | mean excluding it | median |
|---|---|---|---|---|---|---|
| 30 | `group_average_e_value` | 1.9141 | 3636.9 | **95.0%** | 0.0957 | 0.0481 |
| 31 | `family_E_conformal_heldout` | 3.1160 | 4200.9 | **67.4%** | 1.0161 — 0.5306 excluding the top three | 0.0100 |

Arm 31 admits a second, independent reading of the same object. The hedged indicator's per-tick
multiplier is `e_t = 1 + indicator − alpha_E`, so `E[e_t] = 1 + p − alpha` for indicator rate `p`.
Measured over all 2000 × 300 = 600,000 healthy ticks, `p = 0.050138` against `alpha = 0.05`,
giving `E[e_t] = 1.000138` and, over 300 ticks, `E[M_300] = (1.000138)^300 = 1.0424` exactly. The
per-tick behaviour sits 0.0138% above the null; the terminal sample mean of the same process
reads 3.1160.

**What the two verdicts establish.** The mean rule is registered, refusal-only, and fired
mechanically: `mean_e > TERMINAL_MEAN_BOUND = 1` (`lib/constants.mjs:18`) with no interval
recorded on the mean maps S2 to `REFUTED` (`lib/guards.mjs:72-85` `meanRule`, gated
`cls === 'terminal_e_value'`), and `REFUSE` follows before S3 or S4 are consulted
(`lib/score.mjs:537-540`). Both verdicts therefore record **"the registered instrument
refused"**, and neither records **"the construction is proven invalid"**. At n=2000 the sample
mean in each arm is one path.

The right reading of that estimator is **variance**, not the downward-bias argument on its own. A
sample mean of a product over 300 ticks is usually far below its true expectation and
occasionally far above it; both directions are the same fact about the estimator. Saying only
"the terminal mean is biased low, so a reading above 1 has cleared a headwind" understates it
here, because the reading above 1 is itself a single-path artifact of the same skew, and another
seed would move it by orders of magnitude either way.
`~/concord/knowledge/stats/pages/terminal-mean-is-not-measurable.md` records why no feasible `n`
fixes this estimator: on an exactly-mean-1 control at `σ=0.3, T=300`, ten times the replicates
moved the sample mean from 0.029 to 0.172 — still an order of magnitude low — with a median of
`10⁻⁶`.

The instrument that would settle the question is the **increment estimator**, `E[exp(Δ log M_t)]
≤ 1` per tick: a single term rather than a product of 300, measured on that page at roughly 650×
the stability of the terminal estimator at comparable cost. **No terminal-class card computes
it.** `TERMINAL_MEAN_BOUND` is defined on `mean_e`, the terminal read, and no card, cell schema,
or scorer in this repository records a per-tick increment for a `terminal_e_value` card. Arm 31's
`p = 0.050138` above is an increment-style reading taken by hand, outside any registered
instrument. Whether the terminal-class protocol should require an increment reading before a
mean-rule REFUSE is an **open question for the wiki write-back** — not a defect claim against the
frozen rule, and not a reason to move either verdict.

## 4. Errata

Both items disclose defects in artifacts already committed. Neither changes a cell, an endpoint,
a threshold, a seed, or a verdict; the run directory stays append-only.

### I1 — `params: 'oracle'` is wrong for the three terminal detectors

PREREGISTRATION.md §4 registers the baseline as "iid Gaussian, oracle parameters … (`mu:0,
sigma:1` passed directly — no calibration-window estimation)", and every emitted cell carries
`params: 'oracle'`. For the three terminal detectors that stamp is wrong, at the call sites:

- `safeTwoSampleTEValue(values, cal, test, opts?)` (`detectors/safe-t-e-value.ts:103-108`) takes
  no `mu` and no `sigma`; its only relevant option is `ar1Phi`
  (`detectors/safe-t-e-value.ts:55-62`), whose documented default is the engine's
  Kendall-corrected `computePerSignalAr1Phi` **estimated on the calibration window**. The harness
  passes `safeTOpts(phi) = (phi > 0 ? { ar1Phi: phi } : undefined)`
  (`validation/coverage/harness/run-battery.mjs:215`), so at **φ=0 — which is every canonical
  cell — `opts` is `undefined` and φ is estimated**, not known.
- `universalInferenceMeanShiftEValue(values, cal, test)`
  (`detectors/universal-inference-e-value.ts:186-190`) takes nothing beyond the two windows; the
  means, φ, and variance are all fit from the data by `fitAR1`.
- `group_average_e_value` is `K` per-series `safeTwoSampleTEValue` calls
  (`run-battery.mjs:230-236`), so it inherits the same estimation.

Affected cells: every cell scored by `safe_t`, `universal_inference`, or
`group_average_e_value` — all of K1, K2, K3, K5, K6, `safe_t`'s A6 rows on K4, and arm 30.
`family_D_spectral_e_detector` is **genuinely oracle**: `{ mu: 0, sigma: 1, phi: cell.phi, alpha,
windows: 'disjoint' }` is passed at `run-battery.mjs:263`. `family_E_conformal_heldout` uses a
fixed `Σ = [[1]]` with an empirical held-out calibration set, which is neither §4's
oracle-parameter regime nor the cal-window estimation the other three perform.

What stays valid: the endpoint numbers as measured quantities. Each cell's detection rate is what
the named detector did to the named data at the registered seeds, and that is unchanged by how the
parameters were obtained. What is flagged: **K1's and K2's YES were measured with φ estimated,
under a card whose regime is narrowed to known φ** — `guarantee.regime.phi_known: true`
(`validation/certification/cards/safe_t_e_value.json:51`). On mu and sigma there is no conflict
with that card: the same regime block already records `"baseline": "estimated"` (`:49`), so there
only §4's text was wrong. On φ the mismatch is real. Whether a `phi_known` card may be credited
with coverage measured at estimated φ is a regime question this document cannot settle. The cells
are **left exactly as committed** — the disclosure is the correction, per append-only — and the
same disclosure is appended to PREREGISTRATION.md as Erratum v1.3.

### I2 — `family_E_conformal_heldout` is carded `terminal_e_value` but is a per-tick process

Amendment A2 establishes the construction as a per-tick wealth process (`M_t = M_{t-1} * e_t`,
fire iff `M_t ≥ 1/alpha_E`), and the harness drives it as `kind: 'process'`
(`run-battery.mjs:237-258`). Its card nonetheless declares class `terminal_e_value`. That label
is what routed it to the mean rule, which is gated `cls === 'terminal_e_value'`
(`lib/guards.mjs:73`). Carded `e_process`, the same evidence would have produced
`NOT_EXECUTABLE` — no `e_process` instrument was measured for it — rather than `REFUSE`. The
verdict follows from the class label, so the label is the finding. Label and verdict both stay as
committed; the class question goes to the wiki write-back.

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


## Append, dated 2026-08-09 — Erratum v1.5: I1's flagged φ question is CLOSED, and its framing is corrected

WORKLIST `C43`. Filed as an append, not an edit: the section above stays as committed. Full text at
`validation/coverage/PREREGISTRATION.md`, Erratum v1.5.

**I1's last paragraph asks the wrong question.** It flags "K1's and K2's YES were measured with φ
estimated, under a card whose regime is narrowed to known φ" and leaves open "whether a `phi_known`
card may be credited with coverage measured at estimated φ". Checked against the code that does the
crediting:

1. **No coverage-battery cell is out of regime, and none ever was.** `annotatePhi`
   (`validation/certification/lib/collect.mjs:16-27`) derives `phi_source: 'oracle'` from the
   `null_id: 'N1'` these cells carry (`lib/nulls.mjs:67-70`), so `regimeCheck`'s narrowing branch
   (`lib/score.mjs:66`) does not fire. In the scored run
   `validation/certification/results/run-20260809T080049Z`, `safe_t_e_value` carries
   `out_of_regime: true` on 14 of 47 S2 cells and **every one is an `N4-p*` cell from
   `terminal-evalue` / `phi-identifiability`** — none from this battery.
2. **The regime would not exclude them under the accurate tag either.** `lib/nulls.mjs:28-49`
   records the ruling, in code, before I1 was written: a regime bounds data-generating conditions,
   not API call shapes, so an iid null's φ is 0 and known "whatever the detector does internally"
   (tag `'iid-by-construction'`, which is not `'estimated'`).
3. **The class answers never pass through the regime check.** `coverageFor`
   (`lib/score.mjs:358-404`) contains no `regimeCheck`, `inRegime` or `effectivePhi` call — the
   registered reason is the sibling stage's own, "power is not a validity claim" (`:332`). And
   `safe_t` has **zero** cells from this battery in its S2: its 43 coverage rows carry no
   `shift_sigma`, so S3 files them as not-scored-for-INERT, and `safe_t` has no healthy arm here.
   The φ-estimated cells supply **power evidence only**.
4. **Priced, from committed JSON.** Under the stricter reading `lib/nulls.mjs:43-49` rejected (φ
   known iff `opts.ar1Phi` was passed), `safe_t_e_value` keeps S2 `PASS` (12 surviving cells, all
   `CLEARED`; the 21 dropped were all `CLEARED` too), S3 `PASS` (min surviving rate `0.897` against
   `INERTNESS_FLOOR = 0.10`), `USE` and `T1`. K1/K2/K5 would move only if the class-answer layer
   were **also** gated on the regime, which nothing registers: K1 would still read YES via
   `universal_inference_e_value` (`0.9875`, no `phi_known`), K2 and K5 would read NO.

**What is genuinely wrong is narrower than I1 says.** This battery stamps `null_id: 'N1'`
(`run-battery.mjs:1426`) on φ=0 cells, and in the two studies that own that id `N1` **threads φ to
the detector** (`validation/terminal-evalue/harness/run.mjs:28,43`;
`validation/h0-battery/harness/nulls.mjs:53`). This harness does not (`run-battery.mjs:616`). The
accurate id for a φ=0 `safe_t` / `universal_inference` / `group_average_e_value` row is `N2-m100`,
which derives `'iid-by-construction'` / `'estimated-moments'`. **Mechanically inert** — both tags
are non-`'estimated'`, `phi: 0` is recorded on the row, and this card's `m_min` is `null` — so no
verdict moves, and the rows stay exactly as committed. The forward fix changes a registered field's
value on every future emission and needs its own amendment; it is named-not-done in Erratum v1.5.

**I1's scope line should read K1, K2 and K5.** K5's canonical is `slope1e-2` after Amendment v2.K5R,
also φ=0, also carried by `safe_t`.
