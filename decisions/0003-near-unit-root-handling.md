# ADR 0003 — near-unit-root signals: route to the self-normalized fallback, not AR(p)

- **Status:** Proposed
- **Date:** 2026-06-23

## Context

AR(1) pre-whitening (ADR 0001/0002) restores the betting e-process Ville bound for moderate
autocorrelation. A follow-up was filed as "AR(p>1) / near-unit-root (rho=0.95) handling — the
~1.8x residual the lag-1 fix can't remove." Empirical diagnosis (consumer calibration harness
against this engine, 2026-06-23, W=200, alpha=0.01, 8000 trials) **overturns that framing**:

| rho  | whitened with TRUE phi | whitened with estimated phi (clip 0.95) |
|------|------------------------|------------------------------------------|
| 0.90 | 0.64% (controlled)     | controlled                               |
| 0.95 | 0.63% (controlled)     | ~0.6–1.8% (borderline; clip + est noise) |
| 0.99 | 0.65% (controlled)     | **42.8% (catastrophic)**                 |

Two facts:
1. With the TRUE phi, even rho=0.99 is controlled. The failure is **not** model order and **not**
   intrinsic to lag-1 whitening.
2. The failure is the **phi clip ceiling**. `ar1Phi` / `computePerSignalAr1Phi` clip phi to
   [-0.95, 0.95] (guarding against innovation variance `sigma^2*(1-phi^2) -> 0`, which would
   amplify z without bound). A rho=0.99 signal is therefore whitened with phi=0.95, leaving heavy
   residual autocorrelation -> ~43% FPR.

## Decision (proposed)

Do **not** "fix" this with AR(p>1) and do **not** loosen the clip. Instead, treat a phi estimate
that hits the clip ceiling (|phi_hat| at 0.95) as a signal that the baseline is **near-unit-root /
effectively non-stationary** — a violation of the e-process's stationary-baseline premise — and
route it to the **self-normalized e-process fallback** the engine already provides
(EmpiricalProcessLIL bound; routed for the mixture / Page-CUSUM path via the
`ar1_phi_exceeds_threshold` reason). The betting path should respect the same routing rather than
whiten-and-hope.

## Why — and why not the alternatives

- **Chosen (route to self-normalized fallback)** because the fallback is whitening-free (it does not
  assume a clean AR(1) innovation), the mechanism already exists in-engine, and near-unit-root is
  genuinely outside what a stationary-baseline e-process can promise.
- **Not AR(p>1)** — a true near-unit-root AR(1) has no higher-order structure; fitting AR(p) only
  adds estimation variance, which is *worse* in the near-unit-root regime (the data table above
  shows perfect control at the true phi, so the problem is estimation/clip, not order).
- **Not loosen the clip toward 1.0** — innovation variance `sigma^2*(1-phi^2) -> 0` as phi -> 1, so
  z = residual / (B*sigma_innovation) amplifies without bound; the clip is load-bearing for
  numerical stability. Raising it trades one failure (under-whitening) for another (overflow).
- **Not silently ship the whitened result at near-unit-root** — it carries a false Ville guarantee
  (up to ~43% FPR).

## Consequences

- The betting path needs to consult the near-unit-root / fallback decision (today it consumes
  `ar1_phi` and whitens unconditionally). This is a behavior change for high-phi signals and so is
  **Proposed**, pending operator sign-off — hence no implementation in this ADR.
- Curation could additionally flag near-unit-root baselines (phi_hat at the clip ceiling) as
  non-stationary and exclude/quarantine them, since a near-unit-root "baseline" is questionable as a
  stationary reference in the first place.

## Ruled out / gotchas

- The mixture / Page-CUSUM path may already route high-phi to the self-normalized fallback (threshold
  ~0.5 per `ar1_phi_exceeds_threshold`); confirm the threshold and whether the betting path can share
  it before implementing, to avoid two divergent thresholds.
- A consumer validator (Tessera `calibration-envelope`) now sweeps rho=0.99 and clips its own
  estimator to 0.95 to mirror this engine behavior, so the cliff is visible in its published matrix.
