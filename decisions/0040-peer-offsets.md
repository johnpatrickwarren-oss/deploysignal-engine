# ADR 0040 — Designed-null kinds, part 3: declared per-peer offsets on the rank-among-peers kind (difference-in-differences)

- **Date:** 2026-10-03
- **Status:** REJECTED 2026-10-03 as registered. Study `2026-10-peer-offsets` run `run-20261003T135637Z`:
  **ship rule NOT MET** — exact offsets hold (0.000 over 2,000 ticks at 1.5× and 3× gaps), estimated
  offsets hold without wander (0.000) and under a ±10% wander of a 1.5× gap (0.0029), but cell
  EST-g2.0-n rolled back 0.3059 (bar 0.0556) and power at Δ 0.04 was 0.9349 by tick 60 against 0.95.
  **Corrected the same day:** the failing cell's second peer was scaled by 1 + (−g/2) = 0 at g = 2.0, a
  degenerate peer whose estimated offset is garbage; the registered generator, not the gap's wander, is
  the measured reason (`validation/peer-offsets/REPORT.md`, Correction). The rejection stands as
  computed. Superseded by ADR 0041 (a per-peer margin floor from the pre-window's spread, with the
  generator corrected). The `offsets` field stays unreleased until ADR 0041's study rules.
- **Register:** ADR 0039; DeploySignal study `2026-10-peer-offsets-gwdg`'s predecessor
  `2026-10-peer-rank-gwdg` (26 of 44 healthy GPU windows rolled back against node-mates: two working,
  two idle, a two-fold spread no margin up to 100% absorbs); the 2026-10-03 design note (John): remove
  persistent unit offsets by comparing the changed unit's gap to its peers after the change with its
  gap before.

## The gap

ADR 0039's premise is exchangeability of the unit with its peers up to the margin. On the GWDG
cluster it fails by construction of the workload: a GPU that is persistently 40 °C hotter than a mate
is not a regression, and a margin wide enough to pass it sees nothing. What is stable is the *gap*:
if the unit ran 40 °C hotter than mate j before the change, the question after the change is whether
it runs more than 40 °C plus a margin hotter than mate j now.

## Decision

`PeerRankObservation` gains an optional `offsets?: readonly number[]`, one relative offset per peer,
declared by the caller: peer j's reference value becomes `peer_j · (1 + offsets[j])` before the band is
applied. `offsets` absent or 0 is ADR 0039 exactly. The engine does not estimate the offsets: the
consumer computes them from a pre-change window in which the unit and its peers ran concurrently (the
median of `unit / peer_j − 1` over that window per signal, in the companion study) and states the
premise: **the unit's relative gap to each peer is the same after the change as in the pre-window, up
to the margin.** The construction's null is then exchangeability of the residual, and the estimated
quantity, one median per peer per signal from concurrent data, cancels time effects by construction;
what it does not cancel is a change in the gap that is not the change under test, which the margin
and a per-fleet A/A carry.

## Rejected

- *Estimating the offset inside the engine from a running window.* Rejected: it would make the null
  depend on a quantity the detector itself tunes while scoring, which is the estimated-null pattern
  this series exists to leave.
- *Additive offsets.* Deferred: the GWDG spread is multiplicative in the signals that fired
  (temperature, power); an absolute offset is one line and can follow with its own cell.
- *Peers chosen by workload.* Not available on the dataset at hand (no job labels per GPU); noted.

## Ship rule

Study `2026-10-peer-offsets` E1–E4 hold: validity with exact offsets under persistent per-peer gaps
of 0.5 and 2.0; validity with offsets estimated from a pre-window of 576 ticks under AR(1) gap noise
with a 2% margin; ADR 0039 reproduced at offsets 0; power at twice the margin above the offset. Then
`v0.16.0-pre`; otherwise REJECTED with the figure.
