"use strict";
// engine/fleet/calibration-monitor.ts — a live validity metric for an emitter's increment:
// (1) the RUNTIME CALIBRATION MONITOR, ported from Tessera (tools/calibration-monitor.ts,
//     tools/mixture-evalue.ts, 2026-07-28, ADR 0019 follow-up #2 / ADR 0027) so every engine
//     consumer can run it, and (2) the INCREMENT ESTIMATOR, the wiki's validity instrument
//     (knowledge stats/terminal-mean-is-not-measurable; registered as a REPORTED instrument with
//     no verdict authority by engine Amendment v2.C39).
//
// Filed under knowledge stats/e-betting-metrics-2026-09-02, option 2.
//
// WHY THIS EXISTS. A detector's anytime claim is Ville on a supermartingale whose increment
// satisfies E[e_t | F_{t-1}] ≤ 1 ONLY under the reference law it was compiled against
// (knowledge stats/validity-premise-chain). A monitor fed a stream of residuals that are SUPPOSED
// to be null — a concurrent control cohort, or a believed-healthy reference — answers "is this
// increment still an e-value right now" as a live number instead of an offline battery. Two
// instruments, informative in opposite directions:
//
//   MONITOR (Ville, revoking). Under a valid null the increment g satisfies E[g|F] ≤ 1, so
//   W_t = ∏ g(r_s) is a test supermartingale and P(sup_t W_t ≥ 1/α | H0) ≤ α. If W ever exceeds
//   1/α_cal that is anytime-valid evidence the null does NOT hold for this increment; revoke,
//   sticky. A revocation is a certified statement; a passing monitor is not (it may simply lack
//   power yet).
//
//   INCREMENT ESTIMATOR (reported). The sample mean of exp(Δ log M) over believed-null ticks, with
//   a normal-theory interval. ~650× more stable than the terminal mean E[M_T] at comparable cost
//   (stats/terminal-mean-is-not-measurable). A lower bound above 1 REFUTES the e-value premise; a
//   reading at or below 1 establishes nothing — it bounds the MARGINAL increment, and the
//   conditional property is what validity needs (Waudby-Smith–Ramdas 2024 Prop. 2: conditional
//   centering ⇔ the capital process is a test martingale for every predictable bet).
//
// SCOPE (named, from the Tessera header). Both instruments test MARGINAL calibration. Pure serial
// dependence with a perfect marginal is a subtler failure neither is strong against; a
// conditional/serial test is the O5 frontier and nothing here claims it.
//
// INCREMENT-FAMILY COHERENCE (Tessera ADR 0027). The monitor must test the SAME increment family
// the emitter accumulates. A bounded-family emitter monitored with the Gaussian-LR increment is
// FALSELY demoted by heavy tails or a σ̂ error its own increment absorbs; a Gaussian-family emitter
// NEEDS the strict Gaussian test (a 10% σ̂ under-estimate drives its null mean 0.52 → 7.6, Tessera
// audit F7). Default 'bounded'. Linear bets cannot be mixed per tick (mean_λ(1+λc) ≡ 1), so the
// bounded kind keeps one capital per λ and Ville runs on their average — a convex combination of
// martingales, still a martingale.
//
// Contract-agnostic: Tessera's `EmitterContract` has no engine counterpart, so
// `applyCalibrationMonitor` is generic over any object carrying `calibrationMonitorPassing`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOUND_LAMBDAS = exports.BOUND_CLIP = exports.G_CAP = void 0;
exports.gInc = gInc;
exports.gBounded = gBounded;
exports.freshCalibrationMonitor = freshCalibrationMonitor;
exports.updateCalibration = updateCalibration;
exports.updateCalibrationBatch = updateCalibrationBatch;
exports.calibrationVerdict = calibrationVerdict;
exports.applyCalibrationMonitor = applyCalibrationMonitor;
exports.freshIncrementEstimator = freshIncrementEstimator;
exports.updateIncrementEstimator = updateIncrementEstimator;
exports.incrementEstimate = incrementEstimate;
// ── Increments (Tessera tools/mixture-evalue.ts, verbatim constants) ───────────────
const LAMBDAS = [0.5, 1, 2, -0.5, -1, -2];
/** Cap on the per-tick Gaussian increment: E[min(g, cap)] ≤ E[g] = 1 (conservative). */
exports.G_CAP = 100;
/** Gaussian-LR mixture increment, capped. E[g | N(0,1)] ≤ 1 by construction. Validity needs the
 *  residual to be genuinely N(0,1): a 10% under-estimate of the standardizing scale moves the null
 *  mean from ~0.5 to ~7.6 (Tessera audit F7, measured), and heavy tails break E ≤ 1 outright. */
function gInc(r) {
    let s = 0;
    for (const lam of LAMBDAS)
        s += Math.exp(lam * r - 0.5 * lam * lam);
    return Math.min(exports.G_CAP, s / LAMBDAS.length);
}
/** Clip bound for the bounded-bet increment (residual σ-units). Same B as the Family A betting
 *  path's BOUNDED_SCALE_B (detectors/betting-e-process.ts). */
exports.BOUND_CLIP = 3;
/** Linear-bet grid: |λ| < 1 keeps every wealth factor strictly positive. */
exports.BOUND_LAMBDAS = [0.1, 0.3, 0.6, 0.9, -0.1, -0.3, -0.6, -0.9];
/** Distribution-robust linear bounded-bet wealth factor g_λ(r) = 1 + λ·c/B, c = clip(r, ±B).
 *  E[g_λ | F] = 1 exactly whenever the clipped residual is conditionally mean-zero — any tail, any
 *  standardizing-scale error. The one surviving nuisance is the CENTER, which is what the monitor
 *  tests best. */
function gBounded(r, lam) {
    const c = r > exports.BOUND_CLIP ? exports.BOUND_CLIP : r < -exports.BOUND_CLIP ? -exports.BOUND_CLIP : r;
    return 1 + (lam * c) / exports.BOUND_CLIP;
}
function freshCalibrationMonitor(opts = {}) {
    const alpha = opts.alpha ?? 0.01;
    if (!(alpha > 0 && alpha <= 1))
        throw new Error(`calibration-monitor: alpha must be in (0,1], got ${alpha}`);
    const kind = opts.incrementKind ?? 'bounded';
    const bounded = !opts.increment && kind === 'bounded';
    return {
        logW: 0, logWByLambda: bounded ? exports.BOUND_LAMBDAS.map(() => 0) : null,
        peakLogW: 0, ticks: 0, passing: true,
        threshold: Math.log(1 / alpha), increment: opts.increment ?? gInc,
    };
}
/** log of the mean of exp(xs), max-shifted. */
function logMeanExp(xs) {
    let m = -Infinity;
    for (const x of xs)
        if (x > m)
            m = x;
    if (!Number.isFinite(m))
        return m;
    let s = 0;
    for (const x of xs)
        s += Math.exp(x - m);
    return m + Math.log(s / xs.length);
}
/** Ingest ONE believed-null residual; revoke (sticky) if W has ever crossed 1/alpha. Mutates and
 *  returns the state. */
function updateCalibration(state, r) {
    if (state.logWByLambda) {
        for (let i = 0; i < exports.BOUND_LAMBDAS.length; i++) {
            state.logWByLambda[i] += Math.log(gBounded(r, exports.BOUND_LAMBDAS[i]));
        }
        state.logW = logMeanExp(state.logWByLambda);
    }
    else {
        const g = state.increment(r);
        // A zero increment would send logW → −∞; the floor only makes revocation HARDER, which is the
        // conservative direction for the false-revocation guarantee.
        state.logW += Math.log(Math.max(g, 1e-300));
    }
    if (state.logW > state.peakLogW)
        state.peakLogW = state.logW;
    state.ticks++;
    if (state.peakLogW >= state.threshold)
        state.passing = false;
    return state;
}
function updateCalibrationBatch(state, rs) {
    for (const r of rs)
        updateCalibration(state, r);
    return state;
}
/** The monitor's verdict (does NOT mutate). */
function calibrationVerdict(state) {
    return {
        passing: state.passing,
        ticks: state.ticks,
        eValue: Math.exp(Math.min(state.peakLogW, 700)),
        revokeAt: Math.exp(Math.min(state.threshold, 700)),
    };
}
/** Run the monitor over believed-null REFERENCE residuals — the CALLER owns choosing a genuinely
 *  null feed — and return the contract with `calibrationMonitorPassing` set. Several streams (one
 *  per control shard) are pooled into one martingale in order. */
function applyCalibrationMonitor(contract, referenceNullResiduals, opts = {}) {
    const monitor = freshCalibrationMonitor(opts);
    const streams = Array.isArray(referenceNullResiduals[0])
        ? referenceNullResiduals
        : [referenceNullResiduals];
    for (const s of streams)
        updateCalibrationBatch(monitor, s);
    return {
        contract: { ...contract, calibrationMonitorPassing: monitor.passing },
        monitor,
        verdict: calibrationVerdict(monitor),
    };
}
function freshIncrementEstimator() {
    return { n: 0, mean: 0, m2: 0, max: -Infinity };
}
/** Ingest one LOG-increment Δ log M_t from a detector evaluated on a believed-null stream (the
 *  `evidence.log_increment` field of a wealth detector's verdict). Non-finite increments are
 *  skipped — a NaN or ±∞ carries no estimable evidence (detectors/_wealth.ts holds wealth on them
 *  for the same reason). Mutates and returns. */
function updateIncrementEstimator(state, logIncrement) {
    if (!Number.isFinite(logIncrement))
        return state;
    const e = Math.exp(logIncrement);
    state.n += 1;
    const delta = e - state.mean;
    state.mean += delta / state.n;
    state.m2 += delta * (e - state.mean);
    if (e > state.max)
        state.max = e;
    return state;
}
/** The estimate (does NOT mutate). */
function incrementEstimate(state) {
    const n = state.n;
    const sd = n >= 2 ? Math.sqrt(state.m2 / (n - 1)) : NaN;
    const half = n >= 2 ? 1.96 * sd / Math.sqrt(n) : NaN;
    const lower95 = state.mean - half;
    return {
        n, mean: state.mean, sd, lower95, upper95: state.mean + half,
        refutedAboveOne: n >= 2 && lower95 > 1,
        maxToMean: n >= 1 && state.mean > 0 ? state.max / state.mean : NaN,
    };
}
//# sourceMappingURL=calibration-monitor.js.map