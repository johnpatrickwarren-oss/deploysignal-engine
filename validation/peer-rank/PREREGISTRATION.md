# Pre-registration — the rank-among-peers kind (`2026-10-peer-rank`, ADR 0039, T1)

- **Study id:** `2026-10-peer-rank`
- **What it serves:** ADR 0039: validity of the peer-rank e-process under exchangeable peers,
  under persistent sub-margin unit offsets and under shared seasonal AR(1) noise; reproduction of the
  `sign` kind at N = 2; power.
- **Tier:** T1, synthetic, oracle generator, the committed `dist/`.
- **Engine:** the commit carrying this file and ADR 0039, before implementation (`v0.14.0-pre` +
  ADR 0039, unreleased).
- **Status: REGISTERED, NOT RUN.**

## 0. Disclosures

- The `sign` kind's T1 results under this generator family are known (`2026-10-twin-sign-margin`:
  0.000–0.037 false rollback with a 2% margin at offsets up to 0.9 of the margin). The N = 2 cell
  here is a reproduction and is marked so.
- Nothing is implemented at registration.

## 1. Generator

The `twin-sign-margin` generator extended to N units: shared level L_t = 100 · s_t, s_t = 1 + 0.5
sin(2πt / 1440); unit i value = L_t + 10 · a_{i,t} + 30 · ℓ_{i,t} / √max(n, 1) with a_{i,t} AR(1) (σ
0.1, φ 0.5, independent per unit), ℓ the centered lognormal (σ 0.75), n ~ Poisson(1000) per unit;
unit 0 is the unit, 1..N−1 the peers; unit 0 += (δ + Δ) · L_t (persistent offset δ, regression Δ).
Spec `{ worse: 'higher', tolerance: 0.1, margin: { relative: m }, alpha: 0.05 }`, single signal
(threshold 20). Seeds `lcg(20261003 + 7919·i)`, R = 10,000, T as stated.

## 2. Cells

| Cell | N | m | δ | Δ | T | Reads |
|---|---|---|---|---|---|---|
| S2-rep | 2 | 0.02 | 0 | 0 | 300 | reproduction: score-for-score equal to the sign kind with the same spec on one seeded replication; false rollback within ±0.01 of it |
| V4-m0.02 | 4 | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| V16-m0.02 | 16 | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| V4-d0.01 | 4 | 0.02 | 0.01 | 0 | 2000 | false rollback ≤ B (offset ½ margin) |
| V4-d0.018 | 4 | 0.02 | 0.018 | 0 | 2000 | false rollback ≤ B (offset 0.9 margin) |
| M4-m0-d0.01 | 4 | 0 | 0.01 | 0 | 2000 | the mechanism without a margin: reported |
| P4-r0.04 | 4 | 0.02 | 0 | 0.04 | 300 | power: rollback by tick 60 ≥ 0.95 (2× margin) |
| P16-r0.04 | 16 | 0.02 | 0 | 0.04 | 300 | reported, with the N = 4 comparison |
| P4-r0.03 | 4 | 0.02 | 0 | 0.03 | 300 | reported |
| Q4-r0.01 | 4 | 0.02 | 0 | 0.01 | 300 | sub-margin: proceed ≥ 0.90 by 300, rollback ≤ B |

## 3. Bars and endpoints

B = 0.0556 at R = 10,000. **E1** V4, V16, V4-d0.01, V4-d0.018 ≤ B. **E2** S2-rep. **E3** P4-r0.04 ≥
0.95 by tick 60. **E4** Q4-r0.01 proceed ≥ 0.90 by 300 and rollback ≤ B. Ship rule: E1–E4.

## 4. Predictions

- P1: E1 holds; 0.00–0.03 at δ 0 and 0.01; δ 0.018 toward 0.03–0.05 (the sign-margin study's shape).
- P2: E2 exact.
- P3: E3 holds; median tick 15–30 at N = 4; N = 16 faster (median 10–20) since x averages 15 comparisons.
- P4: E4 holds.
- P5: M4 without a margin fires in ≥ 0.90 (the T3 mechanism: a 1% persistent offset at N = 4).

## 5. Not measured

Peer heterogeneity (peers that differ among themselves by more than the margin); peers that
degrade together (a node-level fault); missing peers at random or by outcome; Bonferroni across
signals (the GWDG replay carries that); unequal peer counts over time; any real telemetry (the
DeploySignal companion).
