// validation/certification/test/coverage-score.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAULT_CLASSES, COVERAGE_FLOOR } from '../lib/constants.mjs';
import { coverageFor } from '../lib/score.mjs';

const card = {
  detector_id: 'safe_t_e_value', aliases: ['safe_t'], class: 'terminal_e_value',
  guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } },
  budget: { participating: true }, prior_evidence: [],
};
const pcell = (over = {}) => ({ detector: 'safe_t', fault_class: 'K1', severity: '1.5sigma',
  canonical: true, detection_rate: 0.86, shift_sigma: null, phi: 0, __tier: 'T1', verdict: 'POWERED', ...over });

test('registry: six classes, frozen shape', () => {
  assert.deepEqual(Object.keys(FAULT_CLASSES), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);
  assert.equal(FAULT_CLASSES.K1.canonical, '1.5sigma');
  assert.equal(FAULT_CLASSES.K2.canonical, 'K10-e0.5sigma');
  assert.equal(FAULT_CLASSES.K3.canonical, 'A0.75sigma-f0.05');
  assert.equal(FAULT_CLASSES.K4.canonical, '5sigma-point');
  assert.equal(FAULT_CLASSES.K5.canonical, 'slope1e-4');
  assert.equal(FAULT_CLASSES.K6.canonical, 'mix-d1.5');
  assert.equal(COVERAGE_FLOOR, 0.50);
});

test('COVERED when canonical cell at or above floor', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K1.status, 'COVERED');
  assert.equal(cov.K1.canonical.rate, 0.86);
});

test('NOT_POWERED below floor at canonical; grid cells reported but not deciding', () => {
  const cov = coverageFor(card, [pcell({ detection_rate: 0.31 }), pcell({ severity: '3sigma', canonical: false, detection_rate: 0.99 })]);
  assert.equal(cov.K1.status, 'NOT_POWERED');
  assert.equal(cov.K1.cells.length, 2);
});

test('NO_EVIDENCE when a class has no fault_class cells', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K3.status, 'NO_EVIDENCE');
});

test('cells without fault_class are ignored by coverage (legacy S3 evidence)', () => {
  const legacy = { detector: 'safe_t', shift_sigma: 3, detection_rate: 0.96, __tier: 'T1', verdict: 'pass' };
  const cov = coverageFor(card, [legacy]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});

test('guards apply: non-finite coverage cell is excluded, not counted', () => {
  const cov = coverageFor(card, [pcell({ non_finite_wealth: 12 })]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});
