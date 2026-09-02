# Changelog

## v0.6.8-pre — 2026-09-02

The log-domain evidence surface and the live validity instruments, from the operator's
2026-09-01 question on using testing-by-betting for metrics insight
(`knowledge/stats/pages/e-betting-metrics-2026-09-02.md` carries the literature check).
Additive only: no verdict, statistic, threshold, fire tick, α accounting or wealth book moves.

- **`DetectorVerdict.evidence?` (ADR 0027, `types/verdict-extensions/evidence-surface.ts`).**
  The five per-tick wealth detectors (Family A betting and mixture, safe-Hotelling, the spectral
  e-detector, the Family C betting e-process) emit log-wealth, the realized log-increment, the
  bet, `nats_to_threshold` with `threshold_kind ∈ {ville, bootstrap, priced}`, the realized
  growth rate, and `anytime_p = 1/max wealth`. States gain an optional running-max field; the
  mixture records its uncapped log (`log_M_t`) so the evidence survives the 120-nat cap of the
  linear view. Validity boundary stated on the type: on an estimated-baseline path these are
  bookkeeping, not evidence.
- **e-BH `log_threshold_e` and `log_margin` (`fleet/e-bh.ts`).** The realized selection
  threshold `log(N/(q·max(K,1)))` and each input's log-margin to it; margin ≥ 0 iff selected,
  checked on 200 random snapshots. Zero e-values floor at `−LOG_MAX_WEALTH`.
- **`fleet/calibration-monitor.ts`.** Tessera's runtime calibration monitor ported
  (bounded/gaussian increments, per-λ capital average, sticky revocation at `1/α_cal`) with its
  tests, contract-agnostic; plus the increment estimator `E[exp(Δ log M)]` as a REPORTED
  instrument (`refutedAboveOne` is its only claim).
- **`detectors/mixture-confidence-sequence.ts` and `validation/mixture-cs/`.** The closed-form
  inversion of the Howard normal mixture the Family A detector already computes, under a
  pre-registered study; not wired into any verdict.

- **`guaranteeManifest()` includes the `core.ts` heuristic layer (`fa7573b`).** The
  `HEURISTIC_CORE_GUARANTEE` row introduced at v0.6.7-pre is now part of the manifest a consumer
  reads, not only an export.
- **CI: the release-push tag race on the staleness job documented (`75eb6df`).**

⚠️ **Interface notes:** every field is optional or new. DeploySignal reads `evidence` into
`evidence_outlook` and `DetectorTripV2` as of its PR #82 (keys omitted when absent);
`tessera-rng`'s `buildSurface` ignores the new e-BH fields until it reads them. Certification
cards for the five touched detectors were re-frozen in a dedicated commit (`fc84e2e`) with
`cert:verdict` byte-identical. Merged as PR #73 (`97406e2`).

## v0.6.7-pre — 2026-08-22

Cut after an external review (2026-08-21) found the release discipline lapsed: `v0.6.6-pre`
(`8b611aa`, 2026-07-31) sat 303 commits and 3 weeks behind main while README's pin advice
still pointed consumers at it. A consumer at that pin has **no `guarantees.ts`, no
`fleet/e-bh-guarded.ts`, and the Family D rolling-window runtime that WORKLIST C53 records
as refuted** — re-pin deliberately. Entry reconstructed from `git log 8b611aa..e824257`
(the `v0.6.6-pre` entry is the precedent). CI now carries a tag-staleness tripwire that
fails a push to main when the latest tag falls >21 days or >20 detector-semantics commits
behind, so this lapse cannot recur silently.

- **The engine's own guarantee table (`guarantees.ts`, WORKLIST C4, PR #43).** Every
  registry detector id resolves to exactly one row (totality enforced by
  `test/guarantees.test.ts`); axis 1 is the validity class, axis 2 the estimated-baseline
  regime, with `'unrecorded'` as the honest blank. Family D inflation measurements state K
  beside T (C54, `87d0d90`). 2026-08-22: the `core.ts` heuristic layer (TrendBuffer,
  `trendStrength`, `effectiveThreshold`, `computeVerdict`, `WARMUP_CONFIG`) is covered by a
  parallel `HEURISTIC_CORE_GUARANTEE` export — heuristic, spends no α, hand-tuned constants
  with no derivation trace, sole production caller the Family B rules — and the Family B row
  names it.
- **Guarded e-BH entry point (`fleet/e-bh-guarded.ts`).** `assertValidForFdrPath` had zero
  production callers across six repos until 2026-08-02; the guarded entry calls it on every
  input (`fleet/e-bh-guarded.ts:82`), `fleet/localize` is migrated to it (`8a5764b`), and
  the FDR path gates on the AR(1) coefficient (#50). Envelope type fix: the union members
  added 2026-08-02 make previously-unpassable envelopes compile (`validity-envelope.ts`).
- **Family D repaired and priced.** The e-detector evaluates once per disjoint window, not
  once per tick (`d3d6d06`): FAR 0.0005 against the rolling variant's 0.576 at oracle
  parameters. Measured NOT an e-process under finite-K calibration — E[M_T|H0] = 1.0636
  (T=300) / 1.1076 (T=900) at K=400 (family-d-emean run-20260818T222835Z) — and priced by an
  optional c-bound (`bb56070`): firing at c/α restores FDR ≤ α; `e_value_inflation_bound`
  absent means unpriced inflation. `SpectralInflationBound` carries K beside T
  (`types/families/d.ts`, C54).
- **Classical Page-CUSUM fully retired (Q69.D / C8, `0f7b197`).**
  `detectors/_page-cusum-classical.ts` deleted (`evaluateFamilyAShadow`, `evaluateCUSUM`,
  `lookupCellParams`); `FamilyAShadowCtx` relocated to `_page-cusum-core.ts`; the
  `family_A_page_cusum` NAB arm removed — best-of-A is now over the two Ville A-detectors.
- **New candidate detector modules, all UNWIRED** (registered but not routed to production):
  group-average e-value (K2), conformal point-tail bet (K4), periodogram betting e-process
  (K3), block-conformal shape bet (K6), shape-ECDF accumulator (K6-slow), and the shape-
  kurtosis e-value (built, battery-run, **refuted** — kept with its study record, #49).
- Studies and certification landed alongside: family-d-emean (Amendment A1 + corrections),
  family-c witness-centering (E1 refuted as derived), grapa-stability, φ-regime (C43),
  strided-A (C50), across-draw (C51), K5/K6 grids, certification census 2434→2442.

⚠️ **Interface notes:** (1) the classical Page-CUSUM API is gone — consumers importing
`_page-cusum-classical` must move to the mixture path; (2) the Family D e-detector fires on
disjoint window boundaries, not per tick — fire timing differs from `v0.6.6-pre`; (3) e-BH
consumers should enter through `fleet/e-bh-guarded.ts`, which refuses out-of-envelope
e-values that `fleet/e-bh.ts` accepted silently.

## v0.6.6-pre — 2026-07-31

Released without an entry at the time (`8b611aa`); reconstructed from
`git log 0374677..8b611aa` on 2026-07-31. **No detector under Families A, C or D changed.**

- **Family C registry gap closed (`2a36ff2`).** `sequential_mmd_betting_e_process` is now a
  registered `DETECTOR_REGISTRY.C` id. Before this, the Q67 v2 canonical evaluator emitted that
  signal name while no such id existed, so `_audit-families.ts`'s unrecognized-signal fallthrough
  attributed those fires to the legacy `sequential_mmd` id instead of the evaluator that produced
  them. Audit records now attribute canonical-evaluator fires correctly; `sequential_mmd` remains
  registered as the fallback target.
- **Conformal singular branches tagged (`01b1aae`)**, alongside a de-branding scrub.
  `detectors/conformal.ts` is the only detector file touched in this release, and the change is
  annotation rather than arithmetic.
- **AR(1) short-baseline guard coverage (`0f0baee`)** — tests for `computePerSignalAr1Phi` on
  short baselines. No production-path change.
- Docs: point at the knowledge wiki as the single entry point (`2becdb6`).

⚠️ **Interface note:** `2a36ff2` changes which id a Family C MMD fire is *attributed to* in audit
records. Consumers that group or count by `sequential_mmd` will see those fires move to
`sequential_mmd_betting_e_process`. Verdicts and α accounting are unaffected.

## v0.6.5-pre — 2026-07-29

- **Log-domain wealth (ADR 0026):** the three multiplicative e-process detectors
  (safe-Hotelling, betting, spectral e-detector) now keep exact log-wealth (`log_M`) as the
  single source of truth; the linear `M` is a `Number.MAX_VALUE`-saturating view — per-leaf
  e-values can no longer overflow to `Infinity` → JSON `null` inside a claimed shift band
  (the Tessera-RNG ADR-0063 measured defect at δ=32), and overflow is no longer absorbing.
  NaN observations hold wealth instead of poisoning it; JSON-null `log_M` heals instead of
  silently resetting. `eBenjaminiHochbergLog` added for log-domain e-BH consumers.
  ⚠️ In-range `M` may differ from v0.6.4-pre in final ulps (`exp(Σz)` vs `Π exp(z)`) —
  decision semantics preserved up to ulp-boundary knife-edges; re-pin deliberately.
- **Sequential (predictable-plug-in) UI e-process (ADR 0025):** `E_t` = predictable-numerator
  conditional likelihood over the profiled composite null {Gaussian AR(1), any φ, any σ²} —
  `E[E_τ] ≤ 1` at every stopping time including near-unit-root φ, no empirical crutch; audit
  F6 closed by construction. Honest power recorded: parity with fixed-split UI at 2.5σ; the
  free-φ composite null absorbs small steps.

## v0.6.4-pre — 2026-07-28

- **Covariate-augmented statistical residualizer (ADR 0023):** `fitCovariateResidualizer` /
  `oneStepResiduals` — baseline-window fit, frozen weights, one-step-ahead innovations only,
  strict-exogeneity lint. Tessera ADR 0024 G2's cheap arm.

## v0.6.3-pre — 2026-07-02

- **Calibrated group attribution (ADR 0022):** `attributeCommonMode` gains opt-in `per_shard_e_values`
  / `fleet_fire_rate` / `coincidence_window_s`; candidates are annotated with `group_e_value`
  (arithmetic mean over ALL group members — validity inherited from the inputs), `binom_tail`
  (size-calibrated Binomial(g, α̂) co-firing tail — the raw ≥2-count rule false-candidates
  quadratically in group size), and `group_size`; a temporal coincidence window replaces the
  fires-days-apart clustering. Legacy calls byte-identical.
- **Leave-one-out factors for small domains (ADR 0022):** domains with 2–5 members are deflated once,
  post-sweeps, against per-member leave-one-out factors — no self-absorption (2-member faulty residual
  carries ~7.9/8 of the step vs ~4.0/8 before); the ≤3-member sibling mirror is intrinsic and
  documented (localize at pair granularity or route to a Mode-B contrast). Larger domains bit-for-bit
  unchanged. 11 new tests; 237/237.

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
