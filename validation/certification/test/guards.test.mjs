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

test('increment instrument on an e_process cell is VOID', () => {
  const g = applyGuards(seqCell(), 'e_process');
  assert.equal(g.status, 'VOID');
});

test('healthy martingale cell passes', () => {
  assert.equal(applyGuards(seqCell(), 'test_martingale').status, 'OK');
});

test('internalConsistency flags an impossible increment/crossing pair', () => {
  const bad = seqCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0 });
  const flags = internalConsistency([bad]);
  assert.equal(flags.length, 1);
  assert.match(flags[0], /N1/);
});

test('e-process instrument on a terminal_e_value cell is VOID', () => {
  const g = applyGuards({detector: 'x', null_id: 'N1', stopped_mean: 2.5e-5, crossing_rate: 0}, 'terminal_e_value');
  assert.equal(g.status, 'VOID');
});

test('terminal instrument on an e_process cell is VOID', () => {
  const g = applyGuards({detector: 'x', null_id: 'N1', exceedance: 0.01}, 'e_process');
  assert.equal(g.status, 'VOID');
});

test('power cell with non_finite_wealth > 0 is NON_FINITE', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N5', detection_rate: 0, shift_sigma: 3, non_finite_wealth: 12, verdict: 'INERT' }, 'test_martingale');
  assert.equal(g.status, 'NON_FINITE');
});
