"use strict";
// fleet/multi-factor-common-mode.ts — the contamination-robust MULTI-FACTOR common-mode.
//
// ADR 0008 (productionises ADR 0007 frontier #2). Generalises the contamination-robust SCALAR
// common-mode (`fleet/common-mode.ts`, ADR 0004 PR B) to HETEROGENEOUS factor loadings. PR B removes
// a per-tick scalar center c_t — valid only when every shard responds to the shared factor with the
// SAME gain (homogeneous loading). On a fleet where shard i loads the factor with gain λ_i (e.g.
// different workload sensitivities), the scalar center leaks the factor into the residual proportional
// to (λ_i − mean(λ)), which the per-shard e-value then false-fires on (measured: FDP 0.62 ≫ q).
//
// CONSTRUCTION. Model X[i][t] = ℓ_i + Σ_{k≤r} λ_{ik} F_k[t] + ε[i][t]. Remove each shard's calibration
// LEVEL ℓ̂_i (median), then fit r common factors by ALTERNATING ROBUST regression (a robust PCA): for
// each factor, iterate
//     F̂_k[t] = robust slope of the cross-section {D[i][t]} on the loadings {λ̂_{ik}}   (per tick),
//     λ̂_{ik} = robust slope of shard i's FULL series {D[i][·]} on {F̂_k[·]}             (per shard),
// using a redescending Tukey-biweight weight, then deflate. Residual R[i][t] = D[i][t] − Σ_k λ̂_{ik} F̂_k[t].
// The per-shard fit over the FULL series (not just calibration) is load-bearing: it pins λ̂_i using the
// large factor excursions in the test window, removing the residual leakage (λ_i − λ̂_i)·F[t] that the
// raw factor amplitude would otherwise blow up (a calibration-only loading fit leaves FDP ≈ 0.17).
//
// HONEST LIMITS (cold-eyed — these are load-bearing, do NOT treat the FDP guarantee as unconditional):
//   • FAULT ABSORPTION → the power cost. A constant fault step in the test window CORRELATES with the
//     nonzero-mean test-window factor, so the full-series loading fit partly explains the step as λ·F:
//     ~40% of a step fault is absorbed (faulty-shard λ̂ inflated ~7%). Robustness mitigates but does not
//     prevent this — it is the DOMINANT driver of the power cost, not a free "price of fitting".
//   • POWER IS STEP-DEPENDENT. At a ~2.5σ step, power ≈ 0.7; it falls steeply for smaller faults
//     (≈0.5 at ~1.5σ, ≈0.1 at ~0.75σ) because absorption removes a fixed FRACTION of the step.
//   • r MUST MATCH THE TRUE FACTOR RANK (the FDP ≤ q guarantee is conditional on it):
//       – r too SMALL (under-specified) → residual factor leakage → FDP inflates (true r=2, fit r=1: FDP≈0.25).
//       – r too LARGE (over-specified) → the extra factors fit and remove the fault structure → power
//         SILENTLY collapses to ~0. There is no auto-selection here; use {@link factorDeflationEnergy}
//         (a scree) to choose r — pick where the per-factor energy drops to the noise floor.
//   • On HOMOGENEOUS loadings it reduces TOWARD the scalar center (the first factor's first pass with
//     λ≡1 IS PR B's robustLocation per-tick center), but not exactly (subsequent passes + the loading
//     fit move it; rms difference ≈ 0.2 on null data).
//   • Faults must stay a minority (~20% breakdown, verified); the factor structure is assumed STABLE
//     across cal/test (a CHANGE in it is the Barigozzi–Trapani regime, out of scope). In-sample fit
//     (O(1/N) self-pull, conservative as PR B). Cost O(n·t·passes·IRLS) — heavier than the scalar center.
Object.defineProperty(exports, "__esModule", { value: true });
exports.median = median;
exports.robustSlope = robustSlope;
exports.perShardLevel = perShardLevel;
exports.multiFactorRobustResiduals = multiFactorRobustResiduals;
exports.factorDeflationEnergy = factorDeflationEnergy;
const common_mode_1 = require("./common-mode");
const IRLS_MAX_ITER = 40;
const IRLS_TOL = 1e-8;
const ALT_PASSES = 6;
/** Median of a sample (0 for empty). Exported for the detection-oriented common-mode (ADR 0017). */
function median(xs) {
    if (xs.length === 0)
        return 0;
    const s = [...xs].sort((a, b) => a - b);
    const n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
/** Redescending (Tukey-biweight) robust regression slope through the origin: y_i ≈ b·x_i. IRLS from a
 *  median-ratio start with a MAD scale; gross outliers (in either coordinate) get weight 0. Exported for the
 *  detection-oriented common-mode (ADR 0017). */
function robustSlope(x, y, c = 4.685) {
    const n = x.length;
    const ratios = [];
    for (let i = 0; i < n; i++)
        if (Math.abs(x[i]) > 1e-9)
            ratios.push(y[i] / x[i]);
    let b = median(ratios);
    for (let it = 0; it < IRLS_MAX_ITER; it++) {
        const absRes = [];
        for (let i = 0; i < n; i++)
            absRes.push(Math.abs(y[i] - b * x[i]));
        const scale = Math.max(median(absRes) * 1.4826, 1e-9);
        let a = 0, d = 0;
        for (let i = 0; i < n; i++) {
            const u = (y[i] - b * x[i]) / (c * scale);
            const w = Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0;
            a += w * x[i] * y[i];
            d += w * x[i] * x[i];
        }
        if (d < 1e-9)
            break;
        const next = a / d;
        if (Math.abs(next - b) < IRLS_TOL) {
            b = next;
            break;
        }
        b = next;
    }
    return b;
}
/** Per-shard level ℓ̂_i = median over the healthy calibration window [0, calLen). */
function perShardLevel(X, calLen) {
    return X.map((row) => median(row.slice(0, calLen)));
}
/** Validate the matrix + calLen; returns [n, t]. */
function validateMatrix(X, calLen, fn) {
    const n = X.length;
    if (n === 0)
        throw new RangeError(`${fn}: X must have at least one shard`);
    const t = X[0].length;
    if (t === 0)
        throw new RangeError(`${fn}: shard rows must be non-empty`);
    for (let i = 0; i < n; i++) {
        if (X[i].length !== t)
            throw new RangeError(`${fn}: ragged matrix — row ${i} has length ${X[i].length}, expected ${t}`);
        for (let j = 0; j < t; j++)
            if (!Number.isFinite(X[i][j]))
                throw new RangeError(`${fn}: non-finite value at [${i}][${j}]`);
    }
    if (!Number.isInteger(calLen) || calLen < 1 || calLen > t) {
        throw new RangeError(`${fn}: calLen must be an integer in 1..${t}; got ${calLen}`);
    }
    return [n, t];
}
/** One alternating robust factor fit + deflation, in place on D. Returns the Frobenius energy this
 *  factor removed (Σ (λ̂_i F̂_t)²). */
function fitOneFactor(D, n, t) {
    const lam = new Array(n).fill(1); // homogeneous start ⇒ first F̂ pass = the robust per-tick center
    const F = new Array(t).fill(0);
    const col = new Array(n);
    for (let pass = 0; pass < ALT_PASSES; pass++) {
        for (let j = 0; j < t; j++) {
            for (let i = 0; i < n; i++)
                col[i] = D[i][j];
            // First pass with λ≡1 is exactly the redescending per-tick center (PR B's robustLocation).
            F[j] = pass === 0 ? (0, common_mode_1.robustLocation)(col) : robustSlope(lam, col);
        }
        for (let i = 0; i < n; i++)
            lam[i] = robustSlope(F, D[i]);
    }
    let energy = 0;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < t; j++) {
            const c = lam[i] * F[j];
            energy += c * c;
            D[i][j] -= c;
        }
    return energy;
}
/** Contamination-robust MULTI-FACTOR residual matrix R[i][t] = X[i][t] − ℓ̂_i − Σ_k λ̂_{ik} F̂_k[t], via an
 *  alternating robust (Tukey-biweight) factor fit. The generalisation of `contaminationRobustResiduals`
 *  to heterogeneous factor loadings; feed each row to the per-shard e-value then e-BH. The FDP ≤ q
 *  guarantee is CONDITIONAL on `factors` matching the true factor rank and a minority fault fraction
 *  (~20% breakdown); see the file header for the honest limits (including the ~40% fault-step absorption
 *  that drives the power cost).
 *
 *  @throws RangeError if `X` is empty, rows are ragged, any value is non-finite, `calLen` is not in
 *    1..ticks, or `factors` is not a positive integer < the shard count. */
function multiFactorRobustResiduals(X, calLen, opts) {
    const [n, t] = validateMatrix(X, calLen, 'multiFactorRobustResiduals');
    const r = opts?.factors ?? 1;
    if (!Number.isInteger(r) || r < 1 || r >= n) {
        throw new RangeError(`multiFactorRobustResiduals: factors must be an integer in 1..${n - 1}; got ${r}`);
    }
    const lvl = perShardLevel(X, calLen);
    const D = X.map((row, i) => row.map((x) => x - lvl[i]));
    for (let k = 0; k < r; k++)
        fitOneFactor(D, n, t);
    return D;
}
/** Scree diagnostic for choosing `factors`: the fraction of the level-demeaned Frobenius energy that
 *  each successive robust factor removes (factor 1, 2, …, up to `maxFactors`). A true factor removes a
 *  large fraction; once the per-factor fraction drops to the noise floor (a flat tail), further factors
 *  are spurious and would only destroy power. Pick `factors` at that elbow.
 *
 *  @throws RangeError on an invalid matrix/calLen, or `maxFactors` not in 1..(shards−1). */
function factorDeflationEnergy(X, calLen, maxFactors) {
    const [n, t] = validateMatrix(X, calLen, 'factorDeflationEnergy');
    if (!Number.isInteger(maxFactors) || maxFactors < 1 || maxFactors >= n) {
        throw new RangeError(`factorDeflationEnergy: maxFactors must be an integer in 1..${n - 1}; got ${maxFactors}`);
    }
    const lvl = perShardLevel(X, calLen);
    const D = X.map((row, i) => row.map((x) => x - lvl[i]));
    let total = 0;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < t; j++)
            total += D[i][j] * D[i][j];
    total = Math.max(total, 1e-12);
    const out = [];
    for (let k = 0; k < maxFactors; k++)
        out.push(fitOneFactor(D, n, t) / total);
    return out;
}
//# sourceMappingURL=multi-factor-common-mode.js.map