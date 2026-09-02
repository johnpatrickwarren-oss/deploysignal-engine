"use strict";
// test/e-bh-margin.test.ts — the realized e-BH threshold and per-shard margin
// (knowledge stats/e-betting-metrics-2026-09-02, option 3).
//
// The one property that makes these fields worth emitting: the margin's SIGN
// reproduces the selection exactly. If that ever drifts, the diagnostic is
// lying about the procedure it describes.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const e_bh_1 = require("../fleet/e-bh");
const _wealth_1 = require("../detectors/_wealth");
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Selected iff margin ≥ 0, modulo a floating tie band around zero where the
 *  multiplicative rule k·e_(k) ≥ N/q and the log-domain subtraction can round
 *  differently at the last ulp. */
function assertSignReproducesSelection(selected, margin, label) {
    const sel = new Set(selected);
    margin.forEach((m, i) => {
        if (Math.abs(m) < 1e-9)
            return; // boundary tie: either answer is the procedure's
        strict_1.default.equal(m >= 0, sel.has(i), `${label}: index ${i} margin ${m} vs selected ${sel.has(i)}`);
    });
}
(0, node_test_1.test)('margin sign reproduces the selection on 200 random snapshots (linear and log)', () => {
    const rng = mulberry32(20260902);
    for (let trial = 0; trial < 200; trial++) {
        const N = 1 + Math.floor(rng() * 60);
        const q = 0.02 + rng() * 0.3;
        const es = [];
        for (let i = 0; i < N; i++) {
            // mix of null-ish (e ≈ 0.1..2) and strong (e up to 1e4) values
            es.push(rng() < 0.7 ? 0.1 + rng() * 2 : Math.exp(rng() * Math.log(1e4)));
        }
        const lin = (0, e_bh_1.eBenjaminiHochberg)(es, q);
        assertSignReproducesSelection(lin.selected, lin.log_margin, `linear trial ${trial}`);
        const lg = (0, e_bh_1.eBenjaminiHochbergLog)(es.map(Math.log), q);
        assertSignReproducesSelection(lg.selected, lg.log_margin, `log trial ${trial}`);
        strict_1.default.deepEqual(lg.selected, lin.selected, 'both variants select the same set');
        strict_1.default.ok(Math.abs(lg.log_threshold_e - lin.log_threshold_e) < 1e-9);
    }
});
(0, node_test_1.test)('threshold is log(N/(qK)) when K ≥ 1 and log(N/q) when nothing is selected', () => {
    const r = (0, e_bh_1.eBenjaminiHochberg)([100, 50, 1, 0.5], 0.1);
    strict_1.default.equal(r.K, 2);
    strict_1.default.ok(Math.abs(r.log_threshold_e - Math.log(4 / (0.1 * 2))) < 1e-12);
    const none = (0, e_bh_1.eBenjaminiHochberg)([1, 1, 1], 0.1);
    strict_1.default.equal(none.K, 0);
    strict_1.default.ok(Math.abs(none.log_threshold_e - Math.log(3 / 0.1)) < 1e-12);
    // every margin negative when nothing is selected
    strict_1.default.ok(none.log_margin.every((m) => m < 0));
});
(0, node_test_1.test)('margin is index-aligned with the input, and a zero e-value is floored, never −Infinity', () => {
    const r = (0, e_bh_1.eBenjaminiHochberg)([0, 1000, 3], 0.1);
    strict_1.default.equal(r.log_margin.length, 3);
    strict_1.default.ok(Number.isFinite(r.log_margin[0]), 'zero e-value must not produce −Infinity');
    strict_1.default.equal(r.log_margin[0], -_wealth_1.LOG_MAX_WEALTH);
    strict_1.default.ok(r.log_margin[1] > 0 && r.selected.includes(1));
    strict_1.default.ok(JSON.stringify(r).indexOf('null') === -1, 'the surface stays JSON-safe');
});
//# sourceMappingURL=e-bh-margin.test.js.map