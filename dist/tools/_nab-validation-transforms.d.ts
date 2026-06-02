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
export declare function prewhitenSeries(values: number[], phi: number, mean: number): number[];
/** Apply post-fire cooldown to a firing trace. After a `fire: true`
 *  decision, the next `cooldownTicks` of firings are suppressed (set to
 *  `fire: false`). Statistic and threshold fields pass through unchanged.
 *  Pure data transform — no engine state coupling. */
export declare function applyFireCooldown(firings: DetectorFiringDecision[], cooldownTicks: number): DetectorFiringDecision[];
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
export declare function applyAnomalyLikelihoodSmoothing(firings: DetectorFiringDecision[], windowK: number, thresholdCount: number, cooldownTicks: number): DetectorFiringDecision[];
//# sourceMappingURL=_nab-validation-transforms.d.ts.map