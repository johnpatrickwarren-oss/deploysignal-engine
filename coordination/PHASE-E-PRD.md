# Phase E PRD — Production-AR(1) Substrate

_Owner: Architect (Track 2). Originated: 2026-05-26 from Q70 SLICE 5-7 close._
_Status: OPEN at SLICE 8 spec-emit (T0)._

## Mission

Make the deploysignal-engine detector portfolio robust to the multi-scale
autocorrelation structure observed in real-world production time-series
data — by replacing the SLICE 5-7 single-lag AR(1) calibration with a
production-AR(p) substrate that captures both short-lag autocorrelation
AND longer-period structure where it exists.

## Why now

Q70 SLICE 5-7 closed the iid-vs-AR(1) calibration mismatch at the
calibration-layer. The empirical per-window classification across NAB's
35-dataset suite (PR #4 finding; reconfirmed at PR #5) showed:

| Outcome | Count | % | Cause |
|---|---|---|---|
| Caught inside window (TP) | 20 | 37% | iid+AR(1) calibration sufficient |
| Caught early (≤500 before) | 9 | 17% | NAB-window alignment — detector correct |
| Caught late (≤500 after) | 7 | 13% | NAB-window alignment — detector correct |
| **Genuine miss** | **18** | **33%** | **Detector blind on high-φ + diurnal data** |

The "genuine miss" bucket concentrates on temperature/taxi datasets with
φ ≈ 0.95 AND strong diurnal periodicity. Single-lag AR(1) pre-whitening
shrinks residuals into the noise floor; the anomaly is "explained away"
by the AR(1) model even though it ISN'T part of the AR(1) structure.

Per Q70 spec § Q70.3 option (iii) — "Keep sweep mode for stress-test
purpose + add production-data-AR(1) substrate" was TAGGED FUTURE Phase E.
Phase E now OPENS: the substrate work is the documented architectural
path to address the 33% genuine-miss bucket.

## Scope (additive across SLICE 8-11)

| Slice | Deliverable | Acceptance |
|---|---|---|
| **SLICE 8** | AR(p) multi-lag Yule-Walker calibration with AIC order selection; multi-lag pre-whitening at dispatch | NAB genuine-miss bucket drops measurably on high-φ datasets |
| **SLICE 9** | Periodic / seasonal-trend decomposition before AR fitting (STL-style) | At least one previously-missed window in art_daily_* family becomes detected |
| **SLICE 10** | Production-AR(1) calibration substrate format (file-on-disk, pre-computed AR(p) parameters) — separates calibration concern from runtime detection | New consumers (Anvil chaos-experiment) can adopt the substrate without re-deriving |
| **SLICE 11** | Documentation: when production-AR(p) substrate applies vs sweep modes; cross-detector calibration regime checklist | Per Q70 spec § Q70.3 closing deliverable |

## Anti-scope

- **NO** Hidden Markov Model / state-space anomaly detector. Phase E
  stays within the AR(p) / autocovariance framework — alternative
  detector classes are out of scope.
- **NO** Multivariate substrate. Family A is per-signal; Family C
  (multivariate) has its own calibration track.
- **NO** Engine/detectors/* internal modification beyond what SLICE 7
  established (the mixture-supermartingale detector is the engine-side
  consumer; Phase E delivers calibration-layer enhancements).
- **NO** NAB credential claim. The Phase E acceptance gate is "the
  genuine-miss bucket measurably drops"; passing NAB's combined gate
  (Family A ≥ 50 AND Family D ≥ 40) may still be structurally
  constrained by NAB-window-alignment, which is orthogonal.

## Success metrics

- **Primary** (SLICE 8 gate): NAB genuine-miss count (currently 18/54
  windows at ±500 tick tolerance) drops by ≥ 4 windows
- **Secondary**: NAB family_A_passes (best of three detectors) score
  increases by ≥ 5 points
- **Tertiary**: AR(p) fits are stable (AIC-optimal p̂ varies smoothly
  across similar datasets; no overfitting to probationary noise)

## Dependencies

- ✓ SLICE 5-7 close (PRs #4, #5, #6 merged) — calibration-layer
  infrastructure (pre-whitening, smoothing, mixture-supermartingale
  dispatch) is the foundation Phase E extends
- ✓ confseq library reference available locally — for cross-checking
  any new bound math
- ✓ NAB repo at numenta/NAB SHA ea702d75 — validation substrate

## Open questions for the architect at SLICE 8 spec-emit

1. **AR order selection criterion**: AIC, BIC, or partial-autocorrelation cutoff?
2. **Maximum p_max**: heuristic (N/10) or fixed (e.g., p_max = 60)?
3. **Where AR(p) lives**: new file `detectors/ar-p.ts`, helper in `tools/`,
   or extension of existing `family-a-mixture-supermartingale.ts`?
4. **Compatibility**: should SLICE 8 deprecate the SLICE 5 single-lag
   path or layer on top of it via an opt-in flag?

The SLICE 8 spec (next doc) resolves these.
