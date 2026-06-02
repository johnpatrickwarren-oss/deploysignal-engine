// tools/_nab-validation-transforms.ts — Q64/Q70 NAB dispatch-layer firing-
// trace transforms (pre-whitening + cooldown + anomaly-likelihood
// smoothing). Extracted verbatim from tools/run-nab-validation.ts; all
// names re-exported from run-nab-validation.ts so imports stay stable.
//
// ── Q70 SLICE 5 — dispatcher-layer calibration interventions ──────────
//
// SLICE 4 left page-cusum at 17.07, betting at 0, spectral at 17.14 — well
// short of the (≥50, ≥40) NAB gate. SLICE 5 lands three layered fixes at
// the dispatch wrapper (preserves engine/detectors/* anti-scope from
// Q58/Q59/Q60):
//
//   1. AR(1) pre-whitening of detector input. NAB datasets exhibit
//      φ̂ ≈ 0.95 on temperature/sensor signals; the probationary-window
//      σ² estimates the AR(1) MARGINAL variance, but page-CUSUM and
//      betting standardize against assuming iid Gaussian. SLICE 4's HAC
//      inflation (1+φ)/(1−φ) bandaged this for page-CUSUM by widening σ
//      but silently disabled fire (S_n stayed at 0); same intervention
//      did nothing for betting (which fires on bias accumulation in the
//      GRAPA running-mean). Pre-whitening + innovation variance σ²·(1−φ²)
//      restores the iid-residual assumption per Howard-Ramdas-2021 H1'
//      (calibration phi from baseline).
//
//   2. Post-fire cooldown. Page-CUSUM and betting both fire on EVERY
//      tick once S_n / M_t crosses threshold (CUSUM doesn't reset; betting
//      wealth grows unboundedly). NAB scores reward the FIRST detection
//      in a labeled window; subsequent fires are FPs that swamp the per-
//      dataset score. The cooldown holds firing suppressed for K ticks
//      after a fire (default K=1000 — matches typical NAB labeled-window
//      half-width of ~300–600 ticks).
//
//   3. Spectral lag config + bootstrap-null calibration. The SLICE 4
//      stub config omitted `min_peak_lag` / `max_peak_lag` from the
//      family_D entry, making `peakACF(samples, undefined, undefined)`
//      return 0 → never fires. SLICE 5 stamps `[3, 10]` defaults and
//      replaces the hardcoded 0.5 quantile with a per-dataset bootstrap
//      calibration over the probationary window's peak-ACF distribution.

import type { DetectorFiringDecision } from './_nab-validation-types';

/** AR(1) pre-whitening helper. Given a series, the calibration mean μ,
 *  and the lag-1 autocorrelation φ̂, returns a sequence of residuals
 *  `r_t = (x_t − μ) − φ̂·(x_{t−1} − μ)` re-centered by adding μ back, so
 *  downstream detectors (which mean-center against `baseline_mean` in
 *  their derivation) see `x_t − μ = r_t` as input.
 *
 *  Under AR(1) H₀ with iid Gaussian innovations, the residual sequence is
 *  approximately iid with innovation variance σ²·(1−φ²); the detector's
 *  iid-calibrated math then operates correctly. */
export function prewhitenSeries(values: number[], phi: number, mean: number): number[] {
  if (!Number.isFinite(phi) || Math.abs(phi) >= 1) {
    throw new Error(`prewhitenSeries: phi must be finite and within (-1, 1), got ${phi}`);
  }
  const out: number[] = new Array(values.length);
  let prevDev = 0;
  for (let i = 0; i < values.length; i++) {
    const dev = values[i] - mean;
    const residual = dev - phi * prevDev;
    out[i] = mean + residual;
    prevDev = dev;
  }
  return out;
}

/** Apply post-fire cooldown to a firing trace. After a `fire: true`
 *  decision, the next `cooldownTicks` of firings are suppressed (set to
 *  `fire: false`). Statistic and threshold fields pass through unchanged.
 *  Pure data transform — no engine state coupling. */
export function applyFireCooldown(
  firings: DetectorFiringDecision[],
  cooldownTicks: number,
): DetectorFiringDecision[] {
  if (cooldownTicks <= 0) return firings;
  let suppressUntil = -1;
  const out = firings.map((f) => ({ ...f }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].fire && out[i].tick <= suppressUntil) {
      out[i].fire = false;
    } else if (out[i].fire) {
      suppressUntil = out[i].tick + cooldownTicks;
    }
  }
  return out;
}

/** SLICE 6 — anomaly-likelihood smoothing (NAB-aware window logic).
 *
 *  Replaces the raw cooldown wrapper with a Numenta-style persistence
 *  filter: a fire is emitted only when at least `thresholdCount` of the
 *  most recent `windowK` ticks have detector-fire=true. After emit,
 *  fires are suppressed for `cooldownTicks` (anomaly-likelihood
 *  effectively forms a "confirmed alert" once the rolling count crosses
 *  threshold).
 *
 *  Motivation: page-CUSUM crosses threshold at the FIRST tick of a
 *  sustained shift, but NAB labeled windows trail the actual change
 *  point by ~200–1500 ticks. Empirical classification of the SLICE 5
 *  output showed ~30% of labeled windows have detector fires within
 *  ±500 ticks of the window edge but OUTSIDE the credit zone. Requiring
 *  the rolling fire-count to cross a threshold (a) delays emit until
 *  the anomaly is sustained, increasing the chance the emit lands
 *  inside the labeled window, and (b) dedupes noisy spurious fires
 *  (single-tick CUSUM spikes that don't repeat) so they don't burn
 *  cooldown windows on isolated FPs.
 *
 *  Parameters:
 *  - `windowK`: rolling-window length over which fire-count is summed.
 *  - `thresholdCount`: minimum count of fire=true ticks in the window
 *    required to emit. With windowK=50, thresholdCount=25 means
 *    "detector must have fired in ≥ 50% of the last 50 ticks".
 *  - `cooldownTicks`: post-emit suppression length.
 *
 *  Anti-scope: pure dispatch-layer wrapper; no engine state coupling. */
export function applyAnomalyLikelihoodSmoothing(
  firings: DetectorFiringDecision[],
  windowK: number,
  thresholdCount: number,
  cooldownTicks: number,
): DetectorFiringDecision[] {
  if (windowK <= 0 || thresholdCount <= 0) return firings;
  if (thresholdCount > windowK) {
    throw new Error(
      `applyAnomalyLikelihoodSmoothing: thresholdCount (${thresholdCount}) `
      + `must not exceed windowK (${windowK})`,
    );
  }
  const out = firings.map((f) => ({ ...f, fire: false }));
  let rolling = 0;
  let suppressUntil = -1;
  for (let i = 0; i < firings.length; i++) {
    if (firings[i].fire) rolling += 1;
    if (i >= windowK && firings[i - windowK].fire) rolling -= 1;
    const t = firings[i].tick;
    if (t <= suppressUntil) continue;
    if (rolling >= thresholdCount) {
      out[i].fire = true;
      suppressUntil = t + cooldownTicks;
    }
  }
  return out;
}
