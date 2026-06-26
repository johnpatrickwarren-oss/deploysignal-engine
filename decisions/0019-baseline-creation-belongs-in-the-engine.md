# ADR 0019 — baseline-creation belongs in the engine (parameterized L1 kit)

- **Date:** 2026-06-25
- **Status:** **Accepted (charter).** Re-draws the engine/consumer boundary for baseline creation. Motivated by
  the finding that the weeks-of-data baseline compiler — load-bearing for the e-values to mean anything — is in
  the original DeploySignal (`tools/calibrate`) but was NOT vendored into the engine, and is being
  re-implemented as half-finished prototypes per consumer (Tessera `tools/curate-baseline-*`, SLICE 1 of 3).
- **Builds on:** the ADR 0012/0017/0018 arc (e-values are worthless without a valid baseline) and the engine's
  existing charter split (`per-shard/baseline-lifecycle.ts`: "engine = WHEN, consumer = WHAT/HOW").

## The problem with the current boundary

The vendored engine took the **detectors** + the per-shard **state machine** (`warm-start`) + the **re-record
trigger** (`baseline-lifecycle`) — but left the baseline **compiler** to the consumer. That ships the half
that is useless without the other half: an e-betting engine whose anytime/FDR guarantees are vacuous unless
fed a valid baseline (this whole session demonstrated it — bad baseline ⇒ E[e|H0]≫1 ⇒ Ville/e-BH bind
nothing). So every consumer must re-derive the hardest, most error-prone statistics (robust covariance,
shrinkage, contamination screening, cell-pooling, seasonal decomposition) — and gets them subtly wrong
(centering / window-alignment / SLICE-incomplete bugs observed first-hand). The engine is vended to several
products; this duplication multiplies.

## Decision — three layers, split on data-agnostic algorithm vs product data/semantics

- **L0 — engine core (always vended): the statistics.** Robust estimators (MCD/MRCD, Ledoit-Wolf), AR(1)/φ,
  mean/variance with floors, the e-values/e-processes, Ville-combination, e-BH, seasonal-decomposition math,
  hierarchical pooling, confidence-tiering, drift/staleness tests, the per-shard loading regression. Pure
  parameterized functions; no I/O, no domain knowledge.
- **L1 — engine baseline kit (vended, optional, replaceable): the compiler.** Wires L0 into a baseline from
  `(values, context-labels, config)` — generic cell-binning over ARBITRARY context axes, robust per-cell
  clean-null (drop anomalies), pooling for sparse cells, and a residualiser. This is DeploySignal's
  `tools/calibrate` with the domain specifics lifted out into config. Products may use it or compose their own
  from L0.
- **L2 — product: the data and its meaning.** Telemetry ingestion, signal/tick semantics, the seasonality AXES
  (hour×day for GPUs; something else elsewhere), history length, thresholds/warmup, topology↔factor mapping,
  instrumentation. Per product.

**Rule: mechanism + schema in the engine; data, semantics, and policy in the product.** "Different data per
product" is handled by PARAMETERISATION (context axes, history, transforms, thresholds are config/inputs), NOT
by relocating the algorithms to products.

## Why central

1. Hardest/most error-prone code, written + tested + cold-eyed ONCE (vs divergent per-product bugs).
2. E-values are worthless without a valid baseline — they are a coupled unit; shipping the e-engine without
   the baseline kit is a footgun for every consumer.
3. A shared improvement (better estimator, tighter pooling) propagates to all products.
4. Consumers stay thin: supply data shape + config, get a valid baseline + detection.

## Boundary discipline (keep it vendable)

The L1 kit takes matrices + integer context-label arrays + config and returns a baseline; it never ingests raw
telemetry or knows product semantics (same contract as `instrumentedCommonModeResiduals`: the product supplies
factor signals + membership, the engine does the math). L0 stays exposed so a product can build a bespoke
baseline; L1 is the default for the common case.

## Migration

1. Add the engine L1 kit (`baseline/…`): cell-binning + robust per-cell clean-null + pooling + residualiser,
   parameterised (this ADR's implementation step).
2. Port DeploySignal `tools/calibrate` guts (Family-A μ/σ², MCD/MRCD/Ledoit-Wolf, hierarchical pooling) up into
   L0/L1 over subsequent PRs; collapse Tessera's `tools/curate-baseline-*` prototypes onto the engine kit.
3. Products keep only ingestion + config + topology.

## Retest finding (honest — the mechanism was NOT what we expected)

The charter (baseline-creation belongs in the engine) stands. But the empirical retest of *why* — "seasonality
breaks the e-values' per-shard validity, and the baseline restores it" — was **not confirmed for the UI
e-value**. On 6 weeks of clustersynth-based hourly data with diurnal / sharp business-hours / large
(40–60×noise) seasonal structure, per-shard `E[e|H0]` stayed ≤ 1 (mean ≈ 0.1, frac>1 ≈ 2–3%) **with and
without** the seasonal baseline. Reason: the UI e-value (ADR 0010, valid for any φ) only flags shifts aligned
to the cal/test boundary; seasonal structure at arbitrary phases reads as autocorrelation and does not inflate
`E[e|H0]`. So the seasonal baseline does **not** restore a validity that was lost — the UI never lost it on
seasonality. A power retest (fault on top of large seasonality) showed 0% detection for *both* raw and
seasonal-baseline — because what masks the per-shard fault is the **cross-shard common-mode** (the cool
factor), which the seasonal baseline does not remove; that is the ADR 0017/0018 layer, not this one.

**So the baseline's value is real but lives elsewhere than UI-validity:** (1) **less-robust detectors** — the
original DeploySignal uses Page-CUSUM and Hotelling-T² against per-cell baselines, which *do* need the seasonal
clean-null (CUSUM accumulates any drift; Hotelling compares to a fixed cell mean); the UI's any-φ robustness is
partly *why* it was built. (2) The per-cell **normal reference** for absolute-deviation detection and the
**clean-null** for anomaly screening. (3) Products whose seasonality genuinely breaks their detector or dwarfs
their faults. (4) It does NOT substitute for common-mode removal, and it does NOT lift the ADR 0012 wall (the
irreducible part is non-seasonal, non-AR(1) structure the UI also can't model).

This corrects the earlier framing: the localisation failures were a **common-mode** problem (ADR 0017/0018),
not a missing-seasonal-baseline problem. The baseline still belongs in the engine (consumers need it for the
reasons above), but it is not the lever that fixes per-shard detection with the UI.

## Scope note

This is the charter + the first kit (per-cell Family-A-style seasonal clean-null). The full Family A/C/D/E
calibrator port (incl. the MCD/MRCD/Ledoit-Wolf multivariate path and adjacency-aware pooling) is incremental
per the migration plan.
