// detectors/shape-block-conformal-bet.ts — K6: block-conformal shape bet.
//
// knowledge/methodology/coverage-gap-detectors.md § K6 (`shape_block_conformal_bet`).
// Closes the coverage matrix's K6 NO row: character change with healthy means —
// latency going bimodal, variance-regime shifts, tails thickening — matched mean
// and scale, different distribution. Two predecessors are refuted on the record:
// Family C's MMD (blind to shape by construction,
// knowledge/stats/family-c-blind-to-shape-2026-08-04) and
// detectors/shape-kurtosis-e-value.ts (DO NOT WIRE: fired on 82% of healthy
// clustersynth shards, knowledge/stats/shape-clustersynth-2026-08-05 — root cause
// C22, per-coordinate phi spanning two orders of magnitude inside one calibration
// window). This construction's answer to C22 is CONTIGUITY: reference blocks are
// disjoint contiguous slices of the held-out segment, so each block carries its
// own within-block serial dependence — the calibration and the live window are
// compared on statistics computed the same way over the same structure, and
// validity does not require knowing phi.
//
// Construction. Per metric: a held-out reference segment sliced into m disjoint
// CONTIGUOUS length-W blocks (m = floor(n/W); requires m >= M_MIN_K6 = 100).
// Per block, two registered shape features, RAW (not excess) fourth standardised
// moment and absolute third standardised moment, computed from the block's own
// sample mean (population moments, divided by n, not n-1):
//
//     m2 = mean((x-mean)^2), m3 = mean((x-mean)^3), m4 = mean((x-mean)^4)
//     kurtosis = m4 / m2^2                      (RAW convention: Gaussian = 3)
//     absSkew  = |m3| / m2^1.5
//
// Per disjoint live window (same length W): compute the same two features, then
// rank the DISTANCE |live_stat - median(ref_stats)| against the reference
// blocks' own |dev from median| distances — a two-sided-by-construction
// block-conformal p-value:
//
//     p = (1 + #{ref |dev| >= live |dev|}) / (m + 1)
//
// Exactly the K4 rank direction (point-tail-bet-e-value.ts: >=, not >, is the
// validity-bearing tie rule — ties have probability 0 on continuous draws but
// the count must include them for super-uniformity to hold at the boundary).
// Per-feature e-value through the same kappa*p^(kappa-1) calibrator as K3/K4:
//
//     e = kappa * p^(kappa-1)        kappa = KAPPA_K6 = 0.1 (registered, shared
//                                     derivation with K3/K4)
//
// Validity argument (the docstring the design page requires): under block
// exchangeability of the m reference blocks and the live window's own
// distance-to-median statistic (stationarity across the calibration+test span —
// the class's registered regime; contamination is explicitly out-of-claim), the
// rank p above is super-uniform, exactly the same argument as K4's conformal p
// over held-out scores, applied here to block-level statistics rather than
// point-level scores. `integral_0^1 kappa*p^(kappa-1) dp = 1` for any
// kappa in (0,1), so e is a valid e-value with E[e|H0] <= 1 per feature, per
// window. The rank is on a DISTANCE (|T - median_ref(T)|), so it is two-sided
// by construction: both directions of departure (platykurtic or leptokurtic;
// under- or over-skewed relative to the reference) count as evidence.
//
// Features combine by AVERAGING (arbitrary-dependence-safe, never max — see
// K3's module docstring for the same argument: an average of e-values with
// E[e]<=1 each still has E[eAvg]<=1, a max does not preserve validity).
// Windows combine by PRODUCT (disjoint => independent increments => a genuine
// test martingale), accumulated in the log domain per ADR 0026's house pattern
// (decisions/0026-log-domain-wealth.md; detectors/_wealth.ts): log-wealth is the
// single source of truth, the linear view saturates at Number.MAX_VALUE instead
// of overflowing to Infinity, and a degenerate (NaN) window's e-value holds the
// books rather than poisoning the run.
//
// Out of claim, by design (card scope, not measured here): contamination
// robustness (knowledge/stats/contamination-2026-08-04: the empirical reference
// inverts at eps >= 0.05) and any T3 real-data claim. The T2 clustersynth arm
// that would answer K6's YES/NO — the arm that killed the predecessor — is a
// separate registered run against this module, not part of this file.

import { advanceLogWealth, wealthView } from './_wealth';

/** Reference-block length (registered default; overridable per `calibrateShapeBlocks`). */
export const W_K6 = 30;

/** kappa for the e-value calibrator e = kappa*p^(kappa-1). Registered, shared
 *  derivation with K3/K4 (point-tail-bet-e-value.ts's KAPPA, spectral-bet-e-process.ts's KAPPA_K3). */
export const KAPPA_K6 = 0.1;

/** Minimum disjoint reference blocks. Below this the block-conformal rank's
 *  denominator (m+1) makes even the most extreme live window's p no smaller
 *  than 1/(m+1) — too coarse to be a meaningful rank; registered floor. */
export const M_MIN_K6 = 100;

/** Wealth floor, log domain — same value as spectral-bet-e-process.ts's
 *  LOG_WEALTH_FLOOR_K3 (1e-12); prevents underflow on long healthy runs. */
const LOG_WEALTH_FLOOR_K6 = Math.log(1e-12);

export type ShapeFeatureName = 'kurtosis' | 'absSkew';

/** Per-feature calibration: the reference blocks' own statistic median, plus
 *  the ascending |deviation from that median| distances the live rank counts
 *  against. */
export interface ShapeFeatureCalibration {
  median: number;
  sortedAbsDev: number[];
}

export interface ShapeCalibration {
  W: number;
  m: number;
  kurtosis: ShapeFeatureCalibration;
  absSkew: ShapeFeatureCalibration;
}

export interface ShapeFeatureResult {
  name: ShapeFeatureName;
  T: number;
  p: number;
  e: number;
}

export interface ShapeWindowResult {
  perFeature: ShapeFeatureResult[];
  eAvg: number;
}

export interface ShapeWealthResult {
  wealth: number;
  log: number[];
}

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = n >> 1;
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Binary search: count of values in `sorted` (ascending) that are >= x.
 *  Same tie direction as point-tail-bet-e-value.ts's countGte — validity-
 *  bearing, not incidental (see K4's tie-regression test). */
function countGte(sorted: number[], x: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < x) lo = mid + 1; else hi = mid;
  }
  return sorted.length - lo;
}

/** Raw (not excess) kurtosis and |skew| over a single block/window, from its
 *  own sample mean, population moments (divide by n). See module docstring
 *  for the convention choice and why it does not change conformal validity. */
function shapeMoments(x: ReadonlyArray<number>): { kurtosis: number; absSkew: number } {
  const n = x.length;
  let mean = 0;
  for (const v of x) mean += v;
  mean /= n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of x) {
    const d = v - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n; m3 /= n; m4 /= n;
  const kurtosis = m4 / (m2 * m2);
  const absSkew = Math.abs(m3) / Math.pow(m2, 1.5);
  return { kurtosis, absSkew };
}

function buildFeatureCalibration(stats: number[]): ShapeFeatureCalibration {
  const m = median([...stats].sort((a, b) => a - b));
  const sortedAbsDev = stats.map((s) => Math.abs(s - m)).sort((a, b) => a - b);
  return { median: m, sortedAbsDev };
}

/** Slices `rows` into m disjoint CONTIGUOUS length-W blocks (m = floor(rows.length/W);
 *  the remainder, if any, is dropped, not padded), computes per-block kurtosis and
 *  |skew|, and stores each feature's reference median plus its ascending
 *  |deviation from median| distances. Requires m >= M_MIN_K6. */
export function calibrateShapeBlocks(rows: number[], W: number = W_K6): ShapeCalibration {
  const m = Math.floor(rows.length / W);
  if (m < M_MIN_K6) {
    throw new Error(
      `calibrateShapeBlocks: requires >= ${M_MIN_K6} disjoint ${W}-blocks (M_MIN_K6), got ${m} from ${rows.length} rows`,
    );
  }
  const kurtoses = new Array<number>(m);
  const absSkews = new Array<number>(m);
  for (let i = 0; i < m; i++) {
    const block = rows.slice(i * W, (i + 1) * W);
    const { kurtosis, absSkew } = shapeMoments(block);
    kurtoses[i] = kurtosis;
    absSkews[i] = absSkew;
  }
  return {
    W,
    m,
    kurtosis: buildFeatureCalibration(kurtoses),
    absSkew: buildFeatureCalibration(absSkews),
  };
}

function featureResult(
  name: ShapeFeatureName,
  T: number,
  fc: ShapeFeatureCalibration,
  m: number,
  kappa: number,
): ShapeFeatureResult {
  const dev = Math.abs(T - fc.median);
  const count = countGte(fc.sortedAbsDev, dev);
  const p = (1 + count) / (m + 1);
  const e = kappa * Math.pow(p, kappa - 1);
  return { name, T, p, e };
}

/** Per-window block-conformal shape bet. Requires `window.length === cal.W`.
 *  Per feature: distance-rank p against the calibration's reference blocks,
 *  e through the kappa*p^(kappa-1) calibrator; eAvg is the mean of the two
 *  feature e-values (never max — see module docstring). */
export function shapeBetWindow(
  window: number[],
  cal: ShapeCalibration,
  kappa: number = KAPPA_K6,
): ShapeWindowResult {
  if (window.length !== cal.W) {
    throw new Error(`shapeBetWindow: window.length must be ${cal.W}, got ${window.length}`);
  }
  const { kurtosis, absSkew } = shapeMoments(window);
  const perFeature: ShapeFeatureResult[] = [
    featureResult('kurtosis', kurtosis, cal.kurtosis, cal.m, kappa),
    featureResult('absSkew', absSkew, cal.absSkew, cal.m, kappa),
  ];
  const eAvg = perFeature.reduce((s, f) => s + f.e, 0) / perFeature.length;
  return { perFeature, eAvg };
}

/** Wealth over disjoint windows: product of per-window eAvg, accumulated in the
 *  log domain (ADR 0026 convention — see module docstring). `log[i]` is the
 *  cumulative log-wealth through window i, the running trajectory an any-time
 *  (Ville-inequality) crossing check needs at every prefix. Each window is
 *  validated by `shapeBetWindow` (propagates its guards). */
export function shapeBetWealth(windows: number[][], cal: ShapeCalibration): ShapeWealthResult {
  let logM = 0; // log(1) — wealth starts at 1
  const log: number[] = [];
  for (const w of windows) {
    const { eAvg } = shapeBetWindow(w, cal);
    logM = advanceLogWealth(logM, Math.log(eAvg), LOG_WEALTH_FLOOR_K6);
    log.push(logM);
  }
  return { wealth: wealthView(logM), log };
}
