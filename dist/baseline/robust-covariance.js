"use strict";
// baseline/robust-covariance.ts — robust multivariate covariance for the L1 baseline kit (ADR 0019/0021).
//
// Ported VERBATIM (computation unchanged) from the original DeploySignal calibrators
// (tools/calibrators/_family-c-covariance.ts + _family-c-mcd.ts + _shared.ts) — the proven FastMCD +
// Ledoit-Wolf stack that builds a CLEAN-NULL per-cell covariance by trimming anomalies. ADR 0019 promotes it
// from product-tools into the engine L0 so every consumer shares one tested implementation instead of
// re-deriving it. The DS-specific Family-C orchestration (signal constants, config emission) is left to L1/L2;
// this module is the pure estimator + linalg.
//
// `robustCovariance(rows)` is the engine-facing entry: FastMCD (drop outliers → minimum-determinant h-subset)
// → reweight at the χ²₀.₉₇₅ cutoff → Croux–Haesbroeck consistency correction, with a Ledoit-Wolf fallback when
// the sample is too small/degenerate for MCD. Returns the robust mean/cov and the outlier fraction it trimmed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.choleskyLocal = choleskyLocal;
exports.columnMean = columnMean;
exports.sampleCovariance = sampleCovariance;
exports.mahalanobisSqFromL = mahalanobisSqFromL;
exports.chiSqQuantile975 = chiSqQuantile975;
exports.ledoitWolfShrinkage = ledoitWolfShrinkage;
exports.consistencyCorrectionFactor = consistencyCorrectionFactor;
exports.robustCovariance = robustCovariance;
// ── seeded PRNG + Cholesky (from _shared.ts) ────────────────────────────────────────────────────────────────
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Lower-triangular Cholesky; returns null if not positive-definite (used as the PSD gate). */
function choleskyLocal(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let s = A[i][j];
            for (let k = 0; k < j; k++)
                s -= L[i][k] * L[j][k];
            if (i === j) {
                if (s <= 0)
                    return null;
                L[i][i] = Math.sqrt(s);
            }
            else {
                L[i][j] = s / L[j][j];
            }
        }
    }
    return L;
}
// ── covariance helpers (from _family-c-covariance.ts) ───────────────────────────────────────────────────────
function columnMean(rows) {
    const p = rows[0].length;
    const m = new Array(p).fill(0);
    for (const r of rows)
        for (let i = 0; i < p; i++)
            m[i] += r[i];
    for (let i = 0; i < p; i++)
        m[i] /= rows.length;
    return m;
}
/** Sample covariance of mean-zero rows Z (n×p). */
function sampleCovariance(Z) {
    const n = Z.length, p = Z[0].length;
    const S = Array.from({ length: p }, () => new Array(p).fill(0));
    for (const z of Z)
        for (let i = 0; i < p; i++) {
            const zi = z[i];
            for (let j = 0; j < p; j++)
                S[i][j] += zi * z[j];
        }
    for (let i = 0; i < p; i++)
        for (let j = 0; j < p; j++)
            S[i][j] /= n;
    return S;
}
/** Mahalanobis distance² (z−mean)ᵀ Σ⁻¹ (z−mean) given Σ's Cholesky L. */
function mahalanobisSqFromL(z, mean, L) {
    const n = L.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let s = z[i] - mean[i];
        for (let k = 0; k < i; k++)
            s -= L[i][k] * y[k];
        y[i] = s / L[i][i];
    }
    let sum = 0;
    for (const v of y)
        sum += v * v;
    return sum;
}
function logDetCholesky(S) {
    const L = choleskyLocal(S);
    if (!L)
        return null;
    let d = 0;
    for (let i = 0; i < L.length; i++)
        d += Math.log(L[i][i]);
    return 2 * d;
}
/** Wilson-Hilferty χ²(0.975, p). */
function chiSqQuantile975(p) {
    const z = 1.95996398454005;
    const a = 1 - 2 / (9 * p);
    const b = z * Math.sqrt(2 / (9 * p));
    const root = a + b;
    return p * root * root * root;
}
/** Ledoit-Wolf shrinkage toward `μ_diag·I` (mean-zero input Z, n×p). Returns the shrunk cov + intensity λ. */
function ledoitWolfShrinkage(Z) {
    const n = Z.length, p = Z[0].length;
    const S = sampleCovariance(Z);
    let muDiag = 0;
    for (let i = 0; i < p; i++)
        muDiag += S[i][i];
    muDiag /= p;
    let dSq = 0;
    for (let i = 0; i < p; i++)
        for (let j = 0; j < p; j++) {
            const fij = i === j ? muDiag : 0;
            const diff = S[i][j] - fij;
            dSq += diff * diff;
        }
    let bBar2 = 0;
    for (const z of Z) {
        let normSq = 0;
        for (let i = 0; i < p; i++) {
            const zi = z[i];
            for (let j = 0; j < p; j++) {
                const diff = zi * z[j] - S[i][j];
                normSq += diff * diff;
            }
        }
        bBar2 += normSq;
    }
    bBar2 /= (n * n);
    const bSq = Math.min(bBar2, dSq);
    const lambda = dSq > 0 ? bSq / dSq : 0;
    const cov = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < p; i++)
        for (let j = 0; j < p; j++) {
            const fij = i === j ? muDiag : 0;
            cov[i][j] = lambda * fij + (1 - lambda) * S[i][j];
        }
    return { cov, lambda };
}
// ── Croux–Haesbroeck consistency correction (from _family-c-mcd.ts) ──────────────────────────────────────────
function beasleySpringerInverseNormal(p) {
    const y = p - 0.5;
    if (Math.abs(y) < 0.42) {
        const r = y * y;
        const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
        const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
        const num = ((a[3] * r + a[2]) * r + a[1]) * r + a[0];
        const den = (((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1;
        return y * num / den;
    }
    let r = p;
    if (y > 0)
        r = 1 - p;
    r = Math.log(-Math.log(r));
    const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 0.0276438810333863, 0.0038405729373609, 0.0003951896511919, 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
    const x = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
    return y < 0 ? -x : x;
}
function chiSqQuantileWH(alpha, k) {
    const z = beasleySpringerInverseNormal(alpha);
    const a = 2 / (9 * k);
    const base = 1 - a + z * Math.sqrt(a);
    return k * base * base * base;
}
function chiSqCdfWH(q, k) {
    if (q <= 0)
        return 0;
    const a = 2 / (9 * k);
    const z = (Math.pow(q / k, 1 / 3) - (1 - a)) / Math.sqrt(a);
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-0.5 * z * z);
    const pp = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - pp : pp;
}
/** Croux–Haesbroeck (1999) MCD consistency factor `c = α / F_{χ²_{p+2}}(q_{p,α})`; `Σ_corrected = c·Σ_MCD`. */
function consistencyCorrectionFactor(alpha, p) {
    if (alpha <= 0 || alpha >= 1 || p < 1)
        return 1;
    const q = chiSqQuantileWH(alpha, p);
    const f = chiSqCdfWH(q, p + 2);
    return f <= 0 ? 1 : alpha / f;
}
// ── FastMCD (from _family-c-mcd.ts) ─────────────────────────────────────────────────────────────────────────
const FASTMCD_N_INITIAL_SUBSETS = 500, FASTMCD_CSTEP_LIMIT = 20, FASTMCD_TOP_N_FOR_FULL = 10, FASTMCD_DEFAULT_ALPHA = 0.75, FASTMCD_DEFAULT_SEED = 0xFA5DA >>> 0;
function cStep(rows, currentMean, currentCov, h) {
    const L = choleskyLocal(currentCov);
    if (!L)
        return null;
    const distances = [];
    for (let i = 0; i < rows.length; i++)
        distances.push({ idx: i, d2: mahalanobisSqFromL(rows[i], currentMean, L) });
    distances.sort((a, b) => a.d2 - b.d2);
    const indices = distances.slice(0, h).map((d) => d.idx);
    const kept = indices.map((i) => rows[i]);
    const mean = columnMean(kept);
    const cov = sampleCovariance(kept.map((r) => r.map((v, i) => v - mean[i])));
    const logDet = logDetCholesky(cov);
    if (logDet === null)
        return null;
    return { mean, cov, indices, logDet };
}
function initialSubsetEstimate(rows, rng) {
    const n = rows.length, p = rows[0].length;
    const indices = new Set();
    while (indices.size < p + 1)
        indices.add(Math.floor(rng() * n));
    const expand = () => {
        const kept = [...indices].map((i) => rows[i]);
        const mean = columnMean(kept);
        const cov = sampleCovariance(kept.map((r) => r.map((v, i) => v - mean[i])));
        return choleskyLocal(cov) ? { mean, cov } : null;
    };
    let est = expand();
    while (est === null && indices.size < n) {
        let added = false;
        while (!added) {
            const j = Math.floor(rng() * n);
            if (!indices.has(j)) {
                indices.add(j);
                added = true;
            }
        }
        est = expand();
    }
    return est;
}
function fastMCD(rows, alpha, seed) {
    const n = rows.length, p = rows[0].length;
    if (n < p + 1)
        return null;
    const h = Math.max(p + 1, Math.ceil(alpha * n));
    const rng = mulberry32(seed);
    const candidates = [];
    for (let t = 0; t < FASTMCD_N_INITIAL_SUBSETS; t++) {
        const seed0 = initialSubsetEstimate(rows, rng);
        if (!seed0)
            continue;
        const step = cStep(rows, seed0.mean, seed0.cov, h);
        if (!step)
            continue;
        const step2 = cStep(rows, step.mean, step.cov, h);
        if (step2)
            candidates.push(step2);
    }
    if (candidates.length === 0)
        return null;
    candidates.sort((a, b) => a.logDet - b.logDet);
    let best = null;
    for (const cand of candidates.slice(0, FASTMCD_TOP_N_FOR_FULL)) {
        let current = cand;
        for (let iter = 0; iter < FASTMCD_CSTEP_LIMIT; iter++) {
            const next = cStep(rows, current.mean, current.cov, h);
            if (!next)
                break;
            if (Math.abs(next.logDet - current.logDet) < 1e-10) {
                current = next;
                break;
            }
            current = next;
        }
        if (best === null || current.logDet < best.logDet)
            best = current;
    }
    if (best === null)
        return null;
    return { mean: best.mean, cov: best.cov, supportIndices: best.indices.slice().sort((a, b) => a - b) };
}
function mcdReweight(rows, mcdMean, mcdCov) {
    const p = rows[0].length;
    const cutoff = chiSqQuantile975(p);
    const L = choleskyLocal(mcdCov);
    if (!L)
        return null;
    const kept = [];
    for (let i = 0; i < rows.length; i++)
        if (mahalanobisSqFromL(rows[i], mcdMean, L) <= cutoff)
            kept.push(rows[i]);
    if (kept.length < p + 1)
        return null;
    const mean = columnMean(kept);
    const cov = sampleCovariance(kept.map((r) => r.map((v, i) => v - mean[i])));
    if (!choleskyLocal(cov))
        return null;
    return { mean, cov, keptCount: kept.length };
}
/** Robust multivariate mean + covariance with anomaly trimming (the clean-null estimator). FastMCD → reweight
 *  → Croux–Haesbroeck consistency correction when the sample is large enough; Ledoit-Wolf shrinkage otherwise
 *  (or if MCD degenerates). The covariance is the input each per-cell multivariate baseline needs.
 *  @throws RangeError on empty/ragged input. */
function robustCovariance(rows, opts) {
    const fn = 'robustCovariance';
    const n = rows.length;
    if (n === 0)
        throw new RangeError(`${fn}: rows must be non-empty`);
    const p = rows[0].length;
    if (p === 0)
        throw new RangeError(`${fn}: rows must have ≥ 1 dimension`);
    for (let i = 0; i < n; i++) {
        if (rows[i].length !== p)
            throw new RangeError(`${fn}: ragged rows — row ${i} has ${rows[i].length} dims, expected ${p}`);
        for (let j = 0; j < p; j++)
            if (!Number.isFinite(rows[i][j]))
                throw new RangeError(`${fn}: non-finite value at [${i}][${j}]`);
    }
    const alpha = opts?.alpha ?? FASTMCD_DEFAULT_ALPHA;
    const seed = opts?.seed ?? FASTMCD_DEFAULT_SEED;
    const minPerDim = opts?.minSamplesPerDim ?? 5;
    const R = rows.map((r) => r.slice());
    const lwFallback = () => {
        const mean = columnMean(R);
        const { cov, lambda } = ledoitWolfShrinkage(R.map((r) => r.map((v, i) => v - mean[i])));
        return { mean, cov, method: 'ledoit_wolf', outlierFraction: 0, lambda };
    };
    if (n < Math.max(minPerDim * p, p + 1))
        return lwFallback();
    const mcd = fastMCD(R, alpha, seed);
    if (!mcd)
        return lwFallback();
    // Proper reweighting (RMCD, Rousseeuw–Van Driessen): the cutoff uses the consistency-CORRECTED MCD cov
    // (the raw MCD cov under-estimates and over-flags clean points), and the final reweighted sample cov gets
    // the (small, ~1.0) reweight-coverage factor c_{0.975}. So clean data trims ≈2.5%, not ~18%.
    const cAlpha = consistencyCorrectionFactor(alpha, p);
    const cutoffCov = mcd.cov.map((row) => row.map((v) => v * cAlpha));
    const rw = mcdReweight(R, mcd.mean, cutoffCov);
    if (!rw)
        return lwFallback();
    const cReweight = consistencyCorrectionFactor(0.975, p);
    const cov = rw.cov.map((row) => row.map((v) => v * cReweight));
    return { mean: rw.mean, cov, method: 'mcd', outlierFraction: 1 - rw.keptCount / n };
}
//# sourceMappingURL=robust-covariance.js.map