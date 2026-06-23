# ADR 0002 — Kendall bias correction on the AR(1) phi estimator

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

The AR(1) coefficient estimators — `ar1Phi` (`tools/fit-production-substrate.ts`, which stamps
`ar1_phi` and also feeds the NAB per-dataset / self-normalized-fallback derivation via
`buildPerDatasetConfig`) and `computePerSignalAr1Phi` (`detectors/family-a-mixture-supermartingale.ts`)
— used plain OLS / Yule-Walker lag-1 (`lag1 / variance`, clipped to [-0.95, 0.95]). OLS biases the
AR(1) coefficient *downward* by ~`(1+3*phi)/n`. A phi estimated too low under-whitens, leaving
residual autocorrelation after pre-whitening and re-inflating type-I error — the failure the
whitening was meant to remove. The bias is negligible at long baselines but material at short
baselines / high phi (a consumer-side calibration validator demonstrated the under-whitening at
short n; the engine's own estimator omitted the correction).

## Decision

Apply the Kendall median-unbiased small-sample correction before the stationary clip, in both
estimators:

    phi* = phi_ols + (1 + 3 * phi_ols) / n      (then clip to [-0.95, 0.95])

## Why — and why not the alternatives

- **Chosen** because it is the standard leading-order debias for AR(1) OLS, one line, and makes the
  engine's calibrator consistent with the bias-corrected estimator already used downstream.
- **Not leave OLS as-is** — it systematically under-whitens at high phi / short baselines, the
  regime where whitening matters most.
- **Not a full Marriott-Pope / bootstrap debias** — overkill for the leading-order bias; the clip
  already guards the near-unit-root overshoot.

## Consequences

- Stamped `ar1_phi` rises slightly (toward the true phi). Effect shrinks as O(1/n): negligible for
  long production baselines, meaningful for short ones. No exact-value test broke (the `0.2`/`0.5`
  substrate tests are configured pass-throughs, not estimator outputs; the self-normalized-fallback
  and NAB tests are tolerance/threshold with wide margins). Full suite 128/0.
- Both estimators now carry the identical formula + comment; a future refactor could share one
  helper. Version 0.3.3-pre -> 0.3.4-pre.

## Ruled out / gotchas

- The AR(p>1) fit (`detectors/ar-p.ts` Levinson-Durbin) is a DIFFERENT estimator and is NOT touched
  here.
- Near-unit-root (phi -> 1) is still imperfectly whitened by a lag-1 model even with the correction
  (a finite-sample phi cannot fully decorrelate); that residual is a separate, documented limitation.
