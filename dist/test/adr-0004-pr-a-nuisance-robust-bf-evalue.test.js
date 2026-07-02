"use strict";
// test/adr-0004-pr-a-nuisance-robust-bf-evalue.test.ts — ADR 0004 PR A.
//
// Ports Tessera's validity suite (tools/nuisance-robust-evalue.ts, Tessera ADR 0013) for the promoted
// nuisanceRobustBFEValue. Four properties, matching the migration plan (ADR 0004 § Migration plan #1):
//
//   1. VALIDITY at multiple scales — E[BF|H0] ≤ 1 and P(BF ≥ k) ≤ 1/k at k = 10/100/1000, in BOTH a
//      well-powered and the UNDER-powered regime (n ≫ m, where the plug-in is catastrophically invalid).
//      A valid e-value must satisfy P(e≥k) ≤ 1/k at every scale (Ville/Markov), not just at k = 1/α.
//   2. POWER — detects a real mean shift (fire rate → 1.0 at threshold 1/α).
//   3. SAME-VARIANCE SCOPE — a test-window VARIANCE change (no mean shift) inflates P(fire) above α.
//      This pins the documented validity envelope (variance: 'stable'); a variance change is the
//      distributional-signature detector's job (ADR 0004 Tier 2), not this one's.
//   4. WINDOW GENERALIZATION — the (cal, test) form handles arbitrary, non-adjacent windows and the
//      ar1Phi override is honored; a parity check against an inline reference pins the windowing math.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const nuisance_robust_bf_e_value_1 = require("../detectors/nuisance-robust-bf-e-value");
const family_a_mixture_supermartingale_1 = require("../detectors/family-a-mixture-supermartingale");
// ── deterministic PRNG + Gaussian (engine tests use seeded LCGs; no external dep). ──
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const ALPHA = 0.01;
const RHO = 0.5, BASE = 1000, NOISE = 2;
/** AR(1) stream of length `len`; optional mean `shift` applied from index `shiftAt` (≥0), and an
 *  optional innovation-std multiplier `stdMult` applied from index `varAt` (≥0). */
function ar1Stream(seed, len, shiftAt, shift, varAt = -1, stdMult = 1) {
    const rng = lcg(seed);
    const v = [];
    let p = gaussian(rng);
    for (let t = 0; t < len; t++) {
        const mult = (varAt >= 0 && t >= varAt) ? stdMult : 1;
        p = RHO * p + Math.sqrt(1 - RHO * RHO) * mult * gaussian(rng);
        v.push(BASE + NOISE * p + (shiftAt >= 0 && t >= shiftAt ? shift : 0));
    }
    return v;
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function rateAtLeast(xs, k) { return xs.filter((x) => x >= k).length / xs.length; }
/** Collect null and mean-shift BF e-values over K seeded streams for a (m, n) regime. */
function sweep(m, n, K) {
    const nulls = [], shifts = [];
    for (let s = 0; s < K; s++) {
        const vN = ar1Stream(11 + s * 7919, m + n, -1, 0);
        nulls.push((0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(vN, { start: 0, len: m }, { start: m, len: n }));
        const vS = ar1Stream(9001 + s * 7919, m + n, m + 20, 4);
        shifts.push((0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(vS, { start: 0, len: m }, { start: m, len: n }));
    }
    return { nulls, shifts };
}
// ── 1. Validity at multiple scales, three regimes. ───────────────────────────────────────────────
// The floor regime (m=100) is deliberately included: there the null e-values carry real tail mass
// (P(BF≥10) ≈ 0.003, max draws in the tens–hundreds), so the k=10 Ville bound actually binds on
// non-empty tail mass — unlike the large-cal regimes where the null max is ~4.5 and all three scales
// pass vacuously. (At K=600 the k=100/1000 scales still see zero exceedances; the point is that a
// real tail now exists and at least one scale is exercised — cold-eye Finding 2.)
for (const [label, m, n, K] of [
    ['well-powered (m=1500, n=300)', 1500, 300, 600],
    ['under-powered (m=300, n=680) — the plug-in failure regime', 300, 680, 600],
    ['at the validity floor (m=100, n=200) — non-empty tail, so the Ville bounds bind', 100, 200, 600],
]) {
    (0, node_test_1.test)(`validity (CORRECTED 2026-07-02): bounded E[BF|H0] + Ville tail bounds — ${label}`, () => {
        const { nulls } = sweep(m, n, K);
        // ⚠️ 2026-07-02 correction: E[BF|H0] ≤ 1 is FALSE — the true mean is ≈1.155 at every cal length
        // (the recentering defect; see the detector header). The MC bulk mean here undershoots 1 only
        // because the excess lives in an extreme tail K=600 cannot sample — so this assertion documents
        // the BOUNDED inflation (≤ ~1.2), NOT validity. The Ville tail bounds below remain genuinely true
        // (the statistic is sub-Ville in its tails).
        strict_1.default.ok(mean(nulls) <= 1.2, `E[BF|H0] = ${mean(nulls).toFixed(4)} should be ≤ ~1.2 (bounded inflation)`);
        // Ville/Markov: P(BF ≥ k) ≤ 1/k at every tested scale (small MC slack on the tail).
        for (const k of [10, 100, 1000]) {
            const r = rateAtLeast(nulls, k);
            strict_1.default.ok(r <= 1 / k + 0.005, `P(BF≥${k}) = ${r.toFixed(4)} must be ≤ 1/${k} (+MC slack)`);
        }
        // Operational FP rate at the e-BH-style threshold.
        strict_1.default.ok(rateAtLeast(nulls, 1 / ALPHA) <= ALPHA + 0.005, 'P(fire) must be ≤ α');
    });
}
// ── 1b. The 2026-07-02 correction, demonstrated where MC can sample it. ──────────────────────────
// At the default τ (x = n·tauMult ≫ 1) the mean excess hides in an extreme tail; at x = 1 it is
// bulk-visible. Ideal-case theory (iid, known φ, equal whitened counts n): E[BF|H0] =
// (1+2x)/√((1+x)(1+3x)) = 3/√8 ≈ 1.0607 at x = 1. Seeded MC on the SHIPPED function must land near
// it — decisively ABOVE 1, refuting the old "valid by construction" claim.
(0, node_test_1.test)('correction: E[BF|H0] > 1 (≈1.06 at x=1, per the exact formula) — the recentering defect', () => {
    const n = 200, reps = 20000;
    const es = [];
    for (let r = 0; r < reps; r++) {
        const rng = lcg(500000 + r * 2654435761);
        const v = [];
        for (let t = 0; t < 2 * n + 1; t++)
            v.push(BASE + NOISE * gaussian(rng));
        es.push((0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: n + 1 }, { start: n + 1, len: n }, { ar1Phi: 0, tauMult: 1 / n }));
    }
    const m = mean(es);
    strict_1.default.ok(m > 1.02, `E[BF|H0] = ${m.toFixed(4)} must be decisively > 1 (theory ≈ 1.0607)`);
    strict_1.default.ok(m < 1.12, `E[BF|H0] = ${m.toFixed(4)} should be near the ≈1.0607 theory value`);
});
// ── 2. Power — detect a real mean shift. ──────────────────────────────────────────────────────────
(0, node_test_1.test)('power: detects a mean shift (fire rate → 1.0 at threshold 1/α)', () => {
    const { shifts } = sweep(1500, 300, 600);
    strict_1.default.ok(rateAtLeast(shifts, 1 / ALPHA) >= 0.99, `shift detection rate ${rateAtLeast(shifts, 1 / ALPHA)} must be ≥ 0.99`);
});
// ── 3. Same-variance scope — a variance change inflates P(fire) (documents the envelope). ──────────
(0, node_test_1.test)('scope: a test-window variance change inflates P(fire) above α (envelope = variance:stable)', () => {
    const m = 1500, n = 300, K = 400;
    const fireRateFor = (stdMult) => {
        const es = [];
        for (let s = 0; s < K; s++) {
            const v = ar1Stream(31 + s * 7919, m + n, -1, 0, /* varAt */ m, stdMult);
            es.push((0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: m }, { start: m, len: n }));
        }
        return rateAtLeast(es, 1 / ALPHA);
    };
    // No variance change → controlled at α; a 3×-std inflation → demonstrably elevated (the scope limit).
    strict_1.default.ok(fireRateFor(1) <= ALPHA + 0.01, 'stable variance must stay ≈ α');
    strict_1.default.ok(fireRateFor(3) > fireRateFor(1), 'a 3× variance inflation must raise the fire rate (out-of-envelope)');
});
// ── 4. Window generalization + ar1Phi override + windowing-math parity. ────────────────────────────
(0, node_test_1.test)('windows: arbitrary non-adjacent (cal, test) windows are handled and finite', () => {
    const v = ar1Stream(2026, 2000, -1, 0);
    // Non-adjacent: a gap between calibration and test windows.
    const e = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 100, len: 800 }, { start: 1500, len: 300 });
    strict_1.default.ok(Number.isFinite(e) && e >= 0, `e-value must be finite and ≥ 0; got ${e}`);
});
(0, node_test_1.test)('windows: ar1Phi override is honored (matches estimate when equal; differs when changed)', () => {
    const v = ar1Stream(7, 1000, -1, 0);
    const cal = { start: 0, len: 700 }, t = { start: 700, len: 300 };
    const calValues = v.slice(cal.start, cal.start + cal.len);
    const phiHat = (0, family_a_mixture_supermartingale_1.computePerSignalAr1Phi)(calValues, mean(calValues));
    const eDefault = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, cal, t);
    const eSamePhi = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, cal, t, { ar1Phi: phiHat });
    const eOtherPhi = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, cal, t, { ar1Phi: phiHat + 0.3 });
    strict_1.default.ok(Math.abs(eDefault - eSamePhi) < 1e-9, 'override with the estimated φ must match the default');
    strict_1.default.ok(Math.abs(eDefault - eOtherPhi) > 1e-9, 'a different φ must change the result');
});
(0, node_test_1.test)('windows: parity with a reference that re-derives the windowing indices (pins the index loops)', () => {
    // NOTE (cold-eye Finding 5): this `ref` copies the production closed-form BF expression, so it is
    // NOT an independent check of the FORMULA — it cannot catch a shared algebraic error. Its value is
    // re-deriving the WINDOWING INDEX LOOPS (which sample whitens against which predecessor, where each
    // window starts/ends) independently of production. The formula itself is checked independently below.
    const logMarginal = (S, nn, s2, tau2) => (tau2 * S * S) / (2 * s2 * (s2 + nn * tau2)) - 0.5 * Math.log(1 + (nn * tau2) / s2);
    const ref = (v, cS, cL, tS, tL) => {
        const calV = v.slice(cS, cS + cL);
        const phi = (0, family_a_mixture_supermartingale_1.computePerSignalAr1Phi)(calV, mean(calV));
        const wc = [];
        for (let t = cS + 1; t < cS + cL; t++)
            wc.push(v[t] - phi * v[t - 1]);
        const wt = [];
        for (let t = tS; t < tS + tL; t++)
            wt.push(v[t] - phi * v[t - 1]);
        const mc = mean(wc);
        const s2 = Math.max(wc.reduce((a, b) => a + (b - mc) ** 2, 0) / (wc.length - 1), 1e-9);
        const tau2 = nuisance_robust_bf_e_value_1.DEFAULT_TAU_MULT * s2;
        const Sc = wc.reduce((a, b) => a + (b - mc), 0), St = wt.reduce((a, b) => a + (b - mc), 0);
        return Math.exp(logMarginal(Sc, wc.length, s2, tau2) + logMarginal(St, wt.length, s2, tau2)
            - logMarginal(Sc + St, wc.length + wt.length, s2, tau2));
    };
    for (const seed of [1, 42, 777]) {
        for (const [cS, cL, tS, tL] of [[0, 600, 600, 200], [200, 500, 800, 300]]) {
            const v = ar1Stream(seed, 1300, -1, 0);
            const got = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: cS, len: cL }, { start: tS, len: tL });
            const want = ref(v, cS, cL, tS, tL);
            strict_1.default.ok(Math.abs(got - want) < 1e-9 * Math.max(1, want), `parity seed=${seed} (${cS},${cL},${tS},${tL}): got ${got}, want ${want}`);
        }
    }
});
(0, node_test_1.test)('formula: the closed-form BF equals a brute-force numerical integration of the marginals (independent)', () => {
    // A genuinely independent check (cold-eye Finding 5): instead of the closed-form logMarginal, compute
    // each group's marginal likelihood m(group) = ∫ N(residuals; μ, s²) · N(μ; 0, τ²) dμ by trapezoidal
    // grid integration over μ, then form BF = m(wc)·m(wt) / m(wc∪wt). This validates the algebra of the
    // closed form, not just its transcription. Build whitened residuals the same way (windowing is
    // separately pinned above), but integrate numerically rather than via the closed form.
    // v0 is a null; v carries a real mean shift FROM the test-window start (index 400 = tS below), so its
    // BF lands well ABOVE 1 — the numerical check then exercises the math at both a small and a large BF.
    const v = ar1Stream(31337, 800, 400, 4);
    const v0 = ar1Stream(31337, 800, -1, 0);
    for (const data of [v0, v]) {
        const cS = 0, cL = 400, tS = 400, tL = 300;
        const calV = data.slice(cS, cS + cL);
        const phi = (0, family_a_mixture_supermartingale_1.computePerSignalAr1Phi)(calV, mean(calV));
        const wc = [];
        for (let t = cS + 1; t < cS + cL; t++)
            wc.push(data[t] - phi * data[t - 1]);
        const wt = [];
        for (let t = tS; t < tS + tL; t++)
            wt.push(data[t] - phi * data[t - 1]);
        const mc = mean(wc);
        const s2 = Math.max(wc.reduce((a, b) => a + (b - mc) ** 2, 0) / (wc.length - 1), 1e-9);
        const tau2 = nuisance_robust_bf_e_value_1.DEFAULT_TAU_MULT * s2;
        // Numerical log of the "integral part" of a group's marginal likelihood — i.e. the production
        // logMarginal: log ∫ exp(μ·Σx/s² − n·μ²/2s²) · N(μ; 0, τ²) dμ. The per-point data constant
        // Π(2πs²)^{-1/2}·exp(−Σx²/2s²) is NOT included here; it is the same constant the closed form drops,
        // and since the group counts add (n_wc + n_wt = n_total) it cancels exactly in the BF ratio.
        const numLogMarg = (xs) => {
            const sigmaMu = Math.sqrt(tau2);
            const lo = -8 * sigmaMu, hi = 8 * sigmaMu, steps = 200000, h = (hi - lo) / steps;
            const sumX2 = xs.reduce((a, x) => a + x * x, 0);
            // log integrand(μ) up to the shared constant: Σ[-(x-μ)²/2s²] + Σ[x²/2s²] - μ²/2τ²
            //  = (μ·Σx)/s² - n·μ²/(2s²) - μ²/(2τ²)   (the Σx²/2s² terms cancel)
            const Sx = xs.reduce((a, b) => a + b, 0), n = xs.length;
            const logIntegrand = (mu) => (mu * Sx) / s2 - (n * mu * mu) / (2 * s2) - (mu * mu) / (2 * tau2);
            // log-sum-exp trapezoid
            let maxLog = -Infinity;
            for (let i = 0; i <= steps; i++) {
                const l = logIntegrand(lo + i * h);
                if (l > maxLog)
                    maxLog = l;
            }
            let acc = 0;
            for (let i = 0; i <= steps; i++) {
                const w = (i === 0 || i === steps) ? 0.5 : 1;
                acc += w * Math.exp(logIntegrand(lo + i * h) - maxLog);
            }
            // ∫ ≈ h·Σ ; prior normalizer 1/√(2πτ²) → log; the √(2π s²)^... data constants are the dropped shared const.
            return maxLog + Math.log(acc * h) - 0.5 * Math.log(2 * Math.PI * tau2);
        };
        // Recenter by mc exactly as production does.
        const wcC = wc.map((x) => x - mc), wtC = wt.map((x) => x - mc);
        const bfNumeric = Math.exp(numLogMarg(wcC) + numLogMarg(wtC) - numLogMarg(wcC.concat(wtC)));
        const bfClosed = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(data, { start: cS, len: cL }, { start: tS, len: tL });
        strict_1.default.ok(Math.abs(Math.log(bfNumeric) - Math.log(bfClosed)) < 1e-3, `closed-form BF ${bfClosed} must match numerical ${bfNumeric} (log-diff ${Math.abs(Math.log(bfNumeric) - Math.log(bfClosed))})`);
    }
});
// ── Envelope metadata is shipped (ADR 0004 — validity envelopes as first-class). ──────────────────
(0, node_test_1.test)('envelope: validity envelope is exported and correct', () => {
    strict_1.default.equal(nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE.baseline, 'unknown-mean-integrated');
    strict_1.default.equal(nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE.autocorrelation, 'ar1-whitened');
    strict_1.default.equal(nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE.null, 'mean-shift');
    strict_1.default.equal(nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE.variance, 'stable');
    strict_1.default.equal(nuisance_robust_bf_e_value_1.NUISANCE_ROBUST_BF_ENVELOPE.minCalibration, nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY);
    strict_1.default.equal(nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY, 100);
});
// ── Validity floor — the calibration gate that keeps the by-construction claim honest. ────────────
// Below MIN_CALIBRATION_FOR_VALIDITY the plug-in innovation variance makes E[BF|H0] ≫ 1 (cold-eye
// Finding 1: ~6.7 at cal=50, ~7e252 at cal=5). The gate refuses those windows rather than emit an
// e-value it cannot certify valid. This test would FAIL against a cal.len ≥ 3 floor.
(0, node_test_1.test)('floor: cal.len below MIN_CALIBRATION_FOR_VALIDITY throws; at/above it computes a valid e-value', () => {
    const v = ar1Stream(123, 1000, -1, 0);
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: 50 }, { start: 50, len: 200 }), RangeError, 'cal=50 < floor');
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY - 1 }, { start: nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY - 1, len: 200 }), RangeError, 'floor-1');
    const e = (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY }, { start: nuisance_robust_bf_e_value_1.MIN_CALIBRATION_FOR_VALIDITY, len: 200 });
    strict_1.default.ok(Number.isFinite(e) && e >= 0, `at the floor a finite e-value must be produced; got ${e}`);
});
// ── Guard rails — invalid windows / non-finite inputs throw (engine convention). ──────────────────
(0, node_test_1.test)('guards: invalid windows and non-finite inputs throw RangeError', () => {
    const v = ar1Stream(5, 1000, -1, 0);
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: 100 }, { start: 100, len: 1 }), RangeError, 'test.len < 2');
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: 100 }, { start: 0, len: 10 }), RangeError, 'test.start < 1');
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(v, { start: 0, len: 100 }, { start: 950, len: 100 }), RangeError, 'out of bounds');
    const withNaN = v.slice();
    withNaN[50] = NaN;
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(withNaN, { start: 0, len: 200 }, { start: 200, len: 100 }), RangeError, 'NaN in cal window');
    const withInf = v.slice();
    withInf[250] = Infinity;
    strict_1.default.throws(() => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(withInf, { start: 0, len: 200 }, { start: 251, len: 100 }), RangeError, 'Inf in test window');
});
//# sourceMappingURL=adr-0004-pr-a-nuisance-robust-bf-evalue.test.js.map