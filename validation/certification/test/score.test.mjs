import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreS1, scoreS2, scoreS3, scoreS4, overallVerdict, pairingGaps, untokenedExclusions } from '../lib/score.mjs';

const card = {
  detector_id: 'd', aliases: [], class: 'test_martingale',
  guarantee: { regime: { phi_max: 0.9, m_min: 500 } },
  shipped_path: { kind: 'wealth process', notes: '' },
  budget: { participating: true },
  prior_evidence: [{ stage: 'S1', study: 'x', wiki: 'y' }],
};
const eCard = { ...card, class: 'e_process', guarantee: { regime: { phi_max: 0.99, m_min: null } } };
const s1D = scoreS1(card);

const vCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, verdict: 'CLEARED',
  increment_estimator: { mean: 1.0, sd: 0.001, lower95_one_sided: 0.999 }, crossing_rate: 0, __tier: 'T1', ...over });
const pCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, shift_sigma: 3,
  detection_rate: 1.0, verdict: 'POWERED', __tier: 'T1', ...over });
// The CONTROL_power power-control shape from terminal-evalue runs (safe_t,
// universal_inference): no null_id, records the power number as rate_e_ge_20 instead
// of detection_rate.
const rateCell = (over = {}) => ({ control: 'power', detector: 'd', shift_sigma: 3,
  rate_e_ge_20: 0.960975, verdict: 'pass', mode: 'live', __tier: 'T1', ...over });

// Task 8 addition: scoreS1 was specified in the task-7 brief's interface note
// ("S1 note") but never implemented in task-7's commits (checked: no
// `scoreS1` anywhere in lib/score.mjs or any test as of 08ae73a). v1's honest
// floor for S1 reachability -- no machine-readable runs exist for any card
// yet -- is a declared/missing check against prior_evidence, not a scored cell.
test('S1 is DECLARED when prior_evidence cites a stage S1 entry', () => {
  const s1 = scoreS1(card);
  assert.equal(s1.status, 'DECLARED');
});

test('S1 is MISSING when prior_evidence has no stage S1 entry', () => {
  const s1 = scoreS1({ ...card, prior_evidence: [{ stage: 'S2', study: 'x', wiki: 'y' }] });
  assert.equal(s1.status, 'MISSING');
});

test('S1 is MISSING when prior_evidence is empty', () => {
  const s1 = scoreS1({ ...card, prior_evidence: [] });
  assert.equal(s1.status, 'MISSING');
});

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
  // N2-m100, not a bare 'N2': the registered grammar always carries the cal length on an
  // N2 id, and an id outside the grammar has an unmeasured phi the scorer now refuses.
  const healthy = { detector: 'd', null_id: 'N2-m100', phi: null, m: null,
    crossing_rate: 0, verdict: 'not-refuted', __run: 'run-ok', __tier: 'T1' };
  const s2 = scoreS2(eCard, [mismatched, healthy]);
  assert.equal(s2.status, 'PASS');
  assert.equal(s2.excluded.length, 1);
  assert.equal(s2.excluded[0].reason, 'run voided: instrument-class mismatch');
  assert.equal(s2.perCell.find((c) => c.null_id === 'N2-m100').mapped, 'CLEARED');
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
  const v = overallVerdict(card, s1D, scoreS2(card, [vCell()]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'USE');
  assert.equal(v.tier, 'T1');
});

test('overall: valid-but-inert is ADVISORY, never USE', () => {
  const v = overallVerdict(card, s1D, scoreS2(card, [vCell()]), scoreS3(card, [pCell({ detection_rate: 0.0, verdict: 'INERT' })]), scoreS4(card));
  assert.equal(v.verdict, 'ADVISORY');
});

// Promoted minor 5: some-inert shrinks the regime, not the verdict. USE still holds when
// at least one claimed cell is powered; the inert ones are named in reasons[].
test('overall: some-inert-some-powered is USE, with the inert cell named in reasons[]', () => {
  const v = overallVerdict(
    card, s1D,
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell(), pCell({ null_id: 'N2', detection_rate: 0.0, verdict: 'INERT' })]),
    scoreS4(card),
  );
  assert.equal(v.verdict, 'USE');
  assert.ok(v.reasons.some((r) => r.includes('N2') && r.includes('inert')));
});

test('overall: in-regime refutation is REFUSE', () => {
  const v = overallVerdict(card, s1D, scoreS2(card, [vCell({ verdict: 'REFUTED' })]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'REFUSE');
});

// Promoted minor 7: ADVISORY branches (S4 REFUSE, S3-all-inert) carry the same
// min-supporting-tier computation as UNPRICED, instead of tier: null.
test('overall: S4 REFUSE still carries the supporting tier, not null', () => {
  const v = overallVerdict(
    { ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } }, s1D,
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell()]),
    scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } }),
  );
  assert.equal(v.verdict, 'ADVISORY');
  assert.equal(v.tier, 'T1');
});

test('overall: S3-all-inert ADVISORY still carries the supporting tier, not null', () => {
  const v = overallVerdict(
    card, s1D,
    scoreS2(card, [vCell()]),
    scoreS3(card, [pCell({ detection_rate: 0.0, verdict: 'INERT' })]),
    scoreS4(card),
  );
  assert.equal(v.verdict, 'ADVISORY');
  assert.equal(v.tier, 'T1');
});

// ===========================================================================
// C1 -- the mean rule inside S2.
// ===========================================================================

const tCard = {
  detector_id: 'st', aliases: [], class: 'terminal_e_value',
  guarantee: { regime: { phi_max: 0.95, m_min: null } },
  shipped_path: { kind: 'terminal e-value, phi plug-in', notes: '' },
  budget: { participating: true, alpha_booked: null, resolution_claim: null },
  prior_evidence: [{ stage: 'S2', study: 'terminal-evalue', runs: 'x', wiki: 'y' }],
};
const tCell = (over = {}) => ({ detector: 'st', null_id: 'N1', alpha: 0.05, m: 100,
  exceedance: 0.00025, lower_95: 0.0000557, mean_e: 0.0954, verdict: 'not-refuted',
  __run: 'run-t', __tier: 'T1', ...over });

test('S2 mean rule: a CLEARED terminal cell whose mean_e exceeds 1 maps REFUTED', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'N4-p09', mean_e: 9709.992955188858, exceedance: 0.016, lower_95: 0.013 })]);
  const cell = s2.perCell[0];
  assert.equal(cell.mapped, 'REFUTED');
  assert.equal(cell.mean_rule_applied, true);
  assert.match(cell.mean_rule_reason, /^mean rule: exceedance verdict overridden/);
  assert.equal(s2.status, 'REFUTED', 'an in-regime mean-rule refutation fails the stage');
});

test('S2 mean rule: the overridden exceedance token goes into the suppressed tally', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'N4-p09', mean_e: 9709.99 })]);
  assert.deepEqual(s2.suppressed_verdicts, { 'not-refuted': 1 });
});

test('S2 mean rule leaves a below-1 mean alone (a mean below 1 is not evidence either way)', () => {
  const s2 = scoreS2(tCard, [tCell()]);
  assert.equal(s2.perCell[0].mapped, 'CLEARED');
  assert.equal(s2.perCell[0].mean_rule_applied, undefined);
  assert.equal(s2.status, 'PASS');
});

test('S2 mean rule never rescues an already-REFUTED cell into CLEARED', () => {
  const s2 = scoreS2(tCard, [tCell({ verdict: 'REFUTED', mean_e: 0.0001 })]);
  assert.equal(s2.perCell[0].mapped, 'REFUTED');
});

test('S2 mean rule does not apply to test_martingale or e_process cells', () => {
  const s2 = scoreS2(card, [vCell({ mean_e: 9709.99 })]);
  assert.equal(s2.perCell[0].mapped, 'CLEARED');
  assert.equal(s2.status, 'PASS');
});

// FIX 1 (live power study, 2026-08-07 report §5.1) -- the exact regression: two cells at
// the same detector/null, one from the 2026-08-02 run (mean_e 9709.99, no recorded bound)
// and one from the 2026-08-07 run (identical mean_e, recorded bound clamped to 0.0000).
// Before the fix these scored REFUTED and CLEARED respectively -- the same violation
// reading opposite verdicts depending only on which run happened to record the bound.
// Both must now map REFUTED, with the reason on each naming which signal fired.
test('S2 mean rule regression: no-bound and zero-bound cells of the same N4-p09 both map REFUTED', () => {
  const s2 = scoreS2(tCard, [
    tCell({ null_id: 'N4-p09', mean_e: 9709.99, exceedance: 0.016, lower_95: 0.013, __run: 'run-20260802' }),
    tCell({ null_id: 'N4-p09', mean_e: 9709.99, mean_e_lower_95: 0.0, exceedance: 0.016, lower_95: 0.013, __run: 'run-20260807' }),
  ]);
  assert.equal(s2.perCell.length, 2);
  for (const c of s2.perCell) {
    assert.equal(c.mapped, 'REFUTED');
    assert.equal(c.mean_rule_applied, true);
  }
  const [noBoundCell, zeroBoundCell] = s2.perCell;
  assert.match(noBoundCell.mean_rule_reason, /no interval on the mean is recorded/);
  assert.match(zeroBoundCell.mean_rule_reason, /uninformative, not exculpatory/);
  assert.equal(s2.status, 'REFUTED');
});

// FIX 2 -- 'FAIL' is the terminal harness's own refutation token (run.mjs:115: `verdict:
// lo > alpha ? 'FAIL' : 'not-refuted'`), and every other h0-battery-family harness uses the
// same token for the same purpose. Before this fix it was absent from VERDICT_MAP, so the
// harness's own recorded refutation scored as missing evidence (fail-open in regime).
test('S2 maps the harness refutation token FAIL to REFUTED', () => {
  const s2 = scoreS2(tCard, [tCell({ verdict: 'FAIL', null_id: 'N1' })]);
  assert.equal(s2.perCell.length, 1);
  assert.equal(s2.perCell[0].mapped, 'REFUTED');
  assert.equal(s2.status, 'REFUTED');
  assert.equal(s2.missing.length, 0, 'FAIL must not be routed to missing[] as an unmapped token');
});

// ===========================================================================
// C2 -- fail-closed phi and the known-phi regime.
// ===========================================================================

test('S2 fails closed on a validity cell whose phi is unknown after derivation', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'HC-gauss-corr' })]);
  assert.equal(s2.perCell.length, 0);
  assert.equal(s2.status, 'MISSING');
  assert.equal(s2.missing.length, 1);
  assert.match(s2.missing[0].reason, /phi unmeasured, refused \(fail-closed\)/);
  assert.equal(s2.missing[0].suppressed_verdict, 'not-refuted');
});

test('S2 does not fail closed when the card claims no phi bound at all', () => {
  const noPhiCard = { ...tCard, guarantee: { regime: { phi_max: null, m_min: null } } };
  const s2 = scoreS2(noPhiCard, [tCell({ null_id: 'HC-gauss-corr' })]);
  assert.equal(s2.status, 'PASS');
  assert.equal(s2.perCell.length, 1);
});

test('S2 derives phi from the null_id, so a phi-less N3-p09 cell is in regime at phi_max 0.95', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'N3-p09' })]);
  assert.equal(s2.perCell[0].out_of_regime, false);
  assert.equal(s2.status, 'PASS');
});

test('regime.phi_known puts an estimated-phi cell out of regime, narrowing rather than failing', () => {
  const knownCard = { ...tCard, guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } } };
  const s2 = scoreS2(knownCard, [
    tCell({ null_id: 'N1' }),
    tCell({ null_id: 'N4-p09', mean_e: 9709.99 }),
  ]);
  assert.equal(s2.status, 'PASS', 'the out-of-regime N4 refutation must not fail the stage');
  const n4 = s2.perCell.find((c) => c.null_id === 'N4-p09');
  assert.equal(n4.mapped, 'REFUTED');
  assert.equal(n4.out_of_regime, true);
  assert.match(n4.out_of_regime_reason, /estimated phi/);
});

test('without phi_known, the same estimated-phi cell stays in regime and refutes', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'N1' }), tCell({ null_id: 'N4-p09', mean_e: 9709.99 })]);
  assert.equal(s2.status, 'REFUTED');
});

test('S3 does not fail closed on unknown phi: a pooled power control has no null and no phi', () => {
  const s3 = scoreS3(tCard, [rateCell({ detector: 'st' })]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.perCell.length, 1);
  assert.ok(s3.missing.some((m) => /phi unmeasured on a power cell/.test(m.reason)),
    'the unmeasured phi is still recorded as a gap, not silently accepted');
});

// ===========================================================================
// I1 -- S1 in the overall verdict.
// ===========================================================================

test('overall: a MISSING S1 appends the v1-floor reason and never blocks USE', () => {
  const s1 = scoreS1({ ...card, prior_evidence: [] });
  const v = overallVerdict(card, s1, scoreS2(card, [vCell()]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'USE');
  assert.ok(v.reasons.includes('S1 reachability not run-backed (v1 floor)'));
});

test('overall: a DECLARED S1 adds no S1 reason', () => {
  const v = overallVerdict(card, s1D, scoreS2(card, [vCell()]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.ok(!v.reasons.some((r) => r.includes('S1 reachability')));
});

test('overall: the S1 floor reason is appended on every verdict branch, including REFUSE', () => {
  const s1 = scoreS1({ ...card, prior_evidence: [] });
  const v = overallVerdict(card, s1, scoreS2(card, [vCell({ verdict: 'REFUTED' })]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'REFUSE');
  assert.ok(v.reasons.includes('S1 reachability not run-backed (v1 floor)'));
});

test('scoreS1 matches a compound stage token containing S1 (the family_E S1+S2 shape)', () => {
  assert.equal(scoreS1({ ...card, prior_evidence: [{ stage: 'S1+S2', study: 'x', wiki: 'y' }] }).status, 'DECLARED');
  assert.equal(scoreS1({ ...card, prior_evidence: [{ stage: 'S2+S3', study: 'x', wiki: 'y' }] }).status, 'MISSING');
  assert.equal(scoreS1({ ...card, prior_evidence: [{ stage: null, study: 'x', wiki: 'y' }] }).status, 'MISSING');
});

// ===========================================================================
// I2 -- validity/power pairing.
// ===========================================================================

test('pairingGaps names an in-regime CLEARED validity cell that has no same-null power arm', () => {
  const s2 = scoreS2(tCard, [tCell({ null_id: 'N1' }), tCell({ null_id: 'N3-p06' })]);
  const s3 = scoreS3(tCard, [rateCell({ detector: 'st' })]);
  const gaps = pairingGaps(s2, s3);
  assert.deepEqual(gaps.map((g) => g.line), [
    'unpaired: st N1 validity cell has no power arm',
    'unpaired: st N3-p06 validity cell has no power arm',
  ]);
});

test('pairingGaps is empty when a same-null power cell exists', () => {
  const s2 = scoreS2(card, [vCell()]);
  const s3 = scoreS3(card, [pCell()]);
  assert.deepEqual(pairingGaps(s2, s3), []);
});

test('pairingGaps ignores out-of-regime and REFUTED validity cells', () => {
  const s2 = scoreS2(card, [vCell({ null_id: 'N4', phi: 0.99 }), vCell({ null_id: 'N2', verdict: 'REFUTED' })]);
  assert.deepEqual(pairingGaps(s2, scoreS3(card, [])), []);
});

test('pairingGaps dedupes the alpha replicates of one null into a single line', () => {
  const s2 = scoreS2(tCard, [tCell({ alpha: 0.05 }), tCell({ alpha: 0.01 })]);
  assert.equal(pairingGaps(s2, scoreS3(tCard, [])).length, 1);
});

// ===========================================================================
// I3 -- S4 completions.
// ===========================================================================

test('S4 REFUSES an alpha booked finer than the machinery resolves', () => {
  const s4 = scoreS4({ ...card, budget: { participating: true, alpha_booked: 2e-4, resolution_claim: 'bootstrap resolves 2e-3 at N=500' } });
  assert.equal(s4.status, 'REFUSE');
  assert.ok(s4.reasons.some((r) => /alpha booked 0\.0002 is finer than the claimed resolution 0\.002/.test(r)));
});

test('S4 passes an alpha booked coarser than the claimed resolution', () => {
  const s4 = scoreS4({ ...card, budget: { participating: true, alpha_booked: 1e-2, resolution_claim: 'bootstrap resolves 2e-3 at N=500' } });
  assert.equal(s4.status, 'PASS');
});

test('S4 records "alpha resolution unverifiable" when a participating card books alpha with no parseable resolution', () => {
  const s4 = scoreS4({ ...card, budget: { participating: true, alpha_booked: 1e-4, resolution_claim: null } });
  assert.notEqual(s4.status, 'REFUSE');
  assert.ok(s4.reasons.includes('alpha resolution unverifiable'));
});

test('S4 says nothing about alpha when alpha_booked is 0 or null (family_D, safe_t)', () => {
  assert.deepEqual(scoreS4({ ...card, budget: { participating: false, alpha_booked: 0, resolution_claim: 'bootstrap resolves 2e-3' } }).reasons, []);
  assert.deepEqual(scoreS4({ ...card, budget: { participating: true, alpha_booked: null, resolution_claim: null } }).reasons, []);
});

test('S4 records "no envelope wiring" when the detector is absent from the envelope map, without refusing', () => {
  const s4 = scoreS4(card, { envelopeKeys: ['safe_t_e_value'] });
  assert.equal(s4.status, 'PASS');
  assert.ok(s4.reasons.includes('no envelope wiring'));
});

test('S4 says nothing about wiring when the detector is in the envelope map', () => {
  const s4 = scoreS4({ ...card, detector_id: 'safe_t_e_value' }, { envelopeKeys: ['safe_t_e_value'] });
  assert.deepEqual(s4.reasons, []);
});

// The regression the anchored pattern exists for: family_D's shipped-path kind says
// "analytical 1/alpha threshold (no bootstrap substitution)". A substring match on
// 'bootstrap' or an unanchored 'substitution' would price it UNPRICED for saying it
// does NOT substitute.
test('S4 does not trip UNPRICED on family_D\'s "no bootstrap substitution" kind', () => {
  const s4 = scoreS4({ ...card,
    budget: { participating: false, alpha_booked: 0, resolution_claim: null },
    shipped_path: { kind: 'wealth process on peak|ACF| (spectral autocorrelation statistic), disjoint-window evaluation, analytical 1/alpha threshold (no bootstrap substitution)' } });
  assert.equal(s4.status, 'PASS');
});

test('S4 still prices the two real bootstrap-substituting kinds UNPRICED', () => {
  for (const kind of [
    'wealth process (aGRAPA bet), AR(1) pre-whitened, bootstrap threshold substitution ~2.4e4x over 1/alpha',
    'wealth process, bootstrap threshold substitution ~3.6e76x over 1/alpha',
  ]) {
    assert.equal(scoreS4({ ...card, shipped_path: { kind } }).status, 'UNPRICED', kind);
  }
});

test('S4 does not read a negated p-value mention as a p-value path', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'terminal e-value, not a p-value' } });
  assert.notEqual(s4.status, 'REFUSE');
});

test('S4 still refuses the real family_E p-value kind', () => {
  assert.equal(scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } }).status, 'REFUSE');
});

// ===========================================================================
// Minors: VERDICTS vocabulary, structural regime narrowing, untokened exclusions.
// ===========================================================================

test('overallVerdict throws if it would emit a token outside the registered VERDICTS vocabulary', () => {
  // s2.status is a token the scorer never emits, so the verdict falls through every
  // branch -- the guard must throw rather than return something unregistered.
  assert.throws(
    () => overallVerdict(card, s1D, { status: 'WAT', perCell: [], excluded: [], missing: [] }, scoreS3(card, [pCell()]), scoreS4(card)),
    /unregistered verdict|unknown S2 status/,
  );
});

test('overall: regime narrowing is structural, not just prose', () => {
  const knownCard = { ...tCard, guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } } };
  const s2 = scoreS2(knownCard, [tCell({ null_id: 'N1' }), tCell({ null_id: 'N4-p09', mean_e: 9709.99 })]);
  const s3 = scoreS3(knownCard, [rateCell({ detector: 'st' })]);
  const v = overallVerdict(knownCard, s1D, s2, s3, scoreS4(knownCard));
  assert.equal(v.verdict, 'USE');
  assert.ok(Array.isArray(v.regime.excluded_cells));
  const ex = v.regime.excluded_cells.find((c) => c.null_id === 'N4-p09');
  assert.equal(ex.stage, 'S2');
  assert.equal(ex.mapped, 'REFUTED');
  assert.match(ex.reason, /estimated phi/);
  assert.equal(v.regime.phi_max, 0.95, 'the card regime fields are carried through unchanged');
});

test('overall: inert S3 cells also land in regime.excluded_cells', () => {
  const v = overallVerdict(card, s1D, scoreS2(card, [vCell()]),
    scoreS3(card, [pCell(), pCell({ null_id: 'N2', detection_rate: 0.0 })]), scoreS4(card));
  assert.equal(v.verdict, 'USE');
  assert.ok(v.regime.excluded_cells.some((c) => c.stage === 'S3' && c.null_id === 'N2'));
});

test('overall: the card object is never mutated by regime narrowing', () => {
  const knownCard = { ...tCard, guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } } };
  const before = JSON.stringify(knownCard);
  overallVerdict(knownCard, s1D, scoreS2(knownCard, [tCell()]), scoreS3(knownCard, [rateCell({ detector: 'st' })]), scoreS4(knownCard));
  assert.equal(JSON.stringify(knownCard), before);
});

test('untokenedExclusions groups excluded cells that carried no verdict token, with counts', () => {
  const s2 = scoreS2(eCard, [
    { detector: 'd', null_id: 'N1', crossing_rate: 0, verdict: 'not-refuted', non_finite_wealth: 3, __run: 'r1', __tier: 'T1' },
    { detector: 'd', null_id: 'N2', crossing_rate: 0, non_finite_wealth: 3, __run: 'r1', __tier: 'T1' },
    { detector: 'd', null_id: 'N5', crossing_rate: 0, non_finite_wealth: 3, __run: 'r1', __tier: 'T1' },
  ]);
  const lines = untokenedExclusions(s2);
  assert.deepEqual(lines, ['excluded without token: d x2 (non_finite_wealth=3)']);
});

test('S3 distinguishes a cell at the other registered shift from a cell with no shift recorded', () => {
  const s3 = scoreS3(card, [pCell({ shift_sigma: undefined }), pCell()]);
  const line = s3.missing.find((m) => /no shift_sigma recorded/.test(m.reason));
  assert.ok(line, 'a cell with no shift_sigma must not be described as registered evidence at another shift');
  assert.match(line.reason, /effect size is unknown/);
  assert.ok(!/registered effect size/.test(line.reason));
});

test('S3 records an off-shift power cell instead of dropping it silently', () => {
  const s3 = scoreS3(card, [pCell({ shift_sigma: 0.75 }), pCell({ shift_sigma: 0.75, null_id: 'N2' }), pCell()]);
  assert.equal(s3.status, 'PASS');
  assert.equal(s3.perCell.length, 1);
  const line = s3.missing.find((m) => /shift_sigma=0\.75/.test(m.reason));
  assert.ok(line, 'off-shift cells must be named in missing[]');
  assert.match(line.reason, /x2/, 'off-shift cells at one shift are aggregated with a count');
  assert.equal(s3.excluded.length, 0);
});
