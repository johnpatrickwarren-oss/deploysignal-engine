# Report — 2026-09-mixture-cs: the confidence sequence inverted from the Family A mixture

- **Run:** `run-20260902T195146Z` — engine `f477ae4`, node v25.9.0, N = 4000, T = 900 (P3 at T = 300), α = 0.05, ρ ∈ [1, 38], m ∈ [30, 100, 500], δ* = 0.75.
- **Pre-registration:** `PREREGISTRATION.md` (frozen at `f477ae4`, Amendment A1 before the run).
- **Verdict: 19 of 19 registered endpoints HELD, one attempt.** Per §3 the module is wired onto
  `PageCusumMixtureSupermartingaleResult.confidence_sequence` as a REPORTED field with no
  verdict authority.

## The result, one table

| endpoint | claim | measured | band | verdict |
|---|---|---|---|---|
| `P1.rho1.delta0` | time-uniform miscoverage of δ at oracle parameters | **0.0297** | [0.005, 0.06] | HELD |
| `P1.rho1.delta0.75` | time-uniform miscoverage of δ at oracle parameters | **0.0260** | [0.005, 0.06] | HELD |
| `P1.rho38.delta0` | time-uniform miscoverage of δ at oracle parameters | **0.0225** | [0.005, 0.06] | HELD |
| `P1.rho38.delta0.75` | time-uniform miscoverage of δ at oracle parameters | **0.0297** | [0.005, 0.06] | HELD |
| `P2.rho1` | first tick CS excludes 0 == detector first-fire tick | **4000** | [3996, 4000] | HELD |
| `P2.rho38` | first tick CS excludes 0 == detector first-fire tick | **4000** | [3996, 4000] | HELD |
| `P3.rho1.m30` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.3000** (predicted 0.3016) | [0.2798, 0.3234] | HELD |
| `P3.rho1.m100` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.0830** (predicted 0.0867) | [0.07336, 0.1001] | HELD |
| `P3.rho1.m500` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.0045** (predicted 0.0068) | [0.002872, 0.01065] | HELD |
| `P3.rho38.m30` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.3580** (predicted 0.3601) | [0.3373, 0.3829] | HELD |
| `P3.rho38.m100` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.1333** (predicted 0.1291) | [0.1132, 0.145] | HELD |
| `P3.rho38.m500` | fixed-T miscoverage of δ under plug-in μ̂ equals 2Φ̄(w_T/√(1/T+1/m)) | **0.0155** (predicted 0.0164) | [0.01039, 0.02244] | HELD |
| `P4.rho1.a` | as-deployed time-uniform miscoverage at m=30 ≥ 0.50 | **0.5753** | [0.5, 1] | HELD |
| `P4.rho1.b` | as-deployed time-uniform miscoverage at m=500 ≤ 0.20 | **0.0932** | [0, 0.2] | HELD |
| `P4.rho1.c` | monotone non-increasing in m | **0.5753 / 0.3332 / 0.0932** | monotone | HELD |
| `P4.rho38.a` | as-deployed time-uniform miscoverage at m=30 ≥ 0.50 | **0.6500** | [0.5, 1] | HELD |
| `P4.rho38.b` | as-deployed time-uniform miscoverage at m=500 ≤ 0.20 | **0.1265** | [0, 0.2] | HELD |
| `P4.rho38.c` | monotone non-increasing in m | **0.6500 / 0.3972 / 0.1265** | monotone | HELD |
| `P5` | module half-width vs independent closed form, max relative deviation | **0** | [0, 1e-09] | HELD |

## What it settles

- **The inversion is exact and the CS is the detector seen twice (P2, P5).** On 8,000 of 8,000
  trajectories the first tick at which the interval excludes 0 is the compiled detector's own
  first-fire tick; the module's half-width matches the closed form to floating precision.
- **Valid at oracle parameters, and conservative (P1).** Time-uniform miscoverage over 900 ticks
  reads 0.022–0.030 against α = 0.05 in all four cells, for both mixing variances and under both
  no shift and the portfolio's δ* = 0.75σ. The slack is the discrete-time overshoot plus the
  mixture's tuning (Howard 2021 §3.6 — unimprovable over the sub-Gaussian class, not exact for
  any one law).
- **The estimation premise is priced in closed form (P3).** With μ̂ from an m-sample calibration
  and oracle σ, the fixed-horizon miss rate of the true shift is `2·Φ̄(w_T/√(1/T+1/m))`, held in
  all six cells within 3 binomial se: 0.300 / 0.083 / 0.0045 measured against 0.302 / 0.087 /
  0.0068 predicted at ρ = 1, m = 30 / 100 / 500. This is the CS analogue of C23's κ/m law for the
  tests (`knowledge/stats/grapa-stability-2026-08-18`): the CS covers δ − ε, not δ, and the miss
  is exactly the calibration error's share of the width.
- **As deployed the interval is not a 95% interval for the shift (P4).** With μ̂ and σ̂² both from
  the window, time-uniform miscoverage of the true shift over 900 ticks is **0.58 / 0.33 / 0.09**
  (ρ = 1) and **0.65 / 0.40 / 0.13** (ρ = 38) at m = 30 / 100 / 500 — monotone in m, above 0.5 at
  m = 30, and still 2–3× α at m = 500. The gap to P3's fixed-horizon law is the uniform-over-time
  cost plus σ̂; it is reported, not decomposed.

## Consequence for the shipped field

`confidence_sequence` is an interval for the shift **from the compiled baseline mean, in
whitened units when `ar1_phi ≠ 0`** (the whitened observation has mean δ(1 − φ)). Its coverage
is the coverage of δ − ε under the compiled σ²; a consumer reading it as an interval for δ pays
P4's price. The same estimation premise that governs the detector's anytime claim
(`knowledge/stats/validity-premise-chain`) governs the interval — no new premise, no new
guarantee, one more reading of the same books.

## Scope

iid Gaussian only; oracle σ for P1–P3; no AR(1), heavy tails or drift; α = 0.05 only; the two ρ
values named in the registration. Nothing here bears on the betting e-process or on the bootstrap
threshold. One attempt, no reruns.
