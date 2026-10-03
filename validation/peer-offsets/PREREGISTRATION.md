# Pre-registration — declared per-peer offsets on the rank-among-peers kind (`2026-10-peer-offsets`, ADR 0040, T1)

- **Study id:** `2026-10-peer-offsets`
- **Serves:** ADR 0040. Validity of the offset-adjusted rank kind when the per-peer gap is persistent
  and large; validity when the offsets are *estimated* from a pre-window of the same length the GWDG
  companion will use (576 ticks, 96 h at 10 min) under gap noise; reproduction of ADR 0039 at zero
  offsets; power.
- **Tier:** T1, synthetic, committed `dist/`. **Engine:** `v0.15.0-pre` + ADR 0040, unreleased.
- **Status: REGISTERED, NOT RUN.**

## 0. Disclosures

The GWDG result that motivates this (26 of 44) is known; the peer gaps there are two-fold. Cells
below use gaps of 0.5 and 2.0 (×1.5 and ×3). Nothing is implemented at registration. The pre-window
estimator is the median relative gap; its error under AR(1) gap noise is what the EST cells price.

## 1. Generator

`2026-10-peer-rank`'s generator (shared seasonal level L_t, per-unit AR(1) a_{i,t} σ 0.1 φ 0.5,
lognormal request noise, n ~ Poisson(1000)), N = 4, with **persistent per-peer gaps**: peer j's value
is multiplied by (1 + G_j) with G = (g, −g/2, 0) for g per cell, so the unit sits between its peers;
plus **gap noise** in EST cells: G_j,t = G_j · (1 + 0.1 · b_{j,t}), b AR(1) σ 1 φ 0.9 (a slow wander of
the gap by ±10%). The unit += (δ + Δ) · L_t as before. Spec `{ worse: 'higher', tolerance: 0.1,
margin: { relative: m }, alpha: 0.05 }`, single signal (threshold 20).

**Offsets.** EXACT cells pass `offsets = −G_j / (1 + G_j)`... stated plainly: the offset that maps
peer j back onto the unit's scale, `offsets[j] = 1 / (1 + G_j) − 1`. EST cells estimate them as the
median over a 576-tick pre-window (generated with the same process, before the scored window) of
`unit_t / peer_j,t − 1`, with δ = Δ = 0 in the pre-window.

Seeds `lcg(20261003 + 7919·i)`, R = 10,000, T as stated; validity cells run the rollback bet to T
(proceed recorded, not terminal; the `peer-rank` study's Amendment 1 rule); P and Q cells stop at the
first terminal verdict.

## 2. Cells

| Cell | g | offsets | gap noise | m | δ | Δ | T | Reads |
|---|---|---|---|---|---|---|---|---|
| R-off0 | 0 | 0 | no | 0.02 | 0 | 0 | 300 | reproduction: wealth-for-wealth equal to ADR 0039 on one seeded replication |
| NG-g0.5 | 0.5 | none | no | 0.02 | 0 | 0 | 2000 | the gap, unadjusted: reported (expected to roll back nearly always) |
| EX-g0.5 | 0.5 | exact | no | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| EX-g2.0 | 2.0 | exact | no | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| EST-g0.5 | 0.5 | estimated | no | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| EST-g0.5-n | 0.5 | estimated | yes | 0.02 | 0 | 0 | 2000 | false rollback ≤ B (the estimator's error under a wandering gap, against a 2% margin) |
| EST-g2.0-n | 2.0 | estimated | yes | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| EST-g0.5-n-m0.10 | 0.5 | estimated | yes | 0.10 | 0 | 0 | 2000 | reported (the GWDG companion's margin) |
| P-g0.5-r0.04 | 0.5 | estimated | yes | 0.02 | 0 | 0.04 | 300 | power: rollback by tick 60 ≥ 0.95 |
| P-g2.0-r0.04 | 2.0 | estimated | yes | 0.02 | 0 | 0.04 | 300 | reported |
| Q-g0.5-r0.01 | 0.5 | estimated | yes | 0.02 | 0 | 0.01 | 300 | sub-margin: proceed ≥ 0.90, rollback ≤ B |

## 3. Bars and endpoints

B = 0.0556. **E1** EX-g0.5, EX-g2.0 ≤ B. **E2** EST-g0.5, EST-g0.5-n, EST-g2.0-n ≤ B. **E3** R-off0 exact.
**E4** P-g0.5-r0.04 ≥ 0.95 by 60; Q-g0.5-r0.01 proceed ≥ 0.90 and rollback ≤ B. Ship rule: E1–E4.

## 4. Predictions

- P1: E1 holds at 0.000–0.005 (exact offsets make the residual the ADR 0039 generator).
- P2: E2 holds; EST without gap noise 0.000–0.010; **with gap noise 0.02–0.05**, the ±10% wander
  against a 2% margin being the hard case; if EST-g0.5-n exceeds B the ADR states the margin must
  cover the gap's wander and the companion's 10% margin is the operating point (EST-g0.5-n-m0.10
  predicted under 0.005).
- P3: E3 exact. P4: E4 holds; power median 12–20 (slower than ADR 0039's 12 because the estimated
  offsets add noise to x). NG-g0.5 rolls back ≥ 0.99.

## 5. Not measured

Additive offsets; peer counts other than 4; a gap that changes direction mid-window; a pre-window
shorter than 576 ticks; the GWDG data (the companion).
