# Phase E SLICE 8 SPEC — AR(p) Multi-Lag Yule-Walker Calibration

_Architect-emit. Date: 2026-05-26. Anchor T0._
_Closes PHASE-E-PRD § Open questions 1-4._

## Architect decisions

### ASK 1 — AR order selection criterion

**Architect-pick: Akaike Information Criterion (AIC).**

Derivation: for an AR(p) model fit by Yule-Walker, the AIC is

```
AIC(p) = N · log(σ²_p̂) + 2·p
```

where σ²_p̂ is the innovation variance estimate at order p. The first
term favors fit; the second penalizes complexity. AIC is the standard
choice in time-series ML (vs BIC's `log(N)·p` which is more conservative
and would underfit on probationary-window-sized data).

P3 spot-check: on the SLICE 5 probationary windows (N=600 typical),
AIC's `2p` penalty crosses BIC's `log(600)·p ≈ 6.4·p` decisively only at
p ≈ 20+. For short-lag autocorrelation typical of NAB data, AIC and BIC
agree at p ≤ 5; AIC permits richer models when warranted.

### ASK 2 — Maximum order p_max

**Architect-pick: `p_max = floor(N/10)` clamped to [1, 30].**

Derivation: AR(p) fits are stable when N ≥ 10·p (Box-Jenkins rule of
thumb). For probationary N=600, p_max=30 leaves ≥ 20× safety margin.
The hard cap at 30 prevents pathological order selection on long
probationary windows (e.g., 22695-tick machine_temp probationary
would otherwise yield p_max=339; that's not a useful AR(p) model).

### ASK 3 — File location

**Architect-pick: NEW file `detectors/ar-p.ts`.**

Rationale: AR(p) Yule-Walker is a math primitive that may be consumed
by multiple detectors and tools. Placing it in `detectors/` (sibling
to `family-a-mixture-supermartingale.ts`) makes it directly importable
by future engine-internal consumers (per Phase D close — engine
extension is now permitted at architecturally-anchored extension
points). The file is NOT itself a detector; it's calibration math used
by detectors and calibrators alike.

### ASK 4 — Backward compatibility

**Architect-pick: opt-in via new flag `useArPCalibration?: boolean`
(default false in SLICE 8; flip to true in SLICE 11 docs landing).**

Rationale: SLICE 5-7 default behaviors are pinned by tests. SLICE 8
adds a new code path without disturbing them. Default-off lets us
ship SLICE 8 measurement infrastructure separately from the
default-flip decision (which depends on the SLICE 9 periodic
decomposition outcome).

## Math primitive surface

```typescript
// detectors/ar-p.ts

/** Compute lag-k sample autocovariance γ̂_k = (1/N) Σ (x_t − x̄)(x_{t+k} − x̄). */
export function sampleAutocovariance(x: number[], k: number): number;

/** Solve the Yule-Walker normal equations for AR(p) coefficients via
 *  Levinson-Durbin recursion (O(p²); avoids Toeplitz LU O(p³)). Returns
 *  { phi: phi_1..phi_p, sigma2_innovation } for the fitted AR(p) model. */
export function yuleWalkerLevinson(
  autocovariances: number[],  // [γ̂_0, γ̂_1, ..., γ̂_p]
): { phi: number[]; sigma2_innovation: number };

/** Fit AR(p) for p in [1, p_max]; return the AIC-optimal model. */
export function fitArP(
  values: number[],
  mean: number,
  options?: { p_max?: number; ic?: 'aic' | 'bic' },
): { p: number; phi: number[]; sigma2_innovation: number; aic_trace: number[] };

/** Multi-lag pre-whitening: x_pw_t = (x_t − μ) − Σ_{i=1..p} φ_i · (x_{t−i} − μ).
 *  Returns a re-centered series so downstream detectors mean-center
 *  against the same baseline μ. Returns the input unchanged when p=0 or
 *  phi is empty. */
export function prewhitenAr(
  values: number[],
  mean: number,
  phi: number[],
): number[];
```

## Tests block

```typescript
// test/q70-phase-e-slice8-ar-p.test.ts

// Math correctness:
//   1. sampleAutocovariance on iid Gaussian: γ̂_0 ≈ σ², γ̂_k ≈ 0 for k > 0
//   2. yuleWalkerLevinson on AR(1) data with φ=0.7: recovers phi[0] ≈ 0.7
//   3. yuleWalkerLevinson on AR(2) data: recovers both coefficients
//   4. fitArP order selection: AR(1) data picks p̂=1 (or p̂≤2) with high probability
//   5. fitArP order selection: AR(2) data picks p̂≥2
//   6. prewhitenAr identity check: p=0 or empty phi passes through unchanged
//   7. prewhitenAr removes correlation: AR(1) data pre-whitened with fitted phi
//      has lag-1 ACF near zero

// Integration:
//   8. buildPerDatasetConfig with useArPCalibration:true stamps ar_p_calibration
//      provenance (the fitted phi vector + sigma2_innovation + selected p)
//   9. runDetectorOverDataset with ar_p phi vector applies multi-lag pre-whitening
//      (only when Family A; spectral exempt — SLICE 5 architectural decision)
```

## Implementation surface

- `detectors/ar-p.ts` — new file per ASK 3, ~150 LOC
- `tools/run-nab-validation.ts` — extend `RunDetectorDispatchOpts` with
  `prewhitenPhiArray?: number[]`; if present, use multi-lag pre-whitening
  via `prewhitenAr`; otherwise fall back to single-lag `prewhitenSeries`
  (SLICE 5 path). Family D spectral path unchanged.
- `tools/run-nab-per-dataset.ts` — extend `PerDatasetCalibrationProvenance`
  with optional `ar_p_calibration?: { p, phi, sigma2_innovation, aic_trace, ic }`.
  Extend `buildPerDatasetConfig` options with
  `useArPCalibration?: boolean` (default false). When set, fits AR(p)
  via `fitArP` and stamps provenance + uses AR(p) σ²_innovation as the
  variance stamp.
- `runPerDatasetNABValidation` opts gain `useArPCalibration?: boolean`
  + CLI flag `--ar-p-calibration` (off by default).

## NAB acceptance for SLICE 8

- Multi-lag pre-whitening produces measurably different per-tick
  firings vs SLICE 7 single-lag (per-detector firing-count delta > 0)
- AIC-selected p̂ varies across datasets (low for low-φ noisy data; high
  for high-φ periodic data) — i.e., the calibration adapts
- Genuine-miss bucket drops by ≥ 4 windows at the SLICE 4 ±500 tick
  tolerance level (primary success metric per PRD)

## Anti-scope at SLICE 8

- **NO** seasonal/periodic decomposition (SLICE 9)
- **NO** default flip to AR(p) (SLICE 11)
- **NO** Family D / spectral detector modification
- **NO** engine/detectors/page-cusum.ts or betting-e-process.ts modification

## Open questions deferred to SLICE 9+

- **Q9.1**: For datasets with strong daily periodicity, is AR(p) at
  p̂ < N/10 sufficient, or does SLICE 9 (periodic decomposition + AR(1)
  residual) dominate? Empirical SLICE 8 measurement informs.
- **Q9.2**: Should the substrate file format (SLICE 10) version AR(p)
  parameters separately or carry them inline in CompiledConfig?
