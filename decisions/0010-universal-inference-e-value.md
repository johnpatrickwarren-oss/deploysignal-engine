# ADR 0010 — universal-inference e-value resolves frontier #1 (the φ-floor / near-unit-root guarantee)

- **Date:** 2026-06-24
- **Status:** SHIPPED — `detectors/universal-inference-e-value.ts` (`universalInferenceMeanShiftEValue`),
  `test/adr-0010-universal-inference-e-value.test.ts`. Additive; no change to existing detectors.
- **Resolves:** ADR 0009 #1 (the safe-t φ-floor that ADR 0009 showed is fundamental *for a deflation fix*).
- **Process note:** the construction + its validity argument were independently cold-eye-attacked (a
  fresh-context reviewer told to REFUTE: 8M+ draws, independent RNG, unseen seed families, φ up to 1.0,
  plus a structural re-derivation). No `E[e|H0] > 1` found; the Markov-independence and null-sup claims
  verified. Verdict SOUND within the Gaussian-AR(1) envelope.

## The problem (from ADR 0009)
The safe-t BF (ADR 0005) is a Bayes factor with a `(ν+1)/2` exponent. Under an estimated φ, a short
calibration window occasionally mis-whitens catastrophically; the exponent amplifies the resulting
spurious t-statistic to `e ≈ 1e15`, and the heavy-tailed **mean** `E[e|H0]` — the quantity e-BH needs —
explodes near unit root. ADR 0009 built four control mechanisms (upper-confidence deflation,
residual-autocorrelation deflation, capping, abstention) and showed **all fail** — it is the exponent
itself that is fragile, so no re-weighting of the same statistic can be both valid and powered there.

## The resolution — drop the exponent: a split likelihood-ratio (universal inference) e-value
Universal inference (Wasserman–Ramdas–Balakrishnan, PNAS 117(29) 2020) gives an e-value as a plain ratio
of fitted likelihoods — no exponential amplification — with `E[e|H0] ≤ 1` by construction under **no**
regularity conditions, so the AR(1) coefficient φ is just an estimated nuisance, valid for any value.

Construction (`universalInferenceMeanShiftEValue`): split the calibration and test windows each in time
at their midpoint into a TRAIN half and an EVAL half.
- **ALT** params from TRAIN (separate cal/test means, shared φ̂, σ̂).
- **NULL** params = the H0 MLE ON EVAL (a common mean across both eval halves, free φ, σ) — found by a
  φ-grid search + bisection refine so it is a genuine SUP.
- `e = exp( ℓ_alt(EVAL) − ℓ_null(EVAL) )`, each eval half scored by its conditional AR(1) likelihood
  given its predecessor (which is the last point of the matching TRAIN half).

**Validity for any φ.** `e = L(EVAL; θ̂_train) / sup_{θ∈H0} L(EVAL; θ)`. By the AR(1) Markov property,
given the predecessors EVAL ⟂ TRAIN, so `θ̂_train` is conditionally independent of EVAL and
`L(EVAL; θ̂_train)` is a proper conditional density; the denominator is `≥ L(EVAL; θ_0^true)`. Hence
`E[e|H0] ≤ E[L(EVAL; θ̂_train)/L(EVAL; θ_0^true)] = 1`. The denominator MUST be a true sup — an
under-optimised null fit re-introduces violations (the φ=0.99 lesson; the grid search secures it,
cold-eye-verified LL-gap 0.000 vs a 4000-point grid).

## Evidence (12 disjoint seed families unless noted)
- **Validity, the safe-t kill cells:** φ=0.95 at cal=10/25/50/100/200 → `E[e|H0]` ≈ 0.17–0.19
  (was 368–1e15); φ=0.99/0.999 → 0.16–0.21; random-walk φ=1.0 → 0.13–0.18. **Worst cell over everything
  ≈ 0.27**; deep-CI worst (cal=300/φ=0.9, K=200k) = 0.181 (95% CI ≤ 0.184).
- **Bounded:** max single e ≈ 50–800 across 8M+ draws (vs safe-t's 1e15) — the catastrophe is gone.
- **Power (shift = 2σ, P(e≥100)):** φ=0 → 98–100%; φ=0.5 → 83–96% (safe-t adaptive: 24–71%);
  φ=0.8 → 7–25% (safe-t: 0% AND invalid); φ=0.9 → 2%. Honestly low at high φ (the autocorrelation
  identifiability limit) but VALID throughout. In the identifiable regime it BEATS the safe-t.

## Caveats / envelope (honest)
1. **Well-specification.** Exact validity needs the Gaussian-AR(1) model to contain the H0 truth.
   Empirically robust to Student-t(df=4) innovations (`E[e|H0]` ≈ 0.10–0.12), but that is NOT a
   guarantee. On real non-Gaussian telemetry this is where a violation could hide — validate on the
   substrate before relying on it for the FDR path (cf. [[project_tessera_guarantee_finding]]: model-based
   guarantees can fail on real data). The math guarantee is conditional on the model; it is not a free lunch.
2. **Power at φ ≳ 0.8 is low** — a power, not a validity, issue (fundamental: a short window cannot
   identify a mean shift through strong autocorrelation). The split also spends half of each window on
   training (UI conservativeness); the split ratio is tunable for power without affecting validity.
3. Scope is a MEAN shift with an AR(1) nuisance; a variance change routes to the distributional-signature
   detector (ADR 0004 Tier 2), near-I(1)/unit-root drift to the ADR 0003 path.

## Recommendation
Use `universalInferenceMeanShiftEValue` for the per-shard FDR path where the calibration window is short
and/or the residual autocorrelation is non-negligible — it is the validity-by-construction option. Keep
the safe-t for the long-calibration, well-whitened regime where its power is higher. Next: validate the
well-specification envelope on real Tessera telemetry before wiring it into the fleet FDR pipeline.
