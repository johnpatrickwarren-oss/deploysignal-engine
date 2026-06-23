# Project state

**Last updated:** 2026-06-22 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **AR(1) pre-whitening on the betting e-process path.** The betting detector was the one Family A
  detector not consuming the `ar1_phi` field (the others — mixture-supermartingale, Page-CUSUM,
  ar-p, seasonal — already pre-whiten). Under autocorrelated H0 this left its Ville bound broken
  (AR(0.9) null fire-rate >30% at α=0.01). Now `updateBettingState` consumes `ar1_phi` (default 0,
  backward-compatible), mirroring the mixture-supermartingale pattern. See
  `decisions/0001-betting-eprocess-ar1-prewhitening.md`.
- Full suite 123 pass / 0 fail (incl. 5 new tests: phi=0 identity, last_x_centered storage, AR(0.9)
  FPR collapse, power retained, iid sanity).

## In flight
- Cold-eye review (independent fresh-context audit) of the betting-path change.

## Next
- Tag a release (0.3.2-pre) so consumers can pin the betting-path fix.
- Tessera then bumps its pinned engine dep and re-runs `pnpm calibration-envelope` to confirm the
  betting path now whitens in-engine (rather than via Tessera's validation-only transform).
- (Future) AR(p>1) / near-unit-root whitening; optional innovation-variance rescaling.

## Pointers
- Decisions: `decisions/` (ADR 0001)
- Changed: `detectors/betting-e-process.ts`, `types/families/a.ts`,
  `test/betting-eprocess-ar1-prewhitening.test.ts`
- Validation evidence (consumer side): Tessera `coverage-matrices/calibration-envelope.md`
