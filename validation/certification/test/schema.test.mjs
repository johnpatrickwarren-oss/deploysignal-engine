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
  // C1: the terminal class's second instrument is the MEAN, and its field name in every
  // run that records one is `mean_e` (terminal-evalue/harness/run.mjs:95). This table read
  // `mean_above_1` until 2026-08-07 -- the protocol's English ("mean above 1") mistaken
  // for a field name, matching no cell in the corpus.
  assert.deepEqual(CLASS_INSTRUMENTS.terminal_e_value, ['exceedance', 'mean_e']);
  assert.deepEqual(CLASS_INSTRUMENTS.e_process, ['stopped_mean', 'crossing_rate']);
});

test('tier map: clustersynth studies are T2, others T1', () => {
  assert.equal(tierOfStudy('clustersynth-ui'), 'T2');
  assert.equal(tierOfStudy('detector-audit-sequential'), 'T1');
});

// Minor: the tier map had no T3 branch, so a real-telemetry run would have scored as a
// house-synthetic T1 claim -- the over-claim the tier labels exist to stop. Two mechanical
// routes to T3, manifest declaration first.
test('tier map: a manifest tier declaration wins over the name', () => {
  assert.equal(tierOfStudy('clustersynth-ui', 'T3'), 'T3');
  assert.equal(tierOfStudy('detector-audit-sequential', 'T2'), 'T2');
  assert.throws(() => tierOfStudy('x', 'T9'), /unregistered tier/);
});

test('tier map: a study whose name carries the real token is T3', () => {
  assert.equal(tierOfStudy('real-telemetry-gwdg'), 'T3');
  assert.equal(tierOfStudy('gwdg_real'), 'T3');
  assert.equal(tierOfStudy('nab-per-dataset real'), 'T3');
});

test('tier map: the real token is boundary-bounded, not a bare substring', () => {
  assert.equal(tierOfStudy('realignment-study'), 'T1');
  assert.equal(tierOfStudy('unrealistic-nulls'), 'T1');
});
