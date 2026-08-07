import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGuards, internalConsistency, meanRule } from '../lib/guards.mjs';

const seqCell = (over = {}) => ({
  detector: 'family_A_betting_e_process', null_id: 'N1', verdict: 'CLEARED',
  increment_estimator: { mean: 1.0000, sd: 0.0002, lower95_one_sided: 0.9999 },
  crossing_rate: 0, ...over,
});

test('zero-width interval is VACUOUS, not CLEARED', () => {
  const g = applyGuards(seqCell({ increment_estimator: { mean: 1.0, sd: 0, lower95_one_sided: 1.0 } }), 'test_martingale');
  assert.equal(g.status, 'VACUOUS');
});

test('NaN increment is NON_FINITE', () => {
  const g = applyGuards(seqCell({ increment_estimator: { mean: NaN, sd: NaN, lower95_one_sided: NaN } }), 'test_martingale');
  assert.equal(g.status, 'NON_FINITE');
});

// Finding 4: the class's own instrument (crossing_rate, for e_process) is present on this
// cell alongside the foreign increment_estimator -- this is the real sui shape. Foreign
// fields alongside a present class instrument are an annotation, not a veto.
test('increment instrument alongside the e_process class instrument (crossing_rate) is OK, not VOID', () => {
  const g = applyGuards(seqCell(), 'e_process');
  assert.equal(g.status, 'OK');
  assert.match(g.reason, /increment_estimator/);
});

test('increment instrument on an e_process cell with the class instrument absent is VOID', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N1', increment_estimator: seqCell().increment_estimator }, 'e_process');
  assert.equal(g.status, 'VOID');
});

test('healthy martingale cell passes', () => {
  assert.equal(applyGuards(seqCell(), 'test_martingale').status, 'OK');
});

// Round 3 finding 3: increment_estimator is only the CLASS's own scoring instrument for
// test_martingale. On e_process cells (the sui shape) it's a foreign, descriptive-only
// annotation -- a huge mean beside crossing_rate: 0 there is expected, not impossible.
test('internalConsistency flags an impossible increment/crossing pair for test_martingale cells', () => {
  const bad = seqCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0 });
  const flags = internalConsistency([bad], 'test_martingale');
  assert.equal(flags.length, 1);
  assert.match(flags[0].reason, /N1/);
  assert.equal(flags[0].__run, undefined);
});

test('internalConsistency does not flag the same shape on e_process cells: descriptive, not scored', () => {
  const bad = seqCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0 });
  const flags = internalConsistency([bad], 'e_process');
  assert.equal(flags.length, 0);
});

test('internalConsistency carries __run so score.mjs can void by run', () => {
  const bad = seqCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0, __run: 'run-1' });
  const flags = internalConsistency([bad], 'test_martingale');
  assert.equal(flags[0].__run, 'run-1');
});

test('e-process instrument on a terminal_e_value cell with the class instrument absent is VOID', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N1', stopped_mean: 2.5e-5, crossing_rate: 0 }, 'terminal_e_value');
  assert.equal(g.status, 'VOID');
});

test('stopped_mean alongside the terminal_e_value class instrument (exceedance) is OK, not VOID', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N1', exceedance: 0.01, stopped_mean: 2.5e-5 }, 'terminal_e_value');
  assert.equal(g.status, 'OK');
  assert.match(g.reason, /stopped_mean/);
});

test('terminal instrument on an e_process cell with the class instrument absent is VOID', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N1', exceedance: 0.01 }, 'e_process');
  assert.equal(g.status, 'VOID');
});

test('exceedance alongside the e_process class instrument (crossing_rate) is OK, not VOID', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N1', crossing_rate: 0.02, exceedance: 0.01 }, 'e_process');
  assert.equal(g.status, 'OK');
  assert.match(g.reason, /exceedance/);
});

test('power cell with non_finite_wealth > 0 is NON_FINITE', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N5', detection_rate: 0, shift_sigma: 3, non_finite_wealth: 12, verdict: 'INERT' }, 'test_martingale');
  assert.equal(g.status, 'NON_FINITE');
});

// ---------------------------------------------------------------------------
// C1 -- the mean rule. Protocol S2: "for terminal classes the mean carries
// evidence only above 1; exceedance alone never clears a cell whose mean
// exceeds its registered bound." The registered bound is E[e|H0] <= 1.
// ---------------------------------------------------------------------------

test('meanRule fires on a terminal cell whose mean_e exceeds the registered bound', () => {
  const r = meanRule({ detector: 'safe_t', null_id: 'N4-p09', exceedance: 0.016, lower_95: 0.013, mean_e: 9709.992955188858 }, 'terminal_e_value');
  assert.ok(r, 'expected the mean rule to fire on mean_e 9709.99');
  assert.match(r.reason, /^mean rule: exceedance verdict overridden/);
  assert.match(r.reason, /mean_e 9709\.99/);
  // The reason must not claim lower_95 bounds the mean: in this corpus it is the
  // one-sided binomial lower bound on the EXCEEDANCE (harness/run.mjs:94).
  assert.match(r.reason, /bounds the exceedance, not the mean/);
});

test('meanRule does not fire on a terminal cell whose mean_e sits below the bound', () => {
  assert.equal(meanRule({ mean_e: 0.09546614780602795, exceedance: 0.00025, lower_95: 0.0000557 }, 'terminal_e_value'), null);
});

// The wiki's asymmetry ([[stats/terminal-mean-is-not-measurable]]): a reading below 1
// proves nothing, so the rule must never CLEAR anything -- it only ever refutes.
test('meanRule is silent for non-terminal classes (the increment estimator is their instrument)', () => {
  assert.equal(meanRule({ mean_e: 9709.99 }, 'test_martingale'), null);
  assert.equal(meanRule({ mean_e: 9709.99 }, 'e_process'), null);
});

test('meanRule is silent when no mean is recorded at all', () => {
  assert.equal(meanRule({ exceedance: 0.5 }, 'terminal_e_value'), null);
});

// The card's own falsifier form ("one-sided 95% lower bound of mean(e) > 1"). When the
// recorded bound itself exceeds 1, it fires on its own and names itself as the signal.
test('meanRule fires on a recorded one-sided lower bound above 1, naming the bound as the signal', () => {
  const fired = meanRule({ mean_e: 0.5, mean_e_lower_95: 1.4 }, 'terminal_e_value');
  assert.ok(fired);
  assert.match(fired.reason, /lower bound on mean\(e\) 1\.4 > 1/);
});

// FIX 1 (live power study, 2026-08-07 report §5.1): the mean rule is refusal-only and
// takes the STRONGEST refuting signal. [[stats/terminal-mean-is-not-measurable]]: the mean
// instrument carries evidence only ABOVE 1 -- a low or zero-clamped bound is uninformative,
// never exculpatory. The live run recorded exactly this collision at safe_t N4-p09: the
// 2026-08-02 cells carry mean_e 9709.99 with no bound (point-estimate fallback refutes);
// the 2026-08-07 cells carry the IDENTICAL mean_e with a bound that clamps to 0.0000
// (s/sqrt(n) exceeds the mean itself for a heavy-tailed e). Before this fix the recorded
// 0.0000 bound overrode and CLEARED the cell -- the same violation read REFUTED from one
// run and CLEARED from the other. Neither reading may ever clear; the bound only ever adds
// a second way to refute.
test('meanRule: a recorded bound at or below 1 never overrides a point-estimate refutation', () => {
  const noBound = meanRule({ mean_e: 9709.99 }, 'terminal_e_value');
  const zeroBound = meanRule({ mean_e: 9709.99, mean_e_lower_95: 0.0 }, 'terminal_e_value');
  assert.ok(noBound, 'point estimate alone must refute');
  assert.ok(zeroBound, 'a recorded 0 bound must not clear what the point estimate refutes');
  assert.match(noBound.reason, /mean_e 9709\.99 > registered bound 1/);
  assert.match(zeroBound.reason, /mean_e 9709\.99 > registered bound 1/);
  // The reason names which signal fired: the point estimate, and (when a bound was
  // recorded) that the bound was uninformative rather than exculpatory.
  assert.match(zeroBound.reason, /recorded lower bound 0 <= 1 is uninformative, not exculpatory/);
});

// The exact regression from the report: two cells, same detector/null, one carrying no
// bound and one carrying a bound clamped to 0.0000 -- both must refute, and the reason on
// each must name which signal fired.
test('meanRule regression: N4-p09 shape -- no-bound cell and zero-bound cell both refute, reasons name their signal', () => {
  const noBoundCell = { detector: 'safe_t', null_id: 'N4-p09', mean_e: 9709.99, exceedance: 0.016, lower_95: 0.013 };
  const zeroBoundCell = { detector: 'safe_t', null_id: 'N4-p09', mean_e: 9709.99, mean_e_lower_95: 0.0, exceedance: 0.016, lower_95: 0.013 };
  const r1 = meanRule(noBoundCell, 'terminal_e_value');
  const r2 = meanRule(zeroBoundCell, 'terminal_e_value');
  assert.ok(r1, 'the 2026-08-02 shape (no bound) must refute');
  assert.ok(r2, 'the 2026-08-07 shape (bound clamped to 0) must refute, not clear');
  assert.match(r1.reason, /no interval on the mean is recorded/, 'names the point estimate as the only signal available');
  assert.match(r2.reason, /uninformative, not exculpatory/, 'names the point estimate as the signal that fired despite a recorded bound');
});

test('mean_e is a recognized terminal instrument, so a mean-only cell is not VOID', () => {
  const g = applyGuards({ detector: 'safe_t', null_id: 'N4-p09', mean_e: 9709.99 }, 'terminal_e_value');
  assert.equal(g.status, 'OK');
});
