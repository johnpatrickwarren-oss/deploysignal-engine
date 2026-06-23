# ADR 0001 — AR(1) pre-whitening for the betting e-process

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

The Family A betting e-process is a valid test (super)martingale only when the standardized
observation `z_t` is a martingale difference under H0 — i.e. when observations are temporally
independent. Under autocorrelated H0 that assumption breaks and the Ville bound fails: external
calibration against this engine (Tessera `coverage-matrices/calibration-envelope.md`, 2026-06-22)
measured per-shard type-I inflation up to ~192× nominal at AR(1) ρ=0.95, and fleet e-BH FDR ~73%
against a 5% target. An in-engine reproduction (`test/betting-eprocess-ar1-prewhitening.test.ts`)
shows AR(1) ρ=0.9 null fire-rate > 30% at α=0.01.

The engine already solves this for its other Family A detectors via the `ar1_phi` field:
`family-a-mixture-supermartingale.ts`, `page-cusum.ts`, `ar-p.ts`, and `seasonal.ts` consume it to
pre-whiten observations (`x_pre_whitened = x_centered − phi·x_{t-1,centered}`); `ar1_phi` is
calibrated by `tools/fit-production-substrate.ts` (Yule-Walker on baseline-mean-centered residuals,
clipped to [-0.95, 0.95]). The **betting e-process was the one detector left out** — its only AR(1)
mitigation was the `betting_sliding_buffer_threshold` ρ-stamped firing threshold, which is fragile
to ρ misspecification (a threshold stamped at ρ=0.5 leaves ~51%/~72% FPR at true ρ=0.9/0.95).

## Decision

Consume `ar1_phi` on the betting path, mirroring the mixture-supermartingale pattern exactly:
- Add `last_x_centered` to `BettingEProcessState` (init 0 in `freshBettingState`).
- In `updateBettingState`, accept an optional `ar1Phi = 0`, whiten the centered observation
  (`xWhitened = (x − baselineMean) − ar1Phi·last_x_centered`), store the **raw** centered value for
  the next tick, and standardize the whitened value.
- Thread `perSig.ar1_phi` through `buildMSPRTParamsLocal` → `derivation.ar1_phi` →
  `evaluateBettingEProcess`.

## Why — and why not the alternatives

- **Chosen (consume `ar1_phi`)** because the mechanism, calibrator, and field already exist for the
  engine's other detectors; the betting path is the sole omission. Reusing it is consistency, not
  novelty, and keeps one whitening contract across Family A.
- **Not the `betting_sliding_buffer_threshold`** approach: it is ρ-adaptive only at calibration time,
  fragile to ρ drift (measured FPR blow-ups), and produces opaque astronomically-large thresholds.
- **Not rescaling the standardization variance by (1−φ²)**: the mixture-supermartingale path does not
  rescale either — it standardizes the whitened residual against the marginal σ². This is
  conservative (slightly under-scaled z ⇒ lower power, never higher FPR) and keeps parity across
  detectors. Re-deriving innovation variance is a possible future refinement, not required for the
  Ville bound (which only needs the martingale-difference property whitening restores).

## Consequences

- **Backward-compatible.** `ar1_phi` is optional; absent ⇒ `phi=0` ⇒ `xWhitened === x_centered`, so
  `M` / `bet` / running moments are computationally identical to the prior path (only the new
  snapshot field `last_x_centered` is additionally written). `updateBettingState`'s new parameter
  defaults to 0, so all existing callers are unchanged. The full suite passes unmodified.
- Consumers pinning this engine (e.g. Tessera) pick up the betting-path fix on the next tagged
  version bump (0.3.1-pre → 0.3.2-pre).

## Ruled out / gotchas

- **Store the raw centered value, not the whitened one.** Storing `xWhitened` in `last_x_centered`
  would compound the AR(1) correction across ticks. Mirrors the mixture-supermartingale comment.
- **Near-unit-root (ρ→1).** Lag-1 whitening cannot fully decorrelate; `ar1_phi` is clipped to
  [-0.95, 0.95] upstream. AR(p>1) is future work.
- The `evaluateBettingEProcess` caller passes `x` already mean-centered then re-adds `baselineMean`;
  `updateBettingState` re-centers internally, so whitening operates on the centered series with no
  double-centering.
- **Deserialized pre-change state (cold-eye H1).** `last_x_centered` is non-optional on the
  interface, but a `BettingEProcessState` deserialized from a snapshot persisted before this field
  existed would lack it; with `ar1_phi != 0` that would propagate `NaN`. `updateBettingState` reads
  it via `?? 0`, so such states behave as `phi=0` on their first post-upgrade tick. A two-tick test
  pins that the RAW (not whitened) centered value is stored, guarding against compounding.
