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

test('safe-t and both UI envelopes pass the gate — they could not even be typed before', () => {
  for (const id of ['safe_t_e_value', 'universal_inference_e_value', 'sequential_ui_e_process']) {
    assert.ok(envelopeFor(id), `${id} must be mapped`);
    assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok(id, 50)], 0.1),
      `${id} is validUnderEstimatedBaseline: true`);
  }
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
      [ok('safe_t_e_value', 50, { calLen: (env!.minCalibration as number) - 1 })], 0.1),
    /needs cal ≥/,
  );
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded(
    [ok('safe_t_e_value', 50, { calLen: env!.minCalibration })], 0.1));
});

test('one bad shard refuses the whole batch', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50), ok('spectral_e_detector_kv_cache', 50)], 0.1),
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
