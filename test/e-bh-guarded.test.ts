// test/e-bh-guarded.test.ts — the gate must REFUSE, not report.
//
// Before 2026-08-02 assertValidForFdrPath had zero production callers across six repos and
// minCalibration was read by nothing. These assertions exist so that cannot silently recur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eBenjaminiHochbergGuarded, envelopeFor, DETECTOR_ENVELOPES,
} from '../fleet/e-bh-guarded';

const ok = (detectorId: string, eValue: number, extra = {}) => ({ detectorId, eValue, ...extra });

test('an unknown detector id is refused, not admitted', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('spectral_e_detector_kv_cache', 5)], 0.1),
    /no validity envelope/,
    'a blank envelope means unrecorded, not safe',
  );
});

test('Families C, D and E are absent from the map, so all three are refused', () => {
  for (const id of ['hotelling_t2_safe', 'sequential_mmd_betting_e_process',
    'spectral_e_detector_kv_cache', 'mahalanobis_conformal_baseline']) {
    assert.equal(envelopeFor(id), undefined, `${id} must not have an envelope yet`);
    assert.throws(() => eBenjaminiHochbergGuarded([ok(id, 5)], 0.1), /no validity envelope/);
  }
});

test('a plug-in detector is refused under an estimated baseline', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('betting_e_process', 50)], 0.1),
    /outside its validity regime/,
    'betting is validUnderEstimatedBaseline: false and asserts nothing here',
  );
});

test('the same detector is admitted once the caller asserts its regime', () => {
  const r = eBenjaminiHochbergGuarded(
    [ok('betting_e_process', 50, { assertions: { trueBaseline: true } })], 0.1);
  assert.ok(r.selected.length >= 0, 'admitted with an explicit regime assertion');
});

test('both UI envelopes pass the gate unconditionally — no measured φ bound', () => {
  // safe-t is deliberately NOT in this list any more; see the φ-bound test below.
  for (const id of ['universal_inference_e_value', 'sequential_ui_e_process']) {
    assert.ok(envelopeFor(id), `${id} must be mapped`);
    assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok(id, 50)], 0.1),
      `${id} is validUnderEstimatedBaseline: true and carries no maxPhiValid`);
  }
});

test('safe-t now requires a φ within its measured validity bound — CONTRACT CHANGE 2026-08-05', () => {
  // Was: safe-t passed the gate unconditionally, as validUnderEstimatedBaseline: true.
  // Now: its envelope carries maxPhiValid = 0.95, because exceedance was measured at 0.1420
  // against α=0.05 at φ=0.99 (knowledge/stats/power-per-cell-2026-08-05). An UNMEASURED φ is
  // refused, on the same principle this module already applies to an unmapped detector id:
  // blank means unrecorded, not safe.
  assert.ok(envelopeFor('safe_t_e_value'), 'safe_t_e_value must be mapped');
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('safe_t_e_value', 50)], 0.1),
    /UNMEASURED φ/,
    'an unmeasured φ is refused, not assumed to be zero',
  );
  assert.doesNotThrow(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } })], 0.1),
    'the escape hatch is explicit and greppable, not a silent default',
  );
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.99 } })], 0.1),
    /φ=0.99/,
    'a φ above the bound is refused',
  );
  assert.doesNotThrow(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.95 } })], 0.1),
    'φ at the bound is admitted',
  );
});

test('the retracted BF is refused by name rather than as an unknown id', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('nuisance_robust_bf_e_value', 50)], 0.1),
    /outside its validity regime/,
  );
});

test('minCalibration is enforced — no code path read it before', () => {
  const env = envelopeFor('safe_t_e_value');
  assert.ok(env?.minCalibration !== undefined, 'safe-t declares a floor');
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, {
        calLen: (env!.minCalibration as number) - 1,
        // φ acknowledged so this reaches the calLen check rather than stopping at the φ gate.
        assertions: { phiUnmeasuredAccepted: true },
      })], 0.1),
    /needs cal ≥/,
  );
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded(
    [ok('safe_t_e_value', 50, {
      calLen: env!.minCalibration,
      assertions: { phiUnmeasuredAccepted: true },
    })], 0.1));
});

test('one bad shard refuses the whole batch', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } }), ok('spectral_e_detector_kv_cache', 50)], 0.1),
    /no validity envelope/,
    'e-BH is a joint procedure; a single inadmissible coordinate voids the guarantee',
  );
});

test('every mapped envelope satisfies the type at runtime too', () => {
  for (const [id, env] of Object.entries(DETECTOR_ENVELOPES)) {
    assert.equal(typeof env.validUnderEstimatedBaseline, 'boolean', `${id}`);
    assert.ok(env.baseline && env.autocorrelation && env.null && env.variance, `${id}`);
  }
});
