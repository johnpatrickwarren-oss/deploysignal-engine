# ADR 0022 — calibrated group attribution (null model + coincidence window) and leave-one-shard-out factors for small domains

- **Date:** 2026-07-02
- **Status:** **SHIPPED.**
- **Context:** 2026-07-02 math audit (Tessera `research/2026-07-02-math-audit.md`, finding **F11** — the
  localization/locality improvement program, items (1) and (3)). Two localization-path defects, both of the
  same species: an uncalibrated statistic whose behavior depends on group size.

## Defect 1 — `attributeCommonMode` was uncalibrated co-firing clustering

`topology/common-mode-attribution.ts` surfaced any infra node (psu / rack / cooling_zone) touched by
≥ `min_member_count` (absolute count, default 2) distinct fired shards. Two holes:

- **No null model.** Under an independent per-shard false-fire rate α, a g-member group falsely surfaces
  with probability ≈ C(g,2)·α² — quadratic in group size, and the fleet-level false-candidate count is then
  linear in the number of groups. At g = 72, α = 0.01 that is ≈ 0.15 false candidates per rack per window;
  a small-g toy sweep cannot see the defect. An absolute-count threshold makes candidate strength depend on
  rack size.
- **No temporal coincidence.** `event_ts` was only min/max-aggregated, so fires days apart still clustered.

## Construction 1 (backward-compatible; annotations appear only when the caller supplies the inputs)

Three optional fields on `CommonModeAttributionOpts`:

- `fleet_fire_rate` (α̂ ∈ (0,1)) → each candidate carries **`binom_tail`** = P(X ≥ k), X ~ Binomial(g, α̂),
  with g = the node's FULL group size (all `SHARD_MEMBER_KINDS` nodes within `max_hop_distance`, fired or
  not, union-ed with the counted fired members so k ≤ g always) and k = the distinct counted fired members.
  Computed with a log-factorial table + logsumexp (`binomialUpperTail`, exported; stable at g = 5000 deep
  tails; no external deps). Thresholding on `binom_tail` instead of the raw count makes the false-candidate
  rate per group ≈ the threshold, **invariant to rack size**.
- `per_shard_e_values` (map over ALL group members, not just fired ones) → each candidate carries
  **`group_e_value`** = the arithmetic mean of the group members' e-values. The mean of valid e-values is a
  valid e-value; validity is **inherited from the inputs** (engine convention — this module mints no
  guarantee). Members missing from the map are excluded from the mean (equivalent to averaging the covered
  sub-group, still valid).
- `coincidence_window_s` → only the LARGEST subset of a node's fires fitting inside a sliding window of that
  many seconds (max ts − min ts ≤ window; sort + two-pointer, first maximal window for determinism) counts
  toward `min_member_count`; member/timestamp/hop aggregation covers that counted subset only.

`correlational_not_causal: true` labeling unchanged. Legacy calls (no new options) produce identical
results with **no new keys** (locked by test).

## Defect 2 — small-domain factors self-absorbed and mirrored faults

`fleet/detection-common-mode.ts` evaluated every shard against a domain factor that INCLUDED the shard
itself. Tukey's breakdown point protects large domains, but the robust location of 2 points is their
average: in a 2-member domain a faulty member's step moved its own reference by step/2 — the fault
**half-self-absorbed** (measured residual ≈ 4.0/8) and the healthy sibling showed a **mirrored −step/2**
spurious excursion.

## Construction 2 — leave-one-out factors, applied exactly once

Domains with 2..**`LOO_MAX_MEMBERS` = 5** (exported) members are deflated against leave-one-out factors:
shard i vs F_d^{(−i)}, the robust location over the OTHER members only (for a 2-member domain: the sibling
alone — a pure pair contrast; the evaluated shard cannot move the reference it is compared against).
Domains > 5 members keep the existing all-members iterated path bit-for-bit (locked by a deepStrictEqual
test against an in-test replica). The `< 2`-member skip guard and the reference-energy degeneracy guard are
preserved; `leaveOutGroups` composes (own-group exclusion is a superset of self-exclusion, with a
leave-one-shard-out fallback when the domain is a single group).

Two construction details were forced by measurement, not by the original spec:

1. **LOO runs ONCE, in a single pass after the backfitting sweeps** (small domains are skipped inside the
   loop). Iterating LOO is ill-posed: after the first projection the pair's residual noises are
   anti-correlated, the next sweep's reference-window slope fit finds λ̂ ≈ −1, and re-projection
   **annihilates both the fault and the contrast** (measured at high factor SNR: faulty residual
   8.0 → 0.2 over 8 sweeps). A pair contains exactly one usable contrast. Running the pass after the
   sweeps also identifies the small-domain loading on residuals already clean of large-domain common-mode.
   Within a domain, all LOO factors/loadings are computed before any member is deflated
   (member-order independent).
2. **The mirror on a 2–3-member domain's healthy sibling is intrinsic and is NOT removed.** For members
   (a, b), r_a = a − λ̂_a·b and r_b = b − λ̂_b·a are the only contrasts available and r_b + λ̂_b·r_a ∝ b —
   any "repair" reconstructs the undeflated series. LOO converts (half-absorbed faulty, −step/2 mirror)
   into (**full-step faulty**, ≈ λ̂·step mirror). See caveats.

## Findings (from the shipped tests, seeded LCG, deterministic)

- **Rack-size calibration** (null fleet, α = 0.05, 400 trials/size): raw ≥2-count false-candidate rate
  grows ≈ 0.01 → 0.24 → 0.88 across g ∈ {4, 18, 72}; thresholding at `binom_tail` ≤ 0.01 holds every size
  ≤ 0.03 and ~flat (spread ≤ 0.025).
- `binomialUpperTail` matches direct summation to < 1e-12 (g ≤ 18 grid), monotone in k, finite positive at
  (g = 5000, k = 200, α = 0.01).
- **Coincidence window**: fires 10 000 s apart with a 3600 s window do not cluster; the same fires 600 s
  apart do; a straggler is dropped while the coincident pair survives, and the candidate's timestamps cover
  the counted set only.
- **2-member domain** (step = 8σ, 8 seeds): faulty residual carries 7.9/8 under LOO vs 4.0/8 under the old
  all-members path; the sibling's pair-contrast mirror ≈ 4.1/8 in magnitude, below the faulty member
  (magnitude ranking still points at the faulty member at this SNR).
- **3-member**: faulty 7.9/8 (old 7.3/8 — Tukey already partially protected); healthy mirror share ≈ 2.7/8,
  clearly below the faulty.
- **5-member**: faulty 8.0/8; healthy members clean (max |shift| ≈ 0.05/8·step scale — the LOO Tukey center
  over ≥ 3 others rejects the single faulty sibling).
- **> 5-member domain**: output numerically identical to the pre-change path (deepStrictEqual).
- Engine suite green: 237/237 (226 pre-existing + 11 new).

## Honest caveats

- **`binom_tail` assumes independent fires under the null.** Real healthy fleets have positive co-firing
  dependence (residual common-mode the deflation missed, shared load transients): positive dependence
  fattens the joint upper tail relative to Binomial(g, α̂), so the score is **anti-conservative under
  positively dependent nulls** — treat thresholds as ranking calibration, not an FDR-bearing p-value. (If
  fires were negatively dependent it would be conservative; that is not the plausible direction here.) α̂
  itself is an estimate; an under-estimated α̂ is also anti-conservative. The FDR-bearing path remains
  per-shard e-values → e-BH; `binom_tail` calibrates ATTRIBUTION strength across group sizes.
- **`group_e_value` validity is inherited, not minted.** It is a valid e-value exactly when the supplied
  per-shard values are valid e-values for the intended null; garbage in, calibrated-looking garbage out.
  Members missing from the map shrink the effective group (documented in the type).
- **The small-domain mirror is intrinsic.** A 2-member (and, degraded, 3-member) domain yields one contrast;
  the healthy sibling necessarily carries a mirrored share of its sibling's fault (measured ≈ λ̂·step at
  n = 2, ≈ λ̂·step/2 at n = 3). Consumers must localize ≤ 3-member-domain excursions at PAIR/DOMAIN
  granularity — or route the pair to a Mode-B-style concurrent contrast — never read the sibling's mirrored
  excursion as an independent fault. The audit-spec hope that LOO leaves the sibling noise-clean is
  algebraically unattainable; the shipped tests lock the true trade-off instead.
- **LOO does NOT fix the ADR 0012 correlated-onset contamination case.** ADR 0012's ceiling is per-shard
  within-window nonstationarity on REAL telemetry: the drift is idiosyncratic to each shard (not a shared,
  removable factor), so excluding the evaluated shard from its factor changes nothing — the contamination
  is in the evaluated shard's own series, and no cross-sectional reference, LOO or otherwise, can remove
  what its siblings do not share. Correlated onsets across siblings additionally contaminate the LOO
  reference itself (the siblings carry the same onset, so F^{(−i)} absorbs it and the contrast cancels the
  fault — the group-fault absorption already documented in ADR 0017; `leaveOutGroups` and true factor
  knowledge remain the levers there).
- The iterated-annihilation hazard also means two SMALL domains with IDENTICAL membership across two
  partitions would project the same pair twice (partial re-absorption). Unhandled edge; topologies where two
  partitions coincide on a pair should merge those partitions upstream.
