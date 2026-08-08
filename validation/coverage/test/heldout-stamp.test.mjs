// validation/coverage/test/heldout-stamp.test.mjs
//
// Failing-first test for stampHeldoutFamilyE (Task 7, coverage-matrix-v1). This is
// a validity smoke check, not the registered K4 endpoint (that is Task 8/9's job):
// does the held-out-calibrated hedged-indicator e-value fire its tail indicator at
// rate ~alpha on fresh healthy draws, the way any correctly-calibrated tail
// indicator must (PREREGISTRATION.md Amendment A2: P(indicator=1|H0) = alpha_E by
// construction of the weighted rank).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampHeldoutFamilyE, HELDOUT_MIN_ROWS } from '../../../tools/stamp-heldout-family-e.mjs';
import { rng, gaussFrom } from '../lib/inject.mjs';
import { freshConformalEValueState, evaluateConformalWeightedEValue } from '../../../dist/detectors/conformal.js';

const ALPHA = 0.05;

test('stampHeldoutFamilyE throws below the registered n >= 10,000 floor (PREREGISTRATION.md A1)', () => {
  assert.throws(
    () => stampHeldoutFamilyE({ calibrationRows: new Array(9999).fill(0), alpha: ALPHA }),
    /10,?000/,
  );
});

test('stampHeldoutFamilyE throws on an out-of-range alpha', () => {
  const rows = new Array(HELDOUT_MIN_ROWS).fill(0);
  assert.throws(() => stampHeldoutFamilyE({ calibrationRows: rows, alpha: 0 }), /alpha/);
  assert.throws(() => stampHeldoutFamilyE({ calibrationRows: rows, alpha: 1.5 }), /alpha/);
});

test('stampHeldoutFamilyE returns weighted_e_value params shaped for evaluateConformalWeightedEValue', () => {
  const rows = new Array(HELDOUT_MIN_ROWS).fill(0).map((_, i) => (i % 7) - 3);
  const params = stampHeldoutFamilyE({ calibrationRows: rows, alpha: ALPHA });
  assert.equal(params.kind, 'weighted_e_value');
  assert.equal(params.scores.length, HELDOUT_MIN_ROWS);
  assert.equal(params.weights.length, HELDOUT_MIN_ROWS);
  assert.equal(params.cumulative_weights_above.length, HELDOUT_MIN_ROWS);
  // scores sorted ascending (conformal.ts's findFirstGE requires this)
  for (let i = 1; i < params.scores.length; i++) assert.ok(params.scores[i] >= params.scores[i - 1]);
  // element 0 of the reverse-cumulative weight sum equals total_weight
  assert.equal(params.cumulative_weights_above[0], params.total_weight);
  assert.equal(params.total_weight, HELDOUT_MIN_ROWS); // unweighted rows: total_weight == n
});

test('validity smoke: indicator rate on 2,000 fresh healthy draws lands within [0.03, 0.07] at alpha=0.05', () => {
  // Calibration: n=10,000 N(0,1) held-out rows. Seeds here are smoke-test-local, not
  // the registered HELDOUT_SEED=20760838 stream (PREREGISTRATION.md A1/Amendment
  // v1.2 item 1) -- that seed drives the actual battery run in a later task.
  const calR = rng(99991);
  const calGauss = gaussFrom(calR);
  const calibrationRows = Array.from({ length: HELDOUT_MIN_ROWS }, () => calGauss());
  const params = stampHeldoutFamilyE({ calibrationRows, alpha: ALPHA });

  // 2,000 fresh healthy draws, independent stream from the calibration draws above.
  const liveR = rng(31337);
  const liveGauss = gaussFrom(liveR);
  const N = 2000;
  let indicatorCount = 0;
  for (let i = 0; i < N; i++) {
    const v = liveGauss();
    const state = freshConformalEValueState();
    evaluateConformalWeightedEValue({ params, covariance: [[1]], alpha: ALPHA }, [v], state);
    // e_t = 1 + indicator - alpha (conformal.ts:434). state.M starts at 1, so after
    // exactly one tick state.M === e_t: indicator=0 => e_t = 1-alpha < 1;
    // indicator=1 => e_t = 2-alpha > 1. Recovering indicator this way exercises the
    // real evaluator black-box rather than re-deriving the rank locally.
    if (state.M > 1) indicatorCount++;
  }
  const rate = indicatorCount / N;
  assert.ok(
    rate >= 0.03 && rate <= 0.07,
    `indicator rate ${rate} (${indicatorCount}/${N}) outside [0.03, 0.07] at alpha=${ALPHA}`,
  );
});
