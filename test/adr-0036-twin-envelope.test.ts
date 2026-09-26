// test/adr-0036-twin-envelope.test.ts — ADR 0036: the pairing premise is part of the envelope, and
// the FDR gate asks for it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ValidityEnvelope,
  BETTING_E_PROCESS_ENVELOPE,
  pairingAdmissible,
  isValidForFdrPath,
  assertValidForFdrPath,
} from '../detectors/validity-envelope';

const RATE_LIKE: ValidityEnvelope = {
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-arms',
};
const SIGN_LIKE: ValidityEnvelope = { ...RATE_LIKE, pairingPremise: 'exchangeable-equal-weight-arms' };

test('an envelope without a pairing premise is unconstrained on this axis', () => {
  assert.equal(pairingAdmissible(BETTING_E_PROCESS_ENVELOPE, {}), true);
});

test('exchangeable-arms refuses without randomizedArms and admits with it', () => {
  assert.equal(pairingAdmissible(RATE_LIKE, {}), false);
  assert.equal(pairingAdmissible(RATE_LIKE, { randomizedArms: true }), true);
});

test('equal-weight premise needs both assertions', () => {
  assert.equal(pairingAdmissible(SIGN_LIKE, { randomizedArms: true }), false);
  assert.equal(pairingAdmissible(SIGN_LIKE, { equalWeightArms: true }), false);
  assert.equal(pairingAdmissible(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }), true);
});

test('isValidForFdrPath composes the pairing axis', () => {
  assert.equal(isValidForFdrPath(RATE_LIKE, {}), false);
  assert.equal(isValidForFdrPath(RATE_LIKE, { randomizedArms: true }), true);
});

test('assertValidForFdrPath names the missing pairing assertion', () => {
  assert.throws(() => assertValidForFdrPath(SIGN_LIKE, { randomizedArms: true }), /equalWeightArms/);
  assert.doesNotThrow(() => assertValidForFdrPath(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }));
});
