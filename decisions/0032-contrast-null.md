# ADR 0032 — The contrast null: Tessera's pair contrast is an engine construction, and its registered study refused it an admitting envelope

- **Date:** 2026-09-05
- **Status:** ACCEPTED as a construction; the validity envelope is a **measured refusal** under the
  registered ship rule of study `2026-09-contrast-null` (`validation/contrast-null/PREREGISTRATION.md`
  §6, registered `2416bef` before any code, amended A1/A2 before the run, run once as
  `run-20260905T061348Z`).
- **Register:** knowledge `WORKLIST` C81 (Part 1); `stats/engine-consumer-charter` (the rule);
  `stats/nab-null-survival-2026-09-04` (C76, why the fitted temporal null is not the null);
  `stats/action-surface-2026-09-03` (Tessera's use of the contrast, ADR 0029); C73 (what a twin
  carries). Wiki page: `stats/contrast-null-2026-09-05`.

## Decision

1. `per-shard/contrast.ts`: `fitContrast`, `applyContrast`, `composeFit`, `fitContrastFast`, with the
   AR(1) estimator and whitener they use, ported line for line from Tessera's `tools/contrast.ts`
   and `tools/per-shard-whitening.ts`; `contrastOf` / `contrastResidual` for a treatment/control
   pair; `test/contrast.test.ts` holds the port in lockstep against Tessera's compiled tools
   (139,800 comparisons over 200 streams, 0 mismatches; skipped where no Tessera checkout is
   reachable, and re-run by the study harness into its manifest).
2. `CONTRAST_NULL_ENVELOPE`: a `ValidityEnvelope` with the premise stated in one sentence and the
   fit-window length as the regime, whose `admission` carries the study's P2 as numbers (per
   construction, level and fit length: the nulls on which the contract held, the nulls on which it
   failed, the measured rate per 1,000 ticks). `validUnderEstimatedBaseline: false`, no
   `minCalibration`: **nothing is admitted.**
3. `fleet/e-bh-guarded.ts` gains `contrast_null_mixture` and `contrast_null_betting` keyed to that
   envelope, so a consumer's FDR claim on the contrast residual is refused BY NAME unless the caller
   asserts `{ mMuchGreaterThanN }` (fit ≫ horizon) or `{ trueBaseline }` (a twin with a known
   offset), greppable at the call site as for the plug-in cards. `types/audit.ts` gains
   `contrast_null_{signal}` for the six Family A signals and `guarantees.ts` a row (`contrast_null_`,
   `ville_anytime_valid`, axis 3 `epsilon_growing` with the law and the numbers) so an advisory
   contrast fire can be named in an audit record.

## Why the construction is in the engine

Under the charter, what constructs a baseline and detects deviation from it, with its validity
accounting, lives in the engine. Tessera built and validated the contrast (ADR 0019, 0021, 0022,
0029) and DeploySignal needs it for a control arm. `fleet/detection-common-mode.ts` already
contains the same object in its 2-member leave-one-out case; the contrast takes it once, on a pair
the deployment nominated, with no factor estimation.

## Why the envelope is a refusal, and what the study measured

The registered ship rule was "P1 and P3 HELD → the construction ships with its envelope; P2 writes
admission." As computed, P1 FAILED in 8 of 21 cells and P3 FAILED in 14 of 21. The mechanism is
one thing, and it is not the shared component:

- The shared component cancels exactly. On the check seed the shared-step residual equals the
  null residual to `8.9e-16`; over the grid every one of 73,500 alert ticks is identical between
  the shared-step and null variants. P3's failures are P2's false alerts counted after ν.
- The price is the contrast's OFFSET. The two units have independent baselines, so the center is
  estimated (a median of m fit ticks) and then read against a 2,000-tick horizon. That is the
  plug-in n ≫ m regime `MIXTURE_SUPERMARTINGALE_ENVELOPE` names (Tessera ADR 0014). The mixture's
  false-alert rate on iid pairs is 0.34 / 0.18 / 0.03 per 1,000 ticks at m = 60 / 300 / 2000
  against a contract of 0.025, independent of the fit's scale error (0.69 vs 0.65 across the scale
  split at m = 60), and P1's per-λ readings show it as a center term (the bounded family holds for
  one sign of λ and fails for the other at m ≤ 300; both signs hold at m = 2000).
- Where the shared component exists, the contrast beats the temporal path: on N1 at m = 2000,
  29 vs 228 of 500 mixture false alerts; on a treatment-only 1.5σ step, median delay 80 vs 155
  ticks (the temporal path whitens the step away at the shared component's φ̂). The temporal path
  cannot tell a shared step from a treatment step at all (its cells are identical by construction).
- The e-SR holds its ARL reading on the Gaussian-innovation nulls at every m and fails on
  N5/N6/N8 at every m, as in C76. The bounded monitor revokes the premise at the rate it fails
  (65% / 33% / 3% of replications at m = 60 / 300 / 2000 on N1), which is the gate doing its job.

So a deploy null exists by construction for what the units SHARE, and does not exist by
construction for their OFFSET unless the pair is a true twin (offset known) or m ≫ n (Tessera's
≥ 2-month baseline against 300-tick windows, a ratio near 10⁴). The registration said "no
envelope" on failure; the engine's convention (the retracted BF) is that a measured refusal is
recorded by name rather than left blank, and that is what ships: the object, its numbers, and no
admission. Nothing moved after the run; the verdicts stand as computed.

## Predictions, scored

Wrong: that the bounded increment family would hold at every λ in every cell (it fails one sign
at m ≤ 300 — the center); that the Gaussian family would refute at |λ| = 2 on N6/N8 (the pooled
estimator does not refute a heavy tail it cannot see — `max/mean` ≈ 10⁶ says so — while the
cards fail); that the contrast would be SLOWER than the temporal path on a treatment step (it is
twice as fast); that the mixture at α = 0.05 would hold on N1 and N3-* at m = 300 (it holds on
N1 only, at m = 2000). Right: the shared component cancels; the e-SR's pattern; the temporal
comparator fails on N1 at every m; the bounded monitor revokes where the premise fails.

## What would reverse the refusal

A registered study at m/n ≥ 10 (the fit-ratio floor Tessera's regime implies) on the same pairs
in which the mixture and betting cards hold their contract on every Gaussian-innovation null, or
a twin construction whose offset is known by design (same unit, A/B on the same instance) so the
center is not estimated. Either would set `minCalibration` (or a fit-ratio field) and flip
`validUnderEstimatedBaseline` for the admitted cards; the numbers in `admission` would then be
extended, not replaced.

## Provenance note

The run's manifest hashes `per-shard/contrast.ts` and `dist/per-shard/contrast.js` as they were at
run time, before `CONTRAST_NULL_ENVELOPE.admission` was filled from the run's own `cells.json`;
the fit functions are unchanged (the lockstep test at HEAD is the check), and
`test/contrast.test.ts` asserts the envelope's admission equals the committed run's P2 cells.

## Not done

No real deploy telemetry; no head-to-head against a Kayenta-style fixed-window gate (the next
item); the bounded-bet e-SR was absent (C77 PR #89 open at the run); no consumer path changed.
