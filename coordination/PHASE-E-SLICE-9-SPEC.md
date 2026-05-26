# Phase E SLICE 9 SPEC — Seasonal Decomposition + AR(1) Residual

_Architect-emit. Date: 2026-05-26. Anchor T0._
_Informed by SLICE 8 empirical finding (AR(p) over-corrects anomaly signal)._

## Why SLICE 9

SLICE 8 demonstrated that aggressive parametric modeling (AR(p) with
AIC-selected p̂) HURTS NAB page-cusum by ~6 points. The mechanism: on
diurnal data, longer-range autocorrelation IS partly the anomaly
signal — a step-shift event ALTERS the autocorrelation structure, so
modeling all autocorrelation explains away the anomaly along with
nuisance periodicity.

SLICE 9's hypothesis: **separate known-nuisance periodicity** (which
CAN be removed without losing anomaly signal) **from anomaly-carrying
residual autocorrelation** (which must NOT be removed). A daily
temperature cycle is nuisance; a sustained shift in the daily mean is
anomaly.

## Architect-pick decomposition: seasonal-naive + AR(1) residual

- Detect dominant period P via ACF peak search (first local maximum at
  lag ≥ 10 where ACF > threshold)
- Compute per-phase seasonal means s[p] = average of values at phase p
- Deseasonalize: deseasoned[t] = values[t] − s[t % P]
- Fit AR(1) on the deseasonalized series
- Dispatch: deseasonalize live observation, then apply AR(1)
  pre-whitening, then pass to detector

This is simpler than STL but principled: phase-mean subtraction is
the canonical seasonal-naive baseline. Anomalies (sustained shifts)
appear in the deseasonalized residual; nuisance daily/weekly cycles
are removed.

## ASKs

### ASK 1 — Period detection criterion

**Architect-pick: ACF first-peak after lag 10 with threshold 0.25.**

Rationale: high-φ AR(1) data has monotonically decreasing ACF (no
peak); periodic data has a clear peak at the period. First-peak
rules out subharmonics. Threshold 0.25 is conservative — only strong
periodicity triggers decomposition.

### ASK 2 — Minimum periods in probationary

**Architect-pick: require ≥ 3 full periods in probationary to enable
decomposition.** Below that, fall back to no decomposition (period=0
provenance, single-lag AR(1) path).

Reason: per-phase mean estimation with < 3 periods has high variance
and overfits.

### ASK 3 — Phase alignment

**Architect-pick: probationary tick 0 = phase 0.** Runtime tick t has
phase `t % P`. Both calibration and runtime data start at the same
file-position-0; alignment is automatic.

### ASK 4 — Backward compatibility

**Architect-pick: opt-in via `useSeasonalDecomposition: boolean`,
default false at SLICE 9 emit.** SLICE 11 may flip the default after
measurement.

## Surface

```typescript
// detectors/seasonal.ts (NEW)

export function detectDominantPeriod(
  values: number[], mean: number,
  options?: { min_period?: number; max_period?: number; min_acf?: number },
): { period: number; acf_at_period: number };

export function seasonalMeans(
  values: number[], period: number, baselineMean: number,
  startPhase?: number,
): number[];

export function deseasonalize(
  values: number[], seasonalMeans: number[], period: number,
  baselineMean: number, startPhase?: number,
): number[];
```

## Acceptance

- ACF-peak detection correctly identifies daily period on synthetic
  cycle + noise data
- Seasonal-mean subtraction recovers anomaly signal on AR(1) +
  periodic-trend + step-shift synthetic
- NAB run with `--seasonal-decomposition` shows measurable change
  (positive or negative) on diurnal datasets; the magnitude informs
  SLICE 11 default-flip

## Anti-scope

- NO LOESS / STL (simpler seasonal-naive is the architect-pick)
- NO Family D modification (spectral consumes raw values; seasonal
  cycles are part of its signal)
- NO default flip
