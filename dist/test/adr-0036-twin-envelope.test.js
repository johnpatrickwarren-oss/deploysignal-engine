"use strict";
// test/adr-0036-twin-envelope.test.ts — ADR 0036: the pairing premise is part of the envelope, and
// the FDR gate asks for it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const validity_envelope_1 = require("../detectors/validity-envelope");
const RATE_LIKE = {
    baseline: 'randomized-twin',
    autocorrelation: 'shared-cancels',
    null: 'paired-order',
    variance: 'none',
    validUnderEstimatedBaseline: true,
    statistic: 'e-value',
    pairingPremise: 'exchangeable-arms',
};
const SIGN_LIKE = { ...RATE_LIKE, pairingPremise: 'exchangeable-equal-weight-arms' };
(0, node_test_1.test)('an envelope without a pairing premise is unconstrained on this axis', () => {
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(validity_envelope_1.BETTING_E_PROCESS_ENVELOPE, {}), true);
});
(0, node_test_1.test)('exchangeable-arms refuses without randomizedArms and admits with it', () => {
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(RATE_LIKE, {}), false);
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(RATE_LIKE, { randomizedArms: true }), true);
});
(0, node_test_1.test)('equal-weight premise needs both assertions', () => {
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(SIGN_LIKE, { randomizedArms: true }), false);
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(SIGN_LIKE, { equalWeightArms: true }), false);
    strict_1.default.equal((0, validity_envelope_1.pairingAdmissible)(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }), true);
});
(0, node_test_1.test)('isValidForFdrPath composes the pairing axis', () => {
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(RATE_LIKE, {}), false);
    strict_1.default.equal((0, validity_envelope_1.isValidForFdrPath)(RATE_LIKE, { randomizedArms: true }), true);
});
(0, node_test_1.test)('assertValidForFdrPath names the missing pairing assertion', () => {
    strict_1.default.throws(() => (0, validity_envelope_1.assertValidForFdrPath)(SIGN_LIKE, { randomizedArms: true }), /equalWeightArms/);
    strict_1.default.doesNotThrow(() => (0, validity_envelope_1.assertValidForFdrPath)(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }));
});
//# sourceMappingURL=adr-0036-twin-envelope.test.js.map