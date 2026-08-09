# run-acrossdraw-20260809T065107Z — the C51.2 across-draw replication study

Narrative generated from the committed JSON in this directory (`rows.json`,
`distributions.json`, `manifest.json`). Every number below is readable off those files; nothing
here is computed only for this document except where a line says so explicitly.

**Pre-registration:** `validation/coverage/PREREGISTRATION.md` Amendment v2.K6A.6, committed at
`795f9f4` before the driver existed. Driver and tests committed at `e61e0ca` before any draw ran.
**Run at** `git_sha e61e0ca7f01854609d6f10be123a051f5bb3d46c`, `engine_pin 0.6.6-pre`,
`node v25.9.0`, module `dist/detectors/shape-ecdf-accumulator.js`
`sha256 d57b5dd257a890d0fb0417bd4f52bbdfcc76e32188baeaec5be10a2f684d2b6a`. `mode: live`,
`227.97 s`, one run, no re-run.

**What this study does not do** (K6A.6, restated because it governs how every number below may be
read): it re-scores no card, moves no `COVERAGE.md` row, and does not replace the registered
single-draw run `run-20260809T035934Z`. The one-attempt rule is untouched and the class answer
stays **"K6-slow YES at this calibration draw"** (K6A.2.4b). `screen_positive_draws` is recorded,
never a stop.

## 1. The measured across-draw distributions

`R = 100` fresh calibration draws at the frozen geometry (`W = 150`, `n = 100,000`,
`A/B = 25,000/75,000`, `m = 500`, `kappa = 0.6820`, `H = 6,000`, `N = 40`), `TJ = 500` trajectories
per arm per draw. Quantiles are nearest-rank, `q(p) = sorted[round(p*(n-1))]`, the harness's own
convention. The C1.2 serial-structure guard ran on all 100 draws and threw on none.

| endpoint | mean | sd | min | p05 | p25 | p50 | p75 | p95 | max |
|---|---|---|---|---|---|---|---|---|---|
| canonical detection-within-6,000 | **0.62514** | 0.152938 | 0.278 | 0.364 | 0.518 | 0.634 | 0.746 | 0.872 | 0.930 |
| healthy 6,000-tick crossing rate | 0.01702 | 0.013872 | 0.000 | 0.002 | 0.008 | 0.014 | 0.022 | 0.044 | 0.064 |
| `increment_estimator.mean` | **0.989903** | 0.019139 | 0.954059 | 0.960901 | 0.976076 | 0.988396 | 1.002673 | 1.022896 | 1.041633 |
| `p_uniformity` KS | 0.037646 | 0.010502 | 0.018115 | 0.022891 | 0.029821 | 0.036537 | 0.042774 | 0.057030 | 0.068550 |
| null-growth `g_null` | -0.068211 | 0.013792 | -0.096156 | -0.088861 | -0.078635 | -0.069356 | -0.058945 | -0.044583 | **-0.031494** |

## 2. The registered predictions, verified

| # | endpoint | predicted | band | measured | verdict |
|---|---|---|---|---|---|
| **E1** | across-draw mean canonical detection | `0.6207` | `[0.593, 0.648]` | **`0.62514`** | **HELD** (`+0.29` SE) |
| **E2** | across-draw sd of detection, deconvolved | `0.1416` | `[0.117, 0.166]` | **`0.151398`** | **HELD** |
| **E3** | `P(detection < 0.50)` | `0.196` | `[0.12, 0.28]` | **`0.21`** | **HELD** |
| **E4** | fraction of draws with healthy rate `> alpha` | `0.079` | `[0.03, 0.15]` | **`0.03`** | **HELD**, at the band's lower edge |
| **E5** | fraction where the Wilson-LB stop condition would fire | `0.039` | `[0.01, 0.10]` | **`0.00`** | **DEVIATION** — recorded, not corrected |
| **E6** | across-draw mean of `increment_estimator.mean` | `0.991433` (exact null) | disposition rule | **`0.989903`** | **READING A — TAIL DRAW** |
| **E7** | draws with positive null growth at `M = 8,000` | `0.0013` expected | `0` | **`0`** | **HELD** |
| **E8** | across-draw `p_uniformity` KS | *no prediction registered* | — | median `0.036537` | DESCRIPTIVE |

**Six of seven banded predictions held. One deviation, E5.** Two registration imprecisions
surfaced in the process and are recorded in section 5 rather than fixed.

**E2's deconvolution, since the raw and deconvolved figures differ little and a reader should see
why.** Raw sd of the 100 draw-means `0.152938`; binomial sd at `TJ = 500` is `0.021649`;
`sqrt(0.152938^2 - 0.021649^2) = 0.151398`. At `TJ = 500` this study's own measurement noise
contributes `2%` of the observed variance, against the `14%` it contributed at the gate's
`TJ = 72` — which is the whole reason K6A.2.4c's deconvolution mattered there and barely matters
here. **The measured calibration-draw sd is `0.1514`, `6.9%` above K6A.2.4c's registered `0.1416`
and inside its interval either way.**

**E7 independently reproduces K6A.1.5's screen distribution on a disjoint seed band**, which was
not a registered endpoint and is the study's cheapest replication: `g_null` mean `-6.821e-2`
against K6A.1.5's `-6.754e-2`, sd `1.379e-2` against `1.571e-2`, worst draw `-3.149e-2` against
`-1.501e-2`. `0/100` positive.

## 3. E6 — the claim-settling endpoint, and its pre-registered disposition

`stats/terminal-mean-rule-contested`'s third claim asks whether
`increment_estimator.mean = 1.024959` on the registered run is a validity signal or the
calibration lottery's signature, and names what would settle it: *"the across-draw distribution of
`increment_estimator.mean` at kappa = 0.682 under the corrected substrate"*. K6A.6.5 registered all
three dispositions before this run.

```
across-draw mean                     0.989903
exact discrete null (K6A.1.5)        0.991433
gap                                 -0.001530  =  -0.80 SE of the across-draw mean (SE 0.001914)
                                                  |gap| <= 1.96 SE  ->  consistent with the null
across-draw sd                       0.019139
run draw 1.024959                    inside the measured support [0.954059, 1.041633]
                                     at the 97th percentile, 1.83 across-draw sd above the mean
```

**SELECTED: READING A — TAIL DRAW. The lottery explanation gains its across-draw evidence; the
finite-variance claim does not acquire across-draw support.** The disposition was computed by the
driver from the rule in the prereg, not chosen after reading the number
(`distributions.json` -> `predictions[E6].disposition`).

**The mechanism, and it is the one K6A.2.4c already named on detection.** The registered run
reported `1.024959` as **`16.26` SE** above the exact null. That SE is the **within-draw** Wald SE
of the mean of 2,000 per-trajectory increment means, `0.002062`. The **between-draw** sd measured
here is `0.019139` — **a factor of `9.3` larger**. Against the quantity that actually varies from
run to run, `1.024959` is `(1.024959 - 0.991433)/0.019139 =` **`1.75`** ` across-draw sd` above the
exact null: an ordinary upper-tail draw, not a `16`-sigma event. **A within-draw SE quoted against
a between-draw spread is the same category error K6A.2.4c corrected for detection's `0.1527`, now
measured on the increment field.**

**What this does not do.** It does not restore S2 authority to `increment_estimator` (a protocol
decision, K6A.1.10/K6E.9's ruling), does not re-score the card, and does not withdraw the
`[0.97, 1.01]` range — K6A.5's rejection of withdrawing a range after watching it fire stands. The
range still fired; what is now measured is that it fires on roughly the upper decile of
calibration draws (`p95 = 1.022896`), which is a property of the range's calibration, not of the
run.

## 4. The registered run located in the measured distributions (descriptive, no verdict)

K6A.6.4 registers this read as descriptive with no disposition contingent on it.

| `run-20260809T035934Z` | value | fraction of the 100 draws at or below | inside measured support |
|---|---|---|---|
| canonical detection (cell 44) | `0.8515` | `0.93` | yes |
| healthy crossing rate (arm 47) | `0.0540` | `0.97` | yes |
| `increment_estimator.mean` (arm 47) | `1.0249590993997122` | `0.97` | yes |

**All three sit in the upper few percent of the same 100 draws, and all three are inside the
support.** This is the "hot draw" the contested page describes, now measured rather than asserted:
the registered run drew a calibration substrate in roughly the 93rd-97th percentile on three
diagnostics at once. The three are not independent readings of independent things — they share one
calibration draw, which is the mechanism, and the study measures the joint behaviour of that
sharing exactly once per draw.

## 5. Deviations and registration defects, recorded not corrected

**(a) E5 is a DEVIATION: `0/100` against a registered band of `[0.01, 0.10]`.** At the registered
`p = 0.039`, `P(0 of 100) = 0.0187`, so this is a `1.9%` outcome under the registration as written.

**(b) The measured mechanism for both E4 and E5, flagged as POST-HOC and moving no endpoint.**
K6A.6.7 (3) forbids post-hoc analysis of endpoints; this paragraph analyses the *registration*, not
the endpoint, and the endpoint verdicts in section 2 stand as computed. **E4 and E5 are defined on
an OBSERVED healthy rate, so both are functions of the trajectory count at which the rate is
observed — and K6A.1.10 registered them from a `TJ = 72` probe while this study measures at
`TJ = 500`.** Replaying the gate's own two rules on **this study's own 100 draw-level rates, at the
gate's own `TJ = 72`**:

| rule, as K6A.1.10 defines it | the gate's figure | replayed on this study's 100 draws at `TJ = 72` |
|---|---|---|
| observed rate `> alpha = 0.05` (E4) | `22/280 = 0.079` | **`0.081`** |
| the `n = 2000` Wilson-LB threshold (point rate `0.0585`) applied to the observed rate (E5) | `11/280 = 0.039` | **`0.039`** |

**The underlying draw-level healthy-rate distribution replicates the gate's to two and three
decimals. Neither E4 nor E5 is a disagreement about the accumulator; both are the same
distribution read through a different `TJ`.** At `TJ = 500` the same rules give `0.041` and
`0.011`, against measured `0.030` and `0.000` — both consistent with binomial noise on 100 draws.
Supporting arithmetic: the deconvolved draw-level healthy sd is `0.012609`, which at `TJ = 72`
implies an observed sd of `0.019783`, and the gate's tabulated `p50 = 0.0139` matches this study's
`0.014` exactly while its `p95 = 0.0556` and `max = 0.1389` exceed this study's `0.044` and
`0.064` — a longer upper tail, which is what the extra `TJ = 72` binomial noise is.

**One registration defect this surfaces, filed and not fixed.** E5's rule as K6A.1.10 states it
applies an `n = 2000` Wilson threshold to a rate measured on `72` trajectories, where the
granularity is `1/72 = 0.0139` and the `0.0585` threshold is effectively "`k >= 5`". **A stop
condition's false-fire rate estimated that way is a property of the probe's trajectory count, not
of the stop condition.** Recorded as a write-back obligation. Nothing in K6A.1.10 moves here: this
study has no authority over a stop condition and states so.

**(c) A registration imprecision in this study's own E2 band.** K6A.6.4 calls `[0.117, 0.166]`
"the chi-square 95% interval at `df = 99`". The exact interval about `0.1416` at `df = 99` is
**`[0.1219, 0.1613]`**. The registered band is wider than the thing it names, so it is
conservative — a wider band cannot manufacture a held prediction, and E2's `0.151398` is inside
both. **Corrected by quote-and-correct, in the direction against this study's own convenience: the
band as registered was easier to hit than it claimed to be.**

**(d) E8's comparability limit, stated because the number invites a comparison it cannot support.**
`p_uniformity` pools `TJ * 40` values, so this study's KS is at `n = 20,000` (critical `0.009617`)
and the registered run's at `n = 80,000` (critical `0.004808`). **The KS statistic exceeds its
critical value on `100/100` draws here, the smallest at `1.88x` critical** — so the registered
run's `8.56x` reading is not a property of a hot draw, it is what this discrete-`p` construction
does on every draw, which is the reason K6.7/K3.1.7 stripped the field's verdict authority in the
first place. An unregistered descriptive read, offered as such: the run's KS `0.041150` sits at
fraction `0.66` of these 100 values — but the two are at different `n` and the comparison is
indicative only. **K6A.6.4 registered no prediction for E8 and none is claimed.**

## 6. The study's own principal limitation, as registered before the run

K6A.6.2 registered it and the run does not change it. The harness `rng` is a 32-bit LCG with a
single full-period orbit, so distinct seeds are offsets into one sequence. This study consumed
**`~2.42e9` uniforms against an orbit of `2^32 = 4.295e9` — 56%** — with an expected **23% of
drawn positions re-visited by some other stream. The 100 draws are therefore NOT independent, and
`sd/sqrt(100)` is not the whole error on any figure above**, including the `SE 0.001914` that E6's
disposition rule uses. Registered before the run, not corrected: the generator is the harness's,
and replacing it would make this study measure a different object than the 280-draw MC it
replicates.

**A second, narrower limitation, also pre-registered.** Exact-seed disjointness is enumerated
against every prior family whose *form* the prereg states (3,045,706 seeds `mod 2^32`, 0
collisions, asserted by `test/run-acrossdraw.test.mjs`). **Eight earlier K6-probe seed *bases* are
named in this document without their forms and are excluded from that claim.**

## 7. Fidelity of the path

The replication control (`ACROSSDRAW_REPLICATE=1`, `test/run-acrossdraw.test.mjs` test 5) re-scores
the registered run's own two draws at the registered study's own seeds and spaced-per-trajectory
scheme and reproduces **`0.8515` / `0.054` / `1.0249590993997122` exactly** — asserted with
`assert.equal`, not a tolerance. Together with the module-path positive control (test 4, per-window
`p` and `e` asserted equal to the module called directly), that is the evidence that the numbers
above were produced by the registered scoring path.

**One registered departure**, K6A.6.1: trajectories are consecutive disjoint blocks of one
continuously advanced stream per (calibration draw, arm) — K6A.1.3's convention for the 280-draw MC
this study replicates — rather than `run-battery.mjs:572`'s spaced per-trajectory seeds. The scored
path is the module's, bit for bit.

---

## 8. Correction append, 2026-08-09 (appended not edited)

Four corrections from an independent review, three against this document. The review re-derived
`rows.json` byte-identically and confirmed E6's disposition was forced by the registered rule. No
measurement is re-run and **no endpoint verdict moves.** Full text:
`PREREGISTRATION.md` → "Correction append to v2.K6A.6's results, dated 2026-08-09".

**(1) Section 5(b) mixed two rules.** Quoted: *"At `TJ = 500` the same rules give `0.041` and
`0.011`"*. **The `0.039` replayed at `TJ = 72` is the point-rate `> 0.0585` rule; the `0.011` is the
Wilson-LB-at-`n` rule. Like-for-like at `TJ = 500` for the point-rate rule is `0.0229`.** The three
rules on this study's own 100 draw-level rates:

| rule | `TJ = 72` | `TJ = 500` | `TJ = 2000` |
|---|---|---|---|
| observed rate `> alpha` (**E4's own rule**) | `0.0807` | **`0.0413`** | `0.0380` |
| observed rate `> 0.0585` (the `n = 2000` LB proxy) | **`0.0395`** | `0.0229` | `0.0231` |
| Wilson LB at `n` (**E5's own rule**) | `0.0084` | **`0.0109`** | `0.0240` |

Each endpoint against its own rule: E4's registered `0.079` is `rate > alpha` at `TJ = 72`
(replicated `0.0807`), predicting `0.0413` at `TJ = 500` against measured `0.030`. **E5's registered
`0.039` is NOT E5's rule** — it is the point-rate proxy at `TJ = 72` (replicated `0.0395`); E5's own
rule predicts `0.0109` at `TJ = 500`, i.e. `1.09` draws, `P(0) = 0.34`. **Measured `0` is
unremarkable against the rule E5 applies.** The DEVIATION verdict against the registered band
stands as recorded.

**(2) Section 5's "a property of the probe's trajectory count, not of the stop condition"
OVERSTATES.** At the stop condition's real `n = 2000` the Wilson-LB rule still false-fires on
**`2.40%`** of draws from the lottery alone. The gate's `3.9%` is the `TJ = 72` proxy at `0.0395` —
an inflation of **`×1.64`**, not a fabrication. **K6A.1.10's qualitative claim is correct, and the
write-back obligation is correspondingly WEAKER than section 5 filed it: the registered `≈ 4%`
should read `≈ 2.4%`, a number to correct rather than a method to withdraw.**

**(3) READING A has stronger evidence than section 3 reported, and it contradicts a registered
band.** Unreported here, measured on the committed rows: **`32/100` draws fall outside the
registered falsifier range `[0.97, 1.01]` (15 above, 17 below), and `9/100` meet the run's own
filing condition `LB > 1.01`. The range fires on roughly a third of clean calibration draws from
the lottery alone** — which is the sharpest statement available that the registered run's reading
was a draw, not a detection. Section 3's *"fires on roughly the upper decile of calibration draws"*
is **corrected: `15%` on the upper side, `32%` two-sided.**

And: **`74/100` draws fall outside K6A.1.12's registered per-calibration-draw band
`[0.985, 0.998]`**; measured p05–p95 is `[0.9609, 1.0229]`, **`4.77×` wider**. Filed as an erratum
to K6A.1.12 — **the BAND is wrong, not the field: the point prediction `0.9914` and the exact null
`0.991433` are CONFIRMED** by this study's `0.989903`. The other two per-draw bands in the same
table are right (detection excludes `8/100`, healthy `3/100`), so **one row is wrong, not the
method.** Section 5 and the prereg summary line *"every K6A.1.12 endpoint stands unchanged"* is
corrected accordingly: every endpoint, point prediction and verdict stands — that band does not.

**(4) Four errata.** K6A.6.5's readings B and C overlap (`gap > 1.96·SE` **and** run draw outside
support satisfies both) and the driver's B-first precedence was never registered — **not triggered
here**, `gap = −0.80` SE with the run draw inside support gives A unambiguously. `sd` was
unqualified: `n − 1` gives `−0.799` SE, `n` gives `−0.803`, **both select A**. E4's band comparison
is inclusive in the driver and unstated in the prereg — measured `0.03` **equals** the lower bound,
so an exclusive reading would make E4 a DEVIATION. E1's `+0.29 SE` used this study's measured SE;
against the registered `0.1416/sqrt(100)` the gap is **`+0.31` SE**, which is the denominator E1's
band was built from.
