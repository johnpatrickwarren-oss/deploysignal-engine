# Pre-registration — offsets with a pre-window margin floor (`2026-10-peer-offsets-2`, ADR 0041, T1)

- **Study id:** `2026-10-peer-offsets-2`. **Serves:** ADR 0041. **Tier:** T1. **Engine:** `v0.15.0-pre` +
  ADR 0040's `offsets` (unreleased) + ADR 0041's `margins`, unreleased. **Status: REGISTERED, NOT RUN.**

## 0. Disclosures

`2026-10-peer-offsets` is known: exact offsets 0.000; estimated without wander 0.000; ±10% wander at
1.5× 0.0029 and at 3× 0.3059 against a 2% margin; power 0.9349 at Δ 0.04. This study repeats its EST
cells with the floor and sizes its power cells to the floor. The generator is unchanged.

## 1. Generator and the floor

`2026-10-peer-offsets` §1 exactly (N 4, gaps (g, −g/2, 0), wander G_j,t = G_j (1 + 0.1 b_j,t), b AR(1)
σ 1 φ 0.9, 576-tick pre-window with δ = Δ = 0). From the pre-window, per peer: r_t = unit_t / peer_j,t −
1; `offsets[j] = median(r)`; `margins[j] = q0.90(|r_t − median(r)|)`. Spec margin m = 0.02 (the floor
widens it where larger). Seeds `lcg(20261003 + 7919·i)`, R = 10,000. Validity cells run the rollback
bet to T (proceed recorded); P and Q stop at the first terminal verdict. The realized floors (median
over replications of each `margins[j]`) are reported per cell.

## 2. Cells

| Cell | g | wander | Δ | T | Reads |
|---|---|---|---|---|---|
| R-zero | 0 | no | 0 | 300 | reproduction: zero offsets and margins = ADR 0039 wealth for wealth |
| F-g0.5 | 0.5 | no | 0 | 2000 | false rollback ≤ B |
| F-g0.5-n | 0.5 | ±10% | 0 | 2000 | false rollback ≤ B |
| F-g2.0-n | 2.0 | ±10% | 0 | 2000 | **false rollback ≤ B** (the cell that rejected ADR 0040) |
| F-g2.0-n-q0.75 | 2.0 | ±10% | 0 | 2000 | reported: a lower quantile (0.75) for the floor |
| P-g0.5-n-r0.08 | 0.5 | ±10% | 0.08 | 300 | power ≥ 0.95 by tick 60 (Δ about 2× the expected floor of ~0.04) |
| P-g2.0-n-r0.20 | 2.0 | ±10% | 0.20 | 300 | power ≥ 0.95 by tick 60 (Δ about 2× the expected floor of ~0.09) |
| P-g2.0-n-r0.10 | 2.0 | ±10% | 0.10 | 300 | reported: Δ near the floor |
| Q-g0.5-n-r0.02 | 0.5 | ±10% | 0.02 | 300 | sub-floor: proceed ≥ 0.90, rollback ≤ B |

## 3. Bars and endpoints

B = 0.0556. **E1** F-g0.5, F-g0.5-n, F-g2.0-n ≤ B. **E2** R-zero exact. **E3** both P cells ≥ 0.95 by 60.
**E4** Q proceed ≥ 0.90 and rollback ≤ B. Ship rule: E1–E4.

## 4. Predictions

P1: E1 holds; F-g2.0-n 0.000–0.010 (the q0.90 floor of a ±10% wander on a 3× gap is about 0.09, above
the ±7% excursion); F-g2.0-n-q0.75 0.01–0.05. P2: exact. P3: holds; medians 15–25 (the floor is a
wider band, so fewer ticks score 1). P-g2.0-n-r0.10 between 0.3 and 0.8. P4: holds. Realized floors:
g 0.5 about 0.03–0.05, g 2.0 about 0.07–0.11.

## 5. Not measured

Other quantiles than 0.90 and 0.75; other wander amplitudes; a pre-window shorter than 576 ticks; a
gap that changes regime between pre-window and scored window (the GWDG risk, carried by the companion).
