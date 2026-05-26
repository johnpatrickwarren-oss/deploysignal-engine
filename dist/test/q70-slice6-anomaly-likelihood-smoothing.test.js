"use strict";
// test/q70-slice6-anomaly-likelihood-smoothing.test.ts — SLICE 6 NAB-aware
// dispatch logic: anomaly-likelihood smoothing wrapper.
//
// SLICE 5 left page-CUSUM at 34.36; the empirical 35-dataset
// classification showed ~30% of labeled windows have detector fires
// within ±500 ticks of the window edge but OUTSIDE NAB's credit zone
// (page-CUSUM crosses threshold at the FIRST tick of a sustained
// shift, but NAB labels trail the actual change point by ~200–1500
// ticks). SLICE 6 inserts a Numenta-style persistence filter at the
// dispatch layer: emit only when at least `thresholdCount` of the most
// recent `windowK` ticks have detector-fire=true. This delays first
// emit until the anomaly is sustained AND dedupes spurious single-tick
// fires.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const run_nab_validation_1 = require("../tools/run-nab-validation");
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
// ── applyAnomalyLikelihoodSmoothing core mechanics ─────────────────
function fires(ticks, total) {
    const set = new Set(ticks);
    return Array.from({ length: total }, (_, t) => ({ tick: t, fire: set.has(t) }));
}
(0, node_test_1.test)('SLICE 6 smoothing — sparse isolated fires below threshold do NOT emit', () => {
    // 5 isolated fires in a 100-tick trace; window=10, threshold=3.
    const trace = fires([5, 25, 50, 75, 95], 100);
    const out = (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 10, 3, 20);
    strict_1.default.equal(out.filter((f) => f.fire).length, 0, 'isolated single-tick fires should not satisfy 3-of-10 threshold');
});
(0, node_test_1.test)('SLICE 6 smoothing — sustained fire stream emits at threshold-crossing tick', () => {
    // 50 consecutive fires starting at tick 100; window=10, threshold=5.
    // First tick where rolling count ≥ 5 is tick 104 (counts: 1,2,3,4,5 at ticks 100..104).
    const trace = fires([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
        111, 112, 113, 114, 115, 116, 117, 118, 119,
        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
        130, 131, 132, 133, 134, 135, 136, 137, 138, 139,
        140, 141, 142, 143, 144, 145, 146, 147, 148, 149], 200);
    const out = (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 10, 5, 100);
    const emitted = out.filter((f) => f.fire).map((f) => f.tick);
    strict_1.default.equal(emitted.length, 1, 'one emit per cluster with cooldown=100');
    strict_1.default.equal(emitted[0], 104, 'first emit at threshold-crossing tick (104)');
});
(0, node_test_1.test)('SLICE 6 smoothing — post-emit cooldown suppresses re-emit within cooldownTicks', () => {
    // Two distinct clusters separated by ≥ cooldownTicks → two emits.
    const trace = fires([
        // cluster 1
        100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
        // cluster 2 (well after cooldown=100 expires)
        300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314,
    ], 500);
    const out = (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 10, 5, 100);
    const emitted = out.filter((f) => f.fire).map((f) => f.tick);
    strict_1.default.equal(emitted.length, 2, 'two clusters, two emits');
    strict_1.default.equal(emitted[0], 104);
    strict_1.default.equal(emitted[1], 304);
});
(0, node_test_1.test)('SLICE 6 smoothing — rejects threshold > window', () => {
    const trace = fires([1, 2, 3], 10);
    strict_1.default.throws(() => (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 5, 10, 50), /thresholdCount.*must not exceed windowK/);
});
(0, node_test_1.test)('SLICE 6 smoothing — windowK=0 passes through unchanged (disabled)', () => {
    const trace = fires([1, 5, 10], 20);
    const out = (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 0, 0, 50);
    strict_1.default.deepEqual(out, trace);
});
(0, node_test_1.test)('SLICE 6 smoothing — emit happens at LATER tick than raw cooldown for early-detection clusters', () => {
    // Demonstrates the "delay first emit" property — central to NAB-window
    // alignment. Raw cooldown would emit at the FIRST detector-fire tick;
    // smoothing emits at the threshold-crossing tick (delayed by ≥
    // threshold-1 ticks).
    const trace = fires([100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
        120, 121, 122, 123, 124], 200);
    const smoothed = (0, run_nab_validation_1.applyAnomalyLikelihoodSmoothing)(trace, 10, 5, 100);
    const smoothedEmit = smoothed.findIndex((f) => f.fire);
    // First raw fire was at index 100; smoothing emits at index 104 — 4-tick delay.
    strict_1.default.equal(smoothedEmit, 104, 'smoothing delays emit by threshold-1 ticks vs raw');
});
// ── buildPerDatasetConfig SLICE 6 default ──────────────────────────
(0, node_test_1.test)('SLICE 6 calibrator — smoothing provenance stamped by default', () => {
    const values = [];
    for (let i = 0; i < 500; i++)
        values.push(Math.sin(i / 10));
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    strict_1.default.ok(provenance.smoothing, 'smoothing block expected by default');
    strict_1.default.equal(provenance.smoothing.page_cusum.window, 50);
    strict_1.default.equal(provenance.smoothing.page_cusum.threshold_count, 25);
    strict_1.default.equal(provenance.smoothing.page_cusum.cooldown_ticks, 1000);
    strict_1.default.equal(provenance.smoothing.betting.cooldown_ticks, 1500, 'betting gets a longer cooldown (wealth-process FP control)');
    strict_1.default.equal(provenance.smoothing.spectral.window, 30, 'spectral uses a shorter smoothing window (oscillation periods 3–10)');
});
(0, node_test_1.test)('SLICE 6 calibrator — useAnomalyLikelihoodSmoothing: false disables smoothing', () => {
    const values = [];
    for (let i = 0; i < 500; i++)
        values.push(Math.sin(i / 10));
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15, {
        useAnomalyLikelihoodSmoothing: false,
    });
    strict_1.default.equal(provenance.smoothing, undefined, 'smoothing provenance should be absent when explicitly disabled');
});
//# sourceMappingURL=q70-slice6-anomaly-likelihood-smoothing.test.js.map