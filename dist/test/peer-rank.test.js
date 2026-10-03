"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/peer-rank.test.ts — ADR 0039: the rank-among-peers kind.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const peer_rank_1 = require("../detectors/peer-rank");
const twin_contrast_1 = require("../detectors/twin-contrast");
const _seeded_1 = require("./_seeded");
const SPEC = { id: 'gpu_temp', worse: 'higher', tolerance: 0.1, margin: { relative: 0.02 }, alpha: 0.05 };
const gaussian = (rng) => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
(0, node_test_1.test)('spec checks', () => {
    (0, peer_rank_1.checkPeerRankSpec)(SPEC);
    strict_1.default.throws(() => (0, peer_rank_1.checkPeerRankSpec)({ ...SPEC, tolerance: 0.5 }), /tolerance/);
    strict_1.default.throws(() => (0, peer_rank_1.checkPeerRankSpec)({ ...SPEC, margin: {} }), /relative or absolute/);
    strict_1.default.throws(() => (0, peer_rank_1.checkPeerRankSpec)({ ...SPEC, worse: 'up' }), /worse/);
});
(0, node_test_1.test)('score: fraction of finite peers the unit is worse than, beyond the band; ties count half without a margin', () => {
    strict_1.default.deepEqual((0, peer_rank_1.peerRankScore)(SPEC, { unit: 110, peers: [100, 105, 109, NaN] }), { x: 2 / 3, peersScored: 3 });
    strict_1.default.deepEqual((0, peer_rank_1.peerRankScore)({ ...SPEC, margin: undefined }, { unit: 100, peers: [100, 90, 110] }), { x: 0.5, peersScored: 3 });
    strict_1.default.equal((0, peer_rank_1.peerRankScore)(SPEC, { unit: 100, peers: [NaN] }), null);
    strict_1.default.equal((0, peer_rank_1.peerRankScore)(SPEC, { unit: NaN, peers: [1] }), null);
    strict_1.default.deepEqual((0, peer_rank_1.peerRankScore)({ ...SPEC, worse: 'lower' }, { unit: 90, peers: [100, 91] }), { x: 0.5, peersScored: 2 });
});
(0, node_test_1.test)('N = 2 reproduces the twin sign kind score for score and wealth for wealth (with and without a margin)', () => {
    for (const margin of [undefined, { relative: 0.02 }]) {
        const ps = { ...SPEC, margin };
        const ts = { id: 'x', kind: 'sign', worse: 'higher', tolerance: 0.1, ...(margin ? { margin } : {}) };
        const rng = (0, _seeded_1.lcg)(11);
        let pst = (0, peer_rank_1.initPeerRank)(ps), tst = (0, twin_contrast_1.initTwinMetric)();
        for (let t = 0; t < 500; t++) {
            const u = 100 + 3 * gaussian(rng), p = 100 + 3 * gaussian(rng);
            const peerStep = (0, peer_rank_1.stepPeerRank)(ps, pst, { unit: u, peers: [p] });
            const sc = (0, twin_contrast_1.twinScore)(ts, { canary: u, control: p });
            const px = (0, peer_rank_1.peerRankScore)(ps, { unit: u, peers: [p] });
            if (sc === 'tie')
                strict_1.default.equal(px.x, 0.5);
            else if (typeof sc === 'object')
                strict_1.default.equal(px.x, sc.x);
            tst = (0, twin_contrast_1.updateTwinMetric)(ts, tst, { canary: u, control: p });
            if (peerStep.fire)
                break;
            pst = peerStep.state;
            const te = (0, twin_contrast_1.twinMetricEvidence)(tst);
            strict_1.default.ok(Math.abs(peerStep.rollbackE - te.rollbackE) < 1e-9 * Math.max(1, te.rollbackE), `rollback wealth differs at tick ${t}`);
            strict_1.default.ok(Math.abs(peerStep.proceedE - te.proceedE) < 1e-9 * Math.max(1, te.proceedE), `proceed wealth differs at tick ${t}`);
        }
    }
});
(0, node_test_1.test)('H0 (exchangeable unit and 3 peers, iid noise): false rollback within the Ville bound', () => {
    const rng = (0, _seeded_1.lcg)(20261003);
    const R = 400, T = 300;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, peer_rank_1.initPeerRank)(SPEC);
        for (let t = 0; t < T; t++) {
            const s = (0, peer_rank_1.stepPeerRank)(SPEC, st, { unit: 100 + 3 * gaussian(rng), peers: [0, 1, 2].map(() => 100 + 3 * gaussian(rng)) });
            st = s.state;
            if (s.fire) {
                fired++;
                break;
            }
        }
    }
    strict_1.default.ok(fired / R <= 0.05 + 2.58 * Math.sqrt(0.05 * 0.95 / R), `false rollback ${fired}/${R}`);
});
(0, node_test_1.test)('power: the unit 10% above 3 peers (5× the margin) rolls back within 60 ticks in >= 95% of runs', () => {
    const rng = (0, _seeded_1.lcg)(5);
    const R = 200;
    let fired = 0;
    for (let r = 0; r < R; r++) {
        let st = (0, peer_rank_1.initPeerRank)(SPEC);
        for (let t = 0; t < 60; t++) {
            const s = (0, peer_rank_1.stepPeerRank)(SPEC, st, { unit: 110 + 3 * gaussian(rng), peers: [0, 1, 2].map(() => 100 + 3 * gaussian(rng)) });
            st = s.state;
            if (s.fire) {
                fired++;
                break;
            }
        }
    }
    strict_1.default.ok(fired / R >= 0.95, `power ${fired}/${R}`);
});
(0, node_test_1.test)('after a fire the state is terminal', () => {
    let st = (0, peer_rank_1.initPeerRank)(SPEC);
    let s;
    for (let t = 0; t < 200; t++) {
        s = (0, peer_rank_1.stepPeerRank)(SPEC, st, { unit: 120, peers: [100, 100, 100] });
        st = s.state;
        if (s.fire)
            break;
    }
    strict_1.default.ok(s.fire);
    const after = (0, peer_rank_1.stepPeerRank)(SPEC, st, { unit: 50, peers: [100, 100, 100] });
    strict_1.default.ok(after.fire);
    strict_1.default.equal(after.x, null);
});
//# sourceMappingURL=peer-rank.test.js.map