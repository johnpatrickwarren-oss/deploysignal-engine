# ADR 0025 — Sequential (predictable-plug-in) universal-inference e-process: F6 closed by construction

- **Date:** 2026-07-29
- **Status:** implemented (`detectors/sequential-ui.ts`); the fixed-split UI (ADR 0010) is NOT
  replaced — the two serve different call shapes (below).
- **Closes:** Tessera audit F6's STANDING remnant (research/2026-07-02-math-audit.md) — the
  fixed-split UI's "E ≤ 1 for any φ by construction" claim had a proof hole (the cal-EVAL half
  precedes the test-TRAIN half, so the numerator's parameters are not independent of the scored
  fold at φ ≠ 0). The named fix — a predictable numerator — is this module.

## Construction

    E_t = Π_{s≤t} f_{θ̂_{s−1}}(x_s | x_{s−1})  /  sup_{θ₀∈H0} Π_{s≤t} f_{θ₀}(x_s | x_{s−1})

H0 = {Gaussian AR(1), constant mean, any φ ∈ (−1,1), any σ²}, conditioned on x₀. θ̂_{s−1} is any
F_{s−1}-measurable estimate (implemented: regime means + lag-1 φ̂/σ̂² recomputed on the past
prefix against current regime means — stale-mean lag products bias φ̂ toward unit root and were
measured to cost 0.93 → 0.17 detection). The denominator is a genuine profiled sup (φ grid +
golden-section refinement; μ, σ² closed-form per φ, prefix-sum O(1) per evaluation).

**Theorem (no empirical crutch):** for every θ₀ ∈ H0, E_t ≤ Π f_{θ̂}(x_s|x_{s−1}) / Π f_{θ₀}(x_s|x_{s−1}),
a predictable-plug-in likelihood-ratio martingale under P_{θ₀} — so E is an e-process:
**E[E_τ] ≤ 1 at every stopping time, for any φ including near unit root, by construction.**
Test-locked: crossing ≤ α and stopped mean ≤ 1 at φ ∈ {0, 0.6, 0.95, 0.999}.

Two properties the fixed-split variant does not have:

1. **Anytime validity** — acting at the first crossing is covered; the fixed-split e-value is
   fixed-time only. This also makes the increments legitimate material for SRR-style anytime
   detectors (the O3 promotion question, per-onset states being the cost).
2. **Self-standardization within class** — the null profiles μ, φ, σ² out, so a raw (mis-scaled,
   level-shifted) feed stays valid with no standardization step (test-locked at μ₀ = 5, σ = 2).
   Contrast audit F7's gaussian-mixture failure mode (10 % σ̂ error → null mean ×15).

## Measured power, stated honestly

The composite free-φ null is ABSORBING: at a 1.5σ step (cal 60 / T 300, φ = 0.5) even the
ORACLE-parameter numerator reaches only terminal logE ≈ 7 — that is the construction's ceiling,
not an estimator defect — and the predictable plug-in additionally pays ~(k/2)·log t learning
regret (~8–9 nats by tick 60). Measured detection at e ≥ 100:

| shift | sequential (anytime crossing) | fixed-split (terminal) |
|---|---|---|
| 1.5σ | 0.05 | 0.27 |
| 2.5σ | **0.55** | 0.55 |

**Division of labor:** fixed-window terminal analyses keep the fixed-split UI (its ~6× empirical
slack at small shifts is real power the sequential one spends on regret); anytime/monitoring use
gets the sequential process (parity at moderate shifts, strictly stronger guarantee, gapless
proof). ADR 0010's header should keep its empirical-audit disclosure for the fixed-split; the
"known fix" it names now exists.

## Envelope

Same well-specification requirement as ADR 0010 (the Gaussian-AR(1) class must contain the H0
truth; heavy-tail robustness is empirical there — carry ADR 0011's disclosure). Not a per-shard
real-telemetry guarantee (ADR 0012's wall is untouched). O(T²) per full trajectory from the
per-tick prefix recompute (T ≈ hundreds: milliseconds).

## Tests

`test/adr-0025-sequential-ui.test.ts` — 5: anytime validity across φ (crossing + stopped mean),
raw-feed self-standardization, 2.5σ power with the calibration note, trajectory sanity, guards.
