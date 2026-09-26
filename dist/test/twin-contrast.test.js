"use strict";
// test/twin-contrast.test.ts — ADR 0036: rate and sign twin kinds.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const twin_contrast_1 = require("../detectors/twin-contrast");
const _seeded_1 = require("./_seeded");
const ERR = { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 };
const LAT = { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.1 };
(0, node_test_1.test)('fisherNoncentralMean: psi = 1 is the central hypergeometric mean', () => {
    strict_1.default.ok(Math.abs((0, twin_contrast_1.fisherNoncentralMean)(300, 700, 10, 1) - 3) < 1e-12);
});
(0, node_test_1.test)('fisherNoncentralMean: 1 + 1 arms with one event is psi / (1 + psi)', () => {
    strict_1.default.ok(Math.abs((0, twin_contrast_1.fisherNoncentralMean)(1, 1, 1, 2) - 2 / 3) < 1e-12);
});
(0, node_test_1.test)('fisherNoncentralMean is increasing in psi', () => {
    const a = (0, twin_contrast_1.fisherNoncentralMean)(500, 500, 20, 1);
    const b = (0, twin_contrast_1.fisherNoncentralMean)(500, 500, 20, 1.5);
    const c = (0, twin_contrast_1.fisherNoncentralMean)(500, 500, 20, 3);
    strict_1.default.ok(a < b && b < c && c < 20, `${a} ${b} ${c}`);
});
(0, node_test_1.test)('fisherNoncentralMean does not throw at a large support (N ~ 5e5 requests per tick)', () => {
    const m = (0, twin_contrast_1.fisherNoncentralMean)(500000, 500000, 500000, 1);
    strict_1.default.ok(Math.abs(m - 250000) < 1e-6 * 500000, `${m}`);
});
/** log-free small-N binomial coefficient (n <= 70 here, k <= 12: well inside double precision). */
function binom(n, k) {
    if (k < 0 || k > n)
        return 0;
    const kk = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < kk; i++)
        result = (result * (n - i)) / (i + 1);
    return result;
}
function bruteForceFisherMean(nc, nk, total, psi) {
    const lo = Math.max(0, total - nk);
    const hi = Math.min(total, nc);
    let num = 0;
    let den = 0;
    for (let x = lo; x <= hi; x++) {
        const w = binom(nc, x) * binom(nk, total - x) * Math.pow(psi, x);
        num += x * w;
        den += w;
    }
    return num / den;
}
(0, node_test_1.test)('fisherNoncentralMean matches a brute-force weighted sum over the support', () => {
    const expected = bruteForceFisherMean(30, 70, 12, 1.7);
    const got = (0, twin_contrast_1.fisherNoncentralMean)(30, 70, 12, 1.7);
    strict_1.default.ok(Math.abs(got - expected) < 1e-9, `${got} vs ${expected}`);
});
(0, node_test_1.test)('rate score: canary share of bad events, null = traffic share', () => {
    const s = (0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 6, canaryTotal: 300, controlEvents: 4, controlTotal: 700 });
    strict_1.default.ok(s !== 'skip' && s !== 'tie');
    strict_1.default.ok(Math.abs(s.x - 0.6) < 1e-12);
    strict_1.default.ok(Math.abs(s.rollbackNull - 0.3) < 1e-12);
    strict_1.default.ok(s.proceedNull > 0.3 && s.proceedNull < 1);
});
(0, node_test_1.test)('rate score with worse = lower counts failures (total − events)', () => {
    const spec = { ...ERR, worse: 'lower' };
    const s = (0, twin_contrast_1.twinScore)(spec, { canaryEvents: 990, canaryTotal: 1000, controlEvents: 999, controlTotal: 1000 });
    strict_1.default.ok(s !== 'skip' && s !== 'tie');
    strict_1.default.ok(Math.abs(s.x - 10 / 11) < 1e-12);
});
(0, node_test_1.test)('rate score skips empty arms, zero bad events and a degenerate support', () => {
    strict_1.default.equal((0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 0, canaryTotal: 0, controlEvents: 1, controlTotal: 10 }), 'skip');
    strict_1.default.equal((0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 0, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), 'skip');
    strict_1.default.equal((0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 5, canaryTotal: 5, controlEvents: 2, controlTotal: 2 }), 'skip');
    strict_1.default.throws(() => (0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 11, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), RangeError);
});
(0, node_test_1.test)('rate score rejects non-integer counts', () => {
    strict_1.default.throws(() => (0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 2.7, canaryTotal: 300, controlEvents: 4, controlTotal: 700 }), RangeError);
    strict_1.default.throws(() => (0, twin_contrast_1.twinScore)(ERR, { canaryEvents: 2, canaryTotal: 300.5, controlEvents: 4, controlTotal: 700 }), RangeError);
});
(0, node_test_1.test)('sign score: worse orientation, ties, and missing values', () => {
    const up = (0, twin_contrast_1.twinScore)(LAT, { canary: 120, control: 100 });
    strict_1.default.ok(up !== 'skip' && up !== 'tie' && up.x === 1 && up.rollbackNull === 0.5);
    strict_1.default.ok(Math.abs(up.proceedNull - 0.6) < 1e-12);
    const lower = (0, twin_contrast_1.twinScore)({ ...LAT, worse: 'lower' }, { canary: 120, control: 100 });
    strict_1.default.ok(lower !== 'skip' && lower !== 'tie' && lower.x === 0);
    strict_1.default.equal((0, twin_contrast_1.twinScore)(LAT, { canary: 100, control: 100 }), 'tie');
    strict_1.default.equal((0, twin_contrast_1.twinScore)(LAT, { canary: Number.NaN, control: 100 }), 'skip');
});
(0, node_test_1.test)('tolerance ranges are enforced per kind', () => {
    strict_1.default.throws(() => (0, twin_contrast_1.checkTwinMetricSpec)({ ...ERR, tolerance: 0 }), RangeError);
    strict_1.default.throws(() => (0, twin_contrast_1.checkTwinMetricSpec)({ ...ERR, tolerance: 11 }), RangeError);
    strict_1.default.throws(() => (0, twin_contrast_1.checkTwinMetricSpec)({ ...LAT, tolerance: 0.5 }), RangeError);
    strict_1.default.doesNotThrow(() => (0, twin_contrast_1.checkTwinMetricSpec)(LAT));
});
/** One tick of a rate pair: shared seasonal rate, unequal routing (normal-approximate binomial
 *  split, to keep the suite fast), per-arm multiplier. */
function rateTick(rng, t, w, canaryMult) {
    const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / 144);
    const n = (0, _seeded_1.poisson)(rng, 1000 * season);
    const z = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
    const nc = Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * z)));
    const nk = n - nc;
    const p = 0.01 * season;
    return {
        canaryEvents: Math.min(nc, (0, _seeded_1.poisson)(rng, nc * p * canaryMult)), canaryTotal: nc,
        controlEvents: Math.min(nk, (0, _seeded_1.poisson)(rng, nk * p)), controlTotal: nk,
    };
}
(0, node_test_1.test)('rate H0 (equal rates, w = 0.3, shared seasonality): false rollback within the Ville bound', () => {
    const rng = (0, _seeded_1.lcg)(11);
    const R = 1000, T = 300, alpha = 0.05;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, twin_contrast_1.initTwinMetric)();
        for (let t = 0; t < T; t++) {
            st = (0, twin_contrast_1.updateTwinMetric)(ERR, st, rateTick(rng, t, 0.3, 1));
            if ((0, twin_contrast_1.twinMetricEvidence)(st).rollbackE >= 1 / alpha) {
                fired++;
                break;
            }
        }
    }
    const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
    strict_1.default.ok(fired / R <= bar, `false rollback ${fired / R} > ${bar}`);
});
(0, node_test_1.test)('rate power: canary at twice the bad-event rate rolls back within 300 ticks in >= 95% of runs', () => {
    const rng = (0, _seeded_1.lcg)(12);
    const R = 200, T = 300, alpha = 0.05;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, twin_contrast_1.initTwinMetric)();
        for (let t = 0; t < T; t++) {
            st = (0, twin_contrast_1.updateTwinMetric)(ERR, st, rateTick(rng, t, 0.5, 2));
            if ((0, twin_contrast_1.twinMetricEvidence)(st).rollbackE >= 1 / alpha) {
                fired++;
                break;
            }
        }
    }
    strict_1.default.ok(fired / R >= 0.95, `power ${fired / R}`);
});
(0, node_test_1.test)('rate proceed: identical arms clear a 50% odds tolerance within 300 ticks in >= 90% of runs', () => {
    const rng = (0, _seeded_1.lcg)(13);
    const R = 200, T = 300, alpha = 0.05;
    let cleared = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, twin_contrast_1.initTwinMetric)();
        for (let t = 0; t < T; t++) {
            st = (0, twin_contrast_1.updateTwinMetric)(ERR, st, rateTick(rng, t, 0.5, 1));
            if ((0, twin_contrast_1.twinMetricEvidence)(st).proceedE >= 1 / alpha) {
                cleared++;
                break;
            }
        }
    }
    strict_1.default.ok(cleared / R >= 0.9, `proceed rate ${cleared / R}`);
});
(0, node_test_1.test)('the envelopes carry their pairing premises and estimate nothing', () => {
    strict_1.default.equal(twin_contrast_1.TWIN_RATE_ENVELOPE.pairingPremise, 'exchangeable-arms');
    strict_1.default.equal(twin_contrast_1.TWIN_SIGN_ENVELOPE.pairingPremise, 'exchangeable-equal-weight-arms');
    strict_1.default.equal(twin_contrast_1.TWIN_RATE_ENVELOPE.baseline, 'randomized-twin');
    strict_1.default.equal(twin_contrast_1.TWIN_RATE_ENVELOPE.validUnderEstimatedBaseline, true);
});
//# sourceMappingURL=twin-contrast.test.js.map