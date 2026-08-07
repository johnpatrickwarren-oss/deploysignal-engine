import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCard } from '../lib/schema.mjs';
import { CLASS_INSTRUMENTS, tierOfStudy } from '../lib/constants.mjs';

const goodCard = {
  protocol_version: 1,
  detector_id: 'family_A_betting_e_process',
  aliases: ['betting_e_process'],
  family: 'A',
  class: 'test_martingale',
  engine_pin: { version: 'v0.6.6-pre', sha: null },   // null until frozen
  source_files: [{ path: 'detectors/betting-e-process.ts', sha256: null }],
  guarantee: {
    sentence: 'E[e_t|F_{t-1}] <= 1 per tick under H0 given oracle (mu, sigma^2, phi).',
    quantifiers: [{ text: 'per tick', tag: 'empirical', proof_artifact: null }],
    regime: { phi_max: 0.9, m_min: 500, baseline: 'oracle-or-m>=500', nulls: 'N1,N3' },
  },
  shipped_path: { kind: 'wealth process, AR(1) pre-whitened', estimator: 'plug-in mu/sigma/phi', notes: '' },
  budget: { participating: true, alpha_booked: null, resolution_claim: null },
  falsifier: 'increment estimator lower95 > 1.0005 in a claimed-regime cell',
  prior_evidence: [{ stage: 'S2', study: 'detector-audit', runs: 'detector-audit/results/live/seq-*', wiki: 'stats/detector-audit-sequential-2026-08-05' }],
};

test('valid card returns no errors', () => {
  assert.deepEqual(validateCard(goodCard), []);
});

test('unknown class is rejected', () => {
  const errs = validateCard({ ...goodCard, class: 'martingale' });
  assert.ok(errs.some((e) => e.includes('class')));
});

test('quantifier tagged proof requires a proof_artifact', () => {
  const bad = structuredClone(goodCard);
  bad.guarantee.quantifiers = [{ text: 'for any sigma', tag: 'proof', proof_artifact: null }];
  const errs = validateCard(bad);
  assert.ok(errs.some((e) => e.includes('proof_artifact')));
});

test('missing falsifier is rejected', () => {
  const errs = validateCard({ ...goodCard, falsifier: '' });
  assert.ok(errs.some((e) => e.includes('falsifier')));
});

test('class fixes instruments per the protocol table', () => {
  assert.deepEqual(CLASS_INSTRUMENTS.test_martingale, ['increment_estimator']);
  assert.deepEqual(CLASS_INSTRUMENTS.terminal_e_value, ['exceedance', 'mean_above_1']);
  assert.deepEqual(CLASS_INSTRUMENTS.e_process, ['stopped_mean', 'crossing_rate']);
});

test('tier map: clustersynth studies are T2, others T1', () => {
  assert.equal(tierOfStudy('clustersynth-ui'), 'T2');
  assert.equal(tierOfStudy('detector-audit-sequential'), 'T1');
});
