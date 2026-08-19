# Report — the GRAPA/ONS bet dynamics are stable, and every derived law held

- **Study id:** `2026-08-grapa-stability` (WORKLIST C58). **Run:**
  `results/live/run-20260819T040000Z` — one attempt, N = 2000 × T = 300 per cell, six cells,
  ~1.4 s. Pre-registration `8b9e261`, committed with all six bands before the harness existed.
- **Executability (§5): PASSED** — 0 mismatches over 60 paired drives; the harness reads the
  detector's own state, never a reimplementation.
- **All six registered predictions HELD.** Verdicts as computed; no band moved.

## The headline: the feedback loop is benign, and its one pathology is the known one

| P | claim (derived, then measured) | registered band | measured | verdict |
|---|---|---|---|---|
| P1 | bet variance decays like 1/n | slope ∈ [−1.3, −0.7]; mean ≈ 0 | **−0.965**; mean 0 within 2 se | **HELD** |
| P2 | H₀ wealth decays like −½·log n (polynomial, not exponential) | slope ∈ [−0.75, −0.25] | **−0.511** | **HELD** |
| P3 | martingale exact at oracle params | E[exp Δlog M] ∈ [0.9995, 1.0005] | **0.9999956** | **HELD** |
| P4 | estimation-extraction excess = κ/m, first-principles κ = 1 | κ ∈ [0.7, 1.1], per-m residuals ≤ 25% | **κ = 0.8445**; residuals 1.2% / 13.2% / 3.7% | **HELD** |
| P5 | the clip makes blowup impossible on the mixture-killing shapes | 0 non-finite; max \|inc\| ≤ 13.9; fire ≤ 0.10 | 0 / 0; **13.8155 = −log(10⁻⁶)** both cells; fire 0.0595 / 0.0395 | **HELD** |
| P6 | ONS is a startup device | first-2-ticks fallback ≥ 95%; late rate ≤ 5% | **100%**; **0.00375%** | **HELD** |

## What this settles

1. **The loop is stable by its gain schedule.** The 1/n moment updates make λ_t a
   stochastic-approximation iterate: variance 1/(s·n) (P1), and the Jensen tax integrates to
   `E[log M_n] ≈ −½·log n` (P2, measured −0.511) — a valid e-process whose H₀ wealth decays
   POLYNOMIALLY, not exponentially: the adaptive bet is gentler under H₀ than any fixed-λ
   process, whose decay is linear in n at rate −½λ²s.
2. **C23's estimation boundary now has a mechanism and a law.** The loop *converges on the
   calibration bias*: λ∞ ≈ b/s turns miscentering ε into apparent evidence at per-tick excess
   b²/s, giving excess ≈ 1/m over the calibration draw. Measured κ = 0.8445 on this
   independent harness — and the per-m excesses (0.02781 / 0.00956 / 0.00175) reproduce
   C23's committed 1.029 / 1.009 / 1.002 within their noise. The ~15% shortfall from κ = 1 is
   attributed (unregistered, post-hoc) to the pre-convergence transient and σ̂ error; the
   registered band anticipated it.
3. **The clip is the stability guarantee the mixture lacks.** |λ| ≤ 1 − 10⁻⁶ and |z| ≤ 1 bound
   every log-increment in [−13.816, 0.693]; the measured max hit the floor bound exactly
   (−log 10⁻⁶) and nothing was non-finite on the shapes where the mixture produced NaN and
   8.5×10⁴⁶. Bounded increments are why the betting path held at N5/N6 all along.
4. **GRAPA/ONS division of labor, measured:** at n = 1 GRAPA's λ = 1/z₁ always leaves the unit
   ball, so ONS supplies the opening bet on 100% of trajectories; after the moments concentrate
   the fallback needs ~1 tick in 27,000. ONS is not a co-equal controller; it is the ignition.

## Scope — what this does not establish

- Oracle-φ and whitened-AR(1) cells were not run (P1–P6 are iid-cell claims); the φ-estimation
  regime is C23's separate, standing result.
- The N2 construction estimates μ̂ and σ̂ jointly (as deployed); the derivation prices only the
  μ̂ term, which the κ band absorbed — separating the two contributions is unregistered.
- Stability under the alternative (drift/step inputs) is out of scope: this study is about the
  H₀ feedback loop, not power.
- One combination of gain schedule and clip: the conclusions are about the shipped constants
  (1/n gain, B = 3, clip 1 − 10⁻⁶), not about GRAPA/ONS in general.
