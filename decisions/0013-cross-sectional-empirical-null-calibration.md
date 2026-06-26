# ADR 0013 — cross-sectional empirical-null calibration for e-BH: REJECTED (negative result)

- **Date:** 2026-06-25
- **Status:** **Research findings — REJECTED.** A design proposal (frontier work item 1) taken through two
  independent adversarial cold-eyes; both broke it, the second with code-confirmed counterexamples. The
  approach is recorded here as a *closed* frontier so it is not re-attempted — the same role ADR 0009 plays
  for the φ-deflation wall. No engine code changes.
- **Builds on / corrects:** ADR 0012 (the finding that motivated it), ADR 0006 (the operator it tried to
  re-use), ADR 0010 (the bounded-tail e-value that — this ADR concludes — already does the load-bearing work).
- **Disposition:** item 1 does NOT yield an FDR guarantee or even a safe refinement. Redirect effort to
  items 2 (auto factor-rank) and 3 (structured/hierarchical FDR), which this negative result independently
  points to. A *diagnostic-only* tail-region validity flag is the single salvageable fragment (item 5).

## The hypothesis (item 1)

ADR 0012 left fleet-FDP ≤ q as *empirical, not a theorem*: e-BH's FDR theorem needs per-shard
`E[e_j|H0] ≤ 1`, which real telemetry violates (realized null mean `μ0 ≈ 9–24`). The proposal: estimate the
realized null from the fleet cross-section (mostly-null at scale — Efron empirical-null analog) and recalibrate
each shard's e-value to mean ~1 before e-BH, restoring (or at least refining) the guarantee. Two design
iterations were tried.

- **v1:** estimate null survival `Ŝ0` + mean `μ̂0` from the cross-section, feed to `eBHConditionalCalibration`.
- **v2 (after the first cold-eye broke v1):** retreat to a *gated* design — a self-diagnosis flag + a Markov
  backstop claimed to reduce "exactly to plain e-BH" (no regression), with power-boosting only behind the flag.

## Why it fails (two independent cold-eyes, code-confirmed)

**1. e-BH is rank/scale-based, so mean-recalibration is the wrong operation.** e-BH selects via
`k·e_(k) ≥ N/q`, hence `e-BH(e/μ, q) ≡ e-BH(e, q/μ)` (elementary; reproduced in `scratchpad/backstop2.mjs`).
Dividing every e-value by `μ̂0 ≈ 9–24` therefore silently runs at effective `q' = q/μ̂0 ≈ 0.004–0.011` —
collapsing selections to **K=0** (a power regression against the raw-e pipeline ADR 0012 actually banked).
This is not a tuning artifact: it exposes that **e-BH already tolerates *common, bounded* inflation** — it
cancels in the relative ranking, which is *precisely why* ADR 0012's FDP held at 1.1% with the raw inflated
e-values. Recalibrating the mean to 1 "fixes" a non-problem and discards the headroom that made the status
quo work.

**2. Per-group recalibration is FDR-UNSAFE in the dangerous direction.** With per-group `μ̂0_g` (needed for
heterogeneity), a coherently *deflated* group (the documented coherence-breakdown — a correlated minority
event drags its robust bulk location down) is divided by a small number, **inflating that null group's
e-values** and re-ranking it to the top. Code-confirmed counterexample (`scratchpad/backstop4.mjs`):
50 true-null shards, status-quo raw-e K=0, recalibrated K=50, **FDP = 100%**. The `nullMean ∈ (0,1]` guard at
`fleet/e-bh-conditional-calibration.ts:77` does not catch it — the division is upstream of the call, which
passes `nullMean=1`. So an estimated μ̂0 is an *unguarded multiplicative inflator*.

**3. The break is always in the tail; no bulk diagnostic can see it.** e-BH fires in the far upper quantile.
A null can fit the central bulk perfectly and be heavy-tail-misspecified in the fire region (e.g.
`0.995·N(0,1) + 0.005·t₃`): the bulk goodness-of-fit flag passes while the supplied tail survival is
*understated* — the asymmetric anti-conservative direction that breaks FDR (ADR 0006 contract). v2's flag,
being a bulk statistic, is structurally blind to the very failure it was introduced to gate. The flag is "a
name, not an estimator."

**4. The retreat re-opened what it fixed.** v2's contract-driven fix (pre-divide, `nullMean=1`) re-introduced
the power regression (finding 1) and added a new over-rejection channel (finding 2). Its "the backstop ignores
the estimate" claim is false — the backstop consumes μ̂0 in the pre-division. The narrowed v2 was internally
contradictory.

## Conclusion — the real risks, and where they're already (or properly) handled

ADR 0012's empirical fleet-FDP is threatened by two things, *neither* of which empirical-null calibration
addresses well:

- **Unbounded single-shard tails** (the safe-t's `1e64` blowup → spurious e-BH fire). **Already solved** by
  the bounded-tail UI e-value (ADR 0010). This is the load-bearing fix, and it is in place.
- **Non-cancelling heterogeneous / coherent per-shard inflation** (inflation that does *not* cancel in the
  ranking because it is group-specific). The right tools are **better common-mode removal so residual
  inflation is homogeneous enough to cancel** (→ item 2, automatic factor-rank: a mis-set rank is what leaves
  heterogeneous residual inflation) and **taking the contrast *within* homogeneous groups** (→ item 3,
  structured/hierarchical FDR over the topology). Recalibration attacks neither and breaks the common-inflation
  case that already works.

So the honest disposition: **e-BH's rank invariance is a feature, not a bug** — common bounded inflation is
harmless, and the engineering effort belongs in (a) keeping the per-shard tail bounded (done) and (b) making
the residual inflation homogeneous/structured (items 2, 3), not in per-shard mean recalibration.

## Salvageable fragment (diagnostics only, NOT FDR control)

A *tail-region* validity statistic — held-out empirical survival at the fire quantile vs the model survival,
with a DKW band — is a legitimate **self-diagnosis flag** (item 5): it tells an operator when per-shard
validity is suspect. It does **not** restore or refine FDR control, requires none of this ADR's recalibration
machinery, and must be tail-based (a bulk fit cannot see the break). If pursued, it ships as a standalone
diagnostic, not as a calibration of the e-BH path.

## Carry-forward

- **Item 1 is CLOSED** as a path to fleet-FDR control. Do not re-attempt cross-sectional mean/survival
  recalibration of per-shard e-values; e-BH's scale-invariance defeats it.
- **Reallocate to item 2** (automatic factor-rank — the lever that makes residual inflation homogeneous so it
  cancels in the ranking) and **item 3** (structured/hierarchical FDR + localization over the topology DAG).
- The *provable* fleet-FDR-under-nonstationarity frontier remains exactly where ADR 0012 left it: open,
  needing a per-shard e-value valid under nonstationarity. This ADR rules out one tempting shortcut to it.
- Independently reproduced (operator-faithful e-BH reimplementation): scale-equivalence identity
  `e-BH(e/μ,q) ≡ e-BH(e,q/μ)` holds exactly, divide-by-μ̂0 collapses K 5→0 at μ=9/24, and per-group
  deflation drives a 50-shard all-true-null selection to FDP=1.00. (`ebh-verify.mjs`.)
