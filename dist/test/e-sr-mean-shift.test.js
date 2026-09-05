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
// ── ADR 0031: the bounded-bet increment (study 2026-09-e-sr-bounded, C77) ──
const e_sr_mean_shift_2 = require("../detectors/e-sr-mean-shift");
const calibration_monitor_1 = require("../fleet/calibration-monitor");
(0, node_test_1.test)('bounded: the default is unchanged — increment absent and increment "gaussian" give byte-identical log_M', () => {
    const rng = mulberry32(11);
    const rs = Array.from({ length: 200 }, () => gaussian(rng));
    const a = (0, e_sr_mean_shift_1.freshESrMeanShiftState)({ alpha_arl: 1e-3 }), b = (0, e_sr_mean_shift_1.freshESrMeanShiftState)({ alpha_arl: 1e-3, increment: 'gaussian' });
    for (const r of rs) {
        const x = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(r, { alpha_arl: 1e-3 }, a), y = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(r, { alpha_arl: 1e-3, increment: 'gaussian' }, b);
        strict_1.default.equal(x.log_M, y.log_M);
        strict_1.default.equal(x.onset_estimate, y.onset_estimate);
    }
    strict_1.default.deepEqual((0, e_sr_mean_shift_2.eSrLambdaGrid)({}), e_sr_mean_shift_1.E_SR_LAMBDA_GRID);
});
(0, node_test_1.test)('bounded: the grid is the calibration monitor\'s eight ±λ and every |λ| < 1', () => {
    strict_1.default.deepEqual([...e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID], [...calibration_monitor_1.BOUND_LAMBDAS]);
    strict_1.default.deepEqual((0, e_sr_mean_shift_2.eSrLambdaGrid)({ increment: 'bounded' }), e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID);
    strict_1.default.ok(e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID.every((l) => Math.abs(l) < 1));
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.freshESrMeanShiftState)({ increment: 'bounded', lambdas: [0.5, 1.0] }), /\|lambda\| < 1/);
});
(0, node_test_1.test)('bounded: the increment integrates to exactly 1 under any symmetric law — N(0,1) and a scaled t3 by quadrature', () => {
    const h = 1e-3;
    for (const lam of e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID) {
        let sN = 0, sT = 0, wT = 0;
        for (let z = -12; z <= 12; z += h) {
            const wN = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * h;
            const wt = Math.pow(1 + (z * z) / 3, -2) * h; // t3 kernel, unnormalized, at a different scale
            sN += wN * (0, calibration_monitor_1.gBounded)(z, lam);
            sT += wt * (0, calibration_monitor_1.gBounded)(2.5 * z, lam);
            wT += wt;
        }
        strict_1.default.ok(Math.abs(sN - 1) < 1e-6, `N(0,1) λ=${lam}: ${sN}`);
        strict_1.default.ok(Math.abs(sT / wT - 1) < 1e-6, `t3×2.5 λ=${lam}: ${sT / wT}`);
    }
});
(0, node_test_1.test)('bounded: the recursion equals the brute-force SR sum per λ and the mixture is their mean', () => {
    const rng = mulberry32(5);
    const rs = Array.from({ length: 40 }, () => 0.5 + 3 * gaussian(rng)); // heavy enough to clip
    const p = { alpha_arl: 1e-3, increment: 'bounded' };
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)(p);
    let last = { log_M: 0 };
    for (const r of rs)
        last = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(r, p, st);
    let mix = 0;
    e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID.forEach((lam, k) => {
        let sum = 0;
        for (let j = 0; j < rs.length; j++) {
            let prod = 1;
            for (let i = j; i < rs.length; i++)
                prod *= (0, calibration_monitor_1.gBounded)(rs[i], lam);
            sum += prod;
        }
        strict_1.default.ok(Math.abs(Math.log(sum) - st.log_M_sr[k]) < 1e-9, `λ=${lam}`);
        mix += sum;
    });
    strict_1.default.ok(Math.abs(Math.log(mix / e_sr_mean_shift_2.E_SR_BOUNDED_LAMBDA_GRID.length) - last.log_M) < 1e-9);
});
(0, node_test_1.test)('bounded: on an exactly-zero residual M_t = t and the alarm lands at exactly 1/alpha_arl; alarms on a 3σ step; survives a +60 fault in the log domain', () => {
    const p = { alpha_arl: 1e-3, increment: 'bounded' };
    // g_λ(0) = 1 for every λ, so the SR recursion is M_t = M_{t−1} + 1 = t: the run-length guarantee
    // E∞[N*] ≥ 1/α_ARL holds with EQUALITY on a degenerate residual (a stuck signal at the baseline
    // alarms after 1,000 ticks), where the Gaussian increment exp(−λ²/2) < 1 would never alarm.
    const flat = (0, e_sr_mean_shift_1.freshESrMeanShiftState)(p);
    let firstAlarm = -1;
    for (let t = 0; t < 1200; t++) {
        const out = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, p, flat);
        strict_1.default.ok(Math.abs(out.log_M - Math.log(t + 1)) < 1e-9, `M_${t + 1} = ${t + 1}`);
        if (out.fired && firstAlarm < 0)
            firstAlarm = t + 1;
    }
    strict_1.default.equal(firstAlarm, 1000);
    const rng = mulberry32(3);
    const st = (0, e_sr_mean_shift_1.freshESrMeanShiftState)(p);
    let fireAt = -1;
    for (let t = 0; t < 400 && fireAt < 0; t++)
        if ((0, e_sr_mean_shift_1.evaluateESrMeanShift)((t >= 100 ? 3 : 0) + gaussian(rng), p, st).fired)
            fireAt = t;
    strict_1.default.ok(fireAt >= 100 && fireAt < 200, `fired at ${fireAt}`);
    const big = (0, e_sr_mean_shift_1.freshESrMeanShiftState)(p);
    let out = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(60, p, big);
    for (let t = 0; t < 200; t++)
        out = (0, e_sr_mean_shift_1.evaluateESrMeanShift)(60, p, big);
    strict_1.default.ok(Number.isFinite(out.log_M) && out.fired);
});
(0, node_test_1.test)('bounded: the envelope is an e-detector and the FDR gate refuses it by name', () => {
    strict_1.default.equal(e_sr_mean_shift_2.E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE.statistic, 'e-detector');
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(e_sr_mean_shift_2.E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE), false);
    strict_1.default.throws(() => (0, validity_envelope_1.assertValidForFdrPath)(e_sr_mean_shift_2.E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE), /e-DETECTOR/);
    strict_1.default.throws(() => (0, e_sr_mean_shift_1.evaluateESrMeanShift)(0, { increment: 'cauchy' }, (0, e_sr_mean_shift_1.freshESrMeanShiftState)()), /increment must be/);
});
//# sourceMappingURL=e-sr-mean-shift.test.js.map