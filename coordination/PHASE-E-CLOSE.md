# Phase E CLOSE — SLICE 11

_Date: 2026-05-26._
_Closes Phase E (production-AR(1) substrate) per Q70 spec § Q70.3 option (iii)._

## What Phase E delivered

| Slice | Deliverable | Status |
|---|---|---|
| 8 | AR(p) multi-lag Yule-Walker + AIC order selection (opt-in) | ✓ Merged PR #7 |
| 9 | Seasonal-naive decomposition + AR(1) residual fit (opt-in) | ✓ Merged PR #8 |
| 10 | Production-AR substrate file format + fit/load CLI tools | ✓ Merged PR #9 |
| 11 | This document — close memo + default-flip decision | THIS PR |

## NAB empirical results across all slices

| Detector / Slice | 4 (HAC) | 5 (pw+spec+cool) | 6 (smoothing) | 7 (mixture-SM) | 8 (+AR(p)) | 9 (+seasonal) | 9+8 combined |
|---|---|---|---|---|---|---|---|
| family_A_betting | 0.00 | 21.92 | 29.85 | 29.85 | 29.96 | 29.85 | 29.96 |
| family_A_page_cusum | 17.07 | 34.36 | 35.50 | 35.50 | **29.23** | **30.57** | **26.52** |
| family_A_mixture_supermartingale | — | — | — | 23.45 | 23.62 | 23.09 | 23.66 |
| family_D_spectral | 17.14 | 26.55 | 29.79 | 29.79 | 29.79 | 29.79 | 29.79 |

**Best result on the gate-relevant detector remains SLICE 6/7 at 35.50.** Both
SLICE 8 (AR(p)) and SLICE 9 (seasonal decomposition) — the two
canonical "remove nuisance correlation" methods — empirically HURT
NAB page-cusum. Combined effect is additive: -8.98 from the SLICE 7
baseline.

## Architectural conclusion

The Phase E hypothesis was: "more accurate modeling of the nuisance
correlation structure in NAB data will let detectors see anomalies
that single-lag AR(1) pre-whitening was missing."

The empirical conclusion is: **incorrect**. More accurate modeling of
the correlation structure DEGRADES NAB performance because:

1. The seasonal-mean estimate at probationary windows (~25 cycles per
   phase) carries high estimation variance that introduces artifacts.
2. The longer-range autocorrelation captured by AR(p) at higher p̂
   includes the very correlation perturbations that NAB labels as
   anomalies.
3. The remaining genuine-miss bucket (high-φ + sparse-label datasets)
   isn't a calibration-quality problem — it's a fundamental
   incompatibility between Page-CUSUM-style mean-shift detection and
   anomalies that are themselves correlation-structure changes.

This finding has two implications:

### For NAB credential

**The NAB credential cannot be claimed via calibration-layer work.**
Phase E completes the calibration-layer scope per Q70 spec; the
calibration substrate infrastructure ships. But the NAB combined
acceptance gate (Family A ≥ 50 OR Family A ≥ 50 OR Family A ≥ 50;
AND Family D ≥ 40) remains uncrossed. The honest finding from PRs #4
through #9 is that the structural ceiling is detector-class-shaped,
not calibration-shaped.

### For production deployment (the actual Phase E goal)

**The Phase E substrate format is the durable deliverable.** Production
deploysignal consumers (Anvil, future Tessera integrations) now have:

- An offline-fittable calibration substrate format
  (`types/production-ar-substrate.ts`)
- A calibrator CLI (`ds-engine-fit-substrate`) that produces
  substrate JSONs from production CSVs
- A loader API with consumer mappers that translate substrate fields
  into detector-ready config blocks
- Three composable calibration paths: single-lag AR(1) (default),
  multi-lag AR(p), seasonal-naive decomposition — empirical evidence
  on when each applies (next section)

## Cross-detector calibration regime checklist

### When to use which calibration path

| Path | Use when | Avoid when |
|---|---|---|
| Single-lag AR(1) (SLICE 5 default) | iid baseline + ≤moderate (\|φ\| ≤ 0.7) autocorrelation; OR limited probationary window; OR no clear period | Strong long-range structure that AR(1) can't capture |
| Multi-lag AR(p) (SLICE 8 opt-in) | AR(p) processes where the true order > 1 AND anomalies are mean-shifts (not correlation-structure changes); production substrate fit on long-window real data | NAB-style benchmarks where anomalies ARE correlation perturbations; short probationary windows (< 10·p̂_target) |
| Seasonal-naive (SLICE 9 opt-in) | Known periodicity (daily/weekly cycle) with stable per-phase variance; ≥ 30 cycles available in calibration window | Periodicity weaker than ACF=0.25; calibration window < 3 periods; anomalies that ALTER the periodic pattern (anomaly + seasonal-mean estimate co-mingle) |

### How to choose

1. **Default SLICE 5**: when in doubt, single-lag AR(1) is the safest.
   Worked across all NAB datasets; lowest risk of artifact
   introduction.
2. **Opt into SLICE 9 + 5 (no AR(p))**: when you KNOW the data has a
   clear period (e.g., a known daily traffic cycle) and you have many
   periods of calibration data. The deseasonalized residual is what
   detectors see.
3. **Opt into SLICE 8 + 5 (no seasonal)**: when AR(p) order > 1 is
   genuinely required AND anomalies are sustained mean shifts
   (production change-point detection), NOT autocorrelation
   perturbations.
4. **Combine SLICE 8 + 9**: only if SLICE 9 is sufficient and AR(p) is
   then expected to find p̂ ≤ 2 on the residual. Composing both
   aggressively risks over-explanation.

## Default-flip decision

**Architect-pick: defaults UNCHANGED from SLICE 7.** Specifically:

- `usePrewhitening: true` (single-lag AR(1)) — default ON ✓
- `useAnomalyLikelihoodSmoothing: true` — default ON ✓
- `useArPCalibration: false` — default OFF (NAB-degrading per SLICE 8)
- `useSeasonalDecomposition: false` — default OFF (NAB-degrading per SLICE 9)

Rationale: defaults govern what happens when consumers don't opt in;
the safer default is the one that doesn't introduce known artifacts on
real-world data. AR(p) and seasonal-decomp ship as opt-in measurement
infrastructure for consumers who have the context to know when they
apply.

## Documentation outputs

- coordination/PHASE-E-PRD.md (PR #7)
- coordination/PHASE-E-SLICE-8-SPEC.md (PR #7)
- coordination/PHASE-E-SLICE-9-SPEC.md (PR #8)
- coordination/PHASE-E-SLICE-10-SPEC.md (PR #9)
- coordination/PHASE-E-CLOSE.md (this PR)
- README.md: substrate calibrator CLI usage block

## Recommended next direction (NOT Phase F scope — captured for record)

If NAB credential is still desired in the future, the calibration-layer
search is exhausted. Productive paths from here are at the engine
level:

1. **Numenta anomaly-likelihood detector**: track the recent
   distribution of detector scores and fire when current score is in
   the tail. This produces persistent firing during sustained
   anomalies (matches NAB window-alignment by construction). New
   detector class; engine work.

2. **Window-aware dispatch**: instead of per-tick fire decisions, emit
   "anomaly likelihood scores" and let the consumer's downstream
   alerting logic align with their notion of windows. This is the
   pattern most production SRE systems use; it removes the
   "first-detection-time" coupling that NAB-window alignment imposes
   on Page-CUSUM.

3. **Quantile-based conformal novelty (family_E_conformal)**: the
   actual application domain for the §7 EmpiricalProcessLILBound
   primitive shipped in SLICE 2. Quantile-based novelty is more
   robust to correlation-structure changes than mean-shift detection.

All three are engine-level work, not calibration-layer. None are in
Phase E scope. Documented here for the record.

## Phase E STATUS: CLOSED

The four-slice deliverable lands. The structural NAB-credential question
is answered empirically: not via calibration. The substrate format is
production-ready for consumers that need offline-fittable calibration
artifacts.
