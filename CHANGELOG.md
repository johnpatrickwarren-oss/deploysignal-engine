# Changelog

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

### Architecture coordination docs

- `coordination/PHASE-E-PRD.md`
- `coordination/PHASE-E-SLICE-8-SPEC.md`
- `coordination/PHASE-E-SLICE-9-SPEC.md`
- `coordination/PHASE-E-SLICE-10-SPEC.md`
- `coordination/PHASE-E-CLOSE.md` (cross-detector calibration regime
  checklist; default-flip decision; recommended next direction)

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
