"use strict";
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
// of overflowing to Infinity.
//
// Two explicit degeneracy pathways (review round 2; see `assertNonDegenerate`
// and `featureResult` for the implementations — this paragraph describes the
// implemented behaviour, not an aspiration):
//   - CALIBRATION-side: a reference segment that yields a non-finite median/
//     deviation (a constant block, m2=0) or zero spread across all m blocks
//     (every block ties the same statistic) makes the rank meaningless —
//     `calibrateShapeBlocks` THROWS rather than silently shipping a
//     calibration that scores every live window identically.
//   - LIVE-side: a single degenerate live window (non-finite T) contributes
//     e=1 for that feature — neutral, holds the books — rather than being
//     ranked. If both features degenerate, eAvg=1, log-increment 0, and the
//     window leaves the wealth product unchanged, matching K3's registered
//     NaN pathway (spectral-bet-e-process.ts / ADR 0026).
//
// Out of claim, by design (card scope, not measured here): contamination
// robustness (knowledge/stats/contamination-2026-08-04: the empirical reference
// inverts at eps >= 0.05) and any T3 real-data claim. The T2 clustersynth arm
// that would answer K6's YES/NO — the arm that killed the predecessor — is a
// separate registered run against this module, not part of this file.
Object.defineProperty(exports, "__esModule", { value: true });
exports.M_MIN_K6 = exports.KAPPA_K6 = exports.W_K6 = void 0;
exports.calibrateShapeBlocks = calibrateShapeBlocks;
exports.shapeBetWindow = shapeBetWindow;
exports.shapeBetWealth = shapeBetWealth;
const _wealth_1 = require("./_wealth");
/** Reference-block length (registered default; overridable per `calibrateShapeBlocks`). */
exports.W_K6 = 30;
/** kappa for the e-value calibrator e = kappa*p^(kappa-1). Registered, shared
 *  derivation with K3/K4 (point-tail-bet-e-value.ts's KAPPA, spectral-bet-e-process.ts's KAPPA_K3). */
exports.KAPPA_K6 = 0.1;
/** Minimum disjoint reference blocks. Below this the block-conformal rank's
 *  denominator (m+1) makes even the most extreme live window's p no smaller
 *  than 1/(m+1) — too coarse to be a meaningful rank; registered floor. */
exports.M_MIN_K6 = 100;
/** Wealth floor, log domain — same value as spectral-bet-e-process.ts's
 *  LOG_WEALTH_FLOOR_K3 (1e-12); prevents underflow on long healthy runs. */
const LOG_WEALTH_FLOOR_K6 = Math.log(1e-12);
function median(sorted) {
    const n = sorted.length;
    const mid = n >> 1;
    return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
/** Binary search: count of values in `sorted` (ascending) that are >= x.
 *  Same tie direction as point-tail-bet-e-value.ts's countGte — validity-
 *  bearing, not incidental (see K4's tie-regression test). */
function countGte(sorted, x) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid] < x)
            lo = mid + 1;
        else
            hi = mid;
    }
    return sorted.length - lo;
}
/** Raw (not excess) kurtosis and |skew| over a single block/window, from its
 *  own sample mean, population moments (divide by n). See module docstring
 *  for the convention choice and why it does not change conformal validity. */
function shapeMoments(x) {
    const n = x.length;
    let mean = 0;
    for (const v of x)
        mean += v;
    mean /= n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const v of x) {
        const d = v - mean;
        const d2 = d * d;
        m2 += d2;
        m3 += d2 * d;
        m4 += d2 * d2;
    }
    m2 /= n;
    m3 /= n;
    m4 /= n;
    const kurtosis = m4 / (m2 * m2);
    const absSkew = Math.abs(m3) / Math.pow(m2, 1.5);
    return { kurtosis, absSkew };
}
function buildFeatureCalibration(stats) {
    const m = median([...stats].sort((a, b) => a - b));
    const sortedAbsDev = stats.map((s) => Math.abs(s - m)).sort((a, b) => a - b);
    return { median: m, sortedAbsDev };
}
/** Guard (review round 2, Important 3): a degenerate reference must throw at
 *  calibration time, not silently mis-score every live window. Two ways a
 *  feature's calibration can be degenerate, both caught by one predicate:
 *
 *  (a) NON-FINITE — a constant held-out block has m2=0, so kurtosis and
 *      |skew| are 0/0 = NaN for that block (possibly all blocks, if the
 *      whole segment is constant). Pre-guard this was silent: `countGte`'s
 *      binary search on a NaN query never takes its "go left" branch (every
 *      `sorted[mid] < NaN` comparison is false), so it converges to
 *      "0 excluded, all m counted" -- a REAL p=1 for every live window
 *      forever, not a NaN that would at least be visibly wrong.
 *  (b) ZERO SPREAD — every reference block computes to the SAME finite
 *      statistic (e.g. a deterministically repeating two-level pattern),
 *      so every |deviation from median| is identically 0. Pre-guard this
 *      was also silent: `countGte(allZeros, anyNonzeroDev)` = 0 (no
 *      reference entry ties or beats a nonzero deviation), so ANY nonzero
 *      live perturbation -- even a 0.1% one -- scores the single smallest
 *      possible p = 1/(m+1), the maximum possible e, regardless of how
 *      small the perturbation actually was.
 *
 *  Predicate: throw unless the feature's median is finite, every entry of
 *  its sortedAbsDev is finite, AND the array has nonzero spread (its last
 *  entry, the maximum, is strictly greater than its first, the minimum --
 *  sortedAbsDev is ascending by construction). */
function assertNonDegenerate(name, fc) {
    const allFinite = Number.isFinite(fc.median) && fc.sortedAbsDev.every((d) => Number.isFinite(d));
    if (!allFinite) {
        throw new Error(`calibrateShapeBlocks: degenerate ${name} reference (non-finite median or deviation -- ` +
            'a constant or otherwise degenerate held-out block, m2=0 makes kurtosis/skew 0/0)');
    }
    const spread = fc.sortedAbsDev[fc.sortedAbsDev.length - 1] - fc.sortedAbsDev[0];
    if (!(spread > 0)) {
        throw new Error(`calibrateShapeBlocks: degenerate ${name} reference (zero spread across ${fc.sortedAbsDev.length} ` +
            'reference blocks -- every |deviation| collapses to a single value, so any nonzero live ' +
            'perturbation would score the extreme p regardless of its actual size)');
    }
}
/** Slices `rows` into m disjoint CONTIGUOUS length-W blocks (m = floor(rows.length/W);
 *  the remainder, if any, is dropped, not padded), computes per-block kurtosis and
 *  |skew|, and stores each feature's reference median plus its ascending
 *  |deviation from median| distances. Requires m >= M_MIN_K6 and a positive
 *  integer W (Minor 3). Throws on a degenerate reference for either feature
 *  (see `assertNonDegenerate`). */
function calibrateShapeBlocks(rows, W = exports.W_K6) {
    if (!(Number.isInteger(W) && W > 0)) {
        throw new Error(`calibrateShapeBlocks: W must be a positive integer, got ${W}`);
    }
    const m = Math.floor(rows.length / W);
    if (m < exports.M_MIN_K6) {
        throw new Error(`calibrateShapeBlocks: requires >= ${exports.M_MIN_K6} disjoint ${W}-blocks (M_MIN_K6), got ${m} from ${rows.length} rows`);
    }
    const kurtoses = new Array(m);
    const absSkews = new Array(m);
    for (let i = 0; i < m; i++) {
        const block = rows.slice(i * W, (i + 1) * W);
        const { kurtosis, absSkew } = shapeMoments(block);
        kurtoses[i] = kurtosis;
        absSkews[i] = absSkew;
    }
    const kurtosisCal = buildFeatureCalibration(kurtoses);
    const absSkewCal = buildFeatureCalibration(absSkews);
    assertNonDegenerate('kurtosis', kurtosisCal);
    assertNonDegenerate('absSkew', absSkewCal);
    return { W, m, kurtosis: kurtosisCal, absSkew: absSkewCal };
}
function featureResult(name, T, fc, m, kappa) {
    if (!Number.isFinite(T)) {
        // A degenerate live window (e.g. a constant block: m2=0, so kurtosis and
        // |skew| are 0/0 = NaN) carries no rank-conformal evidence. This must be
        // an explicit e=1 (neutral, holds the books), NOT a fall-through to the
        // dev/countGte path below: `Math.abs(NaN - fc.median)` is NaN, and
        // `countGte`'s binary search on a NaN query never takes its "go left"
        // branch (every `sorted[mid] < NaN` is false), so it silently converges
        // to "0 excluded, all m counted" -- a REAL, WRONG p=1 (e=kappa), not a
        // guarded neutral read. e=1 matches K3's registered NaN pathway
        // (spectral-bet-e-process.ts / ADR 0026 / test/spectral-bet-e-process.test.ts):
        // a degenerate window contributes no evidence rather than being silently
        // mis-scored or poisoning the wealth product with a NaN.
        return { name, T, p: NaN, e: 1 };
    }
    const dev = Math.abs(T - fc.median);
    const count = countGte(fc.sortedAbsDev, dev);
    const p = (1 + count) / (m + 1);
    const e = kappa * Math.pow(p, kappa - 1);
    return { name, T, p, e };
}
/** Amendment v2.C1 (C1.9): the calibrator `e = kappa*p^(kappa-1)` is an e-value because
 *  `integral_0^1 kappa*p^(kappa-1) dp = 1` -- the identity this module's own docstring already
 *  states holds "for any kappa in (0,1)". That requirement was prose only: kappa was a defaulted
 *  parameter nothing validated, so kappa <= 0 (divergent), kappa = 1 (e identically 1, no bet) or
 *  kappa > 1 (bet inverted, large p pays) returned a number that is not an e-value. */
function assertKappaInUnitInterval(fn, kappa) {
    if (!Number.isFinite(kappa) || !(kappa > 0) || !(kappa < 1)) {
        throw new Error(`${fn}: kappa must be a finite number in the open interval (0,1), got ${kappa}`);
    }
}
/** Per-window block-conformal shape bet. Requires `window.length === cal.W`.
 *  Per feature: distance-rank p against the calibration's reference blocks,
 *  e through the kappa*p^(kappa-1) calibrator; eAvg is the mean of the two
 *  feature e-values (never max — see module docstring). */
function shapeBetWindow(window, cal, kappa = exports.KAPPA_K6) {
    assertKappaInUnitInterval('shapeBetWindow', kappa);
    if (window.length !== cal.W) {
        throw new Error(`shapeBetWindow: window.length must be ${cal.W}, got ${window.length}`);
    }
    const { kurtosis, absSkew } = shapeMoments(window);
    const perFeature = [
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
function shapeBetWealth(windows, cal) {
    let logM = 0; // log(1) — wealth starts at 1
    const log = [];
    for (const w of windows) {
        const { eAvg } = shapeBetWindow(w, cal);
        logM = (0, _wealth_1.advanceLogWealth)(logM, Math.log(eAvg), LOG_WEALTH_FLOOR_K6);
        log.push(logM);
    }
    return { wealth: (0, _wealth_1.wealthView)(logM), log };
}
//# sourceMappingURL=shape-block-conformal-bet.js.map