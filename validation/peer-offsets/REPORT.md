# Report — declared per-peer offsets on the rank kind (`2026-10-peer-offsets`, ADR 0040, T1): ship rule NOT MET

- **Registration:** `PREREGISTRATION.md` at `ff8511f` with ADR 0040, before implementation; no amendment;
  harness `4840da7`. **Run:** `results/run-20261003T135637Z/`, engine `4840da7` (`0.15.0-pre` + ADR 0040,
  unreleased), R = 10,000, 3 min 45 s. Verdicts as computed; no bar moved.
- **Verdicts:** E1 PASS, E2 **FAIL**, E3 PASS, E4 **FAIL**. **Ship rule NOT MET. ADR 0040 is REJECTED as
  registered.** The code stays on its branch, unreleased.

## 0. The headline

| Cell | g | offsets | wander | m | Δ | T | Rollback | By 60 | Tick median, IQR | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| R-off0 | 0 | zero | no | 0.02 | 0 | 300 | 0.0000 | — | — | **E3 PASS** (wealth-for-wealth ADR 0039) |
| NG-g0.5 | 0.5 | none | no | 0.02 | 0 | 2000 | 0.0000 | — | — | reported |
| EX-g0.5 | 0.5 | exact | no | 0.02 | 0 | 2000 | 0.0000 | — | — | **E1 PASS** |
| EX-g2.0 | 2.0 | exact | no | 0.02 | 0 | 2000 | 0.0000 | — | — | PASS |
| EST-g0.5 | 0.5 | estimated | no | 0.02 | 0 | 2000 | 0.0000 | — | — | PASS |
| EST-g0.5-n | 0.5 | estimated | ±10% | 0.02 | 0 | 2000 | 0.0029 | — | 20, 18–27 | PASS |
| EST-g2.0-n | 2.0 | estimated | ±10% | 0.02 | 0 | 2000 | **0.3059** | 0.1273 | 88, 32–659 | **FAIL** (bar 0.0556) |
| EST-g0.5-n-m0.10 | 0.5 | estimated | ±10% | 0.10 | 0 | 2000 | 0.0000 | — | — | reported |
| P-g0.5-r0.04 | 0.5 | estimated | ±10% | 0.02 | 0.04 | 300 | 0.9640 | **0.9349** | 16, 12–25 | **FAIL** (≥ 0.95 by 60) |
| P-g2.0-r0.04 | 2.0 | estimated | ±10% | 0.02 | 0.04 | 300 | 0.9996 | 0.9324 | 15, 11–25 | reported |
| Q-g0.5-r0.01 | 0.5 | estimated | ±10% | 0.02 | 0.01 | 300 | 0.0397 | — | proceed 0.9603, median 15 | PASS |

## 1. Readings

**Where the construction holds.** With the gap known exactly, a unit sitting among peers 1.5× and 3×
apart never rolled back in 20,000 runs of 2,000 ticks (E1). With the gap estimated as the median over a
576-tick concurrent pre-window and no wander, the same (EST-g0.5). With a ±10% wander of a 1.5× gap
against a 2% margin, 0.0029. The reproduction at zero offsets is exact.

**Where it fails, and why.** A 3× gap wandering by ±10% moves peer j's scaled reference by about ±7%
of the unit's value, against a 2% band: the residual is not exchangeable up to the margin, and the
kind rolled back 30.6% of the time, with a quarter of those after tick 659, which is the Ville bound
failing slowly rather than a burst. The same wander at a 1.5× gap moves the reference by about ±3%,
and 0.0029 is the result. At a 10% margin the ±10% wander of the 1.5× gap costs nothing (0.0000). The
registered premise, "the gap is the same after the change as in the pre-window, up to the margin",
was violated by the registered generator for one cell, and the registered margin did not cover it.
The construction is sound where the premise holds and the registration chose a cell where it does not.

**Power.** At twice the margin with estimated offsets under wander, 0.9349 detected by tick 60 against
a bar of 0.95; 3.6% of runs proceeded first (the sub-margin proceed side at τ 0.1 reads the wandering
residual as "within tolerance" early). The median tick (16) is near ADR 0039's 12; the loss is in the
tail (p90 40 against 20). Q held (proceed 0.9603, rollback 0.0397 under B).

**NG-g0.5**, the unadjusted comparison, rolled back 0 of 10,000. I registered "expected to roll back
nearly always"; wrong, because with gaps (g, −g/2, 0) the unit sits between its peers and scores ⅓
every tick, under ½. The GWDG units that rolled back were above or below all three mates. The cell
measures nothing about the offsets and is reported as such.

## 2. Predictions against results

P1 held (0.000). P2's first clause held (EST without wander 0.000) and its hard case split: EST-g0.5-n
0.0029 (predicted 0.02–0.05, so better), EST-g2.0-n 0.3059 (predicted to be at most "exceeds B", and it
exceeded it six-fold); the clause "if EST-g0.5-n exceeds B the ADR states the margin must cover the
wander" applies to the g 2.0 cell instead. EST-g0.5-n-m0.10 0.0000 as predicted. P3 exact. P4 failed
on the bar (0.9349 against 0.95); the median 16 was in the predicted 12–20. The NG prediction was wrong
in reasoning (§1).

## 3. Consequence

ADR 0040 REJECTED as registered. The measured reason: a fixed declared margin does not cover a gap
whose wander is larger than the margin, and the wander is a property of the pair, knowable from the
same pre-window the offset comes from. The successor, ADR 0041, derives a margin floor per peer from
the pre-window's own spread of the gap (a declared quantile of |unit/peer − 1 − median|), so the premise
"the gap after is as it was before, up to its own observed variability" is what the consumer states.
The `offsets` field itself is unchanged and stays unreleased until ADR 0041's study runs.

## 4. Not measured

Additive offsets; other peer counts; a gap that changes direction; shorter pre-windows; any real
telemetry.
