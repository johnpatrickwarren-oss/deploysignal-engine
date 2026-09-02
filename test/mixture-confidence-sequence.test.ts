// The mixture CS is the detector's own game inverted: the interval excludes 0 exactly when the
// mixture supermartingale on S_t reaches 1/α, and its edges are the roots of log M_t(S_t − tm)
// = log(1/α) in m.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixtureConfidenceSequence } from '../detectors/mixture-confidence-sequence';
import { computeGaussianMixtureLogSupermartingale } from '../detectors/family-a-mixture-supermartingale';

test('the interval edges are exactly where the shifted mixture reaches 1/α', () => {
  for (const [S, t, s2, rho, alpha] of [[3.2, 10, 1, 1, 0.05], [-40, 300, 2.5, 38, 0.01], [0.1, 1, 1, 1, 0.05]] as const) {
    const cs = mixtureConfidenceSequence({ S_t: S, t, sigma_squared: s2, sigma_squared_prior: rho, alpha });
    for (const edge of [cs.lower, cs.upper]) {
      const logM = computeGaussianMixtureLogSupermartingale(S - t * edge, t, s2, rho);
      assert.ok(Math.abs(logM - Math.log(1 / alpha)) < 1e-9, `edge ${edge}: log M = ${logM} vs ${Math.log(1 / alpha)}`);
    }
    // strictly inside: the game has not made money
    const inside = computeGaussianMixtureLogSupermartingale(S - t * cs.center, t, s2, rho);
    assert.ok(inside < Math.log(1 / alpha));
  }
});

test('excludes_zero ⇔ the detector fires on the same S_t', () => {
  for (let S = -30; S <= 30; S += 0.5) {
    const t = 50, s2 = 1, rho = 1, alpha = 0.05;
    const cs = mixtureConfidenceSequence({ S_t: S, t, sigma_squared: s2, sigma_squared_prior: rho, alpha });
    const fires = computeGaussianMixtureLogSupermartingale(S, t, s2, rho) >= Math.log(1 / alpha);
    assert.equal(cs.excludes_zero, fires, `S=${S}`);
  }
});

test('the half-width is Howard eq. 14 and shrinks like sqrt(log t / t)', () => {
  const w = (t: number) => mixtureConfidenceSequence({ S_t: 0, t, sigma_squared: 1, sigma_squared_prior: 1, alpha: 0.05 }).half_width;
  const closed = (t: number) => Math.sqrt((t + 1) * Math.log((t + 1) / (0.0025))) / t;
  for (const t of [1, 10, 100, 1000, 10000]) assert.ok(Math.abs(w(t) - closed(t)) < 1e-12);
  assert.ok(w(10000) < w(1000) && w(1000) < w(100));
});

test('rejects malformed inputs', () => {
  assert.throws(() => mixtureConfidenceSequence({ S_t: 0, t: 0, sigma_squared: 1, sigma_squared_prior: 1, alpha: 0.05 }), /t must be/);
  assert.throws(() => mixtureConfidenceSequence({ S_t: 0, t: 1, sigma_squared: 1, sigma_squared_prior: 0, alpha: 0.05 }), /prior/);
  assert.throws(() => mixtureConfidenceSequence({ S_t: 0, t: 1, sigma_squared: 1, sigma_squared_prior: 1, alpha: 1 }), /alpha/);
});
