# ADR 0039 — Designed-null kinds, part 2: the rank-among-peers kind

- **Date:** 2026-10-03
- **Status:** PROPOSED. Becomes ACCEPTED only if study `2026-10-peer-rank` (T1, registered beside this
  file before any implementation) meets its ship rule; its real-telemetry companion is DeploySignal
  study `2026-10-peer-rank-gwdg` (T3 replay), registered separately and carrying no authority.
- **Register:** ADR 0036 (the twin's `sign` kind, which this generalizes), ADR 0037 (the margin), ADR
  0038 (part 1); knowledge `stats/gwdg-gate-2026-09-29` (Family A alone rolled back 40 of 44 healthy
  GPU windows against each GPU's own history); the 2026-10-03 note: peers at the same time are a
  stronger null than the unit's own past.

## The construction

A unit u and N − 1 peers observed on the same signal at the same tick. Under **exchangeability** of
the unit with its peers, the unit's rank among the N is uniform, so for each peer j,
P(u is worse than j) = ½, and with a margin P(u is worse than j by more than the margin) ≤ ½.

`detectors/peer-rank.ts`: `PeerRankSpec { id, worse: 'higher' | 'lower', tolerance: τ ∈ (0, ½),
margin?: { relative?, absolute? }, alpha }`, `stepPeerRank(spec, state, { unit, peers: number[] })`.
Per tick, over the finite peers, x = (number of peers the unit is worse than, beyond the margin) /
(number of finite peers), in [0, 1]. Rollback null mean ½ (E[x] ≤ ½ under exchangeability with the
margin's one-sidedness, the ADR 0037 argument summed over peers); proceed null ½ + τ. Two paired
bets, as the sign kind. A tick with fewer than one finite peer, or a non-finite unit value, is
counted (`skipped` / `missing`) and not scored; there is no missingness penalty here because
nothing in this construction is a two-arm split. Fires at wealth ≥ 1/α; the caller applies
Bonferroni across signals. **N = 2 is the sign kind**: the study's reproduction cell checks score
for score.

## What the margin does here

A persistent unit-level offset smaller than the margin (this GPU runs 2 °C warmer than its
neighbours) scores 0, exactly as in ADR 0037. Offsets larger than the margin are what the kind is
for. The premise an operator declares is "no persistent offset larger than the margin between a
healthy unit and its peers", and a per-fleet A/A measures whether it holds.

## Rejected

- *Indicator of being the worst of N* (null mean 1/N). Rejected for power: it discards the rank's
  information; kept as a note, since it is the natural kind when only "worst" is meaningful.
- *Peers as a pooled distribution with the unit's z-score.* Rejected: it estimates a scale from the
  peers each tick, and the point of the series is to estimate nothing the bound depends on.
- *Difference-in-differences against a pre-change gap.* Deferred to part 3; it reintroduces one
  estimated quantity and deserves its own study.

## Ship rule

Study `2026-10-peer-rank` E1–E4 hold (validity under exchangeable peers, under sub-margin offsets
and under shared seasonal AR(1) noise at N = 4 and 16; N = 2 reproduces the sign kind score for
score; power at 2× the margin). Then `v0.15.0-pre` ships it; otherwise REJECTED with the figure.
The GWDG replay informs the DeploySignal eligibility rule, not this ADR's acceptance.
