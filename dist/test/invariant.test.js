"use strict";
// test/invariant.test.ts — ADR 0038 §2: the invariant e-process.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const invariant_1 = require("../detectors/invariant");
const _seeded_1 = require("./_seeded");
const SPEC = { id: 'unaccounted', tolerance: 0.002, alpha: 0.05 };
(0, node_test_1.test)('spec: tolerance and alpha in (0, 1), id required', () => {
    (0, invariant_1.checkInvariantSpec)(SPEC);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, tolerance: 0 }), /tolerance/);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, tolerance: 1 }), /tolerance/);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, alpha: 0 }), /alpha/);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, id: '' }), /id/);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, ceiling: 0.001 }), /ceiling/);
    strict_1.default.throws(() => (0, invariant_1.checkInvariantSpec)({ ...SPEC, ceiling: 1.5 }), /ceiling/);
});
(0, node_test_1.test)('a tick with nothing routed is a skip; a non-finite count is missing; neither moves wealth', () => {
    let st = (0, invariant_1.initInvariant)(SPEC);
    let s = (0, invariant_1.stepInvariant)(SPEC, st, { total: 0, accounted: 0 });
    strict_1.default.equal(s.state.skipped, 1);
    strict_1.default.equal(s.x, null);
    strict_1.default.equal(s.wealth, 1);
    s = (0, invariant_1.stepInvariant)(SPEC, s.state, { total: NaN, accounted: 3 });
    strict_1.default.equal(s.state.missing, 1);
    strict_1.default.equal(s.wealth, 1);
});
(0, node_test_1.test)('more accounted than routed clamps to x = 0', () => {
    const s = (0, invariant_1.stepInvariant)(SPEC, (0, invariant_1.initInvariant)(SPEC), { total: 4800, accounted: 4810 });
    strict_1.default.equal(s.x, 0);
});
(0, node_test_1.test)('H0 (mean unaccounted fraction below the tolerance, boundary noise only): false fire within the Ville bound', () => {
    const rng = (0, _seeded_1.lcg)(20261003);
    const R = 400, T = 300;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, invariant_1.initInvariant)(SPEC);
        let prev = (0, _seeded_1.poisson)(rng, 10);
        for (let t = 0; t < T; t++) {
            const n = (0, _seeded_1.poisson)(rng, 4870);
            const inflight = (0, _seeded_1.poisson)(rng, 10);
            const s = (0, invariant_1.stepInvariant)(SPEC, st, { total: n, accounted: Math.max(0, Math.min(n, n - inflight + prev)) });
            prev = inflight;
            st = s.state;
            if (s.fire) {
                fired++;
                break;
            }
        }
    }
    strict_1.default.ok(fired / R <= 0.05 + 2.58 * Math.sqrt((0.05 * 0.95) / R), `false fire ${fired}/${R}`);
});
(0, node_test_1.test)('power: 0.5% of requests dropped (2.5× the tolerance) fires within 60 ticks in >= 95% of runs', () => {
    const rng = (0, _seeded_1.lcg)(7);
    const R = 200, T = 60;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, invariant_1.initInvariant)(SPEC);
        let prev = (0, _seeded_1.poisson)(rng, 10);
        for (let t = 0; t < T; t++) {
            const n = (0, _seeded_1.poisson)(rng, 4870);
            const inflight = (0, _seeded_1.poisson)(rng, 10);
            const drops = (0, _seeded_1.poisson)(rng, n * 0.005);
            const s = (0, invariant_1.stepInvariant)(SPEC, st, { total: n, accounted: Math.max(0, Math.min(n, n - drops - inflight + prev)) });
            prev = inflight;
            st = s.state;
            if (s.fire) {
                fired++;
                strict_1.default.equal(s.state.firedAt, s.state.used);
                break;
            }
        }
    }
    strict_1.default.ok(fired / R >= 0.95, `power ${fired}/${R}`);
});
(0, node_test_1.test)('after a fire the state is terminal: further ticks report fire without scoring', () => {
    let st = (0, invariant_1.initInvariant)(SPEC);
    let s;
    for (let t = 0; t < 200; t++) {
        s = (0, invariant_1.stepInvariant)(SPEC, st, { total: 4870, accounted: 4800 });
        st = s.state;
        if (s.fire)
            break;
    }
    strict_1.default.ok(s.fire);
    const used = st.used;
    const after = (0, invariant_1.stepInvariant)(SPEC, st, { total: 4870, accounted: 4870 });
    strict_1.default.ok(after.fire);
    strict_1.default.equal(after.state.used, used);
    strict_1.default.equal(after.x, null);
});
//# sourceMappingURL=invariant.test.js.map