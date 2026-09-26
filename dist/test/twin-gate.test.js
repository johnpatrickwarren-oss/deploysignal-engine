"use strict";
// test/twin-gate.test.ts — ADR 0036: multi-metric fusion and the sample-ratio guard.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const twin_gate_1 = require("../per-shard/twin-gate");
const _seeded_1 = require("./_seeded");
const CFG = {
    metrics: [
        { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 },
        { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.2 },
    ],
    alphaRollback: 0.01,
    alphaProceed: 0.05,
    alphaSrm: 0.001,
    canaryWeight: 0.5,
    maxTicks: 1000,
};
function tick(rng, canaryMult, canaryLatencyShift) {
    const n = (0, _seeded_1.poisson)(rng, 2000);
    let nc = 0;
    for (let i = 0; i < n; i++)
        if (rng() < 0.5)
            nc++;
    const nk = n - nc;
    return {
        canaryRequests: nc,
        controlRequests: nk,
        observations: {
            http_5xx: {
                canaryEvents: Math.min(nc, (0, _seeded_1.poisson)(rng, nc * 0.01 * canaryMult)), canaryTotal: nc,
                controlEvents: Math.min(nk, (0, _seeded_1.poisson)(rng, nk * 0.01)), controlTotal: nk,
            },
            p99_ms: { canary: 200 + canaryLatencyShift + 20 * (rng() - 0.5), control: 200 + 20 * (rng() - 0.5) },
        },
    };
}
function run(cfg, rng, mult, shift) {
    let state = (0, twin_gate_1.initTwinGate)(cfg);
    let decision = (0, twin_gate_1.stepTwinGate)(cfg, state, tick(rng, mult, shift)).decision;
    for (let t = 0; t < cfg.maxTicks; t++) {
        const out = (0, twin_gate_1.stepTwinGate)(cfg, state, tick(rng, mult, shift));
        state = out.state;
        decision = out.decision;
        if (decision.verdict !== 'extend')
            break;
    }
    return decision;
}
(0, node_test_1.test)('config: a sign metric at unequal weights is refused', () => {
    strict_1.default.throws(() => (0, twin_gate_1.checkTwinGateConfig)({ ...CFG, canaryWeight: 0.1 }), /equal routing weights/);
});
(0, node_test_1.test)('config: empty metric list and duplicate ids are refused', () => {
    strict_1.default.throws(() => (0, twin_gate_1.checkTwinGateConfig)({ ...CFG, metrics: [] }), RangeError);
    strict_1.default.throws(() => (0, twin_gate_1.checkTwinGateConfig)({ ...CFG, metrics: [CFG.metrics[0], CFG.metrics[0]] }), RangeError);
});
(0, node_test_1.test)('a canary with 3x the error rate is rolled back', () => {
    const d = run(CFG, (0, _seeded_1.lcg)(21), 3, 0);
    strict_1.default.equal(d.verdict, 'rollback');
    strict_1.default.ok(d.tick < 200, `tick ${d.tick}`);
});
(0, node_test_1.test)('a canary 15 ms slower on every tick is rolled back by the sign metric', () => {
    const d = run(CFG, (0, _seeded_1.lcg)(22), 1, 15);
    strict_1.default.equal(d.verdict, 'rollback');
});
(0, node_test_1.test)('identical arms proceed', () => {
    const d = run(CFG, (0, _seeded_1.lcg)(23), 1, 0);
    strict_1.default.equal(d.verdict, 'proceed');
});
(0, node_test_1.test)('a canary receiving no traffic is an invalid experiment', () => {
    const cfg = { ...CFG, metrics: [CFG.metrics[0]] };
    let state = (0, twin_gate_1.initTwinGate)(cfg);
    let verdict = 'extend';
    for (let t = 0; t < 100 && verdict === 'extend'; t++) {
        const out = (0, twin_gate_1.stepTwinGate)(cfg, state, { canaryRequests: 0, controlRequests: 1000, observations: {} });
        state = out.state;
        verdict = out.decision.verdict;
    }
    strict_1.default.equal(verdict, 'invalid_experiment');
});
(0, node_test_1.test)('terminal verdicts are sticky', () => {
    const rng = (0, _seeded_1.lcg)(24);
    let state = (0, twin_gate_1.initTwinGate)(CFG);
    let out = (0, twin_gate_1.stepTwinGate)(CFG, state, tick(rng, 3, 0));
    while (out.decision.verdict === 'extend') {
        state = out.state;
        out = (0, twin_gate_1.stepTwinGate)(CFG, state, tick(rng, 3, 0));
    }
    const after = (0, twin_gate_1.stepTwinGate)(CFG, out.state, tick(rng, 1, 0));
    strict_1.default.equal(after.decision.verdict, out.decision.verdict);
    strict_1.default.equal(after.state.tick, out.state.tick);
});
(0, node_test_1.test)('maxTicks without a decision is inconclusive', () => {
    const cfg = { ...CFG, maxTicks: 3 };
    const d = run(cfg, (0, _seeded_1.lcg)(25), 1, 0);
    strict_1.default.equal(d.verdict, 'inconclusive');
});
(0, node_test_1.test)('rollback threshold is Bonferroni over metrics; proceed is not split', () => {
    const d = (0, twin_gate_1.stepTwinGate)(CFG, (0, twin_gate_1.initTwinGate)(CFG), tick((0, _seeded_1.lcg)(26), 1, 0)).decision;
    strict_1.default.ok(d.metrics.every((m) => m.rollbackThreshold === 2 / 0.01 && m.proceedThreshold === 1 / 0.05));
});
//# sourceMappingURL=twin-gate.test.js.map