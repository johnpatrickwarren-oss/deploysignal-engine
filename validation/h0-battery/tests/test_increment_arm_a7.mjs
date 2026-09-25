// tests/test_increment_arm_a7.mjs — Amendment A7.5.2: the arm's smoke checks before any sweep, the
// finite-N5 check (Correction 2), and the cell vocabulary (increment_estimator + trajectory_estimator,
// no other stage key).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureCell, generatorChecks, registeredPrediction, SPECS, CONSTRUCTIONS, STUDY_ID, BOUND, DIVERGENCE_BOUND } from '../harness/run-increment-arm-a7.mjs';

test('the arm is registered: study id, five nulls, two constructions driving the battery adapters, the bounds', () => {
  assert.equal(STUDY_ID, '2026-09-h0-battery-family-a-increment');
  assert.deepEqual(SPECS.map((s) => s.id), ['N1', 'N3-p09', 'N5', 'N6', 'N8']);
  assert.deepEqual(CONSTRUCTIONS.map((c) => c.id), ['family_A_betting_e_process', 'family_A_mixture_supermartingale']);
  for (const c of CONSTRUCTIONS) { assert.ok(c.adapter, c.id); assert.equal(c.cellId, `${c.id}_increment`); }
  assert.equal(BOUND, 1.0005); assert.equal(DIVERGENCE_BOUND, 1e4);
});

test('A7.4.3: the standardised generators have unit variance to within 3%, and every N5 draw is finite (Correction 2 cannot recur)', () => {
  const { variances, n5NonFinite } = generatorChecks();
  for (const [id, v] of Object.entries(variances)) assert.ok(Math.abs(v - 1) <= 0.03, `${id}: ${v.toFixed(4)}`);
  assert.equal(n5NonFinite, 0);
});

test('A7.3 predictions as registered', () => {
  assert.equal(registeredPrediction('N5', 'family_A_betting_e_process').value.toFixed(5), '1.00105');
  assert.equal(registeredPrediction('N6', 'family_A_betting_e_process').value, 1);
  assert.equal(registeredPrediction('N6', 'family_A_mixture_supermartingale').expected, 'DIVERGENT');
  assert.equal(registeredPrediction('N3-p09', 'family_A_mixture_supermartingale').value, 1);
});

test('smoke: betting on N1 at small size sits at 1 and is not REFUTED; the mixture on N1 likewise', () => {
  const n1 = SPECS[0];
  const b = measureCell(n1, CONSTRUCTIONS[0], 200, 500);
  assert.ok(Math.abs(b.trajectory_estimator.mean - 1) < 0.002, `betting N1 ${b.trajectory_estimator.mean}`);
  assert.notEqual(b.verdict, 'REFUTED');
  const m = measureCell(n1, CONSTRUCTIONS[1], 200, 500);
  assert.ok(Math.abs(m.trajectory_estimator.mean - 1) < 0.01, `mixture N1 ${m.trajectory_estimator.mean}`);
  assert.notEqual(m.verdict, 'REFUTED');
});

test('smoke: a verified divergence — the mixture on t3 (N6) at small size reads far above 1 with a heavy-tail tell', () => {
  const c = measureCell(SPECS.find((s) => s.id === 'N6'), CONSTRUCTIONS[1], 40, 300);
  assert.ok(c.increment_estimator.mean > 10, `N6 mixture pooled mean ${c.increment_estimator.mean}`);
  assert.ok(c.increment_estimator.maxToMean > 10);
});

test('the cell carries increment_estimator and trajectory_estimator and no other stage key; predictions attached', () => {
  const c = measureCell(SPECS[0], CONSTRUCTIONS[0], 5, 50);
  assert.ok('increment_estimator' in c && 'trajectory_estimator' in c);
  for (const k of ['stopped_mean', 'exceedance', 'crossing_rate', 'mean_e', 'arl0_T', 'delay_canonical']) assert.ok(!(k in c), k);
  assert.equal(c.registered_prediction, 1); assert.equal(c.registered_expectation, 'CLEARED');
  assert.equal(c.non_finite_increments, 0);
});
