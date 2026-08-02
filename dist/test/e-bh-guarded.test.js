"use strict";
// test/e-bh-guarded.test.ts — the gate must REFUSE, not report.
//
// Before 2026-08-02 assertValidForFdrPath had zero production callers across six repos and
// minCalibration was read by nothing. These assertions exist so that cannot silently recur.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const e_bh_guarded_1 = require("../fleet/e-bh-guarded");
const ok = (detectorId, eValue, extra = {}) => ({ detectorId, eValue, ...extra });
(0, node_test_1.test)('an unknown detector id is refused, not admitted', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('spectral_e_detector_kv_cache', 5)], 0.1), /no validity envelope/, 'a blank envelope means unrecorded, not safe');
});
(0, node_test_1.test)('Families C, D and E are absent from the map, so all three are refused', () => {
    for (const id of ['hotelling_t2_safe', 'sequential_mmd_betting_e_process',
        'spectral_e_detector_kv_cache', 'mahalanobis_conformal_baseline']) {
        strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)(id), undefined, `${id} must not have an envelope yet`);
        strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok(id, 5)], 0.1), /no validity envelope/);
    }
});
(0, node_test_1.test)('a plug-in detector is refused under an estimated baseline', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('betting_e_process', 50)], 0.1), /outside its validity regime/, 'betting is validUnderEstimatedBaseline: false and asserts nothing here');
});
(0, node_test_1.test)('the same detector is admitted once the caller asserts its regime', () => {
    const r = (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('betting_e_process', 50, { assertions: { trueBaseline: true } })], 0.1);
    strict_1.default.ok(r.selected.length >= 0, 'admitted with an explicit regime assertion');
});
(0, node_test_1.test)('safe-t and both UI envelopes pass the gate — they could not even be typed before', () => {
    for (const id of ['safe_t_e_value', 'universal_inference_e_value', 'sequential_ui_e_process']) {
        strict_1.default.ok((0, e_bh_guarded_1.envelopeFor)(id), `${id} must be mapped`);
        strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok(id, 50)], 0.1), `${id} is validUnderEstimatedBaseline: true`);
    }
});
(0, node_test_1.test)('the retracted BF is refused by name rather than as an unknown id', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('nuisance_robust_bf_e_value', 50)], 0.1), /outside its validity regime/);
});
(0, node_test_1.test)('minCalibration is enforced — no code path read it before', () => {
    const env = (0, e_bh_guarded_1.envelopeFor)('safe_t_e_value');
    strict_1.default.ok(env?.minCalibration !== undefined, 'safe-t declares a floor');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { calLen: env.minCalibration - 1 })], 0.1), /needs cal ≥/);
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { calLen: env.minCalibration })], 0.1));
});
(0, node_test_1.test)('one bad shard refuses the whole batch', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50), ok('spectral_e_detector_kv_cache', 50)], 0.1), /no validity envelope/, 'e-BH is a joint procedure; a single inadmissible coordinate voids the guarantee');
});
(0, node_test_1.test)('every mapped envelope satisfies the type at runtime too', () => {
    for (const [id, env] of Object.entries(e_bh_guarded_1.DETECTOR_ENVELOPES)) {
        strict_1.default.equal(typeof env.validUnderEstimatedBaseline, 'boolean', `${id}`);
        strict_1.default.ok(env.baseline && env.autocorrelation && env.null && env.variance, `${id}`);
    }
});
//# sourceMappingURL=e-bh-guarded.test.js.map