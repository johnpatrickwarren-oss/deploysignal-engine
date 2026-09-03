// Amendment v1.C69: the e_detector class. Registered rules, both directions, and the check that
// the three v1 classes are untouched by the class branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreS2, scoreS3, scoreS4, overallVerdict, scoreS1 } from '../lib/score.mjs';
import { arlRule, internalConsistency } from '../lib/guards.mjs';
import { CLASSES, CLASS_INSTRUMENTS, effectiveShift, eDetectorDelayBound, E_DETECTOR_Z } from '../lib/constants.mjs';

const card = {
  detector_id: 'esr', aliases: [], class: 'e_detector',
  guarantee: { regime: { phi_max: 0.9, m_min: 30, null_prefixes: ['N1', 'N2', 'N3', 'N4', 'N7'] } },
  shipped_path: { kind: 'e-detector (SR mixture), no shipped compile path' },
  budget: { participating: false },
  prior_evidence: [],
};
const A = 1e-3;
const arl = (over = {}) => ({ detector: 'esr', null_id: 'N1', phi: 0, alpha_arl: A, T: 20000, n: 2000,
  arl0_T: 1800, arl0_se: 40, verdict: 'not-refuted', __tier: 'T1', __run: 'r1', ...over });
const pw = (over = {}) => ({ detector: 'esr', null_id: 'N1', phi: 0, alpha_arl: A, shift_sigma: 3, detection_rate: 1.0, delay_canonical: 2.5, delay_se: 0.1, censored: 0, verdict: 'POWERED', __tier: 'T1', __run: 'r1', ...over });
const dl = (over = {}) => ({ detector: 'esr', null_id: 'N1', phi: 0, alpha_arl: A, shift_sigma: 1.5, detection_rate: 1.0, delay_canonical: 7.0, delay_se: 0.2, censored: 0, verdict: 'WITHIN_BOUND', __tier: 'T1', __run: 'r1', ...over });

test('the class is registered with its two instruments', () => {
  assert.ok(CLASSES.includes('e_detector'));
  assert.deepEqual(CLASS_INSTRUMENTS.e_detector, ['arl0_T', 'delay_canonical']);
});

test('registered delay bounds at alpha_arl = 1e-3, delta = 1.5: 13.0 / 23.3 / 49.1 / 229.6', () => {
  const expect = { 0: 13.0, 0.3: 23.3, 0.6: 49.1, 0.9: 229.6 };
  for (const [phi, b] of Object.entries(expect)) {
    const got = eDetectorDelayBound(A, effectiveShift(1.5, Number(phi))).bound;
    assert.ok(Math.abs(got - b) < 0.05, `phi ${phi}: ${got} vs ${b}`);
  }
  assert.ok(Math.abs(effectiveShift(1.5, 0.9) - 0.344) < 0.001);
  assert.throws(() => effectiveShift(1, 1), /phi/);
  assert.throws(() => eDetectorDelayBound(0, 1), /alpha_arl/);
});

test('arl rule: cleared, refuted, inconclusive, and inadmissible fields', () => {
  assert.equal(arlRule(arl()).mapped, 'CLEARED');
  assert.equal(arlRule(arl({ arl0_T: 800, arl0_se: 20 })).mapped, 'REFUTED');
  assert.equal(arlRule(arl({ arl0_T: 1020, arl0_se: 30 })).mapped, 'INCONCLUSIVE');
  // exactly at the floor clears: lower bound == 1/alpha
  assert.equal(arlRule(arl({ arl0_T: 1000 + E_DETECTOR_Z * 10, arl0_se: 10 })).mapped, 'CLEARED');
  assert.equal(arlRule(arl({ arl0_se: NaN })).mapped, 'INCONCLUSIVE');
});

test('S2: scored from the fields; an out-of-class null bounds the regime; inconclusive is missing', () => {
  const cells = [arl(), arl({ null_id: 'N3-p09', phi: 0.9 }), arl({ null_id: 'N2-m30', m: 30, arl0_T: 1128, arl0_se: 25 }),
    arl({ null_id: 'N6', arl0_T: 214, arl0_se: 5, verdict: 'FAIL' }), arl({ null_id: 'N8', phi: 0.9, arl0_T: 150, arl0_se: 4, verdict: 'FAIL' }),
    arl({ null_id: 'N7', arl0_T: 1010, arl0_se: 30, verdict: 'INCONCLUSIVE' })];
  const s2 = scoreS2(card, cells);
  assert.equal(s2.status, 'PASS');
  const byNull = Object.fromEntries(s2.perCell.map((c) => [c.null_id, c]));
  assert.equal(byNull.N1.mapped, 'CLEARED');
  assert.equal(byNull['N2-m30'].mapped, 'CLEARED');
  assert.equal(byNull.N6.mapped, 'REFUTED'); assert.equal(byNull.N6.out_of_regime, true);
  assert.equal(byNull.N8.mapped, 'REFUTED'); assert.equal(byNull.N8.out_of_regime, true);
  assert.ok(s2.missing.some((m) => m.null_id === 'N7' && /straddles/.test(m.reason)));
});

test('S2: an in-regime refutation refuses; m below m_min bounds the regime', () => {
  const s2 = scoreS2(card, [arl(), arl({ null_id: 'N3-p06', phi: 0.6, arl0_T: 700, arl0_se: 20, verdict: 'FAIL' })]);
  assert.equal(s2.status, 'REFUTED');
  const s2b = scoreS2(card, [arl(), arl({ null_id: 'N2-m10', m: 10, arl0_T: 700, arl0_se: 20, verdict: 'FAIL' })]);
  assert.equal(s2b.status, 'PASS');
  assert.equal(s2b.perCell.find((c) => c.null_id === 'N2-m10').out_of_regime, true);
});

test('S2: a recorded token that disagrees with the arl rule voids the run', () => {
  const flags = internalConsistency([arl({ arl0_T: 700, arl0_se: 20, verdict: 'not-refuted' })], 'e_detector');
  assert.equal(flags.length, 1);
  const s2 = scoreS2(card, [arl({ arl0_T: 700, arl0_se: 20, verdict: 'not-refuted' }), arl({ null_id: 'N7' })]);
  assert.equal(s2.status, 'VOID');
  assert.equal(internalConsistency([arl()], 'e_detector').length, 0);
});

test('null_prefixes: N1 does not match N10; absent key leaves the three v1 classes untouched', () => {
  const s2 = scoreS2(card, [arl({ null_id: 'N10' })]);
  assert.equal(s2.perCell[0].out_of_regime, true);
  const tm = { ...card, class: 'test_martingale', guarantee: { regime: { phi_max: 0.9, m_min: null } } };
  const cell = { detector: 'esr', null_id: 'N5', phi: 0, verdict: 'CLEARED', increment_estimator: { mean: 1, sd: 0.01, lower95_one_sided: 0.99 }, __tier: 'T1', __run: 'r1' };
  assert.equal(scoreS2(tm, [cell]).perCell[0].out_of_regime, false);
});

test('S3: PASS when powered at 3 sigma and every canonical delay is under D* (iid and phi = 0.9)', () => {
  const s3 = scoreS3(card, [pw(), dl(), pw({ null_id: 'N3-p09', phi: 0.9 }), dl({ null_id: 'N3-p09', phi: 0.9, delay_canonical: 120, delay_se: 3 })]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.delayCells.length, 2);
  assert.ok(Math.abs(s3.delayCells[1].delay_bound - 229.6) < 0.05);
  assert.equal(s3.missing.filter((m) => /not the inertness-floor shift/.test(m.reason)).length, 0);
});

test('S3: SLOW when a canonical delay exceeds its bound, and overall lands on ADVISORY with the cell named', () => {
  const cells = [pw(), dl({ delay_canonical: 12.5, delay_se: 0.5 })];
  const s3 = scoreS3(card, cells);
  assert.equal(s3.status, 'SLOW');
  const s2 = scoreS2(card, [arl()]);
  const o = overallVerdict(card, scoreS1(card), s2, s3, scoreS4(card, { envelopeKeys: [] }));
  assert.equal(o.verdict, 'ADVISORY');
  assert.ok(o.regime.excluded_cells.some((e) => e.mapped === 'SLOW' && e.null_id === 'N1'));
});

test('S3: a censored canonical cell is a gap; an out-of-class canonical cell is not scored; INERT wins over SLOW', () => {
  const s3 = scoreS3(card, [pw(), dl({ censored: 0.05 })]);
  assert.equal(s3.status, 'MISSING');
  assert.ok(s3.missing.some((m) => /censored/.test(m.reason)));
  const s3b = scoreS3(card, [pw(), dl(), dl({ null_id: 'N6', delay_canonical: 500, delay_se: 5 })]);
  assert.equal(s3b.status, 'PASS');
  const s3c = scoreS3(card, [pw({ detection_rate: 0.05 }), dl({ delay_canonical: 50, delay_se: 1 })]);
  assert.equal(s3c.status, 'INERT');
});

test('S3: a 0.75 sigma cell is still an off-shift gap; a canonical cell without delay fields is MISSING', () => {
  const s3 = scoreS3(card, [pw(), dl(), pw({ shift_sigma: 0.75, delay_canonical: 20 })]);
  assert.equal(s3.status, 'PASS');
  assert.ok(s3.missing.some((m) => /shift_sigma=0.75/.test(m.reason)));
  assert.equal(scoreS3(card, [pw()]).status, 'MISSING');
});

test('S4: advisory and unwired PASS; participating or wired REFUSE', () => {
  assert.equal(scoreS4(card, { envelopeKeys: ['family_A_betting_e_process'] }).status, 'PASS');
  assert.equal(scoreS4({ ...card, budget: { participating: true } }, { envelopeKeys: [] }).status, 'REFUSE');
  assert.equal(scoreS4(card, { envelopeKeys: ['esr'] }).status, 'REFUSE');
  assert.ok(!scoreS4(card, { envelopeKeys: [] }).reasons.some((r) => /no envelope wiring/.test(r)));
});

test('overall: the registered golden shape, USE at T1 with S1 MISSING named in reasons', () => {
  const o = overallVerdict(card, scoreS1(card), scoreS2(card, [arl()]), scoreS3(card, [pw(), dl()]), scoreS4(card, { envelopeKeys: [] }));
  assert.equal(o.verdict, 'USE'); assert.equal(o.tier, 'T1');
  assert.ok(o.reasons.some((r) => /S1 reachability/.test(r)));
});
