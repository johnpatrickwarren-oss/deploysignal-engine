"use strict";
// detectors/seasonal.ts — Phase E SLICE 9 periodic / seasonal-trend
// decomposition math. Companion to detectors/ar-p.ts (SLICE 8 math
// primitive); used together as: (a) seasonal decomposition removes
// known-nuisance periodicity, (b) AR(1) residual fit captures
// short-range nuisance correlation, (c) detector consumes the doubly-
// pre-whitened series.
//
// Per coordination/PHASE-E-SLICE-9-SPEC.md. Architect-pick decomposition
// is seasonal-naive (per-phase mean subtraction) — simpler than STL,
// canonical for the use case, and preserves the anomaly-bearing residual
// structure that SLICE 8's AR(p) was over-correcting.
//
// Theory:
//   For a series with period P:
//     x_t = μ + s[t mod P] + r_t
//   where s[·] is the seasonal component (Σ s = 0 by mean-centering),
//   r_t is the residual carrying any anomaly signal + short-range
//   autocorrelation. Subtracting the seasonal-mean estimate ŝ from each
//   observation yields the deseasonalized series — anomalies in the
//   running mean of r_t are preserved; the nuisance daily/weekly cycle
//   is removed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDominantPeriod = detectDominantPeriod;
exports.seasonalMeans = seasonalMeans;
exports.deseasonalize = deseasonalize;
exports.decomposeSeasonal = decomposeSeasonal;
const ar_p_1 = require("./ar-p");
/** Detect the dominant period in a series via ACF peak search.
 *
 *  Algorithm:
 *    1. Compute ACF(k) for k ∈ [min_period, max_period]
 *    2. Find the first local maximum: k* where ACF(k*) > ACF(k*-1)
 *       AND ACF(k*) > ACF(k*+1)
 *    3. If ACF(k*) ≥ min_acf, return k* (the dominant period)
 *    4. Else return 0 (no strong periodic structure detected)
 *
 *  Defaults:
 *    - min_period = 10 (shorter lags are autocorrelation, not periodicity)
 *    - max_period = floor(N/3) (need ≥ 3 periods to estimate seasonal
 *      means reliably; per SLICE 9 spec § ASK 2)
 *    - min_acf = 0.25 (conservative; only strong periodicity triggers
 *      decomposition; per spec § ASK 1) */
function detectDominantPeriod(values, mean, options) {
    const N = values.length;
    const minPeriod = Math.max(2, options?.min_period ?? 10);
    const maxPeriod = Math.max(minPeriod + 1, Math.min(options?.max_period ?? Math.floor(N / 3), N - 2));
    const minAcf = options?.min_acf ?? 0.25;
    if (N < 3 * minPeriod)
        return { period: 0, acf_at_period: 0 };
    // γ̂_0 normalizes ACF.
    const gamma0 = (0, ar_p_1.sampleAutocovariance)(values, mean, 0);
    if (!(gamma0 > 0))
        return { period: 0, acf_at_period: 0 };
    // Compute ACF over [minPeriod - 1, maxPeriod + 1] so we can check the
    // local-max condition at each candidate.
    const acfStart = Math.max(1, minPeriod - 1);
    const acfEnd = Math.min(maxPeriod + 1, N - 1);
    const acf = [];
    for (let k = acfStart; k <= acfEnd; k++) {
        acf.push((0, ar_p_1.sampleAutocovariance)(values, mean, k) / gamma0);
    }
    // Scan for first local maximum in [minPeriod, maxPeriod].
    for (let k = minPeriod; k <= maxPeriod; k++) {
        const idx = k - acfStart;
        if (idx <= 0 || idx >= acf.length - 1)
            continue;
        const a = acf[idx];
        const aPrev = acf[idx - 1];
        const aNext = acf[idx + 1];
        if (a > aPrev && a > aNext && a >= minAcf) {
            return { period: k, acf_at_period: a };
        }
    }
    return { period: 0, acf_at_period: 0 };
}
/** Compute per-phase seasonal means for a series of given period.
 *
 *  s[p] = (1/n_p) · Σ_{t : t mod P = p} (values[t] − baselineMean)
 *
 *  Returns the array of seasonal residuals s[0], s[1], ..., s[P-1].
 *  Sum of s ≈ 0 by construction (since baselineMean cancels). When a
 *  phase has zero observations in the input (shouldn't happen for the
 *  probationary use case but defensive), its s is 0.
 *
 *  `startPhase` (default 0) lets callers anchor phase 0 to a non-zero
 *  tick position — used when the calibration window's first tick is
 *  not the canonical phase-0 (per spec § ASK 3 the runtime default is
 *  tick 0 = phase 0, but the helper is parameterized for flexibility). */
function seasonalMeans(values, period, baselineMean, startPhase = 0) {
    if (period < 2)
        throw new Error(`seasonalMeans: period must be ≥ 2; got ${period}`);
    const s = new Array(period).fill(0);
    const counts = new Array(period).fill(0);
    for (let t = 0; t < values.length; t++) {
        const phase = ((t + startPhase) % period + period) % period;
        s[phase] += values[t] - baselineMean;
        counts[phase] += 1;
    }
    for (let p = 0; p < period; p++) {
        if (counts[p] > 0)
            s[p] /= counts[p];
    }
    return s;
}
/** Deseasonalize a series by subtracting the per-phase mean.
 *
 *  deseasoned[t] = values[t] − s[(t + startPhase) mod P]
 *
 *  The returned series has the same baseline mean as the input by
 *  construction (since Σ s ≈ 0 from `seasonalMeans`). Downstream
 *  detectors mean-center against the same `baselineMean`; the residual
 *  structure (short-range autocorrelation + anomaly signal) is what
 *  reaches the detector. */
function deseasonalize(values, seasonal, period, startPhase = 0) {
    if (period < 2)
        throw new Error(`deseasonalize: period must be ≥ 2; got ${period}`);
    if (seasonal.length !== period) {
        throw new Error(`deseasonalize: seasonal length ${seasonal.length} must equal period ${period}`);
    }
    const out = new Array(values.length);
    for (let t = 0; t < values.length; t++) {
        const phase = ((t + startPhase) % period + period) % period;
        out[t] = values[t] - seasonal[phase];
    }
    return out;
}
/** Convenience: detect period, compute seasonal means, and return both
 *  the decomposition trail and the deseasonalized series. Returns
 *  period=0 + identity deseasonalized when no strong period is
 *  detected (per ASK 1 + ASK 2 — fall through to single-lag AR(1)
 *  path in the caller). */
function decomposeSeasonal(values, baselineMean, options) {
    const detected = detectDominantPeriod(values, baselineMean, options);
    if (detected.period === 0) {
        return {
            period: 0,
            acf_at_period: detected.acf_at_period,
            seasonal_means: [],
            deseasonalized: values.slice(),
        };
    }
    const s = seasonalMeans(values, detected.period, baselineMean, 0);
    const des = deseasonalize(values, s, detected.period, 0);
    return {
        period: detected.period,
        acf_at_period: detected.acf_at_period,
        seasonal_means: s,
        deseasonalized: des,
    };
}
//# sourceMappingURL=seasonal.js.map