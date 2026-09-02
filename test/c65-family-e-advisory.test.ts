// C65 — a zero Family E budget is advisory, not silence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asAdvisory } from '../detectors/conformal';
import type { DetectorVerdict } from '../types';

const fire: DetectorVerdict = {
  verdict: 'fire', statistic: 12.3, threshold: 1e-4, alpha_consumed: 1e-4, alpha_spent: 1e-4,
  reason_code: 'conformal_p_below_threshold', family: 'E',
};

test('an advisory fire keeps its verdict and statistic, spends nothing, and is tagged', () => {
  const a = asAdvisory(fire);
  assert.equal(a.verdict, 'fire');
  assert.equal(a.statistic, 12.3);
  assert.equal(a.alpha_spent, 0);
  assert.equal(a.alpha_consumed, 0);
  assert.equal(a.reason_code, 'advisory_zero_budget');
  assert.equal(a.family, 'E');
});

test('a clean or suppressed verdict is untouched except for the zero α accounting', () => {
  const clean: DetectorVerdict = { ...fire, verdict: 'clean', alpha_consumed: 0, alpha_spent: 0, reason_code: 'below_threshold' };
  assert.deepEqual(asAdvisory(clean), clean);
});

test('the source reads the budget with ?? and routes zero to the nominal level (the guard no longer sees 1/0)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.join(process.cwd(), 'detectors', 'conformal.ts'), 'utf8');
  assert.ok(src.includes('const advisory = alphaBudget === 0;'));
  assert.ok(src.includes('const alphaE = advisory ? DEFAULT_ALPHA_E : alphaBudget;'));
  assert.ok(src.indexOf('const alphaE = advisory') < src.indexOf('Math.ceil(1 / alphaE)'), 'the nominal level is set before the sample guard');
});
