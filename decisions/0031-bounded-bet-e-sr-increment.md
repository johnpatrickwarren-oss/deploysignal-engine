# ADR 0031 — The bounded-bet increment on the e-SR: a run-length guarantee that needs no sub-Gaussian premise, at a delay price

- **Date:** 2026-09-04
- **Status:** implemented (`detectors/e-sr-mean-shift.ts` `increment: 'bounded'`, `test/e-sr-mean-shift.test.ts`);
  certified under the `e_detector` class by study `2026-09-e-sr-bounded` (`validation/e-sr-bounded/`),
  whose registered ship rule decides the card's verdict, not this ADR.
- **Builds on:** ADR 0029 (the Gaussian e-SR); ADR 0027 (the calibration monitor's `gBounded`, clip 3,
  eight ±λ); protocol Amendment v1.C77 (`knowledge/methodology/pages/detector-certification-protocol.md`).
- **Driven by:** WORKLIST C77; `knowledge/stats/pages/e-sr-mean-shift-design.md` (the named fallback);
  `stats/e-detector-cert-2026-09-03` (ARL a fifth of the claim on N5, N6, N8);
  `stats/nab-time-to-alert-2026-09-04` (the Gaussian increment alerting on 20 of 23 real quiet stretches).

## Problem

The Gaussian e-SR's increment `exp(λr − λ²/2)` is an e-process only for a conditionally sub-Gaussian(1)
residual. On heavy-tailed nulls its average run length is a fifth of the claim, and on real telemetry
under a probationary fit it alarms almost immediately. The portfolio's own gate already runs an
increment that does not need that premise — the calibration monitor's bounded bet — and the design
page named it as the fallback without building it.

## Decision

1. `ESrMeanShiftParams.increment?: 'gaussian' | 'bounded'`, default `'gaussian'`, behaviour
   byte-identical when absent (tested). `'bounded'` runs the unchanged SR recursion, mixture, log-domain
   accumulation and CUSUM companion on `g_λ(r) = 1 + λ·clip(r, ±3)/3` over the monitor's grid
   `±{0.1, 0.3, 0.6, 0.9}` (`E_SR_BOUNDED_LAMBDA_GRID`); a caller-supplied grid must keep every
   `|λ| < 1`. `E[g_λ | F_{t−1}] = 1` whenever the *clipped* residual is conditionally mean-zero, so
   Theorem 2.4 gives `E∞[N*] ≥ 1/α_ARL` for symmetric pre-change laws at the reference location, at
   any scale and any tail.
2. Registry id `e_sr_mean_shift_bounded` with `E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE` (`statistic:
   'e-detector'`, refused by `assertValidForFdrPath`); nothing enters `DETECTOR_ENVELOPES`.
3. The certification scorer evaluates the class delay floor at the card's declared increment
   (`guarantee.regime.increment`, absent = 'gaussian', arithmetic unchanged): for 'bounded', `D` and
   `V` of `log g_λ` under `N(δ_eff, 1)` at the grid λ maximizing `D`, by quadrature. Registered at
   α_ARL = 10⁻³, δ = 1.5: 34.9 / 47.0 / 71.9 / 239.9 ticks at φ = 0 / 0.3 / 0.6 / 0.9.

## The premise and its price, stated once

- **Premise.** A conditionally mean-zero clipped residual. Symmetric laws satisfy it exactly; a skewed
  law does not: the standardized lognormal's clipped mean is about −0.028, which drives the negative-λ
  components up by 0.8% per tick at λ = −0.9. Whether the guarantee survives N5 is what the study's S2
  cell measures; the card claims N5, N6 and N8 inside its regime and takes the scorer's answer.
- **Price.** The growth rate at the K1 canonical is 0.344 against the Gaussian's 1.125, so the delay
  is about three times longer at the same α_ARL (registered prediction 20–25 ticks against 7). A
  consumer that can certify its residual sub-Gaussian keeps the Gaussian increment; one that cannot
  — every probationary-fitted real trace so far — pays the delay for a run-length guarantee that
  holds.

## What does not change

The Gaussian e-SR, its card, its envelope, the FDR gate, every consumer. No tag is cut: C76 runs
inside the engine.
