"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/twin-two-sample.test.ts — ADR 0042: the two-sample betting kind between the twin's arms.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const twin_two_sample_1 = require("../detectors/twin-two-sample");
const _seeded_1 = require("./_seeded");
const gaussian = (rng) => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
const SPEC = { id: 'joint', alpha: 0.05, coordinates: [{ id: 'c1', margin: { relative: 0.02 } }, { id: 'c2', margin: { relative: 0.02 } }] };
(0, node_test_1.test)('spec checks', () => {
    (0, twin_two_sample_1.checkTwinTwoSampleSpec)(SPEC);
    strict_1.default.throws(() => (0, twin_two_sample_1.checkTwinTwoSampleSpec)({ ...SPEC, coordinates: [] }), /at least one/);
    strict_1.default.throws(() => (0, twin_two_sample_1.checkTwinTwoSampleSpec)({ ...SPEC, lambdaMax: 0.6 }), /lambdaMax/);
    strict_1.default.throws(() => (0, twin_two_sample_1.checkTwinTwoSampleSpec)({ ...SPEC, coordinates: [{ id: 'a', margin: {} }] }), /relative or absolute/);
});
(0, node_test_1.test)('shrinkPair: inside the band the pair collapses to its mean; beyond it the excess remains; swapping x and y swaps the outputs', () => {
    const s = (0, twin_two_sample_1.shrinkPair)(SPEC, [101, 100], [100, 110]);
    strict_1.default.ok(Math.abs(s.x[0] - s.y[0]) < 1e-12, 'c1 inside 2%: equal');
    strict_1.default.ok(Math.abs((s.y[1] - s.x[1]) - (10 - 0.02 * 105)) < 1e-9, 'c2: excess over the band');
    const t = (0, twin_two_sample_1.shrinkPair)(SPEC, [100, 110], [101, 100]);
    strict_1.default.deepEqual([t.x, t.y], [s.y, s.x]);
});
(0, node_test_1.test)('H0: exchangeable arms (iid noise) — false fire within the Ville bound; missing ticks are counted, not scored', () => {
    const rng = (0, _seeded_1.lcg)(20261003);
    const R = 300, T = 300;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, twin_two_sample_1.initTwinTwoSample)(SPEC);
        for (let t = 0; t < T; t++) {
            const L = 100 + 5 * gaussian(rng);
            const x = [L + gaussian(rng), L + gaussian(rng)], y = [L + gaussian(rng), L + gaussian(rng)];
            if (t === 7) {
                const s = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, [NaN, 1], y);
                st = s.state;
                strict_1.default.equal(st.missing, 1);
                continue;
            }
            const s = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, x, y);
            st = s.state;
            if (s.fire) {
                fired++;
                break;
            }
        }
    }
    strict_1.default.ok(fired / R <= 0.05 + 2.58 * Math.sqrt(0.05 * 0.95 / R), `false fire ${fired}/${R}`);
});
(0, node_test_1.test)('power (registered generator shape): correlation 0.9 in the canary\'s noise with means and variances held fires within 300 ticks more often than the Ville bound allows under the null (>= 10%); the study 2026-10-twin-two-sample measures the power; a 10% shift on one coordinate fires within 60 in >= 95%', () => {
    const rng = (0, _seeded_1.lcg)(5);
    const R = 100;
    let firedCorr = 0, firedShift = 0;
    const DAY = 1440;
    for (let r = 0; r < R; r++) {
        const M0 = { ...SPEC, coordinates: [{ id: 'c1' }, { id: 'c2' }] };
        let a = (0, twin_two_sample_1.initTwinTwoSample)(M0), b = (0, twin_two_sample_1.initTwinTwoSample)(SPEC);
        let da = false, db = false;
        const ar = [0, 0];
        for (let t = 0; t < 300 && !(da && db); t++) {
            const L = 100 * (1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY));
            ar[0] = 0.5 * ar[0] + 0.1 * gaussian(rng);
            ar[1] = 0.5 * ar[1] + 0.1 * gaussian(rng);
            const noise = () => (30 * (Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125))) / Math.sqrt(1000);
            const g1 = gaussian(rng), g2 = gaussian(rng);
            const sc = 30 / Math.sqrt(1000);
            const xCorr = [L + 10 * ar[0] + sc * g1, L + 10 * ar[0] + sc * (0.9 * g1 + Math.sqrt(1 - 0.81) * g2)];
            const y = [L + 10 * ar[1] + noise(), L + 10 * ar[1] + noise()];
            if (!da) {
                const s = (0, twin_two_sample_1.stepTwinTwoSample)(M0, a, xCorr, y);
                a = s.state;
                if (s.fire) {
                    firedCorr++;
                    da = true;
                }
            }
            if (!db && t < 60) {
                const s = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, b, [L * 1.10 + 10 * ar[0] + noise(), L + 10 * ar[0] + noise()], [L + 10 * ar[1] + noise(), L + 10 * ar[1] + noise()]);
                b = s.state;
                if (s.fire) {
                    firedShift++;
                    db = true;
                }
            }
        }
    }
    strict_1.default.ok(firedShift / R >= 0.95, `shift power ${firedShift}/${R}`);
    strict_1.default.ok(firedCorr / R >= 0.10, `correlation power ${firedCorr}/${R}`);
});
(0, node_test_1.test)('after a fire the state is terminal', () => {
    let st = (0, twin_two_sample_1.initTwinTwoSample)(SPEC);
    let s;
    for (let t = 0; t < 300; t++) {
        s = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, [130 + (t % 3), 100], [100, 100 + (t % 2)]);
        st = s.state;
        if (s.fire)
            break;
    }
    strict_1.default.ok(s.fire);
    const after = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, [100, 100], [100, 100]);
    strict_1.default.ok(after.fire);
    strict_1.default.equal(after.F, null);
});
(0, node_test_1.test)('Amendment 1: the running-max normalization and local standardization are predictable (fMax and recent reflect past ticks only)', () => {
    let st = (0, twin_two_sample_1.initTwinTwoSample)(SPEC);
    const s1 = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, [100, 100], [110, 90]);
    st = s1.state;
    strict_1.default.equal(s1.F, 0, 'no past: payoff 0');
    strict_1.default.equal(st.recent.length, 2);
    const s2 = (0, twin_two_sample_1.stepTwinTwoSample)(SPEC, st, [150, 100], [100, 100]);
    strict_1.default.ok(s2.state.fMax >= st.fMax);
    strict_1.default.equal(s2.state.recent.length, 4);
});
//# sourceMappingURL=twin-two-sample.test.js.map