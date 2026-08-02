// detectors/sequential-ui.ts — the SEQUENTIAL (predictable-plug-in) universal-inference e-process
// for a mean shift under an AR(1) nuisance. ADR 0025: closes the F6 proof gap BY CONSTRUCTION.
//
// WHY THIS EXISTS. ADR 0010's split-LRT UI e-value is empirically valid for any φ but its
// "by construction" proof has a documented hole (Tessera research/2026-07-02-math-audit.md F6):
// in the standard call pattern the cal-EVAL half temporally PRECEDES the test-TRAIN half, so the
// numerator's parameters are NOT independent of the scored fold for φ ≠ 0 and the Fubini step does
// not close. The known fix — named in F6 and in ADR 0010's header — is a PREDICTABLE numerator:
// fit the alternative's parameters on strictly-past data only. This module is that fix, as an
// anytime e-PROCESS rather than a fixed-time e-value:
//
//     E_t = Π_{s≤t} f_{θ̂_{s−1}}(x_s | x_{s−1})  /  sup_{θ₀ ∈ H0} Π_{s≤t} f_{θ₀}(x_s | x_{s−1})
//
// with θ̂_{s−1} any F_{s−1}-measurable estimate (predictable plug-in) and H0 the composite null
// {Gaussian AR(1), CONSTANT mean μ, any φ ∈ (−1, 1), any σ² > 0}, conditioned on x_0.
//
// VALIDITY (the theorem F6 asked for, no empirical crutch). For every θ₀ ∈ H0 the denominator's
// sup is ≥ the likelihood at θ₀ itself, so
//     E_t ≤ M_t := Π f_{θ̂_{s−1}}(x_s|x_{s−1}) / Π f_{θ₀}(x_s|x_{s−1}),
// and M_t is a predictable-plug-in likelihood-ratio martingale under P_{θ₀}
// (E[f_{θ̂}(x_s|x_{s−1}) / f_{θ₀}(x_s|x_{s−1}) | F_{s−1}] = 1 — θ̂ is F_{s−1}-measurable and
// f_{θ̂}(·|x_{s−1}) is a probability density). Hence E is a nonnegative e-process:
// E[E_τ] ≤ 1 at EVERY stopping time, for ANY φ including near unit root — by construction.
// This also makes the increments legitimate anytime Λ^(j) material for SRR-style e-detectors
// (the O3 promotion question), where the fixed-split variant's moving train/eval folds are not.
//
// WHAT VALIDITY DOES AND DOES NOT NEED.
//   • It does NOT need the predictable estimates to be any good — a bad θ̂ costs POWER only.
//   • It does NOT need a standardized residual: the null profiles μ, φ, σ² out, so a mis-scaled
//     or level-shifted feed stays valid (contrast the Gaussian-LR mixture, where a 10% σ̂ error
//     inflates the null mean ~15× — audit F7). The e-process is SELF-STANDARDIZING within class.
//   • It DOES need the Gaussian-AR(1) class to contain the H0 truth — same envelope as ADR 0010
//     (heavy-tail robustness there was empirical, ADR 0011; carry the same disclosure).
//   • The denominator must be a REAL sup: an under-optimised null re-introduces violations. Same
//     φ-grid + closed-form profile approach the fixed-split UI uses (cold-eye-verified there).
//
// POWER SHAPE. The alternative lets the mean DIFFER from tick `changeFrom` on (two-regime mean);
// its predictable estimates converge to the truth, so log E_t grows ≈ t·KL(alt, best-null) after
// a change. Early ticks are spent learning (the sequential analogue of the split's half-data
// cost). Under H0 the numerator tracks the null MLE from below and E_t stays ≤ 1-ish forever —
// there is no α-spending; the process can run unboundedly.

/** Conditional AR(1) Gaussian log-density of x given predecessor p, regime means (mx for x, mp
 *  for p): x − mx = φ(p − mp) + ε, ε ~ N(0, s2). */
import type { ValidityEnvelope } from './validity-envelope';
function condLogDensity(x: number, p: number, mx: number, mp: number, phi: number, s2: number): number {
  const r = x - mx - phi * (p - mp);
  return -0.5 * Math.log(2 * Math.PI * s2) - (r * r) / (2 * s2);
}

/** Prefix sums over scored ticks s = 1..k (predecessor p_s = x_{s−1}): everything the profiled
 *  null likelihood needs, O(1) per (φ, k) after an O(T) build. */
interface NullSums {
  s1: Float64Array;   // Σ x_s
  s1p: Float64Array;  // Σ x_{s−1}
  s2: Float64Array;   // Σ x_s²
  s2p: Float64Array;  // Σ x_{s−1}²
  s11: Float64Array;  // Σ x_s·x_{s−1}
}

function buildNullSums(x: ReadonlyArray<number>): NullSums {
  const T = x.length;
  const s1 = new Float64Array(T), s1p = new Float64Array(T), s2 = new Float64Array(T),
    s2p = new Float64Array(T), s11 = new Float64Array(T);
  for (let s = 1; s < T; s++) {
    s1[s] = s1[s - 1] + x[s];
    s1p[s] = s1p[s - 1] + x[s - 1];
    s2[s] = s2[s - 1] + x[s] * x[s];
    s2p[s] = s2p[s - 1] + x[s - 1] * x[s - 1];
    s11[s] = s11[s - 1] + x[s] * x[s - 1];
  }
  return { s1, s1p, s2, s2p, s11 };
}

/** Null profile at fixed φ via prefix sums: with d_s = x_s − φx_{s−1} and μ̂ = d̄/(1−φ),
 *  SSE = Σd_s² − n·d̄², so ℓ = −n/2·log(2π·SSE/n) − n/2. */
function nullLogLikAtPhi(ns: NullSums, upTo: number, phi: number): number {
  const n = upTo;
  if (n < 2) return 0;
  const sumD = ns.s1[upTo] - phi * ns.s1p[upTo];
  const sumD2 = ns.s2[upTo] - 2 * phi * ns.s11[upTo] + phi * phi * ns.s2p[upTo];
  const sse = Math.max(sumD2 - (sumD * sumD) / n, 1e-12 * n);
  const s2hat = sse / n;
  return -0.5 * n * Math.log(2 * Math.PI * s2hat) - n / 2;
}

/** The genuine null sup over φ ∈ (−1, 1): coarse grid + golden-section refinement around the best
 *  cell (the same defense the fixed-split UI uses against an under-optimised denominator). */
function nullLogLikSup(ns: NullSums, upTo: number): number {
  if (upTo < 2) return 0;
  const GRID = 81;
  let bestPhi = 0, best = -Infinity;
  for (let i = 0; i < GRID; i++) {
    const phi = -0.999 + (1.998 * i) / (GRID - 1);
    const ll = nullLogLikAtPhi(ns, upTo, phi);
    if (ll > best) { best = ll; bestPhi = phi; }
  }
  let lo = Math.max(-0.999, bestPhi - 0.025), hi = Math.min(0.999, bestPhi + 0.025);
  const g = (Math.sqrt(5) - 1) / 2;
  let a = hi - g * (hi - lo), b = lo + g * (hi - lo);
  let fa = nullLogLikAtPhi(ns, upTo, a), fb = nullLogLikAtPhi(ns, upTo, b);
  for (let it = 0; it < 40; it++) {
    if (fa < fb) { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); fb = nullLogLikAtPhi(ns, upTo, b); }
    else { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); fa = nullLogLikAtPhi(ns, upTo, a); }
  }
  return Math.max(best, fa, fb);
}

export interface SequentialUiOptions {
  /** First index whose mean the ALTERNATIVE allows to differ (e.g. the monitoring start). The
   *  null keeps one common mean throughout. Default 1 (every scored point is post-change). */
  changeFrom?: number;
  /** Clip for the predictable φ̂ (stability at short prefixes). Default 0.95 (engine parity). */
  phiClip?: number;
}

export interface SequentialUiResult {
  /** log E_t after each scored tick s = 1..T−1 (index i ↔ tick i+1). */
  logE: number[];
  /** terminal log e-value. */
  terminalLogE: number;
  /** first scored tick (1-based) with E ≥ 1/alpha01 (α = 0.01), else null — a convenience readout;
   *  the caller owns real threshold semantics. */
  firstCross01: number | null;
}

/** Predictable parameters from the prefix [0, s): regime means, then lag-1 φ̂ and innovation σ̂²
 *  recomputed against the CURRENT regime means (stale-mean lag products bias φ̂ toward unit root
 *  after a change, which hands the alternative's advantage back to the absorbing null — measured
 *  as a 0.17-vs-0.93 power difference). O(s) per tick; validity needs only F_{s−1}-measurability,
 *  which a full recompute on the past prefix satisfies. Weak pseudo-data regularises early ticks. */
function predictableFit(
  x: ReadonlyArray<number>, upTo: number, changeFrom: number, phiClip: number,
): { muPre: number; muPost: number; phi: number; s2: number } {
  let nPre = 0, sumPre = 0, nPost = 0, sumPost = 0;
  for (let i = 0; i < upTo; i++) {
    if (i >= changeFrom) { nPost++; sumPost += x[i]; } else { nPre++; sumPre += x[i]; }
  }
  const muPre = nPre > 0 ? sumPre / nPre : 0;
  const muPost = nPost > 0 ? sumPost / nPost : muPre;
  const m = (i: number): number => (i >= changeFrom ? muPost : muPre);
  let sxy = 0, sx2 = 1, sInnov2 = 1, nInnov = 1; // pseudo-data: one unit-variance innovation
  for (let s = 1; s < upTo; s++) {
    const yc = x[s] - m(s), yp = x[s - 1] - m(s - 1);
    sxy += yc * yp;
    sx2 += yp * yp;
  }
  const phi = Math.max(-phiClip, Math.min(phiClip, sxy / sx2));
  for (let s = 1; s < upTo; s++) {
    const innov = x[s] - m(s) - phi * (x[s - 1] - m(s - 1));
    sInnov2 += innov * innov;
    nInnov++;
  }
  return { muPre, muPost, phi, s2: Math.max(sInnov2 / nInnov, 1e-9) };
}

/**
 * The sequential UI e-process on a raw series (index 0 is the conditioning origin). Returns the
 * full log-e trajectory; E[E_τ] ≤ 1 at every stopping time under the composite AR(1) null.
 */
export function sequentialUiMeanShiftEProcess(
  x: ReadonlyArray<number>, opts: SequentialUiOptions = {},
): SequentialUiResult {
  if (x.length < 3) throw new RangeError(`sequential-ui: need ≥ 3 points, got ${x.length}`);
  const changeFrom = opts.changeFrom ?? 1;
  const phiClip = opts.phiClip ?? 0.95;
  const ns = buildNullSums(x);
  let numLog = 0;
  const logE: number[] = [];
  let firstCross01: number | null = null;
  const thresh01 = Math.log(100);
  for (let s = 1; s < x.length; s++) {
    // predictable parameters from the prefix [0, s) — F_{s−1}-measurable by construction
    const { muPre, muPost, phi, s2 } = predictableFit(x, s, changeFrom, phiClip);
    const mx = s >= changeFrom ? muPost : muPre;
    const mp = s - 1 >= changeFrom ? muPost : muPre;
    numLog += condLogDensity(x[s], x[s - 1], mx, mp, phi, s2);
    // e-process value at tick s: predictable numerator vs the FULL-prefix null sup
    const le = numLog - nullLogLikSup(ns, s);
    logE.push(le);
    if (firstCross01 === null && le >= thresh01) firstCross01 = s;
  }
  return { logE, terminalLogE: logE[logE.length - 1], firstCross01 };
}

/** Validity envelope (mirrors UI_MEAN_SHIFT_ENVELOPE's shape). */
export const SEQUENTIAL_UI_ENVELOPE = Object.freeze({
  baseline: 'unknown-mean-mle' as const,
  autocorrelation: 'ar1-any-phi' as const,
  null: 'mean-shift' as const,
  variance: 'unknown-mle' as const,
  validUnderEstimatedBaseline: true as const,
  minCalibration: 3,
  notes: 'Sequential (predictable-plug-in) universal-inference e-PROCESS for an AR(1) mean shift. '
    + 'E[E_τ] ≤ 1 at every stopping time for ANY φ incl. near unit root — BY CONSTRUCTION (the '
    + 'numerator is fit on strictly-past data, closing audit F6\'s independence gap; the denominator '
    + 'is a genuine profiled sup over the composite null). Self-standardizing within class (scale/'
    + 'level errors are profiled out). Needs the Gaussian-AR(1) class to contain the H0 truth — '
    + 'same well-specification envelope as ADR 0010, same heavy-tail disclosure (ADR 0011). '
    + 'O(T·grid) per full trajectory; the running null sup is recomputed per tick.',
}) satisfies ValidityEnvelope;
