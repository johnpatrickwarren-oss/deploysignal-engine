"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/point-tail-bet-e-value.test.ts — engine test/adr-0005 pattern
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const point_tail_bet_e_value_1 = require("../detectors/point-tail-bet-e-value");
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
(0, node_test_1.test)('KAPPA is the registered constant', () => { strict_1.default.equal(point_tail_bet_e_value_1.KAPPA, 0.1); });
(0, node_test_1.test)('calibrate refuses short or degenerate rows', () => {
    strict_1.default.throws(() => (0, point_tail_bet_e_value_1.calibrateTailBet)([1, 2, 3]));
    strict_1.default.throws(() => (0, point_tail_bet_e_value_1.calibrateTailBet)(new Array(10000).fill(7)));
});
(0, node_test_1.test)('validity: healthy exceedance at alpha=0.05 within binomial tolerance', () => {
    const r = lcg(20260808);
    const cal = (0, point_tail_bet_e_value_1.calibrateTailBet)(Array.from({ length: 10000 }, () => gauss(r)));
    let exceed = 0;
    const N = 4000;
    for (let i = 0; i < N; i++)
        if ((0, point_tail_bet_e_value_1.pointTailBetEValue)(gauss(r), cal).e >= 20)
            exceed++;
    // E[1{e>=20}] = P(p <= (20/kappa)^(1/(kappa-1))) = (200)^(-1/0.9) ≈ 0.00279; 3σ tolerance
    const p0 = Math.pow(200, -1 / 0.9);
    strict_1.default.ok(exceed / N < p0 + 3 * Math.sqrt(p0 / N), `exceedance ${exceed / N}`);
});
(0, node_test_1.test)('mean e under H0 <= 1 within tolerance (calibrator integral)', () => {
    const r = lcg(42);
    const cal = (0, point_tail_bet_e_value_1.calibrateTailBet)(Array.from({ length: 10000 }, () => gauss(r)));
    let s = 0;
    const N = 20000;
    for (let i = 0; i < N; i++)
        s += (0, point_tail_bet_e_value_1.pointTailBetEValue)(gauss(r), cal).e;
    strict_1.default.ok(s / N < 1.15, `mean e ${s / N}`); // heavy-tailed; refusal-direction check only
});
(0, node_test_1.test)('a beyond-calibration point is decisive on its own', () => {
    const r = lcg(7);
    const cal = (0, point_tail_bet_e_value_1.calibrateTailBet)(Array.from({ length: 10000 }, () => gauss(r)));
    const { e, p } = (0, point_tail_bet_e_value_1.pointTailBetEValue)(1e6, cal);
    strict_1.default.equal(p, 1 / 10001);
    strict_1.default.ok(e > 300 && e < 500, `e ${e}`); // 0.1 * (1/10001)^(-0.9) ≈ 398
});
//# sourceMappingURL=point-tail-bet-e-value.test.js.map