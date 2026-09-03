"use strict";
// test/e-sr-mean-shift.test.ts — ADR 0029. The e-SR mean-shift e-detector: the recursion is the SR
// sum, the increment is exact under N(0,1), E∞[M_t] = t (so it is NOT an e-value), the FDR gate
// refuses it by name, and the log domain survives a fault the linear domain cannot represent.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const e_sr_mean_shift_1 = require("../detectors/e-sr-mean-shift");
const validity_envelope_1 = require("../detectors/validity-envelope");
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(rng) { const u1 = Math.max(rng(), 1e-12), u2 = rng(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }
(0, node_test_1.test)('the grid is ±{0.25·12^{k/7}}, sixteen points spanning 0.25 to 3', () => {
    strict_1.default.equal(e_sr_mean_shift_1.E_SR_LAMBDA_GRID.length, 16);
    const pos = e_sr_mean_shift_1.E_SR_LAMBDA_GRID.filter((l) => l > 0).sort((a, b) => a - b);
    strict_1.default.ok(Math.abs(pos[0] - 0.25) < 1e-12 && Math.abs(pos[7] - 3) < 1e-12);
    strict_1.default.deepEqual(e_sr_mean_shift_1.E_SR_LAMBDA_GRID.map((l) => -l).sort((a, b) => a - b), [...e_sr_mean_shift_1.E_SR_LAMBDA_GRID].sort((a, b) => a - b));
});
(0, node_test_1.test)('the increment integrates to exactly 1 under N(0,1) for every grid λ', () => {
    const h = 1e-3;
    for (const lam of e_sr_mean_shift_1.E_SR_LAMBDA_GRID) {
        let s = 0;
        for (let z = -12; z <= 12; z += h)
            s += Math.exp(lam * z - 0.5 * lam * lam) * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * h;
        strict_1.default.ok(Math.abs(s - 1) < 1e-6, `λ=${lam}: ${s}`);
    }
});
(0, node_test_1.test)('the recursion equals the brute-force SR sum Σ_j Π_{i≥j} L_i per λ, and the mixture is their mean', () => {
    const rng = mulberry32(7);
    const rs = Array.from({ length: 40 }, () => 0.3 + gaussian(rng));
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)();
    let last = { log_M: 0 };
    for (const r of rs)
        last = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(r, { alpha_arl: 1e-3 }, st);
    let mix = 0;
    e_sr_mean_shift_1.E_SR_LAMBDA_GRID.forEach((lam, k) => {
        let sum = 0;
        for (let j = 0; j < rs.length; j++) {
            let p = 1;
            for (let i = j; i < rs.length; i++)
                p *= Math.exp(lam * rs[i] - 0.5 * lam * lam);
            sum += p;
        }
        strict_1.default.ok(Math.abs(Math.log(sum) - st.log_M_sr[k]) < 1e-9, `λ=${lam}`);
        mix += sum;
    });
    strict_1.default.ok(Math.abs(Math.log(mix / 16) - last.log_M) < 1e-9);
});
// E∞[M_t] = t follows from the two tests above (E[L] = 1 per tick, and the recursion IS the SR
// sum) by linearity and the tower rule. It is NOT measurable by a trajectory mean on the full grid:
// at λ = 3 a 150-tick product has log-sd 3·sqrt(150) ≈ 37, and a sample mean of 3,000 such
// lognormals reads ~64 against an expectation of 150 (measured while writing this test — the
// terminal-mean trap, knowledge/stats/pages/terminal-mean-is-not-measurable.md). So the Monte
// Carlo form runs on λ = ±0.25 over 20 ticks, where the window log-sd is 1.1 and the mean is
// estimable to a few percent. Study H5 was amended to the same instrument before its run.
(0, node_test_1.test)('E∞[M_t] = t under the null on a grid where the mean is measurable — it is NOT an e-value', () => {
    const N = 4000, T = 20, lambdas = [0.25, -0.25];
    let acc = 0;
    for (let i = 0; i < N; i++) {
        const rng = mulberry32(1000 + i);
        const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)({ lambdas });
        let m = 0;
        for (let t = 0; t < T; t++)
            m = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(gaussian(rng), { lambdas }, st).M;
        acc += m;
    }
    const mean = acc / N;
    strict_1.default.ok(mean > 0.9 * T && mean < 1.1 * T, `mean M_T = ${mean} vs T = ${T}`);
    strict_1.default.ok(mean > 5, 'an e-value would average ≤ 1; this averages ≈ T');
});
(0, node_test_1.test)('alarms fast on a 3σ step, never on a flat zero residual, and estimates the onset', () => {
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)();
    for (let t = 0; t < 500; t++) {
        const res = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, { alpha_arl: 1e-3 }, st);
        strict_1.default.equal(res.fired, false);
        strict_1.default.ok(res.M <= t + 1 + 1e-9);
    }
    const st2 = (0, e_sr_mean_shift_1.freshESrMeanShiftState)();
    const rng = mulberry32(3);
    let alarm = null;
    let onset = -1;
    for (let t = 0; t < 400; t++) {
        const r = gaussian(rng) + (t >= 200 ? 3 : 0);
        const res = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(r, { alpha_arl: 1e-3 }, st2);
        if (res.fired && alarm === null) {
            alarm = t;
            onset = res.onset_estimate;
            strict_1.default.ok(res.argmax_lambda > 0);
            break;
        }
    }
    strict_1.default.ok(alarm !== null && alarm >= 200 && alarm <= 215, `alarm at ${alarm}`);
    strict_1.default.ok(onset >= 195 && onset <= 205, `onset estimate ${onset}`);
    strict_1.default.equal(st2.alarm_tick, alarm);
});
(0, node_test_1.test)('log domain: a residual of +60 for 200 ticks keeps log_M finite while M overflows', () => {
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)();
    let res = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, {}, st);
    for (let t = 0; t < 200; t++)
        res = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(60, {}, st);
    strict_1.default.ok(Number.isFinite(res.log_M) && res.log_M > 1000);
    strict_1.default.equal(res.M, Infinity);
    strict_1.default.equal(res.fired, true);
});
(0, node_test_1.test)('standardizeAr1Residual whitens: the whitened step has mean δ·sqrt((1−φ)/(1+φ))', () => {
    strict_1.default.equal((0, e_sr_mean_shift_1.standardizeAr1Residual)(2, null, 1, 2, 0), 0.5);
    const phi = 0.6, delta = 1.5, rng = mulberry32(11);
    let prev = null, acc = 0;
    const n = 20000;
    let x = 0; // AR(1) with unit marginal variance plus a step of δ
    for (let t = 0; t < n; t++) {
        x = phi * x + Math.sqrt(1 - phi * phi) * gaussian(rng);
        const obs = x + delta;
        if (t > 0)
            acc += (0, e_sr_mean_shift_1.standardizeAr1Residual)(obs, prev, 0, 1, phi);
        prev = obs;
    }
    const mean = acc / (n - 1), expected = delta * Math.sqrt((1 - phi) / (1 + phi));
    strict_1.default.ok(Math.abs(mean - expected) < 0.03, `${mean} vs ${expected}`);
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.standardizeAr1Residual)(1, null, 0, 0), /sigma/);
});
(0, node_test_1.test)('the FDR gate refuses the e-detector by name under every assertion', () => {
    strict_1.default.equal(e_sr_mean_shift_1.E_SR_MEAN_SHIFT_ENVELOPE.statistic, 'e-detector');
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(e_sr_mean_shift_1.E_SR_MEAN_SHIFT_ENVELOPE, { trueBaseline: true, phiUnmeasuredAccepted: true }), false);
    strict_1.default.throws(() => (0, validity_envelope_1.assertValidForFdrPath)(e_sr_mean_shift_1.E_SR_MEAN_SHIFT_ENVELOPE, { trueBaseline: true, mMuchGreaterThanN: true, observedPhi: 0 }), /e-DETECTOR/);
});
(0, node_test_1.test)('rejects malformed inputs', () => {
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)();
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.evaluateESrMeanShift)(NaN, {}, st), /finite/);
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, { alpha_arl: 1 }, st), /alpha_arl/);
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, { lambdas: [1] }, st), /components/);
});
//# sourceMappingURL=e-sr-mean-shift.test.js.map