# ADR 0011 — universal-inference e-value: real-telemetry validation of the well-specification envelope

- **Date:** 2026-06-24
- **Status:** Validation findings (NAB single-series). **REFINED by ADR 0012:** the "baselined → 0/46
  violate" result below reflects NAB's slow, cleanly-detrendable metrics and is TOO OPTIMISTIC about
  *per-shard* validity in general — on real GWDG GPU telemetry per-shard `E[e|H0]` stays > 1 even fully
  baselined. The guarantee that survives real data is FLEET-FDR, not per-shard (see ADR 0012).
- **Validates:** ADR 0010 (`universalInferenceMeanShiftEValue`). Substrate: the 47 **real** NAB series
  (`~/concord/NAB/data/real*`: AWS CloudWatch, KnownCause, Traffic, AdExchange, Tweets) with their
  labelled anomaly windows; the anomaly-free regions (88% of 321k points) are the empirical H0.

## Question
ADR 0010 proved `E[e|H0] ≤ 1` for any φ *under the Gaussian-AR(1) model*. Does that guarantee survive on
real telemetry, whose innovations are not Gaussian and whose mean is not constant?

## Real-telemetry diagnostics (what we are actually up against)
- **Innovations are severely heavy-tailed:** AR(1)-residual excess kurtosis median **12.8**, max **1540**
  (Gaussian = 0; the Student-t₄ probed in ADR 0010 is only 6). 39/47 series clearly non-Gaussian.
- AR(1) φ̂ median 0.44, max 0.98 (5 series near unit root).

## Findings
Three complementary tests (UI e-value, cal = test = 100; safe-t shown for contrast):

1. **Heavy tails alone are FINE.** iid residual-recolour bootstrap (true-null constant-mean AR(1) series
   driven by RESAMPLED real residuals — preserves the real heavy-tailed marginal, removes drift):
   UI worst **E[e|H0] = 0.25, 0/45 series violate**, max single e ≈ 82. The construction is robust to the
   real innovation distribution. (safe-t on the same: **2.8e37** — catastrophic, as ADR 0009 predicts.)

2. **RAW real telemetry VIOLATES.** UI on adjacent anomaly-free windows of the raw series:
   **16/46 series violate** (worst E[e|H0] ≈ 2.7e3, max e ≈ 4e5). Cause is **slow nonstationarity** — real
   "normal" telemetry drifts, and the constant-mean AR(1) null correctly reads drift as a mean shift. This
   is the same wall as [[project_tessera_guarantee_finding]] / Tessera ADR 0007: raw real telemetry does
   not satisfy a fixed-baseline null. (A residual BLOCK bootstrap reproduces this — block-resampling
   injects low-frequency wander; the iid version, which cannot, stays valid — confirming drift, not heavy
   tails, is the culprit. Control: block-bootstrapping synthetic Gaussian residuals stays valid 0/45, so
   the method is not artefactual.)

3. **BASELINED residuals RESTORE the guarantee.** Subtract a slow baseline (centred moving average,
   W ≈ 8 h) — a proxy for what the engine's common-mode + baseline-lifecycle layer already produces —
   then repeat test 2: **0/46 series violate**, worst **E[e|H0] = 0.50**, max e ≈ 1.05. Clean, with margin,
   across every real series including the kurtosis-1540 ones.
   - **Power is retained:** injecting a sustained step into the detrended real windows fires at 41% (2σ),
     ~48% (4–6σ). (The plateau is the *centred* MA proxy absorbing part of the step; a causal trailing
     baseline — what production uses — preserves more. So this understates deployed power.)

## Verdict & guidance
- The ADR 0010 guarantee is **real and robust to the hard part of real data (heavy tails)**. The
  well-specification caveat resolves to a **single, concrete, already-satisfied precondition: the input
  must be BASELINED residuals (slow drift removed), never raw telemetry.**
- **Deployment:** wire `universalInferenceMeanShiftEValue` to consume the **common-mode /
  baseline-lifecycle residuals** (ADR 0004 PR B/D output), not raw series. With that, it is the
  validity-by-construction per-shard FDR e-value the pipeline wanted — valid for any residual φ incl. near
  unit root, bounded, heavy-tail-robust.
- **Do NOT** apply it to raw, un-baselined telemetry: 1-in-3 series will violate.

## Carry-forward
- The W ≈ 8 h moving-average detrend is a PROXY. Validate against the ACTUAL pipeline residuals
  (common-mode output on a real multi-shard scrape) before the fleet FDR wiring is trusted in production.
- Harnesses: `scratchpad/nab-{load,diag,testA,mechanism,testB,power}.mjs`.
