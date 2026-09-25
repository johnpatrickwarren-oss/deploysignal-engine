// tests/test_increment_arm.mjs — Amendment A6.5.2: the arm's smoke checks before any sweep, and
// the cell vocabulary (increment_estimator is scorer-readable; no other stage key is present).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureCell, generatorVarianceCheck, registeredPrediction, SPECS, KINDS, STUDY_ID, BOUND } from '../harness/run-increment-arm.mjs';
import { standardiser } from '../harness/detectors.mjs';

test('the arm is registered: study id, five nulls, nine kinds, the card bound', () => {
  assert.equal(STUDY_ID, '2026-09-h0-battery-onset-mixture-increment');
  assert.deepEqual(SPECS.map((s) => s.id), ['N1', 'N3-p09', 'N5', 'N6', 'N8']);
  assert.equal(KINDS.length, 9); assert.equal(KINDS[0].id, 'gaussian');
  assert.equal(BOUND, 1.0005);
  assert.equal(typeof standardiser, 'function');
});

test('A6.4.3: the standardised generators have unit variance to within 3% (200,000 draws)', () => {
  for (const [id, v] of Object.entries(generatorVarianceCheck())) assert.ok(Math.abs(v - 1) <= 0.03, `${id}: ${v.toFixed(4)}`);
});

test('smoke: on N1 at small size the Gaussian increment mean sits near the derived 0.99775 and no cell is REFUTED', () => {
  const n1 = SPECS[0];
  // 300,000 increments: the capped Gaussian increment has sd ≈ 1.5 (the cap's tail), so this is ~7 se.
  const g = measureCell(n1, KINDS[0], 300, 1000);
  assert.ok(Math.abs(g.increment_estimator.mean - 0.99775) < 0.02, `gaussian N1 mean ${g.increment_estimator.mean}`);
  assert.notEqual(g.verdict, 'REFUTED');
  const b = measureCell(n1, KINDS.find((k) => k.id === 'bounded_lp09'), 300, 1000);
  assert.ok(Math.abs(b.increment_estimator.mean - 1) < 0.01);
  assert.notEqual(b.verdict, 'REFUTED');
});

test('smoke: a verified refutation — the Gaussian increment on t3 (N6) reads far above 1 at small size', () => {
  const c = measureCell(SPECS.find((s) => s.id === 'N6'), KINDS[0], 40, 500);
  assert.ok(c.increment_estimator.mean > 1.2, `N6 gaussian mean ${c.increment_estimator.mean}`);
  assert.equal(c.verdict, 'REFUTED');
});

test('the cell carries the scorer-readable increment_estimator and no other stage key; predictions are attached', () => {
  const c = measureCell(SPECS[0], KINDS[1], 5, 50);
  assert.ok('increment_estimator' in c);
  for (const k of ['stopped_mean', 'exceedance', 'crossing_rate', 'mean_e', 'arl0_T', 'delay_canonical']) assert.ok(!(k in c), k);
  assert.equal(c.registered_prediction, 1);
  assert.equal(registeredPrediction('N5', KINDS.find((k) => k.id === 'bounded_lm09')).value.toFixed(5), '1.00832');
  assert.equal(registeredPrediction('N6', KINDS[0]).value, 1.61281);
  assert.equal(registeredPrediction('N3-p09', KINDS[0]).value, 0.99775);
});
