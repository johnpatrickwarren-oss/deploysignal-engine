"use strict";
// per-shard/contrast.ts — the contrast null: a baseline BY CONSTRUCTION where a control arm exists.
//
// WHY THIS EXISTS (C81, knowledge WORKLIST). After C75/C76 (knowledge stats/nab-null-survival-2026-09-04)
// the portfolio's guarantees hold where a null exists by construction and fail on a fitted temporal
// history: on real telemetry the plug-in cards' false-alert rate is flat in the calibration length, so
// no head fixes it. A canary deploy has what a temporal series does not — a concurrent twin on the
// same version under the same traffic. The model-free contrast d_t = treatment_t − control_t cancels
// what the two units share (traffic, the shared outage, the diurnal cycle: the twin carries everything
// shared, C73) and keeps what they do not (a fault in one unit — the deploy null). Centered, whitened
// at the contrast's own φ and standardized on a healthy fit window, it is Tessera's Mode-B spatial null
// (tools/contrast.ts, ADR 0019; validated on the action surface, Tessera ADR 0029). Under the engine/
// consumer charter (what constructs a baseline and detects deviation from it, with its validity
// accounting, lives in the engine) it is ported here so every consumer with a control arm can run it.
//
// RELATION TO fleet/detection-common-mode.ts (ADR 0017/0022). That module ESTIMATES a shared factor
// cross-sectionally from many shards and deflates each; its 2-member leave-one-out case is exactly a
// pair contrast, and its header says a ≤ 3-member domain's excursions must be read as a pair, not as
// independent faults. The contrast here is that object taken once, on a pair the deployment nominated,
// with NO factor estimation — nothing is fitted cross-sectionally, so there is no post-selection residual
// and no loading to mis-estimate. The price is that a twin's own idiosyncratic noise adds: a
// treatment-only step of δ in a unit's σ is δ/√2 in the residual's (measured in P4 of the study).
//
// THE PREMISE (stated once, carried on the envelope below): the contrast of two units on the same
// version under the same traffic is, after the fit, conditionally mean-zero with scale 1 in the fit's
// units. The fit window's length m is the regime; the study measured what each construction's contract
// does at m ∈ {60, 300, 2000} on every h0-battery null made into pairs, and that is written into the
// envelope as numbers (§ CONTRAST_NULL_ENVELOPE), not prose.
//
// PORT DISCIPLINE. fitContrast / applyContrast / composeFit / fitContrastFast and the AR(1) estimator
// and whitener they use are ported LINE FOR LINE from Tessera's tools/contrast.ts and
// tools/per-shard-whitening.ts (Tessera-original, 2026-07), and test/contrast.test.ts holds them in
// lockstep against Tessera's compiled tools (every field, every tick, 200 streams, 0 mismatches — the
// C60 item 5 standard). The engine already carries a Kendall-corrected AR(1) estimator
// (computePerSignalAr1Phi in detectors/family-a-mixture-supermartingale.ts); it differs from Tessera's
// in three small ways (centers on a caller-supplied mean, returns 0 below three samples, floors the
// variance at 1e-12) that would break byte equivalence, so the port carries its own. Do not swap it.
//
// Study: validation/contrast-null/ (2026-09-contrast-null, registered 2416bef before this file existed).
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRAST_NULL_ENVELOPE = exports.CONTRAST_NULL_RUN = exports.madScale = exports.median = void 0;
exports.estimateContrastAr1 = estimateContrastAr1;
exports.whitenContrast = whitenContrast;
exports.fitContrast = fitContrast;
exports.applyContrast = applyContrast;
exports.composeFit = composeFit;
exports.fitContrastFast = fitContrastFast;
exports.contrastOf = contrastOf;
exports.contrastResidual = contrastResidual;
/** Tessera's `estimateAr1`: OLS lag-1 autocorrelation on the mean-centered sample, Kendall
 *  median-unbiased correction φ* = φ_ols + (1 + 3φ_ols)/n, clipped to ±0.95. Degenerate inputs
 *  (n < 2, zero variance) return φ = 0 (whitening becomes identity). Pure. */
function estimateContrastAr1(samples) {
    const n = samples.length;
    if (n < 2) {
        return { phi: 0, sigma2: n === 1 ? 0 : 1 };
    }
    let mean = 0;
    for (const v of samples)
        mean += v;
    mean /= n;
    let num = 0;
    let den = 0;
    for (let i = 1; i < n; i++)
        num += (samples[i] - mean) * (samples[i - 1] - mean);
    for (let i = 0; i < n; i++)
        den += (samples[i] - mean) * (samples[i] - mean);
    if (!(den > 0))
        return { phi: 0, sigma2: 1 };
    const phiOls = num / den;
    let phi = phiOls + (1 + 3 * phiOls) / n;
    const CLIP = 0.95;
    if (phi > CLIP)
        phi = CLIP;
    if (phi < -CLIP)
        phi = -CLIP;
    let rss = 0;
    for (let i = 1; i < n; i++) {
        const r = (samples[i] - mean) - phi * (samples[i - 1] - mean);
        rss += r * r;
    }
    const sigma2 = n > 1 ? rss / (n - 1) : 1;
    return { phi, sigma2: sigma2 > 0 ? sigma2 : 1 };
}
/** Tessera's `whiten`: the AR(1) innovation x_t − φ·x_{t−1}; the first tick (no prior) is returned
 *  unchanged. Pure. */
function whitenContrast(x, xPrev, phi) {
    return xPrev === null ? x : x - phi * xPrev;
}
// ─── Tessera tools/contrast.ts (verbatim) ──────────────────────────────────────────────────────────
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
exports.median = median;
const madScale = (xs) => { const m = (0, exports.median)(xs); return Math.max(1.4826 * (0, exports.median)(xs.map((x) => Math.abs(x - m))), 1e-9); };
exports.madScale = madScale;
function fitContrast(d0) {
    const center = (0, exports.median)(d0);
    const dc = d0.map((x) => x - center);
    const { phi } = estimateContrastAr1(dc);
    const w = dc.map((x, t) => whitenContrast(x, t > 0 ? dc[t - 1] : null, phi));
    return { phi, loc: (0, exports.median)(w), scale: (0, exports.madScale)(w), center };
}
/** Apply a baseline contrast fit to a (monitoring) contrast: center, whiten at φ, standardize by
 *  loc/scale. Causal: applying to a prefix equals the prefix of applying to the whole. */
function applyContrast(d, fit) {
    const dc = d.map((x) => x - fit.center);
    return dc.map((x, t) => (whitenContrast(x, t > 0 ? dc[t - 1] : null, fit.phi) - fit.loc) / fit.scale);
}
/** Compose a fit from two sources (Tessera 2026-07-02 audit F8 fix, ADR 0022 mixed-cadence path): the
 *  CENTER from a long (possibly coarse-cadence) baseline fit of the SAME contrast — a mean offset is
 *  cadence-independent — and the DYNAMICS (φ, loc, scale — all cadence-dependent) from a monitoring-
 *  cadence KNOWN-NULL fit (a control-vs-control sibling contrast). */
function composeFit(centerFrom, dynamicsFrom) {
    return { center: centerFrom.center, phi: dynamicsFrom.phi, loc: dynamicsFrom.loc, scale: dynamicsFrom.scale };
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
/** Like fitContrast but using mean/SD instead of median/MAD — O(n) with NO sort, so it scales to a
 *  long (multi-million-tick) HEALTHY baseline where the median sorts dominate. Use ONLY on a known-
 *  healthy baseline. */
function fitContrastFast(d0) {
    const center = mean(d0);
    const dc = d0.map((x) => x - center);
    const { phi } = estimateContrastAr1(dc);
    const w = dc.map((x, t) => whitenContrast(x, t > 0 ? dc[t - 1] : null, phi));
    return { phi, loc: mean(w), scale: Math.max(sd(w), 1e-9), center };
}
/** The model-free contrast d_t = treatment_t − control_t. Throws on a length mismatch — a pair whose
 *  members are not concurrent is not a pair. */
function contrastOf(p) {
    if (p.treatment.length !== p.control.length) {
        throw new RangeError(`contrastOf: treatment (${p.treatment.length}) and control (${p.control.length}) must be the same length`);
    }
    return p.treatment.map((x, i) => x - p.control[i]);
}
/** The standardized contrast residual of a pair under a fit, for the mean-shift constructions:
 *  `applyContrast(contrastOf(p), fit)`. */
function contrastResidual(p, fit) {
    return applyContrast(contrastOf(p), fit);
}
/** The registered run every number below pins to (validation/contrast-null/results/live/<run>). */
exports.CONTRAST_NULL_RUN = 'run-20260905T061348Z';
/** The contrast null's validity envelope — a REFUSAL RECORD, not an admission. Study
 *  2026-09-contrast-null (registered 2416bef, amended A1/A2 before the run, run once as
 *  CONTRAST_NULL_RUN; 21 cells × 500 replications × 3 variants, 0 exceptions): the registered ship
 *  rule (§6) was P1 and P3 HELD; as computed P1 FAILED in 8 of 21 cells and P3 FAILED in 14 of 21, both
 *  by the same mechanism, so under the registration NOTHING IS ADMITTED and `validUnderEstimatedBaseline`
 *  stays false with no `minCalibration`. The engine's convention (fleet/e-bh-guarded.ts, the retracted BF)
 *  is that a measured refusal is recorded by name rather than left blank, which is what this object is.
 *
 *  WHAT THE NUMBERS SAY. The shared component cancels exactly (the shared-step residual is identical to
 *  the null's, max |Δr| = 8.9e-16; every one of 73,500 alert ticks identical), and the contrast beats the
 *  temporal path where a shared component exists (N1, m = 2000: 29 vs 228 of 500 mixture false alerts at
 *  α = 0.05; a treatment-only 1.5σ step detected with median delay 80 vs 155 ticks). What does not cancel is
 *  the contrast's OFFSET: the two units have independent baselines, so the center is estimated from m ticks
 *  and read against a 2,000-tick horizon — the plug-in n ≫ m regime MIXTURE_SUPERMARTINGALE_ENVELOPE already
 *  names. The mixture's false-alert rate on the null contrast is independent of the fit's scale error
 *  (0.69 vs 0.65 across the scale split at m = 60) and falls with m as the center's error does (0.34 →
 *  0.18 → 0.03 per 1,000 ticks at m = 60 / 300 / 2000 on N1). A null exists BY CONSTRUCTION for what the
 *  units share; it does not exist by construction for their offset unless the pair is a true twin (offset
 *  known) or m ≫ n (Tessera's ≥ 2-month baseline against 300-tick windows, ratio ~10⁴).
 *
 *  ADMISSION TO THE FDR PATH is therefore only under the caller's own assertion `mMuchGreaterThanN` (the
 *  regime the study measured as the price) or `trueBaseline` (a twin with a known offset), greppable at
 *  the call site, exactly as for the plug-in cards. */
exports.CONTRAST_NULL_ENVELOPE = Object.freeze({
    baseline: 'plug-in',
    autocorrelation: 'ar1-whitened',
    null: 'mean-shift',
    variance: 'robust',
    validUnderEstimatedBaseline: false,
    premise: 'the contrast treatment − control of two units on the same version under the same traffic, '
        + 'centered, whitened at the fit window\'s φ and standardized by its robust scale, is conditionally '
        + 'mean-zero with scale 1 after the fit; what the units share cancels by algebra, what one unit does '
        + 'alone remains',
    fitTicksMeasured: [60, 300, 2000],
    admission: Object.freeze([
        { construction: 'family_A_mixture_supermartingale', level: 0.05, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.334, 0.397] },
        { construction: 'family_A_mixture_supermartingale', level: 0.01, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.306, 0.363] },
        { construction: 'family_A_betting_e_process', level: 0.05, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.236, 0.351] },
        { construction: 'family_A_betting_e_process', level: 0.01, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.205, 0.323] },
        { construction: 'e_sr_mean_shift', level: 0.001, fitTicks: 60, heldOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], failedOn: ['N5', 'N6', 'N8'], ratePer1000: [0.406, 0.5] },
        { construction: 'calibration_monitor_gaussian', level: 0.01, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.068, 0.406] },
        { construction: 'calibration_monitor_bounded', level: 0.01, fitTicks: 60, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.246, 0.334] },
        { construction: 'family_A_mixture_supermartingale', level: 0.05, fitTicks: 300, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.175, 0.305] },
        { construction: 'family_A_mixture_supermartingale', level: 0.01, fitTicks: 300, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.131, 0.23] },
        { construction: 'family_A_betting_e_process', level: 0.05, fitTicks: 300, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.079, 0.188] },
        { construction: 'family_A_betting_e_process', level: 0.01, fitTicks: 300, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.044, 0.144] },
        { construction: 'e_sr_mean_shift', level: 0.001, fitTicks: 300, heldOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], failedOn: ['N5', 'N6', 'N8'], ratePer1000: [0.373, 0.5] },
        { construction: 'calibration_monitor_gaussian', level: 0.01, fitTicks: 300, heldOn: ['N1', 'N3-p06', 'N3-p09'], failedOn: ['N3-p03', 'N5', 'N6', 'N8'], ratePer1000: [0.006, 0.466] },
        { construction: 'calibration_monitor_bounded', level: 0.01, fitTicks: 300, heldOn: [], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.071, 0.167] },
        { construction: 'family_A_mixture_supermartingale', level: 0.05, fitTicks: 2000, heldOn: ['N1'], failedOn: ['N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.029, 0.237] },
        { construction: 'family_A_mixture_supermartingale', level: 0.01, fitTicks: 2000, heldOn: ['N1'], failedOn: ['N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'], ratePer1000: [0.007, 0.164] },
        { construction: 'family_A_betting_e_process', level: 0.05, fitTicks: 2000, heldOn: ['N1', 'N5', 'N6', 'N8'], failedOn: ['N3-p03', 'N3-p06', 'N3-p09'], ratePer1000: [0.025, 0.058] },
        { construction: 'family_A_betting_e_process', level: 0.01, fitTicks: 2000, heldOn: ['N5', 'N6', 'N8'], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], ratePer1000: [0.004, 0.023] },
        { construction: 'e_sr_mean_shift', level: 0.001, fitTicks: 2000, heldOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], failedOn: ['N5', 'N6', 'N8'], ratePer1000: [0.353, 0.5] },
        { construction: 'calibration_monitor_gaussian', level: 0.01, fitTicks: 2000, heldOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09'], failedOn: ['N5', 'N6', 'N8'], ratePer1000: [0.001, 0.496] },
        { construction: 'calibration_monitor_bounded', level: 0.01, fitTicks: 2000, heldOn: ['N5'], failedOn: ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N6', 'N8'], ratePer1000: [0.007, 0.03] },
    ]),
    evidence: `validation/contrast-null ${exports.CONTRAST_NULL_RUN} (registered 2416bef; P1 FAILED 8 of 21 cells, P3 FAILED 14 of 21 — the estimated offset, not the shared component; nothing admitted under §6)`,
    notes: 'REFUSED by the registered ship rule: the offset of the contrast is estimated from m ticks and read '
        + 'against the monitoring horizon, the plug-in n ≫ m regime; the shared component cancels exactly. '
        + 'Admit to the FDR path only under the caller\'s assertion mMuchGreaterThanN (fit ≫ horizon) or '
        + 'trueBaseline (a twin with a known offset). `admission` carries what each construction\'s contract '
        + 'did at each m on every h0-battery null made into pairs; the e-SR holds its ARL reading on the '
        + 'Gaussian-innovation nulls at every m and fails on N5/N6/N8; the bounded monitor revokes the '
        + 'premise at the rate it fails.',
});
//# sourceMappingURL=contrast.js.map