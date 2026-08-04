"use strict";
// test/spectral-inflation-bound.test.ts — the c-deflation.
//
// The spectral e-detector is not an e-process: E[M_T|H0] measured 1.0636 at T=300 and 1.1076 at
// T=900 under disjoint evaluation. The violation is BOUNDED, and a bounded violation is priceable —
// firing at c/α is identical to running at α on M/c, and E[M/c] ≤ 1. See
// knowledge/stats/h0-battery-2026-08-01.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const spectral_1 = require("../detectors/spectral");
const base = {
    null_mean: 0.2754, null_std: 0.08, betting_delta: 0.024,
    min_peak_lag: 3, max_peak_lag: 10,
};
const thresholdWith = (bound) => {
    const params = { ...base, e_value_inflation_bound: bound };
    const t = (0, spectral_1.evaluateSpectralEDetector)({ params, alpha: 0.05, signal: 't' }, base.null_mean, (0, spectral_1.freshSpectralEDetectorState)()).threshold;
    strict_1.default.ok(t !== null && t !== undefined, 'the detector must report a threshold');
    return t;
};
(0, node_test_1.test)('absent bound leaves the threshold at 1/alpha — not the same as c = 1 being true', () => {
    strict_1.default.equal(thresholdWith(undefined), 20);
});
(0, node_test_1.test)('a supplied bound raises the threshold to c/alpha', () => {
    strict_1.default.ok(Math.abs(thresholdWith(1.0636) - 1.0636 / 0.05) < 1e-9);
    strict_1.default.ok(Math.abs(thresholdWith(1.25) - 25) < 1e-9);
});
(0, node_test_1.test)('the bound only ever tightens: c >= 1 raises the bar, never lowers it', () => {
    strict_1.default.ok(thresholdWith(1.0636) > thresholdWith(undefined), 'deflation must not make the detector fire MORE readily');
});
(0, node_test_1.test)('the measured bounds are ordered by horizon, as c(n) = a*b^n requires', () => {
    // 1.0636 at 9 wealth updates, 1.1076 at 29. A bound quoted for a short horizon
    // under-corrects a long one, which is why the type says to measure the longest.
    strict_1.default.ok(1.1076 > 1.0636);
    strict_1.default.ok(thresholdWith(1.1076) > thresholdWith(1.0636));
});
//# sourceMappingURL=spectral-inflation-bound.test.js.map