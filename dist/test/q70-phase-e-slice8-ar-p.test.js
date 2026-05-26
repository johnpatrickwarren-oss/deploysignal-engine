"use strict";
// test/q70-phase-e-slice8-ar-p.test.ts — Phase E SLICE 8 AR(p) calibration math.
//
// Per coordination/PHASE-E-SLICE-8-SPEC.md § Tests block. Pins the
// Yule-Walker / Levinson-Durbin / AIC order selection primitives in
// detectors/ar-p.ts, plus the calibrator + dispatcher integration.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const ar_p_1 = require("../detectors/ar-p");
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
// ── Helpers ────────────────────────────────────────────────────────
function ar1Series(N, phi, seed) {
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    let prev = 0;
    for (let i = 0; i < N; i++) {
        const eps = (rng() - 0.5) * 2; // ~U(-1, 1)
        prev = phi * prev + eps;
        out.push(prev);
    }
    return out;
}
function ar2Series(N, phi1, phi2, seed) {
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    let prev1 = 0, prev2 = 0;
    for (let i = 0; i < N; i++) {
        const eps = (rng() - 0.5) * 2;
        const next = phi1 * prev1 + phi2 * prev2 + eps;
        out.push(next);
        prev2 = prev1;
        prev1 = next;
    }
    return out;
}
function lag1ACF(x) {
    const N = x.length;
    let mu = 0;
    for (const v of x)
        mu += v;
    mu /= N;
    let num = 0, den = 0;
    for (let i = 1; i < N; i++)
        num += (x[i] - mu) * (x[i - 1] - mu);
    for (let i = 0; i < N; i++)
        den += (x[i] - mu) ** 2;
    return num / den;
}
// ── Math primitive tests ───────────────────────────────────────────
(0, node_test_1.test)('SLICE 8 sampleAutocovariance — γ̂_0 ≈ sample variance, γ̂_k ≈ 0 for iid noise', () => {
    // ~U(-1, 1) ⇒ variance = 1/3. Lag-k ACF ≈ 0 for k > 0 on iid.
    let s = 0xCAFE;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const x = [];
    for (let i = 0; i < 1000; i++)
        x.push((rng() - 0.5) * 2);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const g0 = (0, ar_p_1.sampleAutocovariance)(x, mu, 0);
    const g5 = (0, ar_p_1.sampleAutocovariance)(x, mu, 5);
    strict_1.default.ok(Math.abs(g0 - 1 / 3) < 0.05, `γ̂_0 ≈ 1/3 for U(-1,1); got ${g0}`);
    strict_1.default.ok(Math.abs(g5) < 0.05, `γ̂_5 ≈ 0 for iid; got ${g5}`);
});
(0, node_test_1.test)('SLICE 8 yuleWalkerLevinson — recovers AR(1) φ on AR(1) data', () => {
    const x = ar1Series(2000, 0.7, 0xBEEF);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const gamma = (0, ar_p_1.autocovarianceSequence)(x, mu, 1);
    const fit = (0, ar_p_1.yuleWalkerLevinson)(gamma);
    strict_1.default.equal(fit.phi.length, 1);
    strict_1.default.ok(Math.abs(fit.phi[0] - 0.7) < 0.05, `expected φ ≈ 0.7; got ${fit.phi[0]}`);
    strict_1.default.ok(fit.sigma2_innovation > 0, 'innovation variance must be positive');
});
(0, node_test_1.test)('SLICE 8 yuleWalkerLevinson — recovers AR(2) coefficients on AR(2) data', () => {
    const x = ar2Series(3000, 0.5, 0.3, 0xDEAD);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const gamma = (0, ar_p_1.autocovarianceSequence)(x, mu, 2);
    const fit = (0, ar_p_1.yuleWalkerLevinson)(gamma);
    strict_1.default.equal(fit.phi.length, 2);
    strict_1.default.ok(Math.abs(fit.phi[0] - 0.5) < 0.1, `expected φ_1 ≈ 0.5; got ${fit.phi[0]}`);
    strict_1.default.ok(Math.abs(fit.phi[1] - 0.3) < 0.1, `expected φ_2 ≈ 0.3; got ${fit.phi[1]}`);
});
(0, node_test_1.test)('SLICE 8 yuleWalkerLevinson — degenerate γ̂_0 = 0 returns zeros', () => {
    const gamma = [0, 0, 0];
    const fit = (0, ar_p_1.yuleWalkerLevinson)(gamma);
    strict_1.default.equal(fit.sigma2_innovation, 0);
    strict_1.default.ok(fit.phi.every((p) => p === 0));
});
(0, node_test_1.test)('SLICE 8 fitArP — AR(1) data picks p̂ ≤ 2 with high probability', () => {
    // 5 independent AR(1) realizations; majority of fits should pick p̂ ∈ {1, 2}.
    let smallP = 0;
    for (let seed = 0; seed < 5; seed++) {
        const x = ar1Series(1000, 0.6, 0xCAFE + seed * 1234);
        const mu = x.reduce((a, b) => a + b, 0) / x.length;
        const fit = (0, ar_p_1.fitArP)(x, mu, { p_max: 10 });
        if (fit.p <= 2)
            smallP++;
    }
    strict_1.default.ok(smallP >= 3, `expected at least 3/5 AR(1) fits to pick p̂ ≤ 2; got ${smallP}/5`);
});
(0, node_test_1.test)('SLICE 8 fitArP — AR(2) data picks p̂ ≥ 2', () => {
    const x = ar2Series(2000, 0.5, 0.3, 0xFADE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const fit = (0, ar_p_1.fitArP)(x, mu, { p_max: 10 });
    strict_1.default.ok(fit.p >= 2, `expected p̂ ≥ 2 on AR(2) data; got ${fit.p}`);
});
(0, node_test_1.test)('SLICE 8 fitArP — BIC picks SMALLER or EQUAL order vs AIC (more conservative)', () => {
    const x = ar2Series(800, 0.5, 0.3, 0xC0FFEE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const aicFit = (0, ar_p_1.fitArP)(x, mu, { p_max: 10, ic: 'aic' });
    const bicFit = (0, ar_p_1.fitArP)(x, mu, { p_max: 10, ic: 'bic' });
    strict_1.default.ok(bicFit.p <= aicFit.p, `BIC (p=${bicFit.p}) should be ≤ AIC (p=${aicFit.p})`);
});
(0, node_test_1.test)('SLICE 8 prewhitenAr — empty phi passes through unchanged', () => {
    const x = [1, 2, 3, 4, 5];
    strict_1.default.deepEqual((0, ar_p_1.prewhitenAr)(x, 3, []), x);
});
(0, node_test_1.test)('SLICE 8 prewhitenAr — removes correlation on AR(1) data with fitted phi', () => {
    const x = ar1Series(2000, 0.7, 0xFEED);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const before = lag1ACF(x);
    const pw = (0, ar_p_1.prewhitenAr)(x, mu, [0.7]);
    const after = lag1ACF(pw);
    strict_1.default.ok(before > 0.5, `expected high pre-whitening lag-1 ACF; got ${before}`);
    strict_1.default.ok(Math.abs(after) < 0.1, `expected lag-1 ACF near 0 after pre-whitening; got ${after}`);
});
(0, node_test_1.test)('SLICE 8 prewhitenAr — AR(2) pre-whitening removes both lags', () => {
    const x = ar2Series(3000, 0.5, 0.3, 0xBADE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const fit = (0, ar_p_1.fitArP)(x, mu, { p_max: 5 });
    const pw = (0, ar_p_1.prewhitenAr)(x, mu, fit.phi);
    const after = lag1ACF(pw);
    strict_1.default.ok(Math.abs(after) < 0.1, `expected lag-1 ACF near 0 after AR(${fit.p}) pre-whitening; got ${after}`);
});
// ── Calibrator integration ─────────────────────────────────────────
(0, node_test_1.test)('SLICE 8 calibrator — useArPCalibration:true stamps ar_p_calibration provenance', () => {
    const x = ar1Series(500, 0.85, 0xC0DE);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.15, { useArPCalibration: true });
    strict_1.default.ok(provenance.ar_p_calibration, 'ar_p_calibration expected when opted in');
    strict_1.default.ok(provenance.ar_p_calibration.p >= 1, 'should pick at least p̂ = 1');
    strict_1.default.equal(provenance.ar_p_calibration.phi.length, provenance.ar_p_calibration.p);
    strict_1.default.ok(provenance.ar_p_calibration.sigma2_innovation > 0);
    strict_1.default.equal(provenance.ar_p_calibration.ic_kind, 'aic');
});
(0, node_test_1.test)('SLICE 8 calibrator — useArPCalibration:false (default) does not stamp ar_p_calibration', () => {
    const x = ar1Series(500, 0.85, 0xDADA);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.15);
    strict_1.default.equal(provenance.ar_p_calibration, undefined, 'AR(p) provenance should be absent by default (opt-in per SLICE 8 spec § ASK 4)');
});
(0, node_test_1.test)('SLICE 8 calibrator — innovation variance from AR(p) supersedes single-lag innovation', () => {
    // For high-φ AR(1) data, AR(1) Yule-Walker recovers φ ≈ 0.85; the
    // AR(p) σ²_inn should be close to the AR(1) σ²·(1−φ²) value.
    const x = ar1Series(500, 0.85, 0xBABE);
    const slice7 = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.15);
    const slice8 = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.15, { useArPCalibration: true });
    const slice7Sigma2 = slice7.config.baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency.baseline_sigma_squared;
    const slice8Sigma2 = slice8.config.baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency.baseline_sigma_squared;
    // Both should be in the same order of magnitude; AR(p) typically
    // gives ≤ AR(1) innovation variance (richer fit → less residual).
    strict_1.default.ok(slice8Sigma2 <= slice7Sigma2 * 1.5, `AR(p) σ²_inn (${slice8Sigma2}) should be ≤ ~AR(1) σ²_inn (${slice7Sigma2})`);
    strict_1.default.ok(slice8Sigma2 > 0, 'AR(p) σ²_inn must be positive');
});
//# sourceMappingURL=q70-phase-e-slice8-ar-p.test.js.map