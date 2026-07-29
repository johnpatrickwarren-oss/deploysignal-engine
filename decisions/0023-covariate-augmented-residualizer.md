# ADR 0023 — Covariate-augmented statistical residualizer (Tessera ADR 0024 G2's cheap arm)

- **Date:** 2026-07-28
- **Status:** implemented (`baseline/covariate-residualizer.ts`); benchmark against real/synthetic
  workload-driven telemetry lives product-side (Tessera), per the ADR 0019 split — products supply
  data + covariates, the engine does the stats.
- **Builds on:** ar-p.ts (Yule-Walker/Levinson + AIC), seasonal-baseline.ts (L1 kit, composes
  upstream), Tessera ADR 0024 (the deferral this module is the mandatory comparator for).

## Decision

Add the in-engine covariate-augmented statistical residualizer:

    y_t = c + β·X_t + u_t,    u_t ~ AR(p) (AIC-selected via the existing Levinson-Durbin)

fit on the baseline window only (`fitCovariateResidualizer`), applied to later windows as frozen
weights emitting one-step-ahead innovations only (`oneStepResiduals`), standardized by the
innovation σ̂. Zero covariates degrades exactly to the plain-AR(p) comparator, so the G2 race
(plain vs augmented vs any future deep model) is apples-to-apples by construction.

## The constraints that are contracts, not conventions

1. **One-step-ahead only.** h-step residuals are MA(h−1) by construction and inadmissible into an
   e-value. The API does not offer them.
2. **Strict exogeneity, no override.** Covariates declare a kind from a closed union
   (`scheduler-intent | workload-class | planned-event | calendar`), and `assertExogenous`
   rejects names matching system-state-response patterns (temp/clock/power/util/ecc/…)
   regardless of declared kind. A health-adjacent covariate correctly predicts the incident and
   nulls the residual exactly when detection matters (Tessera ADR 0024 § 3). There is
   deliberately no escape flag; if a legitimate covariate trips the lint, rename it for what it
   exogenously is or take the discussion to an ADR.
3. **Whiteness is reported, not assumed.** The fit emits the final residual's lag-1 ρ̂ and a
   pass/fail against max(0.1, 2/√N) — the `ar1_phi`-style number the emitter contract wants
   supplied. Consumers feeding non-white residuals to an e-value are violating the contract
   knowingly.
4. **Filtration discipline is the caller's.** The engine cannot see epochs; `fitCovariateResidualizer`
   documents that the fit window must be strictly pre-epoch. The test locks the frozen-fit
   fresh-window behavior (healthy ⇒ ~N(0,1); injected fault ⇒ survives residualisation with the
   AR-retained fraction (1−φ)·shift).

## Non-goals

- Seasonal structure: compose `seasonalBaselineResidual` upstream; this module does not re-own it.
- Nonlinear/cross-metric structure: that is exactly the headroom question G2 exists to measure —
  if this module leaves <~10% one-step error on the table, no deep model enters (ADR 0024 G2's
  two-sided kill criterion).
- Benchmark harness: product-side. **Substrate correction (2026-07-28, same day):** clustersynth
  is NOT a valid G2 substrate — `allocateJobs` runs once per scenario, so allocation is STATIC
  over the horizon: job/partition covariates degenerate to per-shard intercepts, and the job
  factor's time variation is calendar (the seasonal kit's job) plus a latent stochastic part no
  admissible exogenous covariate predicts. A MASE bench there would read "≈0 headroom" as a
  generator property, not a fleet fact. The right substrate is the mini intervention campaign
  (post-gate ~2026-09-21): journaled interventions = strictly-exogenous scheduler-intent
  covariates on real telemetry. GWDG incident windows overstate covariate benefit and cannot
  serve null gates (ADR 0022 / Tessera ADR 0024 G3).

## Tests

`test/adr-0023-covariate-residualizer.test.ts` — 6 properties: plain-arm equivalence (φ
recovery), driver absorption (β recovery + RMSE win), exogeneity lint, frozen-fit healthy
~N(0,1), fault survival, contract guards.
