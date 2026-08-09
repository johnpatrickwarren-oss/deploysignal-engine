# T2 arm `run-t2-20260809T075607Z` — the strided reference: the flip does NOT collapse

The registered T2 rerun of Amendment **v2.K6A.7**, executing the ratified C50 ruling
(`knowledge/methodology/pages/t2-reference-placement.md`). Every number below is read from this
directory's committed `summary.json` and `manifest.json`. Engine pin `0.6.6-pre`, node `v25.9.0`,
harness sha `5224f92064a1a130a59d5f218a3d6e053ff32975`, scenario seed `20260855`, mode `live`,
`120` shards x `5` coordinates, `0` skips.

Geometry, from the manifest: `reference_a_layout: 'strided'`, `reference_a_stride: 4`,
`reference_a_phase: 0`, `reference_a_ticks: 2250`, `n_reference_blocks_registered: 45`, `w: 150`
— A = reference ticks `{0, 4, ..., 8996}`, B = ticks `[2250, 9000)` in 45 contiguous 150-tick
blocks, live = ticks `[9000, 9600)` in 4 windows.

## 1. The stop condition, read first (K6.13 / K6A.7.8)

```
pooled  k = 8   n = 600   t2_crossing_rate = 0.013333333333333334
        t2_pooled_lower_95 = 0.007528366862782477      t2_verdict = not-refuted
        skipped_count = 0
```

**NOT FIRED — CLEARED.** The condition fires at `t2_pooled_lower_95 > alpha = 0.05`, i.e. at
`k >= 39` of `600` (K6A.7.8's registered threshold: `k = 39` gives `0.050319`, `k = 38` gives
`0.048856`). At `k = 8` the bound is `0.007528`. `shape_ecdf_accumulator` is **not refuted** on the
T2 validity arm. Both the pooled rate and the pooled bound match their registered point predictions
exactly, to every digit.

## 2. Every registered endpoint against its band

| endpoint | predicted | band | measured | |
|---|---|---|---|---|
| `gpu_temp_c` crossings | **`8`** | `[2, 20]` | **`8` / 120** | **HELD** |
| `power_w` crossings | `0` | `[0, 30]` | `0` / 120 | HELD |
| `sm_util` crossings | `0` | `[0, 2]` | `0` / 120 | HELD |
| `hbm_bw_gbps` crossings | `0` | `[0, 2]` | `0` / 120 | HELD |
| `nvlink_tx_gbps` crossings | `0` | `[0, 2]` | `0` / 120 | HELD |
| pooled `t2_crossing_rate` | `0.013333` | `[0.0033, 0.0533]` | `0.013333` | HELD |
| pooled `t2_pooled_lower_95` | `0.007528` | `< 0.05` | `0.007528` | HELD |
| the T2 stop condition | CLEARS | — | CLEARED | HELD |
| `gpu_temp_c` `t2_increment_mean` | `1.9343` | `[1.4308, 2.4150]` | `2.029962` | HELD |
| `power_w` `t2_increment_mean` | `0.7945` | `[0.7392, 0.8486]` | **`0.993144`** | **DEVIATION, above** |
| `sm_util` `t2_increment_mean` | `0.8191` | `[0.6987, 0.9509]` | `0.926630` | HELD |
| `hbm_bw_gbps` `t2_increment_mean` | `0.8343` | `[0.7160, 0.9462]` | `0.916402` | HELD |
| `nvlink_tx_gbps` `t2_increment_mean` | `0.8502` | `[0.7422, 0.9502]` | `0.889226` | HELD |
| pooled `t2_increment_mean` | `1.0512` | `[0.9143, 1.1014]` | **`1.151073`** | **DEVIATION, above** |
| degenerate-reference skips | `0` | — | `0` | HELD |
| `n_reference_blocks` / `n_live_windows` | `45` / `4` | — | `45` / `4` on all 600 | HELD |

**14 of 16 held; 2 deviated, both above, and the second is the first's consequence.** The deviations
are recorded, not corrected: `power_w`'s increment mean came in at `0.993144` against a band whose
top is `0.8486`, and since the pooled figure is the unweighted mean of all 600 pair-means (K6A.7.5),
`power_w` carries the pooled row out of its band too. **No band and no point prediction is adjusted
after the fact.** The band's construction is where the miss lives: K6A.7.8 built each coordinate's
band as the registered seed's own front-A value times the min/median/max strided-to-front ratio over
12 fresh seeds, and `power_w`'s realized ratio (`0.993144 / 0.805449 = 1.2330`) is **outside** the
`[0.9177, 1.0536]` the 12 probe seeds spanned. Twelve seeds did not bracket it.

## 3. The flip does NOT collapse — and it is the same eight shards

The ratified page's execution sentence expects that "with strided A the front/back flip must
collapse". **It does not.** K6A.7.8 registered two competing hypotheses with near-disjoint bands
before this run:

| | prediction | measured | |
|---|---|---|---|
| **H_substrate** (registered) | `8`, band `[2, 20]` | **`8`** | **HOLDS** |
| H_placement (the page's expectation) | `[0, 3]` | `8` | **REFUTED** |

And the reading is sharper than the count. **The eight `gpu_temp_c` shards that cross under strided A
are the same eight that crossed under front-A — intersection 8, strided-only 0, front-only 0.**
Striding A changed which reference the statistic is built against, and the crossing set did not move
at all. Recomputed from the superseded run's own committed `summary.json` beside this one's.

So the A-placement DOF was real — moving A to the back erased all eight crossings, which the confound
append measured and this run does not dispute — **and it was not what produced them.** Both facts
hold: front-A and back-A disagree, and front-A and strided-A agree exactly.

## 4. K6.12's contiguity question, answered as K6A.7.9 registered it

**The registered question:** with the A-placement degree of freedom closed, does any coordinate
depart from block-exchangeability between the live span and the reference span's blocks?

**Answer: `gpu_temp_c` departs. The other four do not. The construction is not refuted.**

**First, a registration gap, stated before the answer, because K6A.7.9's four outcomes do not cleanly
contain what happened.** Outcome 1 required all five coordinates inside their bands (`power_w` is
not). Outcome 2 described `gpu_temp_c` *alone outside its band* with crossings in `[2, 20]` — but
`gpu_temp_c` is **inside** its band and it is `power_w` that is outside, with zero crossings. Outcome
3 (crossings `<= 3` everywhere) and outcome 4 (pooled LB `> 0.05`) are both plainly not the case.
**The realized result is outcome 2's substance reached through a different row than the enumeration
anticipated, and the enumeration is registered as incomplete rather than stretched to fit.**

**The evidence for the `gpu_temp_c` departure, with both framings, because they disagree in emphasis
and only one of them is the contiguity question.**

- **Against the detector's registered `alpha = 0.05` budget: consistent, no departure.**
  `gpu_temp_c`'s own crossing rate is `8/120 = 0.066667`, whose one-sided Wilson 95% lower bound is
  **`0.037967 <= alpha`**. By Ville's inequality the null crossing probability is bounded by `alpha`,
  and `0.0667` with that bound is not evidence against it. **This is why nothing is refuted.**
- **Against what this geometry can actually attain under exchangeability: a decisive departure.**
  K6A.1.11 registered the `W = 150` crossing endpoint as very nearly vacuous, and K6A.7.3 measured
  how vacuous on an i.i.d. substrate at exactly this geometry: **`0` crossings in `120,000` draws**
  (`n_A = 2250`, `m = 45`, 4 windows), a one-sided 95% bound of about `2.5e-5` per pair. Expected
  crossings over 120 pairs: **at most `0.003`. Observed: `8`.** A crossing needs `p = 1/46` at three
  of the four windows (K6A.7.3's arithmetic), and `gpu_temp_c` reaches it on 8 of 120 shards.

**The second framing is the contiguity question and the first is not.** C22 asks whether the live span
is exchangeable with the reference blocks, not whether the detector busts its error budget. A
construction can stay inside `alpha` and still be reading a substrate that violates its
exchangeability premise — and at an endpoint this near-vacuous, `alpha` has almost no power to
notice. **So: the `gpu_temp_c` deviation the superseded run recorded is NOT explained by A placement,
and it survives a placement-free reference.** It is filed as a real per-coordinate finding about
`gpu_temp_c` on clustersynth telemetry, and **not** as a refutation of `shape_ecdf_accumulator`,
because the pooled row is what K6.13 gives verdict authority to and it cleared.

**`power_w`'s increment deviation is a second, weaker signal in the increment field only** — above its
band with zero crossings, so it moves no verdict. Recorded, not interpreted further: one coordinate
outside one band on one scenario draw is not a finding this run is powered to make.

**What this answer does not license** (K6A.7.9, unchanged): the B-placement DOF stays open, so this is
a reading at `B = [2250, 9000)` and not at every contiguous B (K6A.7.4 measured `25/1440` against
`7/1440` `gpu_temp_c` crossings across the two choices on fresh seeds). The `+0.0121` overlap bias on
`t2_increment_mean` (K6A.7.3) is subtracted from nothing here and explains no deviation larger than
itself — `power_w` missed its band by `0.1445`, twelve times the bias.

## 5. The increment estimator's pooling, as K6A.7.5 registered it

The registered estimator is the arithmetic mean of pair-means at all three levels, and this run's
figures show again why the definition had to be pinned:

```
pooled t2_increment_mean, as the code computes it (mean over 600 pair-means)   1.151072824998006
unweighted mean of the five coordinate means                                  1.151072824998006
   -> identical only because every coordinate scored n = 120 with 0 skips
median of the 600 pair-means                                                  0.925653
geometric mean of the 600 pair-means                                          1.085561
gpu_temp_c 2.029962 against the mean of the other four 0.931351            =   2.180x
```

The pooled row lands outside its band at `1.151073`; the **median** of the same 600 numbers is
`0.925653`, which would sit inside it. **No re-pooling is performed.** K6A.7.5 registered the
arithmetic mean as operative before this run and it stays operative after it.

## 6. Supersession

This run's manifest declares, detector-scoped:

```
study coverage-t2-clustersynth   run run-t2-20260809T040552Z   detectors [shape_ecdf_accumulator]
```

Verified against `validation/certification/lib/collect.mjs`: **606 cells dropped** from
`run-t2-20260809T040552Z` for `shape_ecdf_accumulator`, `source: manifest`; the sibling T2 run
`run-t2-20260808T121710Z` (which scores `shape_block_conformal_bet`) is untouched. **Corpus census
unchanged at `2266` cells across `47` runs** — the replacement emits the same `600 + 5 + 1` rows the
superseded run did, which K6A.7.7 registered as arithmetic rather than discovering here. The
superseded directory is preserved byte-for-byte and its confound append stands as the record of the
degree of freedom.

## 7. Confirmation of a registered figure, at 12x the sample

K6A.7.3 registered the overlap bias from `R = 10,000` i.i.d. draws. The same probe at **`R = 120,000`**
confirms every figure and sharpens the pairing:

```
PAIRED overlap - disjoint              delta E[e] = +0.012142 +- 0.000223  (54.40 SE)
PAIRED overlap - strided_independent_A delta E[e] = +0.012273 +- 0.000250  (49.03 SE)
overlap                 mean e = 0.972328   (+24.91 SE vs the exact null 0.960274)   P(p<=1/46) = 0.0237
disjoint                mean e = 0.960186   ( -0.19 SE)                              P(p<=1/46) = 0.0217
strided_independent_A   mean e = 0.960055   ( -0.46 SE)                              P(p<=1/46) = 0.0217
crossings: 0 / 120,000 in ALL THREE ARMS
```

The registered `+0.012070 +- 0.000771` becomes `+0.012142 +- 0.000223`. The two non-overlap arms
reproduce the exact null to `0.19` and `0.46` SE and match the uniform-grid `P(p <= 1/46) = 0.021739`
to four decimals, which is what makes the overlap arm's `+1.26%` a real asymmetry rather than a probe
artifact. **K6A.7.3's contradiction with the ratified page's "validity is untouched" stands and is
strengthened.** The crossing endpoint remains untouched by it: `0` of `120,000` in every arm.

## 8. What did not move

`shape_ecdf_accumulator`'s card tuple, every other card's tuple, every `COVERAGE.md` row, the T1
arm's constants, cells, seeds and predictions, `K6 = NO` at the deploy-gate geometry, and the
`K6-slow YES at this calibration draw` reading. T2 rows carry no `fault_class` and none of the field
names `isValidityCell`/`isPowerCell` test, so they are candidates for nothing scored — K6A.7.7
registered that prediction against the code and section 4's finding does not change it.
