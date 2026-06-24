# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **ADR 0004 PR E — validity envelopes as first-class + the FDR-path gate** ("the single most important
  honesty fix"). `detectors/validity-envelope.ts`: shared `ValidityEnvelope` type +
  `isValidForFdrPath`/`assertValidForFdrPath` gate. The plug-in betting + mixture e-values are labelled
  `validUnderEstimatedBaseline: false` (E[e|H0] ≫ 1 under an estimated baseline — Tessera ADR 0008/0014
  → ~1e8/~3e9; valid only with a true baseline or m≫n) and gated OUT of the FDR path unless their regime
  is asserted; the nuisance-robust BF (PR A) is retrofitted onto the shared type as
  `validUnderEstimatedBaseline: true`. `fleet/guarantee.ts`:
  `assembleFleetGuaranteeConditions` surfaces the by-construction conditions for the verdict
  (e-value-valid ∧ fault-fraction < ~20% breakdown ∧ scalar ∧ coupled common-mode), with the FD side
  framed as a characterized power/MDE curve, never unconditional.
  - **Vendoring respected:** the plug-in detectors' envelopes live in the NEW file, not the vendored
    detector sources (verified byte-unchanged vs main); the `ar1-whitened` labels verified accurate
    (both detectors consume ar1_phi). The gate is a HELPER the consumer calls at the e-BH boundary
    (e-values reach e-BH as bare numbers with no attached envelope) — opt-in by design, not a rewire.
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
- Full suite 148 pass / 0 fail (PR A: 12 tests; PR E: 7 tests — envelope labels, the FDR-path gate both
  ways, assertValidForFdrPath throw path, the assembler's AND logic per condition, input validation).

## In flight
- ADR 0004 promotion COMPLETE through PR E. PRs A (#21), B (#22), C (#23), D (#24) SHIP via cold-eye;
  PR E (this branch, stacked on A) under cold-eye. After PR E lands → step 6.

## Next (ADR 0004 step 6 — release + Tessera pin bump)
- Tag an engine pre-release once PRs A–E are merged to main.
- Tessera bumps its pinned engine dep and migrates its `tools/*` to thin validation harnesses over the
  promoted APIs: drop `tools/fleet-fdr.ts:eBH` (consume `eBenjaminiHochberg`); consume the promoted BF,
  `contaminationRobustResiduals`, the distributional-signature scores, and the baseline-lifecycle; re-run
  `tools/*` as cross-checks (reports must stay idempotent).
- Merge order: A → {B, E} (both stacked on A) → then C, D (independent). E touches PR A's envelope, so
  it lands after A.

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (PR A): `detectors/nuisance-robust-bf-e-value.ts` (+ test)
- Added (PR E): `detectors/validity-envelope.ts`, `fleet/guarantee.ts`,
  `test/adr-0004-pr-e-validity-envelopes.test.ts`; retrofit on `nuisance-robust-bf-e-value.ts`
- Source of truth (Tessera): `tools/nuisance-robust-evalue.ts` + `tools/bf-lifecycle.ts` (PR A);
  ADR 0008/0014 (the plug-in invalidity PR E labels)
