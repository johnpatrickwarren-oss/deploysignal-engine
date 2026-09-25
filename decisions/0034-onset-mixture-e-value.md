# ADR 0034 — The onset-mixture e-value is an engine construction

- **Date:** 2026-09-24
- **Status:** ACCEPTED as a construction with its validity envelopes and guarantee row; the engine
  H0-battery cell is registered as a follow-up (knowledge WORKLIST C83), not run here.
- **Register:** knowledge `stats/engine-consumer-charter` (the rule), `methodology/engine-library-
  boundary` (ADR 0033 and its open items); Tessera ADR 0019 (the object and its evidence), Tessera
  ADR 0027 (increment-family coherence), Tessera ADR 0030 (step 2: the increments came here first).

## Decision

1. `detectors/onset-mixture-e-value.ts` carries `normalizedMixtureEValue`, `geometricMixtureEValue`,
   `GEO_RHOS` and `supAdjuster`, ported line for line from Tessera's `tools/mixture-evalue.ts` and
   `tools/supfdr.ts`. `test/onset-mixture-e-value.test.ts` holds the port in lockstep against
   Tessera's compiled tools (skipping, with the reason, once Tessera re-exports this module) and
   carries Tessera's property tests: E[e|H0] ≤ 1 empirically on iid N(0,1) for both increments,
   under t3 tails and a 15% scale under-estimate for the bounded increment, prefix-monotonicity of
   the geometric mixture, the adjuster's integral identity.
2. Two envelopes: Gaussian (variance `stable`) and bounded (variance `robust`); both `plug-in`
   baseline, `iid` autocorrelation (the construction assumes a whitened, standardised residual and
   does not certify the null — Tessera's emitter contract does), `validUnderEstimatedBaseline:
   false`. The guarded e-BH admits `onset_mixture_gaussian` / `onset_mixture_bounded` only under
   `mMuchGreaterThanN` or `trueBaseline`, as for every plug-in wealth.
3. One guarantee row, `onset_mixture_`, class `ville_anytime_valid` (a convex combination of
   e-processes is an e-process; the running max through `√E−1` is a valid all-times e-value),
   alpha policy `ville_spend`, axis 3 `epsilon_growing` with the per-tick rate unmeasured. Evidence
   named: Tessera ADR 0019 (raw SR sum FDP 0.50 / 0.72 at q = 0.1 → convex mixture Mode B FDP
   0.099 ≤ q, power 0.64) and this repo's property tests.
4. The Gaussian increment `gInc` moves from `fleet/calibration-monitor.ts` to
   `detectors/_bounded-bet.ts` beside the bounded bet, so the detector does not import upward;
   the monitor re-exports it (the boundary test's rule 2).

## Why now

ADR 0033 step 2 found this object was the one statistical construction Tessera still carried that
the charter says is the engine's: it constructs the per-shard e-value that fleet e-BH consumes,
and its validity accounting (the convexity argument, the adjuster, the plug-in premise) is exactly
what the guarantee table exists to hold. Tessera-RNG, which also feeds fleet e-BH, could not use it
without depending on Tessera.

## Not done

- The engine H0 battery has no `onset_mixture` cell yet. The row's evidence says so; the
  certification card follows the battery run.
- Tessera's `tools/mixture-evalue.ts` and `tools/supfdr.ts` become re-exports in Tessera's own PR
  after this release is tagged (the pattern of ADR 0030).

## Reversal

Delete the module, the row, the two guarded ids and the registry kind; Tessera's copies are intact
until its re-export PR.
