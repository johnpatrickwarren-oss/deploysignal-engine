# ADR 0028 — Martingale merging in the fleet layer, and a gate on the product

- **Date:** 2026-09-02
- **Status:** implemented (`fleet/combine.ts`, `test/adr-0028-martingale-merging.test.ts`)
- **Builds on:** ADR 0027 (the evidence surface); the R11 combine primitives.
- **Driven by:** WORKLIST C63 under `knowledge/methodology/pages/threshold-free-observability.md`
  claim (3), from Ramdas and Wang 2025 chapter 8 as read on
  `knowledge/stats/pages/ramdas-wang-2025.md` §2.

## Problem

`fleet/combine.ts` shipped the two extremes of the merge spectrum and nothing between them. The
arithmetic mean is the admissible symmetric merge under arbitrary dependence (Theorem 8.4) and
stays. The product is admissible only for independent or sequential e-values, is the λ ≡ 1
"all-in" bet, has the largest null variance of any exact sequential merge (Proposition 8.16), and
Example 8.17 shows its wealth going to zero almost surely while its expectation is maximal. It was
guarded by a docstring.

## Decision

1. `combineMartingale(logEs, lambdas)` — `∏ (1 − λ_k + λ_k e_k)` in the log domain with a
   predictable `λ_k ∈ [0, 1]` (Definition 8.10). An e-value on sequential inputs (Proposition
   8.11); exact when they are exact. λ ≡ 0 is 1, λ ≡ 1 is the product.
2. `adaptiveLambdas(logEs, γ = 1/2)` — the empirically adaptive bet (Example 8.14): `λ_1 = 0`,
   `λ_k` maximizes the mean past log-growth over `[0, γ]`, found by bisection on the concave
   objective's derivative. Predictable by construction; asymptotically log-optimal on inputs iid
   under the alternative (Theorem 7.22).
3. `combineProduct` now requires `{ sequential: true }` and throws otherwise, the `e-bh-guarded`
   refusal pattern; `combineProductUnguarded` keeps the raw sum for measurement harnesses.

## What changes numerically

Nothing on any shipped path: no consumer or engine module calls `combineProduct` (grep, 2026-09-02;
`fleet/detectors.ts` takes the primitive from its caller and none passes the product).
`combineAverage` is untouched.

## Acceptance criteria (the tests)

- Gate refuses without the assertion; unguarded product is the raw sum.
- Endpoints: λ ≡ 0 → 1, λ ≡ 1 → product; logMix stable at ±∞.
- Exactness: adaptive merge on iid exact e-values has mean 1 within 3 se (N = 20,000, K = 30).
- E-power: on Example 8.17's alternative, λ converges to 1/3 (±0.05 over the last 200 of 3,000)
  and the merge beats the mean by hundreds of nats while the product is 0.
- Variance: the product's null variance exceeds λ = ½ and adaptive at K = 6, N = 20,000.
- Predictability: λ_k unchanged when e_k.. change.

## Out of scope

Wiring a martingale merge into any consumer, and the tessera-rng segment-carryover study (the
continuation product of Proposition 7.9 against the shipped segment mean), which is registered
separately under C63 and pre-registered before it runs.
