# Changelog

## v0.6.2-pre — 2026-07-02

- **⚠️ Validity correction (2026-07-02 math audit — Tessera `research/2026-07-02-math-audit.md`):**
  the nuisance-robust BF (`nuisanceRobustBFEValue`, ADR 0004 PR A) is **not a valid e-value** —
  recentering by the estimated calibration mean breaks the proper-prior property; exact ideal-case
  E[BF|H0] = (1+2x)/√((1+x)(1+3x)) ≈ **1.155** at every calibration length (bounded: FDR ≤ 1.155·q).
  The function is now `@deprecated`, its envelope reads `validUnderEstimatedBaseline: false` (so
  `isValidForFdrPath`/`assertValidForFdrPath` no longer auto-admit it), and all pointers route to
  **safe-t** (`safeTwoSampleTEValue`, ADR 0005) as the theorem-valid substitute. New regression test
  demonstrates E[BF|H0] > 1 in an MC-sampleable regime (x=1 → ≈1.06, matching the exact formula).
  **Behavioral change:** callers that fed the BF to the FDR gate must either switch to safe-t (same
  call signature) or pass an explicit `FdrPathAssertions` regime assertion.
- **UI e-value wording:** the "E[e|H0] ≤ 1 BY CONSTRUCTION for ANY φ" claim is corrected to
  **empirically audited** — the split-LRT independence premise fails for the interleaved cal/test
  pattern at φ ≠ 0 (proof gap; MC shows ~6× margin, no observed violation). Envelope notes + ADR 0010
  updated; a sequential/predictable numerator is the known by-construction fix.
- ADR 0004 + ADR 0010 carry the matching correction notes.

## v0.6.1-pre — 2026-06-29

- **Release hygiene only — no functional change.** Aligns the published tag with
  the `package.json` `version` field. The `v0.6.0-pre` tag was cut without
  bumping the field (it read `0.5.0-pre`), so consumers pinning a tag resolved a
  package whose internal version disagreed. This release is tagged `v0.6.1-pre`
  with the field set to `0.6.1-pre` so tag == version. Content is identical to
  the `v0.6.0-pre` entry below.

## v0.6.0-pre — 2026-06-29

- **L1 ingestion contract** (ADR 0020) + **calibrator port** (ADR 0021) — the
  ingestion-side kit that feeds the baseline compiler.
- **Multivariate per-cell baseline compiler (Family-C)** — completes the L1 kit:
  per-cell mean vectors + robust covariance for the joint-vector detectors.
- **Seasonal clean-null baseline kit + charter** (ADR 0019) and the detector
  bake-off capstone validating the full layered pipeline.
- **Fleet frontier closeout** (ADRs 0013–0018) — detection-oriented common-mode,
  the `localizeFaults` ranking path, `leaveOutGroups`, and the per-shard
  instrumented common-mode loading model.
- The universal-inference e-value and ADR 0009–0012 items below (previously
  staged under "Unreleased") ship in this tag.

- **`detectors/universal-inference-e-value.ts`** (ADR 0010) — a split likelihood-ratio
  (universal-inference) e-value for an AR(1) mean shift. `E[e|H0] ≤ 1` **by construction for any φ**
  including near unit root, and BOUNDED (no `(ν+1)/2`-exponent catastrophe) — resolving the safe-t
  φ-floor that ADR 0009 showed is fundamental for any deflation fix. Independently cold-eye-verified
  (8M+ draws; worst `E[e|H0]` ≈ 0.27, max single e ≈ 800). Caveat: exact validity needs the Gaussian-AR(1)
  model to contain the H0 truth (well-specification) — validate on the real substrate. Additive.
- **ADR 0012** (docs) — real **GWDG GPU** telemetry validation (Zenodo 19052367): per-shard `E[e|H0] ≤ 1`
  is NOT achievable on real GPU telemetry even after baseline-lifecycle + common-mode (within-window
  nonstationarity is irreducible) — refines ADR 0011, matches the project's per-shard finding. But the
  **fleet-FDR** guarantee holds: multi-factor common-mode → UI → e-BH keeps fleet FDP ≤ q (1.1%), and the
  UI's bounded tail is load-bearing (the safe-t's 1e64 tail blows fleet FDP to 21%). Deploy at the
  fleet-FDR layer. Envelope notes corrected.
- **ADR 0011** (docs) — real-telemetry validation of the universal-inference e-value (47 NAB series):
  robust to real heavy tails (excess kurtosis ≤ 1540 → still valid), but the constant-mean assumption is
  load-bearing — raw telemetry violates `E[e|H0] ≤ 1` (16/46 series), baselined residuals do not (0/46).
  ⇒ feed it the common-mode / baseline-lifecycle output, not raw series. Envelope notes strengthened.
- **ADR 0009** (docs) — the φ-adaptive deflation wall (four control mechanisms all fail near unit root;
  corrects ADR 0007's tail-vs-mean conflation) and the #3 robust-e-process reconfirmation (median best;
  MoM/clipping inert).

## v0.5.0-pre — 2026-06-24

**Post-release research arc (ADRs 0005–0008) — read the primary e-betting
literature and closed the gaps with known solutions.** Strictly additive on top
of v0.4.0-pre; the vendored betting/mixture detectors are byte-unchanged. Full
suite 186 pass / 0 fail. Every guarantee-affecting step taken from the primary
theorem (not the survey) and independently cold-eyed.

- **`detectors/safe-t-e-value.ts`** (ADR 0005, #26) — the safe-t
  (right-Haar / GROW) e-value: integrates σ out under the improper `1/σ` prior,
  exactly σ-invariant and GROW-optimal. KEY FINDING: this **reattributes the
  calibration floor** — it is the AR(1) **φ plug-in**, not the variance (oracle
  φ is valid at all `cal`; estimated φ inflates below ~100). `MIN_CALIBRATION`
  retained; integrating φ out becomes the sharpest open item (ADR 0007 #1).
- **`fleet/e-bh-conditional-calibration.ts`** (ADR 0006, #28) — Lee–Ren
  conditional-calibration boosting via a self-contained **closed-form** rule for
  our pivotal null (`FIRE ⟺ thrObs·P(ẽ_j≥e_j) ≤ E[ẽ_j]`): provably valid (subset
  of the exact-φ firing), a deterministic superset, exact (no Monte Carlo, no
  cliff). ~2× power (0.35→0.70) at FDR ≤ q under arbitrary dependence.
  Threshold-sharpening **dropped** — Blier-Wong–Wang Prop 5 shows it gives
  nothing under arbitrary dependence.
- **ADR 0007 (#27, docs)** — open-frontier findings. #1 integrate φ out:
  **validity solved** (HAC effective-d.o.f. gives uniform-over-φ validity incl.
  near-unit-root), power-calibration partly fundamental and **open**. #3 robust
  e-process: median-of-means underperforms the existing center — **no
  construction, open**.
- **`fleet/multi-factor-common-mode.ts`** (ADR 0008, frontier #2, #29) —
  contamination-robust multi-factor common-mode via alternating robust factor
  fit; heterogeneous-fleet FDP **0.62 → 0.007**. Cold-eye corrected 3 overclaims
  (fault-absorption magnitude, step-dependent power, r-conditionality); ships a
  `factorDeflationEnergy` scree to pick the factor count r.

## v0.4.0-pre — 2026-06-24

**ADR 0004 — the nuisance-robust evidence stack** (PRs #21–#25). Promotes the
Tessera-validated statistical primitives into the engine per the
engine/consumer charter. Strictly additive — no changes to existing detector
math; the vendored betting/mixture detectors are byte-unchanged.

- **`detectors/nuisance-robust-bf-e-value.ts`** (PR A) — the missing *valid*
  per-shard e-value: a two-sample Bayes factor on AR(1)-whitened residuals
  (mean integrated out), `E[BF|H0] ≤ 1` by construction. Gated to
  `cal.len ≥ MIN_CALIBRATION_FOR_VALIDITY` (100).
- **`fleet/common-mode.ts`** (PR B) — `robustLocation` (redescending
  Tukey-biweight M-estimator) + `contaminationRobustResiduals`: the
  contamination-robust fleet common-mode. With PR A + e-BH this is the
  FP/FDR-by-construction pipeline.
- **`detectors/distributional-signature.ts`** (PR C) — variance/trend/collapse
  scores (the BF's same-variance complement). The trend statistic runs on
  whitened innovations (the load-bearing valid-null fix).
- **`per-shard/baseline-lifecycle.ts`** (PR D) — the epoch-level drift-trigger
  decision machine (`freshBaselineLifecycle` / `updateBaselineLifecycle`):
  re-record on sustained alarm rate, not per-fire run-length.
- **`detectors/validity-envelope.ts`** + **`fleet/guarantee.ts`** (PR E) — the
  honesty layer: a shared `ValidityEnvelope`, the FDR-path gate
  (`isValidForFdrPath` / `assertValidForFdrPath`) labelling the plug-in
  betting/mixture e-values invalid-under-estimated-baselines, and
  `assembleFleetGuaranteeConditions` surfacing the by-construction conditions.

Each PR independently cold-eyed. Full suite 168 pass / 0 fail.

## v0.3.1-pre — 2026-05-28

**Cluster-topology extension types** (PR #12). Adds optional
`ClusterTopologyKind` + `ClusterEdgeRelationship` at
`types/verdict-extensions/cluster-topology` (subpath import + barrel
re-export) for consumers modeling NVL-class GPU fabrics, scale-out
fabric tiers, and federated multi-cluster campuses.

Strictly additive — no changes to existing `NodeKind`,
`EdgeRelationship`, `TopologyNode`, `TopologyEdge`, or
`TopologySnapshot`. Non-cluster consumers see zero schema-surface
churn. Originally motivated by clustersynth
(github.com/johnpatrickwarren-oss/clustersynth).

## v0.3.0-pre — 2026-05-26

**Headline: Production-AR substrate calibrator + format.** Offline-fittable
calibration substrate decouples calibration from runtime detection;
external consumers (Anvil, Tessera, future deploysignal deployments)
can fit AR(1) / AR(p) / seasonal / spectral parameters once per
calibration cycle against representative production data and the
engine consumes the resulting JSON.

### What's new

- **`tools/fit-production-substrate.ts`** + CLI bin `ds-engine-fit-substrate`:
  reads a CSV of production observations, emits a versioned substrate
  JSON. Opt-in fits for AR(p) Yule-Walker (`--ar-p`), seasonal-naive
  decomposition (`--seasonal`), spectral bootstrap (`--spectral`).
- **`tools/load-production-substrate.ts`**: schema-validating loader
  + three consumer mappers translating substrate fields into detector-
  ready config blocks.
- **`types/production-ar-substrate.ts`**: schema version `phase-e-slice10-v1`
  with literal discriminator (no silent migration). Required: baseline
  + AR(1). Optional: AR(p), seasonal, spectral.

### Q70 calibration-layer infrastructure (SLICE 4 through 7)

- **AR(1) pre-whitening + innovation variance + spectral bootstrap calibration**
  (SLICE 5, PR #4): Yule-Walker single-lag pre-whitening at dispatch;
  per-dataset 99th-percentile spectral bootstrap; 1000-tick post-fire
  cooldown.
- **Anomaly-likelihood smoothing** (SLICE 6, PR #5): Numenta-style
  persistence filter (emit only when ≥ threshold fires in rolling
  window); dedupes spurious single-tick fires.
- **Howard-Ramdas-2021 mixture-supermartingale wired to NAB dispatch**
  (SLICE 7, PR #6): the architecturally correct anytime-valid mean-shift
  detector. Closes the SLICE 1-3 deferred §7 LIL application-formula
  question — the LIL primitive is for empirical-CDF / quantile work
  per the confseq library docstring, NOT mean-shift. The mixture-
  supermartingale was already shipped at Q66; SLICE 7 wires it.

### Phase E calibration-regime expansion (SLICE 8 through 11)

- **AR(p) multi-lag Yule-Walker + AIC order selection** (SLICE 8, PR #7,
  opt-in via `useArPCalibration`): Levinson-Durbin recursion; AIC
  picks `p̂ ∈ [1, min(N/10, 30)]`.
- **Seasonal-naive decomposition + AR(1) residual** (SLICE 9, PR #8,
  opt-in via `useSeasonalDecomposition`): ACF first-peak period
  detection with threshold 0.25; per-phase mean subtraction; AR(1)
  refit on deseasonalized residual.
- **Production-AR substrate file format + CLI tools** (SLICE 10, PR #9).
- **Phase E close memo + cross-detector calibration regime checklist**
  (SLICE 11, PR #10).

### Honest empirical finding (NAB)

| Detector / Slice | 4 | 5 | 6 | 7 | 8 (+AR(p)) | 9 (+seasonal) | 8+9 |
|---|---|---|---|---|---|---|---|
| family_A_betting | 0.00 | 21.92 | 29.85 | 29.85 | 29.96 | 29.85 | 29.96 |
| family_A_page_cusum | 17.07 | 34.36 | **35.50** | 35.50 | 29.23 | 30.57 | 26.52 |
| family_A_mixture_supermartingale | — | — | — | 23.45 | 23.62 | 23.09 | 23.66 |
| family_D_spectral | 17.14 | 26.55 | 29.79 | 29.79 | 29.79 | 29.79 | 29.79 |

The NAB combined acceptance gate (Family A ≥ 50 AND Family D ≥ 40) is
**not crossed in this release**. The work delivered the empirical
proof that the structural ceiling is detector-class-shaped, not
calibration-shaped — aligning with Wu-Keogh 2021's broader critique
of windowed anomaly-detection benchmarks. NAB is not the credential
target for v0.3.

### Defaults (unchanged from v0.2)

| Option | Default | Why |
|---|---|---|
| `usePrewhitening` | true | SLICE 5 single-lag AR(1); validated |
| `useAnomalyLikelihoodSmoothing` | true | SLICE 6; validated |
| `useArPCalibration` | false | SLICE 8 NAB-degrading; opt-in |
| `useSeasonalDecomposition` | false | SLICE 9 NAB-degrading; opt-in |

Default `node dist/tools/run-nab-per-dataset.js` reproduces v0.2.0-pre
SLICE 6 numbers exactly. No consumer-facing regressions.

### What this means for consumers

- **Production deploysignal**: adopt the substrate calibrator;
  precompute substrate JSONs once per calibration cycle from your
  production data; engine consumes them via `loadProductionSubstrate`.
- **Anvil**: pin to v0.3.0-pre when chaos-experiment substrate work
  is ready (consumer-side decision; this release is the green light
  on the engine side).
- **Tessera**: pin bump optional; no breaking changes for existing
  consumers.

### Test count

- v0.2.0-pre baseline: 33 tests
- v0.3.0-pre: **93 tests** (60 new across SLICEs 5-11)

### Anti-scope preserved

- Zero `engine/detectors/*` internal modification in this release.
  All math primitives (mixture-supermartingale, AR(p), seasonal) live
  in new files under `detectors/`; dispatch logic lives in `tools/`.
  Q58 / Q59 / Q60 anti-scope intact.

## v0.2.0-pre — 2026-05-XX

Q70 SLICE 2/3 (PR #3): §7 EmpiricalProcessLILBound math primitive +
library-tight C bisection + calibrator stamping. Per-detector
dispatch wiring deferred pending architect cross-check (closed at
SLICE 7).

## v0.1.0-pre — 2026-04-XX

Initial extraction from DeploySignal main@5a72371; package boundary
+ types-barrel decoupling + verifiable tarball (R90).
