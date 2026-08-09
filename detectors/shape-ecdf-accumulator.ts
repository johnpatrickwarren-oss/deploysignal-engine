// detectors/shape-ecdf-accumulator.ts — K6-slow: the hours-scale block-conformal
// accumulator on a held-out reference ECDF.
//
// knowledge/methodology/pages/k6-accumulator.md (the binding design page) and
// validation/coverage/PREREGISTRATION.md Amendments v2.K6A (the construction and its
// design-time gate at H = 3,000, REFUTED), v2.K6A.1 (the fresh H = 6,000 re-gate, PASS,
// which registers this build) and v2.K6A.2 (the build-readiness repair). Every constant
// in this file is a transcription of v2.K6A.1 §K6A.1.2's frozen configuration; nothing
// here is derived, re-optimized or re-tuned, and the prereg governs.
//
// What this closes and what it does NOT. K6 at the deploy-gate geometry (300 ticks) is
// answered NO on the record, twice (shape_block_conformal_bet, k6-ecdf-successor), and
// v2.K6A's H = 3,000 refutation of THIS construction stands un-withdrawn — v2.K6A.1's own
// fresh draw reproduces it at 0.250. What passed is a different question: the same
// construction read over an hours-scale horizon, H = 6,000 post-onset ticks = 40 disjoint
// windows of 150. The bar was re-ratified from 3,000 to 6,000 by operator decision AFTER
// the first measurement missed it (v2.K6A.1 K6A.1.1) — a post-measurement relaxation,
// disclosed as such on the design page and paid for with a fresh gate on fresh seeds.
//
// FROZEN CONFIGURATION (v2.K6A.1 K6A.1.2, quoted):
//
//     W        = 150                     window length, disjoint W-blocks of the live stream
//     n        = 100,000                 calibration substrate rows, ONE advanced stream
//     A / B    = 25,000 / 75,000         A -> the reference; B -> m contiguous disjoint blocks
//     m        = 500                     = 75,000/150 exactly, no remainder; SATURATED
//     feature  = energy distance vs Fhat_A, the form frozen at v2.K6A K6A.2, verbatim
//     kappa    = 0.6820                  FROZEN LITERAL. Not re-derived on the gate's data.
//     H        = 6,000  ->  N = 40        disjoint windows of 150
//     endpoint = wealth >= 20  (log >= log 20 = 2.995732) at any window checkpoint
//
// THE FEATURE, cited rather than invented (v2.K6A K6A.2, the `energy` line, verbatim):
//
//     T_energy(w) = (2/(W*n_A)) * SUM_{i,j} |x_i - a_j|  -  (1/W^2) * SUM_{i,k} |x_i - x_k|
//
// i.e. the two-sample energy distance between the live window and A with the constant
// -(1/n_A^2)*SUM|a - a'| term DROPPED: it is identical for every object ranked against the
// same A, and only the rank is used. SUM_{i,k} runs over all W^2 ORDERED pairs (twice the
// i<k sum, diagonal zero). K6A.2's own justification for the dropped term is cited, not
// re-derived: the only use made of T is its rank among the m+1 exchangeable values, which
// no additive constant or strictly monotone transformation changes (K6E.2).
//
// IMPLEMENTATION NOTE, because the arithmetic is not the formula's shape. The direct
// SUM_{i,j} is W*n_A = 3.75M terms per window, and the calibration alone needs m = 500 of
// them. `crossSum` therefore evaluates SUM_j |x - a_j| in O(log n_A) from an ascending copy
// of A and its prefix sums, and `pairSum` evaluates SUM_{i,k}|x_i - x_k| in O(W log W) from
// the window's own order statistics via SUM_{i<k}(x_(k) - x_(i)) = SUM_r (2r - W - 1) x_(r).
// Both are the same real number as the double sums, differing only in floating-point
// summation order; test/shape-ecdf-accumulator.test.ts pins them against the literal
// double-sum oracle. The ascending copy of A IS Fhat_A(x) = (1/n_A)*#{a in A : a <= x} —
// the same object the CvM/AD variants of K6A.2 read through, held in the form the energy
// form needs.
//
// THE RANK AND THE CALIBRATOR (K6A.2, K6A.1.2):
//
//     p = (1 + #{j : T(B_j) >= T(live)}) / (m + 1)     tie-inclusive >=, K6.2's rule
//     e = kappa * p^(kappa - 1),  kappa in (0,1)
//     log wealth after t windows = t*log(kappa) + (1-kappa)*S_t,  S_t = SUM(-log p_w)
//
// The tie direction is validity-bearing, not incidental — exactly K4's rank direction
// (point-tail-bet-e-value.ts) and K6's (shape-block-conformal-bet.ts): ties have
// probability 0 on continuous draws but the count must include them for super-uniformity
// to hold at the boundary. Conditional on A, T(B_1)...T(B_m) and T(live) are i.i.d. under
// the null (each the same functional of W draws from the same stationary law against the
// same fixed reference), so p is exactly uniform on the m+1 point grid and K6E.3's closed
// forms hold at the frozen m = 500 (K6A.2):
//
//     E[log p | null] = (SUM_{k=1..m+1} log k)/(m+1) - log(m+1)     = -0.991961
//     E[e | null]     = kappa*(m+1)^(-kappa)*SUM_{k=1..m+1} k^(kappa-1) = 0.991433 < 1
//
// Windows combine by PRODUCT (disjoint => independent increments => a genuine test
// martingale), accumulated in the log domain per ADR 0026 (decisions/0026-log-domain-wealth.md;
// detectors/_wealth.ts), never by max — a max of e-values does not preserve E[e|H0] <= 1.
// This construction has ONE feature, so unlike K6 there is no per-window averaging step.
// The wealth floor is the K6 module's own LOG_WEALTH_FLOOR_K6 = log(1e-12) (C1.9 I1).
//
// DEGENERACY, and where this file deliberately DIFFERS from shape-block-conformal-bet.ts.
// The energy feature is a finite sum of absolute differences, so it is finite on every
// finite input — including a constant live window, which is a legitimate extreme (maximum
// distance from A), not a 0/0. K6's kurtosis/|skew| features have a genuine live-side
// degeneracy (a constant window gives m2 = 0), which is why that module returns a neutral
// e = 1 for a non-finite T. Here there is no such pathway: a non-finite T can only come
// from a non-finite INPUT, which is a defect and not an observation, so this module THROWS
// rather than scoring it. That is what makes K6A.1.12's registered `degenerate_windows`
// and `non_finite_wealth` structural zeros checkable — a nonzero count is its own falsifier,
// and a silent NaN would satisfy the counter while corrupting the endpoint.
//
// Calibration-side degeneracy throws, as in K6 (`assertNonDegenerate` there):
//   - a non-finite row anywhere in A or B;
//   - a degenerate reference ECDF (A is a point mass, max = min), so Fhat_A has no spread;
//   - a constant reference block (max = min within B_j) — the substrate is not the
//     stationary continuous draw the exchangeability argument assumes;
//   - zero spread across the m block statistics (every T(B_j) identical), K6's case (b):
//     any nonzero live perturbation would then score the extreme p regardless of size.
//
// Out of claim, by design (design page's §what-this-page-does-not-claim, unchanged):
// contamination robustness, any T3 real-data claim, and any wall-clock guarantee. The T2
// clustersynth validity arm runs at m = 45, NOT this file's registered m = 500 (K6A.1.11's
// arithmetic: 9,000 reference ticks cannot supply 75,000), and its healthy falsifier is
// disclosed as very nearly vacuous at W = 150.

import { advanceLogWealth, wealthView } from './_wealth';

/** Live/reference window length. FROZEN (v2.K6A.1 K6A.1.2). */
export const W_K6SLOW = 150;

/** Reference-segment length: A = rows 1..25,000 of the 100,000-row draw. FROZEN. */
export const N_A_K6SLOW = 25000;

/** Disjoint contiguous B-blocks: 75,000/150 = 500 exactly, no remainder; SATURATED
 *  (v2.K6A Table 3 — the substrate stops paying above m ~ 500). FROZEN. */
export const M_K6SLOW = 500;

/** Calibration substrate rows per cell: 25,000 + 500*150. FROZEN. */
export const N_ROWS_K6SLOW = N_A_K6SLOW + M_K6SLOW * W_K6SLOW;

/** kappa for the calibrator e = kappa*p^(kappa-1). FROZEN LITERAL 0.6820 — v2.K6A.1
 *  K6A.1.2 keeps it against its own fresh data's implied optimum 1/x = 0.680848
 *  (0.00115 below, worth < 0.001 in detection) because re-deriving kappa on the data
 *  that then reports the endpoint is the circularity v2.K6A K6A.6 removed. Do not
 *  "improve" this number: it is the freeze the passing gate rests on. */
export const KAPPA_K6SLOW = 0.682;

/** The healthy budget (v2.K6A.1 K6A.1.2 / K6A.1.10). */
export const ALPHA_K6SLOW = 0.05;

/** Endpoint: wealth >= 1/alpha = 20, i.e. log-wealth >= log 20 = 2.995732, at any
 *  window checkpoint (any-time, Ville). */
export const LOG_WEALTH_THRESHOLD_K6SLOW = Math.log(1 / ALPHA_K6SLOW);

/** Wealth floor, log domain — the same value shape-block-conformal-bet.ts uses
 *  (LOG_WEALTH_FLOOR_K6 = log(1e-12), C1.9 I1); prevents underflow on long healthy runs.
 *  Unreachable inside the registered horizon: the worst attainable path over N = 40
 *  windows is 40*log(kappa) = -15.309, well above log(1e-12) = -27.631. */
export const LOG_WEALTH_FLOOR_K6SLOW = Math.log(1e-12);

/** The substrate split. The registered path uses `REGISTERED_GEOMETRY_K6SLOW` and takes
 *  no geometry argument; the override exists so the construction is testable on
 *  hand-computable geometries and so the T2 arm's m = 45 (K6A.1.11) has a legitimate
 *  route that does not touch the frozen literals. */
export interface EcdfAccumulatorGeometry {
  /** window / block length */
  W: number;
  /** reference-segment length (A) */
  nA: number;
  /** number of disjoint contiguous B-blocks */
  m: number;
}

export const REGISTERED_GEOMETRY_K6SLOW: Readonly<EcdfAccumulatorGeometry> = Object.freeze({
  W: W_K6SLOW,
  nA: N_A_K6SLOW,
  m: M_K6SLOW,
});

/** C1.8's registered fingerprint construction (`cal_fingerprint`), applied to this
 *  construction's single block statistic. `absdev_*` are quantiles of the ascending
 *  |T(B_j) - median| distances under C1.8's convention q(p) = sortedAbsDev[round(p*(m-1))],
 *  and `absdev_max` is the last element. */
export interface EcdfAccumulatorFeatureFingerprint {
  median: number;
  absdev_p50: number;
  absdev_p90: number;
  absdev_max: number;
}

export interface EcdfAccumulatorFingerprint {
  W: number;
  m: number;
  n_A: number;
  blockT: EcdfAccumulatorFeatureFingerprint;
}

export interface EcdfAccumulatorCalibration {
  W: number;
  nA: number;
  m: number;
  /** ascending copy of A — the empirical reference measure Fhat_A */
  sortedA: number[];
  /** prefixA[i] = sum of sortedA[0..i-1]; length nA+1 */
  prefixA: number[];
  /** T(B_j) in block order (provenance: which block produced which statistic) */
  blockT: number[];
  /** T(B_j) ascending — what the live rank counts against */
  sortedBlockT: number[];
  cal_fingerprint: EcdfAccumulatorFingerprint;
}

export interface EcdfAccumulatorWindowResult {
  T: number;
  p: number;
  e: number;
}

export interface EcdfAccumulatorWealthResult {
  /** saturating linear view of the final log-wealth (never Infinity) */
  wealth: number;
  /** cumulative log-wealth through each window — the any-time crossing trajectory */
  log: number[];
  /** 0-based index of the first window whose cumulative log-wealth reaches
   *  LOG_WEALTH_THRESHOLD_K6SLOW, or -1 if none. Index i is post-onset tick (i+1)*W,
   *  so `crossingIndex === 1` is the 300-tick crossing K6A.1.5 identifies as the
   *  earliest arithmetically possible one. */
  crossingIndex: number;
}

export interface NullGrowthScreenOptions {
  /** MC seeds, one null window per seed. Mandatory: this module has no generator and no
   *  wall-clock or Math.random default (the screen is a registered stop condition and
   *  must be reproducible from its seeds). */
  seeds: ReadonlyArray<number>;
  /** the caller's own registered generator, seed -> one length-W null window. */
  drawNullWindow: (seed: number) => number[];
  /** defaults to the frozen KAPPA_K6SLOW; guarded to (0,1) either way. */
  kappa?: number;
}

export interface NullGrowthScreenResult {
  kappa: number;
  draws: number;
  /** Ehat[-log p | null, S] over the MC draws */
  meanNegLogP: number;
  /** g_null(S) = log kappa + (1-kappa)*Ehat[-log p | null, S] */
  gNull: number;
  /** gNull > 0 — the registered STOP condition for this calibration draw (K6A.1.10 (2)) */
  positive: boolean;
}

/** Amendment v2.C1 (C1.9), restated for this module: e = kappa*p^(kappa-1) is an e-value
 *  because integral_0^1 kappa*p^(kappa-1) dp = 1, and that holds only for kappa in (0,1).
 *  kappa <= 0 diverges, kappa = 1 is no bet, kappa > 1 inverts the bet so large p pays. */
function assertKappaInUnitInterval(fn: string, kappa: number): void {
  if (!Number.isFinite(kappa) || !(kappa > 0) || !(kappa < 1)) {
    throw new Error(`${fn}: kappa must be a finite number in the open interval (0,1), got ${kappa}`);
  }
}

function assertGeometry(fn: string, geom: EcdfAccumulatorGeometry): void {
  if (!(Number.isInteger(geom.W) && geom.W > 0)) {
    throw new Error(`${fn}: W must be a positive integer (K6A.1.2 freezes W = ${W_K6SLOW}), got ${geom.W}`);
  }
  if (!(Number.isInteger(geom.nA) && geom.nA > 0)) {
    throw new Error(`${fn}: nA must be a positive integer (K6A.1.2 freezes A = ${N_A_K6SLOW}), got ${geom.nA}`);
  }
  if (!(Number.isInteger(geom.m) && geom.m > 0)) {
    throw new Error(`${fn}: m must be a positive integer (K6A.1.2 freezes m = ${M_K6SLOW}), got ${geom.m}`);
  }
}

/** SUM_j |x - a_j| over the whole reference, in O(log nA) from the ascending copy and its
 *  prefix sums: with c = #{a_j <= x}, the sum splits into (c*x - P_c) below and
 *  ((P_total - P_c) - (nA - c)*x) above. Exactly the SUM_{i,j} term of K6A.2's `energy`
 *  form, one live value at a time. */
function crossSum(x: number, sortedA: number[], prefixA: number[]): number {
  const nA = sortedA.length;
  let lo = 0, hi = nA;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedA[mid] <= x) lo = mid + 1; else hi = mid;
  }
  const c = lo;
  const pc = prefixA[c];
  const total = prefixA[nA];
  return (c * x - pc) + ((total - pc) - (nA - c) * x);
}

/** SUM_{i,k} |x_i - x_k| over all W^2 ordered pairs = 2*SUM_{i<k}(x_(k) - x_(i)), and the
 *  i<k sum telescopes to SUM_r (2r - W - 1) x_(r) over the ascending order statistics
 *  (r 1-based). The second term of K6A.2's `energy` form. */
function pairSum(sortedWindow: number[]): number {
  const W = sortedWindow.length;
  let s = 0;
  for (let r = 1; r <= W; r++) s += (2 * r - W - 1) * sortedWindow[r - 1];
  return 2 * s;
}

/** K6A.2's `energy` form, assembled from the two helpers above. */
function energyT(window: ReadonlyArray<number>, sortedA: number[], prefixA: number[]): number {
  const W = window.length;
  const nA = sortedA.length;
  let cross = 0;
  for (const x of window) cross += crossSum(x, sortedA, prefixA);
  const sorted = [...window].sort((a, b) => a - b);
  return (2 / (W * nA)) * cross - (1 / (W * W)) * pairSum(sorted);
}

/** Count of values in `sorted` (ascending) that are >= x. Same tie direction as
 *  point-tail-bet-e-value.ts's countGte and shape-block-conformal-bet.ts's — the
 *  validity-bearing one (K6.2's rule, cited by K6A.2). */
function countGte(sorted: number[], x: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < x) lo = mid + 1; else hi = mid;
  }
  return sorted.length - lo;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = n >> 1;
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const calQuantile = (sortedAbsDev: number[], p: number): number =>
  sortedAbsDev[Math.round(p * (sortedAbsDev.length - 1))];

function fingerprint(geom: EcdfAccumulatorGeometry, sortedBlockT: number[]): EcdfAccumulatorFingerprint {
  const med = median(sortedBlockT);
  const sortedAbsDev = sortedBlockT.map((t) => Math.abs(t - med)).sort((a, b) => a - b);
  return {
    W: geom.W,
    m: geom.m,
    n_A: geom.nA,
    blockT: {
      median: med,
      absdev_p50: calQuantile(sortedAbsDev, 0.5),
      absdev_p90: calQuantile(sortedAbsDev, 0.9),
      absdev_max: sortedAbsDev[sortedAbsDev.length - 1],
    },
  };
}

/** Calibrates the held-out draw: splits A = rows[0, nA) and B = rows[nA, nA + m*W),
 *  builds the ascending reference (Fhat_A) with its prefix sums, and computes T(B_j) for
 *  each of the m disjoint contiguous W-blocks under K6A.2's registered energy form.
 *
 *  The registered path passes the 100,000-row draw and nothing else: A = 25,000,
 *  B = 75,000 -> m = 500 blocks of 150 exactly, no remainder (v2.K6A.1 K6A.1.2/K6A.1.9).
 *  The split is exact, not floor-based: a substrate that does not divide evenly is a
 *  defect in the draw, and this function throws rather than dropping a remainder.
 *
 *  Throws on: a non-integral geometry; a row count that is not nA + m*W (reported as the
 *  B-remainder and the m mismatch separately, so an A/B boundary off-by-one names itself);
 *  a non-finite row; a degenerate reference ECDF; a constant reference block; zero spread
 *  across the m block statistics. */
export function calibrateEcdfAccumulator(
  rows: ReadonlyArray<number>,
  geom: EcdfAccumulatorGeometry = REGISTERED_GEOMETRY_K6SLOW,
): EcdfAccumulatorCalibration {
  const fn = 'calibrateEcdfAccumulator';
  assertGeometry(fn, geom);
  const { W, nA, m } = geom;
  if (rows.length <= nA) {
    throw new Error(
      `${fn}: need more than nA = ${nA} rows to split A and B (K6A.1.9: A = rows 1..${nA}, `
      + `B = rows ${nA + 1}..${nA + m * W}), got ${rows.length}`,
    );
  }
  const bLen = rows.length - nA;
  if (bLen % W !== 0) {
    throw new Error(
      `${fn}: B must be an exact multiple of W = ${W} (K6A.1.2: no remainder, the split is exact `
      + `and not floor-based), got ${bLen} rows after A = ${nA}`,
    );
  }
  const mSplit = bLen / W;
  if (mSplit !== m) {
    throw new Error(
      `${fn}: m must be ${m}, got ${mSplit} from ${rows.length} rows `
      + `(K6A.1.2: n = ${nA + m * W} = A ${nA} + B ${m * W} -> ${m} blocks of ${W})`,
    );
  }
  for (let i = 0; i < rows.length; i++) {
    if (!Number.isFinite(rows[i])) {
      throw new Error(
        `${fn}: non-finite row at index ${i} (${rows[i]}) — the substrate is a continuous `
        + 'stationary draw (K6A.1.3); a non-finite row is a defect, not an observation',
      );
    }
  }
  const sortedA = rows.slice(0, nA).sort((a, b) => a - b);
  if (!(sortedA[nA - 1] > sortedA[0])) {
    throw new Error(
      `${fn}: degenerate reference ECDF Fhat_A (A is a point mass, min = max = ${sortedA[0]}) — `
      + 'every energy distance would then be a function of |x - a| alone and the rank carries no '
      + 'distributional evidence',
    );
  }
  const prefixA = new Array<number>(nA + 1);
  prefixA[0] = 0;
  for (let i = 0; i < nA; i++) prefixA[i + 1] = prefixA[i] + sortedA[i];
  const blockT = new Array<number>(m);
  for (let j = 0; j < m; j++) {
    const block = rows.slice(nA + j * W, nA + (j + 1) * W);
    let bmin = block[0], bmax = block[0];
    for (const v of block) { if (v < bmin) bmin = v; if (v > bmax) bmax = v; }
    if (!(bmax > bmin)) {
      throw new Error(
        `${fn}: constant reference block B_${j + 1} (all ${W} rows = ${bmin}) — the block-`
        + 'exchangeability argument assumes the same stationary continuous law in every block',
      );
    }
    const t = energyT(block, sortedA, prefixA);
    if (!Number.isFinite(t)) {
      throw new Error(`${fn}: non-finite T for reference block B_${j + 1} (${t})`);
    }
    blockT[j] = t;
  }
  const sortedBlockT = [...blockT].sort((a, b) => a - b);
  if (!(sortedBlockT[m - 1] > sortedBlockT[0])) {
    throw new Error(
      `${fn}: zero spread across the ${m} reference block statistics (every T(B_j) = `
      + `${sortedBlockT[0]}) — any nonzero live perturbation would score the extreme `
      + `p = 1/${m + 1} regardless of its actual size`,
    );
  }
  return {
    W, nA, m, sortedA, prefixA, blockT, sortedBlockT,
    cal_fingerprint: fingerprint(geom, sortedBlockT),
  };
}

/** One live window: T under K6A.2's registered energy form, the tie-inclusive
 *  block-conformal p = (1 + #{T(B_j) >= T(live)})/(m+1), and e = kappa*p^(kappa-1).
 *
 *  Requires `window.length === cal.W` (150 on the registered path) and every value
 *  finite. A non-finite value THROWS — see the module docstring for why this module has
 *  no neutral-e pathway where shape-block-conformal-bet.ts has one. */
export function ecdfAccumulatorWindow(
  window: ReadonlyArray<number>,
  cal: EcdfAccumulatorCalibration,
  kappa: number = KAPPA_K6SLOW,
): EcdfAccumulatorWindowResult {
  assertKappaInUnitInterval('ecdfAccumulatorWindow', kappa);
  if (window.length !== cal.W) {
    throw new Error(
      `ecdfAccumulatorWindow: window.length must be ${cal.W}, got ${window.length} `
      + '(K6A.1.9: the live stream is consumed in DISJOINT W-blocks with no remainder)',
    );
  }
  for (let i = 0; i < window.length; i++) {
    if (!Number.isFinite(window[i])) {
      throw new Error(
        `ecdfAccumulatorWindow: non-finite value at window index ${i} (${window[i]}) — `
        + 'K6A.1.12 registers degenerate_windows and non_finite_wealth as STRUCTURAL zeros, '
        + 'so this throws rather than propagating a NaN into the wealth product',
      );
    }
  }
  const T = energyT(window, cal.sortedA, cal.prefixA);
  if (!Number.isFinite(T)) {
    throw new Error(`ecdfAccumulatorWindow: non-finite T (${T}) on a finite window — arithmetic defect`);
  }
  const p = (1 + countGte(cal.sortedBlockT, T)) / (cal.m + 1);
  const e = kappa * Math.pow(p, kappa - 1);
  return { T, p, e };
}

/** Wealth over DISJOINT live windows: the product of per-window e, accumulated in the log
 *  domain (ADR 0026 / detectors/_wealth.ts) with the registered floor. `log[i]` is the
 *  cumulative log-wealth through window i — the trajectory an any-time (Ville) crossing
 *  check needs at every prefix, which is what makes the registered endpoint
 *  "wealth >= 20 at any window checkpoint" (K6A.1.2) readable off one call.
 *
 *  Always the frozen kappa: the wealth path is the endpoint, and a per-call kappa here
 *  would let a caller report a differently-calibrated accumulator under this class's name.
 *  Each window is validated by `ecdfAccumulatorWindow` (its guards propagate). */
export function ecdfAccumulatorWealth(
  windows: ReadonlyArray<ReadonlyArray<number>>,
  cal: EcdfAccumulatorCalibration,
): EcdfAccumulatorWealthResult {
  let logM = 0; // log(1) — wealth starts at 1
  const log: number[] = [];
  let crossingIndex = -1;
  for (let i = 0; i < windows.length; i++) {
    const { e } = ecdfAccumulatorWindow(windows[i], cal);
    logM = advanceLogWealth(logM, Math.log(e), LOG_WEALTH_FLOOR_K6SLOW);
    log.push(logM);
    if (crossingIndex === -1 && logM >= LOG_WEALTH_THRESHOLD_K6SLOW) crossingIndex = i;
  }
  return { wealth: wealthView(logM), log, crossingIndex };
}

/** The reference-conditional null-growth screen — the design page's mandatory pre-run
 *  check and, per v2.K6A.1 K6A.1.10 (2), a registered STOP condition: if >= 1 of 250 fresh
 *  calibration draws at the frozen kappa has positive null growth, STOP, investigate, do
 *  not run. The estimator is the one K6A.1.5 registers, verbatim:
 *
 *      g_null(S) = log kappa + (1 - kappa) * E[-log p | null, S]
 *
 *  This function screens ONE calibration draw S; aggregating over the 250+ draws is the
 *  caller's (the harness's) job, as is the null generator — the seeds and the sampler are
 *  supplied, never defaulted, so a screen reading is reproducible from what it reports.
 *  Measured for reference at the frozen configuration (K6A.1.5, not re-derived here):
 *  0/280 draws positive, per-draw mean -6.754e-2, max -1.501e-2, 4.30 sd below zero;
 *  for contrast, the prior K6E geometry at kappa* = 0.9126 read 48/250 POSITIVE. */
export function nullGrowthScreen(
  cal: EcdfAccumulatorCalibration,
  opts: NullGrowthScreenOptions,
): NullGrowthScreenResult {
  const fn = 'nullGrowthScreen';
  const kappa = opts.kappa === undefined ? KAPPA_K6SLOW : opts.kappa;
  assertKappaInUnitInterval(fn, kappa);
  if (!Array.isArray(opts.seeds) || opts.seeds.length === 0) {
    throw new Error(`${fn}: needs at least one MC seed — there is no wall-clock or random default`);
  }
  for (let i = 0; i < opts.seeds.length; i++) {
    if (!Number.isFinite(opts.seeds[i])) {
      throw new Error(`${fn}: seeds[${i}] must be a finite number, got ${opts.seeds[i]}`);
    }
  }
  if (typeof opts.drawNullWindow !== 'function') {
    throw new Error(`${fn}: drawNullWindow must be a function (seed -> one length-${cal.W} null window)`);
  }
  let sumNegLogP = 0;
  for (const seed of opts.seeds) {
    const { p } = ecdfAccumulatorWindow(opts.drawNullWindow(seed), cal, kappa);
    sumNegLogP += -Math.log(p);
  }
  const meanNegLogP = sumNegLogP / opts.seeds.length;
  const gNull = Math.log(kappa) + (1 - kappa) * meanNegLogP;
  return { kappa, draws: opts.seeds.length, meanNegLogP, gNull, positive: gNull > 0 };
}
