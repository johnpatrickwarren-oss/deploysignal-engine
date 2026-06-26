"use strict";
// test/adr-0020-factor-telemetry.test.ts — the L2→L1 instrumented-telemetry ingestion contract (ADR 0020).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const factor_telemetry_1 = require("../baseline/factor-telemetry");
const ft = (signals, ids, ticks) => ({ signals, factorIds: ids, t0: 1000, dt: 60, ticks });
(0, node_test_1.test)('validateFactorTelemetry: accepts a well-formed telemetry, rejects malformed', () => {
    (0, factor_telemetry_1.validateFactorTelemetry)(ft([[1, 2, 3], [4, 5, 6]], ['cdu-0', 'feed-0'], 3), 3); // ok
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)(ft([[1, 2]], ['a'], 3), 3), /length 2, expected 3/);
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)(ft([[1, 2, 3]], ['a'], 2), 3), /telemetry ticks 2 != analysis grid ticks 3/);
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)(ft([[1, NaN, 3]], ['a'], 3), 3), /non-finite/);
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)(ft([[1, 2, 3], [4, 5, 6]], ['a', 'a'], 3), 3), /duplicate factor id/);
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)({ signals: [[1, 2, 3]], factorIds: ['a'], t0: 0, dt: 0, ticks: 3 }, 3), /dt must be > 0/);
});
(0, node_test_1.test)('resolveFactorMembership: maps factor ids to indices; zero-factor shard ok; unknown id throws', () => {
    const ids = ['cdu-0', 'feed-0', 'pod-0', 'job-7'];
    const m = (0, factor_telemetry_1.resolveFactorMembership)(ids, [['cdu-0', 'feed-0', 'pod-0', 'job-7'], ['cdu-0', 'pod-0'], []]);
    strict_1.default.deepEqual(m, [[0, 1, 2, 3], [0, 2], []]);
    strict_1.default.throws(() => (0, factor_telemetry_1.resolveFactorMembership)(ids, [['cdu-9']]), /unknown factor id "cdu-9"/);
});
(0, node_test_1.test)('alignToGrid: previous-sample-hold', () => {
    // samples at t=1000,1120,1240; grid t0=1000 dt=60 ticks=5 → 1000,1060,1120,1180,1240
    const s = [{ t: 1000, v: 10 }, { t: 1120, v: 20 }, { t: 1240, v: 30 }];
    const g = (0, factor_telemetry_1.alignToGrid)(s, 1000, 60, 5, { method: 'hold' });
    strict_1.default.deepEqual(g, [10, 10, 20, 20, 30]); // hold the most recent at-or-before each grid point
});
(0, node_test_1.test)('alignToGrid: linear interpolation', () => {
    const s = [{ t: 1000, v: 10 }, { t: 1120, v: 20 }];
    const g = (0, factor_telemetry_1.alignToGrid)(s, 1000, 60, 3, { method: 'linear' }); // grid 1000,1060,1120
    strict_1.default.equal(g[0], 10);
    strict_1.default.ok(Math.abs(g[1] - 15) < 1e-9, `midpoint should interpolate to 15; got ${g[1]}`);
    strict_1.default.equal(g[2], 20);
});
(0, node_test_1.test)('alignToGrid: maxGap leaves NaN past the gap (engine never fabricates past the declared gap)', () => {
    const s = [{ t: 1000, v: 10 }]; // only one sample; grid extends well past it
    const g = (0, factor_telemetry_1.alignToGrid)(s, 1000, 60, 4, { method: 'hold', maxGap: 90 }); // 1000,1060,1120,1180
    strict_1.default.equal(g[0], 10); // exact
    strict_1.default.equal(g[1], 10); // 60 ≤ 90 → held
    strict_1.default.ok(Number.isNaN(g[2])); // 120 > 90 → NaN
    strict_1.default.ok(Number.isNaN(g[3]));
    // and such a column is rejected by validation (forces the product to handle the gap)
    strict_1.default.throws(() => (0, factor_telemetry_1.validateFactorTelemetry)(ft([g], ['a'], 4), 4), /non-finite/);
});
//# sourceMappingURL=adr-0020-factor-telemetry.test.js.map