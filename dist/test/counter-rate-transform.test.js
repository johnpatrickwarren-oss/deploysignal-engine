"use strict";
// test/counter-rate-transform.test.ts — remediation 2026-06-10 (M3).
//
// transformPair used actual_elapsed_seconds as a divisor with no guard:
// duplicate timestamps (elapsed = 0) yielded Infinity/NaN rates and
// out-of-order samples (elapsed < 0) yielded negative rates, all flagged
// 'normal' — propagating directly into TrendBuffer/detector state. Pairs
// with non-positive elapsed must now return a null-value degraded sample.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const counter_rate_transform_1 = require("../l0/counter-rate-transform");
const COUNTER = { semantic_type: 'counter' };
const OPTS = { expected_scrape_interval_seconds: 30 };
(0, node_test_1.test)('M3: zero elapsed (duplicate timestamp) returns null value, degraded', () => {
    const r = (0, counter_rate_transform_1.transformPair)({ value: 100, ts_seconds: 1000 }, { value: 160, ts_seconds: 1000 }, COUNTER, OPTS);
    strict_1.default.equal(r.value, null, 'rate over zero elapsed is undefined; must not be Infinity');
    strict_1.default.equal(r.actual_elapsed_seconds, 0);
    strict_1.default.equal(r.slope_quality, 'degraded');
    strict_1.default.equal(r.nonpositive_elapsed_detected, true);
    strict_1.default.equal(r.reset_detected, false);
    strict_1.default.equal(r.wraparound_handled, false);
});
(0, node_test_1.test)('M3: negative elapsed (out-of-order pair) returns null value, degraded', () => {
    const r = (0, counter_rate_transform_1.transformPair)({ value: 100, ts_seconds: 1000 }, { value: 160, ts_seconds: 970 }, COUNTER, OPTS);
    strict_1.default.equal(r.value, null, 'negative-elapsed rate must not be emitted');
    strict_1.default.equal(r.actual_elapsed_seconds, -30);
    strict_1.default.equal(r.slope_quality, 'degraded');
    strict_1.default.equal(r.nonpositive_elapsed_detected, true);
});
(0, node_test_1.test)('M3: non-counter pass-through also guarded (timestamp invariant is pair-level)', () => {
    const r = (0, counter_rate_transform_1.transformPair)({ value: 0.5, ts_seconds: 1000 }, { value: 0.7, ts_seconds: 1000 }, { semantic_type: 'gauge' }, OPTS);
    strict_1.default.equal(r.value, null);
    strict_1.default.equal(r.slope_quality, 'degraded');
    strict_1.default.equal(r.nonpositive_elapsed_detected, true);
});
(0, node_test_1.test)('M3: clean increasing counter unchanged by the guard', () => {
    const r = (0, counter_rate_transform_1.transformPair)({ value: 100, ts_seconds: 1000 }, { value: 160, ts_seconds: 1030 }, COUNTER, OPTS);
    strict_1.default.equal(r.value, 2);
    strict_1.default.equal(r.slope_quality, 'normal');
    strict_1.default.equal(r.nonpositive_elapsed_detected, undefined);
});
//# sourceMappingURL=counter-rate-transform.test.js.map