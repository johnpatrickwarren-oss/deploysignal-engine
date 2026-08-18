"use strict";
// test/spectral-inflation-bound.test.ts — the c-deflation.
//
// The spectral e-detector's E[M_T|H0] was measured 1.0636 at T=300 and 1.1076 at T=900 under
// disjoint evaluation with ESTIMATED (K = 400 windows) null moments; the first committed
// execution (validation/family-d-emean run-20260818T220621Z) reads 1.0229 / 1.0336 at exact
// moments — consistent with the committed values, which sit on the conservative side. The
// violation is K-dependent (c(T, K) ≈ exp(skew·n + n²r²/2K)) but BOUNDED at every measured K,
// and a bounded violation is priceable — firing at c/α is identical to running at α on M/c,
// and E[M/c] ≤ 1. See knowledge/stats/h0-battery-2026-08-01.
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
// C54 (2026-08-18): a bare c without its calibration-window count is under-specified —
// c(T, K) ≈ exp(skew·n + n²r²/2K), so the same detector at the same T prices differently at a
// different K (measured at run-20260818T220621Z: E[M_900] = 1.03 exact / 1.37 K=400 / 1.97 K=100,
// per-trajectory). The measurement form carries K beside T.
(0, node_test_1.test)('the measurement form prices the threshold identically to its bare c', () => {
    const measured = {
        c: 1.1076, measured_at_ticks: 900, wealth_updates: 29,
        calibration_window_count: 400,
    };
    strict_1.default.ok(Math.abs(thresholdWith(measured) - thresholdWith(1.1076)) < 1e-12);
});
(0, node_test_1.test)("calibration_window_count: 'exact' is expressible — the oracle-moment condition", () => {
    const measured = {
        c: 1.0336, measured_at_ticks: 900, wealth_updates: 29,
        calibration_window_count: 'exact', run: 'family-d-emean/run-20260818T220621Z',
    };
    strict_1.default.ok(Math.abs(thresholdWith(measured) - 1.0336 / 0.05) < 1e-9);
});
(0, node_test_1.test)('the legacy bare-number form still replays', () => {
    // Pre-C54 configs carry a bare number; they stay legal, and the doc marks them under-specified.
    strict_1.default.ok(Math.abs(thresholdWith(1.0636) - 21.272) < 1e-9);
});
// Review 2026-08-18: configs are JSON.parse-cast unvalidated, so the object shape reaches the
// runtime unchecked. A malformed measurement form must fail CLOSED (suppressed, like missing
// null moments) — not silently disable (c undefined -> NaN threshold -> 'clean' forever) and
// not fire unconditionally (c <= 0 -> threshold <= 0).
const verdictWith = (bound) => {
    const params = { ...base, e_value_inflation_bound: bound };
    return (0, spectral_1.evaluateSpectralEDetector)({ params, alpha: 0.05, signal: 't' }, base.null_mean, (0, spectral_1.freshSpectralEDetectorState)());
};
(0, node_test_1.test)('a measurement form without a finite c is suppressed, not silently dead', () => {
    const v = verdictWith({ measured_at_ticks: 900, calibration_window_count: 400 });
    strict_1.default.equal(v.verdict, 'suppressed');
    strict_1.default.equal(v.reason_code, 'spectral_inflation_bound_malformed');
});
(0, node_test_1.test)('a measurement form with c < 1 is suppressed, not an instant fire', () => {
    const v = verdictWith({ c: 0, measured_at_ticks: 900, calibration_window_count: 400 });
    strict_1.default.equal(v.verdict, 'suppressed');
    strict_1.default.equal(v.reason_code, 'spectral_inflation_bound_malformed');
});
//# sourceMappingURL=spectral-inflation-bound.test.js.map