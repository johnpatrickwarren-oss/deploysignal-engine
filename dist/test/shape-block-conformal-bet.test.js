"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/shape-block-conformal-bet.test.ts — engine test pattern (node:test),
// following spectral-bet-e-process.test.ts (K3) and point-tail-bet-e-value.test.ts (K4).
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const shape_block_conformal_bet_1 = require("../detectors/shape-block-conformal-bet");
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
/** AR(1), stationary marginal variance 1: x_t = phi*x_{t-1} + sqrt(1-phi^2)*eps_t.
 *  Burn-in discarded so the returned series is (post-transient) stationary — block
 *  statistics computed near t=0 would otherwise carry the fixed x_0=0 startup. */
function ar1(n, phi, r, burnIn = 200) {
    let prev = 0;
    const innovSigma = Math.sqrt(1 - phi * phi);
    for (let i = 0; i < burnIn; i++)
        prev = phi * prev + innovSigma * gauss(r);
    const out = [];
    for (let i = 0; i < n; i++) {
        prev = phi * prev + innovSigma * gauss(r);
        out.push(prev);
    }
    return out;
}
// ── Deterministic 6-point block kinds, hand-computed (no RNG) ────────────────
// Y = [1,2,3,4,5,6]:            mean 3.5, symmetric ⇒ skew=0 exactly;
//                                kurtosis = 2121/1225 (m2=35/12, m4=707/48).
// X = [8,9,9,10,11,13]:         mean 10, d=[-2,-1,-1,0,1,3];
//                                kurtosis = 75/32 = 2.34375; |skew| = 9*sqrt(6)/32.
// Z = [0,0,0,0,0,5]:            mean 5/6, 5 zeros + 1 spike;
//                                kurtosis = 21/5 = 4.2; |skew| = 4*sqrt(5)/5.
// Wlive = [-5,-1,-1,1,1,5]:     mean 0, symmetric ⇒ skew=0 exactly;
//                                kurtosis = 209/81 (m2=9, m4=209).
// All four verified by independent arithmetic in the comments above and cross-
// checked numerically before being committed (not transcribed from the module's
// own output).
const Y = [1, 2, 3, 4, 5, 6];
const X = [8, 9, 9, 10, 11, 13];
const Z = [0, 0, 0, 0, 0, 5];
const W_LIVE = [-5, -1, -1, 1, 1, 5];
/** Deterministic, non-degenerate calibration: 60 Y-blocks + 30 X-blocks +
 *  10 Z-blocks, m=100=M_MIN_K6 exactly, W=6. Because Y is the 60-block
 *  majority, it alone occupies the median-straddling indices 49/50 (0-
 *  indexed) for BOTH features, so both reference medians equal Y's own
 *  statistic exactly (kurtosis 2121/1225, skew 0) — no averaging needed,
 *  every downstream value stays an exact rational (or a closed radical). */
function buildDeterministicCalibration() {
    const rows = [];
    for (let i = 0; i < 60; i++)
        rows.push(...Y);
    for (let i = 0; i < 30; i++)
        rows.push(...X);
    for (let i = 0; i < 10; i++)
        rows.push(...Z);
    return (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, 6);
}
(0, node_test_1.test)('registered constants', () => {
    strict_1.default.equal(shape_block_conformal_bet_1.W_K6, 30);
    strict_1.default.equal(shape_block_conformal_bet_1.KAPPA_K6, 0.1);
    strict_1.default.equal(shape_block_conformal_bet_1.M_MIN_K6, 100);
});
// Hand-computed 6-point oracle, transcribed algebra (not the module's own output):
// X = [8, 9, 9, 10, 11, 13], mean = 10, deviations d = [-2,-1,-1,0,1,3] (sum 0).
// m2 = (4+1+1+0+1+9)/6 = 16/6 = 8/3
// m3 = (-8-1-1+0+1+27)/6 = 18/6 = 3
// m4 = (16+1+1+0+1+81)/6 = 100/6 = 50/3
// kurtosis (RAW, not excess) = m4/m2^2 = (50/3)/(64/9) = 75/32 = 2.34375
// |skew| = |m3|/m2^1.5 = 3/(8/3)^1.5 = 27/(16*sqrt(6)) = 9*sqrt(6)/32 (rationalised)
//
// Reference median (both features): Y = [1,2,3,4,5,6] is the 60-block majority
// of buildDeterministicCalibration(), so it alone straddles indices 49/50 and
// the medians are exactly Y's own kurtosis (2121/1225) and skew (0) — no
// averaging with any other block's value.
//
// Rank: X's own |dev| from the Y-median ties every one of the other 30 X-blocks
// (X is itself 30/100 of the calibration) exactly, and the 10 Z-blocks are
// further out on BOTH features (kurtosis 4.2 and |skew| 4*sqrt(5)/5 are each
// further from the Y-median than X's own values), so those 10 also count (>=,
// the tie-inclusive direction). count = 30 (tied X's) + 10 (further Z's) = 40.
// p = (1+40)/101 = 41/101 for BOTH features (X sits at the same relative rank
// on both features in this construction — this test pins the moment formula
// and the p/e formula; the max-vs-mean distinguishing job is a separate test
// below, using a different live window that breaks this rank-symmetry).
(0, node_test_1.test)('moment formulas: hand-computed 6-point array oracle, ranked against a deterministic non-degenerate calibration', () => {
    const cal = buildDeterministicCalibration();
    strict_1.default.equal(cal.m, 100);
    strict_1.default.equal(cal.W, 6);
    strict_1.default.ok(Math.abs(cal.kurtosis.median - 2121 / 1225) < 1e-12, `kurtosis median ${cal.kurtosis.median}`);
    strict_1.default.equal(cal.absSkew.median, 0, 'Y is symmetric: skew median is exactly 0');
    const { perFeature, eAvg } = (0, shape_block_conformal_bet_1.shapeBetWindow)(X, cal);
    const kurt = perFeature.find((f) => f.name === 'kurtosis');
    const skew = perFeature.find((f) => f.name === 'absSkew');
    const expectedKurtosis = 75 / 32;
    const expectedAbsSkew = (9 * Math.sqrt(6)) / 32;
    strict_1.default.ok(Math.abs(kurt.T - expectedKurtosis) < 1e-12, `T kurtosis ${kurt.T}`);
    strict_1.default.ok(Math.abs(skew.T - expectedAbsSkew) < 1e-12, `T absSkew ${skew.T}`);
    const expectedP = 41 / 101;
    strict_1.default.ok(Math.abs(kurt.p - expectedP) < 1e-12, `p kurtosis ${kurt.p}`);
    strict_1.default.ok(Math.abs(skew.p - expectedP) < 1e-12, `p absSkew ${skew.p}`);
    const expectedE = shape_block_conformal_bet_1.KAPPA_K6 * Math.pow(expectedP, shape_block_conformal_bet_1.KAPPA_K6 - 1); // ~= 0.22510428666
    strict_1.default.ok(Math.abs(kurt.e - expectedE) < 1e-9, `e kurtosis ${kurt.e}`);
    strict_1.default.ok(Math.abs(skew.e - expectedE) < 1e-9, `e absSkew ${skew.e}`);
    strict_1.default.ok(Math.abs(eAvg - expectedE) < 1e-9, `eAvg ${eAvg}`);
});
// Important 5 (review round 2): the max-vs-average mutation escaped every
// prior test because every prior deterministic fixture happened to give the
// two features equal p (X sits at the same relative rank on both). W_LIVE =
// [-5,-1,-1,1,1,5] breaks that: it is symmetric (skew=0 exactly, matching the
// reference median exactly ⇒ p_skew=1 exactly, e_skew=kappa exactly) but its
// kurtosis (209/81 ~= 2.5802) sits BETWEEN X's reference deviation (0.61232,
// from median 2121/1225) and Z's (2.46857) ⇒ only the 10 Z-blocks are >= its
// own deviation (0.84882) ⇒ count=10 ⇒ p_kurtosis = 11/101, a materially
// different, much smaller p, hence a much larger e.
(0, node_test_1.test)('features combine by averaging, never max (mutation-bound fixture, unequal per-feature e)', () => {
    const cal = buildDeterministicCalibration();
    const { perFeature, eAvg } = (0, shape_block_conformal_bet_1.shapeBetWindow)(W_LIVE, cal);
    const kurt = perFeature.find((f) => f.name === 'kurtosis');
    const skew = perFeature.find((f) => f.name === 'absSkew');
    strict_1.default.ok(Math.abs(kurt.T - 209 / 81) < 1e-12, `T kurtosis ${kurt.T}`);
    strict_1.default.equal(skew.T, 0, 'W_LIVE is symmetric: skew is exactly 0');
    const expectedPKurt = 11 / 101;
    const expectedPSkew = 1;
    strict_1.default.ok(Math.abs(kurt.p - expectedPKurt) < 1e-12, `p kurtosis ${kurt.p}`);
    strict_1.default.equal(skew.p, expectedPSkew);
    const expectedEKurt = shape_block_conformal_bet_1.KAPPA_K6 * Math.pow(expectedPKurt, shape_block_conformal_bet_1.KAPPA_K6 - 1); // ~= 0.7355900054
    const expectedESkew = shape_block_conformal_bet_1.KAPPA_K6; // p=1 => e = kappa * 1^(kappa-1) = kappa exactly
    strict_1.default.ok(Math.abs(kurt.e - expectedEKurt) < 1e-9, `e kurtosis ${kurt.e}`);
    strict_1.default.equal(skew.e, expectedESkew);
    strict_1.default.notEqual(kurt.e, skew.e, 'fixture requires unequal per-feature e to distinguish mean from max');
    const expectedAvg = (kurt.e + skew.e) / 2;
    strict_1.default.equal(eAvg, expectedAvg, 'eAvg is the mean, not the max — mutation eAvg->max fails this');
    strict_1.default.ok(eAvg < Math.max(kurt.e, skew.e), 'never-max: eAvg is strictly below the larger feature e');
});
(0, node_test_1.test)('calibrateShapeBlocks throws if fewer than M_MIN_K6 disjoint blocks', () => {
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(new Array(99 * shape_block_conformal_bet_1.W_K6).fill(1)), /M_MIN_K6|100|disjoint/);
    // exactly at the floor must NOT throw
    const r = lcg(1);
    strict_1.default.doesNotThrow(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r))));
});
// Important 3 (review round 2): a degenerate held-out reference must throw at
// calibration time, not silently mis-score every live window. Two required
// fixtures:
(0, node_test_1.test)('calibrateShapeBlocks throws on a constant held-out segment (m2=0 => kurtosis/skew are 0/0 = NaN)', () => {
    // Every block is a constant run: mean = 7 exactly, every deviation 0, so
    // m2 = m3 = m4 = 0 and kurtosis = absSkew = 0/0 = NaN for every one of the
    // 100 blocks. Pre-fix this propagated silently: NaN medians made every
    // live window's countGte(sortedAbsDev, NaN) binary-search converge to "0
    // (all entries counted)" (NaN comparisons are always false, so the search
    // never takes the low branch) => p=1 for every window, no matter how
    // different the live data was. That is a silent false-negative machine,
    // not a guarded read, and must throw instead.
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(new Array(100 * shape_block_conformal_bet_1.W_K6).fill(7)), /degenerate|non-finite/);
});
(0, node_test_1.test)('calibrateShapeBlocks throws when every reference |deviation| collapses to a single value (two-level quantized reference)', () => {
    // A deterministic, repeating two-level block (15 zeros then 15 ones) in
    // EVERY one of the 100 blocks: every block is bit-for-bit identical, so
    // every block's kurtosis and skew are identical (finite, not NaN) and the
    // reference median equals every block's own statistic exactly => zero
    // spread in sortedAbsDev (all zero). Pre-fix this also propagated
    // silently: with the reference deviation distribution collapsed to a
    // single point (0), ANY nonzero live perturbation has countGte(...)=0
    // (every reference entry is 0, not >= a nonzero deviation) => p=1/(m+1),
    // the single smallest possible p => the maximum possible e, regardless of
    // how small the perturbation actually is. A degenerate (zero-variance)
    // calibration cannot support a meaningful rank and must throw.
    const block = [...new Array(15).fill(0), ...new Array(15).fill(1)];
    const rows = [];
    for (let i = 0; i < 100; i++)
        rows.push(...block);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, 30), /degenerate|spread/);
});
(0, node_test_1.test)('calibrateShapeBlocks throws on a non-positive-integer W (Minor 3)', () => {
    const r = lcg(3);
    const rows = Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r));
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, 0), /W/);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, -5), /W/);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, 2.5), /W/);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, NaN), /W/);
});
(0, node_test_1.test)('shapeBetWindow throws on a window length that does not match the calibration block length', () => {
    const r = lcg(2);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r)));
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(new Array(shape_block_conformal_bet_1.W_K6 - 1).fill(0), cal), /window\.length/);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(new Array(shape_block_conformal_bet_1.W_K6 + 1).fill(0), cal), /window\.length/);
});
// Important 4 (review round 2): a non-finite live T (a degenerate live window,
// e.g. constant => m2=0 => kurtosis/skew = 0/0 = NaN) must contribute e=1
// (neutral — holds the books) rather than the pre-fix behaviour, which was a
// REAL, WRONG p=1 read (the same NaN-binary-search-converges-to-0 mechanism
// as the calibration-side bug above, on the live side instead): e=1 for both
// features => eAvg=1 => log(1)=0 => wealth held at 1 for that window, matching
// K3's registered NaN pathway (test/spectral-bet-e-process.test.ts:118-123 /
// ADR 0026) — a degenerate window carries no evidence, it does not silently
// mis-score as "exactly at the reference median."
(0, node_test_1.test)('a non-finite live T contributes e=1 (holds the books, log 0) — NaN pathway', () => {
    const r = lcg(4);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r)));
    const constantWindow = new Array(shape_block_conformal_bet_1.W_K6).fill(9);
    const { perFeature, eAvg } = (0, shape_block_conformal_bet_1.shapeBetWindow)(constantWindow, cal);
    for (const f of perFeature) {
        strict_1.default.ok(Number.isNaN(f.T), `${f.name}: T should be NaN for a constant window, got ${f.T}`);
        strict_1.default.equal(f.e, 1, `${f.name}: e should hold at 1 for a non-finite T`);
    }
    strict_1.default.equal(eAvg, 1, 'eAvg should hold at 1 when every feature holds at 1');
    const { wealth, log } = (0, shape_block_conformal_bet_1.shapeBetWealth)([constantWindow], cal);
    strict_1.default.equal(log[0], 0, 'log-wealth holds at 0 (wealth 1) for a degenerate window');
    strict_1.default.equal(wealth, 1, 'the linear view stays at 1, not NaN');
});
(0, node_test_1.test)('healthy (iid Gaussian) wealth crossing rate <= alpha at N=2000 trajectories of 6 windows', () => {
    const r = lcg(20260809);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 200 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r)));
    const alpha = 0.05;
    const threshold = 1 / alpha;
    const logThreshold = Math.log(threshold);
    const N = 2000;
    let crossings = 0;
    for (let i = 0; i < N; i++) {
        const windows = [];
        for (let w = 0; w < 6; w++)
            windows.push(Array.from({ length: shape_block_conformal_bet_1.W_K6 }, () => gauss(r)));
        const { log } = (0, shape_block_conformal_bet_1.shapeBetWealth)(windows, cal);
        if (log.some((l) => l >= logThreshold))
            crossings++;
    }
    const rate = crossings / N;
    const tol = 3 * Math.sqrt((alpha * (1 - alpha)) / N);
    strict_1.default.ok(rate < alpha + tol, `crossing rate ${rate}, tolerance ${alpha + tol}`);
});
// The contiguity property under test: reference blocks are disjoint CONTIGUOUS
// slices of a held-out AR(1) phi=0.6 stream, so each block carries the same
// serial dependence the live windows carry — validity should hold without the
// detector ever being told phi. Both calibration and live are drawn from the
// SAME AR(1) generative process (same phi), independent realisations.
(0, node_test_1.test)('healthy (AR(1) phi=0.6) wealth crossing rate <= alpha, calibration from the SAME AR(1) process', () => {
    const rCal = lcg(20260809 + 1);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(ar1(200 * shape_block_conformal_bet_1.W_K6, 0.6, rCal), shape_block_conformal_bet_1.W_K6);
    const rLive = lcg(20260809 + 2);
    const alpha = 0.05;
    const threshold = 1 / alpha;
    const logThreshold = Math.log(threshold);
    const N = 2000;
    // One continuous AR(1) stream for all live windows (a single ongoing
    // stationary process), chopped into N disjoint trajectories of 6 disjoint
    // W-windows each.
    const liveStream = ar1(N * 6 * shape_block_conformal_bet_1.W_K6, 0.6, rLive);
    let crossings = 0;
    for (let i = 0; i < N; i++) {
        const windows = [];
        for (let w = 0; w < 6; w++) {
            const start = (i * 6 + w) * shape_block_conformal_bet_1.W_K6;
            windows.push(liveStream.slice(start, start + shape_block_conformal_bet_1.W_K6));
        }
        const { log } = (0, shape_block_conformal_bet_1.shapeBetWealth)(windows, cal);
        if (log.some((l) => l >= logThreshold))
            crossings++;
    }
    const rate = crossings / N;
    const tol = 3 * Math.sqrt((alpha * (1 - alpha)) / N);
    strict_1.default.ok(rate < alpha + tol, `crossing rate ${rate}, tolerance ${alpha + tol}`);
});
// Important 6 (review round 2): the 6-window PRODUCT crossing check above has
// essentially no power to catch a marginal miscalibration (crossing 1/alpha=20
// requires compounding, which a small per-window p-level drift will not
// reliably produce at N=2000). This instrument is the direct, high-power
// check the review asked for: the MARGINAL per-window, per-feature exceedance
// rate P(p <= alpha) against the EXACT discrete-conformal nominal at m=200,
// floor(alpha*(m+1))/(m+1) = floor(0.05*201)/201 = 10/201 ~= 0.04975 (the
// registered calibration size used throughout this file's healthy tests).
// Matched phi (0.6/0.6): validity is expected to hold at this finer grain,
// not just survive the coarse 6-window product.
//
// POOLED across K independent calibration replicates, not one fixed
// calibration. A first draft measured exceedance against a SINGLE m=200
// calibration and found it swings 0.03-0.07 across seeds even at matched
// phi=0.6/0.6 -- a real effect, not a bug: the calibration's own m=200 draw
// is itself a finite noisy sample, so for any ONE fixed calibration, the
// conditional exceedance rate deviates from the population nominal by an
// amount whose scale is set by 1/sqrt(m), which is LARGER than the N=20,000
// live-draw binomial tolerance a naive single-calibration test would use
// (this is the standard conformal-prediction marginal-vs-conditional-
// coverage distinction, not specific to this construction). Averaging the
// per-replicate exceedance rate over K independent (calibration, live)
// pairs targets the marginal rate the construction actually claims, and the
// tolerance below is the SAMPLE standard error across the K replicate
// rates (data-driven, not a theoretical binomial guess that would be
// mis-specified for this design).
(0, node_test_1.test)('AR(1) phi=0.6 matched-phi per-window exceedance: pooled P(p<=alpha) within tolerance of the exact conformal nominal', () => {
    const M = 200;
    const alpha = 0.05;
    const nominal = Math.floor(alpha * (M + 1)) / (M + 1); // 10/201 ~= 0.049751
    strict_1.default.ok(Math.abs(nominal - 10 / 201) < 1e-12);
    const K = 30; // independent calibration replicates
    const N_LIVE = 2000; // live draws per replicate
    const kurtRates = [];
    const skewRates = [];
    for (let k = 0; k < K; k++) {
        const rCal = lcg(20260810 + k * 2 + 1);
        const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(ar1(M * shape_block_conformal_bet_1.W_K6, 0.6, rCal), shape_block_conformal_bet_1.W_K6);
        const rLive = lcg(20260810 + k * 2 + 2);
        const liveStream = ar1(N_LIVE * shape_block_conformal_bet_1.W_K6, 0.6, rLive);
        let exceedKurt = 0;
        let exceedSkew = 0;
        for (let i = 0; i < N_LIVE; i++) {
            const win = liveStream.slice(i * shape_block_conformal_bet_1.W_K6, (i + 1) * shape_block_conformal_bet_1.W_K6);
            const { perFeature } = (0, shape_block_conformal_bet_1.shapeBetWindow)(win, cal);
            const kurt = perFeature.find((f) => f.name === 'kurtosis');
            const skew = perFeature.find((f) => f.name === 'absSkew');
            if (kurt.p <= alpha)
                exceedKurt++;
            if (skew.p <= alpha)
                exceedSkew++;
        }
        kurtRates.push(exceedKurt / N_LIVE);
        skewRates.push(exceedSkew / N_LIVE);
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const stderr = (a) => {
        const m = mean(a);
        const variance = a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
        return Math.sqrt(variance / a.length);
    };
    const kurtMean = mean(kurtRates);
    const skewMean = mean(skewRates);
    const kurtTol = 3 * stderr(kurtRates);
    const skewTol = 3 * stderr(skewRates);
    strict_1.default.ok(Math.abs(kurtMean - nominal) < kurtTol, `kurtosis pooled exceedance ${kurtMean}, nominal ${nominal}, tol ${kurtTol}`);
    strict_1.default.ok(Math.abs(skewMean - nominal) < skewTol, `absSkew pooled exceedance ${skewMean}, nominal ${nominal}, tol ${skewTol}`);
});
// Review-fixture precedent (K3's tie-direction regression, K4's rank-count regression):
// the conformal rank must count ties (>=), matching the module docstring and the
// coverage-gap page's "p = (1 + #{ref |dev| >= live |dev|}) / (m+1)".
(0, node_test_1.test)('conformal rank count is >=, not > (tie regression, iid fixture)', () => {
    const r = lcg(20260809 + 5);
    const rows = Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r));
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows);
    // Re-score the window that produced the calibration's own median kurtosis block
    // exactly: its |dev| is 0, which ties every zero-|dev| reference block, not just
    // beats them. p must be (1 + count-of->=0) / (m+1), i.e. (1+m)/(m+1) when every
    // reference dev is >= 0 (always true: |dev| >= 0 for all reference blocks).
    const probe = rows.slice(0, shape_block_conformal_bet_1.W_K6);
    const { perFeature } = (0, shape_block_conformal_bet_1.shapeBetWindow)(probe, cal);
    for (const f of perFeature) {
        const expectedCount = f.name === 'kurtosis'
            ? cal.kurtosis.sortedAbsDev.filter((d) => d >= Math.abs(f.T - cal.kurtosis.median)).length
            : cal.absSkew.sortedAbsDev.filter((d) => d >= Math.abs(f.T - cal.absSkew.median)).length;
        const expectedP = (1 + expectedCount) / (cal.m + 1);
        strict_1.default.equal(f.p, expectedP, `${f.name}: p ${f.p} vs expected ${expectedP}`);
    }
});
// coverage PREREGISTRATION.md Amendment v2.C1 C1.9 — kappa domain guard, the same argument as
// K3's and K4's (this module's docstring already states the requirement in prose: "for any
// kappa in (0,1)"), now machine-encoded rather than left to the caller's discipline.
(0, node_test_1.test)('C1.9: kappa outside (0,1) throws', () => {
    const r = lcg(20260808);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 10000 }, () => gauss(r)));
    const w = Array.from({ length: shape_block_conformal_bet_1.W_K6 }, () => gauss(r));
    for (const bad of [0, 1, -0.1, 1.5, NaN, Infinity]) {
        strict_1.default.throws(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(w, cal, bad), /kappa/, `kappa=${bad} must be refused`);
    }
    strict_1.default.doesNotThrow(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(w, cal, shape_block_conformal_bet_1.KAPPA_K6));
    strict_1.default.doesNotThrow(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(w, cal, 0.5));
});
//# sourceMappingURL=shape-block-conformal-bet.test.js.map