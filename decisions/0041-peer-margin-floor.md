# ADR 0041 — Designed-null kinds, part 3b: declared per-peer offsets with a margin floor from the pre-window's own spread

- **Date:** 2026-10-03
- **Status:** PROPOSED. ACCEPTED only if study `2026-10-peer-offsets-2` (T1, registered beside this file
  before implementation) meets its ship rule. Supersedes ADR 0040 (REJECTED as registered: a fixed 2%
  margin did not cover a ±10% wander of a 3× gap, 0.3059 false rollback).
- **Register:** ADR 0039, ADR 0040 and `validation/peer-offsets/REPORT.md`; DeploySignal
  `2026-10-peer-rank-gwdg` (26 of 44); the companion `2026-10-peer-offsets-gwdg` (T3, registered separately).

## Decision

`PeerRankObservation` gains, beside `offsets`, an optional `margins?: readonly number[]`: one relative
margin per peer. The band for peer j uses `max(spec.margin.relative ?? 0, margins[j])`, so a per-peer
margin can only widen the band. Widening the band lowers x, so under the spec's own null the rollback
bet remains valid (E[x] can only fall). The consumer derives `margins[j]` from the **same pre-window as
`offsets[j]`**: with r_t = unit_t / peer_j,t − 1 over the pre-window, `offsets[j] = median(r)` and
`margins[j] = quantile_q(|r_t − median(r)|)` for a declared q (the companion uses 0.90). The premise the
consumer states becomes: **the unit's gap to each peer after the change lies within the range it
occupied before the change, up to the declared quantile.** Nothing is estimated inside the engine.

## Rejected

A floor from a parametric spread (σ of r): the GWDG gaps are not Gaussian (two regimes). A floor
shared across peers: the pairs differ.

## Ship rule

Study `2026-10-peer-offsets-2` E1–E4: validity with estimated offsets and floors under ±10% wander at
1.5× and 3× gaps (the cell that rejected ADR 0040), and without wander; ADR 0039 reproduced at zero
offsets and margins; power at twice the realized floor; sub-floor proceed. Then `v0.16.0-pre` ships
`offsets` and `margins` together; otherwise REJECTED with the figure.
