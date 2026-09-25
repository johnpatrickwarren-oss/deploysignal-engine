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
(0, node_test_1.test)('both UI envelopes pass the gate unconditionally — no measured φ bound', () => {
    // safe-t is deliberately NOT in this list any more; see the φ-bound test below.
    for (const id of ['universal_inference_e_value', 'sequential_ui_e_process']) {
        strict_1.default.ok((0, e_bh_guarded_1.envelopeFor)(id), `${id} must be mapped`);
        strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok(id, 50)], 0.1), `${id} is validUnderEstimatedBaseline: true and carries no maxPhiValid`);
    }
});
(0, node_test_1.test)('safe-t now requires a φ within its measured validity bound — CONTRACT CHANGE 2026-08-05', () => {
    // Was: safe-t passed the gate unconditionally, as validUnderEstimatedBaseline: true.
    // Now: its envelope carries maxPhiValid = 0.95, because exceedance was measured at 0.1420
    // against α=0.05 at φ=0.99 (knowledge/stats/power-per-cell-2026-08-05). An UNMEASURED φ is
    // refused, on the same principle this module already applies to an unmapped detector id:
    // blank means unrecorded, not safe.
    strict_1.default.ok((0, e_bh_guarded_1.envelopeFor)('safe_t_e_value'), 'safe_t_e_value must be mapped');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50)], 0.1), /UNMEASURED φ/, 'an unmeasured φ is refused, not assumed to be zero');
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } })], 0.1), 'the escape hatch is explicit and greppable, not a silent default');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.99 } })], 0.1), /φ=0.99/, 'a φ above the bound is refused');
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.95 } })], 0.1), 'φ at the bound is admitted');
});
(0, node_test_1.test)('the retracted BF is refused by name rather than as an unknown id', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('nuisance_robust_bf_e_value', 50)], 0.1), /outside its validity regime/);
});
(0, node_test_1.test)('minCalibration is enforced — no code path read it before', () => {
    const env = (0, e_bh_guarded_1.envelopeFor)('safe_t_e_value');
    strict_1.default.ok(env?.minCalibration !== undefined, 'safe-t declares a floor');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, {
            calLen: env.minCalibration - 1,
            // φ acknowledged so this reaches the calLen check rather than stopping at the φ gate.
            assertions: { phiUnmeasuredAccepted: true },
        })], 0.1), /needs cal ≥/);
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, {
            calLen: env.minCalibration,
            assertions: { phiUnmeasuredAccepted: true },
        })], 0.1));
});
(0, node_test_1.test)('one bad shard refuses the whole batch', () => {
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } }), ok('spectral_e_detector_kv_cache', 50)], 0.1), /no validity envelope/, 'e-BH is a joint procedure; a single inadmissible coordinate voids the guarantee');
});
(0, node_test_1.test)('every mapped envelope satisfies the type at runtime too', () => {
    for (const [id, env] of Object.entries(e_bh_guarded_1.DETECTOR_ENVELOPES)) {
        strict_1.default.equal(typeof env.validUnderEstimatedBaseline, 'boolean', `${id}`);
        strict_1.default.ok(env.baseline && env.autocorrelation && env.null && env.variance, `${id}`);
    }
});
// ── ADR 0035: the tail premise ──────────────────────────────────────────────────────────────────
const calibration_monitor_1 = require("../fleet/calibration-monitor");
const validity_envelope_1 = require("../detectors/validity-envelope");
(0, node_test_1.test)('ADR 0035: an envelope carrying a tail premise refuses fit ≫ horizon alone, names the premise, and admits the matching promise', () => {
    // h0-battery Amendment A6 (inc-20260925T044059Z): Gaussian increment 1.61 on t3 / 1.91 on the
    // lognormal; bounded increment 1.0009-1.0083 for the negative-λ wealths on the lognormal.
    strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)('onset_mixture_gaussian').tailPremise, 'mgf');
    strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)('onset_mixture_bounded').tailPremise, 'clip-mean-zero');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true } })], 0.1), /mgf exists.*1\.61 on t3.*no increment mean was measured/s, 'the Gaussian premise is named with its measurement');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true } })], 0.1), /CLIPPED residual.*1\.0009-1\.0083/s, 'the bounded premise is named with its measurement');
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, lightTails: true } })], 0.1));
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, clipMeanZero: true } })], 0.1));
    // the wrong premise's promise does not transfer
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, clipMeanZero: true } })], 0.1), /mgf exists/);
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, lightTails: true } })], 0.1), /CLIPPED residual/);
    // the tail assertion does not replace the baseline one
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_gaussian', 50, { assertions: { lightTails: true } })], 0.1), /estimated baseline/);
});
(0, node_test_1.test)('ADR 0035: a measured increment mean clears without a promise, refutes over any promise, and falls back to the promise when inconclusive', () => {
    strict_1.default.equal(validity_envelope_1.INCREMENT_MEAN_BOUND, 1.0005);
    const g = (assertions) => () => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, ...assertions } })], 0.1);
    strict_1.default.doesNotThrow(g({ incrementMean: { lower95: 0.9952, upper95: 0.9983 } }), 'A6 N1: CLEARED');
    strict_1.default.throws(g({ incrementMean: { lower95: 1.5997, upper95: 1.6157 }, lightTails: true }), /REFUTES.*no promise overrides/s, 'A6 N6: REFUTED, the promise does not save it');
    strict_1.default.throws(g({ incrementMean: { lower95: 0.99, upper95: 1.01 } }), /inconclusive/, 'a short feed: inconclusive, no promise');
    strict_1.default.doesNotThrow(g({ incrementMean: { lower95: 0.99, upper95: 1.01 }, lightTails: true }), 'a short feed with the promise');
    const b = (assertions) => () => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, ...assertions } })], 0.1);
    strict_1.default.throws(b({ incrementMean: { lower95: 1.00808, upper95: 1.00858 }, clipMeanZero: true }), /REFUTES/, 'A6 N5 λ = −0.9');
    strict_1.default.doesNotThrow(b({ incrementMean: { lower95: 0.99971, upper95: 1.00021 } }), 'A6 N6 λ = −0.9: CLEARED');
});
(0, node_test_1.test)('ADR 0035: envelopes without a tail premise are unchanged — the premise is unrecorded for them, not waived', () => {
    for (const id of ['betting_e_process', 'page_cusum_mixture_supermartingale', 'contrast_null_mixture']) {
        strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)(id).tailPremise, undefined, id);
        strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([ok(id, 50, { assertions: { mMuchGreaterThanN: true } })], 0.1), id);
    }
});
(0, node_test_1.test)('ADR 0035: why the Ville monitor\'s verdict is not a tail assertion — on t3 it barely revokes while the increment estimator refutes', () => {
    // ∏ g drifts at E[log g], negative under a heavy tail even when E[g] = 1.6. Seeds fixed; 100 feeds × 2000 ticks.
    const mul = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const gaussFrom = (r) => () => { let u = 0, v = 0; while (u === 0)
        u = r(); while (v === 0)
        v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const t3 = (g) => () => { const z = g(); const chi = g() ** 2 + g() ** 2 + g() ** 2; return (z / Math.sqrt(chi / 3)) / Math.sqrt(3); };
    let revoked = 0;
    const est = (0, calibration_monitor_1.freshIncrementEstimator)();
    for (let i = 0; i < 100; i++) {
        const src = t3(gaussFrom(mul(1000 + i)));
        const m = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01, incrementKind: 'gaussian' });
        for (let t = 0; t < 2000; t++) {
            const r = src();
            (0, calibration_monitor_1.updateCalibration)(m, r);
            (0, calibration_monitor_1.updateIncrementEstimator)(est, Math.log((0, calibration_monitor_1.gInc)(r)));
        }
        if (!m.passing)
            revoked++;
    }
    const e = (0, calibration_monitor_1.incrementEstimate)(est);
    strict_1.default.ok(revoked <= 10, `the monitor revoked ${revoked}/100 t3 feeds — expected a handful (measured 1.25% at 400 feeds)`);
    strict_1.default.ok(e.lower95 > validity_envelope_1.INCREMENT_MEAN_BOUND && e.mean > 1.4, `the estimator on the same 200,000 increments: mean ${e.mean.toFixed(3)}, lower95 ${e.lower95.toFixed(3)} — a refutation`);
});
(0, node_test_1.test)('ADR 0035: where the monitor does revoke on heavy tails the channel is the MAD scale of the fit, not the tail — 0.656 on unit-variance t3', () => {
    // knowledge stats/e-by-t2-2026-09-04 and stats/contrast-null-2026-09-05 record the Gaussian monitor
    // revoking under t3; the contrast fit standardises by MAD (per-shard/contrast.ts:95). Same seeds,
    // three scales: oracle 2.5%, fit sd 3.5%, fit MAD 73.5% at 200 feeds. 60 feeds here.
    const mul = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const gaussFrom = (r) => () => { let u = 0, v = 0; while (u === 0)
        u = r(); while (v === 0)
        v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const t3 = (g) => () => { const z = g(); const chi = g() ** 2 + g() ** 2 + g() ** 2; return (z / Math.sqrt(chi / 3)) / Math.sqrt(3); };
    const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
    const mad = (a) => { const m = median(a); return 1.4826 * median(a.map((x) => Math.abs(x - m))); };
    let revokedOracle = 0, revokedMad = 0, madSum = 0;
    for (let i = 0; i < 60; i++) {
        const src = t3(gaussFrom(mul(5000 + i)));
        const fit = Array.from({ length: 2000 }, src);
        const s = mad(fit);
        madSum += s;
        const stream = Array.from({ length: 2000 }, src);
        const mo = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01, incrementKind: 'gaussian' });
        const mm = (0, calibration_monitor_1.freshCalibrationMonitor)({ alpha: 0.01, incrementKind: 'gaussian' });
        for (const r of stream) {
            (0, calibration_monitor_1.updateCalibration)(mo, r);
            (0, calibration_monitor_1.updateCalibration)(mm, r / s);
        }
        if (!mo.passing)
            revokedOracle++;
        if (!mm.passing)
            revokedMad++;
    }
    strict_1.default.ok(madSum / 60 < 0.72 && madSum / 60 > 0.60, `MAD of unit-variance t3 reads ${(madSum / 60).toFixed(3)}`);
    strict_1.default.ok(revokedOracle <= 8, `oracle scale: ${revokedOracle}/60 revoked`);
    strict_1.default.ok(revokedMad >= 30, `MAD scale: ${revokedMad}/60 revoked — the scale channel`);
});
//# sourceMappingURL=e-bh-guarded.test.js.map