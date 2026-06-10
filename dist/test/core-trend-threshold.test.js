"use strict";
// test/core-trend-threshold.test.ts — remediation 2026-06-10 (M1, L3).
//
// M1 — effectiveThreshold must apply the trend-strength factor exactly once:
//      effective = baseThreshold − trendDiscount · strength. The reviewed code
//      computed `discount = trendDiscount * strength` and then returned
//      `baseThreshold - discount * strength` (strength squared), systematically
//      under-discounting for moderate trends.
// L3 — summarizeWindow / TrendBuffer.get agree on the degenerate zero-mean cv.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const core_1 = require("../core");
function snap(partial) {
    return {
        slope: 0,
        slopeNorm: 0,
        stable: false,
        cv: 0,
        mean: 0,
        roc: 0,
        min: 0,
        max: 0,
        range: 0,
        n: 10,
        insufficient: false,
        ...partial,
    };
}
(0, node_test_1.test)('M1: effectiveThreshold applies trend strength exactly once', () => {
    // slopeNorm 0.02 → slopeScore 0.4; stable → +0.2 bonus; cv 0.01 → no
    // noise penalty. strength = 0.6 (strictly between 0 and 1 so the squared
    // bug is distinguishable from the correct formula).
    const t = snap({ slopeNorm: 0.02, stable: true, cv: 0.01, mean: 100 });
    const strength = (0, core_1.trendStrength)(t, 'rise');
    strict_1.default.ok(Math.abs(strength - 0.6) < 1e-12, `expected strength 0.6, got ${strength}`);
    const base = 2.0;
    const trendDiscount = 0.5;
    const expected = base - trendDiscount * strength; // 1.7
    const actual = (0, core_1.effectiveThreshold)(base, trendDiscount, t, 'rise');
    strict_1.default.ok(Math.abs(actual - expected) < 1e-12, `effectiveThreshold must be base - discount·strength = ${expected}; got ${actual}`
        + ' (strength applied twice?)');
});
(0, node_test_1.test)('M1: effectiveThreshold bypasses on insufficient data and fast roc', () => {
    strict_1.default.equal((0, core_1.effectiveThreshold)(2.0, 0.5, null, 'rise'), 2.0);
    strict_1.default.equal((0, core_1.effectiveThreshold)(2.0, 0.5, snap({ slopeNorm: 0.02, stable: true, mean: 100, n: 3 }), 'rise'), 2.0);
    const fastRoc = snap({ slopeNorm: 0.02, stable: true, cv: 0.01, mean: 100, roc: 0.5 });
    strict_1.default.equal((0, core_1.effectiveThreshold)(2.0, 0.5, fastRoc, 'rise', 0.3), 2.0);
});
(0, node_test_1.test)('L3: snapshot medium view cv agrees with get() on a zero-mean window', () => {
    const buf = new core_1.TrendBuffer(10);
    // Zero-mean window: mean === 0 → get() returns cv: 1 as the degenerate
    // default; snapshot's summarizeWindow must agree on the shared field.
    for (const v of [1, -1, 1, -1, 1, -1])
        buf.push('sig', v);
    const fromGet = buf.get('sig');
    const fromSnapshot = buf.snapshot('sig').medium;
    strict_1.default.equal(fromGet.cv, 1);
    strict_1.default.equal(fromSnapshot.cv, fromGet.cv, 'summarizeWindow and TrendBuffer.get must agree bit-for-bit on cv');
});
//# sourceMappingURL=core-trend-threshold.test.js.map