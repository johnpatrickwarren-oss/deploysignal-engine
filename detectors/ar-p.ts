// detectors/ar-p.ts — Phase E SLICE 8 production-AR(p) calibration math.
//
// Per coordination/PHASE-E-SLICE-8-SPEC.md. Extends SLICE 5's single-lag
// Yule-Walker AR(1) to multi-lag AR(p) via Levinson-Durbin recursion +
// AIC order selection. Math primitive — not a detector. Consumed by
// the NAB tool's `buildPerDatasetConfig` (via `useArPCalibration:
// true`) and by future production-AR(1) substrate work (SLICE 10).
//
// Theory:
//   AR(p): x_t = c + Σ_{i=1..p} φ_i · x_{t-i} + ε_t,  ε_t ~ iid (0, σ²)
//   Yule-Walker normal equations: Γ · φ = γ where Γ is the p×p Toeplitz
//   autocovariance matrix and γ = (γ̂_1, ..., γ̂_p). Levinson-Durbin
//   solves this in O(p²) without forming the full matrix.
//   Innovation variance: σ̂²_p = γ̂_0 − Σ φ_i · γ̂_i
//   AIC(p) = N · log(σ̂²_p) + 2p

/** Lag-k sample autocovariance γ̂_k = (1/N) Σ_{t=0..N-k-1} (x_t − μ)(x_{t+k} − μ).
 *  Uses the supplied `mean` (typically the probationary baseline mean)
 *  rather than recomputing from the input — keeps the autocovariance
 *  in the same frame as the detector's mean-centering convention. */
export function sampleAutocovariance(x: number[], mean: number, k: number): number {
  const N = x.length;
  if (k < 0 || k >= N) return 0;
  let s = 0;
  for (let t = 0; t < N - k; t++) {
    s += (x[t] - mean) * (x[t + k] - mean);
  }
  return s / N;
}

/** Compute the autocovariance sequence γ̂_0, γ̂_1, ..., γ̂_p in a single pass. */
export function autocovarianceSequence(x: number[], mean: number, p: number): number[] {
  const out = new Array<number>(p + 1);
  for (let k = 0; k <= p; k++) out[k] = sampleAutocovariance(x, mean, k);
  return out;
}

/** Levinson-Durbin recursion: solve the Yule-Walker normal equations
 *  Γ_p · φ = γ̂_{1..p} for AR(p) coefficients in O(p²).
 *
 *  Returns:
 *    - `phi[i] = φ_{i+1}` (1-indexed math, 0-indexed array)
 *    - `sigma2_innovation = γ̂_0 · ∏(1 − k_j²)` (Burg-style innovation
 *      variance, equivalent to γ̂_0 − Σ φ_i γ̂_i for the fitted AR(p))
 *    - `reflection_coefficients = k_1..k_p` (partial autocorrelations;
 *      |k_j| ≤ 1 for stationary AR(p))
 *
 *  Stability: the recursion guarantees |k_j| ≤ 1 under H₀; if any
 *  |k_j| > 1 the input autocovariance sequence is non-positive-
 *  definite and the AR fit is unstable — caller should fall back to
 *  a lower order. */
export function yuleWalkerLevinson(
  autocovariances: number[],
): { phi: number[]; sigma2_innovation: number; reflection_coefficients: number[] } {
  const p = autocovariances.length - 1;
  if (p < 0) throw new Error('yuleWalkerLevinson: need at least γ̂_0');
  if (p === 0) {
    return { phi: [], sigma2_innovation: Math.max(autocovariances[0], 0), reflection_coefficients: [] };
  }
  const gamma = autocovariances;
  // phi^{(m)}[i] = i-th coefficient of AR(m) model; we maintain only the current m.
  let phi: number[] = new Array<number>(p).fill(0);
  const reflectionCoefficients: number[] = new Array<number>(p).fill(0);
  let sigma2 = gamma[0];
  if (!(sigma2 > 0)) {
    // Degenerate: zero variance. Return all-zero AR coefficients.
    return { phi: new Array<number>(p).fill(0), sigma2_innovation: 0, reflection_coefficients: reflectionCoefficients };
  }
  for (let m = 1; m <= p; m++) {
    // Reflection coefficient k_m
    let num = gamma[m];
    for (let i = 1; i < m; i++) num -= phi[i - 1] * gamma[m - i];
    const k_m = num / sigma2;
    reflectionCoefficients[m - 1] = k_m;
    // Update AR coefficients via the Levinson recursion
    const prev = phi.slice(0, m - 1);
    const updated: number[] = new Array<number>(m).fill(0);
    for (let i = 1; i < m; i++) updated[i - 1] = prev[i - 1] - k_m * prev[m - 1 - i];
    updated[m - 1] = k_m;
    for (let i = 0; i < m; i++) phi[i] = updated[i];
    sigma2 = sigma2 * (1 - k_m * k_m);
    if (sigma2 < 0) sigma2 = 0; // Numerical floor; |k_j| > 1 → non-stationary fit
  }
  return { phi, sigma2_innovation: sigma2, reflection_coefficients: reflectionCoefficients };
}

/** Fit AR(p) for p ∈ [1, p_max] and return the AIC-optimal model.
 *
 *  AIC(p) = N · log(σ̂²_p) + 2p; BIC(p) = N · log(σ̂²_p) + log(N) · p
 *
 *  P3 derivation per spec § ASK 1: AIC matches the standard time-series
 *  ML choice; BIC's `log(N)·p` is more conservative and underfits on
 *  the N≈600 probationary windows typical of NAB calibration.
 *
 *  Returns the AIC-optimal p̂, the fitted φ vector, the innovation
 *  variance σ̂², the full criterion trace for diagnostics, AND the
 *  reflection coefficients of the chosen model (useful for stability
 *  validation in callers). */
export function fitArP(
  values: number[],
  mean: number,
  options?: { p_max?: number; ic?: 'aic' | 'bic' },
): {
  p: number;
  phi: number[];
  sigma2_innovation: number;
  ic_trace: number[];
  ic_kind: 'aic' | 'bic';
  reflection_coefficients: number[];
} {
  const N = values.length;
  if (N < 4) {
    // Too short for a meaningful fit; return AR(0) (no pre-whitening).
    return { p: 0, phi: [], sigma2_innovation: sampleAutocovariance(values, mean, 0), ic_trace: [], ic_kind: options?.ic ?? 'aic', reflection_coefficients: [] };
  }
  const p_max_request = options?.p_max ?? Math.floor(N / 10);
  const p_max = Math.max(1, Math.min(30, p_max_request));
  const ic = options?.ic ?? 'aic';
  const gamma = autocovarianceSequence(values, mean, p_max);
  // Walk Levinson-Durbin once to p_max — we recompute innovation variance
  // and AIC/BIC at each step by re-running yuleWalkerLevinson for each
  // sub-order (small p_max so the cost is fine; the recursion structure
  // allows an O(p²) total but the simpler per-order re-fit reads cleaner
  // and the constants are negligible at p_max=30).
  const icTrace: number[] = [];
  let best = { p: 0, phi: [] as number[], sigma2: gamma[0], icValue: Number.POSITIVE_INFINITY, k: [] as number[] };
  for (let p = 1; p <= p_max; p++) {
    const sub = gamma.slice(0, p + 1);
    const fit = yuleWalkerLevinson(sub);
    const sigma2 = fit.sigma2_innovation;
    if (!(sigma2 > 0)) {
      // Non-positive innovation variance ⇒ fit is degenerate; stop and
      // keep the best-so-far.
      icTrace.push(Number.POSITIVE_INFINITY);
      break;
    }
    const icValue = ic === 'aic'
      ? N * Math.log(sigma2) + 2 * p
      : N * Math.log(sigma2) + Math.log(N) * p;
    icTrace.push(icValue);
    if (icValue < best.icValue) {
      best = { p, phi: fit.phi, sigma2, icValue, k: fit.reflection_coefficients };
    }
  }
  return {
    p: best.p,
    phi: best.phi,
    sigma2_innovation: best.sigma2,
    ic_trace: icTrace,
    ic_kind: ic,
    reflection_coefficients: best.k,
  };
}

/** Apply multi-lag AR(p) pre-whitening to a series.
 *
 *  For each tick t:
 *    residual_t = (x_t − μ) − Σ_{i=1..p} φ_i · (x_{t−i} − μ)
 *
 *  For t < p, the unavailable past observations are treated as 0
 *  (their centered deviation; equivalent to assuming the series began
 *  at its mean). This is the standard finite-sample convention; the
 *  warm-up bias decays after p ticks.
 *
 *  Returns the residuals re-centered by adding μ back, so downstream
 *  detectors (which mean-center against the same baseline) consume
 *  `r_t = (residual_t)` as their effective `(x − μ)`. Identity when
 *  phi is empty.
 *
 *  Matches the SLICE 5 `prewhitenSeries` convention (re-add μ) so this
 *  helper is a drop-in replacement at p=1. */
export function prewhitenAr(values: number[], mean: number, phi: number[]): number[] {
  const p = phi.length;
  if (p === 0) return values.slice();
  const N = values.length;
  const out = new Array<number>(N);
  for (let t = 0; t < N; t++) {
    let residual = values[t] - mean;
    for (let i = 1; i <= p; i++) {
      const past = t - i;
      const pastDeviation = past >= 0 ? (values[past] - mean) : 0;
      residual -= phi[i - 1] * pastDeviation;
    }
    out[t] = mean + residual;
  }
  return out;
}
