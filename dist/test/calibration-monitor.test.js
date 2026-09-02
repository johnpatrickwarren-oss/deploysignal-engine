"use strict";
// test/calibration-monitor.test.ts — the engine port of Tessera's runtime calibration monitor
// (tessera/test/calibration-monitor.test.ts, same streams and seeds) plus the increment
// estimator. The monitor must (a) stay PASSING on a genuinely-null reference stream and
// (b) REVOKE, sticky, on a mis-calibrated one; the estimator must refute an inflated increment
// and must NOT claim validity from a reading at 1.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const calibration_monitor_1 = require("../fleet/calibration-monitor");
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function nullStream(seed, n) {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, () => gaussian(rng));
}
function driftStream(seed, n, mu) {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, () => mu + gaussian(rng));
}
function scaledStream(seed, n, scale) {
    const rng = mulberry32(seed);
    return Array.from({ length: n }, () => scale * gaussian(rng));
}
(0, node_test_1.test)('stays PASSING on a genuinely-null N(0,1) reference stream', () => {
    const m = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    (0, calibration_monitor_1.updateCalibrationBatch)(m, nullStream(424242, 5000));
    strict_1.default.equal(m.passing, true);
    strict_1.default.ok(m.peakLogW < m.threshold);
    const v = (0, calibration_monitor_1.calibrationVerdict)(m);
    strict_1.default.equal(v.passing, true);
    strict_1.default.ok(v.eValue < v.revokeAt);
});
(0, node_test_1.test)('REVOKES quickly on a drifted N(1,1) stream', () => {
    const m = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    let revokedAt = -1;
    for (const r of driftStream(12345, 5000, 1.0)) {
        (0, calibration_monitor_1.updateCalibration)(m, r);
        if (!m.passing && revokedAt < 0)
            revokedAt = m.ticks;
    }
    strict_1.default.equal(m.passing, false);
    strict_1.default.ok(revokedAt > 0 && revokedAt < 100, `should revoke quickly, got tick ${revokedAt}`);
    strict_1.default.ok((0, calibration_monitor_1.calibrationVerdict)(m).eValue >= (0, calibration_monitor_1.calibrationVerdict)(m).revokeAt);
});
(0, node_test_1.test)('revocation is STICKY', () => {
    const m = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    (0, calibration_monitor_1.updateCalibrationBatch)(m, driftStream(7, 200, 1.0));
    strict_1.default.equal(m.passing, false);
    (0, calibration_monitor_1.updateCalibrationBatch)(m, nullStream(99, 5000));
    strict_1.default.equal(m.passing, false, 'anytime-valid evidence does not un-accumulate');
});
(0, node_test_1.test)('applyCalibrationMonitor is contract-agnostic and pools several streams', () => {
    const contract = { id: 'x', validityClass: 'construction_valid' };
    const ok = (0, calibration_monitor_1.applyCalibrationMonitor)(contract, nullStream(424242, 5000));
    strict_1.default.equal(ok.contract.calibrationMonitorPassing, true);
    strict_1.default.equal(ok.contract.id, 'x', 'other fields survive');
    const broken = (0, calibration_monitor_1.applyCalibrationMonitor)(contract, [nullStream(1, 1500), driftStream(2, 1500, 1.2), nullStream(3, 1500)]);
    strict_1.default.equal(broken.contract.calibrationMonitorPassing, false, 'one drifted shard breaks the pooled cohort');
});
(0, node_test_1.test)('rejects an invalid alpha', () => {
    strict_1.default.throws(() => (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0 }), /alpha must be/);
    strict_1.default.throws(() => (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 1.5 }), /alpha must be/);
});
(0, node_test_1.test)('ADR 0027 coherence: a 1.5× scale error revokes the GAUSSIAN monitor but not the BOUNDED default', () => {
    const s = scaledStream(11, 4000, 1.5);
    const g = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01, incrementKind: 'gaussian' });
    const b = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    (0, calibration_monitor_1.updateCalibrationBatch)(g, s);
    (0, calibration_monitor_1.updateCalibrationBatch)(b, s);
    strict_1.default.equal(g.passing, false);
    strict_1.default.equal(b.passing, true, `bounded monitor must NOT falsely demote (peak ${b.peakLogW.toFixed(2)})`);
});
(0, node_test_1.test)('the bounded monitor still catches a center shift, and stays passing on a long clean null', () => {
    const m = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    (0, calibration_monitor_1.updateCalibrationBatch)(m, driftStream(13, 4000, 0.5));
    strict_1.default.equal(m.passing, false);
    const clean = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01 });
    (0, calibration_monitor_1.updateCalibrationBatch)(clean, nullStream(17, 6000));
    strict_1.default.equal(clean.passing, true);
});
(0, node_test_1.test)('increments: gBounded is a unit bet on a symmetric clipped residual; gInc is capped', () => {
    for (const lam of calibration_monitor_1.BOUND_LAMBDAS) {
        strict_1.default.ok(Math.abs((0, calibration_monitor_1.gBounded)(3, lam) + (0, calibration_monitor_1.gBounded)(-3, lam) - 2) < 1e-12);
        strict_1.default.ok((0, calibration_monitor_1.gBounded)(100, lam) > 0);
    }
    strict_1.default.ok((0, calibration_monitor_1.gInc)(50) <= 100);
});
// ── increment estimator ──────────────────────────────────────────────────────────
(0, node_test_1.test)('increment estimator: an exact mean-1 martingale increment reads 1 and is NOT refuted', () => {
    // e_t = exp(z − σ²/2), z ~ N(0, σ²): E[e_t] = 1 by construction (the control from
    // stats/terminal-mean-is-not-measurable).
    const rng = mulberry32(2026);
    const s = (0, calibration_monitor_1.freshIncrementEstimator)();
    const sigma = 0.3;
    for (let i = 0; i < 20000; i++)
        (0, calibration_monitor_1.updateIncrementEstimator)(s, sigma * gaussian(rng) - sigma * sigma / 2);
    const est = (0, calibration_monitor_1.incrementEstimate)(s);
    strict_1.default.equal(est.n, 20000);
    strict_1.default.ok(est.lower95 < 1 && est.upper95 > 1, `interval [${est.lower95}, ${est.upper95}] must cover 1`);
    strict_1.default.equal(est.refutedAboveOne, false);
});
(0, node_test_1.test)('increment estimator: a 5% inflated increment is refuted at 95%', () => {
    const rng = mulberry32(99);
    const s = (0, calibration_monitor_1.freshIncrementEstimator)();
    const sigma = 0.3;
    for (let i = 0; i < 20000; i++) {
        (0, calibration_monitor_1.updateIncrementEstimator)(s, Math.log(1.05) + sigma * gaussian(rng) - sigma * sigma / 2);
    }
    const est = (0, calibration_monitor_1.incrementEstimate)(s);
    strict_1.default.ok(est.lower95 > 1, `lower95 ${est.lower95} should exceed 1`);
    strict_1.default.equal(est.refutedAboveOne, true);
});
(0, node_test_1.test)('increment estimator: non-finite increments are skipped and n < 2 yields NaN bounds', () => {
    const s = (0, calibration_monitor_1.freshIncrementEstimator)();
    (0, calibration_monitor_1.updateIncrementEstimator)(s, NaN);
    (0, calibration_monitor_1.updateIncrementEstimator)(s, Infinity);
    strict_1.default.equal(s.n, 0);
    (0, calibration_monitor_1.updateIncrementEstimator)(s, 0);
    const one = (0, calibration_monitor_1.incrementEstimate)(s);
    strict_1.default.equal(one.n, 1);
    strict_1.default.ok(Number.isNaN(one.lower95));
    strict_1.default.equal(one.refutedAboveOne, false);
});
//# sourceMappingURL=calibration-monitor.test.js.map