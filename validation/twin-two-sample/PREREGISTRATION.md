# Pre-registration — the two-sample betting kind between the twin's arms (`2026-10-twin-two-sample`, ADR 0042, T1)

- **Study id:** `2026-10-twin-two-sample`. **Serves:** ADR 0042. **Tier:** T1, synthetic, committed `dist/`.
  **Engine:** `v0.16.0-pre` + ADR 0042, unreleased. **Status: REGISTERED, NOT RUN.**

## 0. Disclosures

The twin's per-metric kinds' T1 figures are known (`2026-09-twin-null`, `2026-10-twin-sign-margin`:
margined `sign` power 1.000 by tick 60 at 4× the margin, median under 20). The real-service A/As showed
persistent per-arm p99 offsets of 0.01–2 ms at a 1 ms p99 and 1–4 ms at a 76 ms p99 (the margin cell
below carries 0.9 of the margin as in the sign-margin study). Nothing is implemented at registration.
The witness and bandwidth rules are power devices and are stated as such.

## 1. Generator

Two coordinates per arm per tick, the twin-sign-margin generator per coordinate: shared level L_t = 100
s_t (s_t seasonal), per-arm AR(1) a (σ 0.1, φ 0.5), request noise 30 ℓ/√n with n ~ Poisson(1000), so
value_i = L_t + 10 a_{arm,t} + noise_i; the two coordinates of one arm share nothing beyond L_t under the
null. Effects on the canary per cell: offset δ (relative to L_t, both coordinates); mean shift Δ on
coordinate 1; **correlation** ρ between the canary's two coordinates' noise terms (control's stay
independent); **variance** multiplier v on the canary's noise. Spec: `coordinates [{ id: 'c1', margin: {
relative: m } }, { id: 'c2', margin: { relative: m } }]`, α 0.05 (threshold 20), window 200. Seeds
`lcg(20261003 + 7919·i)`, R = 10,000 (T = 2000 for validity, 300 for power; validity cells have no
proceed side to truncate them).

## 2. Cells

| Cell | m | δ | Δ | ρ | v | T | Reads |
|---|---|---|---|---|---|---|---|
| V-iid | 0.02 | 0 | 0 | 0 | 1 | 2000 | false rollback ≤ B |
| V-ar | 0.02 | 0 | 0 | 0 | 1 | 2000 | as V-iid with the shared shock's amplitude ×3 (arm-level AR(1) σ 0.3): ≤ B |
| V-d0.018 | 0.02 | 0.018 | 0 | 0 | 1 | 2000 | persistent offset at 0.9 of the margin: ≤ B |
| V-miss | 0.02 | 0 | 0 | 0 | 1 | 2000 | 10% of ticks missing one coordinate at random: ≤ B |
| M-m0-d0.01 | 0 | 0.01 | 0 | 0 | 1 | 2000 | the mechanism without a margin: reported (expected to fire) |
| P-rho0.8 | 0.02 | 0 | 0 | 0.8 | 1 | 300 | **power on a correlation change, means held**: by tick 300 ≥ 0.80 (reported by 60) |
| P-var2 | 0.02 | 0 | 0 | 0 | 2 | 300 | **power on a variance doubling, means held**: by tick 300 ≥ 0.80 |
| P-r0.08 | 0.02 | 0 | 0.08 | 0 | 1 | 300 | supra-margin mean shift (4× margin): by tick 60 ≥ 0.95, beside the `sign` kind's figure on the same draws |
| P-r0.04 | 0.02 | 0 | 0.04 | 0 | 1 | 300 | reported |

The `sign` kind (margin m) is run on coordinate 1 of the same draws in P-r0.08 and P-r0.04 and its
detection by 60 reported beside the two-sample kind's.

## 3. Bars and endpoints

B = 0.0556. **E1** V-iid, V-ar, V-d0.018, V-miss ≤ B. **E2** M-m0-d0.01 ≥ 0.90 (the mechanism is in the
generator; below 0.50 the margin cell's reading is NOT EXECUTABLE for the T3 mechanism). **E3** P-rho0.8
and P-var2 ≥ 0.80 by tick 300. **E4** P-r0.08 ≥ 0.95 by tick 60. Ship rule: E1–E4.

## 4. Predictions

P1: E1 holds, 0.00–0.03 everywhere; V-d0.018 highest. P2: ≥ 0.95. P3: holds; correlation 0.80–0.95 by
300, median tick 100–200; variance ×2 ≥ 0.95, median 50–120. P4: holds, but slower than the sign kind
(median 25–45 against the sign kind's under 20): the two-sample kind pays for its generality. P-r0.04
0.3–0.7.

## 5. Not measured

More than two coordinates; a change in one coordinate's distribution shape with mean and variance
held; unequal weights; the gate's missingness penalty; any real data (the companion replay).
