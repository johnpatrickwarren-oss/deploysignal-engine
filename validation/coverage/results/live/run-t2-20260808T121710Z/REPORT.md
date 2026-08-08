# Coverage battery `run-t2-20260808T121710Z` — study report (T2 clustersynth arm)

The registered report for this run, per PREREGISTRATION.md §11 rule 8 and rule 3. It is an
**addition** to this run directory: `summary.json` and `manifest.json` as committed at
`5983ebd` are unmodified. Every number below is read off the committed `summary.json` beside
this file.

Written 2026-08-08 in the final fix wave.

**THIS RUN IS EXEMPT FROM THE C1 RERUN, and the reason is that the defect cannot reach it.**
Amendment v2.C1 names a code defect in `run-battery.mjs`'s `heldoutRows`. This arm runs
`validation/coverage/harness/run-clustersynth-arm.mjs`, which never calls it: its reference
blocks are **per-shard prefixes of the shard's own coordinate series**, the construction K6.12
registers. Nothing here is superseded and nothing was rerun. C1 therefore makes this arm the
**stronger of the two K6 validity readings**, and Amendment v2.C1 C1.5 records that ordering
explicitly.

| field | value |
|---|---|
| run id | `run-t2-20260808T121710Z` |
| harness | `validation/coverage/harness/run-clustersynth-arm.mjs` (T2, validity-only per K6.12) |
| `git_sha` at run | `b8b748e8106ff91d519e6afa89c5dd21fc164d51` |
| tier | T2 (clustersynth — the generator the detectors were not tuned against) |
| rows emitted | 606 |
| held-out mechanism | per-shard prefix of the shard's own series; `heldoutRows` is not called |

## 1. The registered census and the endpoint

606 rows = 600 healthy pairs + 5 coordinate rows + 1 pooled row, the registered
census. Every pair carries `n_reference_blocks = 300` and `n_live_windows = 20`.

**THE ENDPOINT: 0 of 600 healthy pairs fired.** Pooled `k = 0`, `n = 600`,
`t2_pooled_lower_95 = 0.0000 <= alpha = 0.05`, `t2_verdict = not-refuted`. K6.13's T2 stop
condition did not fire.

**This is the C22-fix vindication, against the predecessor's own graveyard.**
`detectors/shape-kurtosis-e-value.ts` — marked DO NOT WIRE — fired on **82% of healthy
clustersynth shards** on the same generator. The construction's answer to that failure is
contiguity: reference blocks are disjoint contiguous slices, so each block carries its own
within-block serial dependence and validity does not require knowing φ. 0 of 600 is that answer
measured.

## 2. Guard trips: 0, with the mechanism recorded

`assertNonDegenerate` tripped on **0** pairs. The reason is not that the guard is inert but that
this scenario's coordinates are unquantized — 300 distinct values per 300 ticks — so there is
nothing for it to trip on. Recorded because a 0 with no mechanism attached is indistinguishable
from a guard that cannot fire.

## 3. The zero is a measurement, not a vacuous path — and its margin

A zero crossing rate can also be produced by a silently-degenerate path: `featureResult` returns
the neutral `e = 1` on a non-finite live statistic, so an all-constant live window would hold
wealth at exactly 1 and never cross, indistinguishable in `summary.json` from genuine validity.
Checked directly across all 600 pairs:

- **non-finite `p`: 0 of 24,000.** The neutral pathway never engaged.
- per-window `eAvg` genuinely varies (spot pairs 0.102–7.000); 34–39 distinct `p` values per
  pair over its 40 draws.
- **max prefix log-wealth across all 600 pairs: min −2.2612, p50 −1.7479, p99 −0.5773, max
  −0.3772**, against the bar `log(20) = 2.995732273553991`.

## 4. The wealth floor at the 20-window span — I1's reasoning, in the right order

`LOG_WEALTH_FLOOR_K6 = log(1e-12) = −27.6310` is reached on **523 of 600 pairs (87.2%)**. This is
exactly the condition Task 6's carry flagged — "wealth floor `log(1e-12)` binds at window 12,
unreachable at the 6-window span, note for any longer-span variant" — and T2, at 20 windows, is
that variant.

**The protection is a measurement, stated first: the closest pair finished 3.372932 nats short of
the bar** (`log(20) = 2.995732273553991` minus the maximum prefix log-wealth `−0.3772`,
recomputed). Not one pair came near firing, floor or no floor.

**The direction argument is then a fortiori, and second:** the floor clamps wealth from **below**,
while every endpoint in this study is an **upper**-bar crossing. Removing the floor could only move
trajectories further from the bar, so a floor-free run has at most the observed crossings — and the
observed count is zero. The floor cannot manufacture this clean validity reading; the 3.37-nat
margin is what rules that out directly, and the direction argument only rules out the reverse.

## 5. Post-hoc observations (labelled, no verdict)

- **K6.1.2's closed-form conservativeness claim is CONFIRMED here and CONTRADICTED on T1.** The
  same formula, two signs: T2 measured `P(p <= 0.05) = 0.01671` (conservative, as registered);
  T1 measured 0.10017 under the lattice reference and 0.050167 after the C1 fix, with the KS test
  still rejecting uniformity at 0.0229 against critical 0.0088. Amendment v2.C1 C1.5 registers the
  residual as expected and unexplained, carrying no verdict, filed for write-back.
- **`increment_estimator` does not meet K6.7's filing condition.** Its one-sided lower 95% bound
  is 0.7947, not `> 1`, so `stats/terminal-mean-rule-contested` gains nothing from this arm.
- **This arm carries the T2 tier, and the C1 defect never touched it.** Of the two K6 validity
  readings, this is the one whose substrate was never in question.
