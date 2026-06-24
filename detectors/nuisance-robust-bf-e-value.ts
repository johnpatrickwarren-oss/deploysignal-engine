// detectors/nuisance-robust-bf-e-value.ts — the missing VALID per-shard e-value.
//
// Promoted per ADR 0004 (engine/consumer charter + nuisance-robust evidence stack); validated in
// Tessera as tools/nuisance-robust-evalue.ts (Tessera ADR 0013, cold-eyed). This is the engine-native
// generalization of Tessera's fixed-window (values, m, n) form to arbitrary (cal, test) windows
// (cf. Tessera bf-lifecycle.ts:bfWin), consuming the engine's own Kendall-corrected AR(1) estimator
// (computePerSignalAr1Phi) instead of Tessera's mirror.
//
// WHY THIS EXISTS — the accuracy gap it closes. The engine's plug-in betting e-process
// (detectors/betting-e-process.ts) and Gaussian mixture supermartingale
// (detectors/family-a-mixture-supermartingale.ts) FREEZE a point baseline mean μ̂ estimated from the
// calibration prefix. Under an ESTIMATED baseline the estimation error makes E[e|H0] ≫ 1 — i.e. the
// e-value is INVALID (Tessera ADR 0008/0014: E[e|H0] blows up to ~1e8 plug-in / ~3e9 mixSM at large n).
// They are valid only with a TRUE baseline or in the m≫n regime. Fed to e-BH as if valid, they break
// the FDR guarantee. This detector is the valid replacement in the estimated-baseline regime.
//
// CONSTRUCTION — a two-sample sequential Bayes factor on WHITENED residuals. Whiten by the AR(1) φ
// (NO centering — the mean stays unknown, which is the whole point), then test "test-window mean =
// calibration-window mean" with BOTH means integrated out under a proper N(0, τ²) prior (a Bayes
// factor: separate-means model vs common-mean model). A Bayes factor with proper priors satisfies
// E[BF|H0] ≤ 1 → a VALID e-value — and it never freezes a point baseline, so it is robust to the
// plug-in baseline-MEAN estimation error. τ² = tauMult × innovation variance (diffuse but proper).
//
// CONDITION — adequate calibration length (the validity is NOT unconditional). The innovation
// variance s² is itself PLUG-IN estimated from the calibration residuals and also sets the prior
// scale τ² = tauMult·s². A proper-prior Bayes factor is E[BF|H0] ≤ 1 only with a KNOWN variance; the
// plug-in s² reintroduces estimation-error invalidity through the variance when the calibration window
// is short. Empirically (AR(1) nulls), E[BF|H0] ≤ 1 holds with margin only for cal length ≳ 100 — it
// blows up to ~6.7 at cal=50, ~2e9 at cal=20, ~7e252 at cal=5. So the e-value is gated to
// cal.len ≥ MIN_CALIBRATION_FOR_VALIDITY (the function throws below it rather than emit an e-value it
// cannot certify valid — ADR 0004: "the engine refuses to imply a guarantee outside its envelope").
// The principled fix that would lift this floor is to integrate the variance out too (NIG/t mixture);
// ADR 0004 / Tessera ADR 0013 scope that as the variance-robust extension (future work), not PR A.
//
// VALIDITY ENVELOPE (ships as metadata — see NUISANCE_ROBUST_BF_ENVELOPE): the BF tests a MEAN shift
// assuming the SAME innovation variance in the calibration and test windows (the Gaussian BF model),
// on AR(1)-whitened residuals, with the baseline mean unknown (integrated out, never plugged in).
// A VARIANCE change is OUT of scope here — a large variance inflation inflates P(fire) above α
// (analogous to the plug-in φ being second-order). Detecting a variance/trend/collapse signature is
// the distributional-signature detector's job (ADR 0004 Tier 2), the natural complement to this.
//
// Per ADR 0004's accuracy upgrade, the engine must NOT imply a guarantee outside this envelope; the
// envelope is exported so the fleet verdict can surface it. PR E formalizes a cross-detector envelope
// type and relabels the plug-in betting/mixture e-values as conditionally-valid; this file ships the
// BF's own envelope now.

import { computePerSignalAr1Phi } from './family-a-mixture-supermartingale';

/** A contiguous index window [start, start+len) into the observation series. */
export interface Window {
  /** First index (inclusive). */
  start: number;
  /** Number of samples. */
  len: number;
}

export interface NuisanceRobustBFOptions {
  /** Prior variance on the (whitened) mean as a multiple of the innovation variance:
   *  τ² = tauMult × s². Diffuse but proper. Default {@link DEFAULT_TAU_MULT}. */
  tauMult?: number;
  /** Override the AR(1) coefficient used to whiten. Default: the engine's Kendall-corrected
   *  {@link computePerSignalAr1Phi} estimated on the calibration window (centered on its mean). */
  ar1Phi?: number;
}

/** The validity regime in which E[BF|H0] ≤ 1 holds. Shipped as metadata so the engine never implies
 *  a guarantee outside it (ADR 0004 — validity envelopes as first-class). */
export interface NuisanceRobustBFEnvelope {
  /** The baseline mean is unknown and INTEGRATED OUT (a proper-prior Bayes factor) — it is never
   *  plugged in, which is exactly why this e-value is valid where the plug-in detectors are not. */
  baseline: 'unknown-mean-integrated';
  /** Residuals are AR(1)-whitened before the test. */
  autocorrelation: 'ar1-whitened';
  /** The null is a stable mean (the alternative is a mean shift). */
  null: 'mean-shift';
  /** Validity assumes the SAME innovation variance in calibration and test. A variance change is out
   *  of scope (route to the distributional-signature detector, ADR 0004 Tier 2). */
  variance: 'stable';
  /** Minimum calibration length for E[BF|H0] ≤ 1 to hold (the plug-in innovation variance reintroduces
   *  invalidity below it). Enforced by {@link nuisanceRobustBFEValue}, which throws for shorter windows. */
  minCalibration: number;
}

/** Minimum calibration length for the by-construction E[BF|H0] ≤ 1 property to hold empirically (the
 *  plug-in innovation variance s² reintroduces estimation-error invalidity below this — E[BF|H0] is
 *  ~6.7 at cal=50, ~2e9 at cal=20, ~7e252 at cal=5 on AR(1) nulls; ≤ 1 with margin from ~100 up).
 *  {@link nuisanceRobustBFEValue} throws for shorter calibration windows. */
export const MIN_CALIBRATION_FOR_VALIDITY = 100;

/** The nuisance-robust BF e-value's validity envelope (ADR 0004 Tier 1). E[BF|H0] ≤ 1 holds for the
 *  mean-shift null with stable innovation variance, on AR(1)-whitened residuals, under an unknown
 *  (integrated-out) baseline mean — AND for a calibration window of at least `minCalibration` samples. */
export const NUISANCE_ROBUST_BF_ENVELOPE: Readonly<NuisanceRobustBFEnvelope> = Object.freeze({
  baseline: 'unknown-mean-integrated',
  autocorrelation: 'ar1-whitened',
  null: 'mean-shift',
  variance: 'stable',
  minCalibration: MIN_CALIBRATION_FOR_VALIDITY,
});

/** Default prior-variance multiple (Tessera ADR 0013 TAU_MULT). */
export const DEFAULT_TAU_MULT = 25;

/** Log marginal likelihood of a Gaussian sample (sufficient statistic: cal-mean-centered sum S over
 *  n points, innovation variance s2) under a N(0, tau2) prior on the mean. The data-only constants
 *  cancel in the two-sample Bayes factor, so they are omitted here. */
function logMarginal(S: number, n: number, s2: number, tau2: number): number {
  return (tau2 * S * S) / (2 * s2 * (s2 + n * tau2)) - 0.5 * Math.log(1 + (n * tau2) / s2);
}

/** Nuisance-robust two-sample Bayes-factor e-value over a calibration window and a test window of a
 *  single contiguous series `values`. Robust to the unknown baseline mean (integrated out under a
 *  proper N(0, τ²) prior) and to AR(1) autocorrelation (whitened by φ). Returns the Bayes factor —
 *  a VALID e-value: E[BF|H0] ≤ 1 by construction (see file header + {@link NUISANCE_ROBUST_BF_ENVELOPE}).
 *
 *  Whitening uses each sample's immediate predecessor in `values`, so the calibration window drops its
 *  first sample (no predecessor inside the window) and the test window uses `values[test.start - 1]`
 *  as the predecessor of its first sample; therefore `test.start >= 1` and the two windows must index
 *  a single contiguous series.
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `test.len < 2`,
 *    `cal.len < MIN_CALIBRATION_FOR_VALIDITY` (the validity floor — see that constant), or any
 *    in-window value is non-finite. */
export function nuisanceRobustBFEValue(
  values: ReadonlyArray<number>,
  cal: Window,
  test: Window,
  opts?: NuisanceRobustBFOptions,
): number {
  // ── window validation (caller-bug guards; engine convention is to throw, not silently degrade) ──
  if (!Number.isInteger(cal.start) || !Number.isInteger(cal.len)
    || !Number.isInteger(test.start) || !Number.isInteger(test.len)) {
    throw new RangeError('nuisanceRobustBFEValue: window start/len must be integers');
  }
  if (cal.len < MIN_CALIBRATION_FOR_VALIDITY) {
    // The validity floor, not just the math minimum: below ~100 the plug-in innovation variance makes
    // E[BF|H0] ≫ 1 (the e-value is no longer valid). Refuse rather than emit an uncertifiable e-value.
    throw new RangeError(
      `nuisanceRobustBFEValue: cal.len must be >= MIN_CALIBRATION_FOR_VALIDITY (`
      + `${MIN_CALIBRATION_FOR_VALIDITY}) for E[BF|H0] <= 1 to hold; got ${cal.len}`,
    );
  }
  if (test.len < 2) {
    throw new RangeError(`nuisanceRobustBFEValue: test.len must be >= 2; got ${test.len}`);
  }
  if (test.start < 1) {
    throw new RangeError(`nuisanceRobustBFEValue: test.start must be >= 1 (whitening needs a predecessor); got ${test.start}`);
  }
  if (cal.start < 0 || cal.start + cal.len > values.length
    || test.start + test.len > values.length) {
    throw new RangeError(
      `nuisanceRobustBFEValue: window out of bounds (values.length=${values.length}, `
      + `cal=[${cal.start},${cal.start + cal.len}), test=[${test.start},${test.start + test.len}))`,
    );
  }
  // Finiteness is the caller's contract; a non-finite sample anywhere in the cal predecessor or either
  // window propagates to a NaN/Inf e-value (not a valid e-value). Guard it (sibling detectors do too —
  // betting-e-process.ts checks Number.isFinite). Scan from test.start-1 to cover the test predecessor.
  for (let t = cal.start; t < cal.start + cal.len; t++) {
    if (!Number.isFinite(values[t])) {
      throw new RangeError(`nuisanceRobustBFEValue: non-finite value at calibration index ${t}`);
    }
  }
  for (let t = test.start - 1; t < test.start + test.len; t++) {
    if (!Number.isFinite(values[t])) {
      throw new RangeError(`nuisanceRobustBFEValue: non-finite value at test index ${t}`);
    }
  }

  const tauMult = opts?.tauMult ?? DEFAULT_TAU_MULT;
  if (!(tauMult > 0)) {
    throw new RangeError(`nuisanceRobustBFEValue: tauMult must be > 0; got ${tauMult}`);
  }

  // ── AR(1) coefficient: engine-native Kendall-corrected estimate on the cal window (centered on its
  //    mean so the estimator is not mean-biased), unless overridden. ──
  const calValues = values.slice(cal.start, cal.start + cal.len);
  let phi = opts?.ar1Phi;
  if (phi === undefined) {
    const calMean = calValues.reduce((a, b) => a + b, 0) / calValues.length;
    phi = computePerSignalAr1Phi(calValues, calMean);
  }

  // ── whiten (NO centering — the mean is integrated out, not subtracted). ──
  const wc: number[] = [];
  for (let t = cal.start + 1; t < cal.start + cal.len; t++) wc.push(values[t] - phi * values[t - 1]);
  const wt: number[] = [];
  for (let t = test.start; t < test.start + test.len; t++) wt.push(values[t] - phi * values[t - 1]);

  // ── two-sample Bayes factor (separate-means vs common-mean) on the whitened residuals. ──
  const mc = wc.reduce((a, b) => a + b, 0) / wc.length;
  const s2 = Math.max(wc.reduce((a, b) => a + (b - mc) ** 2, 0) / (wc.length - 1), 1e-9);
  const tau2 = tauMult * s2;
  // Recenter both samples by the calibration mean (a common shift; the BF is invariant to it).
  const Sc = wc.reduce((a, b) => a + (b - mc), 0);
  const St = wt.reduce((a, b) => a + (b - mc), 0);
  return Math.exp(
    logMarginal(Sc, wc.length, s2, tau2)
    + logMarginal(St, wt.length, s2, tau2)
    - logMarginal(Sc + St, wc.length + wt.length, s2, tau2),
  );
}
