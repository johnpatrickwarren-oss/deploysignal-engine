# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **ADR 0004 PR B — the contamination-robust fleet common-mode** (`fleet/common-mode.ts`). Promotes
  Tessera's Lever A (ADR 0015) — the fleet half of the FP/FDR-by-construction pipeline
  `contaminationRobustResiduals → nuisanceRobustBFEValue (PR A) → eBenjaminiHochberg`. `robustLocation`
  (redescending Tukey-biweight M-estimator, IRLS from a median start, MAD scale — gross outliers get
  weight exactly 0) + per-shard level demean make a minority of faulty shards into cross-sectional
  outliers the center then rejects. Closes the ADR 0012 gap (median center contaminated → FDP 0.72–0.77).
  Measured on a strongly-coupled synthetic fleet: at 10% faults the robust pipeline holds **FDP 0.02 ≤ q**
  at power 1.0, where the naive no-demean center runs FDP 0.23; degrades past the breakdown (40% → 0.60),
  the documented minority-fault envelope. Null fleet E[e]=0.055, 0% fire.
  - **Honest decomposition (cold-eye):** a 3-arm ablation shows the **per-shard demean** is the
    load-bearing lever here — `median+demean` controls FDP as well as `Tukey+demean` (the plain median
    already has 50% breakdown on this well-conditioned synthetic). The Tukey center is shipped for
    Gaussian efficiency while still rejecting gross outliers (pinned by the redescending unit test); its
    marginal FDR edge over the median is fault-geometry-dependent (Tessera ADR 0015's substrate showed
    it, this one does not). The test does NOT claim Tukey > median.
  - **Open question resolved:** `robustLocation` lives in `fleet/common-mode.ts` (exported), not a new
    stats util — its only consumer is the fleet common-mode, and `_linalg.ts` is strictly linear algebra.
    Extract to a shared module when a second consumer appears.
  - Stacked on PR A (the FDP test exercises the real assembled pipeline). Conditions documented in the
    module header + envelope: scalar common-mode, minority faults (~20% breakdown, Tessera ADR 0015),
    genuine coupling required, masked-through-calibration faults out of scope (→ PR D lifecycle).
- **ADR 0004 PR A — the missing VALID per-shard e-value** (`detectors/nuisance-robust-bf-e-value.ts`).
  Promotes the nuisance-robust two-sample Bayes-factor e-value validated in Tessera (ADR 0013) into
  the engine, generalized to arbitrary `(cal, test)` windows and consuming the engine's native
  Kendall-corrected `computePerSignalAr1Phi`. This is the valid replacement, in the estimated-baseline
  regime, for the plug-in betting / mixture e-values (which blow up to E[e|H0]≈440 under-powered —
  Tessera ADR 0008/0014). Whitens by AR(1) φ (no centering — the mean is integrated out under a proper
  N(0,τ²) prior); E[BF|H0] ≤ 1 by construction. Validity verified: E[e]≈0.04 with 0% fire at every
  scale AND 100% shift detection, in both a well-powered and the under-powered regime.
  - **Calibration floor (cold-eye fix).** The innovation variance s² is itself plug-in and sets the
    prior scale, so E[BF|H0]≤1 holds only for adequate calibration length — empirically E[e]≈6.7 at
    cal=50, ≤1 from ~100 up. `MIN_CALIBRATION_FOR_VALIDITY = 100` is enforced (throws below it); the
    envelope carries `minCalibration`. The principled lift (integrate the variance out, NIG/t) is the
    ADR-0004-scoped variance-robust extension (future), not PR A.
  - Ships `NUISANCE_ROBUST_BF_ENVELOPE` metadata (baseline=unknown-mean-integrated, ar1-whitened,
    mean-shift null, variance=stable, minCalibration=100) per ADR 0004's validity-envelopes-first rule.
- Full suite 147 pass / 0 fail (PR A: 12 tests; PR B: 6 tests — redescending rejection, demean
  rank-flip, the end-to-end FDP ≤ q pipeline vs the naive-median contrast, the breakpoint).

## In flight
- PR A open as #21 (two cold-eye passes → SHIP). PR B (stacked on PR A) under cold-eye review.

## Next
- Land PR A (#21) then PR B; then ADR 0004 PRs C–E (distributional-signature detectors;
  baseline-lifecycle; validity-envelope metadata across all e-values + relabel the plug-in
  betting/mixture as conditionally-valid).
- Tag an engine pre-release after the relevant PRs; Tessera bumps its pin and migrates its `tools/*`
  to thin validation harnesses over the promoted APIs (ADR 0004 migration step 6).

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (PR A): `detectors/nuisance-robust-bf-e-value.ts`,
  `test/adr-0004-pr-a-nuisance-robust-bf-evalue.test.ts`
- Added (PR B): `fleet/common-mode.ts`, `test/adr-0004-pr-b-contamination-robust-fleet.test.ts`
- Source of truth (Tessera): `tools/nuisance-robust-evalue.ts` + `tools/bf-lifecycle.ts` (PR A);
  `tools/contamination-robust-fleet.ts` (PR B, ADR 0015)
