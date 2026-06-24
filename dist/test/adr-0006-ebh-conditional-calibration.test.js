"use strict";
// test/adr-0006-ebh-conditional-calibration.test.ts — ADR 0006.
//
// Validates the closed-form e-BH-CC (Lee-Ren conditional-calibration boosting for a KNOWN per-shard
// null, arXiv:2404.17562) against its theorems: Theorem 2 — the boosted set is a DETERMINISTIC SUPERSET
// of plain e-BH; Theorem 1 — FDR ≤ q is preserved. The construction is EXACT (closed form in the null
// survival), so there is NO Monte-Carlo sample size and NO validity cliff.
//
// Test e-value: a Gaussian one-sided likelihood ratio e = exp(λx − λ²/2), x ~ N(μ,1) — a valid e-value
// (E[e|H0] = 1) whose null survival P(ẽ ≥ x | H0) = Φ(−(ln x + λ²/2)/λ) is known in closed form.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const e_bh_1 = require("../fleet/e-bh");
const e_bh_conditional_calibration_1 = require("../fleet/e-bh-conditional-calibration");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const LAMBDA = 2, DELTA = 3;
const eLR = (x) => Math.exp(LAMBDA * x - LAMBDA * LAMBDA / 2);
// Exact null survival of the Gaussian-LR e-value: P(e ≥ x | H0) = P(Z ≥ (ln x + λ²/2)/λ).
const survival = (_j, x) => (x <= 0 ? 1 : Phi(-(Math.log(x) + LAMBDA * LAMBDA / 2) / LAMBDA));
// ── 1. Theorem 2 — deterministic superset + the (full) power gain. ─────────────────────────────────
(0, node_test_1.test)('superset + power: boosted ⊇ plain on every trial, and boosting roughly doubles power', () => {
    const m = 50, m1 = 10, q = 0.1, T = 300;
    let viol = 0, plainPow = 0, boostPow = 0;
    for (let t = 0; t < T; t++) {
        const rng = lcg(7 + t * 101);
        const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < m1 ? DELTA : 0)));
        const plain = (0, e_bh_1.eBenjaminiHochberg)(e, q).selected;
        const boost = new Set((0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected);
        for (const i of plain)
            if (!boost.has(i))
                viol++;
        plainPow += plain.filter((i) => i < m1).length / m1;
        boostPow += [...boost].filter((i) => i < m1).length / m1;
    }
    strict_1.default.equal(viol, 0, 'Theorem 2: every plain rejection must remain rejected after boosting');
    strict_1.default.ok(boostPow / T > plainPow / T + 0.2, `boosting must materially raise power (plain ${(plainPow / T).toFixed(2)} → boosted ${(boostPow / T).toFixed(2)})`);
});
// ── 2. Theorem 1 — FDR ≤ q (mixed null/alternative). ────────────────────────────────────────────
(0, node_test_1.test)('FDR: boosted realized FDP ≤ q on a mixed null/alternative fleet', () => {
    const m = 50, m1 = 10, q = 0.1, T = 400;
    let fdp = 0;
    for (let t = 0; t < T; t++) {
        const rng = lcg(1234 + t * 97);
        const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < m1 ? DELTA : 0)));
        const sel = (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected;
        fdp += sel.length ? sel.filter((i) => i >= m1).length / sel.length : 0;
    }
    strict_1.default.ok(fdp / T <= q + 0.01, `boosted FDP ${(fdp / T).toFixed(4)} must be ≤ q=${q}`);
});
// ── 3. Theorem 1 — pure-null FDR ≤ q (every rejection is false). ──────────────────────────────────
(0, node_test_1.test)('FDR: under the complete null, P(any false rejection) ≤ q', () => {
    const m = 50, q = 0.1, T = 2000;
    let anyRej = 0;
    for (let t = 0; t < T; t++) {
        const rng = lcg(50001 + t * 101);
        const e = Array.from({ length: m }, () => eLR(gaussian(rng)));
        if ((0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected.length)
            anyRej++;
    }
    strict_1.default.ok(anyRej / T <= q + 0.005, `pure-null realized FDR ${(anyRej / T).toFixed(4)} must be ≤ q=${q}`);
});
// ── 4. Exactness — deterministic (no Monte-Carlo, no sample-size cliff). ───────────────────────────
(0, node_test_1.test)('exact: the procedure is deterministic (no sampling) — repeated calls give identical results', () => {
    const m = 30, q = 0.1;
    const rng = lcg(2024);
    const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < 5 ? DELTA : 0)));
    const a = (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected;
    const b = (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected;
    strict_1.default.deepEqual(a, b, 'identical inputs must give identical outputs (no randomness)');
});
// ── 5. Conservative survival stays valid; the float boundary is handled. ───────────────────────────
(0, node_test_1.test)('conservative survival fires no more than the exact one (over-stating the tail is safe)', () => {
    const m = 40, q = 0.1, T = 100;
    const conservative = (j, x) => Math.min(1, 1.5 * survival(j, x)); // over-states the tail
    let exactExtra = 0;
    for (let t = 0; t < T; t++) {
        const rng = lcg(303 + t * 71);
        const e = Array.from({ length: m }, (_, i) => eLR(gaussian(rng) + (i < 8 ? DELTA : 0)));
        const ex = new Set((0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, survival).selected);
        const cons = (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)(e, q, conservative).selected;
        for (const i of cons)
            if (!ex.has(i))
                exactExtra++; // conservative ⊆ exact
    }
    strict_1.default.equal(exactExtra, 0, 'a tail-over-stating survival must reject a subset of the exact procedure');
});
// ── 6. Guards. ──────────────────────────────────────────────────────────────────────────────────
(0, node_test_1.test)('guards: empty input, bad q, bad nullMean, out-of-range survival throw', () => {
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([], 0.1, survival), /empty input/);
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([2, 3], 0, survival), RangeError);
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([2, 3], 1.5, survival), RangeError);
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([2, 3], 0.1, survival, { nullMean: 0 }), RangeError);
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([2, 3], 0.1, survival, { nullMean: 1.2 }), RangeError); // E[ẽ]>1 impossible for a valid e-value
    strict_1.default.throws(() => (0, e_bh_conditional_calibration_1.eBHConditionalCalibration)([2, 3], 0.1, () => 2), RangeError); // survival > 1
});
//# sourceMappingURL=adr-0006-ebh-conditional-calibration.test.js.map