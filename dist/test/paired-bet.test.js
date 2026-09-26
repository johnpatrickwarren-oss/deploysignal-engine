"use strict";
// test/paired-bet.test.ts — ADR 0036: the one-sided bounded-mean betting e-process.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const _paired_bet_1 = require("../detectors/_paired-bet");
const _seeded_1 = require("./_seeded");
const HALF = { lo: 0, hi: 1, nullMean: 0.5 };
function feed(spec, xs) {
    let s = (0, _paired_bet_1.initPairedBet)();
    for (const x of xs)
        s = (0, _paired_bet_1.updatePairedBet)(s, spec, x);
    return s;
}
(0, node_test_1.test)('predictability: each step multiplies wealth by 1 + λ(x − m) with λ from the state before x', () => {
    const rng = (0, _seeded_1.lcg)(1);
    let prev = (0, _paired_bet_1.initPairedBet)();
    for (let t = 0; t < 200; t++) {
        const m_t = 0.1 + 0.8 * rng();
        const spec_t = { lo: 0, hi: 1, nullMean: m_t };
        const x = rng() < 0.5 ? 0 : 1;
        const lam = (0, _paired_bet_1.pairedBetLambda)(prev, spec_t);
        strict_1.default.ok(lam >= 0 && lam <= (0, _paired_bet_1.pairedBetLambdaMax)(spec_t), `lambda ${lam} for spec with nullMean ${m_t}`);
        const next = (0, _paired_bet_1.updatePairedBet)(prev, spec_t, x);
        const expectedLogIncrement = Math.log1p(lam * (x - m_t));
        const actualLogIncrement = next.log_K - prev.log_K;
        strict_1.default.ok(Math.abs(actualLogIncrement - expectedLogIncrement) < 1e-12, `log increment mismatch: expected ${expectedLogIncrement}, got ${actualLogIncrement}`);
        prev = next;
    }
});
(0, node_test_1.test)('lambda stays in [0, lambdaMax] and every factor is at least 1/2', () => {
    const rng = (0, _seeded_1.lcg)(2);
    const spec = { lo: 0, hi: 1, nullMean: 0.2 };
    const lamMax = (0, _paired_bet_1.pairedBetLambdaMax)(spec);
    let s = (0, _paired_bet_1.initPairedBet)();
    for (let t = 0; t < 5000; t++) {
        const lam = (0, _paired_bet_1.pairedBetLambda)(s, spec);
        strict_1.default.ok(lam >= 0 && lam <= lamMax, `lambda ${lam}`);
        strict_1.default.ok(1 + lam * (spec.lo - spec.nullMean) >= 0.5 - 1e-12);
        s = (0, _paired_bet_1.updatePairedBet)(s, spec, rng() < 0.9 ? 1 : 0);
    }
});
(0, node_test_1.test)('Ville: under H0 the wealth crosses 1/alpha in at most alpha of runs (MC, 3 SE)', () => {
    const rng = (0, _seeded_1.lcg)(3);
    const R = 2000, T = 500, alpha = 0.05;
    let crossed = 0;
    for (let r = 0; r < R; r++) {
        let s = (0, _paired_bet_1.initPairedBet)();
        for (let t = 0; t < T; t++) {
            s = (0, _paired_bet_1.updatePairedBet)(s, HALF, rng() < 0.5 ? 1 : 0);
            if ((0, _paired_bet_1.pairedBetWealth)(s) >= 1 / alpha) {
                crossed++;
                break;
            }
        }
    }
    const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
    strict_1.default.ok(crossed / R <= bar, `crossing rate ${crossed / R} > ${bar}`);
});
(0, node_test_1.test)('power: P(X=1) = 0.7 crosses 1/alpha within 500 ticks in at least 95% of runs', () => {
    const rng = (0, _seeded_1.lcg)(4);
    const R = 400, T = 500, alpha = 0.05;
    let crossed = 0;
    for (let r = 0; r < R; r++) {
        let s = (0, _paired_bet_1.initPairedBet)();
        for (let t = 0; t < T; t++) {
            s = (0, _paired_bet_1.updatePairedBet)(s, HALF, rng() < 0.7 ? 1 : 0);
            if ((0, _paired_bet_1.pairedBetWealth)(s) >= 1 / alpha) {
                crossed++;
                break;
            }
        }
    }
    strict_1.default.ok(crossed / R >= 0.95, `power ${crossed / R}`);
});
(0, node_test_1.test)('NaN holds the state; out-of-range throws; a bad spec throws; NaN sums yield zero lambda', () => {
    const s = feed(HALF, [1, 0, 1]);
    strict_1.default.deepEqual((0, _paired_bet_1.updatePairedBet)(s, HALF, Number.NaN), s);
    strict_1.default.throws(() => (0, _paired_bet_1.updatePairedBet)(s, HALF, 1.5), RangeError);
    strict_1.default.throws(() => (0, _paired_bet_1.pairedBetLambdaMax)({ lo: 0, hi: 1, nullMean: 0 }), RangeError);
    strict_1.default.throws(() => (0, _paired_bet_1.pairedBetLambdaMax)({ lo: 0, hi: 1, nullMean: 1.2 }), RangeError);
    strict_1.default.equal((0, _paired_bet_1.pairedBetLambda)({ log_K: 0, n: 1, sumY: Number.NaN, sumY2: 0 }, HALF), 0);
});
//# sourceMappingURL=paired-bet.test.js.map