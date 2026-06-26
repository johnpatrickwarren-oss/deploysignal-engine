# ADR 0015 — hierarchical FDR over the topology, and the localization question

- **Date:** 2026-06-25
- **Status:** **Proposed — v2 (two-level construction REJECTED; topology-for-contrast salvage retained).**
  v1 proposed two-level hierarchical e-BH (group e-value = mean of members; outer selects groups, inner
  localizes) for a multi-resolution FDR guarantee + localization. A cold-eye **broke it** (validity AND
  purpose; details below, dilution confirmed by hand-arithmetic). v2 keeps only the part with a real
  guarantee: **flat e-BH on shards, with the topology used solely to define a tighter common-mode contrast**,
  plus a **separate** group-fault detector. No multi-resolution FDR claim. No engine code yet; the group-fault
  detector wants its own cold-eye before implementation.
- **Builds on:** ADR 0008 + ADR 0014 (per-group common-mode + auto-rank), ADR 0010 (bounded UI e-value),
  ADR 0012 (the per-shard wall), `fleet/e-bh.ts` (the flat operator — which v2 keeps unchanged).
- **Frontier item:** engine work item 3 — and it decides the *localization* branch of the Tessera verdict.

## Problem (unchanged from v1)

The engine fleet layer is flat: `eBenjaminiHochberg` returns "K shards flagged" with no structure, and the
2026-06-25 probe localized weakly (faulty GPU rank-1 only 17–39%, in-fleet precision 40–93% false) because a
faulty GPU is contrasted against 10⁵ *dissimilar* shards instead of the shards sharing its common-mode. The
clustersynth topology (rack→pod→cluster→campus) is available and ignored by the engine.

## v1 (REJECTED) — two-level hierarchical e-BH, and exactly why it fails

The plan: group e-value `Ē_g = mean_{i∈g} e_i` (valid marginally since mean-of-e-values is a valid e-value),
outer e-BH selects faulty groups, inner e-BH localizes, with overall FDR via a Benjamini–Bogomolov factor
`q_inner = q·(S/G)`. Three independent breaks:

1. **The multi-resolution FDR guarantee does not hold.** (a) The BB adjustment is a *p-value/PRDS* result;
   it is asserted, not derived, to transfer to e-BH **under arbitrary dependence** — the very regime e-BH
   exists to serve (`fleet/e-bh.ts:22-28`). You cannot borrow BB's factor and keep e-BH's no-dependence-
   assumption selling point. (b) **Selection-on-the-mean voids inner validity:** a group is selected because
   `Ē_g` (the average of its members) is large, which shifts the *conditional* law of the member e_i upward,
   so `E[e_i | i null, group selected] > 1` — violating the inner e-BH input contract (`fleet/e-bh.ts:80-86`).
   Marginal `E[Ē_g|H0]≤1` says nothing post-selection. (c) `q_inner = q·(S/G)` is not the correct e-value
   form (the valid e-hierarchical constructions split the e-budget multiplicatively or flatten to a single
   weighted e-BH; none reduce to this). **Verdict: ship no compound/cross-level FDR statement.**

2. **Mean-aggregation dilution defeats localization for the single-bad-GPU case — arithmetic, confirmed by
   hand.** One faulty member (e-value `E`) among `n−1` nulls (≈1): `Ē_g ≈ E/n`. The outer gate to select that
   lone group among `G` needs `Ē_g ≥ G/q`, i.e. **`E ≥ n·G/q = N/q`** — *identical to flat e-BH's threshold*
   `N/q` (cold-eye sim ratio 0.999–1.000). The n× dilution exactly cancels the n× group-count reduction, so
   the hierarchy buys **zero** outer-gate sensitivity, then adds a *second* multiple-testing toll inside →
   **≤ flat, usually worse**. The dodge (top-k / max / data-dependent-weight e-merge) is **not a valid
   e-value** — E[max of 72 mean-1 e-values] ≈ 4.85, E[weight∝e mean] ≈ 1.97 ≫ 1 — so it breaks the outer
   contract. There is no valid combiner that escapes dilution.

3. **Per-group common-mode is structurally blind to group faults.** A rack-cooling event moves all 72 GPUs
   together → it *is* a common-mode factor → the ADR 0008 fit **absorbs it** → no shard deviates from its rack
   → zero shard faults, and `Ē_g ≈ 1` so the outer gate is silent too. The most operationally severe incident
   (whole-rack power/cooling) is **invisible at both levels** — where a flat rack-vs-fleet contrast catches it.

Also: per-group contrast **relocates** the ADR 0012 invalid-null problem to small n (8 vs 10⁵), *removing the
large-N averaging that made flat's empirical FDP hold* → noisier, not cleaner. And small real node-fleets
(4–8 GPUs) starve the ADR 0014 fit, so the finest (most useful) level is unusable, and coarsening to fix that
re-introduces breaks 2 and 3. **Net: v1 is worse than flat in two namable regimes (group faults; single-shard
faults at scale), not merely "unprovable."**

## v2 — what actually survives

1. **Keep flat e-BH on shards unchanged** (`fleet/e-bh.ts`) — the one real guarantee (FDR ≤ q under arbitrary
   dependence, *conditional on the per-shard inputs being valid*, which on real telemetry is empirical — ADR
   0012).
2. **Use the topology only to define the common-mode grouping.** Fit per-group (rack-level) common-mode +
   auto-rank (ADR 0008/0014) so each shard's e-value is the contrast against shards that *actually* share its
   cooling/power/workload. The genuine, defensible benefit is **better common-mode removal → a cleaner, larger
   faulty-shard e-value** feeding the same flat e-BH — *not* a hierarchical FDR statement. This is bounded by
   small-n instability and must back off to a coarser grouping (or fleet-wide) when a group is too small for a
   stable fit; the back-off rule needs a concrete minimum-n criterion (open).
3. **Add a SEPARATE group-fault detector** that contrasts each group's *aggregate* against *other groups*
   (rack-vs-fleet) to cover the break-3 blind spot the within-group common-mode eats. Different statistic, not
   a level of the same hierarchy; its own validity envelope and cold-eye.
4. **Multi-resolution verdict = separate e-BH runs reported per level with NO compound guarantee.** Honest
   surfacing, not a theorem.

## The honest ceiling on localization (lowered from v1)

ADR 0012's per-shard wall already bounds localization to "sharpen, not prove." The cold-eye lowers it further:
hierarchy is **not uniformly sharper** — it is *worse* than flat for group faults and for single-shard faults
at scale. The only regime where topology-for-contrast plausibly helps is **a small number of co-located
faulty shards in a large homogeneous group**, where the within-group contrast genuinely tightens the e-value
AND the group is big enough for a stable fit. That intersection is narrow and **undemonstrated** — it is
exactly what the FAIR test must measure.

## Validation plan

- **Topology-for-contrast vs flat (v2):** does per-group common-mode produce *larger* faulty-shard e-values /
  better single-shard localization than fleet-wide common-mode, across group sizes n = 4…72? Find the minimum
  n where it helps rather than hurts (the back-off threshold).
- **Group-fault detector:** rack-vs-fleet detection of whole-rack cooling/power events (the break-3 blind
  spot); confirm flat-within-group misses them and the separate detector catches them.
- **Re-run the localization probe** under FAIR conditions (real regime-aware baseline + right-detector-per-
  fault + large coherent fleet + topology-for-contrast). This is the experiment that decides the localization
  branch.
- **FAIR-scale dependency:** realistic clustersynth (real hierarchy + heterogeneous common-mode + faults at
  known topology locations), built separately.

## Carry-forward — the thesis-decisive item, decided pessimistically on the ambitious version

After items 1 (dead) and 2 (verified), this was the last engine lever. Outcome:
- **Hierarchical multi-resolution FDR: DEAD** (validity broken three ways; dilution defeats its purpose).
- **Topology-for-contrast (v2): plausible but undemonstrated** — narrow regime, gated on the FAIR test.
- **Localization with an FDR guarantee: not available** from the engine; the deliverable at best is
  *topology-improved ranking* with no compound guarantee, and only if the FAIR test shows the contrast helps.
- **Group-level incidents need a separate detector** — they are a blind spot of the contrast approach, not a
  level of it.

So the localization branch of the Tessera thesis does **not** get rescued by a clever FDR construction. It now
rests entirely on the empirical question "does topology-informed per-group common-mode make flat-e-BH ranking
materially better under real conditions?" — the FAIR test. The *provable* guarantee (per-shard or fleet)
remains OPEN regardless, needing the per-shard e-value valid under nonstationarity that no item delivers.
