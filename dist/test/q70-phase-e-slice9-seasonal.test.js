"use strict";
// test/q70-phase-e-slice9-seasonal.test.ts — Phase E SLICE 9 seasonal
// decomposition math + calibrator integration.
//
// Per coordination/PHASE-E-SLICE-9-SPEC.md § Acceptance.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const seasonal_1 = require("../detectors/seasonal");
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
// ── Helpers ────────────────────────────────────────────────────────
function periodicPlusNoise(N, period, amplitude, noiseScale, seed) {
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    for (let i = 0; i < N; i++) {
        out.push(amplitude * Math.sin(2 * Math.PI * i / period) + noiseScale * (rng() - 0.5) * 2);
    }
    return out;
}
function highPhiAr1NoPeriod(N, phi, seed) {
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    let prev = 0;
    for (let i = 0; i < N; i++) {
        const eps = (rng() - 0.5) * 2;
        prev = phi * prev + eps;
        out.push(prev);
    }
    return out;
}
// ── detectDominantPeriod ───────────────────────────────────────────
(0, node_test_1.test)('SLICE 9 detectDominantPeriod — identifies daily period on synthetic cycle + noise', () => {
    const N = 1000;
    const period = 24;
    const x = periodicPlusNoise(N, period, 10, 1, 0xBEEF);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const result = (0, seasonal_1.detectDominantPeriod)(x, mu);
    // Allow tolerance ±2 (the first-peak algorithm may snap to a nearby lag).
    strict_1.default.ok(Math.abs(result.period - period) <= 2, `expected period ≈ ${period}; got ${result.period}`);
    strict_1.default.ok(result.acf_at_period > 0.5, `expected strong ACF at peak; got ${result.acf_at_period}`);
});
(0, node_test_1.test)('SLICE 9 detectDominantPeriod — returns 0 on high-φ AR(1) with no period (monotone ACF)', () => {
    const x = highPhiAr1NoPeriod(1000, 0.7, 0xCAFE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const result = (0, seasonal_1.detectDominantPeriod)(x, mu, { min_acf: 0.25 });
    strict_1.default.equal(result.period, 0, `AR(1) with no period should return 0; got period=${result.period}`);
});
(0, node_test_1.test)('SLICE 9 detectDominantPeriod — returns 0 when input too short', () => {
    const result = (0, seasonal_1.detectDominantPeriod)([1, 2, 3, 4, 5], 3);
    strict_1.default.equal(result.period, 0);
});
// ── seasonalMeans + deseasonalize ──────────────────────────────────
(0, node_test_1.test)('SLICE 9 seasonalMeans — sum ≈ 0 by mean-centering construction', () => {
    const x = periodicPlusNoise(500, 24, 5, 0.5, 0xFACE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const s = (0, seasonal_1.seasonalMeans)(x, 24, mu);
    const sum = s.reduce((a, b) => a + b, 0);
    // Σ s = (1/N) · Σ (x − μ) summed over all phases = 0 by construction
    // (when each phase has equal count).
    strict_1.default.ok(Math.abs(sum) < 1, `Σ seasonal_means should be ≈ 0; got ${sum}`);
});
(0, node_test_1.test)('SLICE 9 deseasonalize — removes the periodic component', () => {
    const x = periodicPlusNoise(500, 24, 10, 0.1, 0xDEAD);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const s = (0, seasonal_1.seasonalMeans)(x, 24, mu);
    const des = (0, seasonal_1.deseasonalize)(x, s, 24, 0);
    // Variance of deseasoned should be << variance of input
    const inputVar = x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length;
    const desMu = des.reduce((a, b) => a + b, 0) / des.length;
    const desVar = des.reduce((a, b) => a + (b - desMu) ** 2, 0) / des.length;
    strict_1.default.ok(desVar < inputVar * 0.5, `deseasoned variance (${desVar.toFixed(2)}) should be << input variance (${inputVar.toFixed(2)})`);
});
(0, node_test_1.test)('SLICE 9 deseasonalize — rejects mismatched seasonal length', () => {
    strict_1.default.throws(() => (0, seasonal_1.deseasonalize)([1, 2, 3], [0, 0], 3), /seasonal length 2 must equal period 3/);
});
// ── decomposeSeasonal (combined helper) ───────────────────────────
(0, node_test_1.test)('SLICE 9 decomposeSeasonal — returns period=0 + identity on AR(1) data', () => {
    const x = highPhiAr1NoPeriod(1000, 0.5, 0xBADF00D);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const result = (0, seasonal_1.decomposeSeasonal)(x, mu);
    strict_1.default.equal(result.period, 0);
    strict_1.default.equal(result.seasonal_means.length, 0);
    strict_1.default.deepEqual(result.deseasonalized, x);
});
(0, node_test_1.test)('SLICE 9 decomposeSeasonal — on periodic data, deseasonalized has lower variance', () => {
    const x = periodicPlusNoise(800, 30, 8, 0.5, 0xC0FFEE);
    const mu = x.reduce((a, b) => a + b, 0) / x.length;
    const result = (0, seasonal_1.decomposeSeasonal)(x, mu);
    strict_1.default.ok(result.period > 0, 'expected period detection');
    const inputVar = x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length;
    const desMu = result.deseasonalized.reduce((a, b) => a + b, 0) / result.deseasonalized.length;
    const desVar = result.deseasonalized.reduce((a, b) => a + (b - desMu) ** 2, 0) / result.deseasonalized.length;
    strict_1.default.ok(desVar < inputVar, `expected deseasoned var < input var`);
});
// ── Calibrator integration ─────────────────────────────────────────
(0, node_test_1.test)('SLICE 9 calibrator — useSeasonalDecomposition:true stamps seasonal_decomposition when period found', () => {
    const x = periodicPlusNoise(800, 30, 8, 0.5, 0xFEED);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.5, {
        useSeasonalDecomposition: true,
    });
    // Period detection may snap to a nearby lag; the key is that seasonal
    // decomposition is stamped.
    strict_1.default.ok(provenance.seasonal_decomposition, 'seasonal_decomposition expected when period detected');
    strict_1.default.ok(provenance.seasonal_decomposition.period > 0);
    strict_1.default.equal(provenance.seasonal_decomposition.seasonal_means.length, provenance.seasonal_decomposition.period);
    strict_1.default.ok(provenance.seasonal_decomposition.sigma2_innovation_deseasoned > 0);
});
(0, node_test_1.test)('SLICE 9 calibrator — useSeasonalDecomposition:false (default) does not stamp seasonal', () => {
    const x = periodicPlusNoise(800, 30, 8, 0.5, 0xCAFE);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.5);
    strict_1.default.equal(provenance.seasonal_decomposition, undefined);
});
(0, node_test_1.test)('SLICE 9 calibrator — falls through gracefully when no period detected', () => {
    // Pure AR(1) data has no period; seasonal_decomposition should NOT be stamped
    // (period=0 path → no provenance per the spec § ASK 2 fall-through).
    const x = highPhiAr1NoPeriod(600, 0.5, 0xFADEBABE);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(x, 'p99_latency', 0.5, {
        useSeasonalDecomposition: true,
    });
    strict_1.default.equal(provenance.seasonal_decomposition, undefined, 'no period detected → seasonal_decomposition omitted');
});
//# sourceMappingURL=q70-phase-e-slice9-seasonal.test.js.map