"use strict";
// detectors/shape-kurtosis-e-value.ts — Family E shape score (C22).
//
// Replaces the capability retired with the Family C MMD betting e-process
// (knowledge/stats/family-c-blind-to-shape-2026-08-04): detection of a
// distributional SHAPE change when the first two moments are unchanged —
// "bimodality emergence, variance inflation without mean-shift".
//
// Score. Per-coordinate standardised fourth moment over a trailing window,
// averaged across signals:
//
//     K_t = (1/p) Σ_i  m4_i / m2_i²        over the trailing W observations
//
// SCALE-INVARIANT BY CONSTRUCTION, which is the load-bearing property. For
// u → c·u,  E[(cu)⁴]/E[(cu)²]² = c⁴E[u⁴]/(c²E[u²])² = E[u⁴]/E[u²]², so a
// multiplicative covariance error cancels identically. That matters because
// knowledge/stats/bandwidth-scale-2026-08-04 measured the retired detector's
// false-alarm rate swinging 0.2% → 90% across a ±15% covariance error, and
// knowledge/stats/contamination-2026-08-04 measured the shipped estimator
// biased 10–25% depending on method and cell size.
//
// Direction is informative and is why the indicator is TWO-SIDED. Gaussian
// coordinates give E[u⁴] = 3. A moment-matched bimodal mixture is
// PLATYKURTIC — 1.688 at the harness's parameters — so K FALLS. Outlier
// contamination raises it. One statistic, two distinguishable faults.
//
// e-value construction is the Addition #22 hedged indicator, reused verbatim
// from conformal.ts: e_t = 1 + 1{K_t in tail} − α, M_t = Π e_s, fire at
// M_t ≥ 1/α under Ville. Two-sided means α/2 per tail so P(indicator) = α
// under H₀.
//
// ─────────────────────────────────────────────────────────────────────────────
// DO NOT WIRE. REFUTED ON INDEPENDENT TELEMETRY, 2026-08-05.
//
// This module is UNREACHABLE by design: no dispatch, no envelope in
// fleet/e-bh-guarded.ts, no calibrator stamps its params. It is on `main` so
// its study record and the wiki checks that cite it resolve — NOT because it
// is a candidate to enable.
//
// knowledge/stats/shape-clustersynth-2026-08-05: it fires on 82% of HEALTHY
// clustersynth shards (increment 1.417, lower bound 1.382). Turning
// nonstationarity off does not help — 0.8250 against 0.8167 — so the
// pre-registered stop condition fired and the cause is not drift. Two
// candidates remain untested: the counters span tauIdio 0.5s to 120s at
// dt_s=30, so per-coordinate serial dependence differs by two orders of
// magnitude within one window; and the calibration used stride = 1, so its
// ~571 windows overlap heavily.
//
// What DID hold, on synthetic nulls only: N1-N7 with an empirical calibration,
// and the contamination arm once the calibration is MCD-trimmed. Those are
// recorded in knowledge/stats/shape-battery-2026-08-05. They are evidence about
// isolated departures; knowledge/WORKLIST C27 is why that is not evidence about
// their combination.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHAPE_KURTOSIS_ENVELOPE = void 0;
exports.freshShapeKurtosisState = freshShapeKurtosisState;
exports.shapeKurtosisScore = shapeKurtosisScore;
exports.evaluateShapeKurtosisEValue = evaluateShapeKurtosisEValue;
exports.buildShapeKurtosisCalibration = buildShapeKurtosisCalibration;
exports.buildShapeKurtosisCalibrationEmpirical = buildShapeKurtosisCalibrationEmpirical;
function freshShapeKurtosisState() {
    return { buf: [], sinceEval: 0, M: 1, n: 0, alphaConsumed: 0 };
}
/** K = (1/p) Σ_i m4_i/m2_i². Returns null if any coordinate is degenerate. */
function shapeKurtosisScore(win, sigma) {
    const n = win.length;
    if (n < 4)
        return null;
    const p = sigma.length;
    let acc = 0;
    for (let i = 0; i < p; i++) {
        const s = sigma[i];
        if (!(s > 0))
            return null;
        let m2 = 0, m4 = 0;
        for (let t = 0; t < n; t++) {
            const u = win[t][i] / s;
            const u2 = u * u;
            m2 += u2;
            m4 += u2 * u2;
        }
        m2 /= n;
        m4 /= n;
        if (!(m2 > 0))
            return null;
        acc += m4 / (m2 * m2);
    }
    return acc / p;
}
/** Two-sided tail test against the calibration distribution. α/2 per tail. */
function inTail(scores, k, alpha) {
    const M = scores.length;
    if (M === 0)
        return false;
    const half = alpha / 2;
    const loIdx = Math.floor(half * M);
    const hiIdx = Math.max(0, Math.ceil((1 - half) * M) - 1);
    return k <= scores[loIdx] || k >= scores[hiIdx];
}
/** Evaluate one tick. Accumulates into the trailing window and only scores
 *  once the window is full; before that the wealth is untouched, which keeps
 *  e_t = 1 and the process a valid (trivial) martingale over the warm-up. */
function evaluateShapeKurtosisEValue(input, x_t, state) {
    const { params, alpha } = input;
    const threshold = 1 / alpha;
    const signal = 'shape_kurtosis_e_value';
    state.buf.push([...x_t]);
    if (state.buf.length > params.window)
        state.buf.shift();
    if (state.buf.length < params.window) {
        return {
            verdict: 'clean', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'awaiting_window', family: 'E', signal,
        };
    }
    // Disjoint evaluation — see ShapeKurtosisState.sinceEval.
    state.sinceEval += 1;
    if (state.sinceEval < params.window) {
        return {
            verdict: 'clean', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'awaiting_disjoint_window', family: 'E', signal,
        };
    }
    state.sinceEval = 0;
    const k = shapeKurtosisScore(state.buf, params.sigma);
    if (k === null) {
        return {
            verdict: 'suppressed', statistic: state.M, threshold,
            alpha_consumed: 0, alpha_spent: 0,
            reason_code: 'degenerate_window', family: 'E', signal,
        };
    }
    const indicator = inTail(params.scores, k, alpha) ? 1 : 0;
    const e_t = 1 + indicator - alpha;
    state.M = state.M * e_t;
    state.n += 1;
    if (state.M >= threshold) {
        const alphaSpent = Math.max(0, alpha - state.alphaConsumed);
        state.alphaConsumed = alpha;
        return {
            verdict: 'fire', statistic: state.M, threshold,
            alpha_consumed: alphaSpent, alpha_spent: alphaSpent,
            reason_code: 'shape_kurtosis_wealth_exceeded', family: 'E', signal,
        };
    }
    return {
        verdict: 'clean', statistic: state.M, threshold,
        alpha_consumed: 0, alpha_spent: 0,
        reason_code: 'below_threshold', family: 'E', signal,
    };
}
/** Validity envelope. `baseline: 'plug-in'` is deliberate and is the known
 *  risk: the score standardises by a compiled σ̂. The score is invariant to a
 *  multiplicative error in it, but the CALIBRATION distribution is not
 *  invariant to a wrong correlation structure. */
exports.SHAPE_KURTOSIS_ENVELOPE = Object.freeze({
    baseline: 'plug-in',
    autocorrelation: 'iid',
    null: 'distributional-shape',
    variance: 'stable',
    validUnderEstimatedBaseline: false,
    minCalibration: 200,
    notes: 'Per-coordinate standardised fourth moment, two-sided hedged-indicator e-value. Score is '
        + 'scale-invariant by construction, so a multiplicative covariance error cancels; the '
        + 'CALIBRATION still depends on (p, window, correlation) and is per-cell. Discards cross-signal '
        + 'structure by design — a fault changing only the joint shape at fixed marginals is invisible. '
        + 'NOT VALIDATED: selected on separation, not on any e-value property.',
});
/** Build the per-cell calibration distribution of K under H₀.
 *
 *  Synthesized, exactly as Family E's is: draw windows from N(0, Σ) via the
 *  supplied Cholesky factor and record K for each. The score is scale-
 *  invariant, so the DISTRIBUTION of K does not depend on the scale of Σ —
 *  but it does depend on the correlation structure, which is why this is
 *  per-cell rather than a (p, window) lookup.
 *
 *  `draws` is the number of calibration windows; `L` is lower-triangular. */
function buildShapeKurtosisCalibration(L, window, draws, rng) {
    const p = L.length;
    const sigma = new Array(p);
    for (let i = 0; i < p; i++) {
        let v = 0;
        for (let j = 0; j <= i; j++)
            v += L[i][j] * L[i][j];
        sigma[i] = Math.sqrt(v);
    }
    let spare = null;
    const gauss = () => {
        if (spare !== null) {
            const v = spare;
            spare = null;
            return v;
        }
        const u1 = Math.max(rng(), 1e-300), u2 = rng();
        const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
        spare = r * Math.sin(th);
        return r * Math.cos(th);
    };
    const scores = [];
    for (let d = 0; d < draws; d++) {
        const win = [];
        for (let t = 0; t < window; t++) {
            const w = new Array(p);
            for (let j = 0; j < p; j++)
                w[j] = gauss();
            const z = new Array(p);
            for (let r2 = 0; r2 < p; r2++) {
                let s = 0;
                for (let c = 0; c <= r2; c++)
                    s += L[r2][c] * w[c];
                z[r2] = s;
            }
            win.push(z);
        }
        const k = shapeKurtosisScore(win, sigma);
        if (k !== null)
            scores.push(k);
    }
    scores.sort((a, b) => a - b);
    return { scores, sigma };
}
/** Build the calibration EMPIRICALLY, from real baseline windows.
 *
 *  REQUIRED, not optional. The synthesized-Gaussian builder above asserts
 *  Gaussian kurtosis, and the N1–N7 battery measured what that costs when the
 *  baseline is not Gaussian: `E[exp(Δ log M)]` of 1.947 with a crossing rate
 *  of 1.0000 on healthy lognormal and healthy t₃ traffic — the detector reads
 *  healthy non-Gaussian data as a shape fault. Rebuilding the same
 *  distribution from the baseline's own windows takes those to 0.998 and
 *  1.001, and takes AR(1) φ=0.9 from a crossing rate of 1.0000 to 0.0010.
 *
 *  The synthesized builder is retained only for the Gaussian-baseline case and
 *  for tests; anything reaching production should use this.
 *
 *  TRIM FIRST. The contamination arm measured what an untrimmed empirical
 *  calibration costs: at 10% and 20% shift contamination the detector loses
 *  ALL power — 1.0000 to 0.0000 — because a contaminated baseline is itself
 *  mildly bimodal, so its K distribution overlaps the fault's and the
 *  reference has absorbed the shape it exists to detect. False alarms stay
 *  low throughout, so the failure is silent. Passing MCD-retained rows only
 *  restores power to 1.0000 at every contamination level tested while keeping
 *  the false-alarm rate at 0.0030–0.0420 against α=0.05.
 *
 *  `rows` are baseline observations in the same space the detector sees. */
function buildShapeKurtosisCalibrationEmpirical(rows, window, sigma, stride = 1) {
    const scores = [];
    for (let start = 0; start + window <= rows.length; start += stride) {
        const k = shapeKurtosisScore(rows.slice(start, start + window), sigma);
        if (k !== null)
            scores.push(k);
    }
    scores.sort((a, b) => a - b);
    return scores;
}
//# sourceMappingURL=shape-kurtosis-e-value.js.map