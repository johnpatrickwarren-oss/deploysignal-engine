"use strict";
// test/ar1-phi-small-sample-guards.test.ts
//
// computePerSignalAr1Phi has two early returns and a boundary that
// ar1-phi-bias-correction.test.ts does not reach: the n < 3 minimum-samples
// floor, the variance < 1e-12 degenerate guard, and n = 3 itself, where the
// Kendall correction (1+3*phi_ols)/n is at its largest.
//
// This is the regime that moved when DeploySignal stopped running its own fork
// of this estimator (2026-07-31). At n = 3 the correction contributes 0.333 to
// phi; at n = 100 it contributes 0.01. The existing test measures the shrinkage
// between two mid-range n and asserts the long-baseline end is negligible; it
// never touches the short end, which is the end that whitens a canary window.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const family_a_mixture_supermartingale_js_1 = require("../detectors/family-a-mixture-supermartingale.js");
(0, node_test_1.test)('n < 3 returns exactly 0 — the minimum-samples floor', () => {
    // Not "close to 0": the guard returns the literal, so a regression that
    // computed a value here would be visible rather than absorbed by a tolerance.
    for (const values of [[], [1], [1, 2]]) {
        strict_1.default.equal((0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)(values, 0), 0, `n=${values.length} must short-circuit before the OLS ratio`);
    }
});
(0, node_test_1.test)('a constant window returns 0 via the variance guard, not NaN', () => {
    // Every centered residual is 0, so lag1/variance is 0/0. Without the
    // variance < 1e-12 guard this is NaN, which would propagate into the
    // whitening term and silently poison every subsequent tick.
    const phi = (0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)([5, 5, 5, 5, 5, 5], 5);
    strict_1.default.equal(phi, 0);
    strict_1.default.ok(Number.isFinite(phi), 'must not be NaN');
});
(0, node_test_1.test)('with zero OLS correlation the result IS the correction term, 1/n', () => {
    // [1, 0, 0, ...] centered at 0 gives lag1 = 0 and variance = 1, so
    // phi_ols = 0 exactly and phi = (1 + 3*0)/n = 1/n. This isolates the
    // correction from the estimate and pins its magnitude at each n.
    for (const n of [3, 10, 100]) {
        const values = [1, ...new Array(n - 1).fill(0)];
        strict_1.default.ok(Math.abs((0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)(values, 0) - 1 / n) < 1e-12, `n=${n}: expected the bare correction 1/n = ${1 / n}`);
    }
});
(0, node_test_1.test)('the correction is ~33x larger at the n=3 boundary than at n=100', () => {
    // The claim the code comment makes — "negligible at long baselines" — has a
    // matching short-baseline claim that was never pinned. A change to the
    // correction's n-dependence would move this ratio.
    const at = (n) => (0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)([1, ...new Array(n - 1).fill(0)], 0);
    const ratio = at(3) / at(100);
    strict_1.default.ok(Math.abs(ratio - 100 / 3) < 1e-9, `expected the correction to scale as 1/n (ratio ${100 / 3}); got ${ratio}`);
    strict_1.default.ok(at(3) > 0.3, `n=3 correction should be material; got ${at(3)}`);
});
(0, node_test_1.test)('n=3 is the first length that estimates rather than floors', () => {
    // The boundary itself: one sample shorter returns the floor, one longer
    // returns an estimate. Pins which side of the comparison n=3 sits on.
    strict_1.default.equal((0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)([1, 0], 0), 0);
    strict_1.default.ok((0, family_a_mixture_supermartingale_js_1.computePerSignalAr1Phi)([1, 0, 0], 0) > 0);
});
//# sourceMappingURL=ar1-phi-small-sample-guards.test.js.map