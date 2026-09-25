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

   **Those figures are at oracle scale, and the record shows the monitor revoking on heavy
   tails elsewhere** — knowledge `stats/e-by-t2-2026-09-04` (every replication under t₃
   innovations) and `stats/contrast-null-2026-09-05` (81–99% on N5). Both are right, and the
   channel is the scale: the contrast fit standardises by MAD (`per-shard/contrast.ts:95`), which
   reads a unit-variance t₃ residual at 0.656, and the residual inflated by 1/0.656 trips the
   Gaussian increment. Measured on the same seeds: revoked 2.5% of t₃ feeds at oracle scale, 3.5%
   with the fit window's sd, **73.5% with the fit window's MAD** (200 feeds × 2000 ticks, fit
   2000). So on a MAD-standardised residual the monitor does revoke under heavy tails, for a
   reason that is not the premise; and where it passes it still has not measured E[g]. Neither
   the σ̂ channel nor the tail is what `incrementMean` reads, which is why the estimator and not
   the monitor carries the assertion. The contrast-null page's note that "the pooled estimator
   understates a tail it cannot see" is a sample-size statement about that study's m ≤ 2000
   increments per fit; A6's 4,000,000 per cell read the tail at 1.61 ± 0.008.
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


## Addendum 1 — 2026-09-25, h0-battery Amendment A7: the betting premise was mis-stated, and the other wealths are measured

Decision 1 said the betting e-process, the mixture supermartingale and the contrast null "carry the
`'mgf'` premise structurally". **The betting e-process does not.** Its increment is
`1 + λ_t·z_t` with `z_t = clip((x − μ)/(3σ), −1, 1)` (`detectors/betting-e-process.ts:146-153,
196`), a linear bounded bet with a predictable λ_t from the running moments of z: the premise is
`'clip-mean-zero'`. The mixture supermartingale's is `'mgf'`. The contrast null inherits each
construction's premise by guarded id.

Amendment A7 (`validation/h0-battery/FAMILY-A-INCREMENT-ADDENDUM-2026-09-25.md`,
`inc-20260925T174222Z`) measured both at oracle parameters on the A6 nulls, nine of ten cells as
registered before the run: betting 1.00000 ± 0.00005 on every symmetric null and 1.00118 on the
σ-0.75 lognormal (aGRAPA converges on the clipped mean −0.0092 and bets against it; derived
1.00105); the mixture 1.00002 on N(0,1), divergent (pooled means 10²⁵ and 8 × 10¹¹, scored REFUTED
under a Markov rule at level 10⁻⁴) on t₃ and the lognormal at unit scale, and 2.2 inconclusive on
t₃ innovations under AR(1) because the battery's marginal-σ convention runs the mixture at five
times the true residual variance. Consequences in the same PR: `BETTING_E_PROCESS_ENVELOPE`
carries `'clip-mean-zero'`, `MIXTURE_SUPERMARTINGALE_ENVELOPE` `'mgf'`, and the two contrast ids
map to two frozen views of `CONTRAST_NULL_ENVELOPE` with the premise of their construction. Every
guarded id in the map now carries a tail premise except the four valid-under-estimated-baseline
objects (safe-t, the two UI e-values, the retracted BF), which is v0.11.0-pre.

A second finding the arm was registered on: every detector-audit arm called the null generator
with a second argument that the lognormal read as its σ, so every N5 cell of that study is void
(betting's 1.000000 "inert" and the mixture's NaN were NaN observations, not the detectors). The
mixture card's note "NaN on right-skewed (N5)" carries the void reading and is registered for a
card amendment (knowledge WORKLIST C83); `validation/detector-audit/REPORT.md` carries a dated
correction.
