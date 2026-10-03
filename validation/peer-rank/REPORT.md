# Report — the rank-among-peers kind (`2026-10-peer-rank`, ADR 0039, T1)

- **Registration:** `PREREGISTRATION.md` at `1129db3` with ADR 0039, before implementation; Amendment 1 at
  `fc71953` (validity cells run the rollback bet to T; proceed recorded, not terminal), found at the
  harness smoke and before run 0. Harness `af805e8`. **Stated:** the commit `fc71953` claimed to carry the
  amendment in the harness and did not (a scripted edit failed before writing); its run finished in 3 s,
  was recognised as truncated, and was discarded without being committed. `af805e8` carries the amendment.
- **Run:** `results/run-20261003T131016Z/`, engine `af805e8` (`0.14.0-pre` plus ADR 0039, unreleased),
  R = 10,000, seeds `lcg(20261003 + 7919·i)`, 2 min 17 s.
- **Verdicts:** E1 PASS, E2 PASS, E3 PASS, E4 PASS. **Ship rule MET.**

## 0. The headline

| Cell | N | m | δ | Δ | T | Rollback | By tick 60 | Rollback tick: median, IQR, p90 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| S2-rep | 2 | 0.02 | 0 | 0 | 300 | 0.0000 | — | — | **E2 PASS** (max relative wealth difference from the sign kind 0) |
| V4-m0.02 | 4 | 0.02 | 0 | 0 | 2000 | 0.0000 | — | — | **E1 PASS** (bar 0.0556) |
| V16-m0.02 | 16 | 0.02 | 0 | 0 | 2000 | 0.0000 | — | — | PASS |
| V4-d0.01 | 4 | 0.02 | 0.01 | 0 | 2000 | 0.0001 | — | 22 | PASS |
| V4-d0.018 | 4 | 0.02 | 0.018 | 0 | 2000 | 0.0405 | 0.0356 | 25, 17–41, 70 | PASS |
| M4-m0-d0.01 | 4 | 0 | 0.01 | 0 | 2000 | 1.0000 | 0.9129 | 23, 15–37, 58 | reported |
| P4-r0.04 | 4 | 0.02 | 0 | 0.04 | 300 | 0.9999 | 0.9999 | 12, 10–15, 20 | **E3 PASS** |
| P16-r0.04 | 16 | 0.02 | 0 | 0.04 | 300 | 1.0000 | 1.0000 | 12, 11–14, 17 | reported |
| P4-r0.03 | 4 | 0.02 | 0 | 0.03 | 300 | 1.0000 | 0.9139 | 24, 16–38, 57 | reported |
| Q4-r0.01 | 4 | 0.02 | 0 | 0.01 | 300 | 0.0003 | — | — | **E4 PASS** (proceed 0.9997, median tick 14) |

## 1. Readings

Under exchangeable peers the kind never rolled back in 20,000 runs of 2,000 ticks at N = 4 and 16.
A persistent offset of half the margin cost one rollback in 10,000; an offset of 0.9 of the margin
cost 4.05%, under the bound and in the registered range. Without a margin the same half-margin
offset rolls back every run (1.000, median tick 23): the mechanism the GPU study met against each
unit's own history is reproduced here against peers, and the margin is what removes it. At N = 2
the kind is the sign kind wealth for wealth. Power at twice the margin is 0.9999 by tick 60 with a
median of 12 at both N = 4 and N = 16; the larger peer group tightens the spread (p90 17 against 20)
without moving the median. A sub-margin regression proceeds in 0.9997 of runs at a median of 14.

## 2. Predictions against results

P1 held (0.000, 0.0001, 0.0405 against 0.00–0.03 and 0.03–0.05). P2 exact. P3 held on the bar; the
median of 12 was under the predicted 15–30, and N = 16 was not faster in the median (predicted 10–20,
observed 12): averaging 15 comparisons sharpens the tail, not the centre. P4 held. P5 held (1.000
against ≥ 0.90).

## 3. Consequences

ADR 0039 ACCEPTED; `v0.15.0-pre` ships `detectors/peer-rank.ts`. The real-telemetry companion,
DeploySignal `2026-10-peer-rank-gwdg`, replays the kind over the GWDG units with their node-mates as
peers on the same null and detection windows the temporal path was measured on; its result informs
the DeploySignal eligibility rule and not this ADR.

## 4. Not measured

Peer heterogeneity beyond the margin; peers degrading together; missing peers; Bonferroni across
signals; varying peer counts; any real telemetry.
