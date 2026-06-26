"use strict";
// fleet/instrumented-common-mode.ts — the per-shard loading model on INSTRUMENTED common-mode (ADR 0018).
//
// WHY THIS EXISTS. Localisation needs the common-mode removed accurately. ADR 0017 showed that ESTIMATING the
// crossed factor decomposition from the GPU signals alone (in-sample, leave-group-out, or learned-from-
// history) does not work — the factors are not identifiable from the GPU mixture with enough per-loading
// precision, and the residual leakage (λ_error)·F scales with the large factor excursions and swamps the
// fault. ADR 0018 validated the alternative: when the common-mode factors are KNOWN — i.e. MEASURED from the
// infrastructure (per-CDU cooling/inlet temp, per-PDU power draw, network/switch counters, scheduler job
// allocation) — a simple per-shard regression on them recovers near-oracle residuals, and localisation works
// (rack-level top-1 ≈ 80–100% at ≤10% factor measurement noise; ≈ the true-factor oracle).
//
// CONSTRUCTION (per shard, stateless, fit on the healthy reference window):
//   1. level-remove the shard (median over [0, calLen));
//   2. CENTRE each factor signal on the reference window (median over [0, calLen)) — load-bearing; an
//      un-centred regression biases the loadings;
//   3. regress the shard's level-removed series on ITS factors (membership) over [0, calLen) → loadings λ;
//   4. residual[i][t] = (X[i][t] − level_i) − Σ_k λ_{i,k}·centredFactor_k[t], over ALL ticks.
// A fault in the test window is preserved because λ is fit on the (healthy) reference window and the factors
// are exogenous (the fault cannot move them) — so unlike the estimated common-mode, there is no in-sample
// degree of freedom for the fault to be absorbed into.
//
// SCOPE / HONESTY.
//   • This is a RANKING / localisation tool (feed residuals to a per-shard detector + topology-partitioned
//     e-BH; see `fleet/localize.ts`). It is NOT a per-shard FDR guarantee: it removes the COMMON-MODE
//     accurately, but a shard's OWN within-window idiosyncratic nonstationarity (not captured by any shared
//     factor) is irreducible (ADR 0012), so the per-shard validity ceiling stands.
//   • It REQUIRES instrumented factor signals. With incomplete instrumentation the un-instrumented common-mode
//     leaks; with noisy signals (≳ ~15%) localisation degrades (ADR 0018). Garbage factors in → garbage out.
//   • Stateless per-window fit. Persisting/accumulating loadings over healthy windows (the warm-start
//     extension) is a later layer; this is the per-window primitive.
Object.defineProperty(exports, "__esModule", { value: true });
exports.instrumentedCommonModeResiduals = instrumentedCommonModeResiduals;
const multi_factor_common_mode_1 = require("./multi-factor-common-mode");
/** Solve `(A + ridge·I) x = b` for small symmetric `A` (k×k) via Gaussian elimination with partial pivoting.
 *  Returns `null` if singular (caller falls back to no removal). `A` and `b` are mutated. */
function solveRidge(A, b, ridge) {
    const k = b.length;
    for (let i = 0; i < k; i++)
        A[i][i] += ridge;
    for (let i = 0; i < k; i++) {
        let p = i;
        for (let r = i + 1; r < k; r++)
            if (Math.abs(A[r][i]) > Math.abs(A[p][i]))
                p = r;
        [A[i], A[p]] = [A[p], A[i]];
        [b[i], b[p]] = [b[p], b[i]];
        const d = A[i][i];
        if (Math.abs(d) < 1e-12)
            return null;
        for (let r = 0; r < k; r++) {
            if (r === i)
                continue;
            const f = A[r][i] / d;
            for (let c = i; c < k; c++)
                A[r][c] -= f * A[i][c];
            b[r] -= f * b[i];
        }
    }
    return b.map((v, i) => v / A[i][i]);
}
/** Per-shard residuals after removing the INSTRUMENTED common-mode (ADR 0018). For each shard, the loadings on
 *  its (measured) factor signals are fit by least squares on the healthy reference window, then subtracted over
 *  all ticks — so a test-window fault is preserved, not absorbed. Feed the residuals to a per-shard detector +
 *  topology-partitioned e-BH for localisation (RANKING, not an FDR guarantee — see the file header).
 *
 *  @param X             `[shard][tick]` counter matrix.
 *  @param calLen        healthy reference-window length `[0, calLen)` for the level, the loading fit, and the
 *                       factor centring.
 *  @param factorSignals `[factor][tick]` the measured common-mode signals (one row per instrumented factor:
 *                       a CDU temp, a PDU power, a pod/rail network counter, a job allocation, …).
 *  @param membership    per shard, the factor indices it loads on (its domains): `membership[i]` ⊆
 *                       `0..factorSignals.length-1`. An empty list ⇒ that shard keeps its level-removed series.
 *  @param opts          `ridge` (default 0) to stabilise collinear per-shard fits.
 *  @throws RangeError on an empty/ragged/non-finite `X`, `calLen` ∉ `1..ticks`, a factor signal of the wrong
 *    length or non-finite, `membership` length ≠ shard count, or a membership index out of range. */
function instrumentedCommonModeResiduals(X, calLen, factorSignals, membership, opts) {
    const fn = 'instrumentedCommonModeResiduals';
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
    const nf = factorSignals.length;
    for (let k = 0; k < nf; k++) {
        if (factorSignals[k].length !== t)
            throw new RangeError(`${fn}: factor ${k} has length ${factorSignals[k].length}, expected ${t}`);
        for (let j = 0; j < t; j++)
            if (!Number.isFinite(factorSignals[k][j]))
                throw new RangeError(`${fn}: non-finite factor value at [${k}][${j}]`);
    }
    if (membership.length !== n) {
        throw new RangeError(`${fn}: membership has length ${membership.length}, expected one entry per shard (${n})`);
    }
    const ridge = opts?.ridge ?? 0;
    if (!(ridge >= 0))
        throw new RangeError(`${fn}: ridge must be >= 0; got ${ridge}`);
    // Centre each factor on the reference window (load-bearing — an un-centred fit biases the loadings).
    const cf = factorSignals.map((f) => {
        const c = (0, multi_factor_common_mode_1.median)(f.slice(0, calLen));
        return f.map((v) => v - c);
    });
    const R = new Array(n);
    for (let i = 0; i < n; i++) {
        const lvl = (0, multi_factor_common_mode_1.median)(X[i].slice(0, calLen));
        const row = X[i].map((v) => v - lvl);
        const idx = membership[i];
        if (idx.length === 0) {
            R[i] = row;
            continue;
        }
        const regs = new Array(idx.length);
        for (let a = 0; a < idx.length; a++) {
            const fk = idx[a];
            if (!Number.isInteger(fk) || fk < 0 || fk >= nf) {
                throw new RangeError(`${fn}: membership[${i}] index ${fk} out of range 0..${nf - 1}`);
            }
            regs[a] = cf[fk];
        }
        // Normal equations on the reference window: A = Zᵀ Z, b = Zᵀ y.
        const k = regs.length;
        const A = Array.from({ length: k }, () => new Array(k).fill(0));
        const b = new Array(k).fill(0);
        for (let a = 0; a < k; a++) {
            for (let c = a; c < k; c++) {
                let z = 0;
                for (let j = 0; j < calLen; j++)
                    z += regs[a][j] * regs[c][j];
                A[a][c] = z;
                A[c][a] = z;
            }
            let zy = 0;
            for (let j = 0; j < calLen; j++)
                zy += regs[a][j] * row[j];
            b[a] = zy;
        }
        const lam = solveRidge(A, b, ridge);
        if (lam) {
            for (let j = 0; j < t; j++) {
                let cm = 0;
                for (let a = 0; a < k; a++)
                    cm += lam[a] * regs[a][j];
                row[j] -= cm;
            }
        } // singular ⇒ leave the level-removed row (no removal) rather than inject garbage
        R[i] = row;
    }
    return R;
}
//# sourceMappingURL=instrumented-common-mode.js.map