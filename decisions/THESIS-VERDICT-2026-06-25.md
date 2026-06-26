# Tessera / deploysignal-engine — thesis verdict synthesis (2026-06-25)

Capstone over the research arc ADR 0009–0015. The driving question: **can the engine identify drift with a
guaranteed bound on false positives (per-alert) and false discoveries (fleet)?** This records the honest
final answer reachable from current evidence, and the single branch still gated on external work.

## The four claims, graded

| Claim | Grade | Basis |
|---|---|---|
| **Detect drift before thresholds; multi-metric surfacing; rank anomalies** | **ALIVE** | UI e-value (ADR 0010) detects; ranking works; nothing here is in doubt. |
| **Per-alert guarantee** ("this alert is not a false positive", `E[e\|H0] ≤ 1` per shard) | **DEAD on real telemetry** | ADR 0012 (real GWDG): within-window nonstationarity is irreducible for *any* fixed-baseline e-process; per-shard, drift IS the nuisance, only the cross-shard contrast separates them. Fundamental, not a tuning gap. |
| **Fleet-FDR** ("≤ q of flagged shards are false discoveries") | **EMPIRICAL, not a theorem** — and now robustified | Holds on quiet fleets (ADR 0012: UI 1.1% vs safe-t 20.8%) via common-mode cancellation + the UI's bounded tail. e-BH's theorem *needs* per-shard validity, which real data breaks. Item 2 (below) makes the cancellation condition self-determined; it does not make it a theorem. |
| **Localization** ("which GPU/rack is faulty") | **ACHIEVABLE in principle; bottlenecked by common-mode estimation** | FAIR test (ADR 0016): with a clean common-mode, per-rack e-BH localizes at **99–100% / 0% FPR** even for small faults. But the engine's current common-mode (ADR 0008 full-loading) **absorbs** single-shard faults → 0%; cal-only loading → ~16–20%. Hierarchical-FDR *guarantee* still broken (ADR 0015). Real-data ceiling set by ADR 0012. |

## The three frontier items — outcomes

- **Item 1 — cross-sectional empirical-null calibration (ADR 0013): DEAD.** Two cold-eyes + self-verification
  (`ebh-verify.mjs`). e-BH is rank/scale-based — `e-BH(e/μ,q) ≡ e-BH(e,q/μ)` — so recalibrating per-shard
  means either runs at a silently-tightened `q/μ̂0` (power collapse) or, with per-group μ̂0, inflates a
  deflated null group to **FDP=1.0**. Deep lesson: e-BH *already* tolerates common bounded inflation (it
  cancels in the ranking — that's *why* fleet-FDR held); recalibration fixes a non-problem and breaks the
  working ranking. **Wrong tool. Closed.**

- **Item 2 — automatic factor-rank selection (ADR 0014): VERIFIED ACHIEVABLE.** v1's parallel-analysis rule
  broke (systematic *under*-selection = FDR-unsafe; two cold-eye rounds, B=80: ~88–96% under-select on
  true-r=2). The **sequential common-deflation-path null** fixes it — empirically verified
  (`rank-fix-test.mjs`): under-selection eliminated, all residual error pushed onto the FDR-safe
  over-selection side (true-r=2 → `{2:12, 3:8}`, never r̂=1). Cost: a power tax from over-selection, heavy
  under near-unit-root idiosyncratic noise → the ambiguity flag is mandatory. **This is the legitimate route
  ADR 0013 failed to find: correct rank → homogeneous residual inflation → cancels in e-BH → protects fleet
  FDR.** Engine *can* deliver this.

- **Item 3 — hierarchical FDR + localization (ADR 0015): ambitious version DEAD, humble salvage pending.**
  Two-level e-BH broken three ways (BB adjustment doesn't transfer to e-BH under arbitrary dependence;
  selection-on-the-mean voids inner validity; `q·S/G` is the wrong factor). Worse, mean-aggregation dilution
  makes the outer gate **exactly as hard as flat** for a single bad GPU (`E ≥ n·G/q = N/q`, confirmed by
  arithmetic) and the valid-e-value combiners can't escape it (E[max of 72]≈4.85). And per-group common-mode
  is **structurally blind** to whole-rack faults (it absorbs them). Survivor: flat e-BH + topology used only
  to define a tighter common-mode contrast + a *separate* rack-vs-fleet group-fault detector — no
  multi-resolution guarantee. **Localization with FDR is not available from the engine.**

## What the engine can honestly ship today

1. **Drift/anomaly detection + ranking** (UI e-value on baselined residuals). Solid.
2. **Fleet-FDR control that holds on coherent fleets**, made robust by item-2 auto-rank (homogeneous
   residuals) + the bounded UI tail. *Empirical, not proven.* Market it as such.
3. **A self-diagnosis flag** (the salvage of item 1 + the item-2 ambiguity flag): the engine *knows when it
   doesn't have validity* — tail-region, not bulk. Diagnostics, not control.
4. **NOT**: a per-alert "guaranteed not a false positive", and **NOT** a localization-with-FDR claim.

## The FAIR test — RUN (ADR 0016), localization branch resolved

The FAIR test was run on the realistic clustersynth substrate (heterogeneous loadings, nonstationary
common-mode, labeled faults at topology locations) through the real engine pipeline. Result, in three parts:

1. **The detection/localization machinery works.** With a clean (oracle) common-mode, per-rack e-BH localizes
   single-GPU faults at **99–100% detection, 0% FPR**, even for small (3°C) faults. Localization is **not
   fundamentally dead** — the prior "weak" probe was adversarial.
2. **The bottleneck is common-mode estimation, and the engine's estimator is wrong for this job.** ADR 0008
   full-loading common-mode **absorbs** the very single-shard fault you're hunting (0% localization, worse for
   bigger faults); cal-only loading preserves it but leakage caps it at ~16–20% with degraded FDP. → **frontier
   item 6: a detection-oriented common-mode** (distinct from the FDP-oriented one). **Item 6 explored (ADR
   0017):** RPCA falsified (collinearity → absorption); the best practical estimator is **topology-structured
   crossed-domain backfitting** — a 4×+ gain over the engine, but a *large gap to the oracle's 99%* remains,
   because estimating crossed/heterogeneous/nonstationary factors from one fleet snapshot is hard. Closing more
   likely needs temporal/stateful per-shard loading models. **End-to-end (`localizeFaults`, measured at 2.9k–5.8k
   GPUs, ~1% sparse faults): recall ~45%, per-shard FPR ~6%, but FDP ~93% — the e-BH selection is mostly false
   positives** (low FPR ≠ low FDP at rare-fault density; the data-dependent residual voids the e-BH theorem). So
   the deliverable is a **RANKING shortlist** (victims enriched ~7× over healthy), NOT an FDR-controlled
   discovery set. Honest localization = "rank suspects for an engineer," not "here are the faulty GPUs."
3. **Two ceilings the FAIR test makes explicit.** (a) clustersynth's nonstationarity is *removable*
   common-mode, so the oracle's 100% is an **upper bound real data won't reach** — ADR 0012's irreducible
   per-shard nonstationarity caps real-telemetry localization, and clustersynth cannot measure that ceiling.
   (b) UI power collapses against high-φ backgrounds regardless of estimation.

So localization is **"achievable in principle, engineering-bound on synthetic, fundamentally capped on real."**
The *provable* guarantee (per-shard or fleet) stays OPEN, needing the one piece no item delivered: **a
per-shard e-value valid under nonstationarity.** Until it exists, the honest product is empirical fleet-FDR +
ranking + (with item 6) topology-localized detection — not a guarantee.

## Bottom line

The engine is a strong **detection and ranking** system with **empirical, robustified fleet-FDR**, honest
self-diagnosis, and — with the new item 6 — a clear path to **topology-localized detection**. The
**provable-guarantee** version of the Tessera thesis is **dead on real telemetry** (fundamental, ADR 0012),
and no shortcut survived (item 1 dead; items 2/3 don't deliver it). The FAIR test (ADR 0016) overturned the
pessimistic pre-test guess: **localization is achievable in principle** (oracle 99–100% / 0% FPR on small
faults) — it was never a detector or FDR problem, it is a **common-mode estimation** problem, and the engine's
current FDP-oriented common-mode is the wrong tool (it *absorbs* single-shard faults → 0%). Hence **item 6: a
detection-oriented common-mode**, the highest-value next step. Two ceilings remain hard: real-telemetry
localization is capped by ADR 0012's irreducible per-shard nonstationarity (clustersynth can't measure it),
and UI power collapses against high-φ backgrounds.

The discipline that produced this verdict: an independent cold-eye on every guarantee-affecting claim killed
three overclaims (items 1, 3, 0014-v1) before any shipped — and a keystone sanity test caught a window-
alignment **bug in the FAIR harness** that had me one step from enshrining a false "localization is dead."
That is why the verdict is trustworthy: it survived its own errors.
