// detectors/shape-kurtosis-e-value.ts — Family E shape score (C22).
//
// Replaces the capability retired with the Family C MMD betting e-process
// (knowledge/stats/family-c-blind-to-shape-2026-08-04): detection of a
// distributional SHAPE change when the first two moments are unchanged —
// "bimodality emergence, variance inflation without mean-shift".
//
// Score. Per-coordinate standardised fourth moment over a trailing window,
// averaged across signals:
//
//     K_t = (1/p) Σ_i  m4_i / m2_i²        over the trailing W observations
//
// SCALE-INVARIANT BY CONSTRUCTION, which is the load-bearing property. For
// u → c·u,  E[(cu)⁴]/E[(cu)²]² = c⁴E[u⁴]/(c²E[u²])² = E[u⁴]/E[u²]², so a
// multiplicative covariance error cancels identically. That matters because
// knowledge/stats/bandwidth-scale-2026-08-04 measured the retired detector's
// false-alarm rate swinging 0.2% → 90% across a ±15% covariance error, and
// knowledge/stats/contamination-2026-08-04 measured the shipped estimator
// biased 10–25% depending on method and cell size.
//
// Direction is informative and is why the indicator is TWO-SIDED. Gaussian
// coordinates give E[u⁴] = 3. A moment-matched bimodal mixture is
// PLATYKURTIC — 1.688 at the harness's parameters — so K FALLS. Outlier
// contamination raises it. One statistic, two distinguishable faults.
//
// e-value construction is the Addition #22 hedged indicator, reused verbatim
// from conformal.ts: e_t = 1 + 1{K_t in tail} − α, M_t = Π e_s, fire at
// M_t ≥ 1/α under Ville. Two-sided means α/2 per tail so P(indicator) = α
// under H₀.
//
// NOT YET VALIDATED. knowledge/stats/shape-comparator-2026-08-05 chose this
// construction on SEPARATION (d = 8.30 at W=120 against 0.004 for a degree-4
// kernel, at 0.0% covariance sensitivity against 102–159%). Separation is not
// validity: this file makes no e-value claim until the audit measures it, and
// knowledge/stats/detector-audit-sequential-2026-08-05 gives the specific
// expectation that the estimated-parameter regime is where it will break.

import type { DetectorVerdict } from '../types/verdict.js';

/** Compiled per-cell parameters. `scores` is the ascending calibration
 *  distribution of K under H₀ for this cell's (p, W, correlation). */
export interface ShapeKurtosisParams {
  readonly kind: 'shape_kurtosis_e_value';
  /** Trailing window length the score is computed over. */
  readonly window: number;
  /** Ascending calibration scores. Both tails are read from this. */
  readonly scores: ReadonlyArray<number>;
  /** Per-coordinate standard deviations used to standardise. Only their
   *  RATIO to the live scale matters — the score is scale-invariant — but
   *  they are stamped so the runtime does not re-derive them. */
  readonly sigma: ReadonlyArray<number>;
}

export interface ShapeKurtosisState {
  /** Trailing raw observations, newest last. */
  buf: number[][];
  /** Ticks since the last scored window. DISJOINT evaluation: the window is
   *  scored once per `window` ticks, never on every tick. Sliding by one tick
   *  makes consecutive scores share W−1 observations, and the hedged
   *  indicator's e_t = 1 + 1{tail} − α needs the indicator to fire at rate α
   *  on the sequence it is applied to. Overlapping windows break that — a
   *  first build of this detector false-alarmed at 0.206 against α = 0.05 for
   *  exactly this reason, which is Family D's dominant failure recurring
   *  (knowledge/stats/h0-battery-2026-08-01 N7). */
  sinceEval: number;
  /** Running wealth. */
  M: number;
  n: number;
  alphaConsumed: number;
}

export function freshShapeKurtosisState(): ShapeKurtosisState {
  return { buf: [], sinceEval: 0, M: 1, n: 0, alphaConsumed: 0 };
}

/** K = (1/p) Σ_i m4_i/m2_i². Returns null if any coordinate is degenerate. */
export function shapeKurtosisScore(
  win: ReadonlyArray<ReadonlyArray<number>>, sigma: ReadonlyArray<number>,
): number | null {
  const n = win.length;
  if (n < 4) return null;
  const p = sigma.length;
  let acc = 0;
  for (let i = 0; i < p; i++) {
    const s = sigma[i];
    if (!(s > 0)) return null;
    let m2 = 0, m4 = 0;
    for (let t = 0; t < n; t++) {
      const u = win[t][i] / s;
      const u2 = u * u;
      m2 += u2; m4 += u2 * u2;
    }
    m2 /= n; m4 /= n;
    if (!(m2 > 0)) return null;
    acc += m4 / (m2 * m2);
  }
  return acc / p;
}

/** Two-sided tail test against the calibration distribution. α/2 per tail. */
function inTail(scores: ReadonlyArray<number>, k: number, alpha: number): boolean {
  const M = scores.length;
  if (M === 0) return false;
  const half = alpha / 2;
  const loIdx = Math.floor(half * M);
  const hiIdx = Math.max(0, Math.ceil((1 - half) * M) - 1);
  return k <= scores[loIdx] || k >= scores[hiIdx];
}

/** Evaluate one tick. Accumulates into the trailing window and only scores
 *  once the window is full; before that the wealth is untouched, which keeps
 *  e_t = 1 and the process a valid (trivial) martingale over the warm-up. */
export function evaluateShapeKurtosisEValue(
  input: { params: ShapeKurtosisParams; alpha: number },
  x_t: ReadonlyArray<number>,
  state: ShapeKurtosisState,
): DetectorVerdict {
  const { params, alpha } = input;
  const threshold = 1 / alpha;
  const signal = 'shape_kurtosis_e_value';

  state.buf.push([...x_t]);
  if (state.buf.length > params.window) state.buf.shift();
  if (state.buf.length < params.window) {
    return {
      verdict: 'clean', statistic: state.M, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'awaiting_window', family: 'E', signal,
    };
  }
  // Disjoint evaluation — see ShapeKurtosisState.sinceEval.
  state.sinceEval += 1;
  if (state.sinceEval < params.window) {
    return {
      verdict: 'clean', statistic: state.M, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'awaiting_disjoint_window', family: 'E', signal,
    };
  }
  state.sinceEval = 0;

  const k = shapeKurtosisScore(state.buf, params.sigma);
  if (k === null) {
    return {
      verdict: 'suppressed', statistic: state.M, threshold,
      alpha_consumed: 0, alpha_spent: 0,
      reason_code: 'degenerate_window', family: 'E', signal,
    };
  }

  const indicator = inTail(params.scores, k, alpha) ? 1 : 0;
  const e_t = 1 + indicator - alpha;
  state.M = state.M * e_t;
  state.n += 1;

  if (state.M >= threshold) {
    const alphaSpent = Math.max(0, alpha - state.alphaConsumed);
    state.alphaConsumed = alpha;
    return {
      verdict: 'fire', statistic: state.M, threshold,
      alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
      reason_code: 'shape_kurtosis_wealth_exceeded', family: 'E', signal,
    };
  }
  return {
    verdict: 'clean', statistic: state.M, threshold,
    alpha_consumed: 0, alpha_spent: 0,
    reason_code: 'below_threshold', family: 'E', signal,
  };
}

/** Validity envelope. `baseline: 'plug-in'` is deliberate and is the known
 *  risk: the score standardises by a compiled σ̂. The score is invariant to a
 *  multiplicative error in it, but the CALIBRATION distribution is not
 *  invariant to a wrong correlation structure. */
export const SHAPE_KURTOSIS_ENVELOPE = Object.freeze({
  baseline: 'plug-in' as const,
  autocorrelation: 'iid' as const,
  null: 'distributional-shape' as const,
  variance: 'stable' as const,
  validUnderEstimatedBaseline: false as const,
  minCalibration: 200,
  notes: 'Per-coordinate standardised fourth moment, two-sided hedged-indicator e-value. Score is '
    + 'scale-invariant by construction, so a multiplicative covariance error cancels; the '
    + 'CALIBRATION still depends on (p, window, correlation) and is per-cell. Discards cross-signal '
    + 'structure by design — a fault changing only the joint shape at fixed marginals is invisible. '
    + 'NOT VALIDATED: selected on separation, not on any e-value property.',
});

/** Build the per-cell calibration distribution of K under H₀.
 *
 *  Synthesized, exactly as Family E's is: draw windows from N(0, Σ) via the
 *  supplied Cholesky factor and record K for each. The score is scale-
 *  invariant, so the DISTRIBUTION of K does not depend on the scale of Σ —
 *  but it does depend on the correlation structure, which is why this is
 *  per-cell rather than a (p, window) lookup.
 *
 *  `draws` is the number of calibration windows; `L` is lower-triangular. */
export function buildShapeKurtosisCalibration(
  L: ReadonlyArray<ReadonlyArray<number>>,
  window: number,
  draws: number,
  rng: () => number,
): { scores: number[]; sigma: number[] } {
  const p = L.length;
  const sigma = new Array<number>(p);
  for (let i = 0; i < p; i++) {
    let v = 0;
    for (let j = 0; j <= i; j++) v += L[i][j] * L[i][j];
    sigma[i] = Math.sqrt(v);
  }
  let spare: number | null = null;
  const gauss = (): number => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    const u1 = Math.max(rng(), 1e-300), u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  const scores: number[] = [];
  for (let d = 0; d < draws; d++) {
    const win: number[][] = [];
    for (let t = 0; t < window; t++) {
      const w = new Array<number>(p);
      for (let j = 0; j < p; j++) w[j] = gauss();
      const z = new Array<number>(p);
      for (let r2 = 0; r2 < p; r2++) {
        let s = 0;
        for (let c = 0; c <= r2; c++) s += L[r2][c] * w[c];
        z[r2] = s;
      }
      win.push(z);
    }
    const k = shapeKurtosisScore(win, sigma);
    if (k !== null) scores.push(k);
  }
  scores.sort((a, b) => a - b);
  return { scores, sigma };
}

/** Build the calibration EMPIRICALLY, from real baseline windows.
 *
 *  REQUIRED, not optional. The synthesized-Gaussian builder above asserts
 *  Gaussian kurtosis, and the N1–N7 battery measured what that costs when the
 *  baseline is not Gaussian: `E[exp(Δ log M)]` of 1.947 with a crossing rate
 *  of 1.0000 on healthy lognormal and healthy t₃ traffic — the detector reads
 *  healthy non-Gaussian data as a shape fault. Rebuilding the same
 *  distribution from the baseline's own windows takes those to 0.998 and
 *  1.001, and takes AR(1) φ=0.9 from a crossing rate of 1.0000 to 0.0010.
 *
 *  The synthesized builder is retained only for the Gaussian-baseline case and
 *  for tests; anything reaching production should use this.
 *
 *  `rows` are baseline observations in the same space the detector sees. */
export function buildShapeKurtosisCalibrationEmpirical(
  rows: ReadonlyArray<ReadonlyArray<number>>,
  window: number,
  sigma: ReadonlyArray<number>,
  stride = 1,
): number[] {
  const scores: number[] = [];
  for (let start = 0; start + window <= rows.length; start += stride) {
    const k = shapeKurtosisScore(rows.slice(start, start + window), sigma);
    if (k !== null) scores.push(k);
  }
  scores.sort((a, b) => a - b);
  return scores;
}
