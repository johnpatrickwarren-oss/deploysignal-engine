import type { SelfNormalizedEProcessFallback } from '../self-normalized-fallback';
/** Per-signal Family D spectral params. Bootstrap null quantile gives the
 *  threshold for ACF peak height; lag bounds constrain the peak search to
 *  oscillation periods ~3–10 ticks. */
export interface FamilyDPerSignal {
    /** Measured `E[M_T|H0] ≤ c` for the e-detector variant; raises the firing threshold to `c/α`,
     *  recovering `FDR ≤ α` from `FDR ≤ c·α`. See {@link SpectralInflationBound} for the measurement,
     *  the horizon-dependence, and why absence is not the same as `c = 1`. */
    e_value_inflation_bound?: SpectralInflationBound;
    bootstrap_null_quantile: number;
    min_peak_lag: number;
    max_peak_lag: number;
    /** Addition #21 (ARCHITECT-REPLY-45 D2) — spectral detector variant
     *  discriminator. `'bootstrap_null'` is the legacy per-tick quantile
     *  test; `'e_detector'` is the mixture-prior betting e-process on
     *  peak|ACF| (Shin-Ramdas-Rinaldo 2022, scalar-mixture form per D3).
     *  Optional for backward-compat with pre-#21 configs; absence treated
     *  as `'bootstrap_null'` by the dispatcher. Post-#21 compiler emits
     *  `'e_detector'` on new configs. */
    spectral_variant?: 'bootstrap_null' | 'e_detector';
    /** Addition #21 — null-distribution mean `μ₀` of peak|ACF| under H₀.
     *  Populated by the compiler as `mean(bootstrap_peaks_array)` at the
     *  same time `bootstrap_null_quantile` is computed. Required when
     *  `spectral_variant === 'e_detector'`; coherence guard per D6. */
    null_mean?: number;
    /** Addition #21 — null-distribution std `σ₀` of peak|ACF| under H₀.
     *  Populated as `std(bootstrap_peaks_array)`. Required when
     *  `spectral_variant === 'e_detector'`. */
    null_std?: number;
    /** Addition #21 (D4) — shift-prior magnitude `δ_D = 0.3·σ₀` for the
     *  mixture-prior e-value. `0.3·σ₀` is architect-derived from
     *  sufficiency-gate fire-horizon targets (≤25 ticks on 2σ₀ oscillation)
     *  + healthy sub-martingale drift (≈0.956×/tick). Stored per-signal so
     *  replay consumers reproduce fire timings across recompiles. */
    betting_delta?: number;
    /** Q2.B.7 (Q2-B-7-ACF-AWARE-PARAMETRIC-SPEC.md) — Per-signal AR(1)
     *  lag-1 autocorrelation coefficient fitted at compile time via
     *  Yule-Walker on per-cell baseline samples. Range typically
     *  [-0.5, +0.7] depending on signal class; clipped to [-0.95, +0.95]
     *  for stationarity. Drives both:
     *    (a) Family D bootstrap threshold re-calibration under AR(1) H₀
     *        (replaces iid bootstrap; closes the autocorrelation-structure
     *        mismatch flagged at REPLY-52gi as Phase-2 commitment).
     *    (b) Validation parametric_ar1 resampler in
     *        tools/build-report-card.js: each tick evolves
     *        x_t = μ + diag(ρ)·(x_{t-1} − μ) + ε_t under stationary Σ_x.
     *  Pre-Q2.B.7 configs lack this field; runtime falls back to ρ=0
     *  (iid behaviour) per backward-compat shim. */
    ar1_phi?: number;
    /** Q2.B.7 — Per-signal AR(1) white-noise standard deviation:
     *  σ_eps = σ_baseline · sqrt(1 − ρ²). Used by the AR(1) bootstrap
     *  loop in Family D threshold calibration for univariate-AR
     *  generation. Joint resampler instead consumes
     *  FamilyCPerCell.cholesky_L_eps for the multivariate Σ_eps path. */
    ar1_sigma_eps?: number;
    /** Q70 Phase-3.d.E — self-normalized e-process variant fallback for the
     *  family_D_kv_cache detector (per-signal). Activates when conditional
     *  exemption (Q70.1) is too restrictive for the (substrate × sweep_mode)
     *  triple. §7 EmpiricalProcessLILBound primary. ADDITIVE optional
     *  (sub-rule 2 MERGE); pre-Q70 configs lack this field; runtime detector
     *  dispatch falls through to standard bootstrap-null quantile threshold
     *  when absent. SLICE 1: schema only; calibrator stamping + detector
     *  consumption deferred to SLICE 2. */
    self_normalized_fallback?: SelfNormalizedEProcessFallback;
}
/** Addition #21 (ARCHITECT-REPLY-45 D3) — per-(deploy, signal) spectral
 *  e-detector state. The wealth martingale `M` evolves per-tick via
 *  `M_t = M_{t-1} · exp(z_t)` where z_t is the Gaussian-mean-shift
 *  log-likelihood ratio on peak|ACF|. Fire at `M ≥ 1/α_D = 10000`.
 *  Simpler than `EMmdState` — no betting running moments because the
 *  statistic is standardized against compile-time null moments (μ₀, σ₀)
 *  rather than runtime-adaptive ones. */
/** Measured null-mean inflation `c` for the spectral e-detector, `E[M_T|H0] ≤ c`.
 *
 *  `peak|ACF|` is bounded in [0,1] and right-skewed where the increment `z_t = r·u − ½r²` is exact
 *  only for `u ~ N(0,1)`. Measured 2026-08-03 under disjoint evaluation on iid Gaussian H0 with
 *  `(μ̂₀, σ̂₀)` estimated from `K = 400` windows:
 *
 *    E[M_300] = 1.0636 (95% lower 1.0257, 9 wealth updates)
 *    E[M_900] = 1.1076 (95% lower 1.0244, 29 updates)
 *
 *  That measurement's harness was never committed; the first committed execution is
 *  `validation/family-d-emean` `run-20260818T220621Z` (2026-08-18), which reads, at EXACT null
 *  moments (`K = 66,666` shared, residual `n²r²/2K ≈ 5.7e-4` in log c):
 *
 *    E[M_300] = 1.0229 (95% lower 0.9877)   E[M_900] = 1.0336 (95% lower 0.9502)
 *
 *  and, per-trajectory: `E[M_900]` = 1.9738 at `K = 100`, 1.3695 at `K = 400`. The committed
 *  2026-08-03 values are statistically CONSISTENT with the exact-moment cells (two-sided 95%) and
 *  sit on the conservative side of their point estimates, so pricing with them stays valid.
 *
 *  C54 (2026-08-18): `c` is NOT WELL-FORMED without the calibration-window count `K` beside the
 *  horizon `T` — `c(T, K) ≈ exp(skew·n + n²r²/2K)` (batch-C review), quadratic in the update count
 *  and inverse in `K`, confirmed by the run above. A bare number is therefore under-specified;
 *  prefer {@link SpectralInflationBoundMeasurement}, which states both. Bare numbers stay legal so
 *  pre-C54 configs replay.
 *
 *  Supplying this bound raises the firing threshold to `c/α`, which is identical to running the
 *  procedure at α on `M/c`. Since `E[M/c] ≤ 1`, that recovers exact control: `FDR ≤ α` rather than
 *  `FDR ≤ c·α`. See knowledge/stats/e-value-validity-methods-ledger.
 *
 *  ABSENT means no deflation, which is the pre-2026-08-03 behaviour and leaves the inflation
 *  unpriced. `c` GROWS with horizon, so a value supplied here must be measured for the longest
 *  horizon the detector runs over, not a typical one — and at the `K` the deployed calibration
 *  actually has, not a larger one. */
export type SpectralInflationBound = number | SpectralInflationBoundMeasurement;
/** The well-formed inflation bound: the price `c` with the two axes it is measured on. */
export interface SpectralInflationBoundMeasurement {
    /** The measured bound: `E[M_T|H0] ≤ c` at the stated `(T, K)`. */
    c: number;
    /** Horizon (ticks) the bound is measured for — the longest the detector runs over. */
    measured_at_ticks: number;
    /** Wealth updates at that horizon under the measuring cadence (disjoint: `⌊T/W⌋ − 1`). */
    wealth_updates?: number;
    /** Calibration-window count `K` behind `(μ̂₀, σ̂₀)`; `'exact'` for oracle / large-sample
     *  moments. The same detector at the same `T` prices differently at a different `K`. */
    calibration_window_count: number | 'exact';
    /** Producing artifact, e.g. `family-d-emean/run-20260818T220621Z`. */
    run?: string;
}
export interface SpectralEDetectorState {
    M: number;
    n: number;
    alphaConsumed: number;
    /** ADR 0026 — exact log-wealth; `M` is its Number.MAX_VALUE-saturating
     *  view (detectors/_wealth.ts). Optional (additive); absence is healed on
     *  the next update. */
    log_M?: number;
    /** 2026-08-03 — ticks observed since the last wealth update.
     *
     *  The e-detector consumes `peak|ACF|` over a rolling window, so evaluating it every tick makes
     *  successive increments share all but one sample: `u_t` is nearly `F_{t-1}`-measurable and the
     *  martingale-difference condition fails. Measured false-alarm rate 0.576 against a nominal 0.05
     *  with ORACLE parameters on iid Gaussian data; the same detector on DISJOINT windows measures
     *  0.0005. Advancing the wealth once per window length restores it. Optional (additive); absence
     *  is treated as 0. See knowledge/stats/h0-battery-2026-08-01. */
    ticksSinceEval?: number;
}
/** Per-signal Family D ACF peak-detection state. Bootstrap null is built
 *  on baseline cells at compile time; the detector reads `window_length`
 *  and `bootstrap_null_quantile` at call time. Peak-lag range bounds the
 *  frequencies Family D targets (oscillation periods ≈ 3–10 ticks). */
export interface SpectralParams {
    window_length: number;
    bootstrap_null_quantile: number;
    min_peak_lag: number;
    max_peak_lag: number;
}
//# sourceMappingURL=d.d.ts.map