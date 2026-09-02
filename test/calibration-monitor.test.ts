// test/calibration-monitor.test.ts — the engine port of Tessera's runtime calibration monitor
// (tessera/test/calibration-monitor.test.ts, same streams and seeds) plus the increment
// estimator. The monitor must (a) stay PASSING on a genuinely-null reference stream and
// (b) REVOKE, sticky, on a mis-calibrated one; the estimator must refute an inflated increment
// and must NOT claim validity from a reading at 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshCalibrationMonitor, updateCalibration, updateCalibrationBatch, calibrationVerdict,
  applyCalibrationMonitor, gBounded, gInc, BOUND_LAMBDAS,
  freshIncrementEstimator, updateIncrementEstimator, incrementEstimate,
} from '../fleet/calibration-monitor';

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function nullStream(seed: number, n: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => gaussian(rng));
}
function driftStream(seed: number, n: number, mu: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => mu + gaussian(rng));
}
function scaledStream(seed: number, n: number, scale: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => scale * gaussian(rng));
}

test('stays PASSING on a genuinely-null N(0,1) reference stream', () => {
  const m = freshCalibrationMonitor({ alpha: 0.01 });
  updateCalibrationBatch(m, nullStream(424242, 5000));
  assert.equal(m.passing, true);
  assert.ok(m.peakLogW < m.threshold);
  const v = calibrationVerdict(m);
  assert.equal(v.passing, true);
  assert.ok(v.eValue < v.revokeAt);
});

test('REVOKES quickly on a drifted N(1,1) stream', () => {
  const m = freshCalibrationMonitor({ alpha: 0.01 });
  let revokedAt = -1;
  for (const r of driftStream(12345, 5000, 1.0)) {
    updateCalibration(m, r);
    if (!m.passing && revokedAt < 0) revokedAt = m.ticks;
  }
  assert.equal(m.passing, false);
  assert.ok(revokedAt > 0 && revokedAt < 100, `should revoke quickly, got tick ${revokedAt}`);
  assert.ok(calibrationVerdict(m).eValue >= calibrationVerdict(m).revokeAt);
});

test('revocation is STICKY', () => {
  const m = freshCalibrationMonitor({ alpha: 0.01 });
  updateCalibrationBatch(m, driftStream(7, 200, 1.0));
  assert.equal(m.passing, false);
  updateCalibrationBatch(m, nullStream(99, 5000));
  assert.equal(m.passing, false, 'anytime-valid evidence does not un-accumulate');
});

test('applyCalibrationMonitor is contract-agnostic and pools several streams', () => {
  const contract = { id: 'x', validityClass: 'construction_valid' as const };
  const ok = applyCalibrationMonitor(contract, nullStream(424242, 5000));
  assert.equal(ok.contract.calibrationMonitorPassing, true);
  assert.equal(ok.contract.id, 'x', 'other fields survive');
  const broken = applyCalibrationMonitor(contract, [nullStream(1, 1500), driftStream(2, 1500, 1.2), nullStream(3, 1500)]);
  assert.equal(broken.contract.calibrationMonitorPassing, false, 'one drifted shard breaks the pooled cohort');
});

test('rejects an invalid alpha', () => {
  assert.throws(() => freshCalibrationMonitor({ alpha: 0 }), /alpha must be/);
  assert.throws(() => freshCalibrationMonitor({ alpha: 1.5 }), /alpha must be/);
});

test('ADR 0027 coherence: a 1.5× scale error revokes the GAUSSIAN monitor but not the BOUNDED default', () => {
  const s = scaledStream(11, 4000, 1.5);
  const g = freshCalibrationMonitor({ alpha: 0.01, incrementKind: 'gaussian' });
  const b = freshCalibrationMonitor({ alpha: 0.01 });
  updateCalibrationBatch(g, s);
  updateCalibrationBatch(b, s);
  assert.equal(g.passing, false);
  assert.equal(b.passing, true, `bounded monitor must NOT falsely demote (peak ${b.peakLogW.toFixed(2)})`);
});

test('the bounded monitor still catches a center shift, and stays passing on a long clean null', () => {
  const m = freshCalibrationMonitor({ alpha: 0.01 });
  updateCalibrationBatch(m, driftStream(13, 4000, 0.5));
  assert.equal(m.passing, false);
  const clean = freshCalibrationMonitor({ alpha: 0.01 });
  updateCalibrationBatch(clean, nullStream(17, 6000));
  assert.equal(clean.passing, true);
});

test('increments: gBounded is a unit bet on a symmetric clipped residual; gInc is capped', () => {
  for (const lam of BOUND_LAMBDAS) {
    assert.ok(Math.abs(gBounded(3, lam) + gBounded(-3, lam) - 2) < 1e-12);
    assert.ok(gBounded(100, lam) > 0);
  }
  assert.ok(gInc(50) <= 100);
});

// ── increment estimator ──────────────────────────────────────────────────────────

test('increment estimator: an exact mean-1 martingale increment reads 1 and is NOT refuted', () => {
  // e_t = exp(z − σ²/2), z ~ N(0, σ²): E[e_t] = 1 by construction (the control from
  // stats/terminal-mean-is-not-measurable).
  const rng = mulberry32(2026);
  const s = freshIncrementEstimator();
  const sigma = 0.3;
  for (let i = 0; i < 20000; i++) updateIncrementEstimator(s, sigma * gaussian(rng) - sigma * sigma / 2);
  const est = incrementEstimate(s);
  assert.equal(est.n, 20000);
  assert.ok(est.lower95 < 1 && est.upper95 > 1, `interval [${est.lower95}, ${est.upper95}] must cover 1`);
  assert.equal(est.refutedAboveOne, false);
});

test('increment estimator: a 5% inflated increment is refuted at 95%', () => {
  const rng = mulberry32(99);
  const s = freshIncrementEstimator();
  const sigma = 0.3;
  for (let i = 0; i < 20000; i++) {
    updateIncrementEstimator(s, Math.log(1.05) + sigma * gaussian(rng) - sigma * sigma / 2);
  }
  const est = incrementEstimate(s);
  assert.ok(est.lower95 > 1, `lower95 ${est.lower95} should exceed 1`);
  assert.equal(est.refutedAboveOne, true);
});

test('increment estimator: non-finite increments are skipped and n < 2 yields NaN bounds', () => {
  const s = freshIncrementEstimator();
  updateIncrementEstimator(s, NaN);
  updateIncrementEstimator(s, Infinity);
  assert.equal(s.n, 0);
  updateIncrementEstimator(s, 0);
  const one = incrementEstimate(s);
  assert.equal(one.n, 1);
  assert.ok(Number.isNaN(one.lower95));
  assert.equal(one.refutedAboveOne, false);
});
