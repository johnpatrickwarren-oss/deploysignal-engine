import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGuards, internalConsistency } from '../lib/guards.mjs';

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
