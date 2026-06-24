# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **ADR 0004 PR C — distributional-signature detectors** (`detectors/distributional-signature.ts`).
  Promotes Tessera's Lever B SCORES (ADR 0016) — the FD-side complement to the BF e-value, covering its
  same-variance blind spot. `distributionalSignature(values, cal, test)` → `{fRatio, trendT,
  collapseSigma, hasSignature}`: innovation-variance ratio (SDC/bit-flip), trend t-stat on WHITENED
  innovations (degradation), one-sided downward collapse (detachment). Promotes scores ONLY; the
  benign/fault routing policy + event feed stay app-side (ADR 0004 Tier 3).
  - **The load-bearing fix — trend whitening.** The trend t-stat MUST run on whitened innovations:
    measured FP at threshold on AR(1) nulls — whitened holds ~0.2% at every φ, the naive raw t-stat
    inflates to 15% (φ=.8) / 33% (.9) / 50% (.95) (~200–300× — the Tessera ADR 0016 finding). The test
    pins this raw-vs-whitened separation as the valid null.
  - Scores by type (400 trials): healthy/benign fRatio≈1, trendT≈0.8, collapseσ≈0 → 0% signature (a
    benign mean step is correctly left to the BF); fault-variance fRatio 9.0, fault-trend trendT 11.8,
    fault-collapse collapseσ 20.0 → 100% signature each. Honest limits documented: collapse one-sided
    (downward), and the irreducible mean-only-fault (no signature; needs the consumer event channel).
- **AR(1) pre-whitening on the betting e-process path.** The betting detector was the one Family A
  detector not consuming the `ar1_phi` field (the others — mixture-supermartingale, Page-CUSUM,
  ar-p, seasonal — already pre-whiten). Under autocorrelated H0 this left its Ville bound broken
  (AR(0.9) null fire-rate >30% at α=0.01). Now `updateBettingState` consumes `ar1_phi` (default 0,
  backward-compatible), mirroring the mixture-supermartingale pattern. See
  `decisions/0001-betting-eprocess-ar1-prewhitening.md`.
- Full suite 123 pass / 0 fail (incl. 5 new tests: phi=0 identity, last_x_centered storage, AR(0.9)
  FPR collapse, power retained, iid sanity).

## In flight
- ADR 0004 promotion in flight: PR A (#21, valid BF e-value) + PR B (#22, contamination-robust
  common-mode, stacked on A) both SHIP via cold-eye. PR C (this branch, off main) under cold-eye.

## Next
- Land PRs A/B/C; then PR D (`per-shard/baseline-lifecycle.ts`, epoch-level drift-trigger) and PR E
  (validity-envelope metadata across all e-values + relabel the plug-in betting/mixture as
  conditionally-valid). PR D is independent (off main); PR E touches PR A's envelope pattern.
- Tag an engine pre-release after the relevant PRs; Tessera bumps its pin and migrates its `tools/*`
  to thin validation harnesses over the promoted APIs (ADR 0004 migration step 6).

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (PR C): `detectors/distributional-signature.ts`,
  `test/adr-0004-pr-c-distributional-signature.test.ts`
- Source of truth (Tessera): `tools/fault-discriminator.ts` (PR C, ADR 0016 — scores only, not the
  classify/event policy)
- NOTE: PRs A/B carry their own STATE Done-entries on their branches; reconcile this section at merge.
