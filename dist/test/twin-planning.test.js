"use strict";
// test/twin-planning.test.ts — ADR 0036: the bake-length planning figure. It is a POWER statement;
// validity never reads it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const twin_planning_1 = require("../per-shard/twin-planning");
const _paired_bet_1 = require("../detectors/_paired-bet");
const _seeded_1 = require("./_seeded");
(0, node_test_1.test)('sign: 0.2 excess at alpha 0.05 is ln(20) / 0.08 ticks', () => {
    const got = (0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
    strict_1.default.ok(Math.abs(got - Math.log(20) / 0.08) < 1e-9, `${got}`);
});
(0, node_test_1.test)('sign: ties stretch the bake by 1 / (1 − tieRate)', () => {
    const a = (0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
    const b = (0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0.2, tieRate: 0.5, alpha: 0.05 });
    strict_1.default.ok(Math.abs(b - 2 * a) < 1e-9);
});
(0, node_test_1.test)('rate: share 0.5, odds 2, 20 bad events per tick at alpha 0.05 is ~20.35 ticks', () => {
    const got = (0, twin_planning_1.ticksToDetect)({ kind: 'rate', canaryShare: 0.5, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 });
    strict_1.default.ok(Math.abs(got - 20.35) < 0.1, `${got}`);
});
(0, node_test_1.test)('no effect plans an infinite bake', () => {
    strict_1.default.equal((0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0, tieRate: 0, alpha: 0.05 }), Infinity);
    strict_1.default.equal((0, twin_planning_1.ticksToDetect)({ kind: 'rate', canaryShare: 0.5, oddsRatio: 1, badEventsPerTick: 20, alpha: 0.05 }), Infinity);
});
(0, node_test_1.test)('sign: the simulated median crossing tick lies within [0.8x, 3x] of the plan', () => {
    const plan = (0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
    const rng = (0, _seeded_1.lcg)(31);
    const ticks = [];
    for (let r = 0; r < 400; r++) {
        let s = (0, _paired_bet_1.initPairedBet)();
        for (let t = 1; t <= 2000; t++) {
            s = (0, _paired_bet_1.updatePairedBet)(s, { lo: 0, hi: 1, nullMean: 0.5 }, rng() < 0.7 ? 1 : 0);
            if ((0, _paired_bet_1.pairedBetWealth)(s) >= 20) {
                ticks.push(t);
                break;
            }
        }
    }
    ticks.sort((a, b) => a - b);
    const median = ticks[Math.floor(ticks.length / 2)];
    strict_1.default.ok(median >= 0.8 * plan && median <= 3 * plan, `median ${median}, plan ${plan}`);
});
(0, node_test_1.test)('inputs out of range throw', () => {
    strict_1.default.throws(() => (0, twin_planning_1.ticksToDetect)({ kind: 'sign', excessProbability: 0.6, tieRate: 0, alpha: 0.05 }), RangeError);
    strict_1.default.throws(() => (0, twin_planning_1.ticksToDetect)({ kind: 'rate', canaryShare: 0, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 }), RangeError);
});
//# sourceMappingURL=twin-planning.test.js.map