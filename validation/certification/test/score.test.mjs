import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreS2, scoreS3, scoreS4, overallVerdict } from '../lib/score.mjs';

const card = {
  detector_id: 'd', aliases: [], class: 'test_martingale',
  guarantee: { regime: { phi_max: 0.9, m_min: 500 } },
  shipped_path: { kind: 'wealth process', notes: '' },
  budget: { participating: true },
  prior_evidence: [{ stage: 'S1', study: 'x', wiki: 'y' }],
};
const vCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, verdict: 'CLEARED',
  increment_estimator: { mean: 1.0, sd: 0.001, lower95_one_sided: 0.999 }, crossing_rate: 0, __tier: 'T1', ...over });
const pCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, shift_sigma: 3,
  detection_rate: 1.0, verdict: 'POWERED', __tier: 'T1', ...over });

test('S2 takes the worst in-regime cell; out-of-regime REFUTED does not fail it', () => {
  const s2 = scoreS2(card, [vCell(), vCell({ null_id: 'N4', phi: 0.99, verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'PASS');
  assert.ok(s2.perCell.find((c) => c.null_id === 'N4').out_of_regime);
});

test('S2 in-regime REFUTED fails the stage', () => {
  const s2 = scoreS2(card, [vCell({ verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'REFUTED');
});

test('S2 vacuous cell cannot pass: becomes NOT-EXECUTABLE per cell', () => {
  const s2 = scoreS2(card, [vCell({ increment_estimator: { mean: 1, sd: 0, lower95_one_sided: 1 } })]);
  assert.equal(s2.perCell[0].mapped, 'NOT_EXECUTABLE');
  assert.equal(s2.status, 'MISSING'); // no scoreable in-regime cell survived
});

test('S3 flags inert below the floor', () => {
  const s3 = scoreS3(card, [pCell({ detection_rate: 0.05, verdict: 'INERT' })]);
  assert.equal(s3.status, 'INERT');
});

test('S4 refuses a participating p-value path', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } });
  assert.equal(s4.status, 'REFUSE');
});

test('S4 marks unmeasured bootstrap substitution UNPRICED', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'wealth process, bootstrap threshold substitution ~2.4e4x' } });
  assert.equal(s4.status, 'UNPRICED');
});

test('overall: clean stages give USE at the evidence tier', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell()]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'USE');
  assert.equal(v.tier, 'T1');
});

test('overall: valid-but-inert is ADVISORY, never USE', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell()]), scoreS3(card, [pCell({ detection_rate: 0.0, verdict: 'INERT' })]), scoreS4(card));
  assert.equal(v.verdict, 'ADVISORY');
});

test('overall: in-regime refutation is REFUSE', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell({ verdict: 'REFUTED' })]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'REFUSE');
});
