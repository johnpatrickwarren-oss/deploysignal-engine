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
const eCard = { ...card, class: 'e_process', guarantee: { regime: { phi_max: 0.99, m_min: null } } };

const vCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, verdict: 'CLEARED',
  increment_estimator: { mean: 1.0, sd: 0.001, lower95_one_sided: 0.999 }, crossing_rate: 0, __tier: 'T1', ...over });
const pCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, shift_sigma: 3,
  detection_rate: 1.0, verdict: 'POWERED', __tier: 'T1', ...over });
// The CONTROL_power power-control shape from terminal-evalue runs (safe_t,
// universal_inference): no null_id, records the power number as rate_e_ge_20 instead
// of detection_rate.
const rateCell = (over = {}) => ({ control: 'power', detector: 'd', shift_sigma: 3,
  rate_e_ge_20: 0.960975, verdict: 'pass', mode: 'live', __tier: 'T1', ...over });

test('S2 takes the worst in-regime cell; out-of-regime REFUTED does not fail it', () => {
  const s2 = scoreS2(card, [vCell(), vCell({ null_id: 'N4', phi: 0.99, verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'PASS');
  assert.ok(s2.perCell.find((c) => c.null_id === 'N4').out_of_regime);
});

test('S2 in-regime REFUTED fails the stage', () => {
  const s2 = scoreS2(card, [vCell({ verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'REFUTED');
});

// Finding 1: mapped is an explicit vocabulary, not identity. The corpus's dominant
// clearance token is 'not-refuted' -- it must map to CLEARED, not be discarded.
test('S2 maps the corpus not-refuted token to CLEARED', () => {
  const s2 = scoreS2(card, [vCell({ verdict: 'not-refuted' })]);
  assert.equal(s2.status, 'PASS');
  assert.equal(s2.perCell[0].mapped, 'CLEARED');
});

test('S2 routes an unmapped verdict token to missing[], never drops it silently', () => {
  const s2 = scoreS2(card, [vCell({ verdict: 'inconclusive' })]);
  assert.equal(s2.status, 'MISSING');
  assert.equal(s2.missing.length, 1);
  assert.equal(s2.missing[0].null_id, 'N1');
  assert.match(s2.missing[0].reason, /unmapped verdict token inconclusive/);
});

// Promoted minor 6: vacuous cells are evidence gaps (missing[]), not per-cell verdicts.
// A stage can still PASS on other cleared cells alongside a vacuous one.
test('S2 vacuous cell is an evidence gap in missing[]; the stage can still pass on other cells', () => {
  const s2 = scoreS2(card, [
    vCell({ increment_estimator: { mean: 1, sd: 0, lower95_one_sided: 1 } }),
    vCell({ null_id: 'N2', verdict: 'not-refuted' }),
  ]);
  assert.equal(s2.missing.length, 1);
  assert.equal(s2.missing[0].null_id, 'N1');
  assert.match(s2.missing[0].reason, /vacuous: wealth never moved/);
  assert.equal(s2.perCell.length, 1);
  assert.equal(s2.status, 'PASS');
});

test('S2 vacuous-only evidence cannot pass: MISSING, not PASS', () => {
  const s2 = scoreS2(card, [vCell({ increment_estimator: { mean: 1, sd: 0, lower95_one_sided: 1 } })]);
  assert.equal(s2.status, 'MISSING');
  assert.equal(s2.perCell.length, 0);
  assert.equal(s2.missing.length, 1);
});

// Finding 4: a run that carries a genuine instrument-class mismatch (its own class
// instrument absent, a foreign one present) is voided and excluded per-run -- it does
// not poison the whole stage the way the old global VOID did.
test('S2: a voided run is excluded but a healthy run still scores', () => {
  const mismatched = { detector: 'd', null_id: 'N1', phi: null, m: null,
    increment_estimator: { mean: 1.1e8, sd: 2.3e8, lower95_one_sided: 9.9e7 },
    __run: 'run-void', __tier: 'T1' };
  const healthy = { detector: 'd', null_id: 'N2', phi: null, m: null,
    crossing_rate: 0, verdict: 'not-refuted', __run: 'run-ok', __tier: 'T1' };
  const s2 = scoreS2(eCard, [mismatched, healthy]);
  assert.equal(s2.status, 'PASS');
  assert.equal(s2.excluded.length, 1);
  assert.equal(s2.excluded[0].reason, 'run voided: instrument-class mismatch');
  assert.equal(s2.perCell.find((c) => c.null_id === 'N2').mapped, 'CLEARED');
});

test('S2: stage is VOID only when every in-regime cell came from voided runs', () => {
  const mismatched = { detector: 'd', null_id: 'N1', phi: null, m: null,
    increment_estimator: { mean: 1.1e8, sd: 2.3e8, lower95_one_sided: 9.9e7 },
    __run: 'run-void', __tier: 'T1' };
  const s2 = scoreS2(eCard, [mismatched]);
  assert.equal(s2.status, 'VOID');
});

// The real sui shape: a foreign instrument (increment_estimator) present alongside the
// class's own instrument (crossing_rate) is an annotation, not a mismatch -- it scores.
test('S2: foreign instrument alongside the class instrument does not void the run', () => {
  const suiShaped = { detector: 'd', null_id: 'N1', phi: null, m: null,
    crossing_rate: 0, verdict: 'not-refuted',
    increment_estimator: { mean: 1.1e8, sd: 2.3e8, lower95_one_sided: 9.9e7 },
    __run: 'run-sui', __tier: 'T1' };
  const s2 = scoreS2(eCard, [suiShaped]);
  assert.equal(s2.status, 'PASS');
  assert.equal(s2.excluded.length, 0);
});

// Round 3 finding 1: for test_martingale-class cells, when the top-level verdict field is
// absent, supermartingale_verdict is read through the same vocabulary map. sequential_mmd's
// 136 matched cells carry supermartingale_verdict: 'REFUTED' and no verdict field.
test('S2 maps supermartingale_verdict through VERDICT_MAP when verdict is absent (test_martingale only)', () => {
  const cell = { detector: 'd', null_id: 'N1', phi: 0, m: null,
    increment_estimator: { mean: 1.0, sd: 0.001, lower95_one_sided: 0.999 },
    supermartingale_verdict: 'REFUTED', __tier: 'T1' };
  const s2 = scoreS2(card, [cell]);
  assert.equal(s2.status, 'REFUTED');
  assert.equal(s2.perCell[0].mapped, 'REFUTED');
});

test('S2 does not fall back to supermartingale_verdict outside test_martingale', () => {
  const cell = { detector: 'd', null_id: 'N1', phi: null, m: null,
    crossing_rate: 0, supermartingale_verdict: 'REFUTED', __tier: 'T1' };
  const s2 = scoreS2(eCard, [cell]);
  assert.equal(s2.status, 'MISSING');
  assert.equal(s2.missing.length, 1);
});

// Round 3 finding 2 (the sui twins made explicit): a foreign-instrument verdict
// (increment_verdict, tied to increment_estimator, which is test_martingale's instrument,
// not e_process's) must be discarded ON PURPOSE when the class verdict field is absent --
// annotated as foreign_verdict_ignored, not folded into "unmapped verdict token".
test('S2: a foreign increment_verdict on a non-test_martingale cell is discarded on purpose, not read as unmapped', () => {
  const suiRun170319 = { detector: 'd', null_id: 'N1', phi: null, m: null,
    crossing_rate: 0, increment_verdict: 'REFUTED',
    increment_estimator: { mean: 1.1e8, sd: 2.3e8, lower95_one_sided: 9.9e7 },
    __run: 'run-170319Z', __tier: 'T1' };
  const s2 = scoreS2(eCard, [suiRun170319]);
  assert.equal(s2.status, 'MISSING');
  assert.equal(s2.missing.length, 1);
  assert.equal(s2.missing[0].reason, 'no class-instrument verdict recorded (foreign increment_verdict=REFUTED ignored)');
  assert.equal(s2.missing[0].foreign_verdict_ignored, 'increment_verdict=REFUTED (invalid instrument for class)');
});

// Round 3 finding 3 wired: internalConsistency flags void the flagged cell's run, using the
// same per-run mechanism as instrument-class mismatch (test_martingale only -- the e_process
// exemption is already covered by the sui-shaped test above, which shares this exact
// increment mean/crossing_rate shape and must NOT void).
test('S2: an internally-inconsistent test_martingale run is voided via the per-run mechanism', () => {
  const bad = vCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0, __run: 'run-bad' });
  const s2 = scoreS2(card, [bad]);
  assert.equal(s2.status, 'VOID');
  assert.match(s2.excluded[0].reason, /internally impossible/);
});

// Round 3 finding 4: no silent suppression. Every excluded[]/missing[] entry carries the
// suppressed verdict token when one exists, and the stage tallies them so the CLI/MISSING-CELLS
// can surface what was thrown away (family_E: ANTI-CONSERVATIVE x25 / conservative x23).
test('S2: suppressed verdict tokens on voided-run cells are tallied and named per entry', () => {
  const tCard = { ...card, class: 'terminal_e_value' };
  const cells = [
    { detector: 'd', null_id: 'N1', phi: null, m: null, crossing_rate: 0.808, verdict: 'ANTI-CONSERVATIVE', __run: 'run-1', __tier: 'T1' },
    { detector: 'd', null_id: 'N2', phi: null, m: null, crossing_rate: 0.2, verdict: 'ANTI-CONSERVATIVE', __run: 'run-1', __tier: 'T1' },
    { detector: 'd', null_id: 'N3', phi: null, m: null, crossing_rate: 0.1, verdict: 'conservative', __run: 'run-1', __tier: 'T1' },
  ];
  const s2 = scoreS2(tCard, cells);
  assert.equal(s2.status, 'VOID');
  assert.equal(s2.excluded.length, 3);
  assert.ok(s2.excluded.every((e) => e.reason.includes('suppressed verdict:')));
  assert.deepEqual(s2.suppressed_verdicts, { 'ANTI-CONSERVATIVE': 2, conservative: 1 });
});

// Finding 2: S3 must guard non-finite runs out before the floor determination.
test('S3 excludes non_finite_wealth cells from the floor determination', () => {
  const s3 = scoreS3(card, [
    pCell({ detection_rate: 1.0, verdict: 'POWERED' }),
    pCell({ null_id: 'N5', detection_rate: 0, non_finite_wealth: 60, verdict: 'NOT-EXECUTABLE' }),
  ]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.excluded.length, 1);
  assert.equal(s3.perCell.length, 1);
});

test('S3 flags inert below the floor', () => {
  const s3 = scoreS3(card, [pCell({ detection_rate: 0.05, verdict: 'INERT' })]);
  assert.equal(s3.status, 'INERT');
});

// Fix round 2: rate_e_ge_20 is a vocabulary gap, not an evidence gap. The terminal-evalue
// CONTROL_power cells (safe_t, universal_inference) carry live power evidence at the
// registered shift, recorded as an e>=20 detection rate rather than detection_rate.
test('S3(a) a rate_e_ge_20 cell at 0.96/shift 3 counts as powered', () => {
  const s3 = scoreS3(card, [rateCell({ rate_e_ge_20: 0.960975 })]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.perCell.length, 1);
  assert.equal(s3.perCell[0].detection_rate, 0.960975);
});

test('S3(b) a rate_e_ge_20 cell at 0.05 counts as inert', () => {
  const s3 = scoreS3(card, [rateCell({ rate_e_ge_20: 0.05 })]);
  assert.equal(s3.status, 'INERT');
  assert.equal(s3.perCell[0].detection_rate, 0.05);
});

test('S3(c) a rate_e_ge_20 cell off the registered shift is excluded', () => {
  const s3 = scoreS3(card, [rateCell({ shift_sigma: 0.75 })]);
  assert.equal(s3.status, 'MISSING');
  assert.equal(s3.perCell.length, 0);
});

test('S3 detection_rate cells are unaffected by the rate_e_ge_20 extension', () => {
  const s3 = scoreS3(card, [pCell()]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.perCell[0].detection_rate, 1.0);
  assert.equal('rate_e_ge_20' in s3.perCell[0], false);
});

// Round 3 finding 4: S3 also tallies suppressed verdict tokens.
test('S3: suppressed verdict tokens on excluded entries are tallied', () => {
  const s3 = scoreS3(card, [pCell({ detection_rate: 0, non_finite_wealth: 60, verdict: 'NOT-EXECUTABLE' })]);
  assert.equal(s3.status, 'MISSING');
  assert.equal(s3.excluded.length, 1);
  assert.match(s3.excluded[0].reason, /suppressed verdict: NOT-EXECUTABLE/);
  assert.deepEqual(s3.suppressed_verdicts, { 'NOT-EXECUTABLE': 1 });
});

// Round 3 minor 5(a): shift/regime filtering happens before guards, so excluded[] only
// ever holds in-scope (registered-shift, in-regime) cells.
test('S3: an off-shift non-finite cell is silently out of scope, not counted in excluded[]', () => {
  const s3 = scoreS3(card, [pCell({ shift_sigma: 0.75, non_finite_wealth: 60, verdict: 'NOT-EXECUTABLE' })]);
  assert.equal(s3.excluded.length, 0);
  assert.equal(s3.status, 'MISSING');
});

// Round 3 minor 5(b): a present-but-null detection_rate must fall back to rate_e_ge_20,
// never get pushed through as a literal null that misreads as inert (null < floor is true).
test('S3: a present-but-null detection_rate falls back to rate_e_ge_20, never misreads as inert', () => {
  const s3 = scoreS3(card, [pCell({ detection_rate: null, rate_e_ge_20: 0.96 })]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.perCell[0].detection_rate, 0.96);
});

// Round 3 minor 5(c): guard VOID/VACUOUS candidates are routed to excluded[]/missing[],
// never fall through into perCell scoring.
test('S3: a guard-VOID candidate (instrument-class mismatch) is excluded, never scored', () => {
  const cell = { detector: 'd', null_id: 'N1', phi: null, m: null, shift_sigma: 3,
    detection_rate: 1.0, increment_estimator: { mean: 5, sd: 0.1, lower95_one_sided: 4 }, __tier: 'T1' };
  const s3 = scoreS3(eCard, [cell]);
  assert.equal(s3.perCell.length, 0);
  assert.equal(s3.excluded.length, 1);
  assert.equal(s3.status, 'MISSING');
});

test('S3: a guard-VACUOUS candidate is routed to missing[], never scored', () => {
  const cell = { detector: 'd', null_id: 'N1', phi: 0, m: null, shift_sigma: 3,
    detection_rate: 1.0, increment_estimator: { mean: 1, sd: 0, lower95_one_sided: 1 }, __tier: 'T1' };
  const s3 = scoreS3(card, [cell]);
  assert.equal(s3.perCell.length, 0);
  assert.equal(s3.missing.length, 1);
  assert.equal(s3.status, 'MISSING');
});

test('S4 refuses a participating p-value path', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } });
  assert.equal(s4.status, 'REFUSE');
});

test('S4 marks unmeasured bootstrap substitution UNPRICED', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'wealth process, bootstrap threshold substitution ~2.4e4x' } });
  assert.equal(s4.status, 'UNPRICED');
});

// Finding 3: an S4 prior_evidence entry with runs: null is a declared-but-unmeasured
// c-bound, not a measured artifact -- it must not clear the UNPRICED gate.
test('S4 an S4 prior_evidence entry with runs: null does not count as a measured c-bound', () => {
  const s4 = scoreS4({ ...card,
    shipped_path: { kind: 'wealth process, bootstrap threshold substitution ~3.6e76x' },
    prior_evidence: [{ stage: 'S4', study: 'bootstrap-overshoot', runs: null, wiki: 'y' }] });
  assert.equal(s4.status, 'UNPRICED');
});

test('S4 an S4 prior_evidence entry with runs != null clears the UNPRICED gate', () => {
  const s4 = scoreS4({ ...card,
    shipped_path: { kind: 'wealth process, bootstrap threshold substitution ~3.6e76x' },
    prior_evidence: [{ stage: 'S4', study: 'c-bound-measured', runs: 'c-bound/results/live/*', wiki: 'y' }] });
  assert.equal(s4.status, 'PASS');
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

// Promoted minor 5: some-inert shrinks the regime, not the verdict. USE still holds when
// at least one claimed cell is powered; the inert ones are named in reasons[].
test('overall: some-inert-some-powered is USE, with the inert cell named in reasons[]', () => {
  const v = overallVerdict(
    card,
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell(), pCell({ null_id: 'N2', detection_rate: 0.0, verdict: 'INERT' })]),
    scoreS4(card),
  );
  assert.equal(v.verdict, 'USE');
  assert.ok(v.reasons.some((r) => r.includes('N2') && r.includes('inert')));
});

test('overall: in-regime refutation is REFUSE', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell({ verdict: 'REFUTED' })]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'REFUSE');
});

// Promoted minor 7: ADVISORY branches (S4 REFUSE, S3-all-inert) carry the same
// min-supporting-tier computation as UNPRICED, instead of tier: null.
test('overall: S4 REFUSE still carries the supporting tier, not null', () => {
  const v = overallVerdict(
    { ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } },
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell()]),
    scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } }),
  );
  assert.equal(v.verdict, 'ADVISORY');
  assert.equal(v.tier, 'T1');
});

test('overall: S3-all-inert ADVISORY still carries the supporting tier, not null', () => {
  const v = overallVerdict(
    card,
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell({ detection_rate: 0.0, verdict: 'INERT' })]),
    scoreS4(card),
  );
  assert.equal(v.verdict, 'ADVISORY');
  assert.equal(v.tier, 'T1');
});
