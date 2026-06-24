# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
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
- Full suite 141 pass / 0 fail (incl. 12 new PR-A tests: multi-scale validity in 3 regimes incl. the
  floor, power, same-variance scope, window generalization + φ-override, an independent
  numerical-integration formula check, the calibration-floor gate, finiteness guards).

## In flight
- Cold-eye verification re-review of the PR-A remediation (all 5 findings from the first pass).

## Next
- Land PR A; then ADR 0004 PRs B–E (fleet common-mode + `robustLocation`; distributional-signature
  detectors; baseline-lifecycle; validity-envelope metadata across all e-values + relabel the plug-in
  betting/mixture as conditionally-valid).
- Tag an engine pre-release after the relevant PRs; Tessera bumps its pin and migrates its `tools/*`
  to thin validation harnesses over the promoted APIs (ADR 0004 migration step 6).

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (PR A): `detectors/nuisance-robust-bf-e-value.ts`,
  `test/adr-0004-pr-a-nuisance-robust-bf-evalue.test.ts`
- Source of truth (Tessera): `tools/nuisance-robust-evalue.ts` (fixed-window), `tools/bf-lifecycle.ts`
  (`bfWin`, arbitrary windows)
