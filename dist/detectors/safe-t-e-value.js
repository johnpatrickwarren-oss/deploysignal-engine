"use strict";
// detectors/safe-t-e-value.ts — the safe (right-Haar / GROW) two-sample t-test e-value.
//
// ADR 0005. The principled fix for the calibration floor of the plug-in-variance BF (ADR 0004 PR A):
// instead of plugging in the innovation variance s² (which also set the prior scale τ²=25s² and made
// E[BF|H0] ≤ 1 only empirical for cal ≳ 100), we INTEGRATE the variance out under the improper right-Haar
// prior 1/σ. The resulting e-value is the Bayes factor of the maximal invariant (the two-sample
// t-statistic) — the GROW (growth-rate-optimal) e-statistic for a scale-invariant location-scale model
// (Pérez-Ortiz–Lardy–de Heide–Grünwald, Annals of Statistics 52(4) 2024; Grünwald–de Heide–Koolen, Safe
// Testing, JRSS-B 86(5) 2024; Hendriksen–de Heide–Grünwald, Bayesian Analysis 16(3) 2021).
//
// WHAT IT FIXES (verified) — the VARIANCE nuisance. Under H0 the two-sample t-statistic is central-t_ν
// for EVERY (μ, σ) — the location-scale invariance. The e-value is BF = m₁(t)/m₀(t) where m₀ is the
// central-t_ν density and m₁ is the marginal under a proper N(0, g) prior on the standardized effect δ.
// m₁ is a SCALED-t density (scale √(1+n_eff·g)) integrating to 1 ⇒ E[BF|H0] = 1 EXACTLY when t ~ t_ν
// (the mean is exactly 1; a finite Monte-Carlo sample mean UNDERSHOOTS it — conservatively — because the
// e-value is heavy-right-tailed). Empirically (ADR 0005): with the TRUE φ (or iid data) E[e|H0] ≤ 1 at
// EVERY calibration length incl. cal=5, and the e-value is EXACTLY invariant to the scale σ — so the
// plug-in innovation variance s² (which made ADR 0004 PR A blow up at cal=5) is genuinely fixed.
//
// WHAT IT DOES NOT FIX — the AR(1) φ plug-in (the SHARPENED open problem, ADR 0005). The t ~ t_ν null
// holds only for whitened-to-iid residuals. With φ ESTIMATED from a SHORT calibration window, φ̂ is
// unreliable, the large test window stays autocorrelated, the t-stat tail fattens, and the large-ν
// exponent ((ν+1)/2) amplifies it — so E[e|H0] still exceeds 1 below cal ≈ 100. (Magnitudes are
// order-of-magnitude only: the mean lives in a heavy right tail so it is seed-unstable; the inflation
// shows STABLY in tail probabilities — P(e ≥ k) runs ~10–15× the oracle-φ rate at cal=50, and the cal=10
// estimated/oracle mean ratio is ≫ 1000×. Still vastly better than the plug-in at extreme small cal —
// order ~10 at cal=5 vs the plug-in's ~1e252.) So this REATTRIBUTES the calibration floor: it was thought
// to be the variance plug-in; it is actually the φ plug-in. Integrating φ out (a
// prior/mixture over φ, or a HAC-style effective-sample-size correction) is the genuinely-open extension.
// For the e-BH FDR path (which needs E[e|H0] ≤ 1, the MEAN) keep a calibration floor (~100 with the
// default estimator); a caller that supplies a known/well-estimated φ via opts.ar1Phi is valid at cal ≥ 3.
//
// CLOSED FORM. With n1 = |cal residuals|, n2 = |test residuals|, ν = n1+n2−2, n_eff = n1·n2/(n1+n2),
// pooled within-window variance s_p², and t = (mean(wt) − mean(wc)) / (s_p·√(1/n1 + 1/n2)):
//
//     r  = 1 + n_eff·g
//     BF = r^(−1/2) · [ (1 + t²/ν) / (1 + (t²/ν)/r) ]^((ν+1)/2)
//
// g defaults to {@link DEFAULT_EFFECT_PRIOR_VAR} = 25, matching ADR 0004's TAU_MULT (our N(0, τ²=25s²)
// prior on the mean is exactly a N(0, 25) prior on the standardized effect δ = Δμ/σ).
//
// SCOPE / ENVELOPE: same as the plug-in BF except the variance is no longer plugged in — a mean-shift
// null with EQUAL (but unknown, integrated-out) innovation variance in cal and test, AR(1)-whitened. A
// variance CHANGE is still out of scope (route to the distributional-signature detector, ADR 0004 Tier 2).
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_T_ENVELOPE = exports.DEFAULT_EFFECT_PRIOR_VAR = void 0;
exports.safeTwoSampleTEValue = safeTwoSampleTEValue;
const family_a_mixture_supermartingale_1 = require("./family-a-mixture-supermartingale");
/** Default prior variance on the standardized effect (matches ADR 0004 TAU_MULT = 25). */
exports.DEFAULT_EFFECT_PRIOR_VAR = 25;
/** The safe-t e-value's validity envelope (ADR 0005). Mirrors the shared ValidityEnvelope shape. The
 *  variance is integrated out (E[e|H0] = 1 exactly and uniform over σ when the residuals are iid) — the
 *  `minCalibration` here is the MATH minimum; with the DEFAULT estimated φ the FDR-relevant E[e|H0] ≤ 1
 *  still needs cal ≳ 100 (the residual floor is the φ plug-in, NOT the variance — see file header / ADR 0005). */
exports.SAFE_T_ENVELOPE = Object.freeze({
    baseline: 'unknown-mean-integrated',
    autocorrelation: 'ar1-whitened',
    null: 'mean-shift',
    variance: 'stable', // equal variance cal/test, now INTEGRATED OUT (right-Haar 1/σ)
    validUnderEstimatedBaseline: true,
    minCalibration: 3, // math minimum; with ESTIMATED φ the e-BH floor is ~100 (φ-driven)
    notes: 'Right-Haar / GROW safe two-sample t-test e-value: the VARIANCE is integrated out under the '
        + 'improper 1/σ prior, so E[e|H0] = 1 exactly and uniform over σ for iid/known-φ residuals (GROW-optimal '
        + 'among all e-statistics for the scale-invariant location-scale model). With the DEFAULT estimated AR(1) '
        + 'φ, short-calibration estimation error keeps E[e|H0] > 1 below cal ≈ 100 — the residual floor is the φ '
        + 'plug-in, not the variance (ADR 0005); supply a known φ via opts.ar1Phi to be valid at cal ≥ 3.',
});
/** Sample mean. */
function mean(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
/** Safe (right-Haar / GROW) two-sample t-test e-value over a calibration window and a test window of a
 *  single contiguous series `values`. Tests a MEAN shift between the windows with the common mean AND the
 *  common (unknown) innovation variance integrated out; valid (E[e|H0] = 1, uniform over σ) for any
 *  calibration length. Whitens by the engine's native AR(1) φ (cal drops its first sample; the test window
 *  uses `values[test.start − 1]` as its first predecessor, so `test.start >= 1`).
 *
 *  @throws RangeError if the windows are out of bounds, `test.start < 1`, `cal.len < 3`, `test.len < 2`,
 *    `effectPriorVar <= 0`, or any in-window value is non-finite. */
function safeTwoSampleTEValue(values, cal, test, opts) {
    if (!Number.isInteger(cal.start) || !Number.isInteger(cal.len)
        || !Number.isInteger(test.start) || !Number.isInteger(test.len)) {
        throw new RangeError('safeTwoSampleTEValue: window start/len must be integers');
    }
    if (cal.len < 3)
        throw new RangeError(`safeTwoSampleTEValue: cal.len must be >= 3; got ${cal.len}`);
    if (test.len < 2)
        throw new RangeError(`safeTwoSampleTEValue: test.len must be >= 2; got ${test.len}`);
    if (test.start < 1) {
        throw new RangeError(`safeTwoSampleTEValue: test.start must be >= 1 (whitening needs a predecessor); got ${test.start}`);
    }
    if (cal.start < 0 || cal.start + cal.len > values.length || test.start + test.len > values.length) {
        throw new RangeError(`safeTwoSampleTEValue: window out of bounds (values.length=${values.length}, `
            + `cal=[${cal.start},${cal.start + cal.len}), test=[${test.start},${test.start + test.len}))`);
    }
    for (let t = cal.start; t < cal.start + cal.len; t++) {
        if (!Number.isFinite(values[t]))
            throw new RangeError(`safeTwoSampleTEValue: non-finite value at calibration index ${t}`);
    }
    for (let t = test.start - 1; t < test.start + test.len; t++) {
        if (!Number.isFinite(values[t]))
            throw new RangeError(`safeTwoSampleTEValue: non-finite value at test index ${t}`);
    }
    const g = opts?.effectPriorVar ?? exports.DEFAULT_EFFECT_PRIOR_VAR;
    if (!(g > 0))
        throw new RangeError(`safeTwoSampleTEValue: effectPriorVar must be > 0; got ${g}`);
    // AR(1) coefficient: engine-native Kendall-corrected estimate on the cal window (unless overridden).
    const calValues = values.slice(cal.start, cal.start + cal.len);
    const phi = opts?.ar1Phi ?? (0, family_a_mixture_supermartingale_1.computePerSignalAr1Phi)(calValues, mean(calValues));
    // Whiten (no centering — the mean is integrated out): cal drops its first sample; test uses its predecessor.
    const wc = [];
    for (let t = cal.start + 1; t < cal.start + cal.len; t++)
        wc.push(values[t] - phi * values[t - 1]);
    const wt = [];
    for (let t = test.start; t < test.start + test.len; t++)
        wt.push(values[t] - phi * values[t - 1]);
    const n1 = wc.length, n2 = wt.length;
    const mc = mean(wc), mt = mean(wt);
    // Pooled WITHIN-window variance (a between-window mean shift does NOT inflate it).
    let ss = 0;
    for (const x of wc)
        ss += (x - mc) ** 2;
    for (const x of wt)
        ss += (x - mt) ** 2;
    const nu = n1 + n2 - 2; // >= 2 since n1 >= 2, n2 >= 2
    const sp2 = Math.max(ss / nu, 1e-12);
    const nEff = (n1 * n2) / (n1 + n2);
    const seFactor = Math.sqrt(1 / n1 + 1 / n2);
    const t = (mt - mc) / (Math.sqrt(sp2) * seFactor);
    // BF = r^(-1/2) · [ (1 + t²/ν) / (1 + (t²/ν)/r) ]^((ν+1)/2),  r = 1 + n_eff·g.
    const r = 1 + nEff * g;
    const t2nu = (t * t) / nu;
    return Math.pow(r, -0.5) * Math.pow((1 + t2nu) / (1 + t2nu / r), (nu + 1) / 2);
}
//# sourceMappingURL=safe-t-e-value.js.map