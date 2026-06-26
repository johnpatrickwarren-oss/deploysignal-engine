# ADR 0017 — a detection-oriented common-mode (closing the FAIR localization gap)

- **Date:** 2026-06-25
- **Status:** **IMPLEMENTED (v2).** The v1 recommendation (RPCA) was prototyped and **falsified** on the FAIR
  substrate; a 16-experiment sweep found the best practical estimator is **topology-structured crossed-domain
  backfitting** (0%→40% over the engine, large gap to the oracle's 99% remains; results below). Shipped as
  `fleet/detection-common-mode.ts` (`detectionOrientedResiduals`) + `fleet/localize.ts` (`localizeFaults`, the
  end-to-end path) + tests. Cold-eyed (SOUND-WITH-CAVEATS); two fixes applied — (i) skip <2-member domains
  (single-member self-absorption → false negative), (ii) guard a degenerate reference-window factor (the
  divide-by-~0 λ̂ blow-up that manufactures finite-but-huge false fires). Group-blind-spot note added to the
  header. The shipped `localizeFaults` re-validated on clustersynth: detection ≈ 49%, FPR ≈ 5.1% (72/rack),
  matching the prototype. Suite 200/200. Touches detection/localization, NOT the FDR theorem — a POWER tool
  with no FDR guarantee on its data-dependent residual (see Scope).
- **Builds on:** ADR 0016 (the FAIR finding that motivates it), ADR 0008/0014 (the common-mode it replaces
  for the detection use case), ADR 0010 (the UI e-value it feeds). **Frontier item 6.**

## Problem (from ADR 0016, FAIR test)

Localization is achievable *in principle* — with an oracle common-mode, per-rack e-BH hits 99–100% detection
at 0% FPR on small faults. The bottleneck is common-mode **estimation**, and the engine's estimator is the
wrong tool for detection:

- **ADR 0008 multi-factor (full-series loading)** — `multi-factor-common-mode.ts:112` fits `λ̂_i =
  robustSlope(F, D[i])` over the **full series**. Tukey downweights *point* outliers but a fault is a
  **sustained** test-window step, so it biases λ̂_i: the fault is absorbed into the shard's loading → residual
  ≈ 0 → **0% detection** (worse for larger faults). Built for FDP control; lethal for localization.
- **Cal-only loading** — preserves the fault but estimates λ_i from the cal window, where the nonstationary
  factor is *quiet* (its big excursion is in the test window). So λ_i is poorly identified → leakage
  `(λ_i − λ̂_i)·F_test[t]` (a residual ramp) → only ~16–20% detection at 8% FPR.
- **Oracle** (true λ, F) — 99%.

**The estimation tension:** to *identify* λ_i you need the factor's large test-window excursion, but that is
exactly where the fault lives → using it absorbs the fault; avoiding it (cal-only) leaves λ under-identified.
The FDP-oriented and detection-oriented common-modes are **different objects**; the engine has only the former.

## The central crux (what any solution must resolve)

A heavily-loaded healthy shard (`large λ_i·F`) and a faulty shard (`fault + λ_i·F`) **both** show a large
sustained test-window deviation. Separating "high loading" from "fault" from one shard's data is the
identifiability core. The oracle wins only because it is *given* λ and F separately. An estimator must exploit
the structural asymmetry: **the common-mode is shared (low-rank across many shards); a fault is idiosyncratic
(sparse — few shards, and/or few cells).**

## Candidate constructions

- **(a) Iterative fault-robust loading.** Fit λ on the full series, flag shards/segments with sustained
  residuals, refit λ excluding them, iterate. Gets full-series identification without fault absorption.
  Simple, but the flag *is* the crux (mis-flagging a high-loader as a fault, or vice versa).
- **(b) Regularized / shrunk loading.** Shrink the cal-only λ̂ toward the group-mean loading to cut its
  variance without the full-series bias. Cheap; only partially closes the gap (still cal-identified).
- **(c) Robust PCA — sparse + low-rank decomposition (RECOMMENDED).** Decompose `X = L + S` with `L` low-rank
  (the common-mode `ΣλF`, any rank r, *no stationarity assumption on F*) and `S` sparse (the faults), e.g.
  principal component pursuit (Candès et al. 2011) or, since faults are *sustained per-shard segments*, a
  **column/segment-sparse** variant (outlier pursuit, Xu–Caramanis–Sanghavi 2012). This addresses absorption
  **by construction** — the sparsity penalty keeps a fault in `S`, not `L` — and the recovered `S` **is the
  localized fault** (localization falls out of the decomposition). It directly encodes the structural
  asymmetry the crux demands.
- **(d) Leave-shard-out factor** — estimate F without shard i before regressing i on it; removes self-pull.
  A cheap refinement to stack on (a)/(c), not a standalone fix.

**v1 recommended (c) RPCA. It was prototyped and FAILED (0% detection).** See empirical results.

## Empirical results (FAIR sweep, δ=6°C single-GPU step, aligned windows, per-rack e-BH, 6 seeds)

| common-mode estimator | detection | FPR | resid φ | note |
|---|---|---|---|---|
| mf-full (ADR 0008, engine default) | 0% | 0% | 0.57 | absorbs the fault |
| cal-only loading | 16% | 8% | 0.55 | leakage-limited |
| **single-window RPCA** (v1 rec) | **0%** | 0% | — | **falsified** |
| topology domain-means | 26% | 23% | 0.73 | crossed-domain contamination |
| **crossed-domain backfitting (b/c hybrid)** | **40%** | **4.6%** | **0.22** | **best practical** |
| oracle (true crossed factors) | 99% | 0% | 0.00 | ceiling |

Findings:
- **RPCA fails by collinearity.** A single-shard fault is *collinear* with the nonstationary factor's
  test-window excursion, so the low-rank fit reads it as a *steeper loading*, not an outlier — it is absorbed
  into `L` on iteration 1, the residual goes ~0, the sparse `S` is never recovered, and RPCA collapses to
  mf-full. The crux (high-loader vs fault) is not resolvable from one shard's data; robust point-outlier
  rejection cannot help because the fault is *on* the regression line, not off it.
- **More clean history does not help** (load-180 = 13%): the gap is not loading-window contamination or data
  quantity.
- **The gap is FACTOR ESTIMATION of crossed, heterogeneous, nonstationary factors.** The factors are *crossed*
  (a shard is in one CDU ∧ one feed ∧ one pod ∧ one job — different partitions), so naive per-domain means are
  cross-contaminated (φ=0.73). **Heterogeneous crossed-domain backfitting** (cycle the kinds; per kind,
  estimate each domain factor from the current residual, fit per-shard loadings on the clean window, subtract;
  iterate) disentangles them best — residual φ 0.55→0.22, detection 40% at controlled 4.6% FPR. Still far from
  oracle: the remaining φ=0.22 leakage drowns ~60% of faults.

**Recommendation (v2): topology-structured crossed-domain backfitting** (uses Tessera/clustersynth domain
membership for the factor structure + per-shard heterogeneous loadings fit on a clean window). It is a real
4×+ improvement over the engine's absorbing common-mode, with controlled FPR. **But the oracle gap is large
and the residual is fundamentally limited** by single-snapshot crossed-factor estimation — closing it further
likely needs *temporal* per-shard loading models (estimate each shard's loadings from long healthy history,
then monitor), a materially bigger (stateful) design.

## Validity caveat (this is a POWER fix, not a guarantee)

Item 6 targets **detection/localization power** (the ADR 0016 gap), NOT the provable guarantee. RPCA's
decomposition is **data-dependent**: the residual fed to the UI e-value is chosen using the data (which cells
went to `S`), so the e-value's null is no longer clean — testing on `S` (or `X−L`) is **post-selection
inference**, and e-BH FDR control is *not* automatic on it. So: item 6 improves power toward the oracle; the
*guarantee* on its output is a separate (open) question, and on real telemetry the ADR 0012 wall still caps it
(real per-shard nonstationarity is **not low-rank**, so RPCA's `L` cannot absorb it and the residual stays
contaminated). Ship item 6 as a detection/ranking improvement with an honest "no FDR guarantee on the RPCA
residual" label until post-selection validity is worked out.

## Failure modes (for the cold-eye)

1. **The crux — loading vs fault.** Construct a fleet with a genuinely high-λ healthy shard and a faulty
   shard of similar deviation; does RPCA put the high-loader in `L` and the fault in `S`, or confuse them?
   This is where (a)/(c) most plausibly fail.
2. **Fault density / sparsity breakdown.** RPCA needs faults *sparse*. A group event (whole rack) is NOT
   sparse → it looks low-rank → absorbed into `L` (the ADR 0015 group-blind spot returns). Characterize the
   fault-fraction at which `S` recovery breaks; it must degrade gracefully, not silently.
3. **Rank/penalty selection.** RPCA needs the low-rank `r` (ties to item 2) and the sparsity weight `γ`.
   Mis-set either → over-absorb (fault into `L`) or over-sparsify (common-mode into `S`, false fires).
   Auto-selection, or a validated default, is required — not a hand-tuned knob.
4. **Post-selection validity.** Quantify how badly the data-dependent residual inflates the per-shard e-value
   null / fleet FDP — is the power gain bought at a real FDR cost? (The honest-label position above stands or
   falls on this.)
5. **Cost at scale.** PCP is iterative SVD — O(n·t·min(n,t)) per iter; at 100k shards this is heavy. Needs a
   randomized/sketched or partitioned (per-rack) variant; verify the per-rack decomposition doesn't reintroduce
   small-n instability (item 2).
6. **Real-telemetry ceiling.** On real data the common-mode isn't exactly low-rank and nonstationarity is
   per-shard → confirm RPCA degrades to (not below) the current pipeline, and does not *manufacture* faults
   from un-modeled per-shard structure.

## Validation plan

- **Oracle-gap closure (primary):** on the ADR 0016 clustersynth setup (aligned windows, per-rack e-BH),
  measure RPCA detection vs the established anchors — mf-full 0%, cal-only ~16–20%, **oracle 99%**. Success =
  materially closing 16% → toward 99% at controlled FPR.
- **Crux test:** the high-loader-vs-fault scenario (failure mode 1).
- **Sparsity sweep:** fault fraction 1% → 30%; locate the `S`-recovery breakdown (failure mode 2); confirm
  group faults (non-sparse) are handled by a *separate* detector (ADR 0015 v2), not silently absorbed.
- **Post-selection FDP:** measure healthy-fleet FDP of e-BH on the RPCA residual vs on the clean pipeline
  (failure mode 4) — does the power gain cost FDR control?
- **Real-telemetry floor:** GWDG re-run — confirm graceful degradation, no manufactured faults.

## Scope & sequencing

- **In:** a detection-oriented common-mode (RPCA column/segment-sparse, or fault-robust iterative loading),
  exposed alongside the existing FDP-oriented `multiFactorRobustResiduals` (do not replace it — they serve
  different goals), with auto rank/γ and an honest validity label. Cold-eye before code.
- **Out:** post-selection FDR theory for the RPCA residual (separate, open); the group-fault detector (ADR
  0015 v2); restoring the provable per-shard guarantee (needs the nonstationarity-valid e-value, open).
- **Depends on:** item 2 (rank selection) — RPCA's `r` is the same quantity.

## Target regime + the honest FDP result (scope)

This path is for **large fleets (10k+ GPUs)**, where manual triage is infeasible; small fleets are **out of
scope** (DCGM per-GPU telemetry lets an engineer localise directly).

**`localizeFaults` is a RANKING aid, NOT a discovery set.** Measured at scale (clustersynth, 4–8 pods /
2.9k–5.8k GPUs, ~1% sparse faults, 72/rack, q=0.1, multi-seed):

| metric | value | meaning |
|---|---|---|
| recall (detection) | ~41–49% | a faulty GPU is flagged ~half the time |
| per-shard FPR | ~6% | a healthy GPU is flagged ~6% of the time |
| **FDP** (false / selected) | **~92–94%** | the e-BH SELECTED set is mostly false positives |
| precision | ~6–8% | … so the selection is NOT a clean fault list |

The trap: **low FPR ≠ low FDP when faults are rare.** At ~1% fault density, 6% FPR on the 99% healthy majority
swamps the true positives → FDP ~93%, far above q. The e-BH FDR theorem does **not** hold because the
data-dependent common-mode residual breaks per-shard validity (leakage inflates healthy e-values). So
`selected` is NOT trustworthy as "the faulty GPUs."

What IS real and useful: victims are **enriched ~7× over healthy** (recall ~45% vs FPR ~6%). So the trustworthy
output is the **ranking** (`perShardEValue`) — hand engineers a ranked shortlist of suspects to triage, not an
automated discovery set. (Earlier single-pod runs reported "5.1% FPR" — true, but FPR was the wrong metric;
precision/FDP at sparse density is the operationally meaningful one, and it is poor.)

## Is it the baseline, or scale? — leave-group-out diagnosis

The absorption is the **baseline creation, not scale.** The common-mode is estimated **in-sample** (each
domain factor is the robust center over members *including* the faulty ones), so a coherent fault contaminates
the baseline it is measured against. Decisive test (faulted rack's residual shift preserved, 4-pod clustersynth):

| fault | raw | in-sample baseline | leave-rack-out | oracle |
|---|---|---|---|---|
| delta=8 | 14.4 | **3.5** | 7.8 | 8.0 |
| delta=15 | 21.4 | **7.8** | 14.8 | 15.0 |

In-sample absorbs ~half; leave-rack-out recovers oracle-level preservation. So the diagnosis is confirmed,
and `leaveOutGroups` is implemented (excludes a shard's own group from its factor).

**But leave-group-out is NOT a localisation win** (implemented, OFF by default). End-to-end rack-vs-fleet
*ranking* gets WORSE with it, not better:

| rack delta | leave-out OFF (avg rank /40, top1) | leave-out ON |
|---|---|---|
| 8 | 9.4, 40% | 17.6, 20% |
| 15 | 2.6, 60% | 28.0, 20% |

Why: the diagnostic measured only the *faulted* group's shift, but ranking is *relative*. Estimating a
group's factor from *other* groups, under **heterogeneous loadings**, leaves a per-group `(Δλ)·F` residual;
since F is nonstationary that bias is a **trend** that does not cancel in the cal-vs-test e-value, so it
inflates *every* group's score and defeats the ranking. It is the **same wall** once more: a group's
common-mode can be estimated either *including* it (→ absorption) or *excluding* it (→ heterogeneous-loading
trend bias) — both fail; only true loadings (oracle) are clean. Use `leaveOutGroups` only for
near-homogeneous-loading groups (Δλ≈0).

## Carry-forward

Item 6 confirmed the FAIR diagnosis (localization is a common-mode *estimation* problem) and bounded how far
a practical estimator gets: **topology-structured crossed-domain backfitting reaches ~40% detection at ~5%
FPR — a 4×+ gain over the engine's 0%, but well short of the oracle's 99%.** The single-window crossed-factor
estimation limit (residual φ≈0.22) is the binding constraint; RPCA does not work here (collinearity). The
likely path to close more of the gap is **temporal/stateful per-shard loading estimation** (pin loadings from
long healthy history, then monitor) — a bigger architectural change worth its own ADR if the 40% is
insufficient. Caveats unchanged: this is a **power** improvement, not an FDR guarantee on the (data-dependent)
residual, and it does **not** lift the real-telemetry ceiling (ADR 0012) — both remain open and must not be
claimed.
