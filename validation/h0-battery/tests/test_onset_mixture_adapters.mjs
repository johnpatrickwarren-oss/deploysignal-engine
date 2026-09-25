// tests/test_onset_mixture_adapters.mjs — Amendment A5: the four adapters, smoke-checked before
// any sweep (knowledge methodology/harness-discipline): standardisation as registered, the terminal
// instrument waits for the horizon, a verified fire on an obvious signal, a verified no-fire on clean
// data, and the arm drives the shipped module (no transcription).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { rng, gaussFrom } from '../harness/nulls.mjs';
import { ONSET_ARM, ONSET_ARM_STUDY, ONSET_ARM_PIN } from '../harness/detectors.mjs';
const require = createRequire(import.meta.url);
const onset = require('../../../dist/detectors/onset-mixture-e-value.js');

const ids = ONSET_ARM.map((d) => d.id);

test('the arm is four adapters with the registered ids, study id and pin', () => {
  assert.deepEqual(ids, [
    'family_A_onset_mixture_geometric_gaussian', 'family_A_onset_mixture_geometric_bounded',
    'family_A_onset_mixture_normalized_gaussian', 'family_A_onset_mixture_normalized_bounded',
  ]);
  assert.equal(ONSET_ARM_STUDY, '2026-09-h0-battery-onset-mixture');
  assert.equal(ONSET_ARM_PIN.engine_version, require('../../../package.json').version);
});

test('A5.2 standardisation: marginal scale on the first tick, innovation scale after, whitened at phi', () => {
  // Drive the geometric gaussian adapter and read back the residual it forms by comparing its wealth
  // to the shipped function applied to the registered formula.
  const d = ONSET_ARM[0];
  const cfg = { mu: 2, sigma: 4, phi: 0.6, alpha: 0.05, ticks: 300 };
  const inst = d.make(cfg);
  const xs = [3, 1, 6, 2, 9, 4];
  const inn = 4 * Math.sqrt(1 - 0.36);
  const r = []; let prev = null;
  for (const x of xs) { const c = x - 2; r.push(prev === null ? c / 4 : (c - 0.6 * prev) / inn); prev = c; }
  for (const x of xs) inst.step(x);
  assert.equal(inst.logM(), Math.log(Math.max(onset.geometricMixtureEValue(r, 'gaussian'), 1e-300)));
});

test('the terminal adapters never fire before t = T−1, even on a huge shift, and read exactly once at T−1', () => {
  for (const d of ONSET_ARM.filter((a) => a.id.includes('normalized'))) {
    const inst = d.make({ mu: 0, sigma: 1, phi: 0, alpha: 0.05, ticks: 50 });
    for (let t = 0; t < 49; t++) assert.equal(inst.step(10), false, `${d.id} fired at t=${t}`);
    assert.equal(inst.logM(), Math.log(1e-300), 'no value read before the horizon');
    assert.equal(inst.step(10), true, `${d.id} did not fire at the horizon on a 10σ shift`);
  }
});

test('verified fire: every adapter detects a 3σ step at tick 100 within 200 ticks on N1', () => {
  for (const d of ONSET_ARM) {
    const r = rng(101); const src = gaussFrom(r);
    const inst = d.make({ mu: 0, sigma: 1, phi: 0, alpha: 0.05, ticks: 300 });
    let firedAt = -1;
    for (let t = 0; t < 300; t++) { if (inst.step(src() + (t >= 100 ? 3 : 0))) { firedAt = t; break; } }
    assert.ok(firedAt >= 100 && firedAt <= 299, `${d.id}: fired at ${firedAt}`);
  }
});

test('verified no-fire: on 20 clean N1 trajectories at alpha = 0.05 no adapter fires more than 3 times', () => {
  for (const d of ONSET_ARM) {
    let fires = 0;
    for (let i = 0; i < 20; i++) {
      const r = rng(5000 + i * 31); const src = gaussFrom(r);
      const inst = d.make({ mu: 0, sigma: 1, phi: 0, alpha: 0.05, ticks: 300 });
      for (let t = 0; t < 300; t++) if (inst.step(src())) { fires++; break; }
    }
    assert.ok(fires <= 3, `${d.id}: ${fires} fires on 20 clean trajectories`);
  }
});

test('under AR(1) phi=0.9 at oracle phi, the standardised residual has unit variance (the N3 premise)', () => {
  const r = rng(77); const g = gaussFrom(r);
  const phi = 0.9, sd = Math.sqrt(1 - phi * phi);
  let prev = g(); const xs = [];
  for (let t = 0; t < 20000; t++) { prev = phi * prev + sd * g(); xs.push(prev); }
  // replicate the adapter's standardiser through the geometric adapter is indirect; check the formula directly
  const inn = 1 * sd; let p = null; let s2 = 0, n = 0;
  for (const x of xs) { const c = x; const rr = p === null ? c : (c - phi * p) / inn; p = c; if (n > 0) s2 += rr * rr; n++; }
  const v = s2 / (n - 1);
  assert.ok(Math.abs(v - 1) < 0.05, `residual variance ${v.toFixed(3)}`);
});
