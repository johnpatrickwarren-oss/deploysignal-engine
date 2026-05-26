# Phase E SLICE 10 SPEC — Production-AR Substrate File Format

_Architect-emit. Date: 2026-05-26. Anchor T0._
_Closes Phase E architectural infrastructure; SLICE 11 closes Phase E proper._

## Why SLICE 10

SLICE 8 + 9 produced a NAB empirical finding: calibration-layer
interventions can't pass NAB. But the calibration MATH itself
(Yule-Walker AR(p), seasonal-naive decomposition) is valuable for OTHER
consumers — production deploysignal deployments where calibration
happens offline once per week against a representative production
window. SLICE 10 ships the **substrate file format** that decouples
the calibration concern from the runtime detection concern:

```
[offline]                            [online]
  production CSV                       deployed engine
     ↓ fit                                ↑ load
  substrate.json  →  artifact storage  →  substrate.json
                                          ↓ stamp config
                                          detector runtime
```

External consumers (Anvil chaos-experiment scoring; future Tessera
consumers) can adopt the substrate without re-running fits. The
substrate is the durable artifact; the engine and the NAB tool both
consume it via a shared loader.

## ASKs

### ASK 1 — Schema version policy

**Architect-pick: explicit `version: 'phase-e-slice10-v1'` literal
discriminator.** Future schema evolutions add new version literals;
loaders may accept multiple versions but never silently migrate. This
preserves provenance integrity across consumer-fleet upgrades.

### ASK 2 — Required vs optional fields

**Architect-pick: minimal required substrate carries baseline + AR(1).
Multi-lag AR(p), seasonal decomposition, and spectral bootstrap are
all OPTIONAL.**

Rationale: AR(1) is the only universally-applicable construct. Other
fits may be inappropriate for specific signal classes; consumers
should not be forced to compute them. Detectors that need a specific
fit and don't find it in the substrate fall through to their default
behavior (single-lag AR(1) path matches SLICE 5).

### ASK 3 — File location + integration

**Architect-pick: schema in `types/production-ar-substrate.ts`;
calibrator in `tools/fit-production-substrate.ts`; loader in
`tools/load-production-substrate.ts`. NAB tool gains
`--substrate-file <path>` option that loads instead of fitting
inline.**

## Schema

```typescript
// types/production-ar-substrate.ts
export interface ProductionArSubstrate {
  version: 'phase-e-slice10-v1';
  source: {
    signal_name: string;
    description?: string;
    n_observations: number;
    calibration_start?: string;
    calibration_end?: string;
  };
  baseline: {
    mean: number;
    sigma_squared_marginal: number;
  };
  ar1: {
    phi: number;
    sigma_squared_innovation: number;
  };
  ar_p?: {  // SLICE 8 fit
    p: number;
    phi: number[];
    sigma_squared_innovation: number;
    ic_kind: 'aic' | 'bic';
    reflection_coefficients: number[];
  };
  seasonal?: {  // SLICE 9 fit
    period: number;
    seasonal_means: number[];
    acf_at_period: number;
    ar1_phi_deseasoned: number;
    sigma_squared_innovation_deseasoned: number;
  };
  spectral?: {  // SLICE 5 fit
    bootstrap_null_quantile: number;
    min_peak_lag: number;
    max_peak_lag: number;
    empirically_calibrated: boolean;
  };
  generated_at: string;
}
```

## Acceptance

- Round-trip: `fit → write JSON → load → consume` produces identical
  per-tick detector firings vs inline calibration
- Schema validation: bad version literal rejected at load
- NAB tool `--substrate-file` produces same scores as inline default
  (regression check)

## Anti-scope

- NO substrate versioning beyond v1 (future slices handle migration)
- NO substrate fitting from non-CSV sources (the fitting tool consumes
  the same CSV format the NAB validation already uses)
- NO Anvil / Tessera integration in this SLICE (the format exists; the
  integration is consumer-side work)
