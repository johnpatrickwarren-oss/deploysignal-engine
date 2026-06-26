# ADR 0018 — the per-shard loading model: instrumented common-mode (validated core)

- **Date:** 2026-06-25
- **Status:** **Proposed — validated core.** The construction's central claim is empirically validated on the
  clustersynth crossed substrate (instrumented factors → rack localisation ≈ oracle at ≤10% measurement
  noise; results below). Not yet implemented in the engine. Needs a cold-eye + the instrumented-telemetry
  ingestion before production.
- **Builds on / resolves:** ADR 0017 (localisation is a common-mode *estimation* problem; the wall is the
  in-sample baseline) and the per-shard layer (`per-shard/warm-start.ts` already keeps per-shard state over
  time, but only the *level/baseline*, never the *loadings*). This ADR adds the missing piece — per-shard
  loadings — and shows they must be fit on **known (instrumented) factors**, not estimated ones.
- **Frontier item 7.**

## The question this answers

"The design is per-shard — isn't there a per-shard *loading* model?" No: the pipeline keeps a per-shard
*baseline* (warm-start, over time) and emits per-shard e-values, but the **loadings on the common-mode
factors are re-estimated in-sample every window** at the fleet layer. ADR 0017 traced the localisation wall to
exactly that in-sample estimation. This ADR completes the per-shard design with a real loading model — and
pins down the one thing that makes it work.

## What was ruled out (estimation), and what works (instrumentation)

Rack-level fault, clustersynth 4-pod crossed substrate, faulted-rack rank out of 40 (top-1 %):

| common-mode | rank | top-1 | verdict |
|---|---|---|---|
| in-sample backfit (current) | 19.2 | 20% | absorbs the fault |
| leave-group-out (ADR 0017) | ~28 | 20% | (Δλ)·F bias — worse |
| **learned-λ from healthy data + estimated F** | 30.6 | 0% | **estimating the factors fails** |
| **instrumented factors + per-shard regression** | **5.8–1.0** | **80–100%** | **≈ oracle (≤10% noise)** |
| oracle (true λ, true F) | 1.0 | 100% | ceiling |

The decisive finding: **the factors must be KNOWN, not estimated.** Estimating the crossed factor
decomposition from the GPU signals alone — in-sample, leave-out, or learned-from-healthy-history — all fail,
because the crossed/heterogeneous/nonstationary factors are not identifiable from the GPU mixture with enough
per-loading precision, and the residual leakage `(λ_error)·F` scales with the *large* factor excursions and
swamps the fault. But when the factors are **measured** (instrumented) and each shard is regressed on them, the
per-shard loadings are well-conditioned and localisation matches the oracle.

Noise sensitivity (measurement noise on the instrumented factors): 0% → top-1 80%, 10% → 100%, 30% → 20%. So
the instrumented signals must be reasonably clean (≲10–15% noise).

(Honesty: getting here took several prototype-bug corrections — a UI window-misalignment and a factor-
centering bug each produced false negatives. The validated numbers above use aligned windows + centered
factors. The instrumented factors must be CENTERED on the reference window, as the oracle is.)

## Construction

1. **Ingest instrumented factor signals** (the load-bearing input the engine does not yet take): the real
   infrastructure telemetry that IS the common-mode — per-CDU cooling/inlet temp, per-PDU power draw,
   per-pod/rail network/switch counters, per-job scheduler allocation — as time series aligned to the window.
2. **Factor↔shard mapping from the topology** (which shard loads which CDU/PDU/pod/job — the clustersynth
   membership / Tessera topology).
3. **Per-shard loading regression:** for each shard, regress its level-removed series on its domain's
   *centered* instrumented factors over the healthy reference window → per-shard loadings `λ_i,k`. Subtract
   `Σ_k λ_i,k · (centered factor_k)` over all ticks → residual.
4. **Persist the loadings** (the warm-start extension): accumulate `λ_i,k` over healthy windows with
   confidence tiers (reusing the `per-shard/warm-start.ts` machinery, which already does this for the level),
   so loadings are stable and a new window's fault never re-fits them. Reset on topology change.
5. **Detect + localise** on the clean residual: per-shard UI e-value → topology-partitioned e-BH / ranking
   (ADR 0017 `localizeFaults`), now operating on near-oracle residuals.

## Failure modes / open questions (for the cold-eye)

1. **Instrumentation completeness.** Unmeasured factors leave residual common-mode → leakage. Partial
   instrumentation (instrument cooling+power, estimate the rest) is a hybrid whose value must be measured — it
   may inherit the estimation wall for the un-instrumented part.
2. **Factor measurement noise** (validated to degrade at ~30%) and **factor collinearity** over the window →
   ill-conditioned per-shard regression → ridge/regularise; quantify the conditioning.
3. **Factor↔shard mapping accuracy** — a wrong CDU/PDU/job assignment mis-attributes the factor; how sensitive?
4. **The ADR 0012 ceiling still stands.** This removes COMMON-MODE accurately; it does NOT remove a shard's
   OWN within-window idiosyncratic nonstationarity (not captured by any shared factor). So it makes
   *localisation* work but does NOT restore a *per-shard FDR guarantee* on real telemetry — that residual is
   irreducible. Localisation here is RANKING/attribution, still not a certified discovery set (ADR 0017).
5. **Loading drift vs masking** — slow λ updates adapt to hardware aging but can mask slow faults (the
   baseline-lifecycle tradeoff).

## Validation plan

- **Real instrumented telemetry** (not synthetic): the clustersynth result uses its factor sidecar as the
  "instrumented" signal. The real test is on a dataset with *actual* facility/PDU/scheduler/network telemetry
  alongside GPU counters — confirm per-shard regression on real infra signals localises, and measure the real
  factor measurement-noise level (is it ≲10%?).
- **Completeness sweep:** localisation vs fraction of factors instrumented (full → none); locate the point
  where it beats estimation.
- **Conditioning:** regularisation vs factor collinearity; mapping-error sensitivity.
- **Single-GPU vs group faults; FDP** (expect ranking, not controlled FDP — ADR 0017).

## Decision & scope

The per-shard loading model is viable **iff the common-mode factors are instrumented**. Scope of the first
implementation: an engine function `instrumentedCommonModeResiduals(X, calLen, factorSignals, membership)` —
per-shard centered regression on exogenous factor signals → residuals — which is testable NOW with
clustersynth's factor sidecar as the instrumented input (and validates against the oracle). The bigger lift is
the **data-plumbing**: ingesting real facility/PDU/scheduler/network telemetry, aligned and mapped to shards.

## Carry-forward

The localisation arc resolves to a clear, honest statement: **localisation works when you measure the
common-mode (instrument it) and regress each shard on it; it does not work when you try to estimate the
common-mode from the GPU signals alone.** The per-shard *loading* model — fit on *known* factors, persisted
like the per-shard *level* already is — is the construction. It delivers ranking/attribution at near-oracle
quality with clean instrumented signals; it does not restore the per-shard FDR guarantee (ADR 0012 ceiling).
