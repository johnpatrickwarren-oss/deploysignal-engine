# run-20260810T074653Z — the c-bound measurement, and its control failed

Governed by `../../../PREREGISTRATION.md` §§1–5 and `Amendment A1 — 2026-08-10`, both committed
before the harness existed (`61daee1`) and before this run (`88616e1`). One attempt, as registered.
`node harness/run.mjs --mode live --n 4000 --b 5`. 24 cells, 2 min 17 s. First execution of this
study. This file discharges Amendment A1 §A1.8 rule 8.

## 1. The headline, which is not a `c`

**P-C9's stop condition fired: no `c` is reported from this run for any detector.** The Family D
disjoint control reads `E[M_300] = 1.1200381826911874` on the primary replicate against the
registered band `[1.02, 1.12]` — outside by **3.8 × 10⁻⁵**, or 0.003% — and two of its five
replicates (`1.1200`, `1.1213`) sit above the band's upper edge. The registered consequence is
verbatim: *"If the disjoint arm falls outside `[1.02, 1.12]` the instrument disagrees with a
committed number and NO `c` is reported from this run for any detector."* It is honoured.

**The band was mine and it was too narrow, and that is not the interesting half of the failure.**
The interesting half is `T = 900`, which A1.6 required only to exceed `T = 300` and did not band:

| horizon | wealth updates | committed (`types/families/d.ts:91-93`, `test/spectral-inflation-bound.test.ts`) | measured here, 5 replicates | ratio |
|---|---|---|---|---|
| `T = 300` | 9 | **1.0636** (95% lower 1.0257) | 1.0357 – 1.1213 | 0.97× – 1.05× |
| `T = 900` | 29 | **1.1076** (95% lower 1.0244) | **1.7018 – 1.9517** | **1.54× – 1.76×** |

Fitting `c(n) = a·bⁿ` to my two points gives `b ≈ 1.0210` per wealth update against the committed
`b ≈ 1.00203` — **ten times the per-update inflation**. A 100-window calibration against the
committed 400-window one plausibly explains a percent; it does not explain a factor of ten in the
growth rate. **This is a contradiction between this harness and a committed artifact that a shipped
detector prices against, and I record both claims rather than resolving either.** The direction of
the doubt runs against this harness first, because the control is what failed. If instead the harness
is right, `e_value_inflation_bound` at `1.1076` under-prices `T = 900` by ~1.6×, and that is a
question for whoever owns `detectors/spectral.ts`, not for a measurement whose own control missed.

## 2. What the run establishes anyway, and why withholding `c` does not withhold this

P-C9 bars reporting a `c`. It does not bar reporting whether a `c` is **estimable**, which is a
property of the estimator's degeneracy and not of its value. Every cell's D1–D4 outcome is recorded
per A1.8, including where nothing fired.

**`c_markov` is not estimable by simulation on five of the six primary cells, at any horizon.**

| detector | null | `c_markov` status by horizon (300 / 900 / 2000) | max `top1_share` | why |
|---|---|---|---|---|
| betting | N1 (φ=0 oracle) | **MEASURED / MEASURED / MEASURED** | 0.32 | nothing fired |
| betting | N3-p09 (φ=0.9 **oracle**) | NOT / NOT / MEASURED | 0.66 | **D3** at 300 and 900: the replicates straddle `E[M] = 1` |
| betting | N4-p09-m100 (φ̂) | NOT / NOT / NOT | **1.0000** | D1, D2 |
| safe-Hotelling | N1 | NOT / NOT / NOT | 1.0000 | D1, D2 |
| safe-Hotelling | N3-p09 (oracle) | NOT / NOT / NOT | 1.0000 | D1, D2, D3 |
| safe-Hotelling | N4-p09-m100 | NOT / NOT / NOT | 1.0000 | D1, D2, D4 |

`top1_share = 1.0000` means the log-sum-exp mean is, to double precision, **one trajectory out of
4,000**. On safe-Hotelling N4-p09 at `T = 2000` the five replicates read `log10 E[M]` between
**1350.9** and **2157.4** — a spread of **806 orders of magnitude** on the same estimand. A number
like that is a reading of whichever draw exploded hardest, and reporting it as a mean would be a
category error, not a conservative estimate.

**`c_ville_emp` — the price the bootstrap actually targets — is estimable on 10 of the 18 primary
cells**, including every oracle cell of both detectors, because a high quantile of a heavy-tailed
variable survives where its mean does not. It fails (D4) only on the estimated-φ cells at the two
longer horizons and on betting N4 at `T = 900`+.

**The two instruments disagree about which regime is priced, and that reproduces
`stats/ville-guarantee-is-empirical`'s central reconciliation from a different direction.** On
safe-Hotelling N1 the terminal mean reads `10⁻¹⁴·⁶` while the sup quantile reads
`c_ville_emp = 10⁻⁰·³³` — the max-wealth quantile sits a third of an order of magnitude below `1/α`
where the terminal mean sits fourteen orders below it. The bootstrap is measuring a crossing rate;
`E[M]` is measuring something else. That was the page's argument and it holds on this run's own
numbers.

## 3. Every registered prediction, scored

| # | prediction | result |
|---|---|---|
| **P-C1** | betting N1: `E[M_300] ∈ [0.09, 0.40]`, decreasing in `T` | **HELD** — `0.280`, then `0.179`, `0.112`. The published `0.322 / 0.139 / 0.092` shape. |
| **P-C2** | betting N3-p09 oracle: point in `[0.5, 1.6]`, and the five replicates **straddle 1** | **HELD, both clauses** — point `0.895`; replicates span `0.863`–`1.146` at `T=300`, so D3 fires and `c_markov` is NOT MEASURABLE there. `stats/ville-guarantee-is-empirical`'s partial retraction of this cell is confirmed on its own criterion. |
| **P-C3** | betting N4: `log10 E[M_300] ∈ [8, 25]`; D1 fires | **HELD** — `15.078`. D1 fires as registered (a replicate reaches `top1 = 1.0000`); the primary replicate's own share is `0.3764`, below the criterion, and I state that rather than let the cell-level token stand for it. |
| **P-C4** | safe-Hotelling N1: `log10 E[M_300] < −5` | **HELD** — `−14.564`. |
| **P-C5** | safe-Hotelling N3-p09: `log10 E[M_300] ∈ [8, 25]`; D1 fires | **HELD** — `21.086`, `top1 = 0.983`. Published `14.2` is inside the band. |
| **P-C6** | safe-Hotelling N4: `log10 E[M_300] ∈ [150, 500]`; D1 fires | **HELD** — `233.342`, `top1 = 1.0000`. Published `300.4` is inside the band. |
| **P-C7** | **every** cell with `log10 E[M_T] > 0` fails D1 | **REFUTED — 12 of 14, not 14 of 14.** The two exceptions are the Family D disjoint control at `T = 300` (`log10 E[M] = 0.049`, `top1 = 0.0050`) and `T = 900` (`0.231`, `0.0252`). |
| **P-C8** | `c_ville_emp` nondecreasing in `T` everywhere; `E[M_T]` increasing on the estimated-φ and oracle-AR(1) cells, decreasing on both primary N1 cells | **SPLIT.** The `c_ville_emp` clause **held on all 8 cells**. The `E[M_T]` clause held on both estimated-φ cells (betting `15.1 → 48.9 → 115.9`; safe-Hotelling `233 → 640 → 1514`) and on both primary N1 cells (decreasing), and is **REFUTED on both oracle-AR(1) cells**: betting N3-p09 runs `−0.048 → −0.283 → −0.525` and safe-Hotelling N3-p09 runs `21.1 → 11.5 → −37.5`. |
| **P-C9** | the control: `E[M_300] ∈ [1.02, 1.12]`, `E[M_900] > E[M_300]` | **FAILED on the band, held on the ordering.** §1. Stop condition honoured. |
| **P-C10** | `log10 overshoot_markov` equals `log10` of the shipped ratio where `c_markov` is measurable and below 1; negative on the N4 cells | **HELD** — `4.382` on all four such betting cells (`log10 2.41e4 = 4.382`); no safe-Hotelling cell is both measurable and below 1, so the clause is vacuous there. Negative on both N4 cells: betting `−10.70 / −44.56 / −111.53`, safe-Hotelling `−156.79 / −563.24 / −1437.82`. |

## 4. The refinement P-C7's refutation earns, stated as a hypothesis and not a result

`c_markov`'s estimability at `N = 4000` does not fail at `E[M] > 1`. It fails an order of magnitude
higher: the two cells where nothing fired have `log10 E[M] = 0.049` and `0.231`, D1 first fires at
`log10 E[M] = 0.871` (Family D N1, `T = 2000`, `top1 = 0.117` primary, `0.649` at a replicate), and
every cell above `log10 E[M] = 11` has `top1 ≥ 0.86`. **So a `c` in the neighbourhood of 1 — the only
neighbourhood in which pricing a threshold at `c/α` is operationally tolerable — is exactly the
neighbourhood where the estimator works.** That is a hypothesis from 24 cells on three detectors,
with the control failed, and it is not a measured boundary.

## 5. A defect in my own criterion, named because the control exposed it

**D3 is too strict at `c ≈ 1`.** It marks a cell NOT MEASURABLE whenever the replicates straddle
`E[M] = 1`, which is what sampling noise does to any genuine `c` just above 1 — and `c ≈ 1.06` is
the one route in this portfolio that is successfully priced in shipped code
(`detectors/spectral.ts:345`). D3 fired on betting N3-p09 at two horizons for that reason and not
because that cell is heavy-tailed there (`top1 = 0.075`, `0.108`; the D2 ranges are `0.12` and
`0.56`). The criterion was registered before the run and is not moved; a replacement — a one-sided
lower confidence bound on `E[M]` across replicates, which is what pricing actually needs — is a
separate registration and is named-not-done.

## 6. What this run does not do

- **It reports no `c`, so `family_A_betting_e_process` and `family_C_safe_hotelling` stay
  S4 `UNPRICED`.** No card was edited, no card was re-frozen, and the golden verdict table
  (`validation/certification/test/golden-verdicts.test.mjs:372,374`) is untouched — A1.5
  disposition 3, which barred a card edit on either branch in advance.
- **It does not resolve the Family D contradiction of §1**, and it must not be cited as evidence
  against `e_value_inflation_bound` — the control failed, so this instrument is the one carrying the
  doubt.
- **It does not re-measure the shipped ratios** `2.41e4` and `3.6e76`, quoted from
  `stats/ville-guarantee-is-empirical` (A1.7 item 1). Every `overshoot` inherits their error.
- **It says nothing about the compiled cells that ship a threshold BELOW `1/α`** — 2,584 Family A and
  82 Family C — which need the compiled-config tree.
- **It measures no power.** The overshoot's cost (`0.949 → 0.459` at half-sigma on the wiki page) is
  not re-measured.
- **`c_ville_emp` is not an anytime bound.** It reproduces an `α` crossing rate on three synthetic
  nulls at `T ≤ 2000` and nothing beyond them.
- **T1, synthetic nulls, and `family_C_safe_hotelling` receives an identity covariance on the AR(1)
  cells** — the instrument finding batch B registered, inherited unchanged from the H0 battery's
  adapter and not repaired here.

---

# Correction append, 2026-08-10 (appended not edited): §1's causal claim is REFUTED, the filed contradiction is withdrawn, and five numbers were wrong

From an independent review. Every correction below runs against this report's own text. **No number
in the run changed and nothing was re-run**; the cells are byte-identical.

## X1. §1's central claim was wrong, and the mechanism was already on the page I cited

§1 says, of the Family D control:

> A 100-window calibration against the committed 400-window one plausibly explains a percent; it does
> not explain a factor of ten in the growth rate.

**REFUTED. The 400 → 100 window change explains the whole factor of ten.** Two independent grounds:

1. **The reviewer reimplemented the control four ways and swept `K`, the number of calibration
   windows.** `E[M_900]` reads **16.6 / 4.71 / 2.27 / 1.25 / 1.18 / 1.17** at `K = 25, 50, 100, 200,
   400, exact`. **This harness is condition A** — `K = 100`, per-trajectory calibration — and the
   sweep's ranges contain my readings at every horizon. **The committed `1.1076` is condition D**,
   exact moments. The two numbers measure two different estimators of the same quantity, and neither
   is wrong. The excess is `exp(n² r² / 2K)` in the calibration-error term, which is **quadratic in
   the update count `n` and inverse in `K`**, so quartering `K` moves the exponent by 4×.
2. **`knowledge/stats/h0-battery-2026-08-01.md:166` already records this mechanism**, in the
   provenance box for the very numbers I quoted: *"The gap is that the 1.0023 per-draw figure was
   measured at exact null moments while this study estimates `μ̂₀`/`σ̂₀` from 400 windows."*
   **I quoted that page's table and not its explanation.** The failure was mine and it was a reading
   failure, not a measurement one.

**The "contradiction between this harness and a committed artifact" filed upward in §1 is
WITHDRAWN.** There was no contradiction. `run-20260810T074653Z`'s Family D readings and
`types/families/d.ts:91-93` are the same quantity at two calibration sizes.

**§1's stop-condition ruling stands unchanged.** P-C9's band was `[1.02, 1.12]`, the primary replicate
read `1.1200381826911874`, and the band is missed whatever the reason — a registered stop condition
does not become unfired because its cause turns out to be benign. No `c` is reported. What changes is
the *diagnosis*: the band was too narrow **for a `K = 100` estimator**, and the registration should
have banded `K` rather than assuming the committed number's `K` transferred.

## X2. What the adjudication actually surfaced — three findings, none of them mine

The reviewer's reimplementation found three things that survive the withdrawal. All three are for the
wiki write-back; the code fixes belong to `deploysignal`/engine follow-ups and **not** to this branch,
which changes no detector.

**(a) A compiler/runtime statistic mismatch, and it is the serious one.** The calibrator computes
`null_mean` / `null_std` as moments of a **per-trajectory MAX** statistic —
`../deploysignal/tools/calibrators/family-d.ts:247`, `peaks[b] = trajectoryMaxPeak`, a max over
roughly 80 windows — while `detectors/spectral.ts:367-368` standardizes **one** evaluation:
`u = (peak_t - mu0) / sigma0`. A max-of-~80 location is being used to centre a single draw. In shipped
configs `null_mean` has median **0.5742** against a single-window marginal of **0.276–0.420**, giving
`E[z] ≈ −0.94` per update and a wealth that decays by **`e^−27`** over 29 updates. **So neither
`1.1076` nor `1.70` describes the shipped path**: both were measured with the statistic the runtime
standardizes, and the compiler supplies moments of a different one.

**(b) `SpectralInflationBound` is not well-formed without `K` beside `T`.** `c(T, K) ≈
exp(skew·n + n² r² / 2K)`, so a single scalar `c` pinned to a horizon is under-specified: the same
detector at the same `T` prices differently at a different calibration size. The type's doc comment
(`types/families/d.ts:85-107`) states the horizon rule and not the calibration-size rule.

**(c) The shipped constant has no reproducible artifact.** `validation/family-d-emean/` contains
`PREREGISTRATION.md` and nothing else — no harness, no `results/` — verified at HEAD. `1.0636` and
`1.1076` are quoted in a type comment and a unit test with no run behind either.

## X3. Five numbers in this report were wrong

| where | printed | correct | why |
|---|---|---|---|
| §2 | `c_ville_emp` estimable on **10 of 18** primary cells | **13 of 18** | recount of `c_ville_emp_status === 'MEASURED'` over the 18 primary cells |
| §2 table intro | `c_markov` NOT MEASURABLE on **5 of the 6** primary cells **at every horizon** | **4 of 6 routes at every horizon**; **5 of 6 routes** have at least one NOT MEASURABLE horizon | betting N3-p09 is MEASURED at `T = 2000`, so it is not an every-horizon failure. The four every-horizon routes are betting N4-p09-m100 and all three safe-Hotelling routes. Cell-wise: 4 of 18 cells MEASURED. |
| §3 P-C2 | replicates span `0.863`–**`1.146`** | `0.8628`–**`1.1443`** | the five readings are `0.8953, 0.8938, 1.1443, 0.8933, 0.8628` |
| §4 | "D1 first fires at `log10 E[M] = 0.871`" | **among cells with `log10 E[M] > 0`**, D1 first fires at `0.871` | unqualified it is false: safe-Hotelling N1 fires D1 at `log10 E[M] = −14.56` (`top1 = 0.7383`) |
| §1 | see X1 | see X1 | the causal claim |

**X3's fourth row weakens §4's hypothesis and I state that rather than leaving the section standing.**
§4 argued that estimability fails only well above `c = 1`. D1 firing at `log10 E[M] = −14.56` shows
degeneracy is **not** a function of the mean's size: safe-Hotelling's terminal wealth is
one-trajectory-dominated in a regime where the mean is fourteen orders *below* 1. The surviving
statement is narrower and is the only one this run supports: **among the cells whose mean exceeds 1,
the two lowest (`0.049`, `0.231`) are the only ones where the estimator is not degenerate.** Whether
that is a threshold in the mean or a property of the wealth distribution's shape is untested here, and
the safe-Hotelling N1 cells are evidence for the second reading.
