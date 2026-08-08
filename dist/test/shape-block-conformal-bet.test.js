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
/** Moment-matched two-point Gaussian mixture (mean 0, variance 1), exactly the
 *  registered K6 fault generator (validation/coverage/lib/inject.mjs injectShapeMix):
 *  component means +/-d/2, component sd s = sqrt(1 - d^2/4). */
function bimodalMix(n, d, r) {
    const s = Math.sqrt(Math.max(0, 1 - (d * d) / 4));
    const out = [];
    for (let i = 0; i < n; i++) {
        const b = r() < 0.5;
        out.push((b ? d / 2 : -d / 2) + s * gauss(r));
    }
    return out;
}
(0, node_test_1.test)('registered constants', () => {
    strict_1.default.equal(shape_block_conformal_bet_1.W_K6, 30);
    strict_1.default.equal(shape_block_conformal_bet_1.KAPPA_K6, 0.1);
    strict_1.default.equal(shape_block_conformal_bet_1.M_MIN_K6, 100);
});
// Hand-computed 6-point oracle, transcribed algebra (not the module's own output):
// x = [8, 9, 9, 10, 11, 13], mean = 10, deviations d = [-2,-1,-1,0,1,3] (sum 0).
// m2 = (4+1+1+0+1+9)/6 = 16/6 = 8/3
// m3 = (-8-1-1+0+1+27)/6 = 18/6 = 3
// m4 = (16+1+1+0+1+81)/6 = 100/6 = 50/3
// kurtosis (RAW, not excess) = m4/m2^2 = (50/3)/(64/9) = 75/32 = 2.34375
// |skew| = |m3|/m2^1.5 = 3/(8/3)^1.5 = 27/(16*sqrt(6)) = 9*sqrt(6)/32 (rationalised)
(0, node_test_1.test)('moment formulas: hand-computed 6-point array oracle, via calibrateShapeBlocks(W=6)', () => {
    const block = [8, 9, 9, 10, 11, 13];
    const expectedKurtosis = 75 / 32;
    const expectedAbsSkew = (9 * Math.sqrt(6)) / 32;
    // 100 identical blocks ⇒ m = M_MIN_K6 exactly, and every block's statistic
    // equals the oracle exactly, so the calibration's per-feature median IS the
    // oracle value and every |dev| is exactly 0 (a second, independent pin).
    const rows = [];
    for (let i = 0; i < shape_block_conformal_bet_1.M_MIN_K6; i++)
        rows.push(...block);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(rows, 6);
    strict_1.default.equal(cal.m, shape_block_conformal_bet_1.M_MIN_K6);
    strict_1.default.ok(Math.abs(cal.kurtosis.median - expectedKurtosis) < 1e-12, `kurtosis median ${cal.kurtosis.median}`);
    strict_1.default.ok(Math.abs(cal.absSkew.median - expectedAbsSkew) < 1e-12, `absSkew median ${cal.absSkew.median}`);
    strict_1.default.ok(cal.kurtosis.sortedAbsDev.every((d) => d === 0), 'every block is identical to the oracle: |dev|=0');
    strict_1.default.ok(cal.absSkew.sortedAbsDev.every((d) => d === 0), 'every block is identical to the oracle: |dev|=0');
    // A live window equal to the same oracle block: T pins the moment formula a
    // second, independent way (through shapeBetWindow, not calibrateShapeBlocks),
    // and because dev=0 for every feature, p = (1+m)/(m+1) = 1 exactly, so
    // e = kappa*1^(kappa-1) = kappa for both features, and eAvg = kappa.
    const { perFeature, eAvg } = (0, shape_block_conformal_bet_1.shapeBetWindow)(block, cal);
    const kurt = perFeature.find((f) => f.name === 'kurtosis');
    const skew = perFeature.find((f) => f.name === 'absSkew');
    strict_1.default.ok(Math.abs(kurt.T - expectedKurtosis) < 1e-12, `T kurtosis ${kurt.T}`);
    strict_1.default.ok(Math.abs(skew.T - expectedAbsSkew) < 1e-12, `T absSkew ${skew.T}`);
    strict_1.default.equal(kurt.p, 1, 'dev=0 against an all-zero reference ⇒ every ref block ties or beats ⇒ p=1');
    strict_1.default.equal(skew.p, 1);
    strict_1.default.ok(Math.abs(kurt.e - shape_block_conformal_bet_1.KAPPA_K6) < 1e-12, `e kurtosis ${kurt.e}`);
    strict_1.default.ok(Math.abs(skew.e - shape_block_conformal_bet_1.KAPPA_K6) < 1e-12, `e absSkew ${skew.e}`);
    strict_1.default.ok(Math.abs(eAvg - shape_block_conformal_bet_1.KAPPA_K6) < 1e-12, `eAvg ${eAvg}`);
});
(0, node_test_1.test)('calibrateShapeBlocks throws if fewer than M_MIN_K6 disjoint blocks', () => {
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(new Array(99 * shape_block_conformal_bet_1.W_K6).fill(0)), /M_MIN_K6|100|disjoint/);
    // exactly at the floor must NOT throw
    const r = lcg(1);
    strict_1.default.doesNotThrow(() => (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r))));
});
(0, node_test_1.test)('shapeBetWindow throws on a window length that does not match the calibration block length', () => {
    const r = lcg(2);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 100 * shape_block_conformal_bet_1.W_K6 }, () => gauss(r)));
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(new Array(shape_block_conformal_bet_1.W_K6 - 1).fill(0), cal), /window\.length/);
    strict_1.default.throws(() => (0, shape_block_conformal_bet_1.shapeBetWindow)(new Array(shape_block_conformal_bet_1.W_K6 + 1).fill(0), cal), /window\.length/);
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
// Power finding worth recording, not hiding: at the registered default W_K6=30,
// kurtosis/skew are too noisy at n=30 to separate mix-d1.5 from Gaussian at all
// — direct simulation of shapeBetWindow's own eAvg under this alternative measures
// mean eAvg ~= 0.29 at W=30 (a LOSING bet on average, not a weak winning one), and
// power only turns positive (mean eAvg > 1) once W is large enough for the moment
// estimators to resolve the shape difference — empirically ~W=300 for d=1.5 (mean
// eAvg ~= 1.78 there, ~= 0.72 still at W=200). calibrateShapeBlocks takes W as a
// parameter for exactly this reason; this smoke overrides the default to the
// window length where the construction has power, rather than asserting a claim
// the default does not support. W_K6=30's fitness as a REGISTERED battery
// parameter for K6 is a separate, open question for the adapter task, flagged
// in the task report.
(0, node_test_1.test)('bimodal d=1.5 windows drive average wealth above 1 at a window length the shape estimators can resolve (power smoke, no endpoint)', () => {
    const W = 300;
    const rCal = lcg(20260809 + 3);
    const cal = (0, shape_block_conformal_bet_1.calibrateShapeBlocks)(Array.from({ length: 150 * W }, () => gauss(rCal)), W);
    const rLive = lcg(20260809 + 4);
    const N = 500;
    let totalWealth = 0;
    for (let i = 0; i < N; i++) {
        const windows = [];
        for (let w = 0; w < 6; w++)
            windows.push(bimodalMix(W, 1.5, rLive));
        const { wealth } = (0, shape_block_conformal_bet_1.shapeBetWealth)(windows, cal);
        totalWealth += wealth;
    }
    const avgWealth = totalWealth / N;
    strict_1.default.ok(avgWealth > 1, `average wealth ${avgWealth}`);
});
// Review-fixture precedent (K3's tie-direction regression, K4's rank-count regression):
// the conformal rank must count ties (>=), matching the module docstring and the
// coverage-gap page's "p = (1 + #{ref |dev| >= live |dev|}) / (m+1)". A live window
// exactly matching the reference median (already covered above by the oracle test's
// dev=0 case) pins the same property the K4 test isolates explicitly.
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
//# sourceMappingURL=shape-block-conformal-bet.test.js.map