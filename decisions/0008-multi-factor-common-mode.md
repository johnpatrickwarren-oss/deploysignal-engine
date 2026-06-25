# ADR 0008 — contamination-robust multi-factor common-mode (productionises frontier #2)

- **Date:** 2026-06-24
- **Status:** Accepted (productionises ADR 0007 frontier #2; validated, cold-eyed)
- **Builds on:** ADR 0004 PR B (contamination-robust SCALAR common-mode), ADR 0007 (the frontier finding
  that multi-factor residualisation is the right generalisation).

## Context

PR B's contamination-robust common-mode removes a per-tick SCALAR center `c_t` — valid only when every
shard responds to the shared factor with the SAME gain (homogeneous loading). On a fleet where shard `i`
loads the factor with gain `λ_i` (heterogeneous workload/thermal sensitivities), the scalar center leaks
the factor into the residual proportional to `(λ_i − mean(λ))`, and the per-shard e-value false-fires on
it. Measured on a synthetic heterogeneous fleet (`λ_i ~ U[0.2,1.8]`): scalar **FDP 0.62 ≫ q**. ADR 0007
frontier #2 established that a multi-factor residualisation fixes this; this ADR productionises it.

## Decision

`fleet/multi-factor-common-mode.ts:multiFactorRobustResiduals(X, calLen, { factors })` — the multi-factor
generalisation of `contaminationRobustResiduals`. Model `X[i][t] = ℓ_i + Σ_{k≤r} λ_{ik} F_k[t] + ε[i][t]`:
remove each shard's calibration LEVEL `ℓ̂_i` (median), then fit `r` factors by ALTERNATING ROBUST
regression (a robust PCA) — per factor, iterate

    F̂_k[t] = robust slope of the cross-section on the loadings   (per tick — a redescending Tukey fit),
    λ̂_{ik} = robust slope of shard i's FULL series on the factor  (per shard),

and deflate. Residual `R[i][t] = X[i][t] − ℓ̂_i − Σ_k λ̂_{ik} F̂_k[t]`, fed to the per-shard e-value then
e-BH exactly as the scalar pipeline.

**Two load-bearing choices (both established empirically in ADR 0007):**
- The per-shard loading fit is over the FULL series (cal + test), not just calibration. The factor is
  amplified in the test window (a random-walk common-mode drifts far), so a small loading error
  `(λ_i − λ̂_i)·F[t]` becomes a large residual trend the e-value fires on; fitting `λ̂_i` against the
  large test-window factor excursions removes it. A calibration-only loading fit leaves FDP ≈ 0.17.
- The fit is robust (Tukey-biweight) in BOTH directions: the per-tick factor score rejects the minority
  of faulty shards (cross-sectional outliers), and the per-shard loading fit downweights the fault step.
  **Honest caveat (cold-eyed):** robustness MITIGATES but does NOT prevent fault absorption — a constant
  step in the test window correlates with the nonzero-mean test-window factor, so the loading fit partly
  explains it as λ·F: **~40% of a step fault is absorbed** (faulty-shard λ̂ inflated ~7%). This is the
  DOMINANT driver of the power cost, and it is the same full-series mechanism that removes the leakage —
  a genuine tension, not a free lunch.
- The first factor's first pass uses `λ ≡ 1`, which makes `F̂_t` exactly PR B's redescending per-tick
  center — so on homogeneous loadings the method reduces toward the scalar common-mode.

## Validation (synthetic factor-model fleet; full suite 185 pass / 0 fail)

| fault fraction | heterogeneous: scalar | heterogeneous: multi-factor | homogeneous: multi-factor |
|---|---|---|---|
| 10% | FDP **0.62** | FDP **0.007**, power 0.73 | FDP 0.004 |
| 20% | FDP 0.65 | FDP 0.09 | FDP 0.08 |
| 30–40% | — | FDP 0.23 (broken) | — |

Multi-factor controls FDP ≤ q on BOTH heterogeneous (where the scalar fails) and homogeneous fleets, with
a higher breakdown than the scalar center (it still holds at 20% faults where the scalar broke).

**Power cost is real and STEP-DEPENDENT (cold-eyed):** the ~0.73 above is for a large ~2.5σ step; because
absorption removes a fixed FRACTION of the step, power falls steeply for smaller faults (≈0.5 at ~1.5σ,
≈0.2 at ~1σ, ≈0.1 at ~0.75σ). So the method trades sensitivity-to-small-faults for heterogeneous-fleet
FDP control — quantify the operating step before relying on it. Breakdown is a minority-fault envelope (~20%).

## Conditions / envelope (inherits PR B's, plus)

- **`r` MUST match the true factor rank — the FDP ≤ q guarantee is CONDITIONAL on it (cold-eyed):**
  under-specifying (true r=2, fit r=1) leaves residual factor leakage and **FDP inflates to ≈ 0.25**;
  over-specifying (fit r > true rank) makes the extra factors fit and remove the fault structure, so
  **power SILENTLY collapses to ~0**. There is no auto-selection — choose `r` with the shipped
  `factorDeflationEnergy` scree (pick the elbow where per-factor energy hits the noise floor). The
  Barigozzi–Trapani `(r+1)`-eigenvalue spike is the companion signal for a factor-rank CHANGE; not here.
- Faults must stay a minority (~20% breakdown). The factor structure is assumed STABLE across cal/test (a
  CHANGE in the factor structure is the Barigozzi–Trapani regime, out of scope). The alternating fit is
  in-sample (the O(1/N) self-pull is conservative, as PR B).
- Cost: O(n·t·passes·IRLS) — heavier than the scalar center; fine for a per-window fleet call.

## Net

Closes ADR 0004 weakness #2 (heterogeneous loadings) for the single-factor case at the design load. The
remaining ADR 0007 frontier items stay open: integrating the AR(1) φ out (frontier #1 — validity solved
via HAC, power calibration open) and a principled robust e-process (frontier #3).
