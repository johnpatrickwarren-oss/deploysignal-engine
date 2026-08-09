# K6-slow coverage battery `20260809T035934Z` — study report

The registered report for the K6-slow class, per PREREGISTRATION.md §11 rule 8 (every endpoint's
number and verdict) and rule 3 (post-hoc analysis in a labelled section carrying no verdict). It is
an **addition** to this run directory: `summary.json` and `manifest.json` as committed at `7842c49`
are unmodified, and every number below was generated mechanically from the committed JSON beside
this file and from the T2 arm's own committed JSON (`run-t2-20260809T040552Z`, committed at
`e62af91`), never transcribed by hand. No number here comes from a new run.

## 1. The stop conditions, checked before any power endpoint was read

Both registered T1 stop conditions and the T2 one cleared. **This section comes first because
K6A.1.10 requires it to**: a fired stop condition REFUTES `shape_ecdf_accumulator` on the record,
and a power reading taken before the checks would be a number nobody could act on.

| stop condition | registration | reading | fired? |
|---|---|---|---|
| null-growth screen | K6A.1.10 (2), driver v2.K6A.3 K6A.3.1 | **0/250 positive** at the registered 250 × 8000; `g_null` mean `-0.066692`, sd `0.013949`, max `-0.025749`, p99 `-0.034587` | **NO** |
| T1 healthy paging bound | K6A.1.10 (1) | arm 47 S2 `k = 108/2000`, `crossing_rate` `0.0540`, Wilson one-sided 95% LB **`0.046273`** ≤ α = 0.05 | **NO** (`not-refuted`) |
| T2 pooled healthy crossing | K6A.1.11 | `k = 8/600`, rate `0.013333`, pooled Wilson LB **`0.007528`** ≤ α | **NO** (`not-refuted`) |

**The screen's reading is recorded beside the paging bound because the registration says it must
be.** K6A.1.10: *"A fired T1 stop condition must therefore be reported with the null-growth
screen's reading beside it"* — screen-clean plus paging-fired is the calibration lottery's
signature, screen-dirty plus paging-fired is a construction defect. Here the bound did **not**
fire, and the screen is clean (`0/250`). But the POINT rate
`0.0540` **is above α**, so this calibration draw is one of the `≈7.9%` K6A.1.10
registers as paging above α by the lottery alone; the registered LB crossing point is a point rate
of `0.0585` and this draw sits below it. The same reading is on the S2 row itself as
`null_growth_screen: {draws: 250, positive: 0, g_null_max: -0.025749}`.

## 2. Every registered endpoint against its prediction (K6A.1.12)

Deviations are **recorded, not corrected** (§0 rule 2: a failed endpoint is a publishable result,
and nothing moves afterward).

| endpoint | prediction | registered band | measured | reading |
|---|---|---|---|---|
| cell 43 `mix-d1.0` detection | `0.0220` | `[0.010, 0.040]` | **`0.0190`** | inside |
| **cell 44 `mix-d1.5` canonical detection** | `0.62` | prediction `[0.333, 0.848]`; consistency `[0.333, 0.958]` | **`0.8515`** | **above p95, inside the consistency interval → CONSISTENT with the gate (K6A.2.4(a)), an upper-tail calibration draw, NOT a falsification** |
| cell 45 `mix-d2.0` detection | `1.0000` | `[0.999, 1.000]` | **`1.0000`** | exact; a boundary artifact, not shape sensitivity (K6A.1.8) |
| cell 46 `mix-d1.5-ar1` detection | `0.0000` | `[0.000, 0.002]` | **`0.0000`** | exact |
| cell 47 S2 healthy `crossing_rate` | `0.0181` | `[0.000, 0.056]` per draw | **`0.0540`** | inside, upper region; above α as `7.9%` of draws are |
| cell 47 S2 `increment_estimator.mean` | `0.9914` | `[0.985, 0.998]`; falsifier outside `[0.97, 1.01]` | **`1.024959`** | **OUTSIDE the falsifier range — a fired field-level falsifier on a field K6A.1.10 gives NO verdict authority. Its own one-sided 95% LB is `1.021567` > 1, so this is not noise about 1.** |
| cell 47 S2 `degenerate_windows` / `non_finite_wealth` | structurally 0 | — | **0 / 0** | confirmed |
| cell 47 S3 arm (`shift_sigma: 3` = `d = 2.0`) | `1.0000` → POWERED | `[0.999, 1.000]` | **`1.0000`** (`POWERED`) | exact — and see §3 |
| null-growth screen, 250 fresh draws | `0/250` positive | `0` | **`0/250`** | exact |
| T2 pooled healthy crossing | `0.0000` | `≤ α` | **`0.013333`** | **DEVIATES from the point prediction; the falsifier (the pooled bound) still clears — see §4** |
| T2 degenerate-reference skips | not predicted — a finding to make | — | **0 of 600** | disclosed per coordinate, folded into no denominator |
| T2 `t2_increment_mean` (K6A.2.6) | `0.960274` | `[0.94, 0.98]` | **`1.051073`** | **OUTSIDE the band — see §4** |

**One registered prediction has NO emitted endpoint.** K6A.1.12 predicts a median time-to-cross of
`4,950` ticks with band `[3,300, 5,700]`. The module returns `crossingIndex` per trajectory and the
harness adapter discards it, so no field in this run carries it, and no code item of K6A.1.13 or
K6A.2.1 registered one. **Not measured, and named here rather than left to a reader to notice.**

## 3. Arm 47's S3 row cannot evidence its own fault class

Registered as mechanism at Amendment v2.K6A.3 K6A.3.3, and confirmed by this run's own number.
At `d = 2.0` the mixture's component sd is `s = sqrt(1 − d²/4) = 0` exactly, so every one of the 40
windows returns the rank floor `p = 1/501`, `e = κ·501^(κ−1) = 4.924167`, and the wealth is a
CONSTANT independent of the data: this run reads `final_wealth_mean` **`4.935269342514437e+27`**,
identical to cell 45's `4.935269342514437e+27` on a different seed. A `3σ` MEAN STEP saturates
the identical rank, measured on the build: substituting `injectStep(delta = 3)` leaves the emitted
S3 row bit-identical. **So `S3 POWERED` proves the module fires, not what it fires on** — and the
card's route past `score.mjs:567`'s valid-but-inert `ADVISORY` cap runs through this row. The
cell-level half of the same dependency is K6A.2.2 (`mix-d2.0` carries the card's `USE`).

## 4. The T2 validity arm (K6.12's construction at K6A.1.11's m = 45)

`120` shards × `5` coordinates = **600 scored (shard, coordinate) pairs, 0 skipped**,
scenario seed `20260855`, `A = 2250` + `45` blocks of
`150` = the `9000` reference ticks exactly, `600/150` = 4 live windows.

| coordinate | k | n | `t2_crossing_rate` | `t2_increment_mean` | skips |
|---|---|---|---|---|---|
| `gpu_temp_c` | 8 | 120 | `0.0667` | `2.028722` | 0 |
| `power_w` | 0 | 120 | `0.0000` | `0.805449` | 0 |
| `sm_util` | 0 | 120 | `0.0000` | `0.804824` | 0 |
| `hbm_bw_gbps` | 0 | 120 | `0.0000` | `0.808205` | 0 |
| `nvlink_tx_gbps` | 0 | 120 | `0.0000` | `0.808167` | 0 |
| **pooled** | **8** | **600** | **`0.013333`** | **`1.051073`** | **0** |

**Two registered predictions deviate, and the split is the finding.** K6A.1.11 predicts pooled
healthy crossing `0.0000` on the derivation that a crossing needs `S_4 ≥ 14.2347` of a maximum
`4·log 46 = 15.3146` — all four live windows within a whisker of the `p`-floor. **Eight pairs did
exactly that, and all eight are `gpu_temp_c`** (`0.0667` on that coordinate, `0.0000` on the other
four). The derivation was under the null; this coordinate's live span is not exchangeable with its
own reference, which is precisely the contiguity question this arm exists to answer (K6.12 — the
question that killed `shape-kurtosis-e-value.ts`). K6A.2.6 predicts `t2_increment_mean = 0.960274`
in `[0.94, 0.98]`; the pooled reading `1.051073` is outside it and **averages a strongly
anti-conservative coordinate (`2.028722`) with four conservative ones (`0.8048`–`0.8082`)**. Neither
group is the `m = 45` null law. The `m` IS right — 45 blocks asserted per pair — so what this
measures is the substrate, not the geometry. **Reported with no verdict authority**: the T2 verdict
stays `t2_crossing_rate`-derived, and it cleared.

**And the near-vacuity K6A.1.11 disclosed in advance still stands as the frame for reading a T2
PASS here**: with `m = 45` and 4 live windows the per-window ceiling is `0.834782` nats, so a
crossing is possible only at window 4 and needs 93% of the theoretical maximum. A T2 PASS on
validity carries little information at `W = 150`; what the arm delivered instead is its skip
accounting (`0` of `600`) and the `p`-marginals above, which is what K6A.1.11 said it would.

## 5. The class answer, in the registered wording

The certification re-score (`validation/certification/results/run-20260809T040659Z`, the first
`report_format 6` run) scores this card **USE** at tier **T1** with `K6-slow` **COVERED** at the
canonical severity, rate `0.8515`, so COVERAGE.md's `K6-slow` row reads **YES**.

**Quoted from Amendment v2.K6A.2 K6A.2.4(b), the mirror rule, and this is the only wording this
result may be reported in:**

> a single-draw YES is reported as "class K6-slow YES at this calibration draw; gate
> `P(YES) ≈ 0.79`" and NEVER as a settled class answer.

**So: class K6-slow YES at this calibration draw; gate `P(YES) ≈ 0.79`.** The canonical reading
`0.8515` is above K6A.2.4(a)'s prediction-band p95 of `0.848` and inside its consistency
interval `[0.333, 0.958]`, which that section dispositions explicitly as **CONSISTENT with the
gate — an upper-tail calibration draw, NOT a falsification and NOT to be reported as one**. The
calibration-draw sd dominates the run's binomial noise by a factor of `13.0` (K6A.2.4c), which is
why the draw, and not the run, is the unit of uncertainty here.

**What this YES does not say**, each already registered: it is one calibration draw of a
distribution whose p05–p95 is `[0.333, 0.848]`; it rests on ONE detector, so `pairingGaps` names
this class (K6A.1.9's disclosed cost of a single-candidate row); its S3 arm cannot evidence its own
fault class (§3); and `K6` at the deploy-gate horizon stays **NO**, as does v2.K6A's `H = 3,000`
refutation of this same construction, which is not withdrawn.

## 6. Post-hoc, carrying no verdict (§11 rule 3)

`p_uniformity` on the S2 arm pools `80000` values (`2000 × 40`, as registered) with KS
statistic `0.041150` against critical `0.0048083` — `8.6×` the critical value, deciles
`[8840, 7655, 7233, 7283, 7512, 6667, 9812, 9155, 7423, 8420]`. K6A.1.10 gives this field no verdict authority (`p` is discrete on
501 values) and K6A.1.12 registers no band for the KS statistic, so it is reported and decides
nothing. It points the same way as the `increment_estimator.mean` of `1.0250` and the healthy rate
of `0.0540`: **on this calibration draw the null is not sitting where the exact law says it should.**
That is a statement about one draw, it is what the registered per-draw bands exist to absorb, and
no endpoint moves because of it.

