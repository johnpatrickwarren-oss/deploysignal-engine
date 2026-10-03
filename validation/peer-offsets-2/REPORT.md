# Report — offsets with a pre-window margin floor (`2026-10-peer-offsets-2`, ADR 0041, T1): ship rule MET

- **Registration:** `PREREGISTRATION.md` at `c11a94d` with ADR 0041, before implementation (`ece985d`);
  Amendment 1 at `7d3f578`, found at the harness smoke and before run 0: the inherited gaps scaled the
  second peer to zero at g = 2.0 (the same error that rejected ADR 0040, corrected in its report) and
  my floor predictions were wrong; gaps became (g, 1/(1 + g) − 1, 0) and the power cells were re-sized.
  Harness `7d3f578`. Verdicts as computed; no bar moved after run 0.
- **Run:** `results/run-20261003T140600Z/`, engine `7d3f578` (`0.15.0-pre` + ADRs 0040/0041, unreleased),
  R = 10,000, 3 min 21 s. **Verdicts:** E1 PASS, E2 PASS, E3 PASS, E4 PASS. **Ship rule MET.**

## 0. The headline

| Cell | g | wander | Δ | T | Realized floors (peers 1/2/3, medians) | Rollback | By 60 | Tick median, IQR | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| R-zero | 0 | no | 0 | 300 | 0 / 0 / 0 | 0.0000 | — | — | **E2 PASS** (wealth for wealth) |
| F-g0.5 | 0.5 | no | 0 | 2000 | 0.039 / 0.088 / 0.059 | 0.0000 | — | — | **E1 PASS** |
| F-g0.5-n | 0.5 | ±10% | 0 | 2000 | 0.053 / 0.150 / 0.059 | 0.0000 | — | — | PASS |
| F-g2.0-n | 2.0 | ±10% | 0 | 2000 | 0.041 / 1.049 / 0.059 | 0.0000 | — | — | PASS |
| F-g2.0-n-q0.75 | 2.0 | ±10% | 0 | 2000 | 0.028 / 0.677 / 0.039 | 0.0000 | — | — | reported |
| P-g0.5-n-r0.20 | 0.5 | ±10% | 0.20 | 300 | 0.053 / 0.150 / 0.059 | 1.0000 | 1.0000 | 10, 9–11 | **E3 PASS** |
| P-g2.0-n-r0.30 | 2.0 | ±10% | 0.30 | 300 | 0.041 / 1.052 / 0.059 | 1.0000 | 1.0000 | 21, 21–21 | PASS |
| P-g0.5-n-r0.10 | 0.5 | ±10% | 0.10 | 300 | 0.053 / 0.150 / 0.059 | 1.0000 | 0.9569 | 21, 16–29 | reported |
| Q-g0.5-n-r0.02 | 0.5 | ±10% | 0.02 | 300 | 0.053 / 0.150 / 0.059 | 0.0000 | — | proceed 1.0000, median 7 | **E4 PASS** |

## 1. Readings

With offsets and floors both taken from a 576-tick concurrent pre-window, no cell rolled back a healthy
unit in 50,000 runs of 2,000 ticks, including the gap-of-3× cell that rejected ADR 0040's registration
(with its degenerate peer corrected). Power at Δ 0.20 above a 1.5× gap is total by tick 14, at Δ 0.30
above a 3× gap by tick 21, and at Δ 0.10 (near the second peer's 0.15 floor) 0.957 by tick 60.

**The floor is the price, and the generator makes it large.** The wander is registered as ±10% of the
gap G, not of the peer's value: for the peer below the unit at G = −0.667, a ±10% wander of G moves
the peer's value by about ±20% and the ratio unit/peer by about ±0.6, so its q0.90 floor is 1.05, a
band of ±105%, and that peer contributes nothing to detection; the two other peers carry P-g2.0 (x =
⅔ > ½). At g 0.5 the second peer's floor is 0.15, and detection at Δ 0.10 leans on the other two.
The construction does what ADR 0041 says: a peer whose gap is unstable in the pre-window is given a
band as wide as that instability and is effectively removed; a peer whose gap is stable keeps a tight
band. On real hardware the floors measure how stable each pair is, and the GWDG companion reports
them per pair.

**The realized floors against my predictions.** Peers 1 and 3 came in at 0.04–0.06 (predicted
0.07–0.11 at g 0.5), lower; the second peer at 0.15 and 1.05 (predicted 0.07–0.11 and 0.12–0.18), far
higher, for the reason above. The prediction mis-modelled the wander's effect on the peer below the
unit.

## 2. Predictions against results

P1 held at 0.000 everywhere (predicted 0.000–0.010; the q0.75 cell predicted 0.01–0.05 came in at
0.000). P2 exact. P3 held with medians 10 and 21 (predicted 15–25; the first was faster). The near-floor
cell: 0.957 by 60 (predicted 0.3–0.8), higher. P4 held. Floors: wrong as stated above.

## 3. Consequence

ADR 0041 ACCEPTED. `v0.16.0-pre` ships `PeerRankObservation.offsets` (ADR 0040's field, under ADR
0041's rule) and `.margins`. The real-telemetry companion, DeploySignal `2026-10-peer-offsets-gwdg`,
takes offsets and floors from each GPU's 96-hour calibration window and replays the same 44 null and
40 detection windows as `2026-10-peer-rank-gwdg`; its per-pair floors say how stable node-mate gaps
are on that cluster, and its null rate says whether the two-working-two-idle structure is stable
across the pre-window and the scored window.

## 4. Not measured

A wander defined on the peer's value rather than the gap; a regime change between pre-window and
scored window (the GWDG risk); additive offsets; other quantiles than 0.90 and 0.75; real telemetry.
