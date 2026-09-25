# ADR 0035 — The tail premise is part of the envelope, and the gate asks for it

- **Date:** 2026-09-25
- **Status:** ACCEPTED. `ValidityEnvelope.tailPremise`, three `FdrPathAssertions` fields, the
  `tailAdmissible` check inside `isValidForFdrPath` / `assertValidForFdrPath`; the two onset-mixture
  envelopes carry a premise. Breaking for the guarded e-BH: `onset_mixture_gaussian` and
  `onset_mixture_bounded` are refused under `mMuchGreaterThanN` alone, which admitted them at
  v0.9.0-pre. v0.10.0-pre.
- **Register:** h0-battery Amendment A6 and `INCREMENT-ARM-ADDENDUM-2026-09-24.md` (the
  measurement); ADR 0034 (the envelopes); ADR 0004 PR E (the gate); Tessera ADR 0027 (increment
  coherence), Tessera ADR 0032 (the two contracts that assert the regime); knowledge
  `stats/onset-mixture-increment-mean-2026-09-25`, `methodology/emitter-contract-and-the-engine-gate`.

## The gap

Amendment A6 measured the per-tick increment mean of the onset-mixture object at oracle centre,
scale and φ: the Gaussian-LR increment is 1.61 on t₃ and 1.91 on a σ = 0.75 lognormal (the capped
increment has no finite mean uncapped), and the bounded increment's negative-λ wealths are 1.0009
to 1.0083 on the lognormal because clipping a skewed tail leaves a clipped residual that is not
mean-zero. Neither envelope stated the premise those numbers refute, and the gate admitted both
ids on `mMuchGreaterThanN` alone — a statement about centre and scale that says nothing about the
residual's law. Tessera's two live contracts assert exactly that and nothing else
(`tools/telemetry-source.ts:85`, `tools/clustersynth-mode-b.ts:94`).

## Decision

1. **`ValidityEnvelope.tailPremise?: 'mgf' | 'clip-mean-zero'`** names the shape property of the
   standardised residual an increment's E[g|F] ≤ 1 rests on, beyond centre, scale and φ. Set on
   `ONSET_MIXTURE_GAUSSIAN_ENVELOPE` (`'mgf'`) and `ONSET_MIXTURE_BOUNDED_ENVELOPE`
   (`'clip-mean-zero'`), the two A6 measured. Absent on every other envelope, which means
   UNRECORDED, not waived: the plug-in Gaussian wealths (betting, mixture supermartingale, the
   contrast null) carry the `'mgf'` premise structurally and no increment-mean cell has measured
   them. Registered on C83.
2. **Three assertions.** `incrementMean: { lower95, upper95 }` is the measurement: the engine's own
   increment estimator (`fleet/calibration-monitor.ts:incrementEstimate`) on a believed-null feed
   of the residual with the same increment family, scored as A6.2 scores it against the card
   bound `INCREMENT_MEAN_BOUND = 1.0005`: lower95 above it refutes and refuses regardless of any
   promise; upper95 below it clears; otherwise inconclusive. `lightTails` and `clipMeanZero` are
   the promises, one per premise, accepted only where the measurement is inconclusive or absent.
3. **The Ville monitor's `passing` is not accepted as the assertion,** although it runs the same
   increment. ∏g drifts at E[log g], which stays negative under a heavy tail even at E[g] = 1.6:
   the monitor with the Gaussian increment revoked 1.25% of t₃ feeds and 4.25% of lognormal feeds
   over 2000 ticks at α = 0.01; the bounded monitor 4% of lognormal feeds at 2000 ticks and 12% at
   5000 (400 feeds each, seeds fixed, the script's 100-feed form pinned in
   `test/e-bh-guarded.test.ts`). That is A5's crossing-rate blindness reproduced at the monitor.
   The estimator on the same 200,000 t₃ increments reads 1.6 with a lower bound far above the
   bound.
4. **Unchanged:** the baseline axis. The tail assertion adds to `mMuchGreaterThanN` /
   `trueBaseline`; it does not replace it. Envelopes without a premise gate exactly as before.

## What it costs the consumers

Tessera's two contracts stop being admitted until they carry the assertion. The honest form is
the measurement: an increment estimator per shard beside the calibration monitors the loop already
runs (`tools/mode-b-loop.ts:updateMonitors`), pooled over the known-null cohort, passed as
`incrementMean`. At 1 Hz a ≥ 2-month feed is millions of increments and the interval decides; at
hourly cadence it is about 1,400, the Gaussian increment's interval half-width is about 0.08, and
the reading is inconclusive — the contract must then either promise `lightTails` on stated grounds
or drop `engineEnvelope` and record `not-declared`, as `mode-b-control` already does. That is
Tessera's ADR to write, after this release is tagged. DeploySignal (`contrast_null_mixture`) and
Tessera-RNG are unaffected beyond the pin.

## Not done

- No increment-mean measurement for the other Gaussian-increment envelopes; their `tailPremise`
  stays absent and the gate's behaviour for them is unchanged (decision 1).
- The certification cards that pin `detectors/validity-envelope.ts` by sha will report drift in
  `expiry-check`; the two prior edits to that file (φ bound, e-detector statistic) did not
  re-freeze and neither does this one. The re-freeze is a dedicated commit when it happens.

## Reversal

Remove the field, the three assertions and `tailAdmissible`; the two envelopes lose their premise
and the gate returns to the v0.9.0-pre behaviour. The A6 measurement stands either way.
