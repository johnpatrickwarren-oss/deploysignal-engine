"use strict";
// test/adr-0021-robust-covariance.test.ts — the ported robust multivariate covariance (MCD + Ledoit-Wolf).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const robust_covariance_1 = require("../baseline/robust-covariance");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// rows from a known 2D covariance [[2,1],[1,2]] via its Cholesky.
function genCorrelated(n, seed) {
    const rng = lcg(seed), g = () => gaussian(rng);
    const l00 = Math.SQRT2, l10 = 1 / Math.SQRT2, l11 = Math.sqrt(2 - 0.5);
    const rows = [];
    for (let i = 0; i < n; i++) {
        const z0 = g(), z1 = g();
        rows.push([l00 * z0, l10 * z0 + l11 * z1]);
    }
    return rows;
}
(0, node_test_1.test)('robustCovariance: recovers the true covariance on clean Gaussian (MCD path)', () => {
    const rows = genCorrelated(600, 1);
    const r = (0, robust_covariance_1.robustCovariance)(rows, { seed: 7 });
    strict_1.default.equal(r.method, 'mcd');
    strict_1.default.ok(r.outlierFraction < 0.1, `clean data should trim few outliers; got ${r.outlierFraction.toFixed(2)}`);
    // true cov [[2,1],[1,2]] — within ~25% (finite-sample MCD + consistency correction)
    strict_1.default.ok(Math.abs(r.cov[0][0] - 2) < 0.5, `var0 ≈ 2; got ${r.cov[0][0].toFixed(2)}`);
    strict_1.default.ok(Math.abs(r.cov[1][1] - 2) < 0.5, `var1 ≈ 2; got ${r.cov[1][1].toFixed(2)}`);
    strict_1.default.ok(Math.abs(r.cov[0][1] - 1) < 0.5, `cov01 ≈ 1; got ${r.cov[0][1].toFixed(2)}`);
});
(0, node_test_1.test)('robustCovariance: rejects gross outliers (clean-null) where the sample covariance would blow up', () => {
    const rows = genCorrelated(500, 2);
    // corrupt 12% of rows with huge values
    const corrupt = rows.map((r, i) => (i % 8 === 0 ? [r[0] + 40, r[1] - 40] : r));
    const robust = (0, robust_covariance_1.robustCovariance)(corrupt, { seed: 7 });
    // robust variance stays near the truth (≈2), not the outlier-inflated sample variance (which is ~200+)
    const sampleVar0 = (() => { const m = (0, robust_covariance_1.columnMean)(corrupt); let v = 0; for (const x of corrupt)
        v += (x[0] - m[0]) ** 2; return v / corrupt.length; })();
    strict_1.default.ok(sampleVar0 > 50, `sanity: contaminated sample variance should be huge; got ${sampleVar0.toFixed(0)}`);
    strict_1.default.ok(robust.cov[0][0] < 6, `robust var0 should reject the outliers (≈2, not ${sampleVar0.toFixed(0)}); got ${robust.cov[0][0].toFixed(2)}`);
    strict_1.default.ok(robust.outlierFraction > 0.08, `should flag ~12% outliers; got ${robust.outlierFraction.toFixed(2)}`);
});
(0, node_test_1.test)('robustCovariance: Ledoit-Wolf fallback for small samples, PSD output', () => {
    const rows = genCorrelated(8, 3); // n=8 < 5·p=10 → LW path
    const r = (0, robust_covariance_1.robustCovariance)(rows, { seed: 7 });
    strict_1.default.equal(r.method, 'ledoit_wolf');
    strict_1.default.ok(r.lambda >= 0 && r.lambda <= 1, `lambda in [0,1]; got ${r.lambda}`);
    strict_1.default.ok((0, robust_covariance_1.choleskyLocal)(r.cov) !== null, 'LW covariance must be positive-definite');
});
(0, node_test_1.test)('robustCovariance: consistency factor — >1 correction, matches canonical at p=11, identity at α=1', () => {
    // p=11,α=.75 ≈ 1.24 is the Croux–Haesbroeck value WH reproduces accurately (matches the original engine).
    strict_1.default.ok(Math.abs((0, robust_covariance_1.consistencyCorrectionFactor)(0.75, 11) - 1.24) < 0.06, `p=11,α=.75 ≈ 1.24; got ${(0, robust_covariance_1.consistencyCorrectionFactor)(0.75, 11).toFixed(3)}`);
    // smaller p: a real (>1) correction, larger as coverage tightens; we assert direction/range, not a pinned
    // canonical value (the WH approximation diverges from the table for small p — a known limitation).
    strict_1.default.ok((0, robust_covariance_1.consistencyCorrectionFactor)(0.75, 5) > 1.1, `p=5,α=.75 should correct >1; got ${(0, robust_covariance_1.consistencyCorrectionFactor)(0.75, 5).toFixed(3)}`);
    strict_1.default.ok((0, robust_covariance_1.consistencyCorrectionFactor)(0.5, 2) > 1.0, `p=2,α=.5 should correct >1; got ${(0, robust_covariance_1.consistencyCorrectionFactor)(0.5, 2).toFixed(3)}`);
    strict_1.default.equal((0, robust_covariance_1.consistencyCorrectionFactor)(1.0, 5), 1, 'α=1 (no trimming) ⇒ no correction');
});
(0, node_test_1.test)('robustCovariance: linalg + guards', () => {
    strict_1.default.equal((0, robust_covariance_1.choleskyLocal)([[1, 2], [2, 1]]), null); // indefinite → null
    // Mahalanobis² of [3,4] under identity = 25
    strict_1.default.ok(Math.abs((0, robust_covariance_1.mahalanobisSqFromL)([3, 4], [0, 0], [[1, 0], [0, 1]]) - 25) < 1e-9);
    const { lambda } = (0, robust_covariance_1.ledoitWolfShrinkage)([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    strict_1.default.ok(lambda >= 0 && lambda <= 1);
    strict_1.default.throws(() => (0, robust_covariance_1.robustCovariance)([]), /non-empty/);
    strict_1.default.throws(() => (0, robust_covariance_1.robustCovariance)([[1, 2], [3]]), /ragged/);
});
//# sourceMappingURL=adr-0021-robust-covariance.test.js.map