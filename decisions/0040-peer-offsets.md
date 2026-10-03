# ADR 0040 — Designed-null kinds, part 3: declared per-peer offsets on the rank-among-peers kind (difference-in-differences)

- **Date:** 2026-10-03
- **Status:** PROPOSED. ACCEPTED only if study `2026-10-peer-offsets` (T1, registered beside this file
  before implementation) meets its ship rule. The real-telemetry companion is DeploySignal
  `2026-10-peer-offsets-gwdg` (T3 replay), registered separately, no authority.
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
