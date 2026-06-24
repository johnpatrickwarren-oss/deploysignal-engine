"use strict";
// detectors/distributional-signature.ts — distributional-change detectors (variance / trend / collapse).
//
// Promoted per ADR 0004 Tier 2 (engine/consumer charter + nuisance-robust evidence stack); validated in
// Tessera as tools/fault-discriminator.ts:faultSignature (Tessera ADR 0016 "Lever B", cold-eyed). This
// promotes the signature SCORES only; the benign/fault routing POLICY and the deploy/schedule event feed
// stay in the consumer (ADR 0004 Tier 3 — they depend on an app-specific event channel).
//
// WHY THIS EXISTS — the BF's blind spot. The nuisance-robust BF e-value (ADR 0004 PR A) tests a MEAN
// shift assuming the SAME innovation variance in calibration and test; a change that is NOT a clean mean
// step — variance inflation (SDC / bit-flip), a degradation trend, or a downward collapse (detachment) —
// is out of its scope. This detector scores exactly those three distributional signatures, the natural
// complement to the BF on the detection (FD) side.
//
// THE LOAD-BEARING FIX — the trend statistic MUST be computed on WHITENED innovations. On raw
// autocorrelated values the OLS slope's iid standard error is invalid: AR(1) dependence inflates the
// t-stat by ~400× (Tessera ADR 0016), so a benign autocorrelated stream spuriously "trends." Whitening
// by the calibration AR(1) φ restores an iid residual where the iid slope-se is valid; a real ramp
// survives whitening as a slope ≈ b·(1−φ) and still trips, while AR(1) noise no longer does.
//
// SCOPE / CONDITIONS (this is the FD side — characterized, NOT an FP/FDR guarantee):
//   - The thresholds (F/trend/collapse) are fixed and principled; the benign false-trip rate is to be
//     MEASURED on the consumer's data, not assumed.
//   - collapseSigma is ONE-SIDED (downward only): an upward change is invisible to it, and a large
//     DOWNWARD benign step is indistinguishable from a collapse — it separates on magnitude/direction,
//     not benign-vs-fault, in that direction.
//   - The IRREDUCIBLE limit (named in ADR 0004 + Tessera ADR 0016): a fault whose ONLY signature is a
//     mean step the size of a benign change has NO distributional signature here and is statistically
//     indistinguishable from benign change — only an external event channel (consumer-side) resolves it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLAPSE_SIGMA_THRESHOLD = exports.TREND_T_THRESHOLD = exports.F_RATIO_THRESHOLD = void 0;
exports.distributionalSignature = distributionalSignature;
const family_a_mixture_supermartingale_1 = require("./family-a-mixture-supermartingale");
/** Signature thresholds (Tessera ADR 0016). `hasSignature` trips if any score exceeds its threshold. */
exports.F_RATIO_THRESHOLD = 2.0; // innovation-variance ratio (test/cal)
exports.TREND_T_THRESHOLD = 4.0; // |OLS slope| / slope-se on whitened test innovations
exports.COLLAPSE_SIGMA_THRESHOLD = 6.0; // downward drop of the test mean below cal, in cal-σ units
function mean(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
/** Sample variance (n−1) about `mu`, floored at 1e-9. */
function variance(xs, mu) {
    return Math.max(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, xs.length - 1), 1e-9);
}
/** Distributional-signature scores on the test window vs the calibration window of a single contiguous
 *  series `values`: evidence of a change OTHER than a clean mean step (which the BF e-value already
 *  covers). Whitening uses the engine's native Kendall-corrected AR(1) φ on the calibration window; the
 *  calibration window drops its first sample and the test window uses `values[test.start − 1]` as the
 *  predecessor of its first sample (so `test.start >= 1`).
 *
 *  The two windows may be arbitrary index ranges (they need not be adjacent, and overlap is not
 *  forbidden); the canonical m≫n calibration-then-test layout is the CALLER's discipline, not enforced.
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `cal.len < 3`, `test.len < 2`,
 *    or any in-window value is non-finite. */
function distributionalSignature(values, cal, test) {
    if (!Number.isInteger(cal.start) || !Number.isInteger(cal.len)
        || !Number.isInteger(test.start) || !Number.isInteger(test.len)) {
        throw new RangeError('distributionalSignature: window start/len must be integers');
    }
    if (cal.len < 3)
        throw new RangeError(`distributionalSignature: cal.len must be >= 3; got ${cal.len}`);
    if (test.len < 2)
        throw new RangeError(`distributionalSignature: test.len must be >= 2; got ${test.len}`);
    if (test.start < 1) {
        throw new RangeError(`distributionalSignature: test.start must be >= 1 (whitening needs a predecessor); got ${test.start}`);
    }
    if (cal.start < 0 || cal.start + cal.len > values.length || test.start + test.len > values.length) {
        throw new RangeError(`distributionalSignature: window out of bounds (values.length=${values.length}, `
            + `cal=[${cal.start},${cal.start + cal.len}), test=[${test.start},${test.start + test.len}))`);
    }
    for (let t = cal.start; t < cal.start + cal.len; t++) {
        if (!Number.isFinite(values[t]))
            throw new RangeError(`distributionalSignature: non-finite value at calibration index ${t}`);
    }
    for (let t = test.start - 1; t < test.start + test.len; t++) {
        if (!Number.isFinite(values[t]))
            throw new RangeError(`distributionalSignature: non-finite value at test index ${t}`);
    }
    const calValues = values.slice(cal.start, cal.start + cal.len);
    const phi = (0, family_a_mixture_supermartingale_1.computePerSignalAr1Phi)(calValues, mean(calValues));
    // Whitened innovations (no centering): cal drops its first sample; test uses its predecessor.
    const wc = [];
    for (let t = cal.start + 1; t < cal.start + cal.len; t++)
        wc.push(values[t] - phi * values[t - 1]);
    const wt = [];
    for (let t = test.start; t < test.start + test.len; t++)
        wt.push(values[t] - phi * values[t - 1]);
    // (a) variance ratio.
    const s2c = variance(wc, mean(wc));
    const fRatio = variance(wt, mean(wt)) / s2c;
    // (b) trend t-stat: OLS slope on the WHITENED test innovations, with the iid slope-se (valid because
    //     the innovations are whitened). t = |slope| / sqrt(s2c / Σ(k−k̄)²).
    const nt = wt.length, kbar = (nt - 1) / 2, wtbar = mean(wt);
    let stt = 0, sty = 0;
    for (let k = 0; k < nt; k++) {
        stt += (k - kbar) ** 2;
        sty += (k - kbar) * (wt[k] - wtbar);
    }
    const slope = stt > 0 ? sty / stt : 0;
    const trendT = Math.abs(slope) / Math.sqrt(s2c / Math.max(stt, 1e-9));
    // (c) collapse: downward drop of the test RAW mean below the cal RAW mean, in cal-σ units (one-sided).
    const calMean = mean(calValues);
    const testMean = mean(values.slice(test.start, test.start + test.len));
    const sigmaCal = Math.sqrt(variance(calValues, calMean));
    const collapseSigma = Math.max(0, (calMean - testMean) / sigmaCal);
    return {
        fRatio,
        trendT,
        collapseSigma,
        hasSignature: fRatio > exports.F_RATIO_THRESHOLD || trendT > exports.TREND_T_THRESHOLD || collapseSigma > exports.COLLAPSE_SIGMA_THRESHOLD,
    };
}
//# sourceMappingURL=distributional-signature.js.map