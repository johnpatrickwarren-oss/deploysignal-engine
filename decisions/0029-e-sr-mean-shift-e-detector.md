# ADR 0029 — An e-SR e-detector for the mean-shift class: an average-run-length guarantee beside the α budget, never on it

- **Date:** 2026-09-03
- **Status:** implemented (`detectors/e-sr-mean-shift.ts`, `test/e-sr-mean-shift.test.ts`); wiring
  decided by study `2026-09-e-sr-delay`'s registered ship rule (`validation/e-sr-mean-shift/`).
- **Builds on:** ADR 0004 PR E (validity envelopes and the FDR-path gate); the h0-battery and
  `validation/arl-delay` (protocol Amendment v1.C66).
- **Driven by:** WORKLIST C66/C68 under `knowledge/methodology/pages/threshold-free-observability.md`
  claims (4) and (6); design at `knowledge/stats/pages/e-sr-mean-shift-design.md`; source Shin,
  Ramdas and Rinaldo 2022 ("E-detectors") as read on `knowledge/stats/pages/e-detector.md`.

## Problem

Every shipped mean-shift detector is a single-onset statistic (a partial sum or a wealth process
started at deployment), so its delay after a change grows with the time the change arrives:
`validation/arl-delay` measured the Family A mixture at 35.5 ticks after a 1.5σ onset at tick 200
and its construction puts the same onset at tick 2,000 near 140 ticks. The portfolio also had no
detector whose error metric is the one change detection uses — the average run length under H₀ —
so the wiki's e-detector page could describe the class but no card could carry it.

## Decision

1. `detectors/e-sr-mean-shift.ts`: a uniform mixture of sixteen Shiryaev–Roberts e-detectors over
   exponential increments `exp(λr − λ²/2)`, `λ ∈ ±{0.25·12^{k/7}}`, on the standardized AR(1)-whitened
   residual; SR recursion `M_t(λ) = L_t(λ)(M_{t−1}(λ) + 1)` in the log domain; alarm at
   `M_t ≥ 1/α_ARL`, default `α_ARL = 10⁻³`. Guarantee: `E∞[N*] ≥ 1/α_ARL` for every conditionally
   mean-zero sub-Gaussian(1) pre-change law (Theorem 2.4 with Propositions 2.3 and Definition 2.9).
   A companion CUSUM recursion per λ gives the classical onset estimate; it never drives the alarm.
2. `ValidityEnvelope.statistic?: 'e-value' | 'e-detector'`. `isValidForFdrPath` is false and
   `assertValidForFdrPath` throws by name for `'e-detector'` under every assertion: `E∞[M_t] = t`,
   so the statistic is not an e-value and cannot enter e-BH or the per-run α budget (the F3
   category error of the 2026-07-02 audit).
3. The delay bound the module's header quotes is Theorem 4.3 with Proposition B.2 on this grid
   (`g_α ≈ 11.5` nats at `α_ARL = 10⁻³`; ≈ 13 ticks at 1.5σ) and carries no onset time.

## Consequences

- The detector is usable only where its residual premise holds; under an estimated baseline the
  ARL is a measured, priced quantity (study H4), the same premise every plug-in detector rests on.
- No certification card exists for it: the protocol's three classes have no floor for an ARL or
  a delay. Amendment v1.C66 made those endpoints reportable; giving them verdict authority for an
  `e_detector` class is a further numbered amendment, gated on the study's outcome.
- Re-freezing the fifteen cards was required because `validity-envelope.ts` is a pinned source;
  the certification verdict was re-run to a scratch directory and every card was field-identical.
- Rejected forms, with reasons, are on the design page: the per-onset Howard mixture (O(t) state),
  Tessera's per-tick increment mixture (valid, but Theorem 4.3 is proved for the mixture of
  detectors), e-CUSUM (Remark 2.13), the BCS-detector (the common-index-set regime), BOCPD (no ARL).
